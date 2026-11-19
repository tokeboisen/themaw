// Starter prototypen: skærme, spil-løkken og gemning i browseren.

import { BALANCE as B } from '../../balance.js';
import { createRng, randomSeed } from '../core/rng.js';
import {
  createCharacter, spendAttributePoint, spendSkillPoint, equipItem, unequipItem, dropItem, addEcho, echoToNextMark,
  SKILL_NAMES,
} from '../core/character.js';
import { newSave, buyItem, sellItem, buyConsumable, acceptGift, finishTithe, SAVE_VERSION } from '../core/rim.js';
import { createTithe, stepTithe, refreshStats, debug } from '../core/world.js';
import { createInput } from './input.js';
import { createRenderer } from './render.js';
import {
  createHud, characterView, forgeView, apothecaryView, patronsView, resultsView, backgroundCards,
} from './ui.js';

const SAVE_KEY = 'the-maw-prototype-save';
const TOUCH_KEY = 'the-maw-prototype-touch';
const STEP = 1 / 60;
const $ = (s) => document.querySelector(s);

const state = {
  save: null,
  screen: 'create',
  tithe: null,
  rimTab: 'character',
  background: 'miner',
  endTimer: 0,
  lastSeed: null,
  showXp: false,
  touch: false,
  message: '',
};

const input = createInput();
const renderer = createRenderer($('#view'), $('#minimap'));
const hud = createHud();

// --- Gemning ------------------------------------------------------------------------------------

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);
    return save && save.version === SAVE_VERSION ? save : null;
  } catch {
    return null;
  }
}

function persist() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state.save));
  } catch {
    // Gemning er ikke mulig (privat vindue); spillet virker stadig, indtil siden lukkes.
  }
}

function loadTouchPreference() {
  try {
    const v = localStorage.getItem(TOUCH_KEY);
    if (v !== null) return v === '1';
  } catch {
    // ignorer
  }
  return window.matchMedia('(pointer: coarse)').matches;
}

// --- Skærme -------------------------------------------------------------------------------------

function show(screen) {
  state.screen = screen;
  for (const s of ['create', 'rim', 'results', 'pause']) $(`#screen-${s}`).classList.toggle('hidden', s !== screen);
  const inTithe = screen === 'tithe' || screen === 'pause';
  $('#hud').classList.toggle('hidden', !inTithe);
  $('#touch').classList.toggle('hidden', screen !== 'tithe' || !state.touch);
  if (screen !== 'tithe') input.reset();
  if (screen === 'create') renderCreate();
  if (screen === 'rim') renderRim();
  if (screen === 'pause') renderPause();
}

function renderCreate() {
  $('#create-backgrounds').innerHTML = backgroundCards(B, state.background);
}

function renderRim() {
  const save = state.save;
  const ch = save.character;
  $('#rim-gold').textContent = `${ch.gold} gold`;
  const gifts = save.rim.gifts.length ? ` · ${save.rim.gifts.length} gift${save.rim.gifts.length > 1 ? 's' : ''} waiting` : '';
  $('#rim-sub').textContent = `${ch.name}, Mark ${ch.level} · next is Tithe #${ch.tithes + 1}${gifts}`;
  for (const b of document.querySelectorAll('#rim-tabs button')) b.classList.toggle('active', b.dataset.tab === state.rimTab);
  const views = { character: () => characterView(ch, B, 'rim'), forge: () => forgeView(save, B), apothecary: () => apothecaryView(save, B), patrons: () => patronsView(save, B) };
  $('#rim-content').innerHTML = `<div class="msg">${state.message}</div>${views[state.rimTab]()}`;
  state.message = '';
}

function renderPause() {
  $('#pause-content').innerHTML = characterView(state.tithe.ch, B, 'pause');
}

// --- Tithe --------------------------------------------------------------------------------------

function startTithe(seed = randomSeed()) {
  state.lastSeed = seed;
  state.tithe = createTithe(state.save.character, B, seed);
  state.tithe.god = $('#dbg-god').checked;
  state.endTimer = 0;
  renderer.reset();
  hud.reset();
  show('tithe');
}

function endTithe() {
  const t = state.tithe;
  const summary = finishTithe(state.save, t, B);
  persist();
  $('#results-content').innerHTML = resultsView(summary, state.save.character, B);
  state.tithe = null;
  show('results');
}

function handleEvents(t) {
  const p = t.player;
  for (const e of t.events) {
    if (e.type === 'float') renderer.float(e);
    else if (e.type === 'death') renderer.puff(e.x, e.y);
    else if (e.type === 'shake') renderer.shake(e.amount);
    else if (e.type === 'hurt') renderer.shake(Math.min(6, 1 + e.amount / 4));
    else if (e.type === 'mark') hud.toast(`Mark ${e.level}! Open ☰ to spend your points.`, 3);
    else if (e.type === 'skill' && e.level % 5 === 0) hud.toast(`${SKILL_NAMES[e.skill]} ${e.level}`, 1.6);
    else if (e.type === 'xp' && state.showXp) {
      renderer.float({ x: p.x + 0.6, y: p.y - 0.2, text: `+${e.amount.toFixed(2)} ${SKILL_NAMES[e.skill]}`, color: '#7fd1ff', size: 11 });
    }
  }
  t.events.length = 0;
}

let last = performance.now();
let acc = 0;
let infoAge = 0;

function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  tick(dt);
  requestAnimationFrame(loop);
}

// Én frame: input, simulering, tegning og HUD.
function tick(dt) {
  if (input.take('debug')) toggleDebug();
  const t = state.tithe;
  if (t && (state.screen === 'tithe' || state.screen === 'pause')) {
    if (input.take('pause')) {
      if (state.screen === 'tithe') show('pause');
      else show('tithe');
    }
    if (state.screen === 'tithe' && !t.outcome) {
      acc += dt;
      let snap = input.snapshot();
      let stepped = false;
      while (acc >= STEP) {
        stepTithe(t, STEP, snap);
        acc -= STEP;
        if (!stepped) {
          stepped = true;
          input.consumePresses();
          snap = { ...snap, dodge: false, potion: false, ration: false, interact: false };
        }
        if (t.outcome) break;
      }
    } else {
      acc = 0;
    }
    handleEvents(t);
    if (state.tithe === t) {
      renderer.draw(t, state.screen === 'tithe' ? dt : 0);
      hud.update(t, dt);
    }
    if (t.outcome && state.screen === 'tithe') {
      state.endTimer += dt;
      if (state.endTimer > 2.5) endTithe();
    }
  }

  infoAge += dt;
  if (infoAge > 0.5 && !$('#debug').classList.contains('hidden')) {
    infoAge = 0;
    updateDebugInfo();
  }
}

// --- Klik ---------------------------------------------------------------------------------------

function characterAction(ch, act, id) {
  if (act === 'attr') return spendAttributePoint(ch, id);
  if (act === 'skill') return spendSkillPoint(ch, id, B);
  if (act === 'equip') return equipItem(ch, id);
  if (act === 'unequip') {
    const ok = unequipItem(ch, id, B);
    if (!ok) state.message = 'Your inventory is full.';
    return ok;
  }
  if (act === 'drop') return !!dropItem(ch, id);
  return false;
}

$('#create-backgrounds').addEventListener('click', (e) => {
  const card = e.target.closest('[data-act="background"]');
  if (!card) return;
  state.background = card.dataset.id;
  renderCreate();
});

$('#create-go').addEventListener('click', () => {
  const name = $('#create-name').value.trim() || 'Nameless';
  const rng = createRng(randomSeed());
  state.save = newSave(createCharacter(name, state.background, rng, B), rng, B);
  persist();
  state.rimTab = 'character';
  show('rim');
});

$('#rim-tabs').addEventListener('click', (e) => {
  const tab = e.target.closest('[data-tab]');
  if (!tab) return;
  state.rimTab = tab.dataset.tab;
  renderRim();
});

$('#rim-content').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn || btn.disabled) return;
  const { act, id } = btn.dataset;
  const save = state.save;
  let result = null;
  if (act === 'buy') result = buyItem(save, id, B);
  else if (act === 'sell') sellItem(save, id, B);
  else if (act === 'buyc') result = buyConsumable(save, id, B);
  else if (act === 'gift') result = acceptGift(save, id, B);
  else characterAction(save.character, act, id);
  if (result && !result.ok) state.message = result.reason;
  persist();
  renderRim();
});

$('#rim-descend').addEventListener('click', () => startTithe());

$('#results-go').addEventListener('click', () => {
  state.rimTab = state.save.rim.gifts.length ? 'patrons' : 'character';
  show('rim');
});

$('#pause-content').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn || !state.tithe) return;
  if (characterAction(state.tithe.ch, btn.dataset.act, btn.dataset.id)) refreshStats(state.tithe);
  renderPause();
});

$('#pause-resume').addEventListener('click', () => show('tithe'));
$('#btn-pause').addEventListener('click', () => show('pause'));

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.screen === 'tithe' && state.tithe && !state.tithe.outcome) show('pause');
});

// --- Debug --------------------------------------------------------------------------------------

function toggleDebug() {
  $('#debug').classList.toggle('hidden');
  updateDebugInfo();
}

function updateDebugInfo() {
  const t = state.tithe;
  const ch = state.save?.character;
  const lines = [];
  if (t) {
    lines.push(`seed ${t.seed}`, `time ${t.time.toFixed(0)}s · depth ${t.depth}`, `monsters ${t.depths[t.depth].monsters.length}`);
    lines.push(`pos ${t.player.x.toFixed(1)}, ${t.player.y.toFixed(1)}`);
  } else if (state.lastSeed != null) {
    lines.push(`last seed ${state.lastSeed}`);
  }
  if (ch) lines.push(`Mark ${ch.level} · echo ${Math.floor(ch.echo)}/${echoToNextMark(ch.level, B)}`);
  $('#dbg-info').textContent = lines.join('\n');
}

$('#btn-debug').addEventListener('click', toggleDebug);
$('#dbg-xp').addEventListener('change', (e) => {
  state.showXp = e.target.checked;
});
$('#dbg-god').addEventListener('change', (e) => {
  if (state.tithe) state.tithe.god = e.target.checked;
});
$('#dbg-touch').addEventListener('change', (e) => {
  state.touch = e.target.checked;
  try {
    localStorage.setItem(TOUCH_KEY, state.touch ? '1' : '0');
  } catch {
    // ignorer
  }
  $('#touch').classList.toggle('hidden', state.screen !== 'tithe' || !state.touch);
});

document.querySelector('.dbg-buttons').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-dbg]');
  if (!btn) return;
  const t = state.tithe;
  const ch = state.save?.character;
  const act = btn.dataset.dbg;
  if (act === 'reset') {
    if (!window.confirm('Delete the character and start over?')) return;
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      // ignorer
    }
    state.save = null;
    state.tithe = null;
    show('create');
    return;
  }
  if (!ch) return;
  if (act === 'gold') ch.gold += 200;
  if (act === 'mark') {
    if (t) debug.mark(t);
    else addEcho(ch, echoToNextMark(ch.level, B) - ch.echo, B);
  }
  if (act === 'replay' && state.lastSeed != null && state.screen !== 'create') {
    startTithe(state.lastSeed);
    return;
  }
  if (t) {
    if (act === 'heal') debug.heal(t);
    if (act === 'reveal') debug.reveal(t);
    if (act === 'kill') debug.killAll(t);
    if (act === 'depth') debug.nextDepth(t);
    if (act === 'win') debug.win(t);
  }
  if (!t) {
    persist();
    if (state.screen === 'rim') renderRim();
  }
  if (state.screen === 'pause') renderPause();
  updateDebugInfo();
});

// --- Start --------------------------------------------------------------------------------------

// Til fejlsøgning i browserens konsol: __maw.state.tithe viser den igangværende Tithe.
// __maw.tick(sekunder) kører én frame i hånden, f.eks. når fanen ikke er synlig.
window.__maw = { state, B, tick };

state.touch = loadTouchPreference();
$('#dbg-touch').checked = state.touch;
state.save = load();
show(state.save ? 'rim' : 'create');
requestAnimationFrame(loop);
