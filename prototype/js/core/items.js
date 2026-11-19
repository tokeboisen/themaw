// Udstyr: våben, rustning og ringe med tilfældige egenskaber (affixes), som i Diablo.

export const SLOTS = ['weapon', 'armour', 'ring'];
export const SLOT_NAMES = { weapon: 'Weapon', armour: 'Armour', ring: 'Ring' };
export const RARITY_NAMES = { common: 'Common', magic: 'Magic', rare: 'Rare' };

export function rollRarity(rng, level, B) {
  const r = B.loot.rarity;
  const bonus = r.perDepth * Math.max(0, level - 1);
  const x = rng.next();
  if (x < r.rare + bonus / 3) return 'rare';
  if (x < r.rare + r.magic + bonus) return 'magic';
  return 'common';
}

// opts: { baseId, slot, rarity }
export function generateItem(rng, level, B, opts = {}) {
  const ilvl = Math.max(1, Math.round(level));
  let baseId = opts.baseId;
  if (!baseId) {
    const candidates = Object.entries(B.items.bases)
      .filter(([, b]) => (b.minLevel || 1) <= ilvl && (!opts.slot || b.slot === opts.slot))
      .map(([id]) => id);
    baseId = rng.pick(candidates);
  }
  const base = B.items.bases[baseId];
  let rarity = opts.rarity || rollRarity(rng, ilvl, B);
  if (base.slot === 'ring' && rarity === 'common') rarity = 'magic'; // en ring uden egenskaber er intet værd

  const item = { id: 'i' + rng.id() + rng.id(), baseId, slot: base.slot, ilvl, rarity, affixes: [] };
  if (base.slot === 'weapon') {
    const scale = 1 + B.items.damagePerItemLevel * (ilvl - 1);
    item.skill = base.skill;
    item.min = Math.round(base.min * scale);
    item.max = Math.max(item.min + 1, Math.round(base.max * scale));
  }
  if (base.slot === 'armour') {
    item.armour = Math.round(base.armour * (1 + B.items.armourPerItemLevel * (ilvl - 1)));
  }

  const count = rarity === 'rare' ? 3 : rarity === 'magic' ? rng.int(1, 2) : 0;
  const pool = Object.entries(B.items.affixes).filter(([, a]) => a.slots.includes(base.slot));
  for (let i = 0; i < count && pool.length; i++) {
    const [stat, a] = pool.splice(Math.floor(rng.next() * pool.length), 1)[0];
    const value = Math.max(1, Math.round(rng.range(a.min, a.max) + a.perLevel * (ilvl - 1)));
    item.affixes.push({ stat, value });
  }
  item.name = itemName(item, B);
  item.value = itemValue(item, B);
  return item;
}

export function itemName(item, B) {
  const base = B.items.bases[item.baseId].name;
  const [first, second] = item.affixes;
  const prefix = first ? B.items.affixes[first.stat].prefix + ' ' : '';
  const suffix = second ? ' ' + B.items.affixes[second.stat].suffix : '';
  return prefix + base + suffix;
}

export function itemValue(item, B) {
  const base = B.items.bases[item.baseId];
  const level = 1 + B.items.pricePerItemLevel * (item.ilvl - 1);
  return Math.round(base.price * level * B.items.rarityPrice[item.rarity] + item.affixes.length * 8);
}

export function sellValue(item, B) {
  return Math.max(1, Math.floor(item.value * B.items.sellFactor));
}

const SKILL_LABELS = { blades: 'Blades', heavy: 'Heavy Weapons', bows: 'Bows', echo: 'Echo Arts' };

// Linjer til at vise et stykke udstyr i UI'et.
export function describeItem(item, B) {
  const base = B.items.bases[item.baseId];
  const lines = [];
  if (item.slot === 'weapon') {
    lines.push(`${item.min}–${item.max} damage · ${SKILL_LABELS[item.skill]}`);
    lines.push(base.range ? `Range ${base.range} · ${base.cooldown}s` : `Reach ${base.reach} · ${base.cooldown}s`);
  }
  if (item.slot === 'armour') lines.push(`${item.armour} armour`);
  for (const a of item.affixes) {
    const def = B.items.affixes[a.stat];
    if (a.stat === 'skill') lines.push(`+${a.value} ${SKILL_LABELS[item.skill]}`);
    else if (def.label.startsWith('%')) lines.push(`+${a.value}${def.label}`);
    else lines.push(`+${a.value} ${def.label}`);
  }
  return lines;
}
