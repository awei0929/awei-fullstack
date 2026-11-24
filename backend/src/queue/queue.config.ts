import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// 队列配置集中读取环境变量，便于本地演示与 HTTP 测试调整节奏。
// 这里不保存任何凭据；测试通过 startApp 的 config 覆盖即可关闭自动轮询。
@Injectable()
export class QueueConfig {
  constructor(private readonly config: ConfigService) {}

  workerEnabled(): boolean {
    // 只有显式写成 false 才关闭；空值和拼写错误不会悄悄停掉 Worker。
    return this.config.get<string>('QUEUE_WORKER_ENABLED', 'true').toLowerCase() !== 'false';
  }

  pollIntervalMs(): number {
    return this.integer('QUEUE_POLL_INTERVAL_MS', 500, 1);
  }

  stepMs(): number {
    return this.integer('QUEUE_JOB_STEP_MS', 300, 1);
  }

  steps(): number {
    return this.integer('QUEUE_JOB_STEPS', 4, 1);
  }

  leaseMs(): number {
    return this.integer('QUEUE_JOB_LEASE_MS', 10000, 1000);
  }

  concurrency(): number {
    return this.integer('QUEUE_CONCURRENCY', 2, 1);
  }

  private integer(key: string, fallback: number, min: number): number {
    const raw = this.config.get<string | number>(key);
    if (raw === undefined || raw === '') return fallback;
    const value = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isInteger(value) || value < min) {
      // 配置错误在启动时明确失败，比运行时反复吞掉异常更容易定位。
      throw new Error(`${key} 必须是大于等于 ${min} 的整数`);
    }
    return value;
  }
}
