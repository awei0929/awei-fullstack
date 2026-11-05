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

  async findAll(): Promise<Task[]> {
    // find 查询数据库；exec 执行查询并返回 Promise，await 等待数据库结果。
    // lean 返回普通对象，适合只读列表；排序保持任务创建顺序。
    const records = await this.taskModel.find().sort({ createdAt: 1, _id: 1 }).lean().exec();
    return records.map((record) => this.toTask(record));
  }

  async count(): Promise<number> {
    // 直接让 MongoDB 统计数量，不把所有任务先取回内存。
    return this.taskModel.countDocuments().exec();
  }

  async create(input: CreateTaskDto): Promise<Task> {
    // create 会真正写入 MongoDB；UUID、默认状态和时间由 Schema 配置生成。
    const record = await this.taskModel.create({ title: input.title });
    return this.toTask(record);
  }

  async edit(id: string, input: CreateTaskDto): Promise<Task> {
    // 一次查询完成查找和修改，避免“先读出来再写回去”的间隔。
    // $set 只允许改标题；returnDocument 返回修改后的文档；runValidators 开启更新校验。
    const record = await this.taskModel.findOneAndUpdate(
      { id },
      { $set: { title: input.title } },
      { returnDocument: 'after', runValidators: true },
    ).exec();

    if (!record) {
      throw new NotFoundException('任务不存在');
    }
    return this.toTask(record);
  }

  async remove(id: string): Promise<Task> {
    // 一次操作删除指定任务，并返回删除前的文档；没找到时返回 null。
    const record = await this.taskModel.findOneAndDelete({ id }).exec();
    if (!record) {
      throw new NotFoundException('任务不存在');
    }
    return this.toTask(record);
  }

  private toTask(record: TaskRecord): Task {
    // 数据库存储结构和接口响应分开：只返回原有公开字段，不暴露 _id、updatedAt 等内部字段。
    // MongoDB 中的 Date 转为 ISO 字符串，保持前端原来的数据格式。
    return {
      id: record.id,
      title: record.title,
      completed: record.completed,
      createdAt: record.createdAt.toISOString(),
    };
  }
}
