import { observer } from 'mobx-react-lite'
import { siteAdminStore as store } from '../../store/site-admin'
import type { SiteCapabilityCategory } from '../../types/site'
import type { CapabilityEditorTab, Section } from './sections'
import { Group, TextField, Toggle } from './fields'
import { CapabilitiesEditor } from './capabilities-editor'
import { FileUploadsEditor } from './file-upload'
import styles from './style.module.less'

export const Editors = observer(function Editors({ section, capabilityTab, onCapabilityTabChange, capabilityCategory, onCapabilityCategoryChange, companyProjectId, onCompanyProjectChange }: { section: Section; capabilityTab: CapabilityEditorTab; onCapabilityTabChange: (tab: CapabilityEditorTab) => void; capabilityCategory: SiteCapabilityCategory; onCapabilityCategoryChange: (category: SiteCapabilityCategory) => void; companyProjectId: string | null; onCompanyProjectChange: (id: string | null) => void }) {
  const content = store.draft!
  switch (section) {
    case 'files': return <FileUploadsEditor />
    case 'home': return <>
      <Group title="迎宾文案">
        <TextField label="开场小字" value={content.home.eyebrow} onChange={(value) => store.edit((draft) => { draft.home.eyebrow = value })} maxLength={80} required />
        <TextField label="首屏标题" value={content.home.title} onChange={(value) => store.edit((draft) => { draft.home.title = value })} maxLength={80} multiline rows={2} required />
        <TextField label="一句问候" value={content.home.subtitle} onChange={(value) => store.edit((draft) => { draft.home.subtitle = value })} maxLength={240} multiline rows={2} />
        <TextField label="探索按钮" value={content.home.buttonLabel} onChange={(value) => store.edit((draft) => { draft.home.buttonLabel = value })} maxLength={30} required />
      </Group>
      <Group title="角色素材"><div className={styles.characterCard}><img src="/site/hero-character.png" alt="圆框眼镜经典角色" /><div><strong>CLASSIC / 经典</strong><p>此刻，先打个招呼。</p><small>当前使用角色静帧，连续动作待补充。</small></div></div></Group>
      <Group title="场景一览"><div className={styles.sceneCard}><img src="/site/hero-character.png" alt="" /><span>01</span><strong>初次见面</strong></div><div className={styles.sceneCard}><img src="/site/capability-character-768.webp" alt="" /><span>02</span><strong>我的能力</strong></div><p className={styles.hint}>在右侧预览中切换「初次见面」与「我的能力」。</p></Group>
    </>
    case 'capabilities': return <CapabilitiesEditor tab={capabilityTab} onTabChange={onCapabilityTabChange} category={capabilityCategory} onCategoryChange={onCapabilityCategoryChange} projectId={companyProjectId} onProjectChange={onCompanyProjectChange} />
    case 'profile': return <>
      <Group title="关于你">
        <TextField label="展示名" value={content.profile.name} onChange={(value) => store.edit((draft) => { draft.profile.name = value })} maxLength={60} required />
        <TextField label="个人签名" value={content.profile.tagline} onChange={(value) => store.edit((draft) => { draft.profile.tagline = value })} maxLength={160} multiline rows={2} />
        <TextField label="个人介绍" value={content.profile.bio} onChange={(value) => store.edit((draft) => { draft.profile.bio = value })} maxLength={4000} multiline rows={12} placeholder="写一些关于你的故事…" hint="访客可从「关于我」打开这些内容；留空的内容不会被自动补写。" />
      </Group>
    </>
    case 'contact': return <>
      <Group title="联系方式"><TextField label="公开邮箱" value={content.contact.email} onChange={(value) => store.edit((draft) => { draft.contact.email = value })} type="email" maxLength={254} placeholder="hello@example.com（可留空）" /></Group>
      <Group title={`更多入口 · ${content.contact.links.length}/8`} description="只添加你愿意公开的地址。">
        {content.contact.links.map((link, index) => <div className={styles.linkCard} key={index}>
          <TextField label={`入口 ${index + 1} 名称`} value={link.label} onChange={(value) => store.edit((draft) => { draft.contact.links[index].label = value })} maxLength={50} required />
          <TextField label="链接地址" value={link.url} onChange={(value) => store.edit((draft) => { draft.contact.links[index].url = value })} maxLength={2048} placeholder="https://…" />
          <button type="button" className={styles.textButton} onClick={() => store.edit((draft) => { draft.contact.links.splice(index, 1) })}>移除入口</button>
        </div>)}
        <button type="button" className={styles.addButton} disabled={content.contact.links.length >= 8} onClick={() => store.edit((draft) => { draft.contact.links.push({ label: '新入口', url: '' }) })}>＋ 添加联系入口</button>
      </Group>
    </>
    case 'appearance': return <>
      <Group title="空间风格"><div className={styles.palette}><span /><span /><span /><span /></div><h3>橄榄舞台 / 奶油文字 / 暖橙点缀</h3><p className={styles.hint}>沿用当前视觉方案，保持欢迎与能力场景的一致氛围。</p></Group>
      <Group title="交互效果"><Toggle label="轻量动效" checked={content.appearance.motion} onChange={(value) => store.edit((draft) => { draft.appearance.motion = value })} hint="控制场景过渡与背景回应。" /><p className={styles.hint}>官网也会尊重访客设备的「减少动态效果」设置。角色当前保持静帧。</p></Group>
      <Group title="背景音乐" description="选择自己的音源。访客点击播放后才会响起，后台预览保持静音。">
        <TextField label="音乐名称" value={content.music.title} onChange={(value) => store.edit((draft) => { draft.music.title = value })} maxLength={80} placeholder="可留空" />
        <TextField label="音源地址" value={content.music.sourceUrl} onChange={(value) => store.edit((draft) => { draft.music.sourceUrl = value })} maxLength={2048} required={content.music.enabled} placeholder="https://… 或上传音频" hint="填写可直接播放的 HTTP/HTTPS 音频地址；外部链接失效时访客会看到播放提示。" />
        <label className={`${styles.uploadButton} ${store.busy ? styles.disabled : ''}`}>
          {store.uploadingAudio ? '正在上传…' : '↑ 上传音乐文件'}
          <input type="file" aria-label="上传背景音乐" accept=".mp3,.wav,.ogg,audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/ogg,application/ogg" disabled={!store.canEdit} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void store.uploadAudio(file) }} />
        </label>
        <small className={styles.hint}>MP3、WAV 或 OGG，最大 15 MiB。上传只替换草稿音源，保存全部后才会更新官网。</small>
        {store.uploadingAudio && <progress className={styles.uploadProgress} aria-label="音频上传中" />}
        {store.audioUploadError && <p className={styles.inlineError} role="alert">{store.audioUploadError}</p>}
        <label className={styles.field}>初始音量 · {content.music.volume}%<input type="range" min={0} max={100} step={1} value={content.music.volume} onChange={(event) => store.edit((draft) => { draft.music.volume = Number(event.target.value) })} /></label>
        <Toggle label="循环播放" checked={content.music.loop} onChange={(value) => store.edit((draft) => { draft.music.loop = value })} />
        <Toggle label="启用背景音乐" checked={content.music.enabled} onChange={(value) => store.edit((draft) => { draft.music.enabled = value })} hint="启用前请填写音源或上传文件；关闭后官网隐藏音乐入口。" />
      </Group>
    </>
  }
})
