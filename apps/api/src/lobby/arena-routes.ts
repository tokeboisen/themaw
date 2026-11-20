// Lobby: Feature-044 Arrange an arena match – arena-tavlen, siderne og Start. En arenakamp står i lobbyens tabeller med
// reach 'arena', et format og en indsats; låsen, billetterne og Leave (POST /api/tithes/:name/leave) er de samme som for
// en Tithe.

import { randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { EVENT, MESSAGES, type ArenaMatchStarted } from '@maw/contracts';
import { envelope } from '@maw/platform';
import { BALANCE as B, arenaPlaces, isArenaFormat, type ArenaFormat, type ArenaSide } from '@maw/rules';
import { transaction, type Client, type Pool } from '../db.ts';
import { INVALID, refuse, requireUser } from '../http.ts';
import { enqueue } from '../outbox.ts';
import { current, join, nameKey, player } from './routes.ts';
import { members, membership, syncRunning, type MemberRow, type TitheRow } from './store.ts';
import { workingCopy } from './working-copy.ts';

const NO_CHARACTER = { message: 'Choose a character first.' };
const SIDES: ArenaSide[] = [1, 2];
const isSide = (x: unknown): x is ArenaSide => x === 1 || x === 2;

const formatOf = (tithe: TitheRow): ArenaFormat => (isArenaFormat(tithe.format) ? tithe.format : '1v1');

/** Feature-044 VIEW-02 Arena match: navnet, formatet, indsatsen og spillerne på hver side. */
export function arenaView(tithe: TitheRow, list: MemberRow[], userId: string) {
  const format = formatOf(tithe);
  const places = arenaPlaces(format, B);
  const side = (n: ArenaSide) => ({
    places: places[n],
    players: list.filter((m) => m.side === n).map((m) => ({
      userName: m.user_name, characterName: m.character_name, mark: m.mark, opener: m.user_id === tithe.opener_user_id, you: m.user_id === userId,
    })),
  });
  return {
    name: tithe.name,
    reach: 'arena' as const,
    reachName: 'The Arena',
    format,
    stake: tithe.stake,
    isOpener: tithe.opener_user_id === userId,
    sides: { 1: side(1), 2: side(2) },
    full: list.length >= places[1] + places[2],
  };
}

async function gold(db: Client, characterId: string): Promise<number> {
  const { rows } = await db.query<{ gold: number }>('select gold from market.wallets where character_id = $1', [characterId]);
  return rows[0]?.gold ?? 0;
}

export function arenaRoutes(app: FastifyInstance, pool: Pool): void {
  // Feature-044 VIEW-01 Arena board: de åbne arenakampe.
  app.get('/api/arena', async (request, reply) => {
    const userId = requireUser(request, reply);
    if (!userId) return reply;
    await syncRunning(pool);
    const { rows } = await pool.query<TitheRow & { opener_name: string }>(
      `select t.*, (select user_name from lobby.members where user_id = t.opener_user_id) as opener_name
       from lobby.tithes t where t.status = 'open' and t.reach = 'arena' order by t.created_at`,
    );
    const matches = [];
    for (const t of rows) {
      const view = arenaView(t, await members(pool, t.id), userId);
      matches.push({ name: t.name, format: view.format, stake: t.stake, opener: t.opener_name, sides: view.sides, full: view.full });
    }
    return reply.send({ formats: Object.keys(B.arena.formats), stakeMax: B.arena.stakeMax, matches });
  });

  // Feature-044 CMD-01 Open an arena match: navn, format, indsats og side.
  app.post<{ Body: { name?: unknown; format?: unknown; stake?: unknown; side?: unknown } }>('/api/arena', async (request, reply) => {
    const userId = requireUser(request, reply);
    if (!userId) return reply;
    const raw = request.body?.name;
    const name = typeof raw === 'string' ? raw.trim() : '';
    const { format, stake, side } = request.body ?? {};
    if ([...name].length < B.lobby.nameMin || [...name].length > B.lobby.nameMax) return refuse(reply, 400, INVALID);
    if (!isArenaFormat(format) || !isSide(side) || !Number.isInteger(stake) || (stake as number) < 0 || (stake as number) > B.arena.stakeMax) {
      return refuse(reply, 400, INVALID);
    }
    await syncRunning(pool);
    const result = await transaction(pool, async (client) => {
      await client.query('select pg_advisory_xact_lock(7272003)');
      const me = await player(client, userId);
      if (!me) return 'no-character' as const;
      if (await membership(client, userId)) return 'busy' as const;
      if ((await client.query('select 1 from lobby.tithes where name_key = $1', [nameKey(name)])).rowCount) return 'taken' as const;
      if ((await gold(client, me.id)) < (stake as number)) return 'gold' as const;
      const id = randomUUID();
      await client.query(
        `insert into lobby.tithes (id, name, name_key, opener_user_id, status, reach, format, stake) values ($1, $2, $3, $4, 'open', 'arena', $5, $6)`,
        [id, name, nameKey(name), userId, format, stake],
      );
      await join(client, id, userId, me, side);
      return 'ok' as const;
    });
    if (result === 'no-character') return refuse(reply, 409, NO_CHARACTER);
    if (result === 'busy') return refuse(reply, 409, { message: MESSAGES.inLobbyOrTithe });
    if (result === 'taken') return refuse(reply, 409, { message: MESSAGES.arenaNameTaken, field: 'name' });
    if (result === 'gold') return refuse(reply, 409, { message: MESSAGES.notEnoughGold });
    return reply.code(201).send(await current(pool, userId));
  });

  // Feature-044 CMD-02 Join a side: en side med en ledig plads, og indsatsen i tegnebogen.
  app.post<{ Params: { name: string }; Body: { side?: unknown } }>('/api/arena/:name/join', async (request, reply) => {
    const userId = requireUser(request, reply);
    if (!userId) return reply;
    const side = request.body?.side;
    if (!isSide(side)) return refuse(reply, 400, INVALID);
    await syncRunning(pool);
    const result = await transaction(pool, async (client) => {
      await client.query('select pg_advisory_xact_lock(7272003)');
      const me = await player(client, userId);
      if (!me) return 'no-character' as const;
      if (await membership(client, userId)) return 'busy' as const;
      const { rows } = await client.query<TitheRow>(`select * from lobby.tithes where name_key = $1 and status = 'open' and reach = 'arena'`, [nameKey(request.params.name)]);
      const match = rows[0];
      if (!match) return 'missing' as const;
      const places = arenaPlaces(formatOf(match), B);
      if ((await members(client, match.id)).filter((m) => m.side === side).length >= places[side]) return 'full' as const;
      if ((await gold(client, me.id)) < match.stake) return 'gold' as const;
      await join(client, match.id, userId, me, side);
      return 'ok' as const;
    });
    if (result === 'no-character') return refuse(reply, 409, NO_CHARACTER);
    if (result === 'busy') return refuse(reply, 409, { message: MESSAGES.inLobbyOrTithe });
    if (result === 'missing') return refuse(reply, 404, { message: 'The match is gone.' });
    if (result === 'full') return refuse(reply, 409, { message: MESSAGES.sideFull });
    if (result === 'gold') return refuse(reply, 409, { message: MESSAGES.notEnoughGold });
    return reply.send(await current(pool, userId));
  });

  // Feature-044 CMD-03 Start the arena match: kun den, der åbnede den, og kun når hver plads er fyldt.
  app.post<{ Params: { name: string } }>('/api/arena/:name/start', async (request, reply) => {
    const userId = requireUser(request, reply);
    if (!userId) return reply;
    const result = await transaction(pool, async (client) => {
      const { rows } = await client.query<TitheRow>(
        `select * from lobby.tithes where name_key = $1 and status = 'open' and reach = 'arena' for update`,
        [nameKey(request.params.name)],
      );
      const match = rows[0];
      if (!match) return 'missing' as const;
      if (match.opener_user_id !== userId) return 'not-opener' as const;
      const format = formatOf(match);
      const places = arenaPlaces(format, B);
      const list = await members(client, match.id);
      if (SIDES.some((s) => list.filter((m) => m.side === s).length < places[s])) return 'not-full' as const;
      const fighters: ArenaMatchStarted['fighters'] = [];
      for (const m of list) {
        const copy = await workingCopy(client, m.character_id);
        if (!copy || !isSide(m.side)) continue;
        const ticket = randomBytes(24).toString('base64url');
        await client.query('update lobby.members set ticket = $2 where user_id = $1', [m.user_id, ticket]);
        fighters.push({ userId: m.user_id, userName: m.user_name, characterId: m.character_id, ticket, side: m.side, ...copy });
      }
      await client.query(`update lobby.tithes set status = 'launched', launched_at = now() where id = $1`, [match.id]);
      // Feature-044 EVT-03 Arena match started → Feature-045 SVC-01 Arena master og Feature-046 SVC-01 Arena bookkeeper
      const data: ArenaMatchStarted = { matchId: match.id, name: match.name, format, stake: match.stake, fighters };
      await enqueue(client, envelope(EVENT.arenaMatchStarted, data));
      return 'ok' as const;
    });
    if (result === 'missing') return refuse(reply, 404, { message: 'The match is gone.' });
    if (result === 'not-opener') return refuse(reply, 403, { message: 'Only the player who opened the match can start it.' });
    if (result === 'not-full') return refuse(reply, 409, { message: MESSAGES.placesNotFilled });
    return reply.send(await current(pool, userId));
  });
}
