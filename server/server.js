/**
 * Prices API for sulitzilla.com (DigitalOcean or local).
 * GET /api/prices → fetches Grist table, returns [{ code, price }, ...].
 *
 * Env vars: GRIST_API_KEY, GRIST_DOC_ID, GRIST_TABLE. Optional: GRIST_BASE (default grist.sulitzilla.com/api).
 * Local: copy server/.env.example to server/.env and run: cd server && npm install && npm start
 * Then open the site on http://localhost:5500; it will call http://localhost:5500/api/prices.
 */
const express = require('express');
const path = require('path');
const app = express();

// Load .env when present (e.g. local dev)
try {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch (_) {}

const GRIST_BASE = process.env.GRIST_BASE || 'https://grist.sulitzilla.com/api';
const PORT = process.env.PORT || 5500;

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

app.get('/api/prices', async (req, res) => {
  const apiKey = process.env.GRIST_API_KEY;
  const docId = process.env.GRIST_DOC_ID;
  const tableId = process.env.GRIST_TABLE || process.env.GRIST_TABLE_ID;

  if (!apiKey || !docId || !tableId) {
    return res.status(500).json({
      error: 'Missing Grist config',
      need: ['GRIST_API_KEY', 'GRIST_DOC_ID', 'GRIST_TABLE'],
    });
  }

  const url = `${GRIST_BASE}/docs/${docId}/tables/${encodeURIComponent(tableId)}/records`;

  try {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: 'Grist request failed', body: text.slice(0, 200) });
    }

    const data = await r.json();
    const records = Array.isArray(data?.records) ? data.records : [];
    const list = records.map((rec) => mapRecord(rec.fields || {}));

    res.set('Access-Control-Allow-Origin', '*');
    res.json(list);
  } catch (err) {
    console.error('[Grist /api/prices]', err.message, err.cause || '');
    res.status(500).json({
      error: err.message,
      cause: err.cause ? String(err.cause) : undefined,
    });
  }
});

// Serve the static site (index.html, script.js, etc.) from the project root.
app.use(express.static(path.join(__dirname, '..')));

app.listen(PORT, () => {
  console.log(`Site + prices API listening on http://localhost:${PORT}`);
});
