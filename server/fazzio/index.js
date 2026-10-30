/**
 * Fazzio payment tracker storage (seller only).
 *   GET /api/fazzio/ledger   → saved ledger or null   (x-admin-key)
 *   PUT /api/fazzio/ledger   → replace ledger          (x-admin-key)
 *
 * Env: FAZZIO_ADMIN_KEY (endpoints are disabled when unset). Optional FAZZIO_DATA_DIR.
 * Data lives outside git (server/.data/fazzio) so deploys (git reset --hard) keep it.
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.FAZZIO_DATA_DIR || path.join(__dirname, '..', '.data', 'fazzio');
const LEDGER_FILE = path.join(DATA_DIR, 'ledger.json');
const BACKUP_COUNT = 20;

function requireAdmin(req, res, next) {
  const key = String(process.env.FAZZIO_ADMIN_KEY || '').trim();
  if (!key) return res.status(503).json({ error: 'Admin is disabled. Set FAZZIO_ADMIN_KEY in server/.env.' });
  const a = Buffer.from(String(req.get('x-admin-key') || ''));
  const b = Buffer.from(key);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'Wrong password.' });
  }
  next();
}

/** Keeps the last few versions so an accidental edit can be recovered by hand. */
function backupCurrent() {
  if (!fs.existsSync(LEDGER_FILE)) return;
  const dir = path.join(DATA_DIR, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(LEDGER_FILE, path.join(dir, 'ledger-' + Date.now() + '.json'));
  const old = fs.readdirSync(dir).filter((f) => f.startsWith('ledger-')).sort();
  old.slice(0, Math.max(0, old.length - BACKUP_COUNT)).forEach((f) => fs.unlinkSync(path.join(dir, f)));
}

function createRouter() {
  const router = express.Router();
  router.use(express.json({ limit: '256kb' }));
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Robots-Tag', 'noindex, nofollow');
    next();
  });

  router.get('/ledger', requireAdmin, (req, res) => {
    try {
      res.json(JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf8')));
    } catch (_) {
      res.json(null);
    }
  });

  router.put('/ledger', requireAdmin, (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || !Array.isArray(body.rows) || body.rows.length > 120) {
      return res.status(400).json({ error: 'Invalid ledger.' });
    }
    body.updatedAt = new Date().toISOString();
    fs.mkdirSync(DATA_DIR, { recursive: true });
    backupCurrent();
    const tmp = LEDGER_FILE + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(body, null, 2));
    fs.renameSync(tmp, LEDGER_FILE);
    res.json({ ok: true, updatedAt: body.updatedAt });
  });

  return router;
}

module.exports = { createRouter };
