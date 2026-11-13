# IDE 工具链（F14 跳转 + F15 抽取）

本目录是「2.0 工具链」里 IDE 侧的独立新增文件，与 App 主体解耦：

- `vscode-stackmap/`：VS Code 扩展原型（F14，含自身的 `README.md`）
- `README.md`：本文件，说明端到端链路与审核回写流程

F15 的脚本在 `tools/extract-links.mjs`（说明见 `tools/README-2.0-tools.md`），示例源码在 `samples/`，骨架产物在 `content/generated/links.skeleton.json`。

---

## F14：IDE 中方法名 → 深链 → App 按名解析条目 → 显示来源与四问卡片

```
编辑器里的标识符 / 选中文本 / // @stackmap <methodId>
        │  扩展解析出 name（或 methodId）+ relativePath + line
        ▼
  深链（URL 契约，唯一的耦合点）
        │  · 命中 methodMap 或注释标签 → #/entry/<methodId>?ref=...&line=...（App 已有路由）
        │  · 未命中 → #/entry/by-name/<name>?ref=...&line=...（主 Agent 新增路由）
        ▼
  App 按名（或 id）解析条目
        │  by-name 路由在 content/methods.json 的 name / signature 函数名里查条目
        ▼
  详情页
        · 顶部显示「来源：<ref> 第 <line> 行」（文件 + 行号）
        · 渲染四问卡片：是什么 / 为什么用 / 换别的会怎样 / 怎么兜底
        · 链路 Tab 展示 upstream / downstream / related
```

要点：

- **IDE 不持有知识库数据，App 不依赖 VS Code**；两者只通过一条 URL 契约连接。
- `ref` 是源码相对 `stackmap.projectRoot` 的路径（已 `encodeURIComponent`），`line` 是 1 起始行号；它们给 App 提供「我在看哪段代码」的展示性上下文，App 不需要据此再去读源码。
- `name` 需要与 `content/methods.json` 的 `name` 或 `signature` 中的函数名一致，by-name 路由才能按名解析到条目；同名方法（`createOrder` 等）请用 `stackmap.methodMap` 或注释标签消歧。
- 三种跳转入口：CodeLens（声明行 / 标签行）、命令面板（`stackmap.openMethod` / `stackmap.copyDeepLink`）、注释标签。安装与配置项见 `vscode-stackmap/README.md`。

---

## F15：抽取结果如何审核后回写 `content/methods.json` 的 `links`

`tools/extract-links.mjs` 产出的是**骨架**，不是可直接入库的结论：

1. **生成**：`node tools/extract-links.mjs`（默认扫描 `samples/`，写 `content/generated/links.skeleton.json`）；`--check` 只报告与现有骨架的差异、不写文件。
2. **逐条比对**：看每条的 `suggestedLinks`（脚本建议）与 `currentLinks`（`methods.json` 里现有的人工值，脚本原样拷贝、一字不改）。`calls[].callee / line / resolvedMethodId` 是每一条建议边的可追溯依据；`confidence` 只是参考，不是采纳阈值。
3. **人工判断**：
   - 只保留能对应真实调用关系的边；跨层 RPC、MQ 投递、OSS 回调可能只是同名，需结合业务确认。
   - `related` 只是「同目录且无直接调用」的弱信号，通常不直接采纳。
   - `found: false` 说明 `samples/` 里没有该条目 `repoPath` 对应的源码文件（本仓库里多为 `.java / .tf / .xml / .md`），**不要据此删改现有 links**。
   - 同名歧义（如 `createOrder` 同时出现在 BFF 路由与领域服务）结合骨架里的 `repoPath` 与 `stackmap.methodMap` 判断归属。
4. **回写**：由编辑者把确认过的 `upstream / downstream / related` **手工合并**进 `content/methods.json` 对应条目的 `links` 字段，再运行 `npm run build` 重建 `data.js` 快照并跑内容校验。

> **骨架绝不自动覆盖人工内容。** 脚本只写 `content/generated/links.skeleton.json` 这一个生成物，从不修改 `content/methods.json`；`--check` 连骨架都不写。是否采纳、采纳哪几条，始终是人的决定。这样人工维护的链路语义不会被静态解析的误判冲掉。
