// Market: Feature-018 Keep the wallet, -019 Trade at the Forge og -020 Shop at the Apothecary.

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { EVENT, MESSAGES, type ConsumableBought, type IdentificationBought, type ItemBought, type ItemSold } from '@maw/contracts';
import { envelope } from '@maw/platform';
import { BALANCE as B, CONSUMABLE_KEYS, identifyPrice, sellValue, type Item } from '@maw/rules';
import { transaction, type Client, type Pool } from '../db.ts';
import { consumables, loadInventory, packItem, roomLeft } from '../gear/store.ts';
import { INVALID, refuse, requireUser } from '../http.ts';
import { enqueue } from '../outbox.ts';

type Req = FastifyRequest<{ Params: { id: string }; Body: Record<string, unknown> | undefined }>;

export function marketRoutes(app: FastifyInstance, pool: Pool): void {
  /** Karakterens ID, hvis den tilhører brugeren og har en tegnebog. */
  async function owner(request: Req, reply: FastifyReply): Promise<string | null> {
    const userId = requireUser(request, reply);
    if (!userId) return null;
    const id = request.params.id;
    const ok = /^[0-9a-f-]{36}$/i.test(id) &&
      (await pool.query('select 1 from market.wallets where character_id = $1 and user_id = $2', [id, userId])).rowCount === 1;
    if (!ok) {
      void refuse(reply, 404, { message: 'Character not found.' });
      return null;
    }
    return id;
  }

  async function wallet(db: Pool | Client, characterId: string, lock = false): Promise<number> {
    const { rows } = await db.query<{ gold: number }>(`select gold from market.wallets where character_id = $1${lock ? ' for update' : ''}`, [characterId]);
    return rows[0]!.gold;
  }

  async function stock(db: Pool | Client, characterId: string, lock = false): Promise<Item[]> {
    const { rows } = await db.query<{ stock: Item[] }>(`select stock from market.forges where character_id = $1${lock ? ' for update' : ''}`, [characterId]);
    return rows[0]?.stock ?? [];
  }

  // F018 AGG-01: "The Rim shows the gold at the top of every tab."
  app.get('/api/characters/:id/wallet', async (request: Req, reply) => {
    const id = await owner(request, reply);
    if (!id) return reply;
    return reply.send({ gold: await wallet(pool, id) });
  });

  // F019 VIEW-01 Forge: lageret med priser.
  app.get('/api/characters/:id/forge', async (request: Req, reply) => {
    const id = await owner(request, reply);
    if (!id) return reply;
    return reply.send({ gold: await wallet(pool, id), stock: await stock(pool, id) });
  });

  // F019 CMD-01 Buy item: kræver guldet og plads i pakken; tingen forlader lageret.
  app.post('/api/characters/:id/forge/buy', async (request: Req, reply) => {
    const id = await owner(request, reply);
    if (!id) return reply;
    const itemId = request.body?.itemId;
    if (typeof itemId !== 'string') return refuse(reply, 400, INVALID);
    const room = await roomLeft(pool, id);
    const result = await transaction(pool, async (client) => {
      const gold = await wallet(client, id, true);
      const items = await stock(client, id, true);
      const item = items.find((i) => i.id === itemId);
      if (!item) return 'missing' as const;
      if (gold < item.value) return 'gold' as const;
      if (room <= 0) return 'full' as const;
      await client.query('update market.forges set stock = $2 where character_id = $1', [id, JSON.stringify(items.filter((i) => i.id !== itemId))]);
      await client.query('update market.wallets set gold = gold - $2 where character_id = $1', [id, item.value]);
      await enqueue(client, envelope<ItemBought>(EVENT.itemBought, { characterId: id, item }));
      return { gold: gold - item.value, stock: items.filter((i) => i.id !== itemId) };
    });
    if (result === 'missing') return refuse(reply, 404, { message: 'Item not found.' });
    if (result === 'gold') return refuse(reply, 409, { message: MESSAGES.notEnoughGold });
    if (result === 'full') return refuse(reply, 409, { message: MESSAGES.inventoryFull });
    return reply.send(result);
  });

  // F019 CMD-02 Sell item: kun ting i pakken; man får 30 % af prisen.
  app.post('/api/characters/:id/forge/sell', async (request: Req, reply) => {
    const id = await owner(request, reply);
    if (!id) return reply;
    const itemId = request.body?.itemId;
    if (typeof itemId !== 'string') return refuse(reply, 400, INVALID);
    const item = await packItem(pool, id, itemId);
    if (!item) return refuse(reply, 400, INVALID);
    const price = sellValue(item, B);
    const result = await transaction(pool, async (client) => {
      const sold = await client.query('insert into market.sold_items (item_id, character_id) values ($1, $2) on conflict do nothing', [itemId, id]);
      if (sold.rowCount === 0) return null;
      await client.query('update market.wallets set gold = gold + $2 where character_id = $1', [id, price]);
      await enqueue(client, envelope<ItemSold>(EVENT.itemSold, { characterId: id, itemId, gold: price }));
      return { gold: await wallet(client, id), sold: price };
    });
    if (!result) return refuse(reply, 400, INVALID);
    return reply.send(result);
  });

  // F019 CMD-03 Pay for identification: 10 + 3 × item level for hver uidentificeret ting, båret, i pakken og i kisten.
  app.post('/api/characters/:id/forge/identify', async (request: Req, reply) => {
    const id = await owner(request, reply);
    if (!id) return reply;
    const inv = await loadInventory(pool, id);
    if (!inv) return refuse(reply, 404, { message: 'Inventory not found.' });
    const { count, price } = identifyPrice([...Object.values(inv.equipment).filter((i): i is Item => !!i), ...inv.pack, ...inv.chest], B);
    if (!count) return refuse(reply, 400, INVALID);
    const result = await transaction(pool, async (client) => {
      const gold = await wallet(client, id, true);
      if (gold < price) return null;
      await client.query('update market.wallets set gold = gold - $2 where character_id = $1', [id, price]);
      await enqueue(client, envelope<IdentificationBought>(EVENT.identificationBought, { characterId: id }));
      return { gold: gold - price };
    });
    if (!result) return refuse(reply, 409, { message: MESSAGES.notEnoughGold });
    return reply.send(result);
  });

  // F020 CMD-01 Buy potion, CMD-02 Buy ration og CMD-03 Buy focus potion: højst 9 af hver, og guldet skal række.
  app.post('/api/characters/:id/apothecary/buy', async (request: Req, reply) => {
    const id = await owner(request, reply);
    if (!id) return reply;
    const kind = request.body?.kind;
    if (kind !== 'potion' && kind !== 'ration' && kind !== 'focusPotion') return refuse(reply, 400, INVALID);
    const carried = await consumables(pool, id);
    if (!carried) return refuse(reply, 404, { message: 'Inventory not found.' });
    if (carried[CONSUMABLE_KEYS[kind]] >= B.character.maxConsumables) {
      return refuse(reply, 409, { message: MESSAGES.cannotCarryMore });
    }
    const price = kind === 'potion' ? B.rim.potionPrice : kind === 'focusPotion' ? B.rim.focusPotionPrice : B.rim.rationPrice;
    const event = kind === 'potion' ? EVENT.potionBought : kind === 'focusPotion' ? EVENT.focusPotionBought : EVENT.rationBought;
    const result = await transaction(pool, async (client) => {
      const gold = await wallet(client, id, true);
      if (gold < price) return null;
      await client.query('update market.wallets set gold = gold - $2 where character_id = $1', [id, price]);
      await enqueue(client, envelope<ConsumableBought>(event, { characterId: id }));
      return { gold: gold - price };
    });
    if (!result) return refuse(reply, 409, { message: MESSAGES.notEnoughGold });
    return reply.send(result);
  });
}
