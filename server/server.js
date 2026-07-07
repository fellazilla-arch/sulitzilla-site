/**
 * Prices API for sulitzilla.com (DigitalOcean or local).
 * GET /api/prices → fetches Grist table, returns [{ code, price }, ...].
 * GET /api/inventory → available Pixel units [{ model, storage, color, condition, grade, availability, hasIssue }, ...].
 * Grist data is cached server-side and refreshed daily at 6pm (Asia/Manila) on the server.
 * Manual sync: POST /api/admin/sync?key=YOUR_GRIST_SYNC_SECRET (set in server/.env).
 *
 * Env vars: GRIST_API_KEY, GRIST_DOC_ID, GRIST_TABLE. Optional: GRIST_BASE (default grist.sulitzilla.com/api).
 * Local: copy server/.env.example to server/.env and run: cd server && npm install && npm start
 * Then open the site on http://localhost:5500; it will call http://localhost:5500/api/prices.
 */
const express = require('express');
const path = require('path');
const app = express();

// Load .env when present (e.g. local dev). override: true so values in server/.env
// win over empty or stale GRIST_* vars already set in the shell (dotenv default is false).
try {
  require('dotenv').config({ path: path.join(__dirname, '.env'), override: true });
} catch (_) {}

const GRIST_BASE = (process.env.GRIST_BASE || 'https://grist.sulitzilla.com/api').trim();
const PORT = process.env.PORT || 5500;
const GRIST_SYNC_TIMEZONE = (process.env.GRIST_SYNC_TIMEZONE || 'Asia/Manila').trim();
const GRIST_SYNC_HOUR = Number(process.env.GRIST_SYNC_HOUR ?? 18);
const GRIST_SYNC_MINUTE = Number(process.env.GRIST_SYNC_MINUTE ?? 0);
const GRIST_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const gristCache = {
  records: null,
  fetchedAt: 0,
  refreshPromise: null,
};

function getZonedParts(date, timeZone) {
  const parts = {};
  new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .formatToParts(date)
    .forEach(function (part) {
      if (part.type !== 'literal') parts[part.type] = Number(part.value);
    });
  return parts;
}

function utcFromZonedParts(year, month, day, hour, minute, second, timeZone) {
  let utc = Date.UTC(year, month - 1, day, hour, minute, second || 0);
  for (let i = 0; i < 4; i++) {
    const zoned = getZonedParts(new Date(utc), timeZone);
    const asUtc = Date.UTC(
      zoned.year,
      zoned.month - 1,
      zoned.day,
      zoned.hour,
      zoned.minute,
      zoned.second
    );
    const wanted = Date.UTC(year, month - 1, day, hour, minute, second || 0);
    utc += wanted - asUtc;
  }
  return utc;
}

function msUntilNextScheduledSync() {
  const now = Date.now();
  const zoned = getZonedParts(new Date(now), GRIST_SYNC_TIMEZONE);
  let target = utcFromZonedParts(
    zoned.year,
    zoned.month,
    zoned.day,
    GRIST_SYNC_HOUR,
    GRIST_SYNC_MINUTE,
    0,
    GRIST_SYNC_TIMEZONE
  );
  if (target <= now) {
    const tomorrow = getZonedParts(new Date(now + 24 * 60 * 60 * 1000), GRIST_SYNC_TIMEZONE);
    target = utcFromZonedParts(
      tomorrow.year,
      tomorrow.month,
      tomorrow.day,
      GRIST_SYNC_HOUR,
      GRIST_SYNC_MINUTE,
      0,
      GRIST_SYNC_TIMEZONE
    );
  }
  return Math.max(0, target - now);
}

function formatNextSyncInTimeZone(timestamp) {
  return new Date(timestamp).toLocaleString('en-PH', {
    timeZone: GRIST_SYNC_TIMEZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function isGristCacheFresh() {
  return (
    Array.isArray(gristCache.records) &&
    gristCache.fetchedAt > 0 &&
    Date.now() - gristCache.fetchedAt < GRIST_CACHE_MAX_AGE_MS
  );
}

function isAuthorizedSync(req) {
  const secret = envTrim('GRIST_SYNC_SECRET');
  if (!secret) {
    return req.query.refresh === '1';
  }
  const key = String(req.query.key || req.get('x-sync-key') || '').trim();
  return key === secret;
}

function wantsForceSync(req) {
  return req.query.refresh === '1' && isAuthorizedSync(req);
}

async function refreshGristCache(force) {
  if (!force && isGristCacheFresh()) {
    return gristCache.records;
  }
  if (gristCache.refreshPromise) {
    return gristCache.refreshPromise;
  }

  gristCache.refreshPromise = fetchGristRecords()
    .then(function (records) {
      gristCache.records = records;
      gristCache.fetchedAt = Date.now();
      console.log('[Grist] prices and stock synced at', new Date(gristCache.fetchedAt).toISOString());
      return records;
    })
    .catch(function (err) {
      if (gristCache.records) {
        console.warn('[Grist] sync failed; serving previous cache', err.message);
        return gristCache.records;
      }
      throw err;
    })
    .finally(function () {
      gristCache.refreshPromise = null;
    });

  return gristCache.refreshPromise;
}

async function getGristRecords(force) {
  if (!force && isGristCacheFresh()) {
    return gristCache.records;
  }
  return refreshGristCache(force);
}

function scheduleDailyGristSync() {
  function queueNext() {
    const delay = msUntilNextScheduledSync();
    const nextAt = Date.now() + delay;
    console.log(
      '[Grist] next scheduled sync at',
      formatNextSyncInTimeZone(nextAt),
      '(' + GRIST_SYNC_TIMEZONE + ')'
    );
    setTimeout(function () {
      refreshGristCache(true).catch(function (err) {
        console.error('[Grist] scheduled sync failed', err.message);
      });
      queueNext();
    }, delay);
  }
  queueNext();
}

function envTrim(name) {
  const v = process.env[name];
  return v == null || v === '' ? '' : String(v).trim();
}

function mapRecord(fields) {
  const rawCode = fields.CODE ?? fields.Code ?? fields.code ?? '';
  const code = rawCode == null || rawCode === '' ? '' : String(rawCode).trim();
  let price = fields.PRICES ?? fields.Price ?? fields.price ?? null;
  if (price !== null && price !== undefined && price !== '') {
    const n = Number(price);
    if (!Number.isNaN(n) && n > 0) price = n;
    else price = null;
  }
  return { code, price };
}

const INVENTORY_ALLOWED_STATUSES = new Set([
  'LIVE',
  'ARRIVED',
  'AIR KANGO',
  'OTW KANGO',
  'AWAITING TRACKING',
]);

const INVENTORY_STATUS_LABELS = {
  LIVE: 'In Stock',
  ARRIVED: 'In Stock',
  'AIR KANGO': 'Arriving in 1–2 weeks',
  'OTW KANGO': 'Arriving in 2–3 weeks',
  'AWAITING TRACKING': 'Arriving in 3–4 weeks',
};

function cleanModelName(name) {
  let raw = name;
  if (Array.isArray(name)) {
    raw =
      name.find((x) => String(x).trim().length > 1 && !/^[A-Za-z]$/.test(String(x).trim())) ||
      name[name.length - 1] ||
      name[0];
  }
  const s = String(raw || '').trim();
  return s.replace(/^[A-Za-z],\s*/, '').replace(/^[A-Za-z],/, '');
}

function mapInventoryRecord(fields) {
  const category = String(fields.CATEGORY ?? '').trim().toUpperCase();
  if (category !== 'PHONES') return null;
  if (fields.DO_NOT_COUNT) return null;

  const notes = String(fields.NOTES ?? '').trim();
  if (/reserved/i.test(notes)) return null;

  const statusRaw = String(fields.STATUS ?? '').trim().toUpperCase();
  if (!INVENTORY_ALLOWED_STATUSES.has(statusRaw)) return null;

  const model = cleanModelName(fields.MODEL_PRODUCT ?? fields.MODEL ?? '');
  if (!model || !/^Pixel/i.test(model)) return null;

  const grade = String(fields.GRADE ?? '').trim();
  const hasIssue = /issue/i.test(grade);

  return {
    model,
    storage: String(fields.STORAGE ?? '').trim(),
    color: String(fields.COLOR_FLAVOR ?? '').trim(),
    condition: String(fields.CONDITION ?? '').trim(),
    grade: grade || null,
    availability: INVENTORY_STATUS_LABELS[statusRaw],
    hasIssue,
  };
}

async function fetchGristRecords() {
  const apiKey = envTrim('GRIST_API_KEY');
  const docId = envTrim('GRIST_DOC_ID');
  const tableId = envTrim('GRIST_TABLE') || envTrim('GRIST_TABLE_ID');

  if (!apiKey || !docId || !tableId) {
    const err = new Error('Missing Grist config');
    err.config = { need: ['GRIST_API_KEY', 'GRIST_DOC_ID', 'GRIST_TABLE'] };
    throw err;
  }

  const url = `${GRIST_BASE}/docs/${docId}/tables/${encodeURIComponent(tableId)}/records`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!r.ok) {
    const text = await r.text();
    const err = new Error('Grist request failed');
    err.status = r.status;
    err.body = text.slice(0, 200);
    throw err;
  }

  const data = await r.json();
  return Array.isArray(data?.records) ? data.records : [];
}

function sendGristError(res, err, label) {
  console.error(`[Grist ${label}]`, err.message, err.cause || '');
  if (err.config) {
    return res.status(500).json({ error: err.message, ...err.config });
  }
  if (err.status) {
    return res.status(err.status).json({ error: err.message, body: err.body });
  }
  return res.status(500).json({
    error: err.message,
    cause: err.cause ? String(err.cause) : undefined,
  });
}

app.get('/api/prices', async (req, res) => {
  try {
    const force = wantsForceSync(req);
    const records = await getGristRecords(force);
    const list = records.map((rec) => mapRecord(rec.fields || {}));
    res.set('Access-Control-Allow-Origin', '*');
    res.json(list);
  } catch (err) {
    sendGristError(res, err, '/api/prices');
  }
});

app.get('/api/inventory', async (req, res) => {
  try {
    const force = wantsForceSync(req);
    const records = await getGristRecords(force);
    const list = records
      .map((rec) => mapInventoryRecord(rec.fields || {}))
      .filter(Boolean);
    res.set('Access-Control-Allow-Origin', '*');
    res.json(list);
  } catch (err) {
    sendGristError(res, err, '/api/inventory');
  }
});

async function handleAdminSync(req, res) {
  if (!isAuthorizedSync(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const records = await refreshGristCache(true);
    res.json({
      ok: true,
      syncedAt: gristCache.fetchedAt,
      syncedAtLocal: formatNextSyncInTimeZone(gristCache.fetchedAt),
      recordCount: records.length,
      nextScheduledSyncAt: Date.now() + msUntilNextScheduledSync(),
      nextScheduledSyncAtLocal: formatNextSyncInTimeZone(Date.now() + msUntilNextScheduledSync()),
    });
  } catch (err) {
    sendGristError(res, err, '/api/admin/sync');
  }
}

app.get('/api/admin/sync', handleAdminSync);
app.post('/api/admin/sync', handleAdminSync);

// Product thumbnails are small and rarely change — cache aggressively in the browser.
app.use(
  '/images',
  express.static(path.join(__dirname, '..', 'images'), {
    maxAge: '30d',
    etag: true
  })
);

// Serve the static site (index.html, script.js, etc.) from the project root.
app.use(express.static(path.join(__dirname, '..')));

app.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}`);
  console.log(`  Price list (live at sulitzilla.com): http://localhost:${PORT}/`);
  console.log(`  New site (WIP, local dev):          http://localhost:${PORT}/site/`);
  console.log(`  Grist auto-sync:                    daily at ${GRIST_SYNC_HOUR}:${String(GRIST_SYNC_MINUTE).padStart(2, '0')} ${GRIST_SYNC_TIMEZONE}`);
  if (envTrim('GRIST_SYNC_SECRET')) {
    console.log('  Manual sync:                        GET/POST /api/admin/sync?key=…');
  } else {
    console.warn('  GRIST_SYNC_SECRET not set — manual sync via ?refresh=1 is open (set secret before deploy)');
  }

  refreshGristCache(true).catch(function (err) {
    console.error('[Grist] initial sync failed', err.message);
  });
  scheduleDailyGristSync();
});
