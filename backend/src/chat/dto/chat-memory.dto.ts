import { Transform } from 'class-transformer';
import { IsBoolean, IsString, IsUUID, ValidateBy, ValidateIf } from 'class-validator';

// 通用Length会合并变体选择符；明确以码点计数，与前端Array.from及10000字符总预算一致。
function MemoryContentLength(): PropertyDecorator {
  return ValidateBy({
    name: 'memoryContentCodePointLength',
    validator: {
      validate(value: unknown): boolean {
        if (typeof value !== 'string') return false;
        const length = Array.from(value).length;
        return length >= 1 && length <= 500;
      },
      defaultMessage: () => '记忆内容长度为1–500个字符',
    },
  });
}

// DTO只接受HTTP合同字段：先trim，再按Unicode码点限制长度；id由服务端生成。
export class MemoryParamsDto { @IsUUID() id!: string; }
export class CreateMemoryDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MemoryContentLength() content!: string;
}
export class UpdateMemoryDto {
  // ValidateIf只跳过未提供字段；null仍要校验，不能借“可选”清空内容或启用状态。
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MemoryContentLength() content?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsBoolean() enabled?: boolean;
}
