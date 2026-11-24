import { ConflictException, Injectable } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { SiteRecord } from './schemas/site.schema.js';
import { defaultSiteCapabilities, defaultSiteCapabilityDetails, defaultSiteChat, defaultSiteContent, defaultSiteMusic, defaultSiteResume, defaultSiteThoughts, defaultSiteWorks } from './config/site.defaults.js';
import type { SiteContent, SiteDocument } from './types/site.type.js';

function siteVersionConflict(): ConflictException {
  return new ConflictException({ message: '官网内容已更新，请先查看最新版本', code: 'SITE_VERSION_CONFLICT' });
}

// 站点内容持久化服务：版本比较和写入必须是同一次数据库操作，避免两个编辑页互相覆盖。
// 老编辑器只提交四个基础字段；可选字段在 BSON 中不能落成 null，否则读取端会把它当成非法内容。
function cleanResume(resume: SiteContent['resume']): SiteContent['resume'] {
  const value = { ...resume };
  for (const key of ['summary', 'meta', 'skills', 'experience', 'projects', 'education'] as const) {
    if (value[key] === undefined || value[key] === null) delete value[key];
  }
  return value;
}

@Injectable()
export class SiteService implements OnModuleInit {
  constructor(@InjectModel(SiteRecord.name) private readonly documents: Model<SiteRecord>) {}
  async onModuleInit(): Promise<void> { await this.documents.init(); }
  async read(): Promise<SiteDocument> {
    const record = await this.documents.findOne({ key: 'main' }).lean().exec();
    const document = record ? this.toDocument(record) : { version: 0, updatedAt: null, content: defaultSiteContent() };
    return document;
  }
  async readPublic(): Promise<SiteDocument> {
    // 公开响应必须在服务端剔除隐藏项目，不能仅由浏览器隐藏目录或正文。
    // read每次构造独立文档；替换响应数组不会写库，也不会影响站主完整读取/保存结果。
    const document = await this.read();
    document.content.capabilityDetails.projects = document.content.capabilityDetails.projects.filter(project => project.visible === true);
    document.content.thoughts = document.content.thoughts.filter(thought => thought.visible === true);
    document.content.works = document.content.works.filter(work => work.visible === true);
    // 提示词只给服务端公开对话使用；公开响应清空，避免内部设定随页面泄漏。
    document.content.chat = { ...document.content.chat, systemPrompt: '' };
    return document;
  }
  async save(version: number, content: Omit<SiteContent, 'resume'> & Partial<Pick<SiteContent, 'resume'>>): Promise<SiteDocument> {
    const updatedAt = new Date();
    const { resume, ...sections } = content;
    const match = { key: 'main', version };
    let savedResume = resume === undefined ? undefined : cleanResume(resume);
    if (version > 0 && savedResume === undefined) {
      // 旧编辑器省略简历。只读取相同版本的简历，后续版本条件更新仍防止并发覆盖。
      const previous = await this.documents.findOne(match).select('content.resume').lean().orFail(siteVersionConflict).exec();
      savedResume = previous.content?.resume;
    }
    // 缺失字段从对象中移除，避免 BSON 将 undefined 写成 null。
    const replacement = savedResume === undefined ? sections : { ...sections, resume: savedResume };
    if (version === 0) {
      try {
        return this.toDocument(await this.documents.create({ key: 'main', version: 1, content: replacement, updatedAt }));
      } catch (error) {
        if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 11000)) throw error;
        // 两个首次保存竞争唯一key，输家也是版本冲突，不能自动改为覆盖写入。
      }
    } else {
      const saved = await this.documents.findOneAndUpdate(
        match, { $set: { content: replacement, updatedAt }, $inc: { version: 1 } }, { returnDocument: 'after' },
      ).lean().exec();
      if (saved) return this.toDocument(saved);
    }
    throw siteVersionConflict();
  }
  private toDocument(record: Pick<SiteRecord, 'version' | 'updatedAt' | 'content'>): SiteDocument {
    // 按当前响应合同显式映射保留分区，历史Mongo中的作品字段不再外泄。
    // 这里只构造新对象，不迁移/回写历史文档；版本只在站主正常保存时递增。
    const stored = structuredClone(record.content);
    const content: SiteContent = {
      profile: stored.profile, home: stored.home, contact: stored.contact, appearance: stored.appearance,
      resume: stored.resume === undefined ? defaultSiteResume() : cleanResume(stored.resume),
      music: stored.music === undefined ? defaultSiteMusic() : stored.music,
      capabilities: stored.capabilities === undefined ? defaultSiteCapabilities() : stored.capabilities,
      capabilityDetails: stored.capabilityDetails === undefined ? defaultSiteCapabilityDetails() : stored.capabilityDetails,
      thoughts: stored.thoughts === undefined ? defaultSiteThoughts() : stored.thoughts,
      works: stored.works === undefined ? defaultSiteWorks() : stored.works,
      chat: stored.chat === undefined ? defaultSiteChat() : stored.chat,
    };
    return { version: record.version, updatedAt: record.updatedAt.toISOString(), content };
  }
}
