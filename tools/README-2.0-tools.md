# 2.0 工具链说明（F14 / F15）

本文件说明 2.0 新增的抽取脚本、示例源码与 VS Code 扩展的用法、参数、输出字段含义及审核流程。全部为零依赖、纯静态项目内的独立新增文件，不改动 App 主体（`app.js / core.js / cards.js / index.html / styles.css` 等）与 `content/` 事实源。

## 文件清单

| 路径 | 作用 |
| --- | --- |
| `tools/extract-links.mjs` | F15 调用关系抽取 CLI，生成 links 骨架 |
| `tools/README-2.0-tools.md` | 本文件 |
| `content/generated/links.skeleton.json` | 运行脚本生成的骨架（生成物，可随时重建） |
| `samples/**` | 示例源码，路径与 `content/methods.json` 的 `.ts` `repoPath` 对齐 |
| `ide/vscode-stackmap/**` | F14 VS Code 扩展原型（含自身 `README.md`） |
| `ide/README.md` | F14 端到端链路 + F15 审核回写流程 |

---

## 一、`tools/extract-links.mjs`（F15）

### 运行

```bash
# 默认：扫描 samples/，读 content/methods.json，写 content/generated/links.skeleton.json
node tools/extract-links.mjs

# 自定义参数
node tools/extract-links.mjs --src <dir> --methods <path> --out <path>

# 只报告差异、不写文件（适合 CI / 审核前对比）
node tools/extract-links.mjs --check

# stdout 输出纯 JSON（中文摘要与差异报告转 stderr，便于管道/程序消费）
node tools/extract-links.mjs --json
node tools/extract-links.mjs --check --json

# 中文帮助
node tools/extract-links.mjs --help
```

所有相对路径都以**仓库根**为基准（与 `tools/build-snapshot.mjs` 的 `ROOT` 一致），与当前工作目录无关。内部只用 `node:fs / node:path / node:url`，不调用任何 shell 命令，可在 Windows Git Bash 下运行。Node 建议 18+（本次使用 22.22.2）。

### 参数

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `--src <dir>` | `samples` | 源码根目录；递归收集 `.js/.jsx/.ts/.tsx/.mjs/.cjs`，忽略 `node_modules` 与隐藏目录 |
| `--methods <path>` | `content/methods.json` | MethodEntry 事实源 |
| `--out <path>` | `content/generated/links.skeleton.json` | 骨架输出路径，父目录自动创建 |
| `--check` | 关 | 与现有骨架对比并输出中文差异报告，**不写文件** |
| `--json` | 关 | stdout 只输出纯 JSON；中文内容一律转 stderr（`--check --json` 时额外带 `check` 字段） |
| `-h / --help` | — | 打印中文帮助 |

### 解析器策略

- 优先用动态 `import()` + `try/catch` 探测 `tree-sitter` / `web-tree-sitter`（及 `tree-sitter-javascript` / `tree-sitter-typescript` grammar）；可用时 `parser: "tree-sitter"`，用 AST 抽取声明与调用。
- 未安装时**静默回退**内置轻量静态解析器，`parser: "builtin-regex"`；回退解析器是真实实现，不是空壳，支持：
  - `function` 声明、`export function`、`async function`、generator
  - 箭头函数、`export const foo = (...) => ...`、单参数箭头
  - class 方法
  - `import ... from '...'` / `import '...'` / `require('...')` 来源
  - `foo(...)` 与 `obj.method(...)` 调用
- 扫描前把注释与字符串内容等长替换成空白（保留换行），避免误把注释/字符串里的名字或括号当成声明与调用，行号因此保持不变。
- tree-sitter 分支整体失败时，会连同 `parser` 标记一起回退到内置解析器，不会留下半份不一致的结果。

### 名字映射

- 键来自 `methods.json` 每个条目的 `signature` 函数名（先建立）与合法标识符形态的 `name`。
- `name` 为路由串（如 `POST /api/orders`、`SETNX dedupe:{key}`）时自动忽略，靠 `signature` 里的函数名补足。
- 同名冲突按 `methods.json` 顺序「先到先得、不覆盖」，结果可复现（例如 `createOrder` 归 `m.bff.createOrder`）。
- 只有能映射到**其它已知条目**的调用才进 `calls` 与 `suggestedLinks`：排除自引用，以及 `fetch / console.log / 内部 helper` 等无法映射的名字。

### 输出 JSON 字段（App 会读，字段名不可改）

```json
{
  "schemaVersion": "1.0",
  "generatedAt": "<ISO datetime>",
  "tool": "extract-links.mjs",
  "parser": "tree-sitter | builtin-regex",
  "sourceRoot": "samples",
  "entries": [
    {
      "methodId": "m.fe.useUploadQueue",
      "repoPath": "apps/web/src/upload/useUploadQueue.ts",
      "found": true,
      "signatures": [ { "name": "useUploadQueue", "signature": "useUploadQueue(opts: UploadQueueOpts)", "line": 15 } ],
      "calls": [ { "callee": "createUploadToken", "line": 21, "resolvedMethodId": "m.bff.createUploadToken" } ],
      "suggestedLinks": { "upstream": [], "downstream": ["m.bff.createUploadToken"], "related": [] },
      "currentLinks": { "upstream": [], "downstream": [], "related": [] },
      "confidence": 0.85
    }
  ],
  "summary": { "files": 5, "matchedMethods": 5, "signatures": 12, "callEdges": 9 }
}
```

| 字段 | 含义 |
| --- | --- |
| `schemaVersion` / `tool` | 固定值 `"1.0"` / `"extract-links.mjs"` |
| `generatedAt` | ISO 时间 |
| `parser` | 实际生效的解析器 |
| `sourceRoot` | 源码根相对仓库根的路径，默认 `"samples"` |
| `entries[]` | 每个 MethodEntry 一条，顺序与 `methods.json` 一致（共 14 条） |
| `entries[].methodId` / `repoPath` | 与事实源一致 |
| `entries[].found` | 是否在源码里找到与 `repoPath` 对应的文件 |
| `entries[].signatures[]` | `{ name, signature, line }`：静态抽到的声明头（名 + 参数）与 1 起始行号 |
| `entries[].calls[]` | `{ callee, line, resolvedMethodId }`：仅保留能映射到已知条目的调用 |
| `entries[].suggestedLinks` | `{ upstream, downstream, related }`：脚本建议值 |
| `entries[].currentLinks` | 事实源 `links` 的现有值（原样拷贝，供 App 展示差异） |
| `entries[].confidence` | 0–1；由是否命中文件、是否抽到声明签名、调用边数量综合给出 |
| `summary` | `{ files, matchedMethods, signatures, callEdges }` |

**suggestedLinks 生成规则**：A 的源码调用 B → `A.downstream` 含 B、`B.upstream` 含 A；同一源文件目录（模块）内且彼此无直接调用边的条目互为 `related`。三类数组都去重、排除自引用、按 id 排序。

**summary 计数口径**：`files` = 扫描到的源码文件数；`matchedMethods` = `found: true` 的条目数；`signatures` = 所有 `entries[].signatures` 之和；`callEdges` = 所有 `entries[].calls` 之和（即映射成功的调用边数）。

脚本末尾打印中文摘要：扫描文件数、命中方法数、签名数、调用边数、解析器类型。

### 本次运行结果

```
扫描文件数：5   命中方法数：5   签名数：12   调用边数：9   解析器类型：builtin-regex
```

`entries` 共 14 条，其中 10 条 `suggestedLinks` 非空，`related` 中有一对（`m.bff.createUploadToken` ↔ `m.bff.createOrder`）。`parser` 为 `builtin-regex`，因为项目零依赖、未安装 tree-sitter。

---

## 二、`samples/` 示例源码

5 个 JS/TS 文件（每个 15–40 行，中文注释，无第三方依赖），路径与 `content/methods.json` 中 5 个 `.ts` `repoPath` **完全一致**：

| 文件 | 对应条目 |
| --- | --- |
| `samples/apps/web/src/upload/useUploadQueue.ts` | `m.fe.useUploadQueue` |
| `samples/apps/web/src/upload/uploadFileToOSS.ts` | `m.fe.uploadFile` |
| `samples/apps/bff/src/routes/upload-token.ts` | `m.bff.createUploadToken` |
| `samples/apps/web/src/order/submitOrder.ts` | `m.fe.submitOrder` |
| `samples/apps/bff/src/routes/orders.ts` | `m.bff.createOrder` |

其余 9 个条目的 `repoPath` 是 `.java / .tf / .xml / .md`，不建 JS/TS 源码。示例模拟「文件上传 + 下单幂等」链路：前端 → BFF → 后端 / 数据 / 消息层的方法名以调用形式出现在源码里，用于让抽取脚本建立跨层边。少数 `import` 指向跨语言占位路径（后端服务），静态工具只记录来源字符串、不校验目标文件是否存在。

---

## 三、`ide/vscode-stackmap/` VS Code 扩展（F14）

详见 `ide/vscode-stackmap/README.md`。要点：

- 命令：`stackmap.openMethod`（`vscode.env.openExternal` 打开）、`stackmap.copyDeepLink`（写剪贴板）；另有 CodeLensProvider 与 `// @stackmap <methodId>` 注释标签。
- 配置：`stackmap.baseUrl`（默认 `http://localhost:5173`）、`stackmap.methodMap`（默认 `{}`）、`stackmap.projectRoot`。
- 忽略 `node_modules` 与无标识符情况，并给出中文错误/提示。
- **未命中 methodMap 时 by-name 深链严格为**：

  ```
  ${baseUrl}/#/entry/by-name/${encodeURIComponent(name)}?ref=${encodeURIComponent(relativePath)}&line=${line}
  ```

  命中 methodMap 或注释标签时用 App 已有的 `#/entry/<methodId>?ref=...&line=...`。

---

## 四、审核与回写流程（重要）

1. 运行 `node tools/extract-links.mjs` 生成 / 更新骨架；改动源码后可先跑 `--check` 看差异。
2. 逐条比对 `suggestedLinks`（建议）与 `currentLinks`（人工现值）；`calls` 提供可追溯依据，`confidence` 仅作参考。
3. 人工判断：跨层 RPC / MQ / 回调可能只是同名，`related` 是弱信号，`found: false` 不代表要删现有 links，同名歧义结合 `repoPath` 与 `methodMap` 判断。
4. 由编辑者把确认过的 `upstream / downstream / related` **手工合并**进 `content/methods.json` 的 `links` 字段，再 `npm run build` 重建快照并跑校验。
5. **骨架不自动覆盖人工内容**：脚本只写 `content/generated/links.skeleton.json`，从不修改 `content/methods.json`；`--check` 连骨架都不写。是否采纳、采纳哪几条，始终是人的决定。
