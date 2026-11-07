import { Module } from '@nestjs/common';
import { SystemModule } from '../system/system.module.js';
import { PublicController } from './public.controller.js';

// 公共模块只依赖系统运行信息，不导入 TasksModule，避免游客预览接触真实任务集合。
// imports 复用 SystemModule 导出的服务；无需在 providers 重复注册 SystemService。
@Module({ imports: [SystemModule], controllers: [PublicController] })
export class PublicModule {}
