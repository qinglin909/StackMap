# 内容仓库（Source of Truth）

App 只做渲染与索引，**条目的事实源在这个目录**。前端不持有任何长期内容副本：`data.js` 是由 `tools/build-snapshot.mjs` 从本目录生成的离线快照，仅供直接双击 `index.html`（file://）时兜底使用。以 HTTP 方式运行时，App 会直接读取本目录的 JSON，这才是"同源"模式。

```
content/
  methods.json            全部 MethodEntry（结构化主格式）
  chains.json             Chain 链路
  incidents.json          Incident 事故复盘
  troubleshooting.json    故障排查流 + 场景反查同义词表（二期可替换为 pgvector）
  methods/*.md            人工撰写的 Markdown 条目（导入草稿用）
  README.md               本文件
schema/method-entry.schema.json   JSON Schema（字段约束）
tools/build-snapshot.mjs          从本目录生成 data.js + 校验
```

## 同步约定

- 每个条目带 `repoPath`，指向真实源码文件；`updatedAt` 是文档最后更新时间，`lastCodeChangeAt` 是源码最后变更时间。
- `updatedAt < repoUpdatedAt` → 列表显示 **待同步**（代码改了，文档没跟）。
- `今天 - lastCodeChangeAt > 30 天` 且文档未更新 → 显示 **可能过期** 提醒。
- 内容管理页可以上传/粘贴 JSON 或 Markdown 导入；导入的条目标记为 **本地导入**，需由编辑者回写本目录后再执行 `node tools/build-snapshot.mjs`。
- 校验失败（结论无条件、兜底缺三要素、链路引用悬空）在内容管理页与 `build-snapshot` 中都会报错，不允许静默入库。

## Markdown 撰写格式

`---` 之间是 front matter，字段：`id / name / signature / layer / stack / module / tags / repoPath`。
`layer` 取值：`frontend | bff | backend | data | infra`。

正文按 `##` 分段，解析器按下列规则映射：

| 段落 | 映射字段 |
| --- | --- |
| `## 定位` | `summary` |
| `## 是什么` + `### 参数 / 返回 / 副作用 / 调用方` | `what.*` |
| `## 为什么用` + `### 场景 / 解决的问题 / 前提条件 / 本层理由 / 反例` | `why.*` |
| `## 替代方案` | 每行 `名称 \| 优点(；分隔) \| 缺点 \| 何时选 \| 迁移成本 \| 影响层(逗号分隔)`，紧跟的围栏代码块作为 `codeSnippet` |
| `## 对比结论` | `comparisonConclusion`，**必须含条件句**（当…时…；若…则…） |
| `## 兜底` | 每行 `层 \| 故障模式 \| 策略 \| 监控项`，紧跟的围栏代码块作为 `codeSnippet` |
| `## 踩坑` | `pitfalls[]` |
| `## 示例` + `### 场景名` | `examples[]`（围栏代码 + 后续说明行） |
| `## 检查单` | 保留为 `pitfalls` 附带的检查项备注 |

`## 兜底` 必须覆盖多行、按层分组，每行四列齐全且带代码块，否则校验不通过（对应验收标准"每层至少含策略、代码模板、监控项三要素"）。

参考样例：`methods/m.demo.retryWithBackoff.md`、`methods/m.demo.outboxRelay.md`。

## 新增卡片类型

卡片字段由 `schema/method-entry.schema.json` 约束，卡片渲染器按类型注册（见 `app.js` 的 `CARDS`）。新增卡片不需要改数据表，只需在条目里加可选字段 + 注册一个渲染函数。
