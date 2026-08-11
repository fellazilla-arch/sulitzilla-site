/**
 * Parse pasted Grist / spreadsheet text into label field rows.
 *
 * Primary path: fixed Sulitzilla inventory view column layout (no headers).
 * Fallback: header names or cell-pattern inference for other pastes.
 */

import { normalizeField, labelField, isMoneyValue } from './label-engine.js';

/** @typedef {'Code'|'Brand'|'Product'|'Variation'|'CountOrSize'} LabelField */

/**
 * @typedef {Object} ViewLayout
 * @property {string} id
 * @property {string} name
 * @property {(rows: string[][]) => boolean} detect
 * @property {(row: string[], idx: number) => import('./label-engine.js').LabelFields} mapRow
 * @property {number[]} usedColumns - original indexes kept (for drop reporting)
 */

/**
 * Shared mapping for Kango / Taobao-style rows.
 * Gadgets (phones, laptops, tablets, …): Storage + Color + Condition.
 * Supplements / other: Color/flavor + count/size only — skip Condition.
 * @param {object} cols
 * @param {number} idx
 */
function mapLabelCols(cols, idx) {
  const code = labelField(cols.Code);
  const brand = labelField(cols.Brand);
  const product = labelField(cols.Product);
  const color = labelField(cols.Color);
  const specs = labelField(cols.VariationOrSpecs);
  const storage = labelField(cols.Storage);
  const condition = labelField(cols.Condition);

  const gadget = isGadgetItem({
    brand,
    product,
    storage,
    condition,
    countOrSize: storage,
    variation: color || specs,
  });

  if (gadget) {
    return {
      id: idx + 1,
      Code: code,
      Brand: brand,
      Product: product,
      Color: color,
      Storage: storage || (specs && color ? specs : ''),
      Condition: condition,
      // Keep combined fields for older preview/map paths
      Variation: color || specs,
      CountOrSize: [storage || (specs && color ? specs : ''), condition]
        .filter(Boolean)
        .join(' · '),
    };
  }

  // Supplements / general: never print Condition.
  let variation = '';
  let countOrSize = storage;
  if (color) {
    variation = color;
    if (specs) countOrSize = countOrSize || specs;
  } else if (specs) {
    variation = specs;
  }

  return {
    id: idx + 1,
    Code: code,
    Brand: brand,
    Product: product,
    Color: color,
    Storage: storage,
    Condition: '',
    Variation: variation,
    CountOrSize: countOrSize,
  };
}

/**
 * True for phones / laptops / tablets / similar — show Condition.
 * @param {{ brand?: string, product?: string, storage?: string, condition?: string, countOrSize?: string, variation?: string }} parts
 */
export function isGadgetItem(parts = {}) {
  if (isSupplementItem(parts)) return false;

  const storage = normalizeField(parts.storage);
  if (looksLikeStorage(storage)) return true;

  const blob = [parts.brand, parts.product].map(normalizeField).join(' ');
  if (
    /\b(iphone|ipad|ipod|pixel|galaxy\s*[a-z]?\d|macbook|imac|mac\s*mini|laptop|notebook|thinkpad|yoga|surface(\s*pro)?|tablet|kindle|fire\s*hd|airpods|galaxy\s*buds|apple\s*watch|watch\s*[su]?\d|oneplus|xiaomi|redmi|huawei|oppo|vivo|realme|nothing\s*phone|steam\s*deck|nintendo\s*switch|gopro|drone|chromebook|fold|flip)\b/i.test(
      blob
    )
  ) {
    return true;
  }

  const condition = normalizeField(parts.condition);
  // Used / factory / soft conditions strongly imply gadgets.
  if (looksLikeCondition(condition) && /\b(used|factory|soft|refurb)/i.test(condition)) {
    return true;
  }

  return false;
}

/**
 * Supplements / consumables — keep Condition off the label even if present.
 * @param {{ product?: string, countOrSize?: string, variation?: string }} parts
 */
export function isSupplementItem(parts = {}) {
  const blob = [parts.product, parts.countOrSize, parts.variation]
    .map(normalizeField)
    .join(' ');
  if (!blob) return false;
  if (
    /\b(gummy|gummies|vitamin|capsule|softgel|soft\s*gel|supplement|collagen|probiotic|omega[\s-]?3|multivitamin|creatine|protein\s*powder|electrolyte|fish\s*oil|serving)\b/i.test(
      blob
    )
  ) {
    return true;
  }
  if (/\d+\s*(gummies|caps|softgels|tablets|ct|count)\b/i.test(blob)) return true;
  return false;
}

/**
 * @param {unknown} v
 */
export function looksLikeCondition(v) {
  const s = normalizeField(v);
  if (!s || s.length > 48) return false;
  if (
    /^(new|used|soft|factory|refurbished|refurb|open box|like new)(\b|[,\s]|$)/i.test(s)
  ) {
    return true;
  }
  if (
    /^(factory or new|used or new|used,?\s*soft|new,?\s*soft|factory,?\s*soft)$/i.test(s)
  ) {
    return true;
  }
  return false;
}

function sampleRows(rows) {
  return (rows || []).slice(0, Math.min(rows.length, 8));
}

/**
 * Inventory $STATUS values — accept exact names and common Grist variants
 * like "LIVE (ARRIVED)".
 * @param {unknown} v
 */
function statusLike(v) {
  const s = normalizeField(v);
  if (!s) return false;
  if (
    /^(ARRIVED|LIVE|AIR KANGO|OTW KANGO|AWAITING TRACKING|FOR REPAIR|CHINA AIR|AIR TARLAC)$/i.test(
      s
    )
  ) {
    return true;
  }
  // e.g. LIVE (ARRIVED), ARRIVED (LIVE), LIVE(ARRIVED)
  if (/^(LIVE|ARRIVED)\s*\(/i.test(s)) return true;
  if (/\b(ARRIVED|LIVE|OTW KANGO|AIR KANGO|AWAITING TRACKING|FOR REPAIR|CHINA AIR|AIR TARLAC)\b/i.test(s)) {
    return true;
  }
  return false;
}

/**
 * View 1 — Grist page "Kango Arrived"
 *
 * 0 Code | 1 Status | 2 Package (PAK…) | 3 Condition | 4 Brand | 5 Product
 * 6 Storage? | 7 Color | 8 Variation | … notes, urls, prices, tracking
 */
export const LAYOUT_KANGO_ARRIVED = Object.freeze({
  id: 'kango-arrived',
  name: 'Kango Arrived',
  usedColumns: [0, 3, 4, 5, 6, 7, 8],
  detect(rows) {
    const sample = sampleRows(rows);
    if (!sample.length) return false;
    let ok = 0;
    for (const row of sample) {
      if (row.length < 9 || row.length > 24) continue;
      if (!looksLikeCode(row[0])) continue;
      if (row.some((c) => /amazon\.com/i.test(c))) continue;
      if (/^AIR TARLAC$/i.test(normalizeField(row[1]))) continue;
      // Package id in col 2 distinguishes from Taobao (brand in col 2)
      const pkg = normalizeField(row[2]);
      if (!/^PAK/i.test(pkg) && !/^[A-Z]{2,}\d+/i.test(pkg)) continue;
      if (looksLikeStorage(row[5])) continue; // Taobao has storage in col 5
      const brand = normalizeField(row[4]);
      const product = normalizeField(row[5]);
      if (!brand || looksLikeNoise(brand) || looksLikeCode(brand)) continue;
      if (!product || looksLikeNoise(product)) continue;
      // Status helps but is not required — print any $STATUS from this view.
      ok++;
    }
    return ok >= Math.ceil(sample.length * 0.6);
  },
  mapRow(row, idx) {
    return mapLabelCols(
      {
        Code: row[0],
        Condition: row[3],
        Brand: row[4],
        Product: row[5],
        Storage: row[6],
        Color: row[7],
        VariationOrSpecs: row[8],
      },
      idx
    );
  },
});

/**
 * View 2 — Grist page "Amazon Arrived"
 *
 * 0 Code | 1 Status | 2 Order# | 3 Condition | 4 Brand | 5 Product
 * 6 Variant (e.g. Kids) | 7 Count/Size (24 Gummies) | 8 Flavor/Color (Bubblegum)
 */
export const LAYOUT_AMAZON_ARRIVED = Object.freeze({
  id: 'amazon-arrived',
  name: 'Amazon Arrived',
  usedColumns: [0, 4, 5, 6, 7, 8],
  detect(rows) {
    const sample = sampleRows(rows);
    if (!sample.length) return false;
    let ok = 0;
    for (const row of sample) {
      if (row.length < 9 || row.length > 20) continue;
      if (!looksLikeCode(row[0])) continue;
      const status = normalizeField(row[1]);
      const hasAmzUrl = row.some((c) => /amazon\.com/i.test(c));
      const orderId = normalizeField(row[2]);
      const numericOrder = /^\d{7,}$/.test(orderId);
      const amzStatus = /^AIR TARLAC$/i.test(status) || /^AIR\b/i.test(status);
      if (!hasAmzUrl && !numericOrder && !amzStatus) continue;
      if (/^PAK/i.test(orderId)) continue;
      const brand = normalizeField(row[4]);
      const product = normalizeField(row[5]);
      if (!brand || looksLikeNoise(brand) || looksLikeCode(brand)) continue;
      if (!product || looksLikeNoise(product)) continue;
      ok++;
    }
    return ok >= Math.ceil(sample.length * 0.6);
  },
  mapRow(row, idx) {
    const brand = labelField(row[4]);
    const product = labelField(row[5]);
    const variant = labelField(row[6]);
    const countOrSize = labelField(row[7]);
    const flavor = labelField(row[8]);
    const condition = labelField(row[3]);
    const variation = [variant, flavor].filter(Boolean).join(' · ');
    const gadget = isGadgetItem({
      brand,
      product,
      storage: countOrSize,
      condition,
      countOrSize,
      variation,
    });

    if (gadget) {
      return {
        id: idx + 1,
        Code: labelField(row[0]),
        Brand: brand,
        Product: product,
        Color: variation,
        Storage: countOrSize,
        Condition: condition,
        Variation: variation,
        CountOrSize: [countOrSize, condition].filter(Boolean).join(' · '),
      };
    }

    // Supplements / general Amazon rows — Condition off the label.
    return {
      id: idx + 1,
      Code: labelField(row[0]),
      Brand: brand,
      Product: product,
      Color: flavor,
      Storage: '',
      Condition: '',
      Variation: variation,
      CountOrSize: countOrSize,
    };
  },
});

/**
 * View 3 — Grist page "Taobao Arrived"
 *
 * 0 Code | 1 Status | 2 Brand | 3 Condition | 4 Product
 * 5 Storage (256GB) | 6 Color (Silver) | 7 Grade | 8 Notes | …
 */
export const LAYOUT_TAOBAO_ARRIVED = Object.freeze({
  id: 'taobao-arrived',
  name: 'Taobao Arrived',
  usedColumns: [0, 2, 3, 4, 5, 6],
  detect(rows) {
    const sample = sampleRows(rows);
    if (!sample.length) return false;
    let ok = 0;
    for (const row of sample) {
      if (row.length < 8 || row.length > 24) continue;
      if (!looksLikeCode(row[0])) continue;
      if (row.some((c) => /amazon\.com/i.test(c))) continue;
      const brand = normalizeField(row[2]);
      if (!brand || /^PAK/i.test(brand) || /^\d{7,}$/.test(brand)) continue;
      if (looksLikeNoise(brand) || looksLikeCode(brand) || looksLikeStorage(brand)) continue;
      const product = normalizeField(row[4]);
      if (!product || looksLikeNoise(product) || looksLikeStorage(product)) continue;
      // Storage in col 5 is the strong signal vs Kango (product in col 5)
      if (!looksLikeStorage(row[5]) && !normalizeField(row[5])) {
        // allow empty storage but then require color-ish col 6
        if (!normalizeField(row[6])) continue;
      }
      if (looksLikeStorage(row[5]) || normalizeField(row[6])) ok++;
    }
    return ok >= Math.ceil(sample.length * 0.6);
  },
  mapRow(row, idx) {
    return mapLabelCols(
      {
        Code: row[0],
        Brand: row[2],
        Condition: row[3],
        Product: row[4],
        Storage: row[5],
        Color: row[6],
        VariationOrSpecs: '',
      },
      idx
    );
  },
});

/** Registered layouts — first match wins. */
export const VIEW_LAYOUTS = [
  LAYOUT_AMAZON_ARRIVED,
  LAYOUT_TAOBAO_ARRIVED,
  LAYOUT_KANGO_ARRIVED,
];

/**
 * @param {string[][]} rows
 * @returns {ViewLayout | null}
 */
export function detectViewLayout(rows) {
  for (const layout of VIEW_LAYOUTS) {
    if (layout.detect(rows)) return layout;
  }
  return null;
}

const FIELD_ALIASES = {
  Code: ['code', 'codes', 'sku', 'item code', 'itemcode', 'inventory code'],
  Brand: ['brand', 'brands', 'make', 'manufacturer'],
  Product: [
    'product',
    'products',
    'model',
    'model product',
    'modelproduct',
    'model_product',
    'product name',
    'productname',
    'item name',
    'itemname',
  ],
  Variation: [
    'variation',
    'variant',
    'color',
    'colour',
    'color flavor',
    'colorflavor',
    'color_flavor',
    'color / flavor',
    'flavor',
    'colour flavor',
  ],
  CountOrSize: [
    'count',
    'size',
    'countorsize',
    'count or size',
    'count / size',
    'storage',
    'capacity',
    'qty',
    'quantity',
    'ram',
    'memory',
  ],
};

const FIELD_ORDER = /** @type {LabelField[]} */ ([
  'Code',
  'Brand',
  'Product',
  'Variation',
  'CountOrSize',
]);

const KNOWN_BRANDS = new Set([
  'google',
  'apple',
  'samsung',
  'sony',
  'lg',
  'motorola',
  'oneplus',
  'nothing',
  'xiaomi',
  'huawei',
  'oppo',
  'vivo',
  'asus',
  'lenovo',
  'hp',
  'dell',
  'microsoft',
  'fitbit',
  'garmin',
  'philips',
]);

const KNOWN_COLORS = new Set([
  'obsidian',
  'hazel',
  'porcelain',
  'bay',
  'rose',
  'peony',
  'aloe',
  'coral',
  'moonstone',
  'jade',
  'lemongrass',
  'iris',
  'wintergreen',
  'stormy black',
  'clearly white',
  'just black',
  'oh so orange',
  'kinda coral',
  'sorta sage',
  'mostly black',
  'not pink',
  'charcoal',
  'snow',
  'haze',
  'sage',
  'black',
  'white',
  'silver',
  'gold',
  'blue',
  'green',
  'pink',
  'yellow',
  'red',
  'orange',
  'purple',
  'gray',
  'grey',
  'walnut wood',
  'garden party blue',
  'berry',
]);

function normHeader(header) {
  return normalizeField(header)
    .toLowerCase()
    .replace(/[_./-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string} header
 * @returns {LabelField | null}
 */
export function guessField(header) {
  const h = normHeader(header);
  if (!h) return null;
  for (const field of FIELD_ORDER) {
    const aliases = FIELD_ALIASES[field];
    if (h === field.toLowerCase() || aliases.includes(h)) return field;
  }
  return null;
}

/** Inventory code like A9192, B0812, B3000- */
export function looksLikeCode(v) {
  return /^[A-Za-z]\d{3,5}-?$/.test(normalizeField(v));
}

function looksLikeStorage(v) {
  return /^\d+\s*(GB|TB)$/i.test(normalizeField(v));
}

function looksLikeProduct(v) {
  const s = normalizeField(v);
  if (!s) return false;
  if (/^pixel\b/i.test(s)) return true;
  if (/^(iphone|ipad|macbook|galaxy|fitbit|yoga|oneblade)\b/i.test(s)) return true;
  return false;
}

function looksLikeBrand(v) {
  return KNOWN_BRANDS.has(normalizeField(v).toLowerCase());
}

function looksLikeColor(v) {
  const s = normalizeField(v).toLowerCase();
  return !!s && s.length <= 40 && KNOWN_COLORS.has(s);
}

function looksLikeNoise(v) {
  const s = normalizeField(v);
  if (!s) return true;
  if (isMoneyValue(s)) return true;
  if (/^https?:\/\//i.test(s)) return true;
  if (/\.(com|net|org)\b/i.test(s)) return true;
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) return true;
  if (/^\d{10,}$/.test(s)) return true;
  if (/in transit|out for del|delivered|shipped|pending|available to ship/i.test(s)) {
    return true;
  }
  if (/^LIVE$|^ARRIVED$|^AIR KANGO$/i.test(s)) return true;
  if (/^(LIVE|ARRIVED)\s*\(/i.test(s)) return true;
  return false;
}

/**
 * Quote-aware TSV/CSV matrix parser (keeps newlines inside "quoted" cells).
 * @param {string} text
 * @param {string} [delim]
 * @returns {string[][]}
 */
export function parseDelimitedMatrix(text, delim = '\t') {
  const raw = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '"') {
      if (inQuotes && raw[i + 1] === '"') {
        cur += '"';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && ch === delim) {
      row.push(cur.trim());
      cur = '';
      continue;
    }
    if (!inQuotes && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && raw[i + 1] === '\n') i++;
      row.push(cur.trim());
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.length || row.length) {
    row.push(cur.trim());
    if (row.some((c) => c !== '')) rows.push(row);
  }
  return rows;
}

/**
 * @param {string[][]} rows
 * @deprecated use detectViewLayout
 */
export function isSulitzillaInventoryPaste(rows) {
  return detectViewLayout(rows)?.id === 'kango-arrived';
}

/**
 * @param {string[]} row
 * @param {number} idx
 * @deprecated use layout.mapRow
 */
export function mapSulitzillaRow(row, idx) {
  return LAYOUT_KANGO_ARRIVED.mapRow(row, idx);
}

/**
 * @param {string} text
 * @returns {'tab'|'comma'|'semi'}
 */
export function detectDelimiter(text) {
  const sample = String(text || '').slice(0, 4000);
  const tabs = (sample.match(/\t/g) || []).length;
  const commas = (sample.match(/,/g) || []).length;
  const semis = (sample.match(/;/g) || []).length;
  if (tabs > 0 && tabs >= commas && tabs >= semis) return 'tab';
  if (semis > commas && semis > 0) return 'semi';
  if (commas > 0) return 'comma';
  return 'tab';
}

/**
 * @param {string} line
 * @param {string} delim
 */
export function splitLine(line, delim) {
  return parseDelimitedMatrix(line, delim)[0] || [];
}

/**
 * @param {string[]} values
 * @returns {Record<LabelField, number>}
 */
export function scoreColumn(values) {
  const cells = values.map(normalizeField).filter(Boolean);
  const n = Math.max(cells.length, 1);
  let code = 0;
  let brand = 0;
  let product = 0;
  let variation = 0;
  let size = 0;
  let noise = 0;
  for (const c of cells) {
    if (looksLikeNoise(c)) {
      noise++;
      continue;
    }
    if (looksLikeCode(c)) code++;
    if (looksLikeBrand(c)) brand++;
    if (looksLikeProduct(c)) product++;
    if (looksLikeColor(c)) variation++;
    if (looksLikeStorage(c)) size++;
  }
  return {
    Code: code / n - noise / n,
    Brand: brand / n - noise / n,
    Product: product / n - noise / n,
    Variation: variation / n - noise / n,
    CountOrSize: size / n - noise / n,
  };
}

/**
 * @param {string[][]} rows
 * @returns {Map<LabelField, number>}
 */
export function inferColumnIndexes(rows) {
  if (!rows.length) return new Map();
  const colCount = Math.max(...rows.map((r) => r.length));
  /** @type {{ field: LabelField, col: number, score: number }[]} */
  const candidates = [];
  for (let col = 0; col < colCount; col++) {
    const scores = scoreColumn(rows.map((r) => r[col] || ''));
    for (const field of FIELD_ORDER) {
      if (scores[field] > 0.15) candidates.push({ field, col, score: scores[field] });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  /** @type {Map<LabelField, number>} */
  const assigned = new Map();
  const usedCols = new Set();
  for (const c of candidates) {
    if (assigned.has(c.field) || usedCols.has(c.col)) continue;
    assigned.set(c.field, c.col);
    usedCols.add(c.col);
  }
  if (!assigned.size && colCount === 1) assigned.set('Code', 0);
  if (!assigned.has('Code')) {
    let best = { col: -1, score: 0 };
    for (let col = 0; col < colCount; col++) {
      if (usedCols.has(col)) continue;
      const s = scoreColumn(rows.map((r) => r[col] || '')).Code;
      if (s > best.score) best = { col, score: s };
    }
    if (best.col >= 0 && best.score > 0.1) assigned.set('Code', best.col);
  }
  return assigned;
}

/**
 * @param {string} text
 */
export function parsePasteTable(text) {
  const delimKey = detectDelimiter(text);
  const delim = delimKey === 'tab' ? '\t' : delimKey === 'semi' ? ';' : ',';
  let matrix = parseDelimitedMatrix(text, delim);
  if (!matrix.length) {
    return { headers: [], rows: [], delimiter: delim, hasHeader: false };
  }

  let colCount = Math.max(...matrix.map((r) => r.length));
  if (colCount <= 1 && delim !== '\t') {
    matrix = parseDelimitedMatrix(text, '\t');
    colCount = Math.max(...matrix.map((r) => r.length), 0);
  }

  const pad = (r) => {
    const padded = r.slice();
    while (padded.length < colCount) padded.push('');
    return padded;
  };
  matrix = matrix.map(pad);

  const first = matrix[0] || [];
  const headerHits = first.map(guessField).filter(Boolean).length;
  const hasHeader = headerHits >= 1 && !looksLikeCode(first[0]);

  if (hasHeader) {
    return {
      headers: first.map((h, i) => h || `Column ${i + 1}`),
      rows: matrix.slice(1),
      delimiter: '\t',
      hasHeader: true,
    };
  }

  return {
    headers: Array.from({ length: colCount }, (_, i) => `Column ${i + 1}`),
    rows: matrix,
    delimiter: '\t',
    hasHeader: false,
  };
}

/**
 * @param {{ headers: string[], rows: string[][], delimiter?: string, hasHeader?: boolean }} table
 */
export function filterToLabelColumns(table) {
  const delim = table.delimiter || '\t';
  const headers = table.headers || [];
  const rows = table.rows || [];

  // Fixed Grist page layouts (Kango Arrived, …) — first match wins
  const layout = !table.hasHeader ? detectViewLayout(rows) : null;
  if (layout) {
    const fields = rows.map((row, idx) => layout.mapRow(row, idx));
    const newHeaders = ['Code', 'Brand', 'Product', 'Variation', 'CountOrSize'];
    const newRows = fields.map((f) => [
      f.Code,
      f.Brand,
      f.Product,
      f.Variation,
      f.CountOrSize,
    ]);
    const used = new Set(layout.usedColumns);
    const droppedHeaders = headers
      .map((h, i) => h || `Column ${i + 1}`)
      .filter((_, i) => !used.has(i));

    return {
      headers: newHeaders,
      rows: newRows,
      delimiter: delim,
      hasHeader: true,
      kept: FIELD_ORDER.map((field, i) => ({
        field,
        header: field,
        fromIndex: i,
      })),
      droppedHeaders,
      columnMap: {
        Code: 0,
        Brand: 1,
        Product: 2,
        Variation: 3,
        CountOrSize: 4,
      },
      layout: layout.id,
      layoutName: layout.name,
      labelFields: fields,
    };
  }

  /** @type {Map<LabelField, { field: LabelField, header: string, fromIndex: number }>} */
  const keptByField = new Map();
  /** @type {string[]} */
  const droppedHeaders = [];

  if (table.hasHeader) {
    headers.forEach((header, fromIndex) => {
      const field = guessField(header);
      if (!field) {
        droppedHeaders.push(header || `Column ${fromIndex + 1}`);
        return;
      }
      if (keptByField.has(field)) {
        droppedHeaders.push(`${header} (duplicate ${field})`);
        return;
      }
      keptByField.set(field, { field, header: header || field, fromIndex });
    });
  } else {
    const inferred = inferColumnIndexes(rows);
    const used = new Set(inferred.values());
    for (const field of FIELD_ORDER) {
      const fromIndex = inferred.get(field);
      if (fromIndex == null) continue;
      keptByField.set(field, { field, header: field, fromIndex });
    }
    headers.forEach((header, fromIndex) => {
      if (!used.has(fromIndex)) droppedHeaders.push(header || `Column ${fromIndex + 1}`);
    });
  }

  const kept = FIELD_ORDER.map((f) => keptByField.get(f)).filter(Boolean);
  const newHeaders = kept.map((k) => k.header);
  const newRows = rows.map((row) => kept.map((k) => normalizeField(row[k.fromIndex])));
  /** @type {Record<LabelField, number>} */
  const columnMap = {
    Code: -1,
    Brand: -1,
    Product: -1,
    Variation: -1,
    CountOrSize: -1,
  };
  kept.forEach((k, i) => {
    columnMap[k.field] = i;
  });

  return {
    headers: newHeaders,
    rows: newRows,
    delimiter: delim,
    hasHeader: true,
    kept,
    droppedHeaders,
    columnMap,
    layout: table.hasHeader ? 'headers' : 'inferred',
  };
}

/**
 * @param {string[]} headers
 */
export function autoMapColumns(headers) {
  return filterToLabelColumns({
    headers,
    rows: [],
    hasHeader: headers.some((h) => guessField(h)),
    delimiter: '\t',
  }).columnMap;
}

/**
 * @param {{ headers: string[], rows: string[][] }} table
 */
export function toCleanTsv(table) {
  const lines = [];
  if (table.headers && table.headers.length) lines.push(table.headers.join('\t'));
  for (const row of table.rows || []) {
    lines.push(row.map((c) => String(c ?? '')).join('\t'));
  }
  return lines.join('\n');
}

/**
 * @param {string[][]} rows
 * @param {Record<string, number>} columnMap
 */
export function rowsToLabelFields(rows, columnMap) {
  return (rows || []).map((row, idx) => {
    const pick = (field) => {
      const i = columnMap[field];
      if (i == null || i < 0) return '';
      return normalizeField(row[i]);
    };
    return {
      id: idx + 1,
      Code: pick('Code'),
      Brand: pick('Brand'),
      Product: pick('Product'),
      Variation: pick('Variation'),
      CountOrSize: pick('CountOrSize'),
    };
  });
}

/**
 * @param {string} text
 */
export function parseAndFilterPaste(text) {
  const raw = parsePasteTable(text);
  const filtered = filterToLabelColumns(raw);
  const fields =
    filtered.labelFields || rowsToLabelFields(filtered.rows, filtered.columnMap);
  return { raw, filtered, fields };
}
