import { useId } from 'react'
import { observer } from 'mobx-react-lite'
import { isSafeSiteUrl } from '../../api/site'
import { MAX_COMPANY_PROJECTS } from '../../config/site-capability-details'
import { SiteMarkdown } from '../../components/site-markdown'
import { siteAdminStore as store } from '../../store/site-admin'
import { Toggle } from './fields'
import styles from './capability-details-editor.module.less'

type CompanyMarkdownField = 'introduction' | 'business' | 'responsibilities'

interface DetailFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  limit: number
  multiline?: boolean
  markdown?: boolean
  required?: boolean
  marker?: string
  invalid?: boolean
  hint?: string
}

// oxlint-disable-next-line react/only-export-components -- 字段仅供同文件的两个共享草稿编辑器使用。
function DetailField({ label, value, onChange, limit, multiline, markdown, required, marker, invalid, hint }: DetailFieldProps) {
  const id = useId()
  const props = {
    id, value, required, disabled: !store.canEdit,
    'aria-invalid': invalid || undefined,
    'aria-describedby': `${id}-hint`,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { event.target.setCustomValidity(''); onChange(Array.from(event.target.value).slice(0, limit).join('')) },
  }
  return <div className={styles.field}>
    <label htmlFor={id}>{label}{required && <span aria-hidden="true"> *</span>}</label>
    {multiline ? <textarea {...props} rows={markdown ? 9 : 3} data-company-markdown={marker} /> : <input {...props} ref={input => input?.setCustomValidity(marker?.startsWith('cover:') && invalid ? '请填写安全的 HTTP/HTTPS 图片地址或已有本站图片路径。' : '')} pattern={required ? '.*\\S.*' : undefined} data-company-project-name={marker?.startsWith('name:') ? marker.slice(5) : undefined} data-company-project-cover={marker?.startsWith('cover:') ? marker.slice(6) : undefined} />}
    <small id={`${id}-hint`}>{Array.from(value).length} / {limit} 字{hint ? ` · ${hint}` : ''}</small>
    {markdown && <details className={styles.markdownPreview}><summary>查看 Markdown 预览</summary><div>{value.trim() ? <SiteMarkdown content={value} /> : <p className={styles.empty}>正文暂未填写。</p>}</div></details>}
  </div>
}

// oxlint-disable-next-line react/only-export-components -- 独立观察共享草稿，保持公司正文连续输入。
const CompanyEditor = observer(function CompanyEditor() {
  const company = store.draft!.capabilityDetails.company
  const markdownFields: { key: CompanyMarkdownField; label: string }[] = [
    { key: 'introduction', label: '公司简介' },
    { key: 'business', label: '核心业务' },
    { key: 'responsibilities', label: '岗位职责' },
  ]
  return <div className={styles.details}>
    <p className={styles.hint}>介绍你的真实工作经历。留空时，官网显示尚未填写。</p>
    <DetailField label="公司名称" value={company.name} limit={80} onChange={value => store.edit(draft => { draft.capabilityDetails.company.name = value })} />
    <DetailField label="公司简介摘要" value={company.summary} limit={300} multiline onChange={value => store.edit(draft => { draft.capabilityDetails.company.summary = value })} />
    {markdownFields.map(({ key, label }) => <DetailField key={key} label={`${label} · Markdown`} value={company[key]} limit={10000} multiline markdown marker={key} onChange={value => store.edit(draft => { draft.capabilityDetails.company[key] = value })} hint="支持标题、列表、表格、代码块、链接与图片" />)}
  </div>
})

// oxlint-disable-next-line react/only-export-components -- 项目操作只修改同一份未保存草稿。
const ProjectsEditor = observer(function ProjectsEditor({ projectId, onProjectChange }: { projectId: string | null; onProjectChange: (id: string | null) => void }) {
  const projects = store.draft!.capabilityDetails.projects
  const selected = projects.find(project => project.id === projectId) ?? projects[0]
  const selectedIndex = selected ? projects.findIndex(project => project.id === selected.id) : -1
  const full = projects.length >= MAX_COMPANY_PROJECTS
  const add = () => {
    if (!store.canEdit || full) return
    const id = `company-${crypto.randomUUID()}`
    store.edit(draft => { draft.capabilityDetails.projects.push({ id, name: '', summary: '', content: '', coverUrl: '', visible: true }) })
    onProjectChange(id)
  }
  const move = (offset: -1 | 1) => store.edit(draft => {
    const list = draft.capabilityDetails.projects
    const index = list.findIndex(project => project.id === selected?.id)
    const destination = index + offset
    if (index < 0 || destination < 0 || destination >= list.length) return
    const [project] = list.splice(index, 1)
    list.splice(destination, 0, project)
  })
  const remove = () => {
    if (!store.canEdit || !selected) return
    const next = projects[selectedIndex + 1]?.id ?? projects[selectedIndex - 1]?.id ?? null
    store.edit(draft => { draft.capabilityDetails.projects.splice(selectedIndex, 1) })
    onProjectChange(next)
  }
  return <div className={styles.details}>
    <div className={styles.projectHeading}><p className={styles.hint}>项目顺序即官网目录顺序。隐藏后仍保留在草稿中。</p><span>{projects.length} / {MAX_COMPANY_PROJECTS}</span></div>
    {projects.length > 0 && <nav className={styles.projectList} aria-label="选择公司项目">{projects.map((project, index) => <button key={project.id} type="button" aria-pressed={selected?.id === project.id} onClick={() => onProjectChange(project.id)}><span>{String(index + 1).padStart(2, '0')}</span><strong>{project.name.trim() || '未命名项目'}</strong><small>{project.visible ? '公开' : '隐藏'}</small></button>)}</nav>}
    {selected ? <section className={styles.projectEditor} aria-label="当前公司项目">
      <div className={styles.projectActions}>
        <button type="button" aria-label="上移项目" disabled={!store.canEdit || selectedIndex === 0} onClick={() => move(-1)}>↑ 上移</button>
        <button type="button" aria-label="下移项目" disabled={!store.canEdit || selectedIndex === projects.length - 1} onClick={() => move(1)}>↓ 下移</button>
        <button type="button" aria-label="删除项目" disabled={!store.canEdit} onClick={remove}>删除项目</button>
      </div>
      <DetailField label="项目名称" value={selected.name} limit={80} required marker={`name:${selected.id}`} invalid={!selected.name.trim() || Array.from(selected.name).length > 80} hint={!selected.name.trim() ? '请填写非空白名称' : undefined} onChange={value => store.edit(draft => { const project = draft.capabilityDetails.projects.find(item => item.id === selected.id); if (project) project.name = value })} />
      <DetailField label="项目简介" value={selected.summary} limit={300} multiline onChange={value => store.edit(draft => { const project = draft.capabilityDetails.projects.find(item => item.id === selected.id); if (project) project.summary = value })} />
      <DetailField label="封面 URL" value={selected.coverUrl} limit={2048} marker={`cover:${selected.id}`} invalid={!isSafeSiteUrl(selected.coverUrl, 'image')} hint={isSafeSiteUrl(selected.coverUrl, 'image') ? '可留空；填写 HTTP/HTTPS 图片地址或已有本站图片路径' : '请输入安全的 HTTP/HTTPS 图片地址或已有本站图片路径'} onChange={value => store.edit(draft => { const project = draft.capabilityDetails.projects.find(item => item.id === selected.id); if (project) project.coverUrl = value })} />
      <Toggle label="公开这个项目" checked={selected.visible} onChange={value => store.edit(draft => { const project = draft.capabilityDetails.projects.find(item => item.id === selected.id); if (project) project.visible = value })} hint="关闭后，访客与公开预览均不展示这个项目。" />
      <DetailField label="项目正文 · Markdown" value={selected.content} limit={20000} multiline markdown onChange={value => store.edit(draft => { const project = draft.capabilityDetails.projects.find(item => item.id === selected.id); if (project) project.content = value })} hint="可用标题组织业务背景、负责模块、技术栈、难点与贡献" />
      <button type="button" className={styles.outlineButton} disabled={!store.canEdit || Boolean(selected.content)} onClick={() => store.edit(draft => { const project = draft.capabilityDetails.projects.find(item => item.id === selected.id); if (project && !project.content) project.content = '## 业务背景\n\n## 负责模块\n\n## 技术栈\n\n## 难点与解决\n\n## 我的贡献\n' })}>插入正文结构</button>
    </section> : <p className={styles.empty}>还没有公司项目。添加后可以编写真实的工程经历。</p>}
    <button type="button" className={styles.addButton} disabled={!store.canEdit || full} onClick={add}>＋ 添加公司项目</button>
    {full && <p className={styles.hint}>已达 {MAX_COMPANY_PROJECTS} 项，删除一项后可继续添加。</p>}
  </div>
})

export const CapabilityDetailsEditor = observer(function CapabilityDetailsEditor({ section, projectId = null, onProjectChange = () => {} }: { section: 'company' | 'projects'; projectId?: string | null; onProjectChange?: (id: string | null) => void }) {
  return section === 'company' ? <CompanyEditor /> : <ProjectsEditor projectId={projectId} onProjectChange={onProjectChange} />
})
