# Run the site and prices API locally (localhost:5500 + 3001)

## 1. Start the prices API (port 3001)

```bash
cd server
cp .env.example .env
# Edit .env: set GRIST_API_KEY, GRIST_DOC_ID, GRIST_TABLE (see GRIST_PUBLIC_SITE_GUIDE.md)
npm install
npm start
```

Leave this running. You should see: `Prices API listening on port 3001`.

## 2. Serve the site (port 5500)

From the **project root** (sulitzilla-site), not inside `server/`:

```bash
python3 -m http.server 5500
```

Or use Live Server in VS Code / Cursor and set the port to 5500.

## 3. Open the site

In your browser go to: **http://localhost:5500**

The page will load prices from **http://localhost:3001/api/prices** automatically (no change needed in the code). If the API is running and your `.env` has the right Grist keys, you should see real prices for any variant that has a `code` in script.js (e.g. B1113 → ₱7,990).

## Troubleshooting

- **Still “Set price”** – Open DevTools → Network, reload, and check the request to `localhost:3001/api/prices`. If it fails (CORS, 404, 500), fix the API or env vars. If it returns JSON, check that it includes `{ "code": "B1113", "price": 7990 }` (or similar).
- **CORS** – The API sends `Access-Control-Allow-Origin: *`, so localhost:5500 can call localhost:3001.
