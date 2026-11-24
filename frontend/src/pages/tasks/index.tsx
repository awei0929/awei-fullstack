import { useEffect, useState } from 'react'
import { Alert, Button, Empty, Form, Input, Modal, Progress, Spin, Tag, message } from 'antd'
import { observer } from 'mobx-react-lite'
import { AuthModal } from '../../components/auth-modal'
import { authStore } from '../../store/auth'
import { jobsStore } from '../../store/jobs'
import { tasksStore } from '../../store/tasks'
import type { JobStatus } from '../../types/job'
import type { Task } from '../../types/task'
import styles from './style.module.less'

const formatTime = (value: string) => new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
}).format(new Date(value))

const jobStatusText: Record<JobStatus, string> = {
  pending: '排队中', running: '处理中', done: '已完成', failed: '失败',
}

const jobTagColor: Record<JobStatus, string> = {
  pending: 'default', running: 'processing', done: 'success', failed: 'error',
}

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
          ) : <Button onClick={requestLogin}>登录</Button>
        )}
      </header>

      <main className={styles.main}>
        <div className={styles.intro}>
          <h1>{authStore.user ? '我的任务' : '任务清单'}</h1>
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
  const [jobForm] = Form.useForm<{ label: string }>()
  const [editForm] = Form.useForm<{ title: string }>()
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [deletingTask, setDeletingTask] = useState<Task | null>(null)
  const [messageApi, contextHolder] = message.useMessage()
  const guest = authStore.user === null
  const savingEdit = tasksStore.editingTaskId !== null
  const savingDelete = tasksStore.deletingTaskId !== null
  const busy = tasksStore.isMutating || authStore.loggingOut || jobsStore.creating
  const refreshing = tasksStore.loading || tasksStore.statsLoading

  async function handleCreate({ title }: { title: string }) {
    if (!authStore.user) { requestLogin(); return }
    const identity = authStore.identityVersion
    if (await tasksStore.createTask(title.trim()) && identity === authStore.identityVersion) {
      form.resetFields()
      void messageApi.success('任务已创建')
    }
  }

  async function handleCreateJob({ label }: { label: string }) {
    if (!authStore.user) { requestLogin(); return }
    const identity = authStore.identityVersion
    jobsStore.clearCreateError()
    if (await jobsStore.createJob(label.trim()) && identity === authStore.identityVersion) {
      jobForm.resetFields()
      void messageApi.success('作业已提交')
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
        <div className={styles.statsTotal}>
          <h2 id="stats-heading" className={styles.statsHeading}>任务总数</h2>
          <div className={styles.statsValue} aria-live="polite">
            {tasksStore.statsLoading ? '…' : tasksStore.stats?.total ?? '—'}
            <span>条</span>
          </div>
        </div>
        <div className={styles.statsDescription}>
          <span>{guest ? '示例 · 只读' : '仅你可见'}</span>
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
        <section className={`${styles.panel} ${styles.createPanel}`} aria-labelledby="create-heading">
          <div className={styles.panelHeader}><h2 id="create-heading">创建任务</h2></div>
          <div className={styles.formBody}>
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
              >{guest ? '登录后创建' : '创建任务'}</Button>
            </Form>
          </div>
        </section>

        <section className={`${styles.panel} ${styles.listPanel}`} aria-labelledby="tasks-heading">
          <div className={styles.panelHeader}>
            <div className={styles.headingRow}>
              <h2 id="tasks-heading">{guest ? '示例任务' : '任务列表'}</h2>
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
        </section>
      </div>

      <section className={`${styles.panel} ${styles.jobPanel}`} aria-labelledby="job-heading">
        <div className={styles.panelHeader}>
          <h2 id="job-heading">异步作业演示</h2>
        </div>
        {guest ? (
          <div className={styles.jobGuest}><Button onClick={requestLogin}>登录后提交</Button></div>
        ) : (
          <div className={styles.jobBody}>
            <Form form={jobForm} layout="inline" onFinish={(values) => void handleCreateJob(values)} requiredMark={false} disabled={busy}>
              <Form.Item
                name="label"
                className={styles.jobInput}
                rules={[
                  { required: true, whitespace: true, message: '请输入作业标签' },
                  { max: 80, message: '作业标签最多 80 个字符' },
                ]}
              >
                <Input placeholder="给作业起个名字" maxLength={80} autoComplete="off" />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={jobsStore.creating} disabled={refreshing || busy}>提交作业</Button>
            </Form>
            {jobsStore.createError && (
              <Alert type="error" showIcon title="作业提交失败" description={jobsStore.createError} className={styles.jobAlert} />
            )}
            {jobsStore.loadError && (
              <Alert
                type="error"
                showIcon
                title="作业查询失败"
                description={jobsStore.loadError}
                className={styles.jobAlert}
                action={<Button size="small" onClick={() => void jobsStore.refresh()}>重试</Button>}
              />
            )}
            <div aria-live="polite">
              {jobsStore.jobs.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有作业" className={styles.jobEmpty} />
              ) : (
                <ul className={styles.jobList}>
                  {jobsStore.jobs.map((job) => (
                    <li key={job.id} className={styles.jobRow}>
                      <div className={styles.jobRowHead}>
                        <span className={styles.jobLabel}>{job.label}</span>
                        <Tag color={jobTagColor[job.status]}>{jobStatusText[job.status]}</Tag>
                      </div>
                      {(job.status === 'pending' || job.status === 'running') && (
                        <Progress percent={job.progress} size="small" showInfo={false} />
                      )}
                      {job.status === 'done' && <p className={styles.jobResult}>{job.result}</p>}
                      {job.status === 'failed' && <p className={styles.jobError}>{job.error ?? '作业失败'}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

      <Modal
        className={styles.taskModal}
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
            <Input maxLength={120} showCount autoComplete="off" size="large" />
          </Form.Item>
          {tasksStore.editError && <Alert type="error" showIcon title="任务编辑失败" description={tasksStore.editError} />}
        </Form>
      </Modal>

      <Modal
        className={styles.taskModal}
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
