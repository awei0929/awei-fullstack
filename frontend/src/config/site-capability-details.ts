import type { SiteCapabilityDetails } from '../types/site'

export const MAX_COMPANY_PROJECTS = 12

// 兼容只读旧文档；每次创建独立内容，避免草稿修改影响默认值。
export function defaultSiteCapabilityDetails(): SiteCapabilityDetails {
  return {
    technology: { introduction: '围绕前端、后端、AI 工具与部署，持续积累完整交付的能力。' },
    company: { name: '', summary: '', introduction: '', business: '', responsibilities: '' },
    projects: [],
  }
}
