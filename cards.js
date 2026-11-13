/* 栈析 · cards.js — 8 张卡片、决策向导、故障排查向导、链路图 */
(function () {
  'use strict';
  const KB = window.KB;
  const E = KB.esc, I = KB.icon;
  const C = KB.cards = {};

  C.META = [
    { n: 1, t: '方法速览', q: '是什么' },
    { n: 2, t: '为什么用', q: '为什么用' },
    { n: 3, t: '替代方案对比', q: '换别的会怎样' },
    { n: 4, t: '决策向导', q: '换别的会怎样·交互版' },
    { n: 5, t: '分层兜底', q: '怎么兜底' },
    { n: 6, t: '故障排查', q: '怎么兜底·反向' },
    { n: 7, t: '链路卡', q: '上下游关系' },
    { n: 8, t: '踩坑复盘', q: '综合' }
  ];
  C.PATH = '速览 → 为什么用 → 对比/决策向导 → 分层兜底 → 故障排查 → 链路 → 踩坑复盘';

  const trunc = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const chipRow = (arr, cls) => (arr || []).map((x) => `<span class="${cls || 'tag'}">${E(x)}</span>`).join(' ');
  const bullets = (arr) => `<ul>${(arr || []).map((x) => `<li>${E(x)}</li>`).join('')}</ul>`;

  function validateBadges(m) {
    const r = KB.validateEntry(m);
    return `<div class="row-wrap mt8">
      ${r.errors.length
        ? `<span class="badge badge-red" title="${E(r.errors.join('；'))}">校验未通过 · ${r.errors.length} 项</span>`
        : `<span class="badge badge-green">✓ 结论含条件 / 兜底按层三要素齐全</span>`}
      ${KB.statusBadge(m)}
    </div>`;
  }

  // ---------- 复用组件：替代方案表 ----------
  C.alternativeTable = function (m, opts) {
    opts = opts || {};
    const alts = m.alternatives || [];
    let html = `<div class="tbl-wrap"><table class="tbl"><thead><tr>
      <th>方案</th><th>优点</th><th>缺点</th><th>何时选</th><th>迁移成本</th><th>影响层</th>
    </tr></thead><tbody>`;
    alts.forEach((a, i) => {
      html += `<tr>
        <td><strong>${E(a.name)}</strong><div class="tiny dim mt8">${KB.layerChip(a.layer)}</div></td>
        <td class="pros">${bullets(a.pros)}</td>
        <td class="cons">${bullets(a.cons)}</td>
        <td>${E(a.whenToUse)}</td>
        <td class="nowrap">${E(a.migrationCost)}</td>
        <td>${(a.affectedLayers || []).map((l) => KB.layerChip(l)).join(' ')}</td>
      </tr>`;
      if (opts.showCode !== false && a.codeSnippet) {
        html += `<tr><td colspan="6" style="background:var(--surface-2)">
          <button class="expand-btn" data-action="toggle" data-target="alt-${m.id}-${i}">▸ 展开「${E(a.name)}」代码</button>
          <div class="collapse" id="alt-${m.id}-${i}">${KB.codeBlock(a.codeSnippet)}</div>
        </td></tr>`;
      }
    });
    html += '</tbody></table></div>';
    const ok = /当|若|如果|只有在|仅在/.test(m.comparisonConclusion || '') && /则|才|改用|选择|不得|应选|可/.test(m.comparisonConclusion || '');
    html += `<div class="callout ${ok ? 'good' : 'bad'} mt16"><strong>结论（必须带条件）</strong><br>${E(m.comparisonConclusion || '（缺失）')}
      <div class="mt8 tiny">${ok ? '✓ 已校验：包含「什么条件下选哪个」' : '✗ 未通过：结论缺少条件句，按验收标准不允许入库'}</div></div>`;
    return html;
  };

  // ---------- 复用组件：分层兜底 ----------
  C.fallbackGroup = function (m, opts) {
    opts = opts || {};
    const groups = {};
    (m.fallback || []).forEach((f, i) => { (groups[f.layer] = groups[f.layer] || []).push({ f, i }); });
    let html = '';
    KB.LAYERS.forEach((layer) => {
      const rows = groups[layer];
      if (!rows || !rows.length) return;
      html += `<div class="fb-group"><div class="fb-group-head">${KB.layerChip(layer)}
        <strong>${E((KB.LAYER_META[layer] || {}).label || layer)} 层兜底</strong>
        <span class="tiny dim">${rows.length} 条策略</span></div>`;
      rows.forEach(({ f, i }) => {
        const id = `${opts.idPrefix || 'fb'}-${m.id}-${i}`.replace(/[^a-zA-Z0-9_-]/g, '_');
        const fav = KB.isFav(m.id, f);
        html += `<div class="fb-row">
          <div class="row"><span class="fb-mode">${E(f.failureMode)}</span>
            <span class="grow"></span>
            <div class="fb-elements">
              ${f.strategy ? '<span class="el-ok">✓ 策略</span>' : ''}
              ${f.codeSnippet ? '<span class="el-ok">✓ 代码模板</span>' : ''}
              ${f.monitoring ? '<span class="el-ok">✓ 监控项</span>' : ''}
              ${(!f.strategy || !f.codeSnippet || !f.monitoring) ? '<span class="badge badge-red">缺要素</span>' : ''}
            </div>
          </div>
          <div class="fb-strategy mt8">${E(f.strategy)}</div>
          <div class="fb-meta">
            <span class="monitor-pill">监控：${E(f.monitoring)}</span>
            ${f.codeSnippet ? `<button class="expand-btn" data-action="toggle" data-target="${id}">▸ 展开代码模板</button>` : ''}
            ${opts.showFav !== false ? `<button class="btn btn-sm ${fav ? 'btn-primary' : ''}" data-action="fav" data-id="${E(m.id)}" data-idx="${i}">${fav ? '✓ 已在预案' : '＋ 加入我的预案'}</button>` : ''}
          </div>
          ${f.codeSnippet ? `<div class="collapse ${opts.collapsed === false ? 'open' : ''}" id="${id}">${KB.codeBlock(f.codeSnippet)}</div>` : ''}
        </div>`;
      });
      html += '</div>';
    });
    if (!html) html = '<div class="callout bad">该条目尚无兜底策略，不满足验收标准。</div>';
    return html;
  };

  // ---------- 复用组件：链路 SVG ----------
  C.chainGraph = function (chainId, atId, compact) {
    const c = KB.chains().find((x) => x.id === chainId);
    if (!c) return '<div class="empty"><h3>链路不存在</h3></div>';
    const W = 1200, NW = 176, NH = 54;
    const colX = (i) => 56 + i * 232;
    const counts = {}, pos = {};
    c.nodes.forEach((id, idx) => {
      const m = KB.byId(id) || {};
      const li = Math.max(0, KB.LAYERS.indexOf(m.layer || 'frontend'));
      const k = counts[li] || 0; counts[li] = k + 1;
      pos[id] = { x: colX(li), y: 84 + k * 104, li, idx, m };
    });
    const rows = Math.max.apply(null, [1].concat(Object.values(counts)));
    const H = Math.max(compact ? 260 : 330, 84 + rows * 104 + 44);
    const marker = 'arw-' + String(chainId).replace(/[^a-zA-Z0-9]/g, '');
    let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><defs>
      <marker id="${marker}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--border-strong)" stroke="none"/></marker></defs>`;
    KB.LAYERS.forEach((l, i) => {
      svg += `<text class="chain-col-label" x="${colX(i) + 4}" y="34" style="fill:${KB.LAYER_META[l].color}">${E(KB.LAYER_META[l].label)}</text>`;
      svg += `<line class="chain-col-line" x1="${colX(i) - 16}" y1="46" x2="${colX(i) - 16}" y2="${H - 12}"/>`;
    });
    (c.edges || []).forEach((e) => {
      const a = pos[e.from], b = pos[e.to]; if (!a || !b) return;
      const sx = a.x + NW, sy = a.y + NH / 2, tx = b.x, ty = b.y + NH / 2;
      const d = `M ${sx} ${sy} C ${sx + 46} ${sy}, ${tx - 46} ${ty}, ${tx - 6} ${ty}`;
      svg += `<path class="chain-edge" d="${d}" marker-end="url(#${marker})"/>`;
      if (!compact) svg += `<text class="chain-edge-label" x="${(sx + tx) / 2}" y="${(sy + ty) / 2 - 7}" text-anchor="middle" style="paint-order:stroke;stroke:var(--surface);stroke-width:4px">${E(trunc(e.relation, 8))}</text>`;
    });
    c.nodes.forEach((id, idx) => {
      const p = pos[id]; if (!p) return;
      const here = atId === id;
      const name = trunc(p.m.name || id, 21);
      svg += `<g class="chain-node ${here ? 'here' : ''}" data-action="node" data-id="${E(id)}">
        <rect class="cn-main" x="${p.x}" y="${p.y}" width="${NW}" height="${NH}" rx="9"/>
        <rect class="cn-bar" x="${p.x}" y="${p.y}" width="4" height="${NH}" rx="2" fill="${KB.LAYER_META[KB.LAYERS[p.li]].color}"/>
        <text class="cn-name" x="${p.x + 14}" y="${p.y + 23}">${E(name)}</text>
        <text class="cn-layer" x="${p.x + 14}" y="${p.y + 41}">${E(KB.LAYER_META[KB.LAYERS[p.li]].label)} · ${E(trunc(p.m.module || '', 10))}</text>
        <text class="cn-layer" x="${p.x + NW - 10}" y="${p.y + 41}" text-anchor="end">#${idx + 1}</text>
        ${here ? `<text class="here-label" x="${p.x + NW}" y="${p.y - 7}" text-anchor="end">● 你在这</text>` : ''}
      </g>`;
    });
    svg += '</svg>';
    return `<div class="chain-viewport" data-chain="${E(chainId)}"><div class="chain-canvas" id="chainCanvas">${svg}</div></div>
      <div class="legend-row"><span>${I('chain')} 点击节点 → 速览卡</span><span>滚轮缩放 / 拖拽平移</span><span>${c.nodes.length} 节点 · ${(c.edges || []).length} 条关系</span>${atId ? '<span class="badge badge-accent">● 已标注「你在这」</span>' : ''}</div>`;
  };

  C.chainToolbar = function (chainId, atId) {
    const opts = KB.chains().map((c) => `<option value="${E(c.id)}" ${c.id === chainId ? 'selected' : ''}>${E(c.name)}</option>`).join('');
    return `<div class="chain-toolbar">
      <select class="plain-input" style="width:auto;min-width:190px" data-action="chainSelect">${opts}</select>
      <button class="icon-btn" data-action="zoom" data-delta="0.15" title="放大">＋</button>
      <button class="icon-btn" data-action="zoom" data-delta="-0.15" title="缩小">−</button>
      <button class="btn btn-sm" data-action="zoomReset">重置视图</button>
      <span class="grow"></span>
      <span class="tiny dim">${atId ? '当前定位：' + E(trunc((KB.byId(atId) || {}).name || atId, 26)) : '点击任意节点查看速览卡'}</span>
    </div>`;
  };

  // ---------- 卡 1 速览（含翻面） ----------
  C.quickView = function (id, here) {
    const m = KB.byId(id);
    if (!m) return '<div class="empty">条目不存在</div>';
    return `<div class="row-wrap mb12">${KB.layerChip(m.layer)}<span class="tag">${E(m.module)}</span>${KB.statusBadge(m)}${here ? '<span class="badge badge-accent">● 你在这</span>' : ''}</div>
      <div class="flip-big">${E(m.name)}</div>
      <div class="sig-line">${E(m.signature)}</div>
      <p class="muted mt12">${E(m.summary)}</p>
      <div class="hr"></div>
      <div class="triad">
        <div class="triad-col"><h4>参数</h4><ul>${(m.what.params || []).map((p) => `<li><code>${E(p.name)}: ${E(p.type)}</code> ${E(p.desc)}</li>`).join('')}</ul></div>
        <div class="triad-col"><h4>返回</h4><div class="small">${E(m.what.returns)}</div></div>
        <div class="triad-col"><h4>副作用</h4><ul>${(m.what.sideEffects || []).map((x) => `<li>${E(x)}</li>`).join('')}</ul></div>
      </div>
      <div class="small dim mt12">调用方：${E((m.what.callers || []).join('、') || '—')} · 源码：<code>${E(KB.repoPath(m))}</code></div>
      <div class="card-foot">
        <button class="btn btn-sm" data-action="go" data-route="#/entry/${E(m.id)}">打开四问详情</button>
        <button class="btn btn-sm" data-action="go" data-route="#/cards/${E(m.id)}">卡片学习</button>
        <span class="grow"></span>
        <button class="btn btn-primary btn-sm" data-action="closeModal">返回链路（不丢上下文）</button>
      </div>`;
  };

  function card1(m) {
    return `<div class="flip-scene" id="flipScene" data-action="flip">
      <div class="flip-inner">
        <div class="flip-face">
          <div class="row-wrap">${KB.layerChip(m.layer)}<span class="tag">${E(m.module)}</span><span class="tag">${E(m.stack || '—')}</span><span class="grow"></span>${KB.statusBadge(m)}</div>
          <div class="flip-big">${E(m.name)}</div>
          <div class="sig-line">${E(m.signature)}</div>
          <p class="muted mt16" style="font-size:calc(14px * var(--font-scale))">${E(m.summary)}</p>
          <div class="mt16 row-wrap">${chipRow(m.tags)}</div>
          <div class="mt16 tiny dim">源码路径：<code>${E(KB.repoPath(m))}</code> · 更新 ${E(m.updatedAt)}</div>
          <div class="mt16"><span class="badge badge-accent">点击卡片翻面 → 参数 / 返回 / 副作用 / 调用方</span></div>
        </div>
        <div class="flip-face flip-back">
          <h3>${E(m.name)} · 是什么（细节）</h3>
          <div class="grid grid-2 mt12">
            <div class="triad-col"><h4>参数</h4><ul>${(m.what.params || []).map((p) => `<li><code>${E(p.name)}: ${E(p.type)}</code><br><span class="small dim">${E(p.desc)}</span></li>`).join('')}</ul></div>
            <div class="triad-col"><h4>返回</h4><div class="small">${E(m.what.returns)}</div><h4 class="mt12">副作用</h4><ul>${(m.what.sideEffects || []).map((x) => `<li>${E(x)}</li>`).join('')}</ul></div>
          </div>
          <div class="callout mt12"><strong>调用方：</strong>${E((m.what.callers || []).join('、') || '—')}</div>
        </div>
      </div></div>
      <div class="flip-hint">↻ 点击卡片翻面 · 正面回答「是什么」</div>
      <div class="card-foot">
        <button class="btn btn-sm" data-action="card" data-index="1">为什么用 →</button>
        <button class="btn btn-sm" data-action="card" data-index="2">看替代方案 →</button>
        <button class="btn btn-sm" data-action="card" data-index="4">看兜底 →</button>
        <span class="grow tiny dim">跳转 → 卡 2 / 卡 3 / 卡 5</span>
      </div>`;
  }

  // ---------- 卡 2 为什么用 ----------
  function card2(m) {
    const w = m.why || {}, ce = w.counterExample || {};
    return `<div class="step-flow"><span class="sf cur">① 场景</span><span class="arrow">→</span><span class="sf">② 问题</span><span class="arrow">→</span><span class="sf">③ 解法</span><span class="grow"></span><span class="tiny dim">四问 · 为什么用</span></div>
      <div class="triad">
        <div class="triad-col"><h4>① 什么场景</h4>${bullets(w.scenarios)}</div>
        <div class="triad-col"><h4>② 解决什么问题</h4>${bullets(w.problemsSolved)}</div>
        <div class="triad-col"><h4>③ 本层解法与理由</h4><div class="small">${E(w.layerReason || '—')}</div></div>
      </div>
      <div class="callout warn mt16"><strong>反例 · ${E(ce.title || '不用它会怎样')}</strong><br>${E(ce.desc || '')}
        ${ce.code ? `<button class="expand-btn mt8" data-action="toggle" data-target="ce-${m.id}">▸ 查看反例代码</button><div class="collapse" id="ce-${m.id}">${KB.codeBlock(ce.code)}</div>` : ''}
      </div>
      <div class="card-pad-sm mt12" style="background:var(--surface-2);border-radius:8px">
        <button class="expand-btn" data-action="toggle" data-target="pre-${m.id}">▸ 展开前提条件（${(w.preconditions || []).length} 项）</button>
        <div class="collapse" id="pre-${m.id}" class="mt8">${bullets(w.preconditions)}</div>
      </div>
      <div class="card-foot">
        <button class="btn btn-sm" data-action="card" data-index="0">← 速览</button>
        <button class="btn btn-primary btn-sm" data-action="card" data-index="2">跳对比卡 →</button>
        <button class="btn btn-sm" data-action="card" data-index="3">试决策向导 →</button>
        <span class="grow tiny dim">跳转 → 卡 3 / 卡 4</span>
      </div>`;
  }

  // ---------- 卡 3 替代方案对比 ----------
  function card3(m) {
    return `<div class="row-wrap mb12"><span class="badge badge-purple">换别的会怎样</span><span class="tiny dim">表格 + 结论条；结论必须带条件，否则校验不通过</span></div>
      ${C.alternativeTable(m, { showCode: true })}
      <div class="card-foot">
        <button class="btn btn-sm" data-action="card" data-index="1">← 为什么用</button>
        <button class="btn btn-primary btn-sm" data-action="card" data-index="3">做决策向导 →</button>
        <button class="btn btn-sm" data-action="card" data-index="4">看兜底 →</button>
        <span class="grow"></span>
      </div>`;
  }

  // ---------- 卡 4 决策向导 ----------
  function decState(m) {
    if (!KB.state.decision[m.id]) {
      KB.state.decision[m.id] = { answers: {}, cur: ((m.decisionTree || {}).questions || [])[0] ? m.decisionTree.questions[0].id : 'END', done: false };
    }
    return KB.state.decision[m.id];
  }
  function card4(m) {
    const t = m.decisionTree;
    if (!t || !(t.questions || []).length) {
      return `<div class="empty">${I('cards')}<h3>该条目暂无决策树配置</h3><p>卡 4 属二期能力：在条目 JSON 中新增 <code>decisionTree.questions[] / rules[] / defaultResult</code> 即可驱动。<br>仓库内 14 个条目均已配置，可切换条目体验。</p></div>
        <div class="card-foot"><button class="btn btn-sm" data-action="card" data-index="2">← 对比卡</button><button class="btn btn-primary btn-sm" data-action="card" data-index="4">继续看兜底 →</button></div>`;
    }
    const st = decState(m);
    const qs = t.questions || [];
    let html = `<div class="row-wrap mb12"><span class="badge badge-accent">问卷式决策</span><span class="tiny dim">选项 → 下一步 → 结果；结果必须带条件理由</span><span class="grow"></span><button class="btn btn-sm btn-ghost" data-action="decisionReset" data-id="${E(m.id)}">重新作答</button></div>`;
    html += '<div class="step-flow">';
    qs.forEach((q, i) => {
      const done = st.answers[q.id] != null;
      html += `<span class="sf ${done ? 'done' : ''} ${!st.done && st.cur === q.id ? 'cur' : ''}">${i + 1}. ${E(trunc(q.question, 12))}</span>`;
      if (i < qs.length - 1) html += '<span class="arrow">→</span>';
    });
    html += '<span class="arrow">→</span><span class="sf ' + (st.done ? 'cur' : '') + '">结果</span></div>';

    if (!st.done) {
      const q = qs.find((x) => x.id === st.cur) || qs[0];
      html += `<h3>${E(q.question)}</h3><div class="mt12">`;
      (q.options || []).forEach((o) => {
        html += `<button class="option-btn" data-action="decision" data-id="${E(m.id)}" data-q="${E(q.id)}" data-value="${E(o.value)}" data-next="${E(o.next)}">
          <div class="ob-main">${E(o.label)} ${I('next')}</div>
          ${o.hint ? `<div class="ob-hint">${E(o.hint)}</div>` : ''}</button>`;
      });
      html += '</div>';
    } else {
      const rule = (t.rules || []).find((r) => Object.entries(r.when || {}).every(([k, v]) => st.answers[k] === v));
      const result = rule ? rule.result : (t.defaultResult || '保留当前方案');
      const reason = rule ? rule.reason : (t.defaultReason || '未命中特殊条件，按默认设计区间处理。');
      html += `<div class="result-box"><div class="tiny" style="color:var(--green)">推荐方案</div><h3>${E(result)}</h3><p class="muted mb8">${E(reason)}</p>
        <div class="row-wrap">${Object.entries(st.answers).map(([k, v]) => {
          const q = qs.find((x) => x.id === k); const o = (q.options || []).find((x) => x.value === v);
          return `<span class="tag">${E(trunc(q ? q.question : k, 10))} → ${E(o ? o.label : v)}</span>`;
        }).join('')}</div></div>
        <div class="callout mt12"><strong>条件化结论：</strong>${E(m.comparisonConclusion)}</div>`;
    }
    html += `<div class="card-foot"><button class="btn btn-sm" data-action="card" data-index="2">← 对比卡</button>
      <button class="btn btn-primary btn-sm" data-action="card" data-index="4">看分层兜底 →</button><span class="grow tiny dim">跳转 → 卡 5</span></div>`;
    return html;
  }

  // ---------- 卡 5 分层兜底 ----------
  function card5(m) {
    const layers = new Set((m.fallback || []).map((f) => f.layer));
    return `<div class="row-wrap mb12"><span class="badge badge-green">按故障模式分组 · ${layers.size} 层 / ${(m.fallback || []).length} 条</span>
      <span class="tiny dim">每行 = 层 / 策略 / 代码模板 / 监控项</span><span class="grow"></span>
      <button class="btn btn-sm" data-action="fbAll" data-id="${E(m.id)}">展开全部代码</button></div>
      ${C.fallbackGroup(m, { collapsed: true, showFav: true, idPrefix: 'card5' })}
      ${validateBadges(m)}
      <div class="card-foot"><button class="btn btn-sm" data-action="card" data-index="2">← 对比卡</button>
        <button class="btn btn-primary btn-sm" data-action="card" data-index="5">反向：故障排查 →</button>
        <span class="grow tiny dim">可「加入我的预案」并在收藏页导出</span></div>`;
  }

  // ---------- 卡 6 故障排查向导 ----------
  function trState(m) {
    if (!KB.state.trouble[m.id]) KB.state.trouble[m.id] = { flowId: null, cur: null, answers: [], done: false };
    return KB.state.trouble[m.id];
  }
  function troubleBody(flow, st, m, key) {
    key = key || m.id;
    if (!flow) return '';
    let html = `<div class="callout warn mb12"><strong>现象：</strong>${E(flow.symptom)}</div>`;
    if (st.answers.length) {
      html += '<div class="step-flow">' + st.answers.map((a, i) => `<span class="sf done" title="${E(a.hint || '')}">${i + 1}. ${E(trunc(a.label, 10))}</span>`).join('<span class="arrow">→</span>') + '</div>';
      if (st.answers.length) html += `<div class="callout mb12"><strong>逐级定位线索：</strong>${E(st.answers[st.answers.length - 1].hint || '—')}</div>`;
    }
    if (!st.done) {
      const step = flow.steps.find((s) => s.id === st.cur) || flow.steps[0];
      html += `<h3>${E(step.question)}</h3><div class="mt12">`;
      step.options.forEach((o) => {
        html += `<button class="option-btn" data-action="trAnswer" data-key="${E(key)}" data-flow="${E(flow.id)}" data-step="${E(step.id)}" data-next="${E(o.next)}" data-hint="${E(o.hint || '')}">
          <div class="ob-main">${E(o.label)} ${I('next')}</div>${o.hint ? `<div class="ob-hint">${E(o.hint)}</div>` : ''}</button>`;
      });
      html += '</div>';
    } else {
      const r = KB.byId(flow.resultMethodId);
      html += `<div class="result-box"><div class="tiny" style="color:var(--green)">命中方法</div>
        <h3>${E(r ? r.name : flow.resultMethodId)} ${r ? KB.layerChip(r.layer) : ''}</h3>
        <p class="muted mb8">${E(flow.resultHint || '')}</p>
        <div class="row-wrap">
          ${r ? `<button class="btn btn-sm btn-primary" data-action="go" data-route="#/entry/${E(r.id)}">打开四问详情</button>` : ''}
          ${flow.relatedChainId ? `<button class="btn btn-sm" data-action="go" data-route="#/chain/${E(flow.relatedChainId)}?at=${E(flow.resultMethodId)}">看链路卡</button>` : ''}
          ${flow.relatedIncidentId ? `<button class="btn btn-sm" data-action="card" data-index="7">看事故复盘</button>` : ''}
        </div></div>`;
      if (r) {
        html += `<h4 class="mt16 mb8">对应兜底建议（前 3 条）</h4><div class="triad">`;
        (r.fallback || []).slice(0, 3).forEach((f) => {
          html += `<div class="triad-col">${KB.layerChip(f.layer)}<h4 class="mt8">${E(f.failureMode)}</h4><div class="small">${E(f.strategy)}</div><div class="tiny dim mt8">监控：${E(f.monitoring)}</div></div>`;
        });
        html += '</div>';
      }
    }
    return html;
  }
  C.troubleBody = troubleBody;
  function card6(m) {
    const related = KB.flowsOf(m.id);
    const all = KB.flows();
    const st = trState(m);
    let html = `<div class="row-wrap mb12"><span class="badge badge-amber">现象 → 逐级定位 → 命中方法 → 兜底建议</span>
      <span class="grow"></span><select class="plain-input" style="width:auto;min-width:230px" data-action="trFlow" data-id="${E(m.id)}">
        <option value="">选择排查流…</option>
        ${all.map((f) => `<option value="${E(f.id)}" ${st.flowId === f.id ? 'selected' : ''}>${E(trunc(f.symptom, 22))}${related.indexOf(f) >= 0 ? ' · 相关' : ''}</option>`).join('')}
      </select></div>`;
    if (!st.flowId) {
      html += `<div class="empty">${I('tool')}<h3>从现象出发反查方法</h3><p>选一条排查流，按向导逐级定位，结果会命中具体方法并给出兜底建议。</p></div>
        <div class="grid grid-2 mt12">${all.map((f) => `<button class="option-btn" data-action="trFlowPick" data-id="${E(m.id)}" data-flow="${E(f.id)}"><div class="ob-main">${E(f.symptom)}</div><div class="ob-hint">命中 → ${E(trunc((KB.byId(f.resultMethodId) || {}).name || f.resultMethodId, 30))}</div></button>`).join('')}</div>`;
    } else {
      const flow = all.find((f) => f.id === st.flowId);
      html += troubleBody(flow, st, m);
      html += `<div class="row-wrap mt12"><button class="btn btn-sm btn-ghost" data-action="trReset" data-id="${E(m.id)}">重新排查</button></div>`;
    }
    html += `<div class="card-foot"><button class="btn btn-sm" data-action="card" data-index="4">← 分层兜底</button>
      <button class="btn btn-primary btn-sm" data-action="card" data-index="6">看链路卡 →</button><span class="grow"></span></div>`;
    return html;
  }

  // ---------- 卡 7 链路卡 ----------
  function card7(m) {
    const cs = KB.chainsOf(m.id);
    const cid = (KB.state.chainSelect && cs.some((c) => c.id === KB.state.chainSelect)) ? KB.state.chainSelect : (cs[0] || KB.chains()[0] || {}).id;
    const c = KB.chains().find((x) => x.id === cid);
    let html = `<div class="row-wrap mb12"><span class="badge badge-accent">链路关系</span>
      <span class="tiny dim">节点可点 → 速览卡；支持缩放 / 拖拽；返回不丢上下文</span></div>
      ${cs.length > 1 ? `<div class="row-wrap mb12">${cs.map((x) => `<button class="chip-filter ${x.id === cid ? 'active' : ''}" data-action="cardChain" data-id="${E(m.id)}" data-chain="${E(x.id)}">${E(x.name)}</button>`).join('')}</div>` : ''}`;
    html += c ? C.chainToolbar(cid, m.id) + C.chainGraph(cid, m.id, true) : '<div class="empty">暂无链路</div>';
    if (c) html += `<div class="callout mt12"><strong>${E(c.name)}：</strong>${E(c.description)}</div>`;
    const links = m.links || {};
    html += `<div class="grid grid-3 mt12">
      <div class="triad-col"><h4>上游 upstream</h4>${(links.upstream || []).map((id) => `<div>${KB.link('#/cards/' + id, E((KB.byId(id) || {}).name || id))}</div>`).join('') || '<span class="tiny dim">—</span>'}</div>
      <div class="triad-col"><h4>下游 downstream</h4>${(links.downstream || []).map((id) => `<div>${KB.link('#/cards/' + id, E((KB.byId(id) || {}).name || id))}</div>`).join('') || '<span class="tiny dim">—</span>'}</div>
      <div class="triad-col"><h4>相关 related</h4>${(links.related || []).map((id) => `<div>${KB.link('#/cards/' + id, E((KB.byId(id) || {}).name || id))}</div>`).join('') || '<span class="tiny dim">—</span>'}</div>
    </div>`;
    html += `<div class="card-foot"><button class="btn btn-sm" data-action="card" data-index="5">← 故障排查</button>
      <button class="btn btn-primary btn-sm" data-action="card" data-index="7">看踩坑复盘 →</button>
      <span class="grow"></span>${c ? `<button class="btn btn-sm" data-action="go" data-route="#/chain/${E(c.id)}?at=${E(m.id)}">打开完整链路视图</button>` : ''}</div>`;
    return html;
  }

  // ---------- 卡 8 踩坑复盘 ----------
  function card8(m) {
    const rel = KB.incidentsOf(m.id);
    const all = KB.incidents();
    const chosen = (KB.state.incidentSelect && all.some((i) => i.id === KB.state.incidentSelect)) ? KB.state.incidentSelect : (rel[0] || all[0] || {}).id;
    const inc = all.find((i) => i.id === chosen);
    let html = `<div class="row-wrap mb12"><span class="badge badge-red">综合复盘</span><span class="grow"></span>
      <select class="plain-input" style="width:auto;min-width:250px" data-action="incidentSelect">
        ${all.map((i) => `<option value="${E(i.id)}" ${i.id === chosen ? 'selected' : ''}>${E(i.title)}${rel.indexOf(i) >= 0 ? ' · 与本条目相关' : ''}</option>`).join('')}
      </select></div>`;
    if (!inc) return html + '<div class="empty">暂无事故复盘数据</div>';
    html += `<div class="callout bad"><strong>事故 · ${E(inc.title)}</strong><br><span class="tiny">发生于 ${E(inc.occurredAt)}</span></div>
      <div class="grid grid-2 mt12">
        <div class="triad-col"><h4>现象 symptom</h4><div class="small">${E(inc.symptom)}</div></div>
        <div class="triad-col"><h4>根因 rootCause</h4><div class="small">${E(inc.rootCause)}</div></div>
      </div>
      <h4 class="mt16 mb8">缺失兜底（逐层打叉）</h4>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>层</th><th>当时缺了什么</th><th>本应对应</th></tr></thead><tbody>
      ${(inc.missingFallbacks || []).map((x) => `<tr><td>${KB.layerChip(x.layer)} <span class="cons">✗</span></td><td>${E(x.item)}</td><td class="small dim">${E(x.expected)}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="callout good mt12"><strong>改进 improvement</strong><br>${E(inc.improvement)}</div>
      <h4 class="mt16 mb8">关联方法条目（可跳转）</h4>
      <div class="row-wrap">${(inc.relatedMethodIds || []).map((id) => `<button class="chip-filter" data-action="go" data-route="#/entry/${E(id)}">${E((KB.byId(id) || {}).name || id)}</button>`).join('')}</div>`;
    html += `<div class="card-foot"><button class="btn btn-sm" data-action="card" data-index="6">← 链路卡</button>
      <button class="btn btn-primary btn-sm" data-action="card" data-index="0">↻ 回到速览</button>
      <span class="grow tiny dim">推荐路径已走完：${E(C.PATH)}</span></div>`;
    return html;
  }

  C.body = function (m, idx) {
    switch (idx) {
      case 0: return card1(m);
      case 1: return card2(m);
      case 2: return card3(m);
      case 3: return card4(m);
      case 4: return card5(m);
      case 5: return card6(m);
      case 6: return card7(m);
      case 7: return card8(m);
      default: return card1(m);
    }
  };

  // ---------- 卡片学习外壳 ----------
  C.shell = function (m, idx) {
    const meta = C.META[idx];
    const rail = C.META.map((c, i) => `<button class="rail-item ${i === idx ? 'active' : ''}" data-action="card" data-index="${i}">
      <div class="ri-n">CARD ${c.n}</div><div class="ri-t">${E(c.t)}</div><div class="ri-q">${E(c.q)}</div></button>`).join('');
    const chains = KB.chainsOf(m.id);
    return `<div class="page-head spread">
      <div><div class="eyebrow">卡片学习 · 推荐路径</div>
        <h1>${E(meta.t)} <span class="dim" style="font-weight:400;font-size:.65em">卡 ${meta.n} / 8 · 回答「${E(meta.q)}」</span></h1>
        <p>${E(C.PATH)}</p></div>
      <div class="row-wrap">${KB.statusBadge(m)}${KB.link('#/entry/' + m.id, '四问详情', 'btn btn-sm')}</div>
    </div>
    <div class="card-rail">${rail}</div>
    <div class="learn-shell">
      <div class="card-face">${C.body(m, idx)}</div>
      <aside class="learn-aside">
        <div class="card card-pad-sm"><h4 class="mb8">当前条目</h4>
          <div class="row-wrap mb8">${KB.layerChip(m.layer)}<span class="tag">${E(m.module)}</span></div>
          <div style="font-weight:650;word-break:break-word">${E(m.name)}</div>
          <div class="tiny dim mt8" style="word-break:break-word">${E(trunc(m.signature, 76))}</div>
          <div class="hr" style="margin:12px 0"></div>
          <div class="tiny dim">标签</div><div class="row-wrap mt8">${chipRow(m.tags)}</div>
        </div>
        <div class="card card-pad-sm"><h4 class="mb8">四问覆盖</h4>
          <div class="stack" style="gap:6px">
            <div class="small">${idx === 0 ? '▶' : '✓'} 是什么 · ${(m.what.params || []).length} 参数</div>
            <div class="small">${idx <= 1 ? '○' : '✓'} 为什么用 · ${(m.why.scenarios || []).length} 场景</div>
            <div class="small">${idx <= 2 ? '○' : '✓'} 换别的 · ${(m.alternatives || []).length} 方案</div>
            <div class="small">${idx <= 4 ? '○' : '✓'} 怎么兜底 · ${(m.fallback || []).length} 条 / ${new Set((m.fallback || []).map((f) => f.layer)).size} 层</div>
          </div>
          <div class="hr" style="margin:12px 0"></div>${validateBadges(m)}
        </div>
        <div class="card card-pad-sm"><h4 class="mb8">所在链路</h4>
          ${chains.length ? chains.map((c) => `<div class="small">${KB.link('#/chain/' + c.id + '?at=' + m.id, c.name)}</div>`).join('') : '<span class="tiny dim">未纳入链路</span>'}
        </div>
        <div class="card card-pad-sm"><h4 class="mb8">切换条目</h4>
          <select class="plain-input" data-action="cardMethod"><option value="">选择方法…</option>
            ${KB.methods().map((x) => `<option value="${E(x.id)}" ${x.id === m.id ? 'selected' : ''}>${E(x.name)} · ${E((KB.LAYER_META[x.layer] || {}).label || x.layer)}</option>`).join('')}
          </select>
        </div>
      </aside>
    </div>`;
  };
})();
