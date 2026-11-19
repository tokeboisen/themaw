// Tegner en Tithe på et canvas. Bevidst enkelt: felter, cirkler og farver.

import { WALL, EXIT, GATE } from '../core/dungeon.js';
import { RARITY_COLORS } from '../core/world.js';

const MONSTER_COLORS = { gnawer: '#8d7b68', spitter: '#9b6bd1', brute: '#8a3a2f', foreman: '#b0602d' };

export function createRenderer(canvas, minimap) {
  const ctx = canvas.getContext('2d');
  const mctx = minimap.getContext('2d');
  let dpr = 1;
  let W = 0;
  let H = 0;
  let tile = 40;
  const floaters = [];
  const puffs = [];
  let shake = 0;
  let minimapAge = 1;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    tile = Math.round(Math.max(28, Math.min(48, Math.min(W, H) / 11)));
  }
  window.addEventListener('resize', resize);
  resize();

  function wallEdges(dep) {
    if (dep.wallEdge) return dep.wallEdge;
    const { map } = dep;
    const edge = new Uint8Array(map.w * map.h);
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        if (map.tiles[y * map.w + x] !== WALL) continue;
        let near = false;
        for (let dy = -1; dy <= 1 && !near; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < map.w && ny < map.h && map.tiles[ny * map.w + nx] !== WALL) {
              near = true;
              break;
            }
          }
        }
        edge[y * map.w + x] = near ? 1 : 0;
      }
    }
    dep.wallEdge = edge;
    return edge;
  }

  function circle(x, y, r, fill, stroke, width = 2) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
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

  function bar(x, y, w, frac, color) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(x - w / 2, y, w, 4);
    ctx.fillStyle = color;
    ctx.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, frac)), 4);
  }

  function label(text, x, y, color = '#fff', size = 12) {
    ctx.font = `600 ${size}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function draw(t, dt) {
    const dep = t.depths[t.depth];
    const { map, explored } = dep;
    const p = t.player;
    const R = t.B.view.visionRadius;
    const edge = wallEdges(dep);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0b0807';
    ctx.fillRect(0, 0, W, H);

    shake = Math.max(0, shake - dt * 20);
    const camX = p.x * tile - W / 2 + (Math.random() - 0.5) * shake;
    const camY = p.y * tile - H / 2 + (Math.random() - 0.5) * shake;
    const sx = (x) => x * tile - camX;
    const sy = (y) => y * tile - camY;
    const visible = (e) => (e.x - p.x) ** 2 + (e.y - p.y) ** 2 <= (R + 0.5) ** 2;

    // Felter
    const x0 = Math.max(0, Math.floor(camX / tile));
    const x1 = Math.min(map.w - 1, Math.ceil((camX + W) / tile));
    const y0 = Math.max(0, Math.floor(camY / tile));
    const y1 = Math.min(map.h - 1, Math.ceil((camY + H) / tile));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * map.w + x;
        if (!explored[i]) continue;
        const tt = map.tiles[i];
        const px = sx(x);
        const py = sy(y);
        if (tt === WALL) {
          if (!edge[i]) continue;
          ctx.fillStyle = '#3b3029';
          ctx.fillRect(px, py, tile + 0.5, tile + 0.5);
          ctx.fillStyle = '#4b3d33';
          ctx.fillRect(px, py, tile + 0.5, 3);
        } else {
          ctx.fillStyle = (x + y) % 2 ? '#251e18' : '#221b16';
          ctx.fillRect(px, py, tile + 0.5, tile + 0.5);
          if (tt === EXIT) {
            ctx.fillStyle = '#c87a2e';
            ctx.fillRect(px + 4, py + 4, tile - 8, tile - 8);
            ctx.fillStyle = '#5a3412';
            for (let s = 1; s <= 3; s++) ctx.fillRect(px + 6, py + 4 + (s * (tile - 8)) / 4 - 2, tile - 12, 3);
          } else if (tt === GATE) {
            ctx.fillStyle = map.gateOpen ? '#ffd84a' : '#6b5a1e';
            ctx.fillRect(px + 2, py + 2, tile - 4, tile - 4);
            if (!map.gateOpen) {
              ctx.fillStyle = '#2a220c';
              for (let s = 1; s <= 3; s++) ctx.fillRect(px + (s * tile) / 4 - 2, py + 2, 4, tile - 4);
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

    // Caches og loot
    for (const c of dep.caches) {
      const i = Math.floor(c.y) * map.w + Math.floor(c.x);
      if (!explored[i]) continue;
      ctx.fillStyle = c.opened ? '#3a2c1e' : '#7a5530';
      ctx.fillRect(sx(c.x) - tile * 0.3, sy(c.y) - tile * 0.22, tile * 0.6, tile * 0.44);
      if (!c.opened) {
        ctx.fillStyle = '#ffd84a';
        ctx.fillRect(sx(c.x) - tile * 0.3, sy(c.y) - 2, tile * 0.6, 4);
      }
    }
    for (const l of dep.loot) {
      if (!visible(l)) continue;
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
        ctx.fillStyle = RARITY_COLORS[l.item.rarity];
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // Monstre
    for (const m of dep.monsters) {
      if (m.dead || !visible(m)) continue;
      const x = sx(m.x);
      const y = sy(m.y);
      const r = m.r * tile;
      if (m.windup > 0) {
        if (m.def.warden) circle(x, y, m.def.reach * tile, 'rgba(255,60,40,0.18)', 'rgba(255,60,40,0.6)', 2);
        else if (m.def.ranged && m.aim) {
          ctx.strokeStyle = 'rgba(200,120,255,0.6)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(sx(m.aim.x), sy(m.aim.y));
          ctx.stroke();
        } else circle(x, y, (m.def.reach + 0.2) * tile, 'rgba(255,60,40,0.15)', null);
      }
      circle(x, y, r, m.flash > 0 ? '#fff' : MONSTER_COLORS[m.type] || '#888', '#000', 1.5);
      if (m.type === 'spitter') circle(x, y, r * 0.4, '#d9b8ff', null);
      if (m.def.warden) {
        ctx.fillStyle = '#ffd84a';
        ctx.beginPath();
        ctx.moveTo(x - r * 0.6, y - r * 0.7);
        ctx.lineTo(x - r * 0.3, y - r * 1.15);
        ctx.lineTo(x, y - r * 0.75);
        ctx.lineTo(x + r * 0.3, y - r * 1.15);
        ctx.lineTo(x + r * 0.6, y - r * 0.7);
        ctx.closePath();
        ctx.fill();
        label(m.name, x, y - r - 14, '#ffd84a', 13);
        bar(x, y - r - 10, tile * 2, m.hp / m.maxHp, '#c8423a');
      } else if (m.hp < m.maxHp) {
        bar(x, y - r - 7, tile * 0.7, m.hp / m.maxHp, '#c8423a');
      }
    }

    // Rivaler
    for (const rv of t.rivals) {
      if (!rv.real || rv.status !== 'in' || !visible(rv)) continue;
      const x = sx(rv.x);
      const y = sy(rv.y);
      const r = rv.r * tile;
      if (rv.windup > 0) circle(x, y, (rv.weapon.reach + 0.3) * tile, 'rgba(255,60,40,0.15)', null);
      circle(x, y, r, rv.flash > 0 ? '#fff' : rv.color, rv.aggressive ? '#ff4a3a' : '#000', rv.aggressive ? 2.5 : 1.5);
      label(rv.name, x, y - r - 10, rv.color, 12);
      bar(x, y - r - 7, tile * 0.8, rv.hp / rv.maxHp, '#c8423a');
    }

    // Spilleren
    const px = sx(p.x);
    const py = sy(p.y);
    const pr = p.r * tile;
    if (p.swing > 0) {
      const a = Math.atan2(p.swingDir.y, p.swingDir.x);
      const half = ((p.swingArc / 2) * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.arc(px, py, (p.swingReach + 0.3) * tile, a - half, a + half);
      ctx.closePath();
      ctx.fillStyle = `rgba(255,255,255,${0.25 * (p.swing / 0.15)})`;
      ctx.fill();
    }
    if (p.dodgeT > 0) circle(px - p.dodgeDir.x * tile * 0.5, py - p.dodgeDir.y * tile * 0.5, pr, 'rgba(120,180,255,0.3)', null);
    circle(px, py, pr, p.flash > 0 ? '#fff' : '#4fa3ff', '#e8f2ff', 2);
    ctx.strokeStyle = '#e8f2ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(px + p.facing.x * pr * 0.5, py + p.facing.y * pr * 0.5);
    ctx.lineTo(px + p.facing.x * pr * 1.4, py + p.facing.y * pr * 1.4);
    ctx.stroke();

    // Projektiler
    for (const pj of dep.projectiles) {
      const x = sx(pj.x);
      const y = sy(pj.y);
      if (pj.kind === 'arrow') {
        ctx.strokeStyle = '#e6d3a8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - pj.vx * tile * 0.35, y - pj.vy * tile * 0.35);
        ctx.lineTo(x, y);
        ctx.stroke();
      } else if (pj.kind === 'bolt') {
        circle(x, y, tile * 0.13, '#8fc1ff', '#fff', 1);
      } else {
        circle(x, y, tile * 0.11, '#b67be8', null);
      }
    }

    // Røg, når noget dør
    for (const f of puffs) {
      f.t += dt;
      circle(sx(f.x), sy(f.y), tile * (0.3 + f.t), `rgba(180,140,220,${Math.max(0, 0.4 - f.t * 0.8)})`, null);
    }
    for (let i = puffs.length - 1; i >= 0; i--) if (puffs[i].t > 0.5) puffs.splice(i, 1);

    // Tal og tekster, der stiger op
    for (const f of floaters) {
      f.t += dt;
      const alpha = Math.max(0, 1 - f.t / 1.1);
      ctx.globalAlpha = alpha;
      label(f.text, sx(f.x), sy(f.y) - f.t * tile * 0.9, f.color, f.size);
      ctx.globalAlpha = 1;
    }
    for (let i = floaters.length - 1; i >= 0; i--) if (floaters[i].t > 1.1) floaters.splice(i, 1);

    // Vignetter: forseglet dybde, lavt liv, sult
    const seal = dep.sealAt != null && t.time >= dep.sealAt;
    const low = p.hp < t.stats.maxHp * 0.3;
    if (seal || low || p.hunger <= 0) {
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
      const color = seal ? '120,20,10' : low ? '140,0,0' : '90,60,20';
      g.addColorStop(0, `rgba(${color},0)`);
      g.addColorStop(1, `rgba(${color},${seal ? 0.55 : 0.4})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    if (seal && Math.random() < 0.3) shake = Math.max(shake, 2);

    minimapAge += dt;
    if (minimapAge > 0.2) {
      minimapAge = 0;
      drawMinimap(t);
    }
  }

  function drawMinimap(t) {
    const dep = t.depths[t.depth];
    const { map, explored } = dep;
    const s = minimap.width / map.w;
    mctx.clearRect(0, 0, minimap.width, minimap.height);
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        const i = y * map.w + x;
        if (!explored[i] || map.tiles[i] === WALL) continue;
        mctx.fillStyle = map.tiles[i] === EXIT ? '#ff9a3a' : map.tiles[i] === GATE ? '#ffd84a' : '#5a4e44';
        const big = map.tiles[i] === EXIT || map.tiles[i] === GATE ? 2 : 0;
        mctx.fillRect(x * s - big, y * s - big, s + big * 2, s + big * 2);
      }
    }
    for (const r of t.rivals) {
      if (!r.real || r.status !== 'in') continue;
      if (Math.hypot(r.x - t.player.x, r.y - t.player.y) > t.B.view.visionRadius) continue;
      mctx.fillStyle = r.color;
      mctx.fillRect(r.x * s - 2, r.y * s - 2, 4, 4);
    }
    mctx.fillStyle = '#fff';
    mctx.fillRect(t.player.x * s - 2, t.player.y * s - 2, 4, 4);
  }

  return {
    draw,
    float(e) {
      floaters.push({ ...e, t: 0 });
      if (floaters.length > 60) floaters.shift();
    },
    puff(x, y) {
      puffs.push({ x, y, t: 0 });
    },
    shake(amount) {
      shake = Math.max(shake, amount);
    },
    reset() {
      floaters.length = 0;
      puffs.length = 0;
      shake = 0;
      minimapAge = 1;
    },
  };
}
