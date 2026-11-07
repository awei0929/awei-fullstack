import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { SessionGuard } from '../auth/guards/session.guard.js';
import { CsrfGuard } from '../auth/guards/csrf.guard.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { EditTaskDto } from './dto/edit-task.dto.js';
import { TasksService } from './tasks.service.js';
import type { Task } from './task.type.js';

// Controller 负责把 HTTP 输入交给业务服务；全局 /api 前缀与这里组合成 /api/tasks。
// 类上的守卫覆盖全部方法，先确认会话并写入 request.authUser，游客不能读取个人任务。
@Controller('tasks')
@UseGuards(SessionGuard)
export class TasksController {
  // Nest 注入 TasksModule 注册的服务，Controller 不自行 new 服务，也不直接操作数据库。
  constructor(private readonly tasksService: TasksService) {}

  // @Get() 匹配 GET /api/tasks；@Req() 读取已通过守卫的请求对象。
  @Get()
  findAll(@Req() request: Request): Promise<Task[]> {
    // 用户身份来自服务端 Session，不能从客户端查询参数或请求体指定。
    return this.tasksService.findAll(request.authUser!.id);
  }

  // 类级认证先于方法级CSRF，最后才执行DTO/路径校验。
  // @Post() 默认成功状态为 201；@Body() 配合 DTO 类让全局管道执行转换和校验。
  @Post()
  @UseGuards(CsrfGuard)
  create(@Req() request: Request, @Body() input: CreateTaskDto): Promise<Task> {
    return this.tasksService.create(request.authUser!.id, input);
  }

  // 路径 id 和请求体各有职责：ParseUUIDPipe 检查定位参数，EditTaskDto 检查可编辑字段。
  // UUID 格式正确不代表属于当前用户，归属检查仍由 Service 的数据库过滤完成。
  @Put(':id')
  @UseGuards(CsrfGuard)
  edit(
    @Req() request: Request,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() input: EditTaskDto,
  ): Promise<Task> {
    return this.tasksService.edit(request.authUser!.id, id, input);
  }

  // DELETE 只接收路径 id，返回被删除的公开任务，前端据此移除对应列表项。
  @Delete(':id')
  @UseGuards(CsrfGuard)
  remove(@Req() request: Request, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<Task> {
    return this.tasksService.remove(request.authUser!.id, id);
  }
}
