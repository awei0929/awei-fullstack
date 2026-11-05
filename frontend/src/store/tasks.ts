import { makeAutoObservable, runInAction } from 'mobx'
import * as tasksApi from '../api/tasks'
import * as statsApi from '../api/stats'
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
  }

  get isMutating(): boolean {
    return this.creating || this.editingTaskId !== null || this.deletingTaskId !== null
  }

  async refresh(): Promise<void> {
    if (this.isMutating) return
    await Promise.all([this.loadTasks(), this.loadStats()])
  }

  async loadStats(): Promise<void> {
    const version = ++this.statsVersion
    this.statsLoading = true
    this.statsError = ''

    try {
      const stats = await statsApi.getTaskStats()
      runInAction(() => {
        if (version === this.statsVersion) this.stats = stats
      })
    } catch (error) {
      runInAction(() => {
        if (version === this.statsVersion) {
          this.stats = null
          this.statsError = error instanceof Error ? error.message : '统计查询失败'
        }
      })
    } finally {
      runInAction(() => {
        if (version === this.statsVersion) this.statsLoading = false
      })
    }
  }

  async loadTasks(): Promise<void> {
    const version = ++this.loadVersion
    this.loading = true
    this.loadError = ''

    try {
      const tasks = await tasksApi.getTasks()
      runInAction(() => {
        if (version === this.loadVersion) this.tasks = tasks
      })
    } catch (error) {
      runInAction(() => {
        if (version === this.loadVersion) {
          this.loadError = error instanceof Error ? error.message : '查询失败'
        }
      })
    } finally {
      runInAction(() => {
        if (version === this.loadVersion) this.loading = false
      })
    }
  }

  async createTask(title: string): Promise<boolean> {
    if (this.isMutating) return false
    this.creating = true
    this.createError = ''

    try {
      const task = await tasksApi.createTask({ title })
      runInAction(() => {
        this.tasks.push(task)
      })
      await this.loadStats()
      return true
    } catch (error) {
      runInAction(() => {
        this.createError = error instanceof Error ? error.message : '创建失败'
      })
      return false
    } finally {
      runInAction(() => {
        this.creating = false
      })
    }
  }

  clearEditError(): void {
    this.editError = ''
  }

  async editTask(id: string, title: string): Promise<boolean> {
    if (this.isMutating) return false

    this.editingTaskId = id
    this.editError = ''

    try {
      const updatedTask = await tasksApi.editTask({ id, title })
      runInAction(() => {
        const index = this.tasks.findIndex((task) => task.id === updatedTask.id)
        if (index !== -1) this.tasks[index] = updatedTask
      })
      return true
    } catch (error) {
      runInAction(() => {
        this.editError = error instanceof Error ? error.message : '编辑失败'
      })
      return false
    } finally {
      runInAction(() => {
        this.editingTaskId = null
      })
    }
  }

  clearDeleteError(): void {
    this.deleteError = ''
  }

  async deleteTask(id: string): Promise<boolean> {
    if (this.isMutating) return false
    this.deletingTaskId = id
    this.deleteError = ''

    try {
      const removedTask = await tasksApi.deleteTask(id)
      runInAction(() => {
        this.tasks = this.tasks.filter((task) => task.id !== removedTask.id)
      })
      await this.loadStats()
      return true
    } catch (error) {
      runInAction(() => {
        this.deleteError = error instanceof Error ? error.message : '删除失败'
      })
      return false
    } finally {
      runInAction(() => {
        this.deletingTaskId = null
      })
    }
  }
}

export const tasksStore = new TasksStore()
