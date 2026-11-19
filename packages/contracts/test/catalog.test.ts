// Event-kataloget mod Event Modellen: hver stimulus, der krydser bounded contexts i ProductOwner/, har en rute i
// ROUTES, og hver rute svarer til en stimulus. Så kan koden og modellen ikke glide fra hinanden.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { parse } from 'yaml';
import { ROUTES, bindingsFor, queueFor, routingKey } from '../src/index.ts';

const MODEL = join(import.meta.dirname, '..', '..', '..', 'ProductOwner', 'contexts');

interface Element {
  id: string;
  type: string;
  name: string;
  stimulus?: { bounded_context: string; use_case: string; event: string };
}
interface Model {
  use_case: { name: string; bounded_context: string };
  elements: Element[];
}

function stimuli(): Set<string> {
  const found = new Set<string>();
  for (const context of readdirSync(MODEL)) {
    const folder = join(MODEL, context, 'models');
    for (const file of readdirSync(folder).filter((f) => f.endsWith('.yaml'))) {
      const model = parse(readFileSync(join(folder, file), 'utf8')) as Model;
      const feature = `F${file.slice('Feature-'.length, 'Feature-'.length + 3)}`;
      for (const e of model.elements) {
        if (e.stimulus && e.stimulus.bounded_context !== model.use_case.bounded_context) {
          found.add(`${e.stimulus.bounded_context} / ${e.name} → ${model.use_case.bounded_context} ${feature}`);
        }
      }
    }
  }
  return found;
}

const key = (x: { from: string; event: string; to: string; feature: string }) => `${x.from} / ${x.event} → ${x.to} ${x.feature}`;

test('every cross-context stimulus in the model has a route, and every route is a stimulus', () => {
  const model = stimuli();
  const routes = new Set(ROUTES.map(key));
  assert.ok(model.size > 20, 'the model was read');
  assert.deepEqual([...model].filter((s) => !routes.has(s)).sort(), [], 'stimuli without a route');
  assert.deepEqual([...routes].filter((s) => !model.has(s)).sort(), [], 'routes without a stimulus');
});

test('carried events name an event that goes over the bus to the same feature', () => {
  for (const route of ROUTES.filter((x) => x.transport === 'carried')) {
    assert.ok(
      ROUTES.some((x) => x.transport === 'bus' && x.event === route.carriedBy && x.feature === route.feature),
      `${key(route)} is carried by "${route.carriedBy}"`,
    );
  }
});

test('routing keys and queues follow the naming', () => {
  assert.equal(routingKey('Tithe', 'Tithe ended'), 'tithe.tithe-ended');
  assert.equal(queueFor('Market'), 'maw.market');
  assert.ok(bindingsFor('Market').includes('patronage.purse-paid'));
  assert.ok(bindingsFor('Tithe').includes('lobby.tithe-launched'));
});
