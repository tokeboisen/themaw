// Feature-001 Create character og Feature-031 Create user: reglerne, som både webappen og api'et bruger.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ATTRIBUTES, BALANCE as B, SKILLS, backgroundById, canLower, canRaise, creationProblems, isValidPassword,
  isValidUserName, lower, newCharacter, pointsLeft, raise, suggestedAllocation, userNameKey,
} from '../src/index.ts';

const bg = (id: string) => backgroundById(B, id)!;

test('F001 CMD-01: every suggestion places exactly 55 attribute and 16 skill points within its limits', () => {
  for (const background of B.backgrounds) {
    const alloc = suggestedAllocation(background);
    assert.deepEqual(pointsLeft(alloc, B), { attributes: 0, skills: 0 }, background.name);
    assert.deepEqual(creationProblems({ name: 'X', background: background.id, ...alloc }, B), [], background.name);
  }
});

test('F001 scenario "A Miner is created with the suggested points"', () => {
  const alloc = suggestedAllocation(bg('miner'));
  assert.deepEqual(creationProblems({ name: 'Kael', background: 'miner', ...alloc }, B), []);
  const kael = newCharacter('Kael', bg('miner'), alloc);
  assert.equal(kael.attributes.strength, 13);
  assert.equal(kael.attributes.constitution, 12);
  assert.equal(kael.skills.heavy.level, 10);
  assert.equal(kael.level, 1); // Mark 1
  assert.equal(kael.echo, 0);
  assert.equal(kael.attributePoints + kael.skillPoints, 0);
});

test('F001 scenario "Points are moved within the limits"', () => {
  let alloc = suggestedAllocation(bg('miner'));
  for (let i = 0; i < 2; i++) {
    assert.ok(canLower(bg('miner'), alloc, 'attributes', 'strength'));
    alloc = lower(alloc, 'attributes', 'strength');
    assert.ok(canRaise(bg('miner'), alloc, 'attributes', 'dexterity', B));
    alloc = raise(alloc, 'attributes', 'dexterity');
  }
  assert.deepEqual(creationProblems({ name: 'Brann', background: 'miner', ...alloc }, B), []);
  assert.equal(alloc.attributes.strength, 11);
  assert.equal(alloc.attributes.dexterity, 12);
  assert.ok(!canLower(bg('miner'), alloc, 'attributes', 'strength'), 'Strength is at the Miner minimum of 11');
});

test('F001 scenario "A maximum cannot be passed"', () => {
  // Temple Acolyte: Strength 7–12. Med et ledigt point er + stadig slået fra ved 12.
  let alloc = suggestedAllocation(bg('acolyte'));
  alloc = lower(alloc, 'attributes', 'intelligence');
  alloc = raise(alloc, 'attributes', 'strength');
  alloc = raise(lower(alloc, 'attributes', 'stamina'), 'attributes', 'strength');
  assert.equal(alloc.attributes.strength, 12);
  alloc = lower(alloc, 'attributes', 'dexterity');
  assert.equal(pointsLeft(alloc, B).attributes, 1);
  assert.ok(!canRaise(bg('acolyte'), alloc, 'attributes', 'strength', B));
});

test('F001 scenario "All points must be placed"', () => {
  const alloc = lower(suggestedAllocation(bg('poacher')), 'skills', 'blades');
  assert.equal(pointsLeft(alloc, B).skills, 1);
  assert.deepEqual(creationProblems({ name: 'Vessa', background: 'poacher', ...alloc }, B), ['points']);
});

test('F001 CMD-01: values outside the limits, a missing name and an unknown background are refused', () => {
  const alloc = suggestedAllocation(bg('runner'));
  assert.deepEqual(creationProblems({ name: 'R', background: 'runner', ...alloc, skills: { ...alloc.skills, blades: 13, heavy: 1 } }, B), ['limits']);
  assert.deepEqual(creationProblems({ name: '  ', background: 'runner', ...alloc }, B), ['name']);
  assert.deepEqual(creationProblems({ name: 'A'.repeat(21), background: 'runner', ...alloc }, B), ['name']);
  assert.deepEqual(creationProblems({ name: 'R', background: 'knight', ...alloc }, B), ['background']);
  assert.deepEqual(creationProblems({ name: 'R', background: 'runner', ...alloc, attributes: { ...alloc.attributes, luck: 1 } }, B), ['limits']);
  assert.equal(ATTRIBUTES.length + SKILLS.length, 9);
});

test('F031 CMD-01: user names are 3–20 letters, digits or symbols without spaces, unique regardless of case', () => {
  for (const ok of ['kael', 'Kael_99', 'Æsir', 'x-y.z!', 'abc', 'a'.repeat(20)]) assert.ok(isValidUserName(ok), ok);
  for (const bad of ['ab', 'a'.repeat(21), 'two words', ' kael', '', 'tab\tname']) assert.ok(!isValidUserName(bad), bad);
  assert.equal(userNameKey('Kael'), userNameKey('kael'));
});

test('F031 CMD-01: a password is anything of at least 8 characters', () => {
  assert.ok(isValidPassword('12345678'));
  assert.ok(isValidPassword('åæø é  !'));
  assert.ok(!isValidPassword('1234567'));
});
