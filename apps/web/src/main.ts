// Webappen. Fase 1: Sign in (F031, F032), Characters (F026, F038), Create character (F001), karakterskærmen (F004) og
// Account (F033). Fase 2: the Rim med Forge (F019), Apothecary (F020) og Patrons' Hall (F024), guldet (F018), og
// inventar og hotbar på karakterskærmen (F007, F027). Fase 3: Tithes og lobby (F036, F025, F037), selve Tithen (F010–F017,
// F028, F029), resultatet (F016), Help (F030) og statistikken (F040). Fase 4: Other players og partier (F034, F035).
// Fase 6: Mustering Square (F042) med stederne som overlays og Reaches på tavlen (F036).
// Teksterne er på engelsk og citeret fra featurene.

import { MESSAGES, type ArenaEndedMessage, type EndedMessage } from '@maw/contracts';
import {
  ATTRIBUTES, ATTRIBUTE_NAMES, BALANCE as B, CREATION_SKILLS, displayName, HOTBAR_KEYS, SKILL_NAMES, canLower, isEchoArt, canRaise, isValidPassword, isValidUserName,
  lower, pointsLeft, raise, suggestedAllocation, type Allocation, type EchoArt, type TalentId, type EquipSlot, type Hotbar, type HotbarKey, type PointKind, type SquarePlace,
} from '@maw/rules';
import {
  api, type ArenaBoard, type ArenaMatchView, type BackgroundView, type CharacterView, type CurrentTithe, type LobbyView, type PlayerRow, type ReachView,
  type StatisticsRow, type TitheListItem,
} from './api.ts';
import { arenaBoardHtml, arenaLobbyHtml, arenaResultsHtml, type ArenaForm } from './arena.ts';
import { $, esc, onAction } from './dom.ts';
import { helpHtml } from './help.ts';
import { lobbyHtml, tithesHtml } from './lobby.ts';
import { othersHtml } from './others.ts';
import { RESULTS_DELAY_MS, deleteConfirmation, escapeAction, screenAfterSignIn, screenOnReload, type Screen } from './logic.ts';
import { resultsHtml } from './results.ts';
import { apothecaryHtml, chestHtml, forgeHtml, patronsHtml, type RimData, type RimTab } from './rim.ts';
import {
  NO_FREE_KEY, asCharacter, compareIdOf, firstFreeKey, markOf, sheetHtml, statsHtmlFor, type SheetTab,
} from './sheet.ts';
import { statisticsHtml } from './statistics.ts';
import { SquareView } from './square/view.ts';
import { Game } from './tithe/game.ts';

type Overlay = null | 'sheet' | 'account' | 'help' | 'leave' | 'others' | SquarePlace | 'lobby' | { confirmDelete: string };

const state = {
  screen: 'signin' as Screen,
  userName: '',
  signinMode: 'login' as 'login' | 'create',
  characters: [] as CharacterView[],
  activeId: null as string | null,
  backgrounds: [] as BackgroundView[],
  create: { background: 'miner', alloc: null as Allocation | null, name: '', message: '' },
  overlay: null as Overlay,
  rim: { tab: 'forge' as RimTab, data: { gold: 0, stock: [], inventory: null, gifts: [] } as RimData, message: '', sheetMessage: '', mark: null as string | null,
    sheetTab: 'character' as SheetTab, spellPage: 0, helpTab: 'keys' },
  lobby: { list: [] as TitheListItem[], reaches: [] as ReachView[], current: null as LobbyView | ArenaMatchView | null, message: '', nameDraft: '', reach: 'mines' },
  // Feature-044: arena-tavlen og formularen til en ny arenakamp.
  arena: { board: null as ArenaBoard | null, message: '', form: { name: '', format: '1v1', stake: '0', side: '1' } as ArenaForm },
  arenaEnded: null as ArenaEndedMessage | null,
  game: null as Game | null,
  ended: null as EndedMessage | null,
  stats: { rows: [] as StatisticsRow[], back: 'rim' as 'rim' | 'characters' },
  others: [] as PlayerRow[],
  square: null as SquareView | null,
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
      <div><div class="name">${esc(c.name)}</div><div class="muted">${esc(backgroundName(c.background))} · Mark ${c.mark} · ${c.tithes ?? 0} Tithes · Champion ${c.champions ?? 0}×</div></div>
      <div class="actions">
        <button class="primary small-btn" data-act="play" data-id="${c.id}">Play</button>
        <button class="ghost small-btn" data-act="delete" data-id="${c.id}">Delete</button>
      </div></li>`)
    .join('');
  return `<div class="panel">
    <header class="top"><h1>Characters</h1><div class="actions"><button class="ghost" data-act="statistics">Statistics</button><button class="ghost" data-act="account">Account</button></div></header>
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
      <p><b>Strengths:</b> ${esc(b.strengths.join(', '))}<br><b>Weaknesses:</b> ${esc(b.weaknesses.join(', '))}<br><b>Starting weapon:</b> ${esc(b.weaponName)}<br><b>Talent:</b> ${esc(B.talents[b.talent].name)} – ${esc(B.talents[b.talent].text)}</p>
      <p class="limits">${ATTRIBUTES.map((a) => `${ATTRIBUTE_NAMES[a]} ${rangeText('attributes', a, b)}`).join(' · ')}<br>
        ${CREATION_SKILLS.map((s) => `${SKILL_NAMES[s]} ${rangeText('skills', s, b)}`).join(' · ')}</p>
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
      <div class="box"><h3>Skills</h3><p class="points">Points left: ${left.skills}</p><table class="stats">${rows('skills', CREATION_SKILLS, SKILL_NAMES)}</table></div>
    </div>
    <label class="field">Name <input id="char-name" maxlength="${B.creation.nameMax}" value="${esc(name)}" autocomplete="off" required></label>
    <div class="msg">${esc(message)}</div>
    <button class="primary big" data-act="take">Take the Brand</button>
  </div>`;
}

function overlayHtml(): string {
  const o = state.overlay;
  if (!o) return '';
  if (o === 'sheet') {
    if (state.screen === 'tithe') {
      // Under en Tithe kommer karakterskærmen fra tithe-server, og Tithen fortsætter bag den (Feature-004 VIEW-01).
      const s = state.game?.sheetData;
      return s ? sheetHtml(s.character, backgroundName(s.character.background), s.inventory, state.rim.mark, state.rim.sheetMessage, { found: s.found }, sheetView()) : '';
    }
    const c = active();
    return c ? sheetHtml(c, backgroundName(c.background), state.rim.data.inventory, state.rim.mark, state.rim.sheetMessage, null, sheetView()) : '';
  }
  if (o === 'help') {
    const inGame = state.screen === 'tithe';
    const inv = inGame ? state.game?.sheetData?.inventory : state.rim.data.inventory;
    const hotbar = inGame ? state.game?.hotbar ?? {} : inv?.hotbar ?? {};
    const weapons = inv ? [inv.equipment.melee, inv.equipment.ranged, ...inv.pack] : [];
    return helpHtml(hotbar, (id) => { const w = weapons.find((x) => x?.id === id); return w ? displayName(w, B) : 'a weapon'; }, state.rim.helpTab);
  }
  if (o === 'others') return othersHtml(state.others, state.screen === 'tithe' ? state.game?.party ?? null : null);
  // Feature-042: stederne på Mustering Square åbnes som overlays; pladsen ses bag dem.
  const place = (title: string, body: string) => `<div class="overlay see-through"><div class="sheet place">
    <header class="top"><h2>${title}</h2><div class="actions"><span class="gold-text big-gold">${state.rim.data.gold} gold</span>
      <button class="ghost" data-act="close">Close</button></div></header>${body}</div></div>`;
  // Feature-007: kravene står med rødt, når karakteren ikke opfylder dem.
  const playing = active();
  const ch = playing ? asCharacter(playing, state.rim.data.inventory) : null;
  if (o === 'forge') return place('The Forge', forgeHtml(state.rim.data, state.rim.message, ch));
  if (o === 'chest') return place('The Chest', chestHtml(state.rim.data, state.rim.message, ch));
  if (o === 'apothecary') return place('The Apothecary', apothecaryHtml(state.rim.data, state.rim.message));
  if (o === 'patrons') return place("The Patrons' Hall", patronsHtml(state.rim.data, state.rim.message));
  if (o === 'board') {
    return `<div class="overlay see-through"><div class="sheet place">${tithesHtml(state.lobby.list, state.lobby.message, state.lobby.nameDraft, state.lobby.reaches, state.lobby.reach)}</div></div>`;
  }
  if (o === 'lobby') {
    const cur = state.lobby.current;
    if (!cur) return '';
    // Feature-044 VIEW-02: en arenakamp vises med sine to sider.
    const body = cur.reach === 'arena' ? arenaLobbyHtml(cur as ArenaMatchView, state.lobby.message) : lobbyHtml(cur as LobbyView, state.lobby.message);
    return `<div class="overlay see-through"><div class="sheet place">${body}</div></div>`;
  }
  if (o === 'arena') {
    return `<div class="overlay see-through"><div class="sheet place">${arenaBoardHtml(state.arena.board, state.arena.message, state.arena.form)}</div></div>`;
  }
  if (o === 'leave') {
    // Feature-029 VIEW-01
    return `<div class="overlay"><div class="dialog">
      <p>${esc(MESSAGES.leaveConfirm)}</p>
      <div class="actions"><button class="danger" data-act="confirm-leave">Leave</button><button class="ghost" data-act="close">Stay</button></div>
    </div></div>`;
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

function renderOverlay(): void {
  // Overlayet tegnes forfra ved hver handling; scroll-positionen og et felt med fokus bevares.
  const scrolled = [...overlay.querySelectorAll<HTMLElement>('.overlay, .sheet, .dialog')].map((el) => el.scrollTop);
  const focused = document.activeElement instanceof HTMLInputElement && overlay.contains(document.activeElement) ? document.activeElement.name : '';
  overlay.innerHTML = overlayHtml();
  overlay.querySelectorAll<HTMLElement>('.overlay, .sheet, .dialog').forEach((el, i) => (el.scrollTop = scrolled[i] ?? 0));
  if (focused) {
    const input = overlay.querySelector<HTMLInputElement>(`input[name="${focused}"]`);
    if (input && input.type !== 'radio') {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }
}

/** Feature-042: overskriften på pladsen med karakteren, guldet og gaverne, der venter. */
function squareHud() {
  const c = active();
  return {
    title: 'The Mustering Square',
    sub: c ? `${c.name} · ${backgroundName(c.background)} · Mark ${c.mark}` : '',
    gold: state.rim.data.gold,
    giftsWaiting: state.rim.data.gifts.length,
  };
}

/** Feature-042 VIEW-01: F ved et sted åbner det. Tavlen viser lobbyen, når spilleren venter i en. */
async function openPlace(place: SquarePlace): Promise<void> {
  state.rim.message = '';
  if (place === 'board') {
    if (state.lobby.current) return show('rim', 'lobby');
    state.lobby.message = '';
    await loadTithes();
    return show('rim', 'board');
  }
  // Feature-044 VIEW-01 Arena board; venter spilleren i en kamp, vises den.
  if (place === 'arena') {
    if (state.lobby.current) return show('rim', 'lobby');
    state.arena.message = '';
    await loadArena();
    return show('rim', 'arena');
  }
  await loadRim();
  show('rim', place);
}

function render(): void {
  if (state.screen !== 'rim' && state.square) {
    state.square.unmount();
    state.square = null;
  }
  // Pladsen og Tithe-skærmen bygges én gang og opdaterer sig selv; kun overlayet tegnes her.
  if (state.screen === 'rim') {
    state.square ??= new SquareView({ open: (place) => void openPlace(place) });
    if (!state.square.mounted) state.square.mount(app);
    state.square.setHud(squareHud());
    return renderOverlay();
  }
  if (state.screen === 'tithe') {
    if (state.game && !state.game.mounted) state.game.mount(app);
    return renderOverlay();
  }
  const screens: Record<Exclude<Screen, 'tithe' | 'rim'>, () => string> = {
    signin: signInHtml, characters: charactersHtml, create: createHtml,
    tithes: () => tithesHtml(state.lobby.list, state.lobby.message, state.lobby.nameDraft, state.lobby.reaches, state.lobby.reach),
    lobby: () => {
      const cur = state.lobby.current;
      if (!cur) return '';
      return cur.reach === 'arena' ? arenaLobbyHtml(cur as ArenaMatchView, state.lobby.message) : lobbyHtml(cur as LobbyView, state.lobby.message);
    },
    results: () => (state.arenaEnded ? arenaResultsHtml(state.arenaEnded) : state.ended ? resultsHtml(state.ended) : ''),
    statistics: () => statisticsHtml(state.stats.rows, state.stats.back),
  };
  // Et felt, der har fokus, beholder det, når skærmen tegnes igen (f.eks. når listen af Tithes hentes på ny).
  const focused = document.activeElement instanceof HTMLInputElement && app.contains(document.activeElement) ? document.activeElement.name : '';
  app.innerHTML = screens[state.screen]();
  renderOverlay();
  if (state.screen === 'signin') $<HTMLInputElement>('#signin input[name=userName]').focus();
  if (focused) {
    const input = app.querySelector<HTMLInputElement>(`input[name="${focused}"]`);
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }
}

// --- Tithes, lobby og Tithe -----------------------------------------------------------------------

/** Feature-044 VIEW-01: de åbne arenakampe. */
async function loadArena(): Promise<boolean> {
  const result = await api.arena();
  if (!result.ok) return false;
  const changed = JSON.stringify(result.data) !== JSON.stringify(state.arena.board);
  state.arena.board = result.data;
  return changed;
}

async function loadTithes(): Promise<boolean> {
  const result = await api.tithes();
  if (!result.ok) return false;
  const changed = JSON.stringify(result.data.tithes) !== JSON.stringify(state.lobby.list);
  state.lobby.list = result.data.tithes;
  state.lobby.reaches = result.data.reaches;
  return changed;
}

/** Fører spilleren derhen, hvor lobbyen siger, spilleren er. */
async function follow(current: CurrentTithe): Promise<void> {
  if (current.state === 'playing') return startGame(current.ticket);
  if (current.state === 'lobby') {
    if (!state.lobby.current) state.lobby.message = '';
    state.lobby.current = current.tithe;
    return show('rim', 'lobby');
  }
  // Feature-037: lukkes Tithen, er de andre tilbage ved listen af Tithes; en arenakamp ved arena-tavlen (Feature-044).
  const wasArena = state.lobby.current?.reach === 'arena';
  state.lobby.current = null;
  if (state.overlay === 'lobby') {
    if (wasArena) {
      await loadArena();
      return show('rim', 'arena');
    }
    await loadTithes();
    show('rim', 'board');
  }
}

function startGame(ticket: string): void {
  state.game?.unmount();
  state.ended = null;
  state.rim.mark = null;
  state.rim.sheetMessage = '';
  state.game = new Game(ticket, {
    sheet: () => {
      if (state.overlay === 'sheet' || state.overlay === 'help') renderOverlay();
    },
    party: (_view, invited) => {
      // Feature-035 VIEW-01: en invitation popper op i Other players.
      if (invited && state.overlay !== 'others') return void openOthers();
      if (state.overlay === 'others') renderOverlay();
    },
    arenaEnded: (m) => {
      // Feature-045 VIEW-02 Arena result: 2,5 sekunder efter slutningen.
      state.arenaEnded = m;
      window.setTimeout(() => {
        state.game?.unmount();
        state.game = null;
        show('results');
      }, RESULTS_DELAY_MS);
    },
    ended: (m) => {
      // Feature-016 VIEW-01: resultatet vises 2,5 sekunder efter slutningen.
      state.ended = m;
      window.setTimeout(() => {
        state.game?.unmount();
        state.game = null;
        show('results');
      }, RESULTS_DELAY_MS);
    },
    refused: (message) => {
      state.rim.sheetMessage = message;
      renderOverlay();
    },
    gone: async () => {
      state.game?.unmount();
      state.game = null;
      await loadRim();
      show('rim');
    },
  });
  show('tithe');
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
  if (el.name === 'name' && el.form?.id === 'open-tithe') state.lobby.nameDraft = el.value;
  if (el.name === 'reach' && el.form?.id === 'open-tithe') {
    state.lobby.reach = el.value;
    render();
  }
});

// Feature-036 CMD-01 Open a Tithe (formularen ligger på Tithe Board i overlayet)
overlay.addEventListener('input', (event) => {
  const el = event.target as HTMLInputElement;
  if (el.name === 'name' && el.form?.id === 'open-tithe') state.lobby.nameDraft = el.value;
  if (el.name === 'reach' && el.form?.id === 'open-tithe') {
    state.lobby.reach = el.value;
    renderOverlay();
  }
});
// Feature-044 CMD-01 Open an arena match (formularen ligger på arena-tavlen)
overlay.addEventListener('input', (event) => {
  const el = event.target as HTMLInputElement;
  if (el.form?.id === 'open-arena' && el.name in state.arena.form) state.arena.form[el.name as keyof ArenaForm] = el.value;
});
overlay.addEventListener('submit', async (event) => {
  const form = event.target as HTMLFormElement;
  if (form.id !== 'open-arena') return;
  event.preventDefault();
  const input = form.elements.namedItem('name') as HTMLInputElement;
  const name = input.value.trim();
  if ([...name].length < B.lobby.nameMin || [...name].length > B.lobby.nameMax) {
    input.setCustomValidity(`Use ${B.lobby.nameMin}–${B.lobby.nameMax} characters.`);
    input.reportValidity();
    input.setCustomValidity('');
    return;
  }
  const f = state.arena.form;
  const stake = Math.max(0, Math.min(B.arena.stakeMax, Math.floor(Number(f.stake) || 0)));
  const result = await api.openArena({ name, format: f.format, stake, side: Number(f.side) });
  if (!result.ok) {
    state.arena.message = result.refusal.message;
    await loadArena();
    return render();
  }
  state.arena.form.name = '';
  state.arena.message = '';
  await follow(result.data);
});
overlay.addEventListener('submit', async (event) => {
  const form = event.target as HTMLFormElement;
  if (form.id !== 'open-tithe') return;
  event.preventDefault();
  const input = form.elements.namedItem('name') as HTMLInputElement;
  const name = input.value.trim();
  if ([...name].length < B.lobby.nameMin || [...name].length > B.lobby.nameMax) {
    input.setCustomValidity(`Use ${B.lobby.nameMin}–${B.lobby.nameMax} characters.`);
    input.reportValidity();
    input.setCustomValidity('');
    return;
  }
  const result = await api.openTithe(name, state.lobby.reach);
  if (!result.ok) {
    state.lobby.message = result.refusal.message;
    await loadTithes();
    return render();
  }
  state.lobby.nameDraft = '';
  await follow(result.data);
});

/**
 * Feature-027 CMD-01: det markerede våben eller den markerede Echo Art lægges på tasten. Markeringen bliver stående, så
 * det samme kan flyttes videre med en anden tast.
 */
async function assignMarked(key: string): Promise<void> {
  const target = markOf(state.rim.mark);
  if (target) await assignTo(key, target);
}

/** Feature-027 CMD-01 Assign hotbar key, i the Rim gennem api'et og under en Tithe gennem tithe-server. */
async function assignTo(key: string, target: { itemId: string } | { echoArt: EchoArt } | { talent: TalentId }): Promise<void> {
  if (!(HOTBAR_KEYS as readonly string[]).includes(key)) return;
  if (state.screen === 'tithe' && state.game) {
    state.rim.sheetMessage = '';
    state.game.sheetAction({ action: 'hotbar', key: key as HotbarKey, ...target });
    return renderOverlay();
  }
  const c = active();
  if (!c) return;
  const result = await api.assignHotbar(c.id, key, target);
  if (result.ok) state.rim.data.inventory = result.data;
  state.rim.sheetMessage = result.ok ? '' : result.refusal.message;
  render();
}

/** Hotbaren, som karakterskærmen viser den: fra tithe-server under en Tithe, ellers fra Gear. */
function sheetHotbar(): Hotbar {
  return (state.screen === 'tithe' ? state.game?.sheetData?.inventory.hotbar : state.rim.data.inventory?.hotbar) ?? {};
}

/** Feature-027: Equip i spellbooken lægger Echo Art'en på den første tomme tast. */
async function equipArt(art: string | undefined): Promise<void> {
  if (!isEchoArt(art)) return;
  const key = firstFreeKey(sheetHotbar());
  if (!key) {
    state.rim.sheetMessage = NO_FREE_KEY;
    return renderOverlay();
  }
  await assignTo(key, { echoArt: art });
}

function sheetView() {
  return { tab: state.rim.sheetTab, spellPage: state.rim.spellPage };
}

/** Feature-027 VIEW-01: et klik markerer et våben eller en kendt Echo Art; et klik mere fjerner markeringen. */
function toggleMark(id: string | undefined): void {
  state.rim.mark = !id || state.rim.mark === id ? null : id;
  renderOverlay();
}

/** Karakterskærmen under en Tithe: handlingerne går til tithe-server (Feature-004, -007, -027). */
function titheSheetAction(action: string, id: string | undefined): boolean {
  const game = state.game;
  if (state.screen !== 'tithe' || !game) return false;
  state.rim.sheetMessage = '';
  if (action === 'equip') {
    const [itemId, ring] = id!.split('|') as [string, 'ring1' | 'ring2' | undefined];
    game.sheetAction(ring ? { action: 'equip', itemId, ring } : { action: 'equip', itemId });
  } else if (action === 'unequip') game.sheetAction({ action: 'unequip', slot: id as EquipSlot });
  else if (action === 'drop') game.sheetAction({ action: 'drop', itemId: id! });
  else if (action === 'reveal') game.sheetAction({ action: 'reveal', itemId: id! }); // Feature-050 CMD-01
  else if (action === 'mark') toggleMark(id);
  else if (action === 'hotbar-key') void assignMarked(id ?? '');
  else if (action === 'hotbar-clear') game.sheetAction({ action: 'clear', key: id as HotbarKey });
  else if (action === 'spend-attribute') game.sheetAction({ action: 'attribute', attribute: id as never });
  else if (action === 'spend-skill') game.sheetAction({ action: 'skill', skill: id as never });
  else return false;
  renderOverlay();
  return true;
}

async function loadOthers(): Promise<boolean> {
  const result = await api.players();
  if (!result.ok) return false;
  const changed = JSON.stringify(result.data.players) !== JSON.stringify(state.others);
  state.others = result.data.players;
  return changed;
}

async function openOthers(): Promise<void> {
  await loadOthers();
  show(state.screen, 'others');
}

async function act(action: string, id: string | undefined): Promise<void> {
  if (titheSheetAction(action, id)) return;
  switch (action) {
    case 'others':
      return openOthers();
    case 'invite':
      state.game?.partyAction({ t: 'party', action: 'invite', userId: id! });
      return;
    case 'accept-invite':
    case 'decline-invite':
      state.game?.partyAction({ t: 'party', action: action === 'accept-invite' ? 'accept' : 'decline', from: id! });
      return;
    case 'leave-party':
      state.game?.partyAction({ t: 'party', action: 'leave' });
      return;
    case 'descend':
    case 'square-open':
      // Feature-042: stederne på pladsen; Tithe Board åbner listen af Tithes (Feature-025 VIEW-01).
      return openPlace(action === 'descend' ? 'board' : (id as SquarePlace));
    case 'rim':
      await loadRim();
      return show('rim');
    case 'join-tithe': {
      const result = await api.joinTithe(id!);
      if (!result.ok) {
        state.lobby.message = result.refusal.message;
        await loadTithes();
        return render();
      }
      return follow(result.data);
    }
    case 'launch-tithe':
    case 'leave-lobby': {
      const result = action === 'launch-tithe' ? await api.launchTithe(id!) : await api.leaveLobby(id!);
      if (!result.ok) {
        state.lobby.message = result.refusal.message;
        return render();
      }
      if (action === 'leave-lobby') {
        const wasArena = state.lobby.current?.reach === 'arena';
        state.lobby.current = null;
        if (wasArena) {
          await loadArena();
          return show('rim', 'arena');
        }
        await loadTithes();
        return show('rim', 'board');
      }
      return follow(result.data);
    }
    case 'statistics': {
      const result = await api.statistics();
      state.stats = { rows: result.ok ? result.data.characters : [], back: state.screen === 'characters' ? 'characters' : 'rim' };
      return show('statistics');
    }
    case 'help':
      return show(state.screen, 'help');
    // Feature-030 VIEW-01: et emne i Helps faner; næste gang åbner Help på det.
    case 'help-tab':
      state.rim.helpTab = id ?? 'keys';
      return renderOverlay();
    case 'leave':
      return show(state.screen, 'leave');
    case 'confirm-leave':
      state.game?.leave();
      return show(state.screen);
    case 'hotkey':
      state.game?.hotkey(id as HotbarKey);
      return;
    case 'game-act':
      state.game?.act(id as 'potion' | 'focusPotion' | 'ration' | 'interact' | 'dodge');
      return;
    case 'arena-join': {
      // Feature-044 CMD-02 Join a side
      const [name, side] = (id ?? '').split('|');
      const result = await api.joinArena(name!, Number(side));
      if (!result.ok) {
        state.arena.message = result.refusal.message;
        await loadArena();
        return render();
      }
      return follow(result.data);
    }
    case 'arena-start': {
      // Feature-044 CMD-03 Start the arena match
      const result = await api.startArena(id!);
      if (!result.ok) {
        state.lobby.message = result.refusal.message;
        return render();
      }
      return follow(result.data);
    }
    case 'return-to-rim': {
      // Feature-016 VIEW-01: "Return to the Rim" åbner the Rim, på Patrons' Hall, når der venter gaver.
      state.ended = null;
      state.arenaEnded = null;
      state.rim.message = '';
      await loadCharacters();
      await loadRim();
      // Feature-016 VIEW-01: tilbage på Mustering Square med Patrons' Hall åben, når der venter gaver.
      show('rim', id === 'patrons' ? 'patrons' : null);
      // Pengepung, gaver og det fundne kommer over bussen et øjeblik efter.
      refreshSoon();
      window.setTimeout(refreshSoon, 1500);
      return;
    }
    case 'mode':
      state.signinMode = state.signinMode === 'login' ? 'create' : 'login';
      return render();
    case 'account':
      return show(state.screen, 'account');
    case 'sheet':
      state.rim.mark = null;
      state.rim.sheetMessage = '';
      return show(state.screen, 'sheet');
    case 'close':
      state.rim.mark = null; // Feature-027: at lukke karakterskærmen fjerner markeringen
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
    case 'buy':
    case 'sell':
    case 'forge-identify':
    case 'buy-consumable':
    case 'accept-gift':
    case 'chest-put':
    case 'chest-take': {
      const c = active()!;
      const result = action === 'buy' ? await api.buy(c.id, id!)
        : action === 'forge-identify' ? await api.identifyAll(c.id)
        : action === 'sell' ? await api.sell(c.id, id!)
        : action === 'chest-put' ? await api.putInChest(c.id, id!)
        : action === 'chest-take' ? await api.takeFromChest(c.id, id!)
        : action === 'buy-consumable' ? await api.buyConsumable(c.id, id as 'potion' | 'focusPotion' | 'ration')
        : await api.acceptGift(c.id, id!);
      // F019 VIEW-01: "A refusal is shown above the lists."
      state.rim.message = result.ok ? '' : result.refusal.message;
      await loadRim();
      render();
      return refreshSoon();
    }
    case 'equip':
    case 'unequip':
    case 'hotbar-clear': {
      const c = active()!;
      const [itemId, ring] = (id ?? '').split('|') as [string, 'ring1' | 'ring2' | undefined];
      const result = action === 'equip' ? await api.equip(c.id, itemId, ring)
        : action === 'unequip' ? await api.unequip(c.id, id!)
        : await api.clearHotbar(c.id, id!);
      if (result.ok) state.rim.data.inventory = result.data;
      // F007 scenario "Unequipping needs room": "Your inventory is full." vises på karakterskærmen.
      state.rim.sheetMessage = result.ok ? '' : result.refusal.message;
      return render();
    }
    case 'mark':
      return toggleMark(id);
    // Feature-004 VIEW-01: karakterskærmens faner; Feature-048: spellbookens sider.
    case 'sheet-tab':
      state.rim.sheetTab = (id as SheetTab) ?? 'character';
      state.rim.sheetMessage = '';
      return renderOverlay();
    case 'spell-page':
      state.rim.spellPage = Number(id) || 0;
      return renderOverlay();
    case 'art-equip':
      return equipArt(id);
    // Feature-027/-049: Equip på talentet lægger det på den første tomme tast.
    case 'talent-equip': {
      if (!id || !(id in B.talents)) return;
      const key = firstFreeKey(sheetHotbar());
      if (!key) {
        state.rim.sheetMessage = NO_FREE_KEY;
        return renderOverlay();
      }
      return assignTo(key, { talent: id as TalentId });
    }
    case 'art-unequip':
      return act('hotbar-clear', id);
    case 'hotbar-key':
      return assignMarked(id ?? '');
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

// Feature-007 VIEW-01: at pege på en ting viser værdierne med den i gult under de nuværende; uden peg følger de det
// markerede. Kun tabellen skiftes, så resten af karakterskærmen bliver stående.
let comparing: string | null | undefined;
overlay.addEventListener('mouseover', (event) => {
  const box = overlay.querySelector<HTMLElement>('#sheet-stats');
  if (!box) return;
  const el = (event.target as HTMLElement).closest<HTMLElement>('[data-compare]');
  const id = el?.dataset.compare ?? compareIdOf(state.rim.mark);
  if (id === comparing && box.dataset.shown === '1') return;
  comparing = id;
  box.innerHTML = statsHtmlFor(id);
  box.dataset.shown = '1';
});

window.addEventListener('keydown', (event) => {
  const typing = (event.target as HTMLElement).tagName === 'INPUT';
  if (event.key === 'Escape') {
    // Feature-030: Esc lukker altid det, der er åbent, og går tilbage fra Player statistics.
    const action = escapeAction(state.screen, state.overlay !== null, state.stats.back);
    if (action) {
      event.preventDefault();
      void act(action, undefined);
    }
    return;
  }
  if (typing || event.ctrlKey || event.metaKey || event.altKey) return;
  // Feature-027: med noget markeret på karakterskærmen lægger 1–8 det på en tast i stedet for at vælge en (Feature-028).
  const digit = /^Digit([1-8])$/.exec(event.code);
  if (digit && state.overlay === 'sheet' && markOf(state.rim.mark)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!event.repeat) void assignMarked(digit[1]!);
    return;
  }
  const playing = state.screen === 'rim' || state.screen === 'tithe';
  // F004 VIEW-01: karakterskærmen åbnes med C; F030 VIEW-01: Help med H, i the Rim og under en Tithe.
  if ((event.key === 'c' || event.key === 'C') && playing) void act(state.overlay === 'sheet' ? 'close' : 'sheet', undefined);
  if ((event.key === 'h' || event.key === 'H') && playing) void act(state.overlay === 'help' ? 'close' : 'help', undefined);
  // F034 VIEW-01: Other players åbnes med O.
  if ((event.key === 'o' || event.key === 'O') && playing) void act(state.overlay === 'others' ? 'close' : 'others', undefined);
});

// --- Start ---------------------------------------------------------------------------------------

const me = await api.me();
if (me.ok) {
  state.userName = me.data.userName;
  await Promise.all([loadCharacters(), loadBackgrounds()]);
  await loadRim();
  // Er spilleren i en lobby eller en Tithe, går webappen derhen igen (Feature-029: forbindelsen kan komme igen).
  const current = await api.currentTithe();
  if (current.ok && current.data.state !== 'none') await follow(current.data);
  else show(screenOnReload(state.characters.length, state.activeId));
} else {
  show('signin');
}

// The Rim og listen af Tithes henter nye data hvert andet sekund (planen, afsnit 7) og tegner kun igen, når noget er
// ændret. Lobbyen spørger hvert sekund, så alle kommer med, når Tithen startes.
window.setInterval(async () => {
  if (state.screen === 'rim' && (await loadRim())) render();
  if (state.overlay === 'board' && (await loadTithes()) && state.overlay === 'board') renderOverlay();
  if (state.overlay === 'arena' && (await loadArena()) && state.overlay === 'arena') renderOverlay();
  if (state.overlay === 'others' && (await loadOthers()) && state.overlay === 'others') renderOverlay();
}, 2000);
window.setInterval(async () => {
  // Lobbyen følges, så længe spilleren venter i en – også når overlayet er lukket, og spilleren går på pladsen.
  if (state.screen !== 'rim' || !state.lobby.current) return;
  const current = await api.currentTithe();
  if (!current.ok || !state.lobby.current) return;
  const cur = current.data;
  if (cur.state === 'playing') return startGame(cur.ticket);
  if (cur.state === 'none') return follow(cur);
  if (JSON.stringify(cur.tithe) === JSON.stringify(state.lobby.current)) return;
  state.lobby.current = cur.tithe;
  if (state.overlay === 'lobby') renderOverlay();
}, 1000);
