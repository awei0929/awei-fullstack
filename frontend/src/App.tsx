import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { RouterProvider } from 'react-router-dom'
import { useSyncExternalStore } from 'react'
import { router } from './router'
import { PageLoadFallback, SiteEntryProvider } from './components/site-entry'

export default function App() {
  const pathname = useSyncExternalStore(router.subscribe, () => router.state.location.pathname)
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: { colorPrimary: '#21634d', borderRadius: 10, fontSize: 14 },
      }}
    >
      <SiteEntryProvider active={pathname === '/'}>
        <RouterProvider router={router} fallbackElement={<PageLoadFallback home={pathname === '/'} />} />
      </SiteEntryProvider>
    </ConfigProvider>
  )
}
