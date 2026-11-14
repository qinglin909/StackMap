# StackMap 3.0 内容层说明 · 多项目、同名对比与团队评审

本文只描述 `content/` 下的事实源约定。App 负责渲染与索引，不持有长期内容副本；`data.js` 是
`tools/build-snapshot.mjs` 生成的离线快照，仅供直接双击 `index.html`（file://）时兜底。
三期在「单项目」基础上引入第二个项目与团队评审数据，核心约定是：**项目注册与事实源分离、
已有项目文件不动、评审只记录不改内容**。

## 1. 多项目目录约定

`content/projects.json` 是项目注册表，顶层字段 `schemaVersion` / `defaultProjectId` / `projects`。
每个项目的 `contentBase` 指向该项目四类事实源所在的目录，是相对仓库根的路径：

```
content/
  projects.json                     项目注册表（defaultProjectId / projects[]）
  reviews.json                      团队评审 / 讨论数据（F20）
  methods.json                      云枢(yunshu) 的 MethodEntry       ← contentBase: "content"
  chains.json                       云枢的链路                          ← 同上，四个文件保持不动
  incidents.json                    云枢的事故复盘                      ← 同上
  troubleshooting.json              云枢的排查流 / 同义词 / 场景示例      ← 同上
  projects/
    xinglian/
      methods.json                  星链(xinglian) 的 MethodEntry       ← contentBase: "content/projects/xinglian"
      chains.json                   星链的链路
      incidents.json                星链的事故复盘
      troubleshooting.json          星链的排查流 / 同义词 / 场景示例
  README.md                         内容仓库通用说明（1.0/2.0）
  README-3.0.md                    本文件
schema/method-entry.schema.json    MethodEntry 字段约束
```

要点：

- **云枢的事实源仍是 `content/` 根目录的四个 JSON**，`contentBase` 直接写 `content`，四个文件在三期不做任何改动。
- **新增项目的内容放独立子目录**，不往 `content/` 根目录再塞第二套文件，避免两套事实源互相覆盖。
- 四个文件在**任意项目目录下文件名与顶层 key 完全一致**，App 按固定 key 读取，不按项目定制解析：

| 文件 | 顶层 key | 说明 |
| --- | --- | --- |
| `methods.json` | `schemaVersion` / `project` / `entries` | 新增项目额外带 `projectId` |
| `chains.json` | `chains` | 每条链路带 `projectId` |
| `incidents.json` | `incidents` | 每起事故带 `projectId`；`missingFallbacks` 用 `layer` / `item` / `expected` 三字段 |
| `troubleshooting.json` | `flows` / `sceneSynonyms` / `sceneExamples` | 每条 flow 带 `projectId` |

- `projects.json` 里 `contentBase` 指向的目录必须能被解析出上述四个文件；注册前先确认四个文件都存在且可 `JSON.parse`。
- 新增项目内容同样要过 `tools/build-snapshot.mjs` 的验收规则：结论含条件句双正则、替代方案必带
  `whenToUse` / `migrationCost`、兜底按层且四要素齐全、`links` / 链路 / 事故 / 排查流引用完整且无自引用。
  `.md` 草稿与生成的 `links.skeleton.json` 仍只属于 `content/` 根层，不随项目复制。

## 2. 新增一个项目的步骤

1. **建目录**：在 `content/projects/<projectId>/` 下建子目录，例如 `content/projects/xinglian/`。
2. **写四个 JSON**：复制四类文件的结构与顶层 key，写入该项目内容。
   - `methods.json` 顶层补 `project`，每个 `entries[]` 补 `projectId`；
   - `id` 使用项目自有前缀（如 `xl.`），保证全局不与其他项目冲突；
   - `links.upstream/downstream/related`、`chains` 的 `nodes/edges/entryMethodId`、
     `incidents.relatedMethodIds`、排查流的 `resultMethodId` **只引用本项目 `methods.json` 内的 id**，不跨项目引用；
   - `updatedAt` / `repoUpdatedAt` / `lastCodeChangeAt` 沿用通用同步语义（见 `content/README.md`）：
     `updatedAt < repoUpdatedAt` 显示「待同步」，`lastCodeChangeAt` 距今过久且文档未更新显示「可能过期」。
3. **注册**：在 `content/projects.json` 的 `projects[]` 追加一项，填 `id` / `name` / `short` /
   `description` / `stack` / `contentBase` / `color` / `status` / `owner` / `updatedAt`，
   其中 `contentBase` 必须指向第 1 步的目录。`defaultProjectId` 保持不变（默认仍进云枢）。
4. **构建**：执行 `npm run build`（即 `node tools/build-snapshot.mjs`）重新生成离线快照并跑校验；
   需要时再跑 `npm run test` / `npm run verify` 做冒烟与漂移检查。
5. **评审数据**（可选）：在 `content/reviews.json` 追加 thread，`methodId` 指向已存在项目内的真实条目。

> 新增项目**不修改** `content/methods.json`、`content/chains.json`、`content/incidents.json`、
> `content/troubleshooting.json`、`tools/build-snapshot.mjs`、`tools/smoke-test.mjs`、
> `core.js`、`app.js`、`README.md`、`package.json`。

## 3. projectId 传递规则

`projectId` 是内容归属的唯一标识，从注册表一路透传到每条内容，不允许在中间层推断或改写：

```
projects.json  projects[].id
      │
      ├─ projects[].contentBase  ──► App 按当前项目 id 选目录，读取该目录下四个固定文件名
      │
      ├─ methods.json  每个 entries[].projectId          = 该 id
      ├─ chains.json    每个 chains[].projectId            = 该 id
      ├─ incidents.json 每个 incidents[].projectId         = 该 id
      ├─ troubleshooting.json 每个 flows[].projectId      = 该 id
      └─ reviews.json  每个 threads[].projectId          = 该 id（评审挂到哪个项目）
```

- 切换项目时，App 用 `projectId` 找到 `contentBase`，只加载该目录的四类 JSON；
  `links` / 链路 / 排查流等引用都在**项目内闭合**，跨项目不做 id 引用，避免删除一个项目导致另一项目出现悬空引用。
- `reviews.json` 的 `threads[].methodId` 必须存在于 `threads[].projectId` 所对应项目的 `methods.json`；
  `relatedIncidentIds` 必须存在于对应项目（或留空数组）。
- `defaultProjectId` 只决定首次进入的默认项目，不参与内容过滤。

## 4. 同名方法跨项目对比的口径

跨项目「四问对比」按 **`name` 完全相同**来配对，不是按 `id`（各项目 id 前缀不同），也不是按 `layer`。
例如云枢的 `withIdempotency` / `createOrder` / `submitOrder` / `publishOrderCreated` / `configureRetryDLQ`
与星链的同名条目会各成一组。对比视图重点呈现这几个字段的差异：

| 对比项 | 口径 |
| --- | --- |
| `stack` | 技术栈不同即视为实质差异（React/Java/Node vs Vue3/Go/gRPC） |
| `why.layerReason` | 同一能力放在该层的理由，应体现各自业务上下文（订单附件 vs 支付清算） |
| `alternatives` | 替代方案与迁移成本按各自项目重写，不能只换项目名 |
| `fallback` | 分层兜底按各自故障模式写，前端/BFF/后端/数据/基础设施都要有自己的策略与监控项 |
| `comparisonConclusion` | 必须含「什么条件下选哪个」的条件句，且两边条件不能雷同 |

约定：**同名不等于同实现**。同名是为了让通用能力可横向比较；若两个项目某能力语义相同但名字不同
（如 `verifyUploadCallback` 与 `verifyChannelCallback`），默认不会自动配对，需要在评审记录里显式说明关联。
新增同名条目时务必让上述五个字段与另一项目版本明显不同，否则对比视图没有信息量。

## 5. reviews.json 字段与状态流

`content/reviews.json` 顶层固定为 `schemaVersion` / `threads`。每条 thread 字段：

| 字段 | 含义 |
| --- | --- |
| `id` | 评审线程 id，如 `rv.001` |
| `projectId` | 评审挂靠的项目 id |
| `methodId` | 被评审的方法条目 id，必须真实存在于 `projectId` 对应项目 |
| `title` | 评审标题 |
| `kind` | `review`（评审）或 `discussion`（讨论） |
| `status` | `open` → `in_review` → `approved` / `changes_requested` |
| `author` / `createdAt` / `updatedAt` | 发起人、创建与更新时间 |
| `comments[]` | 每条含 `id` / `author` / `at` / `body` / `verdict`，`verdict` 取 `comment` / `approve` / `request_changes` |
| `checklist[]` | 检查项 `{ item, done }`，如「四问字段齐全」「兜底覆盖前端/后端/数据」 |
| `relatedIncidentIds` | 关联的真实事故 id 数组，可为空数组 |
| `relatedDraftId` | 关联草稿 id，无则空字符串 |

状态流：`open`（刚提出）→ `in_review`（讨论 / 复核中）→ 结论态 `approved`（通过）或
`changes_requested`（打回修改）。出现 `request_changes` 的评论时通常对应 `changes_requested`。
`kind` 只区分是正式评审还是开放讨论，不改变状态机。

评审内容聚焦三类具体问题：**条件化结论是否成立**（结论有没有「当…则…」）、
**兜底是否缺层**（前端 / BFF / 后端 / 数据 / 基础设施是否覆盖且带策略、代码、监控）、
**链路是否需要同步**（改一个被多链路 / 多项目同名引用的节点时，下游字段是否跟着改）。

## 6. 边界：App 不自动改 content

- 评审记录（`reviews.json`）是**团队讨论与结论的事实源**，App 只做展示、筛选与导出。
- 内容管理页 / 评审页里产生的编辑、导入、评审结论，都以**导出 JSON** 的形式交给编辑者；
  由编辑者人工回写 `content/` 下对应的文件，再执行 `npm run build` 让快照与校验同步。
- **App 不会自动写入 `content/` 下任何 JSON**，包括 `reviews.json`、`methods.json` 与四类项目内容文件；
  这与 `tools/pr-impact.mjs` 只产出「PR 复核建议」而不改事实源的边界一致。
- 因此 `data.js` / 本地导入 / 评审结论都只是**渲染期或导出期产物**；要成为事实源，必须经「人工回写 + 重新构建」这一步。
- 校验失败（结论无条件句、兜底缺三要素、引用悬空、missingFallbacks 字段写成 `note/strategy` 等）
  在 `build-snapshot` 与内容管理页都会报错，不允许静默入库。
