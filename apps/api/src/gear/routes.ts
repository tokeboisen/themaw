// Gear: Feature-007 Manage equipment og Feature-027 Assign hotbar keys (i the Rim; under en Tithe fra fase 3).

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { MESSAGES } from '@maw/contracts';
import { assignHotbarKey, clearHotbarKey, isEchoArt, isHotbarKey, type HotbarSlot, type Slot } from '@maw/rules';
import { transaction, type Pool } from '../db.ts';
import { INVALID, refuse, requireUser } from '../http.ts';
import { capacity, loadInventory, type Inventory } from './store.ts';

const SLOTS: Slot[] = ['weapon', 'armour', 'ring'];

async function view(pool: Pool, inv: Inventory) {
  return { equipment: inv.equipment, pack: inv.pack, potions: inv.potions, rations: inv.rations, hotbar: inv.hotbar, capacity: await capacity(pool, inv) };
}

type Req = FastifyRequest<{ Params: { id: string; key?: string }; Body: Record<string, unknown> | undefined }>;

export function gearRoutes(app: FastifyInstance, pool: Pool): void {
  /** Inventaret for brugerens egen karakter, eller et svar, der afviser. */
  async function owned(request: Req, reply: FastifyReply, lock = false, db = pool as Parameters<typeof loadInventory>[0]) {
    const userId = requireUser(request, reply);
    if (!userId) return null;
    const inv = /^[0-9a-f-]{36}$/i.test(request.params.id) ? await loadInventory(db, request.params.id, lock) : undefined;
    if (!inv || inv.userId !== userId) {
      void refuse(reply, 404, { message: 'Inventory not found.' });
      return null;
    }
    return inv;
  }

  // Feature-007 VIEW-01 Inventory
  app.get('/api/characters/:id/inventory', async (request: Req, reply) => {
    const inv = await owned(request, reply);
    if (!inv) return reply;
    return reply.send(await view(pool, inv));
  });

  // Feature-007 CMD-01 Equip item: tingen kommer på sin plads, og det, der sad der, kommer i pakken.
  app.post('/api/characters/:id/equip', async (request: Req, reply) => {
    const itemId = request.body?.itemId;
    if (typeof itemId !== 'string') return refuse(reply, 400, INVALID);
    const result = await transaction(pool, async (client) => {
      const inv = await owned(request, reply, true, client);
      if (!inv) return null;
      const item = inv.pack.find((i) => i.id === itemId);
      if (!item) return 'invalid' as const;
      await client.query(`update gear.items set location = 'pack', added_at = now() where character_id = $1 and location = $2`, [inv.characterId, item.slot]);
      await client.query(`update gear.items set location = $3 where character_id = $1 and id = $2`, [inv.characterId, item.id, item.slot]);
      return loadInventory(client, inv.characterId);
    });
    if (result === null) return reply;
    if (result === 'invalid' || !result) return refuse(reply, 400, INVALID);
    return reply.send(await view(pool, result));
  });

  // Feature-007 CMD-02 Unequip item: kræver plads i pakken.
  app.post('/api/characters/:id/unequip', async (request: Req, reply) => {
    const slot = request.body?.slot;
    if (!SLOTS.includes(slot as Slot)) return refuse(reply, 400, INVALID);
    const result = await transaction(pool, async (client) => {
      const inv = await owned(request, reply, true, client);
      if (!inv) return null;
      if (!inv.equipment[slot as Slot]) return 'invalid' as const;
      if (inv.pack.length >= (await capacity(client, inv))) return 'full' as const;
      await client.query(`update gear.items set location = 'pack', added_at = now() where character_id = $1 and location = $2`, [inv.characterId, slot]);
      return loadInventory(client, inv.characterId);
    });
    if (result === null) return reply;
    if (result === 'full') return refuse(reply, 409, { message: MESSAGES.inventoryFull });
    if (result === 'invalid' || !result) return refuse(reply, 400, INVALID);
    return reply.send(await view(pool, result));
  });

  // Feature-027 CMD-01 Assign hotbar key: et våben, karakteren ejer, eller en Echo Art.
  app.put('/api/characters/:id/hotbar/:key', async (request: Req, reply) => {
    const key = request.params.key;
    const { itemId, echoArt } = request.body ?? {};
    if (!isHotbarKey(key)) return refuse(reply, 400, INVALID);
    const result = await transaction(pool, async (client) => {
      const inv = await owned(request, reply, true, client);
      if (!inv) return null;
      let slot: HotbarSlot;
      if (typeof itemId === 'string') {
        const weapon = [inv.equipment.weapon, ...inv.pack].find((i) => i?.id === itemId && i.slot === 'weapon');
        if (!weapon) return 'invalid' as const;
        slot = { weapon: weapon.id };
      } else if (isEchoArt(echoArt)) {
        slot = { echoArt };
      } else {
        return 'invalid' as const;
      }
      const hotbar = assignHotbarKey(inv.hotbar, key, slot);
      await client.query('update gear.inventories set hotbar = $2 where character_id = $1', [inv.characterId, JSON.stringify(hotbar)]);
      return { ...inv, hotbar };
    });
    if (result === null) return reply;
    if (result === 'invalid') return refuse(reply, 400, INVALID);
    return reply.send(await view(pool, result));
  });

  // Feature-027 CMD-02 Clear hotbar key
  app.delete('/api/characters/:id/hotbar/:key', async (request: Req, reply) => {
    const key = request.params.key;
    if (!isHotbarKey(key)) return refuse(reply, 400, INVALID);
    const result = await transaction(pool, async (client) => {
      const inv = await owned(request, reply, true, client);
      if (!inv) return null;
      const hotbar = clearHotbarKey(inv.hotbar, key);
      await client.query('update gear.inventories set hotbar = $2 where character_id = $1', [inv.characterId, JSON.stringify(hotbar)]);
      return { ...inv, hotbar };
    });
    if (result === null) return reply;
    return reply.send(await view(pool, result));
  });
}
