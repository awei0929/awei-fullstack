// Nest借助装饰器元数据解析构造函数依赖；在创建应用前先加载元数据支持。
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';

async function bootstrap() {
  // 创建应用，并根据 AppModule 的声明实例化 Controller、Service 等依赖。
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // 生产由本机 nginx 反向代理；只信任 loopback 转发的 X-Forwarded-For，否则限流会把所有访客算成同一个 IP。
  // 代理不在这台机器时可用 TRUST_PROXY 覆盖（Express 语法，如 loopback / 10.0.0.0/8）。
  app.set('trust proxy', process.env.TRUST_PROXY?.trim() || 'loopback');
  // 配置Session中间件、接口前缀与全局参数校验；必须等待配置完成后再接收请求。
  await configureApp(app);
  // 启动本机 HTTP 服务，默认端口 3000。
  await app.listen(Number(process.env.PORT ?? 3000), '127.0.0.1');
  console.log(`任务接口已启动：${await app.getUrl()}/api/tasks`);
}
await bootstrap();
