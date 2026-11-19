// Fælles for api'ets tests: en separat testdatabase (maw_test), så spillets egne data aldrig røres.

import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import pg from 'pg';
import { buildApp } from '../src/app.ts';
import { createPool, migrate, type Pool } from '../src/db.ts';

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
