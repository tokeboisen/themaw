// Feature-030 Read help: fanerne i venstre side og emnerne.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HELP_TABS, helpHtml } from '../src/help.ts';

const name = () => 'Pickaxe';

test('F030 scenario "Help during a Tithe": the Keys tab is shown with the other subjects down the left side', () => {
  const html = helpHtml({ '1': { weapon: 'w1' }, '2': { echoArt: 'Echo Bolt' } }, name);
  assert.ok(html.includes('<h3>Keys</h3>'));
  assert.ok(html.includes('Pickaxe') && html.includes('Echo Bolt')); // what is on the hotbar
  assert.deepEqual(HELP_TABS.map((t) => t.name), [
    'Keys', 'The Tithe', 'The Reaches', 'Fighting', 'Hiding', 'Skills and Marks', 'Talents', 'Echo Arts', 'The character sheet', 'Gear and loot',
    'Hunger and supplies', 'The Mirrormaster', 'The Rim', 'Playing with others', 'The Arena', 'Bestiary',
  ]);
});

test('F030 scenario "Reading about hiding"', () => {
  const html = helpHtml({}, name, 'hiding');
  assert.ok(html.includes('class="active" data-act="help-tab" data-id="hiding"'));
  assert.ok(html.includes('a bush hides you'));
  assert.ok(!html.includes('<h3>Keys</h3>'));
});
