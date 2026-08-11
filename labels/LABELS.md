# Sulitzilla inventory label printing

**Paste printer:** https://grist.sulitzilla.com/print/  
**Aliases:** https://sulitzilla.com/print/ , https://sulitzilla.com/labels/  
**Local:** http://localhost:5500/print/

---

## Supported Grist views

The paste page auto-detects which page you copied from:

| View | Keeps |
|------|--------|
| **Kango Arrived** | Code, Brand, Product, Color/Variation, Storage |
| **Amazon Arrived** | Code, Brand, Product, Variant·Flavor, Count/Size |
| **Taobao Arrived** | Code, Brand, Product, Color, Storage |

Everything else (status, notes, prices, tracking, URLs, …) is dropped. Currency values never print.

---

## Printer: Xprinter (recommended)

Default engine is **Xprinter (TSPL)** — works with open thermal label stock (no NIIMBOT RFID lock-in).

### USB (preferred)

1. Open **Chrome** → https://grist.sulitzilla.com/print/
2. Close **Open Label+**, Clabel apps, or anything else using the printer COM port.
3. Plug in the **XP-460B** (or other TSPL Xprinter) by USB.
4. Set **Printer** to **Xprinter (TSPL)**.
5. Set **W×H** to match the loaded labels (default **30×20**) — measure the sticker, not the liner.
6. Click **Connect USB** → choose the printer port.
7. Paste rows from Grist → **Print Labels**.

If feed is wrong, adjust **Gap** (mm) or try continuous (Gap `0`).

If text is cut off on one side, use **Offset X / Offset Y** (mm): positive X shifts print right, positive Y shifts down. Typical when half the design falls off the left: try Offset X `2`–`6`.

Long product names wrap to the next line (soft-break around 10 characters when needed). Tune **Code / Product / Count** % if a field still looks too small or large.

Bitmap polarity is always inverted for XP-460B. Resolution is fixed at 203 dpi (standard for this printer).

### Bluetooth

Use **Connect Bluetooth** if USB is unavailable. USB is more reliable for XP-460B.

### NIIMBOT

Still available under Printer → NIIMBOT (Bluetooth only). Most NIIMBOT models expect proprietary RFID label rolls.

**Clabel / Open Label+** cannot be driven from this page.

---

## Architecture

```
Paste (from Grist) → Label Engine → Print Engine → Xprinter (TSPL) or NIIMBOT
```

| Layer | Path | Role |
|--------|------|------|
| Paste UI | `labels/index.html`, `print-app.js` | Paste, map, preview, print |
| Parser | `labels/paste-parse.js` | View layouts + strip junk |
| Label Engine | `labels/label-engine.js` | Format + canvas |
| TSPL | `labels/print/tspl.js` | Bitmap job builder |
| Xprinter | `labels/print/xprinter-engine.js` | Web Serial + Web Bluetooth |
| NIIMBOT | `labels/print/niimbot-engine.js` | Web Bluetooth (legacy) |

---

## Deploy

Static files under `labels/`, served at `/print/` and `/labels/` by `server/server.js`.  
Nginx on `grist.sulitzilla.com` proxies `/print/` → Node (see [DEPLOY-PRINT.md](DEPLOY-PRINT.md)).
