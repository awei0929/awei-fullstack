import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserRecord, UserRecordSchema } from './schemas/user.schema.js';
import { UsersService } from './users.service.js';

// UsersModule 封装用户存储与密码验证能力，不依赖 AuthModule，也不声明认证 HTTP 路由。
@Module({
  // forFeature 注册当前模块的用户模型，复用 DatabaseModule 已建立的默认 MongoDB 连接。
  // 模型只在本模块注册一次，UsersService 通过 @InjectModel(UserRecord.name) 获取它。
  imports: [MongooseModule.forFeature([{ name: UserRecord.name, schema: UserRecordSchema }])],
  // Nest 管理用户服务实例；导入本模块的使用方复用同一注册，不重复声明 UsersService。
  providers: [UsersService],
  // 只导出业务服务，用户模型保留在模块内部；认证模块通过服务完成注册、验证和查询。
  exports: [UsersService],
})
export class UsersModule {}
