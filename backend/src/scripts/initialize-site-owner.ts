import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AppModule } from '../app.module.js';
import { CredentialsDto } from '../auth/dto/credentials.dto.js';
import { UsersService } from '../users/users.service.js';

// 只供本机操作员调用；不监听HTTP、不接收命令行密码、不打印密码或数据库连接串。
// 输入为stdin JSON {account,password}；成功仅输出已核对用户UUID，调用方负责写本地忽略.env。
async function main(): Promise<void> {
  let app: INestApplicationContext | undefined;
  try {
    if (process.stdin.isTTY || process.argv.length !== 2) throw new Error('需要stdin JSON');
    let input = '';
    for await (const chunk of process.stdin) {
      input += String(chunk);
      if (Buffer.byteLength(input) > 16 * 1024) throw new Error('输入过大');
    }
    const parsed: unknown = JSON.parse(input);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('输入无效');
    const credentials = plainToInstance(CredentialsDto, parsed);
    if (credentials.account !== '55555' || validateSync(credentials, { whitelist: true, forbidNonWhitelisted: true }).length > 0) throw new Error('凭据无效');
    // 禁用Nest常规日志，stdout保持机器可读；abortOnError=false使故障走统一不含秘密的错误提示。
    app = await NestFactory.createApplicationContext(AppModule, { logger: false, abortOnError: false });
    const user = await app.get(UsersService).provisionAccount(credentials);
    process.stdout.write(`${user.id}\n`);
  } catch {
    process.stderr.write('站主初始化失败：请检查stdin凭据、现有账号密码及数据库配置。\n');
    process.exitCode = 1;
  } finally {
    await app?.close();
  }
}
await main();
