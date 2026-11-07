import type { TaskStats } from '../types/stats'
import { request } from './http'

export function getTaskStats(isPrivate: boolean): Promise<TaskStats> {
  return request<TaskStats>(isPrivate ? '/stats' : '/public/stats')
}
