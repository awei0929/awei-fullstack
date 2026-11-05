import { Injectable } from '@nestjs/common';
import { TasksService } from '../tasks/tasks.service.js';
import { SystemService } from '../system/system.service.js';
import type { TaskStats } from './stats.type.js';

// @Injectable 让 Nest 可以创建并注入统计服务；还需要在 StatsModule.providers 中注册。
@Injectable()
export class StatsService {
  // 构造函数接收多个参数，Nest 根据各参数的类型分别找到对应的服务实例。
  // private readonly 是 TypeScript 参数属性写法，会自动保存成 this.tasksService、this.systemService。
  // 它们是两个独立参数，并不是把模块对象传进来；这里注入的是 Service 实例。
  constructor(
    // 来自 TasksModule.exports，与任务接口查询同一个数据库集合。
    private readonly tasksService: TasksService,
    // 来自 SystemModule.exports，提供后端运行时长。
    private readonly systemService: SystemService,
  ) {}

  async getOverview(): Promise<TaskStats> {
    // 通过任务模块公开的方法查询数据库，不在统计模块额外保存任务副本。
    // 统计服务在这里聚合两个模块公开的能力，返回给同一个统计接口。
    return {
      // 必须 await：否则 total 会变成一个 Promise，而不是接口需要的数字。
      total: await this.tasksService.count(),
      uptimeSeconds: this.systemService.getUptimeSeconds(),
    };
  }
}
