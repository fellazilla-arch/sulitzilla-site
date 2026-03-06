# Deploy sulitzilla.com on grist-server (same Droplet as Grist)

Use this when you want to run the site on the same Droplet as Grist (grist-server).  
**grist-server IP:** 139.59.231.34

---

## 1. SSH into grist-server

From your Mac:

```bash
ssh root@139.59.231.34
```

(Or use the user/key you normally use for this Droplet.)

---

## 2. Install Node.js (if not already installed)

Check first:

```bash
node -v
```

If you get a version (e.g. v20.x), skip to step 3. If not:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

---

## 3. Clone the repo

```bash
sudo mkdir -p /var/www
sudo chown $USER /var/www
cd /var/www
git clone https://github.com/fellazilla-arch/sulitzilla-site.git sulitzilla
cd sulitzilla
```

---

## 4. Create `.env` and install dependencies

```bash
cd /var/www/sulitzilla/server
cp .env.example .env
nano .env
```

In `.env`, set (use your real Grist API key):

```
GRIST_API_KEY=your_new_grist_api_key
GRIST_DOC_ID=eEMaR9RHiD3r
GRIST_TABLE=Master_List
GRIST_BASE=https://grist.sulitzilla.com/api
```

Save (Ctrl+O, Enter, Ctrl+X in nano). Then:

```bash
npm install
```

---

## 5. Run the app with PM2

```bash
sudo npm install -g pm2
cd /var/www/sulitzilla/server
pm2 start server.js --name sulitzilla
pm2 save
pm2 startup
```

Run the command that `pm2 startup` prints (it will look like `sudo env PATH=... pm2 startup systemd -u ...`) so the app starts on reboot.

Check it’s running:

```bash
pm2 status
curl -s http://127.0.0.1:5500/ | head -5
```

You should see HTML. If so, the app is fine; next we put nginx in front.

---

## 6. Nginx: add a server block for sulitzilla.com

Nginx is probably already installed (for Grist). Create a new config:

```bash
sudo nano /etc/nginx/sites-available/sulitzilla
```

Paste this (nothing else in the file):

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

Save and exit. Enable the site and reload nginx:

```bash
sudo ln -s /etc/nginx/sites-available/sulitzilla /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 7. HTTPS with Certbot (if not already set up for this domain)

If you already use Certbot for grist.sulitzilla.com, add a cert for sulitzilla.com:

```bash
sudo certbot --nginx -d sulitzilla.com -d www.sulitzilla.com
```

Follow the prompts. Certbot will adjust the nginx config for HTTPS.

---

## 8. DNS: point sulitzilla.com to grist-server

At your domain registrar (where you manage sulitzilla.com):

- Add an **A record**: name `@` (or `sulitzilla.com`), value **139.59.231.34**.
- Optionally add **www**: name `www`, value **139.59.231.34** (or a CNAME to `sulitzilla.com` if your provider does that).

Wait a few minutes for DNS to propagate, then open **https://sulitzilla.com** and **https://sulitzilla.com/prices**.

---

## Quick reference

| What              | Where / command |
|-------------------|------------------|
| App code          | `/var/www/sulitzilla` |
| Run/restart app   | `pm2 restart sulitzilla` |
| Logs              | `pm2 logs sulitzilla` |
| Nginx config      | `/etc/nginx/sites-available/sulitzilla` |
| After editing nginx | `sudo nginx -t && sudo systemctl reload nginx` |

To deploy updates later: `cd /var/www/sulitzilla && git pull && cd server && npm install && pm2 restart sulitzilla`.
