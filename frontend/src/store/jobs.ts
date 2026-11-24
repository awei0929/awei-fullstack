import { makeAutoObservable, reaction, runInAction } from 'mobx'
import * as jobsApi from '../api/jobs'
import { HttpError } from '../api/http'
import { authStore } from './auth'
import type { Job } from '../types/job'

// 作业列表与轮询独立于任务 CRUD；身份变化时整份清空，避免旧账号的作业闪现。
class JobsStore {
  jobs: Job[] = []
  creating = false
  loadError = ''
  createError = ''
  private loadVersion = 0
  private pollTimer: ReturnType<typeof setInterval> | null = null

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true })
    reaction(
      () => `${authStore.identityVersion}:${authStore.ready}`,
      () => {
        this.reset()
        if (authStore.ready) void this.refresh()
      },
      { fireImmediately: true },
    )
  }

  get hasActive(): boolean {
    return this.jobs.some((job) => job.status === 'pending' || job.status === 'running')
  }

  private isCurrent(identity: number): boolean {
    return authStore.ready && identity === authStore.identityVersion
  }

  private reset(): void {
    this.stopPolling()
    this.loadVersion += 1
    this.jobs = []
    this.creating = false
    this.loadError = ''
    this.createError = ''
  }

  private handleUnauthorized(error: unknown, identity: number): boolean {
    if (error instanceof HttpError && error.status === 401) {
      authStore.expireSession(identity)
      return true
    }
    return false
  }

  private startPolling(): void {
    if (this.pollTimer !== null) return
    // 有在途作业时才轮询；终态后自动停止，避免长期空请求。
    this.pollTimer = setInterval(() => { void this.refresh() }, 1000)
  }

  stopPolling(): void {
    if (this.pollTimer === null) return
    clearInterval(this.pollTimer)
    this.pollTimer = null
  }

  clearCreateError(): void {
    this.createError = ''
  }

  async refresh(): Promise<void> {
    const identity = authStore.identityVersion
    if (!this.isCurrent(identity)) return
    const version = ++this.loadVersion
    this.loadError = ''

    try {
      const jobs = await jobsApi.getJobs()
      if (!this.isCurrent(identity) || version !== this.loadVersion) return
      runInAction(() => {
        this.jobs = jobs
        if (this.hasActive) this.startPolling()
        else this.stopPolling()
      })
    } catch (error) {
      runInAction(() => {
        if (!this.isCurrent(identity) || version !== this.loadVersion) return
        if (this.handleUnauthorized(error, identity)) return
        this.loadError = error instanceof Error ? error.message : '作业查询失败'
        this.stopPolling()
      })
    }
  }

  async createJob(label: string): Promise<boolean> {
    if (!this.isCurrent(authStore.identityVersion) || authStore.user === null || authStore.loggingOut || this.creating) return false
    const identity = authStore.identityVersion
    const csrfToken = authStore.csrfToken
    // 提交会使此前开始的轮询结果过期，不能让旧列表覆盖新作业。
    this.loadVersion += 1
    this.creating = true
    this.createError = ''

    try {
      const job = await jobsApi.createJob({ label }, csrfToken)
      if (!this.isCurrent(identity)) return false
      runInAction(() => {
        this.jobs = [job, ...this.jobs].slice(0, 20)
        this.startPolling()
      })
      return true
    } catch (error) {
      runInAction(() => {
        if (!this.isCurrent(identity) || this.handleUnauthorized(error, identity)) return
        this.createError = error instanceof Error ? error.message : '提交作业失败'
      })
      return false
    } finally {
      runInAction(() => {
        if (this.isCurrent(identity)) this.creating = false
      })
    }
  }
}

export const jobsStore = new JobsStore()
