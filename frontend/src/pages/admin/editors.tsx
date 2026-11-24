import { observer } from 'mobx-react-lite'
import { siteAdminStore as store } from '../../store/site-admin'
import type { SiteCapabilityCategory } from '../../types/site'
import type { CapabilityEditorTab, Section } from './sections'
import { Group, LinesField, TextField, Toggle } from './fields'
import { CapabilitiesEditor } from './capabilities-editor'
import { FileUploadControl, FileUploadsEditor } from './file-upload'
import { SiteImage } from '../../components/site-markdown'
import styles from './style.module.less'

function nextId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
}

export const Editors = observer(function Editors({ section, capabilityTab, onCapabilityTabChange, capabilityCategory, onCapabilityCategoryChange, companyProjectId, onCompanyProjectChange }: { section: Section; capabilityTab: CapabilityEditorTab; onCapabilityTabChange: (tab: CapabilityEditorTab) => void; capabilityCategory: SiteCapabilityCategory; onCapabilityCategoryChange: (category: SiteCapabilityCategory) => void; companyProjectId: string | null; onCompanyProjectChange: (id: string | null) => void }) {
  const content = store.draft!
  switch (section) {
    case 'files': return <FileUploadsEditor />
    case 'home': return <>
      <Group title="迎宾文案">
        <TextField label="开场小字" value={content.home.eyebrow} onChange={(value) => store.edit((draft) => { draft.home.eyebrow = value })} maxLength={80} required />
        <TextField label="首屏标题" value={content.home.title} onChange={(value) => store.edit((draft) => { draft.home.title = value })} maxLength={80} multiline rows={2} required />
        <TextField label="一句问候" value={content.home.subtitle} onChange={(value) => store.edit((draft) => { draft.home.subtitle = value })} maxLength={240} multiline rows={2} />
      </Group>
    </>
    case 'thoughts': return <>
      <Group title={`想法 · ${content.thoughts.length}/12`} description="每条想法会出现在首页「01 / THINKING」，点开阅读正文。">
        {content.thoughts.map((thought, index) => <div className={styles.linkCard} key={thought.id}>
          <div className={styles.cardLead}><span>想法 {index + 1}</span><code>{thought.id}</code></div>
          <TextField label="标题" value={thought.title} onChange={value => store.edit(draft => { draft.thoughts[index].title = value })} maxLength={80} required />
          <TextField label="小标签" value={thought.meta} onChange={value => store.edit(draft => { draft.thoughts[index].meta = value })} maxLength={40} placeholder="例如：工程 / 2026" />
          <TextField label="摘要" value={thought.summary} onChange={value => store.edit(draft => { draft.thoughts[index].summary = value })} maxLength={200} multiline rows={2} />
          <TextField label="正文（Markdown）" value={thought.content} onChange={value => store.edit(draft => { draft.thoughts[index].content = value })} maxLength={20000} multiline rows={10} placeholder={'先说结论，再展开理由。\n\n- 一个判断\n- 一个例子'} />
          <Toggle label="公开显示" checked={thought.visible} onChange={value => store.edit(draft => { draft.thoughts[index].visible = value })} />
          <button type="button" className={styles.textButton} onClick={() => store.edit(draft => { draft.thoughts.splice(index, 1) })}>移除这条想法</button>
        </div>)}
        <button type="button" className={styles.addButton} disabled={content.thoughts.length >= 12} onClick={() => store.edit(draft => { draft.thoughts.push({ id: nextId('thought'), title: '新想法', summary: '', content: '', meta: '', visible: true }) })}>＋ 添加想法</button>
      </Group>
    </>
    case 'works': return <>
      <Group title={`作品 · ${content.works.length}/12`} description="第一条会作为首页大卡片，其余按顺序排成小卡片。链接可以是外部地址或站内路径（如 /resume）。">
        {content.works.map((work, index) => <div className={styles.linkCard} key={work.id}>
          <div className={styles.cardLead}><span>作品 {index + 1}{index === 0 ? ' · 首页大卡' : ''}</span><code>{work.id}</code></div>
          <TextField label="标题" value={work.title} onChange={value => store.edit(draft => { draft.works[index].title = value })} maxLength={80} required />
          <TextField label="摘要" value={work.summary} onChange={value => store.edit(draft => { draft.works[index].summary = value })} maxLength={240} multiline rows={2} />
          <TextField label="链接地址" value={work.url} onChange={value => store.edit(draft => { draft.works[index].url = value })} maxLength={2048} placeholder="https://… 或 /resume" />
          <TextField label="类型标签" value={work.label} onChange={value => store.edit(draft => { draft.works[index].label = value })} maxLength={20} placeholder="项目 / 工具 / 实验" />
          <TextField label="年份或角色" value={work.meta} onChange={value => store.edit(draft => { draft.works[index].meta = value })} maxLength={40} placeholder="2026 · 独立开发" />
          <div className={styles.coverField}>
            {work.coverUrl && <SiteImage src={work.coverUrl} alt={`${work.title}封面`} />}
            <FileUploadControl target={{ type: 'work-cover', workId: work.id }} mode="image" showResult={false} />
            {work.coverUrl && <button type="button" className={styles.textButton} onClick={() => store.edit(draft => { draft.works[index].coverUrl = '' })}>移除封面，使用生成封面</button>}
          </div>
          <Toggle label="公开显示" checked={work.visible} onChange={value => store.edit(draft => { draft.works[index].visible = value })} />
          <button type="button" className={styles.textButton} onClick={() => store.edit(draft => { draft.works.splice(index, 1) })}>移除这个作品</button>
        </div>)}
        <button type="button" className={styles.addButton} disabled={content.works.length >= 12} onClick={() => store.edit(draft => { draft.works.push({ id: nextId('work'), title: '新项目', summary: '', url: '', label: '项目', coverUrl: '', meta: '', visible: true }) })}>＋ 添加作品</button>
      </Group>
    </>
    case 'resume': {
      const resume = content.resume
      const skills = resume.skills ?? []
      const experience = resume.experience ?? []
      const projects = resume.projects ?? []
      const education = resume.education ?? []
      return <>
        <Group title="简历头部" description="姓名、方向和一句概括会显示在页面最上方；联系邮箱取自「联系入口」。">
          <TextField label="姓名" value={resume.name} onChange={value => store.edit(draft => { draft.resume.name = value })} maxLength={60} />
          <TextField label="岗位方向" value={resume.role} onChange={value => store.edit(draft => { draft.resume.role = value })} maxLength={80} placeholder="Web 全栈开发" />
          <TextField label="补充信息" value={resume.meta ?? ''} onChange={value => store.edit(draft => { draft.resume.meta = value })} maxLength={60} placeholder="5 年经验 · 随时到岗" hint="显示在姓名下方，可留空。" />
          <TextField label="一句话介绍" value={resume.summary ?? ''} onChange={value => store.edit(draft => { draft.resume.summary = value })} maxLength={600} multiline rows={4} placeholder="用两三句话说明你的经验、方向和关注点。" />
        </Group>
        <Group title={`专业技能 · ${skills.length}/12`} description="左侧是分组名，右侧是逐行展示的技能条目。">
          {skills.map((group, index) => <div className={styles.linkCard} key={index}>
            <div className={styles.cardLead}><span>技能组 {index + 1}</span></div>
            <TextField label="分组名称" value={group.label} onChange={value => store.edit(draft => { (draft.resume.skills ??= [])[index].label = value })} maxLength={40} required />
            <LinesField label="技能条目（每行一条）" value={group.items} onChange={value => store.edit(draft => { (draft.resume.skills ??= [])[index].items = value })} rows={5} placeholder="React 与 TypeScript
Node.js / NestJS" hint="失焦后保存，空行会被忽略。" />
            <button type="button" className={styles.textButton} onClick={() => store.edit(draft => { (draft.resume.skills ??= []).splice(index, 1) })}>移除这个分组</button>
          </div>)}
          <button type="button" className={styles.addButton} disabled={skills.length >= 12} onClick={() => store.edit(draft => { (draft.resume.skills ??= []).push({ label: '新技能组', items: [] }) })}>＋ 添加技能组</button>
        </Group>
        <Group title={`工作经历 · ${experience.length}/12`} description="按时间倒序排列；每段经历用短句说明职责和结果。">
          {experience.map((entry, index) => <div className={styles.linkCard} key={index}>
            <div className={styles.cardLead}><span>经历 {index + 1}</span></div>
            <TextField label="公司" value={entry.company} onChange={value => store.edit(draft => { (draft.resume.experience ??= [])[index].company = value })} maxLength={80} required />
            <TextField label="岗位" value={entry.role} onChange={value => store.edit(draft => { (draft.resume.experience ??= [])[index].role = value })} maxLength={80} required />
            <TextField label="时间" value={entry.period} onChange={value => store.edit(draft => { (draft.resume.experience ??= [])[index].period = value })} maxLength={40} placeholder="2022.12 – 至今" />
            <TextField label="概述" value={entry.summary} onChange={value => store.edit(draft => { (draft.resume.experience ??= [])[index].summary = value })} maxLength={600} multiline rows={2} placeholder="可选：一行说明这段经历的重点。" />
            <LinesField label="要点（每行一条）" value={entry.highlights} onChange={value => store.edit(draft => { (draft.resume.experience ??= [])[index].highlights = value })} rows={5} placeholder="负责了什么
做成了什么" hint="失焦后保存，空行会被忽略。" />
            <button type="button" className={styles.textButton} onClick={() => store.edit(draft => { (draft.resume.experience ??= []).splice(index, 1) })}>移除这段经历</button>
          </div>)}
          <button type="button" className={styles.addButton} disabled={experience.length >= 12} onClick={() => store.edit(draft => { (draft.resume.experience ??= []).push({ company: '新公司', role: '岗位', period: '', summary: '', highlights: [] }) })}>＋ 添加工作经历</button>
        </Group>
        <Group title={`项目经历 · ${projects.length}/12`} description="项目会按顺序展示在经历之后；每条可以写多个技术标签和要点。">
          {projects.map((entry, index) => <div className={styles.linkCard} key={index}>
            <div className={styles.cardLead}><span>项目 {index + 1}</span></div>
            <TextField label="项目名称" value={entry.name} onChange={value => store.edit(draft => { (draft.resume.projects ??= [])[index].name = value })} maxLength={100} required />
            <TextField label="角色" value={entry.role} onChange={value => store.edit(draft => { (draft.resume.projects ??= [])[index].role = value })} maxLength={80} placeholder="前端 / 全栈" />
            <TextField label="时间" value={entry.period} onChange={value => store.edit(draft => { (draft.resume.projects ??= [])[index].period = value })} maxLength={40} placeholder="2023 – 2026" />
            <TextField label="项目概述" value={entry.summary} onChange={value => store.edit(draft => { (draft.resume.projects ??= [])[index].summary = value })} maxLength={600} multiline rows={3} />
            <LinesField label="技术标签（每行一个）" value={entry.tech} onChange={value => store.edit(draft => { (draft.resume.projects ??= [])[index].tech = value })} rows={3} placeholder="React
TypeScript
NestJS" hint="失焦后保存，空行会被忽略。" />
            <LinesField label="项目要点（每行一条）" value={entry.highlights} onChange={value => store.edit(draft => { (draft.resume.projects ??= [])[index].highlights = value })} rows={5} placeholder="负责了什么
解决了什么问题" hint="失焦后保存，空行会被忽略。" />
            <button type="button" className={styles.textButton} onClick={() => store.edit(draft => { (draft.resume.projects ??= []).splice(index, 1) })}>移除这个项目</button>
          </div>)}
          <button type="button" className={styles.addButton} disabled={projects.length >= 12} onClick={() => store.edit(draft => { (draft.resume.projects ??= []).push({ name: '新项目', role: '', period: '', summary: '', tech: [], highlights: [] }) })}>＋ 添加项目</button>
        </Group>
        <Group title={`教育经历 · ${education.length}/8`}>
          {education.map((entry, index) => <div className={styles.linkCard} key={index}>
            <TextField label="学校" value={entry.school} onChange={value => store.edit(draft => { (draft.resume.education ??= [])[index].school = value })} maxLength={100} required />
            <TextField label="专业" value={entry.major} onChange={value => store.edit(draft => { (draft.resume.education ??= [])[index].major = value })} maxLength={80} />
            <TextField label="时间" value={entry.period} onChange={value => store.edit(draft => { (draft.resume.education ??= [])[index].period = value })} maxLength={40} />
            <button type="button" className={styles.textButton} onClick={() => store.edit(draft => { (draft.resume.education ??= []).splice(index, 1) })}>移除这段教育经历</button>
          </div>)}
          <button type="button" className={styles.addButton} disabled={education.length >= 8} onClick={() => store.edit(draft => { (draft.resume.education ??= []).push({ school: '学校', major: '', period: '' }) })}>＋ 添加教育经历</button>
        </Group>
        <Group title="补充内容" description="可选。用 Markdown 写结构化字段放不下的内容，会显示在页面末尾。">
          <TextField label="Markdown 正文" value={resume.body} onChange={value => store.edit(draft => { draft.resume.body = value })} maxLength={20000} multiline rows={8} placeholder={'## 补充\n\n- 一段可以自由编辑的内容'} />
        </Group>
        <Group title="简历 PDF">
          <FileUploadControl target={{ type: 'resume' }} mode="pdf" showResult={false} />
          {resume.pdfUrl && <p className={styles.hint}>
            <a href={resume.pdfUrl} download>下载当前附件</a>
            <button type="button" className={styles.textButton} disabled={!store.canEdit} onClick={() => store.edit(draft => { draft.resume.pdfUrl = '' })}>移除引用</button>
          </p>}
        </Group>
      </>
    }
    case 'capabilities': return <CapabilitiesEditor tab={capabilityTab} onTabChange={onCapabilityTabChange} category={capabilityCategory} onCategoryChange={onCapabilityCategoryChange} projectId={companyProjectId} onProjectChange={onCompanyProjectChange} />
    case 'profile': return <>
      <Group title="关于你">
        <TextField label="展示名" value={content.profile.name} onChange={(value) => store.edit((draft) => { draft.profile.name = value })} maxLength={60} required />
        <TextField label="个人签名" value={content.profile.tagline} onChange={(value) => store.edit((draft) => { draft.profile.tagline = value })} maxLength={160} multiline rows={2} />
        <TextField label="个人介绍" value={content.profile.bio} onChange={(value) => store.edit((draft) => { draft.profile.bio = value })} maxLength={4000} multiline rows={12} placeholder="写一些关于你的故事…" />
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
    case 'conversation': return <>
      <Group title="公开对话入口" description="访客无需登录即可提问；回答只依据下面各分区已公开的内容，不会读取后台数据。">
        <Toggle label="开放对话" checked={content.chat.enabled} onChange={value => store.edit(draft => { draft.chat.enabled = value })} hint="关闭后首页保留说明，但不再显示输入框" />
        <TextField label="标题" value={content.chat.heading} onChange={value => store.edit(draft => { draft.chat.heading = value })} maxLength={40} required />
        <TextField label="一句介绍" value={content.chat.intro} onChange={value => store.edit(draft => { draft.chat.intro = value })} maxLength={240} multiline rows={2} />
        <TextField label="输入框占位" value={content.chat.placeholder} onChange={value => store.edit(draft => { draft.chat.placeholder = value })} maxLength={60} required />
      </Group>
      <Group title={`建议问题 · ${content.chat.suggestions.length}/3`} description="放在输入框下方，点击后填入，不会自动发送。">
        {content.chat.suggestions.map((text, index) => <div className={styles.linkCard} key={index}>
          <TextField label={`建议 ${index + 1}`} value={text} onChange={value => store.edit(draft => { draft.chat.suggestions[index] = value })} maxLength={60} required />
          <button type="button" className={styles.textButton} onClick={() => store.edit(draft => { draft.chat.suggestions.splice(index, 1) })}>移除</button>
        </div>)}
        <button type="button" className={styles.addButton} disabled={content.chat.suggestions.length >= 3} onClick={() => store.edit(draft => { draft.chat.suggestions.push('你最近在做什么？') })}>＋ 添加建议问题</button>
      </Group>
      <Group title="回答设定" description="只影响公开 AI 分身的语气和边界，不会出现在公开接口里。">
        <TextField label="补充提示词" value={content.chat.systemPrompt} onChange={value => store.edit(draft => { draft.chat.systemPrompt = value })} maxLength={4000} multiline rows={8} placeholder="例如：回答时更直接一些；不要讨论未公开的项目。" hint="留空则只使用系统默认规则。" />
      </Group>
    </>
    case 'appearance': return <>
      <Group title="交互效果"><Toggle label="轻量动效" checked={content.appearance.motion} onChange={(value) => store.edit((draft) => { draft.appearance.motion = value })} hint="控制场景过渡与背景回应。" /><p className={styles.hint}>遵循访客设备的「减少动态效果」设置</p></Group>
      <Group title="背景音乐" description="访客点击后播放，后台预览静音">
        <TextField label="音乐名称" value={content.music.title} onChange={(value) => store.edit((draft) => { draft.music.title = value })} maxLength={80} placeholder="可留空" />
        <TextField label="音源地址" value={content.music.sourceUrl} onChange={(value) => store.edit((draft) => { draft.music.sourceUrl = value })} maxLength={2048} required={content.music.enabled} placeholder="https://… 或上传音频" hint="使用可直接播放的音频链接" />
        <label className={`${styles.uploadButton} ${store.busy ? styles.disabled : ''}`}>
          {store.uploadingAudio ? '正在上传…' : '↑ 上传音乐文件'}
          <input type="file" aria-label="上传背景音乐" accept=".mp3,.wav,.ogg,audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/ogg,application/ogg" disabled={!store.canEdit} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void store.uploadAudio(file) }} />
        </label>
        <small className={styles.hint}>MP3、WAV 或 OGG，最大 15 MiB</small>
        {store.uploadingAudio && <progress className={styles.uploadProgress} aria-label="音频上传中" />}
        {store.audioUploadError && <p className={styles.inlineError} role="alert">{store.audioUploadError}</p>}
        <label className={styles.field}>初始音量 · {content.music.volume}%<input type="range" min={0} max={100} step={1} value={content.music.volume} onChange={(event) => store.edit((draft) => { draft.music.volume = Number(event.target.value) })} /></label>
        <Toggle label="循环播放" checked={content.music.loop} onChange={(value) => store.edit((draft) => { draft.music.loop = value })} />
        <Toggle label="启用背景音乐" checked={content.music.enabled} onChange={(value) => store.edit((draft) => { draft.music.enabled = value })} hint="关闭后隐藏官网音乐入口" />
      </Group>
    </>
  }
})
