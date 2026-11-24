export type JobStatus = 'pending' | 'running' | 'done' | 'failed'

// 与后端 JobView 对齐；不包含 ownerId、租约等内部字段。
export interface Job {
  id: string
  label: string
  status: JobStatus
  progress: number
  result: string
  error: string | null
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
}

export interface CreateJobInput {
  label: string
}
