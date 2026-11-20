// Feature-004 VIEW-01 Character sheet: et gennemsigtigt overlay med inventaret (Feature-007) og hotbaren (Feature-027).

import {
  ATTRIBUTES, ATTRIBUTE_NAMES, BALANCE as B, ECHO_ARTS, EQUIP_SLOTS, EQUIP_SLOT_NAMES, HOTBAR_KEYS, SKILLS, SKILL_NAMES,
  derivedStats, echoToNextMark, effectiveSkill, emptyEquipment, skillCap, skillXpToNext, type Character, type Item, type SkillId,
  type WeaponStats,
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
    potions: inv?.potions ?? 0, rations: inv?.rations ?? 0, equipment: inv?.equipment ?? emptyEquipment(),
    inventory: inv?.pack ?? [], tithes: 0, championships: 0,
  };
}

/** Under en Tithe: Drop i pakken og mærket for det, der er fundet i den (Feature-007 VIEW-01). */
export interface TitheMode {
  found: string[];
}

const FOUND = 'Found this Tithe – lost if you fall';

/** Feature-007 VIEW-01: en ring med Ring 1 og Ring 2, når begge ringpladser er optaget; ellers Equip. */
function equipButtons(item: Item, inv: PackView): string {
  if (item.slot === 'ring' && inv.equipment.ring1 && inv.equipment.ring2) {
    return `<button class="ghost small-btn" data-act="equip" data-id="${item.id}|ring1">Ring 1</button>
      <button class="ghost small-btn" data-act="equip" data-id="${item.id}|ring2">Ring 2</button>`;
  }
  return `<button class="ghost small-btn" data-act="equip" data-id="${item.id}">Equip</button>`;
}

/** Feature-007 VIEW-01 Inventory og Feature-027 VIEW-01: hotbaren nederst. */
function inventoryHtml(inv: PackView | null, selectedKey: string | null, tithe: TitheMode | null, ch: Character): string {
  if (!inv) return '<div class="box"><h3>Inventory</h3><p class="hint">The inventory is on its way…</p></div>';
  const equipped = EQUIP_SLOTS.map((slot) => {
    const item = inv.equipment[slot];
    const note = tithe?.found.includes(item?.id ?? '') ? FOUND : '';
    return item ? itemRow(item, `<button class="ghost small-btn" data-act="unequip" data-id="${slot}">Unequip</button>`, note, EQUIP_SLOT_NAMES[slot], ch)
      : `<li class="item"><div class="muted">${EQUIP_SLOT_NAMES[slot]}: empty</div></li>`;
  }).join('');
  const pack = inv.pack.length
    ? inv.pack.map((item) => itemRow(
        item,
        `${equipButtons(item, inv)}${tithe ? `<button class="ghost small-btn" data-act="drop" data-id="${item.id}">Drop</button>` : ''}`,
        tithe?.found.includes(item.id) ? FOUND : '',
        '',
        ch,
      )).join('')
    : '<li class="muted">Empty.</li>';
  const weapons = [inv.equipment.melee, inv.equipment.ranged, ...inv.pack].filter((i): i is Item => !!i && i.slot === 'weapon');
  const label = (key: string): string | null => {
    const slot = inv.hotbar[key as keyof typeof inv.hotbar];
    if (!slot) return null;
    if ('echoArt' in slot) return slot.echoArt;
    return weapons.find((w) => w.id === slot.weapon)?.name ?? '?';
  };
  const keys = HOTBAR_KEYS.map((k) => {
    const name = label(k);
    return `<button class="hotkey ${k === selectedKey ? 'selected' : ''}" data-act="hotbar-key" data-id="${k}"
        aria-label="Key ${k}: ${esc(name ?? 'empty')}" aria-pressed="${k === selectedKey}">
      <b>${k}</b><span>${name ? esc(name) : '<span class="muted">–</span>'}</span></button>`;
  }).join('');
  const choices = selectedKey
    ? `<div class="hotbar-choices"><span class="hint">Put on key ${selectedKey}:</span>
        ${weapons.map((w) => `<button class="ghost small-btn" data-act="hotbar-weapon" data-id="${w.id}">${esc(w.name)}</button>`).join('')}
        ${ECHO_ARTS.map((a) => `<button class="ghost small-btn" data-act="hotbar-art" data-id="${a}">${a}</button>`).join('')}
        <button class="ghost small-btn" data-act="hotbar-clear" data-id="${selectedKey}">Clear</button></div>`
    : '<p class="hint">Choose a key, then what to put on it.</p>';
  return `<div class="box"><h3>Equipped</h3><ul class="items">${equipped}</ul></div>
    <div class="box"><h3>Inventory ${inv.pack.length} / ${inv.capacity}</h3><ul class="items">${pack}</ul>
      <p class="hint">Potions ${inv.potions} · Rations ${inv.rations}</p></div>
    <div class="box"><h3>Hotbar</h3><div class="hotbar">${keys}</div>${choices}</div>`;
}

function weights(skill: SkillId): string {
  return Object.entries(B.skills.weights[skill])
    .map(([a, w]) => `${ATTRIBUTE_NAMES[a as keyof typeof ATTRIBUTE_NAMES]} ${Math.round((w as number) * 100)}%`)
    .join(', ');
}

export function sheetHtml(c: CharacterView, backgroundName: string, inv: PackView | null, selectedKey: string | null, message = '', tithe: TitheMode | null = null): string {
  const ch = asCharacter(c, inv);
  const d = derivedStats(ch, B);
  const need = echoToNextMark(c.mark, B);
  const attributeRows = ATTRIBUTES.map((a) => `<tr><td>${ATTRIBUTE_NAMES[a]}</td><td class="num">${c.attributes[a]}</td>
    <td class="num">${showPlus(c.attributePoints) ? `<button class="plus" data-act="spend-attribute" data-id="${a}" aria-label="Raise ${ATTRIBUTE_NAMES[a]}">+</button>` : ''}</td></tr>`).join('');
  // Feature-002: Mark'en sætter loftet over alle skills; ved loftet kan hverken erfaring eller point løfte dem.
  const cap = skillCap(ch, B);
  const skillRows = SKILLS.map((s) => {
    const sk = ch.skills[s];
    const progress = sk.level >= cap ? 1 : sk.xp / skillXpToNext(sk.level, B);
    return `<tr><td>${SKILL_NAMES[s]}<div class="progress"><i style="width:${pct(progress)}"></i></div>
      <div class="hint">Bonus from ${weights(s)}</div></td>
      <td class="num">${sk.level}<span class="hint"> / ${cap}</span><div class="hint">eff. ${one(effectiveSkill(ch, s, B))}${sk.level >= cap ? ' · Mark cap' : ''}</div></td>
      <td class="num">${showPlus(c.skillPoints) && sk.level < cap ? `<button class="plus" data-act="spend-skill" data-id="${s}" aria-label="Raise ${SKILL_NAMES[s]}">+</button>` : ''}</td></tr>`;
  }).join('');
  const points = [
    c.attributePoints ? `${c.attributePoints} attribute point${c.attributePoints > 1 ? 's' : ''}` : '',
    c.skillPoints ? `${c.skillPoints} skill point${c.skillPoints > 1 ? 's' : ''} (+${B.skills.levelsPerPoint} levels each)` : '',
  ].filter(Boolean);
  const damage = (w: WeaponStats) => `${one(w.min * w.damageMult)}–${one(w.max * w.damageMult)} · ${SKILL_NAMES[w.skill]} · ${w.cooldown.toFixed(2)}s`;
  return `<div class="overlay see-through"><div class="sheet">
    <header class="top"><div><h2>${esc(c.name)} · Mark ${c.mark}</h2><p class="muted">${esc(backgroundName)}</p></div>
      <button class="ghost" data-act="close">Close</button></header>
    <div class="msg">${esc(message)}</div>
    <div class="cols">
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
            <tr><td>${inv?.equipment.melee ? 'Melee damage' : 'Unarmed damage'}</td><td class="num">${damage(d.melee)}</td></tr>
            ${d.ranged ? `<tr><td>Ranged damage</td><td class="num">${damage(d.ranged)}</td></tr>` : ''}
            <tr><td>Echo Bolt</td><td class="num">${one(d.bolt.min * d.bolt.damageMult)}–${one(d.bolt.max * d.bolt.damageMult)} · ${d.bolt.focusCost} focus</td></tr>
            <tr><td>Critical chance</td><td class="num">${pct(d.critChance)}</td></tr>
            <tr><td>Hunger per minute</td><td class="num">${one(d.hungerDrain * 60)}</td></tr>
          </table>
        </div>
      </div>
      <div class="box">
        <h3>Skills</h3>
        <p class="hint">Skills grow when you use them, up to ${cap} at Mark ${c.mark}. Effective level = level + attribute bonus + items, at most the weapon's skill cap.</p>
        <table class="stats">${skillRows}</table>
      </div>
    </div>
    <div class="cols">${inventoryHtml(inv, selectedKey, tithe, ch)}</div>
  </div></div>`;
}
