---
id: m.demo.outboxRelay
name: OutboxRelay.scanAndPublish
signature: scanAndPublish(batchSize: number, now: Instant): PublishBatch
layer: backend
stack: Java 21 + Spring Boot
module: 消息
tags: Outbox, 补投, 事件, 至少一次
repoPath: services/order/src/main/java/.../OutboxRelay.java
---

## 定位
扫描已提交但未发送的 Outbox 记录并补投，保证业务写入与消息发出最终一致。

## 是什么
### 参数
- `batchSize: number` 单批扫描上限，默认 200
- `now: Instant` 用于判定退避到期，便于测试注入时钟
### 返回
- `PublishBatch` 本批成功数、失败数、进入死信数
### 副作用
- 更新 outbox 状态与 next_retry_at
- 向 Kafka 投递事件
### 调用方
- 定时任务调度器
- 运维手动重放接口

## 为什么用
### 场景
- Kafka 短时不可用
- 应用进程在事务提交后、消息发出前崩溃
### 解决的问题
- 消息不会因瞬时故障丢失
- 业务事务与消息发送解耦，远程调用不进事务
### 前提条件
- Outbox 写入与业务写在同一个本地事务
- 消费端按 eventId 幂等
### 本层理由
- 只有后端能读取同事务写入的 Outbox 并理解事件语义，基础设施无法判断哪些记录已提交
### 反例
在业务事务内直接 kafka.send：事务回滚但消息已发出，下游会为不存在的订单创建履约单。

## 替代方案
- 事务内直接发消息 | 代码最少 | 回滚会产生幽灵消息 | 仅单体且消息可丢的测试环境 | 低 | backend
  ```java
  repo.save(o); kafka.send(e); // 反例
  ```
- CDC 读 binlog 投递 | 应用零侵入 | 事件语义弱且耦合表结构 | 已有 Debezium 且只需行变更 | 中 | backend,data,infra
  ```yaml
  source: orders -> sink: order.created
  ```
- 定时全量对账重建 | 无需 DLQ | 恢复延迟小时级 | 事件可由主表完全重建 | 中 | backend,data
  ```java
  scheduler.reconcile("order_created");
  ```

## 对比结论
当事件不可由主表重建且要求分钟级恢复时选当前 Outbox 补投；若团队已有 Debezium 且事件只需表达行变更，则改用 CDC 读 binlog；只有在事件可完全重建且能接受小时级延迟的条件下，才用定时全量对账；任何生产环境下都不得在事务内直接发消息。

## 兜底
- frontend | 下游状态长时间不更新 | 详情页展示处理中时长并提供刷新 | ui_long_pending_count
  ```tsx
  <Pending since={createdAt} sla="5min" />
  ```
- bff | 聚合查询被慢下游拖住 | 下游字段 300ms 超时降级为 null | bff_downstream_timeout_rate
  ```ts
  await withTimeout(300, () => downstream.status()) ?? null;
  ```
- backend | 持续投递失败 | 超过 5 次进 DLQ 并保留 eventId 供重放 | dlq_depth、dlq_oldest_age
  ```java
  if (e.getRetries() > 5) dlq.send(e);
  ```
- data | 补投产生重复消息 | 消费端 processed_event 表按 eventId 去重 | consumer_duplicate_suppressed
  ```sql
  INSERT IGNORE INTO processed_event(event_id) VALUES(?);
  ```
- infra | 重试风暴 | 指数退避 + 抖动，单分区限制在途重试数 | retry_storm_guard_hits
  ```yaml
  backoff: exponential(1s, jitter=true)
  ```

## 踩坑
- 只能扫描已提交记录，未提交的 Outbox 对 Relay 不可见
- 分区键用 orderId，否则同一订单事件乱序
- 归档任务绝不能删除 status=PENDING 的记录

## 示例
### 带退避的单批补投
```java
outbox.findPending(now, batchSize).forEach(e -> {
  if (kafka.send("order.created", e.getOrderId(), e).ok()) outbox.markSent(e);
  else outbox.scheduleRetry(e, backoff(e.getRetries()));
});
```
发送在事务之外，但事实来源是与业务写入同事务落库的 Outbox 记录。

## 检查单
- [ ] 消费端幂等已实现
- [ ] DLQ 有负责人
- [ ] 分区键使用 orderId
