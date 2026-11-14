# StackMap 3.0 工具说明 · F19 PR 变更影响自动提醒

F19 解决的是「源码改了、知识库没跟着改」的过期问题：一次 PR 动了哪些源码文件，
自动映射到知识库里的方法条目，列出波及的链路、下游节点、事故、排查流，并生成
一份人工复核检查单，随 PR 一起送到 reviewer 面前。

## 1. 端到端链路

```
① 研发提 PR（改了 apps/web/src/upload/useUploadQueue.ts 等源码）
        ↓  on: pull_request（paths 覆盖源码 / content / tools / schema / package.json）
② CI 跑 tools/pr-impact.mjs --base origin/<base> --head HEAD --out impact.md
        ↓  脚本递归扫描 content/ 下四类 JSON，把改动文件映射到方法条目
③ 生成 Markdown 检查单 + 结构化 JSON
        ↓
④ CI 把 impact.md 追加到 $GITHUB_STEP_SUMMARY
   并用 gh CLI 创建/更新一条带 <!-- stackmap-impact --> 标记的 PR comment
   若检测到「内容漂移」，额外加一条 ::notice:: 提示
        ↓
⑤ 人工按「PR 复核检查单」逐项复核（条目 / 兜底 / 替代方案 / 下游 / 事故预案 / npm run verify）
        ↓
⑥ 若条目已过期，在同一个 PR 里回写 content/ 下的 JSON，重新跑 CI 直到不再漂移
```

**关键点**：脚本只产出「建议」，不代替人做判断，也不自动改 `content/`。
「随 PR 更新」是靠「漂移提醒 + 人工回写」这条闭环实现的，不是脚本直接写事实源。

## 2. 交付的三个文件

| 文件 | 作用 |
| --- | --- |
| `tools/pr-impact.mjs` | 零依赖 Node ESM CLI，产出 Markdown 检查单与严格字段的 JSON |
| `.github/workflows/stackmap.yml` | CI 工作流：verify → 生成报告 → job summary / PR comment |
| `tools/README-3.0-tools.md` | 本文档 |

## 3. 全部参数

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `--base <ref>` | `HEAD~1` | git diff 起点，CI 里传 `origin/<base_ref>` |
| `--head <ref>` | `HEAD` | git diff 终点 |
| `--files <a,b,c>` | — | 直接给定改动文件列表（逗号分隔）。**给了就不执行 git diff**，用于本地自测 / 无 git 环境 |
| `--out <path>` | — | 把 Markdown 写入文件，父目录不存在会自动 `mkdir -p`；不传则 Markdown 输出到 stdout |
| `--json` | 关闭 | stdout 输出纯 JSON；可与 `--out` 共存（Markdown 写文件、JSON 打 stdout） |
| `--content <dir>` | `content` | 内容目录，相对仓库根解析；也接受绝对路径 |
| `--self-test` | 关闭 | 用内置的一组改动路径跑完整流程，**不依赖 git** |
| `-h, --help` | 关闭 | 显示帮助 |

输出模式对照：

| 组合 | stdout | 文件 | stderr |
| --- | --- | --- | --- |
| 无参数 | 完整 Markdown（首段即中文摘要） | — | 一行中文摘要 |
| `--out x.md` | 中文摘要 | `x.md` = Markdown | 写入提示 + 中文摘要 |
| `--json` | 纯 JSON | — | 中文摘要（保证 stdout 是纯 JSON） |
| `--json --out x.md` | 纯 JSON | `x.md` = Markdown | 写入提示 + 中文摘要 |

中文摘要内容：改动文件数、命中方法数、波及链路数、是否检测到漂移。
git 不可用或 ref 无效时，打印中文提示并优雅降级为「未命中」检查单，不抛异常。

## 4. JSON 字段含义

顶层字段名**严格固定**（主 Agent 的 App 会读取，请勿增删）：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `schemaVersion` | string | 固定 `"1.0"` |
| `generatedAt` | string | 生成时间，ISO 8601 |
| `base` / `head` | string | 本次对比的 ref |
| `changedFiles` | string[] | 归一化后的改动文件列表（去重，`/` 分隔） |
| `hits` | object[] | 命中的方法条目，见下表 |
| `drift` | object | `{ detected, methodIds }`，见第 6 节 |
| `reviewers` | string[] | 按命中方法的 `layer` 去重汇总（顺序固定为 frontend / bff / backend / data / infra） |
| `markdown` | string | 完整 Markdown 报告（与 `--out` 写出的内容一致） |

`hits[]` 每项字段名同样严格固定：

| 字段 | 含义 |
| --- | --- |
| `methodId` / `name` | 条目 id 与名称 |
| `repoPath` | 条目登记的源码路径 |
| `layer` | 层（frontend / bff / backend / data / infra） |
| `projectId` | 项目 id；entry 无该字段时从路径 `content/projects/<id>/` 推断，否则为 `yunshu` |
| `matchType` | `exact` / `suffix` / `prefix`，见第 5 节 |
| `matchedFile` | 触发该命中的改动文件 |
| `chains` | `chains[].nodes` 含该 id 的链路 id 列表 |
| `downstream` | 链路中该节点之后的所有节点 + `links.downstream`，去重 |
| `incidents` | `relatedMethodIds` 含该 id 的事故 id 列表 |
| `flows` | `resultMethodId` 命中、或 steps 文本中提及该 id 的排查流 id 列表 |
| `fallbackLayers` | `fallback` 层数，用于提示「兜底方案需复核」 |
| `alternatives` | `alternatives` 个数，用于提示「替代方案需复核」 |

无命中时同样输出完整结构：`hits: []`、`drift.detected: false`、检查单仍含通用项、
`reviewers: []`，`markdown` 依然是完整可读报告。

## 5. 路径匹配规则

对每个「改动文件 × 方法条目」按以下优先级判定，命中即记录 `matchType`：

1. `exact` — 改动路径与 `repoPath` 精确相等。
2. `suffix` — 改动路径以 `repoPath` 结尾，**或** `repoPath` 以改动路径结尾。
   比较时统一用 `/` 分段并以 `'/'+整串` 做边界，避免 `useUploadQueue.ts` 被子串误命中
   （例如 monorepo 前缀路径、或只写了尾部若干段的路径都能命中）。
3. `prefix` — 两者**目录部分**的公共前缀 ≥ 2 段（比较时去掉文件名）。
   用于「同目录新增文件 / 目录级改动」也能提醒到相关条目。

降噪策略：

- 每个改动文件只保留它达到的**最高优先级**匹配，避免 `prefix` 顺带把同目录方法全带出来。
- 多个改动文件命中同一方法时，按方法去重并保留优先级最高的那条（含 `matchedFile`）。
- 路径统一：`\` 转 `/`、去掉 `./` 前缀、`path` / `fileURLToPath` 处理，Windows Git Bash 可运行。

## 6. 内容漂移检测

判定公式：

```
drift.detected = (hits.length > 0) 且 (changedFiles 中没有任何 content/ 下的文件)
```

- 命中方法却没动 `content/` → `detected: true`，`methodIds` 列出所有应更新的条目 id；
  Markdown 里出现醒目的「⚠ 源码已改但知识库条目未同步」段落，并逐条列出
  `methodId` + `repoPath`；CI 额外加一条 `::notice::`。
- 同一 PR 里已经带了 `content/**` 文件 → `detected: false`，不提示（内容文件与源码同 PR 更新）。
- 无命中 → `detected: false`，`methodIds: []`。

`--content` 指向自定义目录时，判定前缀会同时采用该目录相对仓库根的路径与 `content`。

## 7. 内容扫描与多项目

脚本**不硬读** `content/methods.json`，而是用 `fs` 递归扫描 `--content` 目录下所有名为
`methods.json` / `chains.json` / `incidents.json` / `troubleshooting.json` 的文件：

- 跳过 `node_modules` 与隐藏目录（`.` 开头）；无关文件按文件名自然忽略。
- 同名文件取并集、按 `id` 去重（先出现者优先），兼容 `{ entries: [...] }`、直接数组等写法。
- 单个 JSON 解析失败只跳过并打印中文提示，不影响整体。
- 面向多项目：自动兼容 `content/projects.json` 注册表与
  `content/projects/<id>/methods.json` 等子目录；entry 无 `projectId` 时
  优先从路径 `projects/<id>/` 推断，再兜底为 `yunshu`。

## 8. CI 工作流

`.github/workflows/stackmap.yml`：

- 触发：`on: pull_request`（paths 覆盖 `content/**`、`samples/**`、`*.js`、`*.css`、
  `*.html`、`tools/**`、`schema/**`、`package.json`）+ `workflow_dispatch` 手动重跑。
- job `impact`：`ubuntu-latest`，`permissions: contents: read, pull-requests: write`。
- `actions/checkout@v4` 带 **`fetch-depth: 0`**（必须，否则 `origin/<base_ref>` 取不到）。
- `actions/setup-node@v4` 使用 Node 22 → `npm run verify` → 生成 `impact.md` → 追加到
  `$GITHUB_STEP_SUMMARY`。
- PR comment：用 runner 自带 `gh` CLI + `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`，
  先 `gh api repos/{owner}/{repo}/issues/<num>/comments` 按标记
  `<!-- stackmap-impact -->` 查找已有评论，命中则 `PATCH` 更新，否则 `POST` 新建；
  因此每个 PR 只有一条会被反复更新的评论。
- **fork PR 保护**：仅当
  `github.event.pull_request.head.repo.full_name == github.repository` 时发 comment；
  fork PR 的 `GITHUB_TOKEN` 没有写评论权限，此时只写 job summary 并打印说明，避免 job 失败。
- 漂移时额外输出 `::notice::` 并往 summary 追加一行醒目提示。

权限与 secrets：只需要平台内置的 `secrets.GITHUB_TOKEN`（无需额外配置），
配合 `pull-requests: write` 即可写评论；`contents: read` 用于 checkout。
`workflow_dispatch` 无 PR 上下文，会自动跳过发 comment 的步骤，仍生成 summary。

## 9. 本地自测命令

在仓库根执行（Windows 可把 `node` 换成绝对路径
`C:/Users/123/.workbuddy/binaries/node/versions/22.22.2-6/node.exe`）：

```bash
# 内置自测：不依赖 git，覆盖 exact / suffix / prefix 三种匹配并演示漂移提醒
node tools/pr-impact.mjs --self-test

# 自测同时看 JSON 结构
node tools/pr-impact.mjs --self-test --json

# 直接给改动文件（无 git 环境 / 本地验证单文件命中）
node tools/pr-impact.mjs --files "apps/web/src/upload/useUploadQueue.ts" --json

# 模拟「源码 + content 同 PR 更新」，此时 drift.detected 应为 false
node tools/pr-impact.mjs --files "apps/web/src/upload/useUploadQueue.ts,content/methods.json" --json

# 写文件 + JSON 同时输出
node tools/pr-impact.mjs --self-test --out tmp/impact.md --json

# 语法检查
node --check tools/pr-impact.mjs
```

## 10. 边界（务必遵守）

- 脚本**只生成建议**：产出 Markdown / JSON，不写、不改、不删 `content/` 下任何事实源，
  不自动更新 `methods.json`，也不做 git commit。
- `content/` 的更新由人在同一个 PR 里按检查单复核后手动回写；CI 只负责提醒。
- 零第三方依赖：仅用 `node:fs` / `node:path` / `node:url` / `node:child_process`，
  不调用 shell 管道或 `rm`，不装包。
- 本目录三个文件是 F19 的独立新增，不改动 App 主文件（app.js / core.js / cards.js /
  v2.js / views2.js / v3.js / views3.js / index.html / styles.css 等）与既有工具脚本。
