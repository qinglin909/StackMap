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
for (const f of ['data.js', 'core.js', 'v2.js', 'cards.js', 'views2.js', 'app.js']) {
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
  '#/cards', '#/cards/m.fe.uploadFile',
  // 2.0 新增页面与 IDE 深链
  '#/incidents', '#/incident/i.upload.callback', '#/drafts', '#/progress',
  '#/impact', '#/impact?id=m.fe.uploadFile',
  '#/entry/by-name/useUploadQueue?ref=apps/web/src/upload/useUploadQueue.ts&line=15',
  '#/entry/m.fe.uploadFile?ref=apps/web/src/upload/uploadFileToOSS.ts&line=21'
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

// ---- 2.0：F11 向量语义检索 ----
ok(KB.sceneSearch('做文件上传').length > 0, '2.0 场景反查（文件上传）无结果');
ok(KB.sceneSearch('防止重复下单').length > 0, '2.0 场景反查（幂等）无结果');
const vecHit = KB.sceneSearch('做文件上传')[0];
ok(vecHit && vecHit.score > 0 && vecHit.score <= 99, '向量相关度未在 0–99 区间');
ok(KB.semanticMode() === 'local-tfidf', '默认应回退本地 TF-IDF 向量检索');
const asyncRes = await KB.sceneSearchAsync('上传失败怎么重试');
ok(Array.isArray(asyncRes) && asyncRes.length > 0, '未启用远程服务时异步检索应等价回退本地');

// ---- 2.0：F12 事故录入 ----
const inc = KB.incidentTemplate();
Object.assign(inc, {
  title: '冒烟测试事故', symptom: '上传回调重复', rootCause: '缺少幂等键', improvement: '补幂等兜底',
  relatedMethodIds: [m.id], missingFallbacks: [{ layer: 'frontend', item: '无重试提示', expected: '应有前端重试提示' }]
});
ok(KB.validateIncident(inc).length === 0, '事故录入校验失败：' + KB.validateIncident(inc).join('；'));
KB.saveIncident(inc);
ok(KB.incidents().some((i) => i.id === inc.id), '本地录入的事故未出现在 KB.incidents()');
ok(KB.incidentsOf(m.id).some((i) => i.id === inc.id), '事故未关联到方法（卡 8 读不到）');
KB.state.incidentSelect = inc.id;
ok(KB.cards.body(m, 7).includes('无重试提示'), '本地录入事故未出现在踩坑复盘卡（字段契约不一致）');
ok(KB.incidentsMarkdown().includes('冒烟测试事故'), '事故导出 Markdown 缺内容');
KB.deleteIncident(inc.id);
ok(!KB.incidents().some((i) => i.id === inc.id), '删除事故未生效');

// ---- 2.0：F13 草稿生成与人工审核门禁 ----
const gen = await KB.generateDraft({ name: 'smokeDraft', layer: 'frontend', scene: '弱网下断点续传' });
ok(gen.entry && gen.source === 'local-heuristic', '未配置 LLM 时应走本地启发式起草');
const dv = KB.validateEntry(gen.entry);
ok(dv.errors.length === 0, 'AI 草稿未通过验收校验：' + dv.errors.join('；'));
const draft = KB.makeDraft({ name: 'smokeDraft' }, gen.entry, gen.source);
ok(draft.status === 'draft', '新草稿状态应为待审核');
ok(!KB.approveDraft(draft.id, 'tester').ok, '未人工核实的草稿不应允许入库（审核门禁失效）');
draft.status = 'reviewed'; KB.saveDraft(draft);
const approved = KB.approveDraft(draft.id, 'tester');
ok(approved.ok, '已核实草稿批准入库失败：' + approved.message);
ok(KB.byId(gen.entry.id) !== null, '批准后的条目未进入本地覆盖层');
ok(KB.draftToMarkdown(draft).includes('四问草稿') && KB.draftToMarkdown(draft).includes('对比结论'), '草稿导出格式不完整');

// ---- 2.0：F14 IDE 深链 ----
ok(KB.resolveByName('useUploadQueue') !== null, '按方法名解析条目失败');
ok(KB.deepLink(m, 'apps/web/src/x.ts', 12).includes('#/entry/' + m.id), '固定 id 深链格式错误');
ok(KB.byNameDeepLink(m).includes('by-name'), '按名深链格式错误');

// ---- 2.0：F15 links 骨架 ----
const sk = KB.linksSkeleton();
ok(sk && sk.entries.length >= 14, 'links 骨架未随快照打包');
const sd = KB.skeletonDiff(KB.byId('m.fe.useUploadQueue'));
ok(sd && sd.entry && sd.diff.downstream, '骨架差异计算失败');
const ap = KB.applySkeleton('m.fe.useUploadQueue');
ok(ap.ok, '采纳骨架建议失败：' + ap.message);
ok((KB.byId('m.fe.useUploadQueue').links.downstream || []).length > 0, '采纳后 links 未更新');

// ---- 2.0：F16 学习进度 ----
const ci = KB.checkIn();
ok(ci.ok, '今日打卡失败');
const st = KB.progressStats();
ok(st.streak >= 1 && st.total === KB.methods().length, '进度统计错误');
ok(KB.weeklyReport().includes('学习周报') && KB.weeklyReport().includes('分层覆盖度'), '周报格式不完整');
KB.toggleMastered(m.id);
ok(KB.progressStats().mastered >= 1, '标记已掌握未生效');

// ---- 2.0：F19 变更影响 ----
const im = KB.impactOf('m.fe.uploadFile');
ok(im && im.checklist.length > 0, '变更影响检查单为空');
ok(im.chains.length > 0, '未聚合到受影响链路');
ok(KB.impactMarkdown('m.fe.uploadFile').includes('PR 变更影响检查单'), '检查单导出失败');

// ---- 输出 ----
if (errors.length) {
  console.error(`\n✗ 冒烟测试失败，共 ${errors.length} 项：`);
  errors.forEach((e) => console.error('  - ' + e));
  process.exit(1);
}
console.log(`✓ 页面渲染 ${routes.length} 个 / 8 类卡片 / 2 个 Markdown 导入 / ${KB.methods().length} 个条目校验`);
console.log('✓ 决策树 END 路径全部有推荐方案；排查流步骤可达；过滤 / 场景反查 / 预案导出正常');
console.log('✓ 2.0：向量检索 / 事故录入 / 草稿审核门禁 / IDE 深链 / links 骨架 / 打卡周报 / 变更影响');
