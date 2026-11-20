// Tithe-skærmen (Feature-010 VIEW-01 Depth): forbinder til tithe-server med billetten, sender spillerens handlinger og
// tegner serverens snapshots med lidt udjævning. Browseren regner intet selv; serveren afgør alt (Feature-010 SVC-01).

import type { ClientMessage, EndedMessage, PartyView, ServerMessage, SheetMessage, Snapshot, SnapshotEntity } from '@maw/contracts';
import { BALANCE as B, HOTBAR_KEYS, type HotbarKey, type SheetAction } from '@maw/rules';
import { esc } from '../dom.ts';
import { createRenderer, type Frame, type Renderer } from './render.ts';

export interface GameEvents {
  sheet(message: SheetMessage): void;
  /** Partiet har ændret sig; invited er sand, når en ny invitation er kommet (Feature-035 VIEW-01 popper op). */
  party(view: PartyView, invited: boolean): void;
  ended(message: EndedMessage): void;
  refused(message: string): void;
  gone(reason: string): void;
}

const MOVE: Record<string, [number, number]> = {
  KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
};

/** Feature-030 VIEW-01: tasterne i en Tithe. */
const ACTS: Record<string, 'dodge' | 'potion' | 'ration' | 'interact'> = {
  ShiftLeft: 'dodge', ShiftRight: 'dodge', KeyQ: 'potion', KeyR: 'ration', KeyF: 'interact',
};

interface Buffered {
  at: number;
  snap: Snapshot;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function hudHtml(): string {
  const bar = (cls: string, title: string) => `<div class="bar ${cls}" title="${title}"><i></i><span></span></div>`;
  return `<div class="game">
    <canvas class="view"></canvas>
    <div class="hud">
      <div class="hud-left">
        ${bar('hp', 'Life')}${bar('stamina', 'Stamina')}${bar('focus', 'Focus')}${bar('hunger', 'Hunger')}${bar('echo', 'Echo to the next Mark')}
        <button class="hud-points hidden" data-act="sheet">Points to spend</button>
      </div>
      <div class="hud-center"><div class="hud-depth"></div><div class="hud-seal"></div><div class="hud-renown"></div></div>
      <div class="hud-right">
        <div class="hud-buttons">
          <button class="ghost small-btn" data-act="sheet">Character</button>
          <button class="ghost small-btn" data-act="others">Other players</button>
          <button class="ghost small-btn" data-act="help">Help</button>
          <button class="ghost small-btn" data-act="leave">Leave</button>
        </div>
        <canvas class="minimap" width="128" height="128"></canvas>
        <ul class="hud-candidates"></ul>
      </div>
      <div class="hud-log"></div>
      <div class="hud-prompt"></div>
      <div class="hud-bottom">
        <div class="hud-supplies">
          <button class="ghost small-btn" data-act="game-act" data-id="potion">Potion (Q) <b class="hud-potions"></b></button>
          <button class="ghost small-btn" data-act="game-act" data-id="ration">Ration (R) <b class="hud-rations"></b></button>
        </div>
        <div class="hud-hotbar"></div>
      </div>
      <div class="hud-status"></div>
    </div>
  </div>`;
}

export class Game {
  private socket: WebSocket | null = null;
  private renderer: Renderer | null = null;
  private root: HTMLElement | null = null;
  private frame = 0;
  private last = performance.now();
  private buffer: Buffered[] = [];
  private tiles = new Uint8Array(0);
  private tilesVersion = 0;
  private mapW = 64;
  private mapH = 64;
  private depth = 0;
  private log: { who: string; text: string }[] = [];
  private keys = new Set<string>();
  private sent = '';
  private heartbeat = 0;
  private hotbarHtml = '';
  private candidatesHtml = '';
  private sheet: SheetMessage | null = null;
  private partyJson = '';
  private partyState: PartyView | null = null;
  private readonly events: GameEvents;
  private readonly ticket: string;
  private closedByUs = false;
  /** Tithen startes over bussen; den kan være et øjeblik om at kende billetten, så klienten prøver igen et stykke tid. */
  private welcomed = false;
  private attempts = 0;

  constructor(ticket: string, events: GameEvents) {
    this.ticket = ticket;
    this.events = events;
  }

  mount(container: HTMLElement): void {
    container.innerHTML = hudHtml();
    this.root = container.querySelector<HTMLElement>('.game')!;
    this.renderer = createRenderer(this.root.querySelector('canvas.view')!, this.root.querySelector('canvas.minimap')!);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    this.frame = requestAnimationFrame(this.loop);
    this.heartbeat = window.setInterval(() => this.sendInput(true), 250);
    this.connect();
  }

  get mounted(): boolean {
    return !!this.root?.isConnected;
  }

  /** Den seneste karakterskærm fra serveren (Feature-004, -007, -027 under en Tithe). */
  get sheetData(): SheetMessage | null {
    return this.sheet;
  }

  /** Partiet, som serveren sidst sendte det (Feature-034 VIEW-01). */
  get party(): PartyView | null {
    return this.partyState;
  }

  get hotbar() {
    return this.buffer.at(-1)?.snap.you.hotbar ?? {};
  }

  private connect(): void {
    const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${scheme}://${location.host}/ws?ticket=${encodeURIComponent(this.ticket)}`);
    this.socket = socket;
    this.status('Connecting…');
    socket.onopen = () => this.status('');
    socket.onmessage = (event) => this.receive(String(event.data));
    socket.onclose = (event) => {
      if (this.closedByUs || this.socket !== socket) return;
      if (event.code === 4004) return; // "gone" er allerede vist
      // Feature-029: forbindelsen kan komme igen inden for 60 sekunder.
      this.status('Connection lost. Reconnecting…');
      window.setTimeout(() => {
        if (!this.closedByUs) this.connect();
      }, 1500);
    };
  }

  private status(text: string): void {
    const el = this.root?.querySelector('.hud-status');
    if (el) el.textContent = text;
  }

  private receive(raw: string): void {
    const m = JSON.parse(raw) as ServerMessage;
    switch (m.t) {
      case 'snap':
        return this.onSnapshot(m);
      case 'sheet':
        this.sheet = m;
        return this.events.sheet(m);
      case 'ended':
        return this.events.ended(m);
      case 'refused':
        return this.events.refused(m.message);
      case 'welcome':
        this.welcomed = true;
        return;
      case 'gone':
        if (!this.welcomed && this.attempts < 20) {
          this.attempts += 1;
          window.setTimeout(() => {
            if (!this.closedByUs) this.connect();
          }, 500);
          return;
        }
        return this.events.gone(m.reason);
    }
  }

  private onSnapshot(s: Snapshot): void {
    if (s.reset || s.depth !== this.depth || this.tiles.length !== s.mapW * s.mapH) {
      this.mapW = s.mapW;
      this.mapH = s.mapH;
      this.tiles = new Uint8Array(s.mapW * s.mapH).fill(255);
      if (s.depth !== this.depth) this.buffer = [];
      this.depth = s.depth;
    }
    for (let i = 0; i < s.tiles.length; i += 2) this.tiles[s.tiles[i]!] = s.tiles[i + 1]!;
    if (s.tiles.length) this.tilesVersion += 1;
    this.buffer.push({ at: performance.now(), snap: s });
    if (this.buffer.length > 4) this.buffer.shift();
    const r = this.renderer!;
    for (const f of s.fx) {
      if (f.type === 'float' && f.x !== undefined && f.y !== undefined) r.float(f.x, f.y, f.text ?? '', f.color, f.size);
      else if (f.type === 'death' && f.x !== undefined && f.y !== undefined) r.puff(f.x, f.y);
      else if (f.type === 'shake') r.shake(f.amount ?? 3);
      else if (f.type === 'hurt') r.shake(2);
    }
    if (s.msgs.length) {
      this.log.push(...s.msgs);
      this.log = this.log.slice(-3);
    }
    const partyJson = JSON.stringify(s.party);
    if (partyJson !== this.partyJson) {
      const before = new Set(this.partyState?.invitations.map((i) => i.from) ?? []);
      this.partyJson = partyJson;
      this.partyState = s.party;
      this.events.party(s.party, s.party.invitations.some((i) => !before.has(i.from)));
    }
    this.updateHud(s);
  }

  /** Tegner mellem de to seneste snapshots, lidt bagud i tid, så bevægelserne er glatte. */
  private frameAt(now: number): Frame | null {
    const latest = this.buffer.at(-1);
    if (!latest) return null;
    const renderAt = now - 70;
    let a = latest;
    let b = latest;
    for (let i = this.buffer.length - 1; i > 0; i--) {
      if (this.buffer[i - 1]!.at <= renderAt) {
        a = this.buffer[i - 1]!;
        b = this.buffer[i]!;
        break;
      }
    }
    const t = b.at > a.at ? Math.max(0, Math.min(1, (renderAt - a.at) / (b.at - a.at))) : 1;
    const prev = new Map(a.snap.ents.map((e) => [e.id, e]));
    const ents: SnapshotEntity[] = b.snap.ents.map((e) => {
      const o = prev.get(e.id);
      return o ? { ...e, x: lerp(o.x, e.x, t), y: lerp(o.y, e.y, t) } : e;
    });
    const you = a.snap.depth === b.snap.depth
      ? { ...b.snap.you, x: lerp(a.snap.you.x, b.snap.you.x, t), y: lerp(a.snap.you.y, b.snap.you.y, t) }
      : b.snap.you;
    const s = latest.snap;
    return {
      mapW: this.mapW, mapH: this.mapH, tiles: this.tiles, tilesVersion: this.tilesVersion, you, ents, proj: s.proj, loot: s.loot,
      caches: s.caches, gate: s.gate, sealed: !!s.seal?.sealed, radius: B.view.visionRadius,
      party: s.party.members.filter((m) => !m.you && m.x !== null && m.y !== null).map((m) => ({ name: m.name, x: m.x!, y: m.y! })),
    };
  }

  private loop = (now: number): void => {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const f = this.frameAt(now);
    if (f && this.renderer) this.renderer.draw(f, dt);
    this.frame = requestAnimationFrame(this.loop);
  };

  private updateHud(s: Snapshot): void {
    const root = this.root;
    if (!root) return;
    const y = s.you;
    const setBar = (cls: string, value: number, max: number, text: string) => {
      const el = root.querySelector<HTMLElement>(`.bar.${cls}`)!;
      el.querySelector('i')!.style.width = `${Math.max(0, Math.min(1, value / Math.max(1, max))) * 100}%`;
      el.querySelector('span')!.textContent = text;
    };
    setBar('hp', y.hp, y.maxHp, `Life ${Math.ceil(y.hp)} / ${y.maxHp}`);
    setBar('stamina', y.stamina, y.maxStamina, `Stamina ${Math.floor(y.stamina)}`);
    setBar('focus', y.focus, y.maxFocus, `Focus ${Math.floor(y.focus)}`);
    setBar('hunger', y.hunger, B.hunger.max, y.starving ? 'Starving!' : `Hunger ${Math.floor(y.hunger)}`);
    setBar('echo', y.echo, y.echoNext, `Mark ${y.mark} · Echo ${y.echo} / ${y.echoNext}`);
    root.querySelector('.hud-points')!.classList.toggle('hidden', y.points <= 0);
    // Feature-010 VIEW-01: dybden i minerne; i byen distriktet og etagen (Feature-041).
    const floorName = s.area.floor === 3 ? ' · top floor' : s.area.floor === 2 ? ' · upper floor' : '';
    root.querySelector('.hud-depth')!.textContent = s.area.reach === 'city'
      ? `${s.area.reachName} · ${(s.area.ward ?? '').replace(/^./, (c) => c.toUpperCase())}${floorName}`
      : `${s.area.reachName} · Depth ${s.depth} of ${s.depths}`;
    const seal = root.querySelector<HTMLElement>('.hud-seal')!;
    if (!s.seal) seal.textContent = s.area.reach === 'city' ? (s.area.ward === 'the foundry' ? "The Smelter's foundry" : '') : s.depth === s.depths ? "The Foreman's Hall" : '';
    else if (s.seal.sealed) seal.textContent = 'SEALED – get out!';
    else {
      const left = Math.max(0, Math.ceil(s.seal.left));
      seal.textContent = `Sealed in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    }
    seal.classList.toggle('danger', !!s.seal && (s.seal.sealed || s.seal.left < 30));
    root.querySelector('.hud-renown')!.textContent = `Renown ${s.renown} · Gold found ${s.goldFound}`;
    root.querySelector('.hud-potions')!.textContent = String(y.potions);
    root.querySelector('.hud-rations')!.textContent = String(y.rations);
    const prompt = s.interact === 'descend' ? 'Descend – press F' : s.interact === 'gate' ? 'Claim the Tithe – press F'
      : s.interact === 'climb' ? 'Climb – press F' : s.interact === 'down' ? 'Go down – press F' : '';
    const promptEl = root.querySelector<HTMLElement>('.hud-prompt')!;
    if (promptEl.textContent !== prompt) promptEl.innerHTML = prompt ? `<button class="primary" data-act="game-act" data-id="interact">${prompt}</button>` : '';
    // Feature-028 VIEW-01: hotbaren nederst med tasterne 1–8; den valgte tast er fremhævet.
    const weapons = new Map([...(this.sheet ? [this.sheet.inventory.equipment.melee, this.sheet.inventory.equipment.ranged, ...this.sheet.inventory.pack] : [])].filter((i) => !!i).map((i) => [i!.id, i!.name]));
    const hotbar = HOTBAR_KEYS.map((k) => {
      const slot = y.hotbar[k];
      const name = !slot ? '' : 'echoArt' in slot ? slot.echoArt : weapons.get(slot.weapon) ?? 'Weapon';
      return `<button class="hotkey ${k === y.chosenKey ? 'selected' : ''}" data-act="hotkey" data-id="${k}" aria-label="Key ${k}: ${esc(name || 'empty')}">
        <b>${k}</b><span>${name ? esc(name) : '–'}</span></button>`;
    }).join('');
    if (hotbar !== this.hotbarHtml) {
      this.hotbarHtml = hotbar;
      root.querySelector('.hud-hotbar')!.innerHTML = hotbar;
    }
    // Kandidaterne og deres dybder (Feature-010 VIEW-01).
    const candidates = s.candidates
      .map((c) => `<li class="${c.you ? 'you' : ''} ${c.status !== 'in' ? 'out' : ''}" title="${esc(c.name)}${c.player ? '' : ' (NPC)'}">
        <span class="who">${esc(c.name)}${c.player ? '' : ' <span class="muted">(NPC)</span>'}</span>
        <span>${c.status === 'in' ? `${s.area.reach === 'city' ? 'ward' : 'depth'} ${c.depth}` : c.status}</span></li>`)
      .join('');
    if (candidates !== this.candidatesHtml) {
      this.candidatesHtml = candidates;
      root.querySelector('.hud-candidates')!.innerHTML = candidates;
    }
    root.querySelector('.hud-log')!.innerHTML = this.log.map((m) => `<div><b>${esc(m.who)}:</b> ${esc(m.text)}</div>`).join('');
  }

  // --- Input ---------------------------------------------------------------------------------------

  private typing(event: KeyboardEvent): boolean {
    const tag = (event.target as HTMLElement | null)?.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA';
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (this.typing(event) || event.metaKey || event.ctrlKey || event.altKey) return;
    const code = event.code;
    if (MOVE[code] || code === 'Space') {
      event.preventDefault();
      this.keys.add(code);
      this.sendInput();
      return;
    }
    if (event.repeat) return;
    const act = ACTS[code];
    if (act) {
      event.preventDefault();
      return this.act(act);
    }
    const digit = /^Digit([1-8])$/.exec(code);
    if (digit) {
      event.preventDefault();
      this.hotkey(digit[1] as HotbarKey);
    }
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    if (this.keys.delete(event.code)) this.sendInput();
  };

  private onBlur = (): void => {
    this.keys.clear();
    this.sendInput();
  };

  private sendInput(force = false): void {
    let x = 0;
    let y = 0;
    for (const k of this.keys) {
      const d = MOVE[k];
      if (d) {
        x += d[0];
        y += d[1];
      }
    }
    const input = { t: 'input' as const, moveX: Math.sign(x), moveY: Math.sign(y), attack: this.keys.has('Space') };
    const key = JSON.stringify(input);
    if (key === this.sent && !force) return;
    if (force && key === this.sent && !input.moveX && !input.moveY && !input.attack) return;
    this.sent = key;
    this.send(input);
  }

  private send(message: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }

  act(act: 'dodge' | 'potion' | 'ration' | 'interact'): void {
    this.send({ t: 'act', act });
  }

  /** Feature-028 CMD-01 Choose hotbar key: en tast eller et klik på hotbaren vælger, hvad Attack (Space) bruger. */
  hotkey(key: HotbarKey): void {
    this.send({ t: 'act', act: 'hotkey', key });
  }

  sheetAction(action: SheetAction): void {
    this.send({ t: 'sheet', action });
  }

  /** Feature-034 CMD-01 Invite player, CMD-02 Leave party; Feature-035 CMD-01 Accept, CMD-02 Decline. */
  partyAction(message: Extract<ClientMessage, { t: 'party' }>): void {
    this.send(message);
  }

  /** Feature-029 CMD-01 Leave the Tithe */
  leave(): void {
    this.send({ t: 'leave' });
  }

  unmount(): void {
    this.closedByUs = true;
    cancelAnimationFrame(this.frame);
    window.clearInterval(this.heartbeat);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.renderer?.dispose();
    this.socket?.close(1000, 'Done');
    this.socket = null;
    this.root = null;
  }
}
