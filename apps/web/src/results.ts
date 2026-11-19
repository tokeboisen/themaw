// Feature-016 VIEW-01 Tithe results.

import type { EndedMessage } from '@maw/contracts';
import { SKILL_NAMES, type SkillId } from '@maw/rules';
import { esc } from './dom.ts';

/** Overskriften: "You are the Champion!", "<name> is the Champion", "You fell" eller "You left the Tithe". */
export function resultsHeading(m: EndedMessage): string {
  switch (m.kind) {
    case 'champion':
      return 'You are the Champion!';
    case 'rival-champion':
      return `${m.summary.outcome.name} is the Champion`;
    case 'fell':
      return 'You fell';
    case 'left':
      return 'You left the Tithe';
  }
}

export function resultsHtml(m: EndedMessage): string {
  const s = m.summary;
  const r = s.record;
  const time = `${Math.floor(s.seconds / 60)}:${String(s.seconds % 60).padStart(2, '0')}`;
  const skills = (Object.entries(s.skills) as [SkillId, { from: number; to: number }][])
    .map(([k, v]) => `<tr><td>${SKILL_NAMES[k]}</td><td class="num">${v.from} → ${v.to}${v.to > v.from ? ' <span class="up">▲</span>' : ''}</td></tr>`)
    .join('');
  const gold = s.goldLost ? `<tr><td>Gold lost</td><td class="num">${s.goldLost}</td></tr>` : `<tr><td>Gold found</td><td class="num">${s.goldFound}</td></tr>`;
  return `<div class="panel narrow results">
    <h1>${esc(resultsHeading(m))}</h1>
    ${m.kind === 'fell' && s.outcome.name ? `<p class="muted">Struck down by ${esc(s.outcome.name)}.</p>` : ''}
    <div class="box"><table class="stats">
      <tr><td>Tithe</td><td class="num">#${s.tithe}</td></tr>
      <tr><td>Time</td><td class="num">${time}</td></tr>
      <tr><td>Deepest depth</td><td class="num">${r.maxDepth}</td></tr>
      <tr><td>Monsters slain</td><td class="num">${r.kills}</td></tr>
      <tr><td>Rivals defeated</td><td class="num">${r.rivalsDefeated}</td></tr>
      <tr><td>Players defeated</td><td class="num">${r.playersDefeated}</td></tr>
      <tr><td>Renown</td><td class="num">${r.renown}</td></tr>
      ${gold}
      <tr><td>The Crown's Purse</td><td class="num gold-text">${s.purse} gold</td></tr>
      <tr><td>Sponsor gifts waiting</td><td class="num">${s.gifts}</td></tr>
      <tr><td>Mark</td><td class="num">${s.marks.from} → ${s.marks.to}</td></tr>
      ${skills}
    </table></div>
    ${s.lostItems.length ? `<div class="box"><h3>Lost</h3><p>${s.lostItems.map(esc).join(', ')}</p></div>` : ''}
    <button class="primary big" data-act="return-to-rim" data-id="${s.gifts > 0 ? 'patrons' : 'forge'}">Return to the Rim</button>
  </div>`;
}
