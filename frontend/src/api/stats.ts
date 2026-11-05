import type { TaskStats } from '../types/stats'
import { request } from './http'

export function getTaskStats(): Promise<TaskStats> {
  return request<TaskStats>('/stats')
}
