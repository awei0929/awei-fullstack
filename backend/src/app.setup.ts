import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getConnectionToken } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import type { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import { positiveInteger, sessionDuration } from './auth/config/auth.config.js';
// 加载 express-session 的类型扩展声明，让 request.session 的自定义字段有类型检查。
import './auth/types/auth.type.js';

// 正式启动与HTTP测试都调用这里，避免测试绕过真实的会话、守卫或参数校验配置。
// app.use 注册底层 Express 中间件；它先处理请求，再进入 Nest 的 Guard → Pipe → Controller。
export async function configureApp(app: INestApplication): Promise<void> {
  // app.get 从 Nest 的依赖容器取已有实例，等价于启动阶段使用依赖注入。
  const config = app.get(ConfigService);
  // 密钥给会话ID签名，防止Cookie被篡改；不用于加密密码，也不能每次重启随机生成。
  const secret = config.get<string>('SESSION_SECRET');
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET 必须固定配置且至少32字符');
  const duration = sessionDuration(config);
  for (const [key, fallback] of [['AUTH_IP_LIMIT', 30], ['AUTH_ACCOUNT_LIMIT', 10], ['AUTH_RATE_WINDOW_MS', 900000]] as const) {
    positiveInteger(config, key, fallback);
  }
  const trustProxy = config.get<string>('TRUST_PROXY');
  // 默认不信任转发头；部署时只显式配置可信代理IP/子网，不接受任意代理。
  if (trustProxy) {
    if (['true', 'false'].includes(trustProxy) || /^\d+$/.test(trustProxy)) throw new Error('TRUST_PROXY 必须为可信代理IP或子网列表');
    app.getHttpAdapter().getInstance().set('trust proxy', trustProxy.split(',').map(value => value.trim()));
  }
  // getConnectionToken 取得 Nest/Mongoose 注册连接时使用的依赖标识。
  // 复用当前连接及数据库，测试替换连接后，Session也自然进入隔离测试库。
  const connection = app.get<Connection>(getConnectionToken());
  // Cookie只存随机会话ID，userId/CSRF令牌等会话内容由Store保存在MongoDB。
  // TTL索引只负责异步清理；真正的登录过期由SessionGuard检查绝对有效期。
  const store = MongoStore.create({
    client: connection.getClient(), dbName: connection.name,
    collectionName: 'sessions', ttl: Math.ceil(duration / 1000), autoRemove: 'native',
  });
  // 等待TTL索引就绪，关闭时由Mongoose唯一持有并释放共享连接。
  await store.collectionP;
  // 个人数据和认证响应不交给浏览器/代理缓存；/i与Express默认不区分大小写的路由保持一致。
  app.use((request: Request, response: Response, next: NextFunction) => {
    if (/^\/api\/(auth|tasks|stats)(?:\/|$)/i.test(request.path)) response.setHeader('Cache-Control', 'no-store');
    next();
  });
  // 必须在Controller与Guard之前安装，后续才能通过request.session读取身份。
  // resave=false：未修改的会话不整份覆盖，避免旧请求在退出后重新写回会话。
  // saveUninitialized=false：未使用的匿名请求不落库；获取CSRF时才显式保存。
  // rolling=false：不每次请求重发Cookie；服务端另用authExpiresAt保证固定有效期。
  app.use(session({
    name: 'nest.sid', secret, store, resave: false, saveUninitialized: false, rolling: false,
    // HttpOnly禁止JS读取Cookie；SameSite=Lax减少跨站携带，但仍需独立CSRF校验。
    // 生产Secure要求HTTPS；Path=/让同站的所有API共享会话，不设置Domain扩大范围。
    cookie: { maxAge: duration, httpOnly: true, sameSite: 'lax', secure: config.get('NODE_ENV') === 'production', path: '/' },
  }));
  // 所有 Controller 路由统一加上 /api 前缀。
  app.setGlobalPrefix('api');
  // 全局管道会在 Controller 方法执行前检查参数。
  // DTO 中的装饰器负责登记规则，ValidationPipe 负责读取规则并执行校验。
  app.useGlobalPipes(
    new ValidationPipe({
      // 让 Controller 收到转换后的 DTO 实例，例如已经去掉标题两端空白的对象。
      transform: true,
      // 只接受 DTO 中有校验规则的字段。
      whitelist: true,
      // 与 whitelist 配合：出现额外字段直接返回 400，而不是静默丢弃。
      forbidNonWhitelisted: true,
    }),
  );
  // 收到退出信号时执行 Nest 生命周期钩子，便于后续关闭数据库连接等资源。
  app.enableShutdownHooks();
}
