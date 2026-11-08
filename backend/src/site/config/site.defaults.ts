import type { SiteContent } from '../types/site.type.js';

// 兼容旧内容时只补整个缺失分区，不替损坏的部分字段静默兜底。
export function defaultSiteMusic(): SiteContent['music'] {
  return { enabled: false, title: '', sourceUrl: '', volume: 25, loop: true };
}

// 兼容历史能力场景的九项展示，不将可选图标目录当成站主已掌握的技术。
// 每次创建独立数组和对象，显式保存的空组不应再调用此函数回填。
export function defaultSiteCapabilities(): SiteContent['capabilities'] {
  return {
    ai: [{ icon: 'codex', name: 'Codex' }, { icon: 'claude', name: 'Claude' }, { icon: 'deepseek', name: 'DeepSeek' }],
    frontend: [{ icon: 'react', name: 'React' }, { icon: 'vuedotjs', name: 'Vue' }, { icon: 'typescript', name: 'TypeScript' }],
    backend: [{ icon: 'nestjs', name: 'NestJS' }, { icon: 'mongodb', name: 'MongoDB' }],
    deployment: [{ icon: 'docker', name: 'Docker' }],
  };
}

// 只读兼容旧文档时补完整空履历，不从已经移除的作品字段迁移或虚构经历。
// 技术介绍是通用说明；每次创建独立对象，空字符串和显式空项目均由站主决定。
export function defaultSiteCapabilityDetails(): SiteContent['capabilityDetails'] {
  return {
    technology: { introduction: '围绕前端、后端、AI 工具与部署，持续积累完整交付的能力。' },
    company: { name: '', summary: '', introduction: '', business: '', responsibilities: '' },
    projects: [],
  };
}

// 未保存时只返回默认值，不写数据库；真实联系方式与职业文案留给站主自己填写。
// 每次构造新对象，调用方修改不会污染下一次请求的默认数据。
export function defaultSiteContent(): SiteContent {
  return {
    profile: { name: 'HEY.', tagline: '', bio: '' },
    home: { eyebrow: 'GOOD TO SEE YOU.', title: 'OH, HELLO.', subtitle: '来看看，这里藏着什么。', buttonLabel: '开始探索' },
    contact: { email: '', links: [] }, appearance: { motion: true, character: 'classic' },
    music: defaultSiteMusic(),
    capabilities: defaultSiteCapabilities(),
    capabilityDetails: defaultSiteCapabilityDetails(),
  };
}
