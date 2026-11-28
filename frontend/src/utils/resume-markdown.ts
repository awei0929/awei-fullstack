import type { SiteResumeEducation, SiteResumeExperience, SiteResumeProject, SiteResumeSkillGroup } from '../types/site'

// 木及简历导出的 Markdown 用 ::: 左右分栏、icon: 图标指令表达排版；站点只保存语义化字段，
// 因此解析时忽略容器与图标，只按标题、加粗标签和列表还原内容，未知章节会报告而不是静默丢弃。
type ResumeSection = 'skills' | 'strengths' | 'experience' | 'projects' | 'education' | 'unknown'

export interface ResumeMarkdownResult {
  name: string
  role: string
  meta: string
  skills: SiteResumeSkillGroup[]
  strengths: string[]
  experience: SiteResumeExperience[]
  projects: SiteResumeProject[]
  education: SiteResumeEducation[]
  ignoredHeadings: string[]
}

const HEADINGS: Record<string, ResumeSection> = {
  专业技能: 'skills',
  个人优势: 'strengths',
  工作经历: 'experience',
  项目经历: 'projects',
  教育经历: 'education',
}

// 时间区间允许 2022.12 - 2026.11、2019.09 – 2022.6 这类写法，也允许「至今」。
const PERIOD = /(\d{4})[.\-/年]\s*(\d{1,2})?\s*[–—\-~至]+\s*(\d{4})[.\-/年]?\s*(\d{1,2})?|(\d{4})[.\-/年]\s*(\d{1,2})?\s*[–—\-~至]+\s*(至今|现在)/

function splitParts(text: string): string[] {
  return text.split(/[|｜]/).map((part) => part.trim()).filter(Boolean)
}

function splitItems(text: string): string[] {
  return text.split(/[、，,]/).map((part) => part.trim()).filter(Boolean)
}

function stripBold(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1')
}

function tidy(text: string): string {
  return stripBold(text).replace(/([：:])\s+/g, '$1').replace(/\s+/g, ' ').trim()
}

function readPeriod(text: string): string {
  const match = PERIOD.exec(text)
  if (!match) return ''
  const [, year1, month1, year2, month2, shortYear, shortMonth, ongoing] = match
  if (ongoing) return `${shortYear || year1}${shortMonth || month1 ? `.${shortMonth || month1}` : ''} – ${ongoing}`
  return `${year1}.${month1 || '01'} – ${year2}${month2 ? `.${month2}` : ''}`
}

function readEducation(text: string): SiteResumeEducation {
  const period = readPeriod(text)
  const withoutPeriod = text.replace(PERIOD, '').trim()
  const [school = '', major = '', ...rest] = splitParts(withoutPeriod)
  // 学历与形式（本科（函授）、专科（全日制））没有独立字段，并入学校名，保持与后台既有写法一致。
  const degree = rest.join(' ').replace(/\s+/g, '')
  const form = /（([^）]*)）|\(([^)]*)\)/.exec(degree)
  const suffix = form ? `（${form[1] ?? form[2]}）` : ''
  return { school: `${school}${suffix}`, major, period }
}

function readIdentity(title: string): { name: string; role: string } {
  const parts = title.split(/\s*·\s*/).map((part) => part.trim()).filter(Boolean)
  if (parts.length >= 2) return { name: parts[0], role: parts.slice(1).join(' · ') }
  return { name: title.trim(), role: '' }
}

function readMeta(workYears: string, startTime: string): string {
  const parts: string[] = []
  if (workYears) parts.push(/^\d+\s*年$/.test(workYears) ? `${workYears}经验` : workYears)
  if (startTime) parts.push(startTime === '随时' ? '随时到岗' : startTime)
  return parts.join(' · ')
}

export function parseResumeMarkdown(markdown: string): ResumeMarkdownResult {
  const result: ResumeMarkdownResult = {
    name: '', role: '', meta: '', skills: [], strengths: [], experience: [], projects: [], education: [], ignoredHeadings: [],
  }
  let section: ResumeSection | 'header' = 'header'
  let experience: SiteResumeExperience | null = null
  let project: SiteResumeProject | null = null
  let workYears = ''
  let startTime = ''
  let techContinuation = false

  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  for (const raw of lines) {
    const line = raw.trim().replace(/^icon:[A-Za-z0-9_-]+\s*/, '')
    if (!line) { techContinuation = false; continue }
    if (/^:::+$/.test(line)) continue

    const heading2 = /^##(?!#)\s+(.+)$/.exec(line)
    if (heading2) {
      const title = heading2[1].trim()
      const matched = HEADINGS[title]
      section = matched ?? 'unknown'
      if (!matched) result.ignoredHeadings.push(title)
      experience = null
      project = null
      techContinuation = false
      continue
    }

    const heading1 = /^#(?!#)\s+(.+)$/.exec(line)
    if (heading1) {
      const identity = readIdentity(heading1[1])
      result.name = identity.name
      result.role = identity.role
      continue
    }

    const heading3 = /^###\s+(.+)$/.exec(line)
    if (heading3) {
      // 项目标题可能带官网地址（闪剪 AI 创作平台（https://…））或用 ｜ 分隔名称与方向。
      const title = heading3[1].replace(/（\s*https?:\/\/[^）]*）\s*$/i, '').replace(/\(\s*https?:\/\/[^)]*\)\s*$/i, '').trim()
      const parts = splitParts(title)
      project = { name: parts[0] ?? title, role: parts.slice(1).join(' / '), period: '', summary: '', tech: [], highlights: [] }
      result.projects.push(project)
      techContinuation = false
      continue
    }

    if (section === 'projects' && project) {
      const summary = /^\*\*项目简介[：:]\*\*\s*(.*)$/.exec(line)
      if (summary) { project.summary = tidy(summary[1]); techContinuation = false; continue }
      const tech = /^\*\*技术栈[：:]\*\*\s*(.*)$/.exec(line)
      if (tech) {
        const value = tidy(tech[1])
        if (value) { (project as SiteResumeProject).tech.push(...splitItems(value)); techContinuation = false }
        else techContinuation = true
        continue
      }
      // 项目地址等其余加粗标签站点没有对应字段，直接跳过。
      if (/^\*\*[^*]+[：:]\*\*/.test(line)) { techContinuation = false; continue }
    }

    if (techContinuation && project && !/^[-*]\s+/.test(line) && !/^\*\*/.test(line)) {
      ;(project as SiteResumeProject).tech.push(...splitItems(tidy(line)))
      continue
    }

    const bullet = /^[-*]\s+(.+)$/.exec(line)
    if (bullet) {
      const text = tidy(bullet[1])
      if (!text) continue
      if (section === 'skills') {
        // 「**小标题：** 描述」是老版简历的技能写法，站点把它归到个人优势；纯关键词列表才是技能分组。
        if (/^\*\*[^*]+[：:]\*\*/.test(bullet[1])) result.strengths.push(text)
        else result.skills.push({ label: `技能 ${result.skills.length + 1}`, items: splitItems(text) })
      } else if (section === 'strengths') {
        result.strengths.push(text)
      } else if (section === 'experience' && experience) {
        experience.highlights.push(text)
      } else if (section === 'projects' && project) {
        project.highlights.push(text)
      } else if (section === 'education') {
        result.education.push(readEducation(text))
      }
      continue
    }

    const bold = /^\*\*(.+?)\*\*$/.exec(line)
    if (bold) {
      const text = bold[1].trim()
      if (section === 'experience') {
        const period = readPeriod(text)
        if (period && !/[|｜]/.test(text) && text.replace(PERIOD, '').trim().length <= 1) {
          if (experience) (experience as SiteResumeExperience).period = period
          continue
        }
        const parts = splitParts(text)
        experience = { company: parts[0] ?? text, role: parts.slice(1).join(' / '), period: '', summary: '', highlights: [] }
        result.experience.push(experience)
        continue
      }
      // 项目内的粗体小标题（如「智能体运营端」）只是分组，站点没有对应层级。
      continue
    }

    if (section === 'header') {
      const years = /^工作年限[：:]\s*(.+)$/.exec(line)
      if (years) { workYears = years[1].trim(); continue }
      const start = /^到职时间[：:]\s*(.+)$/.exec(line)
      if (start) { startTime = start[1].trim(); continue }
      continue
    }

    // 导出文件里技能与优势常是裸段落（没有 - 前缀），与列表项同等对待。
    if (section === 'skills' || section === 'strengths') {
      const text = tidy(line)
      if (!text) continue
      if (section === 'strengths') { result.strengths.push(text); continue }
      if (/^\*\*[^*]+[：:]\*\*/.test(line)) { result.strengths.push(text); continue }
      const items = splitItems(text)
      if (items.length) result.skills.push({ label: `技能 ${result.skills.length + 1}`, items })
      continue
    }
  }

  result.meta = readMeta(workYears, startTime).slice(0, 60)
  if (!result.skills.length && !result.strengths.length && !result.experience.length && !result.projects.length && !result.education.length) {
    throw new Error('没有识别到简历内容：请确认粘贴的是包含「## 专业技能 / ## 工作经历 / ## 项目经历」等标题的 Markdown。')
  }
  return result
}
