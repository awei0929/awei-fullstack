import { useEffect, useState } from 'react'
import { Alert, Button, ConfigProvider, Select, Spin, theme } from 'antd'
import { observer } from 'mobx-react-lite'
import { chatLogsStore as store } from '../../store/chat-logs'
import type { ChatLog, ChatLogChannel, ChatLogStatus } from '../../types/chat-log'
import styles from './logs-panel.module.less'

const CHANNEL_LABEL: Record<ChatLogChannel, string> = { site: '公开对话', owner: '站主对话' }
const STATUS_LABEL: Record<ChatLogStatus, string> = {
  streaming: '生成中',
  completed: '已完成',
  failed: '失败',
  canceled: '已取消',
  interrupted: '已中断',
}

function timeLabel(value: string): string {
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function durationLabel(log: ChatLog): string {
  if (log.durationMs === null) return log.status === 'streaming' ? '生成中' : '未记录耗时'
  if (log.durationMs < 1000) return `${log.durationMs} ms`
  return `${(log.durationMs / 1000).toFixed(log.durationMs < 10000 ? 1 : 0)} s`
}

// 单条回答超过这个长度时先截断展示，避免刷新页面就把全部历史正文塞进 DOM。
const ANSWER_PREVIEW = 360

export const LogsPanel = observer(function LogsPanel() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    store.activate()
    return () => store.deactivate()
  }, [])

  return <ConfigProvider theme={{ algorithm: theme.defaultAlgorithm, token: { colorPrimary: '#555f3c', colorBgBase: '#ffffff', colorText: '#272925', colorTextSecondary: '#656961', colorTextPlaceholder: '#777b73', colorBorder: '#dcded7', borderRadius: 8, fontFamily: 'inherit' } }}>
    <section className={styles.panel} aria-label="对话日志">
      <header className={styles.toolbar}>
        <div className={styles.filters}>
          <Select
            aria-label="按对话入口筛选"
            value={store.channel}
            className={styles.select}
            options={[
              { value: 'all', label: '全部入口' },
              { value: 'site', label: '公开对话' },
              { value: 'owner', label: '站主对话' },
            ]}
            onChange={(value: ChatLogChannel | 'all') => store.setChannel(value)}
          />
          <Select
            aria-label="按状态筛选"
            value={store.status}
            className={styles.select}
            options={[
              { value: 'all', label: '全部状态' },
              ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })),
            ]}
            onChange={(value: ChatLogStatus | 'all') => store.setStatus(value)}
          />
        </div>
        <div className={styles.summary}>
          <span aria-live="polite">共 {store.total} 条</span>
          <Button size="small" loading={store.loading} onClick={store.refresh}>刷新</Button>
        </div>
      </header>

      <div className={styles.scroll} aria-busy={store.loading}>
        {store.error && <Alert
          className={styles.alert}
          type="error"
          showIcon
          title={store.error}
          action={<Button size="small" onClick={store.refresh}>重试</Button>}
        />}
        {store.loading && !store.logs.length ? <div className={styles.loading}><Spin /><p>正在读取对话日志…</p></div>
          : store.loaded && !store.logs.length && !store.error ? <div className={styles.empty}>
            <h2>{store.channel === 'all' && store.status === 'all' ? '还没有对话日志' : '当前筛选下没有日志'}</h2>
            <p>{store.channel === 'all' && store.status === 'all' ? '访客或站主发起一轮对话后，这里会出现记录。' : '切换入口或状态筛选查看其他记录。'}</p>
          </div>
            : <div className={styles.list}>
              {store.logs.map((log) => {
                const isLong = Array.from(log.answer).length > ANSWER_PREVIEW
                const isOpen = Boolean(expanded[log.id])
                const answer = isLong && !isOpen ? `${Array.from(log.answer).slice(0, ANSWER_PREVIEW).join('')}…` : log.answer
                return <article className={styles.card} key={log.id}>
                  <div className={styles.cardHead}>
                    <div className={styles.meta}>
                      <time dateTime={log.startedAt}>{timeLabel(log.startedAt)}</time>
                      <span className={styles.channel}>{CHANNEL_LABEL[log.channel]}</span>
                    </div>
                    <div className={styles.state}>
                      <span className={`${styles.status} ${styles[log.status]}`}>{STATUS_LABEL[log.status]}</span>
                      <span className={styles.duration} title="从受理到生成结束的耗时">{durationLabel(log)}</span>
                    </div>
                  </div>
                  <div className={styles.block}>
                    <span className={styles.label}>用户提问</span>
                    <p className={styles.question}>{log.question}</p>
                  </div>
                  <div className={styles.block}>
                    <span className={styles.label}>回答</span>
                    {log.answer ? <p className={styles.answer}>{answer}</p> : <p className={styles.emptyAnswer}>未生成回答</p>}
                    {isLong && <button type="button" className={styles.expand} onClick={() => setExpanded((current) => ({ ...current, [log.id]: !isOpen }))}>{isOpen ? '收起回答' : `展开全文（${Array.from(log.answer).length} 字）`}</button>}
                  </div>
                  <p className={`${styles.error} ${log.error ? styles.hasError : ''}`}>错误：{log.error ?? '无错误'}</p>
                </article>
              })}
            </div>}
      </div>

      {store.total > 0 && <footer className={styles.pager}>
        <span>第 {store.page} / {store.pageCount} 页</span>
        <div>
          <Button size="small" disabled={!store.hasPrevious || store.loading} onClick={store.previous}>上一页</Button>
          <Button size="small" disabled={!store.hasNext || store.loading} onClick={store.next}>下一页</Button>
        </div>
      </footer>}
    </section>
  </ConfigProvider>
})
