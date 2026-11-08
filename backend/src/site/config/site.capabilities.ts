// 只允许已收录的本地图标标识，不接收SVG、文件路径或外部地址。
// 类别只决定前端默认筛选，服务端使用全局白名单，允许站主按自己的语义分类。
export const SITE_CAPABILITY_ICONS = [
  'codex', 'chatgpt', 'claude', 'deepseek', 'gemini', 'cursor', 'ollama',
  'react', 'vuedotjs', 'typescript', 'javascript', 'html5', 'css3', 'vite', 'nextdotjs', 'antdesign', 'tailwindcss',
  'nodedotjs', 'nestjs', 'express', 'python', 'fastapi', 'java', 'springboot', 'go', 'mongodb', 'mysql', 'postgresql', 'redis',
  'docker', 'kubernetes', 'nginx', 'linux', 'git', 'github', 'githubactions', 'vercel', 'cloudflare',
] as const;
