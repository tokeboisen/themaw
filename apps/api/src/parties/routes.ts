// Feature-034 VIEW-01 Other players: spillerne, der er logget ind på serveren, med den karakter, de spiller, og den
// Tithe, de er i. Partierne selv lever i tithe-server, så længe en Tithe kører (planen, afsnit 2).

import type { FastifyInstance } from 'fastify';
import type { Pool } from '../db.ts';
import { requireUser } from '../http.ts';
import { syncRunning } from '../lobby/store.ts';

/** En session, der er brugt inden for to minutter, er logget ind. */
const ACTIVE = "interval '2 minutes'";

export function partiesRoutes(app: FastifyInstance, pool: Pool): void {
  app.get('/api/players', async (request, reply) => {
    const userId = requireUser(request, reply);
    if (!userId) return reply;
    await syncRunning(pool);
    const { rows } = await pool.query<{ id: string; user_name: string; character_name: string | null; mark: number | null; tithe: string | null }>(
      `select u.id, u.user_name, c.name as character_name, c.mark, t.name as tithe
       from accounts.users u
       left join characters.rosters r on r.user_id = u.id
       left join characters.characters c on c.id = r.active_character_id
       left join lobby.members m on m.user_id = u.id
       left join lobby.tithes t on t.id = m.tithe_id
       where u.id = $1
          or m.user_id is not null
          or exists (select 1 from accounts.sessions s where s.user_id = u.id and s.last_seen_at > now() - ${ACTIVE})
       order by lower(u.user_name)`,
      [userId],
    );
    return reply.send({
      players: rows.map((r) => ({
        userName: r.user_name,
        character: r.character_name ? { name: r.character_name, mark: r.mark } : null,
        tithe: r.tithe,
        you: r.id === userId,
      })),
    });
  });
}
