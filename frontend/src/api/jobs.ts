import type { CreateJobInput, Job } from '../types/job'
import { request } from './http'

export function getJobs(): Promise<Job[]> {
  return request<Job[]>('/jobs')
}

export function createJob(input: CreateJobInput, csrfToken: string): Promise<Job> {
  return request<Job>('/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    csrfToken,
    body: JSON.stringify(input),
  })
}
