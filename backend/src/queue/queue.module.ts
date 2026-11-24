import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { JobsController } from './jobs.controller.js';
import { JobsService } from './jobs.service.js';
import { JobsWorker } from './jobs.worker.js';
import { QueueConfig } from './queue.config.js';
import { JobRecord, JobRecordSchema } from './schemas/job.schema.js';

// 队列作为独立业务模块：复用认证守卫与数据库连接，不重复注册用户或会话服务。
// Service 负责受理/查询，Worker 负责消费；两者通过同一个 Mongoose Model 协作。
@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    MongooseModule.forFeature([{ name: JobRecord.name, schema: JobRecordSchema }]),
  ],
  controllers: [JobsController],
  providers: [JobsService, JobsWorker, QueueConfig],
  exports: [JobsService],
})
export class QueueModule {}
