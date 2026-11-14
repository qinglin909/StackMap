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
for (const f of ['data.js', 'core.js', 'v2.js', 'v3.js', 'cards.js', 'views2.js', 'views3.js', 'app.js']) {
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
  '#/entry/m.fe.uploadFile?ref=apps/web/src/upload/uploadFileToOSS.ts&line=21',
  // 3.0 新增页面
  '#/projects', '#/compare', '#/compare?c=submitOrder', '#/reviews', '#/reviews?id=rv.001',
  '#/reviews?method=m.fe.useUploadQueue', '#/compare?c=withIdempotency'
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

// ---- 3.0：F18 多项目切换 ----
ok(KB.projects().length === 2, '项目注册表未加载（应为 2 个项目）');
// 注意：前面的 2.0 冒烟测试批准了一条本地草稿入库，因此全量 = 26 + 1 本地条目
ok(KB.allMethods().length === 27, '全量条目应为 26 仓库条目 + 1 本地覆盖层条目');
ok(KB.methods().length === 15 && KB.methods().every((x) => KB.projectIdOf(x) === 'yunshu'), '默认项目数据域应为云枢条目');
ok(KB.sharedConcepts().length >= 4, '跨项目同名概念不足 4 组');
const projSw = KB.setProject('xinglian');
ok(projSw.ok && KB.methods().length === 12 && KB.methods().every((x) => KB.projectIdOf(x) === 'xinglian'), '切换到星链后数据域未生效');
ok(KB.chains().length === 2 && KB.incidents().length === 2, '项目切换后链路 / 事故未跟随');
KB.setProject('yunshu');
ok(KB.methods().length === 15, '切回云枢失败');

// ---- 3.0：F18 跨项目对比 ----
const concepts = KB.concepts();
ok(concepts.length >= 4, '同名概念列表为空');
const cmp = KB.compareOf(concepts[0].name);
ok(cmp && cmp.cols.length >= 2 && cmp.rows.length >= 10, '跨项目对比矩阵不完整');
ok(cmp && cmp.diffCount > 0, '同名方法对比没有差异字段（对比无意义）');
ok(KB.compareMarkdown(concepts[0].name).includes('跨项目对比'), '对比导出 Markdown 格式错误');
ok(KB.projectMatrix().length === 2 && KB.projectStats('xinglian').methods === 12, '项目对比矩阵统计错误');
// 浏览器仓库模式为 9/7；冒烟测试里已批准一条本地草稿入库，云枢会多 1 个独有名字
ok(KB.projectMatrix()[0].unique.length >= 9 && KB.projectMatrix()[1].unique.length === 7,
  '独有方法统计错误：' + KB.projectMatrix().map((r) => r.project.short + '=' + r.unique.length).join('/'));

// ---- 3.0：F20 团队评审 ----
ok(KB.reviews('*').length === 4, '评审记录未加载（全项目应为 4 条）');
ok(KB.reviews().length === 2, '评审工作台应按当前项目过滤（云枢 2 条）');
ok(KB.reviews('*').some((t) => t.status === 'open' || t.status === 'in_review'), '待处理评审统计错误');
const rv = KB.reviewTemplate('m.fe.useUploadQueue');
rv.title = '冒烟评审'; rv.author = 'tester';
ok(KB.validateReview(rv).length === 0, '评审模板校验失败：' + KB.validateReview(rv).join('；'));
ok(KB.saveReview(rv).ok, '评审保存失败');
ok(KB.reviewById(rv.id) !== null, '本地评审未进入 KB.reviews()');
ok(KB.validateReview(Object.assign({}, rv, { methodId: 'not.exist' })).length > 0, '非法评审未被拦截');
const cm = KB.addReviewComment(rv.id, 'reviewer', '兜底缺数据层', 'request_changes');
ok(cm.ok && KB.reviewById(rv.id).status === 'changes_requested', '「要求修改」表决未同步状态');
KB.addReviewComment(rv.id, 'reviewer', '已补齐四问', 'approve');
ok(KB.reviewById(rv.id).status === 'approved', '「通过」表决未同步状态');
ok(KB.reviewsMarkdown().includes('冒烟评审'), '评审导出缺内容');
KB.deleteReview(rv.id);
ok(KB.reviewById(rv.id) === null, '删除评审未生效');

// ---- 3.0：F19 本地检查单 / 数据备份提醒 ----
ok(KB.prChecklistMarkdown('m.fe.uploadFile').includes('PR 复核检查单'), 'PR 检查单导出失败');
ok(KB.ciCommands().length >= 3, 'CI 命令清单缺失');
KB.state.lastBackupAt = '';
ok(KB.backupStatus().due, '未导出备份时应提示到期');
KB.markBackup();
ok(!KB.backupStatus().due, '导出后备份状态未更新');

// ---- 3.0：只读脱敏无旁路（复制 / 深链 / 搜索 / 详情 HTML） ----
KB.state.role = 'readonly';
const fullPath = 'apps/web/src/upload/uploadFileToOSS.ts';
ok(!KB.maskPath(fullPath).includes('uploadFileToOSS.ts'), '路径脱敏未生效');
ok(!KB.repoPath(m).includes('uploadFileToOSS.ts'), '方法路径脱敏未生效');
ok(!KB.deepLink(m, fullPath, 9).includes('uploadFileToOSS.ts'), '深链携带完整内部路径（脱敏旁路）');
global.location.hash = '#/entry/m.fe.uploadFile';
KB.state.route = KB.parseHash();
KB.render();
ok(!els.main.innerHTML.includes(fullPath), '详情页 HTML 泄露完整源码路径');
KB.state.role = 'editor';

// ---- 3.0：200 节点链路轻量渲染 ----
const savedChains = KB.state.repo.chains;
const bigNodes = [], bigEdges = [];
for (let i = 0; i < 200; i++) {
  const id = 'bench.' + i;
  bigNodes.push(id);
  if (i) bigEdges.push({ from: bigNodes[i - 1], to: id, relation: '调用' });
}
KB.state.repo.chains = [{ id: 'bench', name: '基准链路', entryMethodId: bigNodes[0], nodes: bigNodes, edges: bigEdges, description: '', projectId: KB.state.projectId }];
const bigHtml = KB.cards.chainGraph('bench', bigNodes[0], false);
ok(bigHtml.includes('大图轻量模式') && bigHtml.includes('200 节点'), '200 节点未触发大图轻量模式');
ok(!bigHtml.includes('chain-edge-label'), '大图模式仍渲染关系标签');
KB.state.repo.chains = savedChains;
ok(!KB.cards.chainGraph('c.upload', 'm.fe.uploadFile', false).includes('大图轻量模式'), '8 节点小图不应触发轻量模式');

// ---- 输出 ----
if (errors.length) {
  console.error(`\n✗ 冒烟测试失败，共 ${errors.length} 项：`);
  errors.forEach((e) => console.error('  - ' + e));
  process.exit(1);
}
console.log(`✓ 页面渲染 ${routes.length} 个 / 8 类卡片 / 2 个 Markdown 导入 / ${KB.allMethods().length} 个条目校验（2 个项目）`);
console.log('✓ 决策树 END 路径全部有推荐方案；排查流步骤可达；过滤 / 场景反查 / 预案导出正常');
console.log('✓ 2.0：向量检索 / 事故录入 / 草稿审核门禁 / IDE 深链 / links 骨架 / 打卡周报 / 变更影响');
console.log('✓ 3.0：多项目切换 / 跨项目对比 / 团队评审与表决 / 只读脱敏无旁路 / 200 节点轻量渲染 / 备份提醒');
