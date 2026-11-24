import type { SiteContent } from '../types/site.type.js';

// 兼容旧内容时只补整个缺失分区，不替损坏的部分字段静默兜底。
export function defaultSiteMusic(): SiteContent['music'] {
  return { enabled: false, title: '', sourceUrl: '', volume: 25, loop: true };
}

// 缺少简历的历史站点从空内容开始，由站主决定公开的经历与附件。
export function defaultSiteResume(): SiteContent['resume'] {
  return { name: '', role: '', body: '', pdfUrl: '' };
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

// 想法与作品默认给出一组可替换的真实占位：至少让首页有可读内容，而不是空白模板。
// 每次调用创建独立数组/对象，后台编辑不会污染下一次默认响应。
export function defaultSiteThoughts(): SiteContent['thoughts'] {
  return [
    {
      id: 'build-to-use', title: '先做能被使用的东西。',
      summary: '比起把功能堆满，我更在意它有没有真的进入某个人的日常。',
      content: '## 从能用开始\n\n一个想法是否成立，往往不取决于它有多完整，而取决于有没有人愿意在第二天继续打开它。\n\n所以我会先做一个能跑起来的小版本，把它放到真实场景里，再决定下一步加什么。',
      meta: '2026 · 产品观', visible: true,
    },
    {
      id: 'simple-is-work', title: '简单，是做完之后才出现的。',
      summary: '界面上的轻，通常来自背后多走了一步。',
      content: '## 把复杂留给自己\n\n用户看到的顺序、留白和一句话，背后是很多次删减。\n\n我不太相信“看起来简单”是设计起点；它更像整理完所有材料之后，留下来的那个最合适的答案。',
      meta: '2026 · 设计观', visible: true,
    },
  ];
}

// 作品链接默认指向可验证的公开地址；站主可换成自己的项目、文章或页面。
export function defaultSiteWorks(): SiteContent['works'] {
  return [
    {
      id: 'awei-fullstack', title: 'awei-fullstack',
      summary: '这个站点背后的全栈工程：公开主页、内容后台、任务与 AI 对话。',
      url: 'https://github.com/awei0929/awei-fullstack', label: '查看仓库', coverUrl: '', meta: '全栈 · 进行中', visible: true,
    },
    {
      id: 'resume-page', title: '网页简历',
      summary: '一份可以直接阅读、也可以下载 PDF 的简历页面。',
      url: '/resume', label: '打开简历', coverUrl: '', meta: '页面 · 2026', visible: true,
    },
    {
      id: 'site-chat', title: '和这个网站聊两句',
      summary: '基于公开内容回答问题的 AI 分身，不需要登录。',
      url: '/chat', label: '开始对话', coverUrl: '', meta: '本站 · 2026', visible: true,
    },
  ];
}

// 对话默认开启；模型未配置或站点关闭时，公开接口会返回明确的不可用状态而不是空白。
export function defaultSiteChat(): SiteContent['chat'] {
  return {
    enabled: true,
    heading: '找我说会儿话。',
    intro: '关于我、这个站点，或者你正在想的事，都可以从一句 hello 开始。',
    placeholder: '今天想从哪儿说起…',
    systemPrompt: '',
    suggestions: ['你最近在做什么？', '这个网站是怎么做出来的？', '你相信什么样的产品？'],
  };
}

// 未保存时只返回默认值，不写数据库；真实联系方式与职业文案留给站主自己填写。
// 每次构造新对象，调用方修改不会污染下一次请求的默认数据。
export function defaultSiteContent(): SiteContent {
  return {
    profile: { name: 'HEY.', tagline: '', bio: '' },
    home: { eyebrow: 'A LITTLE HELLO', title: '把想法，做成\n可以体验的东西。', subtitle: '写代码，也写字。这里收集我的想法、做过的项目，以及一个可以随时聊两句的 AI 分身。', buttonLabel: '往下看看' },
    resume: defaultSiteResume(),
    contact: { email: '', links: [] }, appearance: { motion: true, character: 'classic' },
    music: defaultSiteMusic(),
    capabilities: defaultSiteCapabilities(),
    capabilityDetails: defaultSiteCapabilityDetails(),
    thoughts: defaultSiteThoughts(),
    works: defaultSiteWorks(),
    chat: defaultSiteChat(),
  };
}
