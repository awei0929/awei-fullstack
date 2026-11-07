import { Controller, Get } from '@nestjs/common';
import { SystemService } from '../system/system.service.js';
import type { Task } from '../tasks/task.type.js';

// 示例独立于数据库：稳定 id 和时间方便游客预览，不暴露历史无主任务，也不复制给新用户。
// Readonly 仅提供 TypeScript 编译期保护；下面的响应还会逐条复制，避免调用方修改常量对象。
const examples: ReadonlyArray<Readonly<Task>> = [
  { id: '7b5f3a10-63d2-4bd1-a0af-000000000001', title: '欢迎使用任务管理，登录后创建自己的任务', completed: false, createdAt: '2026-01-01T00:00:00.000Z' },
  { id: '7b5f3a10-63d2-4bd1-a0af-000000000002', title: '试试编辑任务标题', completed: false, createdAt: '2026-01-01T00:01:00.000Z' },
  { id: '7b5f3a10-63d2-4bd1-a0af-000000000003', title: '整理今天需要完成的事情', completed: false, createdAt: '2026-01-01T00:02:00.000Z' },
];

// 只提供 GET /api/public/*，不绑定 SessionGuard，因此未登录也能浏览；这里没有写入路由。
@Controller('public')
export class PublicController {
  // 通过模块 imports 注入共享的系统服务，公共与个人统计采用同一个启动时间基准。
  constructor(private readonly system: SystemService) {}
  @Get('tasks')
  // 当前任务字段都是标量，逐条浅拷贝即可隔离每次返回的数据，不需要数据库查询。
  tasks(): Task[] { return examples.map(task => ({ ...task })); }
  @Get('stats')
  // 数量直接取同一份示例数组，不能复用个人 TasksService.count 或统计整个任务集合。
  stats() { return { total: examples.length, uptimeSeconds: this.system.getUptimeSeconds() }; }
}
