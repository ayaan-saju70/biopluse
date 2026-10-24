#!/usr/bin/env python3
"""
cutout.py - remove baked-in checkerboard / white / flat backgrounds from sprite images.

Usage:
    pip install pillow numpy scipy
    python cutout.py assets/kids            # processes every png/jpg in the folder
    python cutout.py assets/kids --no-backup

Originals are copied to <folder>/_originals first. Output is always RGBA PNG.
Works by flood-filling from the image border through "background-like" pixels
(neutral grey/white), so white areas INSIDE a character (enclosed by its outline) are kept.
Also removes enclosed checkerboard holes (e.g. inside a camera strap) and softens edges.
"""
import sys, os, shutil, argparse
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

def cutout(img, sat_tol=26, min_gray=165, holes=True):
    rgb = np.asarray(img.convert("RGB")).astype(np.int16)
    mx, mn = rgb.max(2), rgb.min(2)
    gray = rgb.mean(2)
    bgish = ((mx - mn) <= sat_tol) & (gray >= min_gray)
    lab, n = ndi.label(bgish)                       # 4-connected components
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    border = border[border != 0]
    bg = np.isin(lab, border)
    if holes:  # enclosed checkerboard pockets: bimodal grey with high local alternation
        sizes = ndi.sum(bgish, lab, index=np.arange(1, n + 1))
        for i in np.where(sizes > 300)[0] + 1:
            if i in border: continue
            m = lab == i
            g = gray[m]
            lo, hi = g[g < g.mean()], g[g >= g.mean()]
            if len(lo) > 0.2 * len(g) and len(hi) > 0.2 * len(g) and (hi.mean() - lo.mean()) > 18:
                bg |= m
    fg = ~bg
    fg = ndi.binary_opening(fg, iterations=1)       # kill specks
    # keep only the biggest few foreground blobs (drops stray checker fragments)
    l2, n2 = ndi.label(fg)
    if n2 > 1:
        sz = ndi.sum(fg, l2, index=np.arange(1, n2 + 1))
        keep = np.where(sz >= max(60, 0.002 * fg.size))[0] + 1
        fg = np.isin(l2, keep)
    hole = ndi.binary_fill_holes(fg) & ~fg          # only fill tiny specks, keep real holes (strap loops etc.)
    hl, hn = ndi.label(hole)
    if hn:
        hs = ndi.sum(hole, hl, index=np.arange(1, hn + 1))
        fg = fg | np.isin(hl, np.where(hs < 150)[0] + 1)
    a = ndi.binary_erosion(fg, iterations=1)        # pull edge in 1px to drop grey fringe
    alpha = Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.9))
    out = img.convert("RGBA"); out.putalpha(alpha)
    # trim to content with a small margin
    bbox = alpha.point(lambda v: 255 if v > 8 else 0).getbbox()
    if bbox:
        pad = 6
        bbox = (max(0, bbox[0]-pad), max(0, bbox[1]-pad), min(out.width, bbox[2]+pad), min(out.height, bbox[3]+pad))
        out = out.crop(bbox)
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("folder"); ap.add_argument("--no-backup", action="store_true")
    ap.add_argument("--no-holes", action="store_true")
    ap.add_argument("--no-trim", action="store_true")
    a = ap.parse_args()
    bk = os.path.join(a.folder, "_originals")
    if not a.no_backup: os.makedirs(bk, exist_ok=True)
    for f in sorted(os.listdir(a.folder)):
        p = os.path.join(a.folder, f)
        if not os.path.isfile(p) or not f.lower().endswith((".png", ".jpg", ".jpeg")): continue
        if f.startswith("bg_"): continue            # backgrounds stay opaque
        if not a.no_backup and not os.path.exists(os.path.join(bk, f)): shutil.copy2(p, os.path.join(bk, f))
        out = cutout(Image.open(p), holes=not a.no_holes)
        base = os.path.splitext(f)[0]
        out.save(os.path.join(a.folder, base + ".png"), "PNG")
        if not f.lower().endswith(".png"): os.remove(p)
        print(f"{f}: {out.size[0]}x{out.size[1]}")
if __name__ == "__main__": main()