export type Section = 'home' | 'capabilities' | 'profile' | 'contact' | 'appearance' | 'files'
export type CapabilityEditorTab = 'technology' | 'company' | 'projects'

export const sections: { id: Section; label: string; subtitle: string }[] = [
  { id: 'home', label: '首页场景', subtitle: '编辑你的第一幕。' },
  { id: 'capabilities', label: '我的能力', subtitle: '整理技术栈、公司背景与工程经历。' },
  { id: 'profile', label: '个人资料', subtitle: '让人多认识你一点。' },
  { id: 'contact', label: '联系入口', subtitle: '为下一次对话留一个入口。' },
  { id: 'appearance', label: '外观与动效', subtitle: '调整这个空间的节奏。' },
  { id: 'files', label: '文件上传', subtitle: '上传公开图片、PDF 与常用附件。' },
]
