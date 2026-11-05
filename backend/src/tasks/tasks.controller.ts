import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { TaskWriteGuard } from './guards/task-write.guard.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { EditTaskDto } from './dto/edit-task.dto.js';
import { TasksService } from './tasks.service.js';
import type { Task } from './task.type.js';

// @Controller 声明这个类处理 tasks 路径，结合全局前缀得到 /api/tasks。
@Controller('tasks')
export class TasksController {
  // Nest 根据构造参数类型注入 TasksService，无需手动 new。
  // private readonly 同时声明并保存一个实例属性，限制重新赋值这个属性。
  constructor(private readonly tasksService: TasksService) {}

  // @Get 将下面的方法绑定到 GET /api/tasks；方法名可以自行命名。
  // 查询没有绑定写入守卫，因此不需要携带演示密钥。
  @Get()
  // 数据库操作是异步的；Nest 会等待 Promise 完成，再把结果作为 JSON 返回。
  findAll(): Promise<Task[]> {
    return this.tasksService.findAll();
  }

  // @Post 绑定 POST /api/tasks，默认成功状态码为 201。
  // @Body 指定参数来自整个 JSON 请求体；校验由 ValidationPipe 按 DTO 规则执行。
  @Post()
  // @UseGuards 将守卫绑定到当前方法；只有守卫放行，才校验参数并执行 create。
  @UseGuards(TaskWriteGuard)
  create(@Body() input: CreateTaskDto): Promise<Task> {
    return this.tasksService.create(input);
  }

  // @Put 绑定 PUT /api/tasks/:id，默认成功状态码为 200。
  // 它负责路由匹配，实际查找和修改任务由 Service 完成。
  @Put(':id')
  // 编辑与创建共用同一个守卫，避免在各个业务方法中重复检查访问资格。
  @UseGuards(TaskWriteGuard)
  edit(
    // @Param('id') 提取路径中的 id；ParseUUIDPipe 校验这个路径参数是否为 UUID v4。
    // 路径参数与请求体是两份输入，校验 Body 的 DTO 不会顺便校验这里的 id。
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    // 编辑 DTO 只校验请求体中的 title，id 已经放在路径中。
    @Body() input: EditTaskDto,
  ): Promise<Task> {
    return this.tasksService.edit(id, input);
  }

  // @Delete 的首字母大写，其余小写；它匹配 HTTP DELETE /api/tasks/:id。
  // HTTP 方法名叫 DELETE，但 NestJS 导出的装饰器名叫 Delete。
  @Delete(':id')
  // 方法级绑定仅保护当前接口；如果放在 Controller 类上，则保护该类的所有接口。
  @UseGuards(TaskWriteGuard)
  remove(
    // 删除同样从 URL 取得 id，格式错误会在进入业务方法前返回 400。
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<Task> {
    // Controller 只处理 HTTP 参数，删除和“不存在”的判断交给 Service。
    // 返回任务对象，因此成功状态码使用默认的 200，而不是无响应体的 204。
    return this.tasksService.remove(id);
  }
}
