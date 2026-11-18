// The renderer: one canvas, one camera, everything drawn in code. It paints the
// swamp town (water, levee roads, stilt houses, cypress groves), the fog that
// rolls over it, the night that falls, the HUD with its minimap, and the screens
// (title, paused, busted, wasted, all done).

import {
  WORLD, WATER, ROADS, BRIDGES, BUILDINGS, TREES, CHECKPOINT,
  PALETTE, FONT, FOG_BANKS, WANTED_MAX,
} from './config.js';
import { objectiveText, currentTarget } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_DONE = 'done';

const VIEW_HEIGHT = 900;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let width = 1280;
  let height = 720;
  let scale = 1;
  let camX = WORLD.width / 2;
  let camY = WORLD.height / 2;
  let titlePan = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.clientWidth || window.innerWidth;
    height = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scale = height / VIEW_HEIGHT;
  }
  window.addEventListener('resize', resize);
  resize();

  function worldToScreen(x, y) {
    return { x: (x - camX) * scale + width / 2, y: (y - camY) * scale + height / 2 };
  }

  function drawWater() {
    ctx.fillStyle = PALETTE.waterDeep;
    ctx.fillRect(0, 0, width, height);
    // Water is drawn in world space; the camera transform is applied by the caller.
    for (const w of WATER) {
      ctx.fillStyle = PALETTE.water;
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = PALETTE.waterShallow;
      ctx.fillRect(w.x, w.y, w.w, 10);
      ctx.fillRect(w.x, w.y + w.h - 10, w.w, 10);
      // Current lines.
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 3;
      for (let i = 1; i < 6; i += 1) {
        const yy = w.y + (w.h * i) / 6;
        ctx.beginPath();
        ctx.moveTo(w.x + 20, yy);
        ctx.lineTo(w.x + w.w - 20, yy);
        ctx.stroke();
      }
    }
  }

  function drawLand() {
    // Base land.
    ctx.fillStyle = PALETTE.land;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    // Swamp patches.
    ctx.fillStyle = PALETTE.swamp;
    ctx.beginPath();
    ctx.ellipse(700, 450, 650, 320, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(800, 2120, 700, 220, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(2600, 1700, 500, 300, 0, 0, Math.PI * 2);
    ctx.fill();
    // Roads.
    for (const r of ROADS) {
      ctx.fillStyle = r.name.includes('Levee') ? PALETTE.levee : PALETTE.road;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = PALETTE.roadLine;
      if (r.w > r.h) {
        for (let x = r.x + 20; x < r.x + r.w - 10; x += 70) ctx.fillRect(x, r.y + r.h / 2 - 2, 34, 4);
      } else {
        for (let y = r.y + 20; y < r.y + r.h - 10; y += 70) ctx.fillRect(r.x + r.w / 2 - 2, y, 4, 34);
      }
    }
    // Bridges: road decks over the river and the bayou channels.
    for (const b of BRIDGES) {
      ctx.fillStyle = PALETTE.bridge;
      ctx.fillRect(b.x - 10, b.y, b.w + 20, b.h);
      ctx.strokeStyle = '#3a332a';
      ctx.lineWidth = 4;
      ctx.strokeRect(b.x - 10, b.y, b.w + 20, b.h);
    }
    // Sheriff checkpoint on the Main Street bridge.
    ctx.fillStyle = 'rgba(229, 83, 75, 0.25)';
    ctx.fillRect(CHECKPOINT.x, CHECKPOINT.y, CHECKPOINT.w, CHECKPOINT.h);
    ctx.strokeStyle = PALETTE.danger;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.strokeRect(CHECKPOINT.x, CHECKPOINT.y, CHECKPOINT.w, CHECKPOINT.h);
    ctx.setLineDash([]);
    // Buildings.
    for (const b of BUILDINGS) {
      ctx.fillStyle = PALETTE.building;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = PALETTE.buildingRoof;
      ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
      ctx.strokeStyle = '#3a2c1e';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      if (b.kind === 'stilt') {
        ctx.strokeStyle = '#4a3826';
        ctx.lineWidth = 4;
        for (const sx of [b.x + 12, b.x + b.w - 12]) {
          ctx.beginPath();
          ctx.moveTo(sx, b.y + b.h);
          ctx.lineTo(sx, b.y + b.h + 26);
          ctx.stroke();
        }
      }
    }
    // Trees.
    for (const t of TREES) {
      ctx.fillStyle = PALETTE.treeDark;
      ctx.beginPath();
      ctx.arc(t.x, t.y + 6, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.tree;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath();
      ctx.arc(t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
    // Docks: wooden piers into the river.
    ctx.fillStyle = '#6b4a35';
    for (const [px, py] of [[1480, 1840], [1560, 1940], [1900, 1800]]) {
      ctx.fillRect(px, py, 90, 22);
    }
  }

  function drawCaches(state) {
    for (const c of state.caches) {
      if (c.taken) continue;
      const pulse = 0.6 + 0.4 * Math.sin(state.time * 3 + c.x);
      ctx.fillStyle = `rgba(242, 201, 76, ${pulse})`;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3a2c1e';
      ctx.font = `bold 14px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', c.x, c.y + 1);
    }
    if (state.missionIndex === 1 && state.missionData.stash) {
      for (const s of state.missionData.stash) {
        if (s.taken) continue;
        const pulse = 0.6 + 0.4 * Math.sin(state.time * 4 + s.x);
        ctx.fillStyle = `rgba(88, 179, 104, ${pulse})`;
        ctx.fillRect(s.x - 12, s.y - 10, 24, 20);
        ctx.strokeStyle = '#1e3319';
        ctx.lineWidth = 2;
        ctx.strokeRect(s.x - 12, s.y - 10, 24, 20);
      }
    }
    // Time-trial gates.
    if (state.trial.active || state.missionIndex < 5) {
      state.trialGates.forEach((g, i) => {
        const passed = state.trial.active && i < state.trial.gate;
        const next = state.trial.active && i === state.trial.gate;
        ctx.strokeStyle = passed ? PALETTE.ok : next ? PALETTE.gold : 'rgba(238,241,245,0.5)';
        ctx.lineWidth = next ? 6 : 3;
        ctx.beginPath();
        ctx.arc(g.x, g.y, 46, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.font = `bold 20px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), g.x, g.y);
      });
    }
  }

  function drawVehicle(v) {
    ctx.save();
    ctx.translate(v.x, v.y);
    ctx.rotate(v.angle);
    const len = v.length;
    const wid = v.width;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-len / 2 + 3, -wid / 2 + 4, len, wid);
    ctx.fillStyle = v.color;
    if (v.kind === 'boat') {
      ctx.beginPath();
      ctx.moveTo(len / 2, 0);
      ctx.lineTo(len / 2 - 12, -wid / 2);
      ctx.lineTo(-len / 2, -wid / 2);
      ctx.lineTo(-len / 2, wid / 2);
      ctx.lineTo(len / 2 - 12, wid / 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(-len / 2 + 8, -wid / 2 + 5, len / 3, wid - 10);
    } else {
      ctx.beginPath();
      ctx.roundRect(-len / 2, -wid / 2, len, wid, 8);
      ctx.fill();
      ctx.fillStyle = 'rgba(20,30,40,0.75)';
      ctx.fillRect(-len / 6, -wid / 2 + 4, len / 3, wid - 8);
    }
    ctx.fillStyle = '#f2e9d8';
    ctx.fillRect(len / 2 - 6, -wid / 2 + 3, 4, 6);
    ctx.fillRect(len / 2 - 6, wid / 2 - 9, 4, 6);
    if (v.police) {
      ctx.fillStyle = '#eef1f5';
      ctx.fillRect(-len / 2 + 4, -wid / 2 + 2, len / 2 - 8, wid - 4);
      ctx.fillStyle = '#e5534b';
      ctx.beginPath();
      ctx.arc(0, -wid / 2 + 2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3a6fd8';
      ctx.beginPath();
      ctx.arc(0, wid / 2 - 2, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (v.damage > 40) {
      ctx.fillStyle = 'rgba(30,30,30,0.6)';
      ctx.beginPath();
      ctx.arc(-len / 4, 0, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPlayer(state) {
    const p = state.player;
    if (p.vehicle) return; // the vehicle is drawn; the driver sits inside it
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.arc(2, 3, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2c4a26';
    ctx.beginPath();
    ctx.arc(5, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (state.carrying) {
      ctx.fillStyle = '#8a6a4a';
      ctx.fillRect(p.x - 8, p.y - 22, 16, 12);
      ctx.strokeStyle = '#3a2c1e';
      ctx.strokeRect(p.x - 8, p.y - 22, 16, 12);
    }
  }

  function drawPeds(state) {
    for (const ped of state.peds) {
      ctx.save();
      ctx.translate(ped.x, ped.y);
      ctx.fillStyle = ped.panic > 0 ? '#e5534b' : PALETTE.ped;
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2c3a4a';
      ctx.beginPath();
      ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawObjectiveMarker(state) {
    const target = currentTarget(state);
    if (!target) return;
    const pulse = 0.6 + 0.4 * Math.sin(state.time * 4);
    ctx.save();
    ctx.strokeStyle = `rgba(242, 201, 76, ${pulse})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 34 + 6 * Math.sin(state.time * 4), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath();
    ctx.moveTo(target.x, target.y - 52);
    ctx.lineTo(target.x - 10, target.y - 72);
    ctx.lineTo(target.x + 10, target.y - 72);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** Where the HUD arrow and the minimap point right now — shared with missions. */

  function drawFog(state) {
    // Drifting fog banks, drawn in world space.
    ctx.fillStyle = PALETTE.fog;
    for (const f of FOG_BANKS) {
      const ox = Math.sin(state.time * 0.02 + f.x) * 40;
      const oy = Math.cos(state.time * 0.015 + f.y) * 30;
      ctx.beginPath();
      ctx.ellipse(f.x + ox, f.y + oy, f.r, f.r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Night darkness, drawn in screen space with a lit circle around the player. */
  function drawNight(state) {
    const night = nightFactor(state);
    if (night <= 0) return;
    ctx.save();
    ctx.setTransform(ctx.getTransform().a, 0, 0, ctx.getTransform().d, 0, 0);
    const p = worldToScreen(state.player.x, state.player.y);
    const radius = 380 * scale * (state.player.vehicle ? 1.5 : 1);
    const grad = ctx.createRadialGradient(p.x, p.y, radius * 0.25, p.x, p.y, radius);
    grad.addColorStop(0, 'rgba(6, 10, 26, 0)');
    grad.addColorStop(0.55, `rgba(6, 10, 26, ${0.25 * night})`);
    grad.addColorStop(1, `rgba(6, 10, 26, ${0.62 * night})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  /** 0 in daylight, 1 in the deep night. The day cycles slowly as the game runs. */
  function nightFactor(state) {
    const t = (state.dayTime + state.time / 900) % 1;
    if (t < 0.55) return 0;
    if (t < 0.7) return (t - 0.55) / 0.15;
    if (t < 0.9) return 1;
    return 1 - (t - 0.9) / 0.1;
  }

  function drawHud(state, opts) {
    const p = state.player;
    ctx.save();
    ctx.setTransform(ctx.getTransform().a, 0, 0, ctx.getTransform().d, 0, 0);
    // Top-left panel: cash, wanted, mission.
    ctx.fillStyle = 'rgba(16, 24, 32, 0.82)';
    ctx.beginPath();
    ctx.roundRect(12, 12, 430, 96, 10);
    ctx.fill();
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `bold 26px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`$${state.cash}`, 26, 22);
    // Wanted stars.
    for (let i = 0; i < WANTED_MAX; i += 1) {
      ctx.fillStyle = i < state.wanted ? PALETTE.danger : 'rgba(238,241,245,0.25)';
      ctx.font = '22px sans-serif';
      ctx.fillText('★', 130 + i * 26, 24);
    }
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `15px ${FONT}`;
    ctx.fillText(objectiveText(state), 26, 58, 400);
    const veh = p.vehicle;
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.font = `13px ${FONT}`;
    const vehText = veh ? `${veh.name}  •  fuel ${Math.round(veh.fuel)}%  •  damage ${Math.round(veh.damage)}%` : 'On foot — E to enter a car or boat';
    ctx.fillText(vehText, 26, 82);
    // Trial timer.
    if (state.trial.active) {
      ctx.fillStyle = PALETTE.gold;
      ctx.font = `bold 22px ${FONT}`;
      ctx.fillText(`TIME TRIAL  ${Math.ceil(state.trial.timeLeft)}s  •  gate ${state.trial.gate + 1}/6`, width / 2 - 140, 20);
    }
    // Message line.
    if (state.messageTimer > 0 && state.message) {
      ctx.fillStyle = 'rgba(16, 24, 32, 0.82)';
      const w = Math.min(720, 40 + state.message.length * 8);
      ctx.beginPath();
      ctx.roundRect((width - w) / 2, height - 64, w, 40, 8);
      ctx.fill();
      ctx.fillStyle = PALETTE.hudText;
      ctx.font = `16px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(state.message, width / 2, height - 52);
      ctx.textAlign = 'left';
    }
    // Controls hint.
    ctx.fillStyle = 'rgba(238,241,245,0.55)';
    ctx.font = `12px ${FONT}`;
    ctx.fillText('WASD drive / walk • E enter & exit • F refuel • Space handbrake • P pause • M mute', 14, height - 14);
    if (opts.muted) ctx.fillText('MUTED', width - 70, height - 14);
    drawMinimap(state);
    ctx.restore();
  }

  function drawMinimap(state) {
    const mw = 230;
    const mh = 172;
    const mx = width - mw - 14;
    const my = 14;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    ctx.fillStyle = 'rgba(16, 24, 32, 0.85)';
    ctx.beginPath();
    ctx.roundRect(mx - 6, my - 6, mw + 12, mh + 12, 8);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.rect(mx, my, mw, mh);
    ctx.clip();
    ctx.fillStyle = PALETTE.land;
    ctx.fillRect(mx, my, mw, mh);
    for (const w of WATER) {
      ctx.fillStyle = PALETTE.water;
      ctx.fillRect(mx + w.x * sx, my + w.y * sy, w.w * sx, w.h * sy);
    }
    ctx.fillStyle = PALETTE.road;
    for (const r of ROADS) ctx.fillRect(mx + r.x * sx, my + r.y * sy, Math.max(2, r.w * sx), Math.max(2, r.h * sy));
    const target = currentTarget(state);
    if (target) {
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.arc(mx + target.x * sx, my + target.y * sy, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const cop of state.police) {
      ctx.fillStyle = '#6f9be8';
      ctx.beginPath();
      ctx.arc(mx + cop.x * sx, my + cop.y * sy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    const p = state.player;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(mx + p.x * sx, my + p.y * sy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(mx + p.x * sx, my + p.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.font = `11px ${FONT}`;
    ctx.fillText('GATOR BEND', mx, my + mh + 18);
  }

  function panel(title, lines, accent) {
    ctx.save();
    ctx.setTransform(ctx.getTransform().a, 0, 0, ctx.getTransform().d, 0, 0);
    const w = 640;
    const h = 120 + lines.length * 30;
    const x = (width - w) / 2;
    const y = (height - h) / 2;
    ctx.fillStyle = 'rgba(10, 16, 22, 0.92)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.font = `bold 34px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(title, width / 2, y + 52);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `17px ${FONT}`;
    lines.forEach((line, i) => ctx.fillText(line, width / 2, y + 96 + i * 30));
    ctx.restore();
  }

  function drawTitle(state, opts) {
    titlePan += 0.0004;
    camX = WORLD.width / 2 + Math.sin(titlePan) * 500;
    camY = WORLD.height / 2 + Math.cos(titlePan * 0.7) * 300;
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(scale, scale);
    ctx.translate(-camX, -camY);
    drawWater();
    drawLand();
    ctx.restore();
    ctx.save();
    ctx.setTransform(ctx.getTransform().a, 0, 0, ctx.getTransform().d, 0, 0);
    ctx.fillStyle = 'rgba(8, 14, 20, 0.55)';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `bold 84px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('BAYOU', width / 2, height / 2 - 110);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `26px ${FONT}`;
    ctx.fillText('An open-world crime game on the water’s edge', width / 2, height / 2 - 62);
    ctx.font = `17px ${FONT}`;
    ctx.fillStyle = 'rgba(238,241,245,0.85)';
    ctx.fillText('Remy “Catfish” Broussard owes Mama Odette. The river is the only way out.', width / 2, height / 2 - 22);
    ctx.fillText('Five missions • boats and cars • the law on the levee roads • fog on the swamp', width / 2, height / 2 + 8);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `bold 22px ${FONT}`;
    ctx.fillText('Press Space or click to start', width / 2, height / 2 + 62);
    ctx.fillStyle = 'rgba(238,241,245,0.6)';
    ctx.font = `14px ${FONT}`;
    ctx.fillText('WASD drive / walk • E enter & exit • F refuel • P pause • M mute', width / 2, height / 2 + 96);
    if (opts.best > 0) ctx.fillText(`Best haul: $${opts.best}`, width / 2, height / 2 + 122);
    ctx.restore();
  }

  function draw(state, screen, opts) {
    const p = state.player;
    if (screen !== SCREEN_TITLE) {
      camX = clamp(p.x, (width / 2) / scale, WORLD.width - (width / 2) / scale);
      camY = clamp(p.y, (height / 2) / scale, WORLD.height - (height / 2) / scale);
    }
    ctx.clearRect(0, 0, width, height);
    if (screen === SCREEN_TITLE) {
      drawTitle(state, opts);
      return;
    }
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(scale, scale);
    ctx.translate(-camX, -camY);
    drawWater();
    drawLand();
    drawCaches(state);
    for (const v of state.vehicles) {
      if (v.damage < 100) drawVehicle(v);
    }
    for (const cop of state.police) drawVehicle(cop);
    drawPeds(state);
    drawPlayer(state);
    drawObjectiveMarker(state);
    drawFog(state);
    ctx.restore();
    drawNight(state);
    drawHud(state, opts);
    if (screen === SCREEN_PAUSED) {
      panel('PAUSED', ['Press P or Space to keep playing.', `Cash $${state.cash} • Missions done ${state.stats.missionsDone}/5`], PALETTE.hudText);
    } else if (screen === SCREEN_BUSTED) {
      panel('BUSTED', ['The sheriff takes you in. Mama Odette bails you out — minus $50.', 'Press Space to get back on the river.'], PALETTE.danger);
    } else if (screen === SCREEN_WASTED) {
      panel('WASTED', ['You went down in the swamp. The motel clinic patches you up — minus $50.', 'Press Space to get back on the river.'], PALETTE.danger);
    } else if (screen === SCREEN_DONE) {
      panel('THE BAYOU IS YOURS', [`All five missions done. Final haul: $${state.cash}.`, `Busted ${state.stats.busted} • Wasted ${state.stats.wasted} • Caches ${state.stats.caches}/12`, 'Press Space to keep playing the open world.'], PALETTE.gold);
    }
  }

  return { draw, resize };
}
