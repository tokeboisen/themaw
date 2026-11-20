// Feature-036 VIEW-01 Tithes og Feature-036/-025/-037 VIEW Lobby.

import { BALANCE as B } from '@maw/rules';
import type { LobbyView, ReachView, TitheListItem } from './api.ts';
import { esc } from './dom.ts';

export function tithesHtml(list: TitheListItem[], message: string, nameDraft: string, reaches: ReachView[] = [], reachDraft = 'mines'): string {
  const reachCards = reaches.map((r) => `<label class="reach ${r.id === reachDraft ? 'selected' : ''}">
      <input type="radio" name="reach" value="${esc(r.id)}" ${r.id === reachDraft ? 'checked' : ''}>
      <b>Reach ${r.number}: ${esc(r.name)}</b><span class="hint">${esc(r.text)}</span></label>`).join('');
  const rows = list.length
    ? list.map((t) => `<li>
        <div><div class="name">${esc(t.name)} <span class="muted">· ${esc(t.reachName)}</span></div>
          <div class="muted">Opened by ${esc(t.opener)} · ${t.players.map(esc).join(', ')}</div></div>
        <div class="actions"><span class="muted">${t.count} of ${t.max}</span>
          <button class="primary small-btn" data-act="join-tithe" data-id="${esc(t.name)}" ${t.full ? 'disabled' : ''}>Join</button></div>
      </li>`).join('')
    : '<li class="muted">No Tithes are open. Open one, and your friends can join it.</li>';
  return `<div class="board">
    <header class="top"><h2>The Tithe Board</h2><button class="ghost" data-act="close">Close</button></header>
    <ul class="list">${rows}</ul>
    <form id="open-tithe" class="box" novalidate>
      <h3>Open a Tithe</h3>
      <label class="field">Name <input name="name" minlength="${B.lobby.nameMin}" maxlength="${B.lobby.nameMax}" value="${esc(nameDraft)}" autocomplete="off" required></label>
      ${reachCards ? `<div class="reaches">${reachCards}</div>` : ''}
      <div class="field-error">${esc(message)}</div>
      <button class="primary" type="submit">Open a Tithe</button>
    </form>
  </div>`;
}

export function lobbyHtml(lobby: LobbyView, message: string): string {
  const rows = lobby.players
    .map((p) => `<li><div><div class="name">${esc(p.userName)}${p.opener ? ' <span class="muted">(opened it)</span>' : ''}</div>
      <div class="muted">${esc(p.characterName)} · Mark ${p.mark}</div></div></li>`)
    .join('');
  return `<div class="board">
    <header class="top"><div><h2>${esc(lobby.name)}</h2><p class="muted">${esc(lobby.reachName)}</p></div><span class="muted">${lobby.players.length} of ${lobby.max}</span></header>
    <p class="muted">NPC rivals fill the places that are left when the Tithe is launched.</p>
    <ul class="list">${rows}</ul>
    <div class="msg">${esc(message)}</div>
    <div class="actions">
      ${lobby.isOpener ? `<button class="primary big" data-act="launch-tithe" data-id="${esc(lobby.name)}">Launch</button>` : '<span class="muted">Waiting for the player who opened the Tithe to launch it…</span>'}
      <button class="ghost" data-act="leave-lobby" data-id="${esc(lobby.name)}">Leave</button>
    </div>
  </div>`;
}
