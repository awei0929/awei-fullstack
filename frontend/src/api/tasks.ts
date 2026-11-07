import type { CreateTaskInput, EditTaskInput, Task } from '../types/task'
import { request } from './http'

export function getTasks(isPrivate: boolean): Promise<Task[]> {
  return request<Task[]>(isPrivate ? '/tasks' : '/public/tasks')
}

export function createTask(input: CreateTaskInput, csrfToken: string): Promise<Task> {
  return request<Task>('/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    csrfToken,
    body: JSON.stringify(input),
  })
}

export function editTask(input: EditTaskInput, csrfToken: string): Promise<Task> {
  return request<Task>(`/tasks/${encodeURIComponent(input.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    csrfToken,
    body: JSON.stringify({ title: input.title }),
  })
}

export function deleteTask(id: string, csrfToken: string): Promise<Task> {
  return request<Task>(`/tasks/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    csrfToken,
  })
}
