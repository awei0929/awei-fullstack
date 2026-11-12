type CopyResult = { ok: true } | { ok: false; message: string }

// Called only by the copy button; never requests clipboard read permission.
export async function copyChatText(text: string): Promise<CopyResult> {
  try {
    if (typeof navigator === 'undefined' || globalThis.isSecureContext === false || typeof navigator.clipboard?.writeText !== 'function') {
      return { ok: false, message: '当前浏览器无法复制，请选中文字手动复制。' }
    }
    await navigator.clipboard.writeText(text)
    return { ok: true }
  } catch {
    return { ok: false, message: '复制失败，请允许剪贴板权限或选中文字手动复制。' }
  }
}
