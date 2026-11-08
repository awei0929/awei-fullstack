import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import { Select, Tabs } from 'antd'
import { observer } from 'mobx-react-lite'
import { siteAdminStore as store } from '../../store/site-admin'
import { CAPABILITY_CATALOG, CAPABILITY_CATEGORIES, MAX_CAPABILITIES_PER_CATEGORY, capabilityIconUrl } from '../../config/site-capabilities'
import type { SiteCapabilityCategory } from '../../types/site'
import type { CapabilityEditorTab } from './sections'
import { Group, TextField } from './fields'
import { CapabilityDetailsEditor } from './capability-details-editor'
import styles from './capabilities-editor.module.less'

type CapabilityOption = { value: string; label: ReactNode; searchText: string; disabled: boolean }

// oxlint-disable-next-line react/only-export-components -- 各分类直接编辑同一份 MobX 草稿。
const CategoryEditor = observer(function CategoryEditor({ category }: { category: SiteCapabilityCategory }) {
  const id = useId()
  const [pendingIcon, setPendingIcon] = useState<string | undefined>()
  const items = store.draft!.capabilities[category]
  const categoryLabel = CAPABILITY_CATEGORIES.find(item => item.id === category)!.label
  const usedIcons = new Set(items.map(item => item.icon))
  const full = items.length >= MAX_CAPABILITIES_PER_CATEGORY
  const options = (currentIcon?: string): CapabilityOption[] => [
    ...CAPABILITY_CATALOG.filter(item => item.category === category),
    ...CAPABILITY_CATALOG.filter(item => item.category !== category),
  ].map(item => {
    const label = CAPABILITY_CATEGORIES.find(group => group.id === item.category)!.label
    return {
      value: item.icon,
      disabled: item.icon !== currentIcon && usedIcons.has(item.icon),
      searchText: `${item.name} ${item.icon} ${label}`,
      label: <span className={styles.option}><img src={capabilityIconUrl(item.icon)} alt="" width="20" height="20" /><span>{item.name}<small>{item.category === category ? '本类推荐' : label}</small></span></span>,
    }
  })
  const filterOption = (input: string, option?: CapabilityOption) => Boolean(option?.searchText.toLowerCase().includes(input.trim().toLowerCase()))
  const changeIcon = (index: number, icon: string) => store.edit(draft => {
    const list = draft.capabilities[category]
    const item = list[index]
    const next = CAPABILITY_CATALOG.find(entry => entry.icon === icon)
    if (!item || !next || list.some((entry, position) => position !== index && entry.icon === icon)) return
    const previous = CAPABILITY_CATALOG.find(entry => entry.icon === item.icon)
    if (item.name === previous?.name) item.name = next.name
    item.icon = icon
  })
  const move = (index: number, offset: -1 | 1) => store.edit(draft => {
    const list = draft.capabilities[category]
    const destination = index + offset
    if (index < 0 || index >= list.length || destination < 0 || destination >= list.length) return
    const [item] = list.splice(index, 1)
    list.splice(destination, 0, item)
  })
  const add = () => {
    store.edit(draft => {
      const list = draft.capabilities[category]
      const selected = CAPABILITY_CATALOG.find(item => item.icon === pendingIcon)
      if (!selected || list.length >= MAX_CAPABILITIES_PER_CATEGORY || list.some(item => item.icon === selected.icon)) return
      list.push({ icon: selected.icon, name: selected.name })
    })
    if (store.canEdit) setPendingIcon(undefined)
  }
  return <section className={styles.category} aria-label={`${categoryLabel}能力配置`}>
    <div className={styles.categoryHeading}><p>按这里的顺序展示在官网。</p><span>{items.length} / {MAX_CAPABILITIES_PER_CATEGORY}</span></div>
    {!items.length && <p className={styles.empty}>暂未配置。选择一项你想展示的能力，从这里开始。</p>}
    <ol className={styles.list}>{items.map((item, index) => {
      const iconId = `${id}-${index}-icon`
      const nameId = `${id}-${index}-name`
      const hintId = `${id}-${index}-hint`
      return <li className={styles.item} key={item.icon}>
        <div className={styles.itemHeading}><strong>能力 {String(index + 1).padStart(2, '0')}</strong><div className={styles.actions}>
          <button type="button" aria-label={`上移${item.name}`} disabled={!store.canEdit || index === 0} onClick={() => move(index, -1)}>↑</button>
          <button type="button" aria-label={`下移${item.name}`} disabled={!store.canEdit || index === items.length - 1} onClick={() => move(index, 1)}>↓</button>
          <button type="button" className={styles.remove} aria-label={`删除${item.name}`} disabled={!store.canEdit} onClick={() => store.edit(draft => { draft.capabilities[category].splice(index, 1) })}>删除</button>
        </div></div>
        <div className={styles.field}><label htmlFor={iconId}>技术图标</label><Select<string, CapabilityOption> id={iconId} value={item.icon} options={options(item.icon)} showSearch filterOption={filterOption} disabled={!store.canEdit} onChange={icon => changeIcon(index, icon)} popupMatchSelectWidth={false} classNames={{ popup: { root: styles.popup } }} /></div>
        <div className={styles.field}><label htmlFor={nameId}>展示昵称</label><input id={nameId} data-capability-name={`${category}-${index}`} value={item.name} required pattern=".*\S.*" disabled={!store.canEdit} aria-describedby={hintId} aria-invalid={!item.name.trim() || Array.from(item.name).length > 40} onChange={event => store.edit(draft => { const target = draft.capabilities[category][index]; if (target) target.name = Array.from(event.target.value).slice(0, 40).join('') })} /><small id={hintId}>{Array.from(item.name).length} / 40 字{!item.name.trim() || Array.from(item.name).length > 40 ? ' · 请填写 1–40 字非空白昵称' : ''}</small></div>
      </li>
    })}</ol>
    <div className={styles.addArea}>
      <label htmlFor={`${id}-add`}>添加到{categoryLabel}</label>
      <Select<string, CapabilityOption> id={`${id}-add`} value={pendingIcon} placeholder="搜索技术或工具" options={options()} showSearch filterOption={filterOption} disabled={!store.canEdit || full} onChange={setPendingIcon} popupMatchSelectWidth={false} classNames={{ popup: { root: styles.popup } }} />
      <button type="button" className={styles.addButton} disabled={!store.canEdit || full || !pendingIcon || usedIcons.has(pendingIcon)} onClick={add}>＋ 添加能力</button>
      <p className={styles.hint}>{full ? `本类已达 ${MAX_CAPABILITIES_PER_CATEGORY} 项，删除一项后可继续添加。` : '优先显示本类推荐，也可搜索其他类别；已使用图标不能重复添加。'}</p>
    </div>
  </section>
})

export const CapabilitiesEditor = observer(function CapabilitiesEditor({ tab, onTabChange, category, onCategoryChange, projectId, onProjectChange }: { tab: CapabilityEditorTab; onTabChange: (tab: CapabilityEditorTab) => void; category: SiteCapabilityCategory; onCategoryChange: (category: SiteCapabilityCategory) => void; projectId: string | null; onProjectChange: (id: string | null) => void }) {
  return <Group title="我的能力" description="整理愿意公开展示的技术、公司背景与工程经历；保存全部后统一更新官网。">
    <Tabs className={styles.tabs} size="small" activeKey={tab} animated={false} onChange={key => { if (key === 'technology' || key === 'company' || key === 'projects') onTabChange(key) }} items={[
      { key: 'technology', label: '技术栈', forceRender: true, children: <>
        <TextField label="技术介绍" value={store.draft!.capabilityDetails.technology.introduction} onChange={value => store.edit(draft => { draft.capabilityDetails.technology.introduction = value })} maxLength={2000} multiline rows={4} hint="出现在技术栈详情顶部。以下四类能力保留各自的图标、昵称与顺序，每类最多 12 项。" />
        <Tabs className={styles.tabs} size="small" activeKey={category} animated={false} onChange={key => { const selected = CAPABILITY_CATEGORIES.find(item => item.id === key); if (selected) onCategoryChange(selected.id) }} items={CAPABILITY_CATEGORIES.map(item => ({ key: item.id, label: item.label, forceRender: true, children: <CategoryEditor category={item.id} /> }))} />
      </> },
      { key: 'company', label: '公司背景', forceRender: true, children: <CapabilityDetailsEditor section="company" /> },
      { key: 'projects', label: '公司项目', forceRender: true, children: <CapabilityDetailsEditor section="projects" projectId={projectId} onProjectChange={onProjectChange} /> },
    ]} />
  </Group>
})
