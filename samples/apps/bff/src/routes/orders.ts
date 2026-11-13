// BFF 下单路由：价格复核、幂等键透传，再调用领域服务。
// 对应知识库条目 m.bff.createOrder。
// 说明：领域服务与数据层是跨语言占位引用，静态抽取只记录来源字符串、不校验文件存在。
import { withIdempotency } from '../../../../services/order/IdempotencyGuard';
import { insertOrderWithTx } from '../../../../services/order/OrderMapper';
import { publishOrderCreated } from '../../../../services/order/OrderEventPublisher';

// 聚合下单入口：缺失幂等键直接拒绝，价格复核失败则 fail-closed。
export async function createOrder(req: CreateOrderReq, ctx: UserCtx) {
  const key = ctx.idempotencyKey;
  if (!key) {
    return { code: 400, error: 'KEY_REQUIRED' };
  }
  // 价格复核结果写进请求上下文，避免后端二次查价。
  const price = await priceService.quote(req.cartVersion);
  if (!price.ok) {
    return { code: 503, error: 'PRICE_UNAVAILABLE' };
  }
  // 用幂等键包裹领域写入，落库与事件在同一事务语义下产出。
  return withIdempotency(key, 120, async () => {
    const order = insertOrderWithTx(price, req.items);
    publishOrderCreated({ orderId: order.id });
    return order;
  });
}
