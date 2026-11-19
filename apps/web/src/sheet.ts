// Feature-004 VIEW-01 Character sheet: et gennemsigtigt overlay. Inventar og hotbar (Gear) kommer i fase 2.

import {
  ATTRIBUTES, ATTRIBUTE_NAMES, BALANCE as B, SKILLS, SKILL_NAMES, derivedStats, echoToNextMark, effectiveSkill,
  skillXpToNext, type Character, type SkillId,
} from '@maw/rules';
import type { CharacterView } from './api.ts';
import { esc } from './dom.ts';
import { showPlus } from './logic.ts';

const pct = (x: number) => `${Math.round(Math.max(0, Math.min(1, x)) * 100)}%`;
const one = (x: number) => (Math.round(x * 10) / 10).toString();

/** Reglerne regner på en hel karakter; uden udstyr, indtil Gear findes. */
function asCharacter(c: CharacterView): Character {
  return {
    name: c.name, background: c.background, level: c.mark, echo: c.echo, attributes: c.attributes,
    skills: c.skills as Character['skills'], attributePoints: c.attributePoints, skillPoints: c.skillPoints, gold: 0,
    potions: 0, rations: 0, equipment: { weapon: null, armour: null, ring: null }, inventory: [], tithes: 0, championships: 0,
  };
}

function weights(skill: SkillId): string {
  return Object.entries(B.skills.weights[skill])
    .map(([a, w]) => `${ATTRIBUTE_NAMES[a as keyof typeof ATTRIBUTE_NAMES]} ${Math.round((w as number) * 100)}%`)
    .join(', ');
}

export function sheetHtml(c: CharacterView, backgroundName: string): string {
  const ch = asCharacter(c);
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
  </div></div>`;
}
