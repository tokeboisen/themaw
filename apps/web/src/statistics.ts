// Feature-040 VIEW-01 Player statistics: kun brugerens egne karakterer.

import type { StatisticsRow } from './api.ts';
import { esc } from './dom.ts';

export function statisticsHtml(rows: StatisticsRow[], back: 'rim' | 'characters'): string {
  const body = rows.length
    ? rows.map((c) => `<tr><td>${esc(c.name)} <span class="muted">Mark ${c.mark}</span></td><td class="num">${c.tithes}</td><td class="num">${c.champions}</td>
        <td class="num">${c.falls}</td><td class="num">${c.left}</td><td class="num">${c.deepest}</td><td class="num">${c.monsters}</td>
        <td class="num">${c.rivals}</td><td class="num">${c.playerKills}</td><td class="num">${c.killedByPlayers}</td></tr>`).join('')
    : '<tr><td colspan="10" class="muted">No characters yet.</td></tr>';
  return `<div class="panel wide">
    <header class="top"><h1>Player statistics</h1><button class="ghost" data-act="${back}">Back</button></header>
    <div class="box scroll-x"><table class="stats wide-table">
      <thead><tr><th>Character</th><th>Tithes played</th><th>Champion</th><th>Falls</th><th>Left</th><th>Deepest depth</th>
        <th>Monsters slain</th><th>Rivals defeated</th><th>Player kills</th><th>Killed by players</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>
  </div>`;
}
