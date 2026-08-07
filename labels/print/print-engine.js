/**
 * Print Engine contract — printers implement this; no Grist knowledge.
 */

/**
 * @typedef {import('../label-engine.js').FormattedLabel} FormattedLabel
 * @typedef {import('../label-engine.js').LabelRenderOptions} LabelRenderOptions
 */

/**
 * @typedef {Object} PrintProgress
 * @property {number} index - 0-based label index in the current job
 * @property {number} total
 * @property {FormattedLabel} [label]
 * @property {'printing'|'done'|'error'} status
 * @property {string} [message]
 */

/**
 * @typedef {Object} PrintJobResult
 * @property {number} printed
 * @property {number} failed
 * @property {Array<{ index: number, error: string }>} errors
 * @property {FormattedLabel[]} labels
 */

/**
 * @typedef {Object} PrintEngine
 * @property {string} name
 * @property {() => boolean} isConnected
 * @property {() => Promise<void>} [connect]
 * @property {() => Promise<void>} [disconnect]
 * @property {(labels: FormattedLabel[], options?: LabelRenderOptions & {
 *   onProgress?: (p: PrintProgress) => void
 * }) => Promise<PrintJobResult>} print
 */

/**
 * @param {FormattedLabel[]} labels
 * @param {Array<{ index: number, error: string }>} errors
 * @returns {PrintJobResult}
 */
export function makePrintResult(labels, errors = []) {
  return {
    printed: labels.length - errors.length,
    failed: errors.length,
    errors,
    labels,
  };
}
