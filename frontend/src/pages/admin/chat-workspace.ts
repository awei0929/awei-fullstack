/** 页面交互策略：不直接请求接口，便于验证键盘、滚动与会话选择边界。 */
export function filterConversations<T extends { title: string }>(conversations: T[], query: string): T[] {
  const term = query.trim().toLocaleLowerCase()
  return term ? conversations.filter(item => item.title.toLocaleLowerCase().includes(term)) : conversations
}

export function isNearConversationEnd(area: { scrollHeight: number; clientHeight: number; scrollTop: number }): boolean {
  return area.scrollHeight - area.clientHeight - area.scrollTop < 80
}

export function shouldSendFromKeyboard(event: { key: string; ctrlKey: boolean; metaKey: boolean; isComposing: boolean; keyCode: number }): boolean {
  // 部分浏览器的中文候选确认只提供 229，仍需与 isComposing 一起保护。
  return event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.isComposing && event.keyCode !== 229
}

export function visibleSendError(error: string, turnError: string | null | undefined): string {
  return error === turnError ? '' : error
}

interface HistorySelectionActions {
  close: () => void
  select: (id: string) => Promise<void>
  focus: () => void
}

export async function selectHistoryConversation(id: string, selectedId: string | null, actions: HistorySelectionActions): Promise<void> {
  actions.close()
  // 历史列表允许点当前项来收起抽屉；不能因此触发 store 的 detachRun。
  if (id !== selectedId) await actions.select(id)
  actions.focus()
}
