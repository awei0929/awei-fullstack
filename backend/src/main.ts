import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';

async function bootstrap() {
  // 创建应用，并根据 AppModule 的声明实例化 Controller、Service 等依赖。
  const app = await NestFactory.create(AppModule);
  // 配置接口前缀与全局参数校验。
  configureApp(app);
  // 启动本机 HTTP 服务，默认端口 3000。
  await app.listen(Number(process.env.PORT ?? 3000), '127.0.0.1');
  console.log(`任务接口已启动：${await app.getUrl()}/api/tasks`);
}
await bootstrap();
