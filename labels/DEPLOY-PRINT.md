# Label print at grist.sulitzilla.com/print

Staff URL: **https://grist.sulitzilla.com/print/**

(Also available at `https://sulitzilla.com/print/` and `/labels/` after deploy.)

## One-time nginx (grist.sulitzilla.com)

SSH to the Droplet and edit the Grist site config (path may vary):

```bash
ssh root@139.59.231.34
# find the grist vhost, e.g.:
grep -R "grist.sulitzilla.com" /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null
```

Inside the `server { ... }` block for `grist.sulitzilla.com`, add **before** the main Grist `location /`:

```nginx
    # Sulitzilla label printer (Node app on :5500)
    location = /print {
        return 301 /print/;
    }
    location /print/ {
        proxy_pass http://127.0.0.1:5500/print/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # Allow Web Bluetooth prompts from this origin when possible
        add_header Permissions-Policy "bluetooth=(self), serial=(self)";
    }
```

Then:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Deploy the site as usual (`git push` → Actions, or `git pull` + `pm2 restart sulitzilla` on the server). Open https://grist.sulitzilla.com/print/ in Chrome.
