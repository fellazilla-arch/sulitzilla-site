/**
 * Label Engine — formats inventory rows into printable labels.
 * Independent of Grist and of any specific printer.
 */

/** @typedef {{ id?: number|string, Code: string, Brand?: string, Product?: string, Variation?: string, CountOrSize?: string }} LabelFields */
/** @typedef {{ id?: number|string, lines: string[], fields: LabelFields, skipped?: boolean, skipReason?: string }} FormattedLabel */
/**
 * @typedef {{
 *   widthMm?: number,
 *   heightMm?: number,
 *   dpi?: number,
 *   paddingMm?: number,
 *   fontScale?: { code?: number, product?: number, variation?: number, count?: number }
 * }} LabelRenderOptions
 */

export const DEFAULT_LABEL_OPTIONS = Object.freeze({
  widthMm: 30,
  heightMm: 20,
  dpi: 203,
  paddingMm: 1.5,
  fontScale: Object.freeze({ code: 1.45, product: 0.7, variation: 1, count: 1.15 }),
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
 * @param {LabelRenderOptions} [options]
 */
function resolveFontScale(options = {}) {
  const base = DEFAULT_LABEL_OPTIONS.fontScale;
  const raw = options.fontScale || {};
  return {
    code: clampScale(raw.code != null ? raw.code : base.code),
    product: clampScale(raw.product != null ? raw.product : base.product),
    variation: clampScale(
      raw.variation != null
        ? raw.variation
        : base.variation != null
          ? base.variation
          : base.product
    ),
    count: clampScale(raw.count != null ? raw.count : base.count),
  };
}

/**
 * @param {number} n
 */
function clampScale(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return 1;
  return Math.min(2, Math.max(0.5, v));
}

/**
 * Split an overlong token so it can wrap (soft break ~10 chars, still fit width).
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} word
 * @param {number} maxWidth
 * @param {number} [softLen]
 */
function splitLongWord(ctx, word, maxWidth, softLen = 10) {
  if (!word) return [];
  if (ctx.measureText(word).width <= maxWidth) return [word];

  const chunks = [];
  let i = 0;
  while (i < word.length) {
    let end = Math.min(i + softLen, word.length);
    while (end < word.length && ctx.measureText(word.slice(i, end + 1)).width <= maxWidth) {
      end += 1;
    }
    while (end > i + 1 && ctx.measureText(word.slice(i, end)).width > maxWidth) {
      end -= 1;
    }
    // Single glyph still too wide — force one character.
    if (end <= i) end = i + 1;
    chunks.push(word.slice(i, end));
    i = end;
  }
  return chunks;
}

/**
 * Wrap text to width at word boundaries; long tokens soft-break ~every 10 letters.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} maxWidth
 * @param {number} fontSize
 * @param {string} weight
 * @param {boolean} allowWrap
 * @returns {string[]}
 */
export function wrapTextLines(ctx, text, maxWidth, fontSize, weight, allowWrap) {
  const font = `${weight} ${fontSize}px "Segoe UI", system-ui, sans-serif`;
  ctx.font = font;
  const raw = String(text || '').trim();
  if (!raw) return [];

  if (!allowWrap) {
    if (ctx.measureText(raw).width <= maxWidth) return [raw];
    // Single-line roles: shrink handled by caller; keep as one line for measure.
    return [raw];
  }

  const tokens = raw.split(/\s+/).filter(Boolean);
  /** @type {string[]} */
  const lines = [];
  let current = '';

  const flush = () => {
    if (current) {
      lines.push(current);
      current = '';
    }
  };

  for (const token of tokens) {
    const pieces = splitLongWord(ctx, token, maxWidth);
    for (const piece of pieces) {
      const next = current ? `${current} ${piece}` : piece;
      if (ctx.measureText(next).width <= maxWidth) {
        current = next;
      } else {
        flush();
        if (ctx.measureText(piece).width <= maxWidth) {
          current = piece;
        } else {
          // Extremely narrow — force leftover soft splits already in piece
          lines.push(piece);
        }
      }
    }
  }
  flush();
  return lines.length ? lines : [raw];
}

/**
 * Shrink a single line to fit width (code / count).
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} maxWidth
 * @param {number} startSize
 * @param {string} weight
 */
function fitSingleLine(ctx, text, maxWidth, startSize, weight) {
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
  while (truncated.length > 1 && ctx.measureText(`${truncated}…`).width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return { text: truncated === text ? text : `${truncated}…`, size };
}

/**
 * @typedef {{ role: 'code'|'product'|'detail'|'count', text: string, wrap: boolean, weight: string, scale: number, baseFrac: number }} TextBlock
 */

/**
 * @param {LabelFields} fields
 * @param {{ code: number, product: number, variation: number, count: number }} scale
 * @returns {TextBlock[]}
 */
function buildTextBlocks(fields, scale) {
  /** @type {TextBlock[]} */
  const blocks = [];
  const code = labelField(fields.Code);
  if (code) {
    blocks.push({
      role: 'code',
      text: code,
      wrap: false,
      weight: 'bold',
      scale: scale.code,
      baseFrac: 0.34,
    });
  }

  const brandProduct = [labelField(fields.Brand), labelField(fields.Product)]
    .filter(Boolean)
    .join(' ');
  if (brandProduct) {
    blocks.push({
      role: 'product',
      text: brandProduct,
      wrap: true,
      weight: '700',
      scale: scale.product,
      baseFrac: 0.26,
    });
  }

  const variation = labelField(fields.Variation);
  if (variation) {
    blocks.push({
      role: 'detail',
      text: variation,
      wrap: true,
      weight: '600',
      scale: scale.variation,
      baseFrac: 0.18,
    });
  }

  const countOrSize = labelField(fields.CountOrSize);
  if (countOrSize) {
    blocks.push({
      role: 'count',
      text: countOrSize,
      wrap: false,
      weight: '600',
      scale: scale.count,
      baseFrac: 0.2,
    });
  }

  return blocks;
}

/**
 * Draw a single label onto a canvas (black on white).
 * Long product/variation text wraps instead of shrinking to unreadably small.
 * @param {FormattedLabel|LabelFields|string[]} labelOrLines
 * @param {LabelRenderOptions} [options]
 * @returns {HTMLCanvasElement}
 */
export function renderLabelToCanvas(labelOrLines, options = {}) {
  const opts = { ...DEFAULT_LABEL_OPTIONS, ...options };
  const scale = resolveFontScale(opts);

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

  /** @type {TextBlock[]} */
  let blocks = [];
  if (Array.isArray(labelOrLines)) {
    const lines = labelOrLines.filter((l) => normalizeField(l));
    blocks = lines.map((text, i) => ({
      role: i === 0 ? 'code' : i === lines.length - 1 && lines.length > 2 ? 'count' : 'product',
      text: String(text),
      wrap: i !== 0,
      weight: i === 0 ? 'bold' : '600',
      scale: i === 0 ? scale.code : i === lines.length - 1 && lines.length > 2 ? scale.count : scale.product,
      baseFrac: i === 0 ? 0.34 : 0.22,
    }));
  } else if (labelOrLines && labelOrLines.fields) {
    blocks = buildTextBlocks(labelOrLines.fields, scale);
  } else if (labelOrLines && labelOrLines.lines) {
    blocks = buildTextBlocks(
      {
        Code: labelOrLines.lines[0] || '',
        Brand: '',
        Product: labelOrLines.lines[1] || '',
        Variation: labelOrLines.lines[2] || '',
        CountOrSize: labelOrLines.lines[3] || '',
      },
      scale
    );
  } else {
    blocks = buildTextBlocks(/** @type {LabelFields} */ (labelOrLines), scale);
  }

  if (!blocks.length) {
    ctx.font = `bold ${Math.floor(height * 0.2)}px sans-serif`;
    ctx.fillText('(empty)', padding, padding);
    return canvas;
  }

  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const gap = Math.max(2, Math.floor(innerH * 0.035));

  /**
   * @param {number} shrink
   */
  function measureLayout(shrink) {
    /** @type {{ text: string, size: number, weight: string }[]} */
    const rows = [];
    let total = 0;

    for (const block of blocks) {
      let size = Math.max(
        9,
        Math.floor(innerH * block.baseFrac * block.scale * shrink)
      );
      if (block.role === 'code') {
        size = Math.min(size, Math.floor(innerW * 0.22 * block.scale * shrink));
      }

      if (block.wrap) {
        // Prefer wrap over shrink: keep size, break to multiple lines.
        let lines = wrapTextLines(ctx, block.text, innerW, size, block.weight, true);
        // Cap wrapped lines; if still too many, nudge size down a bit.
        let guard = 0;
        while (lines.length > 3 && size > 10 && guard < 20) {
          size -= 1;
          lines = wrapTextLines(ctx, block.text, innerW, size, block.weight, true);
          guard += 1;
        }
        for (const line of lines) {
          rows.push({ text: line, size, weight: block.weight });
          total += size + gap;
        }
      } else {
        const fitted = fitSingleLine(ctx, block.text, innerW, size, block.weight);
        rows.push({ text: fitted.text, size: fitted.size, weight: block.weight });
        total += fitted.size + gap;
      }
    }

    if (rows.length) total -= gap;
    return { rows, total };
  }

  let shrink = 1;
  let layout = measureLayout(shrink);
  let guard = 0;
  while (layout.total > innerH && shrink > 0.55 && guard < 25) {
    shrink -= 0.04;
    layout = measureLayout(shrink);
    guard += 1;
  }

  let y = padding;
  for (const row of layout.rows) {
    if (y + row.size > height - padding) break;
    ctx.font = `${row.weight} ${row.size}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillText(row.text, padding, y);
    y += row.size + gap;
  }

  return canvas;
}

/**
 * @param {FormattedLabel|LabelFields|string[]} labelOrLines
 * @param {LabelRenderOptions} [options]
 * @returns {string} data URL
 */
export function renderLabelDataUrl(labelOrLines, options) {
  return renderLabelToCanvas(labelOrLines, options).toDataURL('image/png');
}
