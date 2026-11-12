// 上游SSE按行拆帧，TextDecoder保留跨chunk的UTF-8状态；限长包含注释和未结束行。
// 只有空行结束的data帧才交给调用方，残缺EOF不伪装成完整事件。
export async function* sseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader(); const decoder = new TextDecoder('utf-8', { fatal: true });
  let buffer = ''; let data: string[] = []; let size = 0;
  const maximum = 262144;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) { buffer += decoder.decode(); break; }
      buffer += decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf('\n')) !== -1) {
        let line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
        if (line.endsWith('\r')) line = line.slice(0, -1);
        size += line.length;
        if (size > maximum) throw new Error('模型返回的单个事件过大');
        if (!line) { if (data.length) yield data.join('\n'); data = []; size = 0; }
        else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
      }
      if (size + buffer.length > maximum) throw new Error('模型返回的单个事件过大');
    }
    if (buffer.trim() || data.length) throw new Error('模型返回的事件不完整');
  } finally {
    // 提前收到DONE或abort时取消reader，释放上游连接，不继续后台读取。
    await reader.cancel().catch(() => undefined); reader.releaseLock();
  }
}
