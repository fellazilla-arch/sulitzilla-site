#!/usr/bin/env python3
"""Optimize model card thumbnails. Cards display at 72 CSS px; 216px max edge = 3× retina."""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

MAX_EDGE = 216
QUALITY = 72
MIN_REENCODE_BYTES = 12_000  # skip tiny already-efficient JPEGs


def optimize(path: Path) -> tuple[int, int]:
    before = path.stat().st_size
    with Image.open(path) as im:
        im = im.convert("RGB")
        w, h = im.size
        longest = max(w, h)
        if longest > MAX_EDGE:
            scale = MAX_EDGE / longest
            im = im.resize((round(w * scale), round(h * scale)), Image.Resampling.LANCZOS)

        if before < MIN_REENCODE_BYTES and max(im.size) <= MAX_EDGE:
            return before, before

        im.save(path, "JPEG", quality=QUALITY, optimize=True, progressive=True)

    after = path.stat().st_size
    return before, after


def main() -> None:
    root = Path(__file__).resolve().parent
    paths = sorted(root.glob("pixel-*.jpg"))
    total_before = total_after = 0
    changed = 0

    for path in paths:
        b, a = optimize(path)
        total_before += b
        total_after += a
        if a < b:
            changed += 1

    for path in sorted(root.glob("pixel-*.png")):
        before = path.stat().st_size
        with Image.open(path) as im:
            im = im.convert("RGBA")
            w, h = im.size
            longest = max(w, h)
            if longest > MAX_EDGE:
                scale = MAX_EDGE / longest
                im = im.resize((round(w * scale), round(h * scale)), Image.Resampling.LANCZOS)
            im.save(path, "PNG", optimize=True, compress_level=9)
        after = path.stat().st_size
        total_before += before
        total_after += after
        if after < before:
            changed += 1

    paths = list(paths) + list(root.glob("pixel-*.png"))

    svg = root / "pixel-default.svg"
    if svg.exists():
        total_after += svg.stat().st_size

    print(f"Optimized {len(paths)} images ({changed} smaller) — {total_after} bytes total")


if __name__ == "__main__":
    main()
