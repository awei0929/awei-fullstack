export type Section = 'home' | 'thoughts' | 'works' | 'resume' | 'capabilities' | 'profile' | 'contact' | 'appearance' | 'files' | 'conversation' | 'chat' | 'logs'
export type CapabilityEditorTab = 'technology' | 'company' | 'projects'

export const sections: { id: Section; label: string }[] = [
  { id: 'home', label: '首页场景' },
  { id: 'thoughts', label: '想法笔记' },
  { id: 'works', label: '作品链接' },
  { id: 'resume', label: '简历' },
  { id: 'capabilities', label: '能力资料' },
  { id: 'profile', label: '个人资料' },
  { id: 'contact', label: '联系入口' },
  { id: 'appearance', label: '外观与动效' },
  { id: 'files', label: '文件上传' },
  { id: 'conversation', label: '对话设置' },
  { id: 'chat', label: 'AI 对话' },
  { id: 'logs', label: '对话日志' },
]
