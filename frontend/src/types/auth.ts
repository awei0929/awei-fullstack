export interface User {
  id: string
  account: string
}

export interface SessionView {
  user: User | null
  csrfToken: string
}

export interface AuthInput {
  account: string
  password: string
}

export type AuthMode = 'login' | 'register'
