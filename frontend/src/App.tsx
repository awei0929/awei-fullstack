import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'

export default function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: { colorPrimary: '#21634d', borderRadius: 10, fontSize: 14 },
      }}
    >
      <RouterProvider router={router} />
    </ConfigProvider>
  )
}
