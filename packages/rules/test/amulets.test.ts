// Feature-007 v10: amuletter (én attribut og én skill pr. ring og amulet, kræfterne kun på sjældne) og vægt.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BALANCE as B, createCharacter, createRng, createTithe, derivedStats, displayName, equipItem, generateItem, loadOf, revealChance, sellValue, sheetAction } from '../src/index.ts';

const ATTRIBUTES = ['strength', 'dexterity', 'stamina', 'constitution', 'intelligence'];
const POWERS = ['haste', 'speed', 'lifeRegen', 'staminaRegen'];

test('F007: amulets are never common; magic ones have an attribute, a skill or armour; powers only on rare ones', () => {
  const rng = createRng(31);
  for (let i = 0; i < 400; i++) {
    const rarity = i % 3 === 0 ? 'common' : i % 3 === 1 ? 'magic' : 'rare';
    const item = generateItem(rng, 1 + (i % 12), B, { baseId: i % 2 ? 'silver_amulet' : 'bone_amulet', rarity });
    assert.notEqual(item.rarity, 'common');
    const stats = item.affixes.map((a) => a.stat);
    if (item.rarity === 'magic') {
      assert.equal(stats.length, 1);
      assert.ok(!stats.some((s) => POWERS.includes(s)), stats.join());
    }
    assert.ok(stats.filter((s) => ATTRIBUTES.includes(s)).length <= 1, stats.join());
    assert.ok(stats.filter((s) => s === 'skillBonus').length <= 1, stats.join());
    assert.ok(!(stats.includes('haste') && stats.includes('speed')), stats.join());
    for (const a of item.affixes) {
      if (a.stat === 'haste' || a.stat === 'speed') assert.ok(a.value >= 5 && a.value <= 50, String(a.value));
      if (a.stat === 'skillBonus') assert.ok(['blades', 'heavy', 'bows', 'echo'].includes(a.skill!));
    }
  }
});

test('F007: a ring adds to at most one attribute', () => {
  const rng = createRng(32);
  for (let i = 0; i < 300; i++) {
    const ring = generateItem(rng, 8, B, { baseId: 'iron_ring', rarity: 'rare' });
    assert.ok(ring.affixes.filter((a) => ATTRIBUTES.includes(a.stat)).length <= 1);
  }
});

test('F007: an amulet goes into the amulet slot; haste makes attacks faster, speed the feet', () => {
  const ch = createCharacter('Kael', 'miner', createRng(1), B);
  const before = derivedStats(ch, B);
  const amulet = generateItem(createRng(2), 10, B, { baseId: 'silver_amulet', rarity: 'rare' });
  amulet.affixes = [{ stat: 'haste', value: 25 }, { stat: 'lifeRegen', value: 3 }];
  ch.inventory.push(amulet);
  assert.equal(equipItem(ch, amulet.id, B), 'amulet');
  const after = derivedStats(ch, B);
  assert.ok(Math.abs(after.melee.cooldown - before.melee.cooldown / 1.25) < 1e-9);
  assert.ok(Math.abs(after.hpRegen - (before.hpRegen + 3)) < 1e-9);
  amulet.affixes = [{ stat: 'speed', value: 20 }];
  assert.ok(Math.abs(derivedStats(ch, B).moveSpeed - before.moveSpeed * 1.2) < 1e-9);
});

test('F007 scenario "A heavy pack tires": Strength 13 and Constitution 12 carry 28; 38 makes stamina 30 % dearer', () => {
  const ch = createCharacter('Kael', 'miner', createRng(1), B);
  ch.attributes.strength = 13;
  ch.attributes.constitution = 12;
  ch.equipment.armour = null;
  ch.equipment.melee = null;
  // 38 i alt: to Scale Coats (32) og en War Axe (6).
  ch.inventory = [
    generateItem(createRng(3), 4, B, { baseId: 'scale_coat', rarity: 'common' }),
    generateItem(createRng(4), 4, B, { baseId: 'scale_coat', rarity: 'common' }),
    generateItem(createRng(5), 2, B, { baseId: 'war_axe', rarity: 'common' }),
  ];
  const load = loadOf(ch, ch.attributes, B);
  assert.equal(load.carry, 28);
  assert.equal(load.load, 38);
  assert.ok(Math.abs(load.staminaCostMult - 1.3) < 1e-9);
  const s = derivedStats(ch, B);
  assert.ok(Math.abs(s.melee.staminaCost - B.combat.unarmed.stamina * 1.3) < 1e-9);
});

function reveal(focus: number) {
  const ch = createCharacter('Kael', 'miner', createRng(1), B);
  ch.attributes.intelligence = 10;
  ch.level = 5; // Mark 5: skills up to 35, so Reveal 30 can still be trained
  ch.skills.reveal = { level: 30, xp: 0 };
  const ring = generateItem(createRng(9), 5, B, { baseId: 'iron_ring', rarity: 'magic' });
  ring.identified = false;
  ch.inventory.push(ring);
  const t = createTithe({ id: 'T-reveal', name: 'Ashfall', seed: 2, players: [{ userId: 'u1', userName: 'k', characterId: 'c1', character: ch, hotbar: {} }] }, B);
  const p = t.players[0]!;
  p.focus = focus;
  return { t, p, ring: p.ch.inventory.find((i) => i.id === ring.id)! };
}

test('F050 scenario "Revealing a ring": effective Reveal 30 reads an item-level-5 ring for 10 focus', () => {
  const { t, p, ring } = reveal(20);
  assert.equal(displayName(ring, B), 'Iron Ring');
  assert.equal(revealChance(30, ring, B), 1);
  assert.equal(sheetAction(t, 'u1', { action: 'reveal', itemId: ring.id }), null);
  assert.equal(ring.identified, true);
  assert.equal(displayName(ring, B), ring.name);
  assert.equal(p.focus, 10);
  assert.ok(p.ch.skills.reveal.xp > 0); // every try trains Reveal
});

test('F050 scenario "Not enough focus": nothing happens', () => {
  const { t, p, ring } = reveal(5);
  assert.equal(sheetAction(t, 'u1', { action: 'reveal', itemId: ring.id }), null);
  assert.equal(ring.identified, false);
  assert.equal(p.focus, 5);
});

test('F050/F019: an unidentified item hides its affixes and sells as a common item', () => {
  const ring = generateItem(createRng(4), 6, B, { baseId: 'bone_ring', rarity: 'rare' });
  const known = sellValue(ring, B);
  ring.identified = false;
  assert.ok(sellValue(ring, B) < known);
  assert.equal(revealChance(0, ring, B), 0.05); // at least 5 %
});
