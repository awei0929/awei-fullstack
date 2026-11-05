import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

// 数据库模块只负责建立连接；任务的字段和业务操作仍由 TasksModule 管理。
@Module({
  imports: [
    // forRootAsync 配置整个应用使用的数据库连接。
    // inject 与构造函数注入类似：Nest 先提供 ConfigService，再调用 useFactory。
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        // 从 backend/.env 读取连接地址；配置缺失就停止启动，不把密码写进源码。
        uri: configService.getOrThrow<string>('MONGODB_URI'),
        serverSelectionTimeoutMS: 5000,
        retryAttempts: 3,
        retryDelay: 1000,
      }),
    }),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}
