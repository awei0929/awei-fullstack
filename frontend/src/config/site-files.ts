export const SITE_FILE_TYPES = {
  jpg: { mimeType: 'image/jpeg', kind: 'image' },
  png: { mimeType: 'image/png', kind: 'image' },
  webp: { mimeType: 'image/webp', kind: 'image' },
  pdf: { mimeType: 'application/pdf', kind: 'attachment' },
  zip: { mimeType: 'application/zip', kind: 'attachment' },
  txt: { mimeType: 'text/plain', kind: 'attachment' },
  docx: { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', kind: 'attachment' },
  xlsx: { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', kind: 'attachment' },
  pptx: { mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', kind: 'attachment' },
} as const

export const SITE_IMAGE_ACCEPT = '.jpg,.jpeg,.png,.webp'
export const SITE_ATTACHMENT_ACCEPT = '.pdf,.zip,.txt,.docx,.xlsx,.pptx'
export const SITE_FILE_ACCEPT = `${SITE_IMAGE_ACCEPT},${SITE_ATTACHMENT_ACCEPT}`
export const SITE_IMAGE_MAX_SIZE = 5 * 1024 * 1024
export const SITE_ATTACHMENT_MAX_SIZE = 20 * 1024 * 1024
