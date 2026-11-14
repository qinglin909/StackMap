# 更新日志

本项目遵循语义化版本；所有 `[vX.Y.Z]` 均在 Git 中有对应标签。

---

## [v3.1.0] — 2026-11-14 · 导入通用 API 方法库（304 条）

### 新增：第三个项目「通用 API 方法库」

- **内容导入**：`content/projects/apicards/` 新增 304 条四问方法卡片（由 `dev-api-index.json` 经 LLM 批量生成，`validateEntry` 全量通过：结论含条件、兜底跨 2–3 层且三要素齐全、id 唯一 0 冲突），覆盖 Vue / LangChain / JavaScript / Java / Python / SQL / Redis / 后端通用 / Git 九大科目、58 个二级分类。已注册进 `content/projects.json`（projectId `apicards`），顶栏可切换。
- 属 AI 草稿：卡片带「待核实」标注，App 的人工审核门禁（`#/drafts`）照常生效；来源路径为 `content/methods/ai-draft-*.md` 虚拟路径。

### 修正

- **跨项目同名概念口径**：从「所有项目交集」改为「≥2 个项目并集」。此前加入第三个项目后交集归零，云枢↔星链的 5 组同名概念会从项目空间与对比页消失；修正后多项目场景下共享概念稳定可见（当前 5 组）。
- 冒烟测试断言升级为 3 项目口径（全量 331 条目、方法库 304 条数据域切换、对比矩阵 3 列）。

---

## [v3.0.0] — 2026-11-14 · 第三期完成

### 新增：F18 多项目复用与跨项目对比

- **内容层多项目化**：新增 `content/projects.json` 注册表，每个项目用 `contentBase` 指向独立的 `methods/chains/incidents/troubleshooting` 四类 JSON。新增第二个示例项目「星链 · 支付清算平台」（12 条目 / 2 链路 / 2 事故 / 3 排查流，五层齐全），与云枢共享 5 个同名概念。
- `core.js` 升级为按项目聚合加载，`KB.methods()/chains()/incidents()/flows()` 默认按当前项目过滤，`KB.allMethods()` / `KB.byId()` 保持全量解析（跨项目深链不断）；同义词与场景示例跨项目合并。
- 顶栏新增项目切换器，切换即重置筛选与临时状态并刷新全局数据域；`data.js` 离线快照同步打包 `projects / defaultProjectId / reviews`。
- 新增 `#/projects` 项目空间：项目卡片、五层覆盖度、10 维度对比矩阵、独有 / 共享方法、备份提醒、CI 命令清单；新增 `#/compare` 跨项目对比：13 字段并排、差异高亮、只看差异、导出 Markdown。
- 构建脚本新增：项目注册校验、id 全局唯一、projectId 归属、同名概念统计；无注册表时自动退回 1.0/2.0 单项目布局。

### 新增：F19 PR 变更影响自动提醒

- `tools/pr-impact.mjs`：git diff → 按 `repoPath` 精确/后缀/前缀匹配 → 波及链路、下游节点、关联事故与排查流 → 中文 PR 复核检查单 + 结构化 JSON；**内容漂移检测**（源码改了但 `content/` 未同步）；git 不可用或无命中优雅降级。
- `.github/workflows/stackmap.yml`：`pull_request` / 手动触发 → `npm run verify` → 影响清单写入 job summary 与带 `<!-- stackmap-impact -->` 标记的 PR comment（已存在则更新）；漂移时发 notice；fork PR 只写 summary。仅用两个官方 action 与内置 `GITHUB_TOKEN`。
- App 侧新增同结构的本地检查单导出（`KB.prChecklistMarkdown`）与项目空间的 CI 命令清单，人工分析与 CI 报告可互相印证。

### 新增：F20 团队评论与评审条目

- `content/reviews.json` 数据契约（4 条示例，覆盖 4 种状态与两类 kind）+ `#/reviews` 评审工作台：筛选、检查单勾选、状态流转、评论时间线、通过 / 要求修改表决（同步更新状态）、按方法反查、导出 Markdown。
- 新建 / 评论 / 表决 / 删除 / 检查单均按角色门控，写入 localStorage 覆盖层并标记待回写；条目详情页新增「评审」入口。
- 构建校验评审数据：projectId / methodId / status / kind / comments / verdict / checklist / relatedIncidentIds 全部校验。

### 修复与性能

- **只读脱敏旁路**：新增 `KB.maskPath()` 统一处理显示、复制按钮、IDE 深链 `ref`、搜索索引与来源条；`KB.deepLink` 增加防御性脱敏；修复只读用户可复制完整内部路径的问题（新增回归断言）。
- **200 节点链路**：`cards.js` 在 >60 节点时自动启用轻量渲染（缩小节点、收紧行距、省略关系标签与次要文字）；新增 `tools/chain-bench.html` 用无头 Chrome 实测 8/60/120/200 节点，200 节点 **13.7ms / 1023 DOM 元素 / 86.5KB HTML**（阈值 1000ms）。
- **数据定期备份**：7 天周期到期提醒（首页 + 项目空间），导出全量 JSON 后自动记录时间；内容管理页的单项目备份也纳入计时。

### 工程

- 新增 `v3.js`（逻辑）/ `views3.js`（页面），沿用 2.0 的事件总线委托模式；`README.md` 全面更新，`package.json` 升到 3.0.0 并新增 `impact` / `impact:self-test` 脚本。
- `smoke-test.mjs`：页面渲染 25 → **32 个**，新增多项目切换、跨项目对比、评审校验与表决、只读脱敏无旁路、200 节点轻量渲染、备份提醒等断言。

---

## [v2.0.0] — 2026-11-13 · 第二期完成

### 新增：二期 F9–F17 全部能力

- **F11 场景反查升级为向量语义检索**：中英混合分词（中文 bigram / trigram + 英文词）→ TF-IDF 稀疏向量 → 余弦相似度，字段权重与同义词扩展叠加；可配置 pgvector 检索服务，失败自动回退本地并在页面说明原因。场景页显示检索模式与相关度百分比。
- **F12 事故录入**：新增事故复盘列表 / 详情 / 结构化录入表单（现象、根因、逐层缺失兜底、关联方法、改进）、删除与 Markdown 导出。本地录入事故与卡 8 共用 `item/expected` 字段契约，录入后立刻可在踩坑复盘卡看到。
- **F13 AI 起草四问草稿**：可配置 OpenAI 兼容 LLM；未配置或调用失败时回退本地启发式起草器，生成的每个不确定字段都标注「待人工核实」。新增强制审核门禁：必须勾选「已人工核实」、保存审核意见、通过验收校验后才能批准入库，并记录审核人与时间；草稿可导出 Markdown 供 PR 评审。
- **F14 IDE / 注释跳转**：新增 `ide/vscode-stackmap` VS Code 扩展原型（CodeLens、命令面板、`// @stackmap <id>` 标签、深链复制），App 侧新增 `#/entry/by-name/<name>?ref=&line=` 路由、来源条与「复制固定 id / 按名深链」按钮。
- **F15 自动抽取调用关系**：新增 `tools/extract-links.mjs`（tree-sitter 可用时优先，否则内置轻量静态解析器）、`samples/` 演示源码与 `content/generated/links.skeleton.json` 生成物；构建脚本打包骨架并校验引用完整性；内容管理页与变更影响页展示差异并支持逐条采纳（骨架绝不自动覆盖人工 links）。
- **F16 学习进度 / 打卡 / 周报**：按天去重记录学习事件，连续天数、等级、分层覆盖度、活动时间线，Markdown 周报预览与导出。
- **F17 / F9 / F10 / F12 卡片**：沿用并补全入口，事故与决策 / 排查向导结果联动。

### 新增：三期能力提前实现

- **F19 变更影响分析**：聚合 links、链路 edges 的下游可达节点、跨链路共享节点、关联事故 / 排查流 / 已收藏预案，生成 PR 复核检查单并导出 Markdown；同页对照 F15 骨架差异。

### 新增页面

`#/incidents`、`#/incident/<id>`、`#/drafts`、`#/progress`、`#/impact?id=<methodId>`，以及 IDE 深链 `#/entry/by-name/<name>`。侧栏按「浏览 / 学习 / 管理」分组接入。

### 架构与工程

- 新增 `v2.js`（逻辑层，覆盖 `KB.sceneSearch` / `KB.incidents`）与 `views2.js`（页面层，通过事件总线委托），1.0 的 `core.js` / `cards.js` 核心结构保持不动。
- `index.html` 加载顺序调整为 `data → core → v2 → cards → views2 → app`；品牌统一为 **StackMap**（中文副名「栈析」）。
- `tools/build-snapshot.mjs`：打包 links 骨架、校验骨架 methodId / 建议引用 / 自引用。
- `tools/smoke-test.mjs`：页面渲染从 17 增至 25 个，新增向量检索、事故录入与卡 8 契约、草稿审核门禁、IDE 深链、骨架采纳、打卡周报、变更影响等断言。
- `package.json` 升级到 2.0.0，新增 `extract:links` / `verify` 脚本。
- 新增 `CHANGELOG.md`、`tools/README-2.0-tools.md`、`ide/README.md`。

### 修复

- 事故「缺失兜底」字段统一为仓库既有的 `item / expected`，修复本地录入事故在卡 8 不显示内容的问题。
- 链路 SVG 随容器自适应宽度（1.0 后期修复，避免右侧节点被裁切）。

---

## [v1.0.0] — 2026-11-13 · 最小闭环基线

- **MVP F1–F8**：条目 CRUD 与分层浏览、卡片 1/2/3/5/7、四问详情页 + 链路 Tab、全局搜索（层 + 标签组合）、收藏与我的预案、仓库同源与同步状态、链路可视化、三角色权限门控。
- 提前实现卡片 4（决策向导）、卡 6（故障排查向导）、卡 8（踩坑复盘）、场景反查近似（同义词加权）、Markdown / PDF 预案导出。
- 内容事实源 `content/*.json` + Markdown 样例、JSON Schema、`data.js` 离线快照、零依赖本地服务、`build-snapshot` 与 `smoke-test` 校验链。
- 验收标准（结论含条件、兜底按层三要素、链路引用完整、决策树 / 排查流可达）全部以可运行代码校验，失败时构建非零退出。

---

## 已知边界

仍无后端服务：收藏 / 编辑 / 事故 / 草稿 / 进度 / 评审 / 角色均为浏览器本地状态，F20 是「仓库同源 + 导出回写」而非多人实时协同；pgvector 与 LLM 为可选接入；Tree-sitter 为可选依赖且仅覆盖常见 JS/TS；VS Code 扩展仍是原型；CI 只生成检查单、不自动回写 `content/`。详见 `README.md`。
