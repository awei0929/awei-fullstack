// HTTP响应与业务服务共享的公开类型；不把Mongoose内部字段暴露给浏览器。
// 四类能力固定存在，列表次序就是公开展示次序；图标标识由HTTP白名单约束。
export type SiteCapabilityItem = { icon: string; name: string };
// 公司与项目正文仅保存Markdown字符串；公开投影负责显隐，安全渲染属于前端边界。
export type SiteCapabilityProject = {
  id: string;
  name: string;
  summary: string;
  content: string;
  coverUrl: string;
  visible: boolean;
};
export type SiteCapabilityDetails = {
  technology: { introduction: string };
  company: {
    name: string;
    summary: string;
    introduction: string;
    business: string;
    responsibilities: string;
  };
  projects: SiteCapabilityProject[];
};
// 想法与作品是公开首页的主内容；visible 由服务端公开投影过滤，和公司项目保持同一显隐语义。
export type SiteThought = {
  id: string;
  title: string;
  summary: string;
  content: string;
  meta: string;
  visible: boolean;
};
export type SiteWork = {
  id: string;
  title: string;
  summary: string;
  url: string;
  label: string;
  coverUrl: string;
  meta: string;
  visible: boolean;
};
// systemPrompt 只供服务端组装提示词，公开读取时会被清空，避免把内部指令直接暴露给访客。
export type SiteChatContent = {
  enabled: boolean;
  heading: string;
  intro: string;
  placeholder: string;
  systemPrompt: string;
  suggestions: string[];
};
export type SiteContent = {
  profile: { name: string; tagline: string; bio: string };
  home: {
    eyebrow: string;
    title: string;
    subtitle: string;
    buttonLabel: string;
  };
  resume: {
    name: string;
    role: string;
    body: string;
    pdfUrl: string;
    // 结构化履历为后加字段；旧文档缺失时由读取端按空数组处理。
    summary?: string;
    meta?: string;
    skills?: { label: string; items: string[] }[];
    experience?: {
      company: string;
      role: string;
      period: string;
      summary: string;
      highlights: string[];
    }[];
    projects?: {
      name: string;
      role: string;
      period: string;
      summary: string;
      tech: string[];
      highlights: string[];
    }[];
    education?: { school: string; major: string; period: string }[];
  };
  contact: { email: string; links: { label: string; url: string }[] };
  appearance: { motion: boolean; character: 'classic' };
  music: {
    enabled: boolean;
    title: string;
    sourceUrl: string;
    volume: number;
    loop: boolean;
  };
  capabilities: {
    ai: SiteCapabilityItem[];
    frontend: SiteCapabilityItem[];
    backend: SiteCapabilityItem[];
    deployment: SiteCapabilityItem[];
  };
  capabilityDetails: SiteCapabilityDetails;
  thoughts: SiteThought[];
  works: SiteWork[];
  chat: SiteChatContent;
};
export type SiteDocument = {
  version: number;
  updatedAt: string | null;
  content: SiteContent;
};
// 只声明当前上传业务实际使用的字段，不依赖客户端文件名决定存储路径或媒体类型。
export type SiteUpload = {
  buffer: Buffer;
  size: number;
  mimetype: string;
  originalname?: string;
};
// 上传与整站版本保存分离：这里只返回可供草稿引用的公开地址及展示信息。
export type SiteFileAsset = {
  url: string;
  name: string;
  mimeType: string;
  size: number;
  kind: 'image' | 'attachment';
};
