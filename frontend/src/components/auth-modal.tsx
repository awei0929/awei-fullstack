import { useEffect } from 'react'
import { Alert, Button, Form, Input, Modal, message } from 'antd'
import { observer } from 'mobx-react-lite'
import { authStore } from '../store/auth'
import type { AuthInput } from '../types/auth'
import { hasValidPasswordLength } from '../utils/auth-validation'

interface AuthModalProps {
  open: boolean
  reason: string
  onClose: () => void
}

export const AuthModal = observer(function AuthModal({ open, reason, onClose }: AuthModalProps) {
  const [form] = Form.useForm<AuthInput>()
  const [messageApi, contextHolder] = message.useMessage()
  const submitting = authStore.submitting
  const waitingForLogout = authStore.loggingOut

  useEffect(() => {
    if (!open) {
      form.resetFields()
    }
  }, [open, form])

  function close() {
    if (authStore.submitting) return
    form.resetFields()
    authStore.clearAuthError()
    onClose()
  }

  async function submit(values: AuthInput) {
    if (await authStore.authenticate('login', { account: values.account, password: values.password })) {
      form.resetFields()
      onClose()
    } else if (authStore.authError) {
      void messageApi.error(authStore.authError)
    }
  }

  return (
    <Modal
      title="登录账号"
      open={open}
      onCancel={close}
      footer={null}
      closable={!submitting}
      mask={{ closable: !submitting }}
      keyboard={!submitting}
      forceRender
    >
      <p style={{ color: '#758077', lineHeight: 1.8 }}>登录后，创建并管理只属于你的任务。</p>
      {reason && <Alert type="info" showIcon title={reason} style={{ marginBottom: 20 }} />}
      {contextHolder}
      {waitingForLogout && <p role="status" style={{ color: '#758077' }}>正在完成退出，请稍候再登录…</p>}
      <Form
        name="auth"
        form={form}
        layout="vertical"
        requiredMark={false}
        disabled={submitting || waitingForLogout}
        onFinish={(values) => void submit(values)}
        onValuesChange={() => authStore.clearAuthError()}
      >
        <Form.Item name="account" label="账号" rules={[
          { required: true, message: '请输入账号' },
          { pattern: /^[0-9]{3,5}$/, message: '账号须为 3–5 位数字，可保留开头的 0' },
        ]}>
          <Input inputMode="numeric" autoComplete="username" placeholder="3–5 位数字，例如 00123" size="large" />
        </Form.Item>
        <Form.Item name="password" label="密码" rules={[
          { required: true, message: '请输入密码' },
          {
            validator: (_, value: string | undefined) => !value || hasValidPasswordLength(value)
              ? Promise.resolve()
              : Promise.reject(new Error('密码须为 8–64 个字符')),
          },
        ]}>
          <Input.Password autoComplete="current-password" placeholder="8–64 个字符" size="large" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block size="large" loading={submitting} disabled={submitting || waitingForLogout}>
          登录
        </Button>
      </Form>
    </Modal>
  )
})
