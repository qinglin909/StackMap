/* 无浏览器冒烟测试：用最小 DOM 桩加载前端脚本，逐个渲染页面、校验导入解析与决策树可达性。
 * 运行：node tools/smoke-test.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const ok = (cond, msg) => { if (!cond) errors.push(msg); };

// ---- 最小 DOM 桩 ----
const els = {};
function makeEl(id) {
  return {
    id, innerHTML: '', textContent: '', value: '', files: [], scrollTop: 0,
    style: { setProperty() {} },
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    querySelector() { return null; }, querySelectorAll() { return []; },
    getAttribute() { return null; }, appendChild() {}, remove() {}, focus() {},
    closest() { return null; }, addEventListener() {}
  };
}
global.window = global;
global.location = { protocol: 'file:', hash: '#/home' };
Object.defineProperty(global, 'navigator', { value: { clipboard: null }, configurable: true, writable: true });
global.localStorage = {
  _d: {}, getItem(k) { return this._d[k] == null ? null : this._d[k]; },
  setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; }
};
global.requestAnimationFrame = (fn) => fn();
global.document = {
  documentElement: { dataset: {}, style: { setProperty() {} } },
  body: { appendChild() {} },
  getElementById(id) { return els[id] || (els[id] = makeEl(id)); },
  querySelectorAll() { return []; },
  querySelector() { return null; },
  addEventListener() {},
  createElement() { return makeEl('tmp'); },
  execCommand() { return true; }
};
global.addEventListener = () => {};
global.confirm = () => false;

// ---- 加载脚本 ----
for (const f of ['data.js', 'core.js', 'cards.js', 'app.js']) {
  try { vm.runInThisContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), { filename: f }); }
  catch (e) { errors.push(`加载 ${f} 失败：${e.message}\n${e.stack}`); }
}
await new Promise((r) => setImmediate(r));
if (errors.length) { console.error('脚本加载阶段出错：\n' + errors.join('\n')); process.exit(1); }
const KB = global.KB;
if (!KB) { console.error('✗ KB 未初始化'); process.exit(1); }
ok(KB.methods().length >= 14, '仓库条目未加载');
ok(KB.state.mode === 'snapshot', 'file:// 应回退到离线快照');

// ---- 页面渲染 ----
const routes = [
  '#/home', '#/admin', '#/favorites', '#/chains', '#/chain/c.upload?at=m.fe.uploadFile',
  '#/scene', '#/troubleshoot', '#/troubleshoot/t.upload.stuck',
  '#/entry/m.fe.uploadFile', '#/entry/m.fe.uploadFile?tab=why', '#/entry/m.fe.uploadFile?tab=alternatives',
  '#/entry/m.fe.uploadFile?tab=fallback', '#/entry/m.be.verifyUploadCallback?tab=chain',
  '#/entry/m.be.idempotentGuard?tab=examples', '#/entry/m.be.idempotentGuard?tab=pitfalls',
  '#/cards', '#/cards/m.fe.uploadFile'
];
for (const r of routes) {
  global.location.hash = r;
  KB.state.route = KB.parseHash();
  KB.state.context = [];
  try {
    KB.render();
    const html = els.main.innerHTML;
    ok(html.length > 300, `页面 ${r} 渲染内容过短 (${html.length})`);
    ok(!html.includes('undefined>'), `页面 ${r} 出现 undefined 文本`);
  } catch (e) { errors.push(`页面 ${r} 渲染抛错：${e.message}\n${e.stack}`); }
}

// ---- 8 类卡片逐一渲染 ----
const m = KB.byId('m.fe.uploadFile');
for (let i = 0; i < 8; i++) {
  try {
    const html = KB.cards.body(m, i);
    ok(html.length > 200, `卡 ${i + 1} 内容过短`);
  } catch (e) { errors.push(`卡 ${i + 1} 渲染抛错：${e.message}`); }
}
try { ok(KB.cards.shell(m, 6).includes('<svg'), '链路卡未生成 SVG'); }
catch (e) { errors.push('链路卡外壳渲染抛错：' + e.message); }

// ---- 验收标准 ----
const v = KB.validateAll();
ok(v.errors.length === 0, '验收校验存在错误：' + v.errors.slice(0, 3).join('；'));

// ---- Markdown 导入 ----
const mdDir = path.join(ROOT, 'content/methods');
for (const f of fs.readdirSync(mdDir).filter((x) => x.endsWith('.md'))) {
  const e = KB.parseMarkdown(fs.readFileSync(path.join(mdDir, f), 'utf8'));
  const r = KB.validateEntry(e);
  ok(!r.errors.length, `${f} 导入后校验不通过：${r.errors.join('；')}`);
  ok(e.fallback.length >= 3, `${f} 兜底未按层分组`);
  ok(e.fallback.every((x) => x.codeSnippet && x.monitoring && x.strategy), `${f} 兜底缺三要素`);
  ok(e.examples.length > 0 && e.examples[0].code, `${f} 示例解析失败`);
  ok(e.alternatives.length >= 2 && e.alternatives[0].codeSnippet, `${f} 替代方案代码解析失败`);
}

// ---- 决策树：所有 END 路径必须有推荐结果 ----
for (const e of KB.methods()) {
  const t = e.decisionTree;
  if (!t) continue;
  const qmap = Object.fromEntries((t.questions || []).map((q) => [q.id, q]));
  const stack = [{ id: (t.questions || [])[0].id, ans: {} }];
  let paths = 0, uncovered = 0;
  while (stack.length) {
    const cur = stack.pop();
    const q = qmap[cur.id];
    if (!q) continue;
    for (const o of q.options || []) {
      const ans = Object.assign({}, cur.ans, { [q.id]: o.value });
      if (o.next === 'END') {
        paths++;
        const hit = (t.rules || []).some((r) => Object.entries(r.when || {}).every(([k, v]) => ans[k] === v));
        if (!hit && !t.defaultResult) uncovered++;
      } else stack.push({ id: o.next, ans });
    }
  }
  ok(paths > 0, `${e.id} 决策树无可达结果`);
  ok(uncovered === 0, `${e.id} 决策树有 ${uncovered} 条路径无推荐方案且无默认结果`);
}

// ---- 排查流可达性 ----
for (const f of KB.flows()) {
  const ids = new Set(f.steps.map((s) => s.id));
  ok(ids.has(f.steps[0].id), `${f.id} 起始步骤缺失`);
  for (const s of f.steps) for (const o of s.options) {
    ok(o.next === 'RESULT' || ids.has(o.next), `${f.id}/${s.id} 选项指向不存在步骤 ${o.next}`);
  }
}

// ---- 搜索 / 场景反查 / 导出 ----
ok(KB.filterMethods().length === KB.methods().length, '空筛选未返回全部条目');
KB.state.search = { q: '幂等', layers: ['backend'], tags: [] };
ok(KB.filterMethods().length > 0, '按层 + 关键词组合筛选失败');
KB.state.search = { q: '', layers: [], tags: [] };
ok(KB.sceneSearch('做文件上传').length > 0, '场景反查无结果');
ok(KB.sceneSearch('防止重复下单').length > 0, '场景反查（幂等）无结果');
KB.state.favorites = [{ key: 'k', methodId: m.id, methodName: m.name, layer: 'frontend', failureMode: '测试', strategy: '策略', codeSnippet: '// code', monitoring: 'metric', addedAt: KB.today() }];
const md = KB.favoritesMarkdown();
ok(md.includes('代码模板') && md.includes('监控项') && md.includes('前端 层'), '预案导出格式不完整');

// ---- 输出 ----
if (errors.length) {
  console.error(`\n✗ 冒烟测试失败，共 ${errors.length} 项：`);
  errors.forEach((e) => console.error('  - ' + e));
  process.exit(1);
}
console.log(`✓ 页面渲染 ${routes.length} 个 / 8 类卡片 / 2 个 Markdown 导入 / ${KB.methods().length} 个条目校验`);
console.log('✓ 决策树 END 路径全部有推荐方案；排查流步骤可达；过滤 / 场景反查 / 预案导出正常');
