// Feature-007 VIEW-01: sammenligningen på karakterskærmens Equipment-fane og Feature-027's Equip i spellbooken.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BALANCE as B, createCharacter, createRng, generateItem } from '@maw/rules';
import { firstFreeKey, statRows, statsTable, withItem } from '../src/sheet.ts';

test('F007 scenario "Comparing before equipping": the War Axe\'s melee damage is shown in yellow under the Pickaxe\'s', () => {
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
  assert.ok(row.includes(now[melee]!.value) && row.includes('class="cmp"'), row);
  // Only the values that change get a yellow line.
  assert.equal(html.split('class="cmp"').length - 1, now.filter((r, i) => r.value !== statRows(withAxe)[i]!.value).length);
});

test('F007 VIEW-01: for an equipped item the comparison is without it', () => {
  const kael = createCharacter('Kael', 'miner', createRng(1), B);
  const pick = kael.equipment.melee!;
  const without = withItem(kael, pick.id)!;
  assert.equal(without.equipment.melee, null);
  assert.ok(without.inventory.some((i) => i.id === pick.id));
});

test('F027 scenario "Equip puts an Echo Art on the first empty key"', () => {
  assert.equal(firstFreeKey({ '1': { weapon: 'x' }, '2': { echoArt: 'Echo Bolt' } }), '3');
  const full = Object.fromEntries(['1', '2', '3', '4', '5', '6', '7', '8'].map((k) => [k, { echoArt: 'Echo Bolt' as const }]));
  assert.equal(firstFreeKey(full), null);
});
