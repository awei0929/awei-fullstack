import { CreateTaskDto } from './create-task.dto.js';

// 编辑标题时，id 来自 URL 路径，请求体只需要 title。
// extends 会继承 CreateTaskDto 的标题字段，以及标题转换、校验规则。
// 这里保留一个真正的类，ValidationPipe 才能在运行时读取这些规则。
// Partial<T> 只是 TypeScript 类型，编译后会消失，不能代替这个 DTO 类。
// 路径 id 由 Controller 上的 ParseUUIDPipe 单独校验，不再在请求体重复声明。
// 编辑仍要求完整标题，不使用 PartialType 将字段变为可选；权限与归属不属于 DTO 的职责。
export class EditTaskDto extends CreateTaskDto {}
