/**
 * Netlify serverless function: fetches Pixel price list from a Grist table
 * and returns JSON for the frontend. Keeps your Grist API key server-side.
 *
 * Uses your self-hosted Grist at grist.sulitzilla.com (see GRIST_PUBLIC_SITE_GUIDE.md).
 *
 * Required environment variables (set in Netlify dashboard or .env):
 *   GRIST_API_KEY  - Same API key as in your Grist guide (keep secret)
 *   GRIST_DOC_ID   - Document ID (e.g. eEMaR9RHiD3r)
 *   GRIST_TABLE    - Table name/ID in that doc (e.g. "Pixel_Prices" or "Master_List")
 *   GRIST_BASE     - Optional; defaults to https://grist.sulitzilla.com/api
 *
 * Grist columns used: CODE, PRICES.
 * For each row, if PRICES is a positive number we return { code, price }.
 */
const GRIST_BASE = process.env.GRIST_BASE || 'https://grist.sulitzilla.com/api';

function headers(origin) {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
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

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: headers(event.headers?.origin), body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: headers(event.headers?.origin), body: '' };
  }

  const apiKey = process.env.GRIST_API_KEY;
  const docId = process.env.GRIST_DOC_ID;
  const tableId = process.env.GRIST_TABLE || process.env.GRIST_TABLE_ID;

  if (!apiKey || !docId || !tableId) {
    return {
      statusCode: 500,
      headers: headers(event.headers?.origin),
      body: JSON.stringify({
        error: 'Missing Grist config',
        need: ['GRIST_API_KEY', 'GRIST_DOC_ID', 'GRIST_TABLE or GRIST_TABLE_ID'],
      }),
    };
  }

  const url = `${GRIST_BASE}/docs/${docId}/tables/${encodeURIComponent(tableId)}/records`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        statusCode: res.status,
        headers: headers(event.headers?.origin),
        body: JSON.stringify({ error: 'Grist request failed', status: res.status, body: text }),
      };
    }

    const data = await res.json();
    const records = Array.isArray(data?.records) ? data.records : [];
    const list = records.map((r) => mapRecord(r.fields || {}));

    return {
      statusCode: 200,
      headers: headers(event.headers?.origin),
      body: JSON.stringify(list),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: headers(event.headers?.origin),
      body: JSON.stringify({ error: err.message }),
    };
  }
};
