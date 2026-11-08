import { useState } from 'react'
import { observer } from 'mobx-react-lite'
import { CAPABILITY_CATEGORIES, capabilityIconUrl } from '../../config/site-capabilities'
import type { SiteContent, SiteCapabilityCategory } from '../../types/site'
import { SiteImage, SiteMarkdown } from '../../components/site-markdown'
import { CapabilityIcon } from './capability-content'
import type { CapabilityPanelKind } from './capability-content'
import styles from './capability-details.module.less'

const groups: { id: SiteCapabilityCategory; title: string; symbol: string }[] = [
  { id: 'frontend', title: '前端开发', symbol: '▱' },
  { id: 'backend', title: '后端服务', symbol: '◉' },
  { id: 'ai', title: 'AI 开发工具', symbol: '✦' },
  { id: 'deployment', title: '部署工程', symbol: '◇' },
]
const companySections = [
  { id: 'introduction', title: '公司简介', summary: '了解公司与产品方向' },
  { id: 'business', title: '核心业务', summary: '从业务场景理解产品' },
  { id: 'responsibilities', title: '岗位职责', summary: '我在团队中的角色' },
] as const

// oxlint-disable-next-line react/only-export-components -- 文件同时导出observer包装组件，空态仅在本文件使用。
function Empty({ title, description }: { title: string; description: string }) {
  return <div className={styles.empty}><span aria-hidden="true">↗</span><h3>{title}</h3><p>{description}</p></div>
}

// oxlint-disable-next-line react/only-export-components -- 详情实时读取同一份站主草稿，切目录不关闭外层dialog。
export const CapabilityDetails = observer(function CapabilityDetails({ kind, content, titleId }: { kind: CapabilityPanelKind; content: SiteContent; titleId: string }) {
  const [companySection, setCompanySection] = useState<typeof companySections[number]['id']>('introduction')
  const [projectId, setProjectId] = useState<string | null>(null)
  const details = content.capabilityDetails
  const projects = details.projects.filter(project => project.visible)
  const project = projects.find(item => item.id === projectId) ?? projects[0]
  const currentCompany = companySections.find(item => item.id === companySection)!

  return <>
    <header className={styles.heading}>
      <span className={`${styles.headingIcon} ${styles[kind]}`}><CapabilityIcon kind={kind} /></span>
      <div><p className={styles.eyebrow}>{kind === 'technology' ? 'BUILD WITH INTENTION' : kind === 'company' ? 'BUSINESS & GROWTH' : 'SELECTED EXPERIENCE'}</p><h2 id={titleId}>{kind === 'technology' ? '技术栈 · AI 全栈开发' : kind === 'company' ? '公司背景 · 业务与成长' : '公司项目 · 工程实践'}</h2><p className={styles.introduction}>{kind === 'technology' ? details.technology.introduction : kind === 'company' ? details.company.summary || '理解业务，找到技术在产品中的位置。' : '从业务需求到技术实现，记录项目中的思考、职责与贡献。'}</p></div>
    </header>
    {kind === 'technology' ? <div className={styles.techGrid}>{groups.map(group => <section className={`${styles.techGroup} ${styles[group.id]}`} key={group.id} aria-label={group.title}>
      <div className={styles.groupHeading}><span aria-hidden="true">{group.symbol}</span><h3>{group.title}</h3></div>
      <p>{CAPABILITY_CATEGORIES.find(item => item.id === group.id)!.description}</p>
      {content.capabilities[group.id].length ? <ul className={styles.technologies}>{content.capabilities[group.id].map(tech => <li key={tech.icon}><img src={capabilityIconUrl(tech.icon)} alt="" width="30" height="30" /><span>{tech.name}</span></li>)}</ul> : <p className={styles.quiet}>暂未配置此类技术</p>}
    </section>)}</div> : kind === 'company' ? <div className={styles.dossier}>
      <nav className={styles.directory} aria-label="公司背景目录">{companySections.map((item, index) => <button type="button" key={item.id} aria-pressed={companySection === item.id} onClick={() => setCompanySection(item.id)}><span className={styles.directoryIndex}>0{index + 1}</span><span><strong>{item.title}</strong><small>{item.summary}</small></span><span className={styles.directoryArrow} aria-hidden="true">↗</span></button>)}</nav>
      <section key={companySection} className={styles.document} aria-label={currentCompany.title}>
        <p className={styles.documentLabel}>{currentCompany.title}</p><h3>{details.company.name || '公司与业务'}</h3>
        {details.company[companySection].trim() ? <SiteMarkdown content={details.company[companySection]} /> : <Empty title={`${currentCompany.title}尚未公开`} description="这部分内容正在整理，欢迎先了解技术栈与项目经验。" />}
      </section>
    </div> : <div className={styles.dossier}>
      <nav className={styles.directory} aria-label="公司项目目录">{projects.length ? projects.map((item, index) => <button type="button" key={item.id} aria-pressed={project.id === item.id} onClick={() => setProjectId(item.id)}><span className={styles.directoryIndex}>{String(index + 1).padStart(2, '0')}</span><span><small>项目 {String(index + 1).padStart(2, '0')}</small><strong>{item.name || '未命名项目'}</strong></span><span className={styles.directoryArrow} aria-hidden="true">↗</span></button>) : <p className={styles.directoryEmpty}>项目目录<br /><span>等待一份新的记录</span></p>}</nav>
      {project ? <section key={project.id} className={styles.document} aria-label={project.name || '项目详情'}>
        {project.coverUrl && <div className={styles.cover}><SiteImage src={project.coverUrl} alt={`${project.name || '项目'}封面`} /></div>}
        <p className={styles.documentLabel}>项目 {String(projects.indexOf(project) + 1).padStart(2, '0')}{details.company.name && <span> / {details.company.name}</span>}</p><h3>{project.name || '未命名项目'}</h3>
        {project.summary && <p className={styles.projectSummary}>{project.summary}</p>}
        {project.content.trim() ? <SiteMarkdown content={project.content} /> : <Empty title="项目详情正在整理" description="项目介绍将在这里呈现。" />}
      </section> : <section className={styles.document}><Empty title="项目经历尚未公开" description="这里将记录业务背景、负责模块、技术方案与个人贡献。" /></section>}
    </div>}
    <footer className={styles.footer}><span>HEY.</span><p>{kind === 'technology' ? '把技术连接起来，让想法真正落地。' : '理解业务 · 解决问题 · 持续积累'}</p></footer>
  </>
})
