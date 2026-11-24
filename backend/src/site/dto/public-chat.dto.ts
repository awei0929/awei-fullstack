import { ArrayMaxSize, IsArray, IsIn, IsObject, IsOptional, IsUUID, ValidateBy, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// 公开入口只接收一轮问题和有限上下文，不接受模型、提示词或会话ID等客户端可调参数。
function PublicText(max: number): PropertyDecorator {
  return ValidateBy({ name: 'publicChatText', constraints: [max], validator: {
    validate: (value: unknown) => typeof value === 'string' && Array.from(value).length >= 1 && Array.from(value).length <= max && value.trim().length > 0,
    defaultMessage: () => `文本须为 1–${max} 个字符`,
  } });
}

class PublicChatHistoryDto {
  @IsIn(['user', 'assistant']) role!: 'user' | 'assistant';
  @PublicText(500)
  content!: string;
}

export class PublicChatDto {
  // 由前端生成，服务端用它做单轮幂等；重复提交同一 requestId 不会重复调用模型。
  @IsUUID('4')
  requestId!: string;

  // 首条消息不传；第二条起必须指向当前 visitor 自己的会话，服务端会再次校验归属。
  @IsOptional() @IsUUID('4')
  conversationId?: string;

  // 500 个码点足够表达一个问题，也避免把整篇文章塞进提示词和模型预算。
  @PublicText(500)
  message!: string;

  // 旧前端仍可能发送最近上下文；保留字段做兼容校验，但新流程只使用服务端持久化的历史。
  @IsOptional() @IsArray() @ArrayMaxSize(6) @IsObject({ each: true }) @ValidateNested({ each: true }) @Type(() => PublicChatHistoryDto)
  history?: PublicChatHistoryDto[];
}
