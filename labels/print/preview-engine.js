/**
 * Preview print engine — renders labels for on-screen verification (no hardware).
 */

import { renderLabelToCanvas } from '../label-engine.js';
import { makePrintResult } from './print-engine.js';

/**
 * @returns {import('./print-engine.js').PrintEngine & {
 *   getLastCanvases: () => HTMLCanvasElement[]
 * }}
 */
export function createPreviewPrintEngine() {
  /** @type {HTMLCanvasElement[]} */
  let lastCanvases = [];

  return {
    name: 'Preview',
    isConnected() {
      return true;
    },
    async print(labels, options = {}) {
      const ready = (labels || []).filter((l) => l && !l.skipped && l.lines && l.lines.length);
      lastCanvases = [];
      const errors = [];

      for (let i = 0; i < ready.length; i++) {
        const label = ready[i];
        try {
          options.onProgress?.({
            index: i,
            total: ready.length,
            label,
            status: 'printing',
            message: `Preview ${i + 1}/${ready.length}`,
          });
          lastCanvases.push(renderLabelToCanvas(label, options));
          options.onProgress?.({
            index: i,
            total: ready.length,
            label,
            status: 'done',
          });
        } catch (err) {
          const message = err && err.message ? err.message : String(err);
          errors.push({ index: i, error: message });
          options.onProgress?.({
            index: i,
            total: ready.length,
            label,
            status: 'error',
            message,
          });
        }
      }

      return makePrintResult(ready, errors);
    },
    getLastCanvases() {
      return lastCanvases.slice();
    },
  };
}
