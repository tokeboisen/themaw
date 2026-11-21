// Det, hver spiller får at se: snapshot, karakterskærm og resultat (Feature-010 VIEW-01, -004/-007/-027 og -016 VIEW-01),
// og "Tithe ended" til de andre contexts. Kun det, spilleren kan se, kommer med (planen, afsnit 8).

import type { ArenaEndedMessage, ArenaMatchEnded, ArenaView, CandidateView, EndedMessage, PartyView, SheetMessage, Snapshot, SnapshotEntity, TitheEnded } from '@maw/contracts';
import {
  BALANCE, BUFF_NAMES, arenaPayout, displayName, concealed, transparencyFor, arenaRing, chosenKey, crownsPurse, districtAt, echoToNextMark, giftCount, hiddenFrom, losesFound, sameParty, sealInfoAt,
  shownDepth, type Item, type Player, type SkillId, type Tithe, type TitheSummary,
} from '@maw/rules';

/** Hvad serveren har sendt til en spiller, så næste snapshot kun bærer det nye. */
export interface ViewState {
  depth: number;
  reset: boolean;
  sheetVersion: number;
  messages: number;
}

export function newViewState(t: Tithe): ViewState {
  // De sidste tre beskeder fra Mirrormaster vises i HUD'en (Feature-010 VIEW-01), også efter en genforbindelse.
  return { depth: 0, reset: true, sheetVersion: -1, messages: Math.max(0, t.messages.length - 3) };
}

const r2 = (x: number) => Math.round(x * 100) / 100;

function candidates(t: Tithe, p: Player): CandidateView[] {
  const list: CandidateView[] = t.players.map((x) => ({
    name: x.userName,
    depth: shownDepth(t, x),
    status: !x.end ? 'in' : x.end.kind === 'champion' ? 'champion' : x.end.kind === 'left' ? 'left' : x.end.kind === 'fell' ? 'fallen' : 'in',
    player: true,
    you: x.id === p.id,
  }));
  for (const r of t.rivals) list.push({ name: r.name, depth: shownDepth(t, r), status: r.status, player: false, you: false });
  return list;
}

/** Feature-034 VIEW-01 og Feature-035 VIEW-01: partiet, de andre spillere i Tithen og invitationerne. */
function party(t: Tithe, p: Player): PartyView {
  const r2_ = (x: number) => Math.round(x * 100) / 100;
  const inviteLeft = Math.max(0, (t.B ?? BALANCE).tithe.graceSeconds - t.time);
  return {
    inviteLeft: Math.ceil(inviteLeft),
    members: t.players
      .filter((x) => !x.end && sameParty(x, p))
      .map((x) => ({ id: x.id, name: x.userName, depth: x.depth, x: x.depth === p.depth ? r2_(x.x) : null, y: x.depth === p.depth ? r2_(x.y) : null, you: x === p })),
    players: t.players
      .filter((x) => !x.end && x !== p)
      .map((x) => ({ id: x.id, name: x.userName, inParty: sameParty(x, p), invited: t.invitations.some((i) => i.from === p.id && i.to === x.id) })),
    invitations: inviteLeft > 0
      ? t.invitations.filter((i) => i.to === p.id).map((i) => ({ from: i.from, name: t.players.find((x) => x.id === i.from)?.userName ?? '' }))
      : [],
  };
}

function area(t: Tithe, p: Player): Snapshot['area'] {
  const B = t.B ?? BALANCE;
  const d = districtAt(t, p.depth, p.x, p.y);
  return {
    reach: t.reach,
    reachName: t.reach === 'arena' ? 'The Arena' : B.reaches.find((r) => r.id === t.reach)?.name ?? '',
    ward: d === null ? null : (t.reach === 'woods' ? B.woods : B.city).wards[d - 1] ?? null,
    floor: t.depths[p.depth]?.floor ?? 1,
  };
}

export function snapshot(t: Tithe, p: Player, view: ViewState): Snapshot {
  const R = t.B.view.visionRadius;
  const dep = t.depths[p.depth]!;
  const map = dep.map;
  const explored = p.explored[p.depth] ?? new Uint8Array(map.w * map.h);
  const reset = view.reset || view.depth !== p.depth;
  const tiles: number[] = [];
  if (reset) {
    for (let i = 0; i < explored.length; i++) if (explored[i]) tiles.push(i, map.tiles[i]!);
  } else {
    for (const i of p.revealed) tiles.push(i, map.tiles[i]!);
  }
  p.revealed = [];
  view.reset = false;
  view.depth = p.depth;

  // Feature-045: arenaen er åben – alt ses, undtagen modstandere, der gemmer sig i en busk.
  const seen = (e: { x: number; y: number }, extra = 0.5) => t.reach === 'arena' || (e.x - p.x) ** 2 + (e.y - p.y) ** 2 <= (R + extra) ** 2;
  const ents: SnapshotEntity[] = [];
  for (const m of dep.monsters) {
    if (m.dead || !seen(m)) continue;
    const e: SnapshotEntity = {
      id: m.id, kind: 'monster', type: m.type, name: m.name, x: r2(m.x), y: r2(m.y), r: m.r, hp: Math.ceil(m.hp), maxHp: m.maxHp, flash: m.flash > 0,
      level: m.level, ...(m.def.color ? { color: m.def.color } : {}), ...(m.veteran ? { veteran: true } : {}),
    };
    if (m.def.warden) e.warden = true;
    const held = m.stunT > 0 ? 'stunned' : m.rootT > 0 ? 'rooted' : m.slowT > 0 ? 'slowed' : null;
    if (held) e.held = held;
    if (m.markT > 0) e.marked = true;
    // Feature-011 VIEW-01: kun nærkamp viser rækkevidden; monstre, der skyder, viser ingen sigtelinje.
    if (m.windup > 0 && !m.def.ranged) e.windup = { reach: (m.def.reach ?? 1) + (m.def.warden ? 0 : 0.2) };
    ents.push(e);
  }
  for (const r of t.rivals) {
    if (!r.real || r.status !== 'in' || r.depth !== p.depth || !seen(r)) continue;
    const e: SnapshotEntity = {
      id: r.id, kind: 'rival', name: r.name, x: r2(r.x), y: r2(r.y), r: r.r, hp: Math.ceil(r.hp), maxHp: r.maxHp, flash: r.flash > 0,
      color: r.color, hostile: r.aggressive || r.hostileTo.has(p.id),
    };
    if (r.windup > 0) e.windup = { reach: r.weapon.reach + 0.3 };
    ents.push(e);
  }
  for (const o of t.players) {
    if (o === p || o.end || o.depth !== p.depth || !seen(o)) continue;
    // Feature-013/-049: en skjult kandidat toner frem, når man kommer tættere på; længere væk ses den slet ikke.
    const clear = transparencyFor(t, o, p);
    if (clear >= 1) continue;
    // Feature-010 VIEW-01: spillere i syne viser deres brugernavn over hovedet.
    ents.push({
      id: o.id, kind: 'player', name: o.userName, x: r2(o.x), y: r2(o.y), r: o.r, hp: Math.ceil(o.hp), maxHp: o.maxHp, flash: o.flash > 0,
      party: sameParty(o, p), ...(o.side ? { side: o.side } : {}), ...(clear > 0 ? { alpha: r2(1 - clear), hidden: hiddenFrom(t, o, p) } : {}),
    });
  }
  const gate = map.gate && explored[map.gate.y * map.w + map.gate.x] ? { x: map.gate.x, y: map.gate.y, open: t.gateOpenFor.has(p.id) } : null;
  const msgs = t.messages.slice(view.messages).filter((m) => !m.to || m.to === p.id).map((m) => ({ who: m.who, text: m.text }));
  view.messages = t.messages.length;
  const s = p.stats;
  return {
    t: 'snap',
    time: r2(t.time),
    depth: p.depth,
    depths: t.B.tithe.depths,
    mapW: map.w,
    mapH: map.h,
    reset,
    tiles,
    you: {
      x: r2(p.x), y: r2(p.y), hp: r2(p.hp), maxHp: s.maxHp, stamina: r2(p.stamina), maxStamina: s.maxStamina, focus: r2(p.focus),
      maxFocus: s.maxFocus, hunger: r2(p.hunger), facing: [r2(p.facing.x), r2(p.facing.y)], dodge: r2(p.dodgeT),
      dodgeDir: [r2(p.dodgeDir.x), r2(p.dodgeDir.y)], swing: r2(p.swing), swingDir: [r2(p.swingDir.x), r2(p.swingDir.y)],
      swingArc: p.swingArc, swingReach: p.swingReach, flash: p.flash > 0, drawing: p.drawT > 0, mark: p.ch.level, echo: Math.floor(p.ch.echo),
      echoNext: echoToNextMark(p.ch.level, t.B), points: p.ch.attributePoints + p.ch.skillPoints, potions: p.ch.potions,
      focusPotions: p.ch.focusPotions ?? 0, rations: p.ch.rations, chosenKey: chosenKey(p), hotbar: p.hotbar, starving: p.hunger <= 0,
      status: [
        p.slowT > 0 ? 'Slowed' : '', p.stunT > 0 ? 'Stunned' : '', p.corrodeT > 0 ? 'Corroded' : '', ...p.buffs.map((b) => BUFF_NAMES[b.kind] ?? ''),
      ].filter(Boolean),
      cooldowns: {
        ...Object.fromEntries(Object.entries(p.artCd).map(([art, left]) => [art, r2(left ?? 0)])),
        ...(p.talentCd > 0 ? { talent: r2(p.talentCd) } : {}),
      },
      hidden: concealed(t, p),
    },
    ents,
    proj: dep.projectiles.filter((x) => seen(x, 1)).map((x) => ({ x: r2(x.x), y: r2(x.y), vx: r2(x.vx), vy: r2(x.vy), kind: x.kind })),
    zones: dep.zones.filter((z) => seen(z, z.r)).map((z) => ({ x: r2(z.x), y: r2(z.y), r: z.r, kind: z.kind, t: r2(z.t) })),
    loot: dep.loot.filter((l) => seen(l)).map((l) => ({ id: l.id, x: r2(l.x), y: r2(l.y), kind: l.kind, ...(l.item ? { rarity: l.item.rarity } : {}) })),
    caches: dep.caches.filter((c) => explored[Math.floor(c.y) * map.w + Math.floor(c.x)]).map((c) => ({ x: r2(c.x), y: r2(c.y), opened: c.opened })),
    gate,
    seal: sealInfoAt(t, p.depth, p.x, p.y),
    renown: p.record.renown,
    goldFound: p.record.goldFound,
    candidates: candidates(t, p),
    party: party(t, p),
    area: area(t, p),
    ...(t.arena ? { arena: arenaView(t, p) } : {}),
    interact: p.interact,
    fx: t.fx
      .filter((f) => f.depth === p.depth && (!f.to || f.to === p.id) && (f.x === undefined || f.y === undefined || seen({ x: f.x, y: f.y }, 2)))
      .map(({ depth: _d, to: _to, ...f }) => f),
    msgs,
  };
}

export function sheet(t: Tithe, p: Player): SheetMessage {
  const ch = p.ch;
  const found = [...ch.inventory, ...Object.values(ch.equipment)].filter((i): i is Item => !!i && i.found === t.id).map((i) => i.id);
  return {
    t: 'sheet',
    character: {
      id: p.characterId, name: ch.name, background: ch.background, mark: ch.level, echo: ch.echo, attributes: ch.attributes,
      skills: ch.skills, attributePoints: ch.attributePoints, skillPoints: ch.skillPoints,
    },
    inventory: {
      equipment: ch.equipment, pack: ch.inventory, potions: ch.potions, focusPotions: ch.focusPotions ?? 0, rations: ch.rations, hotbar: p.hotbar,
      capacity: p.stats.capacity,
    },
    found,
  };
}

/** Feature-016 EVT-04 for én spiller, med arbejdskopien som den er nu. */
export function titheEnded(t: Tithe, p: Player): TitheEnded {
  const ch = structuredClone(p.ch);
  return {
    titheId: t.id,
    titheName: t.name,
    characterId: p.characterId,
    userId: p.userId,
    outcome: { kind: p.end!.kind, name: p.end!.name },
    seconds: Math.round(p.end!.time),
    record: { ...p.record },
    start: structuredClone(p.start),
    character: { level: ch.level, echo: ch.echo, attributes: ch.attributes, skills: ch.skills, attributePoints: ch.attributePoints, skillPoints: ch.skillPoints },
    gear: {
      equipment: ch.equipment, pack: ch.inventory, potions: ch.potions, focusPotions: ch.focusPotions ?? 0, rations: ch.rations,
      hotbar: structuredClone(p.hotbar),
    },
  };
}

/** Feature-016 VIEW-01 Tithe results: regnet med de samme regler, som Gear, Market og Patronage bruger. */
export function results(t: Tithe, p: Player): EndedMessage {
  const end = p.end!;
  const lose = losesFound(end.kind);
  const ch = p.ch;
  const lostItems = lose
    ? [...ch.inventory, ...Object.values(ch.equipment)].filter((i): i is Item => !!i && i.found === t.id).map((i) => displayName(i, BALANCE))
    : [];
  const outcome = { kind: end.kind, name: end.name };
  const skills: TitheSummary['skills'] = {};
  for (const k of Object.keys(ch.skills) as SkillId[]) skills[k] = { from: p.start.skills[k], to: ch.skills[k].level };
  return {
    t: 'ended',
    kind: end.kind,
    summary: {
      tithe: ch.tithes + 1,
      outcome,
      seconds: Math.round(end.time),
      record: { ...p.record },
      purse: crownsPurse({ outcome, record: p.record }, t.B),
      goldFound: lose ? 0 : p.record.goldFound,
      goldLost: lose ? p.record.goldFound : 0,
      lostItems,
      gifts: giftCount(p.record.renown, t.B),
      marks: { from: p.start.mark, to: ch.level },
      skills,
    },
  };
}

/** Feature-045 VIEW-01: siderne, uret, nedtællingen og ringen, når den lukker sig. */
function arenaView(t: Tithe, p: Player): ArenaView {
  const A = t.B.arena;
  const sides = { 1: [] as { name: string; down: boolean }[], 2: [] as { name: string; down: boolean }[] };
  for (const x of t.players) if (x.side) sides[x.side].push({ name: x.userName, down: !!x.end });
  return {
    format: t.arena!.format,
    stake: t.arena!.stake,
    you: p.side,
    timeLeft: Math.max(0, Math.ceil(A.hardLimit - t.time)),
    countdown: Math.max(0, Math.ceil(A.countdown - t.time)),
    ring: t.time >= A.shrinkFrom ? (({ cx, cy, rx, ry }) => ({ cx, cy, rx: r2(rx), ry: r2(ry) }))(arenaRing(t.time, t.B)) : null,
    sides,
  };
}

/** Feature-045 EVT-04 Arena match ended: vinderens side og hver kæmpers udfald (Feature-046). */
export function arenaMatchEnded(t: Tithe): ArenaMatchEnded {
  const winner = t.arena!.result?.winner ?? null;
  return {
    matchId: t.id,
    name: t.name,
    stake: t.arena!.stake,
    winner,
    fighters: t.players.map((p) => ({
      userId: p.userId, userName: p.userName, characterId: p.characterId, side: p.side ?? 1,
      result: winner === null ? 'draw' : p.side === winner ? 'won' : 'lost',
    })),
  };
}

/** Feature-045 VIEW-02 Arena result: potten deles af vinderne (Feature-046); uafgjort giver indsatsen tilbage. */
export function arenaResult(t: Tithe, p: Player): ArenaEndedMessage {
  const ended = arenaMatchEnded(t);
  const me = ended.fighters.find((f) => f.userId === p.userId)!;
  const winners = ended.fighters.filter((f) => f.result === 'won').length;
  const payout = arenaPayout(ended.stake, ended.fighters.length, winners, me.result);
  const sides = { 1: [] as string[], 2: [] as string[] };
  for (const f of ended.fighters) sides[f.side].push(f.userName);
  return { t: 'arena-ended', result: me.result, winner: ended.winner, you: me.side, stake: ended.stake, payout, sides };
}
