/* StackMap 3.0 · views3.js — 三期页面与交互
 * #/projects 项目空间（F18 多项目复用 + F19 CI 说明 + 备份提醒）
 * #/compare  跨项目四问对比（F18）
 * #/reviews  团队评论与评审工作台（F20）
 * 由 app.js 委托：KB.views3.view(name, r) / action(a,d,el,rerender) / change(el,rerender)
 */
(function () {
  'use strict';
  const KB = window.KB = window.KB || {};
  const E = KB.esc, I = KB.icon;
  const L = KB.LAYER_META;
  KB.state.compareOnlyDiff = false;

  const head = (eyebrow, title, desc, right) =>
    `<div class="page-head spread"><div><div class="eyebrow">${E(eyebrow)}</div><h1>${E(title)}</h1><p>${E(desc)}</p></div>${right ? `<div class="row-wrap">${right}</div>` : ''}</div>`;
  const badge = (text, cls) => `<span class="badge ${cls || 'badge-soft'}">${E(text)}</span>`;
  const empty = (icon, title, desc) => `<div class="empty">${I(icon)}<h3>${E(title)}</h3><p>${E(desc)}</p></div>`;
  const val = (id) => { const el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; };
  const checked = (id) => { const el = document.getElementById(id); return !!(el && el.checked); };
  const layerLabel = (l) => (L[l] || {}).label || l;

  // ============================ #/projects 项目空间 ============================
  function projectCard(row) {
    const p = row.project, s = row.stats, cur = p.id === KB.state.projectId;
    const cov = KB.projectCoverage(p.id);
    const max = Math.max(1, ...cov.map((c) => c.count));
    return `<div class="proj-card ${cur ? 'active' : ''}" style="--proj-color:${E(p.color || '#4361d8')}">
      <div class="row-wrap mb8"><span class="proj-dot"></span><strong>${E(p.name)}</strong>
        ${cur ? badge('当前项目', 'badge-green') : ''}<span class="grow"></span><span class="tiny dim">${E(p.owner || '—')}</span></div>
      <p class="small dim mb12">${E(p.description || '—')}</p>
      <div class="tiny dim mb12 mono">${E(p.stack || '—')}</div>
      <div class="grid grid-4 proj-stats mb12">
        <div><b>${s.methods}</b><span>方法条目</span></div>
        <div><b>${s.chains}</b><span>调用链路</span></div>
        <div><b>${s.incidents}</b><span>事故复盘</span></div>
        <div><b>${s.openReviews}</b><span>待处理评审</span></div>
      </div>
      <div class="cov-list mb12">${cov.map((c) => `<div class="cov-row"><span class="tiny dim">${E(layerLabel(c.layer))}</span>
        <span class="cov-track"><span class="cov-fill" style="width:${Math.round(c.count / max * 100)}%;background:${E((L[c.layer] || {}).color || 'var(--accent)')}"></span></span>
        <span class="tiny mono">${c.count}</span></div>`).join('')}</div>
      <div class="row-wrap mb12">${badge('待同步 ' + s.pending, s.pending ? 'badge-amber' : 'badge-green')}
        ${badge('兜底 ' + s.fallbackRows + ' 行', 'badge-soft')}${badge('标签 ' + s.tags, 'badge-soft')}</div>
      <div class="row-wrap"><span class="tiny dim">共享概念 ${row.shared} · 独有 ${row.unique.length}</span><span class="grow"></span>
        ${cur ? `<button class="btn btn-sm" data-action="go" data-route="#/compare">跨项目对比 →</button>`
              : `<button class="btn btn-sm btn-primary" data-action="projectSwitchTo" data-id="${E(p.id)}">切换到此项目</button>`}
      </div></div>`;
  }
  function viewProjects() {
    const matrix = KB.projectMatrix();
    const shared = KB.sharedConcepts();
    const bk = KB.backupStatus();
    let h = head('三期 F18 · 多项目复用', '项目空间',
      '每个项目独立维护 methods / chains / incidents / troubleshooting 四类内容，共享同一套四问与卡片体系；切换项目后全局搜索、链路、场景反查随之切换数据域。',
      `<button class="btn btn-sm" data-action="go" data-route="#/compare">${I('layers')} 跨项目对比</button>
       <button class="btn btn-sm" data-action="go" data-route="#/reviews">${I('file')} 团队评审</button>`);

    h += `<div class="callout ${bk.due ? 'warn' : 'good'} mb16"><strong>数据备份（防平台锁定）：</strong>${bk.days === null
      ? '尚未导出过备份。' : `上次导出于 ${E(String(bk.last).slice(0, 10))}，距今 ${bk.days} 天。`}建议每 ${bk.interval} 天导出一次全项目 JSON；
      ${bk.due ? '当前已到期，' : ''}导出会覆盖条目、链路、事故与评审记录。
      <span class="grow"></span><button class="btn btn-sm ${bk.due ? 'btn-primary' : ''}" data-action="exportAllBackup">${I('download')} 导出全量备份</button></div>`;

    h += `<div class="grid grid-2 mb16">${matrix.map(projectCard).join('')}</div>`;

    h += `<div class="card mb16"><div class="panel-title">${I('layers')}<h3>项目对比矩阵</h3><span class="tiny dim">同一套验收标准，逐项目核对覆盖度</span></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>维度</th>${matrix.map((r) => `<th>${E(r.project.short || r.project.name)}</th>`).join('')}</tr></thead><tbody>
      ${[
        ['方法条目', (r) => r.stats.methods], ['调用链路', (r) => r.stats.chains], ['事故复盘', (r) => r.stats.incidents],
        ['排查流', (r) => r.stats.flows], ['覆盖层数', (r) => r.stats.layers + ' / 5'], ['兜底策略行数', (r) => r.stats.fallbackRows],
        ['待同步条目', (r) => r.stats.pending], ['待处理评审', (r) => r.stats.openReviews],
        ['跨项目共享概念', (r) => r.shared], ['独有方法数', (r) => r.unique.length]
      ].map(([label, get]) => `<tr><td><strong>${E(label)}</strong></td>${matrix.map((r) => `<td class="mono">${E(String(get(r)))}</td>`).join('')}</tr>`).join('')}
      </tbody></table></div></div>`;

    h += `<div class="card mb16"><div class="panel-title">${I('link')}<h3>可复用的同名概念</h3><span class="tiny dim">点任意一个查看跨项目四问差异</span></div>
      ${shared.length ? `<div class="row-wrap">${shared.map((n) => `<button class="chip-filter" data-action="go" data-route="#/compare?c=${encodeURIComponent(n)}">${E(n)}</button>`).join('')}</div>`
        : '<div class="tiny dim">当前项目间还没有同名方法；在两个项目的 methods.json 里使用相同 name 即可自动出现在这里。</div>'}
      <div class="hr"></div>
      <div class="tiny dim">独有方法（各项目示例）：${matrix.map((r) => `<strong>${E(r.project.short)}</strong> ${r.unique.slice(0, 4).map((n) => E(n)).join('、') || '—'}`).join(' · ')}</div></div>`;

    h += `<div class="card"><div class="panel-title">${I('refresh')}<h3>PR 自动提醒（F19 补齐）</h3>${badge('GitHub Actions', 'badge-accent')}</div>
      <div class="grid grid-2 mb12">
        <div><div class="small mb8">PR 改动源码 → <code>tools/pr-impact.mjs</code> 用 repoPath 映射条目 → 生成受影响链路 / 下游节点 / 关联事故的检查单 → 写入 PR 评论与 job summary；若源码改了但 <code>content/</code> 未同步，额外给出「内容漂移」提醒。</div>
          <div class="tiny dim">工作流：<code>.github/workflows/stackmap.yml</code> · 触发：pull_request + 手动 · 权限：内置 GITHUB_TOKEN · fork PR 只写 summary。</div></div>
        <div><div class="tiny dim mb8">本地等价命令（点右侧可复制）</div>
          ${KB.ciCommands().map((c) => `<div class="val-row"><span class="grow mono tiny">${E(c.cmd)}</span><span class="tiny dim">${E(c.label)}</span>
            <button class="btn btn-sm" data-action="copy" data-text="${E(c.cmd)}">${I('copy')}</button></div>`).join('')}
        </div></div>
      <div class="callout good"><strong>与 App 的关系：</strong>CI 负责「改动即提醒」；App 的变更影响分析页（F19）负责人工选方法后生成复核清单，两者输出结构一致，可互相印证。
        <button class="btn btn-sm" data-action="go" data-route="#/impact">打开变更影响分析</button></div></div>`;
    return h;
  }

  // ============================ #/compare 跨项目对比 ============================
  function viewCompare(r) {
    const concepts = KB.concepts();
    const q = r.qs.get('c') || KB.state.compareConcept || (concepts[0] || {}).name || '';
    KB.state.compareConcept = q;
    let h = head('三期 F18 · 跨项目对比', '同名方法 · 四问差异',
      '同一能力在不同项目里为什么选型不同、兜底覆盖是否一致、结论条件是否仍成立 —— 逐字段并排比对，差异高亮。',
      `<button class="btn btn-sm" data-action="go" data-route="#/projects">${I('home')} 项目空间</button>`);
    h += `<div class="card card-pad-sm mb16"><div class="row-wrap">
      <span class="small nowrap">选择同名概念</span>
      <select id="compareConcept" class="plain-input" data-action="compareConcept">
        ${concepts.map((c) => `<option value="${E(c.name)}" ${c.name === q ? 'selected' : ''}>${E(c.name)} · ${c.projects.length} 个项目</option>`).join('')}
      </select>
      <label class="check-inline tiny"><input type="checkbox" id="compareDiffOnly" data-action="compareDiffOnly" ${KB.state.compareOnlyDiff ? 'checked' : ''}> 只看差异</label>
      <span class="grow"></span>
      ${q ? `<button class="btn btn-sm" data-action="exportCompare" data-concept="${E(q)}">${I('download')} 导出对比 Markdown</button>` : ''}
      </div></div>`;
    if (!concepts.length) return h + empty('layers', '还没有可对比的同名方法', '在两个项目的 methods.json 里使用相同 name，重新构建后即可出现。');
    const x = KB.compareOf(q);
    if (!x) return h + empty('alert', '该概念在当前数据集下无法对比', '需要至少两个项目各有一条同名方法。');

    h += `<div class="grid grid-4 mb16">
      <div class="stat accent"><div class="num">${x.cols.length}</div><div class="lbl">参与对比项目</div></div>
      <div class="stat"><div class="num">${x.total}</div><div class="lbl">对比字段</div></div>
      <div class="stat amber"><div class="num">${x.diffCount}</div><div class="lbl">存在差异字段</div></div>
      <div class="stat green"><div class="num">${Math.round((1 - x.diffCount / x.total) * 100)}%</div><div class="lbl">一致率</div></div>
    </div>`;
    h += `<div class="grid grid-${Math.min(4, Math.max(2, x.cols.length))} mb16">${x.cols.map((c) => `<div class="card card-pad-sm">
      <div class="row-wrap mb8"><span class="proj-dot" style="background:${E(c.project.color || 'var(--accent)')}"></span><strong>${E(c.project.short || c.project.name)}</strong>
        <span class="grow"></span>${KB.layerChip(c.m.layer)}</div>
      <div class="mono tiny dim mb8">${E(c.m.id)}</div>
      <div class="small mb8">${E(c.m.summary || '—')}</div>
      <div class="row-wrap">${KB.statusBadge(c.m)}<span class="grow"></span>
        <button class="btn btn-sm" data-action="go" data-route="#/entry/${E(c.m.id)}">四问详情</button>
        <button class="btn btn-sm" data-action="go" data-route="#/cards/${E(c.m.id)}">卡片</button></div></div>`).join('')}</div>`;

    const rows = KB.state.compareOnlyDiff ? x.rows.filter((row) => row.diff) : x.rows;
    h += `<div class="card"><div class="panel-title">${I('layers')}<h3>逐字段对比</h3><span class="tiny dim">高亮行表示项目间取值不同</span></div>
      <div class="tbl-wrap"><table class="tbl compare-tbl"><thead><tr><th class="cmp-field">字段</th>${x.cols.map((c) => `<th>${E(c.project.short || c.project.name)}<div class="tiny dim">${E(c.m.id)}</div></th>`).join('')}<th>差异</th></tr></thead><tbody>
      ${rows.map((row) => `<tr class="${row.diff ? 'diff-row' : ''}"><td class="cmp-field"><strong>${E(row.label)}</strong></td>
        ${row.values.map((v) => `<td>${E(String(v))}</td>`).join('')}<td>${row.diff ? badge('不同', 'badge-amber') : '<span class="tiny dim">一致</span>'}</td></tr>`).join('')}
      </tbody></table></div></div>`;
    h += `<div class="callout warn mt16"><strong>复核提示：</strong>差异本身不是问题，需判断是「业务约束不同」（如支付必须过内网网关）还是「文档未同步」。
      若某项目缺少条件化结论或分层兜底三要素，按验收标准补齐后回写该项目的 methods.json 并运行 <code>npm run build</code>。</div>`;
    return h;
  }

  // ============================ #/reviews 团队评审 ============================
  function reviewRow(t, active) {
    const m = KB.byId(t.methodId);
    return `<button class="review-row ${active ? 'active' : ''}" data-action="reviewOpen" data-id="${E(t.id)}">
      <div class="row-wrap mb4"><strong class="small">${E(t.title)}</strong><span class="grow"></span>${KB.reviewStatusBadge(t.status)}</div>
      <div class="tiny dim">${E(m ? m.name : t.methodId)} · ${E(t.author || '匿名')} · ${E(t.updatedAt)} · ${(t.comments || []).length} 条讨论</div>
      ${t.source === 'local' ? '<div class="tiny dim">本地录入 · 待回写仓库</div>' : ''}</button>`;
  }
  function reviewDetail(t) {
    const m = KB.byId(t.methodId);
    const p = KB.projects().find((x) => x.id === t.projectId);
    const done = (t.checklist || []).filter((c) => c.done).length;
    return `<div class="card"><div class="spread mb8"><div><div class="eyebrow tiny">${E((p || {}).short || t.projectId)} · ${t.kind === 'review' ? '条目评审' : '讨论'}</div>
        <h2>${E(t.title)}</h2></div>${KB.reviewStatusBadge(t.status)}</div>
      <div class="row-wrap mb12">${badge('发起人 ' + (t.author || '匿名'), 'badge-soft')}${badge('创建 ' + t.createdAt, 'badge-soft')}${badge('更新 ' + t.updatedAt, 'badge-soft')}
        ${t.source === 'local' ? badge('本地 · 待回写', 'badge-amber') : ''}<span class="grow"></span>
        ${KB.canEdit() ? `<button class="btn btn-sm btn-danger" data-action="reviewDelete" data-id="${E(t.id)}">${I('trash')} 删除</button>` : ''}</div>
      <div class="callout mb12">关联方法：${m ? `<span class="link" data-action="go" data-route="#/entry/${E(m.id)}">${E(m.name)}</span> ${KB.layerChip(m.layer)}` : E(t.methodId)}
        · ${m ? `<button class="btn btn-sm" data-action="exportPrChecklist" data-id="${E(m.id)}">导出 PR 复核清单</button>` : ''}</div>
      <div class="grid grid-2 mb16">
        <div><div class="panel-title">${I('check')}<h3>评审检查单</h3><span class="tiny dim">${done} / ${(t.checklist || []).length} 已完成</span></div>
          ${(t.checklist || []).map((c, i) => `<label class="check-row ${c.done ? 'done' : ''}"><input type="checkbox" data-action="reviewCheck" data-id="${E(t.id)}" data-idx="${i}" ${c.done ? 'checked' : ''} ${KB.canEdit() ? '' : 'disabled'}>
            <span class="small">${E(c.item)}</span></label>`).join('') || '<div class="tiny dim">无检查项</div>'}</div>
        <div><div class="panel-title">${I('file')}<h3>状态流转</h3></div>
          <div class="row-wrap mb12">${['open', 'in_review', 'approved', 'changes_requested'].map((s) =>
            `<button class="chip-filter ${t.status === s ? 'active' : ''}" data-action="reviewStatus" data-id="${E(t.id)}" data-status="${s}" ${KB.canEdit() ? '' : 'disabled'}>${E(KB.reviewStatusMeta[s].label)}</button>`).join('')}</div>
          <div class="tiny dim">「通过 / 要求修改」也可以在下方发表意见时直接表决，表决会同步更新状态。</div>
          ${(t.relatedIncidentIds || []).length ? `<div class="hr"></div><div class="tiny dim">关联事故：${t.relatedIncidentIds.map((id) => `<span class="link" data-action="go" data-route="#/incident/${E(id)}">${E(id)}</span>`).join('、')}</div>` : ''}
        </div></div>
      <div class="panel-title">${I('cards')}<h3>讨论时间线</h3><span class="tiny dim">${(t.comments || []).length} 条</span></div>
      <div class="timeline mb16">${(t.comments || []).length ? t.comments.map((c) => `<div class="tl-item">
        <div class="row-wrap"><strong class="small">${E(c.author || '匿名')}</strong>${c.verdict === 'approve' ? badge('通过', 'badge-green') : c.verdict === 'request_changes' ? badge('要求修改', 'badge-red') : badge('评论', 'badge-soft')}
          <span class="grow"></span><span class="tiny dim">${E(c.at)}</span></div>
        <div class="small mt4">${E(c.body)}</div></div>`).join('') : '<div class="tiny dim">还没有讨论，发表第一条意见。</div>'}</div>
      ${KB.canEdit() ? `<div class="review-form"><div class="row-wrap mb8">
          <input id="reviewAuthor" class="plain-input" placeholder="你的名字" value="${E(KB.state.draftReviewer || '')}">
          <span class="grow"></span><span class="tiny dim">只读用户可查看但不可发表</span></div>
        <textarea id="reviewBody" class="plain-input" rows="3" placeholder="写下评审意见：指出条件化结论、兜底缺层、链路同步等具体问题…"></textarea>
        <div class="row-wrap mt8"><span class="grow"></span>
          <button class="btn btn-sm" data-action="reviewVerdict" data-id="${E(t.id)}" data-verdict="comment">发表评论</button>
          <button class="btn btn-sm btn-primary" data-action="reviewVerdict" data-id="${E(t.id)}" data-verdict="approve">✓ 通过</button>
          <button class="btn btn-sm btn-danger" data-action="reviewVerdict" data-id="${E(t.id)}" data-verdict="request_changes">✕ 要求修改</button></div></div>`
        : '<div class="callout warn">只读用户：可浏览评审记录，切换到编辑者或管理员后参与评审。</div>'}
      </div>`;
  }
  function viewReviews(r) {
    const counts = KB.reviewCounts();
    const filter = KB.state.reviewFilter || 'all';
    const all = KB.reviews().filter((t) => filter === 'all' || t.status === filter);
    const selId = r.qs.get('id') || KB.state.reviewSelect || (all[0] || {}).id;
    const t = selId ? KB.reviewById(selId) : null;
    const methodQ = r.qs.get('method');
    let h = head('三期 F20 · 团队评审', '评审工作台',
      '围绕条目发起评审或讨论、逐项勾检查单、表决通过 / 要求修改；记录导出后由编辑者回写 content/reviews.json，与仓库同源。',
      `${KB.canEdit() ? `<button class="btn btn-sm btn-primary" data-action="reviewNew">${I('plus')} 发起评审</button>` : ''}
       <button class="btn btn-sm" data-action="exportReviews">${I('download')} 导出评审记录</button>`);
    h += `<div class="grid grid-4 mb16">
      <div class="stat accent"><div class="num">${counts.all}</div><div class="lbl">评审 / 讨论总数</div></div>
      <div class="stat amber"><div class="num">${counts.pending}</div><div class="lbl">待处理</div></div>
      <div class="stat green"><div class="num">${counts.approved}</div><div class="lbl">已通过</div></div>
      <div class="stat red"><div class="num">${counts.changes_requested}</div><div class="lbl">需修改</div></div></div>`;
    if (methodQ) {
      const mm = KB.byId(methodQ);
      h += `<div class="callout ide-banner mb16">正在查看方法 <strong>${E(mm ? mm.name : methodQ)}</strong> 的评审记录
        <button class="btn btn-sm" data-action="reviewFilter" data-filter="all">显示全部评审</button></div>`;
    }
    h += `<div class="row-wrap mb16">${[['all', '全部 ' + counts.all], ['open', '待讨论 ' + counts.open], ['in_review', '评审中 ' + counts.in_review], ['approved', '已通过 ' + counts.approved], ['changes_requested', '需修改 ' + counts.changes_requested]]
      .map(([k, label]) => `<button class="chip-filter ${filter === k ? 'active' : ''}" data-action="reviewFilter" data-filter="${k}">${E(label)}</button>`).join('')}</div>`;
    const list = methodQ ? all.filter((x) => x.methodId === methodQ) : all;
    h += `<div class="grid review-grid"><div class="card review-list">${list.length ? list.map((x) => reviewRow(x, t && x.id === t.id)).join('') : '<div class="tiny dim p12">该筛选下暂无记录。</div>'}</div>
      <div>${t ? reviewDetail(t) : empty('file', '选择一条评审', '左侧点任意记录查看详情与讨论。')}</div></div>`;
    h += `<div class="callout mt16"><strong>同步约定：</strong>新建、评论、表决、检查单都写入浏览器 localStorage 覆盖层并标记待回写；点击「导出评审记录」得到完整 Markdown / JSON，由编辑者整理进仓库后所有人可见。App 不会自动改写 content/reviews.json。</div>`;
    return h;
  }

  function openReviewForm() {
    if (!KB.canEdit()) { KB.toast('只读用户不可发起评审', 'err'); return; }
    const ms = KB.methods();
    const methodQ = (KB.state.route.qs.get('method') || '');
    KB.modal({
      title: '发起条目评审 / 讨论', wide: true,
      html: `<div class="callout mb12">评审对象默认属于当前项目 <strong>${E(KB.state.project)}</strong>；保存前会校验关联方法与字段结构。</div>
        <div class="grid grid-2">
          <div class="field"><label>关联方法 *</label><select id="rvMethod" class="plain-input">${ms.map((m) => `<option value="${E(m.id)}" ${m.id === methodQ ? 'selected' : ''}>${E(m.name)} · ${E(layerLabel(m.layer))}</option>`).join('')}</select></div>
          <div class="field"><label>类型</label><select id="rvKind" class="plain-input"><option value="review">条目评审</option><option value="discussion">讨论</option></select></div>
          <div class="field"><label>标题 *</label><input id="rvTitle" class="plain-input" placeholder="例如：兜底缺少数据层，结论条件不完整"></div>
          <div class="field"><label>发起人</label><input id="rvAuthor" class="plain-input" placeholder="姓名"></div>
        </div>
        <div class="field"><label>初始状态</label><select id="rvStatus" class="plain-input"><option value="open">待讨论</option><option value="in_review">评审中</option></select></div>`,
      foot: `<button class="btn btn-sm" data-action="closeModal">取消</button><button class="btn btn-sm btn-primary" data-action="reviewCreate">创建评审</button>`
    });
  }

  // ============================ 对外接口 ============================
  const V3 = KB.views3 = {
    view(name, r) {
      if (name === 'projects') return viewProjects();
      if (name === 'compare') return viewCompare(r);
      if (name === 'reviews') return viewReviews(r);
      return '';
    },
    action(a, d, el, rerender) {
      switch (a) {
        case 'projectSwitchTo': {
          const r = KB.setProject(d.id);
          KB.toast(r.message, r.ok ? 'ok' : 'err');
          return true;
        }
        case 'exportAllBackup': {
          if (!KB.canEdit()) { KB.toast('只读用户不可导出备份', 'err'); return true; }
          const backup = {
            schemaVersion: '3.0', exportedAt: new Date().toISOString(),
            projects: KB.projects(), defaultProjectId: KB.state.defaultProjectId,
            entries: KB.allMethods(), chains: KB.chains('*'), incidents: KB.incidents('*'),
            troubleshooting: { flows: KB.flows('*'), sceneSynonyms: KB.synonyms(), sceneExamples: KB.sceneExamples() },
            reviews: KB.reviews('*'), linksSkeleton: (KB.state.repo.linksSkeleton || null)
          };
          KB.download('StackMap-全量备份-' + KB.today() + '.json', JSON.stringify(backup, null, 2), 'application/json');
          KB.markBackup(); KB.render();
          return true;
        }
        case 'exportCompare': {
          const md = KB.compareMarkdown(d.concept || KB.state.compareConcept);
          if (!md) { KB.toast('没有可导出的对比内容', 'err'); return true; }
          KB.download('跨项目对比-' + (d.concept || KB.state.compareConcept) + '.md', md, 'text/markdown');
          return true;
        }
        case 'exportReviews': KB.download('团队评审记录.md', KB.reviewsMarkdown(), 'text/markdown'); return true;
        case 'exportPrChecklist': {
          KB.download('PR-复核检查单.md', KB.prChecklistMarkdown(d.id), 'text/markdown');
          return true;
        }
        case 'reviewFilter': KB.state.reviewFilter = d.filter; KB.state.reviewSelect = ''; KB.render(); return true;
        case 'reviewOpen': KB.navigate('#/reviews?id=' + encodeURIComponent(d.id)); return true;
        case 'reviewNew': openReviewForm(); return true;
        case 'reviewCreate': {
          if (!KB.canEdit()) { KB.toast('只读用户不可发起评审', 'err'); return true; }
          const t = KB.reviewTemplate(val('rvMethod'));
          t.title = val('rvTitle'); t.kind = val('rvKind') || 'review';
          t.author = val('rvAuthor'); t.status = val('rvStatus') || 'open';
          const r = KB.saveReview(t);
          KB.toast(r.message, r.ok ? 'ok' : 'err');
          if (r.ok) { KB.state.reviewSelect = t.id; KB.closeModal(); KB.navigate('#/reviews?id=' + encodeURIComponent(t.id)); }
          return true;
        }
        case 'reviewVerdict': {
          if (!KB.canEdit()) { KB.toast('只读用户不可发表意见', 'err'); return true; }
          const author = val('reviewAuthor');
          KB.state.draftReviewer = author;
          const r = KB.addReviewComment(d.id, author, val('reviewBody'), d.verdict);
          KB.toast(r.message, r.ok ? 'ok' : 'err');
          if (r.ok) KB.render();
          return true;
        }
        case 'reviewCheck': {
          if (!KB.canEdit()) { KB.toast('只读用户不可修改检查单', 'err'); return true; }
          KB.toggleReviewCheck(d.id, parseInt(d.idx, 10)); KB.render(); return true;
        }
        case 'reviewStatus': {
          if (!KB.canEdit()) { KB.toast('只读用户不可变更状态', 'err'); return true; }
          const r = KB.setReviewStatus(d.id, d.status);
          KB.toast(r.message, r.ok ? 'ok' : 'err');
          if (r.ok) KB.render();
          return true;
        }
        case 'reviewDelete': {
          if (!KB.canEdit()) { KB.toast('只读用户不可删除', 'err'); return true; }
          if (!confirm('删除这条评审记录？')) return true;
          KB.deleteReview(d.id); KB.state.reviewSelect = '';
          KB.navigate('#/reviews'); KB.toast('评审已删除（本地）');
          return true;
        }
      }
      return false;
    },
    change(el, rerender) {
      const a = el.dataset ? el.dataset.action : '';
      if (a === 'compareConcept') {
        KB.state.compareConcept = el.value;
        KB.navigate('#/compare?c=' + encodeURIComponent(el.value), { push: false });
        return true;
      }
      if (a === 'compareDiffOnly') { KB.state.compareOnlyDiff = !!el.checked; rerender(); return true; }
      return false;
    }
  };
})();
