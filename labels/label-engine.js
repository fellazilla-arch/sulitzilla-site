/**
 * Label Engine — formats inventory rows into printable labels.
 * Independent of Grist and of any specific printer.
 */

/** @typedef {{ id?: number|string, Code: string, Brand?: string, Product?: string, Variation?: string, CountOrSize?: string }} LabelFields */
/** @typedef {{ id?: number|string, lines: string[], fields: LabelFields, skipped?: boolean, skipReason?: string }} FormattedLabel */
/** @typedef {{ widthMm?: number, heightMm?: number, dpi?: number, paddingMm?: number }} LabelRenderOptions */

export const DEFAULT_LABEL_OPTIONS = Object.freeze({
  widthMm: 50,
  heightMm: 30,
  dpi: 203,
  paddingMm: 1.5,
});

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeField(value) {
  if (value == null || value === false) return '';
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return '';
    return String(value).trim();
  }
  if (Array.isArray(value)) {
    return value
      .map((v) => normalizeField(v))
      .filter(Boolean)
      .join(' ');
  }
  if (typeof value === 'object') {
    // Grist ChoiceList / Ref sometimes arrive as objects
    if ('name' in value) return normalizeField(value.name);
    if ('label' in value) return normalizeField(value.label);
  }
  return String(value).trim();
}

/**
 * True for currency / money cells — these must never appear on labels.
 * @param {unknown} value
 */
export function isMoneyValue(value) {
  const s = normalizeField(value);
  if (!s) return false;
  // $9.78, ₱618, PHP 618, USD 40, €12.50, £10, ₱1,058.13
  if (/^[₱$€£¥]\s*[\d,]+(\.\d+)?%?$/i.test(s)) return true;
  if (/^(USD|PHP|PHP₱|EUR|GBP|CAD|AUD)\s*[\d,]+(\.\d+)?$/i.test(s)) return true;
  if (/^[\d,]+\.\d{2}$/.test(s) && !/GB|TB|mm|inch/i.test(s)) return true;
  if (/(₱|\$|€|£|¥|USD|PHP)\s*[\d,]+/i.test(s) && !/[A-Za-z]{3,}/.test(s.replace(/USD|PHP|EUR|GBP/gi, ''))) {
    return true;
  }
  return false;
}

/**
 * Normalize a label field and drop money / empty junk.
 * @param {unknown} value
 */
export function labelField(value) {
  const s = normalizeField(value);
  if (!s || isMoneyValue(s)) return '';
  return s;
}

/**
 * Build display lines; omit blank fields per PRD.
 * Layout:
 *   Code
 *   Brand Product
 *   Variation
 *   CountOrSize
 *
 * @param {LabelFields} fields
 * @returns {string[]}
 */
export function formatLabelLines(fields) {
  const lines = [];
  const code = labelField(fields.Code);
  if (code) lines.push(code);

  const brandProduct = [labelField(fields.Brand), labelField(fields.Product)]
    .filter(Boolean)
    .join(' ');
  if (brandProduct) lines.push(brandProduct);

  const variation = labelField(fields.Variation);
  if (variation) lines.push(variation);

  const countOrSize = labelField(fields.CountOrSize);
  if (countOrSize) lines.push(countOrSize);

  return lines;
}

/**
 * @param {Partial<LabelFields> & { id?: number|string }} record
 * @returns {FormattedLabel}
 */
export function formatRecord(record) {
  const fields = {
    id: record.id,
    Code: labelField(record.Code),
    Brand: labelField(record.Brand),
    Product: labelField(record.Product),
    Variation: labelField(record.Variation),
    CountOrSize: labelField(record.CountOrSize),
  };

  if (!fields.Code) {
    return {
      id: record.id,
      lines: [],
      fields,
      skipped: true,
      skipReason: 'Missing Code',
    };
  }

  return {
    id: record.id,
    lines: formatLabelLines(fields),
    fields,
    skipped: false,
  };
}

/**
 * Preserve input order. Ready labels first in result.ready; skipped kept separately.
 * @param {Array<Partial<LabelFields> & { id?: number|string }>} records
 */
export function formatBatch(records) {
  const list = Array.isArray(records) ? records : [];
  const formatted = list.map(formatRecord);
  return {
    all: formatted,
    ready: formatted.filter((l) => !l.skipped),
    skipped: formatted.filter((l) => l.skipped),
  };
}

/**
 * @param {number} mm
 * @param {number} dpi
 */
export function mmToPx(mm, dpi) {
  return Math.max(1, Math.round((mm / 25.4) * dpi));
}

/**
 * Draw a single label onto a canvas (black on white).
 * @param {FormattedLabel|LabelFields|string[]} labelOrLines
 * @param {LabelRenderOptions} [options]
 * @returns {HTMLCanvasElement}
 */
export function renderLabelToCanvas(labelOrLines, options = {}) {
  const opts = { ...DEFAULT_LABEL_OPTIONS, ...options };
  const lines = Array.isArray(labelOrLines)
    ? labelOrLines.filter((l) => normalizeField(l))
    : labelOrLines.lines
      ? labelOrLines.lines
      : formatLabelLines(/** @type {LabelFields} */ (labelOrLines));

  const width = mmToPx(opts.widthMm, opts.dpi);
  const height = mmToPx(opts.heightMm, opts.dpi);
  const padding = mmToPx(opts.paddingMm, opts.dpi);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  if (!lines.length) {
    ctx.font = `bold ${Math.floor(height * 0.2)}px sans-serif`;
    ctx.fillText('(empty)', padding, padding);
    return canvas;
  }

  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const gap = Math.max(2, Math.floor(innerH * 0.04));

  // Code is largest; remaining lines share leftover space.
  const codeSize = Math.min(Math.floor(innerH * 0.38), Math.floor(innerW * 0.22));
  const otherCount = Math.max(1, lines.length - 1);
  const otherBudget = innerH - codeSize - gap * lines.length;
  const otherSize = Math.max(
    10,
    Math.min(Math.floor(otherBudget / otherCount), Math.floor(codeSize * 0.55))
  );

  let y = padding;
  lines.forEach((raw, i) => {
    const text = String(raw);
    const fontSize = i === 0 ? codeSize : otherSize;
    const weight = i === 0 ? 'bold' : '600';
    ctx.font = `${weight} ${fontSize}px "Segoe UI", system-ui, sans-serif`;

    const fitted = fitText(ctx, text, innerW, fontSize, weight);
    ctx.font = `${weight} ${fitted.size}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillText(fitted.text, padding, y);
    y += fitted.size + gap;
  });

  return canvas;
}

/**
 * Shrink font / truncate with ellipsis so text fits width.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} maxWidth
 * @param {number} startSize
 * @param {string} weight
 */
function fitText(ctx, text, maxWidth, startSize, weight) {
  let size = startSize;
  while (size > 8) {
    ctx.font = `${weight} ${size}px "Segoe UI", system-ui, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) {
      return { text, size };
    }
    size -= 1;
  }
  ctx.font = `${weight} ${size}px "Segoe UI", system-ui, sans-serif`;
  let truncated = text;
  while (truncated.length > 1 && ctx.measureText(truncated + '…').width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return { text: truncated === text ? text : truncated + '…', size };
}

/**
 * @param {FormattedLabel|LabelFields|string[]} labelOrLines
 * @param {LabelRenderOptions} [options]
 * @returns {string} data URL
 */
export function renderLabelDataUrl(labelOrLines, options) {
  return renderLabelToCanvas(labelOrLines, options).toDataURL('image/png');
}
