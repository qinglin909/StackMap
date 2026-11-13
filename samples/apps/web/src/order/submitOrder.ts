// 提交订单：携带客户端生成的幂等键，按钮做在途锁定。
// 对应知识库条目 m.fe.submitOrder。
import { createOrder } from '../../../bff/src/routes/orders';

// 在途锁：防止连点与键盘 Enter 重复触发。
let submitLocked = false;

// 局部工具：从会话中读取购物车版本号对应的稳定幂等键。
function readSessionKey(cartId: string) {
  return `idem:${cartId}`;
}

// 提交入口，沿用同一幂等键重试，避免刷新后生成双份订单。
export function submitOrder(draft: OrderDraft, opts: SubmitOpts) {
  const key = opts.idempotencyKey || readSessionKey(draft.cartId);
  // 在途期间直接查询结果，不发起新的创建请求。
  if (submitLocked) {
    return { code: 409, key };
  }
  submitLocked = true;
  return createOrder(draft, { key });
}
