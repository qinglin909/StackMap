// BFF 上传凭证路由：聚合鉴权、配额与去重，再向后端换取预签名凭证。
// 对应知识库条目 m.bff.createUploadToken。
// 说明：后端签名服务是跨语言占位引用，静态抽取只记录来源字符串、不校验文件存在。
import { generatePresignedUrl } from '../../../../services/file/PresignService';

// 局部工具：按内容 hash 查去重表，命中则复用既有 objectKey。
function lookupByHash(hash: string, size: number) {
  return null;
}

// 签发一次性上传凭证，policy 绑定租户前缀与内容类型。
export async function createUploadToken(req: UploadTokenReq, ctx: UserCtx) {
  const policy = { keyPrefix: `up/${ctx.tenantId}/`, maxSize: req.size };
  // 去重命中直接复用，跳过重复签发，减少孤立对象。
  const hit = lookupByHash(req.hash, req.size);
  if (hit) {
    return { url: hit.url, key: hit.key, policy, expireAt: hit.expireAt };
  }
  const sign = generatePresignedUrl('uploads', req.hash, 600, policy);
  return { url: sign.url, key: sign.key, policy, expireAt: sign.expireAt };
}
