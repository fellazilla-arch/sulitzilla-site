/**
 * Paste → preview → Xprinter (TSPL) print.
 */

import {
  formatBatch,
  formatRecord,
  renderLabelToCanvas,
  DEFAULT_LABEL_OPTIONS,
} from './label-engine.js';
import {
  parseAndFilterPaste,
  toCleanTsv,
  rowsToLabelFields,
} from './paste-parse.js';
import { createXprinterPrintEngine } from './print/xprinter-engine.js';

const STORAGE_KEY = 'sulitzilla-label-print-job';
const PROFILES_KEY = 'sulitzilla-label-profiles';
/** Canvas preview + print share the same cap (plain-text fallback only beyond this). */
const MAX_CANVAS = 200;
const MAX_PRINT = 200;

/** @typedef {{
 *   width: string, height: string, gap: string, offsetX: string, offsetY: string,
 *   fontCode: string, fontProduct: string, fontColor: string, fontStorage: string, fontCondition: string
 * }} SettingsSnapshot */

/** @typedef {{ id: string, name: string, settings: SettingsSnapshot }} SettingsProfile */

const DEFAULT_SETTINGS = Object.freeze({
  width: '30',
  height: '20',
  gap: '2',
  offsetX: '6',
  offsetY: '0',
  fontCode: '145',
  fontProduct: '70',
  fontColor: '100',
  fontStorage: '115',
  fontCondition: '100',
});

const xprinter = createXprinterPrintEngine({ invert: true });

/** @type {import('./label-engine.js').FormattedLabel[]} */
let currentReady = [];
/** @type {Array<import('./label-engine.js').FormattedLabel & { edited?: boolean }>} */
let currentAll = [];
/** @type {import('./label-engine.js').FormattedLabel[]} */
let lastJob = [];

/** Indexes with the edit panel open */
const editingIndexes = new Set();

/** @type {{ headers: string[], rows: string[][] } | null} */
let parsed = null;

const EDIT_FIELDS = [
  { key: 'Code', label: 'Code' },
  { key: 'Brand', label: 'Brand' },
  { key: 'Product', label: 'Product' },
  { key: 'Color', label: 'Color / flavor' },
  { key: 'Storage', label: 'Storage' },
  { key: 'Condition', label: 'Condition' },
  { key: 'Variation', label: 'Variation' },
  { key: 'CountOrSize', label: 'Count / size' },
  { key: 'Strength', label: 'Strength' },
];
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
    Color: document.getElementById('map-color'),
    Storage: document.getElementById('map-storage'),
    Condition: document.getElementById('map-condition'),
    Variation: document.getElementById('map-variation'),
    CountOrSize: document.getElementById('map-count'),
    Strength: document.getElementById('map-strength'),
  },
  width: document.getElementById('opt-width'),
  height: document.getElementById('opt-height'),
  gap: document.getElementById('opt-gap'),
  offsetX: document.getElementById('opt-offset-x'),
  offsetY: document.getElementById('opt-offset-y'),
  fontCode: document.getElementById('opt-font-code'),
  fontProduct: document.getElementById('opt-font-product'),
  fontColor: document.getElementById('opt-font-color'),
  fontStorage: document.getElementById('opt-font-storage'),
  fontCondition: document.getElementById('opt-font-condition'),
  profile: document.getElementById('opt-profile'),
  profileSave: document.getElementById('btn-profile-save'),
  profileSaveAs: document.getElementById('btn-profile-save-as'),
  profileDelete: document.getElementById('btn-profile-delete'),
};

const FIELD_LABELS = {
  Code: 'Code',
  Brand: 'Brand',
  Product: 'Product',
  Color: 'Color',
  Storage: 'Storage',
  Condition: 'Condition',
  Variation: 'Variation',
  CountOrSize: 'Count/Size',
  Strength: 'Strength',
};

function activePrinter() {
  return xprinter;
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

function readSettingsFromUi() {
  return {
    width: els.width.value,
    height: els.height.value,
    gap: els.gap.value,
    offsetX: els.offsetX.value,
    offsetY: els.offsetY.value,
    fontCode: els.fontCode.value,
    fontProduct: els.fontProduct.value,
    fontColor: els.fontColor.value,
    fontStorage: els.fontStorage.value,
    fontCondition: els.fontCondition.value,
  };
}

/**
 * @param {Partial<SettingsSnapshot>} settings
 */
function applySettingsToUi(settings) {
  const s = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  els.width.value = s.width;
  els.height.value = s.height;
  els.gap.value = s.gap;
  els.offsetX.value = s.offsetX;
  els.offsetY.value = s.offsetY;
  els.fontCode.value = s.fontCode;
  els.fontProduct.value = s.fontProduct;
  els.fontColor.value = s.fontColor;
  els.fontStorage.value = s.fontStorage;
  els.fontCondition.value = s.fontCondition;
}

function loadProfilesState() {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) {
      return { activeId: '', profiles: /** @type {SettingsProfile[]} */ ([]) };
    }
    const parsed = JSON.parse(raw);
    const profiles = Array.isArray(parsed.profiles)
      ? parsed.profiles.filter((p) => p && p.id && p.name && p.settings)
      : [];
    return {
      activeId: typeof parsed.activeId === 'string' ? parsed.activeId : '',
      profiles,
    };
  } catch {
    return { activeId: '', profiles: [] };
  }
}

/**
 * @param {{ activeId: string, profiles: SettingsProfile[] }} state
 */
function saveProfilesState(state) {
  try {
    localStorage.setItem(
      PROFILES_KEY,
      JSON.stringify({
        activeId: state.activeId || '',
        profiles: state.profiles || [],
      })
    );
  } catch {
    showMessage('Could not save settings on this browser (storage blocked).', 'warn');
  }
}

function newProfileId() {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function refreshProfileSelect() {
  const state = loadProfilesState();
  const select = els.profile;
  select.innerHTML = '';

  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = state.profiles.length ? '— choose person —' : '— no saved people yet —';
  select.appendChild(blank);

  state.profiles
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      select.appendChild(opt);
    });

  if (state.activeId && state.profiles.some((p) => p.id === state.activeId)) {
    select.value = state.activeId;
  } else {
    select.value = '';
  }

  els.profileDelete.disabled = !select.value;
  els.profileSave.disabled = !select.value;
}

function applyActiveProfile() {
  const state = loadProfilesState();
  const profile = state.profiles.find((p) => p.id === state.activeId);
  if (profile) {
    applySettingsToUi(profile.settings);
    if (currentAll.length) renderPreviews(currentAll);
  }
}

/**
 * @param {string} name
 * @param {SettingsSnapshot} settings
 * @param {string} [existingId]
 */
function upsertProfile(name, settings, existingId) {
  const state = loadProfilesState();
  const cleanName = String(name || '').trim();
  if (!cleanName) return null;

  const dup = state.profiles.find(
    (p) => p.name.toLowerCase() === cleanName.toLowerCase() && p.id !== existingId
  );
  if (dup) {
    showMessage(`Someone named “${dup.name}” already exists. Pick a different name.`, 'warn');
    return null;
  }

  if (existingId) {
    const idx = state.profiles.findIndex((p) => p.id === existingId);
    if (idx >= 0) {
      state.profiles[idx] = {
        ...state.profiles[idx],
        name: cleanName,
        settings: { ...settings },
      };
      state.activeId = existingId;
      saveProfilesState(state);
      refreshProfileSelect();
      return state.profiles[idx];
    }
  }

  const profile = {
    id: newProfileId(),
    name: cleanName,
    settings: { ...settings },
  };
  state.profiles.push(profile);
  state.activeId = profile.id;
  saveProfilesState(state);
  refreshProfileSelect();
  return profile;
}

function onProfileChange() {
  const id = els.profile.value;
  const state = loadProfilesState();
  state.activeId = id;
  saveProfilesState(state);
  els.profileDelete.disabled = !id;
  els.profileSave.disabled = !id;

  const profile = state.profiles.find((p) => p.id === id);
  if (profile) {
    applySettingsToUi(profile.settings);
    if (currentAll.length) renderPreviews(currentAll);
    showMessage(`Loaded settings for ${profile.name}.`, 'info');
  }
}

function onProfileSave() {
  const state = loadProfilesState();
  const id = els.profile.value;
  const profile = state.profiles.find((p) => p.id === id);
  if (!profile) {
    onProfileSaveAs();
    return;
  }
  const updated = upsertProfile(profile.name, readSettingsFromUi(), profile.id);
  if (updated) showMessage(`Saved settings for ${updated.name}.`, 'info');
}

function onProfileSaveAs() {
  const suggested = els.profile.selectedOptions[0]?.textContent?.startsWith('—')
    ? ''
    : els.profile.selectedOptions[0]?.textContent || '';
  const name = window.prompt('Name for these settings (e.g. employee name):', suggested);
  if (name == null) return;
  const profile = upsertProfile(name, readSettingsFromUi());
  if (profile) showMessage(`Saved new settings for ${profile.name}.`, 'info');
}

function onProfileDelete() {
  const state = loadProfilesState();
  const id = els.profile.value;
  const profile = state.profiles.find((p) => p.id === id);
  if (!profile) return;
  if (!window.confirm(`Delete saved settings for “${profile.name}”?`)) return;
  state.profiles = state.profiles.filter((p) => p.id !== id);
  state.activeId = '';
  saveProfilesState(state);
  refreshProfileSelect();
  applySettingsToUi(DEFAULT_SETTINGS);
  if (currentAll.length) renderPreviews(currentAll);
  showMessage(`Deleted settings for ${profile.name}.`, 'info');
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
      color: (Number(els.fontColor.value) || 100) / 100,
      storage: (Number(els.fontStorage.value) || 115) / 100,
      condition: (Number(els.fontCondition.value) || 100) / 100,
    },
  };
}

function updatePrinterStatus() {
  const p = activePrinter();
  if (!p.isConnected()) {
    els.printer.textContent = 'Printer: disconnected · Xprinter — use Connect USB';
    return;
  }
  const t = typeof p.getTransport === 'function' ? p.getTransport() : null;
  els.printer.textContent =
    t === 'bluetooth' ? 'Printer: connected (Xprinter Bluetooth)' : 'Printer: connected (Xprinter USB)';
}

function updateActionState() {
  const busy = els.print.dataset.busy === '1';
  const p = activePrinter();
  const connected = p.isConnected();
  els.print.disabled = busy || !currentReady.length || currentReady.length > MAX_PRINT;
  els.reprint.disabled = busy || !lastJob.length;
  els.connectUsb.disabled = busy;
  els.connectBt.disabled = busy;
  els.disconnect.disabled = busy || !connected;
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
    Color: Number(els.maps.Color.value),
    Storage: Number(els.maps.Storage.value),
    Condition: Number(els.maps.Condition.value),
    Variation: Number(els.maps.Variation.value),
    CountOrSize: Number(els.maps.CountOrSize.value),
    Strength: Number(els.maps.Strength?.value ?? -1),
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
  editingIndexes.clear();

  els.selection.textContent = `${batch.all.length} rows · ${batch.ready.length} ready · ${batch.skipped.length} skipped`;

  if (!batch.ready.length) {
    showMessage('No printable rows. Need a Code column (CODE) in the paste.', 'warn');
  } else if (batch.skipped.length) {
    showMessage(`${batch.skipped.length} row(s) missing Code will be skipped.`, 'warn');
  } else if (batch.ready.length > MAX_PRINT) {
    showMessage(`Ready count ${batch.ready.length} exceeds print limit (${MAX_PRINT}).`, 'warn');
  } else {
    showMessage(`Ready to print ${batch.ready.length} label(s). Click Edit on a preview to tweak text.`, 'info');
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
  editingIndexes.clear();

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
  msg += ' Click Edit on a preview to tweak any label.';
  showMessage(msg, batch.skipped.length ? 'warn' : 'info');

  renderPreviews(batch.all);
  updateActionState();
}

function syncReadyFromAll() {
  currentReady = currentAll.filter((l) => !l.skipped);
  const edited = currentAll.filter((l) => l.edited).length;
  els.selection.textContent = `${currentAll.length} rows · ${currentReady.length} ready · ${
    currentAll.length - currentReady.length
  } skipped${edited ? ` · ${edited} edited` : ''}`;
  updateActionState();
}

/**
 * @param {number} index
 * @param {Record<string, string>} patch
 */
function applyLabelEdit(index, patch) {
  const prev = currentAll[index];
  if (!prev) return;
  const next = formatRecord({ ...(prev.fields || {}), ...patch, id: prev.id ?? index + 1 });
  currentAll[index] = { ...next, edited: true };
  syncReadyFromAll();

  const card = els.previewList.querySelector(`[data-label-index="${index}"]`);
  if (!card) {
    renderPreviews(currentAll);
    return;
  }

  const badge = card.querySelector('.badge');
  if (badge) {
    badge.className = 'badge ' + (next.skipped ? 'skip' : next.edited ? 'edited' : 'ok');
    badge.textContent = next.skipped ? next.skipReason || 'Skipped' : 'Edited';
  }
  card.classList.toggle('skipped', !!next.skipped);
  card.classList.add('edited');

  const preview = card.querySelector('.card-preview');
  if (preview) {
    preview.innerHTML = '';
    if (!next.skipped && index < MAX_CANVAS) {
      try {
        preview.appendChild(renderLabelToCanvas(next, getRenderOptions()));
      } catch {
        const lines = document.createElement('div');
        lines.className = 'card-lines';
        lines.textContent = next.lines.join('\n');
        preview.appendChild(lines);
      }
    } else {
      const lines = document.createElement('div');
      lines.className = 'card-lines';
      lines.textContent = next.skipped ? '(no Code)' : next.lines.join('\n');
      preview.appendChild(lines);
    }
  }
}

/**
 * @param {import('./label-engine.js').FormattedLabel & { edited?: boolean }} label
 * @param {number} index
 */
function buildEditPanel(label, index) {
  const panel = document.createElement('div');
  panel.className = 'card-edit';
  panel.hidden = !editingIndexes.has(index);

  const fields = label.fields || {};
  EDIT_FIELDS.forEach(({ key, label: fieldLabel }) => {
    const row = document.createElement('label');
    row.className = 'card-edit-field';
    const span = document.createElement('span');
    span.textContent = fieldLabel;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = fields[key] || '';
    input.dataset.field = key;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.addEventListener('input', () => {
      applyLabelEdit(index, { [key]: input.value });
    });
    row.appendChild(span);
    row.appendChild(input);
    panel.appendChild(row);
  });

  const hint = document.createElement('p');
  hint.className = 'card-edit-hint';
  hint.textContent = 'Edits apply to this label only (print uses the preview).';
  panel.appendChild(hint);
  return panel;
}

/**
 * @param {Array<import('./label-engine.js').FormattedLabel & { edited?: boolean }>} labels
 */
function renderPreviews(labels) {
  const opts = getRenderOptions();
  const editedCount = labels.filter((l) => l.edited).length;
  els.previewMeta.textContent = labels.length
    ? `Preview · ${opts.widthMm}×${opts.heightMm} mm · click Edit to tweak a label${
        editedCount ? ` · ${editedCount} edited` : ''
      }`
    : '';
  els.previewList.innerHTML = '';

  if (!labels.length) {
    editingIndexes.clear();
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No labels yet.';
    els.previewList.appendChild(empty);
    return;
  }

  const frag = document.createDocumentFragment();
  labels.forEach((label, index) => {
    const card = document.createElement('article');
    card.className =
      'card' +
      (label.skipped ? ' skipped' : '') +
      (label.edited ? ' edited' : '') +
      (editingIndexes.has(index) ? ' is-editing' : '');
    card.dataset.labelIndex = String(index);

    const head = document.createElement('div');
    head.className = 'card-head';
    const num = document.createElement('span');
    num.textContent = `#${index + 1}`;
    head.appendChild(num);

    const actions = document.createElement('div');
    actions.className = 'card-head-actions';

    const badge = document.createElement('span');
    badge.className =
      'badge ' + (label.skipped ? 'skip' : label.edited ? 'edited' : 'ok');
    badge.textContent = label.skipped
      ? label.skipReason || 'Skipped'
      : label.edited
        ? 'Edited'
        : 'Ready';
    actions.appendChild(badge);

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn-ghost btn-edit';
    editBtn.textContent = editingIndexes.has(index) ? 'Done' : 'Edit';
    editBtn.addEventListener('click', () => {
      if (editingIndexes.has(index)) editingIndexes.delete(index);
      else editingIndexes.add(index);
      renderPreviews(currentAll);
      const open = els.previewList.querySelector(
        `[data-label-index="${index}"] .card-edit input`
      );
      if (open) /** @type {HTMLInputElement} */ (open).focus();
    });
    actions.appendChild(editBtn);

    head.appendChild(actions);
    card.appendChild(head);

    const preview = document.createElement('div');
    preview.className = 'card-preview';
    if (!label.skipped && index < MAX_CANVAS) {
      try {
        preview.appendChild(renderLabelToCanvas(label, opts));
      } catch {
        const lines = document.createElement('div');
        lines.className = 'card-lines';
        lines.textContent = label.lines.join('\n');
        preview.appendChild(lines);
      }
    } else {
      const lines = document.createElement('div');
      lines.className = 'card-lines';
      lines.textContent = label.skipped ? '(no Code)' : label.lines.join('\n');
      preview.appendChild(lines);
    }
    card.appendChild(preview);
    card.appendChild(buildEditPanel(label, index));
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
  } catch (err) {
    showMessage(err && err.message ? err.message : String(err), 'error');
  }
  updatePrinterStatus();
  updateActionState();
}

async function disconnectPrinter() {
  try {
    await xprinter.disconnect();
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
      await p.connect({ transport: 'serial' });
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
  editingIndexes.clear();
  els.mapRow.hidden = true;
  els.fieldStatus.hidden = true;
  els.fieldStatus.innerHTML = '';
  els.previewList.innerHTML = '';
  els.previewMeta.textContent = '';
  els.selection.textContent = 'Paste from any Grist view';
  showMessage('');
  updateActionState();
}

els.connectUsb.addEventListener('click', () => connectPrinter('serial'));
els.connectBt.addEventListener('click', () => connectPrinter('bluetooth'));
els.disconnect.addEventListener('click', disconnectPrinter);
els.print.addEventListener('click', () => runPrint(currentReady));
els.reprint.addEventListener('click', () => runPrint(lastJob));
els.clear.addEventListener('click', clearAll);

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

els.profile.addEventListener('change', onProfileChange);
els.profileSave.addEventListener('click', onProfileSave);
els.profileSaveAs.addEventListener('click', onProfileSaveAs);
els.profileDelete.addEventListener('click', onProfileDelete);

['change', 'input'].forEach((evt) => {
  [
    els.width,
    els.height,
    els.gap,
    els.offsetX,
    els.offsetY,
    els.fontCode,
    els.fontProduct,
    els.fontColor,
    els.fontStorage,
    els.fontCondition,
  ].forEach((el) => {
    el.addEventListener(evt, () => {
      if (currentAll.length) renderPreviews(currentAll);
    });
  });
});

refreshProfileSelect();
applyActiveProfile();
updatePrinterStatus();
updateActionState();
showMessage(
  'Paste from Grist below. Pick your name under My settings (or Save as…) so label/text sizes stick for next time.',
  'info'
);
