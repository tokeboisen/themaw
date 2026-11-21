// Characters: Feature-001 Create character, -026 Choose character, -038 Delete character, -004 Spend points.

import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { MESSAGES, routingKey } from '@maw/contracts';
import { envelope } from '@maw/platform';
import {
  ATTRIBUTES, BALANCE as B, SKILLS, backgroundById, emptyEquipment, creationProblems, itemBase, newCharacter, spendAttributePoint,
  normalizeSkills, spendSkillPoint, type Attribute, type Character, type SkillId,
} from '@maw/rules';
import { transaction, type Client, type Pool } from '../db.ts';
import { enqueue } from '../outbox.ts';
import { INVALID, refuse, requireUser } from '../http.ts';

interface CharacterRow {
  id: string;
  user_id: string;
  name: string;
  background: string;
  mark: number;
  echo: number;
  attributes: Character['attributes'];
  skills: Character['skills'];
  attribute_points: number;
  skill_points: number;
}

/** Karakteren, som webappen ser den. Udstyr, guld og forsyninger hører til Gear og Market (fase 2). */
function view(row: CharacterRow) {
  normalizeSkills(row); // Feature-049: karakterer fra før talentet har det på niveau 0
  return {
    id: row.id,
    name: row.name,
    background: row.background,
    mark: row.mark,
    echo: row.echo,
    attributes: row.attributes,
    skills: row.skills,
    attributePoints: row.attribute_points,
    skillPoints: row.skill_points,
  };
}

/** Reglerne i @maw/rules regner på en hel karakter; her uden udstyr, indtil Gear findes. */
function asCharacter(row: CharacterRow): Character {
  normalizeSkills(row);
  return {
    name: row.name, background: row.background, level: row.mark, echo: row.echo, attributes: row.attributes, skills: row.skills,
    attributePoints: row.attribute_points, skillPoints: row.skill_points, gold: 0, potions: 0, focusPotions: 0, rations: 0,
    equipment: emptyEquipment(), inventory: [], tithes: 0, championships: 0,
  };
}

async function owned(db: Pool | Client, userId: string, id: string, lock = false): Promise<CharacterRow | undefined> {
  const { rows } = await db.query<CharacterRow>(
    `select * from characters.characters where id = $1 and user_id = $2${lock ? ' for update' : ''}`,
    [id, userId],
  );
  return rows[0];
}

const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

export function charactersRoutes(app: FastifyInstance, pool: Pool): void {
  // Baggrundene med forslag, grænser, styrker og svagheder (Feature-001 VIEW-01).
  app.get('/api/backgrounds', async (request, reply) => {
    if (!requireUser(request, reply)) return reply;
    return reply.send({
      creation: B.creation,
      backgrounds: B.backgrounds.map((bg) => ({ ...bg, weaponName: itemBase(B, bg.weapon).name })),
    });
  });

  // Feature-026 VIEW-01 Characters
  app.get('/api/characters', async (request, reply) => {
    const userId = requireUser(request, reply);
    if (!userId) return reply;
    const { rows } = await pool.query<CharacterRow & { tithes: number | null; champions: number | null }>(
      `select c.*, s.tithes, s.champions from characters.characters c
       left join characters.statistics s on s.character_id = c.id
       where c.user_id = $1 order by c.created_at`,
      [userId],
    );
    const roster = await pool.query<{ active_character_id: string | null }>('select active_character_id from characters.rosters where user_id = $1', [userId]);
    // Feature-026 VIEW-01: navn, baggrund, Mark, antal Tithes og gange som Champion (Feature-039).
    return reply.send({
      characters: rows.map((r) => ({ ...view(r), tithes: r.tithes ?? 0, champions: r.champions ?? 0 })),
      activeCharacterId: roster.rows[0]?.active_character_id ?? null,
    });
  });

  // Feature-040 VIEW-01 Player statistics: kun brugerens egne karakterer.
  app.get('/api/statistics', async (request, reply) => {
    const userId = requireUser(request, reply);
    if (!userId) return reply;
    const { rows } = await pool.query<{
      id: string; name: string; mark: number; tithes: number | null; champions: number | null; falls: number | null; left_tithes: number | null;
      deepest: number | null; monsters: number | null; rivals: number | null; player_kills: number | null; killed_by_players: number | null;
    }>(
      `select c.id, c.name, c.mark, s.tithes, s.champions, s.falls, s.left_tithes, s.deepest, s.monsters, s.rivals, s.player_kills, s.killed_by_players
       from characters.characters c left join characters.statistics s on s.character_id = c.id
       where c.user_id = $1 order by c.created_at`,
      [userId],
    );
    return reply.send({
      characters: rows.map((r) => ({
        id: r.id, name: r.name, mark: r.mark, tithes: r.tithes ?? 0, champions: r.champions ?? 0, falls: r.falls ?? 0, left: r.left_tithes ?? 0,
        deepest: r.deepest ?? 0, monsters: r.monsters ?? 0, rivals: r.rivals ?? 0, playerKills: r.player_kills ?? 0, killedByPlayers: r.killed_by_players ?? 0,
      })),
    });
  });

  app.get<{ Params: { id: string } }>('/api/characters/:id', async (request, reply) => {
    const userId = requireUser(request, reply);
    if (!userId) return reply;
    const row = isUuid(request.params.id) ? await owned(pool, userId, request.params.id) : undefined;
    if (!row) return refuse(reply, 404, { message: 'Character not found.' });
    return reply.send(view(row));
  });

  // Feature-001 CMD-01 Create character
  app.post<{ Body: { name?: unknown; background?: unknown; attributes?: unknown; skills?: unknown } }>('/api/characters', async (request, reply) => {
    const userId = requireUser(request, reply);
    if (!userId) return reply;
    const body = request.body ?? {};
    const input = {
      name: typeof body.name === 'string' ? body.name : '',
      background: typeof body.background === 'string' ? body.background : '',
      attributes: (body.attributes ?? {}) as Record<string, unknown>,
      skills: (body.skills ?? {}) as Record<string, unknown>,
    };
    const problems = creationProblems(input, B);
    if (problems.length === 1 && problems[0] === 'points') return refuse(reply, 400, { message: MESSAGES.placeAllPoints });
    if (problems.length) return refuse(reply, 400, INVALID);
    const bg = backgroundById(B, input.background)!;
    const character = newCharacter(input.name, bg, {
      attributes: input.attributes as Character['attributes'],
      skills: input.skills as Record<SkillId, number>,
    });
    const id = randomUUID();
    const row = await transaction(pool, async (client) => {
      const { rows } = await client.query<CharacterRow>(
        `insert into characters.characters (id, user_id, name, background, mark, echo, attributes, skills, attribute_points, skill_points)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning *`,
        [id, userId, character.name, bg.id, character.level, character.echo, JSON.stringify(character.attributes),
          JSON.stringify(character.skills), character.attributePoints, character.skillPoints],
      );
      // Feature-001 EVT-01: den nye karakter er den, der spilles (Choose character) ...
      await client.query(
        `insert into characters.rosters (user_id, active_character_id) values ($1, $2)
         on conflict (user_id) do update set active_character_id = excluded.active_character_id`,
        [userId, id],
      );
      // ... og Gear, Market og Restock the Forge får "Character created" over bussen.
      await enqueue(client, envelope(routingKey('Characters', 'Character created'), {
        characterId: id, userId, name: character.name, background: bg.id, mark: character.level,
      }));
      return rows[0]!;
    });
    return reply.code(201).send(view(row));
  });

  // Feature-026 CMD-01 Choose character. Afvises under en Tithe og i en lobby (låsen i app.ts).
  app.post<{ Params: { id: string } }>('/api/characters/:id/choose', async (request, reply) => {
    const userId = requireUser(request, reply);
    if (!userId) return reply;
    const row = isUuid(request.params.id) ? await owned(pool, userId, request.params.id) : undefined;
    if (!row) return refuse(reply, 404, { message: 'Character not found.' });
    await pool.query(
      `insert into characters.rosters (user_id, active_character_id) values ($1, $2)
       on conflict (user_id) do update set active_character_id = excluded.active_character_id`,
      [userId, row.id],
    );
    return reply.send({ activeCharacterId: row.id });
  });

  // Feature-038 CMD-01 Delete character. Afvises, mens karakteren er i en lobby eller en Tithe (låsen i app.ts).
  app.delete<{ Params: { id: string } }>('/api/characters/:id', async (request, reply) => {
    const userId = requireUser(request, reply);
    if (!userId) return reply;
    const id = request.params.id;
    const deleted = isUuid(id) && await transaction(pool, async (client) => {
      const result = await client.query('delete from characters.characters where id = $1 and user_id = $2', [id, userId]);
      if (result.rowCount === 0) return false;
      // Feature-039 CMD-02 Remove statistics: statistikken hører til karakteren og forsvinder med den.
      await client.query('delete from characters.statistics where character_id = $1', [id]);
      // Feature-038 EVT-01: blev den spillede karakter slettet, vælger spilleren en anden eller opretter en ny.
      await client.query('update characters.rosters set active_character_id = null where user_id = $1 and active_character_id = $2', [userId, id]);
      await enqueue(client, envelope(routingKey('Characters', 'Character deleted'), { characterId: id, userId }));
      return true;
    });
    if (!deleted) return refuse(reply, 404, { message: 'Character not found.' });
    return reply.code(204).send();
  });

  // Feature-004 CMD-01 Spend attribute point og CMD-02 Spend skill point
  const spend = (kind: 'attribute' | 'skill') =>
    async (request: SpendRequest, reply: FastifyReply) => {
      const userId = requireUser(request, reply);
      if (!userId) return reply;
      const key = kind === 'attribute' ? request.body?.attribute : request.body?.skill;
      const valid = kind === 'attribute' ? (ATTRIBUTES as unknown[]).includes(key) : (SKILLS as unknown[]).includes(key);
      if (!valid || !isUuid(request.params.id)) return refuse(reply, 400, INVALID);
      const result = await transaction(pool, async (client) => {
        const row = await owned(client, userId, request.params.id, true);
        if (!row) return 'missing' as const;
        const character = asCharacter(row);
        const ok = kind === 'attribute' ? spendAttributePoint(character, key as Attribute) : spendSkillPoint(character, key as SkillId, B);
        if (!ok) return 'none' as const;
        const { rows } = await client.query<CharacterRow>(
          `update characters.characters set attributes = $2, skills = $3, attribute_points = $4, skill_points = $5
           where id = $1 returning *`,
          [row.id, JSON.stringify(character.attributes), JSON.stringify(character.skills), character.attributePoints, character.skillPoints],
        );
        return rows[0]!;
      });
      if (result === 'missing') return refuse(reply, 404, { message: 'Character not found.' });
      // Feature-004: "Points can only be spent while there are some left"; webappen viser da ingen +.
      if (result === 'none') return refuse(reply, 409, { message: 'No points to spend.' });
      return reply.send(view(result));
    };
  app.post('/api/characters/:id/attribute-points', spend('attribute'));
  app.post('/api/characters/:id/skill-points', spend('skill'));
}

type SpendRequest = FastifyRequest<{ Params: { id: string }; Body: { attribute?: unknown; skill?: unknown } | undefined }>;
