export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response

  try {
    response = await fetch(`/api${path}`, options)
  } catch {
    throw new Error('无法连接服务，请确认前后端都已启动')
  }

  const body: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const message = body && typeof body === 'object' && 'message' in body
      ? body.message
      : null
    throw new Error(
      Array.isArray(message)
        ? message.join('；')
        : typeof message === 'string'
          ? message
          : `请求失败（${response.status}），请检查后端服务`,
    )
  }

  if (body === null) throw new Error('接口没有返回有效的 JSON 数据')
  return body as T
}
