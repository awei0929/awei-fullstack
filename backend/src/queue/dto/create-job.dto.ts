import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

// DTO 是 HTTP 输入边界：全局 ValidationPipe 会 trim、校验类型与长度，并拒绝额外字段。
// ownerId、状态、进度等字段都由服务端决定，不能从请求体传入。
export class CreateJobDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: '作业标签必须是字符串' })
  @MinLength(1, { message: '请输入作业标签' })
  @MaxLength(80, { message: '作业标签最多 80 个字符' })
  label!: string;
}
