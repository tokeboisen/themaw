// Patronage: Feature-024 Accept sponsor gifts.

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { EVENT, MESSAGES, type GoldGiftAccepted, type ItemGiftAccepted } from '@maw/contracts';
import { envelope } from '@maw/platform';
import type { Item } from '@maw/rules';
import { transaction, type Pool } from '../db.ts';
import { roomLeft } from '../gear/store.ts';
import { INVALID, refuse, requireUser } from '../http.ts';
import { enqueue } from '../outbox.ts';

interface GiftRow {
  id: string;
  character_id: string;
  house: string;
  kind: 'item' | 'gold';
  item: Item | null;
  gold: number | null;
}

const view = (g: GiftRow) => ({ id: g.id, house: g.house, kind: g.kind, item: g.item, gold: g.gold });

type Req = FastifyRequest<{ Params: { id: string; giftId?: string } }>;

export function patronageRoutes(app: FastifyInstance, pool: Pool): void {
  // F024 VIEW-01 Patrons' Hall: gaverne, der venter.
  app.get('/api/characters/:id/gifts', async (request: Req, reply) => {
    const userId = requireUser(request, reply);
    if (!userId) return reply;
    if (!/^[0-9a-f-]{36}$/i.test(request.params.id)) return refuse(reply, 400, INVALID);
    const { rows } = await pool.query<GiftRow>(
      'select * from patronage.gifts where character_id = $1 and user_id = $2 and accepted_at is null order by granted_at, id',
      [request.params.id, userId],
    );
    return reply.send({ gifts: rows.map(view) });
  });

  // F024 CMD-01 Accept gift: en ting kræver plads i pakken, ellers venter gaven fortsat.
  app.post('/api/characters/:id/gifts/:giftId/accept', async (request: Req, reply) => {
    const userId = requireUser(request, reply);
    if (!userId) return reply;
    const { id, giftId } = request.params;
    const found = await pool.query<GiftRow>(
      'select * from patronage.gifts where id = $1 and character_id = $2 and user_id = $3 and accepted_at is null',
      [giftId, id, userId],
    );
    const gift = found.rows[0];
    if (!gift) return refuse(reply, 404, { message: 'The gift is gone.' });
    if (gift.kind === 'item' && (await roomLeft(pool, id)) <= 0) return refuse(reply, 409, { message: MESSAGES.inventoryFull });
    const accepted = await transaction(pool, async (client) => {
      const updated = await client.query('update patronage.gifts set accepted_at = now() where id = $1 and accepted_at is null', [gift.id]);
      if (updated.rowCount === 0) return false;
      if (gift.kind === 'item') {
        await enqueue(client, envelope<ItemGiftAccepted>(EVENT.itemGiftAccepted, { characterId: id, giftId: gift.id, item: gift.item! }));
      } else {
        await enqueue(client, envelope<GoldGiftAccepted>(EVENT.goldGiftAccepted, { characterId: id, giftId: gift.id, gold: gift.gold! }));
      }
      return true;
    });
    if (!accepted) return refuse(reply, 404, { message: 'The gift is gone.' });
    return reply.send(view(gift));
  });
}
