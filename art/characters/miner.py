#!/usr/bin/env python3
"""Dukken: Miner uden rustning, set stejlt oppefra i 8 retninger (art/Grafikregler-karakterer.md).

Figuren er en lille 3D-model af enkle former, som render.py tegner som pixel art: polstret læderhue,
sodet ansigt, grov ulden skjorte med oprullede ærmer, læderbukser og tunge støvler, med et par små
Echo-krystalstænk på skjorten. Hænderne er tomme; våbnet tegnes af spillet. Kun farver fra
art/palette.hex.

Skriver idle.png (4 billeder) og walk.png (6 billeder) til apps/web/assets/characters/body/miner/,
med rækkerne N, NE, E, SE, S, SW, W, NW.

Kør fra repoets rod:  python3 art/characters/miner.py [--preview fil.png]
"""

import argparse
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from render import FOOT, SIZE, Capsule, Ellipsoid, sheet  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / 'apps/web/assets/characters/body/miner'
PALETTE = set(ROOT.joinpath('art/palette.hex').read_text().split())

DARK = '241a17'
STONE = ['2f2724', '463b36', '5f534b', '7d7066', 'a09284', 'c8bba8', 'f1ead8']
SKIN = ['3a221a', '5c3727', '86553a', 'b67b59', 'd9a27e', 'f0cba9']
LEATHER = ['33200f', '523419', '774c26', '9e6d3b', 'c4965c']
OCHRE = ['5a3d0e', '8c6420', 'bf9236', 'e6c66e']
ECHO = ['3b2a6b', '6a55c2', '8fc1ff', 'e4f2ff']
for colour in [DARK, *STONE, *SKIN, *LEATHER, *OCHRE, *ECHO]:
    assert colour in PALETTE, f'{colour} er ikke i paletten'

# Afsnit 4: idle 4 billeder (skuldrene løfter sig), walk 6 billeder (benene svinger, armene modsat).
IDLE = [{'breathe': b} for b in (0, 0, 2, 2)]
WALK = []
for i in range(6):
    phase = 2 * math.pi * i / 6
    swing = 18 * math.sin(phase)
    WALK.append({
        'legL': swing, 'legR': -swing,
        'liftL': 2.5 * max(0.0, math.cos(phase)), 'liftR': 2.5 * max(0.0, -math.cos(phase)),
        'armL': -swing * 1.1, 'armR': swing * 1.1,
        'bob': 2 * abs(math.cos(phase)) - 1,
    })

ECHO_SPOTS = [(-6.5, 6.8, 41.0), (7.0, 6.2, 35.5), (5.0, -7.2, 40.0)]
SOOT = [(-5.5, 6.0, -3.0), (5.8, 5.6, -1.6)]


def near(p, q, r):
    return sum((p[i] - q[i]) ** 2 for i in range(3)) < r * r


def model(pose):
    bob = pose.get('bob', 0)
    up = bob + pose.get('breathe', 0)
    shapes = []

    def belt(z0):
        def tex(p, h):
            z = p[2] - z0
            if 27.0 <= z <= 30.5:
                return OCHRE[2] if p[1] > 0 and abs(p[0]) < 1.9 else (LEATHER, 0)
            return None
        return tex

    # Ben i læderbukser og tunge støvler; en fod, der svinger frem, løftes.
    for side, key in ((-1, 'L'), (1, 'R')):
        a = math.radians(pose.get('leg' + key, 0))
        lift = pose.get('lift' + key, 0)
        hip = (side * 5, 0, 25 + bob)
        ankle = (side * 5, 18 * math.sin(a), 7 + lift)
        shapes.append(Capsule('leg' + key, (LEATHER, 1), hip, ankle, 4.2))
        shapes.append(Ellipsoid('boot' + key, (STONE, 1), (ankle[0], ankle[1] + 1.5, ankle[2] - 3.5), (4.2, 6.5, 3.6)))
    shapes.append(Ellipsoid('hips', (LEATHER, 1), (0, 0, 26 + bob), (10, 6.5, 6.5), tex=belt(bob)))

    # Skjorten med åben krave, bæltet og Echo-stænkene.
    def torso_tex(p, h):
        found = belt(bob)(p, h)
        if found:
            return found
        z = p[2] - up
        if p[1] > 2.5 and z > 46.5 and abs(p[0]) < (z - 45.5) * 0.75:
            return (SKIN, 3)
        if any(near(p, (x, y, z0 + up), 1.15) for x, y, z0 in ECHO_SPOTS):
            return ECHO[2]
        return None

    shapes.append(Ellipsoid('torso', (STONE, 3), (0, -0.5, 39 + up), (12, 8, 12.5), tex=torso_tex))

    # Arme: oprullede ærmer, bare underarme og lukkede, tomme hænder.
    for side, key in ((-1, 'L'), (1, 'R')):
        a = math.radians(pose.get('arm' + key, 0))
        b = a + math.radians(14)
        shoulder = (side * 11.3, -0.5, 46 + up)
        elbow = (side * 12.6, shoulder[1] + 10.5 * math.sin(a), shoulder[2] - 10.5 * math.cos(a))
        wrist = (side * 13.0, elbow[1] + 9 * math.sin(b), elbow[2] - 9 * math.cos(b))
        shapes.append(Capsule('arm' + key, (STONE, 3), shoulder, elbow, 3.7, tex=lambda p, h: (STONE, 4) if h > 0.72 else None))
        shapes.append(Capsule('fore' + key, (SKIN, 3), elbow, wrist, 3.0))
        shapes.append(Ellipsoid('fist' + key, (SKIN, 3), (wrist[0], wrist[1] + 0.6, wrist[2] - 1.2), (3.3, 3.3, 3.3)))

    # Hoved med sodet ansigt og nakkehår, ører og næse.
    hc = (0, 1.5, 57 + up)

    def head_tex(p, h):
        d = (p[0] - hc[0], p[1] - hc[1], p[2] - hc[2])
        if d[1] < -1.5 and d[2] < 2.5:
            return (LEATHER, 1)
        if d[1] > 5.0:
            if abs(abs(d[0]) - 3.0) < 1.0 and -1.6 < d[2] < 0.2:
                return DARK
            if 1.0 < d[2] < 2.3 and 1.4 < abs(d[0]) < 4.8:
                return LEATHER[1]
            if -5.2 < d[2] < -4.0 and abs(d[0]) < 2.0:
                return SKIN[1]
        if any(near(d, s, 1.1) for s in SOOT):
            return STONE[2]
        return None

    shapes.append(Capsule('neck', (SKIN, 2), (0, 0, 47 + up), (0, 0.6, 51 + up), 4.0))
    shapes.append(Ellipsoid('head', (SKIN, 3), hc, (8.5, 8.5, 8.5), tex=head_tex))
    for side in (-1, 1):
        shapes.append(Ellipsoid('ear', (SKIN, 2), (side * 8.3, 1.0, 56.5 + up), (1.6, 1.6, 2.0)))
    shapes.append(Ellipsoid('nose', (SKIN, 3), (0, 10.2, 55.8 + up), (1.5, 1.5, 1.6)))

    # Polstret læderhue, tæt om hovedet, så den slutter over panden og ikke skjuler ansigtet oppefra:
    # kuppel med et søm over toppen og et mørkere bånd forneden.
    def cap_tex(p, h):
        z = p[2] - up
        if z < 62.4:
            return (LEATHER, 2)
        if abs(p[0]) < 0.55 and z > 63.5:
            return LEATHER[2]
        return None

    shapes.append(Ellipsoid('cap', (LEATHER, 3), (0, 0, 60 + up), (9.0, 9.2, 7.6), zmin=60.6 + up, tex=cap_tex))
    return shapes


def preview(sheets, path, scale=3):
    """Et prøvebillede: stående i alle 8 retninger og gang mod syd og vest, på minernes gulv med skygge."""
    idle, walk = sheets['idle'], sheets['walk']
    cols = 8
    w, h = cols * 34 * scale, 3 * 56 * scale
    out = Image.new('RGBA', (w, h), (22, 17, 15, 255))
    d = ImageDraw.Draw(out)
    t = 32 * scale
    for ty in range(h // t + 1):
        for tx in range(w // t + 1):
            d.rectangle([tx * t, ty * t, tx * t + t - 1, ty * t + t - 1], fill=(43, 38, 32) if (tx + ty) % 2 else (41, 36, 31))

    def put(img, row, frame, cx, cy):
        d.ellipse([cx - 12 * scale, cy - 4 * scale, cx + 12 * scale, cy + 4 * scale], fill=(16, 12, 10))
        fr = img.crop((frame * SIZE, row * SIZE, frame * SIZE + SIZE, row * SIZE + SIZE)).resize((SIZE * scale, SIZE * scale), Image.NEAREST)
        out.alpha_composite(fr, (cx - FOOT[0] * scale, cy - FOOT[1] * scale))

    for r in range(8):
        put(idle, r, 0, (17 + r * 34) * scale, 46 * scale)
    for i in range(6):
        put(walk, 4, i, (17 + i * 34) * scale, 102 * scale)
        put(walk, 6, i, (17 + i * 34) * scale, 158 * scale)
    out.save(path)


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('--preview', help='skriv også et prøvebillede i 3× hertil')
    args = ap.parse_args()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    sheets = {'idle': sheet(model, IDLE), 'walk': sheet(model, WALK)}
    for name, img in sheets.items():
        img.save(OUT_DIR / f'{name}.png')
        print(f'{OUT_DIR.relative_to(ROOT)}/{name}.png  {img.width}×{img.height}')
    if args.preview:
        preview(sheets, args.preview)


if __name__ == '__main__':
    main()
