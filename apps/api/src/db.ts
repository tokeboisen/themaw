// Postgres: forbindelse, ventetid ved opstart og migrationer (SQL-filer i apps/api/migrations, i navneorden).

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';

export type Pool = pg.Pool;
export type Client = pg.PoolClient;

export const MIGRATIONS = join(import.meta.dirname, '..', 'migrations');

export function createPool(connectionString: string): Pool {
  return new pg.Pool({ connectionString, max: 10 });
}

export async function waitForDatabase(pool: Pool, log: (m: string) => void = () => {}, retries = 30): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await pool.query('select 1');
      return;
    } catch (err) {
      if (attempt >= retries) throw err;
      log(`Postgres is not ready (attempt ${attempt}): ${(err as Error).message}`);
      await new Promise((resolve) => setTimeout(resolve, 1000 * Math.min(attempt, 5)));
    }
  }
}

const MIGRATION_LOCK = 7_272_001; // advisory lock, så to processer ikke migrerer samtidig

export async function migrate(pool: Pool, folder = MIGRATIONS, log: (m: string) => void = () => {}): Promise<string[]> {
  const client = await pool.connect();
  const done: string[] = [];
  try {
    await client.query('select pg_advisory_lock($1)', [MIGRATION_LOCK]);
    await client.query(`create schema if not exists platform;
      create table if not exists platform.migrations (name text primary key, applied_at timestamptz not null default now())`);
    const files = (await readdir(folder)).filter((f) => f.endsWith('.sql')).sort();
    const applied = new Set((await client.query<{ name: string }>('select name from platform.migrations')).rows.map((r) => r.name));
    for (const file of files.filter((f) => !applied.has(f))) {
      try {
        await client.query('begin');
        await client.query(await readFile(join(folder, file), 'utf8'));
        await client.query('insert into platform.migrations (name) values ($1)', [file]);
        await client.query('commit');
        done.push(file);
        log(`Migration ${file} applied`);
      } catch (err) {
        await client.query('rollback');
        throw err;
      }
    }
  } finally {
    await client.query('select pg_advisory_unlock($1)', [MIGRATION_LOCK]).catch(() => {});
    client.release();
  }
  return done;
}

/** Kører fn i en transaktion. */
export async function transaction<T>(pool: Pool, fn: (client: Client) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}
