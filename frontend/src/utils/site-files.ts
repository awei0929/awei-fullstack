import { SITE_ATTACHMENT_MAX_SIZE, SITE_FILE_TYPES, SITE_IMAGE_MAX_SIZE } from '../config/site-files'
import type { SiteFileAsset, SiteFileUploadTarget } from '../types/site'

export function siteFileUploadKey(target: SiteFileUploadTarget): string {
  if (target.type === 'cover' || target.type === 'project') return `${target.type}:${target.projectId}`
  return target.type === 'company' ? `company:${target.field}` : 'library'
}

export function siteFileValidationError(file: File, expectedKind?: SiteFileAsset['kind']): string {
  let extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (extension === 'jpeg') extension = 'jpg'
  const info = Object.hasOwn(SITE_FILE_TYPES, extension) ? SITE_FILE_TYPES[extension as keyof typeof SITE_FILE_TYPES] : undefined
  if (!info || (expectedKind && info.kind !== expectedKind)) return expectedKind === 'image' ? '请选择 JPG、PNG 或 WebP 图片。' : expectedKind === 'attachment' ? '请选择 PDF、ZIP、TXT、DOCX、XLSX 或 PPTX 附件。' : '请选择支持的图片或附件格式。'
  const limit = info.kind === 'image' ? SITE_IMAGE_MAX_SIZE : SITE_ATTACHMENT_MAX_SIZE
  return file.size === 0 || file.size > limit ? `文件不能为空；${info.kind === 'image' ? '图片最大 5 MiB' : '附件最大 20 MiB'}。` : ''
}

export function siteFileMarkdown(asset: SiteFileAsset): string {
  // 标签按普通文字转义，文件名不能闭合链接或插入额外 Markdown。
  const label = asset.name.replace(/[\\`*{}[\]()#+.!_|>~-]/g, '\\$&').replace(/[\r\n]/g, ' ')
  return `${asset.kind === 'image' ? '!' : ''}[${label}](${asset.url})`
}
