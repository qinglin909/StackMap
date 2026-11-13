# 更新日志

本项目遵循语义化版本；所有 `[vX.Y.Z]` 均在 Git 中有对应标签。

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

无后端服务：收藏 / 编辑 / 事故 / 草稿 / 进度 / 角色均为浏览器本地状态；pgvector 与 LLM 为可选接入；Tree-sitter 为可选依赖；F18 多项目、F20 团队评论未实现。详见 `README.md`。
