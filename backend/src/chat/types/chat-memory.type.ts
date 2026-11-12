// 公开记忆仅含可编辑内容和时间；ownerId、Mongo内部字段与模型配置永不返回客户端。
export interface ChatMemory {
  id: string;
  content: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
