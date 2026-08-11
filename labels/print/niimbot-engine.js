/**
 * NIIMBOT print engine — Web Bluetooth via vendored niimbluelib.
 * Expects global `niimbluelib` (UMD) or window.niimbluelib.
 */

import { renderLabelToCanvas, DEFAULT_LABEL_OPTIONS } from '../label-engine.js';
import { makePrintResult } from './print-engine.js';

function getLib() {
  const lib = typeof window !== 'undefined' ? window.niimbluelib : null;
  if (!lib || !lib.NiimbotBluetoothClient || !lib.ImageEncoder) {
    throw new Error(
      'niimbluelib not loaded. Open this widget over HTTPS in Chrome and ensure vendor/niimbluelib.min.js is present.'
    );
  }
  return lib;
}

/**
 * @param {unknown} err
 */
function rewriteConnectError(err) {
  const msg = err && /** @type {any} */ (err).message ? String(/** @type {any} */ (err).message) : String(err);
  const lower = msg.toLowerCase();
  if (/no services found/i.test(msg)) {
    return new Error(
      'This printer is not a NIIMBOT (or macOS already holds the Bluetooth link). ' +
        'Forget/disconnect CT221B / Clabel in macOS Bluetooth settings first. ' +
        'Clabel and Xprinter need a different print driver — this page currently speaks NIIMBOT only.'
    );
  }
  if (/timeout waiting response/i.test(msg) || /waited for \d+/i.test(msg)) {
    return new Error(
      'Connected over Bluetooth, but the printer did not speak the NIIMBOT protocol (common with Xprinter / Clabel). ' +
        'This app’s print engine is NIIMBOT-only right now. Xprinter (TSPL) can be added next if you want.'
    );
  }
  if (/user cancelled|canceled|cancelled/i.test(lower)) {
    return new Error('Bluetooth pairing cancelled.');
  }
  return err instanceof Error ? err : new Error(msg);
}

/**
 * @param {object} [config]
 * @param {string} [config.printTaskName] - e.g. B1, D110, B21_V1; auto if omitted
 * @param {'left'|'top'} [config.printDirection]
 * @param {number} [config.copies]
 */
export function createNiimbotPrintEngine(config = {}) {
  /** @type {any} */
  let client = null;
  let connected = false;

  const printDirection = config.printDirection || 'left';
  const copies = Math.max(1, Number(config.copies) || 1);

  function ensureBluetooth() {
    if (typeof navigator === 'undefined' || !navigator.bluetooth) {
      throw new Error(
        'Web Bluetooth unavailable. Use Chrome on HTTPS, or open the widget in a standalone tab (Bluetooth is often blocked inside Grist iframes).'
      );
    }
  }

  return {
    name: 'NIIMBOT',
    isConnected() {
      return connected && !!client;
    },
    getClient() {
      return client;
    },
    async connect() {
      ensureBluetooth();
      const lib = getLib();
      if (client) {
        try {
          client.disconnect();
        } catch {
          /* ignore */
        }
        client = null;
        connected = false;
      }
      client = new lib.NiimbotBluetoothClient();
      client.on('disconnect', () => {
        connected = false;
      });
      client.on('connect', () => {
        connected = true;
      });
      try {
        await client.connect();
      } catch (err) {
        client = null;
        connected = false;
        throw rewriteConnectError(err);
      }
      connected = true;
      try {
        await client.fetchPrinterInfo?.();
      } catch {
        /* optional — many non-NIIMBOT devices fail here */
      }
    },
    async disconnect() {
      if (client) {
        try {
          client.disconnect();
        } catch {
          /* ignore */
        }
      }
      client = null;
      connected = false;
    },
    /**
     * @param {import('../label-engine.js').FormattedLabel[]} labels
     * @param {import('../label-engine.js').LabelRenderOptions & {
     *   onProgress?: Function,
     *   printTaskName?: string,
     *   printDirection?: 'left'|'top',
     *   copies?: number
     * }} [options]
     */
    async print(labels, options = {}) {
      const ready = (labels || []).filter((l) => l && !l.skipped && l.lines && l.lines.length);
      if (!ready.length) {
        return makePrintResult([], []);
      }
      if (!this.isConnected()) {
        throw new Error('Printer not connected. Click Connect Printer first.');
      }

      const lib = getLib();
      const direction = options.printDirection || printDirection;
      const qty = Math.max(1, Number(options.copies) || copies);
      const renderOpts = {
        ...DEFAULT_LABEL_OPTIONS,
        widthMm: options.widthMm,
        heightMm: options.heightMm,
        dpi: options.dpi,
        paddingMm: options.paddingMm,
        fontScale: options.fontScale,
      };

      const taskName =
        options.printTaskName ||
        config.printTaskName ||
        client.getPrintTaskType?.() ||
        'D110';

      const printTask = client.abstraction.newPrintTask(taskName, {
        totalPages: ready.length * qty,
        statusPollIntervalMs: 100,
        statusTimeoutMs: 12_000,
      });

      const errors = [];

      try {
        await printTask.printInit();

        for (let i = 0; i < ready.length; i++) {
          const label = ready[i];
          options.onProgress?.({
            index: i,
            total: ready.length,
            label,
            status: 'printing',
            message: `Printing ${i + 1}/${ready.length}`,
          });
          try {
            const canvas = renderLabelToCanvas(label, renderOpts);
            const encoded = lib.ImageEncoder.encodeCanvas(canvas, direction);
            await printTask.printPage(encoded, qty);
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
            // Continue remaining labels when possible
          }
        }

        try {
          await printTask.waitForFinished();
        } catch (err) {
          // If some pages printed, still return partial result
          if (!errors.length) {
            throw err;
          }
        }
      } finally {
        try {
          await client.abstraction.printEnd();
        } catch {
          /* ignore */
        }
      }

      return makePrintResult(ready, errors);
    },
  };
}
