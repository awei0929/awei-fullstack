import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { RouterProvider } from 'react-router-dom'
import { useSyncExternalStore } from 'react'
import { router } from './router'
import { ApiTips } from './components/api-tips'
import { ConfirmProvider } from './components/confirm-dialog'
import { PageLoadFallback } from './components/site-entry'

export default function App() {
  const pathname = useSyncExternalStore(router.subscribe, () => router.state.location.pathname)
  return (
    <ConfigProvider
      locale={zhCN}
      button={{ autoInsertSpace: false }}
      theme={{
        token: { colorPrimary: '#21634d', borderRadius: 10, fontSize: 14 },
      }}
    >
      <ApiTips />
      <ConfirmProvider>
        <RouterProvider router={router} fallbackElement={<PageLoadFallback home={pathname === '/'} />} />
      </ConfirmProvider>
    </ConfigProvider>
  )
}
