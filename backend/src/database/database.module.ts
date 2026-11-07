import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

// 数据库模块只负责建立连接；用户/任务字段和业务操作分别由UsersModule、TasksModule管理。
@Module({
  imports: [
    // forRootAsync 配置整个应用使用的数据库连接。其核心模块是全局模块，
    // 默认连接注册为全局Provider，业务模块可用forFeature注册各自模型。
    // inject 与构造函数注入类似：Nest 先提供 ConfigService，再调用 useFactory。
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        // 从 backend/.env 读取连接地址；配置缺失就停止启动，不把密码写进源码。
        uri: configService.getOrThrow<string>('MONGODB_URI'),
        // MongoDB驱动最多等待5秒选择可用服务器；Nest连接失败后按下方次数和间隔重试。
        serverSelectionTimeoutMS: 5000,
        retryAttempts: 3,
        retryDelay: 1000,
      }),
    }),
  ],
  // 重新导出Mongoose模块入口；默认连接的全局可见性来自forRootAsync内部的核心模块。
  exports: [MongooseModule],
})
export class DatabaseModule {}
