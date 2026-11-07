import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

// DTO 是运行时类：全局 ValidationPipe 读取装饰器，拒绝未声明字段并返回 400。
// 这里只声明用户可以填写的标题；id、ownerId、状态和时间都由服务端决定。
export class CreateTaskDto {
  // @Transform 登记字段转换逻辑：请求体转换成 DTO 时，去掉标题两端空白。
  // ({ value }) 是参数解构，value 是当前字段值；回调的返回值就是转换后的字段值。
  // 先判断类型，保留数字、null 等非法值，让后面的规则将它们拒绝。
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  // 以下装饰器登记校验规则，由全局 ValidationPipe 在请求进入 Controller 前执行。
  // @IsString：必须是字符串；不会把数字自动变成字符串。
  @IsString({ message: '任务标题必须是字符串' })
  // @MinLength：至少 1 个字符，因此空字符串、纯空白标题都会校验失败。
  @MinLength(1, { message: '请输入任务标题' })
  // @MaxLength：限制标题长度，避免接收过长的输入。
  @MaxLength(120, { message: '任务标题最多 120 个字符' })
  // ! 是 TypeScript 的确定赋值断言；真正的值来自请求体，它本身不负责校验。
  title!: string;
}
