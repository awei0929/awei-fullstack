// 作业对外状态限定为这四个值；内部不会返回其他中间状态。
export type JobStatus = 'pending' | 'running' | 'done' | 'failed';

// 作业视图是 HTTP 响应边界：只包含前端需要展示的字段。
// ownerId、租约、尝试次数等信息留在数据库文档中，不进入响应。
export interface JobView {
  id: string;
  label: string;
  status: JobStatus;
  progress: number;
  result: string;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}
