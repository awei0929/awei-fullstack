import { makeAutoObservable, reaction, runInAction } from 'mobx'
import * as tasksApi from '../api/tasks'
import * as statsApi from '../api/stats'
import { HttpError } from '../api/http'
import { authStore } from './auth'
import type { Task } from '../types/task'
import type { TaskStats } from '../types/stats'

class TasksStore {
  tasks: Task[] = []
  loading = false
  creating = false
  editingTaskId: string | null = null
  deletingTaskId: string | null = null
  stats: TaskStats | null = null
  statsLoading = false
  loadError = ''
  createError = ''
  editError = ''
  deleteError = ''
  statsError = ''
  private loadVersion = 0
  private statsVersion = 0

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

  get isMutating(): boolean {
    return this.creating || this.editingTaskId !== null || this.deletingTaskId !== null
  }

  private isCurrent(identity: number): boolean {
    return authStore.ready && identity === authStore.identityVersion
  }

  private reset(): void {
    this.loadVersion += 1
    this.statsVersion += 1
    this.tasks = []
    this.stats = null
    this.loading = false
    this.statsLoading = false
    this.creating = false
    this.editingTaskId = null
    this.deletingTaskId = null
    this.loadError = ''
    this.statsError = ''
    this.createError = ''
    this.editError = ''
    this.deleteError = ''
  }

  private handleUnauthorized(error: unknown, identity: number): boolean {
    if (error instanceof HttpError && error.status === 401) {
      authStore.expireSession(identity)
      return true
    }
    return false
  }

  private canWrite(): boolean {
    return authStore.ready && authStore.user !== null && !authStore.loggingOut && !this.isMutating
  }

  private invalidateReads(): void {
    // A read started before a write must not replace the write's updated list/count.
    this.loadVersion += 1
    this.statsVersion += 1
    this.loading = false
    this.statsLoading = false
  }

  async refresh(): Promise<void> {
    if (!authStore.ready || this.isMutating) return
    await Promise.all([this.loadTasks(), this.loadStats()])
  }

  async loadStats(identity = authStore.identityVersion): Promise<void> {
    if (!this.isCurrent(identity)) return
    const version = ++this.statsVersion
    const isPrivate = authStore.user !== null
    this.statsLoading = true
    this.statsError = ''

    try {
      const stats = await statsApi.getTaskStats(isPrivate)
      runInAction(() => {
        if (this.isCurrent(identity) && version === this.statsVersion) this.stats = stats
      })
    } catch (error) {
      runInAction(() => {
        if (!this.isCurrent(identity) || version !== this.statsVersion) return
        if (this.handleUnauthorized(error, identity)) return
        this.stats = null
        this.statsError = error instanceof Error ? error.message : '统计查询失败'
      })
    } finally {
      runInAction(() => {
        if (this.isCurrent(identity) && version === this.statsVersion) this.statsLoading = false
      })
    }
  }

  async loadTasks(): Promise<void> {
    const identity = authStore.identityVersion
    if (!this.isCurrent(identity)) return
    const version = ++this.loadVersion
    const isPrivate = authStore.user !== null
    this.loading = true
    this.loadError = ''

    try {
      const tasks = await tasksApi.getTasks(isPrivate)
      runInAction(() => {
        if (this.isCurrent(identity) && version === this.loadVersion) this.tasks = tasks
      })
    } catch (error) {
      runInAction(() => {
        if (!this.isCurrent(identity) || version !== this.loadVersion) return
        if (this.handleUnauthorized(error, identity)) return
        this.loadError = error instanceof Error ? error.message : '查询失败'
      })
    } finally {
      runInAction(() => {
        if (this.isCurrent(identity) && version === this.loadVersion) this.loading = false
      })
    }
  }

  async createTask(title: string): Promise<boolean> {
    if (!this.canWrite()) return false
    const identity = authStore.identityVersion
    const csrfToken = authStore.csrfToken
    this.invalidateReads()
    this.creating = true
    this.createError = ''

    try {
      const task = await tasksApi.createTask({ title }, csrfToken)
      if (!this.isCurrent(identity)) return false
      runInAction(() => { this.tasks.push(task) })
      await this.loadStats(identity)
      return this.isCurrent(identity)
    } catch (error) {
      runInAction(() => {
        if (!this.isCurrent(identity) || this.handleUnauthorized(error, identity)) return
        this.createError = error instanceof Error ? error.message : '创建失败'
      })
      return false
    } finally {
      runInAction(() => {
        if (this.isCurrent(identity)) this.creating = false
      })
    }
  }

  clearEditError(): void {
    this.editError = ''
  }

  async editTask(id: string, title: string): Promise<boolean> {
    if (!this.canWrite()) return false
    const identity = authStore.identityVersion
    const csrfToken = authStore.csrfToken
    this.invalidateReads()
    this.editingTaskId = id
    this.editError = ''

    try {
      const updatedTask = await tasksApi.editTask({ id, title }, csrfToken)
      if (!this.isCurrent(identity)) return false
      runInAction(() => {
        const index = this.tasks.findIndex((task) => task.id === updatedTask.id)
        if (index !== -1) this.tasks[index] = updatedTask
      })
      return true
    } catch (error) {
      runInAction(() => {
        if (!this.isCurrent(identity) || this.handleUnauthorized(error, identity)) return
        this.editError = error instanceof Error ? error.message : '编辑失败'
      })
      return false
    } finally {
      runInAction(() => {
        if (this.isCurrent(identity)) this.editingTaskId = null
      })
    }
  }

  clearDeleteError(): void {
    this.deleteError = ''
  }

  async deleteTask(id: string): Promise<boolean> {
    if (!this.canWrite()) return false
    const identity = authStore.identityVersion
    const csrfToken = authStore.csrfToken
    this.invalidateReads()
    this.deletingTaskId = id
    this.deleteError = ''

    try {
      const removedTask = await tasksApi.deleteTask(id, csrfToken)
      if (!this.isCurrent(identity)) return false
      runInAction(() => { this.tasks = this.tasks.filter((task) => task.id !== removedTask.id) })
      await this.loadStats(identity)
      return this.isCurrent(identity)
    } catch (error) {
      runInAction(() => {
        if (!this.isCurrent(identity) || this.handleUnauthorized(error, identity)) return
        this.deleteError = error instanceof Error ? error.message : '删除失败'
      })
      return false
    } finally {
      runInAction(() => {
        if (this.isCurrent(identity)) this.deletingTaskId = null
      })
    }
  }
}

export const tasksStore = new TasksStore()
