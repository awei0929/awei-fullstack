import assert from 'node:assert/strict'
import { test } from 'node:test'
import { filterConversations, isNearConversationEnd, shouldSendFromKeyboard, visibleSendError, selectHistoryConversation } from '../src/pages/admin/chat-workspace.ts'

test('history search trims input, matches case-insensitively and preserves recent order', () => {
  const conversations = [{ id: 'recent', title: '官网 TypeScript 方案' }, { id: 'old', title: '项目梳理' }]
  assert.deepEqual(filterConversations(conversations, '  typescript  '), [conversations[0]])
  assert.deepEqual(filterConversations(conversations, '项目'), [conversations[1]])
  assert.deepEqual(filterConversations(conversations, '不存在'), [])
  assert.deepEqual(filterConversations(conversations, '  '), conversations)
})

test('stream following stops while reading earlier content and tolerates a short viewport', () => {
  assert.equal(isNearConversationEnd({ scrollHeight: 1800, clientHeight: 600, scrollTop: 600 }), false)
  assert.equal(isNearConversationEnd({ scrollHeight: 1800, clientHeight: 600, scrollTop: 1190 }), true)
  assert.equal(isNearConversationEnd({ scrollHeight: 300, clientHeight: 600, scrollTop: 0 }), true)
})

test('only modified Enter sends and IME composition or keyCode 229 never sends', () => {
  const key = { key: 'Enter', ctrlKey: false, metaKey: false, isComposing: false, keyCode: 13 }
  assert.equal(shouldSendFromKeyboard(key), false)
  assert.equal(shouldSendFromKeyboard({ ...key, ctrlKey: true }), true)
  assert.equal(shouldSendFromKeyboard({ ...key, metaKey: true }), true)
  assert.equal(shouldSendFromKeyboard({ ...key, ctrlKey: true, isComposing: true }), false)
  assert.equal(shouldSendFromKeyboard({ ...key, metaKey: true, keyCode: 229 }), false)
  assert.equal(shouldSendFromKeyboard({ ...key, ctrlKey: true, key: 'a' }), false)
})

test('a turn error appears once while unrelated send failures remain actionable', () => {
  assert.equal(visibleSendError('上游暂时不可用', '上游暂时不可用'), '')
  assert.equal(visibleSendError('创建失败', '上游暂时不可用'), '创建失败')
  assert.equal(visibleSendError('安全校验已更新', null), '安全校验已更新')
})

test('selecting the current history item closes and focuses without detaching the active request', async () => {
  const events = []
  await selectHistoryConversation('active', 'active', {
    close: () => events.push('close'),
    select: async () => { assert.fail('重新选择当前会话不应读取历史或中止生成') },
    focus: () => events.push('focus'),
  })
  assert.deepEqual(events, ['close', 'focus'])
})

test('selecting another history item closes immediately and focuses only after the selected history loads', async () => {
  const events = []
  let finishRead
  const selected = selectHistoryConversation('other', 'active', {
    close: () => events.push('close'),
    select: id => {
      events.push(`read:${id}`)
      return new Promise(resolve => { finishRead = resolve })
    },
    focus: () => events.push('focus'),
  })
  assert.deepEqual(events, ['close', 'read:other'])
  finishRead()
  await selected
  assert.deepEqual(events, ['close', 'read:other', 'focus'])
})
