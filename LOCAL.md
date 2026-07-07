# Run locally

One Node server serves the price list, the WIP site at `/site`, and the Grist prices API.

## Start

```bash
cd server
cp .env.example .env   # first time only — set GRIST_API_KEY, GRIST_DOC_ID, GRIST_TABLE
npm install            # first time only
npm start
```

Default port is **5500** (not 3000). Override with `PORT=5501 npm start` if 5500 is busy.

## URLs

| Page | URL |
|------|-----|
| **Pixel price list** (same as live sulitzilla.com) | http://localhost:5500/ |
| **New site** (work in progress) | http://localhost:5500/site/ |
| **Prices API** | http://localhost:5500/api/prices |
| **Inventory API** | http://localhost:5500/api/inventory |

## Grist sync (prices + stock)

**Automatic (deployed site):** The Node server syncs from Grist **once per day at 6:00 PM** (`Asia/Manila`). This runs on your **hosting server** (e.g. DigitalOcean) — your computer does **not** need to be on. The server only needs to stay running (or restart and sync on boot, then schedule the next 6pm).

**Manual sync (you only):** Set `GRIST_SYNC_SECRET` in `server/.env`, then either:

- **API (bookmark or curl):** `https://yoursite.com/api/admin/sync?key=YOUR_SECRET` — returns JSON confirming sync time and record count.
- **Price list UI:** `https://yoursite.com/?refresh=1&key=YOUR_SECRET` — shows **Refresh prices & stock** (hidden from normal visitors).

Without the secret, `?refresh=1` alone does not force a server sync.

Prices and stock also cache in the browser only as an offline fallback; each visit fetches fresh data from the server.

## Production vs local

- **sulitzilla.com/** stays the price list until you deliberately switch the homepage.
- **/site/** is a preview area for the full site; it has `noindex` so search engines shouldn’t pick it up if it’s deployed early.

## Troubleshooting

- **“Set price” / empty models** — Check http://localhost:5500/api/prices returns JSON, not an error. Confirm `server/.env` Grist keys.
- **Port in use** — `PORT=5501 npm start` or stop the other process on 5500.
