/**
 * Paste → preview → NIIMBOT print (no Grist widget required).
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

const STORAGE_KEY = 'sulitzilla-label-print-job';
const MAX_CANVAS = 60;
const MAX_PRINT = 200;

const printer = createNiimbotPrintEngine();

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
  connect: document.getElementById('btn-connect'),
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
  width: document.getElementById('opt-width'),
  height: document.getElementById('opt-height'),
  dpi: document.getElementById('opt-dpi'),
  task: document.getElementById('opt-task'),
};

const FIELD_LABELS = {
  Code: 'Code',
  Brand: 'Brand',
  Product: 'Product',
  Variation: 'Variation',
  CountOrSize: 'Count/Size',
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
    ? 'Printer: connected (NIIMBOT protocol)'
    : 'Printer: disconnected · needs NIIMBOT (Clabel/Xprinter not supported yet)';
  els.connect.textContent = printer.isConnected() ? 'Disconnect' : 'Connect Printer';
}

function updateActionState() {
  const busy = els.print.dataset.busy === '1';
  els.print.disabled = busy || !currentReady.length || currentReady.length > MAX_PRINT;
  els.reprint.disabled = busy || !lastJob.length;
  els.connect.disabled = busy;
}

function updateFieldStatus(columnMap) {
  const map = columnMap || {};
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

  // Replace paste box with cleaned TSV (only kept columns).
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
    ? `Preview · ${opts.widthMm}×${opts.heightMm} mm @ ${opts.dpi} dpi`
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

async function connectOrDisconnect() {
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
    showMessage(err.message || String(err), 'error');
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
  els.print.dataset.busy = '1';
  updateActionState();
  try {
    if (!printer.isConnected()) await printer.connect();
    updatePrinterStatus();
        const result = await printer.print(labels, {
      ...getRenderOptions(),
      onProgress(p) {
        if (p.status === 'printing') {
          showMessage(p.message || `Printing ${p.index + 1}/${p.total}…`, 'info');
        }
      },
    });
    lastJob = labels.slice();
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ savedAt: Date.now(), options: getRenderOptions(), labels })
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
    const raw = err && err.message ? err.message : String(err);
    const msg = /timeout waiting response/i.test(raw)
      ? 'Print timed out — this printer is not speaking NIIMBOT (Xprinter/Clabel need a different driver).'
      : raw;
    showMessage(msg, 'error');
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
els.connect.addEventListener('click', connectOrDisconnect);
els.print.addEventListener('click', () => runPrint(currentReady));
els.reprint.addEventListener('click', () => runPrint(lastJob));
els.clear.addEventListener('click', clearAll);

// Auto-strip as soon as you paste (no need to hunt for Load paste).
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
  [els.width, els.height, els.dpi].forEach((el) => {
    el.addEventListener(evt, () => {
      if (currentAll.length) renderPreviews(currentAll);
    });
  });
});

updatePrinterStatus();
updateActionState();
showMessage(
  'Paste from any Grist view — column layouts can change. Each paste is detected fresh. Only Code is required.',
  'info'
);
