// Feature-042 Walk the Mustering Square: pladsen i the Rim. Maw Server holder spillernes positioner, så alle ser den
// samme plads. En spiller kendes på session-cookien, som api'et slår op (/internal/whoami, kun inde i Docker).

import type { IncomingMessage } from 'node:http';
import type { WebSocket } from 'ws';
import type { SquareClientMessage, SquarePlayerView, SquareServerMessage } from '@maw/contracts';
import { BALANCE, SQUARE_ENTRY, walkSquare } from '@maw/rules';

export interface Whoami {
  userId: string;
  userName: string;
  character: { id: string; name: string; mark: number } | null;
}

export type WhoamiFn = (cookie: string) => Promise<Whoami | null>;

export function httpWhoami(apiUrl: string): WhoamiFn {
  return async (cookie) => {
    try {
      const response = await fetch(`${apiUrl}/internal/whoami`, { headers: { cookie }, signal: AbortSignal.timeout(2000) });
      return response.ok ? ((await response.json()) as Whoami) : null;
    } catch {
      return null;
    }
  };
}

interface Walker {
  id: string;
  name: string;
  character: string | null;
  x: number;
  y: number;
  r: number;
  facing: [number, number];
  input: { moveX: number; moveY: number };
  socket: WebSocket | null;
  leaveTimer: NodeJS.Timeout | null;
}

const TICK_MS = 50;
/** En spiller, der genindlæser siden, forsvinder ikke fra pladsen med det samme. */
const LINGER_MS = 4000;

export class Square {
  private readonly walkers = new Map<string, Walker>();
  private readonly timer: NodeJS.Timeout;
  private last = performance.now();
  private readonly whoami: WhoamiFn;

  constructor(whoami: WhoamiFn) {
    this.whoami = whoami;
    this.timer = setInterval(() => this.step(), TICK_MS);
  }

  async connect(socket: WebSocket, request: IncomingMessage): Promise<void> {
    const me = await this.whoami(request.headers.cookie ?? '');
    if (!me) {
      socket.send(JSON.stringify({ t: 'gone', reason: 'Sign in first.' } satisfies SquareServerMessage));
      return void socket.close(4001, 'Not signed in');
    }
    let w = this.walkers.get(me.userId);
    if (!w) {
      w = {
        id: me.userId, name: me.userName, character: me.character?.name ?? null, x: SQUARE_ENTRY.x + (Math.random() - 0.5) * 2,
        y: SQUARE_ENTRY.y, r: 0.35, facing: [0, -1], input: { moveX: 0, moveY: 0 }, socket: null, leaveTimer: null,
      };
      this.walkers.set(me.userId, w);
    }
    w.name = me.userName;
    w.character = me.character?.name ?? null;
    if (w.leaveTimer) clearTimeout(w.leaveTimer);
    w.leaveTimer = null;
    if (w.socket && w.socket !== socket) w.socket.close(4000, 'Replaced by a new connection');
    w.socket = socket;
    const walker = w;
    socket.on('message', (raw) => {
      let m: SquareClientMessage;
      try {
        m = JSON.parse(raw.toString()) as SquareClientMessage;
      } catch {
        return;
      }
      if (m?.t === 'input') walker.input = { moveX: Number(m.moveX) || 0, moveY: Number(m.moveY) || 0 };
    });
    socket.on('close', () => {
      if (walker.socket !== socket) return;
      walker.socket = null;
      walker.input = { moveX: 0, moveY: 0 };
      walker.leaveTimer = setTimeout(() => this.walkers.delete(walker.id), LINGER_MS);
    });
  }

  private step(): void {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    for (const w of this.walkers.values()) {
      const { moveX, moveY } = w.input;
      if (Math.hypot(moveX, moveY) > 0.05) {
        const l = Math.hypot(moveX, moveY);
        w.facing = [moveX / l, moveY / l];
        walkSquare(w, moveX, moveY, BALANCE.character.moveSpeed, dt);
      }
    }
    const r2 = (x: number) => Math.round(x * 100) / 100;
    const all: Omit<SquarePlayerView, 'you'>[] = [...this.walkers.values()].map((w) => ({
      id: w.id, name: w.name, character: w.character, x: r2(w.x), y: r2(w.y), facing: [r2(w.facing[0]), r2(w.facing[1])],
    }));
    for (const w of this.walkers.values()) {
      if (w.socket?.readyState !== 1) continue;
      const message: SquareServerMessage = { t: 'square', players: all.map((p) => ({ ...p, you: p.id === w.id })) };
      w.socket.send(JSON.stringify(message));
    }
  }

  /** Antal spillere på pladsen (til sundhedstjekket). */
  get count(): number {
    return this.walkers.size;
  }

  stop(): void {
    clearInterval(this.timer);
    for (const w of this.walkers.values()) {
      if (w.leaveTimer) clearTimeout(w.leaveTimer);
      w.socket?.close(1001, 'Server is shutting down');
    }
  }
}
