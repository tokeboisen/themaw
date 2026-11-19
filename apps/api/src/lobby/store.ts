// Lobbyens data (Feature-036, -025, -037) og låsen, der holder karakteren fast, mens den er i en lobby eller en Tithe.

import type { Client, Pool } from '../db.ts';
import { registry } from './registry.ts';

type Db = Pool | Client;

/** En Tithe, der lige er startet, har et øjeblik til at dukke op i tithe-server, før lobbyen slipper den. */
const LAUNCH_GRACE_SECONDS = 20;

export interface TitheRow {
  id: string;
  name: string;
  opener_user_id: string;
  status: 'open' | 'launched';
  launched_at: Date | null;
}

export interface MemberRow {
  user_id: string;
  tithe_id: string;
  user_name: string;
  character_id: string;
  character_name: string;
  mark: number;
  ticket: string | null;
}

/**
 * Rydder de startede Tithes op, som ikke kører længere, og de spillere, hvis del er slut (Feature-016): så er navnet
 * ledigt igen, og spilleren kan ændre karakteren i Rim.
 */
export async function syncRunning(db: Db): Promise<void> {
  const launched = await db.query<TitheRow>(`select * from lobby.tithes where status = 'launched'`);
  if (!launched.rows.length) return;
  const running = await registry().running();
  if (!running) return;
  const byId = new Map(running.map((t) => [t.id, new Set(t.players)]));
  for (const t of launched.rows) {
    const players = byId.get(t.id);
    const young = t.launched_at && Date.now() - t.launched_at.getTime() < LAUNCH_GRACE_SECONDS * 1000;
    if (!players) {
      if (!young) await db.query('delete from lobby.tithes where id = $1', [t.id]);
      continue;
    }
    await db.query('delete from lobby.members where tithe_id = $1 and not (user_id = any($2::uuid[]))', [t.id, [...players]]);
    await db.query(`delete from lobby.tithes t where id = $1 and not exists (select 1 from lobby.members m where m.tithe_id = t.id)`, [t.id]);
  }
}

export async function membership(db: Db, userId: string): Promise<{ tithe: TitheRow; member: MemberRow } | null> {
  const { rows } = await db.query<MemberRow>('select * from lobby.members where user_id = $1', [userId]);
  const member = rows[0];
  if (!member) return null;
  const tithe = await db.query<TitheRow>('select * from lobby.tithes where id = $1', [member.tithe_id]);
  return tithe.rows[0] ? { tithe: tithe.rows[0], member } : null;
}

/** Er brugeren i en lobby eller en Tithe? Så afviser Rim, Characters og Gear ændringer af karakteren. */
export async function busy(db: Db, userId: string): Promise<boolean> {
  const found = await membership(db, userId);
  if (!found) return false;
  if (found.tithe.status === 'open') return true;
  await syncRunning(db);
  return (await membership(db, userId)) !== null;
}

export async function members(db: Db, titheId: string): Promise<MemberRow[]> {
  return (await db.query<MemberRow>('select * from lobby.members where tithe_id = $1 order by joined_at, user_id', [titheId])).rows;
}
