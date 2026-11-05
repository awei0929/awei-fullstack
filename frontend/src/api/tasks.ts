import type { CreateTaskInput, EditTaskInput, Task } from '../types/task'
import { request } from './http'

// 与后端学习守卫约定的公开演示值，写入请求携带它以观察守卫放行。
const learningWriteHeaders = { 'X-Learning-Key': 'awei-learning' }

export function getTasks(): Promise<Task[]> {
  return request<Task[]>('/tasks')
}

export function createTask(input: CreateTaskInput): Promise<Task> {
  return request<Task>('/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...learningWriteHeaders },
    body: JSON.stringify(input),
  })
}

export function editTask(input: EditTaskInput): Promise<Task> {
  return request<Task>(`/tasks/${encodeURIComponent(input.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...learningWriteHeaders },
    body: JSON.stringify({ title: input.title }),
  })
}

export function deleteTask(id: string): Promise<Task> {
  return request<Task>(`/tasks/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: learningWriteHeaders,
  })
}
