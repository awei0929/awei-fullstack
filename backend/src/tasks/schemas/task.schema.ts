import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';

// @Schema 描述 MongoDB 中任务文档的结构。DTO 描述 HTTP 输入，两者职责不同。
@Schema({
  collection: 'tasks',
  timestamps: true, // Mongoose 自动维护 createdAt、updatedAt。
  versionKey: false,
  id: false, // 关闭默认 id 虚拟属性，使用下面明确声明的公开 UUID 字段。
})
export class TaskRecord {
  // @Prop 声明一个要保存到文档中的字段及规则。
  // 保留当前 API 的 UUID id；MongoDB 自己的 _id 仍由数据库生成，前端不用改变。
  @Prop({
    type: String,
    required: true,
    default: () => randomUUID(),
    immutable: true,
    unique: true, // 为公开 id 建立唯一索引，便于快速定位任务。
  })
  id!: string;

  // DTO 在 HTTP 入口校验；这里是模型层规则，也保护 Service 内部直接调用模型的情况。
  @Prop({ type: String, required: true, trim: true, minlength: 1, maxlength: 120 })
  title!: string;

  @Prop({ type: Boolean, required: true, default: false })
  completed!: boolean;

  // timestamps 自动增加这两个日期字段；这里补充 TypeScript 类型声明。
  createdAt!: Date;
  updatedAt!: Date;
}

// 把带装饰器的类转换成 Mongoose 能使用的 Schema。
export const TaskRecordSchema = SchemaFactory.createForClass(TaskRecord);
