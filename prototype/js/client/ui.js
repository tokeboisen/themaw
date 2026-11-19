// Skærmene som HTML: karakter, smedje, apotek, sponsorer, resultat og HUD.
// Knapper har data-act og data-id; main.js lytter på klik.

import {
  ATTRIBUTES, ATTRIBUTE_NAMES, SKILLS, SKILL_NAMES, derivedStats, effectiveSkill, itemBonuses,
  skillXpToNext, echoToNextMark,
} from '../core/character.js';
import { describeItem, sellValue, SLOTS, SLOT_NAMES, RARITY_NAMES } from '../core/items.js';
import { sealInfo } from '../core/world.js';

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pct = (x) => `${Math.round(x * 100)}%`;
const fmt1 = (x) => (Math.round(x * 10) / 10).toString();

export function backgroundCards(B, selected) {
  return B.backgrounds
    .map((bg) => {
      const attrs = Object.entries(bg.attributes).map(([a, v]) => `+${v} ${ATTRIBUTE_NAMES[a]}`).join(', ');
      const top = Object.entries(bg.skills).sort((a, b) => b[1] - a[1])[0];
      const weapon = B.items.bases[bg.weapon].name;
      return `<button class="card ${bg.id === selected ? 'selected' : ''}" data-act="background" data-id="${bg.id}">
        <h4>${esc(bg.name)}</h4><p>${esc(bg.text)}</p>
        <small>${attrs} · ${SKILL_NAMES[top[0]]} ${top[1]} · ${esc(weapon)}</small></button>`;
    })
    .join('');
}

function itemRow(item, B, actions) {
  const lines = describeItem(item, B).join(' · ');
  const found = item.found ? '<div class="found">Found this Tithe – lost if you fall</div>' : '';
  return `<li><div><div class="name r-${item.rarity}">${esc(item.name)}</div>
    <div class="lines">${SLOT_NAMES[item.slot]} · ${RARITY_NAMES[item.rarity]} · ${esc(lines)}</div>${found}</div>
    <div class="actions">${actions}</div></li>`;
}

function weightText(skill, B) {
  return Object.entries(B.skills.weights[skill])
    .map(([a, w]) => `${ATTRIBUTE_NAMES[a]} ${Math.round(w * 100)}%`)
    .join(', ');
}

// mode: 'rim' (byen) eller 'pause' (under en Tithe)
export function characterView(ch, B, mode) {
  const d = derivedStats(ch, B);
  const bonuses = itemBonuses(ch);
  const bg = B.backgrounds.find((b) => b.id === ch.background);
  const need = echoToNextMark(ch.level, B);
  const attrRows = ATTRIBUTES.map((a) => {
    const bonus = bonuses.attributes[a] ? ` <span class="muted">(+${bonuses.attributes[a]})</span>` : '';
    const plus = ch.attributePoints > 0 ? `<button class="plus" data-act="attr" data-id="${a}">+</button>` : '';
    return `<tr><td>${ATTRIBUTE_NAMES[a]}</td><td class="num">${ch.attributes[a]}${bonus}</td><td class="num">${plus}</td></tr>`;
  }).join('');
  const skillRows = SKILLS.map((s) => {
    const sk = ch.skills[s];
    const eff = effectiveSkill(ch, s, B, bonuses);
    const frac = sk.level >= B.skills.max ? 1 : sk.xp / skillXpToNext(sk.level, B);
    const plus = ch.skillPoints > 0 && sk.level < B.skills.max ? `<button class="plus" data-act="skill" data-id="${s}">+</button>` : '';
    return `<tr><td>${SKILL_NAMES[s]}<div class="progress"><i style="width:${pct(frac)}"></i></div>
      <div class="lines muted" style="font-size:11px">Bonus from ${weightText(s, B)}</div></td>
      <td class="num">${sk.level}<div class="muted" style="font-size:11px">eff. ${fmt1(eff)}</div></td><td class="num">${plus}</td></tr>`;
  }).join('');
  const w = d.weapon;
  const avg = ((w.min + w.max) / 2) * w.damageMult;
  const equipped = SLOTS.map((slot) => {
    const item = ch.equipment[slot];
    if (!item) return `<li><div><div class="name muted">${SLOT_NAMES[slot]}: empty</div></div></li>`;
    return itemRow(item, B, `<button class="small" data-act="unequip" data-id="${slot}">Unequip</button>`);
  }).join('');
  const inv = ch.inventory.length
    ? ch.inventory
        .map((item) => {
          let actions = `<button class="small" data-act="equip" data-id="${item.id}">Equip</button>`;
          if (mode === 'pause') actions += `<button class="small" data-act="drop" data-id="${item.id}">Drop</button>`;
          return itemRow(item, B, actions);
        })
        .join('')
    : '<li class="muted">Empty.</li>';
  const points = [];
  if (ch.attributePoints) points.push(`${ch.attributePoints} attribute point${ch.attributePoints > 1 ? 's' : ''}`);
  if (ch.skillPoints) points.push(`${ch.skillPoints} skill point${ch.skillPoints > 1 ? 's' : ''} (+${B.skills.levelsPerPoint} levels each)`);

  return `<div class="cols">
    <div>
      <div class="box">
        <h3>${esc(ch.name)} · Mark ${ch.level}</h3>
        <p class="note">${esc(bg ? bg.name : '')} · ${ch.tithes} Tithe${ch.tithes === 1 ? '' : 's'} · Champion ${ch.championships}×</p>
        <div class="note">Echo ${Math.floor(ch.echo)} / ${need} to the next Mark</div>
        <div class="progress"><i style="width:${pct(ch.echo / need)};background:var(--echo)"></i></div>
        ${points.length ? `<p style="color:var(--gold)">Unspent: ${points.join(' · ')}</p>` : ''}
        <table class="stats">${attrRows}</table>
      </div>
      <div class="box" style="margin-top:12px">
        <h3>Skills</h3>
        <p class="note">Skills grow when you use them. Effective level = level + attribute bonus + items.</p>
        <table class="stats">${skillRows}</table>
      </div>
      <div class="box" style="margin-top:12px">
        <h3>Combat</h3>
        <table class="stats">
          <tr><td>Life</td><td class="num">${d.maxHp}</td></tr>
          <tr><td>Stamina</td><td class="num">${d.maxStamina} (+${fmt1(d.staminaRegen)}/s)</td></tr>
          <tr><td>Focus</td><td class="num">${d.maxFocus} (+${fmt1(d.focusRegen)}/s)</td></tr>
          <tr><td>Armour</td><td class="num">${d.armour} (−${pct(d.damageReduction)} damage)</td></tr>
          <tr><td>Weapon damage</td><td class="num">${fmt1(w.min * w.damageMult)}–${fmt1(w.max * w.damageMult)} (avg ${fmt1(avg)})</td></tr>
          <tr><td>Attack time</td><td class="num">${w.cooldown.toFixed(2)}s · ${SKILL_NAMES[w.skill]}</td></tr>
          <tr><td>Echo Bolt</td><td class="num">${fmt1(d.bolt.min * d.bolt.damageMult)}–${fmt1(d.bolt.max * d.bolt.damageMult)} · ${d.bolt.focusCost} focus</td></tr>
          <tr><td>Critical chance</td><td class="num">${pct(d.critChance)}</td></tr>
          <tr><td>Hunger per minute</td><td class="num">${fmt1(d.hungerDrain * 60)}</td></tr>
        </table>
      </div>
    </div>
    <div>
      <div class="box"><h3>Equipped</h3><ul class="items">${equipped}</ul></div>
      <div class="box" style="margin-top:12px">
        <h3>Inventory ${ch.inventory.length} / ${d.capacity}</h3>
        <ul class="items">${inv}</ul>
        <p class="note">Potions ${ch.potions} · Rations ${ch.rations}</p>
      </div>
    </div>
  </div>`;
}

export function forgeView(save, B) {
  const ch = save.character;
  const stock = save.rim.stock.length
    ? save.rim.stock
        .map((item) =>
          itemRow(item, B, `<span class="gold" style="font-size:13px">${item.value}g</span>
            <button class="small" data-act="buy" data-id="${item.id}" ${ch.gold < item.value ? 'disabled' : ''}>Buy</button>`),
        )
        .join('')
    : '<li class="muted">Hesta has nothing left. New stock arrives after the next Tithe.</li>';
  const inv = ch.inventory.length
    ? ch.inventory
        .map((item) =>
          itemRow(item, B, `<span class="gold" style="font-size:13px">${sellValue(item, B)}g</span>
            <button class="small" data-act="sell" data-id="${item.id}">Sell</button>`),
        )
        .join('')
    : '<li class="muted">Nothing to sell. Only items in your inventory can be sold; unequip first.</li>';
  return `<p class="note">Hesta Varn, the smith: "Steel for the Branded. Coin first."</p>
    <div class="cols">
      <div class="box"><h3>For sale</h3><ul class="items">${stock}</ul></div>
      <div class="box"><h3>Your inventory</h3><ul class="items">${inv}</ul></div>
    </div>`;
}

export function apothecaryView(save, B) {
  const ch = save.character;
  const max = B.character.maxConsumables;
  return `<p class="note">Mother Quill: "Drink before you need it, child. Eat before you starve."</p>
    <div class="box"><ul class="items">
      <li><div><div class="name">Healing Draught</div><div class="lines">Restores ${pct(B.combat.potionHeal)} of your life. You have ${ch.potions} / ${max}.</div></div>
        <div class="actions"><span class="gold" style="font-size:13px">${B.rim.potionPrice}g</span>
        <button class="small" data-act="buyc" data-id="potion" ${ch.gold < B.rim.potionPrice || ch.potions >= max ? 'disabled' : ''}>Buy</button></div></li>
      <li><div><div class="name">Ration</div><div class="lines">Restores ${B.hunger.rationRestores} hunger. You have ${ch.rations} / ${max}.</div></div>
        <div class="actions"><span class="gold" style="font-size:13px">${B.rim.rationPrice}g</span>
        <button class="small" data-act="buyc" data-id="ration" ${ch.gold < B.rim.rationPrice || ch.rations >= max ? 'disabled' : ''}>Buy</button></div></li>
    </ul></div>`;
}

export function patronsView(save, B) {
  const gifts = save.rim.gifts;
  const list = gifts.length
    ? gifts
        .map((g) => {
          if (g.kind === 'gold') {
            return `<li><div><div class="name">${esc(g.house)} sends ${g.gold} gold</div></div>
              <div class="actions"><button class="small" data-act="gift" data-id="${g.id}">Accept</button></div></li>`;
          }
          return itemRow(g.item, B, `<span class="note">${esc(g.house)}</span><button class="small" data-act="gift" data-id="${g.id}">Accept</button>`);
        })
        .join('')
    : '<li class="muted">No gifts are waiting.</li>';
  const last = save.rim.lastResult;
  return `<p class="note">The agents of the Noble Houses watch every Tithe through the Mirrors. One gift for every ${B.rim.giftPerRenown} Renown
    (at most ${B.rim.maxGifts}). The crowd loves kill streaks, defeated rivals, new depths and the Warden.</p>
    ${last ? `<p class="note">Your last Tithe earned ${last.record.renown} Renown.</p>` : ''}
    <div class="box"><ul class="items">${list}</ul></div>`;
}

export function resultsView(summary, ch, B) {
  const o = summary.outcome;
  const r = summary.record;
  let title;
  let cls;
  let text;
  if (o.type === 'champion') {
    title = 'You are the Champion!';
    cls = 'win';
    text = 'You walked through the gate. Aurum chants your name, and the Crown pays its purse.';
  } else if (o.type === 'rival-champion') {
    title = `${esc(o.name)} is the Champion`;
    cls = 'lose';
    text = 'The Tithe is over. The Brand drags you back to the Rim, with everything you found.';
  } else {
    title = 'You fell';
    cls = 'lose';
    text = `Slain by ${esc(o.name)}. The Brand drags you back up. The Maw is not finished with you.`;
  }
  const mins = `${Math.floor(summary.seconds / 60)}:${String(summary.seconds % 60).padStart(2, '0')}`;
  const skills = Object.entries(summary.skills)
    .filter(([, s]) => s.to !== s.from)
    .map(([k, s]) => `<tr><td>${SKILL_NAMES[k]}</td><td class="num">${s.from} → <span class="up">${s.to}</span></td></tr>`)
    .join('');
  const lost = summary.lostItems.length
    ? `<h3>Lost</h3><p class="note">${summary.lostItems.map(esc).join(', ')}${summary.goldLost ? ` and ${summary.goldLost} gold` : ''}</p>`
    : summary.goldLost
      ? `<h3>Lost</h3><p class="note">${summary.goldLost} gold</p>`
      : '';
  return `<h1 class="results-title ${cls}">${title}</h1>
    <p class="lead">${text}</p>
    <div class="box"><table class="stats">
      <tr><td>Tithe</td><td class="num">#${summary.tithe}</td></tr>
      <tr><td>Time</td><td class="num">${mins}</td></tr>
      <tr><td>Deepest depth</td><td class="num">${r.maxDepth} / ${B.tithe.depths}</td></tr>
      <tr><td>Monsters slain</td><td class="num">${r.kills}</td></tr>
      <tr><td>Rivals defeated</td><td class="num">${r.rivalsDefeated}</td></tr>
      <tr><td>Renown</td><td class="num">${r.renown}</td></tr>
      <tr><td>Gold found${summary.goldLost ? ' (lost)' : ''}</td><td class="num">${summary.goldLost ? summary.goldLost : summary.goldFound}</td></tr>
      <tr><td>The Crown's Purse</td><td class="num gold" style="font-size:15px">${summary.purse}g</td></tr>
      <tr><td>Sponsor gifts waiting</td><td class="num">${summary.gifts}</td></tr>
    </table></div>
    <h3>Progress</h3>
    <div class="box"><table class="stats">
      <tr><td>Mark</td><td class="num">${summary.marks.from} → <span class="${summary.marks.to > summary.marks.from ? 'up' : ''}">${summary.marks.to}</span></td></tr>
      ${skills || '<tr><td class="muted">No skill grew this time.</td><td></td></tr>'}
    </table></div>
    ${lost}
    <p class="note">You now have ${ch.gold} gold.</p>`;
}

// --- HUD ----------------------------------------------------------------------------------------

export function createHud() {
  const $ = (s) => document.querySelector(s);
  const bars = {
    hp: $('#hud .bar.hp'), stamina: $('#hud .bar.stamina'), focus: $('#hud .bar.focus'),
    hunger: $('#hud .bar.hunger'), echo: $('#hud .bar.echo'),
  };
  const els = {
    points: $('#hud-points'), depth: $('#hud-depth'), seal: $('#hud-seal'), renown: $('#hud-renown'),
    rivals: $('#hud-rivals'), log: $('#log'), toast: $('#toast'), prompt: $('#prompt'),
    interact: document.querySelector('[data-act="interact"]'),
    potion: document.querySelector('[data-act="potion"] b'),
    ration: document.querySelector('[data-act="ration"] b'),
  };
  let toastTimer = 0;
  let lastRivals = '';
  let lastLog = '';

  const setBar = (b, value, max, text) => {
    b.firstElementChild.style.width = pct(Math.max(0, Math.min(1, value / max)));
    b.lastElementChild.textContent = text;
  };

  return {
    update(t, dt) {
      const p = t.player;
      const s = t.stats;
      const ch = t.ch;
      setBar(bars.hp, p.hp, s.maxHp, `Life ${Math.ceil(p.hp)} / ${s.maxHp}`);
      setBar(bars.stamina, p.stamina, s.maxStamina, `Stamina ${Math.floor(p.stamina)}`);
      setBar(bars.focus, p.focus, s.maxFocus, `Focus ${Math.floor(p.focus)}`);
      setBar(bars.hunger, p.hunger, t.B.hunger.max, p.hunger <= 0 ? 'Starving!' : `Hunger ${Math.ceil(p.hunger)}`);
      setBar(bars.echo, ch.echo, echoToNextMark(ch.level, t.B), '');
      const pts = [];
      if (ch.attributePoints || ch.skillPoints) pts.push(`Mark ${ch.level} · points to spend (☰)`);
      else pts.push(`Mark ${ch.level}`);
      els.points.textContent = pts.join('');

      els.depth.textContent = `${t.depth === t.B.tithe.depths ? "The Foreman's Hall" : 'The Old Mines'} · Depth ${t.depth} / ${t.B.tithe.depths}`;
      const seal = sealInfo(t);
      if (seal && seal.sealed) {
        els.seal.textContent = 'SEALED – get out!';
        els.seal.className = 'sealed';
      } else if (seal) {
        const left = Math.max(0, Math.ceil(seal.left));
        els.seal.textContent = `Seals in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
        els.seal.className = '';
      } else {
        els.seal.textContent = t.wardenAlive ? 'Slay the Foreman' : t.depths[t.depth].map.gateOpen ? 'The gate is open' : '';
        els.seal.className = '';
      }
      els.renown.textContent = `Renown ${t.record.renown} · Gold ${t.record.goldFound}`;

      const rivals = t.rivals
        .map((r) => {
          const where = r.status === 'fallen' ? 'fallen' : r.status === 'champion' ? 'Champion' : `D${r.depth}`;
          return `<li class="${r.status}"><span style="color:${r.color}">${esc(r.name)}</span><span>${where}</span></li>`;
        })
        .join('');
      if (rivals !== lastRivals) {
        els.rivals.innerHTML = rivals;
        lastRivals = rivals;
      }

      const recent = t.messages.slice(-3);
      const logHtml = recent
        .map((m) => `<div class="${m.who === 'The Maw' ? 'maw' : ''} ${t.time - m.time > 9 ? 'old' : ''}"><b>${esc(m.who)}:</b> ${esc(m.text)}</div>`)
        .join('');
      if (logHtml !== lastLog) {
        els.log.innerHTML = logHtml;
        lastLog = logHtml;
      }

      const action = t.interact === 'descend' ? 'Descend' : t.interact === 'gate' ? 'Claim the Tithe' : null;
      els.interact.classList.toggle('hidden', !action);
      if (action) els.interact.textContent = action;
      els.prompt.classList.toggle('show', !!action);
      if (action) els.prompt.textContent = `${action} – press F`;
      els.potion.textContent = ch.potions;
      els.ration.textContent = ch.rations;

      if (toastTimer > 0) {
        toastTimer -= dt;
        if (toastTimer <= 0) els.toast.classList.remove('show');
      }
    },
    toast(text, seconds = 2.2) {
      els.toast.textContent = text;
      els.toast.classList.add('show');
      toastTimer = seconds;
    },
    reset() {
      lastRivals = '';
      lastLog = '';
      toastTimer = 0;
      els.toast.classList.remove('show');
    },
  };
}
