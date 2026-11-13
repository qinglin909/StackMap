/* StackMap · app.js — 页面视图、事件分发、启动（2.0 页面由 views2.js 提供） */
(function () {
  'use strict';
  const KB = window.KB, C = KB.cards;
  const E = KB.esc, I = KB.icon;
  const L = KB.LAYER_META;

  // ============================ 视图辅助 ============================
  function pageHead(eyebrow, title, desc, right) {
    return `<div class="page-head spread"><div><div class="eyebrow">${E(eyebrow)}</div><h1>${E(title)}</h1><p>${E(desc)}</p></div>${right ? `<div class="row-wrap">${right}</div>` : ''}</div>`;
  }
  function notFound(msg) {
    return `<div class="empty">${I('alert')}<h3>${E(msg || '内容不存在')}</h3><p>可能已从仓库移除，或链接中的 id 有误。</p>
      <button class="btn btn-sm mt8" data-action="go" data-route="#/home">回到首页</button></div>`;
  }
  function entryCard(m) {
    return `<div class="entry-card">
      <div class="ec-top">${KB.layerChip(m.layer)}<span class="tag">${E(m.module)}</span><span class="grow"></span>${KB.statusBadge(m)}</div>
      <div><a class="ec-name" data-action="go" data-route="#/entry/${E(m.id)}">${E(m.name)}</a></div>
      <div class="ec-sig mono" title="${E(m.signature)}">${E(m.signature)}</div>
      <div class="ec-summary">${E(m.summary)}</div>
      <div class="row-wrap">${(m.tags || []).slice(0, 4).map((t) => `<span class="tag">${E(t)}</span>`).join('')}</div>
      <div class="ec-foot">${KB.statusMark(m)}<span class="tiny dim">${E(m.updatedAt)}</span><span class="grow"></span>
        <button class="btn btn-sm" data-action="go" data-route="#/entry/${E(m.id)}">四问</button>
        <button class="btn btn-sm" data-action="go" data-route="#/cards/${E(m.id)}">卡片</button></div>
    </div>`;
  }
  function badgeInline(html, cls) { return `<span class="badge ${cls || 'badge-soft'}">${html}</span>`; }
  function tagChip(t) {
    const active = KB.state.search.tags.indexOf(t) >= 0;
    return `<button class="chip-filter ${active ? 'active' : ''}" data-action="searchTag" data-tag="${E(t)}"># ${E(t)}</button>`;
  }

  // ============================ 首页 ============================
  function viewHome() {
    const all = KB.methods(), filtered = KB.filterMethods();
    const pending = all.filter((m) => KB.syncStatus(m).level === 'pending').length;
    const stale = all.filter((m) => KB.syncStatus(m).level === 'stale').length;
    const tagCount = {};
    all.forEach((m) => (m.tags || []).forEach((t) => tagCount[t] = (tagCount[t] || 0) + 1));
    const topTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 14).map((x) => x[0]);
    const recent = all.slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 5);
    const favMethods = Array.from(new Set(KB.state.favorites.map((f) => f.methodId))).slice(0, 4);

    let h = pageHead('首页 · 分层浏览', '全栈方法知识库',
      '以「方法/接口/组件」为最小单元，用四问讲清是什么、为什么用、换别的会怎样、怎么兜底；内容与代码仓库同源，随 PR 更新。',
      `<span class="badge badge-soft">${E(KB.state.project)}</span>`);

    h += `<div class="grid grid-4 mb16">
      <div class="stat accent"><div class="num">${all.length}</div><div class="lbl">方法条目</div></div>
      <div class="stat"><div class="num">${KB.chains().length}</div><div class="lbl">调用链路</div></div>
      <div class="stat amber"><div class="num">${pending}</div><div class="lbl">待同步 / 本地变更</div></div>
      <div class="stat green"><div class="num">${KB.state.favorites.length}</div><div class="lbl">我的预案策略</div></div>
    </div>`;
    h += `<div class="callout ${stale ? 'warn' : 'good'} mb16"><strong>内容防腐化：</strong>${pending} 个条目代码已变更但文档未跟（列表显示「待同步」），${stale} 个条目距上次代码变更超过 120 天（建议复核）。${KB.state.mode === 'repo' ? '当前直接读取 content/*.json。' : '当前为离线快照模式，用本地 HTTP 服务启动即切换为仓库同源。'}</div>`;

    h += `<div class="card card-pad-sm mb16"><div class="row-wrap mb8"><strong class="small">按层筛选</strong><span class="grow"></span><span class="tiny dim">可与标签组合</span></div>
      <div class="row-wrap">
        <button class="chip-filter ${KB.state.search.layers.length === 0 ? 'active' : ''}" data-action="searchLayer" data-layer="all">全部 <span class="cnt">${all.length}</span></button>
        ${KB.LAYERS.map((l) => `<button class="chip-filter ${KB.state.search.layers.indexOf(l) >= 0 ? 'active' : ''}" data-action="searchLayer" data-layer="${l}">${E(L[l].label)} <span class="cnt">${all.filter((m) => m.layer === l).length}</span></button>`).join('')}
      </div>
      <div class="hr" style="margin:12px 0"></div>
      <div class="row-wrap"><span class="small dim nowrap">标签组合</span>${topTags.map(tagChip).join('')}
        ${(KB.state.search.q || KB.state.search.layers.length || KB.state.search.tags.length) ? '<button class="chip-filter" data-action="clearFilters">✕ 清空筛选</button>' : ''}</div>
    </div>`;

    h += `<div class="spread mb12"><h2>条目 <span class="dim small">${filtered.length} / ${all.length}</span></h2>
      <div class="row-wrap"><span class="tiny dim">四问 + 链路 + 示例 + 踩坑</span>
      <button class="btn btn-sm" data-action="go" data-route="#/cards">${I('cards')} 卡片学习路径</button></div></div>`;
    h += filtered.length ? `<div class="grid grid-3">${filtered.map(entryCard).join('')}</div>` : `<div class="empty">${I('search')}<h3>没有匹配的条目</h3><p>试试清空筛选，或换一个关键词。</p></div>`;

    h += `<div class="grid grid-2 mt24">
      <div class="card"><div class="panel-title">${I('clock')}<h3>最近更新</h3>${KB.link('#/admin', '同步状态', 'btn btn-sm')}</div>
        ${recent.map((m) => `<div class="val-row"><span class="grow"><span class="link" data-action="go" data-route="#/entry/${E(m.id)}">${E(m.name)}</span> <span class="tiny dim">${E(m.module)}</span></span>${KB.statusBadge(m)}<span class="tiny dim nowrap">${E(m.updatedAt)}</span></div>`).join('')}
      </div>
      <div class="card"><div class="panel-title">${I('star')}<h3>我的预案 · 涉及方法</h3>${KB.link('#/favorites', '查看 / 导出', 'btn btn-sm')}</div>
        ${favMethods.length ? favMethods.map((id) => {
          const m = KB.byId(id);
          return `<div class="val-row"><span class="grow">${E(m ? m.name : id)}</span><span class="badge badge-soft">${KB.state.favorites.filter((f) => f.methodId === id).length} 条策略</span>
            <button class="btn btn-sm" data-action="go" data-route="#/entry/${E(id)}?tab=fallback">看兜底</button></div>`;
        }).join('') : '<div class="tiny dim">还没有收藏。进入任一「分层兜底」卡，点击「加入我的预案」。</div>'}
      </div>
    </div>`;
    return h;
  }

  // ============================ 条目详情 ============================
  const TABS = [['what', '是什么', 'Q1'], ['why', '为什么用', 'Q2'], ['alternatives', '替代方案', 'Q3'], ['fallback', '兜底', 'Q4'], ['chain', '链路', ''], ['examples', '示例', ''], ['pitfalls', '踩坑', '']];
  function viewEntry(r) {
    let m = null, byName = false;
    if (r.p1 === 'by-name' && r.p2) {
      byName = true;
      m = KB.resolveByName(r.p2);
      if (!m) return notFound('IDE 深链未解析到条目：' + r.p2 + '（请到首页按名搜索）');
    } else m = KB.byId(r.p1);
    if (!m) return notFound('找不到该条目：' + (r.p1 || '—'));
    const tab = r.qs.get('tab') || 'what';
    const ideRef = r.qs.get('ref'), ideLine = r.qs.get('line');
    let h = '';
    if (byName || ideRef) {
      h += `<div class="callout ide-banner mb16"><span class="grow"><strong>来自 IDE 的跳转（F14）</strong> · ${byName ? '按方法名解析：' + E(r.p2) : '深链定位'}
        ${ideRef ? ' · 源码 <code>' + E(ideRef) + (ideLine ? ':' + E(ideLine) : '') + '</code>' : ''}
        → 已命中 <strong>${E(m.name)}</strong> ${KB.layerChip(m.layer)}</span>
        <button class="btn btn-sm" data-action="copyDeepLink" data-id="${E(m.id)}" data-ref="${E(ideRef || m.repoPath)}" data-line="${E(ideLine || '')}">复制固定 id 深链</button>
        <button class="btn btn-sm" data-action="copyByNameLink" data-id="${E(m.id)}" data-ref="${E(ideRef || m.repoPath)}" data-line="${E(ideLine || '')}">复制按名深链</button></div>`;
    }
    h += `<div class="detail-head mb16">
      <div class="row-wrap mb8"><span class="eyebrow tiny">条目详情 · 四问 + 链路</span><span class="grow"></span>${KB.statusBadge(m)}</div>
      <h1>${E(m.name)} ${KB.layerChip(m.layer)} <span class="tag">${E(m.module)}</span> <span class="tag">${E(m.stack || '—')}</span></h1>
      <div class="sig-line mono">${E(m.signature)}</div>
      <p class="muted mt12">${E(m.summary)}</p>
      <div class="row-wrap mt12">${(m.tags || []).map((t) => `<span class="tag"># ${E(t)}</span>`).join('')}</div>
      <div class="hr"></div>
      <div class="spread row-wrap">
        <div class="small dim">源码：<code>${E(KB.repoPath(m))}</code> · 文档更新 ${E(m.updatedAt)} · 距上次代码变更 ${KB.daysSince(m.lastCodeChangeAt || m.updatedAt)} 天
          ${KB.state.role === 'readonly' ? '<span class="badge badge-amber">只读模式 · 路径已脱敏</span>' : ''}</div>
        <div class="row-wrap">
          <button class="btn btn-sm" data-action="copy" data-text="${E(m.repoPath)}">${I('copy')} 复制路径</button>
          <button class="btn btn-sm" data-action="copyDeepLink" data-id="${E(m.id)}" data-ref="${E(m.repoPath)}" data-line="">${I('link')} 复制 IDE 深链</button>
          <button class="btn btn-sm" data-action="master" data-id="${E(m.id)}">${I('check')} ${KB.state.progress.mastered.indexOf(m.id) >= 0 ? '取消掌握' : '标记已掌握'}</button>
          <button class="btn btn-primary btn-sm" data-action="go" data-route="#/cards/${E(m.id)}">${I('cards')} 卡片学习</button>
          <button class="btn btn-sm" data-action="go" data-route="#/favorites">${I('star')} 我的预案</button>
          ${KB.canEdit() ? `<button class="btn btn-sm" data-action="editEntry" data-id="${E(m.id)}">${I('edit')} 编辑</button><button class="btn btn-sm btn-danger" data-action="deleteEntry" data-id="${E(m.id)}">${I('trash')} 删除</button>` : '<span class="badge badge-soft">只读用户：不可编辑</span>'}
        </div>
      </div>
    </div>`;

    h += `<div class="tabs">${TABS.map(([k, label, q]) => `<button class="tab ${tab === k ? 'active' : ''}" data-action="tab" data-tab="${k}">${q ? `<span class="q">${q}</span>` : ''}${E(label)}</button>`).join('')}</div>`;

    const w = m.what || {}, wy = m.why || {};
    switch (tab) {
      case 'what':
        h += `<div class="question-block"><h3><span class="q-num">Q1</span> 是什么 · 参数 / 返回 / 副作用</h3>
          <div class="tbl-wrap mb16"><table class="tbl"><thead><tr><th>参数</th><th>类型</th><th>说明</th></tr></thead><tbody>
          ${(w.params || []).map((p) => `<tr><td><code>${E(p.name)}</code></td><td class="mono">${E(p.type)}</td><td>${E(p.desc)}</td></tr>`).join('')}
          </tbody></table></div>
          <div class="grid grid-3">
            <div class="triad-col"><h4>返回</h4><div class="small">${E(w.returns)}</div></div>
            <div class="triad-col"><h4>副作用</h4><ul>${(w.sideEffects || []).map((x) => `<li>${E(x)}</li>`).join('')}</ul></div>
            <div class="triad-col"><h4>调用方</h4><ul>${(w.callers || []).map((x) => `<li>${E(x)}</li>`).join('')}</ul></div>
          </div>
          <div class="callout mt16">下一步：${KB.link('#/cards/' + m.id, '打开方法速览卡（可翻面）')}，或切到「为什么用」。</div></div>`;
        break;
      case 'why':
        h += `<div class="question-block"><h3><span class="q-num">Q2</span> 为什么用 · 场景 → 问题 → 解法</h3>
          <div class="triad">
            <div class="triad-col"><h4>① 场景</h4><ul>${(wy.scenarios || []).map((x) => `<li>${E(x)}</li>`).join('')}</ul></div>
            <div class="triad-col"><h4>② 解决的问题</h4><ul>${(wy.problemsSolved || []).map((x) => `<li>${E(x)}</li>`).join('')}</ul></div>
            <div class="triad-col"><h4>③ 本层选型理由</h4><div class="small">${E(wy.layerReason || '—')}</div></div>
          </div>
          <div class="callout warn mt16"><strong>反例 · ${E((wy.counterExample || {}).title || '不用它会怎样')}</strong><br>${E((wy.counterExample || {}).desc || '')}
            ${(wy.counterExample || {}).code ? KB.codeBlock(wy.counterExample.code) : ''}</div>
          <div class="card card-pad-sm mt12"><h4 class="mb8">前提条件</h4><div class="small muted">${KB.list(wy.preconditions)}</div></div>
          <div class="row-wrap mt12"><button class="btn btn-sm" data-action="go" data-route="#/entry/${E(m.id)}?tab=alternatives">看替代方案 →</button>
            <button class="btn btn-sm" data-action="go" data-route="#/cards/${E(m.id)}?i=3">试决策向导 →</button></div></div>`;
        break;
      case 'alternatives':
        h += `<div class="question-block"><h3><span class="q-num">Q3</span> 换别的会怎样 · 替代方案对比</h3>${C.alternativeTable(m)}
          <div class="row-wrap mt12"><button class="btn btn-sm" data-action="go" data-route="#/cards/${E(m.id)}?i=3">交互版决策向导 →</button>
          <button class="btn btn-sm" data-action="go" data-route="#/entry/${E(m.id)}?tab=fallback">看兜底 →</button></div></div>`;
        break;
      case 'fallback':
        h += `<div class="question-block"><h3><span class="q-num">Q4</span> 怎么兜底 · 按层分组（策略 / 代码模板 / 监控项）</h3>
          <div class="row-wrap mb12"><span class="badge badge-green">${new Set((m.fallback || []).map((f) => f.layer)).size} 层 · ${(m.fallback || []).length} 条策略</span>
            <span class="grow"></span><button class="btn btn-sm" data-action="fbAll" data-id="${E(m.id)}">展开全部代码</button></div>
          <div id="fbAllWrap">${C.fallbackGroup(m, { collapsed: true, showFav: true, idPrefix: 'detail' })}</div>
          <div class="callout good mt12"><strong>验收校验：</strong>${KB.validateEntry(m).errors.length ? E(KB.validateEntry(m).errors.join('；')) : '兜底已按层分组，每层均含策略、代码模板、监控项三要素；对比结论含条件句。'}</div></div>`;
        break;
      case 'chain': {
        const chains = KB.chainsOf(m.id), lk = m.links || {};
        h += `<div class="question-block"><h3>链路 Tab · 上下游影响</h3>
          <div class="grid grid-3 mb16">
            <div class="triad-col"><h4>upstream 上游</h4>${(lk.upstream || []).map((id) => `<div>${KB.link('#/entry/' + id, E((KB.byId(id) || {}).name || id))}</div>`).join('') || '<span class="tiny dim">—</span>'}</div>
            <div class="triad-col"><h4>downstream 下游</h4>${(lk.downstream || []).map((id) => `<div>${KB.link('#/entry/' + id, E((KB.byId(id) || {}).name || id))}</div>`).join('') || '<span class="tiny dim">—</span>'}</div>
            <div class="triad-col"><h4>related 相关</h4>${(lk.related || []).map((id) => `<div>${KB.link('#/entry/' + id, E((KB.byId(id) || {}).name || id))}</div>`).join('') || '<span class="tiny dim">—</span>'}</div>
          </div>
          <h4 class="mb8">所在链路（${chains.length}）</h4>
          ${chains.length ? chains.map((c) => `<div class="card card-pad-sm mb8"><div class="spread"><div><strong>${E(c.name)}</strong><div class="small dim">${E(c.description)}</div></div>
            ${KB.link('#/chain/' + c.id + '?at=' + m.id, '打开链路图', 'btn btn-sm btn-primary')}</div></div>`).join('') : '<div class="callout">该条目尚未纳入任何链路，可在 content/chains.json 中补充。</div>'}
          ${chains.length ? `<div class="mt16">${C.chainToolbar(chains[0].id, m.id)}${C.chainGraph(chains[0].id, m.id, true)}</div>` : ''}
        </div>`;
        break;
      }
      case 'examples':
        h += `<div class="question-block"><h3>示例 · 场景 / 代码 / 解释</h3>
          ${(m.examples || []).length ? m.examples.map((ex) => `<div class="card mb12"><h4>${E(ex.scene)}</h4>${KB.codeBlock(ex.code)}<p class="muted small mt12">${E(ex.explain || '')}</p></div>`).join('') : '<div class="empty">暂无示例</div>'}</div>`;
        break;
      case 'pitfalls': {
        const incs = KB.incidentsOf(m.id);
        h += `<div class="question-block"><h3>踩坑记录</h3><div class="card card-pad-sm">${KB.list(m.pitfalls)}</div>
          <h4 class="mt16 mb8">关联事故复盘（${incs.length}）</h4>
          ${incs.length ? incs.map((i) => `<div class="card card-pad-sm mb8"><div class="spread"><strong>${E(i.title)}</strong><span class="tiny dim">${E(i.occurredAt)}</span></div>
            <div class="small muted mt8">${E(i.rootCause)}</div>
            <div class="mt8"><button class="btn btn-sm" data-action="go" data-route="#/cards/${E(m.id)}?i=7">打开踩坑复盘卡 →</button></div></div>`).join('') : '<div class="callout good">该条目暂无关联事故。</div>'}</div>`;
        break;
      }
    }
    return h;
  }

  // ============================ 卡片学习 ============================
  function viewCards(r) {
    if (!r.p1) {
      let h = pageHead('卡片体系 · 8 种', '选一个方法，走完推荐学习路径',
        '速览 → 为什么用 → 对比 / 决策向导 → 分层兜底 → 故障排查 → 链路 → 踩坑复盘。卡片之间可互相跳转，链路节点可到达速览卡。');
      h += '<div class="grid grid-3 mb16">' + C.META.map((c) => `<div class="card card-pad-sm"><div class="row-wrap"><span class="badge badge-accent">CARD ${c.n}</span><strong>${E(c.t)}</strong></div><div class="tiny dim mt8">回答「${E(c.q)}」</div></div>`).join('') + '</div>';
      KB.LAYERS.forEach((l) => {
        const ms = KB.methods().filter((m) => m.layer === l);
        if (!ms.length) return;
        h += `<h3 class="mt16 mb8">${KB.layerChip(l)} <span class="dim small">${ms.length} 个条目</span></h3>
          <div class="row-wrap mb16">${ms.map((m) => `<button class="chip-filter" data-action="go" data-route="#/cards/${E(m.id)}">${E(m.name)}</button>`).join('')}</div>`;
      });
      return h;
    }
    const m = KB.byId(r.p1);
    if (!m) return notFound('找不到该条目：' + r.p1);
    // 仅在路由真正变化时读取 ?i=，避免卡片按钮重渲染被深链参数覆盖
    if (KB.state.lastCardsRaw !== r.raw) {
      KB.state.lastCardsRaw = r.raw;
      const qi = r.qs.get('i');
      if (qi != null && !isNaN(parseInt(qi, 10))) KB.state.cardIndex = Math.max(0, Math.min(7, parseInt(qi, 10)));
      else if (KB.state.cardMethodId !== m.id) KB.state.cardIndex = 0;
      KB.state.cardMethodId = m.id;
    }
    return C.shell(m, KB.state.cardIndex);
  }

  // ============================ 链路视图 ============================
  function viewChains(r) {
    const list = KB.chains();
    if (!list.length) return notFound('仓库中暂无链路数据');
    const selected = (r.name === 'chain' && r.p1) ? r.p1 : (KB.state.chainSelect || list[0].id);
    if (r.name === 'chain' && r.p1) KB.state.chainSelect = r.p1;
    const c = list.find((x) => x.id === selected) || list[0];
    const at = r.qs.get('at') || null;
    const shared = c.nodes.filter((id) => list.filter((x) => x.id !== c.id && x.nodes.indexOf(id) >= 0).length > 0);

    let h = pageHead('链路视图', '沿调用链看上下游影响',
      '节点按层分列，可点击跳转到方法速览卡（返回不丢上下文）；支持滚轮缩放与拖拽平移。',
      `<span class="badge badge-soft">${list.length} 条链路</span>`);
    h += `<div class="row-wrap mb16">${list.map((x) => `<button class="chip-filter ${x.id === c.id ? 'active' : ''}" data-action="go" data-route="#/chain/${E(x.id)}">${E(x.name)}</button>`).join('')}</div>`;
    h += `<div class="card mb16"><div class="panel-title">${I('chain')}<h3>${E(c.name)}</h3>${at ? '<span class="badge badge-accent">你在这：' + E((KB.byId(at) || {}).name || at) + '</span>' : ''}</div>
      <p class="small muted">${E(c.description)}</p>
      ${C.chainToolbar(c.id, at)}${C.chainGraph(c.id, at, false)}</div>`;
    h += `<div class="grid grid-2">
      <div class="card"><div class="panel-title">${I('layers')}<h3>节点清单（${c.nodes.length}）</h3></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>方法</th><th>层</th><th>关系</th><th></th></tr></thead><tbody>
        ${c.nodes.map((id, i) => {
          const m = KB.byId(id) || {};
          const edge = (c.edges || []).find((e) => e.from === id);
          return `<tr><td>${i + 1}</td><td><strong>${E(m.name || id)}</strong></td><td>${KB.layerChip(m.layer || 'frontend')}</td>
            <td class="small dim">${E(edge ? '→ ' + edge.relation : '终点')}</td>
            <td><button class="btn btn-sm" data-action="go" data-route="#/entry/${E(id)}">四问</button></td></tr>`;
        }).join('')}</tbody></table></div></div>
      <div class="card"><div class="panel-title">${I('alert')}<h3>变更影响提示</h3></div>
        <p class="small muted">跨链路共享节点意味着：改动这些方法会同时影响多条链路，PR 需同步复核对应条目。</p>
        ${shared.length ? shared.map((id) => {
          const others = list.filter((x) => x.id !== c.id && x.nodes.indexOf(id) >= 0);
          return `<div class="callout warn mb8"><strong>${E((KB.byId(id) || {}).name || id)}</strong><br><span class="tiny">同时出现在：${others.map((x) => E(x.name)).join('、')}</span><div class="mt8">${KB.link('#/entry/' + id, '打开条目', 'btn btn-sm')}</div></div>`;
        }).join('') : '<div class="callout good">本链路暂无跨链路共享节点。</div>'}
        <div class="hr"></div><div class="tiny dim">三期 F19 预留：方法改动 → 自动波及链路与条目提醒。</div>
      </div></div>`;
    return h;
  }

  // ============================ 场景反查 ============================
  function viewScene() {
    const q = KB.state.sceneQuery;
    const res = KB.state.sceneResult;
    let h = pageHead('场景反查', '输入一句场景，跨层聚合相关方法',
      '2.0 向量语义检索：中英混合分词 → TF-IDF 向量 → 余弦相似度 + 同义词扩展；可切换 pgvector 远程检索（F11）。',
      `<span class="badge ${KB.semanticMode() === 'pgvector' ? 'badge-accent' : 'badge-soft'}">${KB.semanticMode() === 'pgvector' ? 'pgvector 语义检索' : '本地 TF-IDF 向量'}</span>
       <button class="btn btn-sm" data-action="serviceConfig">${I('tool')} 配置向量服务</button>`);
    h += `<div class="card mb16"><div class="row-wrap">
      <input id="sceneInput" class="plain-input grow" placeholder="例如：做文件上传 / 防止重复下单 / 上传回调总是失败" value="${E(q)}">
      <button class="btn btn-primary" data-action="sceneGo">${I('search')} 反查</button></div>
      <div class="row-wrap mt12"><span class="tiny dim">试试：</span>${KB.sceneExamples().map((x) => `<button class="chip-filter" data-action="sceneChip" data-q="${E(x)}">${E(x)}</button>`).join('')}</div></div>`;
    if (!q) return h + `<div class="empty">${I('scene')}<h3>从场景出发，而不是从方法名出发</h3><p>适合新人或 on-call 值班：不知道方法叫什么，只知道要做什么 / 出了什么现象。</p></div>`;
    if (!res || !res.length) return h + `<div class="empty"><h3>没有命中的方法</h3><p>换个说法，或到首页按层浏览。</p></div>`;
    if (KB.state.semanticNotice) h += `<div class="callout warn mb16">${E(KB.state.semanticNotice)}</div>`;
    h += `<div class="callout mb16"><strong>「${E(q)}」</strong> 命中 ${res.length} 个方法，跨 ${new Set(res.map((x) => x.m.layer)).size} 层。按向量相关度排序并按层分组。</div>`;
    KB.LAYERS.forEach((l) => {
      const rows = res.filter((x) => x.m.layer === l);
      if (!rows.length) return;
      h += `<h3 class="mt16 mb8">${KB.layerChip(l)} <span class="dim small">${rows.length} 个</span></h3><div class="grid grid-2">`;
      rows.forEach(({ m, score, hits, remote }) => {
        h += `<div class="entry-card"><div class="ec-top"><span class="badge ${x.remote ? 'badge-accent' : 'badge-soft'}">${remote ? 'pgvector ' : ''}相关度 ${score}%</span><span class="grow"></span>${KB.statusBadge(m)}</div>
          <div><a class="ec-name" data-action="go" data-route="#/entry/${E(m.id)}">${E(m.name)}</a></div>
          <div class="ec-summary">${E(m.summary)}</div>
          <div class="row-wrap">${hits.slice(0, 4).map((t) => `<span class="tag active">${E(t)}</span>`).join('')}${(m.tags || []).slice(0, 2).map((t) => `<span class="tag"># ${E(t)}</span>`).join('')}</div>
          <div class="ec-foot"><span class="tiny dim">${E(m.module)} · ${(m.fallback || []).length} 条兜底</span><span class="grow"></span>
            <button class="btn btn-sm" data-action="go" data-route="#/entry/${E(m.id)}">四问</button>
            <button class="btn btn-sm" data-action="go" data-route="#/cards/${E(m.id)}">卡片</button></div></div>`;
      });
      h += '</div>';
    });
    return h;
  }

  // ============================ 故障排查 ============================
  function viewTroubleshoot(r) {
    const flows = KB.flows();
    if (!flows.length) return notFound('暂无排查流配置');
    if (!r.p1) {
      let h = pageHead('故障排查', '从现象反查到方法', '向导式：现象 → 逐级定位（链路环节 → 原因）→ 命中方法 → 兜底建议；结果可跳兜底卡与链路卡。');
      h += `<div class="grid grid-2">${flows.map((f) => `<div class="card"><div class="row-wrap mb8"><span class="badge badge-amber">现象</span><span class="grow"></span><span class="tiny dim">${f.steps.length} 步</span></div>
        <h3>${E(f.symptom)}</h3>
        <p class="small muted mt8">命中方法：${E((KB.byId(f.resultMethodId) || {}).name || f.resultMethodId)}</p>
        <div class="row-wrap mt12"><button class="btn btn-primary btn-sm" data-action="go" data-route="#/troubleshoot/${E(f.id)}">开始排查 →</button>
          ${f.relatedIncidentId ? `<button class="btn btn-sm" data-action="go" data-route="#/cards/${E(f.resultMethodId)}?i=7">看事故复盘</button>` : ''}</div></div>`).join('')}</div>`;
      return h;
    }
    const flow = flows.find((f) => f.id === r.p1);
    if (!flow) return notFound('找不到排查流：' + r.p1);
    if (!KB.state.trouble.global || KB.state.trouble.global.flowId !== flow.id) {
      KB.state.trouble.global = { flowId: flow.id, cur: flow.steps[0].id, answers: [], done: false };
    }
    const st = KB.state.trouble.global;
    const m = KB.byId(flow.resultMethodId) || { id: 'global', name: flow.resultMethodId };
    let h = pageHead('故障排查向导', flow.symptom, '每一步都会给出定位线索；命中后可直接跳兜底卡、链路卡与事故复盘卡。',
      KB.link('#/troubleshoot', '← 全部现象', 'btn btn-sm'));
    h += `<div class="grid" style="grid-template-columns:minmax(0,1fr) 260px">
      <div class="card-face">${C.troubleBody(flow, st, m, 'global')}
        <div class="card-foot"><button class="btn btn-sm" data-action="trReset" data-id="global">重新排查</button>
          <button class="btn btn-sm" data-action="go" data-route="#/entry/${E(flow.resultMethodId)}">打开命中方法四问</button>
          <span class="grow tiny dim">卡 6 · 怎么兜底（反向）</span></div></div>
      <aside class="learn-aside">
        <div class="card card-pad-sm"><h4 class="mb8">关联链路</h4>
          ${flow.relatedChainId ? `<div class="small">${KB.link('#/chain/' + flow.relatedChainId + '?at=' + flow.resultMethodId, (KB.chains().find((c) => c.id === flow.relatedChainId) || {}).name || flow.relatedChainId)}</div>` : '<span class="tiny dim">—</span>'}</div>
        <div class="card card-pad-sm"><h4 class="mb8">关联事故</h4>
          ${flow.relatedIncidentId ? `<div class="small">${E((KB.incidents().find((i) => i.id === flow.relatedIncidentId) || {}).title || '')}</div><div class="mt8">${KB.link('#/cards/' + flow.resultMethodId + '?i=7', '踩坑复盘卡 →', 'btn btn-sm')}</div>` : '<span class="tiny dim">—</span>'}</div>
        <div class="card card-pad-sm"><h4 class="mb8">提示</h4><div class="tiny dim">排查结果给出的兜底建议来自条目 fallback 字段，与分层兜底卡同源，不会出现两套口径。</div></div>
      </aside></div>`;
    return h;
  }

  // ============================ 我的预案 ============================
  function viewFavorites() {
    const favs = KB.state.favorites;
    const groups = {};
    favs.forEach((f) => (groups[f.methodId] = groups[f.methodId] || []).push(f));
    let h = pageHead('收藏 / 我的预案', '我收藏的分层兜底策略',
      '收藏粒度是「某方法 × 某层 × 某故障模式」的一条策略；导出保留层、策略、代码模板、监控项四要素。',
      `<button class="btn btn-sm" data-action="exportMd">${I('download')} 导出 Markdown</button>
       <button class="btn btn-sm" data-action="exportPdf">导出 PDF / 打印</button>`);
    h += `<div class="print-only mb16"><h1>我的分层兜底预案</h1><p>导出时间：${E(new Date().toLocaleString('zh-CN'))} · 共 ${favs.length} 条策略</p></div>`;
    if (!favs.length) return h + `<div class="empty">${I('star')}<h3>预案还是空的</h3><p>进入任一「分层兜底」卡或条目详情的兜底 Tab，点击「加入我的预案」。</p>
      <button class="btn btn-sm mt8" data-action="go" data-route="#/home">去浏览条目</button></div>`;
    h += `<div class="grid grid-4 mb16">
      <div class="stat accent"><div class="num">${favs.length}</div><div class="lbl">策略总数</div></div>
      <div class="stat"><div class="num">${Object.keys(groups).length}</div><div class="lbl">覆盖方法</div></div>
      <div class="stat green"><div class="num">${new Set(favs.map((f) => f.layer)).size}</div><div class="lbl">覆盖层</div></div>
      <div class="stat"><div class="num">${favs.filter((f) => f.codeSnippet && f.monitoring && f.strategy).length}</div><div class="lbl">三要素完整</div></div>
    </div>`;
    Object.entries(groups).forEach(([id, rows]) => {
      const m = KB.byId(id);
      h += `<div class="card mb16"><div class="spread mb12"><div><h3>${E(m ? m.name : id)} ${m ? KB.layerChip(m.layer) : ''}</h3>
        <div class="tiny dim">${E(m ? m.module : '')} · ${rows.length} 条策略</div></div>
        <div class="row-wrap">${m ? `<button class="btn btn-sm" data-action="go" data-route="#/entry/${E(id)}?tab=fallback">查看完整兜底</button>` : ''}</div></div>`;
      KB.LAYERS.forEach((layer) => {
        const rs = rows.filter((r) => r.layer === layer);
        if (!rs.length) return;
        h += `<div class="fb-group"><div class="fb-group-head">${KB.layerChip(layer)}<strong>${E(L[layer].label)} 层</strong><span class="tiny dim">${rs.length} 条</span></div>`;
        rs.forEach((f) => {
          h += `<div class="fb-row"><div class="row"><span class="fb-mode">${E(f.failureMode)}</span><span class="grow"></span>
            <button class="btn btn-sm btn-danger" data-action="favRemove" data-key="${E(f.key)}">移出</button></div>
            <div class="fb-strategy mt8">${E(f.strategy)}</div>
            <div class="fb-meta"><span class="monitor-pill">监控：${E(f.monitoring)}</span>
              <span class="tiny dim">收藏于 ${E(f.addedAt)}</span></div>
            ${KB.codeBlock(f.codeSnippet)}</div>`;
        });
        h += '</div>';
      });
      h += '</div>';
    });
    return h;
  }

  // ============================ 内容管理 ============================
  function viewAdmin() {
    const all = KB.methods();
    const val = KB.validateAll();
    const prev = KB.state.importPreview || [];
    const previewValid = prev.length && prev.every((p) => !p.errors.length);
    let h = pageHead('内容管理（内部）', '条目增删改 · 仓库同步 · 过期提醒',
      '事实源是 content/ 目录；导入或编辑先落在本地覆盖层并标记「待同步」，由编辑者回写仓库后重建快照。',
      `<span class="badge ${KB.state.mode === 'repo' ? 'badge-green' : 'badge-amber'}">${KB.state.mode === 'repo' ? '仓库同源 · content/' : '离线快照 · data.js'}</span>`);

    if (!KB.canEdit()) h += `<div class="callout warn mb16"><strong>只读用户：</strong>可以查看同步状态与校验结果，但不能导入、编辑、删除或导出备份。内部代码路径已脱敏。切换到「编辑者」或「管理员」以操作。</div>`;

    // 同步状态
    h += `<div class="card mb16"><div class="panel-title">${I('refresh')}<h3>与仓库同步状态</h3><span class="grow"></span>
      <button class="btn btn-sm" data-action="reloadRepo">重新读取 content/</button>
      <button class="btn btn-sm" data-action="exportJson">${I('download')} 导出全部条目备份</button></div>
      <div class="row-wrap mb12">
        <span class="badge badge-soft">条目 ${all.length}</span>
        <span class="badge badge-amber">待同步 ${all.filter((m) => KB.syncStatus(m).level === 'pending').length}</span>
        <span class="badge badge-red">可能过期 ${all.filter((m) => KB.syncStatus(m).level === 'stale').length}</span>
        <span class="badge badge-green">已同步 ${all.filter((m) => KB.syncStatus(m).level === 'ok').length}</span>
        <span class="grow"></span><span class="tiny dim">快照生成于 ${E((KB.state.generatedAt || '').slice(0, 19).replace('T', ' ') || '—')}</span>
      </div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>条目</th><th>层</th><th>状态</th><th>文档更新</th><th>距上次代码变更</th><th>仓库路径</th><th></th></tr></thead><tbody>
      ${all.slice().sort((a, b) => (KB.syncStatus(b).level === 'pending' ? 1 : 0) - (KB.syncStatus(a).level === 'pending' ? 1 : 0)).map((m) => {
        const s = KB.syncStatus(m);
        return `<tr><td><strong>${E(m.name)}</strong><div class="tiny dim">${E(m.id)}</div></td>
          <td>${KB.layerChip(m.layer)}</td><td><span class="badge ${s.level === 'ok' ? 'badge-green' : s.level === 'pending' ? 'badge-amber' : 'badge-red'}" title="${E(s.detail)}">${s.label}</span></td>
          <td class="nowrap tiny">${E(m.updatedAt)}</td><td class="tiny">${KB.daysSince(m.lastCodeChangeAt || m.updatedAt)} 天</td>
          <td class="tiny mono">${E(KB.repoPath(m))}</td>
          <td class="nowrap"><button class="btn btn-sm" data-action="go" data-route="#/entry/${E(m.id)}">查看</button>
            ${KB.canEdit() ? `<button class="btn btn-sm" data-action="editEntry" data-id="${E(m.id)}">编辑</button>` : ''}</td></tr>`;
      }).join('')}</tbody></table></div></div>`;

    // 校验
    h += `<div class="card mb16"><div class="panel-title">${I('check')}<h3>验收标准校验</h3><span class="grow"></span>
      <button class="btn btn-sm" data-action="validate">重新校验</button></div>
      <div class="row-wrap mb12">
        <span class="badge ${val.errors.length ? 'badge-red' : 'badge-green'}">${val.errors.length ? '✗ ' + val.errors.length + ' 项未通过' : '✓ 全部通过'}</span>
        <span class="badge badge-soft">${val.warnings.length} 条提醒</span>
        <span class="tiny dim">结论必须含条件 · 兜底按层且三要素齐全 · 链路 / 事故 / 排查流引用完整</span></div>
      ${val.errors.length ? `<div class="callout bad">${val.errors.slice(0, 12).map((x) => `<div>• ${E(x)}</div>`).join('')}${val.errors.length > 12 ? `<div class="tiny">… 另有 ${val.errors.length - 12} 项</div>` : ''}</div>` : '<div class="callout good">所有条目均满足：对比卡结论含「什么条件下选哪个」；兜底卡按层分组且每行含策略、代码模板、监控项；链路节点引用完整。</div>'}
      ${val.warnings.length ? `<div class="callout warn mt8">${val.warnings.slice(0, 6).map((x) => `<div>• ${E(x)}</div>`).join('')}</div>` : ''}</div>`;

    // 导入
    h += `<div class="card mb16"><div class="panel-title">${I('file')}<h3>从 Markdown / JSON 导入</h3><span class="grow"></span>
      <span class="tiny dim">格式见 content/README.md</span></div>
      ${KB.canEdit() ? `<div class="grid grid-2">
        <div class="upload-zone"><label class="file-label">${I('download')} 选择 .json / .md 文件（可多选）
          <input type="file" id="importFiles" multiple accept=".json,.md,.markdown,.txt"></label>
          <div class="tiny dim mt8">样例：content/methods/m.demo.retryWithBackoff.md</div></div>
        <div><div class="field"><label>或直接粘贴内容</label><textarea id="importText" placeholder='粘贴 Markdown 条目或 JSON 数组 / { "entries": [...] }'></textarea></div>
          <button class="btn btn-sm" data-action="importPaste">解析粘贴内容</button></div>
      </div>` : '<div class="callout">只读用户不可导入。</div>'}
      ${prev.length ? `<div class="hr"></div><h4 class="mb8">解析预览（${prev.length} 个条目）</h4>
        ${prev.map((p) => `<div class="val-row"><span class="vr-ico ${p.errors.length ? 'vr-err' : 'vr-ok'}">${p.errors.length ? '!' : '✓'}</span>
          <span class="grow"><strong>${E(p.entry.name)}</strong> <span class="tiny dim">${E(p.entry.id)} · ${E(p.entry.source)}</span>
          ${p.errors.length ? `<div class="tiny" style="color:var(--red)">${E(p.errors.join('；'))}</div>` : ''}</span>
          ${KB.layerChip(p.entry.layer)}</div>`).join('')}
        <div class="row-wrap mt12"><button class="btn btn-primary btn-sm ${previewValid ? '' : 'disabled'}" data-action="commitImport">写入本地覆盖层（标记待同步）</button>
          <button class="btn btn-sm" data-action="clearPreview">清空预览</button>
          ${!previewValid ? '<span class="tiny" style="color:var(--red)">存在校验错误，按验收标准不允许入库</span>' : ''}</div>` : ''}
    </div>`;

    // CRUD
    h += `<div class="card mb16"><div class="panel-title">${I('db')}<h3>条目 CRUD 与本地覆盖层</h3><span class="grow"></span>
      ${KB.canEdit() ? `<button class="btn btn-primary btn-sm" data-action="newEntry">${I('plus')} 新建条目</button>
        <button class="btn btn-sm btn-danger" data-action="resetLocal">清除所有本地变更</button>` : ''}</div>
      <div class="row-wrap"><span class="badge badge-soft">本地新增/修改 ${Object.keys(KB.state.overlays).length}</span>
        <span class="badge badge-soft">本地删除 ${KB.state.deleted.length}</span>
        <span class="tiny dim">编辑以完整 JSON 形式进行，字段由 schema/method-entry.schema.json 约束。</span></div>
      <div class="callout mt12"><strong>同步流程：</strong>本地编辑 → 内容管理页出现「待同步」→ 编辑者把条目回写 content/methods.json → 运行 <code>node tools/build-snapshot.mjs</code> 重建快照 → 状态恢复「已同步」。</div></div>`;

    // F15 自动抽取的 links 骨架
    const sk = KB.linksSkeleton();
    const diffRows = sk ? all.map((m) => ({ m, d: KB.skeletonDiff(m) })).filter((x) => x.d && x.d.changes > 0) : [];
    h += `<div class="card mb16"><div class="panel-title">${I('link')}<h3>调用关系骨架（F15 · 自动抽取）</h3><span class="grow"></span>
      ${KB.link('#/impact', '变更影响分析 →', 'btn btn-sm')}</div>
      ${sk ? `<div class="row-wrap mb12">
          ${badgeInline('解析器 ' + E(sk.parser || '—'), 'badge-soft')}
          ${badgeInline('生成 ' + E(String(sk.generatedAt || '').slice(0, 19).replace('T', ' ')), 'badge-soft')}
          ${badgeInline('扫描 ' + (sk.summary ? sk.summary.files : 0) + ' 文件 / ' + (sk.summary ? sk.summary.signatures : 0) + ' 签名 / ' + (sk.summary ? sk.summary.callEdges : 0) + ' 调用边', 'badge-soft')}
          ${badgeInline(diffRows.length + ' 条与人工 links 有差异', diffRows.length ? 'badge-amber' : 'badge-green')}
        </div>
        <div class="tiny dim mb12">由 <code>node tools/extract-links.mjs</code> 从 samples/ 源码抽取，生成 content/generated/links.skeleton.json，随快照一起打包。<strong>骨架只提供建议，绝不自动覆盖人工 links。</strong></div>
        ${diffRows.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>条目</th><th>upstream</th><th>downstream</th><th>related</th><th></th></tr></thead><tbody>
        ${diffRows.slice(0, 8).map(({ m, d }) => `<tr><td><strong>${E(m.name)}</strong></td>
          ${['upstream', 'downstream', 'related'].map((k) => `<td class="small"><span class="txt-green">+${d.diff[k].added.length}</span> / <span class="txt-red">−${d.diff[k].removed.length}</span></td>`).join('')}
          <td class="nowrap">${KB.canEdit() ? `<button class="btn btn-sm" data-action="applySkeleton" data-id="${E(m.id)}">采纳建议</button>` : ''}
            <button class="btn btn-sm" data-action="go" data-route="#/impact?id=${E(m.id)}">影响面</button></td></tr>`).join('')}
        </tbody></table></div>` : '<div class="callout good">所有条目的 links 与抽取建议一致。</div>'}
        ${diffRows.length > 8 ? `<div class="tiny dim mt8">… 另有 ${diffRows.length - 8} 条，可在「变更影响分析」逐条查看。</div>` : ''}`
        : `<div class="callout warn">尚未生成骨架。运行 <code>node tools/extract-links.mjs</code>，再执行 <code>npm run build</code> 重建快照即可在离线模式使用。</div>`}</div>`;

    // 权限
    h += `<div class="card"><div class="panel-title">${I('layers')}<h3>权限与合规</h3></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>角色</th><th>浏览 / 搜索 / 卡片</th><th>收藏预案</th><th>导入 / 编辑 / 删除</th><th>导出备份</th><th>路径脱敏</th></tr></thead><tbody>
      <tr><td>只读用户</td><td>✓</td><td>✓</td><td>✗</td><td>✗</td><td>✓ 内部代码路径遮罩</td></tr>
      <tr><td>编辑者</td><td>✓</td><td>✓</td><td>✓</td><td>只读分享外可导出</td><td>✗</td></tr>
      <tr><td>管理员</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td><td>✗</td></tr>
      </tbody></table></div><div class="tiny dim mt8">当前角色：<strong>${E({ readonly: '只读用户', editor: '编辑者', admin: '管理员' }[KB.state.role])}</strong>（左下角可切换，仅用于本地演示权限门控）。</div></div>`;
    return h;
  }

  // ============================ 主渲染 ============================
  function renderMain() {
    const main = document.getElementById('main');
    const r = KB.state.route;
    if (KB.track) {
      if (r.name === 'entry' && r.p1) {
        const tm = r.p1 === 'by-name' ? (KB.resolveByName && KB.resolveByName(r.p2)) : KB.byId(r.p1);
        if (tm) KB.track('view', { id: tm.id });
      }
      if (r.name === 'cards' && r.p1) KB.track('card', { id: r.p1 });
      if (r.name === 'impact' && r.qs.get('id')) KB.track('impact', { id: r.qs.get('id') });
    }
    let html;
    switch (r.name) {
      case 'home': html = viewHome(); break;
      case 'entry': html = viewEntry(r); break;
      case 'cards': html = viewCards(r); break;
      case 'chains': case 'chain': html = viewChains(r); break;
      case 'scene': html = viewScene(); break;
      case 'troubleshoot': html = viewTroubleshoot(r); break;
      case 'favorites': html = viewFavorites(); break;
      case 'admin': html = viewAdmin(); break;
      case 'incidents': case 'incident': case 'drafts': case 'progress': case 'impact':
        html = KB.views2.view(r.name, r); break;
      default: html = notFound('未知页面：' + r.name);
    }
    main.innerHTML = html;
    applyChainTransform();
  }
  KB.renderMain = renderMain;

  function applyChainTransform() {
    const c = document.getElementById('chainCanvas');
    if (!c) return;
    const v = KB.state.chainView;
    c.style.transform = `translate(${v.tx}px, ${v.ty}px) scale(${v.scale})`;
  }
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // ============================ 事件分发 ============================
  function rerender() { KB.renderMain(); }
  function setTrouble(key, flowId) {
    const f = KB.flows().find((x) => x.id === flowId);
    KB.state.trouble[key] = { flowId: f ? f.id : null, cur: f ? f.steps[0].id : null, answers: [], done: false };
  }

  function click(e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const a = el.dataset.action;
    const d = el.dataset;
    if (a === 'overlayClose') { if (e.target === el) KB.closeModal(); return; }
    // 2.0 页面（事故 / 草稿 / 进度 / 影响 / 服务配置 / 深链）委托给 views2.js
    if (KB.views2 && KB.views2.action(a, d, el, rerender)) return;

    switch (a) {
      case 'go':
        KB.closeModal();
        if (/^#\/(chain|chains)/.test(d.route || '')) KB.state.chainView = { scale: 1, tx: 0, ty: 0 };
        KB.navigate(d.route); break;
      case 'back': KB.closeModal(); KB.back(); break;
      case 'tab': KB.navigate('#/entry/' + KB.state.route.p1 + '?tab=' + d.tab, { push: false }); break;
      case 'closeModal': KB.closeModal(); break;
      case 'flip': { const s = el.closest('.flip-scene'); if (s) s.classList.toggle('flipped'); break; }
      case 'toggle': { const t = document.getElementById(d.target); if (t) t.classList.toggle('open'); break; }
      case 'copy': {
        const cb = el.closest('.code-block');
        const text = cb ? cb.querySelector('code').textContent : (d.text || '');
        KB.copyText(text); break;
      }
      case 'card': KB.state.cardIndex = parseInt(d.index, 10) || 0; rerender(); break;
      case 'cardChain': KB.state.chainSelect = d.chain; KB.state.chainView = { scale: 1, tx: 0, ty: 0 }; rerender(); break;
      case 'decision': {
        const st = KB.state.decision[d.id] || (KB.state.decision[d.id] = { answers: {}, cur: null, done: false });
        st.answers[d.q] = d.value;
        if (d.next === 'END') { st.done = true; if (KB.track) KB.track('decision', { id: d.id }); }
        else st.cur = d.next;
        rerender(); break;
      }
      case 'decisionReset': delete KB.state.decision[d.id]; rerender(); break;
      case 'trFlowPick': setTrouble(d.id, d.flow); rerender(); break;
      case 'trAnswer': {
        const st = KB.state.trouble[d.key] || (KB.state.trouble[d.key] = { flowId: null, cur: null, answers: [], done: false });
        const flow = KB.flows().find((f) => f.id === d.flow);
        const step = flow && flow.steps.find((s) => s.id === d.step);
        const opt = step && step.options.find((o) => o.next === d.next);
        st.answers.push({ step: d.step, label: opt ? opt.label : d.next, hint: d.hint || (opt ? opt.hint : '') });
        st.hint = d.hint || '';
        if (d.next === 'RESULT') { st.done = true; if (KB.track) KB.track('troubleshoot', { id: d.flow }); }
        else st.cur = d.next;
        rerender(); break;
      }
      case 'trReset': setTrouble(d.id, (KB.state.trouble[d.id] || {}).flowId); rerender(); break;
      case 'node': KB.modal({ title: '方法速览卡', html: C.quickView(d.id, true), wide: true }); break;
      case 'zoom': {
        KB.state.chainView.scale = clamp(Math.round((KB.state.chainView.scale + parseFloat(d.delta)) * 100) / 100, 0.5, 2.2);
        applyChainTransform(); break;
      }
      case 'zoomReset': KB.state.chainView = { scale: 1, tx: 0, ty: 0 }; applyChainTransform(); break;
      case 'fav': {
        const m = KB.byId(d.id); const fb = m && m.fallback[parseInt(d.idx, 10)];
        if (m && fb) { KB.toggleFav(m.id, fb); if (KB.track) KB.track('fav', { id: m.id }); } break;
      }
      case 'favRemove': KB.removeFav(d.key); break;
      case 'fbAll': {
        const scope = document.getElementById('fbAllWrap') || document.querySelector('.card-face') || document.body;
        const boxes = scope.querySelectorAll('.collapse');
        const anyClosed = Array.from(boxes).some((b) => !b.classList.contains('open'));
        boxes.forEach((b) => b.classList.toggle('open', anyClosed));
        break;
      }
      case 'searchLayer': {
        const l = d.layer;
        if (l === 'all') KB.state.search.layers = [];
        else {
          const i = KB.state.search.layers.indexOf(l);
          if (i >= 0) KB.state.search.layers.splice(i, 1); else KB.state.search.layers.push(l);
        }
        rerender(); break;
      }
      case 'searchTag': {
        const t = d.tag, arr = KB.state.search.tags, i = arr.indexOf(t);
        if (i >= 0) arr.splice(i, 1); else arr.push(t);
        rerender(); break;
      }
      case 'clearFilters': KB.state.search = { q: '', layers: [], tags: [] }; KB.render(); break;
      case 'sceneGo': case 'sceneChip': {
        const inp = document.getElementById('sceneInput');
        const q = a === 'sceneChip' ? d.q : (inp ? inp.value.trim() : '');
        KB.state.sceneQuery = q; KB.state.sceneResult = KB.sceneSearch(q);
        KB.state.semanticNotice = ''; rerender();
        if (KB.sceneSearchAsync) KB.sceneSearchAsync(q).then((rs) => { KB.state.sceneResult = rs; rerender(); });
        break;
      }
      case 'exportMd': {
        if (!KB.state.favorites.length) { KB.toast('预案为空，无可导出内容', 'err'); break; }
        KB.download('我的分层兜底预案.md', KB.favoritesMarkdown(), 'text/markdown'); break;
      }
      case 'exportPdf': {
        if (!KB.state.favorites.length) { KB.toast('预案为空，无可导出内容', 'err'); break; }
        KB.toast('已打开打印视图，可在浏览器里另存为 PDF'); setTimeout(() => window.print(), 260); break;
      }
      case 'exportJson': {
        if (!KB.canEdit()) { KB.toast('只读用户不可导出备份', 'err'); break; }
        const backup = { schemaVersion: '1.0', exportedAt: new Date().toISOString(), entries: KB.methods() };
        KB.download('methods-backup-' + KB.today() + '.json', JSON.stringify(backup, null, 2), 'application/json'); break;
      }
      case 'theme': KB.setTheme(KB.state.theme === 'dark' ? 'light' : 'dark'); break;
      case 'font': KB.setFont(parseFloat(d.delta)); break;
      case 'reloadRepo': KB.loadRepo(true).then(() => KB.render()); break;
      case 'validate': KB.render(); KB.toast('已完成验收标准校验', 'ok'); break;
      case 'importPaste': {
        const t = document.getElementById('importText');
        addImport(t ? t.value : '', 'paste.txt'); break;
      }
      case 'commitImport': {
        const prev = KB.state.importPreview || [];
        if (!prev.length || prev.some((p) => p.errors.length)) { KB.toast('存在校验错误，不允许入库', 'err'); break; }
        KB.commitImport(prev.map((p) => p.entry)); KB.state.importPreview = null; KB.render(); break;
      }
      case 'clearPreview': KB.state.importPreview = null; KB.render(); break;
      case 'newEntry': openEditor(null); break;
      case 'editEntry': openEditor(KB.byId(d.id)); break;
      case 'deleteEntry': {
        if (!KB.canEdit()) { KB.toast('只读用户不可删除', 'err'); break; }
        if (confirm('确认删除条目「' + (KB.byId(d.id) || {}).name + '」？\n这是本地覆盖层的删除，可从「内容管理」清除所有本地变更恢复。')) {
          KB.deleteEntry(d.id); KB.toast('已删除（本地，标记待同步）'); KB.render();
        }
        break;
      }
      case 'saveEntry': {
        if (!KB.canEdit()) { KB.toast('只读用户不可编辑', 'err'); break; }
        const ta = document.getElementById('entryJson');
        if (!ta) break;
        let obj;
        try { obj = JSON.parse(ta.value); } catch (err) { KB.toast('JSON 解析失败：' + err.message, 'err'); break; }
        const v = KB.validateEntry(obj);
        if (v.errors.length) { KB.toast('校验未通过：' + v.errors[0], 'err'); break; }
        KB.saveEntry(obj); KB.closeModal(); KB.toast('已保存（本地覆盖层，标记待同步）', 'ok'); KB.render();
        break;
      }
      case 'resetLocal': {
        if (!KB.isAdmin() && !KB.canEdit()) { KB.toast('权限不足', 'err'); break; }
        if (confirm('清除所有本地新增 / 修改 / 删除，恢复到仓库内容？此操作不可撤销。')) {
          KB.resetLocal(); KB.toast('已恢复仓库内容'); KB.render();
        }
        break;
      }
    }
  }

  function addImport(text, filename) {
    const res = KB.parseImport(text, filename);
    const prev = KB.state.importPreview || (KB.state.importPreview = []);
    if (res.errors && res.errors.length) { KB.toast(res.errors[0], 'err'); return; }
    res.entries.forEach((entry) => {
      const v = KB.validateEntry(entry);
      prev.push({ entry, errors: v.errors });
    });
    KB.render();
    KB.toast(`解析出 ${res.entries.length} 个条目，请检查预览`, 'ok');
  }

  function templateEntry() {
    return {
      id: 'm.local.new' + Date.now().toString(36).slice(-4), name: 'newMethod', signature: 'newMethod(arg: string): Promise<void>',
      layer: 'frontend', stack: 'TypeScript', module: '新建模块', summary: '一句话定位：说明这个方法做什么。',
      what: { params: [{ name: 'arg', type: 'string', desc: '参数说明' }], returns: 'Promise<void>', sideEffects: ['写一条审计日志'], callers: ['SomeComponent'] },
      why: { scenarios: ['适用场景'], problemsSolved: ['解决的问题'], preconditions: ['前提条件'], layerReason: '为什么放在这一层。', counterExample: { title: '不用它会怎样', desc: '反例描述', code: '// 反例代码' } },
      alternatives: [{ name: '替代方案', layer: 'frontend', pros: ['优点'], cons: ['缺点'], whenToUse: '何时选', migrationCost: '低', affectedLayers: ['frontend'], codeSnippet: '// 代码' }],
      comparisonConclusion: '当场景 A 时选当前方案；若出现条件 B，则改用替代方案；在条件 C 下不得替换。',
      fallback: [
        { layer: 'frontend', failureMode: '前端故障模式', strategy: '前端策略', codeSnippet: '// 前端代码', monitoring: '前端监控项' },
        { layer: 'backend', failureMode: '后端故障模式', strategy: '后端策略', codeSnippet: '// 后端代码', monitoring: '后端监控项' },
        { layer: 'data', failureMode: '数据故障模式', strategy: '数据策略', codeSnippet: '-- 数据代码', monitoring: '数据监控项' }
      ],
      pitfalls: ['踩坑记录'], tags: ['新建'], repoPath: 'apps/web/src/newMethod.ts',
      links: { upstream: [], downstream: [], related: [] }, examples: [{ scene: '最小示例', code: 'await newMethod("x");', explain: '解释' }],
      updatedAt: KB.today(), repoUpdatedAt: KB.today(), lastCodeChangeAt: KB.today()
    };
  }
  function openEditor(m) {
    if (!KB.canEdit()) { KB.toast('只读用户不可编辑', 'err'); return; }
    const obj = m ? JSON.parse(JSON.stringify(m)) : templateEntry();
    delete obj.source;
    KB.modal({
      title: m ? '编辑条目 · ' + m.name : '新建条目',
      wide: true,
      html: `<div class="callout mb12">按 <code>schema/method-entry.schema.json</code> 填写；保存前会执行验收校验（结论含条件、兜底按层且三要素齐全）。</div>
        <div class="field"><label>完整条目 JSON</label><textarea id="entryJson" class="code-editor" spellcheck="false">${E(JSON.stringify(obj, null, 2))}</textarea></div>`,
      foot: `<button class="btn btn-sm" data-action="closeModal">取消</button><button class="btn btn-primary btn-sm" data-action="saveEntry">校验并保存</button>`
    });
  }

  document.addEventListener('click', click);
  document.addEventListener('change', function (e) {
    const el = e.target;
    if (KB.views2 && KB.views2.change(el, rerender)) return;
    const a = el.dataset ? el.dataset.action : '';
    if (a === 'role') { KB.setRole(el.value); return; }
    if (el.id === 'roleSelect') { KB.setRole(el.value); return; }
    if (a === 'chainSelect') {
      KB.state.chainSelect = el.value; KB.state.chainView = { scale: 1, tx: 0, ty: 0 };
      KB.navigate('#/chain/' + el.value, { push: false });
      return;
    }
    if (a === 'trFlow') { setTrouble(el.dataset.id, el.value); rerender(); return; }
    if (a === 'incidentSelect') { KB.state.incidentSelect = el.value; rerender(); return; }
    if (a === 'cardMethod') { if (el.value) KB.navigate('#/cards/' + el.value); return; }
    if (el.id === 'importFiles' && el.files && el.files.length) {
      if (!KB.canEdit()) { KB.toast('只读用户不可导入', 'err'); return; }
      let left = el.files.length;
      Array.from(el.files).forEach((f) => {
        const rd = new FileReader();
        rd.onload = () => { addImport(String(rd.result), f.name); if (--left === 0) KB.render(); };
        rd.readAsText(f, 'utf-8');
      });
    }
  });
  document.addEventListener('input', function (e) {
    if (e.target.id === 'globalSearch') {
      KB.state.search.q = e.target.value;
      if (KB.state.route.name !== 'home') KB.navigate('#/home', { push: false });
      else rerender();
    }
  });
  document.addEventListener('keydown', function (e) {
    const tag = (e.target.tagName || '').toLowerCase();
    if (e.key === 'Escape') { KB.closeModal(); return; }
    if (e.key === '/' && tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
      e.preventDefault(); document.getElementById('globalSearch').focus(); return;
    }
    if (e.key === 'Enter' && e.target.id === 'sceneInput') {
      e.preventDefault();
      KB.state.sceneQuery = e.target.value.trim();
      KB.state.sceneResult = KB.sceneSearch(KB.state.sceneQuery);
      rerender();
      if (KB.sceneSearchAsync) KB.sceneSearchAsync(KB.state.sceneQuery).then((rs) => { KB.state.sceneResult = rs; rerender(); });
    }
  });

  // 链路缩放 / 拖拽
  document.addEventListener('wheel', function (e) {
    const vp = e.target.closest && e.target.closest('.chain-viewport');
    if (!vp) return;
    e.preventDefault();
    KB.state.chainView.scale = clamp(Math.round((KB.state.chainView.scale + (e.deltaY > 0 ? -0.08 : 0.08)) * 100) / 100, 0.5, 2.2);
    applyChainTransform();
  }, { passive: false });
  let drag = null;
  document.addEventListener('mousedown', function (e) {
    const vp = e.target.closest && e.target.closest('.chain-viewport');
    if (!vp || (e.target.closest && e.target.closest('.chain-node'))) return;
    drag = { x: e.clientX, y: e.clientY, tx: KB.state.chainView.tx, ty: KB.state.chainView.ty, vp };
    vp.classList.add('dragging');
  });
  document.addEventListener('mousemove', function (e) {
    if (!drag) return;
    KB.state.chainView.tx = drag.tx + e.clientX - drag.x;
    KB.state.chainView.ty = drag.ty + e.clientY - drag.y;
    applyChainTransform();
  });
  document.addEventListener('mouseup', function () {
    if (drag) drag.vp.classList.remove('dragging');
    drag = null;
  });

  // ============================ 启动 ============================
  (async function boot() {
    await KB.loadRepo();
    KB.applyPrefs();
    if (!location.hash) location.hash = '#/home';
    KB.render();
  })();
})();
