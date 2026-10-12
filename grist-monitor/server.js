/**
 * Grist memory monitor + stress tester (runs on the droplet).
 *
 * Env:
 *   PORT=3004
 *   GRIST_API_KEY=...
 *   GRIST_DOC_ID=eEMaR9RHiD3ruspeNWqKHn
 *   GRIST_TABLE=Master_List
 *   GRIST_INTERNAL_URL=http://127.0.0.1:8484
 *   SAMPLE_INTERVAL_MS=5000
 *   HISTORY_LIMIT=720
 */
const express = require('express');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const app = express();

const PORT = Number(process.env.PORT || 3005);
const GRIST_API_KEY = (process.env.GRIST_API_KEY || '').trim();
const GRIST_DOC_ID = (process.env.GRIST_DOC_ID || 'eEMaR9RHiD3ruspeNWqKHn').trim();
const GRIST_TABLE = (process.env.GRIST_TABLE || 'Master_List').trim();
const GRIST_INTERNAL_URL = (process.env.GRIST_INTERNAL_URL || 'http://127.0.0.1:8484').replace(/\/$/, '');
const SAMPLE_INTERVAL_MS = Number(process.env.SAMPLE_INTERVAL_MS || 5000);
const HISTORY_LIMIT = Number(process.env.HISTORY_LIMIT || 720);

const history = [];
let stressState = {
  running: false,
  label: '',
  startedAt: null,
  requests: 0,
  errors: 0,
  lastError: null,
  concurrency: 0,
  stopRequested: false,
};

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function sh(cmd, args, timeoutMs = 15000) {
  const { stdout } = await execFileAsync(cmd, args, {
    timeout: timeoutMs,
    maxBuffer: 4 * 1024 * 1024,
  });
  return stdout.trim();
}

function parseRssKb(line) {
  const m = line.match(/^\s*(\d+)/);
  return m ? Math.round(Number(m[1]) / 1024) : 0;
}

async function sampleMemory() {
  const ts = Date.now();
  const sample = { ts, ok: true };

  try {
    const [statsOut, psOut, ssOut, inspectOut, envOut, freeOut, logsOut] = await Promise.all([
      sh('docker', ['stats', '--no-stream', '--format', '{{.MemUsage}}|{{.CPUPerc}}|{{.MemPerc}}', 'grist']),
      sh('docker', ['exec', 'grist', 'sh', '-c', "ps -eo rss,args | grep -E 'server.js|main.py|supervisor.mjs' | grep -v grep"]),
      sh('ss', ['-tn', 'state', 'established', '( sport = :8484 )']),
      sh('docker', ['inspect', 'grist', '--format', '{{.Config.Image}}|{{.State.StartedAt}}']),
      sh('docker', ['inspect', 'grist', '--format', '{{range .Config.Env}}{{println .}}{{end}}']),
      sh('free', ['-m']),
      sh('docker', ['logs', '--since', '30s', 'grist'], 8000).catch(() => ''),
    ]);

    const [memUsage, cpuPerc, memPerc] = statsOut.split('|');
    const memMatch = memUsage.match(/^([\d.]+)(MiB|GiB)/);
    sample.containerMemMb = memMatch
      ? Math.round(Number(memMatch[1]) * (memMatch[2] === 'GiB' ? 1024 : 1))
      : null;
    sample.containerCpu = cpuPerc || null;
    sample.containerMemPerc = memPerc || null;

    let nodeMb = 0;
    let pythonMb = 0;
    let supervisorMb = 0;
    for (const line of psOut.split('\n')) {
      if (line.includes('server.js')) nodeMb = parseRssKb(line);
      else if (line.includes('main.py')) pythonMb = parseRssKb(line);
      else if (line.includes('supervisor.mjs')) supervisorMb = parseRssKb(line);
    }
    sample.nodeRssMb = nodeMb;
    sample.pythonRssMb = pythonMb;
    sample.supervisorRssMb = supervisorMb;
    const heapMatch = envOut.match(/^NODE_OPTIONS=.*--max-old-space-size=(\d+)/m);
    sample.nodeHeapLimitMb = heapMatch ? Number(heapMatch[1]) : null;

    const ssLines = ssOut.split('\n').filter((l) => l && !l.startsWith('Recv-Q'));
    sample.wsConnections = Math.max(0, ssLines.length);

    const [image, startedAt] = inspectOut.split('|');
    sample.gristImage = image || null;
    sample.gristStartedAt = startedAt || null;
    if (startedAt) {
      sample.gristUptimeSec = Math.round((ts - Date.parse(startedAt)) / 1000);
    }

    const freeMatch = freeOut.match(/Mem:\s+(\d+)\s+(\d+)\s+(\d+)\s+\d+\s+(\d+)\s+(\d+)/);
    if (freeMatch) {
      sample.hostMemTotalMb = Number(freeMatch[1]);
      sample.hostMemUsedMb = Number(freeMatch[2]);
      sample.hostMemAvailableMb = Number(freeMatch[5]);
    }

    const clientMatches = [...logsOut.matchAll(/DocClients now (\d+) clients/g)];
    sample.docClients = clientMatches.length
      ? Number(clientMatches[clientMatches.length - 1][1])
      : null;

    sample.stress = {
      running: stressState.running,
      label: stressState.label,
      requests: stressState.requests,
      errors: stressState.errors,
      concurrency: stressState.concurrency,
      startedAt: stressState.startedAt,
      lastError: stressState.lastError,
    };
  } catch (err) {
    sample.ok = false;
    sample.error = err.message || String(err);
  }

  history.push(sample);
  if (history.length > HISTORY_LIMIT) history.shift();
  return sample;
}

let sampling = false;
async function tickSample() {
  if (sampling) return;
  sampling = true;
  try {
    await sampleMemory();
  } finally {
    sampling = false;
  }
}

setInterval(tickSample, SAMPLE_INTERVAL_MS);
void tickSample();

app.get('/api/memory', async (_req, res) => {
  try {
    const latest = history.length ? history[history.length - 1] : await sampleMemory();
    res.json({ latest, history, intervalMs: SAMPLE_INTERVAL_MS });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.get('/api/memory/history', (_req, res) => {
  res.json({ history, intervalMs: SAMPLE_INTERVAL_MS });
});

async function gristFetch(pathSuffix, timeoutMs = 120000) {
  const url = `${GRIST_INTERNAL_URL}${pathSuffix}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${GRIST_API_KEY}` },
      signal: controller.signal,
    });
    const text = await resp.text();
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${text.slice(0, 200)}`);
    }
    return text.length;
  } finally {
    clearTimeout(timer);
  }
}

const STRESS_PROFILES = {
  light: {
    label: 'Light (5 parallel table reads)',
    concurrency: 5,
    endpoints: [
      `/api/docs/${GRIST_DOC_ID}/tables/${GRIST_TABLE}/records?limit=500`,
      `/api/docs/${GRIST_DOC_ID}/tables/${GRIST_TABLE}/columns`,
      `/api/docs/${GRIST_DOC_ID}/tables`,
    ],
    pauseMs: 1500,
  },
  medium: {
    label: 'Medium (15 parallel, larger slices)',
    concurrency: 15,
    endpoints: [
      `/api/docs/${GRIST_DOC_ID}/tables/${GRIST_TABLE}/records?limit=2000`,
      `/api/docs/${GRIST_DOC_ID}/tables/${GRIST_TABLE}/records?limit=5000`,
      `/api/docs/${GRIST_DOC_ID}/tables/${GRIST_TABLE}/columns`,
    ],
    pauseMs: 800,
  },
  heavy: {
    label: 'Heavy (30 parallel full-table fetches)',
    concurrency: 30,
    endpoints: [`/api/docs/${GRIST_DOC_ID}/tables/${GRIST_TABLE}/records`],
    pauseMs: 400,
  },
  tabs: {
    label: 'Tab simulator (12 sustained full loads)',
    concurrency: 12,
    endpoints: [
      `/api/docs/${GRIST_DOC_ID}/tables/${GRIST_TABLE}/records`,
      `/api/docs/${GRIST_DOC_ID}/tables`,
      `/api/docs/${GRIST_DOC_ID}/tables/${GRIST_TABLE}/columns`,
    ],
    pauseMs: 250,
  },
};

async function runStressLoop(profileKey, durationSec) {
  const profile = STRESS_PROFILES[profileKey];
  if (!profile) throw new Error(`Unknown profile: ${profileKey}`);
  if (!GRIST_API_KEY) throw new Error('GRIST_API_KEY is not configured on the monitor');

  stressState = {
    running: true,
    label: profile.label,
    startedAt: Date.now(),
    requests: 0,
    errors: 0,
    lastError: null,
    concurrency: profile.concurrency,
    stopRequested: false,
  };

  const endAt = Date.now() + durationSec * 1000;
  let round = 0;

  while (Date.now() < endAt && !stressState.stopRequested) {
    round += 1;
    const jobs = [];
    for (let i = 0; i < profile.concurrency; i += 1) {
      const endpoint = profile.endpoints[(round + i) % profile.endpoints.length];
      jobs.push(
        gristFetch(endpoint)
          .then(() => {
            stressState.requests += 1;
          })
          .catch((err) => {
            stressState.errors += 1;
            stressState.lastError = err.message || String(err);
          })
      );
    }
    await Promise.all(jobs);
    if (profile.pauseMs > 0) {
      await new Promise((r) => setTimeout(r, profile.pauseMs));
    }
  }

  stressState.running = false;
  stressState.stopRequested = false;
}

app.get('/api/stress/profiles', (_req, res) => {
  res.json({
    profiles: Object.fromEntries(
      Object.entries(STRESS_PROFILES).map(([key, p]) => [
        key,
        { label: p.label, concurrency: p.concurrency, pauseMs: p.pauseMs, endpoints: p.endpoints.length },
      ])
    ),
  });
});

app.post('/api/stress/start', async (req, res) => {
  if (stressState.running) {
    return res.status(409).json({ error: 'Stress test already running', stress: stressState });
  }
  const profile = String(req.body?.profile || 'medium');
  const durationSec = Math.min(Math.max(Number(req.body?.durationSec || 300), 30), 3600);
  runStressLoop(profile, durationSec).catch((err) => {
    stressState.running = false;
    stressState.lastError = err.message || String(err);
  });
  res.json({ ok: true, profile, durationSec });
});

app.post('/api/stress/stop', (_req, res) => {
  stressState.stopRequested = true;
  res.json({ ok: true });
});

app.get('/api/stress/status', (_req, res) => {
  res.json(stressState);
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`grist-monitor listening on http://127.0.0.1:${PORT}`);
});
