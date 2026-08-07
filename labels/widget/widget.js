/**
 * Sulitzilla Grist Label Print widget
 *
 * Important: grist.onRecords() receives the whole linked table when Select By
 * is missing or points at the full table — never render a canvas per row in
 * that case or Chrome will freeze.
 */

import {
  formatBatch,
  renderLabelToCanvas,
  DEFAULT_LABEL_OPTIONS,
} from '../label-engine.js';
import { createNiimbotPrintEngine } from '../print/niimbot-engine.js';

const STORAGE_KEY = 'sulitzilla-label-print-job';
/** Above this, treat payload as "full table" and refuse to canvas-render. */
const SAFE_ROW_LIMIT = 100;
/** Max label cards to draw as canvas (rest are text-only). */
const MAX_CANVAS_PREVIEWS = 40;
/** Max labels allowed in one print job. */
const MAX_PRINT = 200;

/** @type {import('../label-engine.js').FormattedLabel[]} */
let currentAll = [];
/** @type {import('../label-engine.js').FormattedLabel[]} */
let currentReady = [];
/** @type {import('../label-engine.js').FormattedLabel[]} */
let lastJob = [];
/** @type {ReturnType<typeof createNiimbotPrintEngine>} */
const printer = createNiimbotPrintEngine();

let applyToken = 0;
let recordsTimer = null;
/** @type {object|null} */
let lastMappings = null;

const els = {
  connect: document.getElementById('btn-connect'),
  print: document.getElementById('btn-print'),
  reprint: document.getElementById('btn-reprint'),
  popout: document.getElementById('btn-popout'),
  selection: document.getElementById('status-selection'),
  printer: document.getElementById('status-printer'),
  message: document.getElementById('message'),
  previewMeta: document.getElementById('preview-meta'),
  previewList: document.getElementById('preview-list'),
  width: document.getElementById('opt-width'),
  height: document.getElementById('opt-height'),
  dpi: document.getElementById('opt-dpi'),
  task: document.getElementById('opt-task'),
};

function showMessage(text, kind = 'info') {
  if (!text) {
    els.message.hidden = true;
    els.message.textContent = '';
    els.message.className = 'message';
    return;
  }
  els.message.hidden = false;
  els.message.textContent = text;
  els.message.className = `message ${kind}`;
}

function getRenderOptions() {
  return {
    widthMm: Number(els.width.value) || DEFAULT_LABEL_OPTIONS.widthMm,
    heightMm: Number(els.height.value) || DEFAULT_LABEL_OPTIONS.heightMm,
    dpi: Number(els.dpi.value) || DEFAULT_LABEL_OPTIONS.dpi,
    paddingMm: DEFAULT_LABEL_OPTIONS.paddingMm,
    printTaskName: els.task.value || undefined,
  };
}

function updatePrinterStatus() {
  els.printer.textContent = printer.isConnected()
    ? 'Printer: connected (NIIMBOT)'
    : 'Printer: disconnected';
  els.connect.textContent = printer.isConnected() ? 'Disconnect' : 'Connect Printer';
}

function updateActionState() {
  const busy = els.print.dataset.busy === '1';
  const tooMany = currentReady.length > MAX_PRINT;
  els.print.disabled = busy || currentReady.length === 0 || tooMany;
  els.reprint.disabled = busy || lastJob.length === 0;
  els.connect.disabled = busy;
}

/**
 * @param {object[]} records
 * @param {object|null} mappings
 */
function mapRecords(records, mappings) {
  return (records || []).map((record) => {
    let mapped = null;
    if (typeof grist !== 'undefined' && typeof grist.mapColumnNames === 'function') {
      try {
        mapped = grist.mapColumnNames(record);
      } catch {
        mapped = null;
      }
    }

    const src = mapped || record || {};
    const fromMapping = (key) => {
      if (!mappings || !mappings[key] || !record) return undefined;
      const col = mappings[key];
      return record[col];
    };

    return {
      id: record?.id ?? src.id,
      Code: src.Code ?? fromMapping('Code') ?? src.CODE ?? src.code ?? '',
      Brand: src.Brand ?? fromMapping('Brand') ?? src.BRAND ?? '',
      Product: src.Product ?? fromMapping('Product') ?? src.PRODUCT ?? '',
      Variation: src.Variation ?? fromMapping('Variation') ?? src.VARIATION ?? '',
      CountOrSize:
        src.CountOrSize ??
        fromMapping('CountOrSize') ??
        src.Count ??
        src.Size ??
        src.COUNT ??
        src.SIZE ??
        '',
    };
  });
}

/**
 * @param {object[]} records
 * @param {object|null} mappings
 * @param {{ source?: string }} [meta]
 */
function applyRecords(records, mappings, meta = {}) {
  lastMappings = mappings || null;
  const incoming = Array.isArray(records) ? records : [];

  // Full-table dump — do not canvas-render or build thousands of DOM nodes.
  if (incoming.length > SAFE_ROW_LIMIT) {
    currentAll = [];
    currentReady = [];
    els.selection.textContent = `${incoming.length} rows received · not loaded`;
    els.previewList.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent =
      'Too many rows to load safely. In the widget settings, set Select By to your inventory table, then select only the rows to print (or click one row to use the cursor).';
    els.previewList.appendChild(empty);
    els.previewMeta.textContent = '';
    showMessage(
      `Got ${incoming.length} rows (looks like the full table). Cap is ${SAFE_ROW_LIMIT}. Fix Select By, then select specific rows.`,
      'error'
    );
    updateActionState();
    return;
  }

  const mapped = mapRecords(incoming, mappings);
  const batch = formatBatch(mapped);
  currentAll = batch.all;
  currentReady = batch.ready;

  const selected = mapped.length;
  const ready = batch.ready.length;
  const skipped = batch.skipped.length;
  const src = meta.source ? ` · ${meta.source}` : '';
  els.selection.textContent = `${selected} selected · ${ready} ready · ${skipped} skipped${src}`;

  if (ready > MAX_PRINT) {
    showMessage(
      `${ready} ready labels exceeds print limit (${MAX_PRINT}). Select fewer rows.`,
      'warn'
    );
  } else if (skipped && ready) {
    showMessage(`${skipped} row(s) missing Code will be skipped.`, 'warn');
  } else if (skipped && !ready && selected) {
    showMessage('No printable rows — map and fill Code.', 'warn');
  } else if (!selected) {
    showMessage('Select row(s) in the linked table to preview labels.', 'info');
  } else {
    showMessage('');
  }

  renderPreviews(batch.all);
  updateActionState();
}

/**
 * Debounced apply for onRecords (can fire often / with large payloads).
 * @param {object[]} records
 * @param {object|null} mappings
 */
function scheduleApplyRecords(records, mappings) {
  clearTimeout(recordsTimer);
  const snapshot = Array.isArray(records) ? records : [];
  // Huge payloads: apply immediately on next tick without waiting (still safe path).
  const delay = snapshot.length > SAFE_ROW_LIMIT ? 0 : 50;
  recordsTimer = setTimeout(() => {
    applyRecords(snapshot, mappings, { source: 'selection' });
  }, delay);
}

/**
 * @param {import('../label-engine.js').FormattedLabel[]} labels
 */
function renderPreviews(labels) {
  const token = ++applyToken;
  const opts = getRenderOptions();
  els.previewMeta.textContent = labels.length
    ? `Preview · ${opts.widthMm}×${opts.heightMm} mm @ ${opts.dpi} dpi`
    : '';

  els.previewList.innerHTML = '';
  if (!labels.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent =
      'Select one or more inventory rows in the linked Grist table to preview labels.';
    els.previewList.appendChild(empty);
    return;
  }

  // Build light DOM first (text). Canvas only for a capped subset, in chunks.
  const frag = document.createDocumentFragment();
  /** @type {{ card: HTMLElement, label: import('../label-engine.js').FormattedLabel, index: number }[]} */
  const canvasQueue = [];

  labels.forEach((label, index) => {
    const card = document.createElement('article');
    card.className = 'card' + (label.skipped ? ' skipped' : '');

    const head = document.createElement('div');
    head.className = 'card-head';
    head.innerHTML = `<span>#${index + 1}${label.id != null ? ` · row ${label.id}` : ''}</span>`;
    const badge = document.createElement('span');
    badge.className = 'badge ' + (label.skipped ? 'skip' : 'ok');
    badge.textContent = label.skipped ? label.skipReason || 'Skipped' : 'Ready';
    head.appendChild(badge);
    card.appendChild(head);

    const lines = document.createElement('div');
    lines.className = 'card-lines';
    lines.textContent = label.skipped ? '(no Code)' : label.lines.join('\n');
    card.appendChild(lines);

    if (!label.skipped && index < MAX_CANVAS_PREVIEWS) {
      canvasQueue.push({ card, label, index });
    }

    frag.appendChild(card);
  });
  els.previewList.appendChild(frag);

  if (labels.length > MAX_CANVAS_PREVIEWS) {
    showMessage(
      `Showing text for all ${labels.length}; canvas preview for first ${MAX_CANVAS_PREVIEWS}.`,
      'info'
    );
  }

  let i = 0;
  const chunk = 5;
  function paintChunk() {
    if (token !== applyToken) return;
    const end = Math.min(i + chunk, canvasQueue.length);
    for (; i < end; i++) {
      const item = canvasQueue[i];
      try {
        const canvas = renderLabelToCanvas(item.label, opts);
        const linesEl = item.card.querySelector('.card-lines');
        if (linesEl) linesEl.replaceWith(canvas);
        else item.card.appendChild(canvas);
      } catch {
        /* keep text lines */
      }
    }
    if (i < canvasQueue.length) {
      requestAnimationFrame(paintChunk);
    }
  }
  if (canvasQueue.length) requestAnimationFrame(paintChunk);
}

async function connectOrDisconnect() {
  showMessage('');
  try {
    if (printer.isConnected()) {
      await printer.disconnect();
      showMessage('Printer disconnected.', 'info');
    } else {
      showMessage('Choose your NIIMBOT in the browser prompt…', 'info');
      await printer.connect();
      showMessage('Printer connected.', 'info');
    }
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    showMessage(msg, 'error');
  }
  updatePrinterStatus();
  updateActionState();
}

/**
 * @param {import('../label-engine.js').FormattedLabel[]} labels
 */
async function runPrint(labels) {
  if (!labels.length) return;
  if (labels.length > MAX_PRINT) {
    showMessage(`Refusing to print ${labels.length} labels (max ${MAX_PRINT}).`, 'error');
    return;
  }
  els.print.dataset.busy = '1';
  updateActionState();
  showMessage(`Printing ${labels.length} label(s)…`, 'info');

  try {
    if (!printer.isConnected()) {
      await printer.connect();
      updatePrinterStatus();
    }
    const result = await printer.print(labels, {
      ...getRenderOptions(),
      onProgress(p) {
        if (p.status === 'printing') {
          showMessage(p.message || `Printing ${p.index + 1}/${p.total}…`, 'info');
        }
      },
    });

    lastJob = labels.slice();
    persistLastJob(lastJob);

    if (result.failed) {
      showMessage(
        `Printed ${result.printed}, failed ${result.failed}. ${result.errors
          .map((e) => `#${e.index + 1}: ${e.error}`)
          .join(' · ')}`,
        'warn'
      );
    } else {
      showMessage(`Printed ${result.printed} label(s).`, 'info');
    }
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    showMessage(msg, 'error');
  } finally {
    els.print.dataset.busy = '0';
    updatePrinterStatus();
    updateActionState();
  }
}

function persistLastJob(labels) {
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        savedAt: Date.now(),
        options: getRenderOptions(),
        labels,
      })
    );
  } catch {
    /* ignore quota */
  }
}

function loadPersistedJob() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (Array.isArray(data.labels) && data.labels.length) {
      lastJob = data.labels;
    }
    if (data.options) {
      if (data.options.widthMm) els.width.value = String(data.options.widthMm);
      if (data.options.heightMm) els.height.value = String(data.options.heightMm);
      if (data.options.dpi) els.dpi.value = String(data.options.dpi);
      if (data.options.printTaskName) els.task.value = data.options.printTaskName;
    }
  } catch {
    /* ignore */
  }
}

function popOut() {
  const payload = {
    savedAt: Date.now(),
    options: getRenderOptions(),
    labels: currentReady,
  };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
  const url = new URL('./standalone.html', window.location.href);
  url.searchParams.set('autoprint', '0');
  window.open(url.toString(), 'sulitzilla-labels', 'width=720,height=820');
}

function initGrist() {
  if (typeof grist === 'undefined') {
    showMessage(
      'Grist API not found — running in standalone/preview mode.',
      'warn'
    );
    applyRecords([], null);
    return;
  }

  grist.ready({
    requiredAccess: 'read table',
    columns: [
      {
        name: 'Code',
        title: 'Code',
        description: 'Unique inventory code (required)',
        optional: false,
      },
      {
        name: 'Brand',
        title: 'Brand',
        description: 'Printed only when filled',
        optional: true,
      },
      {
        name: 'Product',
        title: 'Product',
        description: 'Printed only when filled',
        optional: true,
      },
      {
        name: 'Variation',
        title: 'Variation',
        description: 'Printed only when filled',
        optional: true,
      },
      {
        name: 'CountOrSize',
        title: 'Count / Size',
        description: 'Printed only when filled',
        optional: true,
      },
    ],
  });

  // Cursor row (Select By linked) — always safe, one record.
  grist.onRecord((record, mappings) => {
    if (!record) {
      if (!currentReady.length) applyRecords([], mappings || lastMappings);
      return;
    }
    applyRecords([record], mappings || lastMappings, { source: 'cursor' });
  });

  // Multi-select / table data. Full-table dumps are ignored so they don't
  // wipe a valid cursor selection or freeze the tab.
  grist.onRecords((records, mappings) => {
    const list = records || [];
    if (list.length > SAFE_ROW_LIMIT) {
      clearTimeout(recordsTimer);
      if (!currentReady.length) {
        showMessage(
          `Grist sent ${list.length} rows (full table). Set this widget’s Select By to your inventory table, then click or multi-select rows to print.`,
          'error'
        );
      }
      return;
    }
    if (list.length === 0) return;
    scheduleApplyRecords(list, mappings || null);
  });

  grist.onOptions((options) => {
    if (!options) return;
    if (options.widthMm != null) els.width.value = String(options.widthMm);
    if (options.heightMm != null) els.height.value = String(options.heightMm);
    if (options.dpi != null) els.dpi.value = String(options.dpi);
    if (options.printTaskName != null) els.task.value = String(options.printTaskName || '');
    if (currentAll.length && currentAll.length <= SAFE_ROW_LIMIT) {
      renderPreviews(currentAll);
    }
  });
}

function wireUi() {
  els.connect.addEventListener('click', () => {
    connectOrDisconnect();
  });
  els.print.addEventListener('click', () => {
    runPrint(currentReady);
  });
  els.reprint.addEventListener('click', () => {
    runPrint(lastJob);
  });
  els.popout.addEventListener('click', () => {
    popOut();
  });

  ['change', 'input'].forEach((evt) => {
    els.width.addEventListener(evt, () => {
      if (currentAll.length && currentAll.length <= SAFE_ROW_LIMIT) renderPreviews(currentAll);
      saveOptionsSoon();
    });
    els.height.addEventListener(evt, () => {
      if (currentAll.length && currentAll.length <= SAFE_ROW_LIMIT) renderPreviews(currentAll);
      saveOptionsSoon();
    });
    els.dpi.addEventListener(evt, () => {
      if (currentAll.length && currentAll.length <= SAFE_ROW_LIMIT) renderPreviews(currentAll);
      saveOptionsSoon();
    });
    els.task.addEventListener(evt, () => {
      saveOptionsSoon();
    });
  });
}

let optionsTimer = null;
function saveOptionsSoon() {
  if (typeof grist === 'undefined' || typeof grist.setOptions !== 'function') return;
  clearTimeout(optionsTimer);
  optionsTimer = setTimeout(() => {
    const opts = getRenderOptions();
    grist.setOptions({
      widthMm: opts.widthMm,
      heightMm: opts.heightMm,
      dpi: opts.dpi,
      printTaskName: opts.printTaskName || '',
    }).catch(() => {});
  }, 400);
}

loadPersistedJob();
wireUi();
updatePrinterStatus();
updateActionState();
initGrist();
