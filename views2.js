/* StackMap 2.0 · views2.js — 二期页面与交互
 * 事故复盘 / AI 草稿审核 / 学习进度 / 变更影响分析
 * 由 app.js 的路由与事件总线委托调用：KB.views2.view(name, r) / action(a,d,el,rerender) / change(el,rerender)
 */
(function () {
  'use strict';
  const KB = window.KB = window.KB || {};
  const E = KB.esc, I = KB.icon;
  const L = KB.LAYER_META;

  const head = (eyebrow, title, desc, right) =>
    `<div class="page-head spread"><div><div class="eyebrow">${E(eyebrow)}</div><h1>${E(title)}</h1><p>${E(desc)}</p></div>${right ? `<div class="row-wrap">${right}</div>` : ''}</div>`;
  const val = (id) => { const el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; };
  const checked = (id) => { const el = document.getElementById(id); return !!(el && el.checked); };
  const badge = (text, cls) => `<span class="badge ${cls || 'badge-soft'}">${E(text)}</span>`;
  const empty = (icon, title, desc) => `<div class="empty">${I(icon)}<h3>${E(title)}</h3><p>${E(desc)}</p></div>`;
  const sourceBadge = (s) => badge(s === 'llm' ? 'LLM 起草' : '本地启发式', s === 'llm' ? 'badge-accent' : 'badge-soft');
  const statusBadge = (s) => badge({ draft: '待审核', reviewed: '已核实', approved: '已入库' }[s] || s,
    s === 'approved' ? 'badge-green' : s === 'reviewed' ? 'badge-amber' : 'badge-red');

  // ============================ F12 事故复盘 ============================
  function incidentCard(i) {
    const ms = (i.relatedMethodIds || []).map((id) => KB.byId(id)).filter(Boolean);
    return `<div class="card mb16"><div class="spread mb8"><div class="row-wrap">
        ${badge('事故', 'badge-red')}${i.source === 'local' ? badge('本地录入 · 待回写', 'badge-amber') : ''}
        <strong>${E(i.title)}</strong></div><span class="tiny dim">${E(i.occurredAt)}</span></div>
      <div class="grid grid-2 mb12">
        <div class="triad-col"><h4>现象</h4><div class="small">${E(i.symptom)}</div></div>
        <div class="triad-col"><h4>根因</h4><div class="small">${E(i.rootCause)}</div></div>
      </div>
      <h4 class="mb8">缺失兜底 · 逐层打叉</h4>
      <div class="row-wrap mb12">${(i.missingFallbacks || []).length ? (i.missingFallbacks || []).map((f) =>
        `<span class="missing-chip" title="${E(f.expected || '')}"><span class="cross">✕</span>${KB.layerChip(f.layer)} <span class="tiny">${E(f.item || f.note || f.strategy || '—')}</span></span>`).join('') : '<span class="tiny dim">—</span>'}</div>
      <div class="callout good mb12"><strong>改进：</strong>${E(i.improvement)}</div>
      <div class="row-wrap"><span class="tiny dim">关联方法：</span>${ms.length ? ms.map((m) => `<span class="link" data-action="go" data-route="#/entry/${E(m.id)}">${E(m.name)}</span>`).join('、') : '<span class="tiny dim">—</span>'}
        <span class="grow"></span>
        ${ms[0] ? `<button class="btn btn-sm btn-primary" data-action="go" data-route="#/cards/${E(ms[0].id)}?i=7">踩坑复盘卡 →</button>` : ''}
        <button class="btn btn-sm" data-action="go" data-route="#/incident/${E(i.id)}">详情</button>
        ${KB.canEdit() ? `<button class="btn btn-sm btn-danger" data-action="incidentDelete" data-id="${E(i.id)}">删除</button>` : ''}
      </div></div>`;
  }
  function viewIncidents(r) {
    const all = KB.incidents();
    if (r.name === 'incident' && r.p1) {
      const i = all.find((x) => x.id === r.p1);
      if (!i) return empty('alert', '找不到该事故', '可能已被移除或本地录入未保存。');
      const ms = (i.relatedMethodIds || []).map((id) => KB.byId(id)).filter(Boolean);
      let h = head('事故复盘 · 详情', i.title, '事故 → 根因 → 缺失兜底（逐层打叉）→ 改进 → 跳对应方法',
        KB.link('#/incidents', '← 全部事故', 'btn btn-sm'));
      h += incidentCard(i);
      h += `<div class="card"><div class="panel-title">${I('link')}<h3>关联方法条目（${ms.length}）</h3></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>方法</th><th>层</th><th>模块</th><th>同步状态</th><th></th></tr></thead><tbody>
        ${ms.map((m) => `<tr><td><strong>${E(m.name)}</strong></td><td>${KB.layerChip(m.layer)}</td><td>${E(m.module)}</td>
          <td>${KB.statusBadge(m)}</td><td><button class="btn btn-sm" data-action="go" data-route="#/entry/${E(m.id)}?tab=fallback">看兜底</button></td></tr>`).join('')}
        </tbody></table></div></div>`;
      return h;
    }
    const local = all.filter((i) => i.source === 'local').length;
    const methods = new Set(all.reduce((a, i) => a.concat(i.relatedMethodIds || []), []));
    const layers = new Set(all.reduce((a, i) => a.concat((i.missingFallbacks || []).map((f) => f.layer)), []));
    let h = head('事故复盘', '从事故反推缺失的兜底',
      '每起事故都落到具体层与具体方法；可录入新事故，导出后回写 content/incidents.json。',
      `${KB.canEdit() ? `<button class="btn btn-primary btn-sm" data-action="incidentNew">${I('plus')} 录入事故</button>` : ''}
       <button class="btn btn-sm" data-action="incidentExport">${I('download')} 导出 Markdown</button>`);
    h += `<div class="grid grid-4 mb16">
      <div class="stat accent"><div class="num">${all.length}</div><div class="lbl">事故复盘</div></div>
      <div class="stat amber"><div class="num">${local}</div><div class="lbl">本地录入 · 待回写</div></div>
      <div class="stat"><div class="num">${methods.size}</div><div class="lbl">涉及方法</div></div>
      <div class="stat red"><div class="num">${layers.size}</div><div class="lbl">缺失兜底层</div></div>
    </div>`;
    h += all.length ? all.map(incidentCard).join('') : empty('alert', '还没有事故复盘', '点击「录入事故」，把值班中遇到的现象与根因沉淀下来。');
    return h;
  }
  function incidentForm() {
    const t = KB.incidentTemplate();
    const methods = KB.methods();
    const html = `<div class="callout mb12">事故会与「踩坑复盘卡」「故障排查流」共用同一份数据；录入后先落在本地覆盖层，导出 Markdown / JSON 回写仓库后状态恢复。</div>
      <div class="grid grid-2">
        <div class="field"><label>事故标题 *</label><input id="incTitle" class="plain-input" placeholder="例：上传回调重复触发导致附件重复入库"></div>
        <div class="field"><label>发生日期 *</label><input id="incDate" class="plain-input" type="date" value="${E(t.occurredAt)}"></div>
      </div>
      <div class="field"><label>现象 *</label><textarea id="incSymptom" placeholder="on-call 看到什么：告警、用户反馈、指标异常"></textarea></div>
      <div class="field"><label>根因 *</label><textarea id="incRootCause" placeholder="追到哪一层的哪个假设失效"></textarea></div>
      <div class="field"><label>改进 *</label><textarea id="incImprovement" placeholder="补了哪层兜底 / 加了什么监控"></textarea></div>
      <div class="field"><label>缺失兜底（按层填写，留空表示不缺失）</label>
        ${KB.LAYERS.map((l) => `<div class="row-wrap mb8"><span class="nowrap" style="min-width:92px">${KB.layerChip(l)}</span>
          <input class="plain-input grow" id="incFb_${l}" placeholder="${E(L[l].label)}层缺了什么"></div>`).join('')}
      </div>
      <div class="field"><label>关联方法条目 *（可多选）</label>
        <div class="check-grid">${methods.map((m) => `<label class="check-item"><input type="checkbox" name="incMethod" value="${E(m.id)}">
          <span>${E(m.name)}</span>${KB.layerChip(m.layer)}</label>`).join('')}</div></div>`;
    KB.modal({
      title: '录入事故复盘', wide: true, html,
      foot: `<button class="btn btn-sm" data-action="closeModal">取消</button>
             <button class="btn btn-primary btn-sm" data-action="incidentSave">校验并保存</button>`
    });
  }

  // ============================ F13 AI 起草四问 ============================
  function viewDrafts(r) {
    const ds = KB.drafts();
    let h = head('AI 起草 · 人工审核', '四问草稿必须先审核，才能入库',
      'AI 只生成草稿，所有字段标注「待人工核实」；编辑者勾选「已人工核实」后可批准入库，写入本地覆盖层并标记待同步。',
      `<button class="btn btn-sm" data-action="serviceConfig">${I('tool')} 配置 AI / 向量服务</button>`);
    h += `<div class="callout ${KB.state.draftNotice ? 'warn' : ''} mb16"><strong>人工审核门禁：</strong>
      ${E(KB.state.draftNotice || '本地启发式起草默认启用；配置 OpenAI 兼容 LLM 后可切换为大模型起草，失败自动回退。')}
      <span class="grow"></span>${badge(KB.state.services.useLlm && KB.state.services.llmEndpoint ? 'LLM 已启用' : '本地启发式', KB.state.services.useLlm && KB.state.services.llmEndpoint ? 'badge-accent' : 'badge-soft')}</div>`;
    h += `<div class="card mb16"><div class="panel-title">${I('plus')}<h3>生成一份四问草稿</h3><span class="grow"></span>
      <span class="tiny dim">输入越具体，草稿越接近可审核状态</span></div>
      <div class="grid grid-3">
        <div class="field"><label>方法名 *</label><input id="draftName" class="plain-input" placeholder="例：resumeUpload"></div>
        <div class="field"><label>签名</label><input id="draftSig" class="plain-input" placeholder="resumeUpload(fileId: string): Promise&lt;void&gt;"></div>
        <div class="field"><label>所属层</label><select id="draftLayer" class="plain-input">${KB.LAYERS.map((l) => `<option value="${l}">${E(L[l].label)}</option>`).join('')}</select></div>
        <div class="field"><label>模块</label><input id="draftModule" class="plain-input" placeholder="文件上传"></div>
        <div class="field"><label>源码路径</label><input id="draftPath" class="plain-input" placeholder="apps/web/src/upload/resumeUpload.ts"></div>
        <div class="field"><label>标签（逗号分隔）</label><input id="draftTags" class="plain-input" placeholder="断点续传, 草稿"></div>
      </div>
      <div class="field"><label>场景描述 *</label><textarea id="draftScene" placeholder="例：弱网下大文件上传中断后，用户希望从上次分片继续而不是重传"></textarea></div>
      <div class="field"><label>一句话定位（可选）</label><input id="draftSummary" class="plain-input" placeholder="留空则由起草器生成待核实占位"></div>
      <div class="row-wrap"><button class="btn btn-primary" data-action="draftGenerate">${I('refresh')} 生成四问草稿</button>
        <span class="tiny dim">草稿不会自动入库 · 生成的条目会先经过验收校验</span></div></div>`;

    h += `<div class="spread mb12"><h2>草稿箱 <span class="dim small">${ds.length}</span></h2>
      <span class="tiny dim">状态：待审核 → 已核实 → 已入库</span></div>`;
    if (!ds.length) return h + empty('file', '草稿箱是空的', '填写上方表单生成第一份四问草稿，或先去内容管理页查看导入流程。');
    ds.forEach((d) => {
      const m = d.entry, v = KB.validateEntry(m);
      h += `<div class="card mb16"><div class="spread mb8"><div class="row-wrap">
        ${statusBadge(d.status)}${sourceBadge(d.source)}<strong>${E(m.name)}</strong>${KB.layerChip(m.layer)}
        <span class="tiny dim">${E(String(d.createdAt).slice(0, 19).replace('T', ' '))}</span></div>
        <span class="tiny dim">${E(d.id)}</span></div>
        <div class="grid grid-4 mb12">
          <div class="mini-kv"><span>定位</span><strong>${E(String(m.summary || '').slice(0, 48))}</strong></div>
          <div class="mini-kv"><span>替代方案</span><strong>${(m.alternatives || []).length} 个</strong></div>
          <div class="mini-kv"><span>分层兜底</span><strong>${new Set((m.fallback || []).map((f) => f.layer)).size} 层 / ${(m.fallback || []).length} 行</strong></div>
          <div class="mini-kv"><span>验收校验</span><strong class="${v.errors.length ? 'txt-red' : 'txt-green'}">${v.errors.length ? v.errors.length + ' 项未通过' : '通过'}</strong></div>
        </div>
        ${d.status === 'approved' ? `<div class="callout good mb12">已由 <strong>${E(d.reviewer || '未署名')}</strong> 于 ${E(d.reviewedAt)} 审核入库，条目在内容管理页显示「待同步」。</div>` : ''}
        ${d.notes ? `<div class="callout mb12"><strong>审核意见：</strong>${E(d.notes)}</div>` : ''}
        <div class="row-wrap">
          <button class="btn btn-sm btn-primary" data-action="draftReview" data-id="${E(d.id)}">${I('edit')} 审核 / 编辑四问</button>
          <button class="btn btn-sm ${d.status === 'reviewed' && KB.canEdit() ? 'btn-primary' : 'disabled'}" data-action="draftApprove" data-id="${E(d.id)}">${I('check')} 批准入库</button>
          <button class="btn btn-sm" data-action="draftExport" data-id="${E(d.id)}">${I('download')} 导出 Markdown</button>
          <span class="grow"></span>
          <button class="btn btn-sm" data-action="go" data-route="#/entry/${E(m.id)}">查看条目</button>
          <button class="btn btn-sm btn-danger" data-action="draftDelete" data-id="${E(d.id)}">删除草稿</button>
        </div>
        ${d.status !== 'reviewed' && d.status !== 'approved' ? '<div class="tiny dim mt8">批准按钮在勾选「已人工核实」并保存审核意见后才会生效。</div>' : ''}
      </div>`;
    });
    return h;
  }
  function draftReviewForm(d) {
    KB.modal({
      title: '人工审核 · ' + d.entry.name, wide: true,
      html: `<div class="callout warn mb12"><strong>AI 生成内容未经核实不得入库。</strong>
        请逐项核对 what / why / alternatives / fallback / 结论，把「待人工核实」占位替换为事实；保存时执行验收校验。</div>
        <div class="field"><label>四问条目 JSON（可编辑）</label><textarea id="draftJson" class="code-editor" spellcheck="false">${E(JSON.stringify(d.entry, null, 2))}</textarea></div>
        <div class="grid grid-2">
          <div class="field"><label>审核人</label><input id="draftReviewer" class="plain-input" value="${E(KB.state.draftReviewer || '')}" placeholder="你的名字 / 工号"></div>
          <div class="field"><label>审核意见</label><input id="draftNotes" class="plain-input" value="${E(d.notes || '')}" placeholder="核实了哪些内容，还有什么待补充"></div>
        </div>
        <label class="check-item"><input type="checkbox" id="draftReviewed" ${d.status === 'reviewed' || d.status === 'approved' ? 'checked' : ''}>
          <span>我已逐项人工核实，确认内容可作为条目草稿（解锁「批准入库」）</span></label>
        <div id="draftCheckResult" class="tiny mt8">—</div>`,
      foot: `<button class="btn btn-sm" data-action="closeModal">取消</button>
             <button class="btn btn-primary btn-sm" data-action="draftSaveReview" data-id="${E(d.id)}">保存审核结果</button>`
    });
  }

  // ============================ F16 学习进度 ============================
  function viewProgress() {
    const st = KB.progressStats(), p = KB.state.progress;
    let h = head('学习进度', '打卡 · 覆盖度 · 周报',
      '弱游戏化：记录浏览、卡片、向导、预案与审核行为，按天去重；周报可直接导出给周会。',
      `<button class="btn btn-primary btn-sm" data-action="checkIn">${I('check')} 今日打卡</button>
       <button class="btn btn-sm" data-action="exportReport">${I('download')} 导出周报</button>
       <button class="btn btn-sm" data-action="copyReport">复制周报</button>`);
    h += `<div class="grid grid-4 mb16">
      <div class="stat accent"><div class="num">${st.streak}</div><div class="lbl">连续活跃天数</div></div>
      <div class="stat"><div class="num">${st.totalEvents}</div><div class="lbl">累计学习事件</div></div>
      <div class="stat green"><div class="num">${st.mastered}<span class="tiny">/${st.total}</span></div><div class="lbl">已掌握方法 · ${st.coverage}%</div></div>
      <div class="stat amber"><div class="num" style="font-size:22px">${E(st.level)}</div><div class="lbl">当前等级</div></div>
    </div>`;
    h += `<div class="grid grid-2 mb16">
      <div class="card"><div class="panel-title">${I('layers')}<h3>分层覆盖度</h3></div>
        ${st.byLayer.map((x) => `<div class="prog-row"><div class="spread"><span class="small">${KB.layerChip(x.layer)}</span>
          <span class="tiny dim">${x.done} / ${x.total} · ${x.pct}%</span></div>
          <div class="prog-track"><div class="prog-fill" style="width:${x.pct}%"></div></div></div>`).join('')}
        <div class="hr"></div><div class="tiny dim">本周学习事件 ${st.week.length} 次；打卡 ${p.checkins.filter((d) => d >= new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10)).length} 天。</div></div>
      <div class="card"><div class="panel-title">${I('clock')}<h3>最近活动</h3></div>
        ${st.week.length ? st.week.slice(-10).reverse().map((e) => `<div class="val-row"><span class="vr-ico vr-ok">·</span>
          <span class="grow small">${E(({ view: '浏览条目', card: '卡片学习', decision: '完成决策向导', troubleshoot: '完成故障排查', fav: '收藏兜底策略', mastered: '标记已掌握', checkin: '打卡', incident: '录入事故', 'draft-approved': '审核入库草稿', skeleton: '采纳 links 建议' })[e.type] || e.type)}
          ${e.id ? ' · ' + E((KB.byId(e.id) || {}).name || e.id) : ''}</span><span class="tiny dim">${E(e.day)}</span></div>`).join('')
          : '<div class="tiny dim">暂无活动。去首页浏览一个条目，或点右上角打卡。</div>'}
      </div></div>`;
    h += `<div class="card mb16"><div class="panel-title">${I('star')}<h3>标记已掌握</h3><span class="grow"></span><span class="tiny dim">按「待同步优先」推荐</span></div>
      <div class="row-wrap">${KB.methods().filter((m) => p.mastered.indexOf(m.id) < 0).slice(0, 10).map((m) =>
        `<button class="chip-filter" data-action="master" data-id="${E(m.id)}">✓ ${E(m.name)}</button>`).join('') || '<span class="tiny dim">全部方法都已掌握 🎉</span>'}</div></div>`;
    h += `<div class="card"><div class="panel-title">${I('file')}<h3>本周周报预览</h3></div>
      <pre class="report-pre">${E(KB.weeklyReport())}</pre></div>`;
    return h;
  }

  // ============================ F19 变更影响分析 ============================
  function viewImpact(r) {
    const all = KB.methods();
    const id = r.qs.get('id') || KB.state.impactSelect || '';
    const x = id ? KB.impactOf(id) : null;
    let h = head('变更影响分析', '某个方法改动，会波及谁',
      '聚合 links、链路 edges 的下游可达节点、跨链路共享节点、关联事故与排查流，生成 PR 复核检查单；同时对照自动抽取的 links 骨架。',
      `<select class="plain-input" style="width:auto;min-width:220px" data-action="impactSelect">
        <option value="">选择一个方法…</option>
        ${all.map((m) => `<option value="${E(m.id)}" ${m.id === id ? 'selected' : ''}>${E(m.name)} · ${E(L[m.layer].label)}</option>`).join('')}
      </select>
      ${x ? `<button class="btn btn-sm" data-action="exportChecklist" data-id="${E(id)}">${I('download')} 导出检查单</button>` : ''}`);
    if (!x) return h + `<div class="card"><div class="panel-title">${I('alert')}<h3>从「待同步」条目开始</h3></div>
      <p class="small muted">优先复核源码已变更但文档未跟的条目：</p>
      <div class="row-wrap">${all.filter((m) => KB.syncStatus(m).level !== 'ok').slice(0, 10).map((m) =>
        `<button class="chip-filter" data-action="go" data-route="#/impact?id=${E(m.id)}">${E(m.name)}</button>`).join('') || '<span class="tiny dim">当前没有待同步条目</span>'}</div></div>`;

    h += `<div class="grid grid-4 mb16">
      <div class="stat accent"><div class="num">${x.checklist.length}</div><div class="lbl">需复核条目</div></div>
      <div class="stat"><div class="num">${x.chains.length}</div><div class="lbl">受影响链路</div></div>
      <div class="stat amber"><div class="num">${x.shared.length}</div><div class="lbl">跨链路共享节点</div></div>
      <div class="stat red"><div class="num">${x.incidents.length}</div><div class="lbl">关联事故</div></div>
    </div>`;
    h += `<div class="card mb16"><div class="panel-title">${I('check')}<h3>PR 复核检查单 · ${E(x.m.name)}</h3>${KB.statusBadge(x.m)}</div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>条目</th><th>层</th><th>影响来源</th><th>同步状态</th><th></th></tr></thead><tbody>
      ${x.checklist.map((nid) => {
        const m = KB.byId(nid);
        const src = [];
        if ((x.direct.upstream || []).indexOf(nid) >= 0) src.push('upstream');
        if ((x.direct.downstream || []).indexOf(nid) >= 0) src.push('downstream');
        if ((x.direct.related || []).indexOf(nid) >= 0) src.push('related');
        if (x.downstreamNodes.indexOf(nid) >= 0) src.push('链路下游可达');
        return `<tr><td><strong>${E(m ? m.name : nid)}</strong></td><td>${m ? KB.layerChip(m.layer) : '—'}</td>
          <td class="small dim">${E(src.join(' / '))}</td><td>${m ? KB.statusBadge(m) : badge('已缺失', 'badge-red')}</td>
          <td>${m ? `<button class="btn btn-sm" data-action="go" data-route="#/entry/${E(nid)}">打开</button>` : ''}</td></tr>`;
      }).join('')}</tbody></table></div></div>`;
    h += `<div class="grid grid-2 mb16">
      <div class="card"><div class="panel-title">${I('chain')}<h3>受影响链路（${x.chains.length}）</h3></div>
        ${x.chains.length ? x.chains.map((c) => `<div class="val-row"><span class="grow"><strong>${E(c.name)}</strong>
          <div class="tiny dim">${E(c.description)}</div></span>
          <button class="btn btn-sm" data-action="go" data-route="#/chain/${E(c.id)}?at=${E(x.m.id)}">链路图</button></div>`).join('') : '<div class="tiny dim">该条目尚未纳入链路。</div>'}
        <div class="hr"></div><h4 class="mb8">跨链路共享节点</h4>
        ${x.shared.length ? x.shared.map((nid) => `<div class="callout warn mb8"><strong>${E((KB.byId(nid) || {}).name || nid)}</strong>
          <div class="tiny">出现在 ${KB.chains().filter((c) => c.nodes.indexOf(nid) >= 0).length} 条链路中，改动需同步复核。</div></div>`).join('') : '<div class="callout good">没有跨链路共享节点。</div>'}</div>
      <div class="card"><div class="panel-title">${I('tool')}<h3>自动抽取的 links 骨架（F15）</h3></div>
        ${x.skeleton ? `<div class="row-wrap mb8">${badge(x.skeleton.entry.parser || 'builtin-regex', 'badge-soft')}
          <span class="tiny dim">置信度 ${Math.round((x.skeleton.entry.confidence || 0) * 100)}% · 签名 ${(x.skeleton.entry.signatures || []).length} · 调用边 ${(x.skeleton.entry.calls || []).length}</span></div>
          ${['upstream', 'downstream', 'related'].map((k) => {
            const d = x.skeleton.diff[k];
            return `<div class="val-row"><span class="small nowrap" style="min-width:96px">${E(k)}</span><span class="grow small">
              ${d.added.length ? `<span class="txt-green">+ ${d.added.map((i) => E((KB.byId(i) || {}).name || i)).join('、')}</span> ` : ''}
              ${d.removed.length ? `<span class="txt-red">− ${d.removed.map((i) => E((KB.byId(i) || {}).name || i)).join('、')}</span> ` : ''}
              ${!d.added.length && !d.removed.length ? '<span class="tiny dim">与人工现值一致</span>' : ''}</span></div>`;
          }).join('')}
          <div class="row-wrap mt12">${KB.canEdit() ? `<button class="btn btn-sm btn-primary" data-action="applySkeleton" data-id="${E(x.m.id)}">采纳建议</button>` : ''}
            <span class="tiny dim">骨架只提供建议，不自动覆盖人工 links</span></div>`
          : `<div class="callout">该条目暂无骨架。运行 <code>node tools/extract-links.mjs</code> 后重新构建快照。</div>`}
        <div class="hr"></div><h4 class="mb8">关联事故 / 排查流 / 预案</h4>
        <div class="small">事故 ${x.incidents.length} 起 · 排查流 ${x.flows.length} 条 · 已收藏兜底 ${x.favorites.length} 条</div>
        ${x.incidents.map((i) => `<div class="val-row"><span class="grow small">${E(i.title)}</span>
          <button class="btn btn-sm" data-action="go" data-route="#/incident/${E(i.id)}">详情</button></div>`).join('')}
      </div></div>`;
    h += `<div class="card"><div class="panel-title">${I('file')}<h3>检查单 Markdown 预览</h3></div>
      <pre class="report-pre">${E(KB.impactMarkdown(id))}</pre></div>`;
    return h;
  }

  // ============================ 服务配置 ============================
  function serviceForm() {
    const s = KB.state.services;
    KB.modal({
      title: '配置 AI / 向量检索服务', wide: true,
      html: `<div class="callout mb12">两项能力都支持「无服务也能用」：未配置或调用失败时自动回退本地实现。
        远程接口契约为 OpenAI 兼容 <code>/chat/completions</code> 与 <code>{ results:[{id,score}] }</code> 的 pgvector 检索服务。
        <strong>API Key 只保留在当前会话内存，不写入浏览器存储。</strong></div>
        <div class="grid grid-2">
          <div class="field"><label>LLM endpoint（chat/completions）</label><input id="svcLlm" class="plain-input" value="${E(s.llmEndpoint)}" placeholder="https://.../v1/chat/completions"></div>
          <div class="field"><label>向量检索 endpoint（pgvector）</label><input id="svcEmb" class="plain-input" value="${E(s.embeddingEndpoint)}" placeholder="https://.../search"></div>
          <div class="field"><label>模型名</label><input id="svcModel" class="plain-input" value="${E(s.model)}"></div>
          <div class="field"><label>API Key（仅本会话，可留空）</label><input id="svcKey" class="plain-input" type="password" value="" placeholder="sk-..."></div>
          <div class="field"><label>App 基础地址（IDE 深链用）</label><input id="svcBase" class="plain-input" value="${E(s.baseUrl)}"></div>
        </div>
        <label class="check-item"><input type="checkbox" id="svcUseLlm" ${s.useLlm ? 'checked' : ''}><span>启用 LLM 起草四问（失败自动回退本地启发式）</span></label>
        <label class="check-item"><input type="checkbox" id="svcUseEmb" ${s.useEmbedding ? 'checked' : ''}><span>启用 pgvector 语义检索（失败自动回退本地 TF-IDF）</span></label>`,
      foot: `<button class="btn btn-sm" data-action="closeModal">取消</button>
             <button class="btn btn-primary btn-sm" data-action="serviceSave">保存配置</button>`
    });
  }

  // ============================ 路由 / 事件委托 ============================
  const VIEWS = {
    incidents: viewIncidents, incident: viewIncidents,
    drafts: viewDrafts, progress: viewProgress, impact: viewImpact
  };
  KB.views2 = {
    view(name, r) { return VIEWS[name] ? VIEWS[name](r) : null; },
    change(el, rerender) {
      if (el.dataset && el.dataset.action === 'impactSelect') {
        KB.state.impactSelect = el.value || '';
        KB.navigate(el.value ? '#/impact?id=' + encodeURIComponent(el.value) : '#/impact', { push: false });
        return true;
      }
      return false;
    },
    action(a, d, el, rerender) {
      switch (a) {
        case 'serviceConfig': serviceForm(); return true;
        case 'serviceSave': {
          const s = KB.state.services;
          s.llmEndpoint = val('svcLlm'); s.embeddingEndpoint = val('svcEmb');
          s.model = val('svcModel') || 'gpt-4o-mini'; s.baseUrl = val('svcBase') || 'http://localhost:5173/';
          s.apiKey = val('svcKey'); s.useLlm = checked('svcUseLlm'); s.useEmbedding = checked('svcUseEmb');
          KB.saveServices(); KB.closeModal(); KB.render();
          KB.toast('服务配置已保存（Key 仅本会话有效）', 'ok'); return true;
        }
        case 'draftGenerate': {
          const name = val('draftName');
          if (!name) { KB.toast('请填写方法名', 'err'); return true; }
          const input = {
            name, signature: val('draftSig'), layer: val('draftLayer') || 'frontend',
            module: val('draftModule'), repoPath: val('draftPath'), tags: val('draftTags'),
            scene: val('draftScene'), summary: val('draftSummary')
          };
          KB.generateDraft(input).then((res) => {
            KB.makeDraft(input, res.entry, res.source);
            KB.track('draft', { id: res.entry.id });
            KB.render(); KB.toast('四问草稿已生成，待人工核实', 'ok');
          }).catch((e) => KB.toast('起草失败：' + e.message, 'err'));
          return true;
        }
        case 'draftReview': {
          const dr = KB.drafts().find((x) => x.id === d.id);
          if (dr) draftReviewForm(dr);
          return true;
        }
        case 'draftSaveReview': {
          const dr = KB.drafts().find((x) => x.id === d.id);
          if (!dr) return true;
          let obj;
          try { obj = JSON.parse(val('draftJson')); } catch (e) { KB.toast('JSON 解析失败：' + e.message, 'err'); return true; }
          const v = KB.validateEntry(obj);
          if (v.errors.length) { KB.toast('验收校验未通过：' + v.errors[0], 'err'); return true; }
          dr.entry = obj; dr.status = checked('draftReviewed') ? 'reviewed' : 'draft';
          dr.notes = val('draftNotes'); dr.reviewer = val('draftReviewer');
          KB.state.draftReviewer = dr.reviewer;
          KB.saveDraft(dr); KB.closeModal(); KB.render();
          KB.toast(dr.status === 'reviewed' ? '已保存核实结果，可以批准入库' : '审核意见已保存（未勾选核实）', 'ok');
          return true;
        }
        case 'draftApprove': {
          const res = KB.approveDraft(d.id, KB.state.draftReviewer || '未署名');
          KB.toast(res.message, res.ok ? 'ok' : 'err');
          if (res.ok) KB.render(); else rerender();
          return true;
        }
        case 'draftDelete': {
          if (!confirm('删除这份草稿？此操作不可撤销。')) return true;
          KB.deleteDraft(d.id); KB.render(); KB.toast('草稿已删除'); return true;
        }
        case 'draftExport': {
          const dr = KB.drafts().find((x) => x.id === d.id);
          if (dr) KB.download('四问草稿-' + dr.entry.name + '.md', KB.draftToMarkdown(dr), 'text/markdown');
          return true;
        }
        case 'incidentNew': {
          if (!KB.canEdit()) { KB.toast('只读用户不可录入事故', 'err'); return true; }
          incidentForm(); return true;
        }
        case 'incidentSave': {
          const methods = [];
          try {
            document.querySelectorAll('input[name="incMethod"]:checked').forEach((c) => methods.push(c.value));
          } catch (e) { /* 无 DOM 环境下忽略 */ }
          const inc = {
            id: 'inc.local.' + Date.now().toString(36), title: val('incTitle'), symptom: val('incSymptom'),
            rootCause: val('incRootCause'), improvement: val('incImprovement'),
            occurredAt: val('incDate') || KB.today(), relatedMethodIds: methods,
            missingFallbacks: KB.LAYERS.map((l) => ({ layer: l, item: val('incFb_' + l), expected: '' })).filter((f) => f.item)
          };
          const errs = KB.validateIncident(inc);
          if (errs.length) { KB.toast(errs[0], 'err'); return true; }
          KB.saveIncident(inc); KB.closeModal(); KB.render(); KB.toast('事故已录入（本地，导出后回写仓库）', 'ok');
          return true;
        }
        case 'incidentDelete': {
          if (!KB.canEdit()) { KB.toast('只读用户不可删除', 'err'); return true; }
          if (!confirm('删除这起事故复盘？')) return true;
          KB.deleteIncident(d.id); KB.render(); KB.toast('事故已删除'); return true;
        }
        case 'incidentExport': KB.download('事故复盘.md', KB.incidentsMarkdown(), 'text/markdown'); return true;
        case 'checkIn': { const r = KB.checkIn(); KB.toast(r.message, r.ok ? 'ok' : ''); KB.render(); return true; }
        case 'master': KB.toggleMastered(d.id); KB.render(); return true;
        case 'exportReport': KB.download('StackMap-学习周报-' + KB.today() + '.md', KB.weeklyReport(), 'text/markdown'); return true;
        case 'copyReport': KB.copyText(KB.weeklyReport()); return true;
        case 'exportChecklist': KB.download('PR-变更影响检查单.md', KB.impactMarkdown(d.id), 'text/markdown'); return true;
        case 'applySkeleton': {
          const r = KB.applySkeleton(d.id);
          KB.toast(r.message, r.ok ? 'ok' : 'err'); KB.render(); return true;
        }
        case 'copyDeepLink': {
          const m = KB.byId(d.id);
          if (m) KB.copyText(KB.deepLink(m, d.ref, d.line));
          return true;
        }
        case 'copyByNameLink': {
          const m = KB.byId(d.id);
          if (m) KB.copyText(KB.byNameDeepLink(m, d.ref, d.line));
          return true;
        }
      }
      return false;
    }
  };
})();
