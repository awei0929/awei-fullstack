import type { SiteCapabilities, SiteCapabilityCategory } from '../types/site'

export const MAX_CAPABILITIES_PER_CATEGORY = 12

export const CAPABILITY_CATEGORIES: { id: SiteCapabilityCategory; label: string; summary: string; description: string }[] = [
  { id: 'ai', label: 'AI', summary: '拆解需求、协作编码', description: '用 AI 辅助梳理需求、编写代码和交叉复核，把精力留给判断与实现。' },
  { id: 'frontend', label: '前端', summary: '把界面变成可用的体验', description: '用组件组织界面，关注响应式布局、交互细节与清晰的数据流。' },
  { id: 'backend', label: '后端', summary: '接口、数据与服务逻辑', description: '从接口与权限到数据存储，让前端交互有可靠的服务支撑。' },
  { id: 'deployment', label: '部署', summary: '让应用稳定落地', description: '把应用和运行环境装进容器，让本地开发与实际部署保持一致。' },
]

// 目录仅提供选择素材；是否在官网展示始终由站主保存的列表决定。
export const CAPABILITY_CATALOG: { icon: string; name: string; category: SiteCapabilityCategory }[] = [
  { icon: 'codex', name: 'Codex', category: 'ai' },
  { icon: 'chatgpt', name: 'ChatGPT', category: 'ai' },
  { icon: 'claude', name: 'Claude', category: 'ai' },
  { icon: 'deepseek', name: 'DeepSeek', category: 'ai' },
  { icon: 'gemini', name: 'Gemini', category: 'ai' },
  { icon: 'cursor', name: 'Cursor', category: 'ai' },
  { icon: 'ollama', name: 'Ollama', category: 'ai' },
  { icon: 'react', name: 'React', category: 'frontend' },
  { icon: 'vuedotjs', name: 'Vue', category: 'frontend' },
  { icon: 'typescript', name: 'TypeScript', category: 'frontend' },
  { icon: 'javascript', name: 'JavaScript', category: 'frontend' },
  { icon: 'html5', name: 'HTML5', category: 'frontend' },
  { icon: 'css3', name: 'CSS3', category: 'frontend' },
  { icon: 'vite', name: 'Vite', category: 'frontend' },
  { icon: 'nextdotjs', name: 'Next.js', category: 'frontend' },
  { icon: 'antdesign', name: 'Ant Design', category: 'frontend' },
  { icon: 'tailwindcss', name: 'Tailwind CSS', category: 'frontend' },
  { icon: 'nodedotjs', name: 'Node.js', category: 'backend' },
  { icon: 'nestjs', name: 'NestJS', category: 'backend' },
  { icon: 'express', name: 'Express', category: 'backend' },
  { icon: 'python', name: 'Python', category: 'backend' },
  { icon: 'fastapi', name: 'FastAPI', category: 'backend' },
  { icon: 'java', name: 'Java', category: 'backend' },
  { icon: 'springboot', name: 'Spring Boot', category: 'backend' },
  { icon: 'go', name: 'Go', category: 'backend' },
  { icon: 'mongodb', name: 'MongoDB', category: 'backend' },
  { icon: 'mysql', name: 'MySQL', category: 'backend' },
  { icon: 'postgresql', name: 'PostgreSQL', category: 'backend' },
  { icon: 'redis', name: 'Redis', category: 'backend' },
  { icon: 'docker', name: 'Docker', category: 'deployment' },
  { icon: 'kubernetes', name: 'Kubernetes', category: 'deployment' },
  { icon: 'nginx', name: 'Nginx', category: 'deployment' },
  { icon: 'linux', name: 'Linux', category: 'deployment' },
  { icon: 'git', name: 'Git', category: 'deployment' },
  { icon: 'github', name: 'GitHub', category: 'deployment' },
  { icon: 'githubactions', name: 'GitHub Actions', category: 'deployment' },
  { icon: 'vercel', name: 'Vercel', category: 'deployment' },
  { icon: 'cloudflare', name: 'Cloudflare', category: 'deployment' },
]

export function isCapabilityIcon(icon: unknown): icon is string {
  return typeof icon === 'string' && CAPABILITY_CATALOG.some(item => item.icon === icon)
}

export function capabilityIconUrl(icon: string): string {
  return isCapabilityIcon(icon) ? `/site/tech/${icon}.svg` : ''
}

// 只兼容整个旧分区缺失；显式空列表保留，且每次返回独立对象。
export function defaultSiteCapabilities(): SiteCapabilities {
  return {
    ai: [{ icon: 'codex', name: 'Codex' }, { icon: 'claude', name: 'Claude' }, { icon: 'deepseek', name: 'DeepSeek' }],
    frontend: [{ icon: 'react', name: 'React' }, { icon: 'vuedotjs', name: 'Vue' }, { icon: 'typescript', name: 'TypeScript' }],
    backend: [{ icon: 'nestjs', name: 'NestJS' }, { icon: 'mongodb', name: 'MongoDB' }],
    deployment: [{ icon: 'docker', name: 'Docker' }],
  }
}
