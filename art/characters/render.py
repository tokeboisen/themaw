"""Tegner en lille 3D-model som pixel art set stejlt oppefra (art/Grafikregler-karakterer.md afsnit 1–3).

En figur er en liste af enkle former (ellipsoider og kapsler) i figurens egne koordinater: x mod højre,
y frem og z op, målt i pixels på jorden (et felt er 32). Kameraet står mod syd og ser ned i 60°, så
højder bliver halvt så lange i billedet. Hver pixel får farve fra den nærmeste form: lys fra øverst til
venstre i tre toner fra formens rampe, en mørk linje hvor en form ligger foran en anden, og til sidst en
kontur rundt om hele figuren. Figuren drejes for at få de 8 retninger.
"""

import math

from PIL import Image

SIZE = 64
FOOT = (32, 48)  # fodpunktet: punktet på jorden midt under figuren
PITCH = math.radians(60)
DIRECTIONS = ('N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW')  # rækkerne i arket, med uret fra nord
OUTLINE = '140f0e'
LINE_DEPTH = 2.5  # så meget længere væk skal en anden form være, før kanten får en mørk linje

D = (0.0, math.cos(PITCH), -math.sin(PITCH))  # kameraets blikretning: mod nord og ned
U = (0.0, math.sin(PITCH), math.cos(PITCH))  # opad i billedet
N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))


def _norm(v):
    length = math.sqrt(sum(c * c for c in v))
    return tuple(c / length for c in v)


def _dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


LIGHT = _norm((-0.6, 0.45, 0.75))  # lys fra øverst til venstre i billedet


class Ellipsoid:
    """En ellipsoide; zmin skærer bunden af, så fx en hue kun er toppen."""

    def __init__(self, part, mat, c, r, zmin=None, tex=None):
        self.part, self.mat, self.c, self.r, self.zmin, self.tex = part, mat, c, r, zmin, tex
        self.points, self.radius = [c], max(r)

    def hit(self, o, d):
        oc = [(o[i] - self.c[i]) / self.r[i] for i in range(3)]
        dd = [d[i] / self.r[i] for i in range(3)]
        a = sum(x * x for x in dd)
        b = 2 * sum(oc[i] * dd[i] for i in range(3))
        c = sum(x * x for x in oc) - 1
        disc = b * b - 4 * a * c
        if disc < 0:
            return None
        t = (-b - math.sqrt(disc)) / (2 * a)
        if self.zmin is not None and o[2] + t * d[2] < self.zmin:
            return None
        return t, 0.0

    def normal(self, p, h):
        return _norm(tuple((p[i] - self.c[i]) / (self.r[i] * self.r[i]) for i in range(3)))


class Capsule:
    """En kapsel mellem to punkter, til arme og ben; h er hvor langt fra a mod b et træf ligger (0–1)."""

    def __init__(self, part, mat, a, b, r, tex=None):
        self.part, self.mat, self.a, self.b, self.r, self.tex = part, mat, a, b, r, tex
        self.points, self.radius = [a, b], r

    def hit(self, o, d):
        ba = _sub(self.b, self.a)
        oa = _sub(o, self.a)
        baba, bard, baoa = _dot(ba, ba), _dot(ba, d), _dot(ba, oa)
        rdoa, oaoa = _dot(d, oa), _dot(oa, oa)
        a = baba - bard * bard
        if abs(a) > 1e-9:
            b = baba * rdoa - baoa * bard
            c = baba * oaoa - baoa * baoa - self.r * self.r * baba
            h = b * b - a * c
            if h < 0:
                return None
            t = (-b - math.sqrt(h)) / a
            y = baoa + t * bard
            if 0 < y < baba:
                return t, y / baba
            oc = _sub(o, self.b) if y > 0 else oa
        else:
            oc = oa
        b = _dot(d, oc)
        c = _dot(oc, oc) - self.r * self.r
        h = b * b - c
        if h <= 0:
            return None
        t = -b - math.sqrt(h)
        return t, (1.0 if oc is not oa else 0.0)

    def normal(self, p, h):
        ba = _sub(self.b, self.a)
        k = max(0.0, min(1.0, _dot(_sub(p, self.a), ba) / _dot(ba, ba)))
        q = tuple(self.a[i] + k * ba[i] for i in range(3))
        return _norm(_sub(p, q))


def _ramp(mat, offset):
    ramp, base = mat
    return ramp[max(0, min(len(ramp) - 1, base + offset))]


def render(shapes, facing):
    """Figuren set mod `facing` grader (0 = nord, 90 = øst) som {(x, y): farve}."""
    yaw = math.radians(facing)
    cy, sy = math.cos(yaw), math.sin(yaw)
    to_model = lambda w: (w[0] * cy - w[1] * sy, w[0] * sy + w[1] * cy, w[2])
    to_world = lambda m: (m[0] * cy + m[1] * sy, -m[0] * sy + m[1] * cy, m[2])
    dm = to_model(D)

    # Hver forms omtrentlige kasse i billedet, så hver pixel kun prøver de former, der kan ramme den.
    boxes = []
    for s in shapes:
        xs, ys = [], []
        for pt in s.points:
            w = to_world(pt)
            xs.append(FOOT[0] + w[0])
            ys.append(FOOT[1] - (w[1] * U[1] + w[2] * U[2]))
        boxes.append((min(xs) - s.radius - 1, max(xs) + s.radius + 1, min(ys) - s.radius - 1, max(ys) + s.radius + 1, s))

    hits = {}
    for y in range(SIZE):
        v = FOOT[1] - (y + 0.5)
        row = [b for b in boxes if b[2] <= y + 0.5 <= b[3]]
        if not row:
            continue
        for x in range(SIZE):
            u = x + 0.5 - FOOT[0]
            cand = [b[4] for b in row if b[0] <= x + 0.5 <= b[1]]
            if not cand:
                continue
            o = to_model((u, v * U[1] - 500 * D[1], v * U[2] - 500 * D[2]))
            best = None
            for s in cand:
                r = s.hit(o, dm)
                if r and (best is None or r[0] < best[0]):
                    best = (r[0], r[1], s)
            if best is None:
                continue
            t, h, s = best
            p = tuple(o[i] + t * dm[i] for i in range(3))
            light = _dot(to_world(s.normal(p, h)), LIGHT)
            mat, colour = s.mat, None
            if s.tex:
                found = s.tex(p, h)
                if isinstance(found, str):
                    colour = found
                elif found:
                    mat = found
            if colour is None:
                colour = _ramp(mat, 1 if light > 0.72 else 0 if light > 0.3 else -1)
            hits[(x, y)] = (colour, s.part, t, _ramp(mat, -2))

    px = {}
    for (x, y), (colour, part, depth, line) in hits.items():
        behind = any(
            (q := hits.get((x + dx, y + dy))) and q[1] != part and q[2] > depth + LINE_DEPTH for dx, dy in N4
        )
        px[(x, y)] = line if behind else colour
    for q in {(x + dx, y + dy) for x, y in px for dx, dy in N4} - set(px):
        px[q] = OUTLINE
    return px


def image(px):
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    for (x, y), c in px.items():
        if 0 <= x < SIZE and 0 <= y < SIZE:
            img.putpixel((x, y), (*bytes.fromhex(c), 255))
    return img


def sheet(model, poses):
    """Et ark: en række pr. retning (N, NE, E, SE, S, SW, W, NW) og et billede pr. positur."""
    img = Image.new('RGBA', (SIZE * len(poses), SIZE * len(DIRECTIONS)), (0, 0, 0, 0))
    for r, _ in enumerate(DIRECTIONS):
        for c, pose in enumerate(poses):
            img.paste(image(render(model(pose), r * 45)), (c * SIZE, r * SIZE))
    return img
