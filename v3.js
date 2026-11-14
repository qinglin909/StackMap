/* StackMap 3.0 · v3.js — 三期能力逻辑层
 * F18 多项目复用与跨项目对比 / F20 团队评论与评审条目
 * 另含 F19 的本地检查单入口与「数据定期导出」到期提醒。
 * 依赖 core.js（多项目加载）与 v2.js（track / 进度）。
 * 约定：评审记录与 1.0/2.0 的本地编辑一样先写 localStorage 覆盖层并标记待回写，
 *       导出 Markdown 后由编辑者回写 content/reviews.json，App 不自动修改仓库文件。
 */
(function () {
  'use strict';
  const KB = window.KB = window.KB || {};
  const ls = KB.ls;
  const E = KB.esc;

  // ============================ 本地状态 ============================
  KB.state.reviewOverlays = ls.get('reviewOverlays', {});
  KB.state.reviewDeleted = ls.get('reviewDeleted', []);
  KB.state.lastBackupAt = ls.get('lastBackupAt', '');
  KB.state.reviewFilter = 'all';
  KB.state.reviewForm = null;

  // ============================ F18 项目注册与切换 ============================
  KB.projects = () => KB.state.projects || [];
  KB.currentProject = () => KB.projects().find((p) => p.id === KB.state.projectId) || KB.projects()[0] || null;
  KB.setProject = function (id) {
    const p = KB.projects().find((x) => x.id === id);
    if (!p) return { ok: false, message: '项目不存在：' + id };
    KB.state.projectId = id;
    ls.set('projectId', id);
    KB.state.project = p.name;
    // 项目切换会改变数据域，清掉所有与具体条目绑定的临时状态
    KB.state.search = { q: '', layers: [], tags: [] };
    KB.state.chainSelect = '';
    KB.state.impactSelect = '';
    KB.state.sceneQuery = '';
    KB.state.sceneResult = null;
    KB.state.compareConcept = '';
    KB.state.reviewSelect = '';
    KB.state.chainView = { scale: 1, tx: 0, ty: 0 };
    if (KB.track) KB.track('project', { id });
    KB.render();
    return { ok: true, message: '已切换到 ' + p.name };
  };
  KB.projectStats = function (id) {
    const methods = KB.methods(id), chains = KB.chains(id), incidents = KB.incidents(id);
    const tags = new Set();
    methods.forEach((m) => (m.tags || []).forEach((t) => tags.add(t)));
    return {
      methods: methods.length,
      chains: chains.length,
      incidents: incidents.length,
      flows: KB.flows(id).length,
      layers: KB.LAYERS.filter((l) => methods.some((m) => m.layer === l)).length,
      tags: tags.size,
      pending: methods.filter((m) => KB.syncStatus(m).level !== 'ok').length,
      openReviews: KB.reviews(id).filter((t) => t.status === 'open' || t.status === 'in_review').length,
      fallbackRows: methods.reduce((n, m) => n + (m.fallback || []).length, 0)
    };
  };
  KB.projectCoverage = function (id) {
    const ms = KB.methods(id);
    return KB.LAYERS.map((l) => ({ layer: l, count: ms.filter((m) => m.layer === l).length }));
  };
  KB.sharedConcepts = function () {
    // 口径：出现在 ≥2 个项目中的方法名（并集口径，多项目时不因交集归零）
    const ps = KB.projects();
    if (ps.length < 2) return [];
    const counts = new Map();
    ps.forEach((p) => {
      new Set(KB.methods(p.id).map((m) => m.name)).forEach((n) => counts.set(n, (counts.get(n) || 0) + 1));
    });
    return Array.from(counts.entries()).filter(([, c]) => c >= 2).map(([n]) => n).sort();
  };
  KB.projectMatrix = function () {
    const ps = KB.projects();
    const sets = ps.map((p) => new Set(KB.methods(p.id).map((m) => m.name)));
    const shared = new Set(KB.sharedConcepts());
    return ps.map((p, i) => ({
      project: p,
      stats: KB.projectStats(p.id),
      shared: shared.size,
      unique: Array.from(sets[i]).filter((n) => !shared.has(n) && ps.every((_, j) => j === i || !sets[j].has(n))).sort()
    }));
  };

  // ============================ F18 跨项目对比 ============================
  KB.concepts = function () {
    const map = new Map();
    KB.allMethods().forEach((m) => {
      if (!map.has(m.name)) map.set(m.name, []);
      map.get(m.name).push(m);
    });
    return Array.from(map.entries())
      .filter(([, arr]) => new Set(arr.map((m) => KB.projectIdOf(m))).size >= 2)
      .map(([name, methods]) => ({
        name,
        methods,
        projects: Array.from(new Set(methods.map((m) => KB.projectIdOf(m))))
      }))
      .sort((a, b) => b.methods.length - a.methods.length || a.name.localeCompare(b.name));
  };
  const layerLabel = (l) => (KB.LAYER_META[l] || {}).label || l;
  KB.compareFields = [
    { key: 'project', label: '所属项目', get: (m) => (KB.projects().find((p) => p.id === KB.projectIdOf(m)) || {}).short || KB.projectIdOf(m) },
    { key: 'layer', label: '所属层', get: (m) => layerLabel(m.layer) },
    { key: 'stack', label: '技术栈', get: (m) => m.stack || '—' },
    { key: 'signature', label: '签名', get: (m) => m.signature || '—' },
    { key: 'summary', label: '一句话定位', get: (m) => m.summary || '—' },
    { key: 'layerReason', label: '本层选型理由', get: (m) => (m.why || {}).layerReason || '—' },
    { key: 'conclusion', label: '对比结论（条件）', get: (m) => m.comparisonConclusion || '—' },
    { key: 'alternatives', label: '替代方案', get: (m) => (m.alternatives || []).map((a) => a.name).join('、') || '—' },
    { key: 'fallbackLayers', label: '兜底覆盖层', get: (m) => Array.from(new Set((m.fallback || []).map((f) => f.layer))).map(layerLabel).join('、') || '—' },
    { key: 'fallbackCount', label: '兜底策略数', get: (m) => String((m.fallback || []).length) },
    { key: 'pitfalls', label: '踩坑记录', get: (m) => (m.pitfalls || []).join('；') || '—' },
    { key: 'repoPath', label: '源码路径', get: (m) => KB.repoPath(m) },
    { key: 'sync', label: '同步状态', get: (m) => KB.syncStatus(m).label },
    { key: 'updatedAt', label: '文档更新', get: (m) => m.updatedAt || '—' }
  ];
  KB.compareOf = function (concept) {
    const methods = KB.allMethods().filter((m) => m.name === concept);
    if (methods.length < 2) return null;
    // 同一项目内多条同名时取最近更新的一条，保证每项目一列
    const byProject = new Map();
    methods.forEach((m) => {
      const pid = KB.projectIdOf(m);
      if (!byProject.has(pid) || (m.updatedAt || '') > (byProject.get(pid).updatedAt || '')) byProject.set(pid, m);
    });
    const cols = KB.projects().filter((p) => byProject.has(p.id)).map((p) => ({ project: p, m: byProject.get(p.id) }));
    const fields = KB.compareFields.filter((f) => f.key !== 'project');
    const rows = fields.map((f) => {
      const values = cols.map((c) => f.get(c.m));
      return { label: f.label, key: f.key, values, diff: new Set(values).size > 1 };
    });
    return {
      concept, cols, rows,
      diffCount: rows.filter((r) => r.diff).length,
      total: rows.length
    };
  };
  KB.compareMarkdown = function (concept) {
    const x = KB.compareOf(concept);
    if (!x) return '';
    let md = `# 跨项目对比：${x.concept}\n\n> 生成时间：${new Date().toLocaleString('zh-CN')} · 来源 content/projects.json + 各项目 methods.json\n\n`;
    md += `共 ${x.cols.length} 个项目、${x.total} 个对比字段，其中 **${x.diffCount} 个字段存在差异**。\n\n`;
    md += '| 字段 | ' + x.cols.map((c) => c.project.short + ' · ' + c.m.id).join(' | ') + ' | 差异 |\n';
    md += '| --- | ' + x.cols.map(() => '---').join(' | ') + ' | --- |\n';
    x.rows.forEach((r) => {
      md += '| ' + r.label + ' | ' + r.values.map((v) => String(v).replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ') + ' | ' + (r.diff ? '✓' : '—') + ' |\n';
    });
    md += '\n## 决策提示\n\n- 差异字段需逐项确认是「业务约束不同」还是「文档未同步」。\n- 若仅一方缺少兜底或条件化结论，按验收标准补齐后回写对应项目的 methods.json。\n\n';
    x.cols.forEach((c) => { md += `- [${c.project.short}] ${c.m.name} → ${KB.deepLink ? KB.deepLink(c.m) : '#/entry/' + c.m.id}\n`; });
    return md;
  };

  // ============================ F20 团队评论与评审 ============================
  const STATUS = {
    open: { label: '待讨论', cls: 'badge-soft' },
    in_review: { label: '评审中', cls: 'badge-amber' },
    approved: { label: '已通过', cls: 'badge-green' },
    changes_requested: { label: '需修改', cls: 'badge-red' }
  };
  KB.reviewStatusMeta = STATUS;
  KB.reviewStatusBadge = (s) => `<span class="badge ${(STATUS[s] || STATUS.open).cls}">${E((STATUS[s] || STATUS.open).label)}</span>`;
  KB.reviews = function (projectId) {
    const map = new Map();
    (KB.state.reviews || []).forEach((t) => map.set(t.id, Object.assign({}, t, { source: 'repo' })));
    Object.values(KB.state.reviewOverlays).forEach((t) => map.set(t.id, Object.assign({}, t, { source: t.source || 'local' })));
    (KB.state.reviewDeleted || []).forEach((id) => map.delete(id));
    let arr = Array.from(map.values());
    const s = projectId === undefined ? KB.state.projectId : projectId;
    if (s && s !== '*' && KB.projects().length > 1) {
      arr = arr.filter((t) => (t.projectId || KB.state.defaultProjectId) === s);
    }
    return arr.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  };
  KB.reviewById = (id) => KB.reviews('*').find((t) => t.id === id) || null;
  KB.reviewsOfMethod = (methodId) => KB.reviews('*').filter((t) => t.methodId === methodId);
  KB.reviewCounts = function () {
    const all = KB.reviews();
    return {
      all: all.length,
      open: all.filter((t) => t.status === 'open').length,
      in_review: all.filter((t) => t.status === 'in_review').length,
      approved: all.filter((t) => t.status === 'approved').length,
      changes_requested: all.filter((t) => t.status === 'changes_requested').length,
      pending: all.filter((t) => t.status === 'open' || t.status === 'in_review').length
    };
  };
  KB.reviewTemplate = function (methodId) {
    return {
      id: 'rv.local.' + Date.now().toString(36),
      projectId: KB.state.projectId,
      methodId: methodId || '',
      title: '',
      kind: 'review',
      status: 'open',
      author: '',
      createdAt: KB.today(),
      updatedAt: KB.today(),
      comments: [],
      checklist: [
        { item: '四问字段齐全（是什么 / 为什么用 / 换别的会怎样 / 怎么兜底）', done: false },
        { item: '对比结论含「什么条件下选哪个」', done: false },
        { item: '兜底按层分组且每行含策略 / 代码模板 / 监控项', done: false },
        { item: '链路与 links 引用完整', done: false }
      ],
      relatedIncidentIds: [],
      relatedDraftId: ''
    };
  };
  KB.validateReview = function (t) {
    const errs = [];
    if (!t.id) errs.push('缺少 id');
    if (!t.title || !t.title.trim()) errs.push('标题不能为空');
    if (!t.methodId || !KB.byId(t.methodId)) errs.push('关联方法不存在');
    if (!KB.projects().some((p) => p.id === t.projectId)) errs.push('projectId 非法');
    if (!STATUS[t.status]) errs.push('status 非法');
    if (!['review', 'discussion'].includes(t.kind)) errs.push('kind 非法');
    if (!Array.isArray(t.comments)) errs.push('comments 必须是数组');
    if (!Array.isArray(t.checklist)) errs.push('checklist 必须是数组');
    (t.comments || []).forEach((c, i) => {
      if (!c.body || !c.body.trim()) errs.push(`评论 ${i + 1} 内容为空`);
      if (!['comment', 'approve', 'request_changes'].includes(c.verdict)) errs.push(`评论 ${i + 1} verdict 非法`);
    });
    return errs;
  };
  KB.saveReview = function (t) {
    const errs = KB.validateReview(t);
    if (errs.length) return { ok: false, message: errs[0] };
    const obj = Object.assign({}, t, { source: 'local', updatedAt: KB.today() });
    KB.state.reviewOverlays[obj.id] = obj;
    ls.set('reviewOverlays', KB.state.reviewOverlays);
    KB.state.reviewDeleted = KB.state.reviewDeleted.filter((id) => id !== obj.id);
    ls.set('reviewDeleted', KB.state.reviewDeleted);
    if (KB.track) KB.track('review', { id: obj.id });
    return { ok: true, message: '评审已保存（本地覆盖层，待回写 content/reviews.json）' };
  };
  KB.deleteReview = function (id) {
    if ((KB.state.reviewDeleted || []).indexOf(id) < 0) KB.state.reviewDeleted.push(id);
    delete KB.state.reviewOverlays[id];
    ls.set('reviewDeleted', KB.state.reviewDeleted);
    ls.set('reviewOverlays', KB.state.reviewOverlays);
  };
  KB.addReviewComment = function (id, author, body, verdict) {
    const t = KB.reviewById(id);
    if (!t) return { ok: false, message: '评审不存在' };
    if (!body || !body.trim()) return { ok: false, message: '评论内容不能为空' };
    t.comments = (t.comments || []).concat([{
      id: 'c' + Date.now().toString(36), author: (author || '匿名').trim(),
      at: KB.today(), body: body.trim(), verdict: verdict || 'comment'
    }]);
    t.updatedAt = KB.today();
    if (verdict === 'approve') t.status = 'approved';
    else if (verdict === 'request_changes') t.status = 'changes_requested';
    else if (t.status === 'open') t.status = 'in_review';
    return KB.saveReview(t);
  };
  KB.setReviewStatus = function (id, status) {
    const t = KB.reviewById(id);
    if (!t || !STATUS[status]) return { ok: false, message: '状态非法' };
    t.status = status;
    return KB.saveReview(t);
  };
  KB.toggleReviewCheck = function (id, idx) {
    const t = KB.reviewById(id);
    if (!t || !t.checklist[idx]) return;
    t.checklist[idx].done = !t.checklist[idx].done;
    KB.saveReview(t);
  };
  KB.reviewsMarkdown = function () {
    const all = KB.reviews('*');
    let md = `# 团队评审记录 · 共 ${all.length} 条\n\n> 导出时间：${new Date().toLocaleString('zh-CN')} · 由编辑者审核后回写 content/reviews.json\n\n`;
    all.forEach((t) => {
      const m = KB.byId(t.methodId);
      const p = KB.projects().find((x) => x.id === t.projectId);
      md += `## ${t.title}\n\n- 项目：${(p || {}).name || t.projectId} · 方法：${m ? m.name : t.methodId}\n`;
      md += `- 状态：${(STATUS[t.status] || STATUS.open).label} · 类型：${t.kind === 'review' ? '条目评审' : '讨论'} · 发起人：${t.author || '—'} · 更新：${t.updatedAt}\n\n`;
      md += '### 检查单\n\n';
      (t.checklist || []).forEach((c) => { md += `- [${c.done ? 'x' : ' '}] ${c.item}\n`; });
      md += '\n### 讨论\n\n';
      (t.comments || []).forEach((c) => {
        md += `- **${c.author || '匿名'}**（${c.at}，${({ comment: '评论', approve: '通过', request_changes: '要求修改' })[c.verdict] || '评论'}）：${c.body}\n`;
      });
      if (!(t.comments || []).length) md += '_暂无评论_\n';
      md += '\n---\n\n';
    });
    return md;
  };

  // ============================ F19 本地入口 / 备份提醒 ============================
  KB.ciCommands = function () {
    return [
      { label: '本地一键校验', cmd: 'npm run verify' },
      { label: '生成 PR 影响检查单', cmd: 'node tools/pr-impact.mjs --base origin/main --head HEAD --out impact.md' },
      { label: '脚本自测（不依赖 git）', cmd: 'node tools/pr-impact.mjs --self-test' },
      { label: '重建离线快照', cmd: 'npm run build' }
    ];
  };
  KB.prChecklistMarkdown = function (methodId) {
    const m = KB.byId(methodId);
    if (!m) return '';
    const chains = KB.chainsOf(methodId);
    const downstream = new Set();
    (m.links || {}).downstream && m.links.downstream.forEach((id) => downstream.add(id));
    chains.forEach((c) => {
      const i = c.nodes.indexOf(methodId);
      if (i >= 0) c.nodes.slice(i + 1).forEach((id) => downstream.add(id));
    });
    let md = `# PR 复核检查单：${m.name}\n\n> 生成时间：${new Date().toLocaleString('zh-CN')} · 项目 ${KB.state.project}\n> 提示：CI 会在 PR 中自动跑 tools/pr-impact.mjs 并把同样结构的报告写进 PR 评论与 job summary。\n\n`;
    md += `- 改动方法：\`${m.id}\` · ${layerLabel(m.layer)} · \`${KB.repoPath(m)}\`\n`;
    md += `- 受影响链路：${chains.length ? chains.map((c) => c.name).join('、') : '无'}\n`;
    md += `- 需复核的下游节点：${downstream.size}\n\n`;
    md += '## 检查项\n\n';
    md += '- [ ] 四问内容仍与实现一致（参数 / 返回 / 副作用 / 前提条件）\n';
    md += '- [ ] 对比结论仍含「什么条件下选哪个」\n';
    md += '- [ ] 兜底按层分组，每层策略 / 代码模板 / 监控项三要素齐全\n';
    md += '- [ ] 链路与 links（upstream / downstream / related）已同步\n';
    Array.from(downstream).forEach((id) => {
      const x = KB.byId(id);
      md += `- [ ] 下游 ${x ? x.name : id} 的条目与兜底需复核\n`;
    });
    KB.incidentsOf(methodId).forEach((i) => { md += `- [ ] 关联事故 ${i.title} 的改进项仍有效\n`; });
    KB.flowsOf(methodId).forEach((f) => { md += `- [ ] 排查流「${f.symptom}」定位结论仍成立\n`; });
    md += '\n- [ ] 更新 updatedAt / repoUpdatedAt，回写对应项目的 methods.json\n';
    md += '- [ ] 跑 npm run verify，且 CI 的 stackmap-impact 评论已复核\n';
    return md;
  };
  KB.backupStatus = function () {
    const last = KB.state.lastBackupAt;
    const days = last ? KB.daysSince(String(last).slice(0, 10)) : null;
    return { last, days, due: days === null || days >= 7, interval: 7 };
  };
  KB.markBackup = function () {
    KB.state.lastBackupAt = new Date().toISOString();
    ls.set('lastBackupAt', KB.state.lastBackupAt);
  };
})();
