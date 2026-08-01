#!/usr/bin/env python3
"""Remove near-duplicate images in a folder (average + difference hash).

Usage:
  python3 scripts/dedupe_images.py assets/oder
  python3 scripts/dedupe_images.py assets/oder --threshold 12 --dry-run
"""

from __future__ import annotations

import argparse
import hashlib
from pathlib import Path

from PIL import Image


def ahash(im: Image.Image, hash_size: int = 16) -> str:
    g = im.convert("L").resize((hash_size, hash_size), Image.Resampling.LANCZOS)
    pixels = list(g.getdata())
    avg = sum(pixels) / len(pixels)
    return "".join("1" if p >= avg else "0" for p in pixels)


def dhash(im: Image.Image, hash_size: int = 16) -> str:
    g = im.convert("L").resize((hash_size + 1, hash_size), Image.Resampling.LANCZOS)
    pixels = list(g.getdata())
    bits = []
    for row in range(hash_size):
        for col in range(hash_size):
            left = pixels[row * (hash_size + 1) + col]
            right = pixels[row * (hash_size + 1) + col + 1]
            bits.append("1" if left > right else "0")
    return "".join(bits)


def hamming(a: str, b: str) -> int:
    return sum(x != y for x, y in zip(a, b))


def main() -> None:
    parser = argparse.ArgumentParser(description="Deduplicate images by perceptual hash")
    parser.add_argument("folder", type=Path, help="Image folder")
    parser.add_argument(
        "--threshold",
        type=int,
        default=12,
        help="Max Hamming distance to treat as duplicate (default 12 / 256)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only print duplicates, do not delete",
    )
    args = parser.parse_args()

    folder: Path = args.folder
    files = sorted(
        [
            *folder.glob("*.jpg"),
            *folder.glob("*.jpeg"),
            *folder.glob("*.png"),
            *folder.glob("*.webp"),
        ]
    )
    if not files:
        print(f"No images in {folder}")
        return

    kept = []
    removed = []
    for path in files:
        im = Image.open(path).convert("RGB")
        md5 = hashlib.md5(path.read_bytes()).hexdigest()
        ah, dh = ahash(im), dhash(im)
        dup_of = None
        for k in kept:
            if md5 == k["md5"]:
                dup_of = k["path"]
                break
            if hamming(ah, k["ahash"]) <= args.threshold or hamming(dh, k["dhash"]) <= args.threshold:
                dup_of = k["path"]
                break
        if dup_of:
            removed.append((path, dup_of))
            if not args.dry_run:
                path.unlink()
        else:
            kept.append({"path": path, "md5": md5, "ahash": ah, "dhash": dh})

    print(f"kept {len(kept)} / {len(files)}, removed {len(removed)}")
    for path, vs in removed:
        action = "would delete" if args.dry_run else "deleted"
        print(f"  {action}: {path.name}  (~ {vs.name})")


if __name__ == "__main__":
    main()
