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
  // imports：把任务模块的功能接入应用；模块主要负责组装，不是每次请求的处理步骤。
  imports: [
    // forRoot 读取 backend/.env；isGlobal 使各模块可以注入 ConfigService。
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: fileURLToPath(new URL('../.env', import.meta.url)),
    }),
    DatabaseModule,
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
      // forRoutes 指定生效的 Controller，包含它们的 GET、POST、PUT、DELETE 等路由。声明全局是 "*""，但不推荐，因为会记录健康检查等无关请求。
      // 全局 /api 前缀由 Nest 统一处理，不需要在这里重复拼写。
      .forRoutes(TasksController, StatsController);
  }
}
