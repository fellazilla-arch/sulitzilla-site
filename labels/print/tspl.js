/**
 * TSPL II bitmap job builder for Xprinter / TSC-class label printers.
 */

/**
 * @typedef {Object} TsplJobOptions
 * @property {number} widthMm
 * @property {number} heightMm
 * @property {number} [gapMm]
 * @property {boolean} [invert] - if true, black pixels become 0 (some firmwares)
 * @property {number} [copies]
 * @property {number} [x] - BITMAP x in dots
 * @property {number} [y] - BITMAP y in dots
 * @property {number} [offsetXMm] - shift print right (positive) / left (negative)
 * @property {number} [offsetYMm] - shift print down (positive) / up (negative)
 * @property {number} [dpi]
 * @property {boolean} [includeSetup] - include SIZE/GAP/DENSITY (default true)
 * @property {'gap'|'none'} [media]
 */

/**
 * Pack canvas to 1-bit MSB-first rows (TSPL BITMAP).
 * Default: black (dark) pixels → bit 1.
 * @param {HTMLCanvasElement} canvas
 * @param {{ invert?: boolean }} [opts]
 * @returns {{ widthBytes: number, height: number, data: Uint8Array }}
 */
export function canvasToTsplBitmap(canvas, opts = {}) {
  const invert = !!opts.invert;
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');
  const image = ctx.getImageData(0, 0, w, h);
  const widthBytes = Math.ceil(w / 8);
  const data = new Uint8Array(widthBytes * h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = image.data[i];
      const g = image.data[i + 1];
      const b = image.data[i + 2];
      const a = image.data[i + 3];
      // Luma; treat transparent as white
      const dark = a > 128 && (r + g + b) / 3 < 128;
      const bitOn = invert ? !dark : dark;
      if (bitOn) {
        const byteIndex = y * widthBytes + (x >> 3);
        data[byteIndex] |= 0x80 >> (x & 7);
      }
    }
  }

  return { widthBytes, height: h, data };
}

/**
 * Concatenate Uint8Arrays.
 * @param {Uint8Array[]} parts
 */
function concatBytes(parts) {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

const enc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

/**
 * @param {string} s
 */
function ascii(s) {
  if (!enc) {
    const arr = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i) & 0xff;
    return arr;
  }
  return enc.encode(s);
}

/**
 * Build a complete TSPL job for one label bitmap.
 * @param {HTMLCanvasElement} canvas
 * @param {TsplJobOptions} options
 * @returns {Uint8Array}
 */
export function buildTsplJob(canvas, options) {
  const widthMm = Number(options.widthMm) || 30;
  const heightMm = Number(options.heightMm) || 20;
  const gapMm = options.gapMm != null ? Number(options.gapMm) : 2;
  const copies = Math.max(1, Number(options.copies) || 1);
  const dpi = Number(options.dpi) || 203;
  const mmToDots = (mm) => Math.round((Number(mm) || 0) * (dpi / 25.4));
  const x = (Number(options.x) || 0) + mmToDots(options.offsetXMm);
  const y = (Number(options.y) || 0) + mmToDots(options.offsetYMm);
  const media = options.media || 'gap';
  const includeSetup = options.includeSetup !== false;

  const { widthBytes, height, data } = canvasToTsplBitmap(canvas, {
    invert: options.invert,
  });

  const setup = includeSetup
    ? [
        `SIZE ${widthMm} mm,${heightMm} mm\r\n`,
        media === 'none' ? `GAP 0 mm,0\r\n` : `GAP ${gapMm} mm,0\r\n`,
        `DENSITY 8\r\n`,
      ].join('')
    : '';

  const header = `${setup}CLS\r\nBITMAP ${x},${y},${widthBytes},${height},0,`;
  const footer = `\r\nPRINT ${copies}\r\n`;

  return concatBytes([ascii(header), data, ascii(footer)]);
}

/**
 * Concatenate several label jobs into one continuous TSPL stream.
 * SIZE/GAP/DENSITY once up front; each label is CLS + BITMAP + PRINT.
 * @param {HTMLCanvasElement[]} canvases
 * @param {TsplJobOptions} options
 * @returns {Uint8Array}
 */
export function buildTsplBatch(canvases, options) {
  const list = Array.isArray(canvases) ? canvases.filter(Boolean) : [];
  if (!list.length) return new Uint8Array(0);

  /** @type {Uint8Array[]} */
  const parts = [];
  list.forEach((canvas, i) => {
    parts.push(
      buildTsplJob(canvas, {
        ...options,
        includeSetup: i === 0,
      })
    );
  });
  return concatBytes(parts);
}

/**
 * Chunk a buffer for BLE / slow serial writes.
 * @param {Uint8Array} bytes
 * @param {number} [chunkSize]
 * @returns {Uint8Array[]}
 */
export function chunkBytes(bytes, chunkSize = 512) {
  const size = Math.max(1, chunkSize);
  const out = [];
  for (let i = 0; i < bytes.length; i += size) {
    out.push(bytes.subarray(i, i + size));
  }
  return out;
}
