import { IsString, Matches, ValidateBy } from 'class-validator';

// DTO 必须是运行时存在的类，装饰器把输入规则记录给全局 ValidationPipe 读取。
// 仅写 TypeScript 接口或 string 类型不会拒绝真实 HTTP 请求中的数字、null 或多余字段。
export class CredentialsDto {
  // 账号保持字符串以保留前导零；[0-9] 只允许 ASCII 数字，不接受全角数字或空格。
  @IsString({ message: '账号必须是字符串' })
  @Matches(/^[0-9]{3,5}$/, { message: '账号必须为3–5位数字' })
  account!: string;

  // 密码保持原值，按 Unicode 码点计数（包含变体选择符）；与前端 Array.from 一致。
  // 空格也是密码的一部分，不作trim或字符类别限制。
  @IsString({ message: '密码必须是字符串' })
  // 使用明确的自定义运行时校验，避免通用长度校验库合并某些变体选择符，造成前后端边界不同。
  @ValidateBy({
    name: 'passwordCodePointLength',
    validator: {
      // 输入仍先视为 unknown；字符串的 .length 统计 UTF-16 码元，不能直接作为码点数量。
      validate(value: unknown): boolean {
        if (typeof value !== 'string') return false;
        const length = Array.from(value).length;
        return length >= 8 && length <= 64;
      },
      defaultMessage: () => '密码长度为8–64个字符',
    },
  })
  password!: string;
}
