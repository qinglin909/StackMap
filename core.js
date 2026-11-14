/* StackMap · core.js
 * 状态、仓库加载、校验、Markdown/JSON 导入解析、路由、收藏、通用 UI 能力。
 * 3.0 起事实源是 content/projects.json 注册的**多个项目**，每个项目 contentBase 下四类 JSON；
 * data.js 只是 file:// 打开时的离线快照。2.0 能力在 v2.js/views2.js，3.0 在 v3.js/views3.js。
 */
(function () {
  'use strict';
  const KB = window.KB = window.KB || {};

  KB.LAYERS = ['frontend', 'bff', 'backend', 'data', 'infra'];
  KB.LAYER_META = {
    frontend: { label: '前端', color: 'var(--l-frontend)' },
    bff:      { label: 'BFF',  color: 'var(--l-bff)' },
    backend:  { label: '后端', color: 'var(--l-backend)' },
    data:     { label: '数据', color: 'var(--l-data)' },
    infra:    { label: '基础设施', color: 'var(--l-infra)' }
  };

  // ---------- 基础工具 ----------
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  KB.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);
  KB.icon = (n, cls) => `<svg class="${cls || ''}"><use href="#i-${n}"/></svg>`;
  KB.layerChip = (l) => `<span class="layer-chip layer-${KB.esc(l)}">${KB.esc((KB.LAYER_META[l] || {}).label || l)}</span>`;
  KB.link = (route, label, cls) => `<a class="${cls || 'link'}" data-action="go" data-route="${KB.esc(route)}">${label}</a>`;
  KB.today = () => new Date().toISOString().slice(0, 10);
  KB.daysSince = (d) => {
    const t = Date.parse(d || KB.today());
    return isNaN(t) ? 0 : Math.max(0, Math.floor((Date.now() - t) / 86400000));
  };
  // 只读分享脱敏：3.0 起所有路径出口（显示 / 复制 / 深链 / 搜索索引）统一走这里，避免旁路
  KB.maskPath = (p) => {
    const s = String(p || '');
    if (KB.state.role !== 'readonly') return s;
    const parts = s.split('/');
    return parts.length > 2 ? parts[0] + '/***/' + parts[parts.length - 1].replace(/^.{3,}/, '***') : '***/***';
  };
  KB.repoPath = (m) => KB.maskPath(m && m.repoPath);
  KB.codeBlock = (code, label) => `<div class="code-block"><pre><code>${KB.esc(code || '')}</code></pre><button class="icon-btn copy-btn" data-action="copy" title="复制代码" aria-label="复制代码">${KB.icon('copy')}</button></div>${label ? `<div class="tiny dim mt8">${KB.esc(label)}</div>` : ''}`;
  KB.list = (arr, cls) => `<ul${cls ? ` class="${cls}"` : ''}>${(arr || []).map((x) => `<li>${KB.esc(x)}</li>`).join('')}</ul>`;

  // ---------- 状态 ----------
  const ls = {
    get(k, d) { try { const v = localStorage.getItem('kb.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('kb.' + k, JSON.stringify(v)); } catch (e) {} }
  };
  KB.ls = ls;

  KB.state = {
    repo: {
      methods: [], chains: [], incidents: [],
      troubleshooting: { flows: [], sceneSynonyms: {}, sceneExamples: [] },
      projects: [], reviews: [], linksSkeleton: null
    },
    projects: [],
    projectId: ls.get('projectId', null),
    defaultProjectId: 'yunshu',
    reviews: [],
    compareConcept: '',
    compareA: '',
    compareB: '',
    reviewSelect: '',
    mode: 'loading',
    generatedAt: '',
    overlays: ls.get('overlays', {}),
    deleted: ls.get('deleted', []),
    favorites: ls.get('favorites', []),
    role: ls.get('role', 'editor'),
    theme: ls.get('theme', 'light'),
    fontScale: ls.get('fontScale', 1),
    search: { q: '', layers: [], tags: [] },
    route: { name: 'home', p1: null, p2: null, qs: new URLSearchParams(), raw: '#/home' },
    context: [],
    decision: {},
    trouble: {},
    cardIndex: 0,
    tab: 'what',
    chainView: { scale: 1, tx: 0, ty: 0 },
    pendingScroll: null,
    sceneQuery: '',
    sceneResult: null,
    importPreview: null,
    impactSelect: '',
    draftReviewer: ''
  };

  KB.canEdit = () => KB.state.role === 'editor' || KB.state.role === 'admin';
  KB.isAdmin = () => KB.state.role === 'admin';

  // ---------- 仓库加载 ----------
  // 3.0：内容按项目分目录存放，content/projects.json 是项目注册表。
  // 没有注册表时自动退回 1.0/2.0 的单项目布局，保证旧仓库可直接升级。
  const FILE_NAMES = {
    methods: 'methods.json', chains: 'chains.json',
    incidents: 'incidents.json', troubleshooting: 'troubleshooting.json'
  };
  const REGISTRY_PATH = 'content/projects.json';
  const REVIEWS_PATH = 'content/reviews.json';
  const SKELETON_PATH = 'content/generated/links.skeleton.json';
  const LEGACY_PROJECT = {
    id: 'yunshu', name: '云枢 · 订单与附件平台', short: '云枢', description: '',
    stack: '', contentBase: 'content', color: '#4f6bed', status: 'active', owner: ''
  };
  async function getJson(p, optional) {
    const r = await fetch(p, { cache: 'no-store' });
    if (!r.ok) {
      if (optional) return null;
      throw new Error(p + ' -> ' + r.status);
    }
    return r.json();
  }
  const withProject = (arr, pid) => (arr || []).map((x) => Object.assign({}, x, { projectId: x.projectId || pid }));
  async function fromRepo() {
    let registry = null;
    try { registry = await getJson(REGISTRY_PATH, true); } catch (e) { /* 旧版单项目布局 */ }
    const projects = (registry && registry.projects && registry.projects.length) ? registry.projects : [LEGACY_PROJECT];
    const merged = { methods: [], chains: [], incidents: [], flows: [], sceneSynonyms: {}, sceneExamples: [] };
    await Promise.all(projects.map(async (p) => {
      const base = String(p.contentBase || 'content').replace(/\/+$/, '');
      const docs = {};
      await Promise.all(Object.keys(FILE_NAMES).map(async (k) => {
        docs[k] = await getJson(base + '/' + FILE_NAMES[k], k === 'troubleshooting');
      }));
      merged.methods.push(...withProject((docs.methods || {}).entries, p.id));
      merged.chains.push(...withProject((docs.chains || {}).chains, p.id));
      merged.incidents.push(...withProject((docs.incidents || {}).incidents, p.id));
      const tr = docs.troubleshooting || {};
      merged.flows.push(...withProject(tr.flows, p.id));
      Object.entries(tr.sceneSynonyms || {}).forEach(([k, words]) => {
        const prev = merged.sceneSynonyms[k] || [];
        merged.sceneSynonyms[k] = Array.from(new Set(prev.concat(Array.isArray(words) ? words : [words])));
      });
      merged.sceneExamples.push(...(tr.sceneExamples || []));
    }));
    let skeleton = null, reviews = [];
    try { skeleton = await getJson(SKELETON_PATH, true); } catch (e) { /* 未运行抽取脚本 */ }
    try { const rv = await getJson(REVIEWS_PATH, true); reviews = (rv && rv.threads) || []; } catch (e) { /* 无评审数据 */ }
    return {
      methods: merged.methods,
      chains: merged.chains,
      incidents: merged.incidents,
      troubleshooting: { flows: merged.flows, sceneSynonyms: merged.sceneSynonyms, sceneExamples: merged.sceneExamples },
      projects,
      defaultProjectId: (registry && registry.defaultProjectId) || projects[0].id,
      reviews,
      linksSkeleton: skeleton,
      project: projects[0].name,
      generatedAt: new Date().toISOString()
    };
  }
  function fromSnapshot() {
    const s = window.__REPO_SNAPSHOT__;
    if (!s) throw new Error('离线快照 data.js 未加载');
    const projects = (s.projects && s.projects.length) ? s.projects : [Object.assign({}, LEGACY_PROJECT, { name: s.project || LEGACY_PROJECT.name })];
    return {
      methods: s.methods || [], chains: s.chains || [], incidents: s.incidents || [],
      troubleshooting: s.troubleshooting || { flows: [], sceneSynonyms: {}, sceneExamples: [] },
      linksSkeleton: s.linksSkeleton || null,
      projects,
      defaultProjectId: s.defaultProjectId || projects[0].id,
      reviews: s.reviews || [],
      project: projects[0].name,
      generatedAt: s.generatedAt
    };
  }
  KB.loadRepo = async function (force) {
    let data, mode;
    if (location.protocol !== 'file:') {
      try { data = await fromRepo(); mode = 'repo'; }
      catch (e) { data = fromSnapshot(); mode = 'snapshot'; KB.state.repoError = e.message; }
    } else {
      data = fromSnapshot(); mode = 'snapshot';
    }
    KB.state.repo = data;
    KB.state.projects = data.projects || [];
    KB.state.defaultProjectId = data.defaultProjectId || (KB.state.projects[0] || {}).id || 'yunshu';
    if (!KB.state.projects.some((p) => p.id === KB.state.projectId)) {
      KB.state.projectId = KB.state.defaultProjectId;
      ls.set('projectId', KB.state.projectId);
    }
    KB.state.reviews = data.reviews || [];
    KB.state.mode = mode;
    KB.state.generatedAt = data.generatedAt;
    KB.state.project = (KB.state.projects.find((p) => p.id === KB.state.projectId) || {}).name || data.project || LEGACY_PROJECT.name;
    if (force) KB.toast(mode === 'repo' ? `已重新读取 ${KB.state.projects.length} 个项目的 content/ 内容` : '当前为离线快照模式（用本地 HTTP 服务启动可启用仓库同源）', mode === 'repo' ? 'ok' : '');
    return mode;
  };

  // ---------- 数据访问 ----------
  const pidOf = (x) => (x && x.projectId) || KB.state.defaultProjectId || 'yunshu';
  KB.projectIdOf = pidOf;
  // 全量（跨项目）：引用校验、按 id/按名解析、跨项目对比用
  KB.allMethods = function () {
    const map = new Map();
    KB.state.repo.methods.forEach((m) => map.set(m.id, Object.assign({}, m, { source: 'repo' })));
    Object.values(KB.state.overlays).forEach((m) => map.set(m.id, Object.assign({}, m, { source: m.source || 'local' })));
    KB.state.deleted.forEach((id) => map.delete(id));
    return Array.from(map.values()).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  };
  // 当前项目视图：首页 / 搜索 / 链路 / 卡片 / 场景反查默认只看当前项目
  KB.methods = function (projectId) {
    const scope = arguments.length ? projectId : KB.state.projectId;
    const all = KB.allMethods();
    if (!scope || scope === '*' || KB.state.projects.length <= 1) return all;
    return all.filter((m) => pidOf(m) === scope);
  };
  KB.byId = (id) => KB.allMethods().find((m) => m.id === id) || null;
  const scope = (arr, projectId) => {
    const s = projectId === undefined ? KB.state.projectId : projectId;
    if (!s || s === '*' || KB.state.projects.length <= 1) return arr;
    return arr.filter((x) => pidOf(x) === s);
  };
  KB.chains = (projectId) => scope(KB.state.repo.chains || [], projectId);
  KB.incidents = (projectId) => scope(KB.state.repo.incidents || [], projectId);
  KB.flows = (projectId) => scope(KB.state.repo.troubleshooting.flows || [], projectId);
  // 同义词与场景示例是全项目共享的检索词表，不按项目过滤
  KB.synonyms = () => (KB.state.repo.troubleshooting.sceneSynonyms || {});
  KB.sceneExamples = () => (KB.state.repo.troubleshooting.sceneExamples || []);
  KB.chainsOf = (id) => KB.chains().filter((c) => c.nodes.indexOf(id) >= 0);
  KB.incidentsOf = (id) => KB.incidents().filter((i) => (i.relatedMethodIds || []).indexOf(id) >= 0);
  KB.flowsOf = (id) => KB.flows().filter((f) => f.resultMethodId === id || (f.relatedIncidentId && (KB.incidents().find((i) => i.id === f.relatedIncidentId) || {}).relatedMethodIds?.includes(id)));

  KB.syncStatus = function (m) {
    if (m.source && m.source !== 'repo') return { level: 'pending', label: '待同步', detail: '本地导入/修改，需回写 content/ 后重建快照' };
    if (m.repoUpdatedAt && m.updatedAt && m.updatedAt < m.repoUpdatedAt) {
      return { level: 'pending', label: '待同步', detail: `源码 ${m.repoUpdatedAt} 已变更，文档仍停留在 ${m.updatedAt}` };
    }
    const days = KB.daysSince(m.lastCodeChangeAt || m.repoUpdatedAt || m.updatedAt);
    if (days > 120) return { level: 'stale', label: '可能过期', detail: `距上次代码变更 ${days} 天，建议复核` };
    return { level: 'ok', label: '已同步', detail: `距上次代码变更 ${days} 天` };
  };
  KB.statusBadge = function (m) {
    const s = KB.syncStatus(m);
    const cls = s.level === 'ok' ? 'badge-green' : s.level === 'pending' ? 'badge-amber' : 'badge-red';
    return `<span class="badge ${cls}" title="${KB.esc(s.detail)}">${s.label}</span>`;
  };
  KB.statusMark = function (m) {
    const s = KB.syncStatus(m);
    return `<span class="status-mark status-${s.level}" title="${KB.esc(s.detail)}">${s.level === 'ok' ? '✓' : s.level === 'pending' ? '◐' : '!'} ${s.label}</span>`;
  };

  // ---------- 验收校验 ----------
  const COND_A = /(当|若|如果|只有在|仅在)/;
  const COND_B = /(则|才|改用|选择|不得|应选|可)/;
  KB.validateEntry = function (m) {
    const errs = [], warns = [];
    const tag = m.id || '(无 id)';
    for (const f of ['id', 'name', 'signature', 'layer', 'module', 'summary', 'repoPath', 'updatedAt', 'comparisonConclusion']) {
      if (!m[f]) errs.push(`${tag} 缺少必填字段 ${f}`);
    }
    if (KB.LAYERS.indexOf(m.layer) < 0) errs.push(`${tag} layer 非法：${m.layer}`);
    const c = m.comparisonConclusion || '';
    if (c.length < 20 || !COND_A.test(c) || !COND_B.test(c)) errs.push(`${tag} 对比结论必须含「什么条件下选哪个」（条件句 + 选择句，≥20 字）`);
    if (!m.alternatives || !m.alternatives.length) errs.push(`${tag} alternatives 为空`);
    (m.alternatives || []).forEach((a) => {
      if (!a.whenToUse) errs.push(`${tag} 替代方案「${a.name}」缺 whenToUse`);
      if (!a.migrationCost) errs.push(`${tag} 替代方案「${a.name}」缺 migrationCost`);
    });
    const layers = new Set();
    (m.fallback || []).forEach((fb) => {
      layers.add(fb.layer);
      if (KB.LAYERS.indexOf(fb.layer) < 0) errs.push(`${tag} 兜底 layer 非法：${fb.layer}`);
      ['failureMode', 'strategy', 'codeSnippet', 'monitoring'].forEach((f) => {
        if (!fb[f] || !String(fb[f]).trim()) errs.push(`${tag} 兜底行(${fb.layer}) 缺少「${f}」`);
      });
    });
    if (!m.fallback || m.fallback.length < 2 || layers.size < 2) errs.push(`${tag} 兜底必须按层分组（至少 2 层、2 行）`);
    const ids = new Set(KB.allMethods().map((x) => x.id));
    ['upstream', 'downstream', 'related'].forEach((k) => ((m.links || {})[k] || []).forEach((r) => {
      if (!ids.has(r)) warns.push(`${tag} links.${k} 引用了不存在的条目 ${r}`);
    }));
    return { errors: errs, warnings: warns };
  };
  KB.validateAll = function () {
    const errors = [], warnings = [];
    KB.methods().forEach((m) => {
      const r = KB.validateEntry(m); errors.push(...r.errors); warnings.push(...r.warnings);
    });
    const ids = new Set(KB.allMethods().map((m) => m.id));
    KB.chains().forEach((c) => {
      c.nodes.forEach((n) => { if (!ids.has(n)) errors.push(`链路 ${c.id} 节点 ${n} 不存在`); });
      c.edges.forEach((e) => {
        if (!ids.has(e.from)) errors.push(`链路 ${c.id} edge.from ${e.from} 不存在`);
        if (!ids.has(e.to)) errors.push(`链路 ${c.id} edge.to ${e.to} 不存在`);
      });
    });
    KB.incidents().forEach((i) => (i.relatedMethodIds || []).forEach((r) => { if (!ids.has(r)) errors.push(`事故 ${i.id} 关联 ${r} 不存在`); }));
    KB.flows().forEach((f) => { if (!ids.has(f.resultMethodId)) errors.push(`排查流 ${f.id} 结果方法 ${f.resultMethodId} 不存在`); });
    return { errors, warnings };
  };

  // ---------- Markdown / JSON 导入解析 ----------
  const dedent = (lines) => {
    const ne = lines.filter((l) => l.trim());
    const min = ne.length ? Math.min.apply(null, ne.map((l) => l.match(/^\s*/)[0].length)) : 0;
    return lines.map((l) => l.slice(min)).join('\n').trim();
  };
  function parseSections(lines, start) {
    const out = {}; let cur = null;
    for (let i = start; i < lines.length; i++) {
      const h = lines[i].match(/^##\s+(.+?)\s*$/);
      if (h) { cur = h[1].trim(); out[cur] = []; continue; }
      if (cur) out[cur].push(lines[i]);
    }
    return out;
  }
  function subSections(arr) {
    const out = { _: [] }; let cur = '_';
    arr.forEach((l) => {
      const h = l.match(/^###\s+(.+?)\s*$/);
      if (h) { cur = h[1].trim(); out[cur] = []; return; }
      out[cur].push(l);
    });
    return out;
  }
  function bullets(arr) {
    const out = [];
    arr.forEach((l) => {
      const m = l.match(/^\s*-\s+(.*)$/);
      if (m) out.push(m[1].trim());
      else if (out.length && l.trim() && !/^\s*```/.test(l) && !/^###/.test(l)) out[out.length - 1] += ' ' + l.trim();
    });
    return out;
  }
  function rowsWithCode(arr) {
    const rows = [];
    for (let i = 0; i < arr.length; i++) {
      if (!/^\s*-\s+/.test(arr[i])) continue;
      const cols = arr[i].replace(/^\s*-\s*/, '').split('|').map((s) => s.trim());
      let code = '', j = i + 1;
      while (j < arr.length && !arr[j].trim()) j++;
      if (j < arr.length && /^\s*```/.test(arr[j])) {
        j++; const buf = [];
        while (j < arr.length && !/^\s*```/.test(arr[j])) { buf.push(arr[j]); j++; }
        code = dedent(buf); i = j;
      }
      rows.push({ cols, code });
    }
    return rows;
  }
  function parseExamples(arr) {
    const subs = subSections(arr), out = [];
    Object.entries(subs).forEach(([scene, ls]) => {
      if (scene === '_' || !ls.length) return;
      let code = ''; const rest = [];
      for (let i = 0; i < ls.length; i++) {
        if (!code && /^\s*```/.test(ls[i])) {
          i++; const buf = [];
          while (i < ls.length && !/^\s*```/.test(ls[i])) { buf.push(ls[i]); i++; }
          code = dedent(buf); continue;
        }
        if (ls[i].trim() && !/^\s*```/.test(ls[i])) rest.push(ls[i].trim());
      }
      out.push({ scene, code, explain: rest.join(' ') });
    });
    return out;
  }
  const splitMulti = (s) => String(s || '').split(/[；;]/).map((x) => x.trim()).filter(Boolean);
  const splitLayers = (s) => String(s || '').split(/[,，]/).map((x) => x.trim()).filter(Boolean);

  KB.parseMarkdown = function (text) {
    const lines = String(text).replace(/\r\n/g, '\n').split('\n');
    const fm = {}; let i = 0;
    if (lines[0] && lines[0].trim() === '---') {
      i = 1;
      while (i < lines.length && lines[i].trim() !== '---') {
        const m = lines[i].match(/^([^:]+):\s*(.*)$/);
        if (m) fm[m[1].trim()] = m[2].trim();
        i++;
      }
      i++;
    }
    const S = parseSections(lines, i);
    const whatSubs = subSections(S['是什么'] || []);
    const whySubs = subSections(S['为什么用'] || []);
    const params = bullets(whatSubs['参数'] || []).map((b) => {
      const pm = b.match(/^`([^`]+)`\s*(.*)$/);
      if (!pm) return { name: b.slice(0, 24), type: 'any', desc: b };
      const ci = pm[1].indexOf(':');
      return {
        name: ci >= 0 ? pm[1].slice(0, ci).trim() : pm[1].trim(),
        type: ci >= 0 ? pm[1].slice(ci + 1).trim() : 'any',
        desc: pm[2].trim()
      };
    });
    const joinText = (arr) => arr.filter((l) => l.trim() && !/^\s*```/.test(l)).map((l) => l.trim()).join(' ').trim();
    const altRows = rowsWithCode(S['替代方案'] || []);
    const fbRows = rowsWithCode(S['兜底'] || []);
    const ceLines = (whySubs['反例'] || []);
    let ceCode = '';
    for (let k = 0; k < ceLines.length; k++) {
      if (/^\s*```/.test(ceLines[k])) {
        k++; const buf = [];
        while (k < ceLines.length && !/^\s*```/.test(ceLines[k])) { buf.push(ceLines[k]); k++; }
        ceCode = dedent(buf); break;
      }
    }
    const pitfalls = bullets(S['踩坑'] || []);
    bullets(S['检查单'] || []).forEach((x) => pitfalls.push('检查单：' + x.replace(/^\[.\]\s*/, '')));

    const entry = {
      id: fm.id || 'm.import.' + Date.now().toString(36),
      name: fm.name || fm.id || '未命名方法',
      signature: fm.signature || fm.name || '',
      layer: fm.layer || 'frontend',
      stack: fm.stack || '',
      module: fm.module || '导入条目',
      summary: joinText(S['定位'] || []) || '（待补充一句话定位）',
      what: {
        params,
        returns: joinText(whatSubs['返回'] || []) || '（待补充）',
        sideEffects: bullets(whatSubs['副作用'] || []),
        callers: bullets(whatSubs['调用方'] || [])
      },
      why: {
        scenarios: bullets(whySubs['场景'] || []),
        problemsSolved: bullets(whySubs['解决的问题'] || []),
        preconditions: bullets(whySubs['前提条件'] || []),
        layerReason: joinText(whySubs['本层理由'] || []),
        counterExample: { title: '不用它会怎样', desc: joinText(ceLines) || '（待补充反例）', code: ceCode }
      },
      alternatives: altRows.map((r) => ({
        name: r.cols[0] || '未命名方案', layer: splitLayers(r.cols[5])[0] || fm.layer || 'frontend',
        pros: splitMulti(r.cols[1]), cons: splitMulti(r.cols[2]),
        whenToUse: r.cols[3] || '（待补充）', migrationCost: r.cols[4] || '（待补充）',
        affectedLayers: splitLayers(r.cols[5]), codeSnippet: r.code || '// 参见 repoPath'
      })),
      comparisonConclusion: joinText(S['对比结论'] || []),
      fallback: fbRows.map((r) => ({
        layer: r.cols[0] || 'frontend', failureMode: r.cols[1] || '（待补充故障模式）',
        strategy: r.cols[2] || '', codeSnippet: r.code || '', monitoring: r.cols[3] || ''
      })),
      pitfalls,
      tags: splitLayers(fm.tags),
      repoPath: fm.repoPath || 'content/methods/imported.md',
      links: { upstream: splitLayers(fm.upstream), downstream: splitLayers(fm.downstream), related: splitLayers(fm.related) },
      examples: parseExamples(S['示例'] || []),
      updatedAt: KB.today(), repoUpdatedAt: KB.today(), lastCodeChangeAt: KB.today(),
      source: 'markdown'
    };
    return entry;
  };

  KB.parseImport = function (text, filename) {
    const t = String(text).trim();
    if (!t) return { entries: [], errors: ['内容为空'] };
    const isMd = /\.md$/i.test(filename || '') || t.startsWith('---');
    if (isMd) {
      const e = KB.parseMarkdown(t);
      return { entries: [e], source: 'markdown' };
    }
    let parsed;
    try { parsed = JSON.parse(t); } catch (e) { return { entries: [], errors: ['JSON 解析失败：' + e.message] }; }
    let arr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.entries) ? parsed.entries : (parsed.id || parsed.name ? [parsed] : []));
    if (!arr.length) return { entries: [], errors: ['未识别到条目：需要数组、{entries:[...]} 或单个 MethodEntry'] };
    return { entries: arr.map((e) => Object.assign({}, e, {
      source: 'json', updatedAt: e.updatedAt || KB.today(),
      repoUpdatedAt: e.repoUpdatedAt || e.updatedAt || KB.today(),
      lastCodeChangeAt: e.lastCodeChangeAt || e.updatedAt || KB.today()
    })), source: 'json' };
  };

  KB.commitImport = function (entries) {
    entries.forEach((e) => { KB.state.overlays[e.id] = e; });
    ls.set('overlays', KB.state.overlays);
    KB.toast(`已导入 ${entries.length} 个条目，标记为「待同步」`, 'ok');
  };
  KB.saveEntry = function (entry) {
    KB.state.overlays[entry.id] = Object.assign({}, entry, { source: 'local', updatedAt: KB.today() });
    KB.state.deleted = KB.state.deleted.filter((x) => x !== entry.id);
    ls.set('overlays', KB.state.overlays); ls.set('deleted', KB.state.deleted);
  };
  KB.deleteEntry = function (id) {
    if (KB.state.deleted.indexOf(id) < 0) KB.state.deleted.push(id);
    delete KB.state.overlays[id];
    ls.set('overlays', KB.state.overlays); ls.set('deleted', KB.state.deleted);
  };
  KB.resetLocal = function () {
    KB.state.overlays = {}; KB.state.deleted = [];
    ls.set('overlays', {}); ls.set('deleted', []);
  };

  // ---------- 收藏 / 我的预案 ----------
  KB.favKey = (methodId, fb) => methodId + '::' + fb.layer + '::' + fb.failureMode;
  KB.isFav = (methodId, fb) => KB.state.favorites.some((f) => f.key === KB.favKey(methodId, fb));
  KB.toggleFav = function (methodId, fb) {
    const key = KB.favKey(methodId, fb);
    const idx = KB.state.favorites.findIndex((f) => f.key === key);
    if (idx >= 0) { KB.state.favorites.splice(idx, 1); KB.toast('已移出我的预案'); }
    else {
      KB.state.favorites.push({
        key, methodId, methodName: (KB.byId(methodId) || {}).name || methodId,
        layer: fb.layer, failureMode: fb.failureMode, strategy: fb.strategy,
        codeSnippet: fb.codeSnippet, monitoring: fb.monitoring, addedAt: KB.today()
      });
      KB.toast('已加入我的预案', 'ok');
    }
    ls.set('favorites', KB.state.favorites);
    KB.render();
  };
  KB.removeFav = function (key) {
    KB.state.favorites = KB.state.favorites.filter((f) => f.key !== key);
    ls.set('favorites', KB.state.favorites);
    KB.render();
  };
  KB.favoritesMarkdown = function () {
    const groups = {};
    KB.state.favorites.forEach((f) => { (groups[f.methodName] = groups[f.methodName] || []).push(f); });
    let md = `# 我的分层兜底预案\n\n> 导出时间：${new Date().toLocaleString('zh-CN')}  ·  策略数：${KB.state.favorites.length}  ·  覆盖方法：${Object.keys(groups).length}\n> 来源：StackMap · 全栈方法知识库（内容与仓库同源）\n\n`;
    if (!KB.state.favorites.length) return md + '_（暂无收藏，去「分层兜底」卡点击「加入我的预案」）_\n';
    Object.entries(groups).forEach(([name, rows]) => {
      md += `## ${name}\n\n`;
      KB.LAYERS.forEach((layer) => {
        const rs = rows.filter((r) => r.layer === layer);
        if (!rs.length) return;
        md += `### ${(KB.LAYER_META[layer] || {}).label || layer} 层\n\n`;
        rs.forEach((r) => {
          md += `**故障模式**：${r.failureMode}\n\n`;
          md += `- **策略**：${r.strategy}\n`;
          md += `- **监控项**：${r.monitoring}\n`;
          md += `- **代码模板**：\n\n\`\`\`\n${r.codeSnippet}\n\`\`\`\n\n`;
        });
      });
      md += '---\n\n';
    });
    return md;
  };

  // ---------- 路由 ----------
  KB.parseHash = function () {
    const h = (location.hash || '#/home').replace(/^#\/?/, '');
    const parts = h.split('?');
    const seg = parts[0].split('/').filter(Boolean);
    return {
      name: seg[0] || 'home', p1: seg[1] ? decodeURIComponent(seg[1]) : null,
      p2: seg[2] ? decodeURIComponent(seg[2]) : null,
      qs: new URLSearchParams(parts[1] || ''), raw: location.hash || '#/home'
    };
  };
  KB.pushContext = function () {
    const y = (typeof window.scrollY === 'number' ? window.scrollY : 0) || (document.documentElement ? document.documentElement.scrollTop : 0) || 0;
    KB.state.context.push({ raw: location.hash || '#/home', scroll: y });
    if (KB.state.context.length > 24) KB.state.context.shift();
  };
  KB.navigate = function (route, opts) {
    opts = opts || {};
    if (opts.push !== false) KB.pushContext();
    if (opts.restore != null) KB.state.pendingScroll = opts.restore;
    if (location.hash === route) { KB.render(); return; }
    location.hash = route;
  };
  KB.back = function () {
    const prev = KB.state.context.pop();
    if (!prev) { KB.navigate('#/home', { push: false }); return; }
    KB.navigate(prev.raw || '#/home', { push: false, restore: prev.scroll });
  };

  // ---------- 通用 UI ----------
  KB.toast = function (msg, type) {
    const root = document.getElementById('toastRoot');
    if (!root) return;
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.innerHTML = KB.esc(msg);
    root.appendChild(el);
    setTimeout(() => el.remove(), 2800);
  };
  KB.modal = function (opts) {
    const root = document.getElementById('modalRoot');
    root.innerHTML = `<div class="modal-overlay" data-action="overlayClose"><div class="modal ${opts.wide ? 'wide' : ''}" data-stop="1">
      <div class="modal-head"><h3>${KB.esc(opts.title || '')}</h3><button class="icon-btn" data-action="closeModal" aria-label="关闭">✕</button></div>
      <div class="modal-body">${opts.html || ''}</div>
      ${opts.foot ? `<div class="modal-foot">${opts.foot}</div>` : ''}
    </div></div>`;
  };
  KB.closeModal = () => { const r = document.getElementById('modalRoot'); if (r) r.innerHTML = ''; };
  KB.copyText = function (text) {
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); KB.toast('已复制', 'ok'); } catch (e) { KB.toast('复制失败，请手动选中'); }
      ta.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => KB.toast('已复制', 'ok')).catch(fallback);
    } else fallback();
  };
  KB.download = function (filename, text, mime) {
    const blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    KB.toast('已导出 ' + filename, 'ok');
  };

  KB.applyPrefs = function () {
    document.documentElement.dataset.theme = KB.state.theme;
    document.documentElement.style.setProperty('--font-scale', KB.state.fontScale);
    const rs = document.getElementById('roleSelect'); if (rs) rs.value = KB.state.role;
  };
  KB.setRole = function (r) { KB.state.role = r; ls.set('role', r); KB.applyPrefs(); KB.render(); KB.toast('权限已切换为：' + ({ readonly: '只读用户', editor: '编辑者', admin: '管理员' }[r] || r)); };
  KB.setTheme = function (t) { KB.state.theme = t; ls.set('theme', t); KB.applyPrefs(); };
  KB.setFont = function (d) {
    KB.state.fontScale = Math.min(1.35, Math.max(0.85, Math.round((KB.state.fontScale + d) * 100) / 100));
    ls.set('fontScale', KB.state.fontScale); KB.applyPrefs();
  };

  // ---------- 搜索 / 场景反查 ----------
  KB.filterMethods = function () {
    const s = KB.state.search;
    const q = (s.q || '').trim().toLowerCase();
    return KB.methods().filter((m) => {
      if (s.layers.length && s.layers.indexOf(m.layer) < 0) return false;
      if (s.tags.length && !s.tags.every((t) => (m.tags || []).indexOf(t) >= 0)) return false;
      if (!q) return true;
      const hay = [m.name, m.signature, m.summary, m.module, m.stack, KB.repoPath(m), (m.tags || []).join(' '), (m.pitfalls || []).join(' ')].join(' ').toLowerCase();
      return q.split(/\s+/).every((w) => hay.indexOf(w) >= 0);
    });
  };
  KB.sceneSearch = function (query) {
    const q = String(query || '').trim();
    if (!q) return [];
    const syn = KB.synonyms();
    const expanded = new Set([q]);
    Object.entries(syn).forEach(([topic, words]) => {
      const hit = q.indexOf(topic) >= 0 || words.some((w) => q.indexOf(w) >= 0);
      if (hit) { expanded.add(topic); words.forEach((w) => expanded.add(w)); }
    });
    const terms = Array.from(expanded).filter(Boolean);
    const scored = KB.methods().map((m) => {
      const name = (m.name || '').toLowerCase(), summary = (m.summary || '').toLowerCase(), module = (m.module || '').toLowerCase();
      const tags = (m.tags || []).join(' ').toLowerCase(), ql = q.toLowerCase();
      let score = 0; const hits = [];
      terms.forEach((t) => {
        const tl = t.toLowerCase(); if (!tl) return;
        if (tags.indexOf(tl) >= 0) { score += 6; hits.push(t); }
        if (module.indexOf(tl) >= 0) { score += 5; hits.push(t); }
        if (summary.indexOf(tl) >= 0) { score += 3; hits.push(t); }
        if (name.indexOf(tl) >= 0) { score += 4; hits.push(t); }
      });
      ql.split(/[\s，,、]/).filter(Boolean).forEach((w) => {
        if (w.length >= 2 && (summary + tags + module + name).indexOf(w) >= 0) score += 2;
      });
      if ((m.fallback || []).some((f) => (f.failureMode || '').toLowerCase().indexOf(ql) >= 0)) score += 2;
      return { m, score, hits: Array.from(new Set(hits)).slice(0, 6) };
    }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 12);
    return scored;
  };

  // ---------- 渲染外壳 ----------
  const NAV_KEY = {
    home: 'home', entry: 'home', scene: 'scene', troubleshoot: 'troubleshoot',
    chains: 'chains', chain: 'chains', cards: 'cards', favorites: 'favorites', admin: 'admin',
    incidents: 'incidents', incident: 'incidents', drafts: 'drafts', progress: 'progress', impact: 'impact',
    projects: 'projects', compare: 'compare', reviews: 'reviews'
  };
  KB.renderShell = function () {
    const key = NAV_KEY[KB.state.route.name] || 'home';
    document.querySelectorAll('.nav-item').forEach((el) => {
      const route = (el.getAttribute('data-route') || '').replace('#/', '').split('/')[0];
      el.classList.toggle('active', route === key || (key === 'home' && route === 'home' && KB.state.route.name === 'home'));
    });
    const back = document.getElementById('backBtn');
    if (back) back.classList.toggle('show', KB.state.context.length > 0);
    const fc = document.getElementById('favCount'); if (fc) fc.textContent = KB.state.favorites.length;
    const ps = document.getElementById('projectSwitch');
    if (ps) {
      const sig = KB.state.projects.map((p) => p.id + ':' + (p.short || p.name)).join('|');
      if (ps.dataset.sig !== sig) {
        ps.dataset.sig = sig;
        ps.innerHTML = KB.state.projects.map((p) => `<option value="${KB.esc(p.id)}">${KB.esc(p.short || p.name)}</option>`).join('');
      }
      if (ps.value !== KB.state.projectId) ps.value = KB.state.projectId;
      ps.title = '当前项目：' + KB.state.project;
    }
    const badge = document.getElementById('modeBadge');
    if (badge) {
      badge.textContent = KB.state.mode === 'repo' ? '仓库同源 · content/' : '离线快照 · data.js';
      badge.className = 'badge ' + (KB.state.mode === 'repo' ? 'badge-green' : 'badge-amber');
    }
    const hint = document.getElementById('sideHint');
    if (hint) hint.textContent = KB.state.mode === 'repo'
      ? `已读取 ${KB.state.projects.length} 个项目（当前 ${KB.state.project} ${KB.methods().length} 条目）。修改仓库文件后点「重新同步」。`
      : '直接打开文件使用离线快照；用本地 HTTP 服务启动即为仓库同源模式。';
    const dot = document.getElementById('syncDot');
    if (dot) dot.style.background = KB.state.mode === 'repo' ? 'var(--green)' : 'var(--amber)';
    const input = document.getElementById('globalSearch');
    if (input && input.value !== KB.state.search.q) input.value = KB.state.search.q;
  };
  KB.render = function () {
    KB.state.route = KB.parseHash();
    KB.applyPrefs();
    KB.renderShell();
    if (KB.renderMain) KB.renderMain();
    if (KB.state.pendingScroll != null) {
      const s = KB.state.pendingScroll; KB.state.pendingScroll = null;
      requestAnimationFrame(() => { if (typeof window.scrollTo === 'function') window.scrollTo(0, s); });
    }
  };

  window.addEventListener('hashchange', () => KB.render());
})();
