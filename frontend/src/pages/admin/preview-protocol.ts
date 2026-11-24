import type { SiteContent } from '../../types/site'

export const SITE_PREVIEW_READY = 'site-preview:ready'
export const SITE_PREVIEW_DRAFT = 'site-preview:draft'

type PreviewMessageEvent = Pick<MessageEvent, 'source' | 'origin' | 'data'>

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function strings(value: Record<string, unknown>, fields: string[]): boolean {
  return fields.every(field => typeof value[field] === 'string')
}

function fields(value: Record<string, unknown>, expected: string[]): boolean {
  return Object.keys(value).length === expected.length && expected.every(field => Object.hasOwn(value, field))
}

function optionalStrings(value: Record<string, unknown>, fields: string[]): boolean {
  return fields.every(field => value[field] === undefined || typeof value[field] === 'string')
}

function optionalArray(value: unknown, check: (item: Record<string, unknown>) => boolean): boolean {
  return value === undefined || (Array.isArray(value) && value.every(item => object(item) && check(item)))
}

function stringArray(value: unknown): boolean {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

function validResume(value: Record<string, unknown>): boolean {
  if (!strings(value, ['name', 'role', 'body', 'pdfUrl'])) return false
  if (!optionalStrings(value, ['summary', 'meta'])) return false
  if (!optionalArray(value.skills, item => typeof item.label === 'string' && stringArray(item.items))) return false
  if (!optionalArray(value.experience, item => strings(item, ['company', 'role', 'period', 'summary']) && stringArray(item.highlights))) return false
  if (!optionalArray(value.projects, item => strings(item, ['name', 'role', 'period', 'summary']) && stringArray(item.tech) && stringArray(item.highlights))) return false
  if (!optionalArray(value.education, item => strings(item, ['school', 'major', 'period']))) return false
  return true
}

function validThought(value: Record<string, unknown>): boolean {
  return strings(value, ['id', 'title', 'summary', 'content', 'meta']) && typeof value.visible === 'boolean'
}

function validWork(value: Record<string, unknown>): boolean {
  return strings(value, ['id', 'title', 'summary', 'url', 'label', 'coverUrl', 'meta']) && typeof value.visible === 'boolean'
}

function validChat(value: Record<string, unknown>): boolean {
  if (!strings(value, ['heading', 'intro', 'placeholder', 'systemPrompt'])) return false
  return typeof value.enabled === 'boolean' && Array.isArray(value.suggestions) && value.suggestions.every(item => typeof item === 'string')
}

// 草稿只校验渲染所需结构，空文案和空昵称仍能连续预览；保存校验由原API负责。
export function isSitePreviewContent(value: unknown): value is SiteContent {
  if (!object(value)) return false
  const { profile, home, resume, contact, appearance, music, capabilities, capabilityDetails } = value
  if (!object(profile) || !strings(profile, ['name', 'tagline', 'bio'])) return false
  if (!object(home) || !strings(home, ['eyebrow', 'title', 'subtitle', 'buttonLabel'])) return false
  if (!object(resume) || !validResume(resume)) return false
  if (!object(contact) || typeof contact.email !== 'string' || !Array.isArray(contact.links)
    || !contact.links.every(link => object(link) && strings(link, ['label', 'url']))) return false
  if (!object(appearance) || typeof appearance.motion !== 'boolean' || appearance.character !== 'classic') return false
  if (!object(music) || !strings(music, ['title', 'sourceUrl']) || typeof music.enabled !== 'boolean'
    || typeof music.loop !== 'boolean' || typeof music.volume !== 'number' || !Number.isFinite(music.volume)
    || music.volume < 0 || music.volume > 100) return false
  if (!object(capabilities)) return false
  if (!object(capabilityDetails) || !fields(capabilityDetails, ['technology', 'company', 'projects'])) return false
  const { technology, company, projects } = capabilityDetails
  if (!object(technology) || !fields(technology, ['introduction']) || !strings(technology, ['introduction'])) return false
  const companyFields = ['name', 'summary', 'introduction', 'business', 'responsibilities']
  if (!object(company) || !fields(company, companyFields) || !strings(company, companyFields)) return false
  if (!Array.isArray(projects) || projects.length > 12 || !projects.every(project => object(project)
    && fields(project, ['id', 'name', 'summary', 'content', 'coverUrl', 'visible'])
    && strings(project, ['id', 'name', 'summary', 'content', 'coverUrl']) && typeof project.visible === 'boolean')) return false
  if (value.thoughts !== undefined && (!Array.isArray(value.thoughts) || !value.thoughts.every(item => object(item) && validThought(item)))) return false
  if (value.works !== undefined && (!Array.isArray(value.works) || !value.works.every(item => object(item) && validWork(item)))) return false
  if (value.chat !== undefined && (!object(value.chat) || !validChat(value.chat))) return false
  return ['ai', 'frontend', 'backend', 'deployment'].every(category => {
    const items = capabilities[category]
    return Array.isArray(items) && items.every(item => object(item) && strings(item, ['icon', 'name']))
  })
}

function fromExpectedWindow(event: PreviewMessageEvent, source: Window | null, origin: string): boolean {
  return source !== null && event.source === source && event.origin === origin
}

export function isPreviewReadyEvent(event: PreviewMessageEvent, source: Window | null, origin: string): boolean {
  return fromExpectedWindow(event, source, origin) && object(event.data) && event.data.type === SITE_PREVIEW_READY
}

export function readPreviewDraft(event: PreviewMessageEvent, source: Window | null, origin: string): SiteContent | null {
  if (!fromExpectedWindow(event, source, origin) || !object(event.data) || event.data.type !== SITE_PREVIEW_DRAFT) return null
  return isSitePreviewContent(event.data.content) ? event.data.content : null
}
