import { observer } from 'mobx-react-lite'
import { capabilityIconUrl } from '../../config/site-capabilities'
import type { SiteContent } from '../../types/site'
import styles from './capability-content.module.less'

export type CapabilityPanelKind = 'technology' | 'company' | 'projects'
type Props = { disabled: boolean; content: SiteContent; onOpen: (kind: CapabilityPanelKind) => void }

export function CapabilityIcon({ kind }: { kind: CapabilityPanelKind }) {
  return <svg viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind === 'technology' ? <><path d="m10 9-7 7 7 7m12-14 7 7-7 7M19 5l-6 22" /></> : kind === 'company' ? <><path d="M4 28h24M7 28V9h10v19M17 28V4h8v24M11 13h2m-2 5h2m-2 5h2M20 9h2m-2 5h2m-2 5h2m-2 5h2" /></> : <><path d="m16 3 13 7-13 7L3 10Zm-13 14 13 7 13-7M3 24l13 7 13-7" /></>}</svg>
}

// oxlint-disable-next-line react/only-export-components -- 订阅草稿，卡片摘要和弹窗共享同一份内容。
export const CapabilityContent = observer(function CapabilityContent({ disabled, content, onOpen }: Props) {
  const details = content.capabilityDetails
  const projectCount = details.projects.filter(project => project.visible).length
  const cards: { kind: CapabilityPanelKind; title: string; subtitle: string; description: string; footer: string }[] = [
    { kind: 'technology', title: '技术栈', subtitle: 'AI 全栈开发', description: '融合前端、后端、AI 与部署能力，构建从想法到交付的完整产品。', footer: '' },
    { kind: 'company', title: '公司背景', subtitle: '业务与成长', description: details.company.summary || '了解业务方向、产品场景，以及我在团队中的职责与积累。', footer: details.company.name },
    { kind: 'projects', title: '公司项目', subtitle: '工程实践', description: '从业务背景到技术方案，记录真实项目中的思考、实现与个人贡献。', footer: projectCount ? `${projectCount} 个项目` : '' },
  ]
  const icons = [...content.capabilities.frontend, ...content.capabilities.backend, ...content.capabilities.deployment].slice(0, 3)
  return <div className={styles.cards} data-capability-cards aria-hidden={disabled} ref={node => { node?.toggleAttribute('inert', disabled) }} onTouchStart={event => event.stopPropagation()} onTouchEnd={event => event.stopPropagation()}>
    {cards.map((card, index) => <div key={card.kind} className={`${styles.cardMotion} ${styles[card.kind]}`} data-capability-motion="card">
      <button type="button" className={styles.card} disabled={disabled} aria-label={`${card.title} · ${card.subtitle}`} aria-haspopup="dialog" onClick={() => onOpen(card.kind)}>
        <span className={styles.topline}><CapabilityIcon kind={card.kind} /><span>0{index + 1}</span></span>
        <strong>{card.title}</strong><span className={styles.subtitle}>{card.subtitle}</span>
        <span className={styles.description}>{card.description}</span>
        <span className={styles.cardFooter}>{card.kind === 'technology' && icons.length ? <span className={styles.logos} aria-hidden="true">{icons.map(tech => <img key={tech.icon} src={capabilityIconUrl(tech.icon)} alt="" width="24" height="24" />)}</span> : card.footer ? <span className={styles.note}>{card.footer}</span> : null}<span className={styles.arrow} aria-hidden="true">↗</span></span>
      </button>
    </div>)}
  </div>
})
