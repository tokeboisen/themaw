// Feature-034 VIEW-01 Other players og Feature-035 VIEW-01 Invitation: et gennemsigtigt overlay i the Rim og under en
// Tithe. I Tithens første 20 sekunder kører en nedtælling, og de andre spillere i samme Tithe har Invite.

import type { PartyView } from '@maw/contracts';
import type { PlayerRow } from './api.ts';
import { esc } from './dom.ts';

export function othersHtml(players: PlayerRow[], party: PartyView | null): string {
  const signedIn = players.length
    ? players.map((p) => `<tr><td>${esc(p.userName)}${p.you ? ' <span class="muted">(you)</span>' : ''}</td>
        <td>${p.character ? `${esc(p.character.name)} <span class="muted">Mark ${p.character.mark}</span>` : '<span class="muted">–</span>'}</td>
        <td>${p.tithe ? esc(p.tithe) : '<span class="muted">The Rim</span>'}</td></tr>`).join('')
    : '<tr><td class="muted" colspan="3">Nobody else is here.</td></tr>';
  let tithe = '';
  if (party) {
    const open = party.inviteLeft > 0;
    const invitations = party.invitations
      .map((i) => `<div class="invitation"><p>${esc(i.name)} invites you to their party.</p>
        <div class="actions"><button class="primary small-btn" data-act="accept-invite" data-id="${esc(i.from)}">Accept</button>
          <button class="ghost small-btn" data-act="decline-invite" data-id="${esc(i.from)}">Decline</button>
          <span class="muted">${party.inviteLeft} s</span></div></div>`)
      .join('');
    const others = party.players.filter((p) => !p.inParty);
    const inTithe = others.length
      ? others.map((p) => `<li><span>${esc(p.name)}</span>${open
          ? `<button class="ghost small-btn" data-act="invite" data-id="${esc(p.id)}" ${p.invited ? 'disabled' : ''}>${p.invited ? 'Invited' : 'Invite'}</button>`
          : ''}</li>`).join('')
      : '<li class="muted">No other players outside your party.</li>';
    const members = party.members.map((m) => `<li><span>${esc(m.name)}${m.you ? ' <span class="muted">(you)</span>' : ''}</span>
      <span class="muted">depth ${m.depth}</span></li>`).join('');
    tithe = `${open ? `<p class="countdown">Invitations close in <b>${party.inviteLeft}</b> s</p>` : ''}
      ${invitations}
      <div class="cols">
        <div class="box"><h3>Your party</h3><ul class="items plain">${members}</ul>
          ${party.members.length > 1 ? '<button class="ghost small-btn" data-act="leave-party">Leave party</button>' : '<p class="hint">You fight alone.</p>'}</div>
        <div class="box"><h3>In this Tithe</h3><ul class="items plain">${inTithe}</ul></div>
      </div>`;
  }
  return `<div class="overlay see-through"><div class="sheet">
    <header class="top"><h2>Other players</h2><button class="ghost" data-act="close">Close</button></header>
    ${tithe}
    <div class="box"><h3>Signed in</h3><table class="stats"><tbody>${signedIn}</tbody></table></div>
  </div></div>`;
}
