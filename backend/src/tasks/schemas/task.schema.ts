import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';

// @Schema 描述 MongoDB 中任务文档的结构。DTO 描述 HTTP 输入，两者职责不同。
@Schema({
  collection: 'tasks',
  timestamps: true, // Mongoose 自动维护 createdAt、updatedAt。
  versionKey: false, // 不生成 Mongoose 默认的 __v 字段；当前模型未使用文档版本信息。
  id: false, // 关闭默认 id 虚拟属性，使用下面明确声明的公开 UUID 字段。
})
export class TaskRecord {
  // @Prop 声明一个要保存到文档中的字段及规则。
  // 保留当前 API 的 UUID id；MongoDB 自己的 _id 由 Mongoose 自动生成，前端不用改变。
  @Prop({
    type: String,
    required: true,
    default: () => randomUUID(),
    immutable: true,
    unique: true, // 为公开 id 建立唯一索引，便于快速定位任务。
  })
  id!: string;

  // 旧无主记录不迁移；新任务必须从会话写入 ownerId，而不是信任请求体的同名字段。
  // required 约束新写入，immutable 防止任务创建后改变归属；并不会自动补齐历史文档。
  @Prop({ type: String, required: true, immutable: true })
  ownerId!: string;

  // DTO 在 HTTP 入口校验；这里是模型层规则，也保护 Service 内部直接调用模型的情况。
  @Prop({ type: String, required: true, trim: true, minlength: 1, maxlength: 120 })
  title!: string;

  // 保留已有状态字段；Schema 的存在不等于已经提供修改状态的 HTTP 接口。
  @Prop({ type: Boolean, required: true, default: false })
  completed!: boolean;

  // timestamps 自动增加这两个日期字段；这里补充 TypeScript 类型声明。
  createdAt!: Date;
  updatedAt!: Date;
}

// 把带装饰器的类转换成 Mongoose 能使用的 Schema。
export const TaskRecordSchema = SchemaFactory.createForClass(TaskRecord);

// 复合索引对应“先筛选所属用户，再按创建时间和 _id 排序”的个人列表查询。
TaskRecordSchema.index({ ownerId: 1, createdAt: 1, _id: 1 });
