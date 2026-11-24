import { useEffect, useId, useRef } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { observer } from 'mobx-react-lite'
import { isSiteResumePdf } from '../../api/site'
import { SiteMarkdown } from '../../components/site-markdown'
import { ThemeToggle } from '../../components/theme-toggle'
import { siteStore } from '../../store/site'
import type { SiteContent } from '../../types/site'
import styles from './style.module.less'

interface ResumeExperienceProps {
  content?: SiteContent
  preview?: boolean
  loading?: boolean
  error?: string
}

export function ResumeExperience({ content, preview = false, loading = false, error = '' }: ResumeExperienceProps) {
  const titleId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const resume = content?.resume
  const name = resume?.name.trim()
  const role = resume?.role.trim()
  const summary = resume?.summary?.trim() ?? ''
  const meta = resume?.meta?.trim() ?? ''
  const body = resume?.body ?? ''
  const hasBody = body.trim().length > 0
  const pdfUrl = resume?.pdfUrl && isSiteResumePdf(resume.pdfUrl) ? resume.pdfUrl : ''
  const email = content?.contact.email
  const contactEmail = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ''
  const skills = resume?.skills ?? []
  const experience = resume?.experience ?? []
  const projects = resume?.projects ?? []
  const education = resume?.education ?? []
  const hasSections = skills.length > 0 || experience.length > 0 || projects.length > 0 || education.length > 0

  useEffect(() => {
    if (preview) return
    const previousTitle = document.title
    document.title = name ? `${name}${role ? `-${role}` : ''}-简历` : '简历 · HEY.'
    return () => { document.title = previousTitle }
  }, [name, preview, role])

  useEffect(() => {
    if (preview) return
    window.scrollTo(0, 0)
    headingRef.current?.focus({ preventScroll: true })
  }, [preview])

  return <div className={`${styles.page}${preview ? ` ${styles.preview}` : ''}`} onClickCapture={event => {
    if (preview && event.target instanceof Element && event.target.closest('a')) event.preventDefault()
  }}>
    {!preview && <header className={styles.toolbar}>
      <div className={styles.toolbarInner}>
        <Link className={styles.brand} to="/" aria-label="返回首页">
          <span className={styles.brandMark} aria-hidden="true">H</span><span>HEY.</span>
        </Link>
        <nav className={styles.nav} aria-label="页面导航">
          <NavLink to="/thoughts">想法</NavLink><NavLink to="/works">作品</NavLink><NavLink to="/resume">简历</NavLink>
        </nav>
        <div className={styles.toolbarActions}>
          <ThemeToggle />
          <button className={styles.printAction} type="button" onClick={() => window.print()} title="在打印窗口选择「存储为 PDF」" aria-label="导出 PDF">
            导出 PDF <span aria-hidden="true">↓</span>
          </button>
        </div>
      </div>
    </header>}

    <main className={styles.paperShell} aria-labelledby={titleId}>
      <article className={styles.paper}>
        <header className={styles.docHeader}>
          <h1 id={titleId} tabIndex={-1} ref={headingRef}>{name || '简历'}</h1>
          {role && <p className={styles.role}>{role}</p>}
          {(summary || contactEmail || meta || pdfUrl) && <div className={styles.contactLine}>
            {contactEmail && <a href={`mailto:${contactEmail}`}>{contactEmail}</a>}
            {meta && <span>{meta}</span>}
            {pdfUrl && <a className={styles.pdfLink} href={pdfUrl} download>PDF 附件</a>}
          </div>}
          {summary && <p className={styles.summary}>{summary}</p>}
        </header>

        {loading && !content && <p className={styles.status} role="status">正在加载简历…</p>}

        {skills.length > 0 && <section className={styles.section} aria-labelledby="resume-skills">
          <h2 className={styles.sectionTitle} id="resume-skills">专业技能</h2>
          <div className={styles.skillList}>
            {skills.map((group, index) => <div className={styles.skillRow} key={`${group.label}-${index}`}>
              <h3>{group.label}</h3>
              <p>{group.items.join(' · ')}</p>
            </div>)}
          </div>
        </section>}

        {experience.length > 0 && <section className={styles.section} aria-labelledby="resume-experience">
          <h2 className={styles.sectionTitle} id="resume-experience">工作经历</h2>
          <div className={styles.entryList}>
            {experience.map((entry, index) => <article className={styles.entry} key={`${entry.company}-${index}`}>
              <div className={styles.entryHead}>
                <div>
                  <h3>{entry.company}</h3>
                  {entry.role && <p className={styles.entryRole}>{entry.role}</p>}
                </div>
                {entry.period && <p className={styles.entryPeriod}>{entry.period}</p>}
              </div>
              {entry.summary && <p className={styles.entrySummary}>{entry.summary}</p>}
              {entry.highlights.length > 0 && <ul className={styles.bullets}>
                {entry.highlights.map((line, lineIndex) => <li key={lineIndex}>{line}</li>)}
              </ul>}
            </article>)}
          </div>
        </section>}

        {projects.length > 0 && <section className={styles.section} aria-labelledby="resume-projects">
          <h2 className={styles.sectionTitle} id="resume-projects">项目经历</h2>
          <div className={styles.projectList}>
            {projects.map((project, index) => <article className={styles.project} key={`${project.name}-${index}`}>
              <div className={styles.projectHead}>
                <div>
                  <h3>{project.name}</h3>
                  {project.role && <p className={styles.projectRole}>{project.role}</p>}
                </div>
                {project.period && <p className={styles.projectPeriod}>{project.period}</p>}
              </div>
              {project.summary && <p className={styles.projectSummary}>{project.summary}</p>}
              {project.tech.length > 0 && <p className={styles.tech}>技术栈：{project.tech.join(' · ')}</p>}
              {project.highlights.length > 0 && <ul className={styles.bullets}>
                {project.highlights.map((line, lineIndex) => <li key={lineIndex}>{line}</li>)}
              </ul>}
            </article>)}
          </div>
        </section>}

        {education.length > 0 && <section className={styles.section} aria-labelledby="resume-education">
          <h2 className={styles.sectionTitle} id="resume-education">教育经历</h2>
          <div className={styles.educationList}>
            {education.map((entry, index) => <div className={styles.educationRow} key={`${entry.school}-${index}`}>
              <div>
                <h3>{entry.school}</h3>
                {entry.major && <p>{entry.major}</p>}
              </div>
              {entry.period && <p className={styles.educationPeriod}>{entry.period}</p>}
            </div>)}
          </div>
        </section>}

        {hasBody && <section className={styles.section} aria-label="补充内容">
          <h2 className={styles.sectionTitle}>补充内容</h2>
          <div className={styles.body}><SiteMarkdown content={body} theme="paper" /></div>
        </section>}

        {!hasSections && !hasBody && !pdfUrl && !loading && !error && <p className={styles.status} role="status">简历内容尚未发布。</p>}

        <footer className={styles.paperFooter}>
          <span>{[name, role].filter(Boolean).join(' · ')}</span>
          {contactEmail && <span>{contactEmail}</span>}
        </footer>
      </article>
    </main>
  </div>
}

// oxlint-disable-next-line react/only-export-components -- MobX observer 包装的命名页面组件。
export const ResumePage = observer(function ResumePage() {
  useEffect(() => { void siteStore.load() }, [])
  const content = siteStore.document?.content
  return <ResumeExperience content={content} loading={siteStore.loading || (!content && !siteStore.error)} error={siteStore.error} />
})
