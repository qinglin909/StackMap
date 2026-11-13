---
id: m.demo.retryWithBackoff
name: retryWithBackoff
signature: retryWithBackoff<T>(fn: () => Promise<T>, opts?: { retries?: number; baseMs?: number; signal?: AbortSignal }): Promise<T>
layer: frontend
stack: TypeScript
module: 通用能力
tags: 重试, 退避, 弱网, 抖动
repoPath: apps/web/src/common/retryWithBackoff.ts
---

## 定位
带指数退避与抖动的通用异步重试包装，只对可重试错误生效。

## 是什么
### 参数
- `fn: () => Promise<T>` 需要重试的异步操作
- `opts.retries: number` 最大重试次数，默认 2
- `opts.baseMs: number` 退避基数，默认 300
- `opts.signal: AbortSignal` 取消信号
### 返回
- `Promise<T>` 首次成功的结果；全部失败则抛出最后一次错误
### 副作用
- 写 retry_attempt_total 埋点
- 消耗 AbortSignal 的一次监听
### 调用方
- useUploadQueue
- submitOrder

## 为什么用
### 场景
- 弱网下接口偶发超时
- 下游发布窗口内的短时 503
### 解决的问题
- 瞬时故障无需用户手动干预
- 抖动避免多个客户端在同一时刻重试形成风暴
### 前提条件
- 被调用方法是幂等的
- 错误对象能区分可重试与不可重试
### 本层理由
- 重试节奏与取消信号由调用方生命周期决定，放前端才能感知页面卸载与用户取消
### 反例
不区分错误类型地无限重试：400 参数错误被反复发送，既浪费配额又掩盖真实 bug。

## 替代方案
- 直接不重试 | 实现最简单 | 弱网成功率低，用户需手动点 | 内部工具且网络稳定 | 低 | frontend
  ```ts
  return await fn();
  ```
- 固定间隔重试 | 行为可预测 | 恢复瞬间容易形成重试风暴 | 单客户端后台任务 | 低 | frontend
  ```ts
  await sleep(500); return fn();
  ```
- 交给网关统一重试 | 业务代码零侵入 | 无法感知取消，且会放大端到端超时 | 只读查询且网关已具备策略 | 中 | frontend,bff,infra
  ```ts
  // 网关层 retry policy
  ```

## 对比结论
当被调用方法幂等且错误可区分时选当前带抖动的指数退避；若是内部工具且网络稳定，则可不重试以简化实现；只有在单客户端后台任务条件下，才用固定间隔重试；若网关已具备重试策略且调用为只读查询，则交给网关统一重试，但必须核算端到端超时。

## 兜底
- frontend | 重试耗尽 | 保留原始错误与尝试次数，展示可手动重试按钮而非自动循环 | retry_exhausted_total、手动重试成功率
  ```ts
  throw new RetryExhausted(err, attempts);
  ```
- bff | 上游 503 持续 | BFF 对同一请求做短窗口去重，避免重试叠加放大 | bff_retry_dedupe_hits
  ```ts
  dedupe(reqId, 2000, () => handler(req));
  ```
- backend | 非幂等误被重试 | 服务端以 Idempotency-Key 二次拦截 | non_idem_retry_blocked
  ```ts
  guard.requireIdempotencyKey(req);
  ```
- data | 重试造成重复写 | 唯一索引兜底并映射为 409 | duplicate_key_hit_total
  ```sql
  ALTER TABLE t ADD UNIQUE KEY uk_req (request_id);
  ```
- infra | 恢复瞬间重试风暴 | 网关按用户维度令牌桶限速 | retry_storm_guard_hits
  ```yaml
  rateLimit: { key: userId, rps: 5, burst: 10 }
  ```

## 踩坑
- 重试前必须确认 signal 未被 abort，否则取消后仍会发起请求
- 抖动不能省略，多个标签页会同步重试
- 400/401 属于不可重试，重试只会掩盖问题

## 示例
### 上传失败时带取消地重试
```ts
await retryWithBackoff(() => put(url, file), {
  retries: 2, baseMs: 300, signal: controller.signal
});
```
signal 保证用户离开页面后不会继续发请求；退避加抖动避免与其他标签页同步重试。

## 检查单
- [ ] 被调用方法幂等
- [ ] 错误已分类
- [ ] 重试次数有上限
