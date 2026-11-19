// Webappen. Fase 0: en statusside, der viser, at api og tithe-server kan nås, også fra andre maskiner på netværket.
// Skærmene fra Event Modellen kommer i fase 1 og frem.

const $ = (id: string) => document.getElementById(id) as HTMLElement;

function show(id: string, text: string, ok: boolean): void {
  const el = $(id);
  el.textContent = text;
  el.className = ok ? 'ok' : 'bad';
}

$('address').textContent = `${location.protocol}//${location.host}`;

async function checkApi(): Promise<void> {
  try {
    const response = await fetch('/api/health', { cache: 'no-store' });
    const body = (await response.json()) as { status: string };
    show('api', body.status === 'ok' ? 'Online' : 'Degraded', body.status === 'ok');
  } catch {
    show('api', 'Unreachable', false);
  }
}

function connect(): void {
  const socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  let timer: number | undefined;
  socket.addEventListener('open', () => {
    const ping = () => socket.send(JSON.stringify({ type: 'ping', at: performance.now() }));
    ping();
    timer = window.setInterval(ping, 2000);
  });
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data)) as { type: string; at?: number; players?: number };
    if (message.type === 'pong' && message.at !== undefined) {
      show('ws', `Connected · ${Math.round(performance.now() - message.at)} ms`, true);
      show('players', String(message.players ?? 0), true);
    }
  });
  socket.addEventListener('close', () => {
    window.clearInterval(timer);
    show('ws', 'Disconnected – retrying', false);
    window.setTimeout(connect, 2000);
  });
}

void checkApi();
window.setInterval(() => void checkApi(), 5000);
connect();
