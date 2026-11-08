import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { observer } from 'mobx-react-lite'
import { isSafeSiteUrl } from '../../api/site'
import { SiteLoginPanel } from '../../components/site-login'
import { useSiteEntryReady } from '../../components/site-entry'
import { SiteMusicPlayer } from '../../components/site-music'
import { SiteFluidBackground } from '../../components/site-fluid'
import { siteStore } from '../../store/site'
import type { SiteContent } from '../../types/site'
import { useSceneMotion } from './use-scene-motion'
import { useCapabilityTransition } from './use-capability-transition'
import { useOrbitOcclusion } from './use-orbit-occlusion'
import { CapabilityContent } from './capability-content'
import type { CapabilityPanelKind } from './capability-content'
import { CapabilityDetails } from './capability-details'
import { defaultSiteCapabilityDetails } from '../../config/site-capability-details'
import detailStyles from './capability-details.module.less'
import styles from './style.module.less'

type Panel = { kind: 'about' | 'contact' | CapabilityPanelKind } | null
type SiteExperienceProps = {
  content: SiteContent
  preview?: boolean
  loading?: boolean
  error?: string
  onRetry?: () => void
}

// 请求尚未完成时先呈现舞台，不把占位内容当作已发布的个人资料。
const welcomeContent: SiteContent = {
  profile: { name: '', tagline: '', bio: '' },
  home: { eyebrow: 'GOOD TO SEE YOU.', title: 'OH,\nHELLO.', subtitle: '来看看，这里藏着什么。', buttonLabel: '开始探索' },
  contact: { email: '', links: [] },
  appearance: { motion: true, character: 'classic' },
  music: { enabled: false, title: '', sourceUrl: '', volume: 25, loop: true },
  capabilities: { ai: [], frontend: [], backend: [], deployment: [] },
  capabilityDetails: defaultSiteCapabilityDetails(),
}

function readPanel(): Panel {
  const params = new URLSearchParams(window.location.search)
  const view = params.get('view')
  return view === 'about' || view === 'contact' || view === 'technology' || view === 'company' || view === 'projects' ? { kind: view } : null
}

function panelUrl(panel: Panel): string {
  const url = new URL(window.location.href)
  url.searchParams.delete('project')
  url.searchParams.delete('view')
  if (panel) url.searchParams.set('view', panel.kind)
  return `${url.pathname}${url.search}${url.hash}`
}

function Arrow({ direction = 'up' }: { direction?: 'up' | 'left' | 'right' | 'down' }) {
  const arrows = { up: '↗', left: '←', right: '→', down: '↓' }
  return <span aria-hidden="true" className={styles.arrow}>{arrows[direction]}</span>
}

function Character() {
  const [failed, setFailed] = useState(false)
  if (failed) return <div className={styles.characterFallback} aria-hidden="true"><span>HEY.</span><i /></div>
  return <img className={styles.heroCharacter} src="/site/hero-character.png" alt="" aria-hidden="true" loading="eager" {...{ fetchpriority: 'high' }} onError={() => setFailed(true)} />
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  const external = /^https?:\/\//i.test(href)
  return <a className={styles.paperLink} href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>{children}<Arrow /></a>
}

// oxlint-disable-next-line react/only-export-components -- MobX observer 包装的命名页面组件。
export const SitePage = observer(function SitePage() {
  useEffect(() => { void siteStore.load() }, [])
  return <SiteExperience content={siteStore.document?.content ?? welcomeContent} loading={siteStore.loading || (!siteStore.document && !siteStore.error)} error={siteStore.error} onRetry={() => void siteStore.load()} />
})

// oxlint-disable-next-line react/only-export-components -- 直接订阅共享草稿的字段，连续编辑时预览仍实时更新。
export const SiteExperience = observer(function SiteExperience({ content, preview = false, loading = false, error = '', onRetry }: SiteExperienceProps) {
  const instanceId = useId()
  const [historyOwner] = useState(() => crypto.randomUUID())
  const rootRef = useRef<HTMLDivElement>(null)
  const brandRef = useRef<HTMLButtonElement>(null)
  const heroStageRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const menuToggleRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const hasOriginRef = useRef(false)
  const detailOriginRef = useRef<{ x: number; y: number } | null>(null)
  const [panel, setPanel] = useState<Panel>(() => preview ? null : readPanel())
  const sceneControlRef = useRef<HTMLButtonElement>(null)
  const capabilityHeadingRef = useRef<HTMLHeadingElement>(null)
  const skipFocusRef = useRef(false)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const [capabilityReady, setCapabilityReady] = useState(false)
  const [capabilityFailed, setCapabilityFailed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const [previewPanelTop, setPreviewPanelTop] = useState(20)
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const contactLinks = content.contact.links.filter((link) => link.url && isSafeSiteUrl(link.url))
  const contactEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(content.contact.email) ? content.contact.email : ''
  const motionEnabled = content.appearance.motion && !reducedMotion
  const panelOpen = panel !== null

  const entering = useSiteEntryReady({ enabled: motionEnabled, ready: !loading, preview })

  const capability = useCapabilityTransition({ rootRef: heroStageRef, enabled: motionEnabled, paused: entering || panelOpen || loginOpen })
  useOrbitOcclusion(heroStageRef, motionEnabled)
  const capabilities = capability.scene === 1
  const requestedCapabilities = capability.targetScene === 1
  const showCapabilityPortrait = capabilityReady && !capabilityFailed
  const switching = capability.transitioning
  const switchCapabilities = (next: boolean) => {
    if (!next) skipFocusRef.current = false
    // Move focus out of content before it becomes inert; persistent controls keep keyboard context.
    if (heroStageRef.current?.contains(document.activeElement) && !sceneControlRef.current?.parentElement?.contains(document.activeElement)) sceneControlRef.current?.focus({ preventScroll: true })
    capability.goTo(next ? 1 : 0)
  }

  useEffect(() => {
    let disposed = false
    let settled = false
    const image = new Image()
    const settle = (failed: boolean) => {
      if (disposed || settled) return
      settled = true
      setCapabilityFailed(failed)
      setCapabilityReady(true)
      window.clearTimeout(deadline)
    }
    image.onload = () => { void image.decode().then(() => settle(false), () => settle(true)) }
    image.onerror = () => settle(true)
    const deadline = window.setTimeout(() => settle(true), 8000)
    image.srcset = '/site/capability-character-768.webp 768w, /site/capability-character.webp 1312w'
    image.sizes = '(max-width: 767px) 94vw, 65vw'
    image.src = '/site/capability-character.webp'
    return () => { disposed = true; image.onload = null; image.onerror = null; window.clearTimeout(deadline) }
  }, [])

  useSceneMotion({ rootRef, enabled: motionEnabled, paused: entering || panelOpen || loginOpen })

  const scrollHome = useCallback((instant = false) => {
    const root = rootRef.current
    if (!root) return
    const behavior = motionEnabled && !instant ? 'smooth' : 'auto'
    if (preview) root.scrollTo({ top: 0, behavior })
    else window.scrollTo({ top: root.getBoundingClientRect().top + window.scrollY, behavior })
    setMenuOpen(false)
  }, [motionEnabled, preview])

  useEffect(() => {
    if (!skipFocusRef.current || !capabilities || switching) return
    skipFocusRef.current = false
    capabilityHeadingRef.current?.focus({ preventScroll: true })
  }, [capabilities, switching])

  const restoreFocus = useCallback(() => {
    requestAnimationFrame(() => {
      const opener = returnFocusRef.current
      if (hasOriginRef.current && opener?.isConnected && opener.getClientRects().length) opener.focus({ preventScroll: true })
      // 手机菜单打开面板后已收起，隐藏的导航按钮不能接受焦点。
      else if (hasOriginRef.current && menuToggleRef.current?.getClientRects().length) menuToggleRef.current.focus({ preventScroll: true })
      else {
        scrollHome(true)
        brandRef.current?.focus({ preventScroll: true })
      }
    })
  }, [scrollHome])

  const closePanel = useCallback(() => {
    if (!preview && window.history.state?.sitePanelOwner === historyOwner) {
      window.history.back()
      return
    }
    if (!preview) window.history.replaceState(window.history.state, '', panelUrl(null))
    setPanel(null)
    restoreFocus()
  }, [historyOwner, preview, restoreFocus])

  function openPanel(next: Exclude<Panel, null>) {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    hasOriginRef.current = true
    const origin = returnFocusRef.current?.getBoundingClientRect()
    detailOriginRef.current = origin ? { x: origin.left + origin.width / 2, y: origin.top + origin.height / 2 } : null
    setMenuOpen(false)
    if (preview) setPreviewPanelTop((rootRef.current?.scrollTop ?? 0) + 20)
    if (!preview) window.history.pushState({ ...window.history.state, sitePanelOwner: historyOwner }, '', panelUrl(next))
    setPanel(next)
  }

  function openLogin() {
    if (preview) return
    setMenuOpen(false)
    setLoginOpen(true)
  }

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (preview) return
    const onPopState = () => {
      const next = readPanel()
      setPanel(next)
      if (!next) restoreFocus()
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [preview, restoreFocus])

  useEffect(() => {
    if (entering || !panelOpen || !dialogRef.current) return
    const dialog = dialogRef.current
    // 预览已在独立iframe内，原生模态仅约束iframe，父页仍可继续编辑草稿。
    dialog.showModal()
    if (detailOriginRef.current) {
      const bounds = dialog.getBoundingClientRect()
      dialog.style.setProperty('--detail-origin-x', `${detailOriginRef.current.x - bounds.left}px`)
      dialog.style.setProperty('--detail-origin-y', `${detailOriginRef.current.y - bounds.top}px`)
    }
    closeRef.current?.focus({ preventScroll: true })
    const oldOverflow = document.body.style.overflow
    if (!preview) document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      if (!preview) document.body.style.overflow = oldOverflow
    }
  }, [entering, panelOpen, preview])

  return <div ref={rootRef} className={`${styles.experience} ${preview ? styles.preview : ''} ${!motionEnabled ? styles.still : ''} ${loading || error ? styles.hasContentStatus : ''}`} onClickCapture={(event) => {
    // 预览用于浏览草稿，链接不能带着未保存的编辑离开配置页。
    if (preview && event.target instanceof Element && event.target.closest('a')) event.preventDefault()
  }}>
    <a className={styles.skipLink} href={`#${instanceId}-capabilities`} onClick={event => { event.preventDefault(); scrollHome(); switchCapabilities(true); if (capabilities && !switching) capabilityHeadingRef.current?.focus({ preventScroll: true }); else skipFocusRef.current = true }}>跳到我的能力</a>
    <header className={styles.header}>
      <button ref={brandRef} type="button" className={styles.brand} onClick={() => { scrollHome(); switchCapabilities(false) }} aria-label="返回初次见面">HEY<span>.</span></button>
      <nav className={`${styles.navigation} ${menuOpen ? styles.navigationOpen : ''}`} aria-label="主导航">
        <button type="button" aria-current={!requestedCapabilities ? 'page' : undefined} onClick={() => { scrollHome(); switchCapabilities(false) }}>初次见面</button>
        <button type="button" aria-current={requestedCapabilities ? 'page' : undefined} onClick={() => { scrollHome(); switchCapabilities(true) }}>我的能力</button>
        <button type="button" onClick={() => openPanel({ kind: 'about' })}>关于我</button>
        <button type="button" className={styles.mobileContact} onClick={() => openPanel({ kind: 'contact' })}>联系我 <Arrow /></button>
        <button type="button" className={styles.mobileOwner} disabled={preview} title={preview ? '预览中不可登录' : undefined} onClick={openLogin}>进入空间 <span aria-hidden="true">↗</span>{preview && <small>预览中不可登录</small>}</button>
      </nav>
      <div className={styles.headerActions}><button type="button" className={styles.contactNav} onClick={() => openPanel({ kind: 'contact' })}>联系我 <Arrow /></button><button type="button" className={styles.ownerEntry} data-site-login-trigger disabled={preview} title={preview ? '预览中不可登录' : undefined} onClick={openLogin}>进入空间 <span aria-hidden="true">↗</span></button></div>
      <button ref={menuToggleRef} data-site-login-trigger type="button" className={styles.menuToggle} aria-label={menuOpen ? '关闭导航' : '打开导航'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? '×' : <><span /><span /></>}</button>
    </header>

    {(loading || error) && <div className={styles.contentStatus} role={error ? 'alert' : 'status'}>
      <div><strong>{error ? '内容暂时无法读取' : '正在加载网站内容'}</strong>{error && <p>{error}</p>}</div>
      {error && onRetry && <button type="button" disabled={loading} onClick={onRetry}>{loading ? '重试中…' : '重新加载'} <Arrow /></button>}
    </div>}

    <main>
      <section className={styles.hero} aria-label="个人介绍与我的能力">
        <div ref={heroStageRef} className={styles.heroStage} data-capability-scene={capability.scene} data-entry-ready={!entering} data-welcome-running={motionEnabled && !entering && !panelOpen && !loginOpen && !capabilities && !switching} data-orbit-running={motionEnabled && !entering && !panelOpen && !loginOpen && capabilities && !switching} aria-busy={switching} onTouchStart={event => {
          const target = event.target as Element
          if (target.closest('[data-capability-cards], button, a') || event.touches.length !== 1) { touchStart.current = null; return }
          touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }
        }} onTouchCancel={() => { touchStart.current = null }} onTouchEnd={event => {
          if (!touchStart.current) return
          const dx = event.changedTouches[0].clientX - touchStart.current.x
          const dy = event.changedTouches[0].clientY - touchStart.current.y
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) switchCapabilities(dx < 0)
          touchStart.current = null
        }}>
          <div className={styles.studioEnvironment} aria-hidden="true" />
          <div className={styles.stageGlow} aria-hidden="true" />
          <SiteFluidBackground containerRef={heroStageRef} enabled={motionEnabled && !entering && !preview && !panelOpen && !loginOpen} />
          <div className={styles.stageAtmosphere} aria-hidden="true"><i /><i /><i /><i /></div>
          <div className={styles.heroCopy}><div data-capability-motion="welcome" ref={node => { node?.toggleAttribute('inert', capabilities || switching) }}>
            <p className={styles.eyebrow}>{content.home.eyebrow}</p>
            <h1 id={`${instanceId}-hello`} className={`${styles.heroTitle} ${Array.from(content.home.title).length > 18 ? styles.longTitle : ''}`}>{/^OH,\s*HELLO\.$/.test(content.home.title) ? 'OH,\nHELLO.' : content.home.title}</h1>
            <p className={styles.heroSubtitle}>{content.home.subtitle}</p>
            <button type="button" className={styles.exploreButton} onClick={() => switchCapabilities(true)} >{content.home.buttonLabel}<span><Arrow direction="right" /></span></button>
          </div>
          </div>
          <div className={styles.heroPortrait}><div className={styles.wavingPortrait} data-capability-motion="wave"><Character /></div></div>
          <div className={styles.capabilityScene} ref={node => { node?.toggleAttribute('inert', !capabilities || switching) }} aria-hidden={!capabilities || switching}>
            <div className={styles.capabilityLight} data-capability-motion="light" aria-hidden="true" />
            <div className={styles.capabilityCopy} data-capability-motion="copy"><p className={styles.eyebrow}>MY CAPABILITIES.</p><h2 ref={capabilityHeadingRef} tabIndex={-1} id={`${instanceId}-capabilities`}>我的能力</h2><h3>AI 驱动的全栈开发者</h3><p>融合 AI 与工程能力，关注从需求分析、前后端开发到部署落地的完整实现过程。</p></div>
            <svg className={styles.capabilityOrbit} data-orbit-overlay aria-hidden="true" focusable="false">
              <defs>
                <filter id={`${instanceId}-orbit-silhouette`} colorInterpolationFilters="sRGB">
                  <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" />
                </filter>
                <mask id={`${instanceId}-orbit-mask`} maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%" style={{ maskType: 'luminance' }}>
                  <rect width="100%" height="100%" fill="white" />
                  <g className={styles.orbitPersonOcclusion} data-orbit-person-cutout data-capability-motion="portrait" filter={`url(#${instanceId}-orbit-silhouette)`}>
                    <image data-orbit-person-mask href={showCapabilityPortrait ? '/site/capability-character.webp' : '/site/hero-character.png'} preserveAspectRatio="xMidYMax" />
                  </g>
                  {[0, 1, 2].map(index => <g key={index} className={styles.orbitCardWindow} data-capability-motion="card-window" />)}
                </mask>
              </defs>
              <g mask={`url(#${instanceId}-orbit-mask)`}>
                <g className={styles.orbitMotion} data-capability-motion="orbit">
                  <svg className={styles.orbitRings} width="100%" height="100%" viewBox="0 0 1000 1000" preserveAspectRatio="none">
                    <ellipse className={styles.orbitRing} cx="500" cy="500" rx="498" ry="248" />
                    <ellipse className={`${styles.orbitRing} ${styles.orbitRingMiddle}`} cx="500" cy="500" rx="408.36" ry="203.36" />
                    <ellipse className={`${styles.orbitRing} ${styles.orbitRingInner}`} cx="500" cy="500" rx="334.8552" ry="166.7552" />
                  </svg>
                </g>
              </g>
            </svg>
            <div className={`${styles.capabilityPortrait} ${capabilityFailed ? styles.capabilityFallback : ''}`} data-capability-portrait data-capability-motion="portrait">
              {!showCapabilityPortrait ? <Character /> : <img src="/site/capability-character.webp" srcSet="/site/capability-character-768.webp 768w, /site/capability-character.webp 1312w" sizes="(max-width: 767px) 94vw, 65vw" alt="戴圆框眼镜的开发者坐在 MacBook 前" decoding="async" onError={() => { setCapabilityFailed(true); setCapabilityReady(true) }} />}
            </div>
            <CapabilityContent disabled={!capabilities || switching} content={content} onOpen={kind => openPanel({ kind })} />
          </div>
          <span className={styles.stageSpark} data-capability-motion="welcome" aria-hidden="true"><span className={styles.sparkMotion}>✳</span></span>
          <button type="button" data-capability-motion="discover" tabIndex={capabilities || switching ? -1 : 0} aria-hidden={capabilities || switching} className={styles.discover} onClick={() => switchCapabilities(true)}><span>探索我的能力</span><Arrow direction="down" /></button>
          <div className={styles.sceneFooter}>
            <div className={`${styles.sceneProgress} ${styles.heroProgress}`} role="group" aria-label="切换首页场景">
              <button type="button" aria-pressed={!requestedCapabilities} onClick={() => switchCapabilities(false)} aria-label="切换到初次见面"><span /></button>
              <button ref={sceneControlRef} type="button" aria-pressed={requestedCapabilities} onClick={() => switchCapabilities(true)} aria-label="切换到我的能力"><span /></button>
              <p aria-hidden="true">{requestedCapabilities ? '02' : '01'} <span>/ 02</span></p>
            </div>
            <span className={styles.sceneAnnouncement} role="status">{switching ? requestedCapabilities ? '正在切换到我的能力' : '正在返回初次见面' : capabilities ? '02 / 02 我的能力' : '01 / 02 初次见面'}</span>
            <span className={styles.footerRule} />
          </div>
        </div>
      </section>

    </main>

    {panel && <dialog ref={dialogRef} data-kind={panel.kind} className={panel.kind === 'about' || panel.kind === 'contact' ? styles.readingDialog : detailStyles.dialog} style={preview && (panel.kind === 'about' || panel.kind === 'contact') ? { top: previewPanelTop } : undefined} aria-labelledby={`${instanceId}-panel-title`} onCancel={(event) => { event.preventDefault(); closePanel() }} onKeyDown={(event) => { if (preview && event.key === 'Escape') { event.preventDefault(); closePanel() } }} onClick={(event) => {
      if (event.target !== event.currentTarget) return
      const bounds = event.currentTarget.getBoundingClientRect()
      // 实底详情的padding也是阅读区，只有真正位于外部的背景点击才关闭。
      if (panel.kind === 'about' || panel.kind === 'contact' || event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closePanel()
    }}>
      {panel.kind !== 'about' && panel.kind !== 'contact' ? <><button ref={closeRef} type="button" className={detailStyles.close} aria-label="关闭能力详情" onClick={closePanel}>×</button>{content === welcomeContent && (loading || error) ? <div className={detailStyles.empty} role={error ? 'alert' : 'status'}><h2 id={`${instanceId}-panel-title`}>{error ? '内容暂时无法读取' : '正在打开这份内容'}</h2><p>{error || '请稍等，内容正在加载。'}</p>{error && onRetry && <button type="button" className={detailStyles.retry} disabled={loading} onClick={onRetry}>{loading ? '重试中…' : '重新加载'} ↗</button>}</div> : <CapabilityDetails key={panel.kind} kind={panel.kind} content={content} titleId={`${instanceId}-panel-title`} />}</> : <article className={styles.readingPaper}>
        <header className={styles.readingHeader}><button ref={closeRef} type="button" onClick={closePanel}><Arrow direction="left" />返回浏览</button><button type="button" className={styles.closeButton} aria-label="关闭阅读面板" onClick={closePanel}>×</button></header>
        <div className={styles.readingBody}>
          {content === welcomeContent && (loading || error) ? <div className={styles.readingEmpty} role={error ? 'alert' : 'status'}><h2 id={`${instanceId}-panel-title`}>{error ? '内容暂时无法读取' : '正在打开这份内容'}</h2><p>{error || '请稍等，内容正在加载。'}</p>{error && onRetry && <button type="button" className={styles.paperLink} disabled={loading} onClick={onRetry}>{loading ? '重试中…' : '重新加载'} <Arrow /></button>}</div> : panel.kind === 'about' ? <div className={styles.personalPanel}><p className={styles.paperEyebrow}>A LITTLE ABOUT ME</p><h2 id={`${instanceId}-panel-title`}>{content.profile.name ? `你好，我是${content.profile.name}` : '很高兴认识你'}</h2>{content.profile.tagline && <p className={styles.personalTagline}>{content.profile.tagline}</p>}<div className={styles.personalBio}>{content.profile.bio ? <p>{content.profile.bio}</p> : <p className={styles.quietText}>个人介绍还未公开。欢迎了解我的能力。</p>}</div><button type="button" className={styles.paperLink} onClick={closePanel}>继续探索 <Arrow /></button></div> : <div className={styles.personalPanel}><p className={styles.paperEyebrow}>LET’S KEEP IN TOUCH</p><h2 id={`${instanceId}-panel-title`}>让对话，从这里开始。</h2>{contactEmail || contactLinks.length ? <div className={styles.contactLinks}>{contactEmail && <a className={styles.emailLink} href={`mailto:${contactEmail}`}>{contactEmail}<Arrow /></a>}{contactLinks.map((link, index) => <ExternalLink key={`${link.url}-${index}`} href={link.url}>{link.label}</ExternalLink>)}</div> : <p className={styles.quietText}>暂未公开联系方式，感谢你的来访。</p>}</div>}
        </div>
        <footer className={styles.paperSignature}><span>HEY.</span><i aria-hidden="true">✳</i></footer>
      </article>}
    </dialog>}
    <div className={styles.texture} aria-hidden="true" style={{ '--texture-opacity': preview ? '.065' : '.09' } as CSSProperties} />
    <SiteLoginPanel open={loginOpen && !preview} onClose={() => setLoginOpen(false)} reducedMotion={!motionEnabled} />
    {!preview && <div className={styles.utilityDock}>
      <SiteMusicPlayer music={content.music ?? welcomeContent.music} reducedMotion={!motionEnabled} obscured={panelOpen || loginOpen} />
    </div>}
  </div>
})

export default SitePage
