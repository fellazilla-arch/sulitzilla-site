# Sulitzilla inventory label printing

**Primary workflow (recommended):** paste rows from Grist into a standalone page — no custom widget, no iframe freezes.

**Paste printer (use this):** `https://grist.sulitzilla.com/print/`  
**Aliases:** `https://sulitzilla.com/print/`, `https://sulitzilla.com/labels/`  
**Local:** `http://localhost:5500/print/`

See [DEPLOY-PRINT.md](DEPLOY-PRINT.md) to wire nginx on `grist.sulitzilla.com`.

---

## Supported Grist views

The paste page auto-detects which page you copied from:

| View | Keeps |
|------|--------|
| **Kango Arrived** | Code, Brand, Product, Color/Variation, Storage |
| **Amazon Arrived** | Code, Brand, Product, Variant·Flavor, Count/Size |
| **Taobao Arrived** | Code, Brand, Product, Color, Storage |

Everything else (status, notes, prices, tracking, URLs, …) is dropped.

1. Start the server locally (or use the deployed site):

   ```bash
   cd server && npm start
   ```

2. Open **Chrome**: [http://localhost:5500/labels/](http://localhost:5500/labels/)

3. In Grist, select the cells you want labeled (include the **header row** if you can — `CODE`, `BRAND`, etc.).

4. Copy → paste into the text box → **Load paste**.

5. Check column map (Code / Brand / Product / Variation / Count·Size) if auto-detect is wrong.

6. **Connect Printer** → pick NIIMBOT → **Print Labels**.

You can also paste a single column of codes only.

Shortcut: **⌘/Ctrl + Enter** in the paste box runs Load paste.

---

## Why not the Grist custom widget?

Grist’s `onRecords` often sends the **entire inventory table** into the widget. Rendering that freezes Chrome. The paste page avoids Grist’s iframe entirely and only processes what you copy.

The custom widget under `labels/widget/` remains for later experiments once Select By / selection APIs are reliable for your doc.

---

## Architecture

```
Paste (from Grist) → Label Engine → Print Engine → NIIMBOT
```

| Layer | Path | Role |
|--------|------|------|
| Paste UI | `labels/index.html`, `print-app.js` | Paste, map columns, preview, print |
| Parser | `labels/paste-parse.js` | TSV/CSV + header autodetect |
| Label Engine | `labels/label-engine.js` | Format lines; omit empty fields; canvas |
| Print Engine | `labels/print/` | NIIMBOT Web Bluetooth adapter |
| Vendor | `labels/vendor/niimbluelib.min.js` | `@mmote/niimbluelib` |

---

## Label layout

```
{{Code}}
{{Brand}} {{Product}}
{{Variation}}
{{CountOrSize}}
```

Blank optional fields are omitted. Rows without **Code** are skipped.

Default size: **50×30 mm @ 203 dpi** (adjustable on the page).

---

## Chrome + NIIMBOT

- Use **Google Chrome** (or Edge) on desktop.
- Page must be **HTTPS** (production) or **http://localhost** (dev).
- Keep the printer on and in range; leave Print task on **Auto** unless a specific model needs `B1` / `D110` / etc.

---

## Deploy

Static files under `labels/`, served by `server/server.js`. After deploy: `https://sulitzilla.com/labels/`.
