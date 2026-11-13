// F14 · 栈析/StackMap IDE 跳转原型（CommonJS，零第三方依赖）
// 从光标处的标识符、选中文本或 // @stackmap <methodId> 注释标签解析目标，
// 生成深链并交给 App：支持 CodeLens、命令面板、注释标签三种入口。

const vscode = require('vscode');
const path = require('path');

const IDENT = /[A-Za-z_$][A-Za-z0-9_$]*/g;
const TAG_RE = /@stackmap\s+([a-z0-9][a-z0-9.-]*)/i;
const CONTROL_WORDS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'class',
  'constructor', 'new', 'typeof', 'await', 'async', 'export', 'import',
]);

const SELECTOR = [
  { scheme: 'file', language: 'javascript' },
  { scheme: 'file', language: 'typescript' },
  { scheme: 'file', language: 'javascriptreact' },
  { scheme: 'file', language: 'typescriptreact' },
];

function getConfig() {
  const c = vscode.workspace.getConfiguration('stackmap');
  const methodMap = c.get('methodMap');
  return {
    baseUrl: String(c.get('baseUrl') || 'http://localhost:5173').replace(/\/+$/, ''),
    methodMap: methodMap && typeof methodMap === 'object' ? methodMap : {},
    projectRoot: String(c.get('projectRoot') || ''),
  };
}

// 计算深链里的 relativePath：优先用配置的 projectRoot，否则用工作区根。
function relativePathOf(doc, cfg) {
  const ws = vscode.workspace.getWorkspaceFolder(doc.uri);
  let root = cfg.projectRoot;
  if (!root) root = ws ? ws.uri.fsPath : path.dirname(doc.uri.fsPath);
  if (!path.isAbsolute(root)) {
    root = ws ? path.join(ws.uri.fsPath, root) : path.resolve(root);
  }
  return path.relative(root, doc.uri.fsPath).split(path.sep).join('/');
}

function isIgnored(doc) {
  const p = doc.uri.fsPath.split(path.sep).join('/');
  return doc.uri.scheme !== 'file' || /(^|\/)node_modules(\/|$)/.test(p);
}

// 严格按约定拼深链：
//   命中 methodId（配置 map 或 @stackmap 标签）→ #/entry/<id>?ref=...&line=...
//   未命中 → #/entry/by-name/<name>?ref=...&line=...（与主 Agent 约定的 by-name 路由）
function buildDeepLink(t) {
  const ref = encodeURIComponent(t.relativePath);
  const line = Number.isFinite(t.line) ? t.line : 1;
  if (t.methodId) {
    return `${t.baseUrl}/#/entry/${encodeURIComponent(t.methodId)}?ref=${ref}&line=${line}`;
  }
  return `${t.baseUrl}/#/entry/by-name/${encodeURIComponent(t.name)}?ref=${ref}&line=${line}`;
}

function tagOnLine(text) {
  const m = text.match(TAG_RE);
  return m ? m[1] : null;
}

// 从光标/选区解析方法名：优先选中文本里的最后一个标识符，其次光标处单词。
function nameFromEditor(editor) {
  const doc = editor.document;
  const sel = editor.selection;
  if (!sel.isEmpty) {
    const ids = doc.getText(sel).match(IDENT);
    if (ids && ids.length) return { name: ids[ids.length - 1], line: sel.start.line + 1 };
  }
  const range = doc.getWordRangeAtPosition(sel.active, /[A-Za-z_$][A-Za-z0-9_$]*/);
  if (range) {
    const name = doc.getText(range);
    if (name && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) return { name, line: sel.start.line + 1 };
  }
  return null;
}

// 光标附近（上下各 2 行）的 // @stackmap <methodId> 标签优先于按名解析。
function tagFromEditor(editor) {
  const doc = editor.document;
  const cur = editor.selection.start.line;
  const start = Math.max(0, cur - 2);
  const end = Math.min(doc.lineCount - 1, cur + 2);
  for (let i = start; i <= end; i += 1) {
    const id = tagOnLine(doc.lineAt(i).text);
    if (id) return { methodId: id, line: i + 1 };
  }
  return null;
}

function targetFromEditor() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('栈析：请先打开一个源码文件，并把光标放到方法名上或选中方法名');
    return null;
  }
  if (isIgnored(editor.document)) {
    vscode.window.showWarningMessage('栈析：已忽略 node_modules / 非本地文件');
    return null;
  }
  const cfg = getConfig();
  const relativePath = relativePathOf(editor.document, cfg);

  const tag = tagFromEditor(editor);
  if (tag) {
    return { ...cfg, methodId: tag.methodId, name: tag.methodId, line: tag.line, relativePath };
  }

  const found = nameFromEditor(editor);
  if (!found) {
    vscode.window.showWarningMessage('栈析：光标处没有可识别的标识符；可选中方法名，或加一行 // @stackmap <methodId> 标注');
    return null;
  }
  const mapped = cfg.methodMap[found.name];
  return {
    ...cfg,
    name: found.name,
    methodId: typeof mapped === 'string' && mapped ? mapped : null,
    line: found.line,
    relativePath,
  };
}

// 用于 CodeLens：识别函数声明、箭头函数、class 方法。
function declarationName(text) {
  const patterns = [
    /(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s+([A-Za-z_$][\w$]*)\s*\(/,
    /(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/,
    /^\s*(?:(?:public|private|protected|static|readonly|async)\s+)*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m && !CONTROL_WORDS.has(m[1])) return m[1];
  }
  return null;
}

class StackmapCodeLensProvider {
  provideCodeLenses(document) {
    if (isIgnored(document)) return [];
    const cfg = getConfig();
    const relativePath = relativePathOf(document, cfg);
    const lenses = [];
    for (let i = 0; i < document.lineCount; i += 1) {
      const text = document.lineAt(i).text;
      const line = i + 1;
      let target = null;

      const tag = tagOnLine(text);
      if (tag) {
        target = { ...cfg, methodId: tag, name: tag, line, relativePath };
      } else {
        const name = declarationName(text);
        if (name) {
          const mapped = cfg.methodMap[name];
          target = {
            ...cfg,
            name,
            methodId: typeof mapped === 'string' && mapped ? mapped : null,
            line,
            relativePath,
          };
        }
      }
      if (!target) continue;

      const range = new vscode.Range(i, 0, i, 0);
      lenses.push(new vscode.CodeLens(range, {
        title: `栈析：打开 ${target.methodId || target.name}`,
        command: 'stackmap.openMethod',
        arguments: [target],
      }));
      lenses.push(new vscode.CodeLens(range, {
        title: '栈析：复制深链',
        command: 'stackmap.copyDeepLink',
        arguments: [target],
      }));
    }
    return lenses;
  }
}

function activate(context) {
  const openCmd = vscode.commands.registerCommand('stackmap.openMethod', async (payload) => {
    try {
      const target = payload && typeof payload === 'object' ? payload : targetFromEditor();
      if (!target) return;
      await vscode.env.openExternal(vscode.Uri.parse(buildDeepLink(target)));
    } catch (err) {
      vscode.window.showErrorMessage(`栈析：打开深链失败：${err && err.message ? err.message : String(err)}`);
    }
  });

  const copyCmd = vscode.commands.registerCommand('stackmap.copyDeepLink', async (payload) => {
    try {
      const target = payload && typeof payload === 'object' ? payload : targetFromEditor();
      if (!target) return;
      await vscode.env.clipboard.writeText(buildDeepLink(target));
      vscode.window.showInformationMessage('栈析：方法深链已复制到剪贴板');
    } catch (err) {
      vscode.window.showErrorMessage(`栈析：复制深链失败：${err && err.message ? err.message : String(err)}`);
    }
  });

  const lens = vscode.languages.registerCodeLensProvider(SELECTOR, new StackmapCodeLensProvider());
  context.subscriptions.push(openCmd, copyCmd, lens);
}

function deactivate() {}

module.exports = { activate, deactivate };
