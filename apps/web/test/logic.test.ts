// Webappens beslutninger: scenarierne i Feature-026, -038, -004 og -030, der handler om, hvad skærmen viser.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deleteConfirmation, escapeAction, screenAfterSignIn, screenOnReload, showPlus } from '../src/logic.ts';

test('F026 scenario "A new user goes straight to Create character"', () => {
  assert.equal(screenAfterSignIn(0), 'create');
  assert.equal(screenAfterSignIn(2), 'characters'); // VIEW-01 Characters is shown after sign-in
});

test('F026: a reload while signed in returns to the Rim with the character being played', () => {
  assert.equal(screenOnReload(2, 'kael'), 'rim');
  assert.equal(screenOnReload(2, null), 'characters');
  assert.equal(screenOnReload(0, null), 'create');
});

test('F038 VIEW-01 / scenario "Keep cancels": the confirmation asks before anything is deleted', () => {
  assert.equal(deleteConfirmation('Brann'), 'Delete Brann? Everything Brann owns is lost. This cannot be undone.');
});

test('F004 scenario "No points left": no + button is shown', () => {
  assert.equal(showPlus(0), false);
  assert.equal(showPlus(3), true);
});

test('F030 scenario "Esc closes what is open": every overlay and dialog closes, also on the square and in a Tithe', () => {
  for (const screen of ['rim', 'tithe', 'characters'] as const) assert.equal(escapeAction(screen, true, 'rim'), 'close');
});

test('F030: on Player statistics Esc goes back like the Back button; with nothing open it does nothing', () => {
  assert.equal(escapeAction('statistics', false, 'characters'), 'characters');
  assert.equal(escapeAction('statistics', false, 'rim'), 'rim');
  assert.equal(escapeAction('rim', false, 'rim'), null);
  assert.equal(escapeAction('tithe', false, 'rim'), null);
});
