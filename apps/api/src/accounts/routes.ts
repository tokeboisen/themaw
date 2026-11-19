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
    const { rows } = await pool.query<{ user_id: string }>('select user_id from accounts.sessions where token_hash = $1', [tokenHash(token)]);
    if (rows[0]) request.userId = rows[0].user_id;
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
  app.get('/api/me', async (request, reply) => {
    if (!request.userId) return refuse(reply, 401, { message: 'Sign in first.' });
    const { rows } = await pool.query<{ user_name: string }>('select user_name from accounts.users where id = $1', [request.userId]);
    return reply.send({ userName: rows[0]?.user_name });
  });
}
