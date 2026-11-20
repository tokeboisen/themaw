#!/usr/bin/env python3
"""Tjekker sprite-ark mod art/Grafikregler-karakterer.md (afsnit 11), så grafik fra en AI kan godkendes.

Fejl (skal rettes):
  - arket er ikke et helt antal billeder på 64 px i bredden, eller ikke 8 rækker (death: 1) i højden
  - farver uden for art/palette.hex, eller halvgennemsigtige pixels
  - et tomt billede
  - figuren står ikke om fodpunktet (32, 48), eller går så langt ned, at den mangler margen (y > 61)
Advarsler (se efter):
  - figuren er ikke centreret om x = 32 (mere end 5 px ved siden af)
  - figuren rører billedets kant
  - figuren hopper i idle: øverste eller nederste række flytter sig mere end 1 px i samme retning

Kør fra repoets rod:  python3 art/tools/check_sprites.py [filer eller mapper …]
Uden argumenter tjekkes alle PNG'er under apps/web/assets/characters.
"""

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PALETTE = {bytes.fromhex(c) for c in ROOT.joinpath('art/palette.hex').read_text().split()}
SIZE = 64
FOOT = (32, 48)  # punktet på jorden midt under figuren
LOWEST = 61  # nederste række, figuren må gå ned til
DIRECTIONS = ('N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW')


def check(path: Path) -> tuple[list, list]:
    errors, warnings = [], []
    img = Image.open(path).convert('RGBA')
    w, h = img.size
    rows = 1 if path.stem == 'death' else len(DIRECTIONS)
    if w % SIZE or w == 0:
        errors.append(f'bredden {w} er ikke et helt antal billeder på {SIZE} px')
    if h != rows * SIZE:
        errors.append(f'højden {h} skal være {rows * SIZE} ({rows} række{"r" if rows > 1 else ""})')
    if errors:
        return errors, warnings

    px = img.load()
    off_palette, partial = set(), 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if a != 255:
                partial += 1
            if bytes((r, g, b)) not in PALETTE:
                off_palette.add(f'{r:02x}{g:02x}{b:02x}')
    if off_palette:
        shown = ', '.join(sorted(off_palette)[:8])
        errors.append(f'{len(off_palette)} farver uden for paletten: {shown}{" …" if len(off_palette) > 8 else ""}')
    if partial:
        errors.append(f'{partial} halvgennemsigtige pixels')

    for r in range(rows):
        direction = DIRECTIONS[r] if rows > 1 else 'S'
        tops, bottoms = set(), set()
        for c in range(w // SIZE):
            where = f'{direction} billede {c + 1}'
            pts = [(x, y) for y in range(SIZE) for x in range(SIZE) if px[c * SIZE + x, r * SIZE + y][3]]
            if not pts:
                errors.append(f'{where}: tomt')
                continue
            xs = [x for x, _ in pts]
            ys = [y for _, y in pts]
            tops.add(min(ys))
            bottoms.add(max(ys))
            if path.stem != 'death' and not (min(xs) <= FOOT[0] <= max(xs) and min(ys) <= FOOT[1] <= max(ys)):
                errors.append(f'{where}: figuren står ikke om fodpunktet {FOOT}')
            if max(ys) > LOWEST:
                errors.append(f'{where}: figuren går ned til række {max(ys)}, højst {LOWEST}')
            centre = (min(xs) + max(xs) + 1) / 2
            if abs(centre - FOOT[0]) > 5:
                warnings.append(f'{where}: midten er x = {centre:g}, ikke {FOOT[0]}')
            if min(xs) == 0 or min(ys) == 0 or max(xs) == SIZE - 1 or max(ys) == SIZE - 1:
                warnings.append(f'{where}: figuren rører kanten')
        if path.stem == 'idle' and (max(tops, default=0) - min(tops, default=0) > 1 or max(bottoms, default=0) - min(bottoms, default=0) > 1):
            warnings.append(f'{direction}: figuren hopper mere end 1 px mellem billederne')
    return errors, warnings


def main() -> int:
    args = [Path(a) for a in sys.argv[1:]] or [ROOT / 'apps/web/assets/characters']
    files = sorted(p for a in args for p in ([a] if a.is_file() else a.rglob('*.png')))
    if not files:
        print('Ingen PNG-filer fundet.')
        return 1
    failed = 0
    for path in files:
        errors, warnings = check(path)
        name = path.resolve().relative_to(ROOT) if path.resolve().is_relative_to(ROOT) else path
        print(f'{"FEJL" if errors else "OK  "}  {name}')
        for e in errors:
            print(f'      fejl: {e}')
        for wn in warnings:
            print(f'      advarsel: {wn}')
        failed += bool(errors)
    print(f'\n{len(files) - failed} af {len(files)} ark følger reglerne.')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
