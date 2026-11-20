// Tegner en Tithe på et canvas ud fra serverens snapshots (Feature-010 VIEW-01, -011 VIEW-01, -006 VIEW-01, -015 VIEW-01).
// Overført fra prototype/js/client/render.js. Bevidst enkelt: felter, cirkler og farver.

import type { SnapshotEntity, YouView } from '@maw/contracts';
import { EXIT, GATE, INDOOR, RARITY_COLORS, ROAD, RUBBLE, STAIRS, WALL, type Rarity } from '@maw/rules';

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
  loot: { x: number; y: number; kind: string; rarity?: string }[];
  caches: { x: number; y: number; opened: boolean }[];
  gate: { x: number; y: number; open: boolean } | null;
  sealed: boolean;
  radius: number;
  /** Partiets andre medlemmer på samme dybde, til minikortet (Feature-034 AGG-01). */
  party: { name: string; x: number; y: number }[];
}

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
  const puffs: { x: number; y: number; t: number }[] = [];
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

    // Felter: det, der ikke er set, er sort; det uden for synsradius er mørkt.
    const x0 = Math.max(0, Math.floor(camX / tile));
    const x1 = Math.min(f.mapW - 1, Math.ceil((camX + W) / tile));
    const y0 = Math.max(0, Math.floor(camY / tile));
    const y1 = Math.min(f.mapH - 1, Math.ceil((camY + H) / tile));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * f.mapW + x;
        const tt = f.tiles[i];
        if (tt === UNKNOWN || tt === undefined) continue;
        const px = sx(x);
        const py = sy(y);
        if (tt === WALL) {
          if (!edge[i]) continue;
          ctx.fillStyle = '#3b3029';
          ctx.fillRect(px, py, tile + 0.5, tile + 0.5);
          ctx.fillStyle = '#4b3d33';
          ctx.fillRect(px, py, tile + 0.5, 3);
        } else if (tt === RUBBLE) {
          // The Broken City: murbrokker – lave, spærrer vejen.
          ctx.fillStyle = (x + y) % 2 ? '#2b2620' : '#29241f';
          ctx.fillRect(px, py, tile + 0.5, tile + 0.5);
          ctx.fillStyle = '#5b5046';
          ctx.fillRect(px + tile * 0.15, py + tile * 0.35, tile * 0.4, tile * 0.35);
          ctx.fillStyle = '#4a4038';
          ctx.fillRect(px + tile * 0.5, py + tile * 0.2, tile * 0.32, tile * 0.3);
        } else {
          ctx.fillStyle = tt === ROAD ? ((x + y) % 2 ? '#2b2620' : '#29241f') : tt === INDOOR || tt === STAIRS ? ((x + y) % 2 ? '#33271c' : '#30251b') : (x + y) % 2 ? '#251e18' : '#221b16';
          ctx.fillRect(px, py, tile + 0.5, tile + 0.5);
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
        const dx = x + 0.5 - p.x;
        const dy = y + 0.5 - p.y;
        if (dx * dx + dy * dy > R * R) {
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.fillRect(px, py, tile + 0.5, tile + 0.5);
        }
      }
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

    // Monstre, rivaler og andre spillere. Et angreb på vej viser rækkevidden i rødt (Feature-011 VIEW-01).
    for (const e of f.ents) {
      const x = sx(e.x);
      const y = sy(e.y);
      const r = e.r * tile;
      if (e.windup) {
        if (e.windup.aimX !== undefined && e.windup.aimY !== undefined) {
          ctx.strokeStyle = 'rgba(200,120,255,0.6)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(sx(e.windup.aimX), sy(e.windup.aimY));
          ctx.stroke();
        } else if (e.warden) circle(x, y, (e.windup.reach ?? 1) * tile, 'rgba(255,60,40,0.18)', 'rgba(255,60,40,0.6)', 2);
        else circle(x, y, (e.windup.reach ?? 1) * tile, 'rgba(255,60,40,0.15)', null);
      }
      if (e.kind === 'monster') {
        circle(x, y, r, e.flash ? '#fff' : MONSTER_COLORS[e.type ?? ''] ?? '#888', '#000', 1.5);
        if (e.type === 'spitter') circle(x, y, r * 0.4, '#d9b8ff', null);
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
          label(e.name, x, y - r - 14, '#ffd84a', 13);
          bar(x, y - r - 10, tile * 2, e.hp / e.maxHp, '#c8423a');
        } else if (e.hp < e.maxHp) bar(x, y - r - 7, tile * 0.7, e.hp / e.maxHp, '#c8423a');
      } else if (e.kind === 'rival') {
        circle(x, y, r, e.flash ? '#fff' : e.color ?? '#ccc', e.hostile ? '#ff4a3a' : '#000', e.hostile ? 2.5 : 1.5);
        label(e.name, x, y - r - 10, e.color ?? '#ccc', 12);
        bar(x, y - r - 7, tile * 0.8, e.hp / e.maxHp, '#c8423a');
      } else {
        // Feature-010 VIEW-01: andre spillere i syne viser deres brugernavn over hovedet; partiet i grønblåt, andre i rav.
        circle(x, y, r, e.flash ? '#fff' : e.party ? '#3fc7c0' : '#e0905a', e.party ? '#e8fffd' : '#ff4a3a', 2);
        label(e.name, x, y - r - 10, e.party ? '#9ff3ee' : '#ffc29a', 12);
        bar(x, y - r - 7, tile * 0.8, e.hp / e.maxHp, '#c8423a');
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
    circle(px, py, pr, p.flash ? '#fff' : '#4fa3ff', '#e8f2ff', 2);
    ctx.strokeStyle = '#e8f2ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(px + p.facing[0] * pr * 0.5, py + p.facing[1] * pr * 0.5);
    ctx.lineTo(px + p.facing[0] * pr * 1.4, py + p.facing[1] * pr * 1.4);
    ctx.stroke();

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
      else circle(x, y, tile * 0.11, '#b67be8', null);
    }

    for (const fl of puffs) {
      fl.t += dt;
      circle(sx(fl.x), sy(fl.y), tile * (0.3 + fl.t), `rgba(180,140,220,${Math.max(0, 0.4 - fl.t * 0.8)})`, null);
    }
    for (let i = puffs.length - 1; i >= 0; i--) if (puffs[i]!.t > 0.5) puffs.splice(i, 1);

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
        mctx.fillStyle = v === EXIT || v === STAIRS ? '#ff9a3a' : v === GATE ? '#ffd84a' : v === RUBBLE ? '#3a332c' : v === INDOOR ? '#6b5640' : '#5a4e44';
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
    shake(amount: number): void {
      shake = Math.max(shake, amount);
    },
    dispose(): void {
      window.removeEventListener('resize', resize);
    },
  };
}

export type Renderer = ReturnType<typeof createRenderer>;
