import { Controller, Get } from '@nestjs/common';
import { StatsService } from './stats.service.js';
import type { TaskStats } from './stats.type.js';

// @Controller 为统计接口声明路径，结合全局前缀得到 /api/stats。
@Controller('stats')
export class StatsController {
  // 注入统计模块自己的 Service，跨模块调用放在 Service 中完成。
  constructor(private readonly statsService: StatsService) {}

  // @Get() 匹配 GET /api/stats，默认成功状态为 200。
  @Get()
  getOverview(): Promise<TaskStats> {
    return this.statsService.getOverview();
  }
}
