#!/usr/bin/env python3
"""Build installment/data.json from a Lazada price/stock export (.xlsx).

Usage:
    python3 installment/build-data.py [path/to/export.xlsx]

Defaults to ~/Desktop/asdas.xlsx. Requires openpyxl (pip install openpyxl).
Only active phones, watches and laptops selling at PHP 3,000 or more are kept.
Each model lists every priced option (spec x soft x grade) plus the units in
stock per the "SulitZilla Pickup" column. The page overlays live Pixel stock
from /api/inventory (which also knows about incoming units) when available.
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    import openpyxl
except ImportError as e:
    raise SystemExit("openpyxl required: pip install openpyxl") from e

HERE = Path(__file__).resolve().parent
OUT = HERE / "data.json"
DEFAULT_XLSX = Path.home() / "Desktop" / "asdas.xlsx"

MIN_PRICE = 3000

CATEGORY_BY_CAT_ID = {
    "5121": "phones",
    "42006401": "phones",
    "10100415": "watches",
    "11147": "laptops",
    "13836": "laptops",
}
CATEGORY_LABELS = {"phones": "Phones", "watches": "Watches", "laptops": "Laptops"}

# Seller-paid Lazada installment fees (% of price) by bank and tenure in months.
BANKS = [
    {"name": "BDO", "fees": {"3": 2.81, "6": 5.10, "9": 10.20, "12": 10.20, "18": 17.85, "24": 17.85}},
    {"name": "BPI", "fees": {"3": 2.24, "6": 4.59, "9": 7.65, "12": 8.67, "18": 18.36, "24": 11.22}},
    {"name": "HSBC", "fees": {"3": 2.04, "6": 4.08, "12": 8.67, "24": 10.20}},
    {"name": "UnionBank", "fees": {"3": 2.04, "6": 4.59, "12": 9.18, "24": 12.24, "36": 16.32}},
]

# Laptop listings carry specs/condition in the title, so map them explicitly.
# (title regex, display model, spec or None to read from the variation, condition)
LAPTOPS = [
    (r"Samsung Galaxy Chromebook 2", "Samsung Galaxy Chromebook 2", "13.3-inch / 8GB / 128GB", "Excellent"),
    (r"Acer Aspire 3", "Acer Aspire 3", "15.6-inch / Ryzen 5 / 16GB / 1TB", "New"),
    (r"Acer Nitro 16", "Acer Nitro 16", "16-inch / Ryzen 5 / 8GB / 512GB", "New"),
    (r"Surface Laptop SE", "Surface Laptop SE", "11.6-inch / 8GB / 128GB", "New"),
    (r"^2017 Laptop Air", "MacBook Air 2017", None, None),
    (r"^2018 Laptop Air", "MacBook Air 2018", None, None),
    (r"^2022 Laptop Air", "MacBook Air 2022 (M2)", None, None),
    (r"^2015 Laptop Pro", "MacBook Pro 2015", None, None),
    (r"^2019 Laptop Pro", "MacBook Pro 2019", None, None),
    (r"ASUS Vivobook", "ASUS Vivobook 15", "15.6-inch / i5 / 8GB / 256GB", "Used"),
    (r"Gateway Ultra Slim", "Gateway Ultra Slim", "14.1-inch / Ryzen 5 / 8GB / 256GB", "New"),
    (r"Acer Chromebook 514", "Acer Chromebook 514", "14-inch / i3 / 8GB / 512GB", "Excellent"),
    (r"Surface Pro 7", "Surface Pro 7", "12.3-inch / i5 / 8GB / 256GB", "Good"),
    (r"EliteBook 845 G8", "HP EliteBook 845 G8", "14-inch / Ryzen 5 PRO / 16GB / 256GB", "Good"),
    (r"ASUS TUF GAMING A16", "ASUS TUF Gaming A16", "16-inch / Ryzen 5 / 16GB / 512GB", "New"),
    (r"EliteBook 640 G11", "HP EliteBook 640 G11", "14-inch / Ultra 5 / 16GB / 512GB", "Good"),
    (r"Lenovo Yoga 7", "Lenovo Yoga 7", None, "New"),
    (r"EliteBook 850 G6", "HP EliteBook 850 G6", "15.6-inch / i5 / 16GB / 256GB", "Excellent"),
    (r"EliteBook 850 G7", "HP EliteBook 850 G7", "15-inch / i7 / 8GB / 256GB", "Excellent"),
]

GRADE_ORDER = ["New", "Excellent", "Good", "Acceptable", "MDM", "Used", "Issue"]


def parse_price(v):
    if v in (None, ""):
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def parse_condition(text: str) -> str | None:
    """New / Excellent / Good / Acceptable / MDM / Issue, or None if not stated."""
    t = text or ""
    if re.search(r"issue", t, re.I):
        return "Issue"
    if re.search(r"\bMDM\b", t):
        return "MDM"
    if re.search(r"acceptable", t, re.I):
        return "Acceptable"
    if re.search(r"excellent", t, re.I):
        return "Excellent"
    if re.search(r"\bgood\b", t, re.I):
        return "Good"
    if re.search(r"\bnew\b", t, re.I):
        return "New"
    if re.search(r"preloved", t, re.I):
        return "Used"
    return None


def find_storage(text: str, single_only: bool = False) -> str:
    m = re.findall(r"(\d+)\s*(G|T)B?\b", text or "", re.I)
    if not m or (single_only and len(m) > 1):
        return ""
    n, unit = m[-1]
    return f"{n}{unit.upper()}B"


def find_color(category: str, name: str, variation: str) -> str:
    first = re.split(r",", variation or "")[0].strip()
    if not first or parse_condition(first):
        return ""
    if category == "laptops":
        return first if re.fullmatch(r"[A-Za-z ]+", first) else ""
    if re.search(r"fitbit air", name, re.I):
        return ""
    m = re.match(r"^(?:Razr [\w ]+?|\d+)\s*-\s*([A-Za-z][A-Za-z/ ]*?)\s*(?:\(|-|$)", first)
    if m:
        return m.group(1).strip()
    return "" if find_storage(first) else first


def tidy_spec(raw: str) -> str:
    s = (raw or "").strip()
    s, n = re.subn(r"^(\d+(?:\.\d)?)-(?:inch|in)\b[-/]?", r"\1-inch/", s, flags=re.I)
    if not n:
        s = re.sub(r"^(\d+(?:\.\d)?)-(?=[A-Za-z])", r"\1-inch/", s)
    s = s.replace("AI 5", "Ryzen AI 5").replace("R5-8640", "Ryzen 5 8640")
    parts = [p.strip() for p in s.split("/") if p.strip()]
    return " / ".join(parts)


def phone_entry(name: str, variation: str):
    soft = bool(re.search(r"soft unlocked", name, re.I))
    var = variation or ""
    if re.search(r"motorola razr", name, re.I):
        m = re.match(r"\s*(Razr [\w ]+?)\s*-", var)
        model = "Motorola " + (m.group(1).strip() if m else "Razr")
        return model, find_storage(var), parse_condition(var), soft
    if re.search(r"motorola one 5g", name, re.I):
        return "Motorola One 5G UW Ace", find_storage(name), parse_condition(name) or "New", soft
    model = re.sub(r"^(New\s+)?(Google\s+)?", "", name.strip())
    model = re.split(r"\s+-\s+", model)[0]
    model = re.sub(r"\s+", " ", model).strip()
    storage = find_storage(var) or find_storage(name, single_only=True)
    return model, storage, parse_condition(var), soft


def watch_entry(name: str, variation: str):
    var = variation or ""
    if re.search(r"pixel watch", name, re.I):
        m = re.match(r"\s*(\d+)\s*-", var)
        model = f"Pixel Watch {m.group(1)}" if m else "Pixel Watch"
        size = re.search(r"\((\d+mm)\)", var)
        return model, size.group(1) if size else "", parse_condition(var)
    if re.search(r"fitbit air", name, re.I):
        return "Fitbit Air", var.strip(), parse_condition(var) or "New"
    model = re.split(r"\s+-\s+", name.strip())[0]
    return model, "", parse_condition(var) or parse_condition(name) or "New"


def laptop_entry(name: str, variation: str):
    var = variation or ""
    for pat, model, spec, cond in LAPTOPS:
        if re.search(pat, name, re.I):
            if spec is None:
                spec = tidy_spec(re.split(r",", var)[0]) if var else ""
            return model, spec, parse_condition(var) or cond or parse_condition(name) or "New"
    model = re.split(r"\s+[-–|]\s+", name.strip())[0]
    return model, "", parse_condition(var) or parse_condition(name) or "New"


def storage_rank(spec: str) -> int:
    m = re.search(r"(\d+)\s*(GB|TB)\s*$", spec or "", re.I)
    if not m:
        return 0
    n = int(m.group(1))
    return n * 1024 if m.group(2).upper() == "TB" else n


def pixel_phone_rank(model: str) -> float:
    """Newest first, matching the order on the main price list."""
    if model == "Pixel Fold":
        return 78
    m = re.match(r"Pixel (\d+)(a)?( 5G)?( Pro)?( XL)?( Fold)?$", model)
    if not m:
        return -1
    gen = int(m.group(1)) * 10
    if m.group(2):
        return gen + 5 + (1 if m.group(3) or m.group(5) else 0)
    if m.group(6):
        return gen + 4
    if m.group(4) and m.group(5):
        return gen + 3
    if m.group(4) or m.group(5):
        return gen + 2
    return gen + 1


def model_sort_key(category: str, model: str):
    if category == "phones":
        r = pixel_phone_rank(model)
        return (0 if r >= 0 else 1, -r, model.lower())
    if category == "watches":
        m = re.match(r"Pixel Watch (\d+)", model)
        return (0 if m else 1, -(int(m.group(1)) if m else 0), model.lower())
    return (0, model.lower())


def main() -> None:
    xlsx = Path(sys.argv[1]).expanduser() if len(sys.argv) > 1 else DEFAULT_XLSX
    if not xlsx.exists():
        raise SystemExit(f"Missing {xlsx}")

    ws = openpyxl.load_workbook(xlsx, data_only=True)["template"]

    # (category, model) -> {"options": {(spec, soft, grade): {...}}, "units": {(spec, soft, grade, color): qty}}
    models: dict[tuple[str, str], dict] = {}
    for r in ws.iter_rows(min_row=5, values_only=True):
        cat_id = str(r[1]) if r[1] is not None else ""
        category = CATEGORY_BY_CAT_ID.get(cat_id)
        name = r[2]
        if not category or not name or r[5] != "active":
            continue
        price = parse_price(r[11])
        if price is None:
            continue
        special = parse_price(r[8])
        sell = special if special is not None else price
        if sell < MIN_PRICE:
            continue
        variation = r[13] or ""

        soft = False
        if category == "phones":
            model, spec, cond, soft = phone_entry(name, variation)
            if cond is None:
                continue
        elif category == "watches":
            model, spec, cond = watch_entry(name, variation)
        else:
            model, spec, cond = laptop_entry(name, variation)

        if cond is None:
            continue

        try:
            stock = max(int(float(r[12] or 0)), 0)
        except (TypeError, ValueError):
            stock = 0

        entry = models.setdefault((category, model), {"options": {}, "units": {}})
        sell = round(sell)
        opt = entry["options"].setdefault((spec, soft, cond), {"price": sell, "stock": 0})
        opt["price"] = min(opt["price"], sell)
        opt["stock"] += stock
        if stock:
            ukey = (spec, soft, cond, find_color(category, name, variation))
            entry["units"][ukey] = entry["units"].get(ukey, 0) + stock

    def option_sort(key):
        spec, soft, grade = key
        return (storage_rank(spec), spec, soft, GRADE_ORDER.index(grade))

    categories = []
    for key in ("phones", "watches", "laptops"):
        entries = []
        for (category, model), entry in models.items():
            if category != key:
                continue
            options = [
                {"spec": spec, "soft": soft, "grade": grade, "price": o["price"], "stock": o["stock"]}
                for (spec, soft, grade), o in sorted(entry["options"].items(), key=lambda kv: option_sort(kv[0]))
            ]
            units = [
                {"spec": spec, "soft": soft, "grade": grade, "color": color, "qty": qty}
                for (spec, soft, grade, color), qty in sorted(
                    entry["units"].items(), key=lambda kv: (option_sort(kv[0][:3]), kv[0][3])
                )
            ]
            entries.append({"model": model, "options": options, "units": units})
        entries.sort(key=lambda e: model_sort_key(key, e["model"]))
        categories.append({"key": key, "label": CATEGORY_LABELS[key], "models": entries})

    payload = {
        "source": xlsx.name,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "banks": BANKS,
        "categories": categories,
    }
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    counts = ", ".join(f"{c['label']}: {len(c['models'])}" for c in categories)
    print(f"Wrote {OUT} ({counts})")


if __name__ == "__main__":
    main()
