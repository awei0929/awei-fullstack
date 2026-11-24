import type { SiteCapabilities, SiteCapabilityDetails, SiteChatContent, SiteContent, SiteDocument, SiteFileAsset, SiteResume, SiteThought, SiteWork } from '../types/site'
import { CAPABILITY_CATEGORIES, defaultSiteCapabilities, isCapabilityIcon, MAX_CAPABILITIES_PER_CATEGORY } from '../config/site-capabilities'
import { defaultSiteCapabilityDetails, MAX_COMPANY_PROJECTS } from '../config/site-capability-details'
import { SITE_ATTACHMENT_MAX_SIZE, SITE_FILE_TYPES, SITE_IMAGE_MAX_SIZE } from '../config/site-files'
import { request } from './http'

function invalid(): never {
  throw new Error('网站内容格式无效，请核对字段或重新加载')
}

function object(value: unknown, fields: string[], optional: string[] = []): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  const result = value as Record<string, unknown>
  if (Object.keys(result).some((field) => !fields.includes(field) && !optional.includes(field)) || fields.some((field) => !Object.hasOwn(result, field))) return invalid()
  return result
}

function text(value: unknown, max: number, required = false): string {
  if (typeof value !== 'string' || Array.from(value).length > max || (required && !value.trim())) return invalid()
  return value
}

function bool(value: unknown): boolean {
  if (typeof value !== 'boolean') return invalid()
  return value
}

export function isSafeSiteUrl(value: string, kind: 'link' | 'markdown' | 'audio' | 'image' | 'page' = 'link'): boolean {
  if (!value) return true
  const hasControl = (input: string) => Array.from(input).some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  if (value.length > 2048 || /[\s\\]/.test(value) || hasControl(value)) return false
  if (kind === 'audio' && /^\/api\/site\/assets\/[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}\.(mp3|wav|ogg)$/.test(value)) return true
  if (kind === 'image' && /^\/api\/site\/assets\/[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}\.(png|jpg|webp)$/.test(value)) return true
  if (kind === 'markdown' && /^\/api\/site\/assets\/[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}\.(png|jpg|webp|pdf|zip|txt|docx|xlsx|pptx)$/.test(value)) return true
  // 作品可指向站内页面（如 /resume），但拒绝 // 开头的协议相对地址。
  if (kind === 'page' && /^\/(?!\/)[A-Za-z0-9/_-]*(?:#[A-Za-z0-9_-]+)?$/.test(value)) return true
  if (!/^https?:\/\//i.test(value)) return false
  try {
    const parsed = new URL(value)
    return ['http:', 'https:'].includes(parsed.protocol) && Boolean(parsed.hostname) && !parsed.username && !parsed.password
  } catch { return false }
}

function url(value: unknown, kind: 'link' | 'audio' | 'image' | 'page' = 'link'): string {
  const result = text(value, 2048)
  if (!isSafeSiteUrl(result, kind)) return invalid()
  return result
}

const emptyChat: SiteChatContent = { enabled: false, heading: '', intro: '', placeholder: '', systemPrompt: '', suggestions: [] }

// 旧简历只有四个基础字段；结构化字段缺失时按空内容展示，避免读取历史文档失败。
const emptyResume: SiteResume = {
  name: '', role: '', body: '', pdfUrl: '',
  summary: '', meta: '', skills: [], experience: [], projects: [], education: [],
}

export function isSiteResumePdf(value: string): boolean {
  return value.startsWith('/api/site/assets/') && value.endsWith('.pdf') && isSafeSiteUrl(value, 'markdown')
}

function list<T>(value: unknown, max: number, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value) || value.length > max) return invalid()
  return value.map(parse)
}

export function parseSiteContent(value: unknown, allowLegacyMissingDetails = false): SiteContent {
  const content = object(value, ['profile', 'home', 'contact', 'appearance', ...(allowLegacyMissingDetails ? [] : ['capabilityDetails', 'resume', 'thoughts', 'works', 'chat'])], ['music', 'capabilities', ...(allowLegacyMissingDetails ? ['capabilityDetails', 'resume', 'thoughts', 'works', 'chat'] : [])])
  const profile = object(content.profile, ['name', 'tagline', 'bio'])
  const home = object(content.home, ['eyebrow', 'title', 'subtitle', 'buttonLabel'])
  const resumeValue = Object.hasOwn(content, 'resume')
    ? object(content.resume, ['name', 'role', 'body', 'pdfUrl'], ['summary', 'meta', 'skills', 'experience', 'projects', 'education'])
    : emptyResume
  const pdfUrl = text(resumeValue.pdfUrl, 2048)
  if (pdfUrl && !isSiteResumePdf(pdfUrl)) return invalid()
  const resumeSkills = resumeValue.skills === undefined ? [] : list(resumeValue.skills, 12, (item) => {
    const group = object(item, ['label', 'items'])
    return { label: text(group.label, 40, true), items: list(group.items, 20, (entry) => text(entry, 60, true)) }
  })
  const resumeExperience = resumeValue.experience === undefined ? [] : list(resumeValue.experience, 12, (item) => {
    const entry = object(item, ['company', 'role', 'period', 'summary', 'highlights'])
    return {
      company: text(entry.company, 80, true), role: text(entry.role, 80, true), period: text(entry.period, 40),
      summary: text(entry.summary, 600), highlights: list(entry.highlights, 12, (line) => text(line, 240, true)),
    }
  })
  const resumeProjects = resumeValue.projects === undefined ? [] : list(resumeValue.projects, 12, (item) => {
    const entry = object(item, ['name', 'role', 'period', 'summary', 'tech', 'highlights'])
    return {
      name: text(entry.name, 100, true), role: text(entry.role, 80), period: text(entry.period, 40),
      summary: text(entry.summary, 600), tech: list(entry.tech, 16, (tag) => text(tag, 40, true)),
      highlights: list(entry.highlights, 12, (line) => text(line, 300, true)),
    }
  })
  const resumeEducation = resumeValue.education === undefined ? [] : list(resumeValue.education, 8, (item) => {
    const entry = object(item, ['school', 'major', 'period'])
    return { school: text(entry.school, 100, true), major: text(entry.major, 80), period: text(entry.period, 40) }
  })
  const contact = object(content.contact, ['email', 'links'])
  const appearance = object(content.appearance, ['motion', 'character'])
  const email = text(contact.email, 254)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return invalid()
  if (appearance.character !== 'classic') return invalid()
  // 只兼容旧内容完全缺失music；显式null、数组或不完整音乐对象仍视为错误。
  const music = Object.hasOwn(content, 'music') ? object(content.music, ['enabled', 'title', 'sourceUrl', 'volume', 'loop']) : { enabled: false, title: '', sourceUrl: '', volume: 25, loop: true }
  const sourceUrl = url(music.sourceUrl, 'audio')
  const enabled = bool(music.enabled)
  if (!Number.isInteger(music.volume) || (music.volume as number) < 0 || (music.volume as number) > 100 || (enabled && !sourceUrl)) return invalid()
  let capabilities = defaultSiteCapabilities()
  if (Object.hasOwn(content, 'capabilities')) {
    const groups = object(content.capabilities, CAPABILITY_CATEGORIES.map(group => group.id))
    capabilities = Object.fromEntries(CAPABILITY_CATEGORIES.map(({ id }) => {
      const items = list(groups[id], MAX_CAPABILITIES_PER_CATEGORY, value => {
        const item = object(value, ['icon', 'name'])
        if (!isCapabilityIcon(item.icon)) return invalid()
        return { icon: item.icon, name: text(item.name, 40, true) }
      })
      if (new Set(items.map(item => item.icon)).size !== items.length) return invalid()
      return [id, items]
    })) as SiteCapabilities
  }
  let capabilityDetails: SiteCapabilityDetails = defaultSiteCapabilityDetails()
  if (Object.hasOwn(content, 'capabilityDetails')) {
    const details = object(content.capabilityDetails, ['technology', 'company', 'projects'])
    const technology = object(details.technology, ['introduction'])
    const company = object(details.company, ['name', 'summary', 'introduction', 'business', 'responsibilities'])
    const projects = list(details.projects, MAX_COMPANY_PROJECTS, value => {
      const project = object(value, ['id', 'name', 'summary', 'content', 'coverUrl', 'visible'])
      const id = text(project.id, 64, true)
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return invalid()
      return { id, name: text(project.name, 80, true), summary: text(project.summary, 300), content: text(project.content, 20000), coverUrl: url(project.coverUrl, 'image'), visible: bool(project.visible) }
    })
    if (new Set(projects.map(project => project.id)).size !== projects.length) return invalid()
    capabilityDetails = {
      technology: { introduction: text(technology.introduction, 2000) },
      company: { name: text(company.name, 80), summary: text(company.summary, 300), introduction: text(company.introduction, 10000), business: text(company.business, 10000), responsibilities: text(company.responsibilities, 10000) },
      projects,
    }
  }
  // 想法、作品与对话分区随新首页加入；旧后端缺失时公开页退化为空列表和关闭的对话。
  let thoughts: SiteThought[] = []
  if (Object.hasOwn(content, 'thoughts')) {
    thoughts = list(content.thoughts, 12, (value) => {
      const item = object(value, ['id', 'title', 'summary', 'content', 'meta', 'visible'])
      const id = text(item.id, 64, true)
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return invalid()
      return { id, title: text(item.title, 80, true), summary: text(item.summary, 200), content: text(item.content, 20000), meta: text(item.meta, 40), visible: bool(item.visible) }
    })
    if (new Set(thoughts.map(item => item.id)).size !== thoughts.length) return invalid()
  }
  let works: SiteWork[] = []
  if (Object.hasOwn(content, 'works')) {
    works = list(content.works, 12, (value) => {
      const item = object(value, ['id', 'title', 'summary', 'url', 'label', 'coverUrl', 'meta', 'visible'])
      const id = text(item.id, 64, true)
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return invalid()
      return {
        id, title: text(item.title, 80, true), summary: text(item.summary, 240), url: url(item.url, 'page'),
        label: text(item.label, 20), coverUrl: url(item.coverUrl, 'image'), meta: text(item.meta, 40), visible: bool(item.visible),
      }
    })
    if (new Set(works.map(item => item.id)).size !== works.length) return invalid()
  }
  let chat = emptyChat
  if (Object.hasOwn(content, 'chat')) {
    const value = object(content.chat, ['enabled', 'heading', 'intro', 'placeholder', 'systemPrompt', 'suggestions'])
    const suggestions = list(value.suggestions, 3, item => text(item, 60, true))
    if (new Set(suggestions).size !== suggestions.length) return invalid()
    chat = {
      enabled: bool(value.enabled), heading: text(value.heading, 40, true), intro: text(value.intro, 240),
      placeholder: text(value.placeholder, 60, true), systemPrompt: text(value.systemPrompt, 4000), suggestions,
    }
  }
  return {
    profile: { name: text(profile.name, 60, true), tagline: text(profile.tagline, 160), bio: text(profile.bio, 4000) },
    home: { eyebrow: text(home.eyebrow, 80, true), title: text(home.title, 80, true), subtitle: text(home.subtitle, 240), buttonLabel: text(home.buttonLabel, 30, true) },
    resume: {
      name: text(resumeValue.name, 60), role: text(resumeValue.role, 80), body: text(resumeValue.body, 20000), pdfUrl,
      summary: resumeValue.summary === undefined ? '' : text(resumeValue.summary, 600),
      meta: resumeValue.meta === undefined ? '' : text(resumeValue.meta, 60),
      skills: resumeSkills, experience: resumeExperience, projects: resumeProjects, education: resumeEducation,
    },
    contact: { email, links: list(contact.links, 8, (item) => {
      const link = object(item, ['label', 'url'])
      return { label: text(link.label, 50, true), url: url(link.url) }
    }) },
    appearance: { motion: bool(appearance.motion), character: 'classic' },
    music: { enabled, title: text(music.title, 80), sourceUrl, volume: music.volume as number, loop: bool(music.loop) },
    capabilities,
    capabilityDetails,
    thoughts,
    works,
    chat,
  }
}

export function parseSiteDocument(value: unknown, allowLegacyMissingDetails = false): SiteDocument {
  const document = object(value, ['version', 'updatedAt', 'content'])
  if (!Number.isSafeInteger(document.version) || (document.version as number) < 0) return invalid()
  const updatedAt = document.updatedAt
  if (updatedAt !== null && (typeof updatedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(updatedAt) || !Number.isFinite(Date.parse(updatedAt)))) return invalid()
  return { version: document.version as number, updatedAt: updatedAt as string | null, content: parseSiteContent(document.content, allowLegacyMissingDetails) }
}

export async function getSite(): Promise<SiteDocument> {
  return parseSiteDocument(await request<unknown>('/site?include=resume'), true)
}

export async function getSiteConfig(): Promise<SiteDocument> {
  return parseSiteDocument(await request<unknown>('/site/config?include=resume'), true)
}

export async function saveSiteConfig(document: Pick<SiteDocument, 'version' | 'content'>, csrfToken: string): Promise<SiteDocument> {
  parseSiteContent(document.content)
  return parseSiteDocument(await request<unknown>('/site/config', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, csrfToken,
    body: JSON.stringify(document),
  }))
}

export async function uploadSiteAudio(file: File, csrfToken: string): Promise<{ url: string }> {
  const body = new FormData()
  body.append('file', file)
  const result = object(await request<unknown>('/site/audio-assets', { method: 'POST', csrfToken, body }), ['url'])
  const assetUrl = url(result.url, 'audio')
  if (!assetUrl.startsWith('/api/site/assets/')) return invalid()
  return { url: assetUrl }
}

export function parseSiteFileAsset(value: unknown): SiteFileAsset {
  const asset = object(value, ['url', 'name', 'mimeType', 'size', 'kind'])
  const assetUrl = text(asset.url, 2048, true)
  if (!/^\/api\/site\/assets\/[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}\.(jpg|png|webp|pdf|zip|txt|docx|xlsx|pptx)$/.test(assetUrl)) return invalid()
  const extension = assetUrl.split('.').pop() as keyof typeof SITE_FILE_TYPES
  const info = SITE_FILE_TYPES[extension]
  const name = text(asset.name, 150, true)
  const unsafeName = name.includes('/') || name.includes('\\') || Array.from(name).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  if (unsafeName || asset.kind !== info.kind || asset.mimeType !== info.mimeType || !Number.isSafeInteger(asset.size) || (asset.size as number) < 1 || (asset.size as number) > (info.kind === 'image' ? SITE_IMAGE_MAX_SIZE : SITE_ATTACHMENT_MAX_SIZE)) return invalid()
  return { url: assetUrl, name, mimeType: info.mimeType, size: asset.size as number, kind: info.kind }
}

export async function uploadSiteFile(file: File, csrfToken: string): Promise<SiteFileAsset> {
  const body = new FormData()
  body.append('file', file)
  return parseSiteFileAsset(await request<unknown>('/site/file-assets', { method: 'POST', csrfToken, body }))
}
