import { useId } from 'react'
import { observer } from 'mobx-react-lite'
import { SITE_ATTACHMENT_ACCEPT, SITE_FILE_ACCEPT, SITE_IMAGE_ACCEPT } from '../../config/site-files'
import type { SiteFileUploadTarget } from '../../types/site'
import { siteFileUploadKey } from '../../utils/site-files'
import { siteAdminStore as store } from '../../store/site-admin'
import { Group } from './fields'
import styles from './file-upload.module.less'

// oxlint-disable-next-line react/only-export-components -- MobX 包装的复用上传结果组件。
export const FileUploadResult = observer(function FileUploadResult({ targetKey }: { targetKey?: string }) {
  const id = useId()
  const result = store.lastFileUpload
  if (!result || (targetKey && result.targetKey !== targetKey)) return null
  return <div className={styles.result} aria-live="polite">
    <p>最近一次上传：<strong>{result.asset.name}</strong></p>
    <label htmlFor={`${id}-url`}>文件地址</label>
    <textarea id={`${id}-url`} readOnly value={result.asset.url} rows={2} spellCheck={false} onFocus={event => event.target.select()} />
    <label htmlFor={`${id}-markdown`}>Markdown</label>
    <textarea id={`${id}-markdown`} readOnly value={result.markdown} rows={3} spellCheck={false} onFocus={event => event.target.select()} />
    <small>文件已公开，页面引用需保存后生效</small>
  </div>
})

// oxlint-disable-next-line react/only-export-components -- MobX 包装的复用上传控件。
export const FileUploadControl = observer(function FileUploadControl({ target, mode = 'markdown', showResult = true }: { target: SiteFileUploadTarget; mode?: 'all' | 'image' | 'markdown'; showResult?: boolean }) {
  const key = siteFileUploadKey(target)
  const uploading = store.uploadingFile && store.fileUploadTarget === key
  const error = store.fileUploadTarget === key ? store.fileUploadError : ''
  const buttons = mode === 'markdown' ? [
    { label: '上传图片并插入', accept: SITE_IMAGE_ACCEPT, kind: 'image' as const },
    { label: '上传附件并插入', accept: SITE_ATTACHMENT_ACCEPT, kind: 'attachment' as const },
  ] : [{ label: mode === 'image' ? '上传封面图片' : '选择图片或附件上传', accept: mode === 'image' ? SITE_IMAGE_ACCEPT : SITE_FILE_ACCEPT, kind: mode === 'image' ? 'image' as const : undefined }]
  return <div className={styles.upload}>
    <div className={styles.actions}>{buttons.map(button => <label key={button.label} className={`${styles.button} ${!store.canEdit ? styles.disabled : ''}`}>
      {uploading ? '正在上传…' : button.label}
      <input type="file" aria-label={button.label} accept={button.accept} disabled={!store.canEdit} onChange={event => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (file) void store.uploadFile(file, target, button.kind)
      }} />
    </label>)}</div>
    <small>{mode === 'image' ? '图片最大 5 MiB' : '图片最大 5 MiB，附件最大 20 MiB'}；上传后可公开访问。{mode === 'markdown' && '成功后追加到这段正文末尾。'}</small>
    {uploading && <progress aria-label="文件上传中" />}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {showResult && <FileUploadResult targetKey={key} />}
  </div>
})

export function FileUploadsEditor() {
  return <Group title="上传图片与附件" description="文件上传后即可凭链接公开访问；隐藏项目或移除引用不会让文件变私密。">
    <p className={styles.formats}>图片：JPG、PNG、WebP<br />附件：PDF、ZIP、TXT、DOCX、XLSX、PPTX</p>
    <FileUploadControl target={{ type: 'library' }} mode="all" showResult={false} />
    <FileUploadResult />
    <p className={styles.formats}>复制上传后的地址到所需字段，保存后生效。</p>
  </Group>
}
