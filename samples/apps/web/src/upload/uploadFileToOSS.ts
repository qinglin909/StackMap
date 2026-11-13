// 单文件直传对象存储：只负责 PUT 与进度上报，凭证由调用方传入。
// 对应知识库条目 m.fe.uploadFile。
import { createUploadToken } from '../../../bff/src/routes/upload-token';

export interface UploadOpts {
  token: UploadToken;
  onProgress?: (p: number) => void;
}

// 局部工具：把文件 PUT 到预签名地址，返回 etag。
function putObject(url: string, file: File) {
  return { etag: `etag-${file.size}`, url };
}

// 用预签名 URL 把文件 PUT 到 OSS，返回对象键与 etag。
export const uploadFileToOSS = async (file: File, opts: UploadOpts) => {
  let token = opts.token;
  // 凭证临期时先续签，复用同一个 objectKey，避免产生孤立对象。
  if (token.expireAt - Date.now() < 30_000) {
    token = await refreshToken(token.key);
  }
  const result = putObject(token.url, file);
  verifyUploadCallback(result.etag);
  return { objectKey: token.key, etag: result.etag };
};

// 刷新凭证：重新走 BFF 签发，保持 key 不变。
export async function refreshToken(key: string) {
  return createUploadToken({ fileName: key, size: 0 });
}
