import { AuthModule } from '../auth/auth.module.js';
import { Module } from '@nestjs/common';
import { TasksModule } from '../tasks/tasks.module.js';
import { SystemModule } from '../system/system.module.js';
import { StatsController } from './stats.controller.js';
import { StatsService } from './stats.service.js';

// @Module 描述统计功能的入口、服务及依赖，由 Nest 在启动时组装。
@Module({
  // imports：同时使用任务模块和系统模块各自导出的 Service。
  // 即使两个业务模块都被 AppModule 导入，这里仍需显式声明依赖。
  // 多个模块就放进同一个 imports 数组，对应的服务分别在 StatsService 构造函数中声明。
  // AuthModule 则提供 SessionGuard，让统计接口与个人任务列表使用同一认证边界。
  imports: [TasksModule, SystemModule, AuthModule],
  controllers: [StatsController], // 对外只开放本模块的统计路由。
  // 这里只注册本模块的服务。再次注册 TasksService 可能会创建另一份实例。
  providers: [StatsService],
  // 当前没有其他模块消费 StatsService，因此不需要 exports；公共统计独立计算示例数量。
})
export class StatsModule {}
