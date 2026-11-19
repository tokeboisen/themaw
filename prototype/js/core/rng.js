// Tilfældighed med seed (mulberry32), så en Tithe kan spilles igen med den samme bane.

export function createRng(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => Math.floor(min + (max - min + 1) * next()), // begge grænser med
    pick: (list) => list[Math.floor(next() * list.length)],
    chance: (p) => next() < p,
    id: () => Math.floor(next() * 0xffffffff).toString(36),
  };
}

export function randomSeed() {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}
