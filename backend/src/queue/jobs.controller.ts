import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CsrfGuard } from '../auth/guards/csrf.guard.js';
import { SessionGuard } from '../auth/guards/session.guard.js';
import { CreateJobDto } from './dto/create-job.dto.js';
import { JobsService } from './jobs.service.js';
import type { JobView } from './types/job.type.js';

// Controller 只处理 HTTP：认证、CSRF、DTO 校验后把可信 ownerId 交给 Service。
// 类级 SessionGuard 覆盖读写；写接口额外要求会话绑定的 CSRF 令牌。
@Controller('jobs')
@UseGuards(SessionGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  list(@Req() request: Request): Promise<JobView[]> {
    return this.jobsService.list(request.authUser!.id);
  }

  // 作业只是被受理，还没有执行完，所以返回 202 而不是 201。
  // 响应体直接给出作业视图，前端无需再查一次才能拿到 jobId。
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(CsrfGuard)
  create(@Req() request: Request, @Body() input: CreateJobDto): Promise<JobView> {
    return this.jobsService.create(request.authUser!.id, input.label);
  }
}
