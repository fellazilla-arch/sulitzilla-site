# Loading prices from Grist (sulitzilla.com + DigitalOcean)

The site loads Pixel prices from your Grist table by **CODE**. The browser never talks to Grist; your API (on DigitalOcean) holds the API key and returns `[{ code, price }, ...]`.

---

## 1. How it works

- In **script.js** you set a `code` on each variant (e.g. `code: 'B1113'` for Pixel 2 XL 64GB Used).
- Your **API** (see below) fetches the Grist table and returns every row as `{ code, price }` (using columns CODE and PRICES).
- The **frontend** matches by code and shows the price (e.g. ₱7,990 for B1113).

Grist table must have: **CODE** (e.g. B1113), **PRICES** (number). Other columns are ignored by this API.

---

## 2. Run the prices API on DigitalOcean

A small Node server is in **`server/`**. It exposes one route: **GET /api/prices** → JSON array of `{ code, price }`.

### Option A – Same app as your main site

If you already have a Node/Express app serving sulitzilla.com:

1. Copy the logic from `server/server.js` into your app (one route that fetches Grist and returns the list).
2. Or mount the Express app: `app.use(require('./server/server') );` (if you structure it that way).

Ensure the route is available as **https://sulitzilla.com/api/prices** (or the URL you set in `index.html`).

### Option B – Standalone server on a Droplet or App Platform

1. On your Droplet (or in a new App Platform service), clone or upload the repo and run:

   ```bash
   cd server
   npm install
   PORT=3001 node server.js
   ```

2. Set **environment variables** (same as your Grist guide):

   - `GRIST_API_KEY` – your Grist API key (keep secret)
   - `GRIST_DOC_ID` – e.g. `eEMaR9RHiD3r`
   - `GRIST_TABLE` – table with CODE + PRICES (e.g. `Master_List` or `MASTER_LIST`)
   - `GRIST_BASE` – optional; defaults to `https://grist.sulitzilla.com/api`

3. Point the **main site** (nginx or your reverse proxy) at this app so that:

   - **https://sulitzilla.com** → static site (index.html, script.js, etc.)
   - **https://sulitzilla.com/api/prices** → this Node server (proxy to the port where the server runs, e.g. 3001)

Example nginx proxy for `/api/prices`:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

---

## 3. Frontend (index.html)

The site is already set to call your domain:

```html
<script>window.GRIST_PRICES_URL = 'https://sulitzilla.com/api/prices';</script>
```

If your API lives elsewhere (e.g. `https://api.sulitzilla.com/prices`), change this URL.

---

## 4. Summary

| Item | Value |
|------|--------|
| **Grist** | Table with **CODE** and **PRICES** at `https://grist.sulitzilla.com/api` |
| **API** | `server/server.js` – GET /api/prices → `[{ code, price }, ...]` |
| **Env vars** | `GRIST_API_KEY`, `GRIST_DOC_ID`, `GRIST_TABLE` (optional: `GRIST_BASE`) |
| **Site** | `window.GRIST_PRICES_URL = 'https://sulitzilla.com/api/prices'` |

You edit **script.js** to add `code: 'Bxxxx'` to each variant; the site shows the price from Grist for that CODE.
