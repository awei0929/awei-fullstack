import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DatabaseModule } from '../database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { TaskRecord, TaskRecordSchema } from './schemas/task.schema.js';
import { TasksController } from './tasks.controller.js';
import { TasksService } from './tasks.service.js';

// @Module 声明模块及其依赖，Nest 在应用启动时读取这些声明来组装对象。
@Module({
  imports: [
    // imports 建立依赖可见性：数据库模块提供连接，认证模块导出本模块要使用的守卫。
    DatabaseModule,
    AuthModule,
    // forFeature 为任务模块注册模型；连接由 DatabaseModule 中的 MongooseModule.forRootAsync 建立。
    // 注册后，TasksService 才能通过 @InjectModel(TaskRecord.name) 获取模型。
    MongooseModule.forFeature([{ name: TaskRecord.name, schema: TaskRecordSchema }]),
  ],
  // controllers：注册本模块的 HTTP 请求入口。
  controllers: [TasksController],
  // providers 注册任务服务；@UseGuards 传入的守卫类由 Nest 在当前模块上下文创建，
  // 守卫依赖的 AuthService 则从导入的 AuthModule 解析，不必在这里重复注册。
  providers: [TasksService],
  // exports：把本模块的服务公开给导入 TasksModule 的模块，例如 StatsModule。
  // 其他模块通过 imports 复用这份服务，不需要再注册一份 TasksService。
  // 仅导出业务服务，不直接向统计模块暴露数据库 Model，查询与归属规则集中在一处。
  exports: [TasksService],
})
export class TasksModule {}
