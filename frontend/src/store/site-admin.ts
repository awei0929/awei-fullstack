import { makeAutoObservable, reaction, runInAction } from 'mobx'
import * as siteApi from '../api/site'
import { getSession } from '../api/auth'
import { HttpError } from '../api/http'
import type { SiteContent, SiteDocument, SiteFileAsset, SiteFileUploadTarget } from '../types/site'
import { siteFileMarkdown, siteFileUploadKey, siteFileValidationError } from '../utils/site-files'
import { authStore } from './auth'

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export class SiteAdminStore {
  document: SiteDocument | null = null
  draft: SiteContent | null = null
  latest: SiteDocument | null = null
  status: 'idle' | 'loading' | 'ready' | 'forbidden' | 'error' = 'idle'
  saving = false
  uploadingAudio = false
  uploadingFile = false
  fileUploadTarget = ''
  fileUploadError = ''
  lastFileUpload: { asset: SiteFileAsset; markdown: string; targetKey: string } | null = null
  checkingLatest = false
  loadError = ''
  saveError = ''
  audioUploadError = ''
  latestError = ''
  notice = ''
  conflict = false
  outcomeUnknown = false
  private active = false
  private requestVersion = 0
  private latestVersion = 0
  private draftOwnerId: string | null = null
  private suspendedOwnerId: string | null = null
  private lastLoginPromptVersion = authStore.loginPromptVersion

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true })
    reaction(() => `${authStore.identityVersion}:${authStore.ready}`, () => {
      if (this.active) this.syncIdentity()
    })
  }

  get dirty(): boolean {
    return Boolean(this.draft && this.document && JSON.stringify(this.draft) !== JSON.stringify(this.document.content))
  }

  get busy(): boolean {
    return this.saving || this.uploadingAudio || this.uploadingFile || this.checkingLatest || authStore.loggingOut
  }

  get canEdit(): boolean {
    return this.status === 'ready' && Boolean(authStore.user) && this.draftOwnerId === authStore.user?.id && !this.busy
  }

  activate(): void {
    this.active = true
    this.syncIdentity()
  }

  deactivate(): void {
    this.active = false
    this.requestVersion += 1
    this.latestVersion += 1
    this.saving = false
    this.uploadingAudio = false
    this.uploadingFile = false
    this.checkingLatest = false
  }

  discard(): void {
    this.document = null
    this.draft = null
    this.latest = null
    this.draftOwnerId = null
    this.suspendedOwnerId = null
    this.conflict = false
    this.outcomeUnknown = false
    this.saveError = ''
    this.audioUploadError = ''
    this.fileUploadError = ''
    this.fileUploadTarget = ''
    this.lastFileUpload = null
    this.latestError = ''
    this.notice = ''
  }

  private syncIdentity(): void {
    this.requestVersion += 1
    this.latestVersion += 1
    this.saving = false
    this.uploadingAudio = false
    this.uploadingFile = false
    this.checkingLatest = false
    this.status = 'idle'
    this.loadError = ''
    const userId = authStore.user?.id
    if (authStore.loginPromptVersion !== this.lastLoginPromptVersion && !userId) this.suspendedOwnerId = this.draftOwnerId
    this.lastLoginPromptVersion = authStore.loginPromptVersion
    if (!userId) {
      if (!this.suspendedOwnerId || this.suspendedOwnerId !== this.draftOwnerId) this.discard()
      return
    }
    if (userId !== this.draftOwnerId) this.discard()
    if (authStore.ready) void this.load()
  }

  private current(identity: number, request?: number): boolean {
    return this.active && authStore.ready && Boolean(authStore.user)
      && identity === authStore.identityVersion && (request === undefined || request === this.requestVersion)
  }

  private authFailure(error: unknown, identity: number): boolean {
    if (!(error instanceof HttpError)) return false
    if (error.status === 401) {
      this.suspendedOwnerId = this.draftOwnerId
      authStore.expireSession(identity)
      return true
    }
    if (error.status === 403 && error.code !== 'CSRF_INVALID') {
      this.discard()
      this.status = 'forbidden'
      this.loadError = error.code === 'SITE_OWNER_NOT_CONFIGURED' ? '站主权限尚未配置，请完成站主初始化后重试。' : '此账号没有网站管理权限。'
      return true
    }
    return false
  }

  async load(): Promise<void> {
    if (!this.active || !authStore.ready || !authStore.user || this.busy) return
    const identity = authStore.identityVersion
    const version = ++this.requestVersion
    this.status = 'loading'
    this.loadError = ''
    try {
      const document = await siteApi.getSiteConfig()
      runInAction(() => {
        if (!this.current(identity, version)) return
        if (this.dirty && this.draftOwnerId === authStore.user?.id) {
          if (document.version !== this.document?.version) {
            this.latest = document
            this.conflict = true
            this.saveError = '官网已有新版本。你的草稿已保留，请先查看最新内容。'
          }
          this.notice = '已恢复当前账号的未保存草稿。'
        } else {
          this.document = document
          this.draft = clone(document.content)
          this.conflict = false
          this.outcomeUnknown = false
        }
        this.draftOwnerId = authStore.user!.id
        this.suspendedOwnerId = null
        this.status = 'ready'
      })
    } catch (error) {
      runInAction(() => {
        if (!this.current(identity, version) || this.authFailure(error, identity)) return
        this.status = 'error'
        this.loadError = error instanceof Error ? error.message : '网站配置加载失败'
      })
    }
  }

  edit(change: (draft: SiteContent) => void): void {
    if (!this.canEdit || !this.draft) return
    change(this.draft)
    this.notice = ''
    if (!this.conflict && !this.outcomeUnknown) this.saveError = ''
  }

  private async writeToken(identity: number): Promise<string> {
    // Refresh a token rejected by CSRF without applying a new UI identity or losing the draft.
    if (authStore.csrfToken) return authStore.csrfToken
    const session = await getSession()
    if (!this.current(identity) || session.user?.id !== authStore.user?.id) throw new HttpError('登录已失效', 401)
    runInAction(() => { authStore.csrfToken = session.csrfToken })
    return session.csrfToken
  }

  async save(): Promise<boolean> {
    if (!this.canEdit || !this.draft || !this.document || !this.dirty || this.outcomeUnknown) return false
    const identity = authStore.identityVersion
    const version = ++this.requestVersion
    this.latestVersion += 1
    this.saving = true
    this.saveError = ''
    this.notice = ''
    let requestSent = false
    try {
      const content = siteApi.parseSiteContent(clone(this.draft))
      const csrfToken = await this.writeToken(identity)
      if (!this.current(identity, version)) return false
      requestSent = true
      const document = await siteApi.saveSiteConfig({ version: this.document.version, content }, csrfToken)
      if (!this.current(identity, version)) return false
      runInAction(() => {
        this.document = document
        this.draft = clone(document.content)
        this.latest = null
        this.conflict = false
        this.outcomeUnknown = false
        this.notice = `已保存全部内容 · 版本 ${document.version}`
      })
      return true
    } catch (error) {
      runInAction(() => {
        if (!this.current(identity, version) || this.authFailure(error, identity)) return
        if (error instanceof HttpError && error.status === 409) {
          this.conflict = true
          this.latest = null
          this.saveError = '另一个编辑页面已更新官网。你的输入仍保留，请查看最新内容后选择如何继续。'
        } else if (error instanceof HttpError && error.status === 403) {
          authStore.csrfToken = ''
          this.saveError = '安全校验已更新，内容未保存。请重试保存。'
        } else if (error instanceof HttpError || !requestSent) {
          this.saveError = error instanceof Error ? error.message : '保存尚未开始，请重试。'
        } else {
          this.outcomeUnknown = true
          this.saveError = '未能确认保存结果，输入已保留。请先核对官网最新版本，避免重复保存。'
        }
      })
      return false
    } finally {
      runInAction(() => { if (this.current(identity, version)) this.saving = false })
    }
  }

  async checkLatest(): Promise<void> {
    if (!this.canEdit) return
    const identity = authStore.identityVersion
    const version = ++this.latestVersion
    this.checkingLatest = true
    this.latestError = ''
    try {
      const latest = await siteApi.getSiteConfig()
      runInAction(() => {
        if (!this.current(identity) || version !== this.latestVersion) return
        this.latest = latest
        if (this.outcomeUnknown && JSON.stringify(latest.content) === JSON.stringify(this.draft)) {
          this.document = latest
          this.draft = clone(latest.content)
          this.outcomeUnknown = false
          this.conflict = false
          this.saveError = ''
          this.notice = `已核对：全部内容已保存 · 版本 ${latest.version}`
        } else if (this.outcomeUnknown && latest.version === this.document?.version) {
          this.outcomeUnknown = false
          this.saveError = '已核对最新版本，官网尚未更新。可以重试保存。'
        } else if (latest.version !== this.document?.version) {
          this.outcomeUnknown = false
          this.conflict = true
        }
      })
    } catch (error) {
      runInAction(() => {
        if (!this.current(identity) || version !== this.latestVersion || this.authFailure(error, identity)) return
        this.latestError = error instanceof Error ? error.message : '最新内容加载失败'
      })
    } finally {
      runInAction(() => { if (this.current(identity) && version === this.latestVersion) this.checkingLatest = false })
    }
  }

  useLatest(): void {
    if (!this.canEdit || !this.latest) return
    this.document = clone(this.latest)
    this.draft = clone(this.latest.content)
    this.latest = null
    this.conflict = false
    this.outcomeUnknown = false
    this.saveError = ''
    this.notice = '已载入官网最新内容。'
  }

  async uploadAudio(file: File): Promise<void> {
    if (!this.canEdit || !this.draft) return
    this.audioUploadError = ''
    if (!['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave', 'audio/ogg', 'application/ogg'].includes(file.type) || file.size === 0 || file.size > 15 * 1024 * 1024) {
      this.audioUploadError = '请选择不超过 15 MiB 的 MP3、WAV 或 OGG 音频。'
      return
    }
    const identity = authStore.identityVersion
    const version = ++this.requestVersion
    this.uploadingAudio = true
    try {
      const csrfToken = await this.writeToken(identity)
      if (!this.current(identity, version)) return
      const asset = await siteApi.uploadSiteAudio(file, csrfToken)
      runInAction(() => {
        if (!this.current(identity, version) || !this.draft) return
        this.draft.music.sourceUrl = asset.url
        this.notice = '音频已上传到草稿。启用音乐并保存全部后，访客可主动播放。'
      })
    } catch (error) {
      runInAction(() => {
        if (!this.current(identity, version) || this.authFailure(error, identity)) return
        if (error instanceof HttpError && error.code === 'CSRF_INVALID') authStore.csrfToken = ''
        this.audioUploadError = `${error instanceof Error ? error.message : '上传失败'}；原音源已保留。`
      })
    } finally {
      runInAction(() => { if (this.current(identity, version)) this.uploadingAudio = false })
    }
  }

  async uploadFile(file: File, target: SiteFileUploadTarget, expectedKind?: SiteFileAsset['kind']): Promise<void> {
    if (!this.active || !this.canEdit || !this.draft) return
    const targetKey = siteFileUploadKey(target)
    const requiredKind = target.type === 'cover' ? 'image' : expectedKind
    this.fileUploadTarget = targetKey
    this.fileUploadError = siteFileValidationError(file, requiredKind)
    if (this.fileUploadError) return
    const identity = authStore.identityVersion
    const version = ++this.requestVersion
    this.uploadingFile = true
    this.notice = ''
    try {
      const csrfToken = await this.writeToken(identity)
      if (!this.current(identity, version)) return
      const asset = await siteApi.uploadSiteFile(file, csrfToken)
      runInAction(() => {
        if (!this.current(identity, version) || !this.draft) return
        const markdown = siteFileMarkdown(asset)
        this.lastFileUpload = { asset, markdown, targetKey }
        if (requiredKind && asset.kind !== requiredKind) {
          this.fileUploadError = '服务返回的文件类型不符，原内容已保留。可复制下方地址。'
          return
        }
        if (target.type === 'library') {
          this.notice = '文件已上传，可复制地址或 Markdown。添加到草稿后仍需保存全部。'
          return
        }
        if (target.type === 'cover') {
          const project = this.draft.capabilityDetails.projects.find(item => item.id === target.projectId)
          if (!project) { this.fileUploadError = '原项目已不在草稿中，未替换封面。可复制下方地址。'; return }
          project.coverUrl = asset.url
        } else {
          const project = target.type === 'project' ? this.draft.capabilityDetails.projects.find(item => item.id === target.projectId) : null
          if (target.type === 'project' && !project) { this.fileUploadError = '原项目已不在草稿中，未插入正文。可复制下方内容。'; return }
          const original = target.type === 'company' ? this.draft.capabilityDetails.company[target.field] : project!.content
          const next = `${original}${original ? '\n\n' : ''}${markdown}`
          if (Array.from(next).length > (target.type === 'company' ? 10000 : 20000)) {
            this.fileUploadError = '插入后正文会超出字数限制，原文已保留。文件已上传，可复制下方地址或 Markdown。'
            return
          }
          if (target.type === 'company') this.draft.capabilityDetails.company[target.field] = next
          else project!.content = next
        }
        this.notice = '已写入当前草稿，保存全部后更新页面引用。文件现在即可凭链接公开访问。'
      })
    } catch (error) {
      runInAction(() => {
        if (!this.current(identity, version) || this.authFailure(error, identity)) return
        if (error instanceof HttpError && error.code === 'CSRF_INVALID') authStore.csrfToken = ''
        this.fileUploadError = `${error instanceof Error ? error.message : '上传失败'}；原封面和正文已保留。请重新选择文件重试。`
      })
    } finally {
      runInAction(() => { if (this.current(identity, version)) this.uploadingFile = false })
    }
  }
}

export const siteAdminStore = new SiteAdminStore()
