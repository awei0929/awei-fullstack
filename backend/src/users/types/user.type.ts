// 公开响应类型只描述接口可见字段；密码哈希和 MongoDB 内部 _id 不属于前端用户信息。
// interface 编译后会被擦除，不能替代 DTO 的运行时输入校验。
export interface User { id: string; account: string }

// 用户服务接收的业务输入类型；注册和密码验证复用同一种结构，不依赖 HTTP 层。
// 这里不做运行时校验：认证入口的 CredentialsDto 结构与它兼容，并由 ValidationPipe 校验。
export interface UserCredentials { account: string; password: string }
