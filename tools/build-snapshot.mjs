import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = path.join(ROOT, 'content');
const readJson = (abs) => JSON.parse(fs.readFileSync(abs, 'utf8'));
const readIf = (abs, fallback) => (fs.existsSync(abs) ? readJson(abs) : fallback);

// ---- 3.0：按 content/projects.json 注册的项目聚合事实源 ----
// 没有注册表时自动退回 1.0/2.0 的单项目布局（content/*.json），旧仓库可直接升级。
const registryPath = path.join(CONTENT, 'projects.json');
const registry = readIf(registryPath, null);
const projects = (registry && registry.projects && registry.projects.length)
  ? registry.projects
  : [{ id: 'yunshu', name: '云枢 · 订单与附件平台', short: '云枢', contentBase: 'content' }];
const defaultProjectId = (registry && registry.defaultProjectId) || projects[0].id;
const projectIds = new Set(projects.map((p) => p.id));

const methods = [], chains = [], incidents = [], flows = [];
const sceneSynonyms = {}, sceneExamples = [];
const perProject = [];
const tag = (arr, pid) => (arr || []).map((x) => Object.assign({}, x, { projectId: x.projectId || pid }));

for (const p of projects) {
  const base = path.join(ROOT, p.contentBase || 'content');
  const mDoc = readJson(path.join(base, 'methods.json'));
  const cDoc = readJson(path.join(base, 'chains.json'));
  const iDoc = readJson(path.join(base, 'incidents.json'));
  const tDoc = readIf(path.join(base, 'troubleshooting.json'), { flows: [], sceneSynonyms: {}, sceneExamples: [] });
  const ms = tag(mDoc.entries, p.id), cs = tag(cDoc.chains, p.id), is = tag(iDoc.incidents, p.id), fs_ = tag(tDoc.flows, p.id);
  methods.push(...ms); chains.push(...cs); incidents.push(...is); flows.push(...fs_);
  Object.entries(tDoc.sceneSynonyms || {}).forEach(([k, words]) => {
    const prev = sceneSynonyms[k] || [];
    sceneSynonyms[k] = Array.from(new Set(prev.concat(Array.isArray(words) ? words : [words])));
  });
  sceneExamples.push(...(tDoc.sceneExamples || []));
  perProject.push({ id: p.id, short: p.short || p.name, methods: ms.length, chains: cs.length, incidents: is.length, flows: fs_.length });
}

const reviewsDoc = readIf(path.join(CONTENT, 'reviews.json'), { threads: [] });
const reviews = reviewsDoc.threads || [];
// F15 自动抽取骨架是可选生成物；缺失时快照仍可构建
const skeleton = readIf(path.join(CONTENT, 'generated/links.skeleton.json'), null);

const errors = [], warnings = [];
const COND_A = /(当|若|如果|只有在|仅在)/;
const COND_B = /(则|才|改用|选择|不得|应选|可)/;
const LAYERS = ['frontend', 'bff', 'backend', 'data', 'infra'];
const REVIEW_STATUS = ['open', 'in_review', 'approved', 'changes_requested'];
const VERDICTS = ['comment', 'approve', 'request_changes'];

// ---- id 唯一性与项目归属 ----
const ids = new Set();
for (const m of methods) {
  if (ids.has(m.id)) errors.push(`条目 id 重复：${m.id}（多项目 id 必须全局唯一）`);
  ids.add(m.id);
  if (!projectIds.has(m.projectId)) errors.push(`${m.id}: projectId ${m.projectId} 未注册`);
}

// ---- 验收标准校验 ----
for (const m of methods) {
  const tag = `${m.id}`;
  for (const f of ['id', 'name', 'signature', 'layer', 'module', 'summary', 'repoPath', 'updatedAt', 'comparisonConclusion']) {
    if (!m[f]) errors.push(`${tag}: 缺少必填字段 ${f}`);
  }
  if (!LAYERS.includes(m.layer)) errors.push(`${tag}: layer 非法 -> ${m.layer}`);
  if (!m.comparisonConclusion || !COND_A.test(m.comparisonConclusion) || !COND_B.test(m.comparisonConclusion) || m.comparisonConclusion.length < 20) {
    errors.push(`${tag}: 对比结论必须包含「什么条件下选哪个」（需含条件句 + 选择句，且 >= 20 字）`);
  }
  if (!Array.isArray(m.alternatives) || m.alternatives.length === 0) errors.push(`${tag}: alternatives 为空`);
  for (const a of m.alternatives || []) {
    if (!a.whenToUse) errors.push(`${tag}: 替代方案「${a.name}」缺少 whenToUse`);
    if (!a.migrationCost) errors.push(`${tag}: 替代方案「${a.name}」缺少 migrationCost`);
  }
  if (!Array.isArray(m.fallback) || m.fallback.length < 2) errors.push(`${tag}: fallback 至少需要 2 行（分层）`);
  const layerSet = new Set();
  for (const fb of m.fallback || []) {
    if (!LAYERS.includes(fb.layer)) errors.push(`${tag}: fallback.layer 非法 -> ${fb.layer}`);
    layerSet.add(fb.layer);
    for (const f of ['failureMode', 'strategy', 'codeSnippet', 'monitoring']) {
      if (!fb[f] || !String(fb[f]).trim()) errors.push(`${tag}: 兜底行(${fb.layer}) 缺少三要素之一 ${f}`);
    }
  }
  if (layerSet.size < 2) warnings.push(`${tag}: 兜底只覆盖 ${layerSet.size} 层，建议至少覆盖前端/后端/数据三层`);
  for (const key of ['upstream', 'downstream', 'related']) {
    for (const ref of (m.links && m.links[key]) || []) {
      if (!ids.has(ref)) errors.push(`${tag}: links.${key} 引用了不存在的条目 ${ref}`);
      if (ref === m.id) errors.push(`${tag}: links.${key} 存在自引用`);
    }
  }
  if (m.decisionTree) {
    const qids = new Set((m.decisionTree.questions || []).map((q) => q.id));
    for (const q of m.decisionTree.questions || []) {
      for (const o of q.options || []) {
        if (o.next !== 'END' && !qids.has(o.next)) errors.push(`${tag}: 决策树 ${q.id}.${o.value}.next 指向不存在的题目 ${o.next}`);
      }
    }
    for (const r of m.decisionTree.rules || []) {
      for (const k of Object.keys(r.when || {})) if (!qids.has(k)) errors.push(`${tag}: 决策规则引用了不存在的题目 ${k}`);
    }
  }
  if (m.repoUpdatedAt && m.updatedAt && m.updatedAt < m.repoUpdatedAt) {
    warnings.push(`${tag}: 文档 ${m.updatedAt} 早于源码 ${m.repoUpdatedAt} -> 待同步`);
  }
}

for (const c of chains) {
  if (!projectIds.has(c.projectId)) errors.push(`chain ${c.id}: projectId 未注册`);
  for (const n of c.nodes) if (!ids.has(n)) errors.push(`chain ${c.id}: 节点 ${n} 不存在`);
  for (const e of c.edges) {
    if (!ids.has(e.from)) errors.push(`chain ${c.id}: edge.from ${e.from} 不存在`);
    if (!ids.has(e.to)) errors.push(`chain ${c.id}: edge.to ${e.to} 不存在`);
  }
  if (!ids.has(c.entryMethodId)) errors.push(`chain ${c.id}: entryMethodId 不存在`);
}
for (const inc of incidents) {
  if (!projectIds.has(inc.projectId)) errors.push(`incident ${inc.id}: projectId 未注册`);
  for (const id of inc.relatedMethodIds || []) if (!ids.has(id)) errors.push(`incident ${inc.id}: 关联条目 ${id} 不存在`);
  for (const f of inc.missingFallbacks || []) {
    if (!f.layer || !f.item || !f.expected) errors.push(`incident ${inc.id}: missingFallbacks 必须用 layer / item / expected 三字段`);
  }
}
for (const flow of flows) {
  if (!projectIds.has(flow.projectId)) errors.push(`flow ${flow.id}: projectId 未注册`);
  if (!ids.has(flow.resultMethodId)) errors.push(`flow ${flow.id}: resultMethodId ${flow.resultMethodId} 不存在`);
  const sids = new Set((flow.steps || []).map((s) => s.id));
  for (const s of flow.steps || []) for (const o of s.options || []) {
    if (o.next !== 'RESULT' && !sids.has(o.next)) errors.push(`flow ${flow.id}: ${s.id}.next 指向不存在的步骤 ${o.next}`);
  }
}
// ---- F15 links 骨架引用完整性 ----
if (skeleton) {
  for (const e of skeleton.entries || []) {
    if (!ids.has(e.methodId)) errors.push(`links skeleton: methodId ${e.methodId} 不存在`);
    for (const k of ['upstream', 'downstream', 'related']) {
      for (const ref of ((e.suggestedLinks || {})[k] || [])) {
        if (!ids.has(ref)) errors.push(`links skeleton ${e.methodId}.${k}: 建议引用了不存在的条目 ${ref}`);
        if (ref === e.methodId) errors.push(`links skeleton ${e.methodId}.${k}: 存在自引用`);
      }
    }
  }
}
// ---- F20 团队评审数据契约 ----
const reviewIds = new Set();
for (const t of reviews) {
  const tag = `review ${t.id || '(无 id)'}`;
  if (!t.id || reviewIds.has(t.id)) errors.push(`${tag}: id 缺失或重复`);
  reviewIds.add(t.id);
  if (!projectIds.has(t.projectId)) errors.push(`${tag}: projectId ${t.projectId} 未注册`);
  if (!ids.has(t.methodId)) errors.push(`${tag}: methodId ${t.methodId} 不存在`);
  if (!t.title) errors.push(`${tag}: 缺少标题`);
  if (!REVIEW_STATUS.includes(t.status)) errors.push(`${tag}: status 非法 -> ${t.status}`);
  if (!['review', 'discussion'].includes(t.kind)) errors.push(`${tag}: kind 非法 -> ${t.kind}`);
  if (!Array.isArray(t.comments)) errors.push(`${tag}: comments 必须是数组`);
  if (!Array.isArray(t.checklist)) errors.push(`${tag}: checklist 必须是数组`);
  for (const c of t.comments || []) {
    if (!c.body) errors.push(`${tag}: 存在空评论`);
    if (!VERDICTS.includes(c.verdict)) errors.push(`${tag}: verdict 非法 -> ${c.verdict}`);
  }
  for (const c of t.checklist || []) if (!c.item || typeof c.done !== 'boolean') errors.push(`${tag}: 检查项结构非法`);
  for (const id of t.relatedIncidentIds || []) {
    if (!incidents.some((i) => i.id === id)) errors.push(`${tag}: 关联事故 ${id} 不存在`);
  }
}

// ---- Markdown 结构校验（草稿，不并入快照） ----
const mdDir = path.join(CONTENT, 'methods');
const mdFiles = fs.existsSync(mdDir) && fs.statSync(mdDir).isDirectory() ? fs.readdirSync(mdDir).filter((f) => f.endsWith('.md')) : [];
const REQUIRED_SECTIONS = ['定位', '是什么', '为什么用', '替代方案', '对比结论', '兜底', '踩坑', '示例'];
for (const f of mdFiles) {
  const text = fs.readFileSync(path.join(mdDir, f), 'utf8');
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) { errors.push(`${f}: 缺少 front matter`); continue; }
  const kv = Object.fromEntries(fm[1].split(/\r?\n/).filter(Boolean).map((l) => {
    const i = l.indexOf(':'); return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  }));
  for (const k of ['id', 'name', 'signature', 'layer', 'module', 'tags', 'repoPath']) if (!kv[k]) errors.push(`${f}: front matter 缺 ${k}`);
  if (kv.layer && !LAYERS.includes(kv.layer)) errors.push(`${f}: layer 非法 ${kv.layer}`);
  const sections = [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
  for (const s of REQUIRED_SECTIONS) if (!sections.includes(s)) errors.push(`${f}: 缺少 ## ${s}`);
  const fbBlock = (text.split(/^## 兜底\s*$/m)[1] || '').split(/^## /m)[0];
  const rows = fbBlock.split(/\r?\n/).filter((l) => /^- (frontend|bff|backend|data|infra) \|/.test(l));
  if (rows.length < 3) errors.push(`${f}: 兜底行数不足 3（需分层分组）`);
  for (const r of rows) if (r.split('|').length < 4) errors.push(`${f}: 兜底行列数不足 4 -> ${r}`);
  if (!/```/.test(fbBlock)) errors.push(`${f}: 兜底段缺少代码块（代码模板要素）`);
}

// ---- 输出 ----
const snapshot = {
  generatedAt: new Date().toISOString(),
  project: projects[0].name,
  projects,
  defaultProjectId,
  methods,
  chains,
  incidents,
  troubleshooting: { flows, sceneSynonyms, sceneExamples },
  linksSkeleton: skeleton,
  reviews
};
const out = `/* 自动生成，请勿手改。运行：node tools/build-snapshot.mjs
 * 事实源：content/projects.json 注册的各项目 contentBase/*.json ；本文件仅用于 file:// 离线兜底。
 */
window.__REPO_SNAPSHOT__ = ${JSON.stringify(snapshot, null, 2)};
`;
fs.writeFileSync(path.join(ROOT, 'data.js'), out, 'utf8');

const nameSets = projects.map((p) => new Set(methods.filter((m) => m.projectId === p.id).map((m) => m.name)));
const shared = nameSets.length > 1
  ? Array.from(nameSets[0]).filter((n) => nameSets.slice(1).every((s) => s.has(n)))
  : [];

console.log(`项目 ${projects.length}：` + perProject.map((p) => `${p.short}(${p.methods} 条目/${p.chains} 链路/${p.incidents} 事故/${p.flows} 排查流)`).join('、'));
console.log(`合计 条目 ${methods.length} / 链路 ${chains.length} / 事故 ${incidents.length} / 排查流 ${flows.length} / 评审 ${reviews.length} / 同名概念 ${shared.length} / Markdown 草稿 ${mdFiles.length}`);
console.log(skeleton ? `F15 links 骨架已打包：${skeleton.parser} · ${skeleton.entries.length} 条目 · ${skeleton.summary.callEdges} 调用边` : 'F15 links 骨架：未生成（运行 node tools/extract-links.mjs 可生成）');
console.log(`待同步条目 ${warnings.filter((w) => w.includes('待同步')).length} 条，其它提醒 ${warnings.filter((w) => !w.includes('待同步')).length} 条`);
if (warnings.length) warnings.forEach((w) => console.log('  ⚠ ' + w));
if (errors.length) {
  console.error(`\n校验失败，共 ${errors.length} 项：`);
  errors.forEach((e) => console.error('  ✗ ' + e));
  process.exit(1);
}
console.log('\n✓ 验收标准校验通过：结论含条件 / 兜底按层且三要素齐全 / 链路引用完整 / 决策树与排查流可达 / links 骨架引用完整 / 多项目 id 唯一 / 评审数据契约');
console.log('✓ 已写入 data.js（离线快照）');
