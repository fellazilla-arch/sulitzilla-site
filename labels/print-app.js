/**
 * Paste → preview → Xprinter (TSPL) / NIIMBOT print.
 */

import {
  formatBatch,
  renderLabelToCanvas,
  DEFAULT_LABEL_OPTIONS,
} from './label-engine.js';
import {
  parseAndFilterPaste,
  toCleanTsv,
  rowsToLabelFields,
} from './paste-parse.js';
import { createNiimbotPrintEngine } from './print/niimbot-engine.js';
import { createXprinterPrintEngine } from './print/xprinter-engine.js';

const STORAGE_KEY = 'sulitzilla-label-print-job';
const MAX_CANVAS = 60;
const MAX_PRINT = 200;

const xprinter = createXprinterPrintEngine({ invert: true });
const niimbot = createNiimbotPrintEngine();

/** @type {'xprinter'|'niimbot'} */
let engineId = 'xprinter';

/** @type {import('./label-engine.js').FormattedLabel[]} */
let currentReady = [];
/** @type {import('./label-engine.js').FormattedLabel[]} */
let currentAll = [];
/** @type {import('./label-engine.js').FormattedLabel[]} */
let lastJob = [];

/** @type {{ headers: string[], rows: string[][] } | null} */
let parsed = null;
/** @type {Record<string, number>} */
let columnMap = {
  Code: -1,
  Brand: -1,
  Product: -1,
  Variation: -1,
  CountOrSize: -1,
};

const els = {
  paste: document.getElementById('paste-input'),
  parse: document.getElementById('btn-parse'),
  connectUsb: document.getElementById('btn-connect-usb'),
  connectBt: document.getElementById('btn-connect-bt'),
  disconnect: document.getElementById('btn-disconnect'),
  print: document.getElementById('btn-print'),
  reprint: document.getElementById('btn-reprint'),
  clear: document.getElementById('btn-clear'),
  selection: document.getElementById('status-selection'),
  printer: document.getElementById('status-printer'),
  message: document.getElementById('message'),
  previewMeta: document.getElementById('preview-meta'),
  previewList: document.getElementById('preview-list'),
  fieldStatus: document.getElementById('field-status'),
  mapRow: document.getElementById('map-row'),
  maps: {
    Code: document.getElementById('map-code'),
    Brand: document.getElementById('map-brand'),
    Product: document.getElementById('map-product'),
    Variation: document.getElementById('map-variation'),
    CountOrSize: document.getElementById('map-count'),
  },
  engine: document.getElementById('opt-engine'),
  width: document.getElementById('opt-width'),
  height: document.getElementById('opt-height'),
  gap: document.getElementById('opt-gap'),
  offsetX: document.getElementById('opt-offset-x'),
  offsetY: document.getElementById('opt-offset-y'),
  fontCode: document.getElementById('opt-font-code'),
  fontProduct: document.getElementById('opt-font-product'),
  fontVariation: document.getElementById('opt-font-variation'),
  fontCount: document.getElementById('opt-font-count'),
};

const FIELD_LABELS = {
  Code: 'Code',
  Brand: 'Brand',
  Product: 'Product',
  Variation: 'Variation',
  CountOrSize: 'Count/Size',
};

function activePrinter() {
  return engineId === 'niimbot' ? niimbot : xprinter;
}

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
    dpi: DEFAULT_LABEL_OPTIONS.dpi,
    paddingMm: DEFAULT_LABEL_OPTIONS.paddingMm,
    gapMm: Number(els.gap.value),
    offsetXMm: Number(els.offsetX.value) || 0,
    offsetYMm: Number(els.offsetY.value) || 0,
    invert: true,
    fontScale: {
      code: (Number(els.fontCode.value) || 145) / 100,
      product: (Number(els.fontProduct.value) || 70) / 100,
      variation: (Number(els.fontVariation.value) || 100) / 100,
      count: (Number(els.fontCount.value) || 115) / 100,
    },
  };
}

function updateEngineUi() {
  engineId = els.engine.value === 'niimbot' ? 'niimbot' : 'xprinter';
  els.connectUsb.hidden = engineId !== 'xprinter';
  els.connectBt.textContent =
    engineId === 'xprinter' ? 'Connect Bluetooth' : 'Connect NIIMBOT';
  updatePrinterStatus();
  updateActionState();
}

function updatePrinterStatus() {
  const p = activePrinter();
  if (!p.isConnected()) {
    els.printer.textContent =
      engineId === 'xprinter'
        ? 'Printer: disconnected · Xprinter — use Connect USB'
        : 'Printer: disconnected · NIIMBOT Bluetooth';
  } else if (engineId === 'xprinter') {
    const t = typeof p.getTransport === 'function' ? p.getTransport() : null;
    els.printer.textContent =
      t === 'bluetooth' ? 'Printer: connected (Xprinter Bluetooth)' : 'Printer: connected (Xprinter USB)';
  } else {
    els.printer.textContent = 'Printer: connected (NIIMBOT)';
  }
}

function updateActionState() {
  const busy = els.print.dataset.busy === '1';
  const p = activePrinter();
  const connected = p.isConnected();
  els.print.disabled = busy || !currentReady.length || currentReady.length > MAX_PRINT;
  els.reprint.disabled = busy || !lastJob.length;
  els.connectUsb.disabled = busy || engineId !== 'xprinter';
  els.connectBt.disabled = busy;
  els.disconnect.disabled = busy || !connected;
  els.engine.disabled = busy || connected;
}

function updateFieldStatus(mapIn) {
  const map = mapIn || {};
  els.fieldStatus.hidden = false;
  els.fieldStatus.innerHTML = '';
  Object.keys(FIELD_LABELS).forEach((field) => {
    const on = map[field] != null && map[field] >= 0;
    const pill = document.createElement('span');
    pill.className = 'field-pill ' + (on ? 'on' : 'off');
    pill.textContent = on ? FIELD_LABELS[field] : `${FIELD_LABELS[field]} (not in this paste)`;
    els.fieldStatus.appendChild(pill);
  });
}

function fillMapSelects(headers, map) {
  els.mapRow.hidden = headers.length === 0;
  const opts = [{ value: -1, label: '— none —' }].concat(
    headers.map((h, i) => ({ value: i, label: h || `Column ${i + 1}` }))
  );
  Object.entries(els.maps).forEach(([field, select]) => {
    select.innerHTML = '';
    opts.forEach((o) => {
      const el = document.createElement('option');
      el.value = String(o.value);
      el.textContent = o.label;
      if (Number(o.value) === map[field]) el.selected = true;
      select.appendChild(el);
    });
  });
  updateFieldStatus(map);
}

function readMapFromSelects() {
  return {
    Code: Number(els.maps.Code.value),
    Brand: Number(els.maps.Brand.value),
    Product: Number(els.maps.Product.value),
    Variation: Number(els.maps.Variation.value),
    CountOrSize: Number(els.maps.CountOrSize.value),
  };
}

function applyParsed() {
  if (!parsed) return;
  columnMap = readMapFromSelects();
  updateFieldStatus(columnMap);
  const fields = rowsToLabelFields(parsed.rows, columnMap);
  const batch = formatBatch(fields);
  currentAll = batch.all;
  currentReady = batch.ready;

  els.selection.textContent = `${batch.all.length} rows · ${batch.ready.length} ready · ${batch.skipped.length} skipped`;

  if (!batch.ready.length) {
    showMessage('No printable rows. Need a Code column (CODE) in the paste.', 'warn');
  } else if (batch.skipped.length) {
    showMessage(`${batch.skipped.length} row(s) missing Code will be skipped.`, 'warn');
  } else if (batch.ready.length > MAX_PRINT) {
    showMessage(`Ready count ${batch.ready.length} exceeds print limit (${MAX_PRINT}).`, 'warn');
  } else {
    showMessage(`Ready to print ${batch.ready.length} label(s).`, 'info');
  }

  renderPreviews(batch.all);
  updateActionState();
}

function loadPaste() {
  const text = els.paste.value;
  if (!text.trim()) {
    showMessage('Paste some rows from Grist first.', 'warn');
    return;
  }

  const { raw, filtered, fields } = parseAndFilterPaste(text);
  if (!filtered.rows.length && !raw.rows.length) {
    showMessage('Could not parse any data rows.', 'error');
    return;
  }
  if (!filtered.headers.length || filtered.columnMap.Code < 0) {
    showMessage(
      'Could not find inventory codes (like B2385) in the paste. Select the rows that include the CODE column, copy again, and paste.',
      'error'
    );
    return;
  }

  els.paste.value = toCleanTsv(filtered);

  parsed = { headers: filtered.headers, rows: filtered.rows };
  columnMap = { ...filtered.columnMap };
  fillMapSelects(filtered.headers, columnMap);

  const droppedCount = filtered.droppedHeaders.length;
  const batch = formatBatch(fields);
  currentAll = batch.all;
  currentReady = batch.ready;

  els.selection.textContent = `${batch.all.length} rows · ${batch.ready.length} ready · ${batch.skipped.length} skipped`;

  const found = filtered.kept.map((k) => k.field);
  const missingFields = Object.keys(FIELD_LABELS).filter((f) => filtered.columnMap[f] < 0);
  let msg = filtered.layoutName
    ? `Detected “${filtered.layoutName}”. `
    : filtered.layout && filtered.layout !== 'headers' && filtered.layout !== 'inferred'
      ? `Detected layout “${filtered.layout}”. `
      : '';
  msg += `This paste → ${found.join(', ') || 'nothing'}.`;
  if (missingFields.length) {
    msg += ` Not present: ${missingFields.map((f) => FIELD_LABELS[f]).join(', ')} (OK — omitted on labels).`;
  }
  if (droppedCount) msg += ` Removed ${droppedCount} other column(s).`;
  if (batch.skipped.length) msg += ` ${batch.skipped.length} row(s) missing Code skipped.`;
  showMessage(msg, batch.skipped.length ? 'warn' : 'info');

  renderPreviews(batch.all);
  updateActionState();
}

/**
 * @param {import('./label-engine.js').FormattedLabel[]} labels
 */
function renderPreviews(labels) {
  const opts = getRenderOptions();
  els.previewMeta.textContent = labels.length
    ? `Preview · ${opts.widthMm}×${opts.heightMm} mm`
    : '';
  els.previewList.innerHTML = '';

  if (!labels.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No labels yet.';
    els.previewList.appendChild(empty);
    return;
  }

  const frag = document.createDocumentFragment();
  labels.forEach((label, index) => {
    const card = document.createElement('article');
    card.className = 'card' + (label.skipped ? ' skipped' : '');
    const head = document.createElement('div');
    head.className = 'card-head';
    head.innerHTML = `<span>#${index + 1}</span>`;
    const badge = document.createElement('span');
    badge.className = 'badge ' + (label.skipped ? 'skip' : 'ok');
    badge.textContent = label.skipped ? label.skipReason || 'Skipped' : 'Ready';
    head.appendChild(badge);
    card.appendChild(head);

    if (!label.skipped && index < MAX_CANVAS) {
      try {
        card.appendChild(renderLabelToCanvas(label, opts));
      } catch {
        const lines = document.createElement('div');
        lines.className = 'card-lines';
        lines.textContent = label.lines.join('\n');
        card.appendChild(lines);
      }
    } else {
      const lines = document.createElement('div');
      lines.className = 'card-lines';
      lines.textContent = label.skipped ? '(no Code)' : label.lines.join('\n');
      card.appendChild(lines);
    }
    frag.appendChild(card);
  });
  els.previewList.appendChild(frag);
}

/**
 * @param {'serial'|'bluetooth'} transport
 */
async function connectPrinter(transport) {
  const p = activePrinter();
  try {
    if (engineId === 'xprinter') {
      showMessage(
        transport === 'serial'
          ? 'Pick the Xprinter USB serial port in the browser prompt…'
          : 'Pick the Xprinter in the Bluetooth prompt…',
        'info'
      );
      await p.connect({ transport });
      showMessage(
        transport === 'serial' ? 'Xprinter connected over USB.' : 'Xprinter connected over Bluetooth.',
        'info'
      );
    } else {
      showMessage('Choose your NIIMBOT in the browser prompt…', 'info');
      await p.connect();
      showMessage('NIIMBOT connected.', 'info');
    }
  } catch (err) {
    showMessage(err && err.message ? err.message : String(err), 'error');
  }
  updatePrinterStatus();
  updateActionState();
}

async function disconnectPrinter() {
  try {
    await xprinter.disconnect();
    await niimbot.disconnect();
    showMessage('Printer disconnected.', 'info');
  } catch (err) {
    showMessage(err && err.message ? err.message : String(err), 'error');
  }
  updatePrinterStatus();
  updateActionState();
}

/**
 * @param {import('./label-engine.js').FormattedLabel[]} labels
 */
async function runPrint(labels) {
  if (!labels.length) return;
  if (labels.length > MAX_PRINT) {
    showMessage(`Refusing to print ${labels.length} (max ${MAX_PRINT}).`, 'error');
    return;
  }
  const p = activePrinter();
  els.print.dataset.busy = '1';
  updateActionState();
  try {
    if (!p.isConnected()) {
      if (engineId === 'xprinter') {
        await p.connect({ transport: 'serial' });
      } else {
        await p.connect();
      }
      updatePrinterStatus();
    }
    const opts = getRenderOptions();
    const result = await p.print(labels, {
      ...opts,
      onProgress(prog) {
        if (prog.status === 'printing') {
          showMessage(prog.message || `Printing ${prog.index + 1}/${prog.total}…`, 'info');
        }
      },
    });
    lastJob = labels.slice();
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ savedAt: Date.now(), options: opts, labels })
      );
    } catch {
      /* ignore */
    }
    showMessage(
      result.failed
        ? `Printed ${result.printed}, failed ${result.failed}`
        : `Printed ${result.printed} label(s).`,
      result.failed ? 'warn' : 'info'
    );
  } catch (err) {
    showMessage(err && err.message ? err.message : String(err), 'error');
  } finally {
    els.print.dataset.busy = '0';
    updatePrinterStatus();
    updateActionState();
  }
}

function clearAll() {
  els.paste.value = '';
  parsed = null;
  currentAll = [];
  currentReady = [];
  els.mapRow.hidden = true;
  els.fieldStatus.hidden = true;
  els.fieldStatus.innerHTML = '';
  els.previewList.innerHTML = '';
  els.previewMeta.textContent = '';
  els.selection.textContent = 'Paste from any Grist view';
  showMessage('');
  updateActionState();
}

els.parse.addEventListener('click', loadPaste);
els.connectUsb.addEventListener('click', () => connectPrinter('serial'));
els.connectBt.addEventListener('click', async () => {
  if (engineId === 'niimbot') {
    try {
      showMessage('Choose your NIIMBOT in the browser prompt…', 'info');
      await niimbot.connect();
      showMessage('NIIMBOT connected.', 'info');
    } catch (err) {
      showMessage(err && err.message ? err.message : String(err), 'error');
    }
    updatePrinterStatus();
    updateActionState();
    return;
  }
  await connectPrinter('bluetooth');
});
els.disconnect.addEventListener('click', disconnectPrinter);
els.print.addEventListener('click', () => runPrint(currentReady));
els.reprint.addEventListener('click', () => runPrint(lastJob));
els.clear.addEventListener('click', clearAll);
els.engine.addEventListener('change', async () => {
  if (xprinter.isConnected() || niimbot.isConnected()) {
    await disconnectPrinter();
  }
  updateEngineUi();
});

els.paste.addEventListener('paste', () => {
  setTimeout(loadPaste, 0);
});

els.paste.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    loadPaste();
  }
});

Object.values(els.maps).forEach((select) => {
  select.addEventListener('change', () => {
    if (parsed) applyParsed();
  });
});

['change', 'input'].forEach((evt) => {
  [els.width, els.height, els.fontCode, els.fontProduct, els.fontVariation, els.fontCount].forEach((el) => {
    el.addEventListener(evt, () => {
      if (currentAll.length) renderPreviews(currentAll);
    });
  });
});

updateEngineUi();
showMessage(
  'Long product names wrap. Defaults: Offset X 6 mm · Code 145% · Product 70% · Variation 100% · Count 115%.',
  'info'
);
