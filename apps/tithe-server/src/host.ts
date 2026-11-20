// Tithe master (Feature-010 SVC-01): starter en Tithe, når "Tithe launched" kommer, kører den 30 gange i sekundet og
// sender hver spiller et snapshot 20 gange i sekundet. Når en spillers del slutter, sendes "Tithe ended" på bussen
// (Feature-016) og resultatet til browseren. Spillerne forbinder med billetten fra lobbyen (planen, afsnit 8).

import type { IncomingMessage } from 'node:http';
import type { WebSocket } from 'ws';
import { EVENT, MESSAGES, type ClientMessage, type EventEnvelope, type PlayerDefeated, type ServerMessage, type TitheLaunched } from '@maw/contracts';
import { envelope } from '@maw/platform';
import {
  ATTRIBUTES, BALANCE as B, ECHO_ARTS, HOTBAR_KEYS, SKILLS, answerInvitation, isEquipSlot, createTithe, invitePlayer, leaveParty, leaveTithe,
  playersIn, queueAct, randomSeed, setInput, sheetAction, stepTithe, type Balance, type SheetAction, type Tithe,
} from '@maw/rules';
import { newViewState, results, sheet, snapshot, titheEnded, type ViewState } from './views.ts';

export interface Publisher {
  publish(event: EventEnvelope): Promise<void>;
}

const TICK_MS = 1000 / 30;
const SNAPSHOT_MS = 50;
/** En lukket Tithe bliver stående lidt, så browserne når at få resultatet. */
const CLOSED_LINGER_MS = 30_000;

interface Seat {
  userId: string;
  socket: WebSocket | null;
  view: ViewState;
  ended: boolean;
  leaveTimer: NodeJS.Timeout | null;
}

class Room {
  readonly tithe: Tithe;
  readonly seats = new Map<string, Seat>();
  private tick: NodeJS.Timeout;
  private snap: NodeJS.Timeout;
  private last = performance.now();
  private closedAt: number | null = null;
  private readonly host: Host;

  constructor(data: TitheLaunched, host: Host) {
    this.host = host;
    this.tithe = createTithe(
      {
        id: data.titheId,
        name: data.name,
        seed: randomSeed(),
        players: data.players.map((p) => ({ userId: p.userId, userName: p.userName, characterId: p.characterId, character: p.character, hotbar: p.hotbar })),
      },
      host.balance,
    );
    // Feature-029: at lukke appen er at forlade Tithen – også før den første forbindelse. Uret stopper, når spilleren forbinder.
    for (const p of data.players) {
      const seat: Seat = { userId: p.userId, socket: null, view: newViewState(this.tithe), ended: false, leaveTimer: null };
      seat.leaveTimer = setTimeout(() => leaveTithe(this.tithe, p.userId), host.balance.tithe.reconnectSeconds * 1000);
      this.seats.set(p.userId, seat);
    }
    this.tick = setInterval(() => this.step(), TICK_MS);
    this.snap = setInterval(() => this.broadcast(), SNAPSHOT_MS);
  }

  private step(): void {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    stepTithe(this.tithe, dt);
    this.settle();
    if (this.tithe.closed && this.closedAt === null) this.closedAt = now;
    if (this.closedAt !== null && now - this.closedAt > CLOSED_LINGER_MS) this.host.remove(this);
  }

  /** Feature-016 CMD-01: hver spiller, hvis del er slut, får "Tithe ended" på bussen og resultatet i browseren. */
  private settle(): void {
    // Feature-011 EVT-06 Player defeated → Market (Feature-018) og Characters (Feature-039).
    for (const d of this.tithe.defeats.splice(0)) {
      const data: PlayerDefeated = { titheId: this.tithe.id, ...d };
      this.host.publish(envelope(EVENT.playerDefeated, data));
    }
    for (const p of this.tithe.players) {
      const seat = this.seats.get(p.id);
      if (!p.end || !seat || seat.ended) continue;
      seat.ended = true;
      if (seat.leaveTimer) clearTimeout(seat.leaveTimer);
      this.host.publish(envelope(EVENT.titheEnded, titheEnded(this.tithe, p)));
      this.send(seat, snapshot(this.tithe, p, seat.view));
      this.send(seat, results(this.tithe, p));
      this.host.log(`${p.userName} left ${this.tithe.name}: ${p.end.kind}`);
    }
  }

  private broadcast(): void {
    const t = this.tithe;
    for (const p of playersIn(t)) {
      const seat = this.seats.get(p.id);
      if (!seat?.socket) continue;
      if (seat.view.sheetVersion !== p.sheetVersion) {
        seat.view.sheetVersion = p.sheetVersion;
        this.send(seat, sheet(t, p));
      }
      this.send(seat, snapshot(t, p, seat.view));
    }
    t.fx = [];
  }

  private send(seat: Seat, message: ServerMessage): void {
    if (seat.socket?.readyState === 1) seat.socket.send(JSON.stringify(message));
  }

  connect(userId: string, socket: WebSocket): void {
    const seat = this.seats.get(userId);
    const p = this.tithe.players.find((x) => x.id === userId);
    if (!seat || !p) return void socket.close(4004, 'Not in this Tithe');
    if (seat.socket && seat.socket !== socket) seat.socket.close(4000, 'Replaced by a new connection');
    seat.socket = socket;
    if (seat.leaveTimer) clearTimeout(seat.leaveTimer);
    seat.leaveTimer = null;
    seat.view = newViewState(this.tithe);
    this.send(seat, { t: 'welcome', name: this.tithe.name, you: userId });
    if (seat.ended) this.send(seat, results(this.tithe, p));
    socket.on('message', (raw) => this.receive(seat, raw.toString()));
    socket.on('close', () => {
      if (seat.socket !== socket) return;
      seat.socket = null;
      // Feature-029: en mistet forbindelse tæller som at forlade Tithen efter 60 sekunder.
      if (!seat.ended) seat.leaveTimer = setTimeout(() => leaveTithe(this.tithe, userId), this.host.balance.tithe.reconnectSeconds * 1000);
    });
  }

  private receive(seat: Seat, raw: string): void {
    let m: ClientMessage;
    try {
      m = JSON.parse(raw) as ClientMessage;
    } catch {
      return;
    }
    const t = this.tithe;
    const id = seat.userId;
    if (!m || typeof m !== 'object') return;
    switch (m.t) {
      case 'input':
        setInput(t, id, m);
        break;
      case 'act':
        if (m.act === 'hotkey') {
          if (HOTBAR_KEYS.includes(m.key)) queueAct(t, id, { act: 'hotkey', key: m.key });
        } else if (['dodge', 'potion', 'ration', 'interact'].includes(m.act)) queueAct(t, id, { act: m.act });
        break;
      case 'sheet': {
        if (!validSheetAction(m.action)) return this.send(seat, { t: 'refused', message: 'Invalid request.' });
        const refusal = sheetAction(t, id, m.action);
        if (refusal) this.send(seat, { t: 'refused', message: refusal === 'inventoryFull' ? MESSAGES.inventoryFull : 'Invalid request.' });
        break;
      }
      case 'party':
        // Feature-034 CMD-01 Invite player og CMD-02 Leave party; Feature-035 CMD-01 Accept og CMD-02 Decline.
        if (m.action === 'invite' && typeof m.userId === 'string') invitePlayer(t, id, m.userId);
        else if ((m.action === 'accept' || m.action === 'decline') && typeof m.from === 'string') answerInvitation(t, id, m.from, m.action === 'accept');
        else if (m.action === 'leave') leaveParty(t, id);
        break;
      case 'leave':
        // Feature-029 CMD-01 Leave the Tithe
        leaveTithe(t, id);
        break;
    }
  }

  stop(): void {
    clearInterval(this.tick);
    clearInterval(this.snap);
    for (const seat of this.seats.values()) {
      if (seat.leaveTimer) clearTimeout(seat.leaveTimer);
      seat.socket?.close(1001, 'The Tithe is over');
    }
  }
}

function validSheetAction(a: unknown): a is SheetAction {
  if (!a || typeof a !== 'object') return false;
  const x = a as Record<string, unknown>;
  switch (x.action) {
    case 'equip':
      return typeof x.itemId === 'string' && (x.ring === undefined || x.ring === 'ring1' || x.ring === 'ring2');
    case 'drop':
      return typeof x.itemId === 'string';
    case 'unequip':
      return isEquipSlot(x.slot);
    case 'hotbar':
      return (HOTBAR_KEYS as readonly unknown[]).includes(x.key) && (typeof x.itemId === 'string' || (ECHO_ARTS as readonly unknown[]).includes(x.echoArt));
    case 'clear':
      return (HOTBAR_KEYS as readonly unknown[]).includes(x.key);
    case 'attribute':
      return (ATTRIBUTES as readonly unknown[]).includes(x.attribute);
    case 'skill':
      return (SKILLS as readonly unknown[]).includes(x.skill);
    default:
      return false;
  }
}

export class Host {
  private readonly rooms = new Map<string, Room>();
  private readonly tickets = new Map<string, { titheId: string; userId: string }>();
  private readonly pending: EventEnvelope[] = [];
  private retry: NodeJS.Timeout | null = null;
  private flushing = false;
  private readonly publisher: Publisher;
  readonly log: (message: string) => void;
  readonly balance: Balance;

  constructor(publisher: Publisher, log: (message: string) => void = () => {}, balance: Balance = B) {
    this.publisher = publisher;
    this.log = log;
    this.balance = balance;
  }

  /** Feature-037 EVT-01 Tithe launched → Feature-010 CMD-01 Start the Tithe. Kommer det samme event igen, ignoreres det. */
  launch(data: TitheLaunched): void {
    if (this.rooms.has(data.titheId)) return;
    const room = new Room(data, this);
    this.rooms.set(data.titheId, room);
    for (const p of data.players) this.tickets.set(p.ticket, { titheId: data.titheId, userId: p.userId });
    this.log(`Started ${data.name} with ${data.players.length} player(s) and ${room.tithe.rivals.length} NPC rivals`);
  }

  remove(room: Room): void {
    room.stop();
    this.rooms.delete(room.tithe.id);
    for (const [ticket, seat] of this.tickets) if (seat.titheId === room.tithe.id) this.tickets.delete(ticket);
  }

  connect(socket: WebSocket, request: IncomingMessage): void {
    const ticket = new URL(request.url ?? '', 'http://localhost').searchParams.get('ticket') ?? '';
    const seat = this.tickets.get(ticket);
    const room = seat && this.rooms.get(seat.titheId);
    if (!seat || !room) {
      socket.send(JSON.stringify({ t: 'gone', reason: 'This Tithe is over.' } satisfies ServerMessage));
      return void socket.close(4004, 'Unknown ticket');
    }
    room.connect(seat.userId, socket);
  }

  /** Til lobbyen i api'et: de Tithes, der kører, og spillerne, hvis del ikke er slut. */
  running(): { id: string; name: string; players: string[] }[] {
    return [...this.rooms.values()].map((r) => ({ id: r.tithe.id, name: r.tithe.name, players: playersIn(r.tithe).map((p) => p.id) }));
  }

  /** Sendes på bussen; fejler det, prøves igen, så "Tithe ended" ikke går tabt. */
  publish(event: EventEnvelope): void {
    this.pending.push(event);
    void this.flush();
  }

  private async flush(): Promise<void> {
    if (this.flushing) return;
    this.flushing = true;
    try {
      while (this.pending.length) {
        try {
          await this.publisher.publish(this.pending[0]!);
          this.pending.shift();
        } catch (err) {
          this.log(`Publishing ${this.pending[0]!.type} failed: ${(err as Error).message}; retrying`);
          this.retry ??= setTimeout(() => {
            this.retry = null;
            void this.flush();
          }, 2000);
          return;
        }
      }
    } finally {
      this.flushing = false;
    }
  }

  /** Til tests: venter, til alt er sendt. */
  async drained(): Promise<void> {
    while (this.pending.length || this.flushing) await new Promise((resolve) => setTimeout(resolve, 10));
  }

  stop(): void {
    for (const room of [...this.rooms.values()]) this.remove(room);
    if (this.retry) clearTimeout(this.retry);
  }

  /** Til tests: Tithen, som den kører. */
  titheOf(titheId: string): Tithe | undefined {
    return this.rooms.get(titheId)?.tithe;
  }
}
