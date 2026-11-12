import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'
import { afterEach, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { transformWithOxc } from 'vite'

// Exercise the real React components using the existing Vite transformer.
// Only CSS is stubbed: markup, URL handling, Markdown parsing and copying are real.
const componentRoot = new URL('../src/components/chat-markdown/', import.meta.url)
const transformed = new Map()
for (const name of ['index.tsx', 'copy-button.tsx', 'clipboard.ts']) {
  const url = new URL(name, componentRoot)
  if (existsSync(url)) {
    const result = await transformWithOxc(readFileSync(url, 'utf8'), fileURLToPath(url), { jsx: { runtime: 'automatic' } })
    transformed.set(url.href, result.code)
  }
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && context.parentURL?.startsWith(componentRoot.href)) {
      for (const extension of ['.ts', '.tsx']) {
        const candidate = new URL(`${specifier}${extension}`, context.parentURL)
        if (existsSync(candidate)) return { url: candidate.href, shortCircuit: true }
      }
    }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (transformed.has(url)) return { format: 'module', source: transformed.get(url), shortCircuit: true }
    if (url.endsWith('.module.less')) return { format: 'module', source: 'export default new Proxy({}, { get: (_, key) => key })', shortCircuit: true }
    return nextLoad(url, context)
  },
})

async function render(content) {
  assert.ok(existsSync(new URL('index.tsx', componentRoot)), 'ChatMarkdown must render model output safely')
  const { ChatMarkdown } = await import('../src/components/chat-markdown/index.tsx')
  return renderToStaticMarkup(createElement(ChatMarkdown, { content }))
}

async function copy(text) {
  assert.ok(existsSync(new URL('clipboard.ts', componentRoot)), 'Clipboard action must report its actual result')
  const { copyChatText } = await import('../src/components/chat-markdown/clipboard.ts')
  return copyChatText(text)
}

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
const originalSecureContext = Object.getOwnPropertyDescriptor(globalThis, 'isSecureContext')
function setClipboard(value, secure = true) {
  Object.defineProperty(globalThis, 'navigator', { value, configurable: true })
  Object.defineProperty(globalThis, 'isSecureContext', { value: secure, configurable: true })
}
afterEach(() => {
  if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator)
  else delete globalThis.navigator
  if (originalSecureContext) Object.defineProperty(globalThis, 'isSecureContext', originalSecureContext)
  else delete globalThis.isSecureContext
})

test('chat renders reading structure and GFM tables with a keyboard scroll region', async () => {
  const html = await render('# 标题\n\n正文 **重点** 与 `行内代码`。\n\n- 一项\n- 二项\n\n> 引用\n\n| 名称 | 内容 |\n| --- | --- |\n| 示例 | 说明 |')
  assert.match(html, /<h1>标题<\/h1>/)
  assert.match(html, /<p>正文 <strong>重点<\/strong>/)
  assert.match(html, /<ul>\s*<li>一项<\/li>/)
  assert.match(html, /<blockquote>/)
  assert.match(html, /tabindex="0"[^>]*role="region"[^>]*aria-label="[^"]*表格/)
  assert.match(html, /<table>/)
})

test('chat removes executable HTML and unsafe link schemes while retaining safe links', async () => {
  const html = await render('<script>alert(1)</script>\n\n<img src="https://track.example/raw.png" onerror="alert(1)">\n\n[安全](https://example.com/a?q=1) [片段](#章节-1) [危险](javascript:alert%281%29) [数据](data:text/html,test) [相对](//track.example/a) [邮件](mailto:owner@example.com)')
  assert.doesNotMatch(html, /<script|<img|onerror|href="(?:javascript|data|mailto|\/\/)/)
  assert.match(html, /href="https:\/\/example.com\/a\?q=1"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/)
  assert.match(html, /href="#章节-1"/)
  assert.doesNotMatch(html, /href=""/)
  assert.match(html, /危险/)
})

test('encoded schemes and malformed fragments cannot bypass the URL boundary', async () => {
  const html = await render('[实体](java&#x73;cript:alert%281%29) [编码](javascript%3Aalert%281%29) [坏片段](#%3Cscript%3E) [破损](#%FF) [中文片段](#%E7%AB%A0%E8%8A%82) [HTTP](http://example.com)')
  assert.equal((html.match(/href=/g) || []).length, 2)
  assert.match(html, /href="#章节"/)
  assert.match(html, /href="http:\/\/example.com"/)
})

test('chat images are descriptions or explicit safe links and never network-loading image tags', async () => {
  const html = await render('![远程图](https://track.example/image.png) ![危险图](data:image/png;base64,AAAA) ![本地图片](/api/site/file-assets/example.png)')
  assert.doesNotMatch(html, /<img|<iframe|<video|src=/)
  assert.match(html, /远程图/)
  assert.match(html, /危险图/)
  assert.doesNotMatch(html, /href="data:|href="\/api/)
})

test('linked image descriptions never produce nested interactive links', async () => {
  const html = await render('[![图示](https://track.example/image.png)](https://example.com/article)')
  assert.equal((html.match(/<a /g) || []).length, 1)
  assert.match(html, /href="https:\/\/example.com\/article"/)
  assert.match(html, /图示/)
})

test('unfinished streamed code has a copy action, language label and focusable local scroll', async () => {
  const html = await render('```typescript\nconst label = "<安全>";\n' + 'x'.repeat(400))
  assert.match(html, /typescript/)
  assert.match(html, /<button[^>]*type="button"[^>]*>.*复制代码/)
  assert.match(html, /<pre[^>]*tabindex="0"[^>]*aria-label="[^"]*代码/)
  assert.match(html, /const label = &quot;&lt;安全&gt;&quot;;/)
  assert.match(html, /<\/code><\/pre>/)
})

test('a code block without a language stays a block and inline code has no copy toolbar', async () => {
  const block = await render('```\nplain <text>\n```')
  assert.match(block, /复制代码/)
  assert.match(block, /plain &lt;text&gt;/)
  const inline = await render('正文 `const x = 1`。')
  assert.match(inline, /<code>const x = 1<\/code>/)
  assert.doesNotMatch(inline, /<pre|<button/)
})

test('copy writes exact text only after a user action and does not read clipboard contents', async () => {
  let written
  setClipboard({ clipboard: { writeText: async text => { written = text }, readText: () => { throw new Error('must never read') } } })
  const result = await copy('第一行\n第二行\n')
  assert.deepEqual(result, { ok: true })
  assert.equal(written, '第一行\n第二行\n')
})

test('clipboard denial and missing or insecure API return a visible failure, never success', async () => {
  setClipboard({ clipboard: { writeText: async () => { throw new Error('Permission denied') } } })
  assert.equal((await copy('回复')).ok, false)
  assert.ok((await copy('回复')).message)
  setClipboard({})
  assert.equal((await copy('回复')).ok, false)
  setClipboard({ clipboard: { writeText: async () => { assert.fail('insecure context must not copy') } } }, false)
  assert.equal((await copy('回复')).ok, false)
})

test('copy control is safe to render without a browser and provides an announced feedback region', async () => {
  delete globalThis.navigator
  assert.ok(existsSync(new URL('copy-button.tsx', componentRoot)), 'Copy control must be SSR-safe')
  const { ChatCopyButton } = await import('../src/components/chat-markdown/copy-button.tsx')
  const html = renderToStaticMarkup(createElement(ChatCopyButton, { text: '回复', label: '复制回复' }))
  assert.match(html, /type="button"/)
  assert.match(html, /复制回复/)
  assert.match(html, /role="status"/)
  assert.doesNotMatch(html, /已复制/)
})
