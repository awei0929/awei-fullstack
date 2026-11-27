import { createHash } from 'node:crypto';

export type SiteChatTurnStatus = 'streaming' | 'completed' | 'failed' | 'canceled';

export interface SiteChatTurnView {
  requestId: string;
  content: string;
  answer: string;
  status: SiteChatTurnStatus;
  modelId: string;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SiteChatConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
  preview: string;
}

export interface SiteChatConversationView {
  conversation: { id: string; title: string; createdAt: string; updatedAt: string };
  turns: SiteChatTurnView[];
}

// 公开对话的观测回调：service 记录模型尝试/切换，graph 记录 LangGraph 节点，
// controller 把这些事件转成 chat_logs 的 trace；它不参与生成，失败也不会中断对话。
export interface SiteChatTraceTokens {
  prompt: number;
  completion: number;
  total: number;
}

export interface SiteChatTraceEvent {
  at?: Date;
  stage: string;
  status: 'started' | 'completed' | 'failed';
  durationMs?: number;
  detail?: string;
  modelId?: string;
  modelLabel?: string;
  tokens?: SiteChatTraceTokens;
}

export type SiteChatTrace = (event: SiteChatTraceEvent) => void;

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// visitor ID 是匿名浏览器标识，不是认证凭据；用 UUID v4 约束格式，服务端只保存 sha256。
export function isVisitorId(value: unknown): value is string {
  return typeof value === 'string' && UUID_V4.test(value);
}

// 会话 ID 与 requestId 都使用同一套 UUID v4 规则，避免不同接口接受不同格式。
export function isUuid(value: unknown): value is string {
  return isVisitorId(value);
}

export function hashVisitor(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
