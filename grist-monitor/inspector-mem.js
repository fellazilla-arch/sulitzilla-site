#!/usr/bin/env node
/** Evaluate process.memoryUsage() via inspector. */
const http = require('http');
const { WebSocket } = require('ws');
const host = process.argv[2] || '127.0.0.1';
const port = Number(process.argv[3] || 9229);

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

(async () => {
  const targets = await getJson(`http://${host}:${port}/json/list`);
  const wsUrl = targets[0].webSocketDebuggerUrl.replace(/0\.0\.0\.0/g, host);
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  function send(method, params) {
    const msgId = ++id;
    return new Promise((resolve, reject) => {
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  });
  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
  await send('Runtime.enable');
  const result = await send('Runtime.evaluate', {
    expression: 'JSON.stringify({memoryUsage: process.memoryUsage(), heapStats: v8.getHeapStatistics()})',
    includeCommandLineAPI: false,
    returnByValue: true,
  });
  // v8 may not be in scope; retry with require
  let value = result.result.value;
  if (result.result.subtype === 'error' || !value) {
    const result2 = await send('Runtime.evaluate', {
      expression: `(() => { const v8 = process.binding ? null : null; const mu = process.memoryUsage(); return JSON.stringify({memoryUsage: {rss: mu.rss, heapTotal: mu.heapTotal, heapUsed: mu.heapUsed, external: mu.external, arrayBuffers: mu.arrayBuffers}}); })()`,
      returnByValue: true,
    });
    value = result2.result.value;
  }
  console.log(value);
  ws.close();
})().catch((e) => { console.error(e); process.exit(1); });
