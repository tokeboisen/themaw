// Udstyr som HTML: navn i sjældenhedens farve, plads, sjældenhed, skade eller rustning og egenskaber (Feature-007 VIEW-01).

import { BALANCE as B, RARITY_NAMES, SLOT_NAMES, describeItem, type Item } from '@maw/rules';
import { esc } from './dom.ts';

export function itemRow(item: Item, actions: string): string {
  const lines = describeItem(item, B).join(' · ');
  return `<li class="item"><div>
      <div class="item-name r-${item.rarity}">${esc(item.name)}</div>
      <div class="hint">${SLOT_NAMES[item.slot]} · ${RARITY_NAMES[item.rarity]} · ${esc(lines)}</div>
    </div><div class="actions">${actions}</div></li>`;
}
