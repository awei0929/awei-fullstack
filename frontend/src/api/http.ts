export class HttpError extends Error {
  readonly status: number
  readonly code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
  }
}

interface RequestOptions extends RequestInit {
  csrfToken?: string
}

export async function requestResponse(path: string, options: RequestOptions = {}): Promise<Response> {
  const { csrfToken, ...init } = options
  const headers = new Headers(init.headers)
  if (csrfToken) headers.set('X-CSRF-Token', csrfToken)
  let response: Response

  try {
    response = await fetch(`/api${path}`, {
      ...init,
      headers,
      credentials: 'same-origin',
      cache: 'no-store',
    })
  } catch (error) {
    if (init.signal?.aborted) throw error
    throw new Error('无法连接服务，请检查网络后重试')
  }

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null)
    const message = body && typeof body === 'object' && 'message' in body
      ? body.message
      : null
    throw new HttpError(
      Array.isArray(message)
        ? message.join('；')
        : typeof message === 'string'
          ? message
          : `请求失败（${response.status}），请稍后重试`,
      response.status,
      body && typeof body === 'object' && 'code' in body && typeof body.code === 'string' ? body.code : undefined,
    )
  }

  return response
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await requestResponse(path, options)
  const body: unknown = await response.json().catch(() => null)
  if (body === null) throw new Error('接口没有返回有效的 JSON 数据')
  return body as T
}
