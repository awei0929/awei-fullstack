export type SiteCapabilityCategory = 'ai' | 'frontend' | 'backend' | 'deployment'
export interface SiteCapabilityItem { icon: string; name: string }
export type SiteCapabilities = Record<SiteCapabilityCategory, SiteCapabilityItem[]>

export interface SiteCompanyProject {
  id: string
  name: string
  summary: string
  content: string
  coverUrl: string
  visible: boolean
}

export interface SiteCapabilityDetails {
  technology: { introduction: string }
  company: { name: string; summary: string; introduction: string; business: string; responsibilities: string }
  projects: SiteCompanyProject[]
}

export interface SiteThought {
  id: string
  title: string
  summary: string
  content: string
  meta: string
  visible: boolean
}

export interface SiteWork {
  id: string
  title: string
  summary: string
  url: string
  label: string
  coverUrl: string
  meta: string
  visible: boolean
}

export interface SiteChatContent {
  enabled: boolean
  heading: string
  intro: string
  placeholder: string
  systemPrompt: string
  suggestions: string[]
}

export interface SiteResumeSkillGroup {
  label: string
  items: string[]
}

export interface SiteResumeExperience {
  company: string
  role: string
  period: string
  summary: string
  highlights: string[]
}

export interface SiteResumeProject {
  name: string
  role: string
  period: string
  summary: string
  tech: string[]
  highlights: string[]
}

export interface SiteResumeEducation {
  school: string
  major: string
  period: string
}

export interface SiteResume {
  name: string
  role: string
  body: string
  pdfUrl: string
  summary?: string
  meta?: string
  skills?: SiteResumeSkillGroup[]
  experience?: SiteResumeExperience[]
  projects?: SiteResumeProject[]
  education?: SiteResumeEducation[]
}

export interface SiteContent {
  profile: { name: string; tagline: string; bio: string }
  home: { eyebrow: string; title: string; subtitle: string; buttonLabel: string }
  resume: SiteResume
  contact: { email: string; links: { label: string; url: string }[] }
  appearance: { motion: boolean; character: 'classic' }
  music: { enabled: boolean; title: string; sourceUrl: string; volume: number; loop: boolean }
  capabilities: SiteCapabilities
  capabilityDetails: SiteCapabilityDetails
  thoughts: SiteThought[]
  works: SiteWork[]
  chat: SiteChatContent
}

export interface SiteDocument {
  version: number
  updatedAt: string | null
  content: SiteContent
}

export interface SiteFileAsset {
  url: string
  name: string
  mimeType: string
  size: number
  kind: 'image' | 'attachment'
}

export type SiteFileUploadTarget =
  | { type: 'library' }
  | { type: 'resume' }
  | { type: 'cover'; projectId: string }
  | { type: 'work-cover'; workId: string }
  | { type: 'company'; field: 'introduction' | 'business' | 'responsibilities' }
  | { type: 'project'; projectId: string }
