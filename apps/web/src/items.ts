// Udstyr som HTML: navn i sjældenhedens farve, plads, sjældenhed, skade eller rustning, krav og egenskaber
// (Feature-007 VIEW-01).

import { displayName, BALANCE as B, RARITY_NAMES, SLOT_NAMES, describeItem, meetsRequirements, type Character, type Item } from '@maw/rules';
import { esc } from './dom.ts';

/** Feature-007: med en karakter står kravene med rødt, når karakteren ikke opfylder dem. */
export function itemRow(item: Item, actions: string, note = '', slotLabel = '', ch: Character | null = null): string {
  const unmet = ch !== null && !meetsRequirements(ch, item, B);
  const lines = describeItem(item, B)
    .map((line) => (unmet && line.startsWith('Requires') ? `<span class="unmet">${esc(line)}</span>` : esc(line)))
    .join(' · ');
  return `<li class="item"><div>
      ${slotLabel ? `<div class="slot-label">${esc(slotLabel)}</div>` : ''}
      <div class="item-name r-${item.rarity}">${esc(displayName(item, B))}</div>
      <div class="hint">${SLOT_NAMES[item.slot]} · ${RARITY_NAMES[item.rarity]} · ${lines}</div>
      ${note ? `<div class="hint warn">${esc(note)}</div>` : ''}
    </div><div class="actions">${actions}</div></li>`;
}
