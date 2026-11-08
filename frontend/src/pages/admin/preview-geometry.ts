export type SitePreviewDevice = 'desktop' | 'mobile'

export function getPreviewGeometry(availableWidth: number, device: SitePreviewDevice) {
  const canvasWidth = device === 'mobile' ? 390 : Math.max(1440, Math.round(availableWidth))
  const canvasHeight = device === 'mobile' ? 844 : Math.round(canvasWidth * 900 / 1440)
  const scale = Math.min(1, availableWidth / canvasWidth)
  return { canvasWidth, canvasHeight, scale, width: canvasWidth * scale, height: canvasHeight * scale }
}
