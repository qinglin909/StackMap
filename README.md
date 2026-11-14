# StackMap · 全栈方法知识库与决策辅助 App

> **当前版本 v3.0.0**（`v1.0.0` 最小闭环 → `v2.0.0` 二期 → `v3.0.0` 三期，均有 Git 标签）

面向研发团队的项目知识库：以「方法 / 接口 / 组件」为最小单元，用卡片讲清**是什么、为什么用、换别的会怎样、怎么兜底**，并支持沿调用链查看上下游影响。内容与代码仓库同源，随 PR 更新。

零依赖、纯静态实现（HTML + CSS + 原生 JS）。**3.0 起内容按项目分目录存放**，事实源是 `content/projects.json` 注册的各项目 JSON；`data.js` 只是 `file://` 打开时的离线快照。

---

## 快速启动

```bash
# 方式一：仓库同源模式（推荐）
node serve.mjs          # 或 npm start
# 打开 http://localhost:5173

# 方式二：直接双击 index.html
# file:// 下浏览器禁止 fetch 本地文件，App 自动回退到 data.js 离线快照
```

> 两种模式只差「数据源」：HTTP 模式按项目注册表直读 `content/**/*.json`；file:// 模式读构建产物 `data.js`。离线快照不是第二份事实源。

```bash
npm run build          # 聚合所有项目 → data.js，并跑全量验收校验（失败非零退出）
npm test               # 无浏览器冒烟测试：32 个页面 / 8 类卡片 / 3.0 能力断言
npm run extract:links  # 从 samples/ 抽取签名与调用关系，生成 links 骨架
npm run impact         # 从 git diff 生成 PR 变更影响检查单（impact.md）
npm run impact:self-test  # 不依赖 git 的脚本自测
npm run verify         # 一键：构建 + 冒烟 + 抽取自检
```

**链路性能基准**：用无头 Chrome 打开 `http://localhost:5173/tools/chain-bench.html`，页面会实测 8 / 60 / 120 / 200 节点的生成、挂载、布局耗时，`document.title` 输出 `BENCH {…}`。

---

## 版本历史

| 标签 | 内容 |
| --- | --- |
| `v1.0.0` | MVP F1–F8（四问 + 链路 + 仓库同源），附带卡片 4/6/8、场景反查近似、决策与排查向导、导出 |
| `v2.0.0` | F9–F17 全部补齐，提前实现 F19；新增 `v2.js` / `views2.js`、抽取工具、VS Code 扩展原型、4 个新页面 |
| `v3.0.0` | **三期 F18 / F19 / F20 完成**：多项目复用与跨项目对比、PR 变更影响自动提醒（CI）、团队评论与评审；另修复只读脱敏旁路、200 节点链路渲染、数据定期备份提醒 |

详见 [CHANGELOG.md](CHANGELOG.md)。

---

## 目录结构

```
index.html           应用外壳（侧栏、顶栏项目切换器、图标精灵）
styles.css           浅/深色主题、字号缩放、卡片/表格/链路图/2.0/3.0 页面、打印样式
core.js              核心：多项目仓库加载、按项目过滤的数据访问、校验、导入、路由、收藏、导出
v2.js                2.0 逻辑：向量检索 / 事故 / 草稿 / 进度 / 影响 / 深链 / 骨架消费
v3.js                3.0 逻辑：项目注册与切换 / 跨项目对比 / 团队评审 / 备份提醒 / PR 检查单
cards.js             8 类卡片、决策向导、故障排查向导、链路 SVG（>60 节点自动轻量渲染）
views2.js            2.0 页面：事故复盘 / AI 草稿审核 / 学习进度 / 变更影响分析
views3.js            3.0 页面：项目空间 / 跨项目对比 / 团队评审
app.js               页面视图、事件总线（委托 views2 / views3）、CRUD 编辑器、启动
data.js              【生成物】离线快照，勿手改
serve.mjs            零依赖本地静态服务
content/             ★ 内容事实源
  projects.json          项目注册表（id / name / contentBase / color / owner）
  reviews.json           团队评审与讨论记录（F20）
  methods.json 等四类     yunshu 项目（1.0 起的事实源，保持不动）
  projects/xinglian/      xinglian 项目的四类 JSON（3.0 新增）
  generated/links.skeleton.json  【生成物】F15 自动抽取的 links 骨架
  methods/*.md            Markdown 撰写样例（可导入）
  README.md / README-3.0.md  撰写格式、多项目与评审数据约定
schema/method-entry.schema.json   JSON Schema 字段约束
samples/             F15 演示源码（5 个 TS 文件，repoPath 与条目一致）
ide/                 F14 VS Code 扩展原型与端到端说明
.github/workflows/stackmap.yml   F19 PR 自动提醒工作流
tools/
  build-snapshot.mjs      聚合多项目 → data.js + 全量验收校验
  smoke-test.mjs          无浏览器冒烟测试（32 页面 + 1.0/2.0/3.0 断言）
  pr-impact.mjs           git diff → repoPath → 影响清单 Markdown/JSON
  extract-links.mjs       F15 签名与调用关系抽取（可选 tree-sitter）
  chain-bench.html        200 节点链路渲染基准
  README-2.0-tools.md / README-3.0-tools.md  工具链参数与审核流程
```

示例含两个项目：**云枢 · 订单与附件平台**（14 条目 / 2 链路 / 2 事故 / 3 排查流）与 **星链 · 支付清算平台**（12 条目 / 2 链路 / 2 事故 / 3 排查流），均跨 `frontend / bff / backend / data / infra` 五层，共享 5 个同名概念，另有 4 条团队评审记录。

---

## 页面与流程

| 路由 | 页面 | 主要内容 |
| --- | --- | --- |
| `#/home` | 首页 | 当前项目按层浏览、全局搜索、层 + 标签组合筛选、最近更新、同步状态、到期备份提醒 |
| `#/entry/<id>?tab=...` | 条目详情页 | 四问 Tab + 链路 Tab + 示例 + 踩坑；复制 IDE 深链、标记已掌握、**跳该方法的评审** |
| `#/entry/by-name/<name>?ref=...&line=...` | IDE 深链落地 | 按方法名解析条目，显示「来自 IDE」来源条与源码行号（只读时路径脱敏） |
| `#/cards` / `#/cards/<id>?i=n` | 卡片学习 | 8 卡推荐路径，卡片间互相跳转 |
| `#/chains` / `#/chain/<id>?at=<methodId>` | 链路视图 | 分列 SVG 调用链、缩放/拖拽、节点跳速览卡、「你在这」 |
| `#/scene` | 场景反查 | 自然语言场景 → 向量语义检索 → 跨层聚合相关方法 |
| `#/troubleshoot` | 故障排查 | 现象 → 逐级定位 → 命中方法 → 兜底建议 |
| `#/favorites` | 我的预案 | 收藏的分层兜底策略、导出 Markdown / PDF |
| `#/incidents` / `#/incident/<id>` | 事故复盘 | 事故列表与详情、缺失兜底逐层打叉、录入 / 删除 / 导出 |
| `#/drafts` | AI 草稿审核 | 生成四问草稿 → 逐字段人工核实 → 批准入库 → 导出 Markdown |
| `#/progress` | 学习进度 | 打卡、连续天数、分层覆盖度、活动时间线、周报导出 |
| `#/impact?id=<methodId>` | 变更影响分析 | PR 复核清单、受影响链路、共享节点、links 骨架差异 |
| `#/projects` | **项目空间（3.0）** | 项目卡片与覆盖度、切换数据域、项目对比矩阵、同名概念、CI 说明、全量备份 |
| `#/compare?c=<name>` | **跨项目对比（3.0）** | 同名方法逐字段并排（13 字段）、差异高亮、只看差异、导出对比 Markdown |
| `#/reviews?id=<id>` | **团队评审（3.0）** | 评审/讨论列表、检查单勾选、状态流转、评论时间线、通过/要求修改表决、导出 |
| `#/admin` | 内容管理 | 同步状态、过期提醒、验收校验、导入、CRUD、骨架差异、备份、权限 |

**顶栏项目切换器**会切换全局数据域：首页、搜索、链路、卡片、场景反查、事故、评审都跟随；`KB.byId` 与按名深链仍在全量里解析，跨项目跳转不会断。

---

## 8 类卡片

| # | 卡片 | 回答 | 关键交互 |
| --- | --- | --- | --- |
| 1 | 方法速览 | 是什么 | 3D 翻面（参数 / 返回 / 副作用 / 调用方），跳卡 2 / 3 / 5 |
| 2 | 为什么用 | 为什么用 | 场景 → 问题 → 解法三段式、反例、展开前提条件，跳卡 3 / 4 |
| 3 | 替代方案对比 | 换别的会怎样 | 六列表格、逐方案展开代码、**结论必须带条件**（校验不通过会红标） |
| 4 | 决策向导 | 换别的会怎样·交互版 | 2–4 题问卷 → 规则匹配 → 带理由的推荐方案，跳卡 5 |
| 5 | 分层兜底 | 怎么兜底 | **按 layer 分组**，每行含策略 / 代码模板 / 监控项，展开全部，「加入我的预案」 |
| 6 | 故障排查 | 怎么兜底·反向 | 现象 → 逐级定位线索 → 命中方法 → 兜底建议 → 链路卡 / 复盘卡 |
| 7 | 链路 | 上下游关系 | SVG 分列图、节点点击开速览卡、缩放拖拽、「你在这」；>60 节点自动轻量渲染 |
| 8 | 踩坑复盘 | 综合 | 事故 → 根因 → 缺失兜底逐层打叉 → 改进 → 跳对应方法（含本地录入事故） |

新增卡片不需改核心表：JSON 里加可选字段，再在 `cards.js` 的 `C.META` 注册渲染函数。

---

## 功能清单对照

### MVP（1.0 完成）

| 编号 | 功能 | 实现 |
| --- | --- | --- |
| F1 | 条目 CRUD 与分层浏览 | 按 5 层筛选；内容管理页完整 JSON 编辑器（本地覆盖层） |
| F2 | 卡片 1/2/3/5/7 | 已实现，卡片 4/6/8 一并提前完成 |
| F3 | 四问详情页 + 链路 Tab | 7 个 Tab，链路 Tab 含 upstream/downstream/related 与内嵌链路图 |
| F4 | 全局搜索 | 名 / 签名 / 标签 / 技术栈 / 模块 / 源码路径 / 踩坑，层 + 标签组合 |
| F5 | 收藏与「我的预案」 | localStorage 收藏，按方法 + 层分组，导出 Markdown / 打印 PDF |
| F6 | 内容与仓库同源 | HTTP 直读各项目 JSON；Markdown / JSON 导入；「待同步」与过期提醒 |
| F7 | 链路可视化 | SVG 按层分列、贝塞尔连线、节点点击开速览卡、缩放拖拽、返回恢复滚动位置 |
| F8 | 权限 | 只读 / 编辑者 / 管理员；写操作按角色门控；**只读模式路径全链路脱敏** |

### 二期（2.0 完成）

| 编号 | 功能 | 实现 |
| --- | --- | --- |
| F9 | 决策向导卡 | 条目配置 `decisionTree`，所有 END 路径有推荐方案（逐路径校验） |
| F10 | 故障排查向导 | 6 条排查流（两项目合计），步骤可达性自动校验 |
| F11 | 场景反查（语义检索） | 中英混合分词 → TF-IDF → 余弦相似度 + 同义词扩展；可配 pgvector，失败自动回退 |
| F12 | 事故复盘卡与录入 | 卡 8 + 独立事故页 + 结构化录入 + 删除 / 导出；字段契约 `item/expected` |
| F13 | AI 起草四问草稿 | 可接 OpenAI 兼容 LLM，默认本地启发式；**强制人工审核门禁** + 审核人记录 |
| F14 | IDE / 注释跳转 | VS Code 扩展原型（CodeLens / 命令 / `// @stackmap`） + by-name 深链路由与来源条 |
| F15 | Tree-sitter 自动抽取 | 可选 tree-sitter，默认内置静态解析器；links 骨架差异展示与逐条采纳（不自动覆盖） |
| F16 | 学习进度、打卡、周报 | 按天去重事件、连续天数、分层覆盖度、时间线、Markdown 周报 |
| F17 | 导出预案 Markdown/PDF | 保留层、策略、代码模板、监控项四要素 |

### 三期（3.0 完成）

| 编号 | 功能 | 3.0 实现 |
| --- | --- | --- |
| **F18** | 多项目复用与跨项目对比 | `content/projects.json` 注册表 + 各项目独立四类 JSON；顶栏切换数据域；项目空间对比矩阵（10 个维度）、五层覆盖度、独有/共享方法；同名概念 13 字段逐项并排、差异高亮、导出 Markdown |
| **F19** | 变更影响分析 + **自动提醒** | 2.0 的人工检查单保留；3.0 新增 `tools/pr-impact.mjs` 与 `.github/workflows/stackmap.yml`：PR 触发 → git diff 按 repoPath 映射条目 → 波及链路 / 下游节点 / 事故 / 排查流 → 写入 job summary 与带标记的 PR comment；**内容漂移**（源码改了但 content/ 未动）额外 notice |
| **F20** | 团队评论、评审条目 | `content/reviews.json` + 评审工作台：讨论/评审两类、四种状态流转、检查单逐项勾选、评论时间线与通过/要求修改表决、按方法反查、导出 Markdown 回写仓库；条目详情页直达 |

> 三期实现方式沿用产品「内容与仓库同源」的定位：评审记录导出后由编辑者回写仓库，**App 不自动改写 `content/`**；多人实时协作仍需真实后端（见边界）。

### 顺带补齐的非功能缺口（3.0）

- **只读脱敏旁路修复**：`KB.maskPath()` 统一处理显示、复制按钮、IDE 深链 `ref`、搜索索引与来源条；只读用户无法再从任何出口拿到完整内部路径。
- **200 节点链路流畅**：>60 节点自动切轻量渲染（缩小节点、收紧行距、省略关系标签与次要文字）；`tools/chain-bench.html` 实测 **200 节点 13.7ms / 1023 DOM 元素 / 86.5KB HTML**（8 节点 19ms 基线，阈值 1000ms）。
- **数据定期备份**：首页与项目空间按 7 天周期提示到期，导出全量 JSON（含项目、条目、链路、事故、评审、骨架）后自动记录时间。

---

## 3.0 使用说明

### 新增一个项目

1. 在 `content/projects/<id>/` 下建 `methods.json` / `chains.json` / `incidents.json` / `troubleshooting.json`，文件名与顶层 key 与现有项目一致，条目带 `projectId`。
2. 在 `content/projects.json` 的 `projects` 数组注册 `id / name / short / contentBase / color / owner`。
3. `npm run build` 会聚合全部项目并校验：id 全局唯一、projectId 已注册、结论含条件、兜底按层三要素、链路/事故/排查流/评审引用完整。
4. 两个项目使用**相同方法名**即自动成为「同名概念」，出现在项目空间与跨项目对比页。

没有 `projects.json` 时自动退回 1.0/2.0 单项目布局，旧仓库可直接升级。

### 团队评审

「团队评审」→「发起评审」→ 选方法与类型 → 逐项勾检查单 → 在讨论区发表意见或点「通过 / 要求修改」（表决同步状态）→「导出评审记录」→ 编辑者整理进 `content/reviews.json` → `npm run build`。只读用户可查看但不可写。条目详情页的「评审」按钮可按方法反查。

### PR 自动提醒

`.github/workflows/stackmap.yml` 在 `pull_request`（含 `content/**`、`samples/**`、根目录 js/css/html、`tools/**` 等）与手动触发时运行：

```bash
node tools/pr-impact.mjs --base origin/<base> --head HEAD --out impact.md
```

本地等价：`npm run impact`（或 `npm run impact:self-test`）。脚本扫描 `content/**` 下所有项目的四类 JSON，按「精确 → 后缀 → 目录前缀」匹配 `repoPath`，输出 JSON 契约（`hits[] / drift / reviewers / markdown`）与中文检查单；git 不可用或无命中时优雅降级。**只生成建议，不改 `content/`**。fork PR 只写 job summary，不尝试发评论。

参数与字段详见 `tools/README-3.0-tools.md`；多项目与评审数据约定见 `content/README-3.0.md`。

---

## 验收标准逐条对照

| 验收项 | 实现与校验位置 |
| --- | --- |
| 任一条目完整展示四问 + 链路，卡片间互跳 | 详情页 7 Tab；每张卡底部跳转按钮；`smoke-test` 逐卡渲染 |
| 对比卡结论必须含「什么条件下选哪个」 | `KB.validateEntry` + `build-snapshot` 双条件正则；失败非零退出 |
| 兜底卡按层分组，每层含策略 / 代码模板 / 监控项 | `C.fallbackGroup` 按层分组；校验逐行检查 4 字段且 ≥2 层 |
| 链路卡节点点击到达速览卡，返回不丢上下文 | `data-action="node"` → Modal；顶栏「返回」恢复路由与滚动位置 |
| 条目与仓库不一致时有「待同步」 | `KB.syncStatus`；首页卡片与内容管理页标记（当前 6 条待同步） |
| 搜索支持按层筛选与标签组合 | 首页层 chip（多选）+ 标签 chip（AND）+ 关键词 |
| 收藏预案可导出且格式完整 | `KB.favoritesMarkdown()`；冒烟测试断言四要素 |
| **2.0**：AI 草稿未经审核不得入库 | `KB.approveDraft` 门禁 + 冒烟断言「未审核拒绝 / 已审核放行」 |
| **2.0**：本地录入事故能进卡 8 | 字段统一 `item/expected` + 渲染断言 |
| **2.0**：links 骨架引用完整且可采纳 | 构建校验 + 冒烟断言采纳后 links 更新 |
| **3.0**：多项目数据域切换与引用完整 | 冒烟断言 2 项目 / 26 仓库条目 / 切换后 14↔12 / id 唯一 |
| **3.0**：跨项目对比有差异且可导出 | 冒烟断言 ≥4 组同名概念、≥10 字段、diffCount > 0、Markdown 含标题 |
| **3.0**：评审校验、表决、状态流转 | 冒烟断言非法评审拦截 / 保存 / 两种表决 / 删除 / 导出 |
| **3.0**：只读脱敏无旁路 | 冒烟断言复制路径、深链、详情页 HTML 均不含完整 repoPath |
| **3.0**：200 节点触发轻量渲染 | 冒烟断言 + Chrome 实测基准（13.7ms） |

---

## 数据模型与同步约定

`MethodEntry` 字段见 `schema/method-entry.schema.json`，3.0 起每条带 `projectId`（缺省由构建脚本按项目补齐）。`Chain` / `Incident` / 排查流 / 评审记录分别独立存放，也都带 `projectId`。

- `content/projects.json` 是项目唯一注册表；`contentBase` 指向该项目的四类 JSON。
- `updatedAt < repoUpdatedAt` → **待同步**；距 `lastCodeChangeAt` 超 120 天 → **可能过期**。
- 导入 / 编辑 / 事故 / 草稿批准 / 骨架采纳 / 评审写入都先进浏览器 localStorage 覆盖层并标记待回写；编辑者回写仓库并跑 `npm run build` 后状态恢复。
- 项目选择、角色、收藏、进度、草稿、评审、备份时间存 localStorage；**API Key 不持久化**。
- 只读分享时路径统一遮罩，代码块、深链与导出内容同样受限。

---

## 边界与限制

- **仍无后端服务**：收藏 / 编辑 / 事故 / 草稿 / 进度 / 评审 / 角色都是浏览器本地状态，跨设备不同步；角色切换是权限门控演示，不是真实鉴权。F20 的「团队协作」是**仓库同源 + 导出回写**模式，不是多人实时协同 —— 要实时共享仍需接真实后端与账号体系。
- **pgvector / LLM 是可选接入**：默认本地 TF-IDF 与启发式起草，未接真实 embedding / 模型服务。
- **Tree-sitter 是可选依赖**：未安装时由内置静态解析器兜底，目前仅覆盖常见 JS/TS 语法（不支持 Java/Go/Python）。
- **VS Code 扩展是原型**：未打包发布，跳转是打开浏览器而非 IDE 内嵌，无 JetBrains 支持。
- **CI 只生成检查单**：不自动回写 `content/`，不含合并阻断；fork PR 只写 job summary。
- **强游戏化的学习推送 / 排行榜未做**（需求中 F16 定位为弱游戏化）。

---

## 可访问性与维护

- 代码块一键复制；侧栏 A− / A＋ 调整字号；浅色 / 深色主题切换；卡片键盘可操作；`/` 聚焦搜索，`Esc` 关闭弹窗。
- 打印样式单独定义，导出 PDF 时自动隐藏导航与按钮。
- 修改任何 `content/**/*.json` 后务必 `npm run build`；校验不通过会非零退出并阻止生成快照。
- 架构约定：新增 2.0 能力放 `v2.js` / `views2.js`，3.0 放 `v3.js` / `views3.js`，`core.js` 只承担跨版本的数据与路由基座。脚本加载顺序：`data → core → v2 → v3 → cards → views2 → views3 → app`。
