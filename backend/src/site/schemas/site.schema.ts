import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';
import type { SiteContent } from '../types/site.type.js';

// 单站点使用唯一key；首次保存并发也由数据库索引裁决，不能用“先查后写”保证唯一性。
@Schema({ collection: 'site_documents', versionKey: false })
export class SiteRecord {
  @Prop({ type: String, required: true, unique: true, immutable: true }) key!: string;
  @Prop({ type: Number, required: true }) version!: number;
  // HTTP DTO已逐层验证；整体替换一个内容字段，保证所有分区原子保存而非部分发布。
  @Prop({ type: MongooseSchema.Types.Mixed, required: true }) content!: SiteContent;
  @Prop({ type: Date, required: true }) updatedAt!: Date;
}
export const SiteRecordSchema = SchemaFactory.createForClass(SiteRecord);
