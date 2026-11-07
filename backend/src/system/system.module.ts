import { Module } from '@nestjs/common';
import { SystemService } from './system.service.js';

@Module({
  // providers 注册这个模块自己的系统信息服务。
  providers: [SystemService],
  // exports 允许导入 SystemModule 的其他模块注入 SystemService。
  // StatsModule 和 PublicModule 复用此服务，避免各自注册导致启动时间基准不同。
  exports: [SystemService],
})
// 模块可以只提供 Service，不一定需要 Controller。这里由个人和公共统计接口返回系统信息。
export class SystemModule {}
