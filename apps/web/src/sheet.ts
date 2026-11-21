// Feature-004 VIEW-01 Character sheet: et gennemsigtigt overlay med tre faner – Character, Equipment (Feature-007) og
// Spells (Feature-048). Equipment og Spells har hotbaren øverst (Feature-027): et våben eller en kendt Echo Art markeres
// med et klik og lægges på en tast med 1–8. Equipment sammenligner karakterens værdier med og uden en ting.

import {
  ATTRIBUTES, ATTRIBUTE_NAMES, BALANCE as B, ECHO_ARTS, EQUIP_SLOTS, EQUIP_SLOT_NAMES, HOTBAR_KEYS, SKILLS, SKILL_NAMES,
  artRequirement, derivedStats, displayName, effectiveSkill as effSkill, hotbarSlotName, revealChance, knowsArt, skillName, skillWeights, talentOf, echoToNextMark, effectiveSkill, emptyEquipment, skillCap, skillXpToNext, targetSlot,
  type Character, type EchoArt, type Hotbar, type HotbarKey, type Item, type SkillId, type TalentId, type WeaponStats,
} from '@maw/rules';
import type { CharacterView, PackView } from './api.ts';
import { esc } from './dom.ts';
import { itemRow } from './items.ts';
import { showPlus } from './logic.ts';

const pct = (x: number) => `${Math.round(Math.max(0, Math.min(1, x)) * 100)}%`;
const one = (x: number) => (Math.round(x * 10) / 10).toString();

/** Reglerne regner på en hel karakter: Characters' egenskaber og skills med Gears udstyr. */
export function asCharacter(c: CharacterView, inv: PackView | null): Character {
  return {
    name: c.name, background: c.background, level: c.mark, echo: c.echo, attributes: c.attributes,
    skills: c.skills as Character['skills'], attributePoints: c.attributePoints, skillPoints: c.skillPoints, gold: 0,
    potions: inv?.potions ?? 0, focusPotions: inv?.focusPotions ?? 0, rations: inv?.rations ?? 0, equipment: inv?.equipment ?? emptyEquipment(),
    inventory: inv?.pack ?? [], tithes: 0, championships: 0,
  };
}

/** Under en Tithe: Drop i pakken og mærket for det, der er fundet i den (Feature-007 VIEW-01). */
export interface TitheMode {
  found: string[];
}

const FOUND = 'Found this Tithe – lost if you fall';

/** Feature-050 VIEW-01: under en Tithe har en uidentificeret ting Reveal med chancen og prisen i focus. */
function revealButton(item: Item, tithe: TitheMode | null, ch: Character): string {
  if (!tithe || item.identified !== false) return '';
  const chance = Math.round(revealChance(effSkill(ch, 'reveal', B), item, B) * 100);
  return `<button class="ghost small-btn" data-act="reveal" data-id="${item.id}" title="${B.reveal.focus} focus · ${chance} % chance">Reveal ${chance}%</button>`;
}

/** Feature-050 VIEW-01: i the Rim står, hvordan en uidentificeret ting identificeres. */
function unidentifiedNote(item: Item, tithe: TitheMode | null): string {
  return !tithe && item.identified === false ? 'Unidentified – reveal it in a Tithe or pay Hesta at the Forge' : '';
}

/** Feature-007 VIEW-01: en ring med Ring 1 og Ring 2, når begge ringpladser er optaget; ellers Equip. */
function equipButtons(item: Item, inv: PackView): string {
  if (item.slot === 'ring' && inv.equipment.ring1 && inv.equipment.ring2) {
    return `<button class="ghost small-btn" data-act="equip" data-id="${item.id}|ring1">Ring 1</button>
      <button class="ghost small-btn" data-act="equip" data-id="${item.id}|ring2">Ring 2</button>`;
  }
  return `<button class="ghost small-btn" data-act="equip" data-id="${item.id}">Equip</button>`;
}

/** Feature-004 VIEW-01: karakterskærmens faner. */
export type SheetTab = 'character' | 'equipment' | 'spells';
export const SHEET_TABS: { id: SheetTab; name: string }[] = [
  { id: 'character', name: 'Character' }, { id: 'equipment', name: 'Equipment' }, { id: 'spells', name: 'Spells' },
];

/** Hvad karakterskærmen viser: fanen og siden i spellbooken (Levels 1–3, 4–6 eller 7–9). */
export interface SheetView {
  tab: SheetTab;
  spellPage: number;
}

/**
 * Feature-027 VIEW-01: det markerede – et våben (w:<id>), en anden ting (i:<id>, kun til sammenligning) eller en Echo
 * Art (a:<navn>).
 */
export type Mark = string | null;

/** Det, det markerede lægges på en tast som; null, når det ikke kan på en tast. */
export function markOf(mark: Mark): { itemId: string } | { echoArt: EchoArt } | { talent: TalentId } | null {
  if (!mark) return null;
  if (mark.startsWith('w:')) return { itemId: mark.slice(2) };
  if (mark.startsWith('t:') && mark.slice(2) in B.talents) return { talent: mark.slice(2) as TalentId };
  if (mark.startsWith('a:') && (ECHO_ARTS as readonly string[]).includes(mark.slice(2))) return { echoArt: mark.slice(2) as EchoArt };
  return null;
}

/** Feature-007 VIEW-01: tingen, en markering sammenlignes med. */
export function compareIdOf(mark: Mark): string | null {
  return mark && (mark.startsWith('w:') || mark.startsWith('i:')) ? mark.slice(2) : null;
}

/** Feature-027: den første tomme tast, eller null. */
export function firstFreeKey(hotbar: Hotbar): HotbarKey | null {
  return HOTBAR_KEYS.find((k) => !hotbar[k]) ?? null;
}

/** Feature-027: beskeden, når Equip ikke finder en tom tast. */
export const NO_FREE_KEY = 'No free key – mark the art and press 1–8.';

const markAttrs = (id: string, mark: Mark) =>
  `data-act="mark" data-id="${esc(id)}" role="button" tabindex="0" aria-pressed="${mark === id}"`;

/** Feature-027 VIEW-01: hotbaren øverst på karakterskærmen, så den altid ses uden at scrolle. */
function hotbarHtml(inv: PackView | null, mark: Mark): string {
  if (!inv) return '';
  const weapons = [inv.equipment.melee, inv.equipment.ranged, ...inv.pack].filter((i): i is Item => !!i && i.slot === 'weapon');
  const marked = markOf(mark);
  const weaponName = (id: string) => { const w = weapons.find((x) => x.id === id); return w ? displayName(w, B) : '?'; };
  const markedName = !marked ? '' : hotbarSlotName('itemId' in marked ? { weapon: marked.itemId } : marked, weaponName, B);
  const keys = HOTBAR_KEYS.map((k) => {
    const slot = inv.hotbar[k];
    const name = !slot ? null : hotbarSlotName(slot, weaponName, B);
    return `<div class="hotkey-cell">
      <button class="hotkey ${marked ? 'target' : ''}" data-act="hotbar-key" data-id="${k}" aria-label="Key ${k}: ${esc(name ?? 'empty')}">
        <b>${k}</b><span>${name ? esc(name) : '<span class="muted">–</span>'}</span></button>
      ${name ? `<button class="hotkey-clear" data-act="hotbar-clear" data-id="${k}" aria-label="Clear key ${k}" title="Clear key ${k}">×</button>` : ''}
    </div>`;
  }).join('');
  const hint = markedName
    ? `<b>${esc(markedName)}</b> is marked. Press 1–8 to put it on a key.`
    : 'Click a weapon or a known Echo Art to mark it, then press 1–8.';
  return `<div class="box sheet-hotbar"><div class="hotbar">${keys}</div><p class="hint">${hint}</p></div>`;
}

/**
 * Feature-007 VIEW-01 Inventory: alle ting kan markeres og sammenlignes; et markeret våben kan lægges på en tast
 * (Feature-027).
 */
function inventoryHtml(inv: PackView | null, mark: Mark, tithe: TitheMode | null, ch: Character): string {
  if (!inv) return '<div class="box"><h3>Inventory</h3><p class="hint">The inventory is on its way…</p></div>';
  const markable = (item: Item, html: string) => {
    const id = `${item.slot === 'weapon' ? 'w' : 'i'}:${item.id}`;
    return html.replace('<li class="item">', `<li class="item markable ${mark === id ? 'marked' : ''}" ${markAttrs(id, mark)} data-compare="${esc(item.id)}">`);
  };
  const equipped = EQUIP_SLOTS.map((slot) => {
    const item = inv.equipment[slot];
    const note = tithe?.found.includes(item?.id ?? '') ? FOUND : '';
    return item ? markable(item, itemRow(item, `${revealButton(item, tithe, ch)}<button class="ghost small-btn" data-act="unequip" data-id="${slot}">Unequip</button>`, unidentifiedNote(item, tithe) || note, EQUIP_SLOT_NAMES[slot], ch))
      : `<li class="item"><div class="muted">${EQUIP_SLOT_NAMES[slot]}: empty</div></li>`;
  }).join('');
  const pack = inv.pack.length
    ? inv.pack.map((item) => markable(item, itemRow(
        item,
        `${revealButton(item, tithe, ch)}${equipButtons(item, inv)}${tithe ? `<button class="ghost small-btn" data-act="drop" data-id="${item.id}">Drop</button>` : ''}`,
        unidentifiedNote(item, tithe) || (tithe?.found.includes(item.id) ? FOUND : ''),
        '',
        ch,
      ))).join('')
    : '<li class="muted">Empty.</li>';
  return `<div class="box"><h3>Equipped</h3><ul class="items">${equipped}</ul></div>
    <div class="box"><h3>Inventory ${inv.pack.length} / ${inv.capacity}</h3><ul class="items">${pack}</ul>
      <p class="hint">Potions ${inv.potions} · Focus potions ${inv.focusPotions ?? 0} · Rations ${inv.rations}</p></div>`;
}

const KIND_NAMES = { damage: 'Damage', defence: 'Defence', control: 'Control', movement: 'Movement', party: 'Party' } as const;

/** Feature-048: spellbookens sider med tre levels hver. */
export const SPELL_PAGES = [[1, 2, 3], [4, 5, 6], [7, 8, 9]] as const;

/**
 * Feature-048 VIEW-01 Spellbook: levels side om side, tre ad gangen, så intet skal scrolles. De kendte arts kan markeres,
 * lægges på den første tomme tast med Equip og tages af med Unequip (Feature-027); de andre viser deres krav.
 */
function spellbookHtml(ch: Character, hotbar: Hotbar, mark: Mark, page: number): string {
  const echo = ch.skills.echo.level;
  // Feature-049/-027: baggrundens talent står øverst med Equip og Unequip som en Echo Art.
  const talent = talentOf(ch.background, B);
  const tdef = B.talents[talent];
  const tid = `t:${talent}`;
  const tkey = HOTBAR_KEYS.find((k) => { const slot = hotbar[k]; return !!slot && 'talent' in slot; }) ?? null;
  const talentCard = `<div class="art talent-card markable ${mark === tid ? 'marked' : ''}" ${markAttrs(tid, mark)}>
    <div class="art-top"><span class="art-name">${esc(tdef.name)}</span><span class="art-kind">Talent · ${tdef.cost} ${tdef.resource} · ${tdef.cooldown}s</span>
      <span class="art-actions">${tkey ? `<span class="key-badge">Key ${tkey}</span><button class="ghost small-btn" data-act="art-unequip" data-id="${tkey}">Unequip</button>`
        : `<button class="ghost small-btn" data-act="talent-equip" data-id="${talent}">Equip</button>`}</span></div>
    <div class="art-text">${esc(tdef.text)}</div></div>`;
  const levels = SPELL_PAGES[Math.max(0, Math.min(SPELL_PAGES.length - 1, page))]!;
  const keyOf = (a: EchoArt) => HOTBAR_KEYS.find((k) => {
    const slot = hotbar[k];
    return !!slot && 'echoArt' in slot && slot.echoArt === a;
  }) ?? null;
  const columns = levels.map((level) => {
    const arts = ECHO_ARTS.filter((a) => B.echoArts[a].level === level).map((a) => {
      const def = B.echoArts[a];
      const known = knowsArt(ch, a, B);
      const id = `a:${a}`;
      const key = keyOf(a);
      const cooldown = a === 'Echo Bolt' ? `${B.combat.echoBolt.cooldown}s` : `${def.cooldown}s`;
      const actions = !known
        ? `<span class="hint unmet">Echo Arts ${artRequirement(a, B)}</span>`
        : key
          ? `<span class="key-badge">Key ${key}</span><button class="ghost small-btn" data-act="art-unequip" data-id="${key}">Unequip</button>`
          : `<button class="ghost small-btn" data-act="art-equip" data-id="${esc(a)}">Equip</button>`;
      return `<li class="art ${known ? 'markable' : 'unknown'} ${mark === id ? 'marked' : ''} k-${def.kind}" ${known ? markAttrs(id, mark) : ''}>
        <div class="art-top"><span class="art-name">${esc(a)}</span><span class="art-kind">${KIND_NAMES[def.kind]}</span>
          <span class="art-actions">${actions}</span></div>
        <div class="art-text"><span class="art-cost">${def.focus} focus · ${cooldown}</span> · ${esc(def.text)}</div></li>`;
    }).join('');
    return `<div class="art-level"><div class="slot-label">Level ${level} · Echo Arts ${10 * (level - 1)}</div><ul class="arts">${arts}</ul></div>`;
  }).join('');
  const pages = SPELL_PAGES.map((p, i) => `<button class="${i === page ? 'active' : ''}" data-act="spell-page" data-id="${i}">Levels ${p[0]}–${p[p.length - 1]}</button>`).join('');
  return `<div class="box spellbook">
    ${talentCard}
    <div class="spellbook-head"><nav class="tabs spell-pages">${pages}</nav>
      <span class="hint">Known in the mind, not written in a book. Echo Arts ${echo}.</span></div>
    <div class="art-columns">${columns}</div></div>`;
}

// --- Feature-007 VIEW-01: værdierne og sammenligningen ---------------------------------------------

interface StatRow {
  label: string;
  value: string;
}

const damageText = (w: WeaponStats) => `${one(w.min * w.damageMult)}–${one(w.max * w.damageMult)} · ${SKILL_NAMES[w.skill]} · ${w.cooldown.toFixed(2)}s`;

/** Karakterens værdier i samme rækkefølge hver gang, så to sæt kan sammenlignes række for række. */
export function statRows(ch: Character): StatRow[] {
  const d = derivedStats(ch, B);
  return [
    ...ATTRIBUTES.map((a) => ({ label: ATTRIBUTE_NAMES[a], value: String(d.attributes[a]) })),
    { label: 'Life', value: String(d.maxHp) },
    { label: 'Stamina', value: `${d.maxStamina} (+${one(d.staminaRegen)}/s)` },
    { label: 'Focus', value: `${d.maxFocus} (+${one(d.focusRegen)}/s)` },
    { label: 'Armour', value: String(d.armour) },
    { label: 'Melee damage', value: damageText(d.melee) },
    { label: 'Ranged damage', value: d.ranged ? damageText(d.ranged) : '–' },
    { label: 'Echo Bolt', value: `${one(d.bolt.min * d.bolt.damageMult)}–${one(d.bolt.max * d.bolt.damageMult)} · ${d.bolt.cooldown.toFixed(2)}s` },
    { label: 'Critical chance', value: pct(d.critChance) },
    // Feature-007: lasten og hvor meget dyrere stamina er.
    { label: 'Load', value: `${one(d.load)} / ${one(d.carry)}` },
    { label: 'Stamina costs', value: d.staminaCostMult > 1 ? `+${Math.round((d.staminaCostMult - 1) * 100)}%` : 'normal' },
  ];
}

/** Karakteren med tingen taget på – eller, for en ting, der allerede er taget på, uden den. */
export function withItem(ch: Character, itemId: string): Character | null {
  const c = structuredClone(ch);
  const index = c.inventory.findIndex((i) => i.id === itemId);
  if (index >= 0) {
    const item = c.inventory[index]!;
    const slot = targetSlot(c.equipment, item, B);
    const old = c.equipment[slot];
    c.equipment[slot] = item;
    c.inventory.splice(index, 1);
    if (old) c.inventory.push(old);
    return c;
  }
  for (const slot of EQUIP_SLOTS) {
    const item = c.equipment[slot];
    if (item?.id !== itemId) continue;
    c.equipment[slot] = null;
    c.inventory.push(item);
    return c;
  }
  return null;
}

/** Værdierne i hvidt; under hver, der ændrer sig, værdien med tingen i gult. */
export function statsTable(base: StatRow[], other: StatRow[] | null): string {
  return `<table class="stats">${base.map((row, i) => {
    const changed = other && other[i] && other[i]!.value !== row.value ? `<div class="cmp">${esc(other[i]!.value)}</div>` : '';
    return `<tr><td>${row.label}</td><td class="num">${esc(row.value)}${changed}</td></tr>`;
  }).join('')}</table>`;
}

/** Den seneste Equipment-fanes tabeller: uden sammenligning og for hver ting, så et peg kan skifte dem uden at tegne alt. */
let compareTables: { base: string; byItem: Map<string, string> } = { base: '', byItem: new Map() };

/** Feature-007 VIEW-01: tabellen, når spilleren peger på tingen `itemId` (eller ingen). */
export function statsHtmlFor(itemId: string | null): string {
  return (itemId && compareTables.byItem.get(itemId)) || compareTables.base;
}

function statsBox(ch: Character, mark: Mark): string {
  const base = statRows(ch);
  const byItem = new Map<string, string>();
  const worn = new Set(EQUIP_SLOTS.map((slot) => ch.equipment[slot]?.id).filter(Boolean));
  for (const item of [...EQUIP_SLOTS.map((slot) => ch.equipment[slot]), ...ch.inventory]) {
    if (!item) continue;
    // Feature-007: sammenligningen udelader en uidentificeret tings skjulte affixes.
    if (item.identified === false && worn.has(item.id)) continue;
    const other = withItem(ch, item.id);
    if (!other) continue;
    if (item.identified === false) {
      const copy = [...EQUIP_SLOTS.map((s) => other.equipment[s]), ...other.inventory].find((i) => i?.id === item.id);
      if (copy) copy.affixes = [];
    }
    byItem.set(item.id, statsTable(base, statRows(other)));
  }
  compareTables = { base: statsTable(base, null), byItem };
  return `<div class="box sheet-stats"><h3>Stats</h3><div id="sheet-stats">${statsHtmlFor(compareIdOf(mark))}</div>
    <p class="hint">Point at an item: white is now, <span class="cmp-inline">yellow</span> is with it equipped (or without it, if it is equipped).</p></div>`;
}

function weights(skill: SkillId, background: string): string {
  return Object.entries(skillWeights(skill, background, B))
    .map(([a, w]) => `${ATTRIBUTE_NAMES[a as keyof typeof ATTRIBUTE_NAMES]} ${Math.round((w as number) * 100)}%`)
    .join(', ');
}

export function sheetHtml(
  c: CharacterView, backgroundName: string, inv: PackView | null, mark: Mark, message = '', tithe: TitheMode | null = null,
  view: SheetView = { tab: 'character', spellPage: 0 },
): string {
  const ch = asCharacter(c, inv);
  const tabs = SHEET_TABS.map((t) => `<button class="${t.id === view.tab ? 'active' : ''}" data-act="sheet-tab" data-id="${t.id}">${t.name}</button>`).join('');
  const body = view.tab === 'equipment'
    ? `${hotbarHtml(inv, mark)}<div class="cols equipment-cols"><div>${inventoryHtml(inv, mark, tithe, ch)}</div>${statsBox(ch, mark)}</div>`
    : view.tab === 'spells'
      ? `${hotbarHtml(inv, mark)}${spellbookHtml(ch, inv?.hotbar ?? {}, mark, view.spellPage)}`
      : characterHtml(c, ch);
  return `<div class="overlay see-through"><div class="sheet">
    <header class="top sheet-head"><h2>${esc(c.name)} · Mark ${c.mark} <span class="muted">${esc(backgroundName)}</span></h2>
      <nav class="tabs sheet-tabs">${tabs}</nav>
      <button class="ghost" data-act="close">Close</button></header>
    <div class="msg">${esc(message)}</div>
    ${body}
  </div></div>`;
}

/** Feature-004 VIEW-01: fanen Character – Mark, Echo, attributter, kampværdier og skills. */
function characterHtml(c: CharacterView, ch: Character): string {
  const d = derivedStats(ch, B);
  const need = echoToNextMark(c.mark, B);
  const attributeRows = ATTRIBUTES.map((a) => `<tr><td>${ATTRIBUTE_NAMES[a]}</td><td class="num">${c.attributes[a]}${d.attributes[a] !== c.attributes[a] ? `<span class="hint"> (${d.attributes[a]} with items)</span>` : ''}</td>
    <td class="num">${showPlus(c.attributePoints) ? `<button class="plus" data-act="spend-attribute" data-id="${a}" aria-label="Raise ${ATTRIBUTE_NAMES[a]}">+</button>` : ''}</td></tr>`).join('');
  // Feature-002: Mark'en sætter loftet over alle skills; ved loftet kan hverken erfaring eller point løfte dem.
  const cap = skillCap(ch, B);
  const skillRows = SKILLS.map((s) => {
    const sk = ch.skills[s];
    const progress = sk.level >= cap ? 1 : sk.xp / skillXpToNext(sk.level, B);
    return `<tr><td>${skillName(s, ch.background, B)}<div class="progress"><i style="width:${pct(progress)}"></i></div>
      <div class="hint">Bonus from ${weights(s, ch.background)}</div></td>
      <td class="num">${sk.level}<span class="hint"> / ${cap}</span><div class="hint">eff. ${one(effectiveSkill(ch, s, B))}${sk.level >= cap ? ' · Mark cap' : ''}</div></td>
      <td class="num">${showPlus(c.skillPoints) && sk.level < cap ? `<button class="plus" data-act="spend-skill" data-id="${s}" aria-label="Raise ${skillName(s, ch.background, B)}">+</button>` : ''}</td></tr>`;
  }).join('');
  const points = [
    c.attributePoints ? `${c.attributePoints} attribute point${c.attributePoints > 1 ? 's' : ''}` : '',
    c.skillPoints ? `${c.skillPoints} skill point${c.skillPoints > 1 ? 's' : ''} (+${B.skills.levelsPerPoint} levels each)` : '',
  ].filter(Boolean);
  return `<div class="cols">
      <div>
        <div class="box">
          <div class="muted">Echo ${Math.floor(c.echo)} / ${need} to the next Mark</div>
          <div class="progress echo"><i style="width:${pct(c.echo / need)}"></i></div>
          ${points.length ? `<p class="points">Unspent: ${points.join(' · ')}</p>` : ''}
          <table class="stats">${attributeRows}</table>
        </div>
        <div class="box">
          <h3>Combat</h3>
          <table class="stats">
            <tr><td>Life</td><td class="num">${d.maxHp}</td></tr>
            <tr><td>Stamina</td><td class="num">${d.maxStamina} (+${one(d.staminaRegen)}/s)</td></tr>
            <tr><td>Focus</td><td class="num">${d.maxFocus} (+${one(d.focusRegen)}/s)</td></tr>
            <tr><td>Armour</td><td class="num">${d.armour}</td></tr>
            <tr><td>${ch.equipment.melee ? 'Melee damage' : 'Unarmed damage'}</td><td class="num">${damageText(d.melee)}</td></tr>
            ${d.ranged ? `<tr><td>Ranged damage</td><td class="num">${damageText(d.ranged)}</td></tr>` : ''}
            <tr><td>Echo Bolt</td><td class="num">${one(d.bolt.min * d.bolt.damageMult)}–${one(d.bolt.max * d.bolt.damageMult)} · ${d.bolt.focusCost} focus</td></tr>
            <tr><td>Critical chance</td><td class="num">${pct(d.critChance)}</td></tr>
            <tr><td>Hunger per minute</td><td class="num">${one(d.hungerDrain * 60)}</td></tr>
          </table>
        </div>
      </div>
      <div class="box">
        <h3>Skills</h3>
        <p class="hint">Skills grow when you use them, up to ${cap} at Mark ${c.mark}. Effective level = level + attribute bonus + items.</p>
        <table class="stats">${skillRows}</table>
      </div>
    </div>`;
}
