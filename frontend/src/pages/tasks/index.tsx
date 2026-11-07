import { useEffect, useState } from 'react'
import { Alert, Button, Empty, Form, Input, Modal, Spin, Tag, message } from 'antd'
import { observer } from 'mobx-react-lite'
import { AuthModal } from '../../components/auth-modal'
import { authStore } from '../../store/auth'
import { tasksStore } from '../../store/tasks'
import type { Task } from '../../types/task'
import styles from './style.module.less'

const formatTime = (value: string) => new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
}).format(new Date(value))

export const TasksPage = observer(function TasksPage() {
  const [authOpen, setAuthOpen] = useState(false)
  const [authReason, setAuthReason] = useState('')
  const promptVersion = authStore.loginPromptVersion

  useEffect(() => { void authStore.restoreSession() }, [])

  useEffect(() => {
    if (promptVersion > 0) {
      setAuthReason('登录已过期，请重新登录。')
      setAuthOpen(true)
    }
  }, [promptVersion])

  function requestLogin() {
    if (!authStore.ready || authStore.loggingOut) return
    authStore.clearAuthError()
    setAuthReason('')
    setAuthOpen(true)
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <a className={styles.brand} href="/" aria-label="awei 任务清单首页">
          <span className={styles.brandIcon} aria-hidden="true">a</span>
          <span>awei <span className={styles.brandDivider}>/</span> 任务清单</span>
        </a>
        {authStore.ready && (
          authStore.user ? (
            <div className={styles.accountControls}>
              <span className={styles.account}>账号 {authStore.user.account}</span>
              <Button onClick={() => void authStore.logout()} loading={authStore.loggingOut} disabled={authStore.loggingOut}>退出</Button>
            </div>
          ) : <Button onClick={requestLogin}>登录 / 注册</Button>
        )}
      </header>

      <main className={styles.main}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>{authStore.user ? '留一点空间，给重要的事' : '从小事开始，慢慢向前'}</p>
          <h1>从一条任务开始。</h1>
          <p className={styles.description}>
            {authStore.user ? '记录想做的事，专注下一步。你的任务仅自己可见。' : '先看看示例，登录后拥有一份属于自己的任务清单。'}
          </p>
        </div>

        {authStore.logoutError && (
          <Alert
            type="error"
            showIcon
            title="退出未完成"
            description={authStore.logoutError}
            action={<Button size="small" loading={authStore.loggingOut} disabled={authStore.loggingOut} onClick={() => void authStore.logout()}>重试退出</Button>}
            className={styles.sessionAlert}
          />
        )}

        {!authStore.ready ? (
          <section className={`${styles.panel} ${styles.sessionState}`} aria-live="polite">
            {authStore.status === 'error' ? (
              <Alert
                type="error"
                showIcon
                title="暂时无法确认登录状态"
                description={authStore.restoreError}
                action={<Button onClick={() => void authStore.restoreSession()}>重新连接</Button>}
              />
            ) : <><Spin /><p>正在恢复登录状态…</p></>}
          </section>
        ) : <TasksWorkspace key={authStore.identityVersion} requestLogin={requestLogin} />}
      </main>

      <AuthModal open={authOpen} reason={authReason} onClose={() => setAuthOpen(false)} />
    </div>
  )
})

export const TasksWorkspace = observer(function TasksWorkspace({ requestLogin }: { requestLogin: () => void }) {
  const [form] = Form.useForm<{ title: string }>()
  const [editForm] = Form.useForm<{ title: string }>()
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [deletingTask, setDeletingTask] = useState<Task | null>(null)
  const [messageApi, contextHolder] = message.useMessage()
  const guest = authStore.user === null
  const savingEdit = tasksStore.editingTaskId !== null
  const savingDelete = tasksStore.deletingTaskId !== null
  const busy = tasksStore.isMutating || authStore.loggingOut
  const refreshing = tasksStore.loading || tasksStore.statsLoading

  async function handleCreate({ title }: { title: string }) {
    if (!authStore.user) { requestLogin(); return }
    const identity = authStore.identityVersion
    if (await tasksStore.createTask(title.trim()) && identity === authStore.identityVersion) {
      form.resetFields()
      void messageApi.success('任务已创建')
    }
  }

  function openEdit(task: Task) {
    if (!authStore.user) { requestLogin(); return }
    tasksStore.clearEditError()
    editForm.resetFields()
    editForm.setFieldsValue({ title: task.title })
    setEditingTask(task)
  }

  function closeEdit() {
    if (savingEdit) return
    setEditingTask(null)
    tasksStore.clearEditError()
  }

  async function handleEdit({ title }: { title: string }) {
    if (!editingTask || savingEdit) return
    const identity = authStore.identityVersion
    if (await tasksStore.editTask(editingTask.id, title.trim()) && identity === authStore.identityVersion) {
      setEditingTask(null)
      void messageApi.success('任务已更新')
    }
  }

  function openDelete(task: Task) {
    if (!authStore.user) { requestLogin(); return }
    tasksStore.clearDeleteError()
    setDeletingTask(task)
  }

  function closeDelete() {
    if (savingDelete) return
    setDeletingTask(null)
    tasksStore.clearDeleteError()
  }

  async function handleDelete() {
    if (!deletingTask || savingDelete) return
    const identity = authStore.identityVersion
    if (await tasksStore.deleteTask(deletingTask.id) && identity === authStore.identityVersion) {
      setDeletingTask(null)
      void messageApi.success('任务已删除')
    }
  }

  return (
    <>
      {contextHolder}
      <section className={styles.statsPanel} aria-labelledby="stats-heading">
        <div>
          <h2 id="stats-heading" className={styles.statsHeading}>{guest ? '示例任务' : '我的任务'}</h2>
          <div className={styles.statsValue} aria-live="polite">
            {tasksStore.statsLoading ? '…' : tasksStore.stats?.total ?? '—'}
            <span>条</span>
          </div>
        </div>
        <div className={styles.statsDescription}>
          <Tag color={guest ? 'default' : 'green'}>{guest ? '只读预览' : '仅你可见'}</Tag>
          <p>{guest ? '示例不会加入你的个人清单' : '创建、删除后自动更新统计'}</p>
        </div>
        {tasksStore.statsError && (
          <Alert
            type="error"
            showIcon
            title="任务统计暂时不可用"
            description={`${tasksStore.statsError}，可点击刷新列表重试`}
            className={styles.statsError}
          />
        )}
      </section>

      <div className={styles.workspace}>
        <section className={styles.panel} aria-labelledby="tasks-heading">
          <div className={styles.panelHeader}>
            <div className={styles.headingRow}>
              <h2 id="tasks-heading">{guest ? '示例任务' : '任务列表'}</h2>
              <span className={styles.count} aria-label={`共 ${tasksStore.tasks.length} 条任务`}>
                {tasksStore.tasks.length}
              </span>
            </div>
            <Button onClick={() => void tasksStore.refresh()} loading={refreshing} disabled={busy}>刷新列表</Button>
          </div>

          {tasksStore.loadError && (
            <Alert type="error" showIcon title="任务查询失败" description={tasksStore.loadError} className={styles.alert} />
          )}

          <Spin spinning={tasksStore.loading}>
            <div className={styles.listBody} aria-busy={tasksStore.loading}>
              {tasksStore.tasks.length === 0 ? (
                <div className={styles.empty}>
                  {!tasksStore.loading && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={tasksStore.loadError ? '恢复连接后，点击刷新重试' : '还没有任务，创建你的第一条任务吧'} />}
                </div>
              ) : (
                <ul className={styles.taskList}>
                  {tasksStore.tasks.map((task) => (
                    <li key={task.id} className={styles.taskRow}>
                      <span className={styles.taskDot} aria-hidden="true" />
                      <div className={styles.taskContent}>
                        <p className={styles.taskTitle}>{task.title}</p>
                        <time className={styles.time} dateTime={task.createdAt}>创建于 {formatTime(task.createdAt)}</time>
                      </div>
                      <div className={styles.taskActions}>
                        <Button type="link" size="small" aria-label={`编辑任务：${task.title}`} disabled={refreshing || busy} onClick={() => openEdit(task)}>编辑</Button>
                        <Button type="link" size="small" danger aria-label={`删除任务：${task.title}`} disabled={refreshing || busy} onClick={() => openDelete(task)}>删除</Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Spin>
          <div className={styles.panelFooter}>{guest ? '登录后，即可创建和管理自己的任务。' : '每一个小小的开始，都算数。'}</div>
        </section>

        <section className={`${styles.panel} ${styles.createPanel}`} aria-labelledby="create-heading">
          <div className={styles.panelHeader}><h2 id="create-heading">创建任务</h2></div>
          <div className={styles.formBody}>
            <p className={styles.formDescription}>下一步，你想完成什么？</p>
            <Form name="create-task" form={form} layout="vertical" onFinish={(values) => void handleCreate(values)} requiredMark={false} disabled={busy}>
              <Form.Item name="title" label="任务标题" rules={[
                { required: true, whitespace: true, message: '请输入任务标题' },
                { max: 120, message: '任务标题最多 120 个字符' },
              ]}>
                <Input placeholder="例如：读完一直想看的那本书" maxLength={120} showCount autoComplete="off" size="large" />
              </Form.Item>
              {tasksStore.createError && <Alert type="error" showIcon title={tasksStore.createError} className={styles.alert} />}
              <Button
                type="primary"
                htmlType={guest ? 'button' : 'submit'}
                onClick={guest ? requestLogin : undefined}
                block
                size="large"
                loading={tasksStore.creating}
                disabled={refreshing || busy}
              >创建任务</Button>
            </Form>
            <p className={styles.hint}>{guest ? '注册或登录后开始记录，示例内容保持不变。' : '任务会自动保存，下次登录可以继续。'}</p>
          </div>
        </section>
      </div>

      <Modal
        title="编辑任务"
        open={editingTask !== null}
        onCancel={closeEdit}
        onOk={() => editForm.submit()}
        okText="保存修改"
        cancelText="取消"
        confirmLoading={savingEdit}
        okButtonProps={{ disabled: savingEdit || authStore.loggingOut }}
        cancelButtonProps={{ disabled: savingEdit }}
        closable={!savingEdit}
        mask={{ closable: !savingEdit }}
        keyboard={!savingEdit}
        forceRender
      >
        <Form name="edit-task" form={editForm} layout="vertical" requiredMark={false} disabled={savingEdit || authStore.loggingOut} onFinish={(values) => void handleEdit(values)}>
          <Form.Item name="title" label="任务标题" rules={[
            { required: true, whitespace: true, message: '请输入任务标题' },
            { max: 120, message: '任务标题最多 120 个字符' },
          ]}>
            <Input maxLength={120} showCount autoComplete="off" />
          </Form.Item>
          {tasksStore.editError && <Alert type="error" showIcon title="任务编辑失败" description={tasksStore.editError} />}
        </Form>
      </Modal>

      <Modal
        title="删除任务"
        open={deletingTask !== null}
        onCancel={closeDelete}
        onOk={() => void handleDelete()}
        okText="确认删除"
        cancelText="取消"
        okButtonProps={{ danger: true, disabled: savingDelete || authStore.loggingOut }}
        confirmLoading={savingDelete}
        cancelButtonProps={{ disabled: savingDelete }}
        closable={!savingDelete}
        mask={{ closable: !savingDelete }}
        keyboard={!savingDelete}
      >
        <p className={styles.deleteDescription}>确认删除“{deletingTask?.title}”吗？</p>
        {tasksStore.deleteError && <Alert type="error" showIcon title="任务删除失败" description={tasksStore.deleteError} />}
      </Modal>
    </>
  )
})
