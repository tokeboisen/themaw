// Feature-044 VIEW-01 Arena board og VIEW-02 Arena match, og Feature-045 VIEW-02 Arena result.

import { BALANCE as B } from '@maw/rules';
import type { ArenaEndedMessage } from '@maw/contracts';
import type { ArenaBoard, ArenaMatchView, ArenaSideView } from './api.ts';
import { esc } from './dom.ts';

export const FORMAT_LABELS: Record<string, string> = { '1v1': '1:1', '2v1': '2:1', '2v2': '2:2' };

export interface ArenaForm {
  name: string;
  format: string;
  stake: string;
  side: string;
}

function sideHtml(n: 1 | 2, side: ArenaSideView, join: string | null): string {
  const filled = side.players.map((p) => `<li><div><div class="name">${esc(p.userName)}${p.opener ? ' <span class="muted">(opened it)</span>' : ''}</div>
      <div class="muted">${esc(p.characterName)} · Mark ${p.mark}</div></div></li>`);
  const open = Array.from({ length: Math.max(0, side.places - side.players.length) }, () => '<li class="muted">Open place</li>');
  return `<div class="box side side-${n}"><h3>Side ${n}</h3><ul class="list">${[...filled, ...open].join('')}</ul>${join ?? ''}</div>`;
}

/** Feature-044 VIEW-01: de åbne arenakampe med Join for hver side med en ledig plads, og formularen til en ny kamp. */
export function arenaBoardHtml(board: ArenaBoard | null, message: string, form: ArenaForm): string {
  const matches = board?.matches ?? [];
  const rows = matches.length
    ? matches.map((m) => {
        const join = (n: 1 | 2) => (m.sides[n].players.length < m.sides[n].places
          ? `<button class="primary small-btn" data-act="arena-join" data-id="${esc(m.name)}|${n}">Join Side ${n}</button>` : '');
        return `<li><div><div class="name">${esc(m.name)} <span class="muted">· ${FORMAT_LABELS[m.format] ?? m.format} · stake ${m.stake} gold</span></div>
          <div class="muted">Side 1: ${m.sides[1].players.map((p) => esc(p.userName)).join(', ') || '–'} · Side 2: ${m.sides[2].players.map((p) => esc(p.userName)).join(', ') || '–'}</div></div>
          <div class="actions">${join(1)}${join(2)}</div></li>`;
      }).join('')
    : '<li class="muted">No matches are open. Open one, and others can come and fight you.</li>';
  const option = (value: string, label: string, current: string) => `<option value="${esc(value)}" ${value === current ? 'selected' : ''}>${esc(label)}</option>`;
  return `<div class="board">
    <header class="top"><h2>The Arena</h2><button class="ghost" data-act="close">Close</button></header>
    <p class="quote">The stands of the Rim's arena fill whenever the Branded fight each other. Only the stake is won or lost.</p>
    <ul class="list">${rows}</ul>
    <form id="open-arena" class="box" novalidate>
      <h3>Open an arena match</h3>
      <label class="field">Name <input name="name" minlength="${B.lobby.nameMin}" maxlength="${B.lobby.nameMax}" value="${esc(form.name)}" autocomplete="off" required></label>
      <div class="row">
        <label class="field">Format <select name="format">${Object.keys(B.arena.formats).map((f) => option(f, FORMAT_LABELS[f] ?? f, form.format)).join('')}</select></label>
        <label class="field">Stake (gold) <input name="stake" type="number" min="0" max="${B.arena.stakeMax}" step="1" value="${esc(form.stake)}"></label>
        <label class="field">Your side <select name="side">${option('1', 'Side 1', form.side)}${option('2', 'Side 2', form.side)}</select></label>
      </div>
      <div class="field-error">${esc(message)}</div>
      <button class="primary" type="submit">Open the match</button>
    </form>
  </div>`;
}

/** Feature-044 VIEW-02: kampen, spilleren venter i – begge sider, Start for den, der åbnede den, og Leave. */
export function arenaLobbyHtml(match: ArenaMatchView, message: string): string {
  return `<div class="board">
    <header class="top"><div><h2>${esc(match.name)}</h2><p class="muted">The Arena · ${FORMAT_LABELS[match.format] ?? match.format} · stake ${match.stake} gold</p></div>
      <button class="ghost" data-act="close">Close</button></header>
    <div class="cols">${sideHtml(1, match.sides[1], null)}${sideHtml(2, match.sides[2], null)}</div>
    <div class="msg">${esc(message)}</div>
    <div class="actions">
      ${match.isOpener ? `<button class="primary big" data-act="arena-start" data-id="${esc(match.name)}" ${match.full ? '' : 'disabled'}>Start</button>` : '<span class="muted">Waiting for the player who opened the match to start it…</span>'}
      <button class="ghost" data-act="leave-lobby" data-id="${esc(match.name)}">Leave</button>
    </div>
  </div>`;
}

/** Feature-045 VIEW-02 Arena result: Victory, Defeat eller Draw, begge sider og guldet. */
export function arenaResultsHtml(m: ArenaEndedMessage): string {
  const title = m.result === 'won' ? 'Victory' : m.result === 'lost' ? 'Defeat' : 'Draw';
  const gold = m.result === 'won' ? `You win ${m.payout} gold (stake ${m.stake}).` : m.result === 'draw' ? `Your stake of ${m.stake} gold comes back.` : `You lose your stake of ${m.stake} gold.`;
  const side = (n: 1 | 2) => `<div class="box side side-${n}"><h3>Side ${n}${m.winner === n ? ' · winner' : ''}${m.you === n ? ' · you' : ''}</h3>
    <ul class="list">${m.sides[n].map((name) => `<li>${esc(name)}</li>`).join('')}</ul></div>`;
  return `<main class="screen results">
    <h1 class="${m.result}">${title}</h1>
    <p>${m.stake > 0 ? esc(gold) : 'A friendly match – nothing was at stake.'}</p>
    <div class="cols">${side(1)}${side(2)}</div>
    <button class="primary big" data-act="return-to-rim" data-id="arena">Return to the Rim</button>
  </main>`;
}
