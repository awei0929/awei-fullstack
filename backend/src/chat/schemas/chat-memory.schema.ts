import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

// 每站主只有一个有界文档，新增时将“仍有名额”与push放进同一次原子更新。
// 子项不用Mongo _id；HTTP公开UUID由服务创建，编辑/删除按items.id定位。
@Schema({ _id: false })
export class MemoryItemRecord {
  @Prop({ type: String, required: true }) id!: string;
  @Prop({ type: String, required: true }) content!: string;
  @Prop({ type: Boolean, required: true }) enabled!: boolean;
  @Prop({ type: Date, required: true }) createdAt!: Date;
  @Prop({ type: Date, required: true }) updatedAt!: Date;
}
const MemoryItemSchema = SchemaFactory.createForClass(MemoryItemRecord);

@Schema({ collection: 'chat_memories', versionKey: false, id: false })
export class ChatMemoryRecord {
  @Prop({ type: String, required: true, unique: true, immutable: true }) ownerId!: string;
  @Prop({ type: [MemoryItemSchema], default: [] }) items!: MemoryItemRecord[];
}
export const ChatMemorySchema = SchemaFactory.createForClass(ChatMemoryRecord);
