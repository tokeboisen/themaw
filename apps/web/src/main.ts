// Webappen. Fase 1: Sign in (F031, F032), Characters (F026, F038), Create character (F001), karakterskærmen (F004) og
// Account (F033). Fase 2: the Rim med Forge (F019), Apothecary (F020) og Patrons' Hall (F024), guldet (F018), og
// inventar og hotbar på karakterskærmen (F007, F027). Teksterne er på engelsk og citeret fra featurene.

import { MESSAGES } from '@maw/contracts';
import {
  ATTRIBUTES, ATTRIBUTE_NAMES, BALANCE as B, SKILLS, SKILL_NAMES, canLower, canRaise, isValidPassword, isValidUserName,
  lower, pointsLeft, raise, suggestedAllocation, type Allocation, type PointKind,
} from '@maw/rules';
import { api, type BackgroundView, type CharacterView } from './api.ts';
import { $, esc, onAction } from './dom.ts';
import { deleteConfirmation, screenAfterSignIn, screenOnReload, type Screen } from './logic.ts';
import { apothecaryHtml, forgeHtml, patronsHtml, type RimData, type RimTab } from './rim.ts';
import { sheetHtml } from './sheet.ts';

type Overlay = null | 'sheet' | 'account' | { confirmDelete: string };

const state = {
  screen: 'signin' as Screen,
  userName: '',
  signinMode: 'login' as 'login' | 'create',
  characters: [] as CharacterView[],
  activeId: null as string | null,
  backgrounds: [] as BackgroundView[],
  create: { background: 'miner', alloc: null as Allocation | null, name: '', message: '' },
  overlay: null as Overlay,
  rim: { tab: 'forge' as RimTab, data: { gold: 0, stock: [], inventory: null, gifts: [] } as RimData, message: '', sheetMessage: '', hotbarKey: null as string | null },
};

const app = $('#app');
const overlay = $('#overlay');

const active = () => state.characters.find((c) => c.id === state.activeId);
const backgroundName = (id: string) => state.backgrounds.find((b) => b.id === id)?.name ?? id;

// --- Navigation ----------------------------------------------------------------------------------

async function loadCharacters(): Promise<void> {
  const result = await api.characters();
  if (!result.ok) return show('signin');
  state.characters = result.data.characters;
  state.activeId = result.data.activeCharacterId;
}

/** The Rim's data for den karakter, der spilles: guld, Forge, inventar og gaver. Returnerer, om noget er ændret. */
async function loadRim(): Promise<boolean> {
  const c = active();
  if (!c) return false;
  const [forge, inventory, gifts] = await Promise.all([api.forge(c.id), api.inventory(c.id), api.gifts(c.id)]);
  const next: RimData = {
    gold: forge.ok ? forge.data.gold : 0,
    stock: forge.ok ? forge.data.stock : [],
    inventory: inventory.ok ? inventory.data : null,
    gifts: gifts.ok ? gifts.data.gifts : [],
  };
  const changed = JSON.stringify(next) !== JSON.stringify(state.rim.data);
  state.rim.data = next;
  return changed;
}

/** Events fra bussen ankommer et øjeblik efter en handling; hent igen kort efter. */
function refreshSoon(): void {
  window.setTimeout(async () => {
    if (state.screen === 'rim' && (await loadRim())) render();
  }, 600);
}

async function loadBackgrounds(): Promise<void> {
  if (state.backgrounds.length) return;
  const result = await api.backgrounds();
  if (result.ok) state.backgrounds = result.data.backgrounds;
}

function show(screen: Screen, overlayValue: Overlay = null): void {
  state.screen = screen;
  state.overlay = overlayValue;
  if (screen === 'create' && !state.create.alloc) chooseBackground(state.create.background);
  render();
}

async function afterSignIn(userName: string): Promise<void> {
  state.userName = userName;
  await Promise.all([loadCharacters(), loadBackgrounds()]);
  show(screenAfterSignIn(state.characters.length));
}

function chooseBackground(id: string): void {
  const bg = state.backgrounds.find((b) => b.id === id);
  if (!bg) return;
  state.create.background = id;
  state.create.alloc = suggestedAllocation(bg); // F001 VIEW-01: "Choosing a background places its suggested points."
  state.create.message = '';
}

// --- Skærmene ------------------------------------------------------------------------------------

function signInHtml(): string {
  const creating = state.signinMode === 'create';
  return `<div class="panel narrow">
    <h1 class="title">The Maw</h1>
    <p class="lead">You were sentenced to the Tithe for a theft you did not commit. The Brand binds you to the Maw. The only way out is down.</p>
    <form id="signin" class="box" novalidate>
      <h2>${creating ? 'Create user' : 'Log in'}</h2>
      <div class="msg" id="form-msg"></div>
      <label class="field">User name
        <input name="userName" autocomplete="username" maxlength="40" required></label>
      <div class="field-error" data-for="userName"></div>
      <label class="field">Password
        <input name="password" type="password" autocomplete="${creating ? 'new-password' : 'current-password'}" required></label>
      <div class="field-error" data-for="password"></div>
      <button class="primary" type="submit">${creating ? 'Create user' : 'Log in'}</button>
    </form>
    <p class="muted switch">${creating ? 'Already have a user?' : 'New to the Maw?'}
      <button class="link" data-act="mode">${creating ? 'Log in' : 'Create user'}</button></p>
  </div>`;
}

function charactersHtml(): string {
  const rows = state.characters
    .map((c) => `<li>
      <div><div class="name">${esc(c.name)}</div><div class="muted">${esc(backgroundName(c.background))} · Mark ${c.mark}</div></div>
      <div class="actions">
        <button class="primary small-btn" data-act="play" data-id="${c.id}">Play</button>
        <button class="ghost small-btn" data-act="delete" data-id="${c.id}">Delete</button>
      </div></li>`)
    .join('');
  return `<div class="panel">
    <header class="top"><h1>Characters</h1><button class="ghost" data-act="account">Account</button></header>
    <ul class="list">${rows}</ul>
    <button class="primary" data-act="new">New character</button>
  </div>`;
}

function rangeText(kind: PointKind, key: string, bg: BackgroundView): string {
  const range = kind === 'attributes' ? bg.limits.attributes[key as keyof typeof bg.limits.attributes] : bg.limits.skills[key as keyof typeof bg.limits.skills];
  return `${range.min}–${range.max}`;
}

function createHtml(): string {
  const { background, alloc, name, message } = state.create;
  const bg = state.backgrounds.find((b) => b.id === background)!;
  const left = pointsLeft(alloc!, B);
  const cards = state.backgrounds
    .map((b) => `<button class="card ${b.id === background ? 'selected' : ''}" data-act="background" data-id="${b.id}">
      <h3>${esc(b.name)}</h3>
      <p>${esc(b.text)}</p>
      <p><b>Strengths:</b> ${esc(b.strengths.join(', '))}<br><b>Weaknesses:</b> ${esc(b.weaknesses.join(', '))}<br><b>Starting weapon:</b> ${esc(b.weaponName)}</p>
      <p class="limits">${ATTRIBUTES.map((a) => `${ATTRIBUTE_NAMES[a]} ${rangeText('attributes', a, b)}`).join(' · ')}<br>
        ${SKILLS.map((s) => `${SKILL_NAMES[s]} ${rangeText('skills', s, b)}`).join(' · ')}</p>
    </button>`)
    .join('');
  const rows = (kind: PointKind, keys: string[], names: Record<string, string>) =>
    keys.map((k) => {
      const value = kind === 'attributes' ? alloc!.attributes[k as keyof Allocation['attributes']] : alloc!.skills[k as keyof Allocation['skills']];
      return `<tr><td>${names[k]} <span class="muted">${rangeText(kind, k, bg)}</span></td>
        <td class="stepper">
          <button class="step" data-act="lower" data-id="${kind}:${k}" ${canLower(bg, alloc!, kind, k) ? '' : 'disabled'} aria-label="Lower ${names[k]}">−</button>
          <span class="value">${value}</span>
          <button class="step" data-act="raise" data-id="${kind}:${k}" ${canRaise(bg, alloc!, kind, k, B) ? '' : 'disabled'} aria-label="Raise ${names[k]}">+</button>
        </td></tr>`;
    }).join('');
  return `<div class="panel wide">
    <header class="top"><h1>Create character</h1>${state.characters.length ? '<button class="ghost" data-act="characters">Back</button>' : ''}</header>
    <div class="cards">${cards}</div>
    <div class="cols">
      <div class="box"><h3>Attributes</h3><p class="points">Points left: ${left.attributes}</p><table class="stats">${rows('attributes', ATTRIBUTES, ATTRIBUTE_NAMES)}</table></div>
      <div class="box"><h3>Skills</h3><p class="points">Points left: ${left.skills}</p><table class="stats">${rows('skills', SKILLS, SKILL_NAMES)}</table></div>
    </div>
    <label class="field">Name <input id="char-name" maxlength="${B.creation.nameMax}" value="${esc(name)}" autocomplete="off" required></label>
    <div class="msg">${esc(message)}</div>
    <button class="primary big" data-act="take">Take the Brand</button>
  </div>`;
}

function rimHtml(): string {
  const c = active();
  const { tab, data, message } = state.rim;
  const tabs: [RimTab, string][] = [['forge', 'Forge'], ['apothecary', 'Apothecary'], ['patrons', "Patrons' Hall"]];
  const views: Record<RimTab, () => string> = { forge: () => forgeHtml(data, message), apothecary: () => apothecaryHtml(data, message), patrons: () => patronsHtml(data, message) };
  const waiting = data.gifts.length ? ` (${data.gifts.length})` : '';
  return `<div class="panel wide">
    <header class="top">
      <div><h1>The Rim</h1><p class="muted">${c ? `${esc(c.name)} · ${esc(backgroundName(c.background))} · Mark ${c.mark}` : ''}</p></div>
      <div class="actions">
        <span class="gold-text big-gold">${data.gold} gold</span>
        <button class="primary" data-act="sheet">Character</button>
        <button class="ghost" data-act="characters">Characters</button>
        <button class="ghost" data-act="account">Account</button>
      </div>
    </header>
    <nav class="tabs">${tabs.map(([id, name]) => `<button class="${id === tab ? 'active' : ''}" data-act="tab" data-id="${id}">${name}${id === 'patrons' ? waiting : ''}</button>`).join('')}</nav>
    ${views[tab]()}
  </div>`;
}

function overlayHtml(): string {
  const o = state.overlay;
  if (!o) return '';
  if (o === 'sheet') {
    const c = active();
    return c ? sheetHtml(c, backgroundName(c.background), state.rim.data.inventory, state.rim.hotbarKey, state.rim.sheetMessage) : '';
  }
  if (o === 'account') {
    return `<div class="overlay"><div class="dialog">
      <h2>Account</h2><p>Signed in as <b>${esc(state.userName)}</b></p>
      <div class="actions"><button class="primary" data-act="logout">Log out</button><button class="ghost" data-act="close">Close</button></div>
    </div></div>`;
  }
  const c = state.characters.find((x) => x.id === o.confirmDelete);
  return `<div class="overlay"><div class="dialog">
    <p>${esc(deleteConfirmation(c?.name ?? ''))}</p>
    <div class="actions"><button class="danger" data-act="confirm-delete" data-id="${o.confirmDelete}">Delete</button><button class="ghost" data-act="close">Keep</button></div>
  </div></div>`;
}

function render(): void {
  const screens: Record<Screen, () => string> = { signin: signInHtml, characters: charactersHtml, create: createHtml, rim: rimHtml };
  // Overlayet tegnes forfra ved hver handling; scroll-positionen bevares, så karakterskærmen ikke springer til toppen.
  const scrolled = [...overlay.querySelectorAll<HTMLElement>('.overlay, .sheet, .dialog')].map((el) => el.scrollTop);
  app.innerHTML = screens[state.screen]();
  overlay.innerHTML = overlayHtml();
  overlay.querySelectorAll<HTMLElement>('.overlay, .sheet, .dialog').forEach((el, i) => (el.scrollTop = scrolled[i] ?? 0));
  if (state.screen === 'signin') $<HTMLInputElement>('#signin input[name=userName]').focus();
}

// --- Handlinger ----------------------------------------------------------------------------------

function fieldError(field: string, message: string): void {
  const el = app.querySelector<HTMLElement>(`.field-error[data-for="${field}"]`);
  if (el) el.textContent = message;
}

app.addEventListener('submit', async (event) => {
  const form = event.target as HTMLFormElement;
  if (form.id !== 'signin') return;
  event.preventDefault();
  for (const el of app.querySelectorAll('.field-error, #form-msg')) el.textContent = '';
  const userName = (form.elements.namedItem('userName') as HTMLInputElement).value;
  const password = (form.elements.namedItem('password') as HTMLInputElement).value;
  if (state.signinMode === 'create') {
    // F031: fejlene vises under det felt, de gælder.
    if (!isValidUserName(userName)) return fieldError('userName', MESSAGES.userNameInvalid);
    if (!isValidPassword(password)) return fieldError('password', MESSAGES.passwordShort);
    const result = await api.createUser(userName, password);
    if (!result.ok) return fieldError(result.refusal.field ?? 'userName', result.refusal.message);
    return afterSignIn(result.data.userName);
  }
  const result = await api.logIn(userName, password);
  // F032: "A wrong login is shown above the fields."
  if (!result.ok) {
    $('#form-msg').textContent = result.refusal.message;
    return;
  }
  await afterSignIn(result.data.userName);
});

app.addEventListener('input', (event) => {
  const el = event.target as HTMLInputElement;
  if (el.id === 'char-name') state.create.name = el.value;
});

async function act(action: string, id: string | undefined): Promise<void> {
  switch (action) {
    case 'mode':
      state.signinMode = state.signinMode === 'login' ? 'create' : 'login';
      return render();
    case 'account':
      return show(state.screen, 'account');
    case 'sheet':
      state.rim.hotbarKey = null;
      state.rim.sheetMessage = '';
      return show(state.screen, 'sheet');
    case 'close':
      return show(state.screen);
    case 'logout': {
      await api.logOut();
      // F033 EVT-01: "After logging out, the sign-in screen is shown."
      Object.assign(state, { userName: '', characters: [], activeId: null, signinMode: 'login' });
      return show('signin');
    }
    case 'characters':
      await loadCharacters();
      return show('characters');
    case 'new':
      state.create = { background: 'miner', alloc: null, name: '', message: '' };
      return show('create');
    case 'play': {
      const result = await api.chooseCharacter(id!);
      if (result.ok) state.activeId = result.data.activeCharacterId;
      await loadRim();
      return show('rim'); // F026: "After choosing, the player is in the Rim."
    }
    case 'delete':
      return show('characters', { confirmDelete: id! });
    case 'confirm-delete': {
      await api.deleteCharacter(id!);
      await loadCharacters();
      return show(state.characters.length ? 'characters' : 'create');
    }
    case 'background':
      chooseBackground(id!);
      return render();
    case 'raise':
    case 'lower': {
      const [kind, key] = id!.split(':') as [PointKind, string];
      state.create.alloc = (action === 'raise' ? raise : lower)(state.create.alloc!, kind, key);
      state.create.message = '';
      return render();
    }
    case 'take': {
      const { name, background, alloc } = state.create;
      const left = pointsLeft(alloc!, B);
      if (left.attributes !== 0 || left.skills !== 0) {
        state.create.message = MESSAGES.placeAllPoints;
        return render();
      }
      if (!name.trim()) {
        // F001: navnet er påkrævet; browseren viser selv beskeden ved det tomme felt.
        const input = $<HTMLInputElement>('#char-name');
        input.value = '';
        input.reportValidity();
        return;
      }
      const result = await api.createCharacter(name, background, alloc!);
      if (!result.ok) {
        state.create.message = result.refusal.message;
        return render();
      }
      // F001 EVT-01: den nye karakter er den, der spilles; startudstyr, guld og Forge kommer via bussen.
      await loadCharacters();
      state.create.alloc = null;
      state.rim.data = { gold: 0, stock: [], inventory: null, gifts: [] };
      await loadRim();
      show('rim');
      return refreshSoon();
    }
    case 'tab':
      state.rim.tab = id as RimTab;
      state.rim.message = '';
      return render();
    case 'buy':
    case 'sell':
    case 'buy-consumable':
    case 'accept-gift': {
      const c = active()!;
      const result = action === 'buy' ? await api.buy(c.id, id!)
        : action === 'sell' ? await api.sell(c.id, id!)
        : action === 'buy-consumable' ? await api.buyConsumable(c.id, id as 'potion' | 'ration')
        : await api.acceptGift(c.id, id!);
      // F019 VIEW-01: "A refusal is shown above the lists."
      state.rim.message = result.ok ? '' : result.refusal.message;
      await loadRim();
      render();
      return refreshSoon();
    }
    case 'equip':
    case 'unequip':
    case 'hotbar-weapon':
    case 'hotbar-art':
    case 'hotbar-clear': {
      const c = active()!;
      const key = state.rim.hotbarKey ?? '';
      const result = action === 'equip' ? await api.equip(c.id, id!)
        : action === 'unequip' ? await api.unequip(c.id, id!)
        : action === 'hotbar-weapon' ? await api.assignHotbar(c.id, key, { itemId: id! })
        : action === 'hotbar-art' ? await api.assignHotbar(c.id, key, { echoArt: id! })
        : await api.clearHotbar(c.id, key);
      if (result.ok) state.rim.data.inventory = result.data;
      // F007 scenario "Unequipping needs room": "Your inventory is full." vises på karakterskærmen.
      state.rim.sheetMessage = result.ok ? '' : result.refusal.message;
      if (action.startsWith('hotbar')) state.rim.hotbarKey = null;
      return render();
    }
    case 'hotbar-key':
      state.rim.hotbarKey = state.rim.hotbarKey === id ? null : id!;
      return render();
    case 'spend-attribute':
    case 'spend-skill': {
      const c = active()!;
      const result = action === 'spend-attribute' ? await api.spendAttributePoint(c.id, id!) : await api.spendSkillPoint(c.id, id!);
      if (result.ok) state.characters = state.characters.map((x) => (x.id === c.id ? result.data : x));
      return render();
    }
  }
}

onAction(app, (action, id) => void act(action, id));
onAction(overlay, (action, id) => void act(action, id));

window.addEventListener('keydown', (event) => {
  const typing = (event.target as HTMLElement).tagName === 'INPUT';
  if (event.key === 'Escape' && state.overlay) return void act('close', undefined);
  // F004 VIEW-01: karakterskærmen åbnes med C.
  if (!typing && (event.key === 'c' || event.key === 'C') && state.screen === 'rim') {
    void act(state.overlay === 'sheet' ? 'close' : 'sheet', undefined);
  }
});

// --- Start ---------------------------------------------------------------------------------------

const me = await api.me();
if (me.ok) {
  state.userName = me.data.userName;
  await Promise.all([loadCharacters(), loadBackgrounds()]);
  await loadRim();
  show(screenOnReload(state.characters.length, state.activeId));
} else {
  show('signin');
}

// The Rim henter nye data hvert andet sekund (planen, afsnit 7) og tegner kun igen, når noget er ændret.
window.setInterval(async () => {
  if (state.screen === 'rim' && (await loadRim())) render();
}, 2000);
