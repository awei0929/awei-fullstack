export type Section = 'home' | 'capabilities' | 'profile' | 'contact' | 'appearance' | 'files' | 'chat'
export type CapabilityEditorTab = 'technology' | 'company' | 'projects'

export const sections: { id: Section; label: string }[] = [
  { id: 'home', label: '首页场景' },
  { id: 'capabilities', label: '我的能力' },
  { id: 'profile', label: '个人资料' },
  { id: 'contact', label: '联系入口' },
  { id: 'appearance', label: '外观与动效' },
  { id: 'files', label: '文件上传' },
  { id: 'chat', label: 'AI 对话' },
]
