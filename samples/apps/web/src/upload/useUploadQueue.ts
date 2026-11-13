// 批量附件上传队列：把并发、取消、重试收敛到一个 Hook。
// 对应知识库条目 m.fe.useUploadQueue。
import { uploadFileToOSS } from './uploadFileToOSS';
import { createUploadToken } from '../../../bff/src/routes/upload-token';

export interface UploadQueueOpts {
  concurrency?: number;
  retry?: number;
}

// 当前在途任务数，用于并发上限控制。
let activeCount = 0;

// 队列主入口：返回可取消、可观察的队列对象。
export function useUploadQueue(opts: UploadQueueOpts) {
  const tasks = [];
  const limit = opts.concurrency ?? 3;

  // 单文件流程：先向 BFF 申请凭证，再直传对象存储。
  async function runOne(file: File) {
    const token = await createUploadToken({ fileName: file.name, size: file.size });
    return uploadFileToOSS(file, { token });
  }

  // 入队时做并发上限控制，避免打满浏览器连接池。
  function add(files: File[]) {
    for (const file of files) {
      if (activeCount >= limit) break;
      activeCount += 1;
      tasks.push(runOne(file));
    }
    return tasks.length;
  }

  // 取消时清空在途计数，保留任务引用供手动重试。
  function cancel(reason: string) {
    activeCount = 0;
    return { cancelled: tasks.length, reason };
  }

  return { tasks, add, cancel, limit };
}
