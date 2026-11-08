// HTTP响应与业务服务共享的公开类型；不把Mongoose内部字段暴露给浏览器。
// 四类能力固定存在，列表次序就是公开展示次序；图标标识由HTTP白名单约束。
export type SiteCapabilityItem = { icon: string; name: string };
// 公司与项目正文仅保存Markdown字符串；公开投影负责显隐，安全渲染属于前端边界。
export type SiteCapabilityProject = { id: string; name: string; summary: string; content: string; coverUrl: string; visible: boolean };
export type SiteCapabilityDetails = {
  technology: { introduction: string };
  company: { name: string; summary: string; introduction: string; business: string; responsibilities: string };
  projects: SiteCapabilityProject[];
};
export type SiteContent = {
  profile: { name: string; tagline: string; bio: string };
  home: { eyebrow: string; title: string; subtitle: string; buttonLabel: string };
  contact: { email: string; links: { label: string; url: string }[] };
  appearance: { motion: boolean; character: 'classic' };
  music: { enabled: boolean; title: string; sourceUrl: string; volume: number; loop: boolean };
  capabilities: { ai: SiteCapabilityItem[]; frontend: SiteCapabilityItem[]; backend: SiteCapabilityItem[]; deployment: SiteCapabilityItem[] };
  capabilityDetails: SiteCapabilityDetails;
};
export type SiteDocument = { version: number; updatedAt: string | null; content: SiteContent };
// 只声明当前上传业务实际使用的字段，不依赖客户端文件名决定存储路径或媒体类型。
export type SiteUpload = { buffer: Buffer; size: number; mimetype: string };
