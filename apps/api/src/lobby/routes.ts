// Lobby: Feature-036 Open a Tithe, -025 Join a Tithe og -037 Launch the Tithe.

import { randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { EVENT, MESSAGES, type TitheLaunched } from '@maw/contracts';
import { envelope } from '@maw/platform';
import { BALANCE as B } from '@maw/rules';
import { transaction, type Client, type Pool } from '../db.ts';
import { INVALID, refuse, requireUser } from '../http.ts';
import { enqueue } from '../outbox.ts';
import { members, membership, syncRunning, type MemberRow, type TitheRow } from './store.ts';
import { workingCopy } from './working-copy.ts';

/** Navne sammenlignes uden forskel på store og små bogstaver og uden mellemrum i enderne. */
const nameKey = (name: string) => name.trim().toLocaleLowerCase('en');

const reachName = (id: string) => B.reaches.find((r) => r.id === id)?.name ?? id;

function lobbyView(tithe: TitheRow, list: MemberRow[], userId: string) {
  return {
    name: tithe.name,
    reach: tithe.reach,
    reachName: reachName(tithe.reach),
    isOpener: tithe.opener_user_id === userId,
    players: list.map((m) => ({ userName: m.user_name, characterName: m.character_name, mark: m.mark, opener: m.user_id === tithe.opener_user_id })),
    max: B.lobby.maxPlayers,
  };
}

/** Hvor spilleren er: ingen steder, i en lobby eller i en Tithe (med billetten til WebSocket, planen afsnit 8). */
async function current(db: Pool | Client, userId: string) {
  await syncRunning(db);
  const found = await membership(db, userId);
  if (!found) return { state: 'none' as const };
  if (found.tithe.status === 'launched') return { state: 'playing' as const, tithe: { name: found.tithe.name }, ticket: found.member.ticket };
  return { state: 'lobby' as const, tithe: lobbyView(found.tithe, await members(db, found.tithe.id), userId) };
}

/** Den karakter, brugeren spiller, med det lobbyen viser: brugernavn, navn og Mark (Feature-036 VIEW-02). */
async function player(db: Client, userId: string) {
  const { rows } = await db.query<{ user_name: string; id: string; name: string; mark: number }>(
    `select u.user_name, c.id, c.name, c.mark from characters.rosters r
     join characters.characters c on c.id = r.active_character_id
     join accounts.users u on u.id = r.user_id
     where r.user_id = $1`,
    [userId],
  );
  return rows[0];
}

const NO_CHARACTER = { message: 'Choose a character first.' };

export function lobbyRoutes(app: FastifyInstance, pool: Pool): void {
  // Feature-036 VIEW-01 Tithes
  app.get('/api/tithes', async (request, reply) => {
    const userId = requireUser(request, reply);
    if (!userId) return reply;
    await syncRunning(pool);
    const { rows } = await pool.query<TitheRow & { opener_name: string; players: string[] }>(
      `select t.*, (select user_name from lobby.members where user_id = t.opener_user_id) as opener_name,
              array(select user_name from lobby.members m where m.tithe_id = t.id order by joined_at, user_id) as players
       from lobby.tithes t where t.status = 'open' order by t.created_at`,
    );
    return reply.send({
      // Feature-036 VIEW-01: tavlen viser Reaches med en kort beskrivelse og de åbne Tithes med deres Reach.
      reaches: B.reaches.map((r) => ({ id: r.id, number: r.number, name: r.name, text: r.text })),
      tithes: rows.map((t) => ({
        name: t.name, reach: t.reach, reachName: reachName(t.reach), opener: t.opener_name, players: t.players, count: t.players.length,
        max: B.lobby.maxPlayers, full: t.players.length >= B.lobby.maxPlayers,
      })),
      max: B.lobby.maxPlayers,
    });
  });

  app.get('/api/tithes/current', async (request, reply) => {
    const userId = requireUser(request, reply);
    if (!userId) return reply;
    return reply.send(await current(pool, userId));
  });

  // Feature-036 CMD-01 Open a Tithe
  app.post<{ Body: { name?: unknown; reach?: unknown } }>('/api/tithes', async (request, reply) => {
    const userId = requireUser(request, reply);
    if (!userId) return reply;
    const raw = request.body?.name;
    const name = typeof raw === 'string' ? raw.trim() : '';
    if ([...name].length < B.lobby.nameMin || [...name].length > B.lobby.nameMax) return refuse(reply, 400, INVALID);
    // Feature-036 CMD-01: Tithen åbnes i en af Reaches; uden valg i The Old Mines.
    const reach = request.body?.reach ?? 'mines';
    if (!B.reaches.some((r) => r.id === reach)) return refuse(reply, 400, INVALID);
    await syncRunning(pool);
    const result = await transaction(pool, async (client) => {
      await client.query('select pg_advisory_xact_lock(7272003)');
      const me = await player(client, userId);
      if (!me) return 'no-character' as const;
      if (await membership(client, userId)) return 'busy' as const;
      const taken = await client.query('select 1 from lobby.tithes where name_key = $1', [nameKey(name)]);
      if (taken.rowCount) return 'taken' as const;
      const id = randomUUID();
      await client.query(`insert into lobby.tithes (id, name, name_key, opener_user_id, status, reach) values ($1, $2, $3, $4, 'open', $5)`, [id, name, nameKey(name), userId, reach]);
      await join(client, id, userId, me);
      return 'ok' as const;
    });
    if (result === 'no-character') return refuse(reply, 409, NO_CHARACTER);
    if (result === 'busy') return refuse(reply, 409, { message: MESSAGES.inLobbyOrTithe });
    if (result === 'taken') return refuse(reply, 409, { message: MESSAGES.titheNameTaken, field: 'name' });
    return reply.code(201).send(await current(pool, userId));
  });

  // Feature-025 CMD-01 Join a Tithe
  app.post<{ Params: { name: string } }>('/api/tithes/:name/join', async (request, reply) => {
    const userId = requireUser(request, reply);
    if (!userId) return reply;
    await syncRunning(pool);
    const result = await transaction(pool, async (client) => {
      await client.query('select pg_advisory_xact_lock(7272003)');
      const me = await player(client, userId);
      if (!me) return 'no-character' as const;
      if (await membership(client, userId)) return 'busy' as const;
      const { rows } = await client.query<TitheRow>(`select * from lobby.tithes where name_key = $1 and status = 'open'`, [nameKey(request.params.name)]);
      const tithe = rows[0];
      if (!tithe) return 'missing' as const;
      if ((await members(client, tithe.id)).length >= B.lobby.maxPlayers) return 'full' as const;
      await join(client, tithe.id, userId, me);
      return 'ok' as const;
    });
    if (result === 'no-character') return refuse(reply, 409, NO_CHARACTER);
    if (result === 'busy') return refuse(reply, 409, { message: MESSAGES.inLobbyOrTithe });
    if (result === 'missing') return refuse(reply, 404, { message: 'The Tithe is gone.' });
    if (result === 'full') return refuse(reply, 409, { message: MESSAGES.titheFull });
    return reply.send(await current(pool, userId));
  });

  // Feature-037 CMD-01 Launch the Tithe: kun den, der åbnede den, også alene.
  app.post<{ Params: { name: string } }>('/api/tithes/:name/launch', async (request, reply) => {
    const userId = requireUser(request, reply);
    if (!userId) return reply;
    const result = await transaction(pool, async (client) => {
      const { rows } = await client.query<TitheRow>(`select * from lobby.tithes where name_key = $1 and status = 'open' for update`, [nameKey(request.params.name)]);
      const tithe = rows[0];
      if (!tithe) return 'missing' as const;
      if (tithe.opener_user_id !== userId) return 'not-opener' as const;
      const list = await members(client, tithe.id);
      const players: TitheLaunched['players'] = [];
      for (const m of list) {
        const copy = await workingCopy(client, m.character_id);
        if (!copy) continue;
        const ticket = randomBytes(24).toString('base64url');
        await client.query('update lobby.members set ticket = $2 where user_id = $1', [m.user_id, ticket]);
        players.push({ userId: m.user_id, userName: m.user_name, characterId: m.character_id, ticket, ...copy });
      }
      await client.query(`update lobby.tithes set status = 'launched', launched_at = now() where id = $1`, [tithe.id]);
      // Feature-037 EVT-01 Tithe launched → Feature-010 SVC-01 Tithe master
      // Feature-037: Mark hos den, der startede Tithen, sætter dens niveau (Feature-010, -011).
      const opener = players.find((x) => x.userId === tithe.opener_user_id);
      const data: TitheLaunched = {
        titheId: tithe.id, name: tithe.name, reach: tithe.reach === 'city' ? 'city' : 'mines', players,
        ...(opener ? { level: opener.character.level } : {}),
      };
      await enqueue(client, envelope(EVENT.titheLaunched, data));
      return 'ok' as const;
    });
    if (result === 'missing') return refuse(reply, 404, { message: 'The Tithe is gone.' });
    if (result === 'not-opener') return refuse(reply, 403, { message: 'Only the player who opened the Tithe can launch it.' });
    return reply.send(await current(pool, userId));
  });

  // Feature-037 CMD-02 Leave the lobby. Forlader den, der åbnede Tithen, lukkes den, og de andre er tilbage ved listen.
  app.post<{ Params: { name: string } }>('/api/tithes/:name/leave', async (request, reply) => {
    const userId = requireUser(request, reply);
    if (!userId) return reply;
    await transaction(pool, async (client) => {
      const found = await membership(client, userId);
      if (!found || found.tithe.status !== 'open' || nameKey(found.tithe.name) !== nameKey(request.params.name)) return;
      if (found.tithe.opener_user_id === userId) await client.query('delete from lobby.tithes where id = $1', [found.tithe.id]);
      else await client.query('delete from lobby.members where user_id = $1', [userId]);
    });
    return reply.send(await current(pool, userId));
  });
}

async function join(client: Client, titheId: string, userId: string, me: { user_name: string; id: string; name: string; mark: number }): Promise<void> {
  await client.query(
    'insert into lobby.members (user_id, tithe_id, user_name, character_id, character_name, mark) values ($1, $2, $3, $4, $5, $6)',
    [userId, titheId, me.user_name, me.id, me.name, me.mark],
  );
}

/** Svar, når karakteren er i en lobby eller en Tithe (planen, afsnit 5). */
export function refuseBusy(reply: FastifyReply): FastifyReply {
  return refuse(reply, 409, { message: MESSAGES.inLobbyOrTithe });
}
