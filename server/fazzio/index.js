/**
 * Private Fazzio financing proposal API.
 *   GET   /api/fazzio/config                 public pricing config for the buyer page
 *   POST  /api/fazzio/proposals              buyer submits a plan (re-priced server-side)
 *   GET   /api/fazzio/admin/proposals        seller review list            (x-admin-key)
 *   PATCH /api/fazzio/admin/proposals/:id    status / seller note           (x-admin-key)
 *   GET   /api/fazzio/admin/config           full config                    (x-admin-key)
 *   PUT   /api/fazzio/admin/config           save config                    (x-admin-key)
 *   DELETE /api/fazzio/admin/config          reset to defaults              (x-admin-key)
 *
 * Env: FAZZIO_ADMIN_KEY (admin endpoints are disabled when unset). Optional FAZZIO_DATA_DIR.
 * Data lives outside git (server/.data/fazzio by default) so deploys (git reset --hard) keep it.
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Pricing = require('../../fazzio/pricing.js');

const DATA_DIR = process.env.FAZZIO_DATA_DIR || path.join(__dirname, '..', '.data', 'fazzio');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const PROPOSALS_FILE = path.join(DATA_DIR, 'proposals.json');
const MAX_PROPOSALS = 500;
const SUBMIT_LIMIT_PER_HOUR = 10;
const STATUSES = ['pending', 'approved', 'countered', 'declined', 'withdrawn'];

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function loadConfig() {
  return Pricing.mergeConfig(readJson(CONFIG_FILE, {}));
}

function loadProposals() {
  const list = readJson(PROPOSALS_FILE, []);
  return Array.isArray(list) ? list : [];
}

function adminKey() {
  return String(process.env.FAZZIO_ADMIN_KEY || '').trim();
}

function requireAdmin(req, res, next) {
  const key = adminKey();
  if (!key) return res.status(503).json({ error: 'Admin is disabled. Set FAZZIO_ADMIN_KEY in server/.env.' });
  const given = String(req.get('x-admin-key') || '');
  const a = Buffer.from(given);
  const b = Buffer.from(key);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'Wrong admin key.' });
  }
  next();
}

function cleanText(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

function makeReference() {
  const d = new Date();
  const ymd = d.toISOString().slice(2, 10).replace(/-/g, '');
  return 'FZ-' + ymd + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();
}

const submitLog = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const recent = (submitLog.get(ip) || []).filter((t) => now - t < 3600000);
  if (recent.length >= SUBMIT_LIMIT_PER_HOUR) {
    submitLog.set(ip, recent);
    return true;
  }
  recent.push(now);
  submitLog.set(ip, recent);
  return false;
}

function createRouter() {
  const router = express.Router();
  router.use(express.json({ limit: '32kb' }));
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Robots-Tag', 'noindex, nofollow');
    next();
  });

  router.get('/config', (req, res) => {
    res.json(loadConfig());
  });

  router.post('/proposals', (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (rateLimited(ip)) return res.status(429).json({ error: 'Too many submissions. Please try again later.' });

    const body = req.body || {};
    const buyer = {
      name: cleanText(body.buyer && body.buyer.name, 120),
      contact: cleanText(body.buyer && body.buyer.contact, 160),
      message: cleanText(body.buyer && body.buyer.message, 2000),
    };
    if (!buyer.name || !buyer.contact) {
      return res.status(400).json({ error: 'Please enter your name and a contact number or Messenger name.' });
    }
    if (body.acknowledged !== true) {
      return res.status(400).json({ error: 'Please tick the acknowledgment box before submitting.' });
    }

    const cfg = loadConfig();
    const input = {
      mode: body.input && body.input.mode === 'term' ? 'term' : 'monthly',
      downPayment: body.input && body.input.downPayment,
      monthlyPayment: body.input && body.input.monthlyPayment,
      termMonths: body.input && body.input.termMonths,
      handoverDate: body.input && body.input.handoverDate,
    };
    const result = Pricing.buildPlan(cfg, input);
    if (!result.plan) {
      return res.status(400).json({ error: 'That plan could not be calculated.', issues: result.issues });
    }

    const proposals = loadProposals();
    if (proposals.length >= MAX_PROPOSALS) {
      return res.status(507).json({ error: 'The proposal inbox is full. Please message the seller directly.' });
    }
    const proposal = {
      id: crypto.randomUUID(),
      reference: makeReference(),
      submittedAt: new Date().toISOString(),
      status: 'pending',
      sellerNote: '',
      buyer,
      input,
      withinTerms: result.withinTerms,
      issues: result.issues.map((i) => i.message),
      plan: result.plan,
      pricingSnapshot: {
        cashPrice: cfg.cashPrice,
        premiumTiers: cfg.premiumTiers,
        minDownPayment: cfg.minDownPayment,
        minMonthlyPayment: cfg.minMonthlyPayment,
        maxTermMonths: cfg.maxTermMonths,
        lateFees: cfg.lateFees,
        defaultRules: cfg.defaultRules,
      },
      userAgent: cleanText(req.get('user-agent'), 300),
    };
    proposals.unshift(proposal);
    writeJson(PROPOSALS_FILE, proposals);
    console.log('[Fazzio] proposal', proposal.reference, 'from', buyer.name, result.withinTerms ? '' : '(outside terms)');
    res.status(201).json({
      reference: proposal.reference,
      submittedAt: proposal.submittedAt,
      withinTerms: proposal.withinTerms,
      plan: proposal.plan,
    });
  });

  router.get('/admin/proposals', requireAdmin, (req, res) => {
    res.json(loadProposals());
  });

  router.patch('/admin/proposals/:id', requireAdmin, (req, res) => {
    const proposals = loadProposals();
    const p = proposals.find((x) => x.id === req.params.id);
    if (!p) return res.status(404).json({ error: 'Proposal not found.' });
    const body = req.body || {};
    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status)) return res.status(400).json({ error: 'Unknown status.' });
      p.status = body.status;
    }
    if (body.sellerNote !== undefined) p.sellerNote = cleanText(body.sellerNote, 4000);
    p.updatedAt = new Date().toISOString();
    writeJson(PROPOSALS_FILE, proposals);
    res.json(p);
  });

  router.delete('/admin/proposals/:id', requireAdmin, (req, res) => {
    const proposals = loadProposals();
    const next = proposals.filter((x) => x.id !== req.params.id);
    if (next.length === proposals.length) return res.status(404).json({ error: 'Proposal not found.' });
    writeJson(PROPOSALS_FILE, next);
    res.json({ ok: true });
  });

  router.get('/admin/config', requireAdmin, (req, res) => {
    res.json({ config: loadConfig(), defaults: Pricing.DEFAULT_CONFIG });
  });

  router.put('/admin/config', requireAdmin, (req, res) => {
    const merged = Pricing.mergeConfig(req.body || {});
    const errors = Pricing.validateConfig(merged);
    if (errors.length) return res.status(400).json({ error: 'Some settings need fixing.', errors });
    writeJson(CONFIG_FILE, merged);
    res.json({ config: merged });
  });

  router.delete('/admin/config', requireAdmin, (req, res) => {
    try {
      fs.unlinkSync(CONFIG_FILE);
    } catch (_) {}
    res.json({ config: loadConfig() });
  });

  return router;
}

module.exports = { createRouter };
