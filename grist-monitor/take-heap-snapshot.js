#!/usr/bin/env node
/**
 * Take a V8 heap snapshot from a Node inspector port and write it to disk.
 * Usage: node take-heap-snapshot.js <out.heapsnapshot> [host] [port]
 */
const fs = require('fs');
const http = require('http');
const { WebSocket } = require('ws');

const outPath = process.argv[2];
const host = process.argv[3] || '127.0.0.1';
const port = Number(process.argv[4] || 9229);
if (!outPath) {
  console.error('usage: node take-heap-snapshot.js <out.heapsnapshot> [host] [port]');
  process.exit(1);
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (err) { reject(err); }
      });
    }).on('error', reject);
  });
}

(async () => {
  const targets = await getJson(`http://${host}:${port}/json/list`);
  const target = targets.find((t) => t.webSocketDebuggerUrl) || targets[0];
  if (!target?.webSocketDebuggerUrl) {
    throw new Error(`no inspector target at ${host}:${port}: ${JSON.stringify(targets)}`);
  }
  const wsUrl = target.webSocketDebuggerUrl.replace(/0\.0\.0\.0/g, host);
  console.error(`connecting ${wsUrl}`);

  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const out = fs.createWriteStream(outPath);
  let bytes = 0;

  function send(method, params) {
    const msgId = ++id;
    return new Promise((resolve, reject) => {
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.method === 'HeapProfiler.addHeapSnapshotChunk') {
      const chunk = msg.params.chunk;
      bytes += Buffer.byteLength(chunk);
      out.write(chunk);
    }
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

  await send('HeapProfiler.enable');
  console.error('taking snapshot (process will pause)...');
  const t0 = Date.now();
  await send('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
  await new Promise((resolve, reject) => out.end((err) => (err ? reject(err) : resolve())));
  console.error(`wrote ${outPath} (${(bytes / 1024 / 1024).toFixed(1)} MB) in ${Date.now() - t0}ms`);
  ws.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
