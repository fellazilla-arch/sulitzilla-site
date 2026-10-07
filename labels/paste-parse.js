/**
 * Parse pasted Grist / spreadsheet text into label field rows.
 *
 * Primary path: fixed Sulitzilla inventory view column layout (no headers).
 * Fallback: header names or cell-pattern inference for other pastes.
 */

import { normalizeField, labelField, isMoneyValue } from './label-engine.js';

/** @typedef {'Code'|'Brand'|'Product'|'Color'|'Storage'|'Condition'|'Variation'|'CountOrSize'|'Strength'} LabelField */

/**
 * @typedef {Object} ViewLayout
 * @property {string} id
 * @property {string} name
 * @property {(rows: string[][]) => boolean} detect
 * @property {(row: string[], idx: number) => import('./label-engine.js').LabelFields} mapRow
 * @property {number[]} usedColumns - original indexes kept (for drop reporting)
 */

function looksLikeGrade(v) {
  const s = normalizeField(v);
  if (!s || s.length > 24) return false;
  return /^(excellent|good|fair|poor|issue|ok|a\+?|b\+?|c\+?)$/i.test(s);
}

/**
 * True for short color / flavor style text (not storage/condition/noise).
 * @param {unknown} v
 */
function isPlausibleColorOrFlavor(v) {
  const s = normalizeField(v);
  if (!s || s.length > 40) return false;
  if (looksLikeStorage(s) || looksLikeCondition(s) || looksLikeGrade(s)) return false;
  if (looksLikeCode(s) || looksLikeNoise(s) || /^PAK/i.test(s)) return false;
  if (/\b(pixel|iphone|ipad|galaxy|macbook|oneblade)\b/i.test(s)) return false;
  if (!/^[A-Za-z][A-Za-z0-9 +#&'./\-]*$/.test(s)) return false;
  // Prefer multi-word color names or known singles; reject long prose.
  const words = s.split(/\s+/);
  if (words.length > 5) return false;
  return true;
}

/**
 * Find COLOR_FLAVOR anywhere in the row when the fixed column is empty/wrong.
 * Grist Arrived views often reorder columns so index 7 is not always Color.
 * @param {string[]} row
 * @param {string[]} [reserved]
 */
function findColorInRow(row, reserved = []) {
  const used = new Set(
    reserved.map((v) => normalizeField(v).toLowerCase()).filter(Boolean)
  );
  /** @type {string[]} */
  const soft = [];
  for (const cell of row || []) {
    const v = labelField(cell);
    if (!v) continue;
    const key = v.toLowerCase();
    if (used.has(key)) continue;
    if (looksLikeNoise(v) || looksLikeCode(v) || looksLikeStorage(v)) continue;
    if (looksLikeCondition(v) || looksLikeGrade(v)) continue;
    if (looksLikeColor(v)) return v;
    if (isPlausibleColorOrFlavor(v)) soft.push(v);
  }
  if (soft.length) return soft[0];

  // Last resort: known color phrase inside a longer cell (notes, etc.)
  const known = [...KNOWN_COLORS].sort((a, b) => b.length - a.length);
  for (const cell of row || []) {
    const s = normalizeField(cell);
    if (!s || s.length < 4 || used.has(s.toLowerCase())) continue;
    if (looksLikeCode(s) || looksLikeStorage(s) || looksLikeCondition(s)) continue;
    for (const c of known) {
      const re = new RegExp(`(?:^|[^a-z0-9])(${c.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')})(?:[^a-z0-9]|$)`, 'i');
      const m = s.match(re);
      if (m && m[1] && !used.has(m[1].toLowerCase())) return m[1];
    }
  }
  return '';
}

/**
 * Find a storage cell (128GB / 1TB) anywhere in the row.
 * @param {string[]} row
 * @param {string[]} [reserved]
 */
function findStorageInRow(row, reserved = []) {
  const used = new Set(
    reserved.map((v) => normalizeField(v).toLowerCase()).filter(Boolean)
  );
  for (const cell of row || []) {
    const v = labelField(cell);
    if (!v || used.has(v.toLowerCase())) continue;
    if (looksLikeStorage(v)) return v;
  }
  return '';
}

/**
 * Count/size for supplements: "60 Softgels", "24 Gummies", "100 Caplets", etc.
 * Kept broad on purpose — Grist COUNT/SIZE values vary a lot.
 * @param {unknown} v
 */
function looksLikeCountOrSize(v) {
  const s = normalizeField(v);
  if (!s || s.length > 48) return false;
  if (looksLikeStorage(s)) return true;
  if (looksLikeCondition(s) || looksLikeGrade(s) || looksLikeCode(s)) return false;
  if (isMoneyValue(s) || looksLikeNoise(s)) return false;
  if (looksLikeColor(s)) return false;
  // Any value with a number + short unit-ish text
  if (/\d/.test(s)) {
    if (
      /\b(gummies|gummy|caps?|caplets?|capsules?|softgels?|soft\s*gels?|gelcaps?|tablets?|tabs?|ct|count|pcs?|pieces?|servings?|packs?|bottles?|ml|oz|fl\.?\s*oz|chewables?|softgels?)\b/i.test(
        s
      )
    ) {
      return true;
    }
    // CamelCase: SoftGels, SleepGels, GelCaps
    if (/^\d+\s*[A-Za-z][A-Za-z0-9]*$/i.test(s) && s.length <= 24) return true;
    if (/^\d+\s*[x×]\s*\d+/i.test(s)) return true;
    if (/^\d+\s*(mg|mcg|g)\b/i.test(s) && s.length <= 16) return true;
    // Bare counts like "100" or "24 ct"
    if (/^\d{1,4}(\s*ct)?$/i.test(s)) return true;
  }
  return false;
}

/**
 * Keep almost any COUNT/SIZE cell that isn't junk / a known other field.
 * @param {unknown} v
 */
function isUsableCountOrSizeCell(v) {
  const s = labelField(v);
  if (!s) return false;
  if (looksLikeNoise(s) || looksLikeCode(s) || isMoneyValue(s)) return false;
  if (looksLikeCondition(s) || looksLikeGrade(s) || looksLikeStorage(s)) return false;
  if (looksLikeColor(s)) return false;
  if (/^PAK/i.test(s)) return false;
  if (/^[A-Z]{2,}\d{6,}/i.test(s)) return false; // tracking-ish IDs
  if (looksLikeCountOrSize(s)) return true;
  // Digits should lead (100 Caplets) — not appear mid package/id text
  if (/^\d/.test(s) && s.length <= 40) return true;
  if (/\b(tablet|tab|softgel|capsule|caplet|gumm|count|gelcap|chewable|pack|bottle|serving|gel)\b/i.test(s)) {
    return true;
  }
  return false;
}

/**
 * Find count/size anywhere in the row (supplements).
 * @param {string[]} row
 * @param {string[]} [reserved]
 */
function findCountOrSizeInRow(row, reserved = []) {
  const used = new Set(
    reserved.map((v) => normalizeField(v).toLowerCase()).filter(Boolean)
  );
  // Prefer cells after product-ish columns
  for (const cell of row || []) {
    const v = labelField(cell);
    if (!v || used.has(v.toLowerCase())) continue;
    if (isUsableCountOrSizeCell(v) && !looksLikeStorage(v)) return v;
  }
  return '';
}

/**
 * Find STRENGTH (Maximum Strength, 500mg, …) anywhere in the row.
 * @param {string[]} row
 * @param {string[]} [reserved]
 */
function findStrengthInRow(row, reserved = []) {
  const used = new Set(
    reserved.map((v) => normalizeField(v).toLowerCase()).filter(Boolean)
  );
  for (const cell of row || []) {
    const v = labelField(cell);
    if (!v || used.has(v.toLowerCase())) continue;
    if (looksLikeStrength(v)) return v;
  }
  return '';
}

function looksLikeStrength(v) {
  const s = normalizeField(v);
  if (!s || s.length > 48) return false;
  if (looksLikeStorage(s) || looksLikeCondition(s) || looksLikeCode(s)) return false;
  if (isMoneyValue(s) || looksLikeNoise(s)) return false;
  if (/^PAK/i.test(s) || /^AIR\s*(KANGO|TARLAC)\b/i.test(s)) return false;
  if (/\b(maximum|extra|regular|high)\s+strength\b/i.test(s)) return true;
  if (/^strength\b/i.test(s)) return true;
  if (/^\d+(\.\d+)?\s*(mg|mcg|µg|ug|iu|g)\b/i.test(s)) return true;
  if (/\b\d+(\.\d+)?\s*(mg|mcg|iu)\b/i.test(s) && s.length <= 24) return true;
  return false;
}

/**
 * Shared mapping for Kango / Taobao / Printer-style rows.
 * Gadgets: Storage + Color/Flavor + Condition (+ Count/Size/Strength when present).
 * Non-gadgets: Color/Flavor + Variation + Count/Size + Strength — skip Condition/Storage.
 * @param {object} cols
 * @param {number} idx
 * @param {string[]} [sourceRow] - full paste row for color/storage recovery
 */
function mapLabelCols(cols, idx, sourceRow) {
  const code = labelField(cols.Code);
  const brand = labelField(cols.Brand);
  const product = labelField(cols.Product);
  let color = labelField(cols.Color);
  const specs = labelField(cols.VariationOrSpecs);
  let storage = labelField(cols.Storage);
  const condition = labelField(cols.Condition);
  let strength = labelField(cols.Strength);
  // Always prefer the dedicated COUNT/SIZE column when present.
  let countHint = isUsableCountOrSizeCell(cols.CountOrSize)
    ? labelField(cols.CountOrSize)
    : '';

  // Storage col sometimes holds supplement counts when COUNT/SIZE is empty.
  if (!countHint && storage && isUsableCountOrSizeCell(storage) && !looksLikeStorage(storage)) {
    countHint = storage;
    storage = '';
  }

  // Fixed Color slot sometimes holds storage/grade/count when columns shifted.
  if (color && (looksLikeStorage(color) || looksLikeCondition(color) || looksLikeGrade(color))) {
    if (!storage && looksLikeStorage(color)) storage = color;
    color = '';
  } else if (color && isUsableCountOrSizeCell(color) && !looksLikeColor(color)) {
    if (!countHint) countHint = color;
    color = '';
  }

  if (storage && !looksLikeStorage(storage) && !isUsableCountOrSizeCell(storage)) {
    if (!color && (looksLikeColor(storage) || isPlausibleColorOrFlavor(storage))) {
      color = storage;
    }
    storage = '';
  }

  // If COUNT/SIZE cell is actually a color (older layouts), move it.
  if (countHint && !isUsableCountOrSizeCell(countHint)) {
    if (!color && (looksLikeColor(countHint) || isPlausibleColorOrFlavor(countHint))) {
      color = countHint;
    }
    countHint = '';
  }

  if (strength && (looksLikeStorage(strength) || looksLikeCondition(strength) || looksLikeCode(strength))) {
    strength = '';
  }

  if (sourceRow && sourceRow.length) {
    if (!storage) {
      storage = findStorageInRow(sourceRow, [
        code,
        brand,
        product,
        condition,
        color,
        specs,
        countHint,
        strength,
      ]);
    }
    if (!color || looksLikeStorage(color)) {
      const found = findColorInRow(sourceRow, [
        code,
        brand,
        product,
        condition,
        storage,
        specs,
        countHint,
        strength,
      ]);
      if (found) color = found;
    }
    if (!countHint) {
      countHint = findCountOrSizeInRow(sourceRow, [
        code,
        brand,
        product,
        condition,
        storage,
        color,
        specs,
        strength,
      ]);
    }
    if (!strength) {
      strength = findStrengthInRow(sourceRow, [
        code,
        brand,
        product,
        condition,
        storage,
        color,
        specs,
        countHint,
      ]);
    }
  }

  // Specs / variation column often holds color when Color col is blank.
  if (
    !color &&
    specs &&
    !looksLikeStorage(specs) &&
    !looksLikeCondition(specs) &&
    !looksLikeGrade(specs) &&
    !isUsableCountOrSizeCell(specs)
  ) {
    if (looksLikeColor(specs) || isPlausibleColorOrFlavor(specs)) color = specs;
  }

  if (!countHint && specs && isUsableCountOrSizeCell(specs) && !looksLikeStorage(specs)) {
    countHint = specs;
  }

  const gadget = isGadgetItem({
    brand,
    product,
    storage,
    condition,
    countOrSize: storage || countHint,
    variation: color || specs,
  });

  if (gadget) {
    return {
      id: idx + 1,
      Code: code,
      Brand: brand,
      Product: product,
      Color: color,
      Storage: storage,
      Condition: condition,
      // Keep VARIATION distinct from COLOR/FLAVOR (e.g. case model vs color).
      Variation: specs && specs !== color ? specs : '',
      CountOrSize: countHint,
      Strength: strength,
    };
  }

  // Non-gadgets: Color/Flavor + Variation + Count/Size + Strength; never Condition/Storage.
  const countOrSize =
    countHint ||
    (storage && !looksLikeStorage(storage) ? storage : '') ||
    (specs && isUsableCountOrSizeCell(specs) ? specs : '');
  const variation =
    specs && specs !== countOrSize && specs !== color && !isUsableCountOrSizeCell(specs)
      ? specs
      : '';
  return {
    id: idx + 1,
    Code: code,
    Brand: brand,
    Product: product,
    Color: color && color !== countOrSize ? color : '',
    Storage: '',
    Condition: '',
    Variation: variation,
    CountOrSize: countOrSize,
    Strength: strength && strength !== countOrSize ? strength : '',
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
    /\b(gummy|gummies|vitamin|capsule|softgel|soft\s*gel|sleepgels?|sleep\s*gels?|supplement|collagen|probiotic|omega[\s-]?3|multivitamin|creatine|protein\s*powder|electrolyte|fish\s*oil|serving)\b/i.test(
      blob
    )
  ) {
    return true;
  }
  if (/\d+\s*(gummies|caps|softgels|tablets|ct|count)\b/i.test(blob)) return true;
  // Product names like SleepGels / MelatoninGummies without a space
  if (/gels?\b|gummies\b|capsules?\b|vitamins?\b/i.test(blob)) return true;
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
 * Shared column map for Kango-style Master_List views
 * (Arrived / Air Kango — same left-to-right order).
 *
 * 0 Code | 1 Status | 2 Package (PAK…) | 3 Condition | 4 Brand | 5 Product
 * 6 Storage | 7 Count/Size | 8 Variation | 9 Color/Flavor | 10 Grade | …
 * @param {string[]} row
 * @param {number} idx
 */
function mapKangoStyleRow(row, idx) {
  const countRaw = labelField(row[7]);
  const colorRaw = labelField(row[9]);
  const color =
    colorRaw ||
    (countRaw && !isUsableCountOrSizeCell(countRaw) ? countRaw : '');
  // STRENGTH is often after COLOR/FLAVOR (col 10+) on Printer / Master_List pastes.
  const strength =
    labelField(row[10]) && looksLikeStrength(row[10])
      ? labelField(row[10])
      : labelField(row[11]) && looksLikeStrength(row[11])
        ? labelField(row[11])
        : '';
  return mapLabelCols(
    {
      Code: row[0],
      Condition: row[3],
      Brand: row[4],
      Product: row[5],
      Storage: row[6],
      CountOrSize: countRaw,
      VariationOrSpecs: row[8],
      Color: color,
      Strength: strength,
    },
    idx,
    row
  );
}

function looksLikeKangoPackage(v) {
  const pkg = normalizeField(v);
  return /^PAK/i.test(pkg) || /^[A-Z]{2,}\d+/i.test(pkg);
}

/** AIR KANGO / AIR TARLAC on Master_List-style views (PAK in col 2). */
function looksLikeAirInventoryStatus(v) {
  const s = normalizeField(v);
  return /^AIR\s*KANGO\b/i.test(s) || /^AIR\s*TARLAC\b/i.test(s);
}

function resolveAirInventoryLayoutName(rows) {
  const sample = sampleRows(rows);
  let kango = 0;
  let tarlac = 0;
  for (const row of sample) {
    const s = normalizeField(row[1]);
    if (/^AIR\s*KANGO\b/i.test(s)) kango++;
    if (/^AIR\s*TARLAC\b/i.test(s)) tarlac++;
  }
  if (tarlac && !kango) return 'Air Tarlac';
  if (kango && !tarlac) return 'Air Kango';
  return 'Air Inventory';
}

/**
 * View — Inventory filtered to AIR KANGO or AIR TARLAC (e.g. p/470).
 * Same column order as Kango Arrived; same field rules as Air Kango.
 */
export const LAYOUT_AIR_KANGO = Object.freeze({
  id: 'air-inventory',
  name: 'Air Inventory',
  // CODE, CONDITION, BRAND, PRODUCT, STORAGE, COUNT/SIZE, VARIATION, COLOR/FLAVOR (+ STRENGTH if present)
  usedColumns: [0, 3, 4, 5, 6, 7, 8, 9, 10],
  detect(rows) {
    const sample = sampleRows(rows);
    if (!sample.length) return false;
    let ok = 0;
    for (const row of sample) {
      if (row.length < 9 || row.length > 40) continue;
      if (!looksLikeCode(row[0])) continue;
      if (row.some((c) => /amazon\.com/i.test(c))) continue;
      if (!looksLikeAirInventoryStatus(row[1])) continue;
      if (!looksLikeKangoPackage(row[2])) continue;
      if (looksLikeStorage(row[5])) continue;
      const brand = normalizeField(row[4]);
      const product = normalizeField(row[5]);
      if (!brand || looksLikeNoise(brand) || looksLikeCode(brand)) continue;
      if (!product || looksLikeNoise(product)) continue;
      ok++;
    }
    return ok >= Math.ceil(sample.length * 0.6);
  },
  resolveName: resolveAirInventoryLayoutName,
  mapRow: mapKangoStyleRow,
});

/**
 * Grist "Printer" page column order (Inventory p/497-style):
 * 0 CODE | 1 CONDITION | 2 BRAND | 3 MODEL/PRODUCT | 4 VARIATION
 * 5 STORAGE | 6 COUNT/SIZE | 7 COLOR/FLAVOR | 8 STRENGTH | 9 STATUS
 * STATUS is detected but never printed.
 */
export const LAYOUT_AIR_PRINTER = Object.freeze({
  id: 'air-printer',
  name: 'Air Printer',
  usedColumns: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  detect(rows) {
    const sample = sampleRows(rows);
    if (!sample.length) return false;
    let ok = 0;
    for (const row of sample) {
      if (row.length < 8 || row.length > 16) continue;
      if (!looksLikeCode(row[0])) continue;
      // Master_List air layout has STATUS in col 1 — leave that to LAYOUT_AIR_KANGO.
      if (looksLikeAirInventoryStatus(row[1])) continue;
      if (looksLikeKangoPackage(row[1]) || looksLikeKangoPackage(row[2])) continue;
      const status = normalizeField(row[9] || row[row.length - 1]);
      if (!looksLikeAirInventoryStatus(status)) continue;
      const brand = normalizeField(row[2]);
      const product = normalizeField(row[3]);
      if (!brand || looksLikeNoise(brand) || looksLikeCode(brand)) continue;
      if (!product || looksLikeNoise(product)) continue;
      // Soft check: CONDITION empty or condition-like; STORAGE empty or storage-like.
      const cond = normalizeField(row[1]);
      if (cond && !looksLikeCondition(cond) && !/^new\b/i.test(cond) && !/^used\b/i.test(cond)) {
        continue;
      }
      ok++;
    }
    return ok >= Math.ceil(sample.length * 0.6);
  },
  resolveName(rows) {
    const sample = sampleRows(rows);
    let kango = 0;
    let tarlac = 0;
    for (const row of sample) {
      const s = normalizeField(row[9] || row[row.length - 1]);
      if (/^AIR\s*KANGO\b/i.test(s)) kango++;
      if (/^AIR\s*TARLAC\b/i.test(s)) tarlac++;
    }
    if (tarlac && !kango) return 'Air Tarlac';
    if (kango && !tarlac) return 'Air Kango';
    return 'Air Printer';
  },
  mapRow(row, idx) {
    return mapLabelCols(
      {
        Code: row[0],
        Condition: row[1],
        Brand: row[2],
        Product: row[3],
        VariationOrSpecs: row[4],
        Storage: row[5],
        CountOrSize: row[6],
        Color: row[7],
        Strength: row[8],
      },
      idx,
      row
    );
  },
});

/**
 * View 1 — Grist page "Kango Arrived"
 *
 * 0 Code | 1 Status | 2 Package (PAK…) | 3 Condition | 4 Brand | 5 Product
 * 6 Storage | 7 Count/Size | 8 Variation | 9 Color/Flavor | 10 Grade | …
 */
export const LAYOUT_KANGO_ARRIVED = Object.freeze({
  id: 'kango-arrived',
  name: 'Kango Arrived',
  usedColumns: [0, 3, 4, 5, 6, 7, 8, 9],
  detect(rows) {
    const sample = sampleRows(rows);
    if (!sample.length) return false;
    let ok = 0;
    for (const row of sample) {
      if (row.length < 9 || row.length > 40) continue;
      if (!looksLikeCode(row[0])) continue;
      if (row.some((c) => /amazon\.com/i.test(c))) continue;
      // Air Kango / Air Tarlac inventory views have their own detector.
      if (looksLikeAirInventoryStatus(row[1])) continue;
      if (!looksLikeKangoPackage(row[2])) continue;
      if (looksLikeStorage(row[5])) continue; // Taobao has storage in col 5
      const brand = normalizeField(row[4]);
      const product = normalizeField(row[5]);
      if (!brand || looksLikeNoise(brand) || looksLikeCode(brand)) continue;
      if (!product || looksLikeNoise(product)) continue;
      ok++;
    }
    return ok >= Math.ceil(sample.length * 0.6);
  },
  mapRow: mapKangoStyleRow,
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
      // Amazon Arrived: order# / amazon URL. PAK+AIR TARLAC belongs to Air Inventory.
      const amzStatus = /^AIR\s*TARLAC\b/i.test(status);
      if (!hasAmzUrl && !numericOrder && !amzStatus) continue;
      if (looksLikeKangoPackage(orderId)) continue;
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
    let countOrSize = labelField(row[7]);
    const flavor = labelField(row[8]);
    const condition = labelField(row[3]);
    if (!countOrSize) {
      countOrSize = findCountOrSizeInRow(row, [
        labelField(row[0]),
        brand,
        product,
        condition,
        variant,
        flavor,
      ]);
    }
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
        Color: [flavor, variant].filter(Boolean).join(' · ') || flavor || variant,
        Storage: looksLikeStorage(countOrSize) ? countOrSize : '',
        Condition: condition,
        Variation: [variant, flavor].filter(Boolean).join(' · '),
        CountOrSize: countOrSize || [condition].filter(Boolean).join(' · '),
      };
    }

    // Supplements / general — Count/Size + optional Color/Flavor + Variation.
    return {
      id: idx + 1,
      Code: labelField(row[0]),
      Brand: brand,
      Product: product,
      Color: flavor && flavor !== countOrSize ? flavor : '',
      Storage: '',
      Condition: '',
      Variation: variant && variant !== countOrSize && variant !== flavor ? variant : '',
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
        VariationOrSpecs: row[7],
      },
      idx,
      row
    );
  },
});

/** Registered layouts — first match wins. */
export const VIEW_LAYOUTS = [
  LAYOUT_AIR_PRINTER,
  LAYOUT_AIR_KANGO,
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
  Color: [
    'color',
    'colour',
    'color flavor',
    'colorflavor',
    'color_flavor',
    'color / flavor',
    'colour flavor',
    'flavor',
    'flavour',
  ],
  Storage: ['storage', 'capacity', 'ram', 'memory'],
  Condition: ['condition', 'conditions', 'cond'],
  Variation: ['variation', 'variant', 'variants'],
  CountOrSize: [
    'count',
    'size',
    'count size',
    'countorsize',
    'count or size',
    'count / size',
    'qty',
    'quantity',
  ],
  Strength: ['strength', 'potency', 'dose', 'dosage'],
};

const FIELD_ORDER = /** @type {LabelField[]} */ ([
  'Code',
  'Brand',
  'Product',
  'Color',
  'Storage',
  'Condition',
  'Variation',
  'CountOrSize',
  'Strength',
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
  'mint',
  'navy',
  'bronze',
  'graphite',
  'midnight',
  'starlight',
  'product red',
  'sierra blue',
  'alpine green',
  'deep purple',
  'space gray',
  'space grey',
  'natural titanium',
  'blue titanium',
  'black titanium',
  'white titanium',
  'lemon',
  'indigo',
  'coral red',
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
  let color = 0;
  let storage = 0;
  let condition = 0;
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
    if (looksLikeColor(c)) color++;
    if (looksLikeStorage(c)) storage++;
    if (looksLikeCondition(c)) condition++;
    if (isUsableCountOrSizeCell(c) && !looksLikeStorage(c)) size++;
    // Loose product: multi-word non-noise text
    if (!looksLikeBrand(c) && !looksLikeCode(c) && !looksLikeColor(c) && c.split(/\s+/).length >= 2) {
      product += 0.35;
    }
  }
  return {
    Code: code / n - noise / n,
    Brand: brand / n - noise / n,
    Product: product / n - noise / n,
    Color: color / n - noise / n,
    Storage: storage / n - noise / n,
    Condition: condition / n - noise / n,
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
 * Grist sometimes includes the leftmost row-number column when copying.
 * That shifts CODE off index 0 and breaks Kango detection.
 * @param {string[][]} rows
 * @param {string[]} [headers]
 */
function stripLeadingRowNumbers(rows, headers = []) {
  if (!rows.length) return { rows, headers, stripped: false };
  const sample = rows.slice(0, Math.min(rows.length, 8));
  let indexLike = 0;
  let codeInCol1 = 0;
  for (const row of sample) {
    const c0 = normalizeField(row[0]);
    const c1 = normalizeField(row[1]);
    if (/^\d{1,4}$/.test(c0)) indexLike++;
    if (looksLikeCode(c1)) codeInCol1++;
  }
  const need = Math.ceil(sample.length * 0.6);
  if (indexLike < need || codeInCol1 < need) {
    return { rows, headers, stripped: false };
  }
  // Don't strip if col0 already looks like inventory codes
  if (sample.filter((r) => looksLikeCode(r[0])).length >= need) {
    return { rows, headers, stripped: false };
  }
  return {
    rows: rows.map((r) => r.slice(1)),
    headers: headers.length ? headers.slice(1) : headers,
    stripped: true,
  };
}

/**
 * @param {{ headers: string[], rows: string[][], delimiter?: string, hasHeader?: boolean }} table
 */
export function filterToLabelColumns(table) {
  const delim = table.delimiter || '\t';
  const stripped = stripLeadingRowNumbers(table.rows || [], table.headers || []);
  const headers = stripped.headers;
  const rows = stripped.rows;

  // Prefer fixed Grist layouts even when a header row is present — headers often
  // mis-map STORAGE→Count/Size and drop COUNT/SIZE / COLOR/FLAVOR.
  const layout = detectViewLayout(rows);
  if (layout) {
    const fields = rows.map((row, idx) => layout.mapRow(row, idx));
    const newHeaders = [
      'Code',
      'Brand',
      'Product',
      'Color',
      'Storage',
      'Condition',
      'Variation',
      'CountOrSize',
      'Strength',
    ];
    const newRows = fields.map((f) => [
      f.Code,
      f.Brand,
      f.Product,
      f.Color || '',
      f.Storage || '',
      f.Condition || '',
      f.Variation || '',
      f.CountOrSize || '',
      f.Strength || '',
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
      kept: newHeaders.map((header, fromIndex) => ({
        field: /** @type {LabelField} */ (header),
        header,
        fromIndex,
      })),
      droppedHeaders,
      columnMap: {
        Code: 0,
        Brand: 1,
        Product: 2,
        Color: 3,
        Storage: 4,
        Condition: 5,
        Variation: 6,
        CountOrSize: 7,
        Strength: 8,
      },
      layout: layout.id,
      layoutName:
        typeof layout.resolveName === 'function'
          ? layout.resolveName(rows)
          : layout.name,
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
  /** @type {Record<string, number>} */
  const columnMap = {
    Code: -1,
    Brand: -1,
    Product: -1,
    Color: -1,
    Storage: -1,
    Condition: -1,
    Variation: -1,
    CountOrSize: -1,
    Strength: -1,
  };
  kept.forEach((k, i) => {
    columnMap[k.field] = i;
  });

  // Build rich label fields from header/inferred columns (not only 5-col legacy).
  const labelFields = rows.map((row, idx) => {
    const pick = (field) => {
      const meta = keptByField.get(field);
      if (!meta) return '';
      return row[meta.fromIndex];
    };
    return mapLabelCols(
      {
        Code: pick('Code'),
        Brand: pick('Brand'),
        Product: pick('Product'),
        Color: pick('Color'),
        Storage: pick('Storage'),
        Condition: pick('Condition'),
        VariationOrSpecs: pick('Variation'),
        CountOrSize: pick('CountOrSize'),
        Strength: pick('Strength'),
      },
      idx,
      row
    );
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
    labelFields,
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
    const color = pick('Color') || pick('Variation');
    const storage = pick('Storage');
    const condition = pick('Condition');
    const countOrSize = pick('CountOrSize');
    // Cleaned 6-col layout stores Color/Storage/Condition separately.
    // Older 5-col clean TSV may have "128GB · Used" in CountOrSize.
    let resolvedStorage = storage;
    let resolvedCondition = condition;
    if (!resolvedStorage && !resolvedCondition && countOrSize) {
      const parts = countOrSize.split(/\s*·\s*/).map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 2 && looksLikeStorage(parts[0])) {
        resolvedStorage = parts[0];
        resolvedCondition = parts.slice(1).join(' · ');
      } else if (looksLikeStorage(countOrSize)) {
        resolvedStorage = countOrSize;
      }
    }
    return {
      id: idx + 1,
      Code: pick('Code'),
      Brand: pick('Brand'),
      Product: pick('Product'),
      Color: color,
      Storage: resolvedStorage,
      Condition: resolvedCondition,
      Variation: pick('Variation') || color,
      CountOrSize: countOrSize || [resolvedStorage, resolvedCondition].filter(Boolean).join(' · '),
      Strength: pick('Strength'),
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
