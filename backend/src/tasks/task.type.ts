// 公开响应类型只描述交给前端的数据；interface 编译后消失，不执行运行时输入校验。
// 输入约束交给 DTO，数据库字段交给 Schema，Service 显式映射为这里的结构。
export interface Task {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string; // HTTP 使用 ISO 字符串，不直接暴露数据库中的 Date 对象。
}
