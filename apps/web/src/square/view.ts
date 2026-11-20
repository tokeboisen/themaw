// Feature-042 VIEW-01 Mustering Square: pladsen i the Rim. Browseren sender retningen; tithe-server flytter spillerne og
// sender dem tilbage. Smedjen, apoteket, Patrons' Hall og Tithe Board åbnes med F, når man står ved dem.

import type { SquarePlayerView, SquareServerMessage } from '@maw/contracts';
import { ROAD, SQUARE_BOARD, SQUARE_BUILDINGS, SQUARE_H, SQUARE_PLACES, SQUARE_W, WALL, placeAt, squareMap, type SquarePlace } from '@maw/rules';
import { esc } from '../dom.ts';

export interface SquareEvents {
  /** F eller et klik på knappen ved et sted. */
  open(place: SquarePlace): void;
}

export interface SquareHud {
  title: string;
  sub: string;
  gold: number;
  giftsWaiting: number;
}

const MOVE: Record<string, [number, number]> = {
  KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
};

const PLACE_COLORS: Record<string, { wall: string; roof: string; glow: string }> = {
  forge: { wall: '#4a2a22', roof: '#6b3a2c', glow: 'rgba(255,140,60,0.35)' },
  apothecary: { wall: '#2c3f2c', roof: '#3d5a3a', glow: 'rgba(120,220,140,0.3)' },
  patrons: { wall: '#3a2c48', roof: '#54406a', glow: 'rgba(255,216,74,0.45)' },
};

interface Buffered {
  at: number;
  players: SquarePlayerView[];
}

export class SquareView {
  private root: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private socket: WebSocket | null = null;
  private frame = 0;
  private keys = new Set<string>();
  private sent = '';
  private buffer: Buffered[] = [];
  private closed = false;
  private hud: SquareHud = { title: 'The Mustering Square', sub: '', gold: 0, giftsWaiting: 0 };
  private promptPlace: SquarePlace | null = null;
  private readonly events: SquareEvents;
  private retry = 0;

  constructor(events: SquareEvents) {
    this.events = events;
  }

  get mounted(): boolean {
    return !!this.root?.isConnected;
  }

  mount(container: HTMLElement): void {
    container.innerHTML = `<div class="square">
      <canvas class="view"></canvas>
      <header class="square-top">
        <div><h1 class="square-title"></h1><p class="muted square-sub"></p></div>
        <div class="actions">
          <span class="gold-text big-gold square-gold"></span>
          <button class="primary" data-act="sheet">Character</button>
          <button class="ghost" data-act="characters">Characters</button>
          <button class="ghost" data-act="others">Other players</button>
          <button class="ghost" data-act="statistics">Statistics</button>
          <button class="ghost" data-act="help">Help</button>
          <button class="ghost" data-act="account">Account</button>
        </div>
      </header>
      <div class="square-prompt"></div>
      <div class="hud-status square-status"></div>
    </div>`;
    this.root = container.querySelector<HTMLElement>('.square')!;
    this.canvas = this.root.querySelector('canvas')!;
    this.closed = false;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    this.frame = requestAnimationFrame(this.loop);
    this.connect();
    this.setHud(this.hud);
  }

  setHud(hud: SquareHud): void {
    this.hud = hud;
    const root = this.root;
    if (!root) return;
    root.querySelector('.square-title')!.textContent = hud.title;
    root.querySelector('.square-sub')!.textContent = hud.sub;
    root.querySelector('.square-gold')!.textContent = `${hud.gold} gold`;
  }

  private connect(): void {
    const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${scheme}://${location.host}/ws?square=1`);
    this.socket = socket;
    this.status('Entering the square…');
    socket.onmessage = (event) => {
      const m = JSON.parse(String(event.data)) as SquareServerMessage;
      if (m.t === 'square') {
        this.status('');
        this.retry = 0;
        this.buffer.push({ at: performance.now(), players: m.players });
        if (this.buffer.length > 4) this.buffer.shift();
      }
    };
    socket.onclose = () => {
      if (this.closed || this.socket !== socket) return;
      this.status('The square is out of reach. Trying again…');
      this.retry = Math.min(5000, 500 + this.retry * 2);
      window.setTimeout(() => {
        if (!this.closed) this.connect();
      }, this.retry);
    };
  }

  private status(text: string): void {
    const el = this.root?.querySelector('.square-status');
    if (el) el.textContent = text;
  }

  // --- Input ---------------------------------------------------------------------------------------

  private typing(event: KeyboardEvent): boolean {
    const tag = (event.target as HTMLElement | null)?.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (this.typing(event) || event.metaKey || event.ctrlKey || event.altKey) return;
    if (MOVE[event.code]) {
      event.preventDefault();
      this.keys.add(event.code);
      this.sendInput();
      return;
    }
    if (event.code === 'KeyF' && !event.repeat && this.promptPlace) {
      event.preventDefault();
      this.events.open(this.promptPlace);
    }
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    if (this.keys.delete(event.code)) this.sendInput();
  };

  private onBlur = (): void => {
    this.keys.clear();
    this.sendInput();
  };

  private sendInput(): void {
    let x = 0;
    let y = 0;
    for (const k of this.keys) {
      const d = MOVE[k];
      if (d) {
        x += d[0];
        y += d[1];
      }
    }
    const message = JSON.stringify({ t: 'input', moveX: Math.sign(x), moveY: Math.sign(y) });
    if (message === this.sent) return;
    this.sent = message;
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(message);
  }

  // --- Tegning ------------------------------------------------------------------------------------

  private players(now: number): SquarePlayerView[] {
    const latest = this.buffer.at(-1);
    if (!latest) return [];
    const renderAt = now - 60;
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
    const before = new Map(a.players.map((p) => [p.id, p]));
    return b.players.map((p) => {
      const o = before.get(p.id);
      return o ? { ...p, x: o.x + (p.x - o.x) * t, y: o.y + (p.y - o.y) * t } : p;
    });
  }

  private loop = (now: number): void => {
    this.draw(now);
    this.frame = requestAnimationFrame(this.loop);
  };

  private draw(now: number): void {
    const canvas = this.canvas;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0b0807';
    ctx.fillRect(0, 0, W, H);
    // Hele pladsen i ét billede, under toplinjen.
    const top = 70;
    const tile = Math.max(12, Math.min((W - 24) / SQUARE_W, (H - top - 16) / SQUARE_H));
    const ox = (W - tile * SQUARE_W) / 2;
    const oy = top + Math.max(0, (H - top - tile * SQUARE_H) / 2);
    const sx = (x: number) => ox + x * tile;
    const sy = (y: number) => oy + y * tile;
    const map = squareMap();
    for (let y = 0; y < SQUARE_H; y++) {
      for (let x = 0; x < SQUARE_W; x++) {
        const v = map.tiles[y * SQUARE_W + x];
        if (v === WALL) {
          ctx.fillStyle = (x + y) % 2 ? '#2a221c' : '#282019';
        } else {
          ctx.fillStyle = v === ROAD ? ((x + y) % 2 ? '#3b332b' : '#383028') : '#4a3f33';
        }
        ctx.fillRect(sx(x), sy(y), tile + 0.5, tile + 0.5);
      }
    }
    // Bygningerne ved stederne, med navn over døren; Patrons' Hall gløder, når der venter gaver (Feature-042).
    const label = (text: string, x: number, y: number, color = '#ece4d6', size = 13) => {
      ctx.font = `600 ${size}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText(text, x, y);
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
    };
    for (const b of SQUARE_BUILDINGS) {
      const c = PLACE_COLORS[b.id]!;
      ctx.fillStyle = c.wall;
      ctx.fillRect(sx(b.x), sy(b.y), b.w * tile, b.h * tile);
      ctx.fillStyle = c.roof;
      ctx.fillRect(sx(b.x) + 3, sy(b.y) + 3, b.w * tile - 6, b.h * tile - 6);
      const glow = b.id !== 'patrons' || this.hud.giftsWaiting > 0;
      const place = SQUARE_PLACES.find((p) => p.id === b.id)!;
      if (glow) {
        const pulse = 0.75 + 0.25 * Math.sin(now / 300);
        ctx.fillStyle = c.glow.replace(/[\d.]+\)$/, `${(Number(/([\d.]+)\)$/.exec(c.glow)?.[1] ?? 0.3) * pulse).toFixed(2)})`);
        ctx.beginPath();
        ctx.arc(sx(place.x), sy(place.y), tile * 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
      label(b.label, sx(b.x + b.w / 2), sy(b.y + b.h / 2) + 5, b.id === 'patrons' && this.hud.giftsWaiting ? '#ffd84a' : '#ece4d6');
    }
    // Tithe Board i midten.
    const bd = SQUARE_BOARD;
    ctx.fillStyle = '#5a3d22';
    ctx.fillRect(sx(bd.x) - 4, sy(bd.y), bd.w * tile + 8, bd.h * tile);
    ctx.fillStyle = '#c9b48a';
    ctx.fillRect(sx(bd.x) + 2, sy(bd.y) + 4, bd.w * tile - 4, bd.h * tile - 14);
    ctx.fillStyle = '#6b5a3f';
    for (let i = 0; i < 4; i++) ctx.fillRect(sx(bd.x) + 6, sy(bd.y) + 9 + i * (tile * 0.35), bd.w * tile - 12, 2);
    label('The Tithe Board', sx(bd.x + bd.w / 2), sy(bd.y) - 6, '#ffd84a');
    label('To the Maw', sx(18), sy(SQUARE_H - 0.6), '#a39581', 12);

    // Spillerne med deres brugernavne.
    const players = this.players(now);
    for (const p of players) {
      const x = sx(p.x);
      const y = sy(p.y);
      const r = tile * 0.35;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = p.you ? '#4fa3ff' : '#3fc7c0';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = p.you ? '#e8f2ff' : '#e8fffd';
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + p.facing[0] * r * 0.5, y + p.facing[1] * r * 0.5);
      ctx.lineTo(x + p.facing[0] * r * 1.4, y + p.facing[1] * r * 1.4);
      ctx.stroke();
      label(p.name, x, y - r - 6, p.you ? '#cfe5ff' : '#9ff3ee', 12);
    }

    // "<name> – press F", når man står ved et sted.
    const me = players.find((p) => p.you);
    const place = me ? placeAt(me.x, me.y) : null;
    if ((place?.id ?? null) !== this.promptPlace) {
      this.promptPlace = place?.id ?? null;
      const el = this.root?.querySelector('.square-prompt');
      if (el) el.innerHTML = place ? `<button class="primary" data-act="square-open" data-id="${place.id}">${esc(place.name)} – press F</button>` : '';
    }
  }

  unmount(): void {
    this.closed = true;
    cancelAnimationFrame(this.frame);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.socket?.close(1000, 'Left the square');
    this.socket = null;
    this.root = null;
    this.canvas = null;
    this.buffer = [];
    this.keys.clear();
    this.sent = '';
  }
}
