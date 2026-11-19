// Tests af spillets regler (js/core). Kør med: npm test  (eller node --test tests/*.test.js)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE as B } from '../balance.js';
import { createRng } from '../js/core/rng.js';
import {
  createCharacter, addSkillXp, skillXpToNext, addEcho, echoToNextMark, spendAttributePoint, spendSkillPoint,
  effectiveSkill, derivedStats, equipItem, sellItem,
} from '../js/core/character.js';
import { generateItem } from '../js/core/items.js';
import { generateDepth, bfs, isSolid } from '../js/core/dungeon.js';
import { newSave, finishTithe, buyConsumable, acceptGift } from '../js/core/rim.js';
import { createTithe, stepTithe } from '../js/core/world.js';

const fresh = (bg = 'miner') => createCharacter('Tester', bg, createRng(1), B);

test('a skill grows when it is used, and later levels need more use', () => {
  const ch = fresh();
  const start = ch.skills.heavy.level;
  const need = skillXpToNext(start, B);
  // Intelligence 10 giver ingen læringsbonus for en Miner.
  assert.equal(addSkillXp(ch, 'heavy', need - 0.01, B), 0);
  assert.equal(addSkillXp(ch, 'heavy', 0.01, B), 1);
  assert.equal(ch.skills.heavy.level, start + 1);
  assert.ok(skillXpToNext(50, B) > skillXpToNext(10, B));
});

test('Intelligence makes skills learn faster', () => {
  const miner = fresh('miner');
  const acolyte = fresh('acolyte'); // Intelligence 14
  addSkillXp(miner, 'bows', 1, B);
  addSkillXp(acolyte, 'bows', 1, B);
  assert.ok(acolyte.skills.bows.xp > miner.skills.bows.xp);
});

test('Echo gives Marks, and each Mark gives attribute and skill points', () => {
  const ch = fresh();
  const marks = addEcho(ch, echoToNextMark(1, B), B);
  assert.equal(marks, 1);
  assert.equal(ch.level, 2);
  assert.equal(ch.attributePoints, B.marks.attributePoints);
  assert.equal(ch.skillPoints, B.marks.skillPoints);
  assert.ok(spendAttributePoint(ch, 'dexterity'));
  assert.equal(ch.attributes.dexterity, 11);
  const blades = ch.skills.blades.level;
  assert.ok(spendSkillPoint(ch, 'blades', B));
  assert.equal(ch.skills.blades.level, blades + B.skills.levelsPerPoint);
  ch.attributePoints = 0;
  assert.equal(spendAttributePoint(ch, 'strength'), false);
});

test('skills get a bonus from their attributes', () => {
  const ch = fresh();
  const before = effectiveSkill(ch, 'bows', B);
  ch.attributes.dexterity += 10;
  const after = effectiveSkill(ch, 'bows', B);
  assert.equal(after - before, 10 * B.skills.weights.bows.dexterity * B.skills.attributeBonus);
  // Heavy Weapons bruger ikke Dexterity.
  assert.equal(effectiveSkill(ch, 'heavy', B), effectiveSkill(fresh(), 'heavy', B));
});

test('a higher weapon skill gives more damage and faster attacks', () => {
  const ch = fresh();
  const a = derivedStats(ch, B).weapon;
  ch.skills.heavy.level += 20;
  const b = derivedStats(ch, B).weapon;
  assert.ok(b.damageMult > a.damageMult);
  assert.ok(b.cooldown < a.cooldown);
});

test('Constitution gives life and Stamina gives stamina', () => {
  const ch = fresh();
  const a = derivedStats(ch, B);
  ch.attributes.constitution += 1;
  ch.attributes.stamina += 1;
  const b = derivedStats(ch, B);
  assert.equal(b.maxHp - a.maxHp, B.character.hpPerConstitution);
  assert.equal(b.maxStamina - a.maxStamina, B.character.staminaPerStamina);
});

test('items: rarity decides the number of affixes, and rings are never common', () => {
  const rng = createRng(7);
  for (let i = 0; i < 200; i++) {
    const item = generateItem(rng, 3, B);
    const expected = { common: [0, 0], magic: [1, 2], rare: [3, 3] }[item.rarity];
    assert.ok(item.affixes.length >= expected[0] && item.affixes.length <= expected[1], item.name);
    if (item.slot === 'ring') assert.notEqual(item.rarity, 'common');
    assert.ok(item.value > 0);
  }
});

test('equipping an item swaps it with the one in the slot', () => {
  const ch = fresh();
  const sword = generateItem(createRng(3), 1, B, { baseId: 'short_sword', rarity: 'common' });
  ch.inventory.push(sword);
  const old = ch.equipment.weapon;
  assert.ok(equipItem(ch, sword.id));
  assert.equal(ch.equipment.weapon, sword);
  assert.ok(ch.inventory.includes(old));
  const gold = ch.gold;
  assert.ok(sellItem(ch, old.id, B) > 0);
  assert.ok(ch.gold > gold);
});

test('every depth connects the start with the exit, and the last depth has a closed gate', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const map = generateDepth(createRng(seed), { warden: seed % 3 === 0 });
    const dist = bfs(map, map.start.x, map.start.y);
    assert.ok(dist[map.exit.y * map.w + map.exit.x] > 0, `seed ${seed}`);
    if (map.wardenRoom) {
      assert.ok(isSolid(map, map.gate.x, map.gate.y));
      map.gateOpen = true;
      assert.ok(!isSolid(map, map.gate.x, map.gate.y));
    }
  }
});

// En simpel "bot", der går mod udgangen og slår hele tiden.
function botInput(t) {
  const dep = t.depths[t.depth];
  const { map } = dep;
  const p = t.player;
  const tx = Math.floor(p.x);
  const ty = Math.floor(p.y);
  let best = null;
  let bestD = dep.toExit[ty * map.w + tx];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const d = dep.toExit[(ty + dy) * map.w + tx + dx];
    if (d >= 0 && d < bestD) {
      bestD = d;
      best = { x: tx + dx + 0.5 - p.x, y: ty + dy + 0.5 - p.y };
    }
  }
  return { moveX: best ? best.x : 0, moveY: best ? best.y : 0, attack: true, bolt: false, dodge: false, potion: p.hp < t.stats.maxHp * 0.4, ration: p.hunger < 30, interact: true };
}

test('a whole Tithe can be played headless without errors', () => {
  for (const seed of [11, 12, 13]) {
    const ch = fresh('runner');
    const t = createTithe(ch, B, seed);
    t.god = true;
    let steps = 0;
    while (!t.outcome && steps < 60 * 900) {
      stepTithe(t, 1 / 60, botInput(t));
      steps += 1;
      t.events.length = 0;
      for (const e of [t.player, ...t.rivals]) {
        assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y), `${e.name} has a position`);
      }
    }
    assert.ok(t.record.maxDepth >= 2, `seed ${seed} reached depth ${t.record.maxDepth}`);
    assert.ok(ch.skills.blades.level > 10, 'Blades grew by use');
  }
});

test('falling costs the gold and items found in that Tithe, but nothing you brought down', () => {
  const ch = fresh();
  const save = newSave(ch, createRng(2), B);
  const t = createTithe(ch, B, 99);
  const brought = ch.equipment.weapon;
  const found = generateItem(createRng(4), 1, B);
  found.found = t.id;
  ch.inventory.push(found);
  t.record.goldFound = 100;
  t.record.renown = 250;
  t.outcome = { type: 'fell', name: 'Gnawer' };
  const gold = ch.gold;
  const result = finishTithe(save, t, B);
  assert.deepEqual(result.lostItems, [found.name]);
  assert.equal(result.goldLost, 100);
  assert.equal(ch.equipment.weapon, brought);
  assert.equal(ch.gold, gold + result.purse);
  assert.equal(save.rim.gifts.length, 2);
  assert.equal(ch.tithes, 1);
});

test('a Champion keeps what was found and gets the champion purse', () => {
  const ch = fresh();
  const save = newSave(ch, createRng(2), B);
  const t = createTithe(ch, B, 5);
  const found = generateItem(createRng(4), 1, B);
  found.found = t.id;
  ch.inventory.push(found);
  t.record.goldFound = 50;
  t.record.wardenSlain = true;
  t.record.maxDepth = 3;
  t.outcome = { type: 'champion', name: ch.name };
  const result = finishTithe(save, t, B);
  assert.equal(result.lostItems.length, 0);
  assert.ok(ch.inventory.includes(found));
  assert.equal(found.found, undefined);
  assert.ok(result.purse >= B.rim.purse.champion + B.rim.purse.warden);
  assert.equal(ch.championships, 1);
});

test('the Rim sells consumables and hands out sponsor gifts', () => {
  const ch = fresh();
  const save = newSave(ch, createRng(2), B);
  const gold = ch.gold;
  assert.ok(buyConsumable(save, 'potion', B).ok);
  assert.equal(ch.gold, gold - B.rim.potionPrice);
  save.rim.gifts.push({ id: 'g1', house: 'House Vane', kind: 'gold', gold: 40 });
  assert.ok(acceptGift(save, 'g1', B).ok);
  assert.equal(save.rim.gifts.length, 0);
});
