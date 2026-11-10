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

export interface SiteContent {
  profile: { name: string; tagline: string; bio: string }
  home: { eyebrow: string; title: string; subtitle: string; buttonLabel: string }
  contact: { email: string; links: { label: string; url: string }[] }
  appearance: { motion: boolean; character: 'classic' }
  music: { enabled: boolean; title: string; sourceUrl: string; volume: number; loop: boolean }
  capabilities: SiteCapabilities
  capabilityDetails: SiteCapabilityDetails
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
  | { type: 'cover'; projectId: string }
  | { type: 'company'; field: 'introduction' | 'business' | 'responsibilities' }
  | { type: 'project'; projectId: string }
