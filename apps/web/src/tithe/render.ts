// Tegner en Tithe på et canvas ud fra serverens snapshots (Feature-010 VIEW-01, -011 VIEW-01, -006 VIEW-01, -015 VIEW-01).
// Overført fra prototype/js/client/render.js. Bevidst enkelt: felter, cirkler og farver.

import type { SnapshotEntity, YouView } from '@maw/contracts';
import {
  BUSH, CAMPFIRE, EXIT, FLOOR, FURNITURE, GATE, HEARTH, INDOOR, RARITY_COLORS, ROAD, RUBBLE, STAIRS, TREE, TREE_BIG, WALL, inOval, type Rarity,
} from '@maw/rules';

/** Det, der står på jorden og tegnes efter den. */
const DECOR = new Set([TREE, TREE_BIG, BUSH, FURNITURE, HEARTH, CAMPFIRE]);

const MONSTER_COLORS: Record<string, string> = { gnawer: '#8d7b68', spitter: '#9b6bd1', brute: '#8a3a2f', foreman: '#b0602d' };
const UNKNOWN = 255;

/** Det, der tegnes i ét billede: kortet, som spilleren kender det, og de udjævnede positioner. */
export interface Frame {
  mapW: number;
  mapH: number;
  tiles: Uint8Array;
  tilesVersion: number;
  you: YouView;
  ents: SnapshotEntity[];
  proj: { x: number; y: number; vx: number; vy: number; kind: string }[];
  /** Feature-047: flammer, ekkoer og spejlbilleder på gulvet. */
  zones: { x: number; y: number; r: number; kind: string; t: number }[];
  loot: { x: number; y: number; kind: string; rarity?: string }[];
  caches: { x: number; y: number; opened: boolean }[];
  gate: { x: number; y: number; open: boolean } | null;
  sealed: boolean;
  radius: number;
  /** Partiets andre medlemmer på samme dybde, til minikortet (Feature-034 AGG-01). */
  party: { name: string; x: number; y: number }[];
  /** Stedet: minerne, byen, skoven eller arenaen (Feature-010). */
  reach: string;
  /** Feature-045 VIEW-01: arenaen – spillerens side og ringen, når den lukker sig. */
  arena: { you: 1 | 2 | null; ring: { cx: number; cy: number; rx: number; ry: number } | null } | null;
}

/** Feature-045 VIEW-01: Side 1 i blåt og Side 2 i rødt. */
const SIDE_COLORS: Record<1 | 2, { fill: string; ring: string; text: string }> = {
  1: { fill: '#46608a', ring: '#c3ccd6', text: '#9fc0ff' },
  2: { fill: '#973a2c', ring: '#f0cba9', text: '#ffb09a' },
};

interface Floater {
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  t: number;
}

export function createRenderer(canvas: HTMLCanvasElement, minimap: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!;
  const mctx = minimap.getContext('2d')!;
  let dpr = 1;
  let W = 0;
  let H = 0;
  let tile = 40;
  const floaters: Floater[] = [];
  const puffs: { x: number; y: number; t: number; color?: string; size?: number }[] = [];
  /** Feature-047: en Echo Arts område som en ring, der vokser, og Echo Chains stråler. */
  const rings: { x: number; y: number; r: number; t: number; color: string }[] = [];
  const beams: { x: number; y: number; x2: number; y2: number; t: number; color: string }[] = [];
  let clock = 0;
  let shake = 0;
  let minimapAge = 1;
  let edges: Uint8Array | null = null;
  let edgesVersion = -1;

  function resize(): void {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth || window.innerWidth;
    H = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    tile = Math.round(Math.max(28, Math.min(48, Math.min(W, H) / 11)));
  }
  window.addEventListener('resize', resize);
  resize();

  /** Kun vægge ved siden af kendt gulv tegnes. */
  function wallEdges(f: Frame): Uint8Array {
    if (edges && edgesVersion === f.tilesVersion) return edges;
    const { mapW: w, mapH: h, tiles } = f;
    const edge = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (tiles[y * w + x] !== WALL) continue;
        let near = false;
        for (let dy = -1; dy <= 1 && !near; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            const v = nx >= 0 && ny >= 0 && nx < w && ny < h ? tiles[ny * w + nx] : UNKNOWN;
            if (v !== WALL && v !== UNKNOWN) {
              near = true;
              break;
            }
          }
        }
        edge[y * w + x] = near ? 1 : 0;
      }
    }
    edges = edge;
    edgesVersion = f.tilesVersion;
    return edge;
  }

  function circle(x: number, y: number, r: number, fill: string | null, stroke: string | null, width = 2): void {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.stroke();
    }
  }

  function bar(x: number, y: number, w: number, frac: number, color: string): void {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(x - w / 2, y, w, 4);
    ctx.fillStyle = color;
    ctx.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, frac)), 4);
  }

  function label(text: string, x: number, y: number, color = '#fff', size = 12): void {
    ctx.font = `600 ${size}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  /** Jordens farve: sand i arenaen, skovbund og stier i skoven, ellers gulvene i minerne og byen. */
  function ground(f: Frame, x: number, y: number, tt = FLOOR): string {
    const odd = (x + y) % 2 === 1;
    if (f.arena) return odd ? '#9e8a62' : '#988459';
    if (f.reach === 'woods') {
      if (tt === ROAD) return odd ? '#4a3b28' : '#463826';
      if (tt === INDOOR) return odd ? '#5e3c22' : '#583820';
      return odd ? '#2c3322' : '#29301f';
    }
    if (tt === ROAD) return odd ? '#2b2620' : '#29241f';
    if (tt === INDOOR || tt === STAIRS) return odd ? '#33271c' : '#30251b';
    return odd ? '#251e18' : '#221b16';
  }

  /** Træer (1 og 2 × 2 felter), buske, møbler, ildsteder og bål (Feature-045, -010). */
  function drawDecor(f: Frame, x: number, y: number, tt: number, px: number, py: number): void {
    const at = (dx: number, dy: number) => f.tiles[(y + dy) * f.mapW + (x + dx)];
    const t = performance.now() / 1000;
    if (tt === TREE) {
      ctx.fillStyle = '#523419';
      ctx.fillRect(px + tile * 0.42, py + tile * 0.55, tile * 0.16, tile * 0.4);
      circle(px + tile / 2, py + tile * 0.42, tile * 0.48, '#34452a', '#1f2a1a', 2);
      circle(px + tile * 0.38, py + tile * 0.32, tile * 0.18, '#52663d', null);
    } else if (tt === TREE_BIG) {
      // Kronen tegnes én gang fra feltet øverst til venstre og dækker alle fire felter.
      if (at(-1, 0) === TREE_BIG || at(0, -1) === TREE_BIG) return;
      const cx = px + tile;
      const cy = py + tile * 0.92;
      ctx.fillStyle = '#523419';
      ctx.fillRect(cx - tile * 0.14, cy + tile * 0.3, tile * 0.28, tile * 0.7);
      circle(cx, cy, tile * 0.98, '#2b3a22', '#1f2a1a', 2.5);
      circle(cx - tile * 0.35, cy - tile * 0.3, tile * 0.42, '#34452a', null);
      circle(cx + tile * 0.3, cy - tile * 0.1, tile * 0.38, '#3f5232', null);
      circle(cx - tile * 0.25, cy - tile * 0.45, tile * 0.2, '#52663d', null);
    } else if (tt === BUSH) {
      circle(px + tile * 0.32, py + tile * 0.58, tile * 0.32, '#3f5232', null);
      circle(px + tile * 0.68, py + tile * 0.55, tile * 0.3, '#465a37', null);
      circle(px + tile * 0.5, py + tile * 0.35, tile * 0.3, '#52663d', null);
    } else if (tt === FURNITURE) {
      // Et bord, en seng eller en tønde, efter feltet.
      const kind = (x * 7 + y * 13) % 3;
      if (kind === 0) {
        ctx.fillStyle = '#774c26';
        ctx.fillRect(px + 3, py + 4, tile - 6, tile - 10);
        ctx.fillStyle = '#523419';
        ctx.fillRect(px + 5, py + tile - 7, 3, 5);
        ctx.fillRect(px + tile - 8, py + tile - 7, 3, 5);
      } else if (kind === 1) {
        ctx.fillStyle = '#7d7066';
        ctx.fillRect(px + 2, py + 3, tile - 4, tile - 6);
        ctx.fillStyle = '#c8bba8';
        ctx.fillRect(px + 4, py + 5, tile * 0.35, tile * 0.3);
        ctx.fillStyle = '#6b2420';
        ctx.fillRect(px + 2, py + tile * 0.5, tile - 4, tile * 0.5 - 3);
      } else {
        circle(px + tile / 2, py + tile / 2, tile * 0.32, '#774c26', '#33200f', 2);
        ctx.fillStyle = '#5d6876';
        ctx.fillRect(px + tile * 0.2, py + tile * 0.42, tile * 0.6, 2);
      }
    } else if (tt === HEARTH || tt === CAMPFIRE) {
      const big = tt === CAMPFIRE;
      const cx = px + tile / 2;
      const cy = py + tile / 2;
      circle(cx, cy, tile * (big ? 1.4 : 0.9) * (0.95 + 0.05 * Math.sin(t * 7)), 'rgba(255,176,74,0.14)', null);
      if (big) {
        for (let k = 0; k < 6; k++) circle(cx + Math.cos(k) * tile * 0.38, cy + Math.sin(k) * tile * 0.38, tile * 0.1, '#5f534b', null);
        ctx.fillStyle = '#523419';
        ctx.fillRect(cx - tile * 0.3, cy - 2, tile * 0.6, 4);
      } else {
        ctx.fillStyle = '#5f534b';
        ctx.fillRect(px + 2, py + 2, tile - 4, tile - 4);
        ctx.fillStyle = '#241a17';
        ctx.fillRect(px + 5, py + 5, tile - 10, tile - 10);
      }
      const flick = 0.85 + 0.15 * Math.sin(t * 11 + x);
      circle(cx, cy, tile * 0.22 * flick, '#d0601e', null);
      circle(cx, cy - 2, tile * 0.12 * flick, '#ffb04a', null);
    }
  }

  function draw(f: Frame, dt: number): void {
    if (canvas.clientWidth !== W || canvas.clientHeight !== H) resize();
    const p = f.you;
    const R = f.radius;
    const edge = wallEdges(f);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0b0807';
    ctx.fillRect(0, 0, W, H);

    shake = Math.max(0, shake - dt * 20);
    const camX = p.x * tile - W / 2 + (Math.random() - 0.5) * shake;
    const camY = p.y * tile - H / 2 + (Math.random() - 0.5) * shake;
    const sx = (x: number) => x * tile - camX;
    const sy = (y: number) => y * tile - camY;

    // Felter: det, der ikke er set, er sort; det uden for synsradius er mørkt. Først jorden, så det, der står på den
    // (træer, store træer, buske, møbler, ildsteder og bål), så et stort træs krone ikke dækkes af nabofelterne, og til
    // sidst mørket.
    const x0 = Math.max(0, Math.floor(camX / tile) - 1);
    const x1 = Math.min(f.mapW - 1, Math.ceil((camX + W) / tile));
    const y0 = Math.max(0, Math.floor(camY / tile) - 1);
    const y1 = Math.min(f.mapH - 1, Math.ceil((camY + H) / tile));
    const woods = f.reach === 'woods';
    const decor: [number, number, number][] = [];
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * f.mapW + x;
        const tt = f.tiles[i];
        if (tt === UNKNOWN || tt === undefined) continue;
        const px = sx(x);
        const py = sy(y);
        if (f.arena && tt === WALL && !inOval(x + 0.5, y + 0.5)) {
          // Feature-045 VIEW-01: tribunerne udenfor ovalen.
          ctx.fillStyle = (y % 2) ? '#3d2716' : '#4a2f1c';
          ctx.fillRect(px, py, tile + 0.5, tile + 0.5);
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.fillRect(px, py + tile - 4, tile + 0.5, 4);
          continue;
        }
        if (DECOR.has(tt)) {
          const indoor = tt === FURNITURE || tt === HEARTH;
          ctx.fillStyle = indoor ? ((x + y) % 2 ? '#5e3c22' : '#583820') : ground(f, x, y);
          ctx.fillRect(px, py, tile + 0.5, tile + 0.5);
          decor.push([x, y, tt]);
          continue;
        }
        if (f.arena) {
          // Feature-045 VIEW-01: sand og klipper.
          ctx.fillStyle = ground(f, x, y);
          ctx.fillRect(px, py, tile + 0.5, tile + 0.5);
          if (tt === WALL) {
            ctx.fillStyle = '#5f534b';
            ctx.fillRect(px + 2, py + 3, tile - 4, tile - 5);
            ctx.fillStyle = '#7d7066';
            ctx.fillRect(px + 2, py + 3, tile - 4, 4);
          }
          continue;
        }
        if (tt === WALL) {
          if (!edge[i]) continue;
          // I skoven er murene hytternes bjælkevægge.
          ctx.fillStyle = woods ? '#3d2716' : '#3b3029';
          ctx.fillRect(px, py, tile + 0.5, tile + 0.5);
          ctx.fillStyle = woods ? '#774c26' : '#4b3d33';
          ctx.fillRect(px, py, tile + 0.5, 3);
          if (woods) {
            ctx.fillStyle = '#33200f';
            ctx.fillRect(px, py + tile * 0.5, tile + 0.5, 2);
          }
        } else if (tt === RUBBLE) {
          // The Broken City: murbrokker; The Woods: hjertets stående sten.
          ctx.fillStyle = woods ? ground(f, x, y) : (x + y) % 2 ? '#2b2620' : '#29241f';
          ctx.fillRect(px, py, tile + 0.5, tile + 0.5);
          if (woods) {
            ctx.fillStyle = '#5f534b';
            ctx.fillRect(px + tile * 0.25, py + tile * 0.1, tile * 0.5, tile * 0.8);
            ctx.fillStyle = '#7d7066';
            ctx.fillRect(px + tile * 0.25, py + tile * 0.1, tile * 0.5, tile * 0.18);
          } else {
            ctx.fillStyle = '#5b5046';
            ctx.fillRect(px + tile * 0.15, py + tile * 0.35, tile * 0.4, tile * 0.35);
            ctx.fillStyle = '#4a4038';
            ctx.fillRect(px + tile * 0.5, py + tile * 0.2, tile * 0.32, tile * 0.3);
          }
        } else {
          ctx.fillStyle = ground(f, x, y, tt);
          ctx.fillRect(px, py, tile + 0.5, tile + 0.5);
          if (woods && tt === INDOOR) {
            ctx.fillStyle = 'rgba(0,0,0,0.18)';
            ctx.fillRect(px, py + tile * 0.33, tile + 0.5, 1);
            ctx.fillRect(px, py + tile * 0.66, tile + 0.5, 1);
          }
          if (tt === STAIRS) {
            // Feature-041: trapperne i husene.
            ctx.fillStyle = '#8a6a44';
            for (let s = 0; s < 4; s++) ctx.fillRect(px + 4 + s * 2, py + 4 + (s * (tile - 8)) / 4, tile - 8 - s * 4, (tile - 8) / 4 - 2);
          }
          if (tt === EXIT) {
            ctx.fillStyle = '#c87a2e';
            ctx.fillRect(px + 4, py + 4, tile - 8, tile - 8);
            ctx.fillStyle = '#5a3412';
            for (let s = 1; s <= 3; s++) ctx.fillRect(px + 6, py + 4 + (s * (tile - 8)) / 4 - 2, tile - 12, 3);
          } else if (tt === GATE) {
            const open = !!f.gate?.open;
            ctx.fillStyle = open ? '#ffd84a' : '#6b5a1e';
            ctx.fillRect(px + 2, py + 2, tile - 4, tile - 4);
            if (!open) {
              ctx.fillStyle = '#2a220c';
              for (let s = 1; s <= 3; s++) ctx.fillRect(px + (s * tile) / 4 - 2, py + 2, 4, tile - 4);
            } else {
              // Feature-015 VIEW-01: den åbne port gløder guld.
              circle(px + tile / 2, py + tile / 2, tile * (0.7 + 0.1 * Math.sin(performance.now() / 200)), 'rgba(255,216,74,0.18)', null);
            }
          }
        }
      }
    }
    for (const [x, y, tt] of decor) drawDecor(f, x, y, tt, sx(x), sy(y));
    if (!f.arena) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const tt = f.tiles[y * f.mapW + x];
          if (tt === UNKNOWN || tt === undefined) continue;
          const dx = x + 0.5 - p.x;
          const dy = y + 0.5 - p.y;
          if (dx * dx + dy * dy > R * R) ctx.fillRect(sx(x), sy(y), tile + 0.5, tile + 0.5);
        }
      }
    }

    // Feature-045 AGG-02: ringen, når den lukker sig – en glødende linje, og udenfor den et rødligt skær.
    if (f.arena?.ring) {
      const g = f.arena.ring;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.ellipse(sx(g.cx), sy(g.cy), g.rx * tile, g.ry * tile, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(208,96,30,0.18)';
      ctx.fill('evenodd');
      ctx.beginPath();
      ctx.ellipse(sx(g.cx), sy(g.cy), g.rx * tile, g.ry * tile, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffb04a';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }

    // Caches og loot (Feature-006 VIEW-01): ting som ruder i sjældenhedens farve, guld som mønter, potions røde og rations brune.
    for (const c of f.caches) {
      ctx.fillStyle = c.opened ? '#3a2c1e' : '#7a5530';
      ctx.fillRect(sx(c.x) - tile * 0.3, sy(c.y) - tile * 0.22, tile * 0.6, tile * 0.44);
      if (!c.opened) {
        ctx.fillStyle = '#ffd84a';
        ctx.fillRect(sx(c.x) - tile * 0.3, sy(c.y) - 2, tile * 0.6, 4);
      }
    }
    for (const l of f.loot) {
      const x = sx(l.x);
      const y = sy(l.y);
      if (l.kind === 'gold') circle(x, y, tile * 0.12, '#ffd84a', '#7a5c00', 1);
      else if (l.kind === 'potion') circle(x, y, tile * 0.14, '#d0453c', '#fff', 1.5);
      else if (l.kind === 'focusPotion') circle(x, y, tile * 0.14, '#4a7fd6', '#fff', 1.5); // Feature-006: focus potions blå
      else if (l.kind === 'ration') {
        ctx.fillStyle = '#c9a26a';
        ctx.fillRect(x - tile * 0.13, y - tile * 0.1, tile * 0.26, tile * 0.2);
      } else {
        const s = tile * 0.17;
        ctx.beginPath();
        ctx.moveTo(x, y - s);
        ctx.lineTo(x + s, y);
        ctx.lineTo(x, y + s);
        ctx.lineTo(x - s, y);
        ctx.closePath();
        ctx.fillStyle = RARITY_COLORS[(l.rarity ?? 'common') as Rarity] ?? '#fff';
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // Feature-047: flammer, ekkoer og spejlbilleder på gulvet.
    clock += dt;
    for (const z of f.zones) {
      const x = sx(z.x);
      const y = sy(z.y);
      const fade = Math.min(1, z.t / 0.6);
      if (z.kind === 'fire') {
        const flicker = 0.85 + Math.sin(clock * 18 + z.x * 7) * 0.15;
        circle(x, y, z.r * tile * flicker, `rgba(255,120,40,${0.35 * fade})`, `rgba(255,200,80,${0.5 * fade})`, 1.5);
        circle(x, y, z.r * tile * 0.45 * flicker, `rgba(255,220,120,${0.55 * fade})`, null);
      } else if (z.kind === 'echo') {
        circle(x, y, z.r * tile, `rgba(180,140,224,${0.12 * fade})`, `rgba(180,140,224,${0.45 * fade})`, 1.5);
        circle(x, y, tile * 0.3, `rgba(200,170,240,${0.55 * fade})`, `rgba(240,230,255,${0.8 * fade})`, 1.5);
      } else if (z.kind === 'heal') {
        // Feature-049 Healing Circle: en grøn, lysende cirkel.
        const pulse = 0.85 + Math.sin(clock * 4) * 0.15;
        circle(x, y, z.r * tile, `rgba(110,230,140,${0.12 * fade * pulse})`, `rgba(150,255,170,${0.6 * fade})`, 2);
      } else {
        circle(x, y, tile * 0.35, `rgba(150,200,255,${0.4 * fade})`, `rgba(230,245,255,${0.85 * fade})`, 2);
      }
    }

    // Monstre, rivaler og andre spillere. Et angreb på vej viser rækkevidden i rødt (Feature-011 VIEW-01).
    for (const e of f.ents) {
      const x = sx(e.x);
      const y = sy(e.y);
      const r = e.r * tile;
      if (e.windup) {
        if (e.warden) circle(x, y, e.windup.reach * tile, 'rgba(255,60,40,0.18)', 'rgba(255,60,40,0.6)', 2);
        else circle(x, y, e.windup.reach * tile, 'rgba(255,60,40,0.15)', null);
      }
      if (e.kind === 'monster') {
        circle(x, y, r, e.flash ? '#fff' : e.color ?? MONSTER_COLORS[e.type ?? ''] ?? '#888', e.veteran ? '#ffd84a' : '#000', e.veteran ? 2.5 : 1.5);
        // Feature-011 VIEW-01: navn og level under monstret, i en farve efter hvor svært det er for spillerens Mark.
        if (!e.warden && e.level !== undefined) {
          const diff = e.level - p.mark;
          const color = e.veteran ? '#ffd84a' : diff <= -3 ? '#8a8178' : diff <= 2 ? '#e8e2d6' : diff <= 4 ? '#ffa64d' : '#ff5a4a';
          label(`${e.name} · L${e.level}`, x, y + r + 12, color, 10);
        }
        if (e.type === 'spitter') circle(x, y, r * 0.4, '#d9b8ff', null);
        // Feature-047: lammet, rodfæstet, langsomt og mærket.
        if (e.held === 'rooted') circle(x, y, r + 4, null, '#bfe6ff', 3);
        else if (e.held === 'slowed') circle(x, y, r + 3, null, 'rgba(120,170,255,0.8)', 2);
        else if (e.held === 'stunned') {
          for (let i = 0; i < 3; i++) {
            const a = clock * 4 + (i * Math.PI * 2) / 3;
            circle(x + Math.cos(a) * r * 0.8, y - r - 4 + Math.sin(a) * 3, 2.5, '#ffd84a', null);
          }
        }
        if (e.marked) circle(x, y, r + 7, null, `rgba(180,140,224,${0.6 + Math.sin(clock * 6) * 0.3})`, 2);
        if (e.warden) {
          ctx.fillStyle = '#ffd84a';
          ctx.beginPath();
          ctx.moveTo(x - r * 0.6, y - r * 0.7);
          ctx.lineTo(x - r * 0.3, y - r * 1.15);
          ctx.lineTo(x, y - r * 0.75);
          ctx.lineTo(x + r * 0.3, y - r * 1.15);
          ctx.lineTo(x + r * 0.6, y - r * 0.7);
          ctx.closePath();
          ctx.fill();
          label(`${e.name} · L${e.level ?? ''}`, x, y - r - 14, '#ffd84a', 13);
          bar(x, y - r - 10, tile * 2, e.hp / e.maxHp, '#c8423a');
        } else if (e.hp < e.maxHp) bar(x, y - r - 7, tile * 0.7, e.hp / e.maxHp, '#c8423a');
      } else if (e.kind === 'rival') {
        circle(x, y, r, e.flash ? '#fff' : e.color ?? '#ccc', e.hostile ? '#ff4a3a' : '#000', e.hostile ? 2.5 : 1.5);
        label(e.name, x, y - r - 10, e.color ?? '#ccc', 12);
        bar(x, y - r - 7, tile * 0.8, e.hp / e.maxHp, '#c8423a');
      } else if (e.side) {
        // Feature-045 VIEW-01: kæmperne i deres sides farve; Feature-013/-049: en skjult kæmper ses svagt.
        ctx.globalAlpha = e.alpha ?? 1;
        const c = SIDE_COLORS[e.side];
        circle(x, y, r, e.flash ? '#fff' : c.fill, c.ring, 2);
        label(e.name, x, y - r - 10, c.text, 12);
        bar(x, y - r - 7, tile * 0.8, e.hp / e.maxHp, '#c8423a');
        ctx.globalAlpha = 1;
      } else {
        // Feature-010 VIEW-01: andre spillere i syne viser deres brugernavn over hovedet; partiet i grønblåt, andre i rav.
        ctx.globalAlpha = e.alpha ?? 1;
        circle(x, y, r, e.flash ? '#fff' : e.party ? '#3fc7c0' : '#e0905a', e.party ? '#e8fffd' : '#ff4a3a', 2);
        label(e.name, x, y - r - 10, e.party ? '#9ff3ee' : '#ffc29a', 12);
        bar(x, y - r - 7, tile * 0.8, e.hp / e.maxHp, '#c8423a');
        ctx.globalAlpha = 1;
      }
    }

    // Spilleren og et sving som en bleg bue (Feature-011 VIEW-01).
    const px = sx(p.x);
    const py = sy(p.y);
    const pr = 0.35 * tile;
    if (p.swing > 0) {
      const a = Math.atan2(p.swingDir[1], p.swingDir[0]);
      const half = ((p.swingArc / 2) * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.arc(px, py, (p.swingReach + 0.3) * tile, a - half, a + half);
      ctx.closePath();
      ctx.fillStyle = `rgba(255,255,255,${0.25 * Math.min(1, p.swing / 0.15)})`;
      ctx.fill();
    }
    if (p.dodge > 0) circle(px - p.dodgeDir[0] * tile * 0.5, py - p.dodgeDir[1] * tile * 0.5, pr, 'rgba(120,180,255,0.3)', null);
    const mine = f.arena?.you ? SIDE_COLORS[f.arena.you] : null;
    // Feature-013/-049: skjult tegnes spilleren selv halvt gennemsigtig.
    ctx.globalAlpha = p.hidden ? 0.45 : 1;
    circle(px, py, pr, p.flash ? '#fff' : mine ? mine.fill : '#4fa3ff', mine ? mine.ring : '#e8f2ff', 2);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#e8f2ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(px + p.facing[0] * pr * 0.5, py + p.facing[1] * pr * 0.5);
    ctx.lineTo(px + p.facing[0] * pr * 1.4, py + p.facing[1] * pr * 1.4);
    ctx.stroke();

    // Feature-047: virkningerne på spilleren – skjold, krystal, krone og tre spejlbilleder.
    if (p.status.includes('Warded')) circle(px, py, pr + 5, null, 'rgba(191,230,255,0.8)', 2);
    if (p.status.includes('Mantled')) circle(px, py, pr + 8, null, 'rgba(191,230,255,0.45)', 3);
    if (p.status.includes('Crowned')) circle(px, py - pr - 6, 4, '#ffd84a', null);
    if (p.status.includes('Mirrored')) {
      for (let i = 0; i < 3; i++) {
        const a = clock * 2 + (i * Math.PI * 2) / 3;
        circle(px + Math.cos(a) * tile * 0.8, py + Math.sin(a) * tile * 0.8, pr * 0.85, 'rgba(150,200,255,0.35)', 'rgba(230,245,255,0.7)', 1.5);
      }
    }

    for (const pj of f.proj) {
      const x = sx(pj.x);
      const y = sy(pj.y);
      if (pj.kind === 'arrow') {
        ctx.strokeStyle = '#e6d3a8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - pj.vx * tile * 0.35, y - pj.vy * tile * 0.35);
        ctx.lineTo(x, y);
        ctx.stroke();
      } else if (pj.kind === 'bolt') circle(x, y, tile * 0.13, '#8fc1ff', '#fff', 1);
      else if (pj.kind === 'fire') circle(x, y, tile * 0.15, '#ff8a3a', '#ffd84a', 1.5);
      else if (pj.kind === 'web') circle(x, y, tile * 0.13, 'rgba(230,230,240,0.8)', '#9a9aa8', 1);
      else if (pj.kind === 'tone') {
        // Feature-047 Resonant Line: en bølge på tværs af retningen.
        ctx.strokeStyle = 'rgba(190,225,255,0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x - pj.vy * tile * 0.35, y + pj.vx * tile * 0.35);
        ctx.lineTo(x + pj.vy * tile * 0.35, y - pj.vx * tile * 0.35);
        ctx.stroke();
      } else if (pj.kind === 'note') circle(x, y, tile * 0.18, '#ffe9a0', '#fff', 2);
      else circle(x, y, tile * 0.11, '#b67be8', null);
    }

    for (const fl of puffs) {
      fl.t += dt;
      const color = fl.color ?? '180,140,220';
      circle(sx(fl.x), sy(fl.y), tile * ((fl.size ?? 0.3) + fl.t), `rgba(${color},${Math.max(0, 0.45 - fl.t * 0.8)})`, null);
    }
    for (let i = puffs.length - 1; i >= 0; i--) if (puffs[i]!.t > 0.5) puffs.splice(i, 1);
    for (const rg of rings) {
      rg.t += dt;
      const k = Math.min(1, rg.t / 0.25);
      const alpha = Math.max(0, 1 - rg.t / 0.5);
      circle(sx(rg.x), sy(rg.y), Math.max(2, rg.r * tile * (0.3 + 0.7 * k)), `rgba(${rg.color},${0.18 * alpha})`, `rgba(${rg.color},${0.85 * alpha})`, 2.5);
    }
    for (let i = rings.length - 1; i >= 0; i--) if (rings[i]!.t > 0.5) rings.splice(i, 1);
    for (const bm of beams) {
      bm.t += dt;
      ctx.strokeStyle = `rgba(${bm.color},${Math.max(0, 1 - bm.t / 0.3)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sx(bm.x), sy(bm.y));
      ctx.lineTo(sx(bm.x2), sy(bm.y2));
      ctx.stroke();
    }
    for (let i = beams.length - 1; i >= 0; i--) if (beams[i]!.t > 0.3) beams.splice(i, 1);

    // Tal og tekster, der stiger op: kritiske slag i guld, skade på spilleren i rødt.
    for (const fl of floaters) {
      fl.t += dt;
      ctx.globalAlpha = Math.max(0, 1 - fl.t / 1.1);
      label(fl.text, sx(fl.x), sy(fl.y) - fl.t * tile * 0.9, fl.color, fl.size);
      ctx.globalAlpha = 1;
    }
    for (let i = floaters.length - 1; i >= 0; i--) if (floaters[i]!.t > 1.1) floaters.splice(i, 1);

    // Forseglet dybde, lavt liv og sult giver en mørk kant.
    const low = p.hp < p.maxHp * 0.3;
    if (f.sealed || low || p.starving) {
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
      const color = f.sealed ? '120,20,10' : low ? '140,0,0' : '90,60,20';
      g.addColorStop(0, `rgba(${color},0)`);
      g.addColorStop(1, `rgba(${color},${f.sealed ? 0.55 : 0.4})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    if (f.sealed && Math.random() < 0.3) shake = Math.max(shake, 2);

    minimapAge += dt;
    if (minimapAge > 0.2) {
      minimapAge = 0;
      drawMinimap(f);
    }
  }

  function drawMinimap(f: Frame): void {
    const s = minimap.width / f.mapW;
    mctx.clearRect(0, 0, minimap.width, minimap.height);
    for (let y = 0; y < f.mapH; y++) {
      for (let x = 0; x < f.mapW; x++) {
        const v = f.tiles[y * f.mapW + x];
        if (v === UNKNOWN || v === WALL || v === undefined) continue;
        // Træer og møbler er mørke på kortet; buske og skovbund grønlige; bål og ildsteder gløder (Feature-010).
        mctx.fillStyle = v === EXIT || v === STAIRS ? '#ff9a3a' : v === GATE ? '#ffd84a' : v === RUBBLE ? '#3a332c' : v === INDOOR ? '#6b5640'
          : v === TREE || v === TREE_BIG ? '#1f2a1a' : v === BUSH ? '#3f5232' : v === FURNITURE ? '#3d2716' : v === HEARTH || v === CAMPFIRE ? '#d0601e'
          : f.reach === 'woods' && v === ROAD ? '#6b5640' : f.reach === 'woods' ? '#3f4a30' : '#5a4e44';
        const big = v === EXIT || v === GATE ? 2 : v === STAIRS ? 1 : 0;
        mctx.fillRect(x * s - big, y * s - big, s + big * 2, s + big * 2);
      }
    }
    for (const e of f.ents) {
      if (e.kind === 'monster' || e.party) continue;
      mctx.fillStyle = e.kind === 'rival' ? e.color ?? '#ccc' : '#e0905a';
      mctx.fillRect(e.x * s - 2, e.y * s - 2, 4, 4);
    }
    // Feature-034 AGG-01: partiets medlemmer ses på kortet med deres brugernavne, også uden for synsradius.
    mctx.font = '600 9px system-ui, sans-serif';
    mctx.textAlign = 'center';
    for (const m of f.party) {
      mctx.fillStyle = '#3fc7c0';
      mctx.fillRect(m.x * s - 2, m.y * s - 2, 4, 4);
      mctx.fillStyle = '#9ff3ee';
      mctx.fillText(m.name.slice(0, 10), Math.min(minimap.width - 20, Math.max(20, m.x * s)), Math.max(9, m.y * s - 4));
    }
    mctx.fillStyle = '#fff';
    mctx.fillRect(f.you.x * s - 2, f.you.y * s - 2, 4, 4);
  }

  return {
    draw,
    float(x: number, y: number, text: string, color = '#fff', size = 14): void {
      floaters.push({ x, y, text, color, size, t: 0 });
      if (floaters.length > 60) floaters.shift();
    },
    puff(x: number, y: number): void {
      puffs.push({ x, y, t: 0 });
    },
    /** Feature-013: en ildkrukke, der springer. */
    blast(x: number, y: number, radius: number): void {
      puffs.push({ x, y, t: 0, color: '255,140,60', size: radius * 0.7 });
    },
    /** Feature-047: en Echo Arts område eller et partis lys. */
    ring(x: number, y: number, radius: number, color: string): void {
      rings.push({ x, y, r: radius, t: 0, color: rgb(color) });
      if (rings.length > 40) rings.shift();
    },
    /** Feature-047 Echo Chain. */
    beam(x: number, y: number, x2: number, y2: number, color: string): void {
      beams.push({ x, y, x2, y2, t: 0, color: rgb(color) });
    },
    shake(amount: number): void {
      shake = Math.max(shake, amount);
    },
    dispose(): void {
      window.removeEventListener('resize', resize);
    },
  };
}

export type Renderer = ReturnType<typeof createRenderer>;

/** '#rrggbb' som 'r,g,b' til rgba(). */
function rgb(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}
