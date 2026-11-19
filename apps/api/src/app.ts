// api'et som Fastify-app med alle moduler. main.ts starter den; testene kalder den med app.inject.

import Fastify, { type FastifyInstance } from 'fastify';
import type { Bus } from '@maw/platform';
import { accountsRoutes } from './accounts/routes.ts';
import { charactersRoutes } from './characters/routes.ts';
import type { Pool } from './db.ts';

export function buildApp(pool: Pool, bus?: Bus, logger = false): FastifyInstance {
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
  charactersRoutes(app, pool);
  return app;
}
