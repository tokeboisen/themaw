// api'et som Fastify-app med alle moduler. main.ts starter den; testene kalder den med app.inject.

import Fastify, { type FastifyInstance } from 'fastify';
import type { Bus } from '@maw/platform';
import { accountsRoutes } from './accounts/routes.ts';
import { charactersRoutes } from './characters/routes.ts';
import type { Pool } from './db.ts';
import { gearRoutes } from './gear/routes.ts';
import { useRegistry, type TitheRegistry } from './lobby/registry.ts';
import { lobbyRoutes, refuseBusy } from './lobby/routes.ts';
import { busy } from './lobby/store.ts';
import { marketRoutes } from './market/routes.ts';
import { partiesRoutes } from './parties/routes.ts';
import { patronageRoutes } from './patronage/routes.ts';

const LOCKED = [
  /^\/api\/characters\/[^/]+\/(choose|equip|unequip|attribute-points|skill-points)$/,
  /^\/api\/characters\/[^/]+\/(hotbar|forge|apothecary|gifts)\//,
];

export function buildApp(pool: Pool, bus?: Bus, logger = false, options: { tithes?: TitheRegistry } = {}): FastifyInstance {
  if (options.tithes) useRegistry(options.tithes);
  const app = Fastify({ logger, bodyLimit: 64 * 1024 });

  app.get('/api/health', async (_request, reply) => {
    let database = false;
    try {
      await pool.query('select 1');
      database = true;
    } catch {
      database = false;
    }
    const busOpen = bus?.isOpen() ?? false;
    const ok = database && busOpen;
    return reply.code(ok ? 200 : 503).send({ status: ok ? 'ok' : 'degraded', service: 'api', database, bus: busOpen });
  });

  accountsRoutes(app, pool);

  // Planen, afsnit 5, Feature-026 og -038: mens karakteren er i en lobby eller en Tithe, er arbejdskopien i tithe-server
  // den gældende, så Rim, Characters og Gear afviser ændringer: Forge, Apothecary, gaver, udstyr, hotbar, point, valg
  // og sletning af karakterer.
  app.addHook('preHandler', async (request, reply) => {
    if (request.method === 'GET' || !request.userId) return;
    const path = request.url.split('?')[0] ?? '';
    const locked = LOCKED.some((pattern) => pattern.test(path)) || (request.method === 'DELETE' && /^\/api\/characters\/[^/]+$/.test(path));
    if (locked && (await busy(pool, request.userId))) return refuseBusy(reply);
  });
  charactersRoutes(app, pool);
  gearRoutes(app, pool);
  marketRoutes(app, pool);
  patronageRoutes(app, pool);
  lobbyRoutes(app, pool);
  partiesRoutes(app, pool);
  return app;
}
