import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ChatModel, ModelSettings } from '../types/chat.type.js';

// 配置由服务端提供；客户端只得到可用性，不知道Key变量名、URL或真实模型参数。
@Injectable()
export class ChatConfig {
  constructor(private readonly config: ConfigService) {}
  models(): ModelSettings[] {
    try {
      const extras: unknown = JSON.parse(this.config.get<string>('CHAT_MODELS_JSON') || '[]');
      if (!Array.isArray(extras) || extras.length > 10) throw new Error();
      const glm = { baseUrl: this.config.get<string>('GLM_BASE_URL') || 'https://open.bigmodel.cn/api/paas/v4', apiKeyEnv: 'GLM_API_KEY' };
      const defaults = [
        { ...glm, id: 'glm-4.7-flash', label: 'GLM-4.7-Flash', model: 'glm-4.7-flash', disableThinking: true },
        { ...glm, id: 'glm-4-flash-250414', label: 'GLM-4-Flash-250414', model: 'glm-4-flash-250414', disableThinking: false },
      ];
      // DeepSeek 只在提供Key时出现，避免未配置的部署多出一个不可用模型，也保持旧白名单数量不变。
      // 公开对话使用非思考模式，降低首字延迟与费用；DeepSeek 的思考参数与GLM同名，可直接复用适配器。
      const deepseek = this.config.get<string>('DEEPSEEK_API_KEY')?.trim() ? [{
        id: 'deepseek-flash', label: 'DeepSeek-Flash', model: 'deepseek-flash',
        baseUrl: this.config.get<string>('DEEPSEEK_BASE_URL') || 'https://api.deepseek.com',
        apiKeyEnv: 'DEEPSEEK_API_KEY', disableThinking: true,
      }] : [];
      const ids = new Set<string>();
      return [...defaults, ...deepseek, ...extras].map(value => {
        if (!value || typeof value !== 'object' || Object.keys(value).some(key => !['id', 'label', 'model', 'baseUrl', 'apiKeyEnv', 'disableThinking'].includes(key))) throw new Error();
        const { id, label, model, baseUrl, apiKeyEnv, disableThinking = false } = value;
        if (typeof id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(id) || ids.has(id)) throw new Error();
        ids.add(id);
        if (typeof label !== 'string' || !label.trim() || label.length > 100 || typeof model !== 'string' || !model.trim() || model.length > 200 || typeof apiKeyEnv !== 'string' || !/^[A-Z][A-Z0-9_]*$/.test(apiKeyEnv) || typeof disableThinking !== 'boolean') throw new Error();
        const url = new URL(baseUrl);
        if (url.username || url.password || url.search || url.hash || !(url.protocol === 'https:' || (url.protocol === 'http:' && this.config.get('NODE_ENV') !== 'production' && ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname)))) throw new Error();
        // 备用关系由代码固定，额外白名单不能注入关系或覆盖内置id，避免自动调用收费模型。
        return { id, label: label.trim(), model: model.trim(), baseUrl: url.href.replace(/\/$/, ''), apiKey: this.config.get<string>(apiKeyEnv)?.trim() || '', disableThinking, ...(id === 'glm-4.7-flash' ? { fallbackModelId: 'glm-4-flash-250414' } : {}) };
      });
    } catch {
      // 不把JSON解析异常或原始配置抛出，避免错误页/日志包含密钥。
      throw new ServiceUnavailableException('聊天模型配置无效，请检查服务端模型白名单');
    }
  }
  catalog(): { models: ChatModel[]; defaultModelId: string } {
    const models = this.models();
    // 配置了DeepSeek后后台也默认选它；未配置时保持原GLM默认，避免改变已有部署行为。
    const defaultModelId = models.find(model => model.id === 'deepseek-flash' && model.apiKey)?.id ?? 'glm-4.7-flash';
    return { models: models.map(model => ({ id: model.id, label: model.label, available: Boolean(model.apiKey), ...(model.fallbackModelId ? { fallbackModelId: model.fallbackModelId } : {}) })), defaultModelId };
  }
  timeout(): number {
    const raw = this.config.get<string>('CHAT_TIMEOUT_MS') || '120000';
    if (!/^\d+$/.test(raw) || Number(raw) < 1000 || Number(raw) > 300000) throw new ServiceUnavailableException('CHAT_TIMEOUT_MS 必须为1000至300000毫秒');
    return Number(raw);
  }
}
