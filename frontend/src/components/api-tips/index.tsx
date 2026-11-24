import { message } from 'antd'
import { useEffect } from 'react'
import { subscribeErrorTips } from '../../utils/error-tips'

// 全站 API/SSE 错误的统一出口：页面只保留业务状态，不直接渲染错误文案。
export function ApiTips() {
  const [api, contextHolder] = message.useMessage({ top: 84, maxCount: 1 })

  useEffect(() => subscribeErrorTips(text => {
    void api.open({
      key: 'api-error-tip',
      type: 'error',
      content: text,
      duration: 4,
      className: 'api-error-tip',
    })
  }), [api])

  return contextHolder
}
