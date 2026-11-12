import { createServer } from 'node:http';

// 真实HTTP上游替身只监听回环地址；可控字节分片、错误和挂起用于验证流生命周期，不调用真实模型。
export async function modelFixture() {
  const calls = [];
  const sockets = new Set();
  let handler;
  let aborted = 0;
  const server = createServer(async (request, response) => {
    let raw = ''; for await (const chunk of request) raw += chunk;
    const body = JSON.parse(raw); calls.push({ body, authorization: request.headers.authorization, url: request.url });
    let finished = false;
    response.on('close', () => { if (!finished) aborted++; });
    // 个别竞争测试在真实HTTP边界暂停响应；业务、流解析和Mongo写入仍使用生产实现。
    if (handler && await handler({ body, request, response })) { finished = response.writableEnded; return; }
    const mode = body.messages.at(-1).content;
    if (mode === 'redirect') { response.writeHead(302, { Location: '/unexpected' }); response.end(); finished = true; return; }
    if (/^http-(401|429|500)$/.test(mode)) { response.writeHead(Number(mode.slice(5))); response.end('secret upstream diagnostic'); finished = true; return; }
    response.writeHead(200, { 'Content-Type': 'text/event-stream' });
    const event = text => `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\r\n\r\n`;
    if (mode === 'hang' || mode === 'race') { response.write(event('部分回复')); return; }
    if (mode === 'empty') { response.end('data: [DONE]\n\n'); finished = true; return; }
    if (mode === 'long') { response.end(event('长'.repeat(16001)) + 'data: [DONE]\n\n'); finished = true; return; }
    if (mode === 'oversized') { response.end('data: ' + 'x'.repeat(270000)); finished = true; return; }
    if (mode === 'truncated') { response.end(event('部分回复')); finished = true; return; }
    if (mode === 'bad-json') { response.end('data: {broken}\n\n'); finished = true; return; }
    if (mode === 'length') { response.end(event('受限') + 'data: {"choices":[{"delta":{},"finish_reason":"length"}]}\n\ndata: [DONE]\n\n'); finished = true; return; }
    // UTF-8中文刻意在字节内部拆开，第二个事件使用多行data与CRLF。
    const data = Buffer.from(': heartbeat\r\n\r\n' + event('你好') + 'data: {"choices":\r\ndata: [{"delta":{"content":"，世界","reasoning_content":"不能展示"}}]}\r\n\r\ndata: [DONE]\r\n\r\n');
    for (let index = 0; index < data.length; index += 7) {
      if (response.destroyed) return;
      response.write(data.subarray(index, index + 7));
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    finished = true; response.end();
  });
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}/v1`, calls, get aborted() { return aborted; },
    handle(next) { handler = next; },
    async close() { for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve)); } };
}

// 客户端解析仅供测试观察HTTP业务事件，断流时不会制造done事件。
export async function* events(response) {
  assertResponse(response);
  const decoder = new TextDecoder(); let buffer = '';
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let end;
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const frame = buffer.slice(0, end); buffer = buffer.slice(end + 2);
      const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
      if (data) yield JSON.parse(data);
    }
  }
}
function assertResponse(response) { if (response.status !== 200) throw new Error(`Expected SSE 200, received ${response.status}`); }
export async function collect(response) { const result = []; for await (const event of events(response)) result.push(event); return result; }
export async function eventually(read, accept, timeout = 3000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { const result = await read(); if (accept(result)) return result; await new Promise(resolve => setTimeout(resolve, 20)); }
  throw new Error('等待可观察终态超时');
}
