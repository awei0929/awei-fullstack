import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

// 管理端查询参数也必须经过运行时校验；limit 限制单页大小，offset 防止无界翻页。
export class ListChatLogsDto {
  @IsOptional() @IsIn(['site', 'owner'])
  channel?: 'site' | 'owner';

  @IsOptional() @IsIn(['streaming', 'completed', 'failed', 'canceled', 'interrupted'])
  status?: 'streaming' | 'completed' | 'failed' | 'canceled' | 'interrupted';

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000)
  offset?: number;
}
