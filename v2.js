/* StackMap 2.0 · v2.js — 二期能力逻辑层
 * F11 向量语义检索（本地 TF-IDF + 可选 pgvector）/ F12 事故录入
 * F13 AI 四问草稿与人工审核 / F14 IDE 深链解析 / F15 links 骨架消费
 * F16 学习进度打卡周报 / F19 变更影响分析
 * 依赖 core.js；覆盖 KB.sceneSearch / KB.incidents，其余均为新增能力。
 */
(function () {
  'use strict';
  const KB = window.KB = window.KB || {};
  const ls = KB.ls;
  const E = KB.esc;

  // ============================ 本地状态 ============================
  KB.state.incidentOverlays = ls.get('incidentOverlays', {});
  KB.state.incidentDeleted = ls.get('incidentDeleted', []);
  KB.state.drafts = ls.get('drafts', []);
  KB.state.progress = Object.assign({ events: [], checkins: [], mastered: [] }, ls.get('progress', {}));
  KB.state.services = Object.assign({
    llmEndpoint: '', embeddingEndpoint: '', model: 'gpt-4o-mini',
    useLlm: false, useEmbedding: false, baseUrl: 'http://localhost:5173/'
  }, ls.get('services', {}));
  KB.state.services.apiKey = '';   // 密钥只留在本会话内存，不写入 localStorage
  KB.state.semanticNotice = '';
  KB.state.draftNotice = '';

  KB.saveServices = function () {
    const s = Object.assign({}, KB.state.services);
    delete s.apiKey;
    ls.set('services', s);
  };

  // ============================ F11 语义检索 ============================
  /* 本地向量：中英文混合分词（中文 bigram + 整词，英文词干近似）→ TF-IDF → 余弦相似度。
   * 字段权重用「重复采样」实现；同义词扩展以低权重注入查询向量。
   * 远程 pgvector 契约：POST { query, topK, model } → { results: [{ id, score }] }。
   */
  function tokens(text) {
    const s = String(text == null ? '' : text).toLowerCase();
    const out = [];
    (s.match(/[a-z0-9_]{2,}/g) || []).forEach((w) => out.push(w));
    (s.match(/[\u4e00-\u9fa5]+/g) || []).forEach((seg) => {
      if (seg.length === 1) out.push(seg);
      else for (let i = 0; i < seg.length - 1; i++) out.push(seg.slice(i, i + 2));
      if (seg.length >= 3) out.push(seg);
      if (seg.length >= 4) for (let i = 0; i < seg.length - 2; i++) out.push(seg.slice(i, i + 3));
    });
    return out;
  }
  function weightedText(m) {
    const why = m.why || {};
    return [
      [m.name, 4], [(m.tags || []).join(' '), 3], [m.module, 3], [m.summary, 2],
      [(why.scenarios || []).join(' '), 2], [(why.problemsSolved || []).join(' '), 1],
      [(m.fallback || []).map((f) => (f.failureMode || '') + ' ' + (f.strategy || '')).join(' '), 1],
      [(m.pitfalls || []).join(' '), 1], [(m.examples || []).map((x) => x.scene).join(' '), 1],
      [(m.alternatives || []).map((x) => x.name).join(' '), 1],
      [m.signature, 1], [(KB.LAYER_META[m.layer] || {}).label || '', 1], [m.stack, 1]
    ];
  }
  let indexCache = null;
  function buildIndex() {
    const docs = KB.methods().map((m) => {
      const toks = [];
      weightedText(m).forEach(([txt, w]) => { const t = tokens(txt); for (let i = 0; i < w; i++) toks.push.apply(toks, t); });
      return { m, toks };
    });
    const df = new Map();
    docs.forEach((d) => new Set(d.toks).forEach((t) => df.set(t, (df.get(t) || 0) + 1)));
    const N = docs.length || 1;
    const idf = (t) => Math.log(1 + N / (1 + (df.get(t) || 0))) + 0.12;
    const vecs = docs.map((d) => ({ m: d.m, v: vectorize(d.toks.map((t) => ({ t, w: 1 })), idf) }));
    const sig = docs.map((d) => d.m.id + '|' + (d.m.updatedAt || '') + '|' + (d.m.source || '')).join(';');
    indexCache = { vecs, idf, sig, N };
    return indexCache;
  }
  function getIndex() {
    const sig = KB.methods().map((m) => m.id + '|' + (m.updatedAt || '') + '|' + (m.source || '')).join(';');
    if (!indexCache || indexCache.sig !== sig) buildIndex();
    return indexCache;
  }
  function vectorize(items, idf) {
    const tf = new Map();
    items.forEach(({ t, w }) => tf.set(t, (tf.get(t) || 0) + w));
    const v = new Map(); let norm = 0;
    tf.forEach((c, t) => { const x = (1 + Math.log(c)) * idf(t); v.set(t, x); norm += x * x; });
    norm = Math.sqrt(norm) || 1;
    v.forEach((x, t) => v.set(t, x / norm));
    return v;
  }
  function cosine(a, b) { let s = 0; a.forEach((x, t) => { if (b.has(t)) s += x * b.get(t); }); return s; }
  function expandQuery(q) {
    const items = tokens(q).map((t) => ({ t, w: 1 }));
    const hits = [];
    const syn = KB.synonyms();
    Object.entries(syn).forEach(([topic, words]) => {
      const hit = q.indexOf(topic) >= 0 || (words || []).some((w) => q.indexOf(w) >= 0);
      if (!hit) return;
      hits.push(topic);
      tokens(topic).forEach((t) => items.push({ t, w: 0.7 }));
      (words || []).forEach((w) => { hits.push(w); tokens(w).forEach((t) => items.push({ t, w: 0.5 })); });
    });
    return { items, hits: Array.from(new Set(hits)) };
  }
  function keywordFallback(q, hits) {
    const ql = String(q).toLowerCase();
    return KB.methods().map((m) => {
      const hay = [m.name, m.summary, m.module, (m.tags || []).join(' ')].join(' ').toLowerCase();
      let score = 0;
      [ql].concat(hits).forEach((t) => { if (t && hay.indexOf(String(t).toLowerCase()) >= 0) score += 12; });
      return { m, score, hits, vector: false };
    }).filter((x) => x.score > 0);
  }
  KB.sceneSearch = function (query) {
    const q = String(query || '').trim();
    if (!q) return [];
    const idx = getIndex();
    const ex = expandQuery(q);
    const qv = vectorize(ex.items, idx.idf);
    const ql = q.toLowerCase();
    let scored = idx.vecs.map(({ m, v }) => {
      let score = cosine(qv, v) * 100;
      const name = String(m.name || '').toLowerCase();
      if (name === ql) score += 18;
      else if (name.indexOf(ql) >= 0 || ql.indexOf(name) >= 0) score += 8;
      (m.tags || []).forEach((t) => { if (q.indexOf(t) >= 0) score += 5; });
      if (String(m.module || '') && q.indexOf(m.module) >= 0) score += 4;
      return { m, score, hits: ex.hits, cosine: cosine(qv, v) };
    }).filter((x) => x.score > 0.5);
    if (!scored.length) scored = keywordFallback(q, ex.hits);
    return scored.sort((a, b) => b.score - a.score).slice(0, 12)
      .map((x) => ({ m: x.m, score: Math.min(99, Math.round(x.score * 10) / 10), hits: (x.hits || []).slice(0, 6), vector: true }));
  };
  KB.sceneSearchAsync = async function (query) {
    const local = KB.sceneSearch(query);
    const s = KB.state.services;
    if (!s.useEmbedding || !s.embeddingEndpoint) { KB.state.semanticNotice = ''; return local; }
    try {
      const r = await fetch(s.embeddingEndpoint, {
        method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, s.apiKey ? { Authorization: 'Bearer ' + s.apiKey } : {}),
        body: JSON.stringify({ query, topK: 20, model: s.model || undefined })
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      const results = Array.isArray(j.results) ? j.results : (Array.isArray(j) ? j : []);
      if (!results.length) throw new Error('检索服务未返回结果');
      const byId = new Map(local.map((x) => [x.m.id, x]));
      const merged = results.map((x) => {
        const m = KB.byId(x.id);
        if (!m) return null;
        const base = byId.get(x.id);
        return { m, score: Math.min(99, Math.round(Number(x.score || 0) * 1000) / 10), hits: (base && base.hits) || [], vector: true, remote: true };
      }).filter(Boolean);
      local.forEach((x) => { if (!merged.some((y) => y.m.id === x.m.id)) merged.push(x); });
      KB.state.semanticNotice = 'pgvector 语义检索已启用，返回 ' + results.length + ' 条向量结果';
      return merged.sort((a, b) => b.score - a.score).slice(0, 12);
    } catch (e) {
      KB.state.semanticNotice = '向量服务不可用（' + e.message + '），已自动回退本地 TF-IDF';
      return local;
    }
  };
  KB.semanticMode = () => (KB.state.services.useEmbedding && KB.state.services.embeddingEndpoint) ? 'pgvector' : 'local-tfidf';

  // ============================ F12 事故录入 ============================
  const repoIncidents = KB.incidents;
  KB.incidents = function () {
    const base = repoIncidents().filter((i) => KB.state.incidentDeleted.indexOf(i.id) < 0);
    const local = Object.values(KB.state.incidentOverlays).map((i) => Object.assign({}, i, { source: 'local' }));
    return base.concat(local).sort((a, b) => String(b.occurredAt || '').localeCompare(String(a.occurredAt || '')));
  };
  KB.validateIncident = function (inc) {
    const errs = [];
    ['id', 'title', 'symptom', 'rootCause', 'improvement', 'occurredAt'].forEach((f) => { if (!inc[f]) errs.push('事故缺少 ' + f); });
    if (!Array.isArray(inc.relatedMethodIds) || !inc.relatedMethodIds.length) errs.push('事故至少关联一个方法条目');
    (inc.relatedMethodIds || []).forEach((id) => { if (!KB.byId(id)) errs.push('关联条目不存在：' + id); });
    (inc.missingFallbacks || []).forEach((f) => { if (KB.LAYERS.indexOf(f.layer) < 0) errs.push('缺失兜底层非法：' + f.layer); });
    return errs;
  };
  KB.saveIncident = function (inc) {
    inc.id = inc.id || 'inc.local.' + Date.now().toString(36);
    inc.occurredAt = inc.occurredAt || KB.today();
    inc.updatedAt = KB.today();
    inc.source = 'local';
    KB.state.incidentOverlays[inc.id] = inc;
    KB.state.incidentDeleted = KB.state.incidentDeleted.filter((x) => x !== inc.id);
    ls.set('incidentOverlays', KB.state.incidentOverlays); ls.set('incidentDeleted', KB.state.incidentDeleted);
    KB.track('incident', { id: inc.id });
    return inc;
  };
  KB.deleteIncident = function (id) {
    if (KB.state.incidentOverlays[id]) delete KB.state.incidentOverlays[id];
    else if (KB.state.incidentDeleted.indexOf(id) < 0) KB.state.incidentDeleted.push(id);
    ls.set('incidentOverlays', KB.state.incidentOverlays); ls.set('incidentDeleted', KB.state.incidentDeleted);
  };
  KB.incidentTemplate = function () {
    return {
      id: 'inc.local.' + Date.now().toString(36), title: '', symptom: '', rootCause: '',
      missingFallbacks: [{ layer: 'frontend', item: '', expected: '' }],
      relatedMethodIds: [], improvement: '', occurredAt: KB.today()
    };
  };
  KB.incidentsMarkdown = function () {
    let md = '# 事故复盘导出\n\n> 导出时间：' + new Date().toLocaleString('zh-CN') + ' · 共 ' + KB.incidents().length + ' 起\n\n';
    KB.incidents().forEach((i) => {
      md += '## ' + i.title + '（' + i.occurredAt + '）\n\n';
      md += '- **现象**：' + i.symptom + '\n- **根因**：' + i.rootCause + '\n- **改进**：' + i.improvement + '\n';
      md += '- **关联方法**：' + (i.relatedMethodIds || []).join('、') + '\n';
      md += '- **缺失兜底**：\n';
      (i.missingFallbacks || []).forEach((f) => { md += '  - ' + f.layer + '：' + (f.item || f.note || f.strategy || '—') + (f.expected ? '（应对应：' + f.expected + '）' : '') + '\n'; });
      md += '\n';
    });
    return md;
  };

  // ============================ F13 AI 起草四问草稿 ============================
  const DRAFT_TAG = '【草稿·待人工核实】';
  function localDraft(input) {
    const layer = KB.LAYERS.indexOf(input.layer) >= 0 ? input.layer : 'frontend';
    const name = input.name || 'newMethod';
    const scene = input.scene || '常规业务场景';
    const id = input.id || 'm.draft.' + Date.now().toString(36);
    const peers = KB.methods().filter((m) => m.layer === layer).slice(0, 3);
    const altName = (peers[0] && peers[0].alternatives[0] && peers[0].alternatives[0].name) || '同步直调';
    const fbModes = (peers[0] && peers[0].fallback || []).slice(0, 2);
    const entry = {
      id, name, signature: input.signature || (name + '(...): Promise<void>'),
      layer, stack: input.stack || '待补充', module: input.module || '待补充模块',
      summary: DRAFT_TAG + ' ' + (input.summary || ('在' + scene + '下提供 ' + name + ' 能力，需核实实际职责边界。')),
      what: {
        params: [{ name: 'input', type: 'object', desc: DRAFT_TAG + ' 参数待从源码签名核对' }],
        returns: DRAFT_TAG + ' 返回值待核实', sideEffects: [DRAFT_TAG + ' 副作用：网络请求 / 缓存 / 日志，需逐项确认'],
        callers: [DRAFT_TAG + ' 调用方待由 IDE / Tree-sitter 抽取后补齐']
      },
      why: {
        scenarios: [scene], problemsSolved: [DRAFT_TAG + ' 该场景下的核心问题待人工描述'],
        preconditions: [DRAFT_TAG + ' 依赖的服务与配置待确认'],
        layerReason: DRAFT_TAG + ' 本层选型理由待补充；可参考同层条目：' + peers.map((m) => m.name).join('、'),
        counterExample: { title: '不用它会怎样', desc: DRAFT_TAG + ' 反例待补充', code: '// ' + DRAFT_TAG + ' 反例代码待补充' }
      },
      alternatives: [
        { name: altName, layer, pros: [DRAFT_TAG + ' 优点待核实'], cons: [DRAFT_TAG + ' 缺点待核实'], whenToUse: DRAFT_TAG + ' 适用条件待核实', migrationCost: '待评估', affectedLayers: [layer], codeSnippet: '// ' + DRAFT_TAG },
        { name: '保持现状（不引入该方法）', layer, pros: ['无迁移成本'], cons: ['能力缺口仍在'], whenToUse: '当该能力可由现有方法覆盖时', migrationCost: '无', affectedLayers: [layer], codeSnippet: '// 复用现有实现' }
      ],
      comparisonConclusion: '当' + scene + '确实需要独立收敛该能力时，选择当前方案；若现有方法已可覆盖，则保持现状不得新增；只有在完成人工核实并补齐监控后才可上线。',
      fallback: [
        { layer, failureMode: DRAFT_TAG + ' ' + (fbModes[0] && fbModes[0].failureMode || '本层调用失败'), strategy: DRAFT_TAG + ' 策略待核实', codeSnippet: '// ' + DRAFT_TAG + ' 代码模板待补充', monitoring: DRAFT_TAG + ' 监控项待补充' },
        { layer: 'backend', failureMode: DRAFT_TAG + ' 下游服务不可用', strategy: DRAFT_TAG + ' 降级 / 重试策略待核实', codeSnippet: '// ' + DRAFT_TAG, monitoring: DRAFT_TAG + ' 监控项待补充' },
        { layer: 'data', failureMode: DRAFT_TAG + ' 数据写入失败', strategy: DRAFT_TAG + ' 补偿 / 对账策略待核实', codeSnippet: '-- ' + DRAFT_TAG, monitoring: DRAFT_TAG + ' 监控项待补充' }
      ],
      pitfalls: [DRAFT_TAG + ' 踩坑记录待值班同学补充'],
      tags: (input.tags || '草稿').split(/[,，\s]+/).filter(Boolean),
      repoPath: input.repoPath || 'apps/web/src/' + name + '.ts',
      links: { upstream: [], downstream: [], related: [] },
      examples: [{ scene: scene, code: '// ' + DRAFT_TAG + ' 示例待核实', explain: DRAFT_TAG + ' 解释待补充' }],
      decisionTree: null,
      updatedAt: KB.today(), repoUpdatedAt: KB.today(), lastCodeChangeAt: KB.today(),
      source: 'ai-draft'
    };
    return entry;
  }
  function normalizeDraft(obj, input, source) {
    const base = localDraft(input);
    const out = Object.assign({}, base, obj || {});
    out.id = (obj && obj.id) || base.id;
    out.name = (obj && obj.name) || input.name || base.name;
    out.layer = KB.LAYERS.indexOf(out.layer) >= 0 ? out.layer : base.layer;
    out.what = Object.assign({}, base.what, out.what || {});
    out.why = Object.assign({}, base.why, out.why || {});
    out.links = Object.assign({ upstream: [], downstream: [], related: [] }, out.links || {});
    if (!Array.isArray(out.alternatives) || !out.alternatives.length) out.alternatives = base.alternatives;
    out.alternatives.forEach((a) => { a.whenToUse = a.whenToUse || base.alternatives[0].whenToUse; a.migrationCost = a.migrationCost || '待评估'; });
    if (!Array.isArray(out.fallback) || out.fallback.length < 2) out.fallback = base.fallback;
    const layerSet = new Set(out.fallback.map((f) => f.layer));
    if (layerSet.size < 2) out.fallback = base.fallback;
    out.fallback.forEach((f) => { ['failureMode', 'strategy', 'codeSnippet', 'monitoring'].forEach((k) => { if (!f[k]) f[k] = DRAFT_TAG + ' ' + k + ' 待补充'; }); });
    const c = String(out.comparisonConclusion || '');
    if (c.length < 20 || !/(当|若|如果|只有在|仅在)/.test(c) || !/(则|才|改用|选择|不得|应选|可)/.test(c)) out.comparisonConclusion = base.comparisonConclusion;
    out.pitfalls = Array.isArray(out.pitfalls) && out.pitfalls.length ? out.pitfalls : base.pitfalls;
    out.examples = Array.isArray(out.examples) && out.examples.length ? out.examples : base.examples;
    out.updatedAt = KB.today(); out.repoUpdatedAt = KB.today(); out.lastCodeChangeAt = KB.today();
    out.source = source;
    return out;
  }
  KB.callLLM = async function (messages) {
    const s = KB.state.services;
    if (!s.llmEndpoint) throw new Error('未配置 LLM endpoint');
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), 20000) : null;
    try {
      const r = await fetch(s.llmEndpoint, {
        method: 'POST', signal: ctrl ? ctrl.signal : undefined,
        headers: Object.assign({ 'Content-Type': 'application/json' }, s.apiKey ? { Authorization: 'Bearer ' + s.apiKey } : {}),
        body: JSON.stringify({ model: s.model || 'gpt-4o-mini', temperature: 0.2, messages })
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      const text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || j.content || j.text || '';
      if (!text) throw new Error('模型未返回内容');
      const cleaned = String(text).replace(/^[\s\S]*?```(?:json)?/m, '').replace(/```[\s\S]*$/, '').trim();
      return JSON.parse(cleaned);
    } finally { if (timer) clearTimeout(timer); }
  };
  KB.generateDraft = async function (input) {
    const s = KB.state.services;
    if (s.useLlm && s.llmEndpoint) {
      try {
        const prompt = '你是全栈项目知识库的编辑助理。请为方法起草一份「四问」条目 JSON（只输出 JSON，不要解释）。字段：name, signature, layer(frontend|bff|backend|data|infra), module, summary, what{params[],returns,sideEffects[],callers[]}, why{scenarios[],problemsSolved[],preconditions[],layerReason,counterExample{title,desc,code}}, alternatives[{name,layer,pros[],cons[],whenToUse,migrationCost,affectedLayers[],codeSnippet}], comparisonConclusion(必须含「当…则…」的条件句), fallback[{layer,failureMode,strategy,codeSnippet,monitoring}] 至少 2 层且每行三要素齐全, pitfalls[], tags[], examples[{scene,code,explain}]。所有无法确认的事实请写明「待人工核实」。输入：' + JSON.stringify(input);
        const obj = await KB.callLLM([{ role: 'system', content: '只输出严格 JSON。' }, { role: 'user', content: prompt }]);
        KB.state.draftNotice = 'LLM 起草完成（' + (s.model || 'model') + '），仍需人工核实后方可入库';
        return { entry: normalizeDraft(obj, input, 'llm'), source: 'llm' };
      } catch (e) {
        KB.state.draftNotice = 'LLM 不可用（' + e.message + '），已回退本地启发式起草';
      }
    } else KB.state.draftNotice = '本地启发式起草（未启用 LLM）：所有字段均标注「待人工核实」';
    return { entry: normalizeDraft(null, input, 'local-heuristic'), source: 'local-heuristic' };
  };
  KB.drafts = () => KB.state.drafts;
  KB.saveDraft = function (d) {
    const i = KB.state.drafts.findIndex((x) => x.id === d.id);
    if (i >= 0) KB.state.drafts[i] = d; else KB.state.drafts.unshift(d);
    ls.set('drafts', KB.state.drafts);
    return d;
  };
  KB.makeDraft = function (input, entry, source) {
    return KB.saveDraft({
      id: 'draft.' + Date.now().toString(36), createdAt: new Date().toISOString(), input,
      entry, source, status: 'draft', reviewer: '', reviewedAt: '', notes: ''
    });
  };
  KB.deleteDraft = function (id) {
    KB.state.drafts = KB.state.drafts.filter((d) => d.id !== id);
    ls.set('drafts', KB.state.drafts);
  };
  KB.approveDraft = function (id, reviewer) {
    const d = KB.state.drafts.find((x) => x.id === id);
    if (!d) return { ok: false, message: '草稿不存在' };
    if (!KB.canEdit()) return { ok: false, message: '只读用户不可批准入库' };
    if (d.status !== 'reviewed') return { ok: false, message: '必须先勾选「已人工核实」并保存审核意见' };
    const errs = KB.validateEntry(d.entry);
    if (errs.errors.length) return { ok: false, message: '校验未通过：' + errs.errors[0] };
    KB.saveEntry(Object.assign({}, d.entry, {
      source: 'ai-reviewed', reviewedBy: reviewer || '未署名', reviewedAt: new Date().toISOString()
    }));
    d.status = 'approved'; d.reviewer = reviewer || '未署名'; d.reviewedAt = KB.today();
    ls.set('drafts', KB.state.drafts);
    KB.track('draft-approved', { id: d.entry.id });
    return { ok: true, message: '已审核入库（本地覆盖层，标记待同步）' };
  };
  KB.draftToMarkdown = function (d) {
    const m = d.entry;
    let md = '# ' + m.name + '（四问草稿 · ' + (d.source === 'llm' ? 'LLM 起草' : '本地启发式') + '）\n\n';
    md += '> 状态：' + d.status + ' · 生成于 ' + d.createdAt + ' · **AI 生成内容必须人工核实后入库**\n\n';
    md += '## 定位\n\n' + m.summary + '\n\n## 是什么\n\n- 返回：' + (m.what.returns || '') + '\n';
    (m.what.sideEffects || []).forEach((x) => { md += '- 副作用：' + x + '\n'; });
    md += '\n## 为什么用\n\n';
    (m.why.scenarios || []).forEach((x) => { md += '- 场景：' + x + '\n'; });
    (m.why.problemsSolved || []).forEach((x) => { md += '- 解决：' + x + '\n'; });
    md += '\n## 替代方案\n\n| 方案 | 何时选 | 迁移成本 |\n| --- | --- | --- |\n';
    (m.alternatives || []).forEach((a) => { md += '| ' + a.name + ' | ' + a.whenToUse + ' | ' + a.migrationCost + ' |\n'; });
    md += '\n## 对比结论\n\n' + m.comparisonConclusion + '\n\n## 兜底\n\n';
    (m.fallback || []).forEach((f) => { md += '- ' + f.layer + ' | ' + f.failureMode + ' | ' + f.strategy + ' | ' + f.monitoring + '\n'; });
    md += '\n## 踩坑\n\n' + (m.pitfalls || []).join('\n') + '\n';
    return md;
  };

  // ============================ F14 IDE 深链 ============================
  KB.resolveByName = function (name) {
    const n = String(name || '').trim().toLowerCase();
    if (!n) return null;
    const all = KB.methods();
    let hit = all.find((m) => String(m.name || '').toLowerCase() === n);
    if (!hit) hit = all.find((m) => {
      const fn = String(m.signature || '').split('(')[0].replace(/^.*[\s.]/, '').trim();
      return fn.toLowerCase() === n;
    });
    if (!hit && n.length >= 3) hit = all.find((m) => String(m.name || '').toLowerCase().indexOf(n) >= 0);
    return hit || null;
  };
  KB.deepLink = function (m, ref, line) {
    let base = KB.state.services.baseUrl || 'http://localhost:5173/';
    if (location.protocol !== 'file:' && location.origin) base = location.origin + location.pathname;
    let url = base + '#/entry/' + encodeURIComponent(m.id);
    const qs = [];
    if (ref) qs.push('ref=' + encodeURIComponent(ref));
    if (line) qs.push('line=' + encodeURIComponent(line));
    return url + (qs.length ? '?' + qs.join('&') : '');
  };
  KB.byNameDeepLink = function (m, ref, line) {
    const link = KB.deepLink(m, ref, line);
    return link.replace('#/entry/' + encodeURIComponent(m.id), '#/entry/by-name/' + encodeURIComponent(m.name));
  };

  // ============================ F15 links 骨架消费 ============================
  KB.linksSkeleton = function () {
    return KB.state.repo.linksSkeleton || (window.__REPO_SNAPSHOT__ || {}).linksSkeleton || null;
  };
  KB.skeletonDiff = function (m) {
    const sk = KB.linksSkeleton();
    if (!sk || !m) return null;
    const e = (sk.entries || []).find((x) => x.methodId === m.id);
    if (!e) return null;
    const cur = m.links || {};
    const diff = {}; let changes = 0;
    ['upstream', 'downstream', 'related'].forEach((k) => {
      const a = Array.isArray(cur[k]) ? cur[k] : [];
      const b = (e.suggestedLinks || {})[k] || [];
      diff[k] = { added: b.filter((x) => a.indexOf(x) < 0), removed: a.filter((x) => b.indexOf(x) < 0), same: a.filter((x) => b.indexOf(x) >= 0) };
      changes += diff[k].added.length + diff[k].removed.length;
    });
    return { entry: e, diff, changes };
  };
  KB.applySkeleton = function (id) {
    const m = KB.byId(id);
    const d = KB.skeletonDiff(m);
    if (!m || !d) return { ok: false, message: '该条目暂无抽取骨架' };
    const next = JSON.parse(JSON.stringify(m));
    delete next.source;
    next.links = Object.assign({}, next.links, d.entry.suggestedLinks);
    KB.saveEntry(next);
    KB.track('skeleton', { id });
    return { ok: true, message: '已采纳 links 建议（本地覆盖层，标记待同步）' };
  };

  // ============================ F16 学习进度 / 打卡 / 周报 ============================
  function persistProgress() { ls.set('progress', KB.state.progress); }
  KB.track = function (type, payload) {
    const p = KB.state.progress, day = KB.today(), id = (payload && payload.id) || '';
    if (p.events.some((e) => e.type === type && e.id === id && e.day === day)) return false;
    p.events.push({ type, id, day, ts: Date.now() });
    if (p.events.length > 1500) p.events = p.events.slice(-1500);
    persistProgress();
    return true;
  };
  KB.checkIn = function () {
    const p = KB.state.progress, day = KB.today();
    if (p.checkins.indexOf(day) >= 0) return { ok: false, message: '今天已经打过卡了' };
    p.checkins.push(day); persistProgress();
    KB.track('checkin', {});
    return { ok: true, message: '打卡成功，连续 ' + KB.progressStats().streak + ' 天' };
  };
  KB.toggleMastered = function (id) {
    const p = KB.state.progress, i = p.mastered.indexOf(id);
    if (i >= 0) { p.mastered.splice(i, 1); KB.toast('已取消「已掌握」'); }
    else { p.mastered.push(id); KB.track('mastered', { id }); KB.toast('已标记掌握', 'ok'); }
    persistProgress();
    return p.mastered.indexOf(id) >= 0;
  };
  KB.progressStats = function () {
    const p = KB.state.progress, all = KB.methods();
    const days = Array.from(new Set(p.events.map((e) => e.day))).sort();
    let streak = 0;
    for (let i = 0; ; i++) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      if (p.checkins.indexOf(d) >= 0 || days.indexOf(d) >= 0) streak++;
      else break;
      if (i > 400) break;
    }
    const byLayer = KB.LAYERS.map((l) => {
      const total = all.filter((m) => m.layer === l).length;
      const done = p.mastered.filter((id) => (KB.byId(id) || {}).layer === l).length;
      return { layer: l, total, done, pct: total ? Math.round(done / total * 100) : 0 };
    });
    const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
    const week = p.events.filter((e) => e.day >= weekAgo);
    const lvl = p.events.length >= 60 ? '链路领航员' : p.events.length >= 30 ? '四问熟手' : p.events.length >= 12 ? '卡片学徒' : '入门探索者';
    return {
      totalEvents: p.events.length, uniqueDays: days.length, streak, checkins: p.checkins.length,
      mastered: p.mastered.length, total: all.length,
      coverage: all.length ? Math.round(p.mastered.length / all.length * 100) : 0,
      byLayer, week, level: lvl,
      counts: week.reduce((acc, e) => { acc[e.type] = (acc[e.type] || 0) + 1; return acc; }, {})
    };
  };
  KB.weeklyReport = function () {
    const st = KB.progressStats(), p = KB.state.progress;
    const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
    let md = '# StackMap 学习周报\n\n> 周期：' + weekAgo + ' ~ ' + KB.today() + ' · 等级：' + st.level + ' · 连续 ' + st.streak + ' 天\n\n';
    md += '## 本周概览\n\n| 指标 | 数值 |\n| --- | --- |\n';
    md += '| 学习事件 | ' + st.week.length + ' |\n| 打卡天数 | ' + p.checkins.filter((d) => d >= weekAgo).length + ' |\n';
    md += '| 已掌握方法 | ' + st.mastered + ' / ' + st.total + '（' + st.coverage + '%） |\n';
    md += '| 完成决策向导 | ' + (st.counts.decision || 0) + ' |\n| 完成故障排查 | ' + (st.counts.troubleshoot || 0) + ' |\n';
    md += '| 新增预案策略 | ' + (st.counts.fav || 0) + ' |\n| 审核入库草稿 | ' + (st.counts['draft-approved'] || 0) + ' |\n\n';
    md += '## 本周学习的方法\n\n';
    const viewed = Array.from(new Set(st.week.filter((e) => e.type === 'view' && e.id).map((e) => e.id)));
    if (viewed.length) viewed.forEach((id) => {
      const m = KB.byId(id);
      md += '- ' + (m ? m.name : id) + (m ? '（' + (KB.LAYER_META[m.layer] || {}).label + ' · ' + m.module + '）' : '') + '\n';
    });
    else md += '_本周暂无浏览记录_\n';
    md += '\n## 分层覆盖度\n\n| 层 | 已掌握 / 总数 | 覆盖率 |\n| --- | --- | --- |\n';
    st.byLayer.forEach((x) => { md += '| ' + (KB.LAYER_META[x.layer] || {}).label + ' | ' + x.done + ' / ' + x.total + ' | ' + x.pct + '% |\n'; });
    md += '\n## 下周建议\n\n';
    const todo = KB.methods().filter((m) => p.mastered.indexOf(m.id) < 0 && KB.syncStatus(m).level !== 'ok').slice(0, 5);
    if (todo.length) todo.forEach((m) => { md += '- 复习 [' + m.name + '](' + KB.deepLink(m) + ')（' + KB.syncStatus(m).label + '）\n'; });
    else md += '- 继续沿链路学习未掌握的方法，并把常用兜底加入「我的预案」。\n';
    return md;
  };

  // ============================ F19 变更影响分析 ============================
  KB.impactOf = function (id) {
    const m = KB.byId(id);
    if (!m) return null;
    const chains = KB.chainsOf(id);
    const edges = chains.reduce((acc, c) => acc.concat(c.edges || []), []);
    const walk = (start, reverse) => {
      const seen = new Set(), q = [start];
      while (q.length) {
        const cur = q.shift();
        edges.filter((e) => reverse ? e.to === cur : e.from === cur).forEach((e) => {
          const nxt = reverse ? e.from : e.to;
          if (!seen.has(nxt) && nxt !== start) { seen.add(nxt); q.push(nxt); }
        });
      }
      return Array.from(seen);
    };
    const downstreamNodes = walk(id, false), upstreamNodes = walk(id, true);
    const lk = m.links || {};
    const checklist = Array.from(new Set([].concat(lk.upstream || [], lk.downstream || [], lk.related || [], downstreamNodes)));
    const shared = chains.length ? Array.from(new Set(checklist.concat([id]))).filter((nid) => KB.chains().filter((c) => c.nodes.indexOf(nid) >= 0).length > 1) : [];
    return {
      m, chains, edges, direct: lk, downstreamNodes, upstreamNodes, checklist, shared,
      incidents: KB.incidentsOf(id), flows: KB.flowsOf(id),
      favorites: KB.state.favorites.filter((f) => f.methodId === id),
      skeleton: KB.skeletonDiff(m)
    };
  };
  KB.impactMarkdown = function (id) {
    const x = KB.impactOf(id);
    if (!x) return '';
    let md = '# PR 变更影响检查单：' + x.m.name + '\n\n> 生成时间：' + new Date().toLocaleString('zh-CN') + ' · 来源 content/chains.json + links + links 骨架\n\n';
    md += '## 需复核的条目（' + x.checklist.length + '）\n\n';
    x.checklist.forEach((nid) => {
      const m = KB.byId(nid);
      md += '- [ ] [' + (m ? m.name : nid) + '](' + (m ? KB.deepLink(m) : '#') + ') — ' + (m ? KB.syncStatus(m).label : '条目不存在') + '\n';
    });
    md += '\n## 受影响链路（' + x.chains.length + '）\n\n';
    x.chains.forEach((c) => { md += '- ' + c.name + '：' + c.nodes.length + ' 个节点\n'; });
    md += '\n## 跨链路共享节点（' + x.shared.length + '）\n\n';
    md += x.shared.length ? x.shared.map((nid) => '- ' + ((KB.byId(nid) || {}).name || nid)).join('\n') + '\n' : '_无_\n';
    md += '\n## 关联事故与排查流\n\n';
    x.incidents.forEach((i) => { md += '- 事故：' + i.title + '\n'; });
    x.flows.forEach((f) => { md += '- 排查流：' + f.symptom + '\n'; });
    md += '\n## 兜底复核要求\n\n- [ ] 逐层确认策略 / 代码模板 / 监控项三要素仍适用\n- [ ] 更新 updatedAt，若源码已变更则标记待同步并回写 content/\n';
    return md;
  };
})();
