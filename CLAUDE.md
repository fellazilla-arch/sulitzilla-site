# sulitzilla.com website

Static pages at the repo root (`index.html`, `script.js`, `styles.css`, price list in `prices/`) plus one Node server in `server/` that serves the site and the Grist prices API.
The browser never talks to Grist; the server holds the key and returns prices by `CODE`.

- Run locally: `cd server && npm install && npm start`. Details: `LOCAL.md`, `GRIST.md`, `DEPLOY.md`.
- A push to `main` deploys the live site through GitHub Actions. When Dru says deploy or ship: `/deploy`.
- Do not create Asana tasks for anything in this repo, including Fazzio price or rate changes.
- A price-list change: follow `/price-change` so Shopee and Lazada match — still with no Asana task.
- Never read or print `server/.env`.
