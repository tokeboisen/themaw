// Accounts: Feature-031 Create user, Feature-032 Log in, Feature-033 Log out.

import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { MESSAGES } from '@maw/contracts';
import { isValidPassword, isValidUserName, userNameKey } from '@maw/rules';
import { transaction, type Client, type Pool } from '../db.ts';
import { INVALID, SESSION_COOKIE, clearSessionCookie, readCookie, refuse, setSessionCookie } from '../http.ts';
import { DUMMY_HASH, hashPassword, verifyPassword } from './password.ts';

const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

async function startSession(db: Pool | Client, userId: string, device: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await db.query('insert into accounts.sessions (token_hash, user_id, device) values ($1, $2, $3)', [tokenHash(token), userId, device]);
  return token;
}

interface Credentials {
  userName?: unknown;
  password?: unknown;
}

export function accountsRoutes(app: FastifyInstance, pool: Pool): void {
  // Den indloggede bruger findes ud fra sessions-cookien (Feature-032 EVT-01).
  app.addHook('onRequest', async (request) => {
    const token = readCookie(request, SESSION_COOKIE);
    if (!token) return;
    const hash = tokenHash(token);
    const { rows } = await pool.query<{ user_id: string; stale: boolean }>(
      `select user_id, last_seen_at < now() - interval '20 seconds' as stale from accounts.sessions where token_hash = $1`,
      [hash],
    );
    if (!rows[0]) return;
    request.userId = rows[0].user_id;
    // Feature-034 VIEW-01: hvem er logget ind lige nu. Opdateres højst hvert 20. sekund.
    if (rows[0].stale) await pool.query('update accounts.sessions set last_seen_at = now() where token_hash = $1', [hash]);
  });

  // Feature-031 CMD-01 Create user
  app.post<{ Body: Credentials }>('/api/users', async (request, reply) => {
    const { userName, password } = request.body ?? {};
    if (typeof userName !== 'string' || typeof password !== 'string') return refuse(reply, 400, INVALID);
    if (!isValidUserName(userName)) return refuse(reply, 400, { field: 'userName', message: MESSAGES.userNameInvalid });
    if (!isValidPassword(password)) return refuse(reply, 400, { field: 'password', message: MESSAGES.passwordShort });
    const hash = await hashPassword(password);
    const id = randomUUID();
    const token = await transaction(pool, async (client) => {
      const inserted = await client.query(
        `insert into accounts.users (id, user_name, user_name_key, password_hash) values ($1, $2, $3, $4)
         on conflict (user_name_key) do nothing`,
        [id, userName, userNameKey(userName), hash],
      );
      if (inserted.rowCount === 0) return null;
      // Feature-031 EVT-01: "A new user is signed in right away."
      return startSession(client, id, request.headers['user-agent'] ?? '');
    });
    if (!token) return refuse(reply, 409, { field: 'userName', message: MESSAGES.userNameTaken });
    setSessionCookie(reply, token);
    return reply.code(201).send({ userName });
  });

  // Feature-032 CMD-01 Log in
  app.post<{ Body: Credentials }>('/api/sessions', async (request, reply) => {
    const { userName, password } = request.body ?? {};
    if (typeof userName !== 'string' || typeof password !== 'string') return refuse(reply, 400, INVALID);
    const { rows } = await pool.query<{ id: string; user_name: string; password_hash: string }>(
      'select id, user_name, password_hash from accounts.users where user_name_key = $1',
      [userNameKey(userName)],
    );
    const user = rows[0];
    const ok = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);
    // "Wrong user name or password." uden at sige hvilket.
    if (!user || !ok) return refuse(reply, 401, { message: MESSAGES.wrongLogin });
    setSessionCookie(reply, await startSession(pool, user.id, request.headers['user-agent'] ?? ''));
    return reply.send({ userName: user.user_name });
  });

  // Feature-033 CMD-01 Log out. At logge ud under en Tithe afvises fra fase 3, hvor Tithes findes.
  app.delete('/api/sessions', async (request, reply) => {
    const token = readCookie(request, SESSION_COOKIE);
    if (token) await pool.query('delete from accounts.sessions where token_hash = $1', [tokenHash(token)]);
    clearSessionCookie(reply);
    return reply.code(204).send();
  });

  // Den indloggede bruger (Feature-033 VIEW-01 Account viser brugernavnet).
  // Kun inde i Docker (gatewayen sender kun /api/* hertil): tithe-server spørger, hvem en session-cookie tilhører, når
  // en spiller går ind på Mustering Square (Feature-042), og hvilken karakter spilleren spiller.
  app.get('/internal/whoami', async (request, reply) => {
    if (!request.userId) return reply.code(401).send({ message: 'Sign in first.' });
    const { rows } = await pool.query<{ user_name: string; id: string | null; name: string | null; mark: number | null }>(
      `select u.user_name, c.id, c.name, c.mark from accounts.users u
       left join characters.rosters r on r.user_id = u.id
       left join characters.characters c on c.id = r.active_character_id
       where u.id = $1`,
      [request.userId],
    );
    const row = rows[0];
    if (!row) return reply.code(401).send({ message: 'Sign in first.' });
    return reply.send({ userId: request.userId, userName: row.user_name, character: row.id ? { id: row.id, name: row.name, mark: row.mark } : null });
  });

  app.get('/api/me', async (request, reply) => {
    if (!request.userId) return refuse(reply, 401, { message: 'Sign in first.' });
    const { rows } = await pool.query<{ user_name: string }>('select user_name from accounts.users where id = $1', [request.userId]);
    return reply.send({ userName: rows[0]?.user_name });
  });
}
