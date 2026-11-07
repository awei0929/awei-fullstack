import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { SessionGuard } from '../auth/guards/session.guard.js';
import { StatsService } from './stats.service.js';
import type { TaskStats } from './stats.type.js';

// GET /api/stats 是个人统计；会话守卫先确认用户，未登录时不执行统计查询。
@Controller('stats')
@UseGuards(SessionGuard)
export class StatsController {
  // Controller 只负责 HTTP 入口，组合多个数据来源的工作交给 StatsService。
  constructor(private readonly statsService: StatsService) {}
  @Get()
  getOverview(@Req() request: Request): Promise<TaskStats> {
    // authUser 由守卫写入，客户端不能通过参数统计他人的任务数量。
    return this.statsService.getOverview(request.authUser!.id);
  }
}
