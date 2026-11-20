// Tests af spillets regler, overført fra prototypen (prototype/tests/rules.test.js).
// Testnavnene nævner den feature, reglen kommer fra. Selve Tithen (prototype/js/core/world.js) kommer i fase 3.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BALANCE as B, SQUARE_CHEST, acceptGift, addEcho, addSkillXp, buyConsumable, bfs, createCharacter, createRng, derivedStats, describeItem,
  itemRequirements, meetsRequirements, placeAt, squareMap,
  echoToNextMark, effectiveSkill, equipItem, finishTithe, generateDepth, generateItem, isSolid, newSave, sellItem,
  skillXpToNext, spendAttributePoint, spendSkillPoint, type TitheResult,
} from '../src/index.ts';

const fresh = (bg = 'miner') => createCharacter('Tester', bg, createRng(1), B);

function result(t: Partial<TitheResult> & Pick<TitheResult, 'outcome'>): TitheResult {
  return {
    id: 'T1-test',
    seed: 99,
    time: 120,
    record: { kills: 0, rivalsDefeated: 0, renown: 0, goldFound: 0, maxDepth: 1, wardenSlain: false, itemsFound: 0, playersDefeated: 0 },
    start: { level: 1, skills: { blades: 3, heavy: 10, bows: 1, echo: 1 } },
    ...t,
  };
}

test('F002 AGG-01: a skill grows when it is used, and later levels need more use', () => {
  const ch = fresh();
  const start = ch.skills.heavy.level;
  const need = skillXpToNext(start, B);
  assert.equal(addSkillXp(ch, 'heavy', need - 0.01, B), 0);
  assert.equal(addSkillXp(ch, 'heavy', 0.01, B), 1);
  assert.equal(ch.skills.heavy.level, start + 1);
  assert.ok(skillXpToNext(50, B) > skillXpToNext(10, B));
});

test('F002 AGG-01: Intelligence makes skills learn faster', () => {
  const miner = fresh('miner');
  const acolyte = fresh('acolyte'); // Intelligence 14
  addSkillXp(miner, 'bows', 1, B);
  addSkillXp(acolyte, 'bows', 1, B);
  assert.ok(acolyte.skills.bows.xp > miner.skills.bows.xp);
});

test('F003 EVT-04: Echo gives Marks, and each Mark gives attribute and skill points', () => {
  const ch = fresh();
  assert.equal(addEcho(ch, echoToNextMark(1, B), B), 1);
  assert.equal(ch.level, 2);
  assert.equal(ch.attributePoints, B.marks.attributePoints);
  assert.equal(ch.skillPoints, B.marks.skillPoints);
});

test('F004 CMD-01/CMD-02: points raise attributes by 1 and skills by 2 levels', () => {
  const ch = fresh();
  addEcho(ch, echoToNextMark(1, B), B);
  assert.ok(spendAttributePoint(ch, 'dexterity'));
  assert.equal(ch.attributes.dexterity, 11);
  const blades = ch.skills.blades.level;
  assert.ok(spendSkillPoint(ch, 'blades', B));
  assert.equal(ch.skills.blades.level, blades + B.skills.levelsPerPoint);
  ch.attributePoints = 0;
  assert.equal(spendAttributePoint(ch, 'strength'), false);
});

test('F004 AGG-01: skills get a bonus from their attributes', () => {
  const ch = fresh();
  const before = effectiveSkill(ch, 'bows', B);
  ch.attributes.dexterity += 10;
  assert.equal(effectiveSkill(ch, 'bows', B) - before, 10 * 0.7 * B.skills.attributeBonus);
  assert.equal(effectiveSkill(ch, 'heavy', B), effectiveSkill(fresh(), 'heavy', B)); // Heavy Weapons bruger ikke Dexterity
});

test('F002 EVT-05: a higher weapon skill gives more damage and faster attacks', () => {
  const ch = fresh();
  const a = derivedStats(ch, B).weapon;
  ch.skills.heavy.level += 20;
  const b = derivedStats(ch, B).weapon;
  assert.ok(b.damageMult > a.damageMult);
  assert.ok(b.cooldown < a.cooldown);
});

test('F004 AGG-01: Constitution gives life and Stamina gives stamina', () => {
  const ch = fresh();
  const a = derivedStats(ch, B);
  ch.attributes.constitution += 1;
  ch.attributes.stamina += 1;
  const b = derivedStats(ch, B);
  assert.equal(b.maxHp - a.maxHp, B.character.hpPerConstitution);
  assert.equal(b.maxStamina - a.maxStamina, B.character.staminaPerStamina);
});

test('F007 AGG-01: rarity decides the number of affixes, and rings are never common', () => {
  const rng = createRng(7);
  for (let i = 0; i < 200; i++) {
    const item = generateItem(rng, 3, B);
    const [min, max] = { common: [0, 0], magic: [1, 2], rare: [3, 3] }[item.rarity];
    assert.ok(item.affixes.length >= min! && item.affixes.length <= max!, item.name);
    if (item.slot === 'ring') assert.notEqual(item.rarity, 'common');
    assert.ok(item.value > 0);
  }
});

test('F007 CMD-01: equipping an item swaps it with the one in the slot', () => {
  const ch = fresh();
  const sword = generateItem(createRng(3), 1, B, { baseId: 'rusty_sword', rarity: 'common' }); // ingen krav ved item level 1
  ch.inventory.push(sword);
  const old = ch.equipment.melee!;
  assert.equal(equipItem(ch, sword.id, B), 'melee');
  assert.equal(ch.equipment.melee, sword);
  assert.ok(ch.inventory.includes(old));
  const gold = ch.gold;
  assert.ok(sellItem(ch, old.id, B) > 0);
  assert.ok(ch.gold > gold);
});

test('F010 AGG-01: every depth connects the start with the exit, and the last depth has a closed gate', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const map = generateDepth(createRng(seed), { warden: seed % 3 === 0 });
    const dist = bfs(map, map.start.x, map.start.y);
    assert.ok(dist[map.exit.y * map.w + map.exit.x]! > 0, `seed ${seed}`);
    if (map.wardenRoom && map.gate) {
      assert.ok(isSolid(map, map.gate.x, map.gate.y));
      map.gateOpen = true;
      assert.ok(!isSolid(map, map.gate.x, map.gate.y));
    }
  }
});

test('F009 CMD-01: falling costs the gold and items found in that Tithe, never what was brought down', () => {
  const ch = fresh();
  const save = newSave(ch, createRng(2), B);
  const brought = ch.equipment.melee;
  const found = generateItem(createRng(4), 1, B);
  found.found = 'T1-test';
  ch.inventory.push(found);
  const gold = ch.gold;
  const t = result({ outcome: { kind: 'fell', name: 'Gnawer' } });
  t.record.goldFound = 100;
  t.record.renown = 250;
  const summary = finishTithe(save, t, B);
  assert.deepEqual(summary.lostItems, [found.name]);
  assert.equal(summary.goldLost, 100);
  assert.equal(ch.equipment.melee, brought);
  assert.equal(ch.gold, gold + summary.purse);
  assert.equal(save.rim.gifts.length, 2);
  assert.equal(ch.tithes, 1);
});

test('F009/F029: leaving counts as a fall', () => {
  const ch = fresh();
  const save = newSave(ch, createRng(2), B);
  const t = result({ outcome: { kind: 'left', name: ch.name } });
  t.record.goldFound = 20;
  assert.equal(finishTithe(save, t, B).goldLost, 20);
});

test('F009 EVT-02 / F022: a Champion keeps what was found and gets the champion purse', () => {
  const ch = fresh();
  const save = newSave(ch, createRng(2), B);
  const found = generateItem(createRng(4), 1, B);
  found.found = 'T1-test';
  ch.inventory.push(found);
  const t = result({ outcome: { kind: 'champion', name: ch.name } });
  Object.assign(t.record, { goldFound: 50, wardenSlain: true, maxDepth: 3 });
  const summary = finishTithe(save, t, B);
  assert.equal(summary.lostItems.length, 0);
  assert.ok(ch.inventory.includes(found));
  assert.equal(found.found, undefined);
  assert.ok(summary.purse >= B.rim.purse.champion + B.rim.purse.warden);
  assert.equal(ch.championships, 1);
});

test('F022 scenario "The Champion\'s purse": depth 3, The Foreman and 400 Renown pay 690 gold', () => {
  const ch = fresh();
  const save = newSave(ch, createRng(2), B);
  const t = result({ outcome: { kind: 'champion', name: ch.name } });
  Object.assign(t.record, { maxDepth: 3, wardenSlain: true, renown: 400 });
  assert.equal(finishTithe(save, t, B).purse, 690);
});

test('F020 CMD-01 / F024 CMD-01: the Rim sells consumables and hands out sponsor gifts', () => {
  const ch = fresh();
  const save = newSave(ch, createRng(2), B);
  const gold = ch.gold;
  assert.ok(buyConsumable(save, 'potion', B).ok);
  assert.equal(ch.gold, gold - B.rim.potionPrice);
  save.rim.gifts.push({ id: 'g1', house: 'House Vane', kind: 'gold', gold: 40 });
  assert.ok(acceptGift(save, 'g1', B).ok);
  assert.equal(save.rim.gifts.length, 0);
});

test('F007 scenarios "A bow goes into the ranged slot" and "A second ring"', () => {
  const ch = fresh();
  const pickaxe = ch.equipment.melee!;
  const bow = generateItem(createRng(5), 1, B, { baseId: 'short_bow', rarity: 'common' });
  const ring1 = generateItem(createRng(6), 1, B, { slot: 'ring' });
  const ring2 = generateItem(createRng(7), 1, B, { slot: 'ring' });
  const ring3 = generateItem(createRng(8), 1, B, { slot: 'ring' });
  ch.inventory.push(bow, ring1, ring2, ring3);
  assert.equal(equipItem(ch, bow.id, B), 'ranged');
  assert.equal(ch.equipment.melee, pickaxe); // Kael wears the Pickaxe and the Short Bow
  assert.equal(ch.equipment.ranged, bow);
  assert.equal(equipItem(ch, ring1.id, B), 'ring1');
  assert.equal(equipItem(ch, ring2.id, B), 'ring2'); // Kael wears both rings
  // Med begge ringpladser optaget vælger spilleren, hvilken ring der erstattes.
  assert.equal(equipItem(ch, ring3.id, B, 'ring2'), 'ring2');
  assert.equal(ch.equipment.ring1, ring1);
  assert.ok(ch.inventory.includes(ring2));
});

test('F007 AGG-01: every equipped item gives its affixes, also the weapon that is not chosen', () => {
  const ch = fresh();
  const bow = generateItem(createRng(9), 3, B, { baseId: 'short_bow', rarity: 'rare' });
  bow.affixes = [{ stat: 'maxHp', value: 10 }];
  const before = derivedStats(ch, B, 'melee').maxHp;
  ch.equipment.ranged = bow;
  assert.equal(derivedStats(ch, B, 'melee').maxHp, before + 10);
  assert.equal(derivedStats(ch, B, 'melee').weapon.skill, 'heavy');
  assert.equal(derivedStats(ch, B, 'ranged').weapon.skill, 'bows');
});

test('F003: Marks need 300 × Mark^1.5 Echo and stop at Mark 20', () => {
  assert.equal(echoToNextMark(1, B), 300);
  assert.equal(echoToNextMark(2, B), 849);
  const ch = fresh();
  ch.level = 20;
  ch.echo = 0;
  assert.equal(addEcho(ch, 1e9, B), 0);
  assert.equal(ch.level, 20);
});

test('F004 and F002: a skill point cannot raise a skill above 10 + 5 × Mark', () => {
  const ch = fresh();
  ch.level = 1;
  ch.skillPoints = 2;
  ch.skills.heavy = { level: 15, xp: 0 };
  assert.equal(spendSkillPoint(ch, 'heavy', B), false);
  ch.level = 2;
  assert.equal(spendSkillPoint(ch, 'heavy', B), true);
  assert.equal(ch.skills.heavy.level, 17);
});

test('F007 AGG-01: requirements by type and item level – a weapon needs its skill and an attribute, armour Strength, rings nothing', () => {
  const item = (baseId: string, ilvl: number) => generateItem(createRng(ilvl), ilvl, B, { baseId, rarity: 'common' });
  assert.deepEqual(itemRequirements(item('war_axe', 1), B), { skill: { id: 'heavy', level: 10 }, attribute: { id: 'strength', value: 13 } });
  assert.deepEqual(itemRequirements(item('war_axe', 5), B), { skill: { id: 'heavy', level: 14 }, attribute: { id: 'strength', value: 15 } });
  assert.deepEqual(itemRequirements(item('longbow', 6), B), { skill: { id: 'bows', level: 31 }, attribute: { id: 'dexterity', value: 19 } });
  assert.deepEqual(itemRequirements(item('dagger', 1), B), {}); // starting weapons need nothing
  assert.deepEqual(itemRequirements(item('dagger', 3), B), { skill: { id: 'blades', level: 2 }, attribute: { id: 'dexterity', value: 1 } });
  assert.deepEqual(itemRequirements(item('scale_coat', 4), B), { attribute: { id: 'strength', value: 18 } });
  assert.deepEqual(itemRequirements(generateItem(createRng(1), 9, B, { slot: 'ring' }), B), {});
  assert.ok(describeItem(item('war_axe', 1), B).includes('Requires Heavy Weapons 10 · Strength 13'));
});

test('F007: the attribute counts with bonuses from what the character wears', () => {
  const ch = fresh();
  ch.attributes.strength = 12;
  ch.skills.heavy = { level: 10, xp: 0 };
  const axe = generateItem(createRng(4), 1, B, { baseId: 'war_axe', rarity: 'common' }); // Strength 13
  assert.equal(meetsRequirements(ch, axe, B), false);
  const ring = generateItem(createRng(6), 1, B, { slot: 'ring' });
  ring.affixes = [{ stat: 'strength', value: 1 }];
  ch.equipment.ring1 = ring;
  assert.equal(meetsRequirements(ch, axe, B), true);
});

test('F042 and F043: the chest stands on the square, blocks the way and opens with F', () => {
  const map = squareMap();
  assert.ok(isSolid(map, SQUARE_CHEST.x, SQUARE_CHEST.y));
  assert.equal(placeAt(10, 16.3)?.id, 'chest');
  assert.equal(placeAt(10, 16.3)?.name, 'Chest');
});
