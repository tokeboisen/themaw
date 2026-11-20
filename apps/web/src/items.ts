// Udstyr som HTML: navn i sjældenhedens farve, plads, sjældenhed, skade eller rustning og egenskaber (Feature-007 VIEW-01).

import { BALANCE as B, RARITY_NAMES, SLOT_NAMES, describeItem, type Item } from '@maw/rules';
import { esc } from './dom.ts';

export function itemRow(item: Item, actions: string, note = '', slotLabel = ''): string {
  const lines = describeItem(item, B).join(' · ');
  return `<li class="item"><div>
      ${slotLabel ? `<div class="slot-label">${esc(slotLabel)}</div>` : ''}
      <div class="item-name r-${item.rarity}">${esc(item.name)}</div>
      <div class="hint">${SLOT_NAMES[item.slot]} · ${RARITY_NAMES[item.rarity]} · ${esc(lines)}</div>
      ${note ? `<div class="hint warn">${esc(note)}</div>` : ''}
    </div><div class="actions">${actions}</div></li>`;
}
