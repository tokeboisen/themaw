// Partier og spillere mod spillere: scenarierne i Feature-034 Form a party, -035 Answer an invitation, -011 (party og
// Player defeated), -015 (hele partiet som Champion) og -018 (guldet, der spildes).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BALANCE as B, answerInvitation, createCharacter, createRng, createTithe, invitePlayer, leaveParty, sameParty, setInput,
  stepTithe, testing, type Hotbar, type Player, type Tithe,
} from '../src/index.ts';

const DT = 1 / 30;

function tithe(players = 2): Tithe {
  const t = createTithe({
    id: 'T-party',
    name: 'Ashfall',
    seed: 3,
    players: Array.from({ length: players }, (_, i) => {
      const character = createCharacter(['Kael', 'Brann', 'Vessa'][i] ?? `P${i}`, 'miner', createRng(i + 1), B);
      const hotbar: Hotbar = { '1': { weapon: character.equipment.melee!.id } };
      return { userId: `u${i + 1}`, userName: ['kael', 'brann', 'vessa'][i] ?? `p${i}`, characterId: `c${i + 1}`, character, hotbar };
    }),
  }, B);
  for (const dep of Object.values(t.depths)) dep.monsters = [];
  for (const r of t.rivals) r.status = 'fallen';
  return t;
}

const [KAEL, BRANN, VESSA] = [0, 1, 2];
const pl = (t: Tithe, i: number) => t.players[i]!;

/** Stiller to spillere side om side efter nådetiden. */
function sideBySide(t: Tithe, a: Player, b: Player): void {
  t.time = B.tithe.graceSeconds + 1;
  b.depth = a.depth;
  b.x = a.x + 0.6;
  b.y = a.y;
  a.facing = { x: 1, y: 0 };
}

test('F034 scenario "Kael invites Brann" 8 seconds after the start', () => {
  const t = tithe();
  t.time = 8;
  assert.equal(invitePlayer(t, 'u1', 'u2'), null);
  assert.deepEqual(t.invitations.map((i) => [i.from, i.to]), [['u1', 'u2']]);
});

test('F034 scenario "Too late to invite": after 20 seconds nobody can be invited, and invitations lapse', () => {
  const t = tithe();
  t.time = 5;
  invitePlayer(t, 'u1', 'u2');
  t.time = 25;
  assert.equal(invitePlayer(t, 'u1', 'u2'), 'tooLate');
  stepTithe(t, DT);
  assert.deepEqual(t.invitations, []);
  assert.equal(answerInvitation(t, 'u2', 'u1', true), 'invalid');
});

test('F035 scenario "Brann accepts": Kael and Brann are one party, and Kael is told', () => {
  const t = tithe();
  t.time = 5;
  invitePlayer(t, 'u1', 'u2');
  assert.equal(answerInvitation(t, 'u2', 'u1', true), null);
  assert.ok(sameParty(pl(t, KAEL), pl(t, BRANN)));
  assert.ok(t.messages.some((m) => m.to === 'u1' && m.text === 'brann joined the party.'));
});

test('F035 scenario "Brann declines": Kael sees "brann declined."', () => {
  const t = tithe();
  t.time = 5;
  invitePlayer(t, 'u1', 'u2');
  assert.equal(answerInvitation(t, 'u2', 'u1', false), null);
  assert.ok(!sameParty(pl(t, KAEL), pl(t, BRANN)));
  assert.ok(t.messages.some((m) => m.to === 'u1' && m.text === 'brann declined.'));
});

test('F035 CMD-01: accepting leaves the party the player was in', () => {
  const t = tithe(3);
  t.time = 5;
  invitePlayer(t, 'u1', 'u2');
  answerInvitation(t, 'u2', 'u1', true);
  invitePlayer(t, 'u3', 'u2');
  answerInvitation(t, 'u2', 'u3', true);
  assert.ok(sameParty(pl(t, BRANN), pl(t, VESSA)));
  assert.ok(!sameParty(pl(t, BRANN), pl(t, KAEL)));
});

test('F011 scenario "A party member is never hit", and a player outside the party is', () => {
  const t = tithe();
  t.time = 5;
  invitePlayer(t, 'u1', 'u2');
  answerInvitation(t, 'u2', 'u1', true);
  const [kael, brann] = [pl(t, KAEL), pl(t, BRANN)];
  sideBySide(t, kael, brann);
  const hp = brann.hp;
  setInput(t, kael.id, { moveX: 0, moveY: 0, attack: true });
  stepTithe(t, DT);
  assert.equal(brann.hp, hp);
});

test('F034 scenario "Kael leaves the party": Brann can strike Kael', () => {
  const t = tithe();
  t.time = 5;
  invitePlayer(t, 'u1', 'u2');
  answerInvitation(t, 'u2', 'u1', true);
  const [kael, brann] = [pl(t, KAEL), pl(t, BRANN)];
  leaveParty(t, kael.id);
  assert.ok(!sameParty(kael, brann));
  sideBySide(t, brann, kael);
  const hp = kael.hp;
  setInput(t, brann.id, { moveX: 0, moveY: 0, attack: true });
  stepTithe(t, DT);
  assert.ok(kael.hp < hp);
});

test('F011: another player is only aimed at when nothing else is near', () => {
  const t = tithe();
  const [kael, brann] = [pl(t, KAEL), pl(t, BRANN)];
  sideBySide(t, kael, brann);
  const gnawer = testing.makeMonster(t, 'gnawer', kael.x, kael.y + 0.9, 1);
  t.depths[kael.depth]!.monsters.push(gnawer);
  kael.stats.weapon.arc = 10; // et smalt sving rammer kun det, der sigtes på
  const hp = brann.hp;
  setInput(t, kael.id, { moveX: 0, moveY: 0, attack: true });
  stepTithe(t, DT);
  assert.ok(gnawer.hp < gnawer.maxHp);
  assert.equal(brann.hp, hp);
});

test('F011 EVT-06 and F018 scenario "A defeat spills gold": 10–20 % of 200 gold on the floor, and a Player kill', () => {
  const t = tithe();
  const [kael, brann] = [pl(t, KAEL), pl(t, BRANN)];
  sideBySide(t, kael, brann);
  brann.ch.gold = 200;
  const dep = t.depths[kael.depth]!;
  testing.kill(t, dep, kael, brann);
  assert.equal(brann.end?.kind, 'fell');
  assert.equal(brann.end?.name, 'kael');
  const [defeat] = t.defeats;
  assert.ok(defeat && defeat.gold >= 20 && defeat.gold <= 40, String(defeat?.gold));
  assert.deepEqual({ ...defeat, gold: 0 }, { userId: 'u2', characterId: 'c2', byUserId: 'u1', byCharacterId: 'c1', gold: 0 });
  assert.equal(dep.loot.find((l) => l.kind === 'gold')?.amount, defeat!.gold);
  assert.equal(kael.record.playersDefeated, 1);
  assert.equal(kael.record.renown, B.renown.rival);
});

test('F015 scenario "The whole party is Champion"', () => {
  const t = tithe(3);
  t.time = 5;
  invitePlayer(t, 'u1', 'u2');
  answerInvitation(t, 'u2', 'u1', true);
  const [kael, brann, vessa] = [pl(t, KAEL), pl(t, BRANN), pl(t, VESSA)];
  testing.enterDepth(t, kael, 3);
  const dep = t.depths[3]!;
  const foreman = testing.makeMonster(t, 'foreman', kael.x + 1, kael.y, 3);
  dep.monsters.push(foreman);
  testing.kill(t, dep, kael, foreman);
  const gate = dep.map.gate!;
  kael.x = gate.x + 0.5;
  kael.y = gate.y + 1.2;
  stepTithe(t, DT);
  testing.claimTithe(t, kael);
  assert.equal(kael.end?.kind, 'champion');
  assert.equal(brann.end?.kind, 'champion'); // Brann is still in the Tithe, in depth 1
  assert.equal(vessa.end?.kind, 'rival-champion');
});
