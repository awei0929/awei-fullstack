import { useEffect, useState } from 'react'
import { Alert, Button, ConfigProvider, Drawer, Select, Spin, theme } from 'antd'
import { observer } from 'mobx-react-lite'
import { chatLogsStore as store } from '../../store/chat-logs'
import type { ChatLog, ChatLogChannel, ChatLogStatus, ChatLogTraceStatus } from '../../types/chat-log'
import styles from './logs-panel.module.less'

const CHANNEL_LABEL: Record<ChatLogChannel, string> = { site: '公开对话', owner: '站主对话' }
const STATUS_LABEL: Record<ChatLogStatus, string> = {
  streaming: '生成中',
  completed: '已完成',
  failed: '失败',
  canceled: '已取消',
  interrupted: '已中断',
}
const TRACE_STATUS_LABEL: Record<ChatLogTraceStatus, string> = {
  started: '开始',
  completed: '完成',
  failed: '失败',
}
const STAGE_LABEL: Record<string, string> = {
  request: '请求受理',
  'agent.loadConversation': 'Agent · 加载会话历史',
  'agent.buildContext': 'Agent · 构建上下文',
  'agent.agent': 'Agent · 生成回答',
  'model.request': '模型调用',
  'model.firstToken': '首 token',
  'model.fallback': '备用模型切换',
  stream: '流式输出结束',
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

function clockLabel(value: string): string {
  return new Date(value).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    hour12: false,
  })
}

function durationLabel(value: number | null): string {
  if (value === null) return '未记录'
  if (value < 1000) return `${value} ms`
  return `${(value / 1000).toFixed(value < 10000 ? 1 : 0)} s`
}

function logDuration(log: ChatLog): string {
  if (log.durationMs === null) return log.status === 'streaming' ? '生成中' : '未记录耗时'
  return durationLabel(log.durationMs)
}

function tokenLabel(log: ChatLog): string {
  if (log.totalTokens === null) return '未返回'
  return `输入 ${log.promptTokens ?? 0} / 输出 ${log.completionTokens ?? 0} / 合计 ${log.totalTokens}`
}

// 单条回答超过这个长度时先截断展示，避免刷新页面就把全部历史正文塞进 DOM。
const ANSWER_PREVIEW = 360

export const LogsPanel = observer(function LogsPanel() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    store.activate()
    return () => store.deactivate()
  }, [])

  const detail = store.detail

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
                      {log.modelLabel && <span className={styles.modelTag}>{log.modelLabel}{log.fallbackUsed ? ' · 备用' : ''}</span>}
                    </div>
                    <div className={styles.state}>
                      <span className={`${styles.status} ${styles[log.status]}`}>{STATUS_LABEL[log.status]}</span>
                      <span className={styles.duration} title="从受理到生成结束的耗时">{logDuration(log)}</span>
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
                  <div className={styles.cardFoot}>
                    <p className={`${styles.error} ${log.error ? styles.hasError : ''}`}>错误：{log.error ?? '无错误'}</p>
                    <button type="button" className={styles.detailButton} onClick={() => store.openDetail(log.id)}>查看详情 →</button>
                  </div>
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

      <Drawer
        open={Boolean(store.detailId)}
        onClose={store.closeDetail}
        width="min(560px, 100vw)"
        title="日志详情"
        className={styles.drawer}
        extra={<Button size="small" loading={store.detailLoading} onClick={store.retryDetail}>刷新详情</Button>}
      >
        {store.detailLoading && !detail ? <div className={styles.detailLoading}><Spin /><p>正在读取详情…</p></div> : null}
        {store.detailError ? <Alert
          type="error"
          showIcon
          title={store.detailError}
          action={<Button size="small" onClick={store.retryDetail}>重试</Button>}
        /> : null}
        {detail ? <div className={styles.detail}>
          <div className={styles.detailHead}>
            <div>
              <span className={styles.channel}>{CHANNEL_LABEL[detail.channel]}</span>
              <span className={`${styles.status} ${styles[detail.status]}`}>{STATUS_LABEL[detail.status]}</span>
            </div>
            <span className={styles.detailDuration}>{logDuration(detail)}</span>
          </div>

          <dl className={styles.facts}>
            <div><dt>模型</dt><dd>{detail.modelLabel ?? '未知'}{detail.modelId ? `（${detail.modelId}）` : ''}</dd></div>
            <div><dt>请求模型</dt><dd>{detail.requestedModelLabel ?? detail.requestedModelId ?? '未记录'}</dd></div>
            <div><dt>备用切换</dt><dd>{detail.fallbackUsed ? '是' : '否'}</dd></div>
            <div><dt>首 token</dt><dd>{durationLabel(detail.firstTokenMs)}</dd></div>
            <div><dt>Token 用量</dt><dd>{tokenLabel(detail)}</dd></div>
            <div><dt>开始时间</dt><dd>{timeLabel(detail.startedAt)}</dd></div>
            <div><dt>结束时间</dt><dd>{detail.finishedAt ? timeLabel(detail.finishedAt) : '尚未结束'}</dd></div>
            <div><dt>会话 ID</dt><dd className={styles.mono}>{detail.conversationId ?? '未记录'}</dd></div>
            <div><dt>轮次 ID</dt><dd className={styles.mono}>{detail.turnId ?? '未记录'}</dd></div>
          </dl>

          {detail.error && <div className={styles.detailError}><span>错误</span><p>{detail.error}</p></div>}

          <section className={styles.detailBlock}>
            <h3>用户提问</h3>
            <p>{detail.question}</p>
          </section>
          <section className={styles.detailBlock}>
            <h3>回答</h3>
            <p>{detail.answer || '未生成回答'}</p>
          </section>

          <section className={styles.detailBlock}>
            <h3>执行轨迹 <small>{detail.trace.length} 个事件</small></h3>
            {detail.channel === 'owner' && <p className={styles.note}>站主对话为直连模型，没有 LangGraph 节点；这里展示请求、模型调用、首 token 与结束事件。</p>}
            {detail.trace.length ? <ol className={styles.timeline}>{detail.trace.map((event, index) => <li className={`${styles.traceItem} ${styles[`trace_${event.status}`]}`} key={`${event.at}-${index}`}>
              <time className={styles.traceTime}>{clockLabel(event.at)}</time>
              <span className={styles.traceDot} aria-hidden="true" />
              <div className={styles.traceBody}>
                <div className={styles.traceTitle}>
                  <strong>{STAGE_LABEL[event.stage] ?? event.stage}</strong>
                  <span>{TRACE_STATUS_LABEL[event.status]}{event.durationMs !== null ? ` · ${durationLabel(event.durationMs)}` : ''}</span>
                </div>
                {event.detail && <p>{event.detail}</p>}
              </div>
            </li>)}</ol>
              : <p className={styles.note}>这条日志还没有轨迹。若是旧日志，它产生时尚未启用轨迹采集。</p>}
          </section>
        </div> : null}
      </Drawer>
    </section>
  </ConfigProvider>
})
