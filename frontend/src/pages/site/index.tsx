import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { observer } from 'mobx-react-lite'
import { Link, NavLink } from 'react-router-dom'
import { isSafeSiteUrl } from '../../api/site'
import { SiteMarkdown, SiteImage } from '../../components/site-markdown'
import { ThemeToggle } from '../../components/theme-toggle'
import { defaultSiteCapabilities } from '../../config/site-capabilities'
import { defaultSiteCapabilityDetails } from '../../config/site-capability-details'
import { siteStore } from '../../store/site'
import type { SiteContent, SiteThought, SiteWork } from '../../types/site'
import { Conversation } from './conversation'
import styles from './home.module.less'

type SiteExperienceProps = {
  content: SiteContent
  preview?: boolean
  focus?: 'thoughts' | 'works' | 'conversation'
  loading?: boolean
}

type Reading = { title: string; meta: string; content: string }

// 首屏在接口返回前先给出主张，不让访客看到空白或占位姓名。
const welcomeContent: SiteContent = {
  profile: { name: 'HEY.', tagline: '独立开发者', bio: '' },
  home: {
    eyebrow: 'A LITTLE HELLO',
    title: '把想法，做成\n可以体验的东西。',
    subtitle: '这里记录我正在想的事、做过的项目，以及一个可以随时聊两句的 AI 分身。',
    buttonLabel: '往下看看',
  },
  resume: { name: '', role: '', body: '', pdfUrl: '' },
  contact: { email: '', links: [] },
  appearance: { motion: true, character: 'classic' },
  music: { enabled: false, title: '', sourceUrl: '', volume: 25, loop: true },
  capabilities: defaultSiteCapabilities(),
  capabilityDetails: defaultSiteCapabilityDetails(),
  thoughts: [],
  works: [],
  chat: {
    enabled: false, heading: '找我说会儿话。', intro: '关于经历、想法和这个网站，都可以直接问。',
    placeholder: '今天想从哪儿说起……', systemPrompt: '', suggestions: [],
  },
}

const sectionCopy = {
  thoughts: { number: '01', label: 'THINKING', title: '把一件事想透。', note: '写下来的判断，比说过的话更耐读。' },
  works: { number: '02', label: 'SELECTED WORK', title: '让想法可以体验。', note: '能点开、能用、能被别人接着做的东西。' },
}

// oxlint-disable-next-line react/only-export-components -- 首页内部排版组件。
function SectionHead({ number, label, title, note, aside }: { number: string; label: string; title: string; note?: string; aside?: ReactNode }) {
  return <div className={styles.sectionHead}>
    <div className={styles.sectionKicker}><span>{number}</span><span>{label}</span></div>
    <div className={styles.sectionTitleRow}>
      <div><h2>{title}</h2>{note && <p className={styles.sectionNote}>{note}</p>}</div>
      {aside && <div className={styles.sectionAside}>{aside}</div>}
    </div>
  </div>
}

// oxlint-disable-next-line react/only-export-components -- 首页内部插画组件。
function OrbitArt({ motion }: { motion: boolean }) {
  return <div className={styles.orbit} data-motion={motion} aria-hidden="true">
    <span className={styles.orbitHalo} />
    <span className={styles.orbitCore} />
    <span className={styles.orbitSweep} />
    <svg viewBox="0 0 420 420" role="presentation">
      <g className={styles.orbitRings} fill="none" stroke="currentColor" strokeWidth="0.7">
        {[0, 30, 60, 90, 120, 150].map(angle => <ellipse key={angle} cx="210" cy="210" rx="198" ry="92" transform={`rotate(${angle} 210 210)`} />)}
      </g>
      <g className={styles.orbitRingsAlt} fill="none" stroke="currentColor" strokeWidth="0.55" strokeDasharray="2 9">
        {[15, 75, 135].map(angle => <ellipse key={angle} cx="210" cy="210" rx="170" ry="70" transform={`rotate(${angle} 210 210)`} />)}
      </g>
      <g className={styles.orbitDots} fill="currentColor">
        <circle cx="210" cy="12" r="3.2" className={styles.orbitDot} />
      </g>
      <g className={styles.orbitDotsAlt} fill="currentColor">
        <circle cx="402" cy="210" r="2.4" className={styles.orbitDot} />
        <circle cx="18" cy="210" r="2" className={styles.orbitDot} />
      </g>
    </svg>
    <div className={styles.orbitCenter}><span>想法</span></div>
  </div>
}

// oxlint-disable-next-line react/only-export-components -- 首页内部封面组件。
function CoverArt({ work }: { work: SiteWork }) {
  if (work.coverUrl && isSafeSiteUrl(work.coverUrl, 'image')) {
    return <div className={styles.coverImage}><SiteImage src={work.coverUrl} alt={work.title} /></div>
  }
  return <div className={styles.coverFallback} aria-hidden="true">
    <span className={styles.coverKicker}>SELECTED WORK</span>
    <span className={styles.coverTitle}>{work.title}</span>
    <span className={styles.coverFooter}><span>{work.meta || work.label || 'PROJECT'}</span><span>{work.label || '↗'}</span></span>
  </div>
}

function workHref(work: SiteWork): string | null {
  return work.url && isSafeSiteUrl(work.url, 'page') ? work.url : null
}

// oxlint-disable-next-line react/only-export-components -- MobX observer 包装的命名页面组件。
export const SitePage = observer(function SitePage({ section }: { section?: 'thoughts' | 'works' }) {
  useEffect(() => {
    void siteStore.load()
    // 后台保存后切回官网标签页时重新读取，避免已打开的页面一直停留在旧内容。
    const refresh = () => { if (document.visibilityState === 'visible') void siteStore.load() }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])
  // 路径页复用同一份内容，但用真实路由代替 #hash：直接访问 /works 也会落到作品区。
  const contentReady = Boolean(siteStore.document) && !siteStore.loading
  useEffect(() => { if (!section) window.scrollTo({ top: 0 }) }, [section])
  useEffect(() => {
    if (!section || !contentReady) return
    const frame = window.requestAnimationFrame(() => document.getElementById(section)?.scrollIntoView({ block: 'start' }))
    return () => window.cancelAnimationFrame(frame)
  }, [section, contentReady])
  return <SiteExperience
    content={siteStore.document?.content ?? welcomeContent}
    loading={siteStore.loading || (!siteStore.document && !siteStore.error)}
  />
})

// oxlint-disable-next-line react/only-export-components -- 直接订阅共享草稿，后台编辑时预览实时更新。
export const SiteExperience = observer(function SiteExperience({ content, preview = false, focus, loading = false }: SiteExperienceProps) {
  const [reading, setReading] = useState<Reading | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const name = content.profile.name.trim() || 'HEY.'
  const tagline = content.profile.tagline.trim() || '独立开发者'
  const motion = content.appearance.motion
  const thoughts = content.thoughts.filter(item => preview || item.visible)
  const works = content.works.filter(item => preview || item.visible)
  const featured = works[0]
  const rest = works.slice(1)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (reading && !dialog.open) dialog.showModal()
    if (!reading && dialog.open) dialog.close()
  }, [reading])

  // 后台编辑想法/作品/对话时，预览直接落在对应分区，而不是总从首屏开始。
  useEffect(() => {
    if (!preview || !focus) return
    const timer = window.setTimeout(() => document.getElementById(focus)?.scrollIntoView({ block: 'start' }), 80)
    return () => window.clearTimeout(timer)
  }, [preview, focus])

  const openThought = (thought: SiteThought) => setReading({ title: thought.title, meta: thought.meta, content: thought.content || thought.summary })
  return <div className={styles.page} data-motion={motion}>
    <a className={styles.skip} href="#main">跳到内容</a>
    <header className={styles.header}>
      <Link className={styles.brand} to="/" aria-label={`${name} 首页`}>
        <span className={styles.brandMark}>{Array.from(name)[0]}</span><span>{name}</span>
      </Link>
      <nav className={styles.nav} aria-label="页面导航">
        <NavLink to="/thoughts">想法</NavLink><NavLink to="/works">作品</NavLink><NavLink to="/resume">简历</NavLink>
      </nav>
      <div className={styles.headerTools}>
        <ThemeToggle />
        <Link className={styles.headerCta} to="/chat">开始对话<span aria-hidden="true">↗</span></Link>
      </div>
    </header>

    <main id="main" className={styles.main} aria-busy={loading}>
      <section className={styles.hero} id="top">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}><span className={styles.dot} />{name} / {tagline}</p>
          <h1>{content.home.title.split('\n').map((line, index) => <span key={`${line}-${index}`}>{line || '\u00a0'}</span>)}</h1>
          <p className={styles.heroSubtitle}>{content.home.subtitle}</p>
          <div className={styles.heroActions}>
            <button type="button" className={styles.downLink} onClick={() => document.getElementById('thoughts')?.scrollIntoView({ block: 'start', behavior: 'smooth' })}><span>{content.home.buttonLabel || '往下看看'}</span><span className={styles.circleArrow} aria-hidden="true">↓</span></button>
          </div>
        </div>
        <OrbitArt motion={motion} />
      </section>

      <section className={`${styles.section} ${styles.thoughtsSection}`} id="thoughts">
        <SectionHead {...sectionCopy.thoughts} aside={<span className={styles.count}>{thoughts.length ? `${String(thoughts.length).padStart(2, '0')} 篇` : '整理中'}</span>} />
        {thoughts.length > 0 ? <div className={styles.thoughtList}>
          {thoughts.map((thought, index) => <article key={thought.id} className={styles.thought}>
            <button type="button" className={styles.thoughtButton} onClick={() => openThought(thought)} disabled={!(thought.content.trim() || thought.summary.trim())}>
              <span className={styles.thoughtNumber}>{String(index + 1).padStart(2, '0')}</span>
              <span className={styles.thoughtBody}>
                <span className={styles.thoughtTitleRow}><strong>{thought.title}</strong>{preview && !thought.visible && <em className={styles.hiddenBadge}>隐藏</em>}</span>
                {thought.summary && <span className={styles.thoughtSummary}>{thought.summary}</span>}
              </span>
              <span className={styles.thoughtMeta}>{thought.meta || '笔记'}<i aria-hidden="true">{thought.content.trim() ? '↗' : '—'}</i></span>
            </button>
          </article>)}
        </div> : <p className={styles.empty}>想法还在整理，先去作品里看看。</p>}
      </section>

      <section className={`${styles.section} ${styles.worksSection}`} id="works">
        <SectionHead {...sectionCopy.works} aside={<span className={styles.count}>{works.length ? `${String(works.length).padStart(2, '0')} 件` : '整理中'}</span>} />
        {featured ? <>
          <div className={styles.featured}>
            <div className={styles.featuredVisual}><CoverArt work={featured} />{preview && !featured.visible && <em className={styles.hiddenBadge}>隐藏</em>}</div>
            <div className={styles.featuredPanel}>
              <p className={styles.featuredKicker}>01 — {featured.label || '项目'}</p>
              <h3>{featured.title}</h3>
              {featured.summary && <p>{featured.summary}</p>}
              <div className={styles.featuredFoot}>
                <span>{featured.meta}</span>
                {workHref(featured) && <a href={workHref(featured) as string} target={/^https?:/i.test(featured.url) ? '_blank' : undefined} rel="noopener noreferrer">打开项目<span aria-hidden="true">↗</span></a>}
              </div>
            </div>
          </div>
          {rest.length > 0 && <div className={styles.workGrid}>
            {rest.map((work, index) => <article key={work.id} className={styles.workCard}>
              <div className={styles.workTop}><span>{String(index + 2).padStart(2, '0')}</span><span>{work.label || '项目'}</span></div>
              <h3>{work.title}{preview && !work.visible && <em className={styles.hiddenBadge}>隐藏</em>}</h3>
              {work.summary && <p>{work.summary}</p>}
              <div className={styles.workFoot}><span>{work.meta}</span>{workHref(work) && <a href={workHref(work) as string} target={/^https?:/i.test(work.url) ? '_blank' : undefined} rel="noopener noreferrer" aria-label={`打开${work.title}`}>↗</a>}</div>
            </article>)}
          </div>}
        </> : <p className={styles.empty}>项目还在整理。想先聊聊？<Link to="/chat">去对话</Link></p>}
      </section>

      <Conversation chat={content.chat} />
    </main>

    <footer className={styles.footer}>
      <div>
        <Link className={styles.footerBrand} to="/"><span className={styles.brandMark}>{Array.from(name)[0]}</span>{name}</Link>
        <p>阅读、设计与作品。在真实世界里，把想法慢慢做出来。</p>
      </div>
      <div className={styles.footerLinks}>
        <Link to="/thoughts">想法</Link><Link to="/works">作品</Link><Link to="/resume">简历</Link><Link to="/chat">聊一聊<span aria-hidden="true">↗</span></Link>
      </div>
      <p className={styles.copyright}>© {new Date().getFullYear()} {name} · 用 React 与 Nest 搭的</p>
    </footer>

    <dialog ref={dialogRef} className={styles.reader} aria-labelledby="reader-title" onClose={() => setReading(null)} onClick={event => { if (event.target === dialogRef.current) dialogRef.current?.close() }}>
      {reading && <div className={styles.readerPanel}>
        <div className={styles.readerTop}><span>{reading.meta || '笔记'}</span><button type="button" onClick={() => dialogRef.current?.close()} aria-label="关闭">关闭 ✕</button></div>
        <h2 id="reader-title">{reading.title}</h2>
        <div className={styles.readerBody}><SiteMarkdown content={reading.content} theme="paper" /></div>
      </div>}
    </dialog>
  </div>
})
