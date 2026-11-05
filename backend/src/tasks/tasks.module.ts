import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DatabaseModule } from '../database/database.module.js';
import { TaskWriteGuard } from './guards/task-write.guard.js';
import { TaskRecord, TaskRecordSchema } from './schemas/task.schema.js';
import { TasksController } from './tasks.controller.js';
import { TasksService } from './tasks.service.js';

// @Module 声明模块及其依赖，Nest 在应用启动时读取这些声明来组装对象。
@Module({
  imports: [
    DatabaseModule,
    // forFeature 为任务模块注册模型；连接由 DatabaseModule.forRootAsync 建立。
    // 注册后，TasksService 才能通过 @InjectModel(TaskRecord.name) 获取模型。
    MongooseModule.forFeature([{ name: TaskRecord.name, schema: TaskRecordSchema }]),
  ],
  // controllers：注册本模块的 HTTP 请求入口。
  controllers: [TasksController],
  // providers：注册服务和守卫，使它们由 Nest 管理，并支持构造函数依赖注入。
  providers: [TasksService, TaskWriteGuard],
  // exports：把本模块的服务公开给导入 TasksModule 的模块，例如 StatsModule。
  // 其他模块通过 imports 复用这份服务，不需要再注册一份 TasksService。
  exports: [TasksService],
})
export class TasksModule {}
