// Feature-004 VIEW-01 Character sheet: et gennemsigtigt overlay med inventaret (Feature-007) og hotbaren (Feature-027).

import {
  ATTRIBUTES, ATTRIBUTE_NAMES, BALANCE as B, ECHO_ARTS, HOTBAR_KEYS, SKILLS, SKILL_NAMES, SLOT_NAMES, derivedStats,
  echoToNextMark, effectiveSkill, skillXpToNext, type Character, type Item, type SkillId, type Slot,
} from '@maw/rules';
import type { CharacterView, InventoryView } from './api.ts';
import { esc } from './dom.ts';
import { itemRow } from './items.ts';
import { showPlus } from './logic.ts';

const pct = (x: number) => `${Math.round(Math.max(0, Math.min(1, x)) * 100)}%`;
const one = (x: number) => (Math.round(x * 10) / 10).toString();

/** Reglerne regner på en hel karakter: Characters' egenskaber og skills med Gears udstyr. */
function asCharacter(c: CharacterView, inv: InventoryView | null): Character {
  return {
    name: c.name, background: c.background, level: c.mark, echo: c.echo, attributes: c.attributes,
    skills: c.skills as Character['skills'], attributePoints: c.attributePoints, skillPoints: c.skillPoints, gold: 0,
    potions: inv?.potions ?? 0, rations: inv?.rations ?? 0, equipment: inv?.equipment ?? { weapon: null, armour: null, ring: null },
    inventory: inv?.pack ?? [], tithes: 0, championships: 0,
  };
}

/** Feature-007 VIEW-01 Inventory og Feature-027 VIEW-01: hotbaren nederst. */
function inventoryHtml(inv: InventoryView | null, selectedKey: string | null): string {
  if (!inv) return '<div class="box"><h3>Inventory</h3><p class="hint">The inventory is on its way…</p></div>';
  const slots: Slot[] = ['weapon', 'armour', 'ring'];
  const equipped = slots.map((slot) => {
    const item = inv.equipment[slot];
    return item ? itemRow(item, `<button class="ghost small-btn" data-act="unequip" data-id="${slot}">Unequip</button>`)
      : `<li class="item"><div class="muted">${SLOT_NAMES[slot]}: empty</div></li>`;
  }).join('');
  const pack = inv.pack.length
    ? inv.pack.map((item) => itemRow(item, `<button class="ghost small-btn" data-act="equip" data-id="${item.id}">Equip</button>`)).join('')
    : '<li class="muted">Empty.</li>';
  const weapons = [inv.equipment.weapon, ...inv.pack].filter((i): i is Item => !!i && i.slot === 'weapon');
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

export function sheetHtml(c: CharacterView, backgroundName: string, inv: InventoryView | null, selectedKey: string | null, message = ''): string {
  const ch = asCharacter(c, inv);
  const d = derivedStats(ch, B);
  const need = echoToNextMark(c.mark, B);
  const attributeRows = ATTRIBUTES.map((a) => `<tr><td>${ATTRIBUTE_NAMES[a]}</td><td class="num">${c.attributes[a]}</td>
    <td class="num">${showPlus(c.attributePoints) ? `<button class="plus" data-act="spend-attribute" data-id="${a}" aria-label="Raise ${ATTRIBUTE_NAMES[a]}">+</button>` : ''}</td></tr>`).join('');
  const skillRows = SKILLS.map((s) => {
    const sk = ch.skills[s];
    const progress = sk.level >= B.skills.max ? 1 : sk.xp / skillXpToNext(sk.level, B);
    return `<tr><td>${SKILL_NAMES[s]}<div class="progress"><i style="width:${pct(progress)}"></i></div>
      <div class="hint">Bonus from ${weights(s)}</div></td>
      <td class="num">${sk.level}<div class="hint">eff. ${one(effectiveSkill(ch, s, B))}</div></td>
      <td class="num">${showPlus(c.skillPoints) ? `<button class="plus" data-act="spend-skill" data-id="${s}" aria-label="Raise ${SKILL_NAMES[s]}">+</button>` : ''}</td></tr>`;
  }).join('');
  const points = [
    c.attributePoints ? `${c.attributePoints} attribute point${c.attributePoints > 1 ? 's' : ''}` : '',
    c.skillPoints ? `${c.skillPoints} skill point${c.skillPoints > 1 ? 's' : ''} (+${B.skills.levelsPerPoint} levels each)` : '',
  ].filter(Boolean);
  const w = d.weapon;
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
            <tr><td>Weapon damage</td><td class="num">${one(w.min * w.damageMult)}–${one(w.max * w.damageMult)} · ${SKILL_NAMES[w.skill]}</td></tr>
            <tr><td>Attack time</td><td class="num">${w.cooldown.toFixed(2)}s</td></tr>
            <tr><td>Echo Bolt</td><td class="num">${one(d.bolt.min * d.bolt.damageMult)}–${one(d.bolt.max * d.bolt.damageMult)} · ${d.bolt.focusCost} focus</td></tr>
            <tr><td>Critical chance</td><td class="num">${pct(d.critChance)}</td></tr>
            <tr><td>Hunger per minute</td><td class="num">${one(d.hungerDrain * 60)}</td></tr>
          </table>
        </div>
      </div>
      <div class="box">
        <h3>Skills</h3>
        <p class="hint">Skills grow when you use them. Effective level = level + attribute bonus + items.</p>
        <table class="stats">${skillRows}</table>
      </div>
    </div>
    <div class="cols">${inventoryHtml(inv, selectedKey)}</div>
  </div></div>`;
}
