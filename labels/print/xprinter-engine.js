/**
 * Xprinter / TSC-class TSPL print engine.
 * Primary: Web Serial (USB). Secondary: Web Bluetooth.
 */

import { renderLabelToCanvas, DEFAULT_LABEL_OPTIONS } from '../label-engine.js';
import { makePrintResult } from './print-engine.js';
import { buildTsplBatch, chunkBytes } from './tspl.js';

/**
 * @param {object} [config]
 * @param {number} [config.baudRate]
 * @param {number} [config.gapMm]
 * @param {boolean} [config.invert]
 * @param {number} [config.bleChunkSize]
 * @param {number} [config.bleChunkDelayMs]
 */
export function createXprinterPrintEngine(config = {}) {
  /** @type {'serial'|'bluetooth'|null} */
  let transport = null;
  /** @type {SerialPort|null} */
  let serialPort = null;
  /** @type {WritableStreamDefaultWriter|null} */
  let serialWriter = null;
  /** @type {BluetoothRemoteGATTCharacteristic|null} */
  let bleChar = null;
  /** @type {BluetoothDevice|null} */
  let bleDevice = null;
  let connected = false;

  const baudRate = Number(config.baudRate) || 115200;
  const gapMm = config.gapMm != null ? Number(config.gapMm) : 2;
  const invert = !!config.invert;
  const bleChunkSize = Number(config.bleChunkSize) || 512;
  const bleChunkDelayMs =
    config.bleChunkDelayMs != null ? Number(config.bleChunkDelayMs) : 2;

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  /**
   * @param {Uint8Array} bytes
   * @param {{ onProgress?: (p: { sent: number, total: number }) => void }} [opts]
   */
  async function writeBytes(bytes, opts = {}) {
    if (!connected) throw new Error('Printer not connected.');
    if (transport === 'serial') {
      if (!serialWriter) throw new Error('USB serial writer missing.');
      await serialWriter.write(bytes);
      opts.onProgress?.({ sent: bytes.length, total: bytes.length });
      return;
    }
    if (transport === 'bluetooth') {
      if (!bleChar) throw new Error('Bluetooth characteristic missing.');
      const chunks = chunkBytes(bytes, bleChunkSize);
      let sent = 0;
      const total = bytes.length;
      const useNoResp = !!(
        bleChar.properties.writeWithoutResponse && bleChar.writeValueWithoutResponse
      );
      for (const chunk of chunks) {
        const copy = chunk.slice();
        if (useNoResp) {
          await bleChar.writeValueWithoutResponse(copy);
        } else {
          await bleChar.writeValue(copy);
        }
        sent += chunk.length;
        opts.onProgress?.({ sent, total });
        if (bleChunkDelayMs > 0) await sleep(bleChunkDelayMs);
      }
      return;
    }
    throw new Error('No active transport.');
  }

  async function disconnectSerial() {
    try {
      if (serialWriter) {
        try {
          await serialWriter.close();
        } catch {
          /* ignore */
        }
        serialWriter = null;
      }
      if (serialPort) {
        try {
          await serialPort.close();
        } catch {
          /* ignore */
        }
        serialPort = null;
      }
    } finally {
      if (transport === 'serial') {
        transport = null;
        connected = false;
      }
    }
  }

  async function disconnectBluetooth() {
    try {
      if (bleDevice?.gatt?.connected) {
        bleDevice.gatt.disconnect();
      }
    } catch {
      /* ignore */
    }
    bleChar = null;
    bleDevice = null;
    if (transport === 'bluetooth') {
      transport = null;
      connected = false;
    }
  }

  /**
   * Find a writable BLE characteristic on the connected GATT server.
   * @param {BluetoothRemoteGATTServer} server
   */
  async function findWritableCharacteristic(server) {
    const services = await server.getPrimaryServices();
    /** @type {BluetoothRemoteGATTCharacteristic[]} */
    const candidates = [];
    for (const service of services) {
      let chars;
      try {
        chars = await service.getCharacteristics();
      } catch {
        continue;
      }
      for (const c of chars) {
        if (c.properties.write || c.properties.writeWithoutResponse) {
          candidates.push(c);
        }
      }
    }
    if (!candidates.length) {
      throw new Error(
        'No writable Bluetooth characteristic found. Try USB (Connect USB) instead — more reliable for XP-460B.'
      );
    }
    // Prefer writeWithoutResponse for throughput
    return (
      candidates.find((c) => c.properties.writeWithoutResponse) || candidates[0]
    );
  }

  return {
    name: 'Xprinter',
    getTransport() {
      return transport;
    },
    isConnected() {
      return connected;
    },
    /**
     * @param {{ transport?: 'serial'|'bluetooth', baudRate?: number }} [opts]
     */
    async connect(opts = {}) {
      const mode = opts.transport || 'serial';

      if (mode === 'serial') {
        if (typeof navigator === 'undefined' || !navigator.serial) {
          throw new Error(
            'Web Serial unavailable. Use Chrome/Edge on desktop, or try Connect Bluetooth.'
          );
        }

        // requestPort first so the click gesture is still valid.
        let port;
        try {
          port = await navigator.serial.requestPort();
        } catch (err) {
          const msg =
            err && /** @type {any} */ (err).message
              ? String(/** @type {any} */ (err).message)
              : String(err);
          if (/cancel|abort/i.test(msg)) throw new Error('USB port selection cancelled.');
          if (/gesture|activation/i.test(msg)) {
            throw new Error('Click Connect USB again, then immediately choose XP-460B.');
          }
          throw new Error(
            msg ||
              'Could not select USB port. Close Open Label+ / other apps that may hold the printer.'
          );
        }

        await disconnectBluetooth();
        await disconnectSerial();

        // Stale open from a previous attempt on this page.
        if (port.readable || port.writable) {
          try {
            await port.close();
          } catch {
            /* ignore */
          }
        }

        const baud = Number(opts.baudRate) || baudRate;
        try {
          await port.open({
            baudRate: baud,
            dataBits: 8,
            stopBits: 1,
            parity: 'none',
            flowControl: 'none',
          });
        } catch (err) {
          const msg =
            err && /** @type {any} */ (err).message
              ? String(/** @type {any} */ (err).message)
              : String(err);
          throw new Error(
            'USB port is busy. Close Open Label+ and every other /print tab, unplug the printer 5 seconds, plug in, then Connect USB and select XP-460B again. (' +
              msg +
              ')'
          );
        }

        serialPort = port;
        serialWriter = serialPort.writable.getWriter();
        transport = 'serial';
        connected = true;
        return;
      }

      if (mode === 'bluetooth') {
        await this.disconnect();
        if (typeof navigator === 'undefined' || !navigator.bluetooth) {
          throw new Error('Web Bluetooth unavailable. Use Chrome on HTTPS, or Connect USB.');
        }
        try {
          bleDevice = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: [
              '0000ff00-0000-1000-8000-00805f9b34fb',
              '0000fff0-0000-1000-8000-00805f9b34fb',
              '0000ffe0-0000-1000-8000-00805f9b34fb',
              '000018f0-0000-1000-8000-00805f9b34fb',
              0xff00,
              0xffe0,
              0xfff0,
            ],
          });
        } catch (err) {
          const msg =
            err && /** @type {any} */ (err).message
              ? String(/** @type {any} */ (err).message)
              : String(err);
          if (/cancel|abort/i.test(msg)) throw new Error('Bluetooth pairing cancelled.');
          throw err instanceof Error ? err : new Error(msg);
        }
        bleDevice.addEventListener('gattserverdisconnected', () => {
          connected = false;
          bleChar = null;
        });
        const server = await bleDevice.gatt.connect();
        bleChar = await findWritableCharacteristic(server);
        transport = 'bluetooth';
        connected = true;
        return;
      }

      throw new Error(`Unknown transport: ${mode}`);
    },

    async disconnect() {
      await disconnectSerial();
      await disconnectBluetooth();
      transport = null;
      connected = false;
    },

    /**
     * @param {import('../label-engine.js').FormattedLabel[]} labels
     * @param {import('../label-engine.js').LabelRenderOptions & {
     *   onProgress?: Function,
     *   gapMm?: number,
     *   invert?: boolean,
     *   offsetXMm?: number,
     *   offsetYMm?: number,
     *   copies?: number,
     *   media?: 'gap'|'none'
     * }} [options]
     */
    async print(labels, options = {}) {
      const ready = (labels || []).filter((l) => l && !l.skipped && l.lines && l.lines.length);
      if (!ready.length) return makePrintResult([], []);
      if (!this.isConnected()) {
        throw new Error('Printer not connected. Click Connect USB (recommended) or Connect Bluetooth.');
      }

      const renderOpts = {
        ...DEFAULT_LABEL_OPTIONS,
        widthMm: options.widthMm,
        heightMm: options.heightMm,
        dpi: options.dpi,
        paddingMm: options.paddingMm,
        fontScale: options.fontScale,
      };
      const jobOpts = {
        widthMm: renderOpts.widthMm,
        heightMm: renderOpts.heightMm,
        dpi: renderOpts.dpi,
        gapMm: options.gapMm != null ? options.gapMm : gapMm,
        invert: options.invert != null ? options.invert : invert,
        offsetXMm: Number(options.offsetXMm) || 0,
        offsetYMm: Number(options.offsetYMm) || 0,
        copies: Math.max(1, Number(options.copies) || 1),
        media: options.media || 'gap',
      };

      const errors = [];
      options.onProgress?.({
        index: 0,
        total: ready.length,
        status: 'printing',
        message: `Preparing ${ready.length} label${ready.length === 1 ? '' : 's'}…`,
      });

      /** @type {HTMLCanvasElement[]} */
      const canvases = [];
      for (let i = 0; i < ready.length; i++) {
        try {
          canvases.push(renderLabelToCanvas(ready[i], renderOpts));
        } catch (err) {
          const message =
            err && /** @type {any} */ (err).message
              ? String(/** @type {any} */ (err).message)
              : String(err);
          errors.push({ index: i, error: message });
          options.onProgress?.({
            index: i,
            total: ready.length,
            label: ready[i],
            status: 'error',
            message,
          });
        }
      }

      if (!canvases.length) return makePrintResult(ready, errors);

      const payload = buildTsplBatch(canvases, jobOpts);
      options.onProgress?.({
        index: 0,
        total: ready.length,
        status: 'printing',
        message: `Sending ${canvases.length} label${canvases.length === 1 ? '' : 's'} to printer…`,
      });

      try {
        await writeBytes(payload, {
          onProgress({ sent, total }) {
            if (total <= 0) return;
            const pct = Math.min(100, Math.round((sent / total) * 100));
            options.onProgress?.({
              index: Math.min(
                canvases.length - 1,
                Math.floor((sent / total) * canvases.length)
              ),
              total: ready.length,
              status: 'printing',
              message: `Sending… ${pct}%`,
            });
          },
        });
        options.onProgress?.({
          index: canvases.length - 1,
          total: ready.length,
          status: 'done',
          message: `Sent ${canvases.length} label${canvases.length === 1 ? '' : 's'}`,
        });
      } catch (err) {
        const message =
          err && /** @type {any} */ (err).message
            ? String(/** @type {any} */ (err).message)
            : String(err);
        errors.push({ index: 0, error: message });
        options.onProgress?.({
          index: 0,
          total: ready.length,
          status: 'error',
          message,
        });
      }

      return makePrintResult(ready, errors);
    },
  };
}
