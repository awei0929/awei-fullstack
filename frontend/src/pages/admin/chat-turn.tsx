import { observer } from 'mobx-react-lite'
import { ChatMarkdown } from '../../components/chat-markdown'
import { ChatCopyButton } from '../../components/chat-markdown/copy-button'
import { MemorySaveButton } from './chat-memory-panel'
import type { ChatStatus, ChatTurn } from '../../types/chat'
import styles from './chat-panel.module.less'

const statuses: Record<Exclude<ChatStatus, 'completed'>, string> = { streaming: '正在生成', canceled: '已停止', failed: '生成失败', interrupted: '连接中断' }

// 每轮只订阅自己的正文；活动回复增量不会重新解析已完成回复。
export const ChatTurnCard = observer(function ChatTurnCard({ turn, busy, onEdit }: { turn: ChatTurn; busy: boolean; onEdit: (turn: ChatTurn) => void }) {
  return <article className={styles.turn} aria-label="一轮对话">
    <div className={styles.question}>
      <div className={styles.questionHeading}><strong>你</strong><button type="button" disabled={busy} onClick={() => onEdit(turn)}>重新编辑</button></div>
      <p>{turn.content}</p>
    </div>
    <div className={styles.answer}>
      <div className={styles.answerHeader}>
        <span className={styles.assistantAvatar} aria-hidden="true">H<span>.</span></span>
        <div className={styles.assistantIdentity}><strong title={turn.modelLabel}>{turn.modelLabel}</strong></div>
        {turn.status !== 'completed' && <span className={`${styles.turnStatus} ${turn.status === 'streaming' ? styles.streamingStatus : ''} ${turn.status === 'failed' || turn.status === 'interrupted' ? styles.failureStatus : ''}`}><i aria-hidden="true" />{turn.status === 'streaming' && !turn.answer ? '等待回复' : statuses[turn.status]}</span>}
      </div>
      {turn.modelId !== turn.requestedModelId && <p className={styles.fallbackNotice}>因限流自动切换自 {turn.requestedModelLabel}</p>}
      <div className={styles.answerBody}>
        {turn.answer ? <ChatMarkdown content={turn.answer} /> : <p className={styles.answerPlaceholder}>{turn.status === 'streaming' ? '正在等待模型回复…' : '本次没有生成回复'}</p>}
        {turn.error && <p role="alert" className={styles.turnError}>{turn.error}</p>}
      </div>
      {turn.answer && turn.status !== 'streaming' && <div className={styles.messageActions}><ChatCopyButton text={turn.answer} label="复制回复" className={styles.copyButton} /><MemorySaveButton content={turn.answer} /></div>}
    </div>
  </article>
})
