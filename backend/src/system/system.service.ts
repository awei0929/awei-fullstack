import { Injectable } from '@nestjs/common';

// @Injectable 标记这个类可以由 Nest 创建并注入，需同时在 SystemModule.providers 注册。
@Injectable()
export class SystemService {
  // 服务实例创建时记录启动时间；默认单例作用域下，多次请求复用同一份记录。
  private readonly startedAt = Date.now();

  getUptimeSeconds(): number {
    // 返回后端应用本次运行的秒数，重启后会重新计时。
    // 每次调用按时间差即时计算，无需定时器；这与 MongoDB 中任务和 Session 的持久化无关。
    return Math.floor((Date.now() - this.startedAt) / 1000);
  }
}
