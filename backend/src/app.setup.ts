import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';

export function configureApp(app: INestApplication): void {
  // 所有 Controller 路由统一加上 /api 前缀。
  app.setGlobalPrefix('api');
  // 全局管道会在 Controller 方法执行前检查参数。
  // DTO 中的装饰器负责登记规则，ValidationPipe 负责读取规则并执行校验。
  app.useGlobalPipes(
    new ValidationPipe({
      // 让 Controller 收到转换后的 DTO 实例，例如已经去掉标题两端空白的对象。
      transform: true,
      // 只接受 DTO 中有校验规则的字段。
      whitelist: true,
      // 与 whitelist 配合：出现额外字段直接返回 400，而不是静默丢弃。
      forbidNonWhitelisted: true,
    }),
  );
  // 收到退出信号时执行 Nest 生命周期钩子，便于后续关闭数据库连接等资源。
  app.enableShutdownHooks();
}
