// Feature-007 VIEW-01: sammenligningen på karakterskærmens Equipment-fane og Feature-027's Equip i spellbooken.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BALANCE as B, createCharacter, createRng, generateItem } from '@maw/rules';
import { firstFreeKey, statRows, statsTable, withItem } from '../src/sheet.ts';

test('F007 scenario "Comparing before equipping": the Pickaxe\'s melee damage turns into the War Axe\'s, in yellow', () => {
  const kael = createCharacter('Kael', 'miner', createRng(1), B);
  const axe = generateItem(createRng(2), 1, B, { baseId: 'war_axe', rarity: 'common' });
  kael.inventory.push(axe);
  const now = statRows(kael);
  const withAxe = withItem(kael, axe.id)!;
  assert.equal(withAxe.equipment.melee?.id, axe.id);
  assert.ok(withAxe.inventory.some((i) => i.baseId === 'pickaxe'));
  const html = statsTable(now, statRows(withAxe));
  const melee = now.findIndex((r) => r.label === 'Melee damage');
  const row = html.split('<tr>')[melee + 1]!;
  // The Pickaxe's value is replaced by the War Axe's, in yellow – no new line.
  assert.ok(row.includes(`<span class="cmp">${statRows(withAxe)[melee]!.value}</span>`) && !row.includes(now[melee]!.value), row);
  assert.equal(html.split('<tr>').length, statsTable(now, null).split('<tr>').length);
  // Only the values that change turn yellow.
  assert.equal(html.split('class="cmp"').length - 1, now.filter((r, i) => r.value !== statRows(withAxe)[i]!.value).length);
});

test('F007 scenario "No comparison for what is worn": an equipped item is not compared', () => {
  const kael = createCharacter('Kael', 'miner', createRng(1), B);
  assert.equal(withItem(kael, kael.equipment.melee!.id), null);
});

test('F027 scenario "Equip puts an Echo Art on the first empty key"', () => {
  assert.equal(firstFreeKey({ '1': { weapon: 'x' }, '2': { echoArt: 'Echo Bolt' } }), '3');
  const full = Object.fromEntries(['1', '2', '3', '4', '5', '6', '7', '8'].map((k) => [k, { echoArt: 'Echo Bolt' as const }]));
  assert.equal(firstFreeKey(full), null);
});
