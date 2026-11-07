import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { TaskRecord } from './schemas/task.schema.js';
import type { CreateTaskDto } from './dto/create-task.dto.js';
import type { Task } from './task.type.js';

// @Injectable 标记此类可以参与 Nest 依赖注入；还需要在 Module.providers 中注册。
@Injectable()
export class TasksService {
  // @InjectModel 按模型名称向 Nest 获取 TasksModule 注册的 Mongoose Model。
  // Model 是操作 tasks 集合的入口，不是一条任务，也不是一个内存数组。
  constructor(
    @InjectModel(TaskRecord.name) private readonly taskModel: Model<TaskRecord>,
  ) {}

  async findAll(ownerId: string): Promise<Task[]> {
    // find 查询数据库；exec 执行查询并返回 Promise，await 等待数据库结果。
    // lean 返回普通对象，适合只读列表；排序保持任务创建顺序。
    // 每次查询都带 ownerId，历史无主记录和其他用户任务不会进入个人列表。
    const records = await this.taskModel.find({ ownerId }).sort({ createdAt: 1, _id: 1 }).lean().exec();
    return records.map((record) => this.toTask(record));
  }

  async count(ownerId: string): Promise<number> {
    // 直接让 MongoDB 统计数量，不把所有任务先取回内存。
    // 统计与列表使用相同的归属条件，不能用整个集合数量泄漏其他用户的任务信息。
    return this.taskModel.countDocuments({ ownerId }).exec();
  }

  async create(ownerId: string, input: CreateTaskDto): Promise<Task> {
    // create 会真正写入 MongoDB；UUID、默认状态和时间由 Schema 配置生成。
    // 显式选择 title 并写入可信 ownerId，不把整个客户端对象直接展开到数据库记录。
    const record = await this.taskModel.create({ title: input.title, ownerId });
    return this.toTask(record);
  }

  async edit(ownerId: string, id: string, input: CreateTaskDto): Promise<Task> {
    // 一次查询完成查找和修改，避免“先读出来再写回去”的间隔。
    // $set 只允许改标题；returnDocument 返回修改后的文档；runValidators 开启更新校验。
    // id 与 ownerId 一起作为原子更新条件，权限判断和写入不能拆成两次数据库操作。
    const record = await this.taskModel.findOneAndUpdate(
      { id, ownerId },
      { $set: { title: input.title } },
      { returnDocument: 'after', runValidators: true },
    ).exec();

    if (!record) {
      // 不存在与不属于本人使用同一个 404，避免暴露其他用户是否拥有该任务。
      throw new NotFoundException('任务不存在');
    }
    return this.toTask(record);
  }

  async remove(ownerId: string, id: string): Promise<Task> {
    // 一次操作删除指定任务，并返回删除前的文档；没找到时返回 null。
    // 同样把归属条件放进原子删除，不先查出任意用户的任务再尝试鉴权。
    const record = await this.taskModel.findOneAndDelete({ id, ownerId }).exec();
    if (!record) {
      throw new NotFoundException('任务不存在');
    }
    return this.toTask(record);
  }

  private toTask(record: TaskRecord): Task {
    // 数据库存储结构和接口响应分开：只返回原有公开字段，不暴露 _id、ownerId、updatedAt 等内部字段。
    // MongoDB 中的 Date 转为 ISO 字符串，保持前端原来的数据格式。
    return {
      id: record.id,
      title: record.title,
      completed: record.completed,
      createdAt: record.createdAt.toISOString(),
    };
  }
}
