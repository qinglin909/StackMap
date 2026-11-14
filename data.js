/* 自动生成，请勿手改。运行：node tools/build-snapshot.mjs
 * 事实源：content/projects.json 注册的各项目 contentBase/*.json ；本文件仅用于 file:// 离线兜底。
 */
window.__REPO_SNAPSHOT__ = {
  "generatedAt": "2026-11-14T01:38:31.274Z",
  "project": "云枢 · 订单与附件平台",
  "projects": [
    {
      "id": "yunshu",
      "name": "云枢 · 订单与附件平台",
      "short": "云枢",
      "description": "订单与附件平台，覆盖文件上传主链路与下单幂等链路。",
      "stack": "React 18 / TypeScript / Node BFF / Java / PostgreSQL / OSS / MQ",
      "contentBase": "content",
      "color": "#4f6bed",
      "status": "active",
      "owner": "平台研发组",
      "updatedAt": "2026-11-14"
    },
    {
      "id": "xinglian",
      "name": "星链 · 支付清算平台",
      "short": "星链",
      "description": "支付清算平台，覆盖支付下单、渠道路由、对账与差错处理。",
      "stack": "Vue 3 / Go / gRPC / Kafka / MySQL / Redis / 渠道网关",
      "contentBase": "content/projects/xinglian",
      "color": "#0e9f8a",
      "status": "active",
      "owner": "支付研发组",
      "updatedAt": "2026-11-14"
    }
  ],
  "defaultProjectId": "yunshu",
  "methods": [
    {
      "id": "m.fe.useUploadQueue",
      "name": "useUploadQueue",
      "signature": "useUploadQueue(opts: { concurrency?: number; retry?: number; onSettled?: (r: UploadResult[]) => void }): UploadQueue",
      "layer": "frontend",
      "stack": "React 18 + TypeScript",
      "module": "文件上传",
      "summary": "把批量附件上传收敛成一个可取消、可重试、可观察的队列 Hook。",
      "what": {
        "params": [
          {
            "name": "opts.concurrency",
            "type": "number",
            "desc": "并发分片数，默认 3"
          },
          {
            "name": "opts.retry",
            "type": "number",
            "desc": "单文件失败重试次数，默认 2"
          },
          {
            "name": "opts.onSettled",
            "type": "callback",
            "desc": "全部结束（成功或最终失败）后触发"
          }
        ],
        "returns": "UploadQueue：{ tasks, add, cancel, retryFailed, progress, status }",
        "sideEffects": [
          "在内存中维护任务状态机",
          "组件卸载时 AbortController.abort()",
          "上报 upload_queue_settle 埋点"
        ],
        "callers": [
          "AttachmentPanel",
          "OrderAttachments"
        ]
      },
      "why": {
        "scenarios": [
          "一次订单需附带 1–20 个附件",
          "弱网环境下用户反复点击重传",
          "上传中途切换路由"
        ],
        "problemsSolved": [
          "避免 N 个并发请求打满浏览器连接池",
          "避免重复上传同一文件造成 OSS 碎片",
          "让失败可定位到具体文件而不是整批失败"
        ],
        "preconditions": [
          "token 接口可用且返回有效期 ≥ 5min",
          "浏览器支持 AbortController",
          "文件已在本地完成 hash 计算"
        ],
        "layerReason": "并发控制与取消属于用户交互生命周期，只有前端能感知路由切换与组件卸载；放到 BFF 会丢失上下文。",
        "counterExample": {
          "title": "不用队列，直接 Promise.all",
          "desc": "20 个文件同时直传，弱网下 6 个连接被浏览器丢弃，用户只看到整体失败；重试时又生成 20 个新 objectKey，产生孤立对象。",
          "code": "await Promise.all(files.map(f => uploadFileToOSS(f))); // 无并发上限 / 无取消 / 无单文件重试"
        }
      },
      "alternatives": [
        {
          "name": "逐个串行上传",
          "layer": "frontend",
          "pros": [
            "实现最简单",
            "不会打满连接池"
          ],
          "cons": [
            "20 个文件耗时线性增长",
            "一个卡住阻塞整批"
          ],
          "whenToUse": "附件数量恒定为 1–2 个的内部工具",
          "migrationCost": "低（1 人日）",
          "affectedLayers": [
            "frontend"
          ],
          "codeSnippet": "for (const f of files) await uploadFileToOSS(f);"
        },
        {
          "name": "浏览器端 Web Worker 队列",
          "layer": "frontend",
          "pros": [
            "hash 计算不阻塞主线程",
            "大文件体验更好"
          ],
          "cons": [
            "增加构建与通信复杂度",
            "调试成本高"
          ],
          "whenToUse": "单文件普遍 > 100MB 且主线程有动画卡顿投诉",
          "migrationCost": "中（3 人日）",
          "affectedLayers": [
            "frontend"
          ],
          "codeSnippet": "const w = new Worker('hash.worker.ts');\nw.postMessage(file);"
        },
        {
          "name": "BFF 侧聚合上传",
          "layer": "bff",
          "pros": [
            "前端逻辑极薄",
            "可做服务端统一限流"
          ],
          "cons": [
            "所有文件流量穿透 BFF，带宽成本上升",
            "失去直传 OSS 的收益"
          ],
          "whenToUse": "强合规要求文件必须过内网网关时",
          "migrationCost": "高（5 人日 + 网关扩容）",
          "affectedLayers": [
            "frontend",
            "bff",
            "infra"
          ],
          "codeSnippet": "POST /api/upload/stream  // multipart → BFF → OSS"
        }
      ],
      "comparisonConclusion": "当附件数量 ≥ 3 且允许直传 OSS 时选当前队列方案；若附件恒定为 1–2 个的内部工具，则改用串行上传以省掉状态机；只有在单文件普遍超过 100MB 且主线程卡顿可复现的条件下，才升级为 Web Worker 队列；若合规要求文件必须过内网网关，则改用 BFF 聚合上传，但需同步评估带宽成本。",
      "fallback": [
        {
          "layer": "frontend",
          "failureMode": "单文件上传失败 / 网络闪断",
          "strategy": "指数退避重试 2 次，仍失败则把任务标记为 failed 并保留本地 File 引用，允许用户手动重试而不重算 hash",
          "codeSnippet": "await retry(fn, { retries: 2, backoff: 'exp', signal });\nmarkFailed(task.id, { keepFileRef: true });",
          "monitoring": "upload_task_failed_total{reason}、重试后成功率"
        },
        {
          "layer": "bff",
          "failureMode": "token 接口超时或 5xx",
          "strategy": "队列整体进入 paused，按 30s 间隔探测 token 服务，恢复后自动 resume，不吞掉用户已选文件",
          "codeSnippet": "queue.pause('TOKEN_UNAVAILABLE');\nawait waitForHealthy('/api/upload/token', { interval: 30_000 });\nqueue.resume();",
          "monitoring": "upload_token_error_rate、队列 paused 时长"
        },
        {
          "layer": "backend",
          "failureMode": "回调丢失导致任务永不 settle",
          "strategy": "前端 90s 未收到终态时主动查询 /api/upload/status?key=，以后端对象存在性为准收敛状态",
          "codeSnippet": "const st = await fetch('/api/upload/status?key=' + key);\nif (st.objectExists) queue.markSucceeded(task.id);",
          "monitoring": "upload_pending_over_90s、主动查询命中率"
        },
        {
          "layer": "data",
          "failureMode": "本地 hash 缓存丢失造成重复上传",
          "strategy": "以 fileHash + size 为幂等键，重传前先查 dedupe 表，命中则直接复用既有 objectKey",
          "codeSnippet": "const existing = await api.lookupByHash(hash, size);\nif (existing) return existing.objectKey;",
          "monitoring": "upload_dedupe_hit_ratio"
        },
        {
          "layer": "infra",
          "failureMode": "OSS 区域不可用",
          "strategy": "切到备用区域 bucket，并在任务上打 region=backup 供事后对账",
          "codeSnippet": "const bucket = health.ossPrimary ? PRIMARY : BACKUP;\nawait put(bucket, key, file);",
          "monitoring": "oss_5xx_rate、跨区域切换次数"
        }
      ],
      "pitfalls": [
        "onSettled 里不要再触发 add，否则微任务循环",
        "组件卸载后 AbortController 已 abort，重试必须换新 signal",
        "fileHash 计算要包含 size，仅有内容 hash 在截断文件上会误判"
      ],
      "tags": [
        "上传",
        "队列",
        "并发控制",
        "断点续传"
      ],
      "repoPath": "apps/web/src/upload/useUploadQueue.ts",
      "links": {
        "upstream": [],
        "downstream": [
          "m.fe.uploadFile",
          "m.bff.createUploadToken"
        ],
        "related": [
          "m.be.verifyUploadCallback"
        ]
      },
      "examples": [
        {
          "scene": "批量附件上传并允许中途取消",
          "code": "const q = useUploadQueue({ concurrency: 3, retry: 2 });\nq.add(files);\n// 路由离开时\nuseEffect(() => () => q.cancel('ROUTE_LEAVE'), []);",
          "explain": "队列把取消语义收敛到一处，避免每个上传任务各自处理卸载。"
        }
      ],
      "decisionTree": {
        "questions": [
          {
            "id": "q1",
            "question": "一次要传的文件通常有几个？",
            "options": [
              {
                "label": "1–2 个",
                "value": "few",
                "next": "q2"
              },
              {
                "label": "3 个以上",
                "value": "many",
                "next": "q2"
              }
            ]
          },
          {
            "id": "q2",
            "question": "是否允许文件直传对象存储（不过业务网关）？",
            "options": [
              {
                "label": "允许",
                "value": "direct",
                "next": "q3"
              },
              {
                "label": "不允许，必须过内网",
                "value": "gateway",
                "next": "END"
              }
            ]
          },
          {
            "id": "q3",
            "question": "单文件普遍超过 100MB 且主线程卡顿吗？",
            "options": [
              {
                "label": "是",
                "value": "huge",
                "next": "END"
              },
              {
                "label": "否",
                "value": "normal",
                "next": "END"
              }
            ]
          }
        ],
        "rules": [
          {
            "when": {
              "q2": "gateway"
            },
            "result": "BFF 侧聚合上传",
            "reason": "合规要求文件必须过内网网关，直传方案不可用；需同步评估网关带宽成本。"
          },
          {
            "when": {
              "q1": "few",
              "q2": "direct"
            },
            "result": "逐个串行上传",
            "reason": "文件量恒定为 1–2 个，队列状态机的收益不足以抵消维护成本。"
          },
          {
            "when": {
              "q1": "many",
              "q2": "direct",
              "q3": "huge"
            },
            "result": "浏览器端 Web Worker 队列",
            "reason": "大文件 hash 会阻塞主线程，需要把计算移出主线程。"
          },
          {
            "when": {
              "q1": "many",
              "q2": "direct",
              "q3": "normal"
            },
            "result": "保留当前 useUploadQueue",
            "reason": "批量 + 直传 + 常规文件大小，正是队列方案的设计区间。"
          }
        ],
        "defaultResult": "保留当前 useUploadQueue",
        "defaultReason": "未命中特殊条件，按默认设计区间处理。"
      },
      "updatedAt": "2026-09-18",
      "repoUpdatedAt": "2026-10-28",
      "lastCodeChangeAt": "2026-10-28",
      "projectId": "yunshu"
    },
    {
      "id": "m.fe.uploadFile",
      "name": "uploadFileToOSS",
      "signature": "uploadFileToOSS(file: File, opts: { token: UploadToken; onProgress?: (p: number) => void }): Promise<UploadResult>",
      "layer": "frontend",
      "stack": "TypeScript",
      "module": "文件上传",
      "summary": "用后端签发的临时凭证把单个文件直传对象存储，业务服务器不承载文件流量。",
      "what": {
        "params": [
          {
            "name": "file",
            "type": "File",
            "desc": "浏览器 File 对象"
          },
          {
            "name": "opts.token",
            "type": "UploadToken",
            "desc": "BFF 签发的预签名凭证，含 key / policy / expireAt"
          }
        ],
        "returns": "Promise<UploadResult>：{ objectKey, etag, size, durationMs }",
        "sideEffects": [
          "向 OSS 发起 PUT 请求",
          "写 progress 事件",
          "触发 upload_single_done 埋点"
        ],
        "callers": [
          "useUploadQueue"
        ]
      },
      "why": {
        "scenarios": [
          "订单附件上传",
          "头像/凭证图片上传"
        ],
        "problemsSolved": [
          "避免文件流量穿透应用服务器",
          "凭证短期有效，前端不持有长期密钥",
          "上传进度可本地计算"
        ],
        "preconditions": [
          "token 未过期且 key 与文件 hash 绑定",
          "CORS 白名单已配置",
          "浏览器支持 XMLHttpRequest.upload 进度事件"
        ],
        "layerReason": "直传发生在浏览器与 OSS 之间，进度与取消只能由前端持有；后端只负责签发凭证。",
        "counterExample": {
          "title": "把文件 POST 给后端再转发",
          "desc": "大文件占用 BFF 连接池与内存，超时后前端无法判断对象是否已落盘，重试产生重复对象。",
          "code": "await fetch('/api/upload', { method: 'POST', body: formData }); // 全链路持有文件字节"
        }
      },
      "alternatives": [
        {
          "name": "分片上传 + 断点续传",
          "layer": "frontend",
          "pros": [
            "弱网成功率显著提升",
            "支持暂停续传"
          ],
          "cons": [
            "需要维护 uploadId 与分片清单",
            "代码量翻倍"
          ],
          "whenToUse": "单文件 > 50MB 或移动端弱网占比 > 15%",
          "migrationCost": "中（4 人日）",
          "affectedLayers": [
            "frontend",
            "backend"
          ],
          "codeSnippet": "const uploadId = await initMultipart(key);\nawait Promise.all(chunks.map(c => putPart(uploadId, c)));"
        },
        {
          "name": "服务端代理上传（BFF 转发）",
          "layer": "bff",
          "pros": [
            "前端无需处理 CORS 与凭证",
            "可做统一病毒扫描"
          ],
          "cons": [
            "带宽与连接数成本翻倍",
            "无法直传收益"
          ],
          "whenToUse": "内网合规或需要上传前内容审查",
          "migrationCost": "高（5 人日 + 容量评估）",
          "affectedLayers": [
            "frontend",
            "bff",
            "infra"
          ],
          "codeSnippet": "POST /api/upload/proxy  // BFF stream → OSS"
        },
        {
          "name": "Base64 塞进业务 JSON",
          "layer": "frontend",
          "pros": [
            "一次请求搞定"
          ],
          "cons": [
            "体积膨胀 33%",
            "网关 body 限制直接打爆"
          ],
          "whenToUse": "仅限 < 64KB 的极小图标",
          "migrationCost": "低（0.5 人日）",
          "affectedLayers": [
            "frontend",
            "bff"
          ],
          "codeSnippet": "body: JSON.stringify({ icon: await toBase64(file) })"
        }
      ],
      "comparisonConclusion": "当文件小于 50MB 且允许直传时选当前一次性 PUT；若单文件普遍大于 50MB 或弱网占比超过 15%，则改用分片上传并同步补后端分片合并接口；若合规要求上传前内容审查，则改用 BFF 代理上传；只有在体积恒小于 64KB 的图标场景下，才允许 Base64 内联，其余条件下一律禁止。",
      "fallback": [
        {
          "layer": "frontend",
          "failureMode": "token 在上传中途过期",
          "strategy": "捕获 403 后重新取 token，复用同一 objectKey 续传，不新建 key",
          "codeSnippet": "if (res.status === 403) {\n  const t = await refreshToken(key);\n  return putWithToken(t, file, { key });\n}",
          "monitoring": "upload_token_expired_midflight、续传成功率"
        },
        {
          "layer": "bff",
          "failureMode": "签发凭证接口不可用",
          "strategy": "前端退避重试并在 UI 明确提示「上传暂不可用」，禁止降级为明文直传",
          "codeSnippet": "throw new UploadUnavailableError('TOKEN_SERVICE_DOWN');\n// 严禁 fallback 到长期密钥",
          "monitoring": "token_endpoint_availability、降级尝试拦截数"
        },
        {
          "layer": "backend",
          "failureMode": "回调未到达，前端误判成功",
          "strategy": "前端以 /api/upload/status 二次确认为准，后端回调做幂等 upsert",
          "codeSnippet": "const ok = await confirmObject(key, etag);\nif (!ok) markPending(key);",
          "monitoring": "callback_missing_total、状态确认不一致数"
        },
        {
          "layer": "data",
          "failureMode": "同一文件生成多个 objectKey",
          "strategy": "key 由 fileHash + size 确定性生成，数据库加唯一索引兜底",
          "codeSnippet": "const key = `up/${sha256}/${size}/${name}`;\nUNIQUE INDEX uk_object_key (object_key)",
          "monitoring": "orphan_object_count"
        },
        {
          "layer": "infra",
          "failureMode": "OSS PUT 返回 5xx",
          "strategy": "指数退避重试 3 次后切换备用区域，并写死信队列供对账",
          "codeSnippet": "await retry(() => put(region, key, file), { times: 3 });\nawait dlq.push({ key, reason: 'OSS_5XX' });",
          "monitoring": "oss_5xx_rate、dlq_depth"
        }
      ],
      "pitfalls": [
        "PUT 的 Content-Type 必须与 policy 中一致，否则签名校验失败",
        "进度事件在 fetch 下不可用，需用 XMLHttpRequest",
        "objectKey 里含中文要先 encodeURIComponent"
      ],
      "tags": [
        "上传",
        "OSS",
        "直传",
        "预签名"
      ],
      "repoPath": "apps/web/src/upload/uploadFileToOSS.ts",
      "links": {
        "upstream": [
          "m.fe.useUploadQueue"
        ],
        "downstream": [
          "m.bff.createUploadToken",
          "m.infra.ossLifecycle"
        ],
        "related": [
          "m.be.verifyUploadCallback"
        ]
      },
      "examples": [
        {
          "scene": "带进度条的单个文件上传",
          "code": "const xhr = new XMLHttpRequest();\nxhr.upload.onprogress = e => setPct(e.loaded / e.total);\nxhr.open('PUT', token.url);\nxhr.send(file);",
          "explain": "进度来自浏览器本地字节计数，不依赖服务端推送。"
        }
      ],
      "decisionTree": {
        "questions": [
          {
            "id": "q1",
            "question": "单文件常见大小？",
            "options": [
              {
                "label": "小于 50MB",
                "value": "small",
                "next": "q2"
              },
              {
                "label": "大于 50MB",
                "value": "large",
                "next": "END"
              }
            ]
          },
          {
            "id": "q2",
            "question": "是否要求上传前做内容审查或禁止外网直传？",
            "options": [
              {
                "label": "是",
                "value": "audit",
                "next": "END"
              },
              {
                "label": "否",
                "value": "free",
                "next": "q3"
              }
            ]
          },
          {
            "id": "q3",
            "question": "是否是小于 64KB 的图标类资源？",
            "options": [
              {
                "label": "是",
                "value": "icon",
                "next": "END"
              },
              {
                "label": "否",
                "value": "normal",
                "next": "END"
              }
            ]
          }
        ],
        "rules": [
          {
            "when": {
              "q1": "large"
            },
            "result": "分片上传 + 断点续传",
            "reason": "大文件一次性 PUT 在弱网下失败率高，必须可续传。"
          },
          {
            "when": {
              "q2": "audit"
            },
            "result": "服务端代理上传（BFF 转发）",
            "reason": "需要在文件落盘前做审查，直传绕过审查点。"
          },
          {
            "when": {
              "q3": "icon"
            },
            "result": "Base64 内联",
            "reason": "极小资源内联可减少一次请求，且不会触碰 body 限制。"
          },
          {
            "when": {
              "q1": "small",
              "q2": "free",
              "q3": "normal"
            },
            "result": "保留当前一次性直传 PUT",
            "reason": "常规大小、无审查要求，直传是成本与复杂度最优解。"
          }
        ],
        "defaultResult": "保留当前一次性直传 PUT",
        "defaultReason": "默认落在直传方案的设计区间。"
      },
      "updatedAt": "2026-10-30",
      "repoUpdatedAt": "2026-10-30",
      "lastCodeChangeAt": "2026-11-05",
      "projectId": "yunshu"
    },
    {
      "id": "m.bff.createUploadToken",
      "name": "POST /api/upload/token",
      "signature": "createUploadToken(req: { fileName: string; size: number; hash: string }, ctx: UserCtx): Promise<UploadToken>",
      "layer": "bff",
      "stack": "Node.js + Fastify",
      "module": "文件上传",
      "summary": "聚合鉴权、配额与去重查询后，向后端换取一次性上传凭证。",
      "what": {
        "params": [
          {
            "name": "req.hash",
            "type": "string",
            "desc": "前端计算的文件内容 hash"
          },
          {
            "name": "ctx.user",
            "type": "UserCtx",
            "desc": "登录态与租户信息"
          }
        ],
        "returns": "UploadToken：{ url, key, policy, expireAt, region }",
        "sideEffects": [
          "写配额计数",
          "读 dedupe 表",
          "调用后端签发服务"
        ],
        "callers": [
          "useUploadQueue",
          "uploadFileToOSS"
        ]
      },
      "why": {
        "scenarios": [
          "浏览器需要上传凭证",
          "上传前必须校验用户配额与文件类型"
        ],
        "problemsSolved": [
          "前端不接触长期密钥",
          "把鉴权/配额/去重三件事收敛到一次往返",
          "屏蔽后端签发服务分区细节"
        ],
        "preconditions": [
          "网关已注入 UserCtx",
          "配额服务可用",
          "tenantId 必须透传到后端签名策略"
        ],
        "layerReason": "BFF 是唯一同时持有用户会话与后端服务发现能力的一层，签发凭证前的鉴权与配额适合放这里。",
        "counterExample": {
          "title": "前端直连后端签发服务",
          "desc": "需要把长期密钥或内网地址暴露给浏览器，且无法按租户做配额裁剪。",
          "code": "fetch('http://sign-svc.internal/token', { headers: { key: LONG_LIVED_KEY } });"
        }
      },
      "alternatives": [
        {
          "name": "前端直接向 OSS 申请 STS",
          "layer": "frontend",
          "pros": [
            "少一跳"
          ],
          "cons": [
            "长期密钥外泄风险",
            "无法做租户级配额"
          ],
          "whenToUse": "纯静态演示站、无租户概念",
          "migrationCost": "低但风险高",
          "affectedLayers": [
            "frontend",
            "infra"
          ],
          "codeSnippet": "const sts = await oss.assumeRole(...); // 密钥在浏览器"
        },
        {
          "name": "由后端服务直接签发（跳过 BFF）",
          "layer": "backend",
          "pros": [
            "链路更短"
          ],
          "cons": [
            "后端需要理解会话与租户语义",
            "鉴权逻辑重复"
          ],
          "whenToUse": "单租户内部系统且已有统一网关鉴权",
          "migrationCost": "中（2 人日）",
          "affectedLayers": [
            "bff",
            "backend"
          ],
          "codeSnippet": "GET /internal/sign?tenant=..."
        },
        {
          "name": "长期有效的公共上传凭证",
          "layer": "infra",
          "pros": [
            "无需签发接口"
          ],
          "cons": [
            "凭证泄露即全量可写",
            "无法审计"
          ],
          "whenToUse": "任何生产环境都不建议",
          "migrationCost": "低",
          "affectedLayers": [
            "infra"
          ],
          "codeSnippet": "// 固定 policy，永不过期"
        }
      ],
      "comparisonConclusion": "当存在多租户且需要按租户做配额裁剪时选当前 BFF 聚合签发；若是单租户内部系统且已有统一网关鉴权，则可让后端直接签发以缩短链路；只有在无租户概念的纯静态演示站条件下，才允许前端直连 STS；任何生产环境都不得使用长期有效的公共凭证。",
      "fallback": [
        {
          "layer": "frontend",
          "failureMode": "凭证请求失败导致用户无法开始上传",
          "strategy": "本地暂存已选文件，展示可重试状态，不清空用户选择",
          "codeSnippet": "setPendingFiles(files);\nshowRetry('凭证服务暂不可用');",
          "monitoring": "token_ui_retry_rate"
        },
        {
          "layer": "bff",
          "failureMode": "配额服务超时",
          "strategy": "fail-closed：拒绝签发并返回明确错误码，绝不默认放行",
          "codeSnippet": "throw httpError(503, 'QUOTA_UNAVAILABLE');\n// 禁止 catch 后 return defaultAllow()",
          "monitoring": "quota_timeout_total、fail_open 拦截数"
        },
        {
          "layer": "backend",
          "failureMode": "签发服务分区不可用",
          "strategy": "切到备用分区签发，并在 token 上标记 region 供回调对账",
          "codeSnippet": "const signer = pickHealthySigner([primary, backup]);\nreturn signer.issue(policy);",
          "monitoring": "signer_failover_count"
        },
        {
          "layer": "data",
          "failureMode": "dedupe 表查询超时",
          "strategy": "跳过复用直接签发新 key，靠对象唯一索引与生命周期规则事后清理",
          "codeSnippet": "const hit = await lookup(hash).catch(() => null);\nreturn issue({ key: hit?.key ?? newKey(hash) });",
          "monitoring": "dedupe_lookup_timeout、孤立对象清理量"
        },
        {
          "layer": "infra",
          "failureMode": "网关限流误伤签发接口",
          "strategy": "为 /api/upload/token 配置独立限流桶与优先级队列",
          "codeSnippet": "rateLimit({ path: '/api/upload/token', bucket: 'upload-token', rps: 200 });",
          "monitoring": "token_429_rate"
        }
      ],
      "pitfalls": [
        "policy 必须绑定 key 前缀与 Content-Type，否则可越权覆盖他人对象",
        "expireAt 要留时钟偏移余量",
        "配额扣减与签发不是事务，需对账"
      ],
      "tags": [
        "上传",
        "鉴权",
        "配额",
        "预签名",
        "BFF"
      ],
      "repoPath": "apps/bff/src/routes/upload-token.ts",
      "links": {
        "upstream": [
          "m.fe.useUploadQueue",
          "m.fe.uploadFile"
        ],
        "downstream": [
          "m.be.generatePresignedUrl"
        ],
        "related": [
          "m.data.redisDedupe"
        ]
      },
      "examples": [
        {
          "scene": "签发绑定租户前缀的凭证",
          "code": "const policy = { keyPrefix: `up/${ctx.tenantId}/`, contentType, maxSize };\nreturn signer.issue(policy, { ttl: 600 });",
          "explain": "前缀绑定让凭证即使泄露也只能写到该租户目录。"
        }
      ],
      "decisionTree": {
        "questions": [
          {
            "id": "q1",
            "question": "系统是否多租户且需要按租户配额？",
            "options": [
              {
                "label": "是",
                "value": "multi",
                "next": "END"
              },
              {
                "label": "否，单租户",
                "value": "single",
                "next": "q2"
              }
            ]
          },
          {
            "id": "q2",
            "question": "是否已有统一网关完成鉴权？",
            "options": [
              {
                "label": "是",
                "value": "gateway",
                "next": "END"
              },
              {
                "label": "否",
                "value": "none",
                "next": "END"
              }
            ]
          }
        ],
        "rules": [
          {
            "when": {
              "q1": "multi"
            },
            "result": "保留当前 BFF 聚合签发",
            "reason": "租户配额与会话语义只有 BFF 同时具备。"
          },
          {
            "when": {
              "q1": "single",
              "q2": "gateway"
            },
            "result": "由后端服务直接签发（跳过 BFF）",
            "reason": "网关已承担鉴权，BFF 聚合层收益不足。"
          },
          {
            "when": {
              "q1": "single",
              "q2": "none"
            },
            "result": "保留当前 BFF 聚合签发",
            "reason": "缺少统一鉴权时，仍需 BFF 收敛会话校验。"
          }
        ],
        "defaultResult": "保留当前 BFF 聚合签发",
        "defaultReason": "默认保留鉴权收敛点。"
      },
      "updatedAt": "2026-08-02",
      "repoUpdatedAt": "2026-09-11",
      "lastCodeChangeAt": "2026-09-11",
      "projectId": "yunshu"
    },
    {
      "id": "m.be.generatePresignedUrl",
      "name": "generatePresignedUrl",
      "signature": "generatePresignedUrl(bucket: string, key: string, ttlSec: number, policy: Policy): string",
      "layer": "backend",
      "stack": "Java 21 + Spring Boot",
      "module": "文件上传",
      "summary": "用服务端密钥生成短时、绑定资源前缀与内容类型的对象存储预签名 URL。",
      "what": {
        "params": [
          {
            "name": "bucket",
            "type": "string",
            "desc": "目标桶"
          },
          {
            "name": "ttlSec",
            "type": "number",
            "desc": "有效期，上限 900"
          }
        ],
        "returns": "string：可直接 PUT 的预签名 URL",
        "sideEffects": [
          "读 KMS 密钥",
          "写签名审计日志"
        ],
        "callers": [
          "POST /api/upload/token"
        ]
      },
      "why": {
        "scenarios": [
          "为前端直传生成临时写权限"
        ],
        "problemsSolved": [
          "最小权限：只能写指定 key 前缀",
          "时间受限：泄露窗口 ≤ 15min",
          "密钥不出服务端"
        ],
        "preconditions": [
          "KMS 可用",
          "key 已完成租户前缀规范化",
          "policy 不含通配符"
        ],
        "layerReason": "长期密钥与 KMS 只能在后端持有，签名属于信任边界内的操作。",
        "counterExample": {
          "title": "签发通配符 policy",
          "desc": "凭证可写整个桶，一次泄露即全量数据可覆盖。",
          "code": "policy.setResource('*'); // 禁止"
        }
      },
      "alternatives": [
        {
          "name": "STS 临时角色凭证",
          "layer": "infra",
          "pros": [
            "无需自管签名",
            "权限模型更细"
          ],
          "cons": [
            "多一次 STS 调用",
            "策略配置复杂"
          ],
          "whenToUse": "多服务共享对象存储且权限频繁变化",
          "migrationCost": "中（3 人日）",
          "affectedLayers": [
            "backend",
            "infra"
          ],
          "codeSnippet": "sts.assumeRole(policy, Duration.ofMinutes(10));"
        },
        {
          "name": "服务端中转 PUT",
          "layer": "backend",
          "pros": [
            "零签名逻辑"
          ],
          "cons": [
            "文件流量全进后端"
          ],
          "whenToUse": "文件小且并发极低的内部系统",
          "migrationCost": "低（1 人日）",
          "affectedLayers": [
            "backend",
            "infra"
          ],
          "codeSnippet": "ossClient.putObject(bucket, key, stream);"
        }
      ],
      "comparisonConclusion": "当文件由浏览器直传且需要最小权限时选当前预签名 URL；若多服务共享存储且权限策略频繁变化，则改用 STS 临时角色凭证；只有在文件小、并发极低且不介意流量进后端的条件下，才用服务端中转 PUT。",
      "fallback": [
        {
          "layer": "frontend",
          "failureMode": "URL 过期",
          "strategy": "按 expireAt 提前 30s 触发续签，复用原 key",
          "codeSnippet": "if (expireAt - Date.now() < 30_000) return refresh(key);",
          "monitoring": "presign_refresh_total"
        },
        {
          "layer": "bff",
          "failureMode": "签发结果被缓存复用跨租户",
          "strategy": "缓存键必须包含 tenantId + keyPrefix，命中前二次校验",
          "codeSnippet": "cacheKey = `${tenantId}:${keyPrefix}:${policyHash}`;",
          "monitoring": "presign_cache_cross_tenant_block"
        },
        {
          "layer": "backend",
          "failureMode": "KMS 不可用",
          "strategy": "切换备用密钥版本并降级为只读签发，同时告警，不返回无签名 URL",
          "codeSnippet": "key = kms.activeVersion() ?? kms.backupVersion();\nif (!key) throw new SigningUnavailable();",
          "monitoring": "kms_error_rate、signing_degraded"
        },
        {
          "layer": "data",
          "failureMode": "审计日志写入失败",
          "strategy": "先本地落盘再异步补写，禁止因日志失败阻塞签发",
          "codeSnippet": "auditBuffer.append(event); // async flush",
          "monitoring": "audit_buffer_depth"
        },
        {
          "layer": "infra",
          "failureMode": "时钟漂移导致签名提前失效",
          "strategy": "所有签发节点强制 NTP 对齐，签发时留 60s 偏移余量",
          "codeSnippet": "ttl = min(ttlSec, 900); skewAllowance = 60;",
          "monitoring": "node_clock_drift_ms"
        }
      ],
      "pitfalls": [
        "ttlSec 必须设上限，否则长期凭证等价泄露",
        "policy 里的 keyPrefix 需做路径穿越校验",
        "签名审计日志不能记录完整 URL（含签名）"
      ],
      "tags": [
        "上传",
        "预签名",
        "KMS",
        "最小权限"
      ],
      "repoPath": "services/file/src/main/java/.../PresignService.java",
      "links": {
        "upstream": [
          "m.bff.createUploadToken"
        ],
        "downstream": [
          "m.fe.uploadFile",
          "m.infra.ossLifecycle"
        ],
        "related": [
          "m.be.verifyUploadCallback"
        ]
      },
      "examples": [
        {
          "scene": "生成 10 分钟有效的 PUT 签名",
          "code": "String url = oss.generatePresignedUrl(bucket, key, 600, HttpMethod.PUT, policy);",
          "explain": "有效期与资源前缀同时绑定，构成最小写权限。"
        }
      ],
      "decisionTree": {
        "questions": [
          {
            "id": "q1",
            "question": "是否由浏览器直传对象存储？",
            "options": [
              {
                "label": "是",
                "value": "direct",
                "next": "q2"
              },
              {
                "label": "否",
                "value": "proxy",
                "next": "END"
              }
            ]
          },
          {
            "id": "q2",
            "question": "是否存在多服务共享存储且权限频繁变化？",
            "options": [
              {
                "label": "是",
                "value": "shared",
                "next": "END"
              },
              {
                "label": "否",
                "value": "single",
                "next": "END"
              }
            ]
          }
        ],
        "rules": [
          {
            "when": {
              "q1": "proxy"
            },
            "result": "服务端中转 PUT",
            "reason": "流量本就进后端，签名层没有收益。"
          },
          {
            "when": {
              "q2": "shared"
            },
            "result": "STS 临时角色凭证",
            "reason": "集中式角色策略更适合多服务频繁变更的权限。"
          },
          {
            "when": {
              "q1": "direct",
              "q2": "single"
            },
            "result": "保留当前预签名 URL",
            "reason": "单服务直传场景，预签名是复杂度最低的最小权限方案。"
          }
        ],
        "defaultResult": "保留当前预签名 URL",
        "defaultReason": "默认落在单服务直传场景。"
      },
      "updatedAt": "2026-07-15",
      "repoUpdatedAt": "2026-07-15",
      "lastCodeChangeAt": "2026-06-20",
      "projectId": "yunshu"
    },
    {
      "id": "m.be.verifyUploadCallback",
      "name": "verifyUploadCallback",
      "signature": "verifyUploadCallback(sign: string, body: UploadCallback): Promise<CallbackResult>",
      "layer": "backend",
      "stack": "Java 21 + Spring Boot",
      "module": "文件上传",
      "summary": "校验对象存储上传回调签名，幂等地把「对象已落盘」写入业务库。",
      "what": {
        "params": [
          {
            "name": "sign",
            "type": "string",
            "desc": "OSS 回调头中的签名"
          },
          {
            "name": "body",
            "type": "UploadCallback",
            "desc": "objectKey / etag / size"
          }
        ],
        "returns": "CallbackResult：{ accepted, duplicate, orderId? }",
        "sideEffects": [
          "幂等写 upload_record",
          "发布 UploadCompleted 事件"
        ],
        "callers": [
          "OSS 回调 HTTP 入口"
        ]
      },
      "why": {
        "scenarios": [
          "对象存储通知文件已完成上传",
          "订单附件状态需要落库"
        ],
        "problemsSolved": [
          "防止伪造回调把不存在的对象标记为已完成",
          "回调重投不产生重复记录",
          "把对象状态转成业务事件"
        ],
        "preconditions": [
          "回调公钥已轮换同步",
          "upload_record 有唯一索引",
          "MQ 生产者可用"
        ],
        "layerReason": "验签需要长期密钥与业务库事务，只能在后端完成。",
        "counterExample": {
          "title": "信任回调不做验签",
          "desc": "任何人构造 POST 即可把订单标记为已上传，且对象并不存在。",
          "code": "@PostMapping('/callback')\npublic void cb(@RequestBody Callback c) { markDone(c.getKey()); }"
        }
      },
      "alternatives": [
        {
          "name": "前端上传成功后主动上报",
          "layer": "frontend",
          "pros": [
            "无需配置回调"
          ],
          "cons": [
            "用户关页即丢失",
            "不可信来源"
          ],
          "whenToUse": "仅作辅助确认，不能作为唯一事实源",
          "migrationCost": "低",
          "affectedLayers": [
            "frontend",
            "backend"
          ],
          "codeSnippet": "await api.post('/upload/confirm', { key, etag });"
        },
        {
          "name": "定时轮询对象存储清单",
          "layer": "backend",
          "pros": [
            "不依赖回调可用性",
            "可天然对账"
          ],
          "cons": [
            "状态延迟分钟级",
            "清单接口有频率限制"
          ],
          "whenToUse": "回调长期不稳定的兜底手段",
          "migrationCost": "中（2 人日）",
          "affectedLayers": [
            "backend",
            "data"
          ],
          "codeSnippet": "scheduler.fixedRate(60_000, () -> reconcileListing());"
        },
        {
          "name": "CDC 订阅对象元数据表",
          "layer": "data",
          "pros": [
            "实时且可重放"
          ],
          "cons": [
            "引入流处理依赖"
          ],
          "whenToUse": "已有 Flink/Debezium 基础设施的团队",
          "migrationCost": "高（5 人日）",
          "affectedLayers": [
            "backend",
            "data",
            "infra"
          ],
          "codeSnippet": "debezium.source('oss_meta').sink(uploadRecord);"
        }
      ],
      "comparisonConclusion": "当回调可用且要求秒级状态收敛时选当前验签 + 幂等落库方案；若回调长期不稳定或需要独立对账，则增加定时轮询清单作为兜底；只有在团队已有 Flink/Debezium 基础设施的条件下，才考虑 CDC 订阅；前端主动上报任何条件下都只能作辅助确认，不得作为唯一事实源。",
      "fallback": [
        {
          "layer": "frontend",
          "failureMode": "回调丢失导致页面一直转圈",
          "strategy": "90s 后主动查询状态接口，展示「确认中」而非无限等待",
          "codeSnippet": "setTimeout(() => pollStatus(key), 90_000);",
          "monitoring": "ui_upload_pending_over_90s"
        },
        {
          "layer": "bff",
          "failureMode": "状态查询打到旧缓存",
          "strategy": "状态接口对 pending 记录强制读主库，禁用缓存",
          "codeSnippet": "@CacheEvict(key = '#key')\nStatus status = masterRepo.findByKey(key);",
          "monitoring": "status_stale_read_count"
        },
        {
          "layer": "backend",
          "failureMode": "验签公钥轮换期间签名全部失败",
          "strategy": "同时接受新旧两把公钥，验签失败进入重试队列而非直接丢弃",
          "codeSnippet": "if (!verify(newKey) && !verify(oldKey)) dlq.push(body);",
          "monitoring": "callback_sign_fail_rate、dlq_depth"
        },
        {
          "layer": "data",
          "failureMode": "回调重投造成重复记录",
          "strategy": "objectKey 唯一索引 + INSERT IGNORE，返回 duplicate=true",
          "codeSnippet": "INSERT IGNORE INTO upload_record(object_key, etag) VALUES(?, ?);",
          "monitoring": "callback_duplicate_ratio"
        },
        {
          "layer": "infra",
          "failureMode": "OSS 回调地址不可达",
          "strategy": "配置主备回调地址，未投递事件由清单对账任务补齐",
          "codeSnippet": "callbackUrls: [primary, backup]\n// reconcile job 每小时补一次",
          "monitoring": "callback_delivery_fail_total、对账补齐数"
        }
      ],
      "pitfalls": [
        "验签必须用原始 body 字节，不能先反序列化再拼串",
        "回调超时时间要小于 OSS 重投间隔，否则必然重复",
        "公钥轮换必须双写窗口，事故 i.upload.callback 就是少了这一步"
      ],
      "tags": [
        "上传",
        "回调",
        "验签",
        "幂等",
        "事故关联"
      ],
      "repoPath": "services/file/src/main/java/.../CallbackVerifier.java",
      "links": {
        "upstream": [
          "m.infra.ossLifecycle",
          "m.fe.uploadFile"
        ],
        "downstream": [
          "m.be.publishOrderEvent"
        ],
        "related": [
          "m.fe.useUploadQueue"
        ]
      },
      "examples": [
        {
          "scene": "双公钥窗口期验签",
          "code": "boolean ok = verifier.verify(raw, sign, activeKey)\n        || verifier.verify(raw, sign, previousKey);\nif (!ok) deadLetter.push(raw);",
          "explain": "轮换期间不丢事件，也不放宽验签。"
        }
      ],
      "decisionTree": {
        "questions": [
          {
            "id": "q1",
            "question": "回调链路是否稳定可用？",
            "options": [
              {
                "label": "稳定",
                "value": "stable",
                "next": "q2"
              },
              {
                "label": "经常丢",
                "value": "flaky",
                "next": "END"
              }
            ]
          },
          {
            "id": "q2",
            "question": "团队是否已有 Flink/Debezium 流处理设施？",
            "options": [
              {
                "label": "有",
                "value": "yes",
                "next": "END"
              },
              {
                "label": "没有",
                "value": "no",
                "next": "END"
              }
            ]
          }
        ],
        "rules": [
          {
            "when": {
              "q1": "flaky"
            },
            "result": "定时轮询对象存储清单",
            "reason": "回调不可靠时，清单是唯一完整的事实源。"
          },
          {
            "when": {
              "q1": "stable",
              "q2": "yes"
            },
            "result": "CDC 订阅对象元数据表",
            "reason": "已有流处理设施时 CDC 可重放且实时。"
          },
          {
            "when": {
              "q1": "stable",
              "q2": "no"
            },
            "result": "保留当前验签 + 幂等落库",
            "reason": "回调稳定且无流处理设施，当前方案成本最低。"
          }
        ],
        "defaultResult": "保留当前验签 + 幂等落库",
        "defaultReason": "默认采用回调直写并把清单对账作为兜底。"
      },
      "updatedAt": "2026-08-20",
      "repoUpdatedAt": "2026-08-20",
      "lastCodeChangeAt": "2026-08-14",
      "projectId": "yunshu"
    },
    {
      "id": "m.infra.ossLifecycle",
      "name": "putObjectLifecycleRule",
      "signature": "putObjectLifecycleRule(bucket: string, rule: { prefix: string; days: number; action: 'delete' | 'archive' }): void",
      "layer": "infra",
      "stack": "Terraform + OSS",
      "module": "文件上传",
      "summary": "给临时上传前缀设置自动过期规则，清理回调丢失或上传中断产生的孤立对象。",
      "what": {
        "params": [
          {
            "name": "rule.prefix",
            "type": "string",
            "desc": "只作用于临时上传目录"
          },
          {
            "name": "rule.days",
            "type": "number",
            "desc": "过期天数，默认 7"
          }
        ],
        "returns": "void（声明式配置）",
        "sideEffects": [
          "修改桶生命周期配置",
          "异步删除到期对象"
        ],
        "callers": [
          "Terraform 流水线"
        ]
      },
      "why": {
        "scenarios": [
          "上传中断产生无主对象",
          "回调丢失但对象已落盘"
        ],
        "problemsSolved": [
          "存储成本可回收",
          "不需要业务侧写清理任务",
          "与业务解耦的最后一道防线"
        ],
        "preconditions": [
          "临时前缀与正式对象前缀严格分离",
          "已完成对象会被业务侧转存或打标"
        ],
        "layerReason": "对象生命周期是存储设施自身能力，放在应用层会引入定时任务与状态一致性问题。",
        "counterExample": {
          "title": "不设生命周期，靠人工清理",
          "desc": "半年后临时目录堆积数十 TB，且无法区分哪些对象仍被待确认订单引用。",
          "code": "// 无规则，临时对象永久保留"
        }
      },
      "alternatives": [
        {
          "name": "业务侧定时清理任务",
          "layer": "backend",
          "pros": [
            "可按业务状态判断"
          ],
          "cons": [
            "需要扫描与分布式锁",
            "任务挂了就堆积"
          ],
          "whenToUse": "清理必须依赖业务状态时",
          "migrationCost": "中（2 人日）",
          "affectedLayers": [
            "backend",
            "data"
          ],
          "codeSnippet": "@Scheduled('0 3 * * *') void sweepOrphans() { ... }"
        },
        {
          "name": "上传前预写占位记录 + TTL 索引",
          "layer": "data",
          "pros": [
            "可精确追踪"
          ],
          "cons": [
            "写放大",
            "库表膨胀"
          ],
          "whenToUse": "需要审计每个临时对象归属时",
          "migrationCost": "中（3 人日）",
          "affectedLayers": [
            "backend",
            "data"
          ],
          "codeSnippet": "db.uploadIntent.insert({ key, expireAt }); // TTL index"
        }
      ],
      "comparisonConclusion": "当临时上传前缀与正式对象前缀可严格分离时选当前生命周期规则；若清理判定必须依赖业务订单状态，则增加业务侧定时清理任务；只有在需要审计每个临时对象归属的条件下，才引入预写占位记录与 TTL 索引；任何条件下都不得让临时对象无回收路径。",
      "fallback": [
        {
          "layer": "frontend",
          "failureMode": "用户中断上传留下未完成对象",
          "strategy": "取消时调用 abort 接口打中断标记，便于生命周期规则提前识别",
          "codeSnippet": "await api.post('/upload/abort', { key });",
          "monitoring": "upload_abort_total"
        },
        {
          "layer": "bff",
          "failureMode": "转存接口失败导致正式对象仍在临时前缀",
          "strategy": "转存失败时回滚业务状态，禁止把临时 key 写进正式记录",
          "codeSnippet": "if (!promote(key)) throw new PromoteFailed(key);",
          "monitoring": "promote_fail_total"
        },
        {
          "layer": "backend",
          "failureMode": "生命周期规则被误改为覆盖全桶",
          "strategy": "Terraform plan 加前缀白名单校验，CI 拦截宽泛 prefix",
          "codeSnippet": "assert(rule.prefix.startsWith('up/tmp/'), 'prefix too broad');",
          "monitoring": "lifecycle_rule_diff_alerts"
        },
        {
          "layer": "data",
          "failureMode": "到期对象仍被待确认订单引用",
          "strategy": "删除前查业务引用，命中则打标延期 7 天并告警",
          "codeSnippet": "if (referenced(key)) { tag(key, 'keep', 7); alert(); }",
          "monitoring": "lifecycle_delete_skipped"
        },
        {
          "layer": "infra",
          "failureMode": "生命周期任务延迟或未执行",
          "strategy": "监控临时前缀对象总量与最老对象年龄，超阈值触发人工对账",
          "codeSnippet": "alert when oldest_object_age_days > 10",
          "monitoring": "tmp_object_count、oldest_object_age_days"
        }
      ],
      "pitfalls": [
        "prefix 千万别配成空串，曾误删整个桶的测试对象",
        "低频访问存储有最小存储时长，转 archive 未必省钱",
        "规则变更需要 review，属于基础设施高危操作"
      ],
      "tags": [
        "上传",
        "OSS",
        "生命周期",
        "成本",
        "Terraform"
      ],
      "repoPath": "infra/terraform/oss_lifecycle.tf",
      "links": {
        "upstream": [
          "m.be.generatePresignedUrl",
          "m.fe.uploadFile"
        ],
        "downstream": [
          "m.be.verifyUploadCallback"
        ],
        "related": []
      },
      "examples": [
        {
          "scene": "只对临时前缀设置 7 天过期",
          "code": "resource \"oss_bucket_lifecycle\" \"tmp\" {\n  prefix = \"up/tmp/\"\n  days   = 7\n  action = \"delete\"\n}",
          "explain": "前缀隔离是这条规则安全的前提。"
        }
      ],
      "decisionTree": {
        "questions": [
          {
            "id": "q1",
            "question": "临时前缀与正式对象前缀能否严格分离？",
            "options": [
              {
                "label": "能",
                "value": "separable",
                "next": "q2"
              },
              {
                "label": "不能",
                "value": "mixed",
                "next": "END"
              }
            ]
          },
          {
            "id": "q2",
            "question": "是否需要审计每个临时对象的归属？",
            "options": [
              {
                "label": "需要",
                "value": "audit",
                "next": "END"
              },
              {
                "label": "不需要",
                "value": "no",
                "next": "END"
              }
            ]
          }
        ],
        "rules": [
          {
            "when": {
              "q1": "mixed"
            },
            "result": "业务侧定时清理任务",
            "reason": "前缀混用无法用设施规则安全删除，只能按业务状态判断。"
          },
          {
            "when": {
              "q2": "audit"
            },
            "result": "预写占位记录 + TTL 索引",
            "reason": "需要可追溯归属时，业务表记录是必要成本。"
          },
          {
            "when": {
              "q1": "separable",
              "q2": "no"
            },
            "result": "保留当前生命周期规则",
            "reason": "前缀可隔离且无需审计，设施侧规则最省维护。"
          }
        ],
        "defaultResult": "保留当前生命周期规则",
        "defaultReason": "默认以前缀隔离 + 设施规则作为最后一道防线。"
      },
      "updatedAt": "2026-05-12",
      "repoUpdatedAt": "2026-05-12",
      "lastCodeChangeAt": "2026-05-12",
      "projectId": "yunshu"
    },
    {
      "id": "m.fe.submitOrder",
      "name": "submitOrder",
      "signature": "submitOrder(draft: OrderDraft, opts: { idempotencyKey: string }): Promise<OrderView>",
      "layer": "frontend",
      "stack": "React 18 + TypeScript",
      "module": "下单",
      "summary": "提交订单时携带客户端生成的幂等键，并对按钮做在途锁定。",
      "what": {
        "params": [
          {
            "name": "draft",
            "type": "OrderDraft",
            "desc": "购物车快照与收货信息"
          },
          {
            "name": "opts.idempotencyKey",
            "type": "string",
            "desc": "由购物车版本号 + 会话生成的 UUID"
          }
        ],
        "returns": "Promise<OrderView>",
        "sideEffects": [
          "按钮置 loading",
          "写 sessionStorage 幂等键",
          "提交成功清空购物车"
        ],
        "callers": [
          "CheckoutPage"
        ]
      },
      "why": {
        "scenarios": [
          "用户连点提交按钮",
          "弱网下请求超时后用户手动刷新重试"
        ],
        "problemsSolved": [
          "前端先挡住最常见的重复触发",
          "重试沿用同一幂等键，后端可去重",
          "成功后才清购物车，避免丢单"
        ],
        "preconditions": [
          "幂等键在购物车内容不变时保持稳定",
          "购物车变更必须重新生成键"
        ],
        "layerReason": "连点与在途状态只存在于浏览器交互层，前端必须先行拦截，后端去重是第二道。",
        "counterExample": {
          "title": "只靠按钮 disable，不给幂等键",
          "desc": "用户刷新页面后 disable 失效，重试生成新请求，后端无去重依据，产生双份订单。",
          "code": "onClick={() => { setDisabled(true); api.post('/orders', draft); }}"
        }
      },
      "alternatives": [
        {
          "name": "仅后端去重，前端不锁按钮",
          "layer": "frontend",
          "pros": [
            "前端最简单"
          ],
          "cons": [
            "无谓请求打满网关",
            "用户看到多次 loading 闪烁"
          ],
          "whenToUse": "内部低并发工具",
          "migrationCost": "低",
          "affectedLayers": [
            "frontend"
          ],
          "codeSnippet": "api.post('/orders', draft); // 无锁"
        },
        {
          "name": "服务端生成一次性提交令牌",
          "layer": "bff",
          "pros": [
            "键不可被客户端伪造",
            "可绑定购物车快照"
          ],
          "cons": [
            "多一次往返",
            "令牌服务成为关键路径"
          ],
          "whenToUse": "涉及资金且需要强防重放",
          "migrationCost": "中（3 人日）",
          "affectedLayers": [
            "frontend",
            "bff",
            "backend"
          ],
          "codeSnippet": "const t = await api.get('/orders/submit-token');\napi.post('/orders', { ...draft, token: t });"
        },
        {
          "name": "前端队列 + 离线提交",
          "layer": "frontend",
          "pros": [
            "断网也能恢复"
          ],
          "cons": [
            "状态机复杂",
            "离线期间价格可能变化"
          ],
          "whenToUse": "移动端弱网占比极高的场景",
          "migrationCost": "高（5 人日）",
          "affectedLayers": [
            "frontend",
            "bff"
          ],
          "codeSnippet": "outbox.push(draft); // Service Worker 后台重放"
        }
      ],
      "comparisonConclusion": "当存在常规连点与弱网重试时选当前「在途锁 + 客户端幂等键」；若涉及资金且要求不可伪造的防重放，则改用服务端一次性提交令牌；只有在内部低并发工具场景下，才可仅靠后端去重；若移动端弱网占比极高且能接受价格复核，才考虑离线提交队列。",
      "fallback": [
        {
          "layer": "frontend",
          "failureMode": "请求超时，用户不确定是否下单成功",
          "strategy": "沿用同一幂等键重试，并展示「查询订单结果」而不是「重新提交」",
          "codeSnippet": "await api.post('/orders', draft, { key }); // key 不变\n// 超时改为 GET /orders?key=",
          "monitoring": "submit_timeout_retry_total、重复率"
        },
        {
          "layer": "bff",
          "failureMode": "提交请求被网关重放",
          "strategy": "BFF 透传 Idempotency-Key 且不改写，网关配置重放窗口内去重",
          "codeSnippet": "headers['Idempotency-Key'] = req.header('Idempotency-Key');",
          "monitoring": "gateway_replay_blocked"
        },
        {
          "layer": "backend",
          "failureMode": "幂等键冲突但返回体不一致",
          "strategy": "命中幂等记录时返回首次结果原样，禁止重新计算价格",
          "codeSnippet": "if (hit) return hit.responseSnapshot;",
          "monitoring": "idempotent_hit_ratio、响应不一致数"
        },
        {
          "layer": "data",
          "failureMode": "购物车快照与订单不一致",
          "strategy": "订单表存 cartVersion，校验不通过直接拒绝并提示刷新",
          "codeSnippet": "if (order.cartVersion != cart.version) throw Conflict();",
          "monitoring": "cart_version_conflict_total"
        },
        {
          "layer": "infra",
          "failureMode": "提交高峰网关限流",
          "strategy": "按用户维度令牌桶 + 排队提示，避免 429 触发用户反复点击",
          "codeSnippet": "rateLimit({ key: userId, rps: 2, burst: 3 });",
          "monitoring": "submit_429_rate"
        }
      ],
      "pitfalls": [
        "购物车内容变化后必须换幂等键，否则会复用旧订单结果",
        "成功后清购物车要放在结果确认之后",
        "在途锁不能只靠 CSS pointer-events，键盘 Enter 仍可触发"
      ],
      "tags": [
        "下单",
        "幂等",
        "连点",
        "前端"
      ],
      "repoPath": "apps/web/src/order/submitOrder.ts",
      "links": {
        "upstream": [],
        "downstream": [
          "m.bff.createOrder"
        ],
        "related": [
          "m.be.idempotentGuard"
        ]
      },
      "examples": [
        {
          "scene": "用购物车版本号生成稳定幂等键",
          "code": "const key = `${cart.id}:${cart.version}`;\nawait submitOrder(draft, { idempotencyKey: key });",
          "explain": "内容不变键不变，内容变化键随之变化。"
        }
      ],
      "decisionTree": {
        "questions": [
          {
            "id": "q1",
            "question": "是否涉及资金且需要强防重放？",
            "options": [
              {
                "label": "是",
                "value": "money",
                "next": "END"
              },
              {
                "label": "否",
                "value": "normal",
                "next": "q2"
              }
            ]
          },
          {
            "id": "q2",
            "question": "是否是内部低并发工具？",
            "options": [
              {
                "label": "是",
                "value": "internal",
                "next": "END"
              },
              {
                "label": "否",
                "value": "prod",
                "next": "q3"
              }
            ]
          },
          {
            "id": "q3",
            "question": "移动端弱网占比是否极高？",
            "options": [
              {
                "label": "是",
                "value": "weak",
                "next": "END"
              },
              {
                "label": "否",
                "value": "ok",
                "next": "END"
              }
            ]
          }
        ],
        "rules": [
          {
            "when": {
              "q1": "money"
            },
            "result": "服务端生成一次性提交令牌",
            "reason": "客户端生成的键可被伪造，资金场景需要服务端令牌。"
          },
          {
            "when": {
              "q2": "internal"
            },
            "result": "仅后端去重，前端不锁按钮",
            "reason": "低并发内部工具，交互复杂度收益不足。"
          },
          {
            "when": {
              "q3": "weak"
            },
            "result": "前端队列 + 离线提交",
            "reason": "弱网下需要可恢复的本地 outbox，但必须做价格复核。"
          },
          {
            "when": {
              "q1": "normal",
              "q2": "prod",
              "q3": "ok"
            },
            "result": "保留当前在途锁 + 客户端幂等键",
            "reason": "常规电商并发与弱网水平，双层防重最划算。"
          }
        ],
        "defaultResult": "保留当前在途锁 + 客户端幂等键",
        "defaultReason": "默认采用前端拦截 + 后端去重的双层方案。"
      },
      "updatedAt": "2026-06-10",
      "repoUpdatedAt": "2026-06-10",
      "lastCodeChangeAt": "2026-06-02",
      "projectId": "yunshu"
    },
    {
      "id": "m.bff.createOrder",
      "name": "POST /api/orders",
      "signature": "createOrder(req: CreateOrderReq, ctx: UserCtx): Promise<OrderView>",
      "layer": "bff",
      "stack": "Node.js + Fastify",
      "module": "下单",
      "summary": "聚合用户态、价格复核与幂等键透传，把下单请求收敛到后端领域服务。",
      "what": {
        "params": [
          {
            "name": "Idempotency-Key",
            "type": "header",
            "desc": "必需；缺失直接 400"
          },
          {
            "name": "req.cartVersion",
            "type": "number",
            "desc": "用于价格复核"
          }
        ],
        "returns": "OrderView：聚合订单主档、支付单、附件状态",
        "sideEffects": [
          "调用价格服务复核",
          "透传幂等键到后端",
          "写下单项埋点"
        ],
        "callers": [
          "submitOrder"
        ]
      },
      "why": {
        "scenarios": [
          "多端下单入口需要一致的聚合视图",
          "价格在下单瞬间可能变化"
        ],
        "problemsSolved": [
          "前端不必分别调 3 个服务",
          "在 BFF 完成价格复核，避免后端拿到过期价格",
          "幂等键统一校验入口"
        ],
        "preconditions": [
          "网关已注入 UserCtx",
          "价格服务可用或可 fail-closed",
          "幂等键格式符合 UUID/自定义规范"
        ],
        "layerReason": "聚合与用户态裁剪是 BFF 的职责；后端领域服务不应理解多端视图差异。",
        "counterExample": {
          "title": "前端直接调用后端领域服务",
          "desc": "每个端各自实现聚合与价格复核，出现三个版本的不一致逻辑。",
          "code": "Promise.all([orderSvc.create(), priceSvc.get(), paySvc.init()]);"
        }
      },
      "alternatives": [
        {
          "name": "GraphQL 聚合网关",
          "layer": "bff",
          "pros": [
            "端上按需取字段"
          ],
          "cons": [
            "引入 schema 治理成本"
          ],
          "whenToUse": "端数量 ≥ 4 且字段差异大",
          "migrationCost": "高（5 人日）",
          "affectedLayers": [
            "frontend",
            "bff"
          ],
          "codeSnippet": "mutation { createOrder(input: $in) { id payUrl } }"
        },
        {
          "name": "后端直接返回聚合视图",
          "layer": "backend",
          "pros": [
            "链路最短"
          ],
          "cons": [
            "领域服务被端侧视图污染"
          ],
          "whenToUse": "仅单端系统",
          "migrationCost": "中（2 人日）",
          "affectedLayers": [
            "bff",
            "backend"
          ],
          "codeSnippet": "return OrderAssembler.toView(order); // 在后端组装"
        }
      ],
      "comparisonConclusion": "当存在多端入口且各端视图不同时选当前 BFF 聚合并做价格复核；若端数量达到 4 个以上且字段差异很大，则可升级为 GraphQL 聚合网关；只有在仅单端系统的条件下，才允许后端直接返回聚合视图；任何条件下都不得让前端自行并行调用多个领域服务。",
      "fallback": [
        {
          "layer": "frontend",
          "failureMode": "聚合响应超时",
          "strategy": "改用订单查询接口按幂等键轮询，不再发起新的创建请求",
          "codeSnippet": "await poll(`/api/orders?key=${key}`);",
          "monitoring": "create_timeout_poll_total"
        },
        {
          "layer": "bff",
          "failureMode": "价格服务超时",
          "strategy": "fail-closed 返回 503「请重试」，绝不按前端传来的价格下单",
          "codeSnippet": "const p = await priceSvc.quote(cartVersion); // 超时即抛\nif (!p.ok) throw httpError(503, 'PRICE_UNAVAILABLE');",
          "monitoring": "price_timeout_total、fail_open_blocked"
        },
        {
          "layer": "backend",
          "failureMode": "领域服务返回 5xx",
          "strategy": "带同一幂等键有限重试 1 次，仍失败则返回可查询状态",
          "codeSnippet": "return retry(() => orderSvc.create({ key }), { times: 1 });",
          "monitoring": "order_svc_5xx、重试成功率"
        },
        {
          "layer": "data",
          "failureMode": "聚合查询读到从库延迟",
          "strategy": "创建后 3s 内的查询强制走主库",
          "codeSnippet": "if (Date.now() - createdAt < 3000) useMaster();",
          "monitoring": "replica_lag_ms、read_your_write_miss"
        },
        {
          "layer": "infra",
          "failureMode": "大促流量冲垮 BFF",
          "strategy": "按用户维度限流 + 下单接口独立线程池隔离",
          "codeSnippet": "bulkhead('order-create', { concurrency: 200 });",
          "monitoring": "bff_threadpool_saturation"
        }
      ],
      "pitfalls": [
        "幂等键缺失必须 400，不能自动生成，否则防重失效",
        "价格复核结果要写进请求上下文，别让后端二次查",
        "聚合超时重试必须沿用原键"
      ],
      "tags": [
        "下单",
        "BFF",
        "聚合",
        "价格复核",
        "幂等"
      ],
      "repoPath": "apps/bff/src/routes/orders.ts",
      "links": {
        "upstream": [
          "m.fe.submitOrder"
        ],
        "downstream": [
          "m.be.idempotentGuard",
          "m.be.createOrder"
        ],
        "related": [
          "m.data.insertOrderTx"
        ]
      },
      "examples": [
        {
          "scene": "强制校验幂等键",
          "code": "const key = req.headers['idempotency-key'];\nif (!key) return reply.code(400).send({ code: 'KEY_REQUIRED' });",
          "explain": "把防重前置到入口，避免后端承担无效流量。"
        }
      ],
      "decisionTree": {
        "questions": [
          {
            "id": "q1",
            "question": "端数量是否 ≥ 4 且字段差异很大？",
            "options": [
              {
                "label": "是",
                "value": "many",
                "next": "END"
              },
              {
                "label": "否",
                "value": "few",
                "next": "q2"
              }
            ]
          },
          {
            "id": "q2",
            "question": "是否仅单端系统？",
            "options": [
              {
                "label": "是",
                "value": "single",
                "next": "END"
              },
              {
                "label": "否",
                "value": "multi",
                "next": "END"
              }
            ]
          }
        ],
        "rules": [
          {
            "when": {
              "q1": "many"
            },
            "result": "GraphQL 聚合网关",
            "reason": "多端字段差异大，按需取字段能显著降低聚合维护成本。"
          },
          {
            "when": {
              "q2": "single"
            },
            "result": "后端直接返回聚合视图",
            "reason": "单端系统没有视图裁剪需求，BFF 聚合层可省。"
          },
          {
            "when": {
              "q1": "few",
              "q2": "multi"
            },
            "result": "保留当前 BFF 聚合",
            "reason": "多端但规模不大，REST 聚合最简单可控。"
          }
        ],
        "defaultResult": "保留当前 BFF 聚合",
        "defaultReason": "默认保持 BFF 作为唯一聚合点。"
      },
      "updatedAt": "2026-09-05",
      "repoUpdatedAt": "2026-10-02",
      "lastCodeChangeAt": "2026-10-02",
      "projectId": "yunshu"
    },
    {
      "id": "m.be.idempotentGuard",
      "name": "withIdempotency",
      "signature": "withIdempotency<T>(key: string, ttlSec: number, fn: () => Promise<T>): Promise<IdemResult<T>>",
      "layer": "backend",
      "stack": "Java 21 + Spring Boot",
      "module": "下单",
      "summary": "以幂等键包裹领域操作，用「执行中 / 已完成」两态防止并发重复提交。",
      "what": {
        "params": [
          {
            "name": "key",
            "type": "string",
            "desc": "全局幂等键"
          },
          {
            "name": "ttlSec",
            "type": "number",
            "desc": "记录保留时长，默认 86400"
          }
        ],
        "returns": "IdemResult<T>：{ value, replayed, state }",
        "sideEffects": [
          "Redis SETNX 占位",
          "写幂等结果快照",
          "记录冲突日志"
        ],
        "callers": [
          "POST /api/orders",
          "createOrder"
        ]
      },
      "why": {
        "scenarios": [
          "同一请求并发到达多实例",
          "上游超时重投"
        ],
        "problemsSolved": [
          "并发下只有一个执行体真正运行",
          "重放返回首次结果原样",
          "与业务事务同生命周期，避免幽灵记录"
        ],
        "preconditions": [
          "Redis 可用且 SETNX 原子",
          "结果快照可序列化",
          "业务方法自身不产生额外副作用"
        ],
        "layerReason": "幂等是领域操作的约束，必须在后端事务边界内实现；前端与 BFF 都只能减少触发，无法保证。",
        "counterExample": {
          "title": "先查再写（check-then-act）",
          "desc": "两个并发请求同时查到「不存在」，双双插入订单。",
          "code": "if (!repo.exists(key)) repo.insert(order); // 非原子"
        }
      },
      "alternatives": [
        {
          "name": "数据库唯一索引兜底",
          "layer": "data",
          "pros": [
            "最强最终防线",
            "不依赖 Redis"
          ],
          "cons": [
            "只能报错，无法返回首次结果"
          ],
          "whenToUse": "作为必配的第二道防线，不能单独使用",
          "migrationCost": "低",
          "affectedLayers": [
            "backend",
            "data"
          ],
          "codeSnippet": "UNIQUE INDEX uk_idem_key (idempotency_key);"
        },
        {
          "name": "分布式锁 + 业务查重",
          "layer": "backend",
          "pros": [
            "可复用现有锁组件"
          ],
          "cons": [
            "锁过期时间难定",
            "仍需查重逻辑"
          ],
          "whenToUse": "已有统一锁服务且无法引入结果快照时",
          "migrationCost": "中（2 人日）",
          "affectedLayers": [
            "backend"
          ],
          "codeSnippet": "tryLock('idem:' + key, 30, () -> doBiz());"
        },
        {
          "name": "MQ 串行化同一键",
          "layer": "infra",
          "pros": [
            "天然有序"
          ],
          "cons": [
            "延迟上升",
            "引入异步一致性"
          ],
          "whenToUse": "可接受秒级延迟的异步下单",
          "migrationCost": "高（5 人日）",
          "affectedLayers": [
            "backend",
            "infra"
          ],
          "codeSnippet": "mq.send('order.create', msg, { partitionKey: key });"
        }
      ],
      "comparisonConclusion": "当要求同步返回首次结果且存在多实例并发时选当前 SETNX 两态幂等；若仅需要最终防重而可接受报错，则数据库唯一索引即可，但必须与当前方案叠加而非替换；只有在已有统一锁服务且无法保存结果快照的条件下，才用分布式锁 + 业务查重；若业务可接受秒级异步延迟，才考虑 MQ 按键串行化。",
      "fallback": [
        {
          "layer": "frontend",
          "failureMode": "上游重放时前端拿到 409",
          "strategy": "约定 409 携带首次订单号，前端转为查询而非报错",
          "codeSnippet": "if (e.status === 409) return queryByKey(key);",
          "monitoring": "idem_409_converted"
        },
        {
          "layer": "bff",
          "failureMode": "幂等键被改写导致去重失效",
          "strategy": "BFF 记录原始键与透传键，不一致直接告警",
          "codeSnippet": "audit.assert(rawKey === forwardedKey);",
          "monitoring": "idem_key_mismatch_alerts"
        },
        {
          "layer": "backend",
          "failureMode": "执行体崩溃，占位永不过期",
          "strategy": "占位带 TTL，并由对账任务把超时 PROCESSING 重置或标记失败",
          "codeSnippet": "SET idem:key state=PROCESSING EX 120 NX\n// reconcile: timeout > 120s → FAILED",
          "monitoring": "idem_stuck_processing、对账重置数"
        },
        {
          "layer": "data",
          "failureMode": "Redis 不可用导致幂等整体失效",
          "strategy": "降级为数据库唯一索引拦截，返回 409 并关闭非关键下单入口",
          "codeSnippet": "catch (RedisUnavailable e) {\n  return db.insertWithUniqueKey(key, order); // 命中则 409\n}",
          "monitoring": "redis_down_degrade_total"
        },
        {
          "layer": "infra",
          "failureMode": "Redis 主从切换丢占位",
          "strategy": "关键键开启 AOF 每秒刷盘，并在切换后跑一次对账",
          "codeSnippet": "appendfsync everysec\n// post-failover reconcile",
          "monitoring": "redis_failover_count、idem_record_loss"
        }
      ],
      "pitfalls": [
        "占位 TTL 必须大于业务最大执行时间，否则并发窗口重新打开",
        "结果快照要在事务提交后再写，否则可能返回一个回滚了的订单",
        "事故 i.order.duplicate 的根因是只做了先查再写"
      ],
      "tags": [
        "下单",
        "幂等",
        "SETNX",
        "并发",
        "事故关联"
      ],
      "repoPath": "services/order/src/main/java/.../IdempotencyGuard.java",
      "links": {
        "upstream": [
          "m.bff.createOrder"
        ],
        "downstream": [
          "m.data.redisDedupe",
          "m.be.createOrder"
        ],
        "related": [
          "m.fe.submitOrder"
        ]
      },
      "examples": [
        {
          "scene": "原子占位 + 结果快照",
          "code": "boolean won = redis.setnx('idem:' + key, 'PROCESSING', 120);\nif (!won) return replayOrWait(key);\nT v = fn(); redis.set('idem:' + key, snapshot(v));",
          "explain": "SETNX 保证只有一个执行体，快照保证重放结果一致。"
        }
      ],
      "decisionTree": {
        "questions": [
          {
            "id": "q1",
            "question": "是否需要同步返回首次执行的结果？",
            "options": [
              {
                "label": "是",
                "value": "sync",
                "next": "q2"
              },
              {
                "label": "否，报错即可",
                "value": "error",
                "next": "END"
              }
            ]
          },
          {
            "id": "q2",
            "question": "业务能否接受秒级异步延迟？",
            "options": [
              {
                "label": "能",
                "value": "async",
                "next": "END"
              },
              {
                "label": "不能",
                "value": "realtime",
                "next": "q3"
              }
            ]
          },
          {
            "id": "q3",
            "question": "是否已有统一锁服务且无法保存结果快照？",
            "options": [
              {
                "label": "是",
                "value": "lock",
                "next": "END"
              },
              {
                "label": "否",
                "value": "snapshot",
                "next": "END"
              }
            ]
          }
        ],
        "rules": [
          {
            "when": {
              "q1": "error"
            },
            "result": "数据库唯一索引兜底",
            "reason": "只需最终防重时唯一索引最可靠，但仍建议与 SETNX 叠加。"
          },
          {
            "when": {
              "q2": "async"
            },
            "result": "MQ 串行化同一键",
            "reason": "可接受异步时，按键分区天然去重且削峰。"
          },
          {
            "when": {
              "q3": "lock"
            },
            "result": "分布式锁 + 业务查重",
            "reason": "无法保存快照时只能靠锁 + 查重近似实现。"
          },
          {
            "when": {
              "q1": "sync",
              "q2": "realtime",
              "q3": "snapshot"
            },
            "result": "保留当前 withIdempotency 两态方案",
            "reason": "同步返回首次结果是当前方案的独有能力。"
          }
        ],
        "defaultResult": "保留当前 withIdempotency 两态方案",
        "defaultReason": "默认要求同步且结果一致。"
      },
      "updatedAt": "2026-06-08",
      "repoUpdatedAt": "2026-06-08",
      "lastCodeChangeAt": "2026-06-02",
      "projectId": "yunshu"
    },
    {
      "id": "m.be.createOrder",
      "name": "createOrder",
      "signature": "createOrder(cmd: CreateOrderCmd, ctx: TxContext): Promise<Order>",
      "layer": "backend",
      "stack": "Java 21 + Spring Boot",
      "module": "下单",
      "summary": "领域层创建订单聚合根，校验库存与价格快照，并在同一事务内写主档与明细。",
      "what": {
        "params": [
          {
            "name": "cmd",
            "type": "CreateOrderCmd",
            "desc": "已复核的价格快照、SKU 列表、幂等键"
          },
          {
            "name": "ctx",
            "type": "TxContext",
            "desc": "事务上下文"
          }
        ],
        "returns": "Order 聚合根",
        "sideEffects": [
          "写 order / order_item",
          "扣减库存预留",
          "发 Outbox 事件"
        ],
        "callers": [
          "withIdempotency",
          "POST /api/orders"
        ]
      },
      "why": {
        "scenarios": [
          "用户确认下单",
          "后台补单"
        ],
        "problemsSolved": [
          "保证主档与明细原子落库",
          "价格以复核快照为准，不受下游波动影响",
          "事件与业务写入同一事务，避免消息先于数据"
        ],
        "preconditions": [
          "价格已由 BFF 复核",
          "幂等键已占位成功",
          "库存预留接口可用"
        ],
        "layerReason": "聚合根一致性与事务边界属于领域层，不能上移到 BFF。",
        "counterExample": {
          "title": "先写订单再异步发消息",
          "desc": "进程在两者之间崩溃，消息发出但订单回滚；或订单成功但消息丢失，下游永远不知道。",
          "code": "repo.save(order);\nmq.send(event); // 非事务，存在中间态"
        }
      },
      "alternatives": [
        {
          "name": "Saga 分步事务",
          "layer": "backend",
          "pros": [
            "跨服务长事务可补偿"
          ],
          "cons": [
            "补偿逻辑复杂",
            "最终一致"
          ],
          "whenToUse": "库存/支付分属不同服务且无法同库事务",
          "migrationCost": "高（8 人日）",
          "affectedLayers": [
            "backend",
            "data",
            "infra"
          ],
          "codeSnippet": "saga.step(reserveStock).compensate(releaseStock).step(createOrder);"
        },
        {
          "name": "直接存储过程写库",
          "layer": "data",
          "pros": [
            "少一次网络往返"
          ],
          "cons": [
            "业务逻辑沉入数据库难维护"
          ],
          "whenToUse": "遗留系统且无法改造应用",
          "migrationCost": "中（3 人日）",
          "affectedLayers": [
            "backend",
            "data"
          ],
          "codeSnippet": "CALL sp_create_order(...);"
        }
      ],
      "comparisonConclusion": "当订单主档与明细在同一数据库且需强一致时选当前聚合根 + 单事务 + Outbox；若库存与支付分属不同服务且无法共库，则改用 Saga 分步事务并明确补偿；只有在遗留系统无法改造应用层的条件下，才允许存储过程写库；任何条件下都不得把消息发送放在事务之外。",
      "fallback": [
        {
          "layer": "frontend",
          "failureMode": "下单失败但库存已锁",
          "strategy": "展示带剩余时间的「处理中」状态，由库存预留 TTL 自动释放，不引导用户重复提交",
          "codeSnippet": "showPending({ ttlSec: 120, key });",
          "monitoring": "ui_pending_order_total"
        },
        {
          "layer": "bff",
          "failureMode": "后端已提交但响应丢失",
          "strategy": "按幂等键查询既有结果并原样返回，不触发二次创建",
          "codeSnippet": "const existing = await orderSvc.findByKey(key);\nif (existing) return existing;",
          "monitoring": "create_response_lost_recovered"
        },
        {
          "layer": "backend",
          "failureMode": "事务提交后 Outbox 投递失败",
          "strategy": "Outbox 表 + 定时补投，消息至少一次投递，消费侧去重",
          "codeSnippet": "@Transactional void create(...) {\n  repo.save(order); outbox.insert(event);\n}\n// relay 每 5s 补投",
          "monitoring": "outbox_unsent_age、补投成功率"
        },
        {
          "layer": "data",
          "failureMode": "唯一索引冲突（重复插入）",
          "strategy": "捕获 DuplicateKeyException 转为幂等命中，返回既有订单",
          "codeSnippet": "catch (DuplicateKeyException e) {\n  return repo.findByIdempotencyKey(key);\n}",
          "monitoring": "duplicate_key_hit_total"
        },
        {
          "layer": "infra",
          "failureMode": "数据库主库故障切换",
          "strategy": "切换窗口内拒绝写请求并返回可重试状态，禁止自动重放写操作",
          "codeSnippet": "if (!primaryHealthy) throw new RetryableWriteUnavailable();",
          "monitoring": "db_failover_writes_rejected"
        }
      ],
      "pitfalls": [
        "Outbox 事件必须与业务写在同一个 @Transactional 里",
        "不要在事务内做远程调用",
        "价格快照要随订单落库，否则事后无法对账"
      ],
      "tags": [
        "下单",
        "事务",
        "聚合根",
        "Outbox"
      ],
      "repoPath": "services/order/src/main/java/.../OrderService.java",
      "links": {
        "upstream": [
          "m.be.idempotentGuard",
          "m.bff.createOrder"
        ],
        "downstream": [
          "m.data.insertOrderTx",
          "m.be.publishOrderEvent"
        ],
        "related": []
      },
      "examples": [
        {
          "scene": "业务写入与事件同事务",
          "code": "@Transactional\npublic Order create(CreateOrderCmd cmd) {\n  Order o = Order.from(cmd);\n  repo.save(o);\n  outbox.insert(OrderCreated.of(o));\n  return o;\n}",
          "explain": "消息落库而非直接发送，避免中间态。"
        }
      ],
      "decisionTree": {
        "questions": [
          {
            "id": "q1",
            "question": "库存与支付是否与订单在同一数据库？",
            "options": [
              {
                "label": "是",
                "value": "same",
                "next": "q2"
              },
              {
                "label": "否，跨服务",
                "value": "cross",
                "next": "END"
              }
            ]
          },
          {
            "id": "q2",
            "question": "是否为无法改造应用的遗留系统？",
            "options": [
              {
                "label": "是",
                "value": "legacy",
                "next": "END"
              },
              {
                "label": "否",
                "value": "modern",
                "next": "END"
              }
            ]
          }
        ],
        "rules": [
          {
            "when": {
              "q1": "cross"
            },
            "result": "Saga 分步事务",
            "reason": "跨服务无法共库事务，只能用补偿式最终一致。"
          },
          {
            "when": {
              "q2": "legacy"
            },
            "result": "直接存储过程写库",
            "reason": "遗留约束下只能在数据库侧保证原子性。"
          },
          {
            "when": {
              "q1": "same",
              "q2": "modern"
            },
            "result": "保留当前聚合根 + 单事务 + Outbox",
            "reason": "同库场景下强一致成本最低。"
          }
        ],
        "defaultResult": "保留当前聚合根 + 单事务 + Outbox",
        "defaultReason": "默认同库强一致。"
      },
      "updatedAt": "2026-10-12",
      "repoUpdatedAt": "2026-10-12",
      "lastCodeChangeAt": "2026-10-20",
      "projectId": "yunshu"
    },
    {
      "id": "m.data.redisDedupe",
      "name": "SETNX dedupe:{key}",
      "signature": "SET dedupe:{key} <state> NX EX <ttl>  →  1 | 0",
      "layer": "data",
      "stack": "Redis 7",
      "module": "下单",
      "summary": "用单条原子命令实现幂等占位，是后端幂等与上传去重共用的数据层原语。",
      "what": {
        "params": [
          {
            "name": "key",
            "type": "string",
            "desc": "业务幂等键，含租户前缀"
          },
          {
            "name": "state",
            "type": "string",
            "desc": "PROCESSING / DONE + 结果快照"
          }
        ],
        "returns": "1 表示抢到占位；0 表示已有执行体或已完成",
        "sideEffects": [
          "写 Redis 键",
          "触发过期淘汰"
        ],
        "callers": [
          "withIdempotency",
          "POST /api/upload/token"
        ]
      },
      "why": {
        "scenarios": [
          "多实例并发去重",
          "短期状态占位"
        ],
        "problemsSolved": [
          "原子性由 Redis 单线程保证",
          "TTL 自动回收，无需清理任务",
          "延迟低于数据库唯一索引冲突路径"
        ],
        "preconditions": [
          "Redis 主从/集群配置一致",
          "客户端未开启会拆命令的管道重写",
          "TTL 大于业务最大耗时"
        ],
        "layerReason": "原子占位是存储层能力；应用层无法在分布式下自行实现。",
        "counterExample": {
          "title": "GET + SET 两步",
          "desc": "两个实例同时 GET 到 nil，都执行 SET，去重完全失效。",
          "code": "if (redis.get(k) == null) redis.set(k, v); // 非原子"
        }
      },
      "alternatives": [
        {
          "name": "数据库唯一索引",
          "layer": "data",
          "pros": [
            "持久化可靠",
            "不受 Redis 故障影响"
          ],
          "cons": [
            "每次冲突要走异常路径",
            "延迟更高"
          ],
          "whenToUse": "作为强制第二道防线，与 SETNX 叠加",
          "migrationCost": "低",
          "affectedLayers": [
            "backend",
            "data"
          ],
          "codeSnippet": "ALTER TABLE t ADD UNIQUE KEY uk_idem (idempotency_key);"
        },
        {
          "name": "Redis Lua 脚本封装状态机",
          "layer": "data",
          "pros": [
            "多步判断仍原子",
            "支持重放结果"
          ],
          "cons": [
            "脚本调试与版本管理成本高"
          ],
          "whenToUse": "需要区分 PROCESSING/DONE 并做等待时",
          "migrationCost": "中（2 人日）",
          "affectedLayers": [
            "backend",
            "data"
          ],
          "codeSnippet": "EVAL idem_script 1 key state ttl"
        },
        {
          "name": "etcd 租约锁",
          "layer": "infra",
          "pros": [
            "强一致"
          ],
          "cons": [
            "吞吐低",
            "多一套依赖"
          ],
          "whenToUse": "配置变更类低频强一致场景",
          "migrationCost": "高（4 人日）",
          "affectedLayers": [
            "backend",
            "infra"
          ],
          "codeSnippet": "etcd.lease.grant(30).then(l => put(k, v, l));"
        }
      ],
      "comparisonConclusion": "当只需高频原子占位且能接受 Redis 故障时由唯一索引兜底时选当前 SETNX；若需要区分执行中/已完成并让并发方等待结果，则改用 Lua 脚本状态机；只有在配置变更类低频强一致条件下，才考虑 etcd 租约锁；数据库唯一索引任何生产条件下都必须叠加保留，不得作为唯一手段。",
      "fallback": [
        {
          "layer": "frontend",
          "failureMode": "去重失败导致用户看到两次结果",
          "strategy": "以幂等键做结果聚合，UI 只渲染首个 settle 的响应",
          "codeSnippet": "const first = firstSettledByKey(key);\nrender(first);",
          "monitoring": "ui_duplicate_result_suppressed"
        },
        {
          "layer": "bff",
          "failureMode": "不同端生成了不同键",
          "strategy": "BFF 统一规范化键（租户 + 业务主键 + 版本）后再透传",
          "codeSnippet": "key = `${tenant}:${cartId}:${version}`;",
          "monitoring": "idem_key_normalized_total"
        },
        {
          "layer": "backend",
          "failureMode": "SETNX 返回 0 但无结果可读",
          "strategy": "短暂等待后重试读取，超时则按冲突返回 409 让上游查询",
          "codeSnippet": "await waitForResult(key, 2_000) ?? conflict(409);",
          "monitoring": "idem_wait_timeout_total"
        },
        {
          "layer": "data",
          "failureMode": "Redis 完全不可用",
          "strategy": "降级走数据库唯一索引，同时把去重失败计数打到告警",
          "codeSnippet": "return db.insertWithUniqueKey(key, payload); // 冲突即 409",
          "monitoring": "redis_unavailable_degrade_total"
        },
        {
          "layer": "infra",
          "failureMode": "键过期策略误删活跃占位",
          "strategy": "TTL 由配置中心统一下发，禁止代码内硬编码；监控过期早于业务完成的比例",
          "codeSnippet": "ttl = config.get('idem.ttl', 120); // 禁止魔法数字",
          "monitoring": "idem_ttl_early_expire_rate"
        }
      ],
      "pitfalls": [
        "NX 与 EX 必须写在同一条命令，分开就不是原子",
        "key 要带租户前缀，否则跨租户互相误杀",
        "主从切换可能丢未同步的占位，必须叠加数据库唯一索引"
      ],
      "tags": [
        "幂等",
        "Redis",
        "SETNX",
        "去重",
        "数据层"
      ],
      "repoPath": "infra/redis/idem_keys.md",
      "links": {
        "upstream": [
          "m.be.idempotentGuard",
          "m.bff.createUploadToken"
        ],
        "downstream": [],
        "related": [
          "m.data.insertOrderTx"
        ]
      },
      "examples": [
        {
          "scene": "一条命令完成占位",
          "code": "SET dedupe:order:42 PROCESSING NX EX 120",
          "explain": "NX + EX 在同一条命令内才能保证原子与自动回收。"
        }
      ],
      "decisionTree": {
        "questions": [
          {
            "id": "q1",
            "question": "是否需要区分执行中/已完成并让并发方等待？",
            "options": [
              {
                "label": "是",
                "value": "states",
                "next": "END"
              },
              {
                "label": "否",
                "value": "simple",
                "next": "q2"
              }
            ]
          },
          {
            "id": "q2",
            "question": "是否是低频但要求强一致的配置类操作？",
            "options": [
              {
                "label": "是",
                "value": "strong",
                "next": "END"
              },
              {
                "label": "否",
                "value": "highfreq",
                "next": "END"
              }
            ]
          }
        ],
        "rules": [
          {
            "when": {
              "q1": "states"
            },
            "result": "Redis Lua 脚本封装状态机",
            "reason": "多步判断必须整体原子，Lua 是唯一低成本方案。"
          },
          {
            "when": {
              "q2": "strong"
            },
            "result": "etcd 租约锁",
            "reason": "低频强一致场景可以承受 etcd 的吞吐代价。"
          },
          {
            "when": {
              "q1": "simple",
              "q2": "highfreq"
            },
            "result": "保留当前 SETNX + 数据库唯一索引",
            "reason": "高频简单占位用单条原子命令最划算。"
          }
        ],
        "defaultResult": "保留当前 SETNX + 数据库唯一索引",
        "defaultReason": "默认高频简单占位。"
      },
      "updatedAt": "2026-04-18",
      "repoUpdatedAt": "2026-04-18",
      "lastCodeChangeAt": "2026-04-18",
      "projectId": "yunshu"
    },
    {
      "id": "m.data.insertOrderTx",
      "name": "insertOrderWithTx",
      "signature": "insertOrderWithTx(conn: Connection, order: Order, items: OrderItem[]): TxResult",
      "layer": "data",
      "stack": "MySQL 8 + InnoDB",
      "module": "下单",
      "summary": "在单个事务内写订单主档、明细与 Outbox，并以唯一索引兜住重复提交。",
      "what": {
        "params": [
          {
            "name": "conn",
            "type": "Connection",
            "desc": "已开启事务的连接"
          },
          {
            "name": "order",
            "type": "Order",
            "desc": "含 idempotency_key 与价格快照"
          }
        ],
        "returns": "TxResult：{ orderId, committed, duplicate }",
        "sideEffects": [
          "写 3 张表",
          "加间隙锁",
          "产生 binlog"
        ],
        "callers": [
          "createOrder"
        ]
      },
      "why": {
        "scenarios": [
          "订单落库"
        ],
        "problemsSolved": [
          "主档/明细/事件要么全成功要么全回滚",
          "唯一索引是最后一道防重",
          "价格快照落库便于事后对账"
        ],
        "preconditions": [
          "idempotency_key 上有唯一索引",
          "事务隔离级别为 READ COMMITTED 及以上",
          "锁等待超时已配置"
        ],
        "layerReason": "原子性与约束由数据库保证，应用层重试不能替代。",
        "counterExample": {
          "title": "分三次 autocommit 写入",
          "desc": "主档成功、明细失败，产生金额为零的幽灵订单。",
          "code": "insert(order); insert(items); insert(outbox); // 各自提交"
        }
      },
      "alternatives": [
        {
          "name": "分库分表 + 最终一致",
          "layer": "data",
          "pros": [
            "可水平扩展"
          ],
          "cons": [
            "跨片无事务",
            "需要补偿任务"
          ],
          "whenToUse": "单表超千万行且写入成为瓶颈",
          "migrationCost": "高（10 人日）",
          "affectedLayers": [
            "backend",
            "data"
          ],
          "codeSnippet": "shardBy(userId); // 跨片走 Saga"
        },
        {
          "name": "事件溯源（只写事件表）",
          "layer": "data",
          "pros": [
            "天然可回溯"
          ],
          "cons": [
            "查询需物化视图",
            "团队心智负担大"
          ],
          "whenToUse": "审计要求极强的资金系统",
          "migrationCost": "很高（15 人日）",
          "affectedLayers": [
            "backend",
            "data",
            "infra"
          ],
          "codeSnippet": "appendEvent(OrderCreated); // 读模型异步构建"
        }
      ],
      "comparisonConclusion": "当单表规模可控且要求强一致时选当前单事务三表写入；若单表超过千万行且写入已成为瓶颈，则改为分库分表并接受最终一致；只有在审计要求极强的资金系统条件下，才引入事件溯源；任何情况下唯一索引与价格快照都不得省略。",
      "fallback": [
        {
          "layer": "frontend",
          "failureMode": "写库超时用户看到失败",
          "strategy": "以幂等键查询结果而非状态文案，避免用户重复提交",
          "codeSnippet": "return queryByKey(key) ?? showPending();",
          "monitoring": "write_timeout_query_rate"
        },
        {
          "layer": "bff",
          "failureMode": "重复写返回 500",
          "strategy": "把 DuplicateKey 统一映射为 409 + 首次订单号",
          "codeSnippet": "map(DuplicateKeyException.class, 409, 'IDEM_HIT');",
          "monitoring": "duplicate_mapped_409_total"
        },
        {
          "layer": "backend",
          "failureMode": "事务未提交进程崩溃",
          "strategy": "依赖 InnoDB 回滚 + Outbox 补投，不做应用层补偿写",
          "codeSnippet": "// 崩溃由 DB 回滚，relay 只处理已提交 outbox",
          "monitoring": "uncommitted_tx_detected"
        },
        {
          "layer": "data",
          "failureMode": "锁等待超时",
          "strategy": "设置 innodb_lock_wait_timeout=5，超时返回可重试错误，禁止无限等待",
          "codeSnippet": "SET SESSION innodb_lock_wait_timeout = 5;",
          "monitoring": "lock_wait_timeout_total"
        },
        {
          "layer": "infra",
          "failureMode": "磁盘满导致写入失败",
          "strategy": "磁盘水位告警 + 下单入口熔断，避免半写入与雪崩",
          "codeSnippet": "if (diskUsage > 0.85) circuitBreaker.open('order-write');",
          "monitoring": "db_disk_usage、circuit_open_total"
        }
      ],
      "pitfalls": [
        "唯一索引必须建在 idempotency_key 而不是 order_id",
        "不要在事务里做 HTTP 调用，锁会被远程延迟拖住",
        "Outbox 表要定期归档，否则成为新的热点表"
      ],
      "tags": [
        "下单",
        "事务",
        "MySQL",
        "唯一索引",
        "Outbox"
      ],
      "repoPath": "services/order/src/main/resources/mapper/OrderMapper.xml",
      "links": {
        "upstream": [
          "m.be.createOrder"
        ],
        "downstream": [
          "m.be.publishOrderEvent"
        ],
        "related": [
          "m.data.redisDedupe"
        ]
      },
      "examples": [
        {
          "scene": "唯一索引 + 事务",
          "code": "BEGIN;\nINSERT INTO orders(..., idempotency_key) VALUES(..., ?);\nINSERT INTO order_item(...) VALUES(...);\nINSERT INTO outbox(...) VALUES(...);\nCOMMIT;",
          "explain": "三张表同事务，唯一索引兜住并发重复。"
        }
      ],
      "decisionTree": {
        "questions": [
          {
            "id": "q1",
            "question": "订单单表是否已超千万行且写入成为瓶颈？",
            "options": [
              {
                "label": "是",
                "value": "huge",
                "next": "END"
              },
              {
                "label": "否",
                "value": "normal",
                "next": "q2"
              }
            ]
          },
          {
            "id": "q2",
            "question": "是否为审计要求极强的资金系统？",
            "options": [
              {
                "label": "是",
                "value": "audit",
                "next": "END"
              },
              {
                "label": "否",
                "value": "no",
                "next": "END"
              }
            ]
          }
        ],
        "rules": [
          {
            "when": {
              "q1": "huge"
            },
            "result": "分库分表 + 最终一致",
            "reason": "单表容量已到瓶颈，必须牺牲跨片强一致。"
          },
          {
            "when": {
              "q2": "audit"
            },
            "result": "事件溯源（只写事件表）",
            "reason": "极强审计要求下，不可变事件流是唯一完备记录。"
          },
          {
            "when": {
              "q1": "normal",
              "q2": "no"
            },
            "result": "保留当前单事务三表写入",
            "reason": "规模可控时，单事务强一致维护成本最低。"
          }
        ],
        "defaultResult": "保留当前单事务三表写入",
        "defaultReason": "默认单库强一致。"
      },
      "updatedAt": "2026-03-22",
      "repoUpdatedAt": "2026-03-22",
      "lastCodeChangeAt": "2026-03-22",
      "projectId": "yunshu"
    },
    {
      "id": "m.be.publishOrderEvent",
      "name": "publishOrderCreated",
      "signature": "publishOrderCreated(event: OrderCreated, ctx: OutboxCtx): Promise<PublishResult>",
      "layer": "backend",
      "stack": "Java 21 + Kafka",
      "module": "消息",
      "summary": "把 Outbox 中的订单事件投递到消息总线，供履约、通知、附件服务消费。",
      "what": {
        "params": [
          {
            "name": "event",
            "type": "OrderCreated",
            "desc": "含 orderId / tenantId / eventId"
          },
          {
            "name": "ctx",
            "type": "OutboxCtx",
            "desc": "补投标记与重试次数"
          }
        ],
        "returns": "PublishResult：{ sent, retried, deadLettered }",
        "sideEffects": [
          "写 Kafka topic",
          "更新 outbox 状态",
          "投递失败写死信"
        ],
        "callers": [
          "createOrder",
          "verifyUploadCallback",
          "Outbox Relay"
        ]
      },
      "why": {
        "scenarios": [
          "订单创建后触发履约、通知、附件归档"
        ],
        "problemsSolved": [
          "业务写入与消息发出解耦但不错序",
          "投递失败可补投",
          "下游各自重试互不影响"
        ],
        "preconditions": [
          "eventId 全局唯一",
          "消费者实现幂等",
          "topic 分区键使用 orderId 保序"
        ],
        "layerReason": "事件发布属于领域输出边界，必须由后端在事务提交后统一执行。",
        "counterExample": {
          "title": "在事务内直接 send",
          "desc": "事务回滚但消息已发出，下游创建了不存在的订单履约单。",
          "code": "@Transactional void create() { repo.save(o); kafka.send(e); }"
        }
      },
      "alternatives": [
        {
          "name": "同步 RPC 串行调用下游",
          "layer": "backend",
          "pros": [
            "即时一致",
            "实现直观"
          ],
          "cons": [
            "下游故障拖垮下单",
            "新增下游要改下单代码"
          ],
          "whenToUse": "下游仅 1 个且强依赖结果",
          "migrationCost": "低（1 人日）",
          "affectedLayers": [
            "backend"
          ],
          "codeSnippet": "fulfillClient.create(order); notifyClient.send(order);"
        },
        {
          "name": "CDC 直接读 binlog 发消息",
          "layer": "data",
          "pros": [
            "零应用侵入",
            "天然保序"
          ],
          "cons": [
            "事件语义弱、含表结构耦合"
          ],
          "whenToUse": "已有 Debezium 且事件只需行变更",
          "migrationCost": "中（3 人日）",
          "affectedLayers": [
            "backend",
            "data",
            "infra"
          ],
          "codeSnippet": "debezium.source('orders').sink('order.created');"
        },
        {
          "name": "本地内存事件总线",
          "layer": "backend",
          "pros": [
            "零依赖"
          ],
          "cons": [
            "进程重启即丢",
            "多实例不广播"
          ],
          "whenToUse": "仅单体测试环境",
          "migrationCost": "低",
          "affectedLayers": [
            "backend"
          ],
          "codeSnippet": "eventBus.post(new OrderCreated(o));"
        }
      ],
      "comparisonConclusion": "当下游 ≥ 2 个且要求下单链路不被下游故障拖垮时选当前 Outbox + Kafka；若下游只有 1 个且下单必须同步拿到其结果，则改用同步 RPC；只有在团队已有 Debezium 且事件只需表达行变更的条件下，才用 CDC 读 binlog；任何生产环境都不得使用本地内存事件总线。",
      "fallback": [
        {
          "layer": "frontend",
          "failureMode": "下单成功但通知未到达",
          "strategy": "前端订单详情页提供「重新发送通知」入口，走后端补发接口",
          "codeSnippet": "await api.post('/orders/' + id + '/resend');",
          "monitoring": "manual_resend_total"
        },
        {
          "layer": "bff",
          "failureMode": "聚合视图依赖下游状态超时",
          "strategy": "视图里对下游字段做可空降级，主档信息始终可展示",
          "codeSnippet": "view.fulfillment = await safeGet(() => f.status, null);",
          "monitoring": "view_partial_degrade_rate"
        },
        {
          "layer": "backend",
          "failureMode": "Kafka 不可用",
          "strategy": "Outbox 保持未发送，Relay 指数退避补投，不丢事件",
          "codeSnippet": "while (!sent) { await backoff(); sent = relay.trySend(); }",
          "monitoring": "outbox_backlog_age、补投成功率"
        },
        {
          "layer": "data",
          "failureMode": "重复投递造成下游重复处理",
          "strategy": "eventId 作为消费者幂等键，落 processed_event 表",
          "codeSnippet": "INSERT IGNORE INTO processed_event(event_id) VALUES(?);",
          "monitoring": "consumer_duplicate_suppressed"
        },
        {
          "layer": "infra",
          "failureMode": "持续失败堆积死信",
          "strategy": "超过 5 次进 DLQ 并告警，提供按 eventId 重放工具",
          "codeSnippet": "if (retries > 5) dlq.send(event);",
          "monitoring": "dlq_depth、dlq_oldest_age"
        }
      ],
      "pitfalls": [
        "分区键必须用 orderId，用 tenantId 会把同一订单的事件打散",
        "至少一次投递，消费端幂等是硬要求",
        "Outbox 归档不能删未发送记录"
      ],
      "tags": [
        "消息",
        "Kafka",
        "Outbox",
        "事件",
        "跨链路"
      ],
      "repoPath": "services/order/src/main/java/.../OrderEventPublisher.java",
      "links": {
        "upstream": [
          "m.be.createOrder",
          "m.be.verifyUploadCallback"
        ],
        "downstream": [
          "m.infra.mqRetry"
        ],
        "related": []
      },
      "examples": [
        {
          "scene": "事务提交后由 Relay 补投",
          "code": "// Relay 只扫描 status = 'PENDING' 的已提交记录\noutbox.pending().forEach(e -> kafka.send('order.created', e.orderId, e));",
          "explain": "发送发生在事务之外，但事实来源于同事务的 Outbox。"
        }
      ],
      "decisionTree": {
        "questions": [
          {
            "id": "q1",
            "question": "下游服务是否 ≥ 2 个？",
            "options": [
              {
                "label": "是",
                "value": "many",
                "next": "q2"
              },
              {
                "label": "否，仅 1 个",
                "value": "one",
                "next": "END"
              }
            ]
          },
          {
            "id": "q2",
            "question": "是否已有 Debezium 且事件只需表达行变更？",
            "options": [
              {
                "label": "是",
                "value": "cdc",
                "next": "END"
              },
              {
                "label": "否",
                "value": "no",
                "next": "END"
              }
            ]
          }
        ],
        "rules": [
          {
            "when": {
              "q1": "one"
            },
            "result": "同步 RPC 串行调用下游",
            "reason": "仅一个下游且需要结果时，同步调用最简单。"
          },
          {
            "when": {
              "q2": "cdc"
            },
            "result": "CDC 直接读 binlog 发消息",
            "reason": "已有流处理设施且语义只需行变更，可减少应用侵入。"
          },
          {
            "when": {
              "q1": "many",
              "q2": "no"
            },
            "result": "保留当前 Outbox + Kafka",
            "reason": "多下游需要解耦与独立重试，Outbox 保证不丢。"
          }
        ],
        "defaultResult": "保留当前 Outbox + Kafka",
        "defaultReason": "默认多下游异步解耦。"
      },
      "updatedAt": "2026-09-28",
      "repoUpdatedAt": "2026-09-28",
      "lastCodeChangeAt": "2026-11-01",
      "projectId": "yunshu"
    },
    {
      "id": "m.infra.mqRetry",
      "name": "configureRetryDLQ",
      "signature": "configureRetryDLQ(topic: string, cfg: { maxRetries: number; backoff: string; dlqTopic: string }): void",
      "layer": "infra",
      "stack": "Terraform + Kafka",
      "module": "消息",
      "summary": "为订单与上传事件统一配置重试退避与死信队列，防止单条毒消息阻塞整条链路。",
      "what": {
        "params": [
          {
            "name": "cfg.maxRetries",
            "type": "number",
            "desc": "进入 DLQ 前的最大重试次数，默认 5"
          },
          {
            "name": "cfg.backoff",
            "type": "string",
            "desc": "指数退避策略"
          }
        ],
        "returns": "void（声明式配置）",
        "sideEffects": [
          "创建 DLQ topic",
          "修改消费者重试策略",
          "写告警规则"
        ],
        "callers": [
          "Terraform 流水线"
        ]
      },
      "why": {
        "scenarios": [
          "下游服务短时不可用",
          "某条消息格式异常永远消费失败"
        ],
        "problemsSolved": [
          "瞬时故障自动恢复",
          "毒消息隔离，不阻塞后续消息",
          "失败事件可审计与重放"
        ],
        "preconditions": [
          "消费者幂等",
          "DLQ 有负责人与清理流程",
          "重试间隔小于业务可接受延迟"
        ],
        "layerReason": "重试与死信属于消息基础设施策略，统一在设施层配置比每个消费者各写一套更可控。",
        "counterExample": {
          "title": "无限重试同一条消息",
          "desc": "一条格式错误的消息卡住分区，后面所有订单事件全部延迟。",
          "code": "while (true) { try { consume(); } catch { /* 原地重试 */ } }"
        }
      },
      "alternatives": [
        {
          "name": "消费者内自建重试",
          "layer": "backend",
          "pros": [
            "可按异常类型定制"
          ],
          "cons": [
            "各服务策略不一致",
            "容易写成无限重试"
          ],
          "whenToUse": "个别服务有特殊退避需求时作为补充",
          "migrationCost": "低",
          "affectedLayers": [
            "backend"
          ],
          "codeSnippet": "@Retryable(maxAttempts = 3, backoff = @Backoff(1000))"
        },
        {
          "name": "失败即丢弃 + 定时全量对账",
          "layer": "data",
          "pros": [
            "无 DLQ 维护成本"
          ],
          "cons": [
            "恢复延迟小时级",
            "对账任务重"
          ],
          "whenToUse": "事件可完全由主表重建",
          "migrationCost": "中（3 人日）",
          "affectedLayers": [
            "backend",
            "data"
          ],
          "codeSnippet": "scheduler.reconcile('order_created'); // 每小时"
        }
      ],
      "comparisonConclusion": "当事件不可由主表低成本重建且要求分钟级恢复时选当前统一重试 + DLQ；若个别服务需要按异常类型定制退避，则在消费者内补充自建重试，但不得替代统一策略；只有在事件可由主表完全重建且能接受小时级延迟的条件下，才用丢弃 + 全量对账；任何条件下都禁止无限原地重试。",
      "fallback": [
        {
          "layer": "frontend",
          "failureMode": "下游状态长时间不更新",
          "strategy": "详情页展示「处理中」与已等待时长，提供刷新而非重新下单",
          "codeSnippet": "showPending({ since: createdAt, sla: '5min' });",
          "monitoring": "ui_long_pending_count"
        },
        {
          "layer": "bff",
          "failureMode": "聚合接口被慢消费者拖慢",
          "strategy": "下游状态查询加 300ms 超时并降级为 null",
          "codeSnippet": "withTimeout(300, () => downstream.status()) ?? null;",
          "monitoring": "bff_downstream_timeout_rate"
        },
        {
          "layer": "backend",
          "failureMode": "消费者抛非瞬时异常",
          "strategy": "按异常分类：瞬时进重试，格式错误直接进 DLQ，不占用重试次数",
          "codeSnippet": "if (e instanceof DeserializationError) dlq.send(msg); else retry(msg);",
          "monitoring": "non_retryable_to_dlq_total"
        },
        {
          "layer": "data",
          "failureMode": "DLQ 消息无人处理",
          "strategy": "DLQ 记录 eventId / 失败原因 / 首次失败时间，超 SLA 自动升级告警",
          "codeSnippet": "dlq.record({ eventId, reason, firstFailedAt });",
          "monitoring": "dlq_oldest_age、dlq_unhandled"
        },
        {
          "layer": "infra",
          "failureMode": "重试风暴放大故障",
          "strategy": "指数退避 + 抖动，并对单分区设置最大在途重试数",
          "codeSnippet": "backoff = base * 2 ** n + jitter();\nmaxInFlightRetriesPerPartition = 20;",
          "monitoring": "retry_storm_guard_hits"
        }
      ],
      "pitfalls": [
        "重试必须加抖动，否则下游恢复瞬间被同时打垮",
        "DLQ 不是垃圾桶，必须有负责人和重放工具",
        "顺序性要求高的事件不能靠 DLQ 后补，会乱序"
      ],
      "tags": [
        "消息",
        "Kafka",
        "重试",
        "死信",
        "Terraform",
        "跨链路"
      ],
      "repoPath": "infra/terraform/kafka_retry.tf",
      "links": {
        "upstream": [
          "m.be.publishOrderEvent"
        ],
        "downstream": [],
        "related": [
          "m.be.verifyUploadCallback"
        ]
      },
      "examples": [
        {
          "scene": "指数退避 + 抖动 + DLQ",
          "code": "retry:\n  maxRetries: 5\n  backoff: exponential(1s, jitter=true)\n  deadLetterTopic: order.created.dlq",
          "explain": "抖动避免恢复瞬间的重试风暴。"
        }
      ],
      "decisionTree": {
        "questions": [
          {
            "id": "q1",
            "question": "事件是否可由主表低成本重建？",
            "options": [
              {
                "label": "是",
                "value": "rebuild",
                "next": "q2"
              },
              {
                "label": "否",
                "value": "unique",
                "next": "END"
              }
            ]
          },
          {
            "id": "q2",
            "question": "能否接受小时级恢复延迟？",
            "options": [
              {
                "label": "能",
                "value": "hours",
                "next": "END"
              },
              {
                "label": "不能",
                "value": "minutes",
                "next": "END"
              }
            ]
          }
        ],
        "rules": [
          {
            "when": {
              "q1": "unique"
            },
            "result": "保留当前统一重试 + DLQ",
            "reason": "事件不可重建时，DLQ 是唯一不丢数据的路径。"
          },
          {
            "when": {
              "q1": "rebuild",
              "q2": "hours"
            },
            "result": "失败即丢弃 + 定时全量对账",
            "reason": "可重建且能接受延迟时，对账比维护 DLQ 更省。"
          },
          {
            "when": {
              "q1": "rebuild",
              "q2": "minutes"
            },
            "result": "保留当前统一重试 + DLQ",
            "reason": "分钟级恢复要求下，不能等定时对账。"
          }
        ],
        "defaultResult": "保留当前统一重试 + DLQ",
        "defaultReason": "默认事件不可重建且要求快速恢复。"
      },
      "updatedAt": "2026-10-08",
      "repoUpdatedAt": "2026-10-08",
      "lastCodeChangeAt": "2026-10-08",
      "projectId": "yunshu"
    },
    {
      "id": "xl.fe.submitPayment",
      "projectId": "xinglian",
      "name": "submitOrder",
      "signature": "submitOrder(req: { outTradeNo: string; amountFen: number; channel: ChannelCode }, opts: { idempotencyKey: string }): Promise<PaySubmitView>",
      "layer": "frontend",
      "stack": "Vue 3 + TypeScript + Pinia",
      "module": "支付下单",
      "summary": "收银台提交支付单：以商户订单号生成稳定幂等键、在途锁定按钮，并把渠道参数交给统一收单聚合层。",
      "what": {
        "params": [
          {
            "name": "req.outTradeNo",
            "type": "string",
            "desc": "商户订单号，由后端预下单签发，页面刷新保持不变"
          },
          {
            "name": "req.amountFen",
            "type": "number",
            "desc": "金额，单位分，避免浮点误差"
          },
          {
            "name": "opts.idempotencyKey",
            "type": "string",
            "desc": "merchantId:outTradeNo 派生的稳定键"
          }
        ],
        "returns": "PaySubmitView：{ payOrderId, channel, credential, expiredAt }，credential 用于拉起渠道收银台",
        "sideEffects": [
          "提交按钮置 in-flight 并禁用键盘 Enter 触发",
          "写 sessionStorage 幂等键",
          "拉起渠道支付页 / 二维码"
        ],
        "callers": [
          "CheckoutCashier"
        ]
      },
      "why": {
        "scenarios": [
          "用户在收银台连点「确认支付」",
          "渠道支付页返回后用户手动刷新结果页",
          "大促期间弱网导致提交响应超时"
        ],
        "problemsSolved": [
          "前端先挡住最常见的重复触发",
          "幂等键绑定商户订单号，刷新后重试仍可去重",
          "成功后才拉起渠道页，避免丢单与重复扣款"
        ],
        "preconditions": [
          "outTradeNo 已由预下单接口签发且未被使用",
          "金额与币种以分为单位校验",
          "渠道 SDK / 二维码组件可用"
        ],
        "layerReason": "收银台是渠道跳转与支付状态机的唯一持有者，只有前端能在渠道页返回后收敛终态并决定拉起哪个渠道控件；BFF 无法感知页面生命周期与渠道 SDK 回调。",
        "counterExample": {
          "title": "按钮置灰但刷新后重新生成幂等键",
          "desc": "用户刷新收银台后按钮锁失效，前端用随机 UUID 重新提交，后端无法识别是同一次支付，渠道侧产生两笔成功扣款。",
          "code": "onClick(() => { disabled = true; api.post('/pay/submit', { ...form, key: uuidv4() }); })"
        }
      },
      "alternatives": [
        {
          "name": "仅靠按钮 disable，不带幂等键",
          "layer": "frontend",
          "pros": [
            "前端实现最简单"
          ],
          "cons": [
            "刷新即失效",
            "请求打满收单网关"
          ],
          "whenToUse": "内部低并发运营工具且金额可人工冲正",
          "migrationCost": "低（0.5 人日）",
          "affectedLayers": [
            "frontend"
          ],
          "codeSnippet": "disabled = true; await api.post('/pay/submit', form);"
        },
        {
          "name": "服务端一次性提交令牌",
          "layer": "bff",
          "pros": [
            "令牌不可被客户端伪造",
            "可绑定金额与渠道快照"
          ],
          "cons": [
            "多一次往返",
            "令牌服务成为关键路径"
          ],
          "whenToUse": "涉及资金且要求强防重放、不可伪造提交凭证",
          "migrationCost": "中（3 人日）",
          "affectedLayers": [
            "frontend",
            "bff",
            "backend"
          ],
          "codeSnippet": "const t = await api.get('/pay/submit-token?outTradeNo=' + no);\nawait api.post('/pay/submit', { ...form, token: t });"
        },
        {
          "name": "Service Worker 离线提交队列",
          "layer": "frontend",
          "pros": [
            "断网也能恢复提交"
          ],
          "cons": [
            "状态机复杂",
            "离线期间渠道费率与限额可能变化"
          ],
          "whenToUse": "移动端弱网占比极高且能接受渠道参数复核",
          "migrationCost": "高（5 人日）",
          "affectedLayers": [
            "frontend",
            "bff"
          ],
          "codeSnippet": "outbox.push(form); // SW 后台重放，重放前复核渠道限额"
        }
      ],
      "comparisonConclusion": "当存在常规连点与渠道页返回重试时选「在途锁 + 商户订单号稳定幂等键」；若涉及资金且要求不可伪造的防重放，则改用服务端一次性提交令牌；只有在内部低并发运营工具的条件下，才可仅靠按钮锁定；任何情况下都不得让刷新页面重新生成幂等键。",
      "fallback": [
        {
          "layer": "frontend",
          "failureMode": "提交超时，用户不确定是否扣款",
          "strategy": "沿用同一幂等键改为查询支付单，展示「结果确认中」而非「重新支付」，禁止二次拉起渠道",
          "codeSnippet": "const view = await api.get('/pay/orders/' + outTradeNo);\nif (view.payOrderId) router.push('/result/' + view.payOrderId);\nelse showPending({ key });",
          "monitoring": "submit_timeout_query_total、二次提交拦截数"
        },
        {
          "layer": "bff",
          "failureMode": "收单聚合返回 429 / 503",
          "strategy": "前端按 Retry-After 退避重试并沿用原键，指数退避上限 3 次，UI 保持 in-flight 不释放按钮",
          "codeSnippet": "await retry(() => submit(form, { idempotencyKey: key }), { times: 3, backoff: 'exp' });\n// 期间 disabled 不释放",
          "monitoring": "submit_retry_total、429 触发的用户重试率"
        },
        {
          "layer": "backend",
          "failureMode": "渠道 credential 生成失败但支付单已创建",
          "strategy": "返回可查询的 payOrderId，前端跳转结果页轮询，不重新创建支付单",
          "codeSnippet": "if (!credential) return reply.code(202).send({ payOrderId, state: 'CREDENTIAL_PENDING' });",
          "monitoring": "credential_pending_total、恢复成功率"
        },
        {
          "layer": "data",
          "failureMode": "sessionStorage 幂等键丢失",
          "strategy": "以 outTradeNo 向后端查询既有支付单，命中则复用，不生成新键",
          "codeSnippet": "const key = sessionStorage.getItem('idem:' + outTradeNo) ?? await fetchKeyByOutTradeNo(outTradeNo);",
          "monitoring": "idem_key_rebuilt_by_out_trade_no"
        },
        {
          "layer": "infra",
          "failureMode": "渠道 SDK / 网关整体不可用",
          "strategy": "收银台降级展示「稍后支付」与订单查询入口，禁止把金额带入任何备用渠道",
          "codeSnippet": "if (!channelHealth.anyHealthy()) showMaintenance(outTradeNo);",
          "monitoring": "cashier_channel_unavailable_total"
        }
      ],
      "pitfalls": [
        "金额一律用分，浮点元值在渠道侧会因四舍五入对不上账",
        "在途锁不能只靠 CSS pointer-events，键盘 Enter 仍会触发提交",
        "成功后先拿到 payOrderId 再拉起渠道页，顺序反了会丢单",
        "outTradeNo 变化必须换幂等键，否则会复用旧支付结果"
      ],
      "tags": [
        "支付下单",
        "收银台",
        "幂等",
        "连点",
        "前端"
      ],
      "repoPath": "apps/pay/web/src/payment/submitOrder.ts",
      "links": {
        "upstream": [],
        "downstream": [
          "xl.bff.createPayIntent",
          "xl.fe.pollPayResult"
        ],
        "related": [
          "xl.be.idempotentGuard"
        ]
      },
      "examples": [
        {
          "scene": "用商户订单号生成稳定幂等键并提交",
          "code": "const key = `${merchantId}:${outTradeNo}`;\nconst view = await submitOrder({ outTradeNo, amountFen, channel }, { idempotencyKey: key });\nopenChannelCashier(view.credential);",
          "explain": "键由商户订单号派生，刷新页面后仍指向同一笔支付。"
        }
      ],
      "decisionTree": {
        "questions": [
          {
            "id": "q1",
            "question": "是否涉及资金且要求不可伪造的防重放？",
            "options": [
              {
                "label": "是",
                "value": "money",
                "next": "END"
              },
              {
                "label": "否",
                "value": "normal",
                "next": "q2"
              }
            ]
          },
          {
            "id": "q2",
            "question": "是否为内部低并发运营工具？",
            "options": [
              {
                "label": "是",
                "value": "internal",
                "next": "END"
              },
              {
                "label": "否",
                "value": "prod",
                "next": "q3"
              }
            ]
          },
          {
            "id": "q3",
            "question": "渠道页返回后是否需要前端收敛终态？",
            "options": [
              {
                "label": "是",
                "value": "need",
                "next": "END"
              },
              {
                "label": "否",
                "value": "none",
                "next": "END"
              }
            ]
          }
        ],
        "rules": [
          {
            "when": {
              "q1": "money"
            },
            "result": "服务端一次性提交令牌",
            "reason": "客户端生成的键可被伪造，资金场景需要服务端签发的提交凭证。"
          },
          {
            "when": {
              "q2": "internal"
            },
            "result": "仅靠按钮锁定",
            "reason": "低并发内部工具，交互复杂度收益不足且金额可人工冲正。"
          },
          {
            "when": {
              "q1": "normal",
              "q2": "prod",
              "q3": "need"
            },
            "result": "保留当前在途锁 + 商户订单号稳定幂等键",
            "reason": "常规并发与渠道页返回场景，双层防重最划算。"
          }
        ],
        "defaultResult": "保留当前在途锁 + 商户订单号稳定幂等键",
        "defaultReason": "默认采用前端拦截 + 稳定幂等键的双层方案。"
      },
      "updatedAt": "2026-10-20",
      "repoUpdatedAt": "2026-10-20",
      "lastCodeChangeAt": "2026-10-20"
    },
    {
      "id": "xl.fe.pollPayResult",
      "projectId": "xinglian",
      "name": "pollPaymentResult",
      "signature": "pollPaymentResult(payOrderId: string, opts: { maxWaitMs?: number; intervalMs?: number }): Promise<PayTerminalView>",
      "layer": "frontend",
      "stack": "Vue 3 + TypeScript",
      "module": "支付结果",
      "summary": "渠道页返回后按退避间隔查询支付终态，把「处理中」收敛为成功/失败/关闭，避免用户误判重复支付。",
      "what": {
        "params": [
          {
            "name": "payOrderId",
            "type": "string",
            "desc": "支付单号，来自提交响应或回调状态查询"
          },
          {
            "name": "opts.maxWaitMs",
            "type": "number",
            "desc": "最长等待时间，默认 90_000"
          }
        ],
        "returns": "PayTerminalView：{ state: 'SUCCESS' | 'FAILED' | 'CLOSED' | 'PENDING', channelTradeNo, paidAt }",
        "sideEffects": [
          "按退避间隔发起 GET 查询",
          "写 pay_result_poll 埋点",
          "终态后停止定时器并清理组件卸载监听"
        ],
        "callers": [
          "PayResultPage",
          "CheckoutCashier"
        ]
      },
      "why": {
        "scenarios": [
          "渠道支付页关闭后回到商户结果页",
          "渠道异步通知延迟或丢失",
          "用户反复刷新结果页"
        ],
        "problemsSolved": [
          "不依赖渠道 SDK 回调即可拿到终态",
          "把无限 loading 收敛成明确的 PENDING 文案",
          "避免用户以为没付成功而重复支付"
        ],
        "preconditions": [
          "状态查询接口对 PENDING 读主库",
          "渠道主动查单接口有频率上限保护",
          "页面卸载能取消定时器"
        ],
        "layerReason": "渠道页与商户页是两个独立上下文，只有前端能在用户回到页面时发起并停止状态收敛；后端只能被动响应查询。",
        "counterExample": {
          "title": "只信渠道 SDK 的同步返回",
          "desc": "用户直接关闭渠道页导致同步回调永远不来，结果页卡在 loading，用户重复支付产生第二笔扣款。",
          "code": "channelPay(credential).then(showSuccess); // 用户关页即丢失终态"
        }
      },
      "alternatives": [
        {
          "name": "WebSocket / SSE 服务端推送终态",
          "layer": "frontend",
          "pros": [
            "秒级到达",
            "无轮询开销"
          ],
          "cons": [
            "需维护长连接与断线重连",
            "渠道回调延迟时仍要兜底"
          ],
          "whenToUse": "商户有统一长连接网关且结果页停留时长高",
          "migrationCost": "中（4 人日）",
          "affectedLayers": [
            "frontend",
            "bff",
            "infra"
          ],
          "codeSnippet": "const es = new EventSource('/pay/stream/' + payOrderId);\nes.onmessage = e => render(JSON.parse(e.data));"
        },
        {
          "name": "完全交给渠道页跳转回传参数",
          "layer": "frontend",
          "pros": [
            "零接口成本"
          ],
          "cons": [
            "回传参数可伪造",
            "关页即丢失"
          ],
          "whenToUse": "仅作辅助提示，不得作为唯一事实源",
          "migrationCost": "低",
          "affectedLayers": [
            "frontend"
          ],
          "codeSnippet": "const q = new URLSearchParams(location.search); render(q.get('result')); // 不可信"
        }
      ],
      "comparisonConclusion": "当渠道回调可能延迟或用户会关闭渠道页时选当前「退避轮询 + 主库状态查询」；若团队已有统一长连接网关且结果页停留时长高，则改用 SSE 推送终态但仍保留轮询兜底；只有在仅作辅助提示的场景下，才允许读取渠道页回传参数，任何条件下都不得把它当作支付终态的事实源。",
      "fallback": [
        {
          "layer": "frontend",
          "failureMode": "轮询一直返回 PENDING",
          "strategy": "达到 maxWaitMs 后展示「处理中 + 订单查询入口」，停止轮询，禁止引导重新支付",
          "codeSnippet": "if (Date.now() - start > maxWaitMs) { stop(); showPendingWithOrderLink(outTradeNo); }",
          "monitoring": "result_poll_pending_over_90s"
        },
        {
          "layer": "bff",
          "failureMode": "状态查询命中旧缓存",
          "strategy": "PENDING 记录强制读主库并禁用 CDN/网关缓存，响应带 no-store",
          "codeSnippet": "w.Header().Set('Cache-Control', 'no-store');\ns, _ := masterRepo.FindByPayOrderID(ctx, id);",
          "monitoring": "status_stale_read_count"
        },
        {
          "layer": "backend",
          "failureMode": "渠道主动查单被限频",
          "strategy": "后端按 payOrderId 合并并发查单请求，结果缓存 2s，前端轮询不直接打渠道",
          "codeSnippet": "v, _ := singleflight.Do(id, func() (any, error) { return channel.Query(ctx, id) });",
          "monitoring": "channel_query_qps、singleflight_merge_ratio"
        },
        {
          "layer": "data",
          "failureMode": "同一 payOrderId 出现两个终态",
          "strategy": "以支付单状态机的单向流转为准，重复回调只更新一次终态时间",
          "codeSnippet": "UPDATE pay_order SET state=? WHERE pay_order_id=? AND state='PENDING';",
          "monitoring": "terminal_double_write_blocked"
        },
        {
          "layer": "infra",
          "failureMode": "渠道查单接口整体不可用",
          "strategy": "降级为本地支付单状态 + 提示「以账单为准」，并触发日终对账补单",
          "codeSnippet": "if channelDown { return localState(ctx, id); enqueueRecon(id); }",
          "monitoring": "channel_query_unavailable_total"
        }
      ],
      "pitfalls": [
        "轮询必须带抖动，否则渠道回调恢复瞬间把状态接口打满",
        "组件卸载要 clearInterval，否则后台持续请求",
        "PENDING 是合法中间态，不能渲染成失败",
        "渠道回传参数没有验签，只能当作提示"
      ],
      "tags": [
        "支付结果",
        "轮询",
        "终态收敛",
        "前端"
      ],
      "repoPath": "apps/pay/web/src/payment/pollResult.ts",
      "links": {
        "upstream": [
          "xl.fe.submitPayment"
        ],
        "downstream": [
          "xl.be.verifyCallback"
        ],
        "related": [
          "xl.be.publishPayEvent"
        ]
      },
      "examples": [
        {
          "scene": "带退避与超时的结果轮询",
          "code": "const t = setInterval(async () => {\n  const v = await api.get('/pay/orders/' + id + '/state');\n  if (v.state !== 'PENDING') { clearInterval(t); render(v); }\n}, jitter(1500));",
          "explain": "抖动间隔避免大量用户同时轮询打满状态接口。"
        }
      ],
      "updatedAt": "2026-09-08",
      "repoUpdatedAt": "2026-09-08",
      "lastCodeChangeAt": "2026-09-08"
    },
    {
      "id": "xl.bff.createPayIntent",
      "projectId": "xinglian",
      "name": "createPaymentIntent",
      "signature": "CreatePaymentIntent(ctx context.Context, req *CreatePayIntentReq) (*PayIntentReply, error)",
      "layer": "bff",
      "stack": "Go + gRPC-Gateway + JWT",
      "module": "统一收单",
      "summary": "收单聚合入口：校验商户签名与金额、签发商户订单号、透传幂等键，并把请求收敛到后端支付领域服务。",
      "what": {
        "params": [
          {
            "name": "req.MerchantID",
            "type": "string",
            "desc": "商户标识，来自 JWT 与签名双重校验"
          },
          {
            "name": "req.AmountFen / Currency",
            "type": "int64 / string",
            "desc": "金额与币种，金额以分为单位"
          },
          {
            "name": "Idempotency-Key",
            "type": "header",
            "desc": "必需，缺失或格式非法直接拒绝"
          }
        ],
        "returns": "PayIntentReply：{ OutTradeNo, PayOrderId, AmountFen, ExpireAt, Sign }",
        "sideEffects": [
          "写收单审计日志",
          "调限额/风控前置校验",
          "透传幂等键到后端领域服务"
        ],
        "callers": [
          "CheckoutCashier / 商户服务端 SDK"
        ]
      },
      "why": {
        "scenarios": [
          "多端收银台与商户服务端直连需要一致收单语义",
          "下单瞬间需要复核金额与商户权限",
          "幂等键需要统一入口校验"
        ],
        "problemsSolved": [
          "商户不必各自实现签名与金额校验",
          "商户订单号由服务端签发，杜绝客户端伪造",
          "把鉴权、限额校验、幂等透传收敛到一次往返"
        ],
        "preconditions": [
          "网关已注入商户身份与租户",
          "风控限额服务可用或可 fail-closed",
          "幂等键符合 merchantId:outTradeNo 规范"
        ],
        "layerReason": "收单是外部商户与内部领域服务的边界，BFF 同时持有会话/签名校验与服务发现能力；后端领域服务不应理解多端接入差异与商户鉴权。",
        "counterExample": {
          "title": "商户服务端直连渠道下单",
          "desc": "每个接入方各自实现签名、金额校验与商户订单号生成，出现多个版本的不一致逻辑，且无法统一防重放窗口。",
          "code": "go channel.Create(order); // 各商户各自拼报文，无统一收单"
        }
      },
      "alternatives": [
        {
          "name": "GraphQL 收单聚合",
          "layer": "bff",
          "pros": [
            "端上按需取字段"
          ],
          "cons": [
            "引入 schema 治理与限流复杂度"
          ],
          "whenToUse": "接入端 ≥ 4 类且返回字段差异很大",
          "migrationCost": "高（5 人日）",
          "affectedLayers": [
            "frontend",
            "bff"
          ],
          "codeSnippet": "mutation { createPayIntent(input: $in) { outTradeNo credential } }"
        },
        {
          "name": "后端领域服务直接对商户暴露",
          "layer": "backend",
          "pros": [
            "链路最短"
          ],
          "cons": [
            "领域服务被商户视图与鉴权逻辑污染",
            "无法统一防重放"
          ],
          "whenToUse": "仅单一内部商户且已有统一网关鉴权",
          "migrationCost": "中（2 人日）",
          "affectedLayers": [
            "bff",
            "backend"
          ],
          "codeSnippet": "// 领域服务直接读 JWT 并返回商户视图"
        }
      ],
      "comparisonConclusion": "当存在多端接入且各端返回字段不同时选当前 BFF 收单聚合并做金额复核；若接入端达到 4 类以上且字段差异很大，则可升级为 GraphQL 收单聚合；只有在仅单一内部商户且已有统一网关鉴权的条件下，才允许领域服务直接对商户暴露；任何情况下都不得让前端自行签发商户订单号。",
      "fallback": [
        {
          "layer": "frontend",
          "failureMode": "预下单响应超时",
          "strategy": "沿用同一幂等键查询既有支付单，不再发起新的创建请求",
          "codeSnippet": "const existing = await api.get('/pay/intents?key=' + key);\nif (existing) return existing;",
          "monitoring": "intent_timeout_poll_total"
        },
        {
          "layer": "bff",
          "failureMode": "风控限额服务超时",
          "strategy": "fail-closed 返回明确错误码，绝不按前端传来的金额放行",
          "codeSnippet": "if !riskOK { return nil, status.Error(codes.Unavailable, 'RISK_UNAVAILABLE') } // 禁止默认放行",
          "monitoring": "risk_timeout_total、fail_open_blocked"
        },
        {
          "layer": "backend",
          "failureMode": "领域服务返回 5xx",
          "strategy": "带同一幂等键有限重试 1 次，仍失败返回可查询状态而非重新生成商户订单号",
          "codeSnippet": "return retryOnce(ctx, func() (*PayIntentReply, error) { return core.Create(ctx, req, key) });",
          "monitoring": "core_5xx_total、intent_retry_success"
        },
        {
          "layer": "data",
          "failureMode": "幂等键被 BFF 改写导致去重失效",
          "strategy": "记录原始键与透传键并断言一致，不一致直接告警并拒绝",
          "codeSnippet": "audit.AssertEqual(rawKey, forwardedKey); // 不等则 return error",
          "monitoring": "idem_key_mismatch_blocked"
        },
        {
          "layer": "infra",
          "failureMode": "大促流量冲垮收单网关",
          "strategy": "按商户维度令牌桶 + 预下单接口独立并发隔离，避免 429 触发商户反复提交",
          "codeSnippet": "bulkhead('pay-intent', { concurrency: 400 });\nrateLimit({ key: merchantID, rps: 50 });",
          "monitoring": "gateway_threadpool_saturation、intent_429_rate"
        }
      ],
      "pitfalls": [
        "幂等键缺失必须拒绝，不能自动生成，否则防重失效",
        "金额复核结果要写进请求上下文，别让后端二次按前端金额计算",
        "商户订单号必须服务端签发并设置过期时间",
        "聚合超时重试必须沿用原键，不得换商户订单号"
      ],
      "tags": [
        "统一收单",
        "预下单",
        "BFF",
        "商户鉴权",
        "幂等"
      ],
      "repoPath": "apps/pay/gateway/src/intent/create.go",
      "links": {
        "upstream": [
          "xl.fe.submitPayment"
        ],
        "downstream": [
          "xl.bff.rateLimitPayment",
          "xl.be.createPayOrder"
        ],
        "related": [
          "xl.be.routeChannel"
        ]
      },
      "examples": [
        {
          "scene": "强制校验幂等键并签发商户订单号",
          "code": "key := r.Header.Get('Idempotency-Key')\nif key == '' { return nil, status.Error(codes.InvalidArgument, 'KEY_REQUIRED') }\noutTradeNo := idgen.MerchantOrderNo(req.MerchantID)\nreturn core.Create(ctx, req, outTradeNo, key)",
          "explain": "把防重前置到入口，商户订单号由服务端确定性签发。"
        }
      ],
      "updatedAt": "2026-09-20",
      "repoUpdatedAt": "2026-11-06",
      "lastCodeChangeAt": "2026-11-06"
    },
    {
      "id": "xl.bff.rateLimitPayment",
      "projectId": "xinglian",
      "name": "rateLimitPayment",
      "signature": "rateLimitPayment(ctx context.Context, key RateKey) (*RateDecision, error)",
      "layer": "bff",
      "stack": "Go + Redis + Lua",
      "module": "收单限流",
      "summary": "按商户 + 接口 + 渠道三维度做令牌桶限流，拦截超顿提交与渠道探测，避免把流量压到后端领域服务。",
      "what": {
        "params": [
          {
            "name": "key.MerchantID",
            "type": "string",
            "desc": "商户维度，防止单商户打满共享桶"
          },
          {
            "name": "key.Channel",
            "type": "string",
            "desc": "渠道维度，防止单渠道故障时重放风暴"
          }
        ],
        "returns": "RateDecision：{ allowed, remaining, retryAfterMs }",
        "sideEffects": [
          "Redis 令牌桶扣减",
          "写限流审计与告警计数"
        ],
        "callers": [
          "createPaymentIntent"
        ]
      },
      "why": {
        "scenarios": [
          "大促首分钟提交峰值",
          "商户 SDK 缺陷导致无限重试",
          "渠道超时后用户反复点击"
        ],
        "problemsSolved": [
          "把超顿流量挡在领域服务之外",
          "429 携带 Retry-After 让客户端有序退避",
          "按渠道隔离，避免单渠道故障拖垮全部收单"
        ],
        "preconditions": [
          "Redis Lua 令牌桶脚本原子执行",
          "桶参数由配置中心下发",
          "时钟以服务端为准"
        ],
        "layerReason": "限流需要感知商户身份与接入端来源，只有收单边界层同时具备这两类上下文；后端领域服务无法区分流量归属。",
        "counterExample": {
          "title": "只在应用入口做全局单机限流",
          "desc": "多实例各自计数，实际阈值随实例数成倍放大；渠道超时引发的重试风暴仍全部穿透到后端。",
          "code": "var counter int64 // 进程内计数，多实例失效"
        }
      },
      "alternatives": [
        {
          "name": "网关层固定窗口计数",
          "layer": "infra",
          "pros": [
            "零业务侵入",
            "配置简单"
          ],
          "cons": [
            "窗口边界易被突发打穿",
            "无法按商户维度隔离"
          ],
          "whenToUse": "只需粗粒度兜底且无需商户级配额",
          "migrationCost": "低（1 人日）",
          "affectedLayers": [
            "infra"
          ],
          "codeSnippet": "limit_req_zone $binary_remote_addr zone=pay:10m rate=50r/s;"
        },
        {
          "name": "自适应限流（按后端延迟动态调整）",
          "layer": "bff",
          "pros": [
            "能跟随后端容量自动收紧"
          ],
          "cons": [
            "调参复杂",
            "抖动期易误杀"
          ],
          "whenToUse": "后端容量随渠道波动明显且有成熟指标体系",
          "migrationCost": "高（6 人日）",
          "affectedLayers": [
            "bff",
            "backend",
            "infra"
          ],
          "codeSnippet": "if p99 > 800*time.Millisecond { shrink(rate, 0.8) }"
        }
      ],
      "comparisonConclusion": "当需要按商户与渠道隔离且要求客户端有序退避时选当前 Redis Lua 令牌桶；若只需粗粒度兜底且不关心商户级配额，则可退化为网关固定窗口计数；只有在后端容量随渠道剧烈波动且已有成熟指标体系时，才升级为自适应限流；任何条件下都不得用进程内单机计数替代分布式限流。",
      "fallback": [
        {
          "layer": "frontend",
          "failureMode": "用户收到 429 后反复点击",
          "strategy": "按 Retry-After 置灰按钮并倒计时，倒计时结束前不释放提交入口",
          "codeSnippet": "const ra = Number(res.headers['retry-after']) * 1000;\ndisableFor(ra); // 期间不发起任何请求",
          "monitoring": "client_429_retry_suppressed"
        },
        {
          "layer": "bff",
          "failureMode": "Redis 不可用导致限流整体失效",
          "strategy": "降级为本地令牌桶 + 单实例保守上限，并立刻告警，绝不无限放行",
          "codeSnippet": "if redisDown { return localBucket.Allow(key, conservativeCap) } // 禁止 fail-open",
          "monitoring": "ratelimit_redis_down_total、degrade_active"
        },
        {
          "layer": "backend",
          "failureMode": "限流放行但领域服务已过载",
          "strategy": "后端以并发隔离舱作为第二道，超并发直接返回可重试错误",
          "codeSnippet": "if !bulkhead.TryAcquire() { return status.Error(codes.ResourceExhausted, 'CORE_BUSY') }",
          "monitoring": "core_bulkhead_reject_total"
        },
        {
          "layer": "data",
          "failureMode": "令牌桶脚本在 Redis 主从切换后丢计数",
          "strategy": "桶状态按短 TTL 可重建，切换后由配置中心重新下发阈值并跑一次核对",
          "codeSnippet": "SET ratelimit:config ${cfg} EX 300 // 切换后重新拉取，避免魔法数字",
          "monitoring": "ratelimit_config_reloaded"
        },
        {
          "layer": "infra",
          "failureMode": "单商户配额被误配为全局共享",
          "strategy": "配置中心对桶 key 模板做租户占位符校验，CI 拦截缺 merchantID 的配置",
          "codeSnippet": "assert(strings.Contains(tpl, '{merchantID}'), 'bucket key 缺少商户维度');",
          "monitoring": "ratelimit_config_invalid_blocked"
        }
      ],
      "pitfalls": [
        "429 必须带 Retry-After，否则客户端会立即重试形成风暴",
        "Lua 脚本要把取令牌与扣减放在一次原子调用里",
        "桶参数禁止硬编码，配置中心下发并留审计",
        "限流降级要 fail-closed，宁可少放不能全放"
      ],
      "tags": [
        "限流",
        "令牌桶",
        "Redis",
        "BFF",
        "收单"
      ],
      "repoPath": "apps/pay/gateway/src/limit/pay_limit.go",
      "links": {
        "upstream": [
          "xl.bff.createPayIntent"
        ],
        "downstream": [
          "xl.be.createPayOrder"
        ],
        "related": [
          "xl.be.routeChannel"
        ]
      },
      "examples": [
        {
          "scene": "按商户维度的 Lua 令牌桶",
          "code": "allowed, err := bucket.Allow(ctx, fmt.Sprintf('pay:%s:%s', merchantID, channel))\nif !allowed {\n  return &RateDecision{RetryAfterMs: 800}, status.Error(codes.ResourceExhausted, 'RATE_LIMITED')\n}",
          "explain": "商户与渠道同时进 key，单渠道故障不会挤占其它商户的配额。"
        }
      ],
      "updatedAt": "2026-08-15",
      "repoUpdatedAt": "2026-08-15",
      "lastCodeChangeAt": "2026-08-15"
    },
    {
      "id": "xl.be.routeChannel",
      "projectId": "xinglian",
      "name": "routePayChannel",
      "signature": "routePayChannel(ctx context.Context, cmd RouteCmd) (*ChannelDecision, error)",
      "layer": "backend",
      "stack": "Go + gRPC + Redis",
      "module": "渠道路由",
      "summary": "按支付方式的成功率、费率、限额与渠道健康度选择实际受理渠道，并给出熔断与降级决策。",
      "what": {
        "params": [
          {
            "name": "cmd.Method",
            "type": "string",
            "desc": "支付方式：WECHAT / ALIPAY / UNIONPAY / BALANCE"
          },
          {
            "name": "cmd.AmountFen",
            "type": "int64",
            "desc": "金额，参与单笔限额与费率计算"
          }
        ],
        "returns": "ChannelDecision：{ channelCode, feeRateBps, fallbackChain, reason }",
        "sideEffects": [
          "读渠道健康度滑动窗口",
          "写路由决策审计",
          "命中熔断时降级到备用渠道"
        ],
        "callers": [
          "createPayOrder / 渠道受理补单"
        ]
      },
      "why": {
        "scenarios": [
          "同一支付方式有多个可选渠道",
          "某渠道网关超时率突然升高",
          "大促期间渠道单笔/日累计限额触顶"
        ],
        "problemsSolved": [
          "避免把流量持续打到故障渠道",
          "在费率与成功率之间按可配置权重取最优",
          "决策可审计，事后能对账为什么选了某渠道"
        ],
        "preconditions": [
          "渠道健康度指标延迟 ≤ 30s",
          "限额与费率配置已下发",
          "熔断窗口与半开探测已配置"
        ],
        "layerReason": "路由决策依赖渠道实时健康度、费率与限额等内部状态，只有领域层能在创建支付单的事务上下文里确定并固化 channelCode；BFF 不应持有渠道内部指标。",
        "counterExample": {
          "title": "客户端指定渠道且后端无熔断",
          "desc": "某渠道网关超时率飙到 40% 仍持续受理，超时后用户重试产生多笔渠道下单，最终重复扣款。",
          "code": "channel := req.Channel // 直接信任入参，无健康度校验"
        }
      },
      "alternatives": [
        {
          "name": "固定渠道直连",
          "layer": "backend",
          "pros": [
            "实现最简单",
            "无路由表维护"
          ],
          "cons": [
            "渠道故障即全量失败",
            "无法按费率优化"
          ],
          "whenToUse": "单一渠道签约且无备用通道的内部业务",
          "migrationCost": "低（1 人日）",
          "affectedLayers": [
            "backend"
          ],
          "codeSnippet": "return &ChannelDecision{ChannelCode: 'WECHAT_DIRECT'}, nil"
        },
        {
          "name": "独立渠道决策服务",
          "layer": "infra",
          "pros": [
            "多业务线复用",
            "可独立扩缩容"
          ],
          "cons": [
            "多一跳 RPC",
            "跨服务一致性要额外设计"
          ],
          "whenToUse": "已有多条业务线共用同一批渠道且路由规则频繁变化",
          "migrationCost": "高（6 人日）",
          "affectedLayers": [
            "backend",
            "infra"
          ],
          "codeSnippet": "resp, _ := routerSvc.Decide(ctx, &DecideReq{...}); // 独立 gRPC 服务"
        },
        {
          "name": "静态权重轮询",
          "layer": "backend",
          "pros": [
            "无需实时指标"
          ],
          "cons": [
            "故障渠道仍分到流量",
            "无法感知限额"
          ],
          "whenToUse": "渠道质量长期稳定且无实时指标可用时",
          "migrationCost": "中（2 人日）",
          "affectedLayers": [
            "backend"
          ],
          "codeSnippet": "idx := atomic.AddUint64(&rr, 1) % uint64(len(channels));"
        }
      ],
      "comparisonConclusion": "当同一支付方式有多个渠道且健康度指标可用时选当前「成功率 + 费率 + 限额 + 熔断」动态路由；若只有单一签约渠道且无备用通道，则退化为固定渠道直连；只有在已有多条业务线共用渠道且规则频繁变化的条件下，才下沉为独立渠道决策服务；任何情况下都不得直接信任客户端传入的渠道编码。",
      "fallback": [
        {
          "layer": "frontend",
          "failureMode": "选定渠道的收银台控件加载失败",
          "strategy": "结果页提供「更换支付方式」入口，复用同一商户订单号重新发起路由，不新建支付单",
          "codeSnippet": "await api.post('/pay/orders/' + outTradeNo + '/reroute'); // 沿用原单",
          "monitoring": "cashier_channel_switch_total"
        },
        {
          "layer": "bff",
          "failureMode": "路由服务返回的 channelCode 不在白名单",
          "strategy": "BFF 校验渠道白名单后再透传给前端，非法值直接拒绝并告警",
          "codeSnippet": "if !whitelist.Has(decision.ChannelCode) { return error('CHANNEL_NOT_ALLOWED') }",
          "monitoring": "route_invalid_channel_blocked"
        },
        {
          "layer": "backend",
          "failureMode": "健康度指标缺失或过期",
          "strategy": "超过 30s 未更新的指标视为不可用，降级到保守的固定权重并告警",
          "codeSnippet": "if time.Since(h.UpdatedAt) > 30*time.Second { return conservativeWeights() }",
          "monitoring": "route_stale_health_total"
        },
        {
          "layer": "data",
          "failureMode": "路由决策与支付单落库不一致",
          "strategy": "channelCode 与 routeReason 随支付单同事务写入，禁止事后补写",
          "codeSnippet": "tx.ExecContext(ctx, `INSERT INTO pay_order(..., channel_code, route_reason) VALUES(...,?,?)`, code, reason);",
          "monitoring": "route_order_mismatch_total"
        },
        {
          "layer": "infra",
          "failureMode": "熔断窗口内仍持续重投故障渠道",
          "strategy": "熔断期间把该渠道从候选集移除并进半开探测队列，禁止重投渠道下单",
          "codeSnippet": "if breaker.IsOpen(code) { exclude(code); halfOpenProbe(code) } // 不 retry 该渠道",
          "monitoring": "breaker_open_retry_blocked"
        }
      ],
      "pitfalls": [
        "channelCode 必须随支付单落库，事后补写会让对账找不到依据",
        "健康度指标要带更新时间，过期数据比没有更危险",
        "熔断后禁止对同一渠道重投渠道下单，只能换渠道或关单",
        "费率用基点(bps)整数存储，别用浮点"
      ],
      "tags": [
        "渠道路由",
        "熔断",
        "费率",
        "限额",
        "决策审计"
      ],
      "repoPath": "apps/pay/core/src/route/channel.go",
      "links": {
        "upstream": [
          "xl.be.createPayOrder"
        ],
        "downstream": [
          "xl.be.publishPayEvent"
        ],
        "related": [
          "xl.bff.rateLimitPayment",
          "xl.be.verifyCallback"
        ]
      },
      "examples": [
        {
          "scene": "按健康度与费率打分选渠道",
          "code": "for _, c := range candidates {\n  if breaker.IsOpen(c.Code) { continue }\n  score := 0.6*successRate(c) + 0.3*(1-feeBps(c)/10000) + 0.1*headroom(c)\n  if score > best.score { best = c }\n}\nreturn best, nil",
          "explain": "熔断渠道直接剔除，打分结果随支付单落库便于事后对账。"
        }
      ],
      "decisionTree": {
        "questions": [
          {
            "id": "q1",
            "question": "同一支付方式是否有多个可选渠道且健康度指标可用？",
            "options": [
              {
                "label": "是",
                "value": "multi",
                "next": "q2"
              },
              {
                "label": "否，单渠道",
                "value": "single",
                "next": "END"
              }
            ]
          },
          {
            "id": "q2",
            "question": "是否已有多条业务线共用渠道且规则频繁变化？",
            "options": [
              {
                "label": "是",
                "value": "shared",
                "next": "END"
              },
              {
                "label": "否",
                "value": "local",
                "next": "END"
              }
            ]
          }
        ],
        "rules": [
          {
            "when": {
              "q1": "single"
            },
            "result": "固定渠道直连",
            "reason": "只有单一签约渠道时，动态路由没有决策空间。"
          },
          {
            "when": {
              "q1": "multi",
              "q2": "shared"
            },
            "result": "独立渠道决策服务",
            "reason": "多业务线共用且规则频繁变化，独立服务可复用并独立扩缩容。"
          },
          {
            "when": {
              "q1": "multi",
              "q2": "local"
            },
            "result": "保留当前进程内动态路由",
            "reason": "单业务线多场景，进程内路由延迟最低且事务内可固化决策。"
          }
        ],
        "defaultResult": "保留当前进程内动态路由",
        "defaultReason": "默认多渠道且需要健康度决策。"
      },
      "updatedAt": "2026-10-02",
      "repoUpdatedAt": "2026-10-02",
      "lastCodeChangeAt": "2026-10-28"
    },
    {
      "id": "xl.be.createPayOrder",
      "projectId": "xinglian",
      "name": "createOrder",
      "signature": "createOrder(ctx context.Context, cmd CreatePayOrderCmd, tx *sql.Tx) (*PayOrder, error)",
      "layer": "backend",
      "stack": "Go + MySQL 8 + sql.Tx",
      "module": "支付单",
      "summary": "领域层创建支付单聚合：金额以分为单位校验、固化渠道决策，并在同一事务内写支付单主档与 Outbox 事件。",
      "what": {
        "params": [
          {
            "name": "cmd.OutTradeNo",
            "type": "string",
            "desc": "服务端签发的商户订单号，带 (merchant_id, out_trade_no) 唯一约束"
          },
          {
            "name": "cmd.AmountFen",
            "type": "int64",
            "desc": "复核后的金额，单位分"
          },
          {
            "name": "tx",
            "type": "*sql.Tx",
            "desc": "与 Outbox 共用的事务上下文"
          }
        ],
        "returns": "PayOrder 聚合：{ PayOrderId, State, ChannelCode, AmountFen, OutboxEventId }",
        "sideEffects": [
          "写 pay_order 主档",
          "固化 channelCode / routeReason",
          "写 outbox 事件（同事务）"
        ],
        "callers": [
          "withIdempotency / CreatePaymentIntent"
        ]
      },
      "why": {
        "scenarios": [
          "收银台确认支付后创建支付单",
          "渠道回调先于业务落库到达时的补单"
        ],
        "problemsSolved": [
          "支付单主档与 Outbox 事件要么全成功要么全回滚",
          "金额以复核后的分为准，不受下游渠道报价波动影响",
          "渠道决策随单固化，事后可解释为什么走这个渠道"
        ],
        "preconditions": [
          "金额已由 BFF 复核",
          "幂等占位已成功",
          "(merchant_id, out_trade_no) 唯一索引已建"
        ],
        "layerReason": "支付单聚合与渠道决策的一致性属于领域事务边界，金额以分为单位落库与 Outbox 同事务写入只能由领域层保证；BFF 无法持有数据库事务，也不能让消息先于数据落库。",
        "counterExample": {
          "title": "先写支付单再异步发事件",
          "desc": "进程在两者之间崩溃，事件已发出但支付单回滚，清结算按不存在的支付单记账；或支付单成功但事件丢失，渠道回调永远无法收敛。",
          "code": "repo.Save(order); kafka.Send(event); // 非事务，存在中间态"
        }
      },
      "alternatives": [
        {
          "name": "Saga 分步事务",
          "layer": "backend",
          "pros": [
            "跨服务长事务可补偿"
          ],
          "cons": [
            "补偿逻辑复杂",
            "最终一致"
          ],
          "whenToUse": "渠道受理与账务分属不同服务且无法同库事务",
          "migrationCost": "高（8 人日）",
          "affectedLayers": [
            "backend",
            "data",
            "infra"
          ],
          "codeSnippet": "saga.Step(reserveChannel).Compensate(closeChannel).Step(createPayOrder);"
        },
        {
          "name": "存储过程写支付单",
          "layer": "data",
          "pros": [
            "少一次网络往返"
          ],
          "cons": [
            "业务逻辑沉入数据库难维护",
            "难以做单元测试"
          ],
          "whenToUse": "遗留账务系统且无法改造应用层",
          "migrationCost": "中（3 人日）",
          "affectedLayers": [
            "backend",
            "data"
          ],
          "codeSnippet": "CALL sp_create_pay_order(?, ?, ?);"
        }
      ],
      "comparisonConclusion": "当支付单主档与 Outbox 在同一数据库且需强一致时选当前「聚合根 + 单事务 + Outbox」；若渠道受理与账务分属不同服务且无法共库，则改用 Saga 分步事务并明确补偿动作；只有在遗留账务系统无法改造应用层的条件下，才允许存储过程写单；任何条件下都不得把事件发送放在事务之外。",
      "fallback": [
        {
          "layer": "frontend",
          "failureMode": "创建支付单失败但渠道可能已受理",
          "strategy": "展示带剩余时间的「处理中」，由支付单 TTL 与渠道主动查单收敛，禁止引导用户重新支付",
          "codeSnippet": "showPending({ outTradeNo, ttlSec: 120 }); // 不重建支付单",
          "monitoring": "ui_pending_pay_order_total"
        },
        {
          "layer": "bff",
          "failureMode": "后端已提交但响应丢失",
          "strategy": "按幂等键查询既有支付单并原样返回，不触发二次创建",
          "codeSnippet": "existing, _ := core.FindByIdempotencyKey(ctx, key)\nif existing != nil { return existing.ToReply(), nil }",
          "monitoring": "create_response_lost_recovered"
        },
        {
          "layer": "backend",
          "failureMode": "事务提交后 Outbox 投递失败",
          "strategy": "Outbox 表保持 PENDING，Relay 指数退避补投，消息至少一次投递且消费侧按 eventId 去重",
          "codeSnippet": "tx.ExecContext(ctx, `INSERT INTO outbox(event_id, aggregate_id, payload, status) VALUES(?,?,?,'PENDING')`, eid, id, payload);\n// relay 每 5s 扫 PENDING",
          "monitoring": "outbox_unsent_age、补投成功率"
        },
        {
          "layer": "data",
          "failureMode": "(merchant_id, out_trade_no) 唯一索引冲突",
          "strategy": "捕获唯一键冲突转为幂等命中，返回既有支付单，绝不新建第二笔",
          "codeSnippet": "if errors.Is(err, mysql.ErrDupEntry) { return repo.FindByOutTradeNo(ctx, merchantID, no) }",
          "monitoring": "duplicate_key_hit_total"
        },
        {
          "layer": "infra",
          "failureMode": "数据库主库故障切换",
          "strategy": "切换窗口内拒绝写请求并返回可重试状态，禁止自动重放写操作",
          "codeSnippet": "if !primaryHealthy { return status.Error(codes.Unavailable, 'WRITE_UNAVAILABLE') }",
          "monitoring": "db_failover_writes_rejected"
        }
      ],
      "pitfalls": [
        "Outbox 事件必须与支付单写在同一个 sql.Tx 里",
        "不要在事务内做渠道 RPC，锁会被远程延迟拖住",
        "金额一律 int64 分，禁止 float",
        "唯一索引必须建在 (merchant_id, out_trade_no) 而不是 pay_order_id"
      ],
      "tags": [
        "支付单",
        "事务",
        "聚合根",
        "Outbox",
        "唯一索引"
      ],
      "repoPath": "apps/pay/core/src/order/create.go",
      "links": {
        "upstream": [
          "xl.bff.createPayIntent",
          "xl.bff.rateLimitPayment",
          "xl.be.idempotentGuard"
        ],
        "downstream": [
          "xl.be.routeChannel",
          "xl.be.publishPayEvent"
        ],
        "related": [
          "xl.data.reconcile"
        ]
      },
      "examples": [
        {
          "scene": "支付单与 Outbox 事件同事务写入",
          "code": "tx, _ := db.BeginTx(ctx, nil)\no := PayOrder{OutTradeNo: cmd.OutTradeNo, AmountFen: cmd.AmountFen, ChannelCode: decision.Code}\nrepo.Insert(ctx, tx, &o)\noutbox.Insert(ctx, tx, PaymentAccepted{EventID: uuid(), PayOrderID: o.ID})\nif err := tx.Commit(); err != nil { tx.Rollback(); return nil, err }",
          "explain": "事件落库而非直接发送，避免事务与消息之间的中间态。"
        }
      ],
      "updatedAt": "2026-09-30",
      "repoUpdatedAt": "2026-09-30",
      "lastCodeChangeAt": "2026-09-30"
    },
    {
      "id": "xl.be.idempotentGuard",
      "projectId": "xinglian",
      "name": "withIdempotency",
      "signature": "withIdempotency[T any](ctx context.Context, key string, ttl time.Duration, fn func(context.Context) (T, error)) (IdemResult[T], error)",
      "layer": "backend",
      "stack": "Go + Redis (Lua) + MySQL",
      "module": "支付幂等",
      "summary": "以商户订单号派生键包裹渠道受理，用 Lua 状态机区分执行中/已完成，重放返回首次支付单与渠道流水号。",
      "what": {
        "params": [
          {
            "name": "key",
            "type": "string",
            "desc": "merchantId:outTradeNo 派生的全局幂等键"
          },
          {
            "name": "ttl",
            "type": "time.Duration",
            "desc": "占位保留时长，需大于渠道最大受理超时"
          }
        ],
        "returns": "IdemResult[T]：{ value, replayed, state, channelTradeNo }",
        "sideEffects": [
          "Redis Lua 原子占位",
          "写幂等结果快照",
          "记录冲突与重放审计"
        ],
        "callers": [
          "createPayOrder / verifyChannelCallback"
        ]
      },
      "why": {
        "scenarios": [
          "同一商户订单号并发到达多实例",
          "上游超时重投或用户刷新后重试",
          "渠道回调与收单并发到达"
        ],
        "problemsSolved": [
          "并发下只有一个执行体真正发起渠道下单",
          "重放返回首次支付单号与渠道流水号原样",
          "资金级防重绑定商户订单号，而非可变的请求 ID"
        ],
        "preconditions": [
          "Redis Lua 脚本原子执行",
          "结果快照可序列化",
          "MySQL (merchant_id, out_trade_no) 唯一索引作为第二道防线"
        ],
        "layerReason": "资金级防重必须绑定商户订单号并同时持有 Redis 状态机与数据库唯一索引，只有领域层能在渠道受理前原子占位、并把渠道流水号写进结果快照；前端与 BFF 都只能减少触发，无法保证不重复扣款。",
        "counterExample": {
          "title": "先查再写（check-then-act）",
          "desc": "两个并发请求同时查到「无记录」，双双发起渠道下单，渠道侧产生两笔成功流水，商户订单号相同但无法收敛。",
          "code": "if !repo.Exists(ctx, outTradeNo) { repo.Insert(ctx, order) } // 非原子"
        }
      },
      "alternatives": [
        {
          "name": "数据库唯一索引兜底",
          "layer": "data",
          "pros": [
            "最强最终防线",
            "不依赖 Redis"
          ],
          "cons": [
            "只能报错，无法返回首次支付结果"
          ],
          "whenToUse": "作为必配的第二道防线，必须与当前方案叠加",
          "migrationCost": "低（1 人日）",
          "affectedLayers": [
            "backend",
            "data"
          ],
          "codeSnippet": "ALTER TABLE pay_order ADD UNIQUE KEY uk_out_trade_no (merchant_id, out_trade_no);"
        },
        {
          "name": "分布式锁 + 业务查重",
          "layer": "backend",
          "pros": [
            "可复用现有锁组件"
          ],
          "cons": [
            "锁过期时间难定",
            "仍需查重逻辑且无结果快照"
          ],
          "whenToUse": "已有统一锁服务且暂时无法引入结果快照",
          "migrationCost": "中（2 人日）",
          "affectedLayers": [
            "backend"
          ],
          "codeSnippet": "lock, _ := locker.TryLock(ctx, 'idem:'+key, 30*time.Second)\ndefer lock.Release()"
        },
        {
          "name": "渠道受理 MQ 按键串行化",
          "layer": "infra",
          "pros": [
            "同一键天然有序"
          ],
          "cons": [
            "延迟上升",
            "引入异步一致性"
          ],
          "whenToUse": "可接受秒级延迟的异步受理场景",
          "migrationCost": "高（5 人日）",
          "affectedLayers": [
            "backend",
            "infra"
          ],
          "codeSnippet": "mq.Send('pay.accept', msg, pubsub.WithPartitionKey(outTradeNo));"
        }
      ],
      "comparisonConclusion": "当要求同步返回首次受理结果且存在多实例并发时选当前 Lua 状态机幂等；若仅需要最终防重而可接受报错，则数据库唯一索引即可，但必须与当前方案叠加而非替换；只有在已有统一锁服务且无法保存结果快照的条件下，才用分布式锁 + 业务查重；若业务可接受秒级异步延迟，才考虑渠道受理 MQ 按键串行化。",
      "fallback": [
        {
          "layer": "frontend",
          "failureMode": "上游重放时前端拿到 409",
          "strategy": "约定 409 携带首次支付单号与渠道流水号，前端转为结果查询而非报错",
          "codeSnippet": "if (e.code === 'IDEM_HIT') return queryPayOrder(e.payOrderId);",
          "monitoring": "idem_409_converted"
        },
        {
          "layer": "bff",
          "failureMode": "幂等键被改写导致去重失效",
          "strategy": "收单入口记录原始键与透传键并断言一致，不一致直接拒绝并告警",
          "codeSnippet": "audit.AssertEqual(rawKey, forwardedKey); // 不等则 400 + 告警",
          "monitoring": "idem_key_mismatch_alerts"
        },
        {
          "layer": "backend",
          "failureMode": "执行体崩溃，占位永不过期",
          "strategy": "占位带 TTL，由对账任务把超时 PROCESSING 重置或标记 FAILED，结果快照只在事务提交后写",
          "codeSnippet": "// Lua: SET key PROCESSING EX 120 NX\n// reconcile: age > 120s 且无渠道流水 -> FAILED",
          "monitoring": "idem_stuck_processing、对账重置数"
        },
        {
          "layer": "data",
          "failureMode": "Redis 不可用导致幂等整体失效",
          "strategy": "降级为 MySQL 唯一索引拦截，返回 409 并关闭非关键收单入口",
          "codeSnippet": "if redisUnavailable {\n  return db.InsertWithUniqueKey(ctx, outTradeNo, order) // 命中则 409\n}",
          "monitoring": "redis_down_degrade_total"
        },
        {
          "layer": "infra",
          "failureMode": "Redis 主从切换丢占位",
          "strategy": "关键键开启 AOF 每秒刷盘，切换后跑一次幂等记录与渠道流水对账",
          "codeSnippet": "appendfsync everysec\n// post-failover: reconcile idem vs channel_trade",
          "monitoring": "redis_failover_count、idem_record_loss"
        }
      ],
      "pitfalls": [
        "占位 TTL 必须大于渠道最大受理超时，否则并发窗口重新打开",
        "结果快照要在事务提交后再写，否则可能返回一个回滚了的支付单",
        "幂等键必须含商户维度，否则跨商户互相误杀",
        "事故 i.pay.duplicate_charge 的根因是只做了先查再写且唯一索引缺失"
      ],
      "tags": [
        "幂等",
        "防重复扣款",
        "Lua",
        "Redis",
        "唯一索引"
      ],
      "repoPath": "apps/pay/core/src/idem/guard.go",
      "links": {
        "upstream": [
          "xl.bff.createPayIntent"
        ],
        "downstream": [
          "xl.be.createPayOrder"
        ],
        "related": [
          "xl.be.verifyCallback"
        ]
      },
      "examples": [
        {
          "scene": "Lua 原子占位 + 结果快照",
          "code": "res, err := idemScript.Run(ctx, rdb, []string{key}, 'PROCESSING', 120).Int()\nif res == 0 { return replayOrWait(ctx, key) } // 已有执行体或已完成\nv, err := fn(ctx)\nrdb.Set(ctx, key, snapshot(v), 24*time.Hour) // 事务提交后才写\nreturn IdemResult{Value: v}, nil",
          "explain": "Lua 保证只有一个执行体，快照保证重放返回首次渠道流水号。"
        }
      ],
      "decisionTree": {
        "questions": [
          {
            "id": "q1",
            "question": "是否需要同步返回首次受理结果（支付单号 + 渠道流水号）？",
            "options": [
              {
                "label": "是",
                "value": "sync",
                "next": "q2"
              },
              {
                "label": "否，报错即可",
                "value": "error",
                "next": "END"
              }
            ]
          },
          {
            "id": "q2",
            "question": "业务能否接受渠道侧秒级异步最终一致？",
            "options": [
              {
                "label": "能",
                "value": "async",
                "next": "END"
              },
              {
                "label": "不能",
                "value": "realtime",
                "next": "q3"
              }
            ]
          },
          {
            "id": "q3",
            "question": "是否已有统一锁服务且无法保存结果快照？",
            "options": [
              {
                "label": "是",
                "value": "lock",
                "next": "END"
              },
              {
                "label": "否",
                "value": "snapshot",
                "next": "END"
              }
            ]
          }
        ],
        "rules": [
          {
            "when": {
              "q1": "error"
            },
            "result": "数据库唯一索引兜底",
            "reason": "只需最终防重时唯一索引最可靠，但仍建议与 Lua 状态机叠加。"
          },
          {
            "when": {
              "q2": "async"
            },
            "result": "渠道受理 MQ 按键串行化",
            "reason": "可接受异步时，按键分区天然去重且削峰。"
          },
          {
            "when": {
              "q3": "lock"
            },
            "result": "分布式锁 + 业务查重",
            "reason": "无法保存快照时只能靠锁 + 查重近似实现。"
          },
          {
            "when": {
              "q1": "sync",
              "q2": "realtime",
              "q3": "snapshot"
            },
            "result": "保留当前 Lua 状态机幂等",
            "reason": "同步返回首次受理结果是当前方案的独有能力。"
          }
        ],
        "defaultResult": "保留当前 Lua 状态机幂等",
        "defaultReason": "默认资金链路要求同步且结果一致。"
      },
      "updatedAt": "2026-07-18",
      "repoUpdatedAt": "2026-07-18",
      "lastCodeChangeAt": "2026-07-18"
    },
    {
      "id": "xl.be.verifyCallback",
      "projectId": "xinglian",
      "name": "verifyChannelCallback",
      "signature": "verifyChannelCallback(ctx context.Context, raw []byte, headers CallbackHeaders) (*CallbackResult, error)",
      "layer": "backend",
      "stack": "Go + crypto/rsa + crypto/hmac",
      "module": "渠道回调",
      "summary": "用渠道公钥/密钥校验异步通知签名的原始 body，双密钥窗口内验签，幂等地把支付终态回写业务库。",
      "what": {
        "params": [
          {
            "name": "raw",
            "type": "[]byte",
            "desc": "未经反序列化改写的原始 HTTP body 字节"
          },
          {
            "name": "headers.Sign / Timestamp / Nonce",
            "type": "string",
            "desc": "签名、时间戳与防重放随机数"
          }
        ],
        "returns": "CallbackResult：{ accepted, duplicate, payOrderId, channelTradeNo }",
        "sideEffects": [
          "幂等写 pay_order 终态",
          "发布 PaymentSucceeded 事件",
          "写回调审计日志"
        ],
        "callers": [
          "渠道通知 HTTP 入口 / 商户通知重投"
        ]
      },
      "why": {
        "scenarios": [
          "渠道异步通知支付成功/失败/退款",
          "回调重投导致同一通知多次到达",
          "渠道平台轮换 RSA 公钥或签名密钥"
        ],
        "problemsSolved": [
          "防止伪造回调把未扣款订单标记为已支付",
          "回调重投不产生重复终态写入",
          "把渠道状态转成可被对账消费的业务事件"
        ],
        "preconditions": [
          "新旧两把验签密钥已同步并保留 24h 窗口",
          "原始 body 未被框架重排字段",
          "timestamp/nonce 防重放窗口已配置"
        ],
        "layerReason": "验签需要渠道密钥与业务库事务，且必须用原始 body 字节计算签名，只有后端信任边界内能完成；网关层一旦反序列化 JSON 就会破坏签名串。",
        "counterExample": {
          "title": "信任回调不做验签且失败直接返回 200",
          "desc": "任何人构造 POST 即可把订单标记为已支付；密钥轮换期间验签失败又被当作成功丢弃，渠道不再重投，支付状态永久丢失。",
          "code": "func cb(w http.ResponseWriter, r *http.Request) { markPaid(r.FormValue('out_trade_no')); w.WriteHeader(200) }"
        }
      },
      "alternatives": [
        {
          "name": "主动查单替代回调",
          "layer": "backend",
          "pros": [
            "不依赖回调可用性",
            "天然可对账"
          ],
          "cons": [
            "状态延迟秒级到分钟级",
            "渠道查单有频率限制"
          ],
          "whenToUse": "回调长期不稳定或渠道不提供通知时的兜底手段",
          "migrationCost": "中（2 人日）",
          "affectedLayers": [
            "backend",
            "data"
          ],
          "codeSnippet": "ticker := time.NewTicker(30 * time.Second); for range ticker.C { queryPending(ctx) }"
        },
        {
          "name": "CDC 订阅渠道流水表",
          "layer": "data",
          "pros": [
            "实时且可重放"
          ],
          "cons": [
            "渠道侧不会开放 binlog",
            "仅适用于自建账务"
          ],
          "whenToUse": "自建账务系统且已有 Debezium 基础设施",
          "migrationCost": "高（5 人日）",
          "affectedLayers": [
            "backend",
            "data",
            "infra"
          ],
          "codeSnippet": "debezium.Source('channel_trade').Sink('payment.succeeded');"
        }
      ],
      "comparisonConclusion": "当回调可用且要求秒级状态收敛时选当前「原始 body 验签 + 双密钥窗口 + 幂等回写」；若回调长期不稳定或渠道不提供通知，则增加主动查单作为兜底；只有在自建账务且已有 Debezium 基础设施的条件下，才考虑 CDC 订阅渠道流水；任何条件下验签失败都不得返回 200 丢弃消息。",
      "fallback": [
        {
          "layer": "frontend",
          "failureMode": "回调丢失导致结果页一直转圈",
          "strategy": "60s 后由结果轮询主动查渠道状态，展示「确认中」而非无限等待",
          "codeSnippet": "setTimeout(() => pollPayResult(payOrderId), 60_000);",
          "monitoring": "ui_callback_pending_over_60s"
        },
        {
          "layer": "bff",
          "failureMode": "网关把 JSON body 反序列化后重排字段",
          "strategy": "回调入口透传原始 body 字节与渠道标识，禁止在验签前做任何结构化改写",
          "codeSnippet": "raw, _ := io.ReadAll(r.Body); // 原样交给验签，不做 json.Unmarshal 后重新 marshal",
          "monitoring": "callback_raw_body_preserved"
        },
        {
          "layer": "backend",
          "failureMode": "密钥轮换期间签名全部失败",
          "strategy": "同时接受新旧两把密钥，验签失败进按渠道隔离的重试队列而非直接丢弃",
          "codeSnippet": "ok := verify(raw, sign, activeKey) || verify(raw, sign, previousKey)\nif !ok { dlq.Push(ctx, channelCode, raw) } // 绝不 return 200",
          "monitoring": "callback_sign_fail_rate、dlq_depth"
        },
        {
          "layer": "data",
          "failureMode": "回调重投造成重复终态写入",
          "strategy": "(channel_code, channel_trade_no) 唯一索引 + INSERT IGNORE，终态单向流转",
          "codeSnippet": "INSERT IGNORE INTO callback_record(channel_code, channel_trade_no, payload) VALUES(?,?,?);\nUPDATE pay_order SET state='SUCCESS' WHERE pay_order_id=? AND state='PENDING';",
          "monitoring": "callback_duplicate_ratio"
        },
        {
          "layer": "infra",
          "failureMode": "渠道回调地址不可达",
          "strategy": "配置主备回调地址，未投递事件由日终对账与主动查单补齐",
          "codeSnippet": "callbackURLs := []string{primary, backup}\n// recon job 每小时按渠道账单补一次",
          "monitoring": "callback_delivery_fail_total、对账补齐数"
        }
      ],
      "pitfalls": [
        "验签必须用原始 body 字节，不能先反序列化再拼串",
        "回调超时时间要小于渠道重投间隔，否则必然重复",
        "密钥轮换必须双密钥窗口，事故 i.pay.callback_sign 就是少了这一步",
        "timestamp/nonce 防重放窗口建议 5min 并留时钟偏移余量"
      ],
      "tags": [
        "渠道回调",
        "验签",
        "RSA",
        "幂等",
        "密钥轮换"
      ],
      "repoPath": "apps/pay/core/src/callback/verify.go",
      "links": {
        "upstream": [
          "xl.fe.pollPayResult",
          "xl.infra.channelRetry"
        ],
        "downstream": [
          "xl.be.publishPayEvent",
          "xl.data.reconcile"
        ],
        "related": [
          "xl.be.idempotentGuard"
        ]
      },
      "examples": [
        {
          "scene": "双密钥窗口期验签并幂等回写",
          "code": "ok := rsa.VerifyPKCS1v15(activePub, crypto.SHA256, digest(raw), sign) ||\n      rsa.VerifyPKCS1v15(previousPub, crypto.SHA256, digest(raw), sign)\nif !ok { dlq.Push(ctx, channel, raw); return nil, ErrSignInvalid }\nres, err := repo.MarkPaidOnce(ctx, cmd.PayOrderID, cmd.ChannelTradeNo)",
          "explain": "轮换期间不丢事件也不放宽验签，终态写入靠唯一索引保证幂等。"
        }
      ],
      "updatedAt": "2026-09-06",
      "repoUpdatedAt": "2026-09-06",
      "lastCodeChangeAt": "2026-09-06"
    },
    {
      "id": "xl.be.publishPayEvent",
      "projectId": "xinglian",
      "name": "publishOrderCreated",
      "signature": "publishPaymentEvent(ctx context.Context, e PaymentEvent) (*PublishResult, error)",
      "layer": "backend",
      "stack": "Go + Kafka + Outbox Relay",
      "module": "支付事件",
      "summary": "把 Outbox 中的支付受理/成功事件按 payOrderId 分区投递到 Kafka，供清结算、对账与商户通知消费。",
      "what": {
        "params": [
          {
            "name": "e.EventID",
            "type": "string",
            "desc": "全局唯一事件 ID，供消费侧幂等"
          },
          {
            "name": "e.PayOrderID",
            "type": "string",
            "desc": "分区键，保证同一支付单事件有序"
          },
          {
            "name": "e.ChannelCode",
            "type": "string",
            "desc": "渠道编码，随路由决策一并固化"
          }
        ],
        "returns": "PublishResult：{ sent, retried, deadLettered }",
        "sideEffects": [
          "写 Kafka topic",
          "更新 outbox 状态",
          "投递失败写按渠道隔离的死信"
        ],
        "callers": [
          "createPayOrder / verifyChannelCallback / Outbox Relay"
        ]
      },
      "why": {
        "scenarios": [
          "支付受理后触发清结算与商户通知",
          "渠道回调成功后驱动对账入账",
          "新增下游消费者不改收单代码"
        ],
        "problemsSolved": [
          "业务写入与消息投递解耦但不错序",
          "投递失败可补投",
          "下游各自重试互不影响"
        ],
        "preconditions": [
          "eventId 全局唯一",
          "消费者按 eventId 幂等",
          "分区键使用 payOrderId 保序"
        ],
        "layerReason": "事件发布属于领域输出边界，必须由 Outbox Relay 在事务提交后统一执行；网关层没有事务上下文，也无法保证事件与支付单一致。",
        "counterExample": {
          "title": "在事务内直接 send",
          "desc": "事务回滚但消息已发出，清结算按不存在的支付单记账；或支付单成功但消息丢失，商户永远收不到通知。",
          "code": "tx.Commit(); kafka.Send(e); // 提交与发送之间存在中间态"
        }
      },
      "alternatives": [
        {
          "name": "同步 RPC 串行调用下游",
          "layer": "backend",
          "pros": [
            "即时一致",
            "实现直观"
          ],
          "cons": [
            "下游故障拖垮受理链路",
            "新增下游要改收单代码"
          ],
          "whenToUse": "下游仅 1 个且受理必须同步拿到其结果",
          "migrationCost": "低（1 人日）",
          "affectedLayers": [
            "backend"
          ],
          "codeSnippet": "settle.Create(ctx, order); notify.Send(ctx, order);"
        },
        {
          "name": "CDC 直接读 binlog 发消息",
          "layer": "data",
          "pros": [
            "零应用侵入",
            "天然保序"
          ],
          "cons": [
            "事件语义弱、含表结构耦合",
            "无法携带渠道决策原因"
          ],
          "whenToUse": "已有 Debezium 且事件只需表达行变更",
          "migrationCost": "中（3 人日）",
          "affectedLayers": [
            "backend",
            "data",
            "infra"
          ],
          "codeSnippet": "debezium.Source('pay_order').Sink('payment.accepted');"
        },
        {
          "name": "本地内存事件总线",
          "layer": "backend",
          "pros": [
            "零依赖"
          ],
          "cons": [
            "进程重启即丢",
            "多实例不广播"
          ],
          "whenToUse": "仅单体测试环境",
          "migrationCost": "低",
          "affectedLayers": [
            "backend"
          ],
          "codeSnippet": "bus.Post(PaymentAccepted{...}) // 进程内，重启即丢"
        }
      ],
      "comparisonConclusion": "当下游 ≥ 2 个且要求收单链路不被下游故障拖垮时选当前 Outbox + Kafka；若下游只有 1 个且受理必须同步拿到其结果，则改用同步 RPC；只有在团队已有 Debezium 且事件只需表达行变更的条件下，才用 CDC 读 binlog；任何生产环境都不得使用本地内存事件总线。",
      "fallback": [
        {
          "layer": "frontend",
          "failureMode": "支付成功但商户通知未到达",
          "strategy": "商户后台提供「重新发送通知」入口，走后端按 eventId 补发接口",
          "codeSnippet": "await api.post('/pay/events/' + eventId + '/resend');",
          "monitoring": "manual_resend_total"
        },
        {
          "layer": "bff",
          "failureMode": "聚合视图依赖下游状态超时",
          "strategy": "视图里对清结算字段做可空降级，支付单主档信息始终可展示",
          "codeSnippet": "view.Settlement, _ = safeGet(ctx, settleStatus, nil); // 超时降级为 null",
          "monitoring": "view_partial_degrade_rate"
        },
        {
          "layer": "backend",
          "failureMode": "Kafka 不可用",
          "strategy": "Outbox 保持 PENDING，Relay 指数退避补投，不丢事件也不在事务内直连发送",
          "codeSnippet": "for !sent { time.Sleep(backoff()); sent, err = relay.TrySend(ctx, row) }",
          "monitoring": "outbox_backlog_age、补投成功率"
        },
        {
          "layer": "data",
          "failureMode": "重复投递造成下游重复入账",
          "strategy": "eventId 作为消费者幂等键，落 processed_event 表后再处理",
          "codeSnippet": "INSERT IGNORE INTO processed_event(event_id) VALUES(?);\nif affected == 0 { return nil } // 已处理",
          "monitoring": "consumer_duplicate_suppressed"
        },
        {
          "layer": "infra",
          "failureMode": "持续失败堆积死信",
          "strategy": "超过 5 次进按渠道隔离的 DLQ 并告警，提供按 eventId 重放工具",
          "codeSnippet": "if retries > 5 { dlq.Send(ctx, channelCode, event) }",
          "monitoring": "dlq_depth、dlq_oldest_age"
        }
      ],
      "pitfalls": [
        "分区键必须用 payOrderId，用 merchantId 会把同一支付单的事件打散",
        "至少一次投递，消费端按 eventId 幂等是硬要求",
        "Outbox 归档不能删未发送记录",
        "事件里的 channelCode 要与路由决策同步，改路由要一起核对"
      ],
      "tags": [
        "消息",
        "Kafka",
        "Outbox",
        "支付事件",
        "跨链路"
      ],
      "repoPath": "apps/pay/core/src/event/publish.go",
      "links": {
        "upstream": [
          "xl.be.createPayOrder",
          "xl.be.verifyCallback",
          "xl.be.routeChannel"
        ],
        "downstream": [
          "xl.infra.channelRetry"
        ],
        "related": [
          "xl.data.reconcile"
        ]
      },
      "examples": [
        {
          "scene": "事务提交后由 Relay 按分区键补投",
          "code": "rows, _ := outbox.Pending(ctx, 100)\nfor _, row := range rows {\n  w.WriteMessages(ctx, kafka.Message{Key: []byte(row.PayOrderID), Value: row.Payload})\n  outbox.MarkSent(ctx, row.EventID)\n}",
          "explain": "发送发生在事务之外，但事实来源于同事务的 Outbox，且分区键保证同单有序。"
        }
      ],
      "updatedAt": "2026-08-11",
      "repoUpdatedAt": "2026-10-30",
      "lastCodeChangeAt": "2026-10-30"
    },
    {
      "id": "xl.be.resolveDiff",
      "projectId": "xinglian",
      "name": "resolveReconDiff",
      "signature": "resolveReconDiff(ctx context.Context, diff ReconDiff) (*DiffResolution, error)",
      "layer": "backend",
      "stack": "Go + MySQL + 工作流",
      "module": "差错处理",
      "summary": "把日终对账检出的长款/短款/金额不符分类为挂账、冲正、补记或人工工单，并驱动补发通知。",
      "what": {
        "params": [
          {
            "name": "diff.Type",
            "type": "enum",
            "desc": "LONG（渠道有本地无）/ SHORT（本地有渠道无）/ AMOUNT_MISMATCH"
          },
          {
            "name": "diff.ChannelTradeNo",
            "type": "string",
            "desc": "渠道流水号，用于定位与冲正"
          }
        ],
        "returns": "DiffResolution：{ action: 'HANG' | 'REVERSE' | 'SUPPLEMENT' | 'TICKET', ticketId }",
        "sideEffects": [
          "写差错处理记录",
          "触发冲正/补记",
          "发差错处理完成事件"
        ],
        "callers": [
          "runDailyReconciliation / 运营后台"
        ]
      },
      "why": {
        "scenarios": [
          "渠道已扣款但本地无支付单（长款）",
          "本地支付单无渠道流水（短款）",
          "两边金额不一致"
        ],
        "problemsSolved": [
          "差异有明确分类与处置路径，不靠人工翻日志",
          "资金类动作可追溯、可复核",
          "把差错结果回写支付单并补发商户通知"
        ],
        "preconditions": [
          "差异已由对账任务归因",
          "冲正接口可用且有幂等键",
          "人工工单有负责人与 SLA"
        ],
        "layerReason": "差错处置是资金类业务决策，必须在领域层按状态机执行并留审计；对账任务只负责发现与分类，不能自己改支付单状态。",
        "counterExample": {
          "title": "对账发现差异后直接 UPDATE 支付单",
          "desc": "定时任务直接改状态，没有冲正流水与人工复核，出现重复冲正且无法解释资金去向。",
          "code": "db.Exec(`UPDATE pay_order SET state='SUCCESS' WHERE ...`) // 无审计无冲正"
        }
      },
      "alternatives": [
        {
          "name": "全自动按规则冲正",
          "layer": "backend",
          "pros": [
            "零人工",
            "恢复快"
          ],
          "cons": [
            "规则外的异常会误冲正"
          ],
          "whenToUse": "差异类型单一且金额低于阈值、规则经长期验证",
          "migrationCost": "中（3 人日）",
          "affectedLayers": [
            "backend",
            "data"
          ],
          "codeSnippet": "if diff.AmountFen < 100 && diff.Type == 'SHORT' { autoReverse(ctx, diff) }"
        },
        {
          "name": "全部转人工工单",
          "layer": "backend",
          "pros": [
            "风险最低"
          ],
          "cons": [
            "恢复慢",
            "人力成本高"
          ],
          "whenToUse": "新渠道接入初期或差异率突增的观察期",
          "migrationCost": "低（1 人日）",
          "affectedLayers": [
            "backend"
          ],
          "codeSnippet": "ticket.Create(ctx, diff); // 一律人工复核"
        }
      ],
      "comparisonConclusion": "当差异类型多样且涉及资金安全时选当前「分类 + 状态机 + 人工复核」处置；若差异类型单一且金额低于阈值、规则经长期验证，则可对小额短款启用全自动冲正；只有在新渠道接入初期或差异率突增的观察期，才把全部差异转人工工单；任何条件下都不得让对账任务绕过状态机直接改支付单。",
      "fallback": [
        {
          "layer": "frontend",
          "failureMode": "差错处理期间用户看到状态回退",
          "strategy": "结果页展示「资金核对中」与工单号，不回退已支付终态，提供客服入口",
          "codeSnippet": "showNotice('资金核对中', ticketId); // 不改 state=SUCCESS 的展示",
          "monitoring": "ui_diff_pending_notice_total"
        },
        {
          "layer": "bff",
          "failureMode": "运营后台批量操作超时",
          "strategy": "按差异单拆成小批次异步处理，返回可查询的批次号，禁止同步长事务",
          "codeSnippet": "batchID := enqueueDiffBatch(ctx, diffs); return &BatchReply{BatchID: batchID}, nil",
          "monitoring": "diff_batch_timeout_total"
        },
        {
          "layer": "backend",
          "failureMode": "冲正接口重复调用造成二次冲正",
          "strategy": "冲正带 (channel_trade_no, action) 幂等键，状态机只允许从 PENDING 流转一次",
          "codeSnippet": "INSERT IGNORE INTO diff_action(channel_trade_no, action) VALUES(?, 'REVERSE');\nif affected == 0 { return ErrAlreadyReversed }",
          "monitoring": "reverse_duplicate_blocked"
        },
        {
          "layer": "data",
          "failureMode": "差错记录与支付单状态不一致",
          "strategy": "差错处置与支付单终态回写放在同一事务，失败整体回滚",
          "codeSnippet": "tx, _ := db.BeginTx(ctx, nil)\ndiffRepo.Save(ctx, tx, res); payRepo.ApplyResolution(ctx, tx, res)\ntx.Commit()",
          "monitoring": "diff_order_mismatch_total"
        },
        {
          "layer": "infra",
          "failureMode": "差错完成通知投递失败",
          "strategy": "处置结果写 Outbox，由回调重投通道按 eventId 补发商户通知",
          "codeSnippet": "outbox.Insert(ctx, tx, DiffResolved{EventID: uuid(), DiffID: diff.ID});\n// channelRetry 补发",
          "monitoring": "diff_notify_backlog"
        }
      ],
      "pitfalls": [
        "冲正必须带幂等键，重复冲正是资金事故",
        "长款不得自动补记支付单，必须人工确认商户订单归属",
        "差错处置与支付单回写要同事务",
        "人工工单要有 SLA，否则差异长期挂账"
      ],
      "tags": [
        "差错处理",
        "冲正",
        "挂账",
        "工单",
        "对账"
      ],
      "repoPath": "apps/pay/recon/src/diff/resolve.go",
      "links": {
        "upstream": [
          "xl.data.reconcile"
        ],
        "downstream": [
          "xl.infra.channelRetry"
        ],
        "related": [
          "xl.be.verifyCallback"
        ]
      },
      "examples": [
        {
          "scene": "按差异类型分派处置动作",
          "code": "switch diff.Type {\ncase 'LONG':   return ticket(ctx, diff)        // 长款人工确认归属\ncase 'SHORT':  return autoCloseOrReverse(ctx, diff)\ncase 'AMOUNT_MISMATCH': return hang(ctx, diff) // 金额不符先挂账\n}\nreturn nil, ErrUnknownDiffType",
          "explain": "长款不自动补单，金额不符先挂账，避免误动资金。"
        }
      ],
      "updatedAt": "2026-07-25",
      "repoUpdatedAt": "2026-07-25",
      "lastCodeChangeAt": "2026-07-25"
    },
    {
      "id": "xl.data.reconcile",
      "projectId": "xinglian",
      "name": "runDailyReconciliation",
      "signature": "runDailyReconciliation(ctx context.Context, date string, channelCode string) (*ReconReport, error)",
      "layer": "data",
      "stack": "Go + MySQL 8 + 渠道账单文件",
      "module": "日终对账",
      "summary": "T+1 拉取渠道清算账单，与本地支付流水按渠道流水号/金额逐笔核对，产出长款、短款与金额不符差异清单。",
      "what": {
        "params": [
          {
            "name": "date",
            "type": "string",
            "desc": "清算日期 yyyyMMdd，按渠道时区对齐"
          },
          {
            "name": "channelCode",
            "type": "string",
            "desc": "按渠道分账对账，避免多渠道混单"
          }
        ],
        "returns": "ReconReport：{ total, matched, diffs[] , checksum }",
        "sideEffects": [
          "下载并解析渠道对账文件",
          "写对账批次与差异表",
          "触发差错处理"
        ],
        "callers": [
          "日终调度 / 运营后台"
        ]
      },
      "why": {
        "scenarios": [
          "渠道回调丢失导致本地状态滞后",
          "渠道重复扣款或多退",
          "跨渠道费率与手续费核对"
        ],
        "problemsSolved": [
          "以渠道账单为独立事实源发现状态不一致",
          "差异可按类型交差错处理",
          "按渠道分批，单渠道失败不阻塞其它渠道"
        ],
        "preconditions": [
          "渠道对账文件已就绪且校验通过",
          "本地流水含渠道流水号与金额",
          "对账批次可重跑且幂等"
        ],
        "layerReason": "对账是数据集之间的比对与差异归因，属于数据层批处理；把逐笔核对放进在线事务会拖垮收单链路，且无法重跑。",
        "counterExample": {
          "title": "只信本地支付单状态",
          "desc": "渠道回调丢失后本地一直是 PENDING，若不做账单核对，资金已到账却永远不入账，直到商户投诉才发现。",
          "code": "SELECT * FROM pay_order WHERE state='PENDING'; // 仅看本地，无独立事实源"
        }
      },
      "alternatives": [
        {
          "name": "实时逐笔对账（回调即核对）",
          "layer": "data",
          "pros": [
            "差异发现延迟低"
          ],
          "cons": [
            "与渠道查单限频冲突",
            "对在线链路有侵入"
          ],
          "whenToUse": "交易量小且渠道查单配额充足",
          "migrationCost": "中（4 人日）",
          "affectedLayers": [
            "backend",
            "data"
          ],
          "codeSnippet": "onCallback: go reconcileOne(ctx, channelTradeNo) // 逐笔实时核对"
        },
        {
          "name": "准实时流对账（Kafka + 流处理）",
          "layer": "data",
          "pros": [
            "分钟级差异发现"
          ],
          "cons": [
            "需维护流处理作业与状态存储"
          ],
          "whenToUse": "已有 Flink 基础设施且差异 SLA 要求分钟级",
          "migrationCost": "高（8 人日）",
          "affectedLayers": [
            "backend",
            "data",
            "infra"
          ],
          "codeSnippet": "flink.KeyBy(channelTradeNo).Join(channelBillStream).Sink(diffTopic);"
        }
      ],
      "comparisonConclusion": "当交易量大且能接受 T+1 收敛时选当前「渠道账单文件 + 批处理逐笔核对」；若交易量小且渠道查单配额充足，则可退化为回调触发的实时逐笔核对；只有在已有 Flink 基础设施且差异 SLA 要求分钟级的条件下，才升级为准实时流对账；任何条件下都不得只以本地支付单状态作为资金事实源。",
      "fallback": [
        {
          "layer": "frontend",
          "failureMode": "对账差异尚未处理完用户就来查账",
          "strategy": "商户后台对账页展示批次进度与「核对中」标识，不把未收敛差异渲染成最终结论",
          "codeSnippet": "render({ batchStatus: 'RECONCILING', asOf: date }); // 不展示最终金额",
          "monitoring": "recon_page_pending_batch_total"
        },
        {
          "layer": "bff",
          "failureMode": "对账文件下载接口超时",
          "strategy": "按渠道重试并保留已下载分片的 checksum，恢复后断点续传，不重复拉取整批",
          "codeSnippet": "file, err := fetchWithResume(ctx, url, lastOffset); // 记录 offset + checksum",
          "monitoring": "recon_file_fetch_retry_total"
        },
        {
          "layer": "backend",
          "failureMode": "账单格式变更导致解析整体失败",
          "strategy": "解析器按渠道版本化，未知表头直接拒收并告警，禁止按旧格式误解析",
          "codeSnippet": "if !parser.Supports(header) { alert('UNKNOWN_BILL_FORMAT'); return ErrUnsupportedFormat }",
          "monitoring": "recon_parse_unsupported_total"
        },
        {
          "layer": "data",
          "failureMode": "对账批次重跑产生重复差异单",
          "strategy": "批次以 (date, channelCode, checksum) 唯一，重跑先删该批次未处理差异再重算",
          "codeSnippet": "INSERT IGNORE INTO recon_batch(date, channel_code, checksum) VALUES(?,?,?);\n-- 重跑: DELETE FROM recon_diff WHERE batch_id=? AND state='NEW'",
          "monitoring": "recon_batch_rerun_total"
        },
        {
          "layer": "infra",
          "failureMode": "渠道账单文件延迟或未下发",
          "strategy": "按渠道配置最晚就绪时间，超时告警并保留上一日差异不自动关闭",
          "codeSnippet": "if time.Now().After(deadline) && !billReady { alert('BILL_MISSING', channel); keepOpen(prevDiffs) }",
          "monitoring": "recon_bill_missing_total"
        }
      ],
      "pitfalls": [
        "按渠道时区对齐清算日期，UTC 与本地日切差一天会全量误报",
        "金额一律用分比较，含手续费的渠道要单独字段",
        "账单文件必须有 checksum，重复下发要能识别",
        "对账批次要可幂等重跑，否则差异单会翻倍"
      ],
      "tags": [
        "对账",
        "清算",
        "长款短款",
        "批处理",
        "数据层"
      ],
      "repoPath": "apps/pay/recon/src/reconcile.go",
      "links": {
        "upstream": [
          "xl.be.verifyCallback"
        ],
        "downstream": [
          "xl.be.resolveDiff"
        ],
        "related": [
          "xl.be.createPayOrder",
          "xl.be.publishPayEvent"
        ]
      },
      "examples": [
        {
          "scene": "按渠道流水号与金额逐笔核对",
          "code": "bill := parseBill(file, channelCode) // map[channelTradeNo]amountFen\nfor _, t := range localTrades(date, channelCode) {\n  a, ok := bill[t.ChannelTradeNo]\n  if !ok { diffs = append(diffs, ReconDiff{Type: 'SHORT', ...}) } else if a != t.AmountFen {\n    diffs = append(diffs, ReconDiff{Type: 'AMOUNT_MISMATCH', ...})\n  }\n}\nfor no, a := range bill { if !localSeen(no) { diffs = append(diffs, ReconDiff{Type: 'LONG', ...}) } }",
          "explain": "渠道账单是独立事实源，双向核对才能同时发现长款与短款。"
        }
      ],
      "updatedAt": "2026-07-02",
      "repoUpdatedAt": "2026-11-09",
      "lastCodeChangeAt": "2026-11-09"
    },
    {
      "id": "xl.infra.channelRetry",
      "projectId": "xinglian",
      "name": "configureRetryDLQ",
      "signature": "configureRetryDLQ(channelCode string, cfg RetryCfg) error",
      "layer": "infra",
      "stack": "Go + Kafka + Redis + 配置中心",
      "module": "回调重投",
      "summary": "按渠道配置回调验签失败与商户通知的退避重投、签名有效期窗口与隔离死信队列，避免毒消息阻塞整条通知链路。",
      "what": {
        "params": [
          {
            "name": "cfg.MaxRetries",
            "type": "int",
            "desc": "进入 DLQ 前最大重试次数，默认 5"
          },
          {
            "name": "cfg.SignWindowSec",
            "type": "int",
            "desc": "签名时间戳有效窗口，超窗不再重投渠道下单"
          }
        ],
        "returns": "error（声明式配置）",
        "sideEffects": [
          "创建按渠道隔离的 DLQ topic",
          "修改消费者重试策略",
          "写告警规则"
        ],
        "callers": [
          "配置中心 / 发布流水线"
        ]
      },
      "why": {
        "scenarios": [
          "渠道回调短时验签失败",
          "商户通知地址短时不可达",
          "密钥轮换窗口内的历史通知需要重放"
        ],
        "problemsSolved": [
          "瞬时故障自动恢复且不越过签名有效期",
          "毒消息按渠道隔离，不阻塞其它渠道通知",
          "失败事件可审计、可按 eventId 重放"
        ],
        "preconditions": [
          "消费者按 eventId 幂等",
          "DLQ 按渠道有负责人与重放工具",
          "退避带抖动且小于渠道签名有效期"
        ],
        "layerReason": "重投与死信属于消息基础设施策略，且渠道回调受签名有效期与渠道频次约束，统一在设施层按渠道配置比每个消费者各写一套更可控。",
        "counterExample": {
          "title": "无限原地重试同一条通知",
          "desc": "一条过期签名的通知卡住分区，后面所有渠道回调全部延迟；重投时签名时间戳已超窗，渠道侧直接拒收。",
          "code": "for { if err := consume(); err != nil { continue } } // 无退避无窗口判定"
        }
      },
      "alternatives": [
        {
          "name": "消费者内自建重试",
          "layer": "backend",
          "pros": [
            "可按异常类型定制"
          ],
          "cons": [
            "各服务策略不一致",
            "容易写成无限重试"
          ],
          "whenToUse": "个别渠道有特殊退避需求时作为补充",
          "migrationCost": "低（1 人日）",
          "affectedLayers": [
            "backend"
          ],
          "codeSnippet": "for i := 0; i < 3; i++ { if err == nil { break }; time.Sleep(backoff(i)) }"
        },
        {
          "name": "失败即丢弃 + 日终对账补齐",
          "layer": "data",
          "pros": [
            "无 DLQ 维护成本"
          ],
          "cons": [
            "恢复延迟 T+1",
            "商户通知体验差"
          ],
          "whenToUse": "事件可完全由支付单与账单重建且能接受次日收敛",
          "migrationCost": "中（3 人日）",
          "affectedLayers": [
            "backend",
            "data"
          ],
          "codeSnippet": "scheduler.Reconcile('payment.succeeded'); // 次日补齐"
        }
      ],
      "comparisonConclusion": "当通知不可由主表低成本重建且要求分钟级恢复时选当前「按渠道隔离 DLQ + 带抖动退避 + 签名窗口判定」；若个别渠道需要按异常类型定制退避，则在消费者内补充自建重试，但不得替代统一策略；只有在事件可由支付单与账单完全重建且能接受 T+1 延迟的条件下，才用丢弃 + 日终对账；任何条件下都禁止无限原地重试与超签名窗口的重投。",
      "fallback": [
        {
          "layer": "frontend",
          "failureMode": "商户通知长时间不更新",
          "strategy": "商户后台展示「通知处理中」与已等待时长，提供刷新而非重新触发支付",
          "codeSnippet": "showPending({ since: createdAt, sla: '5min' }); // 不重新支付",
          "monitoring": "ui_long_pending_notify_count"
        },
        {
          "layer": "bff",
          "failureMode": "通知查询被慢消费者拖慢",
          "strategy": "下游状态查询加 300ms 超时并降级为 null，主档信息始终可展示",
          "codeSnippet": "v, _ := withTimeout(ctx, 300*time.Millisecond, downstream.Status); if v == nil { v = nullView }",
          "monitoring": "bff_downstream_timeout_rate"
        },
        {
          "layer": "backend",
          "failureMode": "消费者抛非瞬时异常（格式/验签错误）",
          "strategy": "按异常分类：瞬时进重试，格式或签名错误直接进 DLQ，不占用重试次数",
          "codeSnippet": "if errors.Is(err, ErrSignInvalid) { dlq.Send(ctx, channel, msg) } else { retry(ctx, msg) }",
          "monitoring": "non_retryable_to_dlq_total"
        },
        {
          "layer": "data",
          "failureMode": "DLQ 消息无人处理",
          "strategy": "DLQ 记录 eventId / 失败原因 / 首次失败时间，超 SLA 自动升级告警",
          "codeSnippet": "dlq.Record(ctx, DLQRow{EventID: id, Reason: reason, FirstFailedAt: t0});",
          "monitoring": "dlq_oldest_age、dlq_unhandled"
        },
        {
          "layer": "infra",
          "failureMode": "重试风暴放大渠道故障",
          "strategy": "指数退避 + 抖动，并对单渠道分区设置最大在途重试数与签名有效期上限",
          "codeSnippet": "backoff := base*time.Duration(1<<n) + jitter()\nif now.Sub(evt.Timestamp) > time.Duration(cfg.SignWindowSec)*time.Second { return ErrBeyondSignWindow }\nmaxInFlightPerChannel = 20",
          "monitoring": "retry_storm_guard_hits、beyond_sign_window_blocked"
        }
      ],
      "pitfalls": [
        "重试必须加抖动，否则渠道恢复瞬间被同时打垮",
        "重投前要判签名时间戳是否仍在渠道有效期窗口，超窗重投必被拒",
        "DLQ 必须按渠道隔离，单渠道毒消息不能拖垮全量通知",
        "顺序性要求高的支付单事件不能靠 DLQ 后补，会乱序"
      ],
      "tags": [
        "回调重投",
        "重试",
        "死信",
        "DLQ",
        "Kafka",
        "签名窗口"
      ],
      "repoPath": "apps/pay/infra/terraform/channel_retry.tf",
      "links": {
        "upstream": [
          "xl.be.publishPayEvent",
          "xl.be.resolveDiff"
        ],
        "downstream": [
          "xl.be.verifyCallback"
        ],
        "related": [
          "xl.be.routeChannel"
        ]
      },
      "examples": [
        {
          "scene": "按渠道隔离的退避 + 抖动 + DLQ 配置",
          "code": "cfg := RetryCfg{MaxRetries: 5, Base: time.Second, Jitter: true, SignWindowSec: 300,\n  DLQTopic: 'payment.notify.' + channelCode + '.dlq'}\nreturn configureRetryDLQ(channelCode, cfg)",
          "explain": "DLQ topic 带渠道编码，单渠道毒消息不会阻塞其它渠道。"
        }
      ],
      "updatedAt": "2026-03-11",
      "repoUpdatedAt": "2026-03-11",
      "lastCodeChangeAt": "2026-03-11"
    }
  ],
  "chains": [
    {
      "id": "c.upload",
      "name": "文件上传主链路",
      "entryMethodId": "m.fe.useUploadQueue",
      "nodes": [
        "m.fe.useUploadQueue",
        "m.bff.createUploadToken",
        "m.be.generatePresignedUrl",
        "m.fe.uploadFile",
        "m.infra.ossLifecycle",
        "m.be.verifyUploadCallback",
        "m.be.publishOrderEvent",
        "m.infra.mqRetry"
      ],
      "edges": [
        {
          "from": "m.fe.useUploadQueue",
          "to": "m.bff.createUploadToken",
          "relation": "请求凭证"
        },
        {
          "from": "m.bff.createUploadToken",
          "to": "m.be.generatePresignedUrl",
          "relation": "换取签名"
        },
        {
          "from": "m.be.generatePresignedUrl",
          "to": "m.fe.uploadFile",
          "relation": "返回预签名 URL"
        },
        {
          "from": "m.fe.uploadFile",
          "to": "m.infra.ossLifecycle",
          "relation": "写入临时前缀对象"
        },
        {
          "from": "m.infra.ossLifecycle",
          "to": "m.be.verifyUploadCallback",
          "relation": "OSS 回调"
        },
        {
          "from": "m.be.verifyUploadCallback",
          "to": "m.be.publishOrderEvent",
          "relation": "发布事件"
        },
        {
          "from": "m.be.publishOrderEvent",
          "to": "m.infra.mqRetry",
          "relation": "重试/死信"
        }
      ],
      "description": "从选择附件到对象落盘、事件投递的完整链路。跨链路共享节点 publishOrderCreated，改动它同时影响下单链路。",
      "projectId": "yunshu"
    },
    {
      "id": "c.order",
      "name": "下单幂等链路",
      "entryMethodId": "m.fe.submitOrder",
      "nodes": [
        "m.fe.submitOrder",
        "m.bff.createOrder",
        "m.be.idempotentGuard",
        "m.data.redisDedupe",
        "m.be.createOrder",
        "m.data.insertOrderTx",
        "m.be.publishOrderEvent",
        "m.infra.mqRetry"
      ],
      "edges": [
        {
          "from": "m.fe.submitOrder",
          "to": "m.bff.createOrder",
          "relation": "携带幂等键提交"
        },
        {
          "from": "m.bff.createOrder",
          "to": "m.be.idempotentGuard",
          "relation": "价格复核后透传"
        },
        {
          "from": "m.be.idempotentGuard",
          "to": "m.data.redisDedupe",
          "relation": "SETNX 原子占位"
        },
        {
          "from": "m.be.idempotentGuard",
          "to": "m.be.createOrder",
          "relation": "占位成功后执行"
        },
        {
          "from": "m.be.createOrder",
          "to": "m.data.insertOrderTx",
          "relation": "单事务写三表"
        },
        {
          "from": "m.be.createOrder",
          "to": "m.be.publishOrderEvent",
          "relation": "Outbox 落库后投递"
        },
        {
          "from": "m.be.publishOrderEvent",
          "to": "m.infra.mqRetry",
          "relation": "重试/死信"
        }
      ],
      "description": "覆盖连点拦截、SETNX 去重、单事务落库到事件投递。事故 i.order.duplicate 暴露了第 3 步最初缺失。",
      "projectId": "yunshu"
    },
    {
      "id": "c.pay.submit",
      "name": "支付下单主链路",
      "projectId": "xinglian",
      "entryMethodId": "xl.fe.submitPayment",
      "nodes": [
        "xl.fe.submitPayment",
        "xl.bff.createPayIntent",
        "xl.bff.rateLimitPayment",
        "xl.be.idempotentGuard",
        "xl.be.createPayOrder",
        "xl.be.routeChannel",
        "xl.be.publishPayEvent",
        "xl.infra.channelRetry"
      ],
      "edges": [
        {
          "from": "xl.fe.submitPayment",
          "to": "xl.bff.createPayIntent",
          "relation": "携带商户订单号与稳定幂等键提交"
        },
        {
          "from": "xl.bff.createPayIntent",
          "to": "xl.bff.rateLimitPayment",
          "relation": "预下单前按商户维度限流"
        },
        {
          "from": "xl.bff.rateLimitPayment",
          "to": "xl.be.idempotentGuard",
          "relation": "限流放行后透传幂等键"
        },
        {
          "from": "xl.be.idempotentGuard",
          "to": "xl.be.createPayOrder",
          "relation": "Lua 占位成功后创建支付单"
        },
        {
          "from": "xl.be.createPayOrder",
          "to": "xl.be.routeChannel",
          "relation": "按支付单固化渠道决策"
        },
        {
          "from": "xl.be.routeChannel",
          "to": "xl.be.publishPayEvent",
          "relation": "渠道受理后发 PaymentAccepted"
        },
        {
          "from": "xl.be.publishPayEvent",
          "to": "xl.infra.channelRetry",
          "relation": "投递失败进入退避重投/死信"
        }
      ],
      "description": "从收银台提交、收单聚合、限流、幂等占位、支付单落库、渠道路由到受理事件投递的完整链路。跨链路共享 publishOrderCreated 节点，改动它同时影响日终对账链路。"
    },
    {
      "id": "c.pay.recon",
      "name": "日终对账与差错处理链路",
      "projectId": "xinglian",
      "entryMethodId": "xl.data.reconcile",
      "nodes": [
        "xl.data.reconcile",
        "xl.be.verifyCallback",
        "xl.be.createPayOrder",
        "xl.be.publishPayEvent",
        "xl.be.resolveDiff",
        "xl.infra.channelRetry",
        "xl.fe.pollPayResult"
      ],
      "edges": [
        {
          "from": "xl.data.reconcile",
          "to": "xl.be.verifyCallback",
          "relation": "对账核对渠道回调流水"
        },
        {
          "from": "xl.data.reconcile",
          "to": "xl.be.createPayOrder",
          "relation": "短款按本地支付单定位"
        },
        {
          "from": "xl.data.reconcile",
          "to": "xl.be.resolveDiff",
          "relation": "差异生成差错工单"
        },
        {
          "from": "xl.be.resolveDiff",
          "to": "xl.be.publishPayEvent",
          "relation": "处置结果发差错完成事件"
        },
        {
          "from": "xl.be.publishPayEvent",
          "to": "xl.infra.channelRetry",
          "relation": "补发商户通知重投"
        },
        {
          "from": "xl.be.verifyCallback",
          "to": "xl.fe.pollPayResult",
          "relation": "终态回写供结果页查询"
        },
        {
          "from": "xl.be.resolveDiff",
          "to": "xl.fe.pollPayResult",
          "relation": "差错处理完成后更新查询结果"
        }
      ],
      "description": "T+1 渠道账单与本地流水逐笔核对，差异转差错处理并补发商户通知。事故 i.pay.callback_sign 暴露了回调验签失败被丢弃时对账补齐缺位的问题。"
    }
  ],
  "incidents": [
    {
      "id": "i.upload.callback",
      "title": "附件回调验签公钥轮换事故：订单卡在「待上传」",
      "symptom": "2026-08-14 14:05 起，约 18% 的订单附件已实际上传到 OSS，但业务侧一直停留在待上传；回调接口验签失败日志每分钟上千条，OSS 侧无回调投递失败记录。",
      "rootCause": "KMS 公钥轮换时，签发服务已切到新公钥，回调验签服务仍只加载旧公钥且无双写窗口。验签失败后代码直接返回 200 丢弃消息，OSS 认为投递成功不再重投，导致对象已落盘但业务状态永远丢失。",
      "missingFallbacks": [
        {
          "layer": "frontend",
          "item": "上传 90s 未收到终态时主动查询对象状态",
          "expected": "m.fe.useUploadQueue 的后端层兜底（事故发生时未实现）"
        },
        {
          "layer": "backend",
          "item": "双公钥窗口 + 验签失败进重试队列而非丢弃",
          "expected": "m.be.verifyUploadCallback 的后端层兜底"
        },
        {
          "layer": "data",
          "item": "objectKey 唯一索引 + INSERT IGNORE 支撑重投幂等",
          "expected": "m.be.verifyUploadCallback 的数据层兜底"
        },
        {
          "layer": "infra",
          "item": "主备回调地址 + 清单定时对账补齐",
          "expected": "m.be.verifyUploadCallback 的基础设施层兜底"
        },
        {
          "layer": "infra",
          "item": "验签失败率告警阈值",
          "expected": "监控项 callback_sign_fail_rate 未配置告警"
        }
      ],
      "relatedMethodIds": [
        "m.be.verifyUploadCallback",
        "m.fe.useUploadQueue",
        "m.fe.uploadFile",
        "m.infra.ossLifecycle",
        "m.be.publishOrderEvent"
      ],
      "improvement": "① 验签支持新旧双公钥并保留 24h 窗口；② 验签失败一律进 DLQ，禁止返回 200 丢弃；③ 增加对象清单对账任务与前端主动查询；④ callback_sign_fail_rate > 0.5% 触发 P2 告警；⑤ 公钥轮换加入发布检查单。",
      "occurredAt": "2026-08-14",
      "projectId": "yunshu"
    },
    {
      "id": "i.order.duplicate",
      "title": "重复提交产生双份订单",
      "symptom": "2026-06-02 大促首分钟，47 个用户各产生 2 笔金额相同的订单；前端按钮已置灰，但仍有重复请求到达；订单表未报唯一键冲突。",
      "rootCause": "幂等实现为「先查存在再插入」的非原子 check-then-act，两个并发请求同时查到不存在并双双插入；同时前端刷新页面后重新生成了幂等键，后端无法识别是同一次提交；订单表当时未在 idempotency_key 上建唯一索引。",
      "missingFallbacks": [
        {
          "layer": "frontend",
          "item": "幂等键与购物车版本绑定，刷新后保持不变",
          "expected": "m.fe.submitOrder 的前端层兜底"
        },
        {
          "layer": "bff",
          "item": "透传原始 Idempotency-Key 且缺失即 400",
          "expected": "m.bff.createOrder 的 BFF 层兜底"
        },
        {
          "layer": "backend",
          "item": "SETNX 原子占位 + 结果快照",
          "expected": "m.be.idempotentGuard 的后端层兜底"
        },
        {
          "layer": "data",
          "item": "idempotency_key 唯一索引",
          "expected": "m.data.insertOrderTx 的数据层兜底（最关键的缺失）"
        },
        {
          "layer": "infra",
          "item": "按用户维度限流，抑制 429 触发的反复点击",
          "expected": "m.fe.submitOrder 的基础设施层兜底"
        }
      ],
      "relatedMethodIds": [
        "m.fe.submitOrder",
        "m.bff.createOrder",
        "m.be.idempotentGuard",
        "m.data.redisDedupe",
        "m.be.createOrder",
        "m.data.insertOrderTx"
      ],
      "improvement": "① 引入 withIdempotency 两态占位与结果快照；② 订单表补唯一索引并统一映射 409；③ 幂等键改为购物车 id + version 稳定生成；④ 下游增加 duplicate_key_hit_total 告警；⑤ 把「防重必须双层」写入 Code Review 检查单。",
      "occurredAt": "2026-06-02",
      "projectId": "yunshu"
    },
    {
      "id": "i.pay.callback_sign",
      "title": "渠道回调验签密钥轮换事故：用户已扣款但订单卡在「待支付」",
      "symptom": "2026-09-03 14:20 起，部分微信渠道交易用户已被扣款，商户订单却一直停留在待支付；渠道侧通知投递成功率正常，但业务回调验签失败日志每分钟上千条，商户集中投诉「付了钱没到账」，部分用户因误判未支付而重复付款。",
      "rootCause": "渠道平台轮换 RSA 公钥时，渠道侧已切到新公钥，回调验签服务仍只加载旧公钥且无双密钥窗口。验签失败后处理器直接返回 HTTP 200 让渠道认为已送达、不再重投，支付终态永久丢失；同时 (channel_code, channel_trade_no) 未建唯一索引，同一通知重投也无法幂等收敛；日终对账当时尚未接入该渠道，缺最后一道补齐。",
      "missingFallbacks": [
        {
          "layer": "frontend",
          "item": "结果页 60s 未收到终态时主动查渠道支付状态",
          "expected": "xl.fe.pollPayResult 的前端层兜底（事故发生时未实现）"
        },
        {
          "layer": "bff",
          "item": "回调入口保留原始 body 字节与渠道标识，验签前不做结构化改写",
          "expected": "xl.be.verifyCallback 的接入层兜底（网关曾重排 JSON 字段）"
        },
        {
          "layer": "backend",
          "item": "新旧双密钥窗口 + 验签失败进重试队列而非返回 200 丢弃",
          "expected": "xl.be.verifyCallback 的后端层兜底（最关键的缺失）"
        },
        {
          "layer": "data",
          "item": "(channel_code, channel_trade_no) 唯一索引 + INSERT IGNORE 支撑回调重投幂等",
          "expected": "xl.be.idempotentGuard 的数据层兜底"
        },
        {
          "layer": "infra",
          "item": "按渠道隔离的回调 DLQ + 日终对账补齐 + callback_sign_fail_rate 阈值告警",
          "expected": "xl.infra.channelRetry 的基础设施层兜底"
        }
      ],
      "relatedMethodIds": [
        "xl.be.verifyCallback",
        "xl.be.idempotentGuard",
        "xl.infra.channelRetry",
        "xl.fe.pollPayResult",
        "xl.data.reconcile",
        "xl.be.publishPayEvent"
      ],
      "improvement": "① 验签支持新旧双密钥并保留 24h 轮换窗口；② 验签失败一律进按渠道隔离的 DLQ，禁止返回 200 丢弃；③ 回调记录补 (channel_code, channel_trade_no) 唯一索引与终态单向流转；④ 结果页 60s 主动查渠道 + 渠道账单日终对账自动补单；⑤ callback_sign_fail_rate > 0.3% 触发 P1 告警；⑥ 密钥轮换与双写窗口纳入发布检查单。",
      "occurredAt": "2026-09-03",
      "projectId": "xinglian"
    },
    {
      "id": "i.pay.duplicate_charge",
      "title": "渠道路由未熔断叠加幂等键被改写造成重复扣款",
      "symptom": "2026-05-21 大促首分钟，某渠道网关超时率飙到 40%，路由仍持续把流量打到该渠道；用户超时后刷新收银台重新提交，31 笔交易产生两笔渠道成功扣款，渠道流水号不同但商户订单号相同，订单表未报唯一键冲突。",
      "rootCause": "渠道路由缺少基于成功率的熔断与渠道级幂等约束，故障渠道仍被持续选中；刷新收银台后前端用随机 UUID 重新生成幂等键，BFF 未把服务端签发的商户订单号作为稳定键透传；支付单表当时未在 (merchant_id, out_trade_no) 上建唯一索引，两个执行体并发都发起了渠道下单。",
      "missingFallbacks": [
        {
          "layer": "frontend",
          "item": "幂等键与商户订单号绑定，刷新后保持不变",
          "expected": "xl.fe.submitPayment 的前端层兜底"
        },
        {
          "layer": "bff",
          "item": "透传原始幂等键与服务端签发的商户订单号，缺失即拒绝，禁止前端重写",
          "expected": "xl.bff.createPayIntent 的 BFF 层兜底"
        },
        {
          "layer": "backend",
          "item": "按商户订单号 Lua 原子占位 + 渠道流水号结果快照",
          "expected": "xl.be.idempotentGuard 的后端层兜底"
        },
        {
          "layer": "data",
          "item": "(merchant_id, out_trade_no) 唯一索引",
          "expected": "xl.be.createPayOrder 的数据层兜底（最关键的缺失）"
        },
        {
          "layer": "infra",
          "item": "渠道成功率熔断 + 按商户维度限流，抑制超时后的反复提交",
          "expected": "xl.be.routeChannel 的基础设施层兜底"
        }
      ],
      "relatedMethodIds": [
        "xl.fe.submitPayment",
        "xl.bff.createPayIntent",
        "xl.be.idempotentGuard",
        "xl.be.createPayOrder",
        "xl.be.routeChannel",
        "xl.bff.rateLimitPayment"
      ],
      "improvement": "① 幂等键改为 merchantId:outTradeNo 稳定生成，BFF 禁止改写；② 支付单表补 (merchant_id, out_trade_no) 唯一索引并统一映射 409 + 首次支付单号；③ 路由增加成功率滑动窗口与熔断半开探测，熔断窗口内不重投故障渠道；④ 引入 withIdempotency 两态占位与渠道流水号结果快照；⑤ 把「资金链路防重必须前端/BFF/后端/数据四层」写入 Code Review 检查单。",
      "occurredAt": "2026-05-21",
      "projectId": "xinglian"
    }
  ],
  "troubleshooting": {
    "flows": [
      {
        "id": "t.upload.stuck",
        "symptom": "文件上传卡在 99% / 一直转圈，但 OSS 上能看到对象",
        "steps": [
          {
            "id": "s1",
            "question": "对象是否已在 OSS 上存在？",
            "options": [
              {
                "label": "已存在，etag 正常",
                "value": "exists",
                "next": "s2",
                "hint": "说明上传动作本身成功，问题在状态回写"
              },
              {
                "label": "不存在或部分分片",
                "value": "missing",
                "next": "RESULT",
                "hint": "问题在上传本身，重试并查看 OSS 5xx"
              }
            ]
          },
          {
            "id": "s2",
            "question": "回调接口日志里有没有验签失败或 5xx？",
            "options": [
              {
                "label": "有大量验签失败",
                "value": "signfail",
                "next": "s3",
                "hint": "优先怀疑公钥轮换窗口"
              },
              {
                "label": "回调根本没进来",
                "value": "nocallback",
                "next": "RESULT",
                "hint": "怀疑回调地址 / 网络 / OSS 投递配置"
              },
              {
                "label": "回调成功但状态仍不对",
                "value": "written",
                "next": "RESULT",
                "hint": "怀疑读从库延迟或前端状态查询缓存"
              }
            ]
          },
          {
            "id": "s3",
            "question": "最近 24h 是否做过 KMS 公钥轮换？",
            "options": [
              {
                "label": "是",
                "value": "rotated",
                "next": "RESULT",
                "hint": "几乎可以确定是双公钥窗口缺失"
              },
              {
                "label": "否",
                "value": "notrotated",
                "next": "RESULT",
                "hint": "检查验签用的原始 body 字节是否被框架改写"
              }
            ]
          }
        ],
        "resultMethodId": "m.be.verifyUploadCallback",
        "resultHint": "优先看「分层兜底卡」的后端层（双公钥 + DLQ）与前端层（90s 主动查询），再沿链路卡检查 OSS 回调 → 事件投递这一段。",
        "relatedChainId": "c.upload",
        "relatedIncidentId": "i.upload.callback",
        "projectId": "yunshu"
      },
      {
        "id": "t.order.duplicate",
        "symptom": "用户投诉下了两单 / 被扣了两次",
        "steps": [
          {
            "id": "s1",
            "question": "两笔订单的 idempotency_key 是否相同？",
            "options": [
              {
                "label": "不同",
                "value": "different",
                "next": "s2",
                "hint": "幂等键在客户端被重新生成了"
              },
              {
                "label": "相同",
                "value": "same",
                "next": "s3",
                "hint": "说明后端去重逻辑被并发击穿"
              }
            ]
          },
          {
            "id": "s2",
            "question": "用户中途是否刷新过页面或改动过购物车？",
            "options": [
              {
                "label": "是",
                "value": "refresh",
                "next": "RESULT",
                "hint": "幂等键未与购物车版本稳定绑定"
              },
              {
                "label": "否",
                "value": "norefresh",
                "next": "RESULT",
                "hint": "检查 BFF 是否改写了请求头"
              }
            ]
          },
          {
            "id": "s3",
            "question": "幂等实现是 SETNX 原子占位吗？",
            "options": [
              {
                "label": "不是，先查再写",
                "value": "checkthenact",
                "next": "RESULT",
                "hint": "并发窗口下必然重复"
              },
              {
                "label": "是",
                "value": "atomic",
                "next": "RESULT",
                "hint": "检查 Redis 主从切换是否丢了占位"
              }
            ]
          }
        ],
        "resultMethodId": "m.be.idempotentGuard",
        "resultHint": "先看「分层兜底卡」的数据层（唯一索引）与后端层（原子占位），再看事故复盘卡 i.order.duplicate 的逐层缺失对照。",
        "relatedChainId": "c.order",
        "relatedIncidentId": "i.order.duplicate",
        "projectId": "yunshu"
      },
      {
        "id": "t.upload.signfail",
        "symptom": "上传报 403 SignatureDoesNotMatch",
        "steps": [
          {
            "id": "s1",
            "question": "是否只在个别文件类型上出现？",
            "options": [
              {
                "label": "是，特定类型",
                "value": "contenttype",
                "next": "RESULT",
                "hint": "PUT 的 Content-Type 与 policy 绑定值不一致"
              },
              {
                "label": "否，全部失败",
                "value": "all",
                "next": "s2",
                "hint": "怀疑凭证过期或时钟漂移"
              }
            ]
          },
          {
            "id": "s2",
            "question": "签发节点时钟是否与 NTP 偏差超过 60s？",
            "options": [
              {
                "label": "是",
                "value": "drift",
                "next": "RESULT",
                "hint": "签名提前失效"
              },
              {
                "label": "否",
                "value": "ok",
                "next": "RESULT",
                "hint": "检查 objectKey 是否含未编码中文或路径穿越字符"
              }
            ]
          }
        ],
        "resultMethodId": "m.be.generatePresignedUrl",
        "resultHint": "重点看「分层兜底卡」的前端层（提前 30s 续签）与基础设施层（NTP 对齐 + 60s 偏移余量）。",
        "relatedChainId": "c.upload",
        "relatedIncidentId": null,
        "projectId": "yunshu"
      },
      {
        "id": "t.pay.pending",
        "symptom": "收银台一直显示「支付处理中」，渠道已扣款但商户订单未变为已支付",
        "projectId": "xinglian",
        "steps": [
          {
            "id": "s1",
            "question": "渠道侧这笔 out_trade_no 是否已是 SUCCESS？",
            "options": [
              {
                "label": "渠道已成功扣款",
                "value": "paid",
                "next": "s2",
                "hint": "说明扣款成功，问题在回调验签或状态回写"
              },
              {
                "label": "渠道无此单或已关闭",
                "value": "none",
                "next": "RESULT",
                "hint": "问题在渠道下单本身，按超时关单处理，勿引导重新支付"
              }
            ]
          },
          {
            "id": "s2",
            "question": "回调验签日志里有没有验签失败或 5xx？",
            "options": [
              {
                "label": "有大量验签失败",
                "value": "signfail",
                "next": "s3",
                "hint": "优先怀疑渠道密钥轮换缺双密钥窗口"
              },
              {
                "label": "回调根本没进来",
                "value": "nocb",
                "next": "RESULT",
                "hint": "怀疑回调地址白名单 / 网络 / 渠道投递配置，走日终对账补单"
              },
              {
                "label": "验签成功但状态仍不对",
                "value": "written",
                "next": "RESULT",
                "hint": "怀疑从库延迟或前端查询缓存，查 xl.be.createPayOrder 的事务回写"
              }
            ]
          },
          {
            "id": "s3",
            "question": "最近 24h 是否做过渠道公钥 / 签名密钥轮换？",
            "options": [
              {
                "label": "是",
                "value": "rotated",
                "next": "RESULT",
                "hint": "几乎可确定是双密钥窗口缺失，按 i.pay.callback_sign 处理"
              },
              {
                "label": "否",
                "value": "notrotated",
                "next": "RESULT",
                "hint": "检查验签是否用了被框架重排过的 JSON body 而非原始字节"
              }
            ]
          }
        ],
        "resultMethodId": "xl.be.verifyCallback",
        "resultHint": "重点看分层兜底卡的后端层（双密钥 + 验签失败进 DLQ）与前端层（60s 主动查渠道），再沿链路卡检查渠道回调 → 事件投递 → 日终对账补齐这一段。",
        "relatedChainId": "c.pay.recon",
        "relatedIncidentId": "i.pay.callback_sign"
      },
      {
        "id": "t.pay.duplicate",
        "symptom": "用户投诉同一订单被扣了两次 / 渠道出现两笔成功流水",
        "projectId": "xinglian",
        "steps": [
          {
            "id": "s1",
            "question": "两笔渠道流水的商户订单号 out_trade_no 是否相同？",
            "options": [
              {
                "label": "不同",
                "value": "different",
                "next": "s2",
                "hint": "幂等键在收银台刷新后被重新生成了"
              },
              {
                "label": "相同",
                "value": "same",
                "next": "s3",
                "hint": "说明后端幂等占位被并发击穿或未透传原始键"
              }
            ]
          },
          {
            "id": "s2",
            "question": "用户中途是否刷新过收银台或改过支付方式？",
            "options": [
              {
                "label": "是",
                "value": "refresh",
                "next": "RESULT",
                "hint": "幂等键未与商户订单号稳定绑定"
              },
              {
                "label": "否",
                "value": "norefresh",
                "next": "RESULT",
                "hint": "检查 BFF 是否改写了 Idempotency-Key 请求头"
              }
            ]
          },
          {
            "id": "s3",
            "question": "幂等实现是 Lua 原子占位且支付单有 (merchant_id, out_trade_no) 唯一索引吗？",
            "options": [
              {
                "label": "不是，先查再写",
                "value": "checkthenact",
                "next": "RESULT",
                "hint": "并发窗口下必然重复扣款"
              },
              {
                "label": "是",
                "value": "atomic",
                "next": "RESULT",
                "hint": "检查 Redis 主从切换是否丢了占位，或渠道超时是否触发了越窗重投"
              }
            ]
          }
        ],
        "resultMethodId": "xl.be.idempotentGuard",
        "resultHint": "先看分层兜底卡的数据层（唯一索引）与后端层（原子占位 + 结果快照），再对照事故复盘 i.pay.duplicate_charge 的逐层缺失。",
        "relatedChainId": "c.pay.submit",
        "relatedIncidentId": "i.pay.duplicate_charge"
      },
      {
        "id": "t.pay.signfail",
        "symptom": "渠道回调报签名校验失败（SignInvalid），支付状态无法推进",
        "projectId": "xinglian",
        "steps": [
          {
            "id": "s1",
            "question": "是否只在某一渠道上出现？",
            "options": [
              {
                "label": "是，特定渠道",
                "value": "onechannel",
                "next": "s2",
                "hint": "该渠道密钥/证书可能刚轮换，或验签串拼接规则与其它渠道不同"
              },
              {
                "label": "否，全渠道失败",
                "value": "all",
                "next": "RESULT",
                "hint": "怀疑网关把 JSON body 反序列化重排字段导致原始字节被改写"
              }
            ]
          },
          {
            "id": "s2",
            "question": "该渠道近 24h 是否轮换过公钥或签名证书？",
            "options": [
              {
                "label": "是",
                "value": "rotated",
                "next": "RESULT",
                "hint": "双密钥窗口缺失，按 i.pay.callback_sign 处理并补对账"
              },
              {
                "label": "否",
                "value": "ok",
                "next": "RESULT",
                "hint": "检查 timestamp / nonce 防重放窗口与节点时钟漂移是否超过 5min"
              }
            ]
          }
        ],
        "resultMethodId": "xl.be.verifyCallback",
        "resultHint": "重点看分层兜底卡的后端层（原始 body 字节验签 + 双密钥窗口）与基础设施层（按渠道隔离 DLQ + 验签失败率告警）。",
        "relatedChainId": "c.pay.recon",
        "relatedIncidentId": "i.pay.callback_sign"
      }
    ],
    "sceneSynonyms": {
      "文件上传": [
        "上传",
        "附件",
        "OSS",
        "对象存储",
        "直传",
        "预签名",
        "断点续传",
        "分片",
        "回调",
        "验签"
      ],
      "下单幂等": [
        "下单",
        "订单",
        "重复提交",
        "连点",
        "幂等",
        "去重",
        "扣两次",
        "SETNX",
        "防重"
      ],
      "消息投递": [
        "消息",
        "事件",
        "Kafka",
        "MQ",
        "Outbox",
        "重试",
        "死信",
        "DLQ",
        "通知",
        "履约"
      ],
      "数据一致性": [
        "事务",
        "一致性",
        "原子",
        "回滚",
        "唯一索引",
        "binlog",
        "CDC",
        "补偿",
        "Saga"
      ],
      "鉴权配额": [
        "鉴权",
        "权限",
        "租户",
        "配额",
        "限流",
        "凭证",
        "密钥",
        "KMS",
        "最小权限"
      ],
      "性能优化": [
        "并发",
        "连接池",
        "限流",
        "卡顿",
        "弱网",
        "大文件",
        "Worker",
        "削峰"
      ],
      "支付下单": [
        "支付",
        "下单",
        "收银台",
        "预下单",
        "支付单",
        "商户订单号",
        "out_trade_no",
        "扣款",
        "提交支付"
      ],
      "渠道路由": [
        "渠道",
        "路由",
        "微信支付",
        "支付宝",
        "银联",
        "渠道网关",
        "费率",
        "限额",
        "熔断",
        "渠道健康度"
      ],
      "回调验签": [
        "回调",
        "异步通知",
        "验签",
        "签名",
        "RSA",
        "HMAC",
        "公钥",
        "密钥轮换",
        "重放",
        "notify"
      ],
      "对账差错": [
        "对账",
        "清算",
        "账单",
        "差错",
        "长款",
        "短款",
        "挂账",
        "冲正",
        "退款",
        "T+1"
      ],
      "幂等限流": [
        "幂等",
        "防重",
        "重复扣款",
        "Lua",
        "SETNX",
        "唯一索引",
        "限流",
        "令牌桶",
        "429",
        "防连点"
      ]
    },
    "sceneExamples": [
      "做文件上传",
      "防止重复下单",
      "上传回调总是失败",
      "跨服务发通知",
      "多租户配额控制",
      "用户支付一直显示处理中，渠道其实已经扣款了",
      "怎么防止同一订单被重复扣款",
      "渠道回调总报签名不匹配怎么办"
    ]
  },
  "linksSkeleton": {
    "schemaVersion": "1.0",
    "generatedAt": "2026-11-13T10:21:34.268Z",
    "tool": "extract-links.mjs",
    "parser": "builtin-regex",
    "sourceRoot": "samples",
    "entries": [
      {
        "methodId": "m.fe.useUploadQueue",
        "repoPath": "apps/web/src/upload/useUploadQueue.ts",
        "found": true,
        "signatures": [
          {
            "name": "useUploadQueue",
            "signature": "useUploadQueue(opts: UploadQueueOpts)",
            "line": 15
          },
          {
            "name": "runOne",
            "signature": "runOne(file: File)",
            "line": 20
          },
          {
            "name": "add",
            "signature": "add(files: File[])",
            "line": 26
          },
          {
            "name": "cancel",
            "signature": "cancel(reason: string)",
            "line": 36
          }
        ],
        "calls": [
          {
            "callee": "createUploadToken",
            "line": 21,
            "resolvedMethodId": "m.bff.createUploadToken"
          },
          {
            "callee": "uploadFileToOSS",
            "line": 22,
            "resolvedMethodId": "m.fe.uploadFile"
          }
        ],
        "suggestedLinks": {
          "upstream": [],
          "downstream": [
            "m.bff.createUploadToken",
            "m.fe.uploadFile"
          ],
          "related": []
        },
        "currentLinks": {
          "upstream": [],
          "downstream": [
            "m.fe.uploadFile",
            "m.bff.createUploadToken"
          ],
          "related": [
            "m.be.verifyUploadCallback"
          ]
        },
        "confidence": 0.85
      },
      {
        "methodId": "m.fe.uploadFile",
        "repoPath": "apps/web/src/upload/uploadFileToOSS.ts",
        "found": true,
        "signatures": [
          {
            "name": "putObject",
            "signature": "putObject(url: string, file: File)",
            "line": 11
          },
          {
            "name": "uploadFileToOSS",
            "signature": "uploadFileToOSS(file: File, opts: UploadOpts)",
            "line": 16
          },
          {
            "name": "refreshToken",
            "signature": "refreshToken(key: string)",
            "line": 28
          }
        ],
        "calls": [
          {
            "callee": "verifyUploadCallback",
            "line": 23,
            "resolvedMethodId": "m.be.verifyUploadCallback"
          },
          {
            "callee": "createUploadToken",
            "line": 29,
            "resolvedMethodId": "m.bff.createUploadToken"
          }
        ],
        "suggestedLinks": {
          "upstream": [
            "m.fe.useUploadQueue"
          ],
          "downstream": [
            "m.be.verifyUploadCallback",
            "m.bff.createUploadToken"
          ],
          "related": []
        },
        "currentLinks": {
          "upstream": [
            "m.fe.useUploadQueue"
          ],
          "downstream": [
            "m.bff.createUploadToken",
            "m.infra.ossLifecycle"
          ],
          "related": [
            "m.be.verifyUploadCallback"
          ]
        },
        "confidence": 0.85
      },
      {
        "methodId": "m.bff.createUploadToken",
        "repoPath": "apps/bff/src/routes/upload-token.ts",
        "found": true,
        "signatures": [
          {
            "name": "lookupByHash",
            "signature": "lookupByHash(hash: string, size: number)",
            "line": 7
          },
          {
            "name": "createUploadToken",
            "signature": "createUploadToken(req: UploadTokenReq, ctx: UserCtx)",
            "line": 12
          }
        ],
        "calls": [
          {
            "callee": "generatePresignedUrl",
            "line": 19,
            "resolvedMethodId": "m.be.generatePresignedUrl"
          }
        ],
        "suggestedLinks": {
          "upstream": [
            "m.fe.uploadFile",
            "m.fe.useUploadQueue"
          ],
          "downstream": [
            "m.be.generatePresignedUrl"
          ],
          "related": [
            "m.bff.createOrder"
          ]
        },
        "currentLinks": {
          "upstream": [
            "m.fe.useUploadQueue",
            "m.fe.uploadFile"
          ],
          "downstream": [
            "m.be.generatePresignedUrl"
          ],
          "related": [
            "m.data.redisDedupe"
          ]
        },
        "confidence": 0.8
      },
      {
        "methodId": "m.be.generatePresignedUrl",
        "repoPath": "services/file/src/main/java/.../PresignService.java",
        "found": false,
        "signatures": [],
        "calls": [],
        "suggestedLinks": {
          "upstream": [
            "m.bff.createUploadToken"
          ],
          "downstream": [],
          "related": []
        },
        "currentLinks": {
          "upstream": [
            "m.bff.createUploadToken"
          ],
          "downstream": [
            "m.fe.uploadFile",
            "m.infra.ossLifecycle"
          ],
          "related": [
            "m.be.verifyUploadCallback"
          ]
        },
        "confidence": 0
      },
      {
        "methodId": "m.be.verifyUploadCallback",
        "repoPath": "services/file/src/main/java/.../CallbackVerifier.java",
        "found": false,
        "signatures": [],
        "calls": [],
        "suggestedLinks": {
          "upstream": [
            "m.fe.uploadFile"
          ],
          "downstream": [],
          "related": []
        },
        "currentLinks": {
          "upstream": [
            "m.infra.ossLifecycle",
            "m.fe.uploadFile"
          ],
          "downstream": [
            "m.be.publishOrderEvent"
          ],
          "related": [
            "m.fe.useUploadQueue"
          ]
        },
        "confidence": 0
      },
      {
        "methodId": "m.infra.ossLifecycle",
        "repoPath": "infra/terraform/oss_lifecycle.tf",
        "found": false,
        "signatures": [],
        "calls": [],
        "suggestedLinks": {
          "upstream": [],
          "downstream": [],
          "related": []
        },
        "currentLinks": {
          "upstream": [
            "m.be.generatePresignedUrl",
            "m.fe.uploadFile"
          ],
          "downstream": [
            "m.be.verifyUploadCallback"
          ],
          "related": []
        },
        "confidence": 0
      },
      {
        "methodId": "m.fe.submitOrder",
        "repoPath": "apps/web/src/order/submitOrder.ts",
        "found": true,
        "signatures": [
          {
            "name": "readSessionKey",
            "signature": "readSessionKey(cartId: string)",
            "line": 9
          },
          {
            "name": "submitOrder",
            "signature": "submitOrder(draft: OrderDraft, opts: SubmitOpts)",
            "line": 14
          }
        ],
        "calls": [
          {
            "callee": "createOrder",
            "line": 21,
            "resolvedMethodId": "m.bff.createOrder"
          }
        ],
        "suggestedLinks": {
          "upstream": [],
          "downstream": [
            "m.bff.createOrder"
          ],
          "related": []
        },
        "currentLinks": {
          "upstream": [],
          "downstream": [
            "m.bff.createOrder"
          ],
          "related": [
            "m.be.idempotentGuard"
          ]
        },
        "confidence": 0.8
      },
      {
        "methodId": "m.bff.createOrder",
        "repoPath": "apps/bff/src/routes/orders.ts",
        "found": true,
        "signatures": [
          {
            "name": "createOrder",
            "signature": "createOrder(req: CreateOrderReq, ctx: UserCtx)",
            "line": 9
          }
        ],
        "calls": [
          {
            "callee": "withIdempotency",
            "line": 20,
            "resolvedMethodId": "m.be.idempotentGuard"
          },
          {
            "callee": "insertOrderWithTx",
            "line": 21,
            "resolvedMethodId": "m.data.insertOrderTx"
          },
          {
            "callee": "publishOrderCreated",
            "line": 22,
            "resolvedMethodId": "m.be.publishOrderEvent"
          }
        ],
        "suggestedLinks": {
          "upstream": [
            "m.fe.submitOrder"
          ],
          "downstream": [
            "m.be.idempotentGuard",
            "m.be.publishOrderEvent",
            "m.data.insertOrderTx"
          ],
          "related": [
            "m.bff.createUploadToken"
          ]
        },
        "currentLinks": {
          "upstream": [
            "m.fe.submitOrder"
          ],
          "downstream": [
            "m.be.idempotentGuard",
            "m.be.createOrder"
          ],
          "related": [
            "m.data.insertOrderTx"
          ]
        },
        "confidence": 0.9
      },
      {
        "methodId": "m.be.idempotentGuard",
        "repoPath": "services/order/src/main/java/.../IdempotencyGuard.java",
        "found": false,
        "signatures": [],
        "calls": [],
        "suggestedLinks": {
          "upstream": [
            "m.bff.createOrder"
          ],
          "downstream": [],
          "related": []
        },
        "currentLinks": {
          "upstream": [
            "m.bff.createOrder"
          ],
          "downstream": [
            "m.data.redisDedupe",
            "m.be.createOrder"
          ],
          "related": [
            "m.fe.submitOrder"
          ]
        },
        "confidence": 0
      },
      {
        "methodId": "m.be.createOrder",
        "repoPath": "services/order/src/main/java/.../OrderService.java",
        "found": false,
        "signatures": [],
        "calls": [],
        "suggestedLinks": {
          "upstream": [],
          "downstream": [],
          "related": []
        },
        "currentLinks": {
          "upstream": [
            "m.be.idempotentGuard",
            "m.bff.createOrder"
          ],
          "downstream": [
            "m.data.insertOrderTx",
            "m.be.publishOrderEvent"
          ],
          "related": []
        },
        "confidence": 0
      },
      {
        "methodId": "m.data.redisDedupe",
        "repoPath": "infra/redis/idem_keys.md",
        "found": false,
        "signatures": [],
        "calls": [],
        "suggestedLinks": {
          "upstream": [],
          "downstream": [],
          "related": []
        },
        "currentLinks": {
          "upstream": [
            "m.be.idempotentGuard",
            "m.bff.createUploadToken"
          ],
          "downstream": [],
          "related": [
            "m.data.insertOrderTx"
          ]
        },
        "confidence": 0
      },
      {
        "methodId": "m.data.insertOrderTx",
        "repoPath": "services/order/src/main/resources/mapper/OrderMapper.xml",
        "found": false,
        "signatures": [],
        "calls": [],
        "suggestedLinks": {
          "upstream": [
            "m.bff.createOrder"
          ],
          "downstream": [],
          "related": []
        },
        "currentLinks": {
          "upstream": [
            "m.be.createOrder"
          ],
          "downstream": [
            "m.be.publishOrderEvent"
          ],
          "related": [
            "m.data.redisDedupe"
          ]
        },
        "confidence": 0
      },
      {
        "methodId": "m.be.publishOrderEvent",
        "repoPath": "services/order/src/main/java/.../OrderEventPublisher.java",
        "found": false,
        "signatures": [],
        "calls": [],
        "suggestedLinks": {
          "upstream": [
            "m.bff.createOrder"
          ],
          "downstream": [],
          "related": []
        },
        "currentLinks": {
          "upstream": [
            "m.be.createOrder",
            "m.be.verifyUploadCallback"
          ],
          "downstream": [
            "m.infra.mqRetry"
          ],
          "related": []
        },
        "confidence": 0
      },
      {
        "methodId": "m.infra.mqRetry",
        "repoPath": "infra/terraform/kafka_retry.tf",
        "found": false,
        "signatures": [],
        "calls": [],
        "suggestedLinks": {
          "upstream": [],
          "downstream": [],
          "related": []
        },
        "currentLinks": {
          "upstream": [
            "m.be.publishOrderEvent"
          ],
          "downstream": [],
          "related": [
            "m.be.verifyUploadCallback"
          ]
        },
        "confidence": 0
      }
    ],
    "summary": {
      "files": 5,
      "matchedMethods": 5,
      "signatures": 12,
      "callEdges": 9
    }
  },
  "reviews": [
    {
      "id": "rv.001",
      "projectId": "yunshu",
      "methodId": "m.be.verifyUploadCallback",
      "title": "回调验签条目建议纳入跨项目同名对比，并补齐与事故 i.upload.callback 的逐层对照",
      "kind": "review",
      "status": "changes_requested",
      "author": "陈昊",
      "createdAt": "2026-11-10",
      "updatedAt": "2026-11-14",
      "comments": [
        {
          "id": "c1",
          "author": "陈昊",
          "at": "2026-11-10",
          "body": "这条的『双公钥窗口』经验很值得复用到星链的渠道回调验签，但两边方法名不同（verifyUploadCallback / verifyChannelCallback），跨项目四问对比按 name 匹配会漏掉。建议要么把回调验签收敛成同名能力，要么在评审记录里显式记一笔关联，避免经验断在两个项目之间。",
          "verdict": "comment"
        },
        {
          "id": "c2",
          "author": "周岚",
          "at": "2026-11-12",
          "body": "同意。另外 fallback 的 infra 层写了主备回调地址，但 i.upload.callback 的 missingFallbacks 里『验签失败率告警阈值』当时是缺的，想确认现在这条是否把量化告警阈值也补进了 monitoring。",
          "verdict": "request_changes"
        },
        {
          "id": "c3",
          "author": "陈昊",
          "at": "2026-11-14",
          "body": "我核了 methods.json：monitoring 有 callback_sign_fail_rate，但没有写阈值。请在兜底行补『> 0.5% 触发 P2』之类的量化条件，改完 @ 我复审，否则兜底卡只显示指标名、看不到触发条件。",
          "verdict": "request_changes"
        }
      ],
      "checklist": [
        {
          "item": "四问字段齐全（是什么 / 为什么 / 替代方案 / 对比结论）",
          "done": true
        },
        {
          "item": "对比结论含『当/若』条件句与『则/改用』选择句",
          "done": true
        },
        {
          "item": "兜底覆盖前端 / 后端 / 数据 / 基础设施并带量化告警阈值",
          "done": false
        },
        {
          "item": "与事故 i.upload.callback 的逐层缺失一一对应、跨项目同名口径已对齐",
          "done": false
        }
      ],
      "relatedIncidentIds": [
        "i.upload.callback"
      ],
      "relatedDraftId": ""
    },
    {
      "id": "rv.002",
      "projectId": "xinglian",
      "methodId": "xl.be.idempotentGuard",
      "title": "支付幂等守卫评审通过：条件化结论清晰，五层兜底与唯一索引叠加到位",
      "kind": "review",
      "status": "approved",
      "author": "林玥",
      "createdAt": "2026-11-11",
      "updatedAt": "2026-11-13",
      "comments": [
        {
          "id": "c1",
          "author": "林玥",
          "at": "2026-11-11",
          "body": "comparisonConclusion 用了『当…时选…；若…则改用…；只有在…条件下才…』的完整条件句，四问对比能直接读出来，符合 build-snapshot 的双正则验收口径。",
          "verdict": "comment"
        },
        {
          "id": "c2",
          "author": "周岚",
          "at": "2026-11-12",
          "body": "fallback 五层齐全，尤其 data 层把『Redis 不可用时降级到 (merchant_id, out_trade_no) 唯一索引』写清了；与云枢 m.be.idempotentGuard 的 Java + Redis SETNX 版本在 stack、why.layerReason、alternatives 上差异明显，跨项目对比有实质内容，不是只换个项目名。",
          "verdict": "approve"
        },
        {
          "id": "c3",
          "author": "陈昊",
          "at": "2026-11-13",
          "body": "同意合入。唯一非阻塞建议：把幂等键 TTL 必须与『渠道最大受理超时』对齐的理由在 why.layerReason 里再点一句，避免后来者照抄云枢的 120s 却在慢渠道上提前过期。",
          "verdict": "approve"
        }
      ],
      "checklist": [
        {
          "item": "四问字段齐全且结论含条件句",
          "done": true
        },
        {
          "item": "兜底覆盖前端 / BFF / 后端 / 数据 / 基础设施不少于两层",
          "done": true
        },
        {
          "item": "同名方法 withIdempotency 与云枢版本的 stack / 替代 / 兜底明显不同",
          "done": true
        },
        {
          "item": "links 无自引用与悬空引用",
          "done": true
        }
      ],
      "relatedIncidentIds": [
        "i.pay.duplicate_charge"
      ],
      "relatedDraftId": ""
    },
    {
      "id": "rv.003",
      "projectId": "xinglian",
      "methodId": "xl.be.routeChannel",
      "title": "讨论：渠道路由的熔断阈值与限流层职责边界，是否拆成两个条目",
      "kind": "discussion",
      "status": "in_review",
      "author": "周岚",
      "createdAt": "2026-11-12",
      "updatedAt": "2026-11-14",
      "comments": [
        {
          "id": "c1",
          "author": "周岚",
          "at": "2026-11-12",
          "body": "现在 routePayChannel 把『成功率熔断』和『费率 / 限额路由』放在一条里，而 xl.bff.rateLimitPayment 又做了商户维度令牌桶，想讨论会不会职责重叠、是不是该拆成两个条目。",
          "verdict": "comment"
        },
        {
          "id": "c2",
          "author": "林玥",
          "at": "2026-11-13",
          "body": "我倾向不拆：熔断是路由决策的输入，令牌桶是入口保护，两者 layer 不同（backend / bff），链路卡上也能区分。但需要把『熔断窗口内不重投故障渠道』明确写进 infra 兜底，否则容易和回调重投打架。",
          "verdict": "comment"
        },
        {
          "id": "c3",
          "author": "陈昊",
          "at": "2026-11-14",
          "body": "赞成不拆，按当前方案继续。补一点：xl.be.publishPayEvent 依赖路由结果，事件体里的 channelCode 必须与路由决策同事务固化，改路由时要同步核对下游事件字段，别出现链路同步漏改。",
          "verdict": "approve"
        }
      ],
      "checklist": [
        {
          "item": "明确 routePayChannel 与 rateLimitPayment 的职责边界",
          "done": false
        },
        {
          "item": "链路下游 publishPayEvent 的 channelCode 字段同步核对",
          "done": false
        },
        {
          "item": "对比结论补充熔断场景的条件分支",
          "done": true
        }
      ],
      "relatedIncidentIds": [
        "i.pay.duplicate_charge"
      ],
      "relatedDraftId": ""
    },
    {
      "id": "rv.004",
      "projectId": "yunshu",
      "methodId": "m.be.publishOrderEvent",
      "title": "开放讨论：跨链路事件条目的同步提醒要不要覆盖星链的同名方法",
      "kind": "discussion",
      "status": "open",
      "author": "林玥",
      "createdAt": "2026-11-13",
      "updatedAt": "2026-11-14",
      "comments": [
        {
          "id": "c1",
          "author": "林玥",
          "at": "2026-11-13",
          "body": "m.be.publishOrderEvent 同时被 c.upload 和 c.order 两条链路引用，改它要同步两处；三期又引入了星链的 publishOrderCreated 同名方法，想讨论对比视图里要不要也标『跨项目同名』，让改一处能提醒到另一处。",
          "verdict": "comment"
        },
        {
          "id": "c2",
          "author": "周岚",
          "at": "2026-11-14",
          "body": "按条件化结论的口径核过了，措辞没问题，approve 这个方向。只补一句：『下游 ≥ 2 个』这个条件在多项目下要写清楚是『当前项目内』的下游数，避免读者把两个项目的下游加起来误判。",
          "verdict": "approve"
        }
      ],
      "checklist": [
        {
          "item": "对比结论在多项目语境下无歧义",
          "done": false
        },
        {
          "item": "跨链路 / 跨项目同名引用在对比视图中可见",
          "done": false
        }
      ],
      "relatedIncidentIds": [
        "i.upload.callback"
      ],
      "relatedDraftId": ""
    }
  ]
};
