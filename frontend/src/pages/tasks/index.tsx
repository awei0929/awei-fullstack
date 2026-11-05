import { useEffect, useState } from 'react'
import { Alert, Button, Empty, Form, Input, Modal, Spin, Tag, message } from 'antd'
import { observer } from 'mobx-react-lite'
import { tasksStore } from '../../store/tasks'
import type { Task } from '../../types/task'
import styles from './style.module.less'

const formatTime = (value: string) => new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
}).format(new Date(value))

export const TasksPage = observer(function TasksPage() {
  const [form] = Form.useForm<{ title: string }>()
  const [editForm] = Form.useForm<{ title: string }>()
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [deletingTask, setDeletingTask] = useState<Task | null>(null)
  const [messageApi, contextHolder] = message.useMessage()
  const savingEdit = tasksStore.editingTaskId !== null
  const savingDelete = tasksStore.deletingTaskId !== null
  const busy = tasksStore.isMutating
  const refreshing = tasksStore.loading || tasksStore.statsLoading

  useEffect(() => {
    void tasksStore.refresh()
  }, [])

  async function handleCreate({ title }: { title: string }) {
    if (await tasksStore.createTask(title.trim())) {
      form.resetFields()
      void messageApi.success('任务已创建')
    }
  }

  function openEdit(task: Task) {
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
    if (await tasksStore.editTask(editingTask.id, title.trim())) {
      setEditingTask(null)
      void messageApi.success('任务已更新')
    }
  }

  function openDelete(task: Task) {
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
    if (await tasksStore.deleteTask(deletingTask.id)) {
      setDeletingTask(null)
      void messageApi.success('任务已删除')
    }
  }

  return (
    <div className={styles.page}>
      {contextHolder}
      <header className={styles.header}>
        <a className={styles.brand} href="/" aria-label="awei 任务练习首页">
          <span className={styles.brandIcon} aria-hidden="true">a</span>
          <span>awei <span className={styles.brandDivider}>/</span> 全栈练习</span>
        </a>
        <span className={styles.lesson}>LESSON 01</span>
      </header>

      <main className={styles.main}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>把第一个请求跑通</p>
          <h1>从一条任务开始。</h1>
          <p className={styles.description}>查询、创建、编辑和删除任务，观察任务模块与统计模块如何协作。</p>
        </div>

        <section className={styles.statsPanel} aria-labelledby="stats-heading">
          <div>
            <h2 id="stats-heading" className={styles.statsHeading}>任务总数</h2>
            <div className={styles.statsValue} aria-live="polite">
              {tasksStore.statsLoading ? '…' : tasksStore.stats?.total ?? '—'}
              <span>条</span>
            </div>
          </div>
          <div className={styles.statsDescription}>
            <p>后端运行时长：{tasksStore.stats?.uptimeSeconds ?? '—'} 秒（上次统计）</p>
            <p>创建、删除后自动重新统计</p>
            <code>GET /api/stats</code>
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
                <h2 id="tasks-heading">任务列表</h2>
                <span className={styles.count} aria-label={`共 ${tasksStore.tasks.length} 条任务`}>
                  {tasksStore.tasks.length}
                </span>
              </div>
              <Button onClick={() => void tasksStore.refresh()} loading={refreshing} disabled={busy}>
                刷新列表
              </Button>
            </div>

            {tasksStore.loadError && (
              <Alert type="error" showIcon title="任务查询失败" description={tasksStore.loadError} className={styles.alert} />
            )}

            <Spin spinning={tasksStore.loading}>
              <div className={styles.listBody} aria-busy={tasksStore.loading}>
                {tasksStore.tasks.length === 0 ? (
                  <div className={styles.empty}>
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={tasksStore.loadError ? '恢复连接后，点击刷新重试' : '还没有任务，创建你的第一条任务吧'} />
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
                          <Tag color="default">待完成</Tag>
                          <Button
                            type="link"
                            size="small"
                            aria-label={`编辑任务：${task.title}`}
                            disabled={refreshing || busy}
                            onClick={() => openEdit(task)}
                          >
                            编辑
                          </Button>
                          <Button
                            type="link"
                            size="small"
                            danger
                            aria-label={`删除任务：${task.title}`}
                            disabled={refreshing || busy}
                            onClick={() => openDelete(task)}
                          >
                            删除
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Spin>
            <div className={styles.panelFooter}><span className={styles.method}>GET</span> /api/tasks</div>
          </section>

          <section className={`${styles.panel} ${styles.createPanel}`} aria-labelledby="create-heading">
            <div className={styles.panelHeader}><h2 id="create-heading">创建任务</h2></div>
            <div className={styles.formBody}>
              <p className={styles.formDescription}>下一步，你想学会什么？</p>
              <Form name="create-task" form={form} layout="vertical" onFinish={(values) => void handleCreate(values)} requiredMark={false} disabled={busy}>
                <Form.Item name="title" label="任务标题" rules={[
                  { required: true, whitespace: true, message: '请输入任务标题' },
                  { max: 120, message: '任务标题最多 120 个字符' },
                ]}>
                  <Input placeholder="例如：理解 Controller 如何接收请求" maxLength={120} showCount autoComplete="off" size="large" />
                </Form.Item>
                {tasksStore.createError && <Alert type="error" showIcon title={tasksStore.createError} className={styles.alert} />}
                <Button type="primary" htmlType="submit" block size="large" loading={tasksStore.creating} disabled={refreshing || busy}>
                  创建任务
                </Button>
              </Form>
              <p className={styles.hint}>任务保存在 MongoDB 中，重启后端后仍会保留。</p>
            </div>
            <div className={styles.panelFooter}><span className={`${styles.method} ${styles.post}`}>POST</span> /api/tasks</div>
          </section>
        </div>

        <footer className={styles.footer}>前端提交请求 <span>→</span> Controller 接收 <span>→</span> Service 处理 <span>→</span> 返回 JSON</footer>
      </main>

      <Modal
        title="编辑任务"
        open={editingTask !== null}
        onCancel={closeEdit}
        onOk={() => editForm.submit()}
        okText="保存修改"
        cancelText="取消"
        confirmLoading={savingEdit}
        cancelButtonProps={{ disabled: savingEdit }}
        closable={!savingEdit}
        mask={{ closable: !savingEdit }}
        keyboard={!savingEdit}
        forceRender
      >
        <Form
          name="edit-task"
          form={editForm}
          layout="vertical"
          requiredMark={false}
          disabled={savingEdit}
          onFinish={(values) => void handleEdit(values)}
        >
          <Form.Item name="title" label="任务标题" rules={[
            { required: true, whitespace: true, message: '请输入任务标题' },
            { max: 120, message: '任务标题最多 120 个字符' },
          ]}>
            <Input maxLength={120} showCount autoComplete="off" />
          </Form.Item>
          {tasksStore.editError && (
            <Alert type="error" showIcon title="任务编辑失败" description={tasksStore.editError} />
          )}
        </Form>
      </Modal>

      <Modal
        title="删除任务"
        open={deletingTask !== null}
        onCancel={closeDelete}
        onOk={() => void handleDelete()}
        okText="确认删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        confirmLoading={savingDelete}
        cancelButtonProps={{ disabled: savingDelete }}
        closable={!savingDelete}
        mask={{ closable: !savingDelete }}
        keyboard={!savingDelete}
      >
        <p className={styles.deleteDescription}>确认删除“{deletingTask?.title}”吗？</p>
        {tasksStore.deleteError && (
          <Alert type="error" showIcon title="任务删除失败" description={tasksStore.deleteError} />
        )}
      </Modal>
    </div>
  )
})
