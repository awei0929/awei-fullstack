import { useEffect, useRef, useState } from 'react'
import { Link, useBlocker } from 'react-router-dom'
import { Alert, Button, ConfigProvider, Form, Input, Modal, Spin, theme } from 'antd'
import { observer } from 'mobx-react-lite'
import { authStore } from '../../store/auth'
import { siteAdminStore as store } from '../../store/site-admin'
import { hasValidPasswordLength } from '../../utils/auth-validation'
import type { AuthInput } from '../../types/auth'
import type { SiteCapabilityCategory } from '../../types/site'
import { CAPABILITY_CATEGORIES } from '../../config/site-capabilities'
import { isSafeSiteUrl } from '../../api/site'
import { SitePreview as Preview } from './site-preview'
import { Editors } from './editors'
import { ChatPanel } from './chat-panel'
import { sections } from './sections'
import type { CapabilityEditorTab, Section } from './sections'
import { Icon } from './fields'
import styles from './style.module.less'

// oxlint-disable-next-line react/only-export-components -- MobX observer 包装的私有登录组件。
const Login = observer(function Login() {
  const [form] = Form.useForm<AuthInput>()
  return <>
    <p className={styles.smallEyebrow}>YOUR LITTLE CORNER</p>
    <h1>站主登录</h1><p className={styles.loginDescription}>欢迎回来。继续打理你的小小世界。</p>
    {authStore.loginPromptVersion > 0 && <Alert type="info" title="登录已过期，请重新登录。同一账号的未保存草稿会保留。" showIcon className={styles.alert} />}
    {authStore.authError && <Alert type="error" title={authStore.authError} showIcon className={styles.alert} />}
    <Form form={form} layout="vertical" requiredMark={false} disabled={authStore.submitting || authStore.loggingOut} onValuesChange={authStore.clearAuthError} onFinish={async (values: AuthInput) => { if (await authStore.authenticate('login', values)) form.resetFields() }}>
      <Form.Item label="账号" name="account" rules={[{ required: true, message: '请输入账号' }, { pattern: /^[0-9]{3,5}$/, message: '账号须为 3–5 位数字' }]}><Input autoComplete="username" inputMode="numeric" size="large" placeholder="输入站主账号" /></Form.Item>
      <Form.Item label="密码" name="password" rules={[{ required: true, message: '请输入密码' }, { validator: (_, value: string) => !value || hasValidPasswordLength(value) ? Promise.resolve() : Promise.reject(new Error('密码须为 8–64 个字符')) }]}><Input.Password autoComplete="current-password" size="large" placeholder="输入密码" /></Form.Item>
      <Button type="primary" htmlType="submit" size="large" block loading={authStore.submitting} disabled={authStore.loggingOut}>登录</Button>
    </Form>
    <Link to="/" className={styles.returnLink}>↗ 返回官网</Link>
  </>
})

export const AdminPage = observer(function AdminPage() {
  const [section, setSection] = useState<Section>('home')
  const [capabilityTab, setCapabilityTab] = useState<CapabilityEditorTab>('technology')
  const [capabilityCategory, setCapabilityCategory] = useState<SiteCapabilityCategory>('ai')
  const [capabilityFocus, setCapabilityFocus] = useState<{ category: SiteCapabilityCategory; index: number } | null>(null)
  const [companyProjectId, setCompanyProjectId] = useState<string | null>(null)
  const [companyProjectFocus, setCompanyProjectFocus] = useState<{ id: string; field: 'name' | 'cover' } | null>(null)
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [mobilePanel, setMobilePanel] = useState<'editor' | 'preview'>('editor')
  const [confirm, setConfirm] = useState<{ kind: 'logout' | 'latest' } | null>(null)
  const [latestOpen, setLatestOpen] = useState(false)
  const [conflictOpen, setConflictOpen] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const blocker = useBlocker(({ currentLocation, nextLocation }) => (store.dirty || store.busy) && currentLocation.pathname !== nextLocation.pathname)
  const activeSection = sections.find((item) => item.id === section)!
  const conflict = store.conflict
  const user = authStore.user
  const status = store.status
  const identityVersion = authStore.identityVersion

  useEffect(() => {
    store.activate()
    void authStore.restoreSession()
    return () => store.deactivate()
  }, [])
  useEffect(() => {
    const handle = (event: BeforeUnloadEvent) => { if (store.dirty || store.busy) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', handle)
    return () => window.removeEventListener('beforeunload', handle)
  }, [])
  useEffect(() => { if (conflict && user && status === 'ready') setConflictOpen(true) }, [conflict, user, status])
  useEffect(() => {
    if (!user || status !== 'ready') { setLatestOpen(false); setConflictOpen(false); setConfirm(null) }
  }, [identityVersion, user, status])
  useEffect(() => {
    if (!capabilityFocus) return
    const frame = requestAnimationFrame(() => {
      const input = formRef.current?.querySelector<HTMLInputElement>(`input[data-capability-name="${capabilityFocus.category}-${capabilityFocus.index}"]`)
      input?.focus()
      input?.reportValidity()
    })
    return () => cancelAnimationFrame(frame)
  }, [capabilityFocus])
  useEffect(() => {
    if (!companyProjectFocus) return
    const frame = requestAnimationFrame(() => {
      const input = formRef.current?.querySelector<HTMLInputElement>(`input[data-company-project-${companyProjectFocus.field}="${companyProjectFocus.id}"]`)
      if (!input) return
      input.setCustomValidity(companyProjectFocus.field === 'cover' && !isSafeSiteUrl(input.value, 'image') ? '请填写安全的 HTTP/HTTPS 图片地址或已有本站图片路径。' : '')
      input.focus()
      input.reportValidity()
    })
    return () => cancelAnimationFrame(frame)
  }, [companyProjectFocus])

  async function logout() {
    if (store.busy) return
    if (store.dirty) setConfirm({ kind: 'logout' })
    else await authStore.logout()
  }
  async function showLatest() {
    setConflictOpen(false)
    setLatestOpen(true)
    await store.checkLatest()
  }
  async function confirmAction() {
    if (!confirm || store.busy) return
    if (confirm.kind === 'logout') {
      if (await authStore.logout()) setConfirm(null)
    } else {
      store.useLatest()
      setConfirm(null)
      setLatestOpen(false)
    }
  }
  function saveAll() {
    for (const category of CAPABILITY_CATEGORIES) {
      const index = store.draft?.capabilities[category.id].findIndex(item => !item.name.trim() || Array.from(item.name).length > 40) ?? -1
      if (index >= 0) {
        setSection('capabilities')
        setCapabilityTab('technology')
        setCapabilityCategory(category.id)
        setMobilePanel('editor')
        setCapabilityFocus({ category: category.id, index })
        return
      }
    }
    for (const project of store.draft?.capabilityDetails.projects ?? []) {
      const field = !project.name.trim() || Array.from(project.name).length > 80 ? 'name' : !isSafeSiteUrl(project.coverUrl, 'image') ? 'cover' : null
      if (field) {
        setSection('capabilities')
        setCapabilityTab('projects')
        setCompanyProjectId(project.id)
        setMobilePanel('editor')
        setCompanyProjectFocus({ id: project.id, field })
        return
      }
    }
    if (!formRef.current?.checkValidity()) {
      setMobilePanel('editor')
      requestAnimationFrame(() => formRef.current?.reportValidity())
      return
    }
    void store.save()
  }
  const authorized = authStore.ready && authStore.user && store.status === 'ready' && store.draft
  return <ConfigProvider theme={{ algorithm: theme.darkAlgorithm, token: { colorPrimary: '#ed791b', colorBgBase: '#292a21', colorText: '#f6ecd8', colorBorder: '#6d6954', borderRadius: 10, fontFamily: 'inherit' } }}>
    {!authorized ? <main className={styles.gate}>
      <Link className={styles.gateBrand} to="/">HEY.<span>创作后台</span></Link>
      <div className={styles.gateArt}><span>MAKE<br />YOURSELF<br />AT HOME.</span><img src="/site/hero-character.png" alt="圆框眼镜角色向你打招呼" /></div>
      <div className={styles.gateCard}>
        {authStore.status === 'idle' || authStore.status === 'loading' ? <div className={styles.loading}><Spin size="large" /><h1>正在恢复登录状态</h1></div>
          : authStore.status === 'error' ? <><p className={styles.smallEyebrow}>ONE MORE TRY</p><h1>暂时无法连接</h1><p role="alert">{authStore.restoreError}</p><Button size="large" type="primary" onClick={() => void authStore.restoreSession()}>重新连接</Button><Link className={styles.returnLink} to="/">返回官网</Link></>
            : !authStore.user ? <Login />
              : store.status === 'forbidden' ? <><div className={styles.noticeIcon}>!</div><h1>此账号无管理权限</h1><p>{store.loadError}</p><p className={styles.hint}>请使用站主账号登录。</p>{authStore.logoutError && <Alert type="error" title={authStore.logoutError} className={styles.alert} />}<Button type="primary" size="large" loading={authStore.loggingOut} onClick={() => void authStore.logout()}>⇄ 切换账号</Button><Link to="/" className={styles.returnLink}>↗ 返回官网</Link></>
                : store.status === 'error' ? <><p className={styles.smallEyebrow}>ONE MORE TRY</p><h1>配置加载失败</h1><p role="alert">{store.loadError}</p><Button size="large" type="primary" onClick={() => void store.load()}>重新加载</Button><Link className={styles.returnLink} to="/">返回官网</Link></>
                  : <div className={styles.loading}><Spin size="large" /><h1>正在打开你的工作台</h1><p>检查权限，读取最新内容。</p></div>}
      </div>
      <span className={styles.gateFooter}>A SPACE THAT FEELS LIKE YOU.</span>
    </main> : <div className={`${styles.admin} ${section === 'chat' ? styles.chatAdmin : ''}`}>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} to="/">HEY.<span>创作后台</span></Link>
        <nav aria-label="配置分区">{sections.map((item) => <button key={item.id} type="button" aria-current={section === item.id ? 'page' : undefined} className={`${styles.navItem} ${section === item.id ? styles.active : ''}`} onClick={() => { setSection(item.id); setMobilePanel('editor') }}><Icon name={item.id} /><span>{item.label}</span>{section === item.id && <i />}</button>)}</nav>
        <div className={styles.owner}><img src="/site/hero-character.png" alt="" /><div><strong>站主</strong><small><i /> 已登录</small></div><button type="button" onClick={() => void logout()} disabled={store.busy}>退出</button></div>
        <Link to="/" className={styles.sidebarReturn}>返回网站 ↗</Link>
      </aside>
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.pageTitle}><span className={styles.mobileBrand}>HEY.</span><h1>{activeSection.label}</h1><p>{activeSection.subtitle}</p></div>
          <div className={styles.headerActions}>{section !== 'chat' && <span className={`${styles.dirty} ${store.dirty ? styles.hasChanges : ''}`}><i />{store.dirty ? '官网草稿未保存' : `已保存 · v${store.document?.version}`}</span>}{section === 'chat' ? <button type="button" className={styles.outlineButton} onClick={() => setSection('home')}>返回官网编辑</button> : <><a href="/" target="_blank" rel="noopener noreferrer" className={styles.outlineButton}>查看已更新官网 ↗</a><button type="button" className={styles.primaryButton} disabled={!store.canEdit || !store.dirty || store.outcomeUnknown} onClick={saveAll}>{store.saving ? '正在保存…' : '保存全部并更新官网'}</button></>}</div>
        </header>
        <div className={styles.mobileControls}><label>当前分区<select value={section} onChange={(event) => { setSection(event.target.value as Section); setMobilePanel('editor') }}>{sections.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>{section === 'chat' && <div className={styles.mobileChatLinks}><button type="button" disabled={store.busy} onClick={() => void logout()}>退出</button><Link to="/" aria-label="返回官网">官网 ↗</Link></div>}{section !== 'chat' && <div className={styles.segmented}><button type="button" aria-pressed={mobilePanel === 'editor'} onClick={() => setMobilePanel('editor')}>编辑</button><button type="button" aria-pressed={mobilePanel === 'preview'} onClick={() => { setDevice('mobile'); setMobilePanel('preview') }}>预览</button></div>}</div>
        {section === 'chat' && store.dirty && <p className={styles.chatDraftNotice}>官网草稿未保存，已为你保留</p>}
        {((section !== 'chat' && (store.saveError || store.notice)) || authStore.logoutError) && <div className={styles.statusMessages} aria-live="polite">
          {section !== 'chat' && store.saveError && <div className={styles.errorBanner}><span>! {store.saveError}</span>{(store.conflict || store.outcomeUnknown) && <button type="button" onClick={() => void showLatest()} disabled={store.busy}>查看最新内容</button>}</div>}
          {section !== 'chat' && store.notice && <p className={styles.successBanner}>✓ {store.notice}</p>}
          {authStore.logoutError && <p className={styles.errorBanner}>{authStore.logoutError}</p>}
        </div>}
        {section === 'chat' ? <ChatPanel /> : <div className={styles.workspace}>
          <form ref={formRef} className={`${styles.editor} ${mobilePanel !== 'editor' ? styles.mobileHidden : ''}`} onSubmit={(event) => event.preventDefault()}><fieldset disabled={!store.canEdit}><Editors section={section} capabilityTab={capabilityTab} onCapabilityTabChange={setCapabilityTab} capabilityCategory={capabilityCategory} onCapabilityCategoryChange={setCapabilityCategory} companyProjectId={companyProjectId} onCompanyProjectChange={setCompanyProjectId} /></fieldset><p className={styles.editorFootnote}>所有分区共享一份草稿，统一保存。</p></form>
          <section className={`${styles.preview} ${mobilePanel !== 'preview' ? styles.mobileHidden : ''}`} aria-label="未保存预览">
            <div className={styles.previewHeading}><div><span className={styles.smallEyebrow}>LIVE PREVIEW</span><h2>{store.dirty ? '未保存预览' : '官网预览'}</h2></div><div className={styles.segmented}><button type="button" aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}>▱ 桌面</button><button type="button" aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')}>▯ 手机</button></div></div>
            <Preview content={store.draft!} device={device} />
            <p className={styles.previewHint}>ⓘ 这里展示当前草稿。预览不会改变公开网站，保存后统一更新。</p>
          </section>
        </div>}
        {section !== 'chat' && <footer className={styles.mobileSave}><span className={`${styles.dirty} ${store.dirty ? styles.hasChanges : ''}`}><i />{store.dirty ? '有未保存修改' : `已保存 · v${store.document?.version}`}</span><button className={styles.primaryButton} type="button" disabled={!store.canEdit || !store.dirty || store.outcomeUnknown} onClick={saveAll}>{store.saving ? '保存中…' : '保存全部'}</button><button type="button" className={styles.textButton} disabled={store.busy} onClick={() => void logout()}>退出</button><Link to="/" aria-label="返回官网">↗</Link></footer>}
      </main>
    </div>}
    <Modal open={blocker.state === 'blocked'} title={store.busy ? '正在处理，请稍候' : '还有未保存的修改'} closable={!store.busy} mask={{ closable: false }} onCancel={() => blocker.state === 'blocked' && blocker.reset()} footer={<><Button disabled={store.busy} onClick={() => blocker.state === 'blocked' && blocker.reset()}>继续编辑</Button><Button danger disabled={store.busy} onClick={() => { store.discard(); if (blocker.state === 'blocked') blocker.proceed() }}>放弃修改并离开</Button></>}><p>{store.busy ? '等待当前请求完成后再离开，避免无法确认保存结果。' : '离开后，这份未保存的草稿将被丢弃。'}</p></Modal>
    <Modal open={Boolean(confirm)} title={confirm?.kind === 'logout' ? '退出前，要放弃这份草稿吗？' : '载入官网最新内容？'} onCancel={() => { if (!store.busy) setConfirm(null) }} onOk={() => void confirmAction()} confirmLoading={authStore.loggingOut} okText={confirm?.kind === 'logout' ? '放弃并退出' : '放弃草稿并载入'} cancelText="继续编辑" closable={!store.busy} mask={{ closable: !store.busy }} keyboard={!store.busy} okButtonProps={{ danger: true, disabled: store.busy }} cancelButtonProps={{ disabled: store.busy }}><p>当前未保存的修改不会保留。</p>{authStore.logoutError && <Alert type="error" title={authStore.logoutError} />}</Modal>
    <Modal open={conflictOpen && Boolean(authorized)} title="最新内容已更新" onCancel={() => setConflictOpen(false)} footer={<><Button onClick={() => setConflictOpen(false)}>继续保留编辑</Button><Button type="primary" onClick={() => void showLatest()}>查看最新内容</Button></>}><p>另一个编辑页面已更新官网。你的输入仍保留，请先查看最新内容。继续编辑不会覆盖官网的新版本。</p></Modal>
    <Modal open={latestOpen && Boolean(authorized)} width={1000} title={`官网最新内容${store.latest ? ` · 版本 ${store.latest.version}` : ''}`} onCancel={() => { if (!store.busy) setLatestOpen(false) }} closable={!store.busy} footer={<><Button disabled={store.busy} onClick={() => setLatestOpen(false)}>继续保留编辑</Button><Button disabled={store.busy || !store.latest} type="primary" onClick={() => setConfirm({ kind: 'latest' })}>载入最新，替换草稿</Button></>}>
      {store.checkingLatest ? <div className={styles.loading}><Spin /><p>正在核对最新版本…</p></div> : store.latestError ? <Alert type="error" title={store.latestError} action={<Button onClick={() => void store.checkLatest()}>重试</Button>} /> : store.latest && <><p>以下是已保存到官网的内容。可以载入最新内容后重新应用你的修改，也可以关闭并继续保留草稿。</p><Preview content={store.latest.content} device="desktop" /></>}
    </Modal>
  </ConfigProvider>
})
