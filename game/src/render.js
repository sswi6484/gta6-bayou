// Drawing only: the world's state and the current screen in, pixels out. A camera follows the
// player over the 3200x2400 map; the 1280x720 view scales to the window. Flat shapes and canvas
// text: map (land, water, roads, bridges, buildings, fog banks), vehicles, peds, markers, HUD
// (cash, wanted stars, objective, speed, vehicle health), minimap, and the title / pause /
// busted / wasted / complete panels. Night mode swaps the palette.
import {
  BOAT, BRIDGES, BUILDINGS, CAR, CACHES, FOG_BANKS, FONT, PALETTE, ROADS, TRIAL_GATES,
  VIEW, WATER, WORLD,
} from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_DONE = 'done';

const MINIMAP = { x: 16, y: 556, w: 208, h: 148 };

function rectsOverlap(ax, ay, aw, ah, b) {
  return ax < b.x + b.w && ax + aw > b.x && ay < b.y + b.h && ay + ah > b.y;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, weight) {
    context.font = `${weight || ''} ${size}px ${FONT}`;
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function drawMap(state, pal, cam) {
    const { x: cx, y: cy } = cam;
    // Land.
    context.fillStyle = pal.land;
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    // Dry patches (visual variety).
    context.fillStyle = pal.landDry;
    context.fillRect(240 - cx, 420 - cy, 420, 260);
    context.fillRect(2100 - cx, 1500 - cy, 520, 300);
    context.fillRect(900 - cx, 2100 - cy, 480, 220);
    // Water.
    for (const w of WATER) {
      if (!rectsOverlap(cx, cy, VIEW.width, VIEW.height, w)) continue;
      context.fillStyle = pal.water;
      context.fillRect(w.x - cx, w.y - cy, w.w, w.h);
      context.fillStyle = pal.waterDeep;
      context.fillRect(w.x + 40 - cx, w.y + 30 - cy, w.w - 80, w.h - 60);
    }
    // Roads.
    for (const r of ROADS) {
      if (!rectsOverlap(cx, cy, VIEW.width, VIEW.height, r)) continue;
      context.fillStyle = pal.road;
      context.fillRect(r.x - cx, r.y - cy, r.w, r.h);
      context.fillStyle = pal.roadLine;
      if (r.w > r.h) {
        for (let x = r.x + 20; x < r.x + r.w; x += 90) context.fillRect(x - cx, r.y + r.h / 2 - 2 - cy, 44, 4);
      } else {
        for (let y = r.y + 20; y < r.y + r.h; y += 90) context.fillRect(r.x + r.w / 2 - 2 - cx, y - cy, 4, 44);
      }
    }
    // Bridges.
    for (const b of BRIDGES) {
      if (!rectsOverlap(cx, cy, VIEW.width, VIEW.height, b)) continue;
      context.fillStyle = pal.bridge;
      context.fillRect(b.x - cx, b.y - cy, b.w, b.h);
      context.fillStyle = pal.roadLine;
      context.fillRect(b.x - cx, b.y + b.h / 2 - 2 - cy, b.w, 4);
    }
    // Buildings.
    for (const b of BUILDINGS) {
      if (!rectsOverlap(cx, cy, VIEW.width, VIEW.height, b)) continue;
      const color = b.name === 'motel' ? pal.motel : b.name === 'warehouse' ? pal.warehouse
        : b.name === 'safehouse' ? pal.safehouse : b.name === 'docks' ? pal.docks
        : b.name === 'stilt' ? pal.stilt : pal.building;
      context.fillStyle = color;
      context.fillRect(b.x - cx, b.y - cy, b.w, b.h);
      context.fillStyle = 'rgba(0,0,0,0.25)';
      context.fillRect(b.x - cx, b.y + b.h - 12 - cy, b.w, 12);
      if (b.name === 'motel' || b.name === 'warehouse' || b.name === 'safehouse') {
        text(b.name.toUpperCase(), b.x + b.w / 2 - cx, b.y + b.h / 2 + 5 - cy, 15, pal.text, 'center', 'bold');
      }
    }
    // Fog banks (haze on the map).
    for (const f of FOG_BANKS) {
      if (f.x + f.r < cx || f.x - f.r > cx + VIEW.width || f.y + f.r < cy || f.y - f.r > cy + VIEW.height) continue;
      const g = context.createRadialGradient(f.x - cx, f.y - cy, f.r * 0.2, f.x - cx, f.y - cy, f.r);
      g.addColorStop(0, pal.fogDense);
      g.addColorStop(1, 'rgba(200,210,200,0)');
      context.fillStyle = g;
      context.beginPath();
      context.arc(f.x - cx, f.y - cy, f.r, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawVehicle(v, pal, cam, isPlayer) {
    const x = v.x - cam.x; const y = v.y - cam.y;
    context.save();
    context.translate(x, y);
    context.rotate(v.angle);
    const boat = v.kind === 'boat' || v.kind === 'policeBoat';
    const w = boat ? 46 : 40; const h = boat ? 18 : 20;
    const color = v.kind === 'policeCar' || v.kind === 'policeBoat' ? pal.police
      : v.kind === 'traffic' ? pal.traffic : boat ? pal.boat : pal.car;
    context.fillStyle = color;
    if (boat) {
      context.beginPath();
      context.moveTo(w / 2, 0); context.lineTo(w / 2 - 10, -h / 2); context.lineTo(-w / 2, -h / 2);
      context.lineTo(-w / 2, h / 2); context.lineTo(w / 2 - 10, h / 2); context.closePath(); context.fill();
      context.fillStyle = 'rgba(0,0,0,0.3)';
      context.fillRect(-w / 2 + 6, -h / 2 + 3, 14, h - 6);
    } else {
      context.fillRect(-w / 2, -h / 2, w, h);
      context.fillStyle = 'rgba(0,0,0,0.35)';
      context.fillRect(-w / 2 + 5, -h / 2 + 2, 10, 5);
      context.fillRect(-w / 2 + 5, h / 2 - 7, 10, 5);
      context.fillRect(w / 2 - 14, -h / 2 + 2, 9, 5);
      context.fillRect(w / 2 - 14, h / 2 - 7, 9, 5);
    }
    if (v.kind === 'policeCar' || v.kind === 'policeBoat') {
      context.fillStyle = (Math.floor(performance.now() / 300) % 2 === 0) ? '#ff3b30' : '#3b82ff';
      context.beginPath(); context.arc(0, 0, 5, 0, Math.PI * 2); context.fill();
    }
    context.restore();
    if (isPlayer) {
      context.strokeStyle = pal.marker;
      context.lineWidth = 2;
      context.beginPath(); context.arc(x, y, 28, 0, Math.PI * 2); context.stroke();
    }
  }

  function drawEntities(state, pal, cam) {
    // Caches.
    for (const c of state.caches) {
      if (c.taken) continue;
      const x = c.x - cam.x; const y = c.y - cam.y;
      if (x < -20 || x > VIEW.width + 20 || y < -20 || y > VIEW.height + 20) continue;
      context.fillStyle = pal.cache;
      context.fillRect(x - 9, y - 9, 18, 18);
      context.fillStyle = 'rgba(0,0,0,0.4)';
      context.fillRect(x - 9, y - 3, 18, 3);
    }
    // Mission crates.
    for (const c of state.crates) {
      if (!c.active) continue;
      const x = c.x - cam.x; const y = c.y - cam.y;
      context.fillStyle = '#ffb020';
      context.fillRect(x - 11, y - 11, 22, 22);
      context.strokeStyle = pal.marker;
      context.lineWidth = 2;
      context.strokeRect(x - 11, y - 11, 22, 22);
    }
    // Time-trial gates.
    if (state.trial.active || !state.trial.done) {
      const next = state.trial.active ? state.trial.gate : 0;
      for (let i = next; i < TRIAL_GATES.length; i += 1) {
        const g = TRIAL_GATES[i];
        const x = g.x - cam.x; const y = g.y - cam.y;
        if (x < -40 || x > VIEW.width + 40 || y < -40 || y > VIEW.height + 40) continue;
        context.strokeStyle = i === next ? pal.marker : 'rgba(255,217,77,0.4)';
        context.lineWidth = i === next ? 4 : 2;
        context.beginPath(); context.arc(x, y, 34, 0, Math.PI * 2); context.stroke();
        text(String(i + 1), x, y + 6, 20, pal.marker, 'center', 'bold');
      }
    }
    // Peds.
    for (const p of state.peds) {
      const x = p.x - cam.x; const y = p.y - cam.y;
      if (x < -20 || x > VIEW.width + 20 || y < -20 || y > VIEW.height + 20) continue;
      if (p.down > 0) {
        context.fillStyle = pal.ped;
        context.beginPath(); context.arc(x, y, 10, 0, Math.PI * 2); context.fill();
        continue;
      }
      context.fillStyle = pal.ped;
      context.beginPath(); context.arc(x, y, 8, 0, Math.PI * 2); context.fill();
      context.fillStyle = 'rgba(0,0,0,0.35)';
      context.beginPath(); context.arc(x + Math.cos(p.angle) * 4, y + Math.sin(p.angle) * 4, 3, 0, Math.PI * 2); context.fill();
    }
    // Vehicles (parked first, then traffic/police, then the player's).
    for (const v of state.vehicles) {
      if (!v.active || v === state.player.vehicle) continue;
      const x = v.x - cam.x; const y = v.y - cam.y;
      if (x < -60 || x > VIEW.width + 60 || y < -60 || y > VIEW.height + 60) continue;
      drawVehicle(v, pal, cam, false);
    }
    if (state.player.vehicle) drawVehicle(state.player.vehicle, pal, cam, true);
    // Player on foot.
    if (state.player.onFoot) {
      const x = state.player.x - cam.x; const y = state.player.y - cam.y;
      context.fillStyle = pal.playerFoot;
      context.beginPath(); context.arc(x, y, 13, 0, Math.PI * 2); context.fill();
      context.fillStyle = pal.player;
      context.beginPath(); context.arc(x + Math.cos(state.player.angle) * 7, y + Math.sin(state.player.angle) * 7, 5, 0, Math.PI * 2); context.fill();
      context.strokeStyle = pal.marker;
      context.lineWidth = 2;
      context.beginPath(); context.arc(x, y, 20, 0, Math.PI * 2); context.stroke();
    }
  }

  function drawMarker(state, pal, cam, objective) {
    if (!objective.has) return;
    const x = objective.x - cam.x; const y = objective.y - cam.y;
    const onScreen = x > 30 && x < VIEW.width - 30 && y > 60 && y < VIEW.height - 30;
    const pulse = 1 + 0.12 * Math.sin(state.elapsed * 5);
    if (onScreen) {
      context.strokeStyle = pal.marker;
      context.lineWidth = 3;
      context.beginPath(); context.arc(x, y, 26 * pulse, 0, Math.PI * 2); context.stroke();
      context.fillStyle = pal.marker;
      context.beginPath(); context.arc(x, y - 34, 6, 0, Math.PI * 2); context.fill();
      context.beginPath(); context.moveTo(x - 8, y - 30); context.lineTo(x + 8, y - 30); context.lineTo(x, y - 16); context.closePath(); context.fill();
    } else {
      const cx = Math.max(40, Math.min(VIEW.width - 40, x));
      const cy = Math.max(80, Math.min(VIEW.height - 40, y));
      const a = Math.atan2(y - (VIEW.height / 2), x - (VIEW.width / 2));
      context.save();
      context.translate(cx, cy);
      context.rotate(a);
      context.fillStyle = pal.marker;
      context.beginPath(); context.moveTo(16, 0); context.lineTo(-10, -11); context.lineTo(-10, 11); context.closePath(); context.fill();
      context.restore();
    }
  }

  function drawFogOverlay(state, pal, cam) {
    const p = state.player;
    let inside = 0;
    for (const f of FOG_BANKS) {
      const d = Math.hypot(p.x - f.x, p.y - f.y);
      if (d < f.r) { inside = Math.max(inside, 1 - d / f.r); }
    }
    if (inside > 0.02) {
      context.fillStyle = `rgba(205,215,205,${(inside * 0.5).toFixed(3)})`;
      context.fillRect(0, 0, VIEW.width, VIEW.height);
    }
    if (state.night) {
      context.fillStyle = 'rgba(4,6,14,0.28)';
      context.fillRect(0, 0, VIEW.width, VIEW.height);
    }
  }

  function drawHud(state, pal, objective) {
    // Top-left: cash + mission.
    context.fillStyle = pal.panel;
    context.fillRect(12, 12, 430, 66);
    text(`$${state.cash}`, 26, 42, 28, pal.player, 'left', 'bold');
    const obj = objective.text.length > 52 ? objective.text.slice(0, 52) + '…' : objective.text;
    text(obj, 26, 66, 16, pal.text);
    // Top-right: wanted stars.
    context.fillStyle = pal.panel;
    context.fillRect(VIEW.width - 216, 12, 204, 44);
    for (let i = 0; i < 5; i += 1) {
      text('★', VIEW.width - 198 + i * 38, 44, 28, i < state.wanted ? pal.star : 'rgba(255,255,255,0.18)', 'left');
    }
    // Trial timer.
    if (state.trial.active) {
      context.fillStyle = pal.panel;
      context.fillRect(VIEW.width / 2 - 150, 12, 300, 44);
      text(`RIVER TRIAL  ${Math.ceil(state.trial.timeLeft)}s   GATE ${state.trial.gate + 1}/6`, VIEW.width / 2, 42, 20, pal.marker, 'center', 'bold');
    }
    // Bottom-right: speed + vehicle health.
    const p = state.player;
    if (p.vehicle) {
      const kmh = Math.round(Math.abs(p.vehicle.speed) * 0.36);
      context.fillStyle = pal.panel;
      context.fillRect(VIEW.width - 216, VIEW.height - 76, 204, 64);
      text(`${kmh} km/h`, VIEW.width - 26, VIEW.height - 44, 24, pal.text, 'right', 'bold');
      const hp = Math.max(0, p.vehicle.hp);
      context.fillStyle = 'rgba(255,255,255,0.2)';
      context.fillRect(VIEW.width - 200, VIEW.height - 30, 172, 10);
      context.fillStyle = hp > 50 ? pal.cache : hp > 25 ? pal.marker : pal.danger;
      context.fillRect(VIEW.width - 200, VIEW.height - 30, 172 * (hp / 100), 10);
      text(p.vehicle.kind === 'boat' ? 'BOAT' : 'CAR', VIEW.width - 200, VIEW.height - 44, 13, pal.muted);
    } else {
      context.fillStyle = pal.panel;
      context.fillRect(VIEW.width - 216, VIEW.height - 50, 204, 38);
      text('ON FOOT — E near a car or boat', VIEW.width - 26, VIEW.height - 24, 14, pal.text, 'right');
    }
    // Toast.
    if (state.toast) {
      const w = Math.min(760, 18 + state.toast.length * 9.5);
      context.fillStyle = pal.panel;
      context.fillRect(VIEW.width / 2 - w / 2, 84, w, 40);
      text(state.toast, VIEW.width / 2, 110, 18, pal.marker, 'center', 'bold');
    }
    // Controls hint.
    text('WASD drive · E enter/exit · Space brake · P pause · M mute', 16, VIEW.height - 14, 13, pal.muted);
    drawMinimap(state, pal);
  }

  function drawMinimap(state, pal) {
    const sx = MINIMAP.w / WORLD.width; const sy = MINIMAP.h / WORLD.height;
    context.fillStyle = 'rgba(10,14,20,0.85)';
    context.fillRect(MINIMAP.x - 4, MINIMAP.y - 4, MINIMAP.w + 8, MINIMAP.h + 8);
    context.fillStyle = pal.land;
    context.fillRect(MINIMAP.x, MINIMAP.y, MINIMAP.w, MINIMAP.h);
    context.fillStyle = pal.water;
    for (const w of WATER) context.fillRect(MINIMAP.x + w.x * sx, MINIMAP.y + w.y * sy, Math.max(2, w.w * sx), Math.max(2, w.h * sy));
    context.fillStyle = pal.road;
    for (const r of ROADS) context.fillRect(MINIMAP.x + r.x * sx, MINIMAP.y + r.y * sy, Math.max(1, r.w * sx), Math.max(1, r.h * sy));
    const dot = (x, y, color, size) => {
      context.fillStyle = color;
      context.beginPath(); context.arc(MINIMAP.x + x * sx, MINIMAP.y + y * sy, size, 0, Math.PI * 2); context.fill();
    };
    dot(630, 2100, pal.motel, 3);
    for (const c of state.caches) if (!c.taken) dot(c.x, c.y, pal.cache, 2);
    for (const v of state.vehicles) {
      if (!v.active) continue;
      if (v.kind === 'policeCar' || v.kind === 'policeBoat') dot(v.x, v.y, '#5b9bff', 3);
    }
    const p = state.player;
    context.strokeStyle = '#fff';
    context.lineWidth = 2;
    context.beginPath(); context.arc(MINIMAP.x + p.x * sx, MINIMAP.y + p.y * sy, 5, 0, Math.PI * 2); context.stroke();
    dot(p.x, p.y, pal.player, 3);
    text('GATOR BEND', MINIMAP.x + 6, MINIMAP.y + 14, 10, pal.text, 'left', 'bold');
  }

  function drawPanel(title, lines, prompt, pal) {
    const width = 640;
    const height = 150 + lines.length * 32;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = pal.panel;
    context.fillRect(x, y, width, height);
    context.strokeStyle = pal.marker;
    context.lineWidth = 2;
    context.strokeRect(x, y, width, height);
    text(title, VIEW.width / 2, y + 62, 42, pal.marker, 'center', 'bold');
    for (let i = 0; i < lines.length; i += 1) text(lines[i], VIEW.width / 2, y + 112 + i * 32, 19, pal.text, 'center');
    text(prompt, VIEW.width / 2, y + height - 26, 17, pal.muted, 'center');
  }

  function draw(state, screen, best, objective) {
    const pal = state.night ? PALETTE.night : PALETTE.day;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = pal.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const cam = {
      x: Math.max(0, Math.min(WORLD.width - VIEW.width, state.player.x - VIEW.width / 2)),
      y: Math.max(0, Math.min(WORLD.height - VIEW.height, state.player.y - VIEW.height / 2)),
    };
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawMap(state, pal, cam);
    drawEntities(state, pal, cam);
    drawMarker(state, pal, cam, objective);
    drawFogOverlay(state, pal, cam);
    if (screen === SCREEN_TITLE) {
      context.fillStyle = 'rgba(6,9,14,0.55)';
      context.fillRect(0, 0, VIEW.width, VIEW.height);
      drawPanel('BAYOU', [
        'Open-world crime on the swamp river-delta.',
        'Remy "Catfish" Broussard owes Mama Odette — run her hauls,',
        'dodge the law on the levees, and escape by boat when the roads close.',
        `Cash $${state.cash}  ·  Best $${best}`,
      ], 'Press Space to play — WASD to drive, E to enter a car or boat', pal);
      text('5 story missions · 12 swamp caches · river time trial · wanted 0–5', VIEW.width / 2, VIEW.height - 120, 16, pal.muted, 'center');
    } else if (screen === SCREEN_PAUSED) {
      context.fillStyle = 'rgba(6,9,14,0.55)';
      context.fillRect(0, 0, VIEW.width, VIEW.height);
      drawPanel('PAUSED', ['The bayou waits.'], 'Press P or Space to keep playing', pal);
    } else if (screen === SCREEN_BUSTED) {
      context.fillStyle = 'rgba(20,6,6,0.6)';
      context.fillRect(0, 0, VIEW.width, VIEW.height);
      drawPanel('BUSTED', ['The law caught Remy. The crew posts bail —', 'half the haul money is gone.'], 'Press Space to get back out there', pal);
    } else if (screen === SCREEN_WASTED) {
      context.fillStyle = 'rgba(20,6,6,0.6)';
      context.fillRect(0, 0, VIEW.width, VIEW.height);
      drawPanel('WASTED', ['The ride went up in smoke. Mama Odette', 'is not pleased — half the haul money is gone.'], 'Press Space to get back out there', pal);
    } else if (screen === SCREEN_DONE) {
      context.fillStyle = 'rgba(6,14,9,0.6)';
      context.fillRect(0, 0, VIEW.width, VIEW.height);
      drawPanel('THE BIG HAUL IS DONE', [
        `Remy paid Mama Odette in full. Cash $${state.cash}.`,
        'Free roam: caches and the river trial still pay.',
      ], 'Press Space to keep playing', pal);
    } else {
      drawHud(state, pal, objective);
    }
  }

  window.addEventListener('resize', resize);
  resize();
  return { draw };
}
