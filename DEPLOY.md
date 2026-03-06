# Getting sulitzilla.com live (DigitalOcean)

You need two things live: (1) the **site** (HTML/CSS/JS + the **prices** page), and (2) the **API** that fetches prices from Grist (`/api/prices`). The `server/` app does both: it serves the site and the API.

---

## Option A: DigitalOcean App Platform (simplest)

1. **Push your code to GitHub** (if you haven’t already).  
   Repo should contain: `index.html`, `prices/`, `styles.css`, `script.js`, `server/`, etc.

2. **In DigitalOcean:** [Apps](https://cloud.digitalocean.com/apps) → **Create App** → choose **GitHub** and select the `sulitzilla-site` repo.

3. **Configure the app (Node):**
   - **Source:** branch (e.g. `main`). Leave **Source Directory** empty (repo root).

   - **Build Command:** `cd server && npm install`
   - **Run Command:** `npm start`
   - **HTTP Port:** `5500` (or set `PORT` in env). The app serves the repo root (home + `/prices`) and `/api/prices`.


4. **Environment variables** (App → Settings → App-Level Env Vars):
   - `GRIST_API_KEY` = your Grist API key  
   - `GRIST_DOC_ID` = e.g. `eEMaR9RHiD3r`  
   - `GRIST_TABLE` = e.g. `Master_List`  
   - `PORT` = `5500` (or leave unset if your code defaults to 5500)

5. **Domain:** In the app, add a domain: `sulitzilla.com` (and optionally `www.sulitzilla.com`). DigitalOcean will show you the CNAME or A record to add at your DNS provider. Point the domain there.

6. **Deploy.** After deploy, open `https://sulitzilla.com` (home) and `https://sulitzilla.com/prices` (price list). The API will be `https://sulitzilla.com/api/prices`.

---

## Option B: Droplet (VPS) + Node + PM2

1. **Create a Droplet** (Ubuntu) on DigitalOcean.

2. **On the Droplet:**
   ```bash
   # Install Node (e.g. 20 LTS)
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs

   # Clone your repo (or upload files)
   cd /var/www
   sudo mkdir -p sulitzilla
   sudo chown $USER sulitzilla
   git clone https://github.com/YOUR_USERNAME/sulitzilla-site.git sulitzilla
   cd sulitzilla
   ```

3. **Env file for the server:**
   ```bash
   cd server
   cp .env.example .env
   nano .env   # set GRIST_API_KEY, GRIST_DOC_ID, GRIST_TABLE
   npm install
   ```

4. **Run with PM2 (keeps it running):**
   ```bash
   sudo npm install -g pm2
   cd /var/www/sulitzilla/server
   PORT=5500 pm2 start server.js --name sulitzilla
   pm2 save
   pm2 startup   # run the command it prints so it starts on reboot
   ```

5. **Nginx in front (recommended):** Install nginx, then add a server block so that:
   - `sulitzilla.com` and `www.sulitzilla.com` proxy to `http://127.0.0.1:5500`.

   Example (edit as needed):
   ```nginx
   server {
       listen 80;
       server_name sulitzilla.com www.sulitzilla.com;
       location / {
           proxy_pass http://127.0.0.1:5500;
           proxy_http_version 1.1;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```
   Then enable HTTPS (e.g. Certbot/Let’s Encrypt).

6. **DNS:** Point `sulitzilla.com` (and www if you use it) to the Droplet’s IP (A record) or to the host DO gives you (CNAME).

---

## Quick checklist

- [ ] Code in GitHub (or on the Droplet).
- [ ] Env vars set: `GRIST_API_KEY`, `GRIST_DOC_ID`, `GRIST_TABLE`.
- [ ] App or PM2 runs the **server** (so `/` and `/prices/` and `/api/prices` are served).
- [ ] Domain `sulitzilla.com` points to the app or Droplet.
- [ ] HTTPS enabled (App Platform does this; on Droplet use Certbot).

After that, **https://sulitzilla.com** is the main site and **https://sulitzilla.com/prices** is the Pixel price list.
