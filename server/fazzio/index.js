/**
 * Fazzio payment tracker and agreement storage.
 *   GET  /api/fazzio/ledger                  → saved ledger or null                  (x-admin-key)
 *   PUT  /api/fazzio/ledger                  → replace ledger                         (x-admin-key)
 *   GET  /api/fazzio/status                  → buyer's view of the ledger (public; no name or notes)
 *
 *   GET  /api/fazzio/agreement               → full agreement record                  (x-admin-key)
 *   PUT  /api/fazzio/agreement               → { details, open } (locked once signed)  (x-admin-key)
 *   POST /api/fazzio/agreement/code          → new private signing code               (x-admin-key)
 *   POST /api/fazzio/agreement/countersign   → { name, image }                        (x-admin-key)
 *   POST /api/fazzio/agreement/reset         → clear both signatures                  (x-admin-key)
 *   GET  /api/fazzio/agreement/status        → { open, buyerSignedAt, sellerSignedAt } (public)
 *   GET  /api/fazzio/agreement/view?code=    → details + signatures                   (signing code)
 *   POST /api/fazzio/agreement/sign          → { code, buyer, typedName, image, consent, textHash } (signing code)
 *
 * Env: FAZZIO_ADMIN_KEY (admin endpoints are disabled when unset). Optional FAZZIO_DATA_DIR.
 * Data lives outside git (server/.data/fazzio) so deploys (git reset --hard) keep it.
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Agreement = require('../../fazzio/agreement.js');

const DATA_DIR = process.env.FAZZIO_DATA_DIR || path.join(__dirname, '..', '.data', 'fazzio');
const LEDGER_FILE = path.join(DATA_DIR, 'ledger.json');
const AGREEMENT_FILE = path.join(DATA_DIR, 'agreement.json');
const BACKUP_COUNT = 20;
const MAX_SIGNATURE_CHARS = 400000;

function requireAdmin(req, res, next) {
  const key = String(process.env.FAZZIO_ADMIN_KEY || '').trim();
  if (!key) return res.status(503).json({ error: 'Admin is disabled. Set FAZZIO_ADMIN_KEY in server/.env.' });
  if (!safeEqual(req.get('x-admin-key'), key)) return res.status(401).json({ error: 'Wrong password.' });
  next();
}

function safeEqual(given, expected) {
  const a = Buffer.from(String(given || ''));
  const b = Buffer.from(String(expected || ''));
  return a.length === b.length && b.length > 0 && crypto.timingSafeEqual(a, b);
}

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return null;
  }
}

/** Atomic write that keeps the last few versions so an accidental change can be recovered by hand. */
function writeJSON(file, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const base = path.basename(file, '.json');
  if (fs.existsSync(file)) {
    const dir = path.join(DATA_DIR, 'backups');
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(file, path.join(dir, base + '-' + Date.now() + '.json'));
    const old = fs.readdirSync(dir).filter((f) => f.startsWith(base + '-')).sort();
    old.slice(0, Math.max(0, old.length - BACKUP_COUNT)).forEach((f) => fs.unlinkSync(path.join(dir, f)));
  }
  const tmp = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function readAgreement() {
  return readJSON(AGREEMENT_FILE) || { details: {}, open: false, code: null };
}

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function clientIp(req) {
  return String(req.get('x-forwarded-for') || '').split(',')[0].trim() || req.socket.remoteAddress || '';
}

function validSignatureImage(img) {
  return typeof img === 'string' && img.startsWith('data:image/png;base64,') && img.length < MAX_SIGNATURE_CHARS;
}

function cleanFields(src, fields) {
  const out = {};
  fields.forEach((f) => {
    const v = src && src[f.key];
    out[f.key] = f.key === 'dueDay' ? Math.max(0, Math.min(28, Number(v) || 0)) : String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, 300);
  });
  return out;
}

function newCode() {
  return crypto.randomBytes(8).toString('hex');
}

function createRouter() {
  const router = express.Router();
  router.use(express.json({ limit: '1mb' }));
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Robots-Tag', 'noindex, nofollow');
    next();
  });

  // ---------- payment ledger ----------

  router.get('/ledger', requireAdmin, (req, res) => {
    res.json(readJSON(LEDGER_FILE));
  });

  router.get('/status', (req, res) => {
    const l = readJSON(LEDGER_FILE);
    if (!l || !Array.isArray(l.rows)) return res.json(null);
    const pick = (o, keys) => keys.reduce((out, k) => ((out[k] = o[k]), out), {});
    res.json({
      ...pick(l, ['downPayment', 'monthlyPayment', 'borrowed', 'interest', 'months', 'monthlyRatePct', 'total',
        'handoverDate', 'dueDay', 'updatedAt']),
      rows: l.rows.map((r) => pick(r, ['number', 'dueDate', 'amountDue', 'paidAmount', 'paidDate', 'daysLateOverride',
        'penaltyWaived', 'penaltyPaid'])),
      extraPayments: (l.extraPayments || []).map((x) => pick(x, ['date', 'amount'])),
    });
  });

  router.put('/ledger', requireAdmin, (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || !Array.isArray(body.rows) || body.rows.length > 120 ||
        (body.extraPayments !== undefined && (!Array.isArray(body.extraPayments) || body.extraPayments.length > 200))) {
      return res.status(400).json({ error: 'Invalid ledger.' });
    }
    body.updatedAt = new Date().toISOString();
    writeJSON(LEDGER_FILE, body);
    res.json({ ok: true, updatedAt: body.updatedAt });
  });

  // ---------- agreement ----------

  router.get('/agreement', requireAdmin, (req, res) => {
    res.json(readAgreement());
  });

  router.put('/agreement', requireAdmin, (req, res) => {
    const a = readAgreement();
    const body = req.body || {};
    if (body.details !== undefined) {
      if (a.buyerSignature) return res.status(409).json({ error: 'The buyer has already signed. Reset the signatures before changing the details.' });
      a.details = cleanFields(body.details, Agreement.DETAIL_FIELDS);
    }
    if (body.open !== undefined) {
      if (body.open && Agreement.missingDetails(a.details).length) {
        return res.status(400).json({ error: 'Fill in every detail before opening the agreement for signing.' });
      }
      a.open = !!body.open;
    }
    if (!a.code) a.code = newCode();
    a.updatedAt = new Date().toISOString();
    writeJSON(AGREEMENT_FILE, a);
    res.json(a);
  });

  router.post('/agreement/code', requireAdmin, (req, res) => {
    const a = readAgreement();
    a.code = newCode();
    writeJSON(AGREEMENT_FILE, a);
    res.json(a);
  });

  router.post('/agreement/reset', requireAdmin, (req, res) => {
    const a = readAgreement();
    delete a.buyer;
    delete a.buyerSignature;
    delete a.sellerSignature;
    delete a.signedText;
    a.open = false;
    writeJSON(AGREEMENT_FILE, a);
    res.json(a);
  });

  router.post('/agreement/countersign', requireAdmin, (req, res) => {
    const a = readAgreement();
    const { name, image } = req.body || {};
    if (!a.buyerSignature) return res.status(409).json({ error: 'The buyer hasn’t signed yet.' });
    if (a.sellerSignature) return res.status(409).json({ error: 'Already countersigned.' });
    if (!String(name || '').trim() || !validSignatureImage(image)) return res.status(400).json({ error: 'Type your name and draw your signature.' });
    a.sellerSignature = {
      typedName: String(name).replace(/\s+/g, ' ').trim().slice(0, 200),
      image,
      signedAt: new Date().toISOString(),
      ip: clientIp(req),
      userAgent: String(req.get('user-agent') || '').slice(0, 300),
      textHash: a.buyerSignature.textHash,
    };
    writeJSON(AGREEMENT_FILE, a);
    res.json(a);
  });

  router.get('/agreement/status', (req, res) => {
    const a = readAgreement();
    res.json({
      open: !!a.open,
      buyerSignedAt: a.buyerSignature ? a.buyerSignature.signedAt : null,
      sellerSignedAt: a.sellerSignature ? a.sellerSignature.signedAt : null,
    });
  });

  function requireCode(req, res, next) {
    const a = readAgreement();
    const code = req.method === 'GET' ? req.query.code : (req.body || {}).code;
    if (!a.code || !safeEqual(code, a.code)) return res.status(403).json({ error: 'This signing link isn’t valid. Ask the seller for the current link.' });
    req.agreement = a;
    next();
  }

  const publicSignature = (s) => s && { typedName: s.typedName, image: s.image, signedAt: s.signedAt, ip: s.ip, textHash: s.textHash };

  router.get('/agreement/view', requireCode, (req, res) => {
    const a = req.agreement;
    res.json({
      open: !!a.open,
      details: a.details || {},
      buyer: a.buyer || null,
      buyerSignature: publicSignature(a.buyerSignature),
      sellerSignature: publicSignature(a.sellerSignature),
      signedText: a.signedText || null,
    });
  });

  router.post('/agreement/sign', requireCode, (req, res) => {
    const a = req.agreement;
    const { buyer, typedName, image, consent, textHash } = req.body || {};
    if (a.buyerSignature) return res.status(409).json({ error: 'This agreement has already been signed.' });
    if (!a.open) return res.status(409).json({ error: 'The agreement isn’t open for signing yet.' });
    if (Agreement.missingDetails(a.details).length) return res.status(409).json({ error: 'The seller hasn’t finished filling in the agreement.' });
    const b = cleanFields(buyer, Agreement.BUYER_FIELDS);
    const missing = Agreement.missingBuyer(b);
    if (missing.length) return res.status(400).json({ error: 'Please fill in: ' + missing.join(', ') + '.' });
    const typed = String(typedName || '').replace(/\s+/g, ' ').trim();
    if (typed.toLowerCase() !== b.name.toLowerCase()) return res.status(400).json({ error: 'Type your full name exactly as entered above to sign.' });
    if (!validSignatureImage(image)) return res.status(400).json({ error: 'Please draw your signature.' });
    if (consent !== true) return res.status(400).json({ error: 'Please tick the box to confirm you agree.' });
    const text = Agreement.toText(a.details, b);
    const hash = sha256(text);
    if (textHash !== hash) return res.status(409).json({ error: 'The agreement changed while you were reading it. Reload the page and review it again.' });
    a.buyer = b;
    a.signedText = text;
    a.buyerSignature = {
      typedName: typed,
      image,
      signedAt: new Date().toISOString(),
      ip: clientIp(req),
      userAgent: String(req.get('user-agent') || '').slice(0, 300),
      textHash: hash,
    };
    a.open = false;
    writeJSON(AGREEMENT_FILE, a);
    res.json({ ok: true, signedAt: a.buyerSignature.signedAt, textHash: hash });
  });

  return router;
}

module.exports = { createRouter };
