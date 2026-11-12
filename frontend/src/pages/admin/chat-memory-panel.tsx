import { useEffect, useRef } from 'react'
import { Alert, Button, Input, Modal, Spin, Switch } from 'antd'
import { observer } from 'mobx-react-lite'
import { chatMemoryStore as store } from '../../store/chat-memory'
import styles from './chat-memory-panel.module.less'

// oxlint-disable-next-line react/only-export-components -- observer导出组件共用的私有图标。
function MemoryMark() {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5 3.5h10v13l-5-3-5 3zM8 7h4M8 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

export const MemorySaveButton = observer(function MemorySaveButton({ content }: { content: string }) {
  return <button className={styles.inlineButton} type="button" disabled={store.busy || store.forbidden} onClick={() => store.openManager(content)} aria-label="保存为记忆"><MemoryMark />记住</button>
})

// 管理入口只在聊天工作区挂载一次，回复上的“记住”按钮共用同一表单和身份状态。
export const ChatMemoryPanel = observer(function ChatMemoryPanel() {
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const addRef = useRef<HTMLButtonElement>(null)
  const editorOpen = store.editorOpen, editingId = store.editingId, open = store.open
  useEffect(() => { store.activate(); return () => store.deactivate() }, [])
  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => { if (editorOpen) inputRef.current?.focus(); else addRef.current?.focus() })
    return () => cancelAnimationFrame(frame)
  }, [open, editorOpen, editingId])
  return <>
    <button className={styles.entry} type="button" onClick={() => store.openManager()} disabled={store.forbidden} aria-label="管理记忆"><MemoryMark /><span>记忆</span>{store.enabledCount > 0 && <small>{store.enabledCount}</small>}</button>
    <Modal className={styles.modal} open={store.open} title="长期记忆" width={680} footer={null} onCancel={store.close} closable={!store.busy} keyboard={!store.busy} mask={{ closable: !store.busy }} afterOpenChange={visible => { if (visible) { if (store.editorOpen) inputRef.current?.focus(); else addRef.current?.focus() } }}>
      <div className={styles.intro}><p>把希望以后还记得的偏好与背景，留在这里</p><span>启用的记忆会随消息发送给所选模型，修改将在后续对话生效</span></div>
      <div className={styles.toolbar}><p><strong>{store.enabledCount}</strong> 条启用 <span>共 {store.memories.length} / 20 条</span></p><button ref={addRef} type="button" className={styles.add} disabled={store.busy || store.memories.length >= 20} onClick={() => store.startNew()}>添加记忆</button></div>
      {store.loadError && <Alert type="error" title={store.loadError} action={<Button size="small" disabled={store.busy} onClick={() => void store.load()}>重新读取</Button>} />}
      {store.notice && <p className={styles.notice} role="status">{store.notice}</p>}
      {store.writeError && <p className={styles.error} role="alert">{store.writeError}</p>}
      {store.editorOpen && <form className={styles.editor} onSubmit={event => { event.preventDefault(); void store.save() }}>
        <label htmlFor="chat-memory-content">{store.editingId ? '编辑记忆' : '记忆内容'}</label>
        <Input.TextArea id="chat-memory-content" ref={element => { inputRef.current = element?.resizableTextArea?.textArea ?? null }} rows={4} autoSize={{ minRows: 3, maxRows: 8 }} disabled={store.busy} value={store.draft} onChange={event => store.setDraft(event.target.value)} placeholder="例如：技术问题先说明思路，再给 TypeScript 示例" aria-describedby="chat-memory-count" />
        <div className={styles.editorFooter}><span id="chat-memory-count" className={store.draftLength > 500 ? styles.error : ''}>{store.draftLength} / 500 字</span><button type="button" className={styles.textAction} disabled={store.busy} onClick={store.cancelEdit}>取消编辑</button><Button type="primary" htmlType="submit" disabled={!store.canSave} loading={store.busy}>保存记忆</Button></div>
        {store.draftLength > 500 && <p className={styles.error}>内容较长，请摘录你希望长期记住的部分</p>}
      </form>}
      <div className={styles.list} aria-label="已保存的记忆" aria-busy={store.loading}>
        {store.loading ? <div className={styles.empty}><Spin /><p>正在读取记忆</p></div> : !store.memories.length ? <div className={styles.empty}><MemoryMark /><h3>下一次，不必从头介绍</h3><p>保存你的表达偏好、项目背景或常用约定<br />也可以在回复下点击“记住”，先编辑再保存</p></div> : store.memories.map((item, index) => <article key={item.id} className={`${styles.item} ${!item.enabled ? styles.inactive : ''}`} aria-label={`记忆 ${index + 1}`}>
          <div className={styles.itemTop}><span>{item.enabled ? '已启用' : '已停用'}</span><Switch size="small" aria-label={`启用记忆 ${index + 1}`} checked={item.enabled} disabled={store.busy} onChange={() => void store.toggle(item)} /></div>
          <p className={styles.content}>{item.content}</p>
          <div className={styles.itemBottom}><time dateTime={item.updatedAt}>{new Date(item.updatedAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}更新</time><button className={styles.textAction} type="button" aria-label={`编辑记忆 ${index + 1}`} disabled={store.busy} onClick={() => store.edit(item)}>编辑</button><button className={styles.textAction} type="button" aria-label={`删除记忆 ${index + 1}`} disabled={store.busy} onClick={() => store.askDelete(item.id)}>删除</button></div>
          {store.deleteId === item.id && <div className={styles.confirm} role="group" aria-label="确认删除记忆"><p>删除后，后续对话不再使用这条记忆</p><div><button type="button" disabled={store.busy} onClick={store.cancelDelete}>保留记忆</button><button type="button" className={styles.deleteButton} disabled={store.busy} onClick={() => void store.remove()}>确认删除</button></div></div>}
        </article>)}
      </div>
      <p className={styles.footnote}>记忆由你选择保存，不会自动从对话中提取</p>
    </Modal>
  </>
})
