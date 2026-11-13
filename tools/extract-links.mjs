#!/usr/bin/env node
// F15 · 调用关系自动抽取（零依赖 Node ESM CLI）
// 扫描源码，抽取函数/方法签名与调用关系，为每个 MethodEntry 生成 links 骨架，
// 供人工审核后再合并进 content/methods.json。本脚本绝不回写事实源。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 与 tools/build-snapshot.mjs 保持一致：以仓库根为所有相对路径的基准。
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOOL = 'extract-links.mjs';
const SOURCE_EXT = /\.(js|jsx|ts|tsx|mjs|cjs)$/;

const HELP = `用法：node tools/extract-links.mjs [选项]

选项：
  --src <dir>       源码根目录（默认 samples）
  --methods <path>  MethodEntry 事实源（默认 content/methods.json）
  --out <path>      骨架输出路径（默认 content/generated/links.skeleton.json）
  --check           只报告与现有骨架的差异，不写文件
  --json            stdout 输出纯 JSON（中文摘要与差异报告转到 stderr）
  -h, --help        显示本帮助

说明：优先使用 tree-sitter / web-tree-sitter 解析 JS/TS；未安装时自动回退
      内置的静态解析器（正则 + 括号匹配），不会因缺少依赖而报错。`;

// 出现在「调用位」但不代表方法调用的关键字，统一过滤。
const KEYWORDS = new Set([
  'if', 'for', 'while', 'switch', 'case', 'catch', 'try', 'finally', 'do', 'else',
  'return', 'typeof', 'instanceof', 'void', 'delete', 'in', 'of', 'new', 'throw',
  'yield', 'await', 'function', 'class', 'extends', 'super', 'this', 'import',
  'export', 'default', 'const', 'let', 'var', 'async', 'static', 'get', 'set',
  'public', 'private', 'protected', 'readonly', 'interface', 'type', 'enum',
  'namespace', 'as', 'from', 'satisfies', 'keyof', 'asserts', 'is', 'constructor',
]);

// ---- 内置静态解析器用到的正则 ----
const DECL_FUNCTION = /(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/;
const DECL_ARROW = /(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/;
const DECL_ARROW_SINGLE = /(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*=>/;
const DECL_METHOD = /^\s*(?:(?:public|private|protected|static|readonly|async|get|set)\s+)*([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/;
const IMPORT_FROM = /^\s*(?:import|export)\b[^'"\n]*?\bfrom\s*['"]([^'"]+)['"]/;
const IMPORT_BARE = /^\s*import\s*['"]([^'"]+)['"]/;
const REQUIRE = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
// 组 1 可选的 obj. 前缀，组 2 为调用名；foo(...) 与 obj.method(...) 统一处理。
const CALL_RE = /(?:([A-Za-z_$][\w$]*)\s*\.\s*)?([A-Za-z_$][\w$]*)\s*\(/g;

function parseArgs(argv) {
  const args = {
    src: 'samples',
    methods: 'content/methods.json',
    out: 'content/generated/links.skeleton.json',
    check: false,
    json: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--check') args.check = true;
    else if (a === '--json') args.json = true;
    else if (a === '-h' || a === '--help') args.help = true;
    else if (a === '--src') args.src = argv[++i];
    else if (a === '--methods') args.methods = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a.startsWith('--')) process.stderr.write(`[extract-links] 忽略未知参数：${a}\n`);
  }
  return args;
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

// 递归收集源码文件；忽略 node_modules 与隐藏目录。
function collectFiles(dir, base, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) collectFiles(full, base, out);
    else if (SOURCE_EXT.test(ent.name)) out.push({ rel: toPosix(path.relative(base, full)), abs: full });
  }
  return out;
}

// 把一个源码文件归属到某个 MethodEntry：优先精确匹配 repoPath，再允许后缀匹配
// （便于 --src 指向 monorepo 上层目录）。取最长的 repoPath 以保证最精确。
function ownerFor(rel, methods) {
  let best = null;
  for (const m of methods) {
    const rp = toPosix(m.repoPath || '');
    if (!rp) continue;
    if (rel === rp || rel.endsWith('/' + rp)) {
      if (!best || rp.length > toPosix(best.repoPath).length) best = m;
    }
  }
  return best;
}

// 把注释与字符串内容替换成等长空白（保留换行），避免误把注释/字符串里的
// 名字或括号当成声明与调用；行号因此保持不变。
function stripNoise(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];
    if (c === '/' && c2 === '/') {
      while (i < n && src[i] !== '\n') { out += ' '; i += 1; }
      continue;
    }
    if (c === '/' && c2 === '*') {
      out += '  '; i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        out += src[i] === '\n' ? '\n' : ' ';
        i += 1;
      }
      out += '  '; i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      out += ' '; i += 1;
      while (i < n && src[i] !== quote) {
        if (src[i] === '\\') { out += '  '; i += 2; continue; }
        out += src[i] === '\n' ? '\n' : ' ';
        i += 1;
      }
      out += ' '; i += 1;
      continue;
    }
    out += c; i += 1;
  }
  return out;
}

function pushSignature(list, declared, name, params, line) {
  if (!name || KEYWORDS.has(name)) return;
  const clean = String(params || '').replace(/\s+/g, ' ').trim();
  list.push({ name, signature: `${name}(${clean})`, line });
  declared.add(name);
}

// 内置轻量静态解析器：真实工作，不是空壳。
// 返回 { signatures, calls, imports }，calls 为 { callee, lookup, line }。
function parseBuiltin(raw) {
  const cleaned = stripNoise(raw);
  const lines = cleaned.split('\n');
  const rawLines = raw.split('\n');
  const signatures = [];
  const calls = [];
  const imports = [];
  const declared = new Set();

  // import / require 来源在未清理的原始行上抽取（字符串已被 strip 掉）。
  for (const rl of rawLines) {
    let m;
    if ((m = IMPORT_FROM.exec(rl))) imports.push(m[1]);
    else if ((m = IMPORT_BARE.exec(rl))) imports.push(m[1]);
    REQUIRE.lastIndex = 0;
    for (const r of rl.matchAll(REQUIRE)) imports.push(r[1]);
  }

  // 声明：function 声明 / 箭头函数 / export const / class 方法。
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const lineNo = i + 1;
    let m;
    if ((m = DECL_FUNCTION.exec(line))) {
      pushSignature(signatures, declared, m[1], m[2], lineNo);
    } else if ((m = DECL_ARROW.exec(line))) {
      pushSignature(signatures, declared, m[1], m[2], lineNo);
    } else if ((m = DECL_ARROW_SINGLE.exec(line))) {
      pushSignature(signatures, declared, m[1], m[2], lineNo);
    } else if ((m = DECL_METHOD.exec(line))) {
      if (!KEYWORDS.has(m[1])) pushSignature(signatures, declared, m[1], m[2], lineNo);
    }
  }

  // 调用：过滤关键字、本文件已声明的名字（声明处与自调用），其余作为候选。
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const lineNo = i + 1;
    CALL_RE.lastIndex = 0;
    let m;
    while ((m = CALL_RE.exec(line)) !== null) {
      const obj = m[1] || '';
      const name = m[2];
      if (KEYWORDS.has(name) || declared.has(name)) continue;
      calls.push({ callee: obj ? `${obj}.${name}` : name, lookup: name, line: lineNo });
    }
  }

  return { signatures, calls, imports };
}

// ---- tree-sitter 可选增强 ----
// 任何一步失败都静默回退，绝不因缺少依赖而报错。
async function detectTreeSitter() {
  try {
    const Parser = (await import('tree-sitter')).default;
    for (const grammar of ['tree-sitter-javascript', 'tree-sitter-typescript']) {
      try {
        const lang = (await import(grammar)).default;
        if (Parser && lang) return { Parser, lang };
      } catch { /* 缺少对应 grammar */ }
    }
  } catch { /* 未安装 tree-sitter */ }

  try {
    const mod = await import('web-tree-sitter');
    const Parser = mod.default || mod;
    if (!Parser || typeof Parser.init !== 'function') return null;
    await Parser.init();
    const wasm = [
      path.join(ROOT, 'tree-sitter-javascript.wasm'),
      path.join(process.cwd(), 'tree-sitter-javascript.wasm'),
    ].find((p) => fs.existsSync(p));
    if (!wasm) return null;
    const lang = Parser.Language && typeof Parser.Language.load === 'function'
      ? await Parser.Language.load(wasm)
      : null;
    return lang ? { Parser, lang } : null;
  } catch { return null; }
}

function fieldOf(node, name) {
  if (!node || typeof node.childForFieldName !== 'function') return null;
  try { return node.childForFieldName(name); } catch { return null; }
}

function nodeText(node) {
  return node && typeof node.text === 'string' ? node.text : '';
}

function paramsOf(node) {
  return nodeText(node).trim().replace(/^\(/, '').replace(/\)$/, '').trim();
}

async function parseWithTreeSitter(ts, source) {
  const parser = new ts.Parser();
  // node 版 setLanguage 同步、web 版异步；await 兼容两者。
  await parser.setLanguage(ts.lang);
  const tree = parser.parse(source);
  const signatures = [];
  const calls = [];
  const imports = [];

  function walk(node, visit) {
    visit(node);
    for (const child of node.namedChildren || []) walk(child, visit);
  }

  function addDecl(nameNode, paramsNode) {
    if (!nameNode) return;
    const name = nodeText(nameNode);
    if (!name || KEYWORDS.has(name)) return;
    signatures.push({ name, signature: `${name}(${paramsOf(paramsNode)})`, line: nameNode.startPosition.row + 1 });
  }

  walk(tree.rootNode, (node) => {
    const t = node.type;
    if (t === 'function_declaration' || t === 'generator_function_declaration' || t === 'function' || t === 'method_definition') {
      addDecl(fieldOf(node, 'name'), fieldOf(node, 'parameters') || fieldOf(node, 'params'));
    } else if (t === 'variable_declarator') {
      const value = fieldOf(node, 'value');
      if (value && (value.type === 'arrow_function' || value.type === 'function')) {
        addDecl(fieldOf(node, 'name'), fieldOf(value, 'parameters') || fieldOf(value, 'params'));
      }
    } else if (t === 'call_expression') {
      const fn = fieldOf(node, 'function');
      if (!fn) return;
      let callee;
      let lookup;
      if (fn.type === 'member_expression') {
        callee = nodeText(fn);
        lookup = nodeText(fieldOf(fn, 'property')) || nodeText(fn);
      } else {
        callee = nodeText(fn);
        lookup = callee;
      }
      if (lookup) calls.push({ callee, lookup, line: fn.startPosition.row + 1 });
    } else if (t === 'import_statement' || t === 'import_declaration') {
      const src = (node.namedChildren || []).find((c) => c.type === 'string' || c.type === 'string_fragment');
      if (src) imports.push(nodeText(src).replace(/['"`]/g, ''));
    }
  });

  return { signatures, calls, imports };
}

// ---- 方法名 → methodId 映射 ----
// 键来自 signature 中的函数名（优先建立）与 name 字段（合法标识符才纳入）。
// 同名冲突按 methods.json 顺序「先到先得、不覆盖」，保证结果可复现。
function signatureName(sig) {
  if (typeof sig !== 'string') return null;
  const m = sig.match(/^\s*([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*\(/);
  return m ? m[1] : null;
}

function buildNameMap(methods) {
  const map = new Map();
  const add = (key, id) => {
    if (!key || !/^[A-Za-z_$][\w$]*$/.test(key)) return;
    if (!map.has(key)) map.set(key, id);
  };
  for (const m of methods) add(signatureName(m.signature), m.id);
  for (const m of methods) add(m.name, m.id);
  return map;
}

function sorted(set) {
  return [...set].sort();
}

function linksOf(entry) {
  const l = (entry && entry.links) || {};
  return {
    upstream: Array.isArray(l.upstream) ? [...l.upstream] : [],
    downstream: Array.isArray(l.downstream) ? [...l.downstream] : [],
    related: Array.isArray(l.related) ? [...l.related] : [],
  };
}

function makeSummaryText(result, outRel, wrote) {
  const s = result.summary;
  return [
    '[extract-links] 抽取完成',
    `  扫描文件数：${s.files}`,
    `  命中方法数：${s.matchedMethods}`,
    `  签名数：${s.signatures}`,
    `  调用边数：${s.callEdges}`,
    `  解析器类型：${result.parser}`,
    wrote ? `  输出文件：${outRel}` : '  输出文件：（--check 未写入）',
  ].join('\n');
}

function computeDiff(existing, result) {
  if (!existing) {
    return { changed: true, reason: '现有骨架不存在（首次生成）', changedEntries: result.entries.map((e) => e.methodId) };
  }
  const norm = (v) => JSON.stringify({
    upstream: sorted(new Set(v.upstream || [])),
    downstream: sorted(new Set(v.downstream || [])),
    related: sorted(new Set(v.related || [])),
  });
  const oldById = new Map((existing.entries || []).map((e) => [e.methodId, e]));
  const changedEntries = [];
  for (const e of result.entries) {
    const o = oldById.get(e.methodId);
    if (!o) { changedEntries.push(e.methodId); continue; }
    const linksChanged = norm(o.suggestedLinks || {}) !== norm(e.suggestedLinks);
    const sigChanged = (o.signatures || []).length !== e.signatures.length;
    const callChanged = (o.calls || []).length !== e.calls.length;
    if (linksChanged || sigChanged || callChanged) changedEntries.push(e.methodId);
  }
  const metaChanged = existing.parser !== result.parser
    || existing.sourceRoot !== result.sourceRoot
    || JSON.stringify(existing.summary || {}) !== JSON.stringify(result.summary);
  return { changed: changedEntries.length > 0 || metaChanged, changedEntries, metaChanged };
}

function makeDiffText(diff, result) {
  const s = result.summary;
  return [
    '[extract-links] --check 差异报告（未写入文件）',
    `  对比结果：${diff.changed ? '有变化' : '无变化'}`,
    diff.reason ? `  原因：${diff.reason}` : null,
    `  元数据/汇总变化：${diff.metaChanged ? '是' : '否'}`,
    `  变化条目数：${diff.changedEntries.length}${diff.changedEntries.length ? '（' + diff.changedEntries.join('、') + '）' : ''}`,
    `  summary：files ${s.files} / matchedMethods ${s.matchedMethods} / signatures ${s.signatures} / callEdges ${s.callEdges}`,
  ].filter(Boolean).join('\n');
}

function readExisting(outAbs) {
  try { return JSON.parse(fs.readFileSync(outAbs, 'utf8')); } catch { return null; }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { process.stdout.write(HELP + '\n'); return; }

  const srcAbs = path.resolve(ROOT, args.src);
  const methodsAbs = path.resolve(ROOT, args.methods);
  const outAbs = path.resolve(ROOT, args.out);
  const outRel = toPosix(path.relative(ROOT, outAbs));

  if (!fs.existsSync(srcAbs) || !fs.statSync(srcAbs).isDirectory()) {
    throw new Error(`源码目录不存在：${srcAbs}`);
  }
  if (!fs.existsSync(methodsAbs)) {
    throw new Error(`methods.json 不存在：${methodsAbs}`);
  }

  const methodsDoc = JSON.parse(fs.readFileSync(methodsAbs, 'utf8'));
  const methods = Array.isArray(methodsDoc) ? methodsDoc : methodsDoc.entries;
  if (!Array.isArray(methods) || methods.length === 0) {
    throw new Error('methods.json 中没有可处理的 entries');
  }

  const files = collectFiles(srcAbs, srcAbs, []).sort((a, b) => a.rel.localeCompare(b.rel));
  const nameToId = buildNameMap(methods);

  // 解析：优先 tree-sitter，整体失败则连同 parser 标记一起回退到内置解析器。
  let parserKind = 'builtin-regex';
  let parsed = null;
  let ts = null;
  try { ts = await detectTreeSitter(); } catch { ts = null; }
  if (ts) {
    try {
      parsed = new Map();
      for (const f of files) {
        parsed.set(f.rel, await parseWithTreeSitter(ts, fs.readFileSync(f.abs, 'utf8')));
      }
      parserKind = 'tree-sitter';
    } catch (err) {
      process.stderr.write(`[extract-links] tree-sitter 解析失败，回退内置解析器：${err.message}\n`);
      parsed = null;
      parserKind = 'builtin-regex';
    }
  }
  if (!parsed) {
    parsed = new Map();
    for (const f of files) parsed.set(f.rel, parseBuiltin(fs.readFileSync(f.abs, 'utf8')));
  }

  // 文件 → MethodEntry 归属，以及条目所在模块（源文件目录）。
  const ownedFiles = new Map();
  const moduleOf = new Map();
  for (const f of files) {
    const owner = ownerFor(f.rel, methods);
    if (!owner) continue;
    if (!ownedFiles.has(owner.id)) ownedFiles.set(owner.id, []);
    ownedFiles.get(owner.id).push({ rel: f.rel, parsed: parsed.get(f.rel) });
    if (!moduleOf.has(owner.id)) moduleOf.set(owner.id, toPosix(path.posix.dirname(f.rel)));
  }

  // 逐条目组装 signatures / calls。calls 只保留能映射到「其它已知条目」的边。
  const entries = methods.map((m) => {
    const owned = ownedFiles.get(m.id) || [];
    const found = owned.length > 0;
    const signatures = [];
    const calls = [];
    for (const f of owned) {
      const pr = f.parsed || { signatures: [], calls: [], imports: [] };
      for (const s of pr.signatures) signatures.push(s);
      for (const c of pr.calls) {
        const id = nameToId.get(c.lookup);
        if (id && id !== m.id) {
          calls.push({ callee: c.callee, line: c.line, resolvedMethodId: id });
        }
      }
    }
    let confidence = 0;
    if (found) {
      const hasSignature = signatures.length > 0;
      confidence = 0.35 + (hasSignature ? 0.4 : 0) + Math.min(calls.length * 0.05, 0.25);
      confidence = Math.min(0.98, Math.round(confidence * 100) / 100);
    }
    return {
      methodId: m.id,
      repoPath: m.repoPath,
      found,
      signatures,
      calls,
      suggestedLinks: { upstream: [], downstream: [], related: [] },
      currentLinks: linksOf(m),
      confidence,
    };
  });

  // suggestedLinks：A 调用 B → A.downstream 含 B、B.upstream 含 A。
  const down = new Map();
  const up = new Map();
  const rel = new Map();
  for (const m of methods) {
    down.set(m.id, new Set());
    up.set(m.id, new Set());
    rel.set(m.id, new Set());
  }
  for (const e of entries) {
    for (const c of e.calls) {
      const b = c.resolvedMethodId;
      if (b === e.methodId || !down.has(b)) continue;
      down.get(e.methodId).add(b);
      up.get(b).add(e.methodId);
    }
  }
  // related：同模块（同一源文件目录）且彼此没有直接调用边的条目对。
  const ownerIds = [...ownedFiles.keys()];
  for (let i = 0; i < ownerIds.length; i += 1) {
    for (let j = i + 1; j < ownerIds.length; j += 1) {
      const a = ownerIds[i];
      const b = ownerIds[j];
      if (moduleOf.get(a) !== moduleOf.get(b)) continue;
      if (down.get(a).has(b) || down.get(b).has(a)) continue;
      rel.get(a).add(b);
      rel.get(b).add(a);
    }
  }
  for (const e of entries) {
    e.suggestedLinks = {
      upstream: sorted(up.get(e.methodId)),
      downstream: sorted(down.get(e.methodId)),
      related: sorted(rel.get(e.methodId)),
    };
  }

  const result = {
    schemaVersion: '1.0',
    generatedAt: new Date().toISOString(),
    tool: TOOL,
    parser: parserKind,
    sourceRoot: toPosix(path.relative(ROOT, srcAbs)) || '.',
    entries,
    summary: {
      files: files.length,
      matchedMethods: entries.filter((e) => e.found).length,
      signatures: entries.reduce((n, e) => n + e.signatures.length, 0),
      callEdges: entries.reduce((n, e) => n + e.calls.length, 0),
    },
  };

  // 输出：--json 时 stdout 保持纯 JSON，中文内容一律走 stderr。
  const diff = args.check ? computeDiff(readExisting(outAbs), result) : null;
  const wrote = !args.check;
  if (wrote) {
    fs.mkdirSync(path.dirname(outAbs), { recursive: true });
    fs.writeFileSync(outAbs, JSON.stringify(result, null, 2) + '\n', 'utf8');
  }
  const summaryText = makeSummaryText(result, outRel, wrote);
  const diffText = diff ? makeDiffText(diff, result) : null;

  if (args.json) {
    const payload = diff ? { ...result, check: diff } : result;
    process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
    process.stderr.write([diffText, summaryText].filter(Boolean).join('\n') + '\n');
  } else {
    process.stdout.write([diffText, summaryText].filter(Boolean).join('\n') + '\n');
  }
}

main().catch((err) => {
  process.stderr.write(`[extract-links] 运行失败：${err && err.stack ? err.stack : err}\n`);
  process.exitCode = 1;
});
