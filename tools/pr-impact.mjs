#!/usr/bin/env node
// F19 · PR 变更影响自动提醒（零依赖 Node ESM CLI）
// 把一次 PR 的源码改动映射到知识库条目，产出「哪些方法被改动、波及哪些
// 链路 / 下游节点 / 事故 / 排查流、PR 需要复核什么」的 Markdown 检查单，
// 供 CI 写入 PR comment / job summary；同时输出结构化 JSON 给上层 App 读取。
//
// 本脚本只生成建议，绝不回写 content/ 事实源，也不依赖任何第三方包。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// 与 build-snapshot.mjs / extract-links.mjs 保持一致：以仓库根为相对路径基准。
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOOL = 'pr-impact.mjs';

const CONTENT_FILES = new Set([
  'methods.json',
  'chains.json',
  'incidents.json',
  'troubleshooting.json',
]);
const DEFAULT_PROJECT_ID = 'yunshu';
const LAYER_ORDER = ['frontend', 'bff', 'backend', 'data', 'infra'];
const MATCH_RANK = { exact: 3, suffix: 2, prefix: 1 };

const HELP = `用法：node tools/pr-impact.mjs [选项]

选项：
  --base <ref>      对比起点，默认 HEAD~1
  --head <ref>      对比终点，默认 HEAD
  --files <a,b,c>   直接给定改动文件列表（逗号分隔）；给了就不执行 git diff
  --out <path>      把 Markdown 检查单写入文件（父目录自动创建）；不传则输出到 stdout
  --json            stdout 输出纯 JSON（可与 --out 共存：Markdown 写文件、JSON 打 stdout）
  --content <dir>   内容目录，默认 content；会递归扫描其下所有四类 JSON 并合并
  --self-test       用内置改动路径跑完整流程，不依赖 git
  -h, --help        显示本帮助

说明：git 不可用或 ref 无效时优雅降级为「未命中」检查单，不会抛异常。
      多项目：自动扫描 content/projects/<id>/ 下的同名 JSON，按 id 去重取并集；
      entry 无 projectId 时优先从路径推断，否则默认 yunshu。
      脚本只生成建议，不自动改 content/。`;

// 内置自测改动路径：覆盖 exact / suffix / prefix 三种匹配，跨两条链路，
// 且刻意不含任何 content/ 文件，以便同时演示「内容漂移提醒」。
const SELF_TEST_FILES = [
  'apps/web/src/upload/useUploadQueue.ts',
  'apps/web/src/upload/uploadFileToOSS.ts',
  'apps/bff/src/routes/upload-token.ts',
  'monorepo/apps/web/src/order/submitOrder.ts',
  'services/order/src/main/java/.../IdempotencyGuard.java',
  'infra/terraform/kafka_retry.tf',
  'apps/web/src/upload/__tests__/queue.spec.ts',
  'services/file/src/main/java/.../NewPresignHelper.java',
];

// ---------------------------------------------------------------- 参数解析

function parseArgs(argv) {
  const args = {
    base: 'HEAD~1',
    head: 'HEAD',
    files: null,
    out: null,
    json: false,
    content: 'content',
    selfTest: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--json') args.json = true;
    else if (a === '--self-test') args.selfTest = true;
    else if (a === '-h' || a === '--help') args.help = true;
    else if (a === '--base') args.base = argv[++i];
    else if (a === '--head') args.head = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--content') args.content = argv[++i];
    else if (a === '--files') {
      const raw = argv[++i];
      args.files = String(raw == null ? '' : raw)
        .split(',')
        .map(normalizeFile)
        .filter(Boolean);
    } else if (a.startsWith('--')) {
      process.stderr.write(`[${TOOL}] 忽略未知参数：${a}\n`);
    } else {
      process.stderr.write(`[${TOOL}] 忽略未知位置参数：${a}\n`);
    }
  }
  return args;
}

// ---------------------------------------------------------------- 路径工具

function toPosix(p) {
  return String(p).split(path.sep).join('/').replace(/\\/g, '/');
}

// 统一改动文件 / repoPath 的表示：反斜杠转正斜杠、去掉 ./ 前缀、去空白。
function normalizeFile(p) {
  let s = String(p == null ? '' : p).trim().replace(/\\/g, '/');
  while (s.startsWith('./')) s = s.slice(2);
  return s;
}

function dirSegments(p) {
  const s = normalizeFile(p);
  const arr = s.split('/');
  if (!s.endsWith('/')) arr.pop(); // 去掉文件名，只保留目录段
  return arr.filter(Boolean);
}

function commonPrefixLen(a, b) {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n += 1;
  return n;
}

// 按优先级返回命中方式：exact > suffix > prefix，未命中返回 null。
// suffix 用 '/'+整串 做边界比较，保证按 / 分段匹配，避免子串误命中。
function matchType(changedFile, repoPath) {
  const cf = normalizeFile(changedFile);
  const rp = normalizeFile(repoPath);
  if (!cf || !rp) return null;
  if (cf === rp) return 'exact';
  if (cf.endsWith('/' + rp) || rp.endsWith('/' + cf)) return 'suffix';
  if (commonPrefixLen(dirSegments(cf), dirSegments(rp)) >= 2) return 'prefix';
  return null;
}

// ---------------------------------------------------------------- 内容扫描

function walk(dir, out) {
  let ents;
  try {
    ents = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of ents) {
    if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (CONTENT_FILES.has(ent.name)) out.push(full);
  }
}

function inferProjectFromPath(file, contentDir) {
  const rel = toPosix(path.relative(contentDir, file));
  const m = /(?:^|\/)projects\/([^/]+)\//.exec(rel);
  return m ? m[1] : null;
}

function asArray(data, key) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data[key])) return data[key];
  return [];
}

function dedupeById(list) {
  const seen = new Set();
  return list.filter((x) => {
    if (!x || !x.id || seen.has(x.id)) return false;
    seen.add(x.id);
    return true;
  });
}

// 递归合并 content/ 下所有同名文件：取并集、按 id 去重（先出现者优先）。
function scanContent(contentDir) {
  const result = { methods: [], chains: [], incidents: [], flows: [] };
  if (!fs.existsSync(contentDir)) {
    process.stderr.write(`[${TOOL}] 提示：内容目录不存在（${toPosix(contentDir)}），按「未命中」处理。\n`);
    return result;
  }

  const files = [];
  walk(contentDir, files);
  files.sort((a, b) => toPosix(a).localeCompare(toPosix(b)));

  for (const file of files) {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      process.stderr.write(`[${TOOL}] 提示：跳过无法解析的 JSON（${toPosix(file)}）：${err.message}\n`);
      continue;
    }
    const kind = path.basename(file);
    if (kind === 'methods.json') {
      const inferred = inferProjectFromPath(file, contentDir);
      for (const e of asArray(data, 'entries')) {
        if (!e || !e.id) continue;
        result.methods.push({
          ...e,
          projectId: e.projectId || inferred || DEFAULT_PROJECT_ID,
        });
      }
    } else if (kind === 'chains.json') {
      for (const c of asArray(data, 'chains')) if (c && c.id) result.chains.push(c);
    } else if (kind === 'incidents.json') {
      for (const i of asArray(data, 'incidents')) if (i && i.id) result.incidents.push(i);
    } else if (kind === 'troubleshooting.json') {
      for (const f of asArray(data, 'flows')) if (f && f.id) result.flows.push(f);
    }
  }

  result.methods = dedupeById(result.methods);
  result.chains = dedupeById(result.chains);
  result.incidents = dedupeById(result.incidents);
  result.flows = dedupeById(result.flows);
  return result;
}

// ---------------------------------------------------------------- 改动文件

function gitDiff(base, head) {
  try {
    const out = execFileSync('git', ['diff', '--name-only', base, head], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return String(out).split(/\r?\n/).map(normalizeFile).filter(Boolean);
  } catch {
    process.stderr.write(
      `[${TOOL}] 提示：无法获取 git diff（git 不可用或 ref 无效：${base} → ${head}）。` +
        `已优雅降级为「未命中」检查单；可用 --files 手动指定改动文件。\n`,
    );
    return [];
  }
}

// ---------------------------------------------------------------- 命中计算

// 每个改动文件只保留它达到的最高优先级匹配，避免 prefix 带来过多噪音；
// 多个文件命中同一方法时，按方法保留优先级最高的那条（含 matchedFile）。
function collectMatches(changedFiles, methods) {
  const perMethod = new Map();
  for (const file of changedFiles) {
    let bestRank = 0;
    const candidates = [];
    for (const m of methods) {
      const mt = matchType(file, m.repoPath);
      if (!mt) continue;
      const rank = MATCH_RANK[mt];
      if (rank > bestRank) {
        bestRank = rank;
        candidates.length = 0;
      }
      if (rank === bestRank) candidates.push({ method: m, matchType: mt });
    }
    for (const c of candidates) {
      const prev = perMethod.get(c.method.id);
      if (!prev || MATCH_RANK[c.matchType] > MATCH_RANK[prev.matchType]) {
        perMethod.set(c.method.id, { ...c, matchedFile: file });
      }
    }
  }
  return [...perMethod.values()];
}

function buildHits(matches, content) {
  const hits = matches.map(({ method, matchType: mt, matchedFile }) => {
    const id = method.id;

    // 所在链路
    const chains = content.chains
      .filter((c) => (c.nodes || []).includes(id))
      .map((c) => c.id);

    // 下游：链路中该节点之后的所有节点（按 nodes 顺序） + links.downstream，去重
    const downstreamSet = new Set();
    for (const c of content.chains) {
      const nodes = c.nodes || [];
      const idx = nodes.indexOf(id);
      if (idx >= 0) for (let j = idx + 1; j < nodes.length; j += 1) downstreamSet.add(nodes[j]);
    }
    for (const d of (method.links && method.links.downstream) || []) downstreamSet.add(d);

    // 关联事故
    const incidents = content.incidents
      .filter((i) => (i.relatedMethodIds || []).includes(id))
      .map((i) => i.id);

    // 关联排查流：resultMethodId 命中，或 steps 文本中提及该 id
    const flows = content.flows
      .filter((f) => {
        if (f.resultMethodId === id) return true;
        return JSON.stringify(f.steps || []).includes(id);
      })
      .map((f) => f.id);

    return {
      methodId: id,
      name: method.name || id,
      repoPath: method.repoPath || '',
      layer: method.layer || '',
      projectId: method.projectId || DEFAULT_PROJECT_ID,
      matchType: mt,
      matchedFile,
      chains,
      downstream: [...downstreamSet],
      incidents,
      flows,
      fallbackLayers: (method.fallback || []).length,
      alternatives: (method.alternatives || []).length,
    };
  });
  hits.sort(
    (a, b) =>
      MATCH_RANK[b.matchType] - MATCH_RANK[a.matchType] ||
      String(a.methodId).localeCompare(String(b.methodId)),
  );
  return hits;
}

function isContentFile(file, contentDir) {
  const prefixes = new Set(['content']);
  const rel = toPosix(path.relative(ROOT, contentDir));
  if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) prefixes.add(rel);
  const f = normalizeFile(file);
  for (const p of prefixes) {
    if (f === p || f.startsWith(p + '/')) return true;
  }
  return false;
}

function computeDrift(changedFiles, hits, contentDir) {
  const hasContentChange = changedFiles.some((f) => isContentFile(f, contentDir));
  const detected = hits.length > 0 && !hasContentChange;
  return { detected, methodIds: detected ? hits.map((h) => h.methodId) : [] };
}

function computeReviewers(hits) {
  const layerSet = new Set(hits.map((h) => h.layer).filter(Boolean));
  const known = LAYER_ORDER.filter((l) => layerSet.has(l));
  const extra = [...layerSet].filter((l) => !LAYER_ORDER.includes(l)).sort();
  return [...known, ...extra];
}

// ---------------------------------------------------------------- Markdown

function buildMarkdown(ctx) {
  const {
    generatedAt, base, head, changedFiles, hits, drift, reviewers,
    chainCount, content,
  } = ctx;
  const chainById = new Map(content.chains.map((c) => [c.id, c]));
  const incidentById = new Map(content.incidents.map((i) => [i.id, i]));
  const flowById = new Map(content.flows.map((f) => [f.id, f]));

  const L = [];
  L.push('# StackMap · PR 变更影响检查单');
  L.push('');
  L.push('> 生成时间：' + generatedAt);
  L.push('> base / head：`' + base + '` → `' + head + '`');
  L.push(
    '> **摘要**：改动文件 ' + changedFiles.length + ' 个 / 命中条目 ' + hits.length +
      ' 个 / 波及链路 ' + chainCount + ' 条 / 漂移：' + (drift.detected ? '是' : '否'),
  );
  L.push('');
  L.push('<details><summary>本次改动文件（' + changedFiles.length + '）</summary>');
  L.push('');
  if (changedFiles.length === 0) L.push('- （无）');
  else for (const f of changedFiles) L.push('- `' + f + '`');
  L.push('');
  L.push('</details>');
  L.push('');

  // 一、命中的方法条目
  L.push('## 一、命中的方法条目');
  L.push('');
  if (hits.length === 0) {
    L.push('本次改动 **未命中** 任何知识库条目。');
    L.push('');
  } else {
    for (const h of hits) {
      L.push('### ' + h.methodId + ' · ' + h.name);
      L.push('');
      L.push('- 层（layer）：`' + h.layer + '`');
      L.push('- 项目（projectId）：`' + h.projectId + '`');
      L.push('- 路径（repoPath）：`' + h.repoPath + '`');
      L.push('- 匹配方式：`' + h.matchType + '` ← 改动文件 `' + h.matchedFile + '`');
      L.push('- 分层兜底：' + h.fallbackLayers + ' 层 ｜ 替代方案：' + h.alternatives + ' 个');
      L.push('- 所在链路：' + (h.chains.length ? h.chains.map((c) => '`' + c + '`').join('、') : '（无）'));
      L.push('');
    }
  }

  // 二、波及链路与下游节点表
  L.push('## 二、波及链路与下游节点');
  L.push('');
  const allChainIds = [...new Set(hits.flatMap((h) => h.chains))];
  if (allChainIds.length === 0) {
    L.push('（无波及链路）');
    L.push('');
  } else {
    L.push('| 链路 | 名称 | 命中节点 | 下游节点 |');
    L.push('| --- | --- | --- | --- |');
    for (const cid of allChainIds) {
      const chain = chainById.get(cid);
      const nodes = (chain && chain.nodes) || [];
      const hitNodes = hits.filter((h) => h.chains.includes(cid)).map((h) => h.methodId);
      const minIdx = nodes.reduce(
        (acc, n, i) => (hitNodes.includes(n) ? Math.min(acc, i) : acc),
        Number.POSITIVE_INFINITY,
      );
      const downstream = Number.isFinite(minIdx)
        ? nodes.slice(minIdx + 1).filter((n) => !hitNodes.includes(n))
        : [];
      L.push(
        '| `' + cid + '` | ' + ((chain && chain.name) || '—') + ' | ' +
          (hitNodes.length ? hitNodes.map((n) => '`' + n + '`').join('、') : '—') + ' | ' +
          (downstream.length ? downstream.map((n) => '`' + n + '`').join('、') : '—') + ' |',
      );
    }
    L.push('');
  }

  // 三、关联事故与排查流
  L.push('## 三、关联事故与排查流');
  L.push('');
  const allIncidents = [...new Set(hits.flatMap((h) => h.incidents))];
  const allFlows = [...new Set(hits.flatMap((h) => h.flows))];
  L.push('**关联事故**：');
  if (allIncidents.length === 0) L.push('- （无）');
  else for (const iid of allIncidents) {
    const inc = incidentById.get(iid);
    L.push('- `' + iid + '`' + (inc && inc.title ? ' — ' + inc.title : ''));
  }
  L.push('');
  L.push('**排查流**：');
  if (allFlows.length === 0) L.push('- （无）');
  else for (const fid of allFlows) {
    const fl = flowById.get(fid);
    L.push('- `' + fid + '`' + (fl && fl.symptom ? ' — ' + fl.symptom : ''));
  }
  L.push('');

  // 四、PR 复核检查单
  L.push('## 四、PR 复核检查单');
  L.push('');
  L.push('- [ ] 跑 `npm run verify`，确认快照 / 冒烟 / 链接抽取检查全部通过');
  if (hits.length === 0) {
    L.push('- [ ] 本次改动未命中知识库条目：确认是否确为新模块；若是请补 `content/methods.json` 条目与 repoPath');
    L.push('- [ ] 确认知识库无需随本次 PR 同步，或已在 PR 描述中说明');
  } else {
    for (const h of hits) {
      L.push('- [ ] 复核条目 `' + h.methodId + '`（' + h.name + '）的 what / why / repoPath 是否仍与源码一致');
      L.push(
        '- [ ] 复核 `' + h.methodId + '` 的**兜底分层三要素**（failureMode / strategy / monitoring）' +
          '在前端 / 后端 / 数据层是否仍成立（当前 ' + h.fallbackLayers + ' 层）',
      );
      L.push(
        '- [ ] 复核 `' + h.methodId + '` 的**替代方案结论条件**（whenToUse / comparisonConclusion / migrationCost）' +
          '是否随本次改动变化（当前 ' + h.alternatives + ' 个）',
      );
      if (h.downstream.length) {
        L.push('- [ ] 复核 `' + h.methodId + '` 的**链路下游** ' + h.downstream.map((d) => '`' + d + '`').join('、') + ' 是否受影响');
      }
      if (h.incidents.length) {
        L.push('- [ ] 复核 `' + h.methodId + '` 关联的**事故预案** ' + h.incidents.map((i) => '`' + i + '`').join('、') + ' 的改进项是否仍生效');
      }
    }
  }
  L.push('');

  // 五、内容漂移提醒
  L.push('## 五、内容漂移提醒');
  L.push('');
  if (drift.detected) {
    L.push('> ⚠ **源码已改但知识库条目未同步**');
    L.push('');
    L.push('本次 PR 命中了以下方法，但改动文件列表中 **没有任何 `content/` 下的文件**。请在本 PR 同步更新：');
    L.push('');
    L.push('| 应更新条目 id | repoPath |');
    L.push('| --- | --- |');
    for (const h of hits) L.push('| `' + h.methodId + '` | `' + h.repoPath + '` |');
    L.push('');
    L.push('若源码与知识库确实无需同步，请在 PR 描述里说明理由并让 reviewer 确认。');
  } else {
    L.push(
      '未检测到漂移：' +
        (hits.length
          ? '本次 PR 同时包含 `content/` 文件更新（内容文件与源码同 PR 更新，不提示）。'
          : '本次改动未命中知识库条目。'),
    );
  }
  L.push('');

  // 六、建议 reviewers
  L.push('## 六、建议 reviewers');
  L.push('');
  if (reviewers.length) {
    L.push('按命中方法的 layer 汇总：' + reviewers.map((r) => '`' + r + '`').join('、') + '。');
  } else {
    L.push('本次无命中条目，按常规 owner 分配即可。');
  }
  L.push('');
  L.push('---');
  L.push('');
  L.push('> 本报告由 `tools/pr-impact.mjs` 自动生成，仅提供复核建议，不会自动修改 `content/`。');
  L.push('');

  return L.join('\n') + '\n';
}

function summaryLine(ctx) {
  return (
    `[${TOOL}] 中文摘要：改动文件 ${ctx.changedFiles.length} 个 / 命中方法 ${ctx.hits.length} 个 / ` +
    `波及链路 ${ctx.chainCount} 条 / 漂移：${ctx.drift.detected ? '是（⚠ 源码已改但知识库条目未同步）' : '否'}`
  );
}

// ---------------------------------------------------------------- 主流程

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(HELP + '\n');
    return;
  }

  let changedFiles;
  if (args.selfTest) changedFiles = [...SELF_TEST_FILES];
  else if (args.files && args.files.length) changedFiles = args.files;
  else changedFiles = gitDiff(args.base, args.head);
  changedFiles = [...new Set(changedFiles.map(normalizeFile).filter(Boolean))];

  const contentDir = path.isAbsolute(args.content)
    ? args.content
    : path.resolve(ROOT, args.content);
  const content = scanContent(contentDir);

  const hits = buildHits(collectMatches(changedFiles, content.methods), content);
  const chainCount = new Set(hits.flatMap((h) => h.chains)).size;
  const drift = computeDrift(changedFiles, hits, contentDir);
  const reviewers = computeReviewers(hits);
  const generatedAt = new Date().toISOString();

  const ctx = {
    generatedAt,
    base: args.base,
    head: args.head,
    changedFiles,
    hits,
    drift,
    reviewers,
    chainCount,
    content,
  };
  const markdown = buildMarkdown(ctx);

  // JSON 结构字段名严格固定，主 Agent 的 App 会读取，勿增删顶层字段。
  const report = {
    schemaVersion: '1.0',
    generatedAt,
    base: args.base,
    head: args.head,
    changedFiles,
    hits,
    drift,
    reviewers,
    markdown,
  };

  if (args.out) {
    const outPath = path.isAbsolute(args.out) ? args.out : path.resolve(ROOT, args.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, markdown, 'utf8');
    process.stderr.write(`[${TOOL}] Markdown 检查单已写入：${toPosix(outPath)}\n`);
  }

  if (args.json) {
    // stdout 必须保持纯 JSON，中文摘要转到 stderr。
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    process.stderr.write(summaryLine(ctx) + '\n');
  } else if (args.out) {
    // Markdown 已写文件，stdout 打印中文摘要。
    process.stdout.write(summaryLine(ctx) + '\n');
  } else {
    // stdout 输出完整 Markdown（首段即中文摘要），stderr 另打印一行纯文本摘要。
    process.stdout.write(markdown);
    process.stderr.write(summaryLine(ctx) + '\n');
  }
}

main();
