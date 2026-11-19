// Fælles for api'ets tests: en separat testdatabase (maw_test), så spillets egne data aldrig røres.

import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import pg from 'pg';
import { bindingsFor } from '@maw/contracts';
import { BALANCE, backgroundById, createRng, generateItem, suggestedAllocation, type Item, type ItemOptions } from '@maw/rules';
import { buildApp } from '../src/app.ts';
import { createPool, migrate, type Pool } from '../src/db.ts';
import { HANDLERS, consumer } from '../src/events.ts';

export const hasDatabase = !!process.env.DATABASE_URL;

export async function testPool(): Promise<Pool> {
  const url = new URL(process.env.DATABASE_URL!);
  const admin = new pg.Client({ connectionString: url.toString() });
  await admin.connect();
  try {
    await admin.query('create database maw_test');
  } catch (err) {
    // 42P04: findes allerede. 23505: en anden testfil oprettede den i samme øjeblik.
    if (!['42P04', '23505'].includes((err as { code?: string }).code ?? '')) throw err;
  } finally {
    await admin.end();
  }
  url.pathname = '/maw_test';
  const pool = createPool(url.toString());
  await migrate(pool);
  return pool;
}

/** Testene kører parallelt og igen og igen; et kort tilfældigt endelse holder brugernavnene adskilt. */
const run = randomBytes(3).toString('hex');
export const named = (name: string) => `${name}-${run}`;

export async function setup(): Promise<{ pool: Pool; app: FastifyInstance }> {
  const pool = await testPool();
  return { pool, app: buildApp(pool) };
}

/** Opretter en bruger og returnerer sessions-cookien. */
export async function signUp(app: FastifyInstance, userName: string, password = 'correct horse'): Promise<string> {
  const response = await app.inject({ method: 'POST', url: '/api/users', payload: { userName, password } });
  if (response.statusCode !== 201) throw new Error(`sign up failed: ${response.body}`);
  return cookieOf(response.headers['set-cookie']);
}

export function cookieOf(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header[0] : header;
  return (value ?? '').split(';')[0]!;
}

export async function outboxTypes(pool: Pool, match: string): Promise<string[]> {
  const { rows } = await pool.query<{ type: string }>(`select type from platform.outbox where payload::text like $1`, [`%${match}%`]);
  return rows.map((r) => r.type);
}

/**
 * Leverer outboxens ventende events direkte til lytterne i api'et (events.ts), ligesom RabbitMQ gør i drift.
 * Testfilerne kører én ad gangen (npm test), så de ikke tager hinandens events.
 */
export async function deliverAll(pool: Pool): Promise<number> {
  let delivered = 0;
  for (;;) {
    const { rows } = await pool.query<{ id: string; type: string; payload: unknown; occurred_at: Date }>(
      `update platform.outbox set published_at = now()
       where id in (select id from platform.outbox where published_at is null order by occurred_at limit 100 for update skip locked)
       returning id, type, payload, occurred_at`,
    );
    if (!rows.length) return delivered;
    rows.sort((a, b) => a.occurred_at.getTime() - b.occurred_at.getTime());
    for (const row of rows) {
      const event = { id: row.id, type: row.type, occurredAt: row.occurred_at.toISOString(), data: row.payload };
      for (const context of Object.keys(HANDLERS)) {
        if (bindingsFor(context).includes(row.type) && HANDLERS[context]![row.type]) await consumer(pool, context)(event);
      }
      delivered += 1;
    }
  }
}

/** Opretter en karakter og leverer "Character created", så den har inventar, tegnebog og Forge. */
export async function createCharacter(app: FastifyInstance, pool: Pool, cookie: string, name = 'Kael', background = 'miner'): Promise<string> {
  const bg = backgroundById(BALANCE, background)!;
  const response = await app.inject({ method: 'POST', url: '/api/characters', headers: { cookie }, payload: { name, background, ...suggestedAllocation(bg) } });
  if (response.statusCode !== 201) throw new Error(`create character failed: ${response.body}`);
  await deliverAll(pool);
  return response.json().id as string;
}

/** Lægger ting direkte i pakken, f.eks. for at fylde den. */
export async function putInPack(pool: Pool, characterId: string, items: Item[]): Promise<void> {
  for (const item of items) {
    await pool.query(`insert into gear.items (id, character_id, location, data) values ($1, $2, 'pack', $3)`, [item.id, characterId, JSON.stringify(item)]);
  }
}

export function items(count: number, opts: ItemOptions = {}, level = 1): Item[] {
  const rng = createRng(randomBytes(4).readUInt32LE(0));
  return Array.from({ length: count }, () => generateItem(rng, level, BALANCE, opts));
}
