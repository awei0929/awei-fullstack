import { ChatModule } from './chat/chat.module.js';
import { ChatController } from './chat/chat.controller.js';
import { SiteModule } from './site/site.module.js';
import { SiteController } from './site/site.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { AuthController } from './auth/auth.controller.js';
import { PublicModule } from './public/public.module.js';
import { PublicController } from './public/public.controller.js';
import { Module } from '@nestjs/common';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { fileURLToPath } from 'node:url';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware.js';
import { DatabaseModule } from './database/database.module.js';
import { TasksModule } from './tasks/tasks.module.js';
import { TasksController } from './tasks/tasks.controller.js';
import { StatsModule } from './stats/stats.module.js';
import { StatsController } from './stats/stats.controller.js';
import { SystemModule } from './system/system.module.js';

// @Module 标记应用根模块，NestFactory.create(AppModule) 从这里开始组织依赖。
@Module({
  // imports：接入数据库、认证、公共示例与任务模块；声明的是依赖关系，不是请求执行顺序。
  imports: [
    // forRoot 读取 backend/.env；isGlobal 使各模块可以注入 ConfigService。
    ConfigModule.forRoot({
      isGlobal: true,
      // HTTP测试只使用调用者显式传入的测试环境，绝不能从真实.env补入线上连接或模型Key。
      ignoreEnvFile: process.env.NODE_ENV === 'test',
      envFilePath: fileURLToPath(new URL('../.env', import.meta.url)),
    }),
    DatabaseModule,
    AuthModule,
    PublicModule,
    SiteModule,
    ChatModule,
    TasksModule,
    SystemModule,
    StatsModule,
  ],
  providers: [
    {
      // APP_FILTER 是 Nest 提供的特殊标识：将此过滤器绑定到整个应用的 HTTP 请求。
      // useClass 让 Nest 创建和管理实例，也支持以后通过构造函数注入其他服务。
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
// NestModule 约定模块可以提供 configure 方法，用来绑定中间件。
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      // apply 指定要执行的中间件；绑定后由 Nest 管理它的实例。
      .apply(RequestLoggerMiddleware)
      // forRoutes 指定需要记录的 Controller，包含它们全部HTTP方法；不打印密码、Cookie或请求体。
      // 全局 /api 前缀由 Nest 统一处理，不需要在这里重复拼写。
      .forRoutes(TasksController, StatsController, AuthController, PublicController, SiteController, ChatController);
  }
}
