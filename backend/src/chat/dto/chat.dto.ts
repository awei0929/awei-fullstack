import { Transform } from 'class-transformer';
import { IsString, IsUUID, Matches, ValidateBy } from 'class-validator';

// 空DTO仍作为运行时类交给ValidationPipe，配合forbidNonWhitelisted拒绝额外字段。
export class EmptyChatDto {}
export class ConversationParamsDto { @IsUUID() id!: string; }
export class TurnParamsDto extends ConversationParamsDto { @IsUUID() requestId!: string; }
// 输入先trim；明确按Unicode码点计算，服务层只收到白名单业务字段。
export class StreamChatDto {
  @IsUUID() requestId!: string;
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  // 通用Length会合并变体选择符；使用Array.from与页面计数、服务层预算保持一致。
  @ValidateBy({
    name: 'chatContentCodePointLength',
    validator: {
      validate(value: unknown): boolean {
        if (typeof value !== 'string') return false;
        const length = Array.from(value).length;
        return length >= 1 && length <= 4000;
      },
      defaultMessage: () => '消息内容长度为1–4000个字符',
    },
  })
  content!: string;
  @IsString() @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/) modelId!: string;
}
