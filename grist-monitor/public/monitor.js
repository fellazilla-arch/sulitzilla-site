const $ = (id) => document.getElementById(id);

const els = {
  statusPill: $('statusPill'),
  nodeRss: $('nodeRss'),
  pythonRss: $('pythonRss'),
  containerMem: $('containerMem'),
  containerCpu: $('containerCpu'),
  connections: $('connections'),
  docClients: $('docClients'),
  hostFree: $('hostFree'),
  gristUptime: $('gristUptime'),
  heapCeiling: $('heapCeiling'),
  chart: $('chart'),
  stressProfile: $('stressProfile'),
  stressMinutes: $('stressMinutes'),
  startStress: $('startStress'),
  stopStress: $('stopStress'),
  stressStatus: $('stressStatus'),
};

function fmtMb(n) {
  return typeof n === 'number' && !Number.isNaN(n) ? `${n} MB` : '—';
}

function fmtUptime(sec) {
  if (!sec && sec !== 0) return 'uptime —';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `grist up ${h}h ${m}m`;
}

function setStatus(sample) {
  const node = sample?.nodeRssMb || 0;
  const cap = sample?.nodeHeapLimitMb || 2048;
  els.statusPill.className = 'status-pill';
  if (!sample?.ok) {
    els.statusPill.textContent = 'Sample error';
    els.statusPill.classList.add('bad');
  } else if (node >= cap * 0.9) {
    els.statusPill.textContent = 'Node very high';
    els.statusPill.classList.add('bad');
  } else if (node >= cap * 0.7) {
    els.statusPill.textContent = 'Node climbing';
    els.statusPill.classList.add('warn');
  } else {
    els.statusPill.textContent = 'Healthy';
    els.statusPill.classList.add('ok');
  }
}

function drawChart(history) {
  const canvas = els.chart;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  if (!history.length) return;

  const pad = { l: 48, r: 16, t: 16, b: 28 };
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;

  const maxY = Math.max(
    512,
    ...history.map((s) => Math.max(s.nodeRssMb || 0, s.pythonRssMb || 0, s.containerMemMb || 0))
  );

  const xAt = (i) => pad.l + (i / Math.max(history.length - 1, 1)) * plotW;
  const yAt = (v) => pad.t + plotH - (v / maxY) * plotH;

  ctx.strokeStyle = '#2a3440';
  ctx.lineWidth = 1;
  for (let y = 0; y <= 4; y += 1) {
    const val = (maxY / 4) * y;
    const yy = yAt(val);
    ctx.beginPath();
    ctx.moveTo(pad.l, yy);
    ctx.lineTo(width - pad.r, yy);
    ctx.stroke();
    ctx.fillStyle = '#93a1b0';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${Math.round(val)} MB`, 4, yy + 4);
  }

  function line(key, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    history.forEach((s, i) => {
      const x = xAt(i);
      const y = yAt(s[key] || 0);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  line('nodeRssMb', '#5b9cff');
  line('pythonRssMb', '#57d38c');
  line('containerMemMb', '#f0b429');
}

function render(sample, history) {
  setStatus(sample);
  els.nodeRss.textContent = fmtMb(sample.nodeRssMb);
  if (els.heapCeiling) {
    els.heapCeiling.textContent = sample.nodeHeapLimitMb
      ? `heap ceiling ${sample.nodeHeapLimitMb} MB`
      : 'heap ceiling —';
  }
  els.pythonRss.textContent = fmtMb(sample.pythonRssMb);
  els.containerMem.textContent = fmtMb(sample.containerMemMb);
  els.containerCpu.textContent = `CPU ${sample.containerCpu || '—'}`;
  els.connections.textContent = sample.wsConnections ?? '—';
  els.docClients.textContent = `doc clients ${sample.docClients ?? '—'}`;
  els.hostFree.textContent = fmtMb(sample.hostMemAvailableMb);
  els.gristUptime.textContent = fmtUptime(sample.gristUptimeSec);
  drawChart(history);
}

async function refresh() {
  const resp = await fetch('/monitor/api/memory');
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  render(data.latest, data.history || []);
  updateStressUi(data.latest?.stress || {});
}

function updateStressUi(stress) {
  const running = !!stress.running;
  els.startStress.disabled = running;
  els.stopStress.disabled = !running;
  if (running) {
    const elapsed = stress.startedAt ? Math.round((Date.now() - stress.startedAt) / 1000) : 0;
    els.stressStatus.textContent =
      `RUNNING ${stress.label || ''} | concurrency ${stress.concurrency || '—'} | ` +
      `requests ${stress.requests || 0} | errors ${stress.errors || 0} | elapsed ${elapsed}s` +
      (stress.lastError ? ` | last error: ${stress.lastError}` : '');
  } else if (stress.requests) {
    els.stressStatus.textContent =
      `Finished | requests ${stress.requests} | errors ${stress.errors || 0}` +
      (stress.lastError ? ` | last error: ${stress.lastError}` : '');
  } else {
    els.stressStatus.textContent = 'Idle';
  }
}

els.startStress.addEventListener('click', async () => {
  const profile = els.stressProfile.value;
  const durationSec = Math.max(30, Number(els.stressMinutes.value || 5) * 60);
  els.stressStatus.textContent = 'Starting…';
  const resp = await fetch('/monitor/api/stress/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile, durationSec }),
  });
  const data = await resp.json();
  if (!resp.ok) {
    els.stressStatus.textContent = data.error || 'Failed to start';
    return;
  }
  els.stressStatus.textContent = `Started ${profile} for ${durationSec}s`;
});

els.stopStress.addEventListener('click', async () => {
  await fetch('/monitor/api/stress/stop', { method: 'POST' });
  els.stressStatus.textContent = 'Stopping…';
});

async function loop() {
  try {
    await refresh();
  } catch (err) {
    els.statusPill.className = 'status-pill bad';
    els.statusPill.textContent = 'Offline';
    els.stressStatus.textContent = err.message || String(err);
  }
}

loop();
setInterval(loop, 3000);
window.addEventListener('resize', () => {
  fetch('/monitor/api/memory')
    .then((r) => r.json())
    .then((d) => drawChart(d.history || []))
    .catch(() => {});
});
