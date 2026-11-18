// Bayou's rules and state, with no drawing and no browser in it: the player on foot, in cars
// and in boats; traffic and pedestrians; police and the wanted level; five story missions, swamp
// caches and the river time trial; saving. step() advances one fixed step and returns what
// happened as bit flags, so the caller can react without the world knowing about screens or sound.
import {
  BOAT, BRIDGES, BUILDINGS, CACHES, CAR, DOCKED_BOATS, MISSIONS,
  PARKED_CARS, PED_COUNT, PLAYER, POLICE, ROADS, TRAFFIC_COUNT, TRIAL_GATES,
  TRIAL_REWARD, TRIAL_TIME, WANTED_DECAY_SECONDS, WATER, WORLD,
} from './config.js';

export const EVENT_CASH = 1;
export const EVENT_MISSION = 2;
export const EVENT_BUSTED = 4;
export const EVENT_WASTED = 8;
export const EVENT_PICKUP = 16;
export const EVENT_CRASH = 32;
export const EVENT_ALL_DONE = 64;

const TAU = Math.PI * 2;

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function dist(ax, ay, bx, by) { const dx = ax - bx; const dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
function wrapAngle(a) { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; }
function inRect(x, y, r) { return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h; }
function onBridge(x, y) { for (const b of BRIDGES) if (inRect(x, y, b)) return true; return false; }
function inWater(x, y) {
  for (const w of WATER) if (inRect(x, y, w)) {
    if (onBridge(x, y)) return false;
    return true;
  }
  return false;
}
function onRoad(x, y) { for (const r of ROADS) if (inRect(x, y, r)) return true; return false; }
function hitsBuilding(x, y, radius) {
  for (const b of BUILDINGS) {
    const cx = clamp(x, b.x, b.x + b.w); const cy = clamp(y, b.y, b.y + b.h);
    const dx = x - cx; const dy = y - cy;
    if (dx * dx + dy * dy < radius * radius) return true;
  }
  return false;
}

// Traffic loops around city blocks (waypoints are road intersections).
const TRAFFIC_LOOPS = [
  [{ x: 445, y: 245 }, { x: 1045, y: 245 }, { x: 1045, y: 745 }, { x: 445, y: 745 }],
  [{ x: 2245, y: 245 }, { x: 2845, y: 245 }, { x: 2845, y: 745 }, { x: 2245, y: 745 }],
  [{ x: 445, y: 1245 }, { x: 1045, y: 1245 }, { x: 1045, y: 1745 }, { x: 445, y: 1745 }],
  [{ x: 2245, y: 1245 }, { x: 2845, y: 1245 }, { x: 2845, y: 1745 }, { x: 2245, y: 1745 }],
  [{ x: 445, y: 1745 }, { x: 1045, y: 1745 }, { x: 1045, y: 2245 }, { x: 445, y: 2245 }],
  [{ x: 2245, y: 1745 }, { x: 2845, y: 1745 }, { x: 2845, y: 2245 }, { x: 2245, y: 2245 }],
];

export function createWorld(random) {
  const state = {
    elapsed: 0, cash: 0, wanted: 0, crimeTimer: 0, decayTimer: 0,
    missionIndex: 0, stepIndex: 0, stepTimer: 0, collected: 0, allDone: false,
    night: false, trial: { active: false, gate: 0, timeLeft: 0, done: false },
    toast: '', toastTimer: 0, bustTimer: 0,
    player: { x: 630, y: 1980, angle: -Math.PI / 2, speed: 0, onFoot: true, vehicle: null },
    vehicles: [], peds: [], caches: [], crates: [],
  };

  function makeVehicle(kind, x, y, angle) {
    const boat = kind === 'boat' || kind === 'policeBoat';
    return {
      kind, x, y, angle, speed: 0, hp: boat ? BOAT.hp : CAR.hp,
      active: true, parked: kind === 'car' || kind === 'boat',
      route: null, routeIndex: 0, ramTimer: 0, color: '',
    };
  }

  function reset() {
    state.elapsed = 0; state.cash = 0; state.wanted = 0; state.crimeTimer = 0; state.decayTimer = 0;
    state.missionIndex = 0; state.stepIndex = 0; state.stepTimer = 0; state.collected = 0;
    state.allDone = false; state.night = false; state.bustTimer = 0;
    state.trial = { active: false, gate: 0, timeLeft: 0, done: false };
    state.toast = ''; state.toastTimer = 0;
    state.player = { x: 630, y: 1980, angle: -Math.PI / 2, speed: 0, onFoot: true, vehicle: null };
    state.vehicles = [];
    for (const c of PARKED_CARS) state.vehicles.push(makeVehicle('car', c.x, c.y, c.a));
    for (const b of DOCKED_BOATS) state.vehicles.push(makeVehicle('boat', b.x, b.y, b.a));
    for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
      const loop = TRAFFIC_LOOPS[i % TRAFFIC_LOOPS.length];
      const wp = loop[i % loop.length];
      const v = makeVehicle('traffic', wp.x, wp.y, 0);
      v.parked = false; v.route = loop; v.routeIndex = (i + 1) % loop.length; v.speed = 150 + random() * 60;
      state.vehicles.push(v);
    }
    state.peds = [];
    for (let i = 0; i < PED_COUNT; i += 1) {
      state.peds.push({
        x: 200 + random() * 2800, y: 200 + random() * 2000, tx: 0, ty: 0,
        wait: random() * 2, down: 0, angle: random() * TAU, speed: 55 + random() * 25,
      });
      const p = state.peds[i];
      if (inWater(p.x, p.y) || hitsBuilding(p.x, p.y, 20)) { p.x = 500; p.y = 250; }
      p.tx = p.x; p.ty = p.y;
    }
    state.caches = CACHES.map((c) => ({ x: c.x, y: c.y, taken: false }));
    state.crates = [];
    startStep();
  }

  function currentMission() { return state.missionIndex < MISSIONS.length ? MISSIONS[state.missionIndex] : null; }
  function currentStep() {
    const m = currentMission();
    return m ? m.steps[state.stepIndex] : null;
  }
  function objective() {
    const m = currentMission();
    if (!m) return { text: 'All missions done — free roam. Caches and the river trial still pay.', x: 0, y: 0, has: false };
    const s = currentStep();
    if (s.type === 'goto') return { text: `${m.name}: ${s.text}`, x: s.x, y: s.y, has: true };
    if (s.type === 'collect') return { text: `${m.name}: ${s.text} (${state.collected}/${s.count})`, x: s.area.x, y: s.area.y, has: true };
    if (s.type === 'evade') return { text: `${m.name}: ${s.text} — ${Math.ceil(state.stepTimer)}s`, x: state.player.x, y: state.player.y, has: false };
    return { text: `${m.name}: ${s.text}`, x: state.player.x, y: state.player.y, has: false };
  }

  function say(text, seconds) { state.toast = text; state.toastTimer = seconds; }

  function startStep() {
    const s = currentStep();
    if (!s) return;
    state.collected = 0;
    if (s.type === 'collect') {
      state.crates = [];
      for (let i = 0; i < s.count; i += 1) {
        const a = random() * TAU; const r = random() * (s.area.r - 40);
        let x = s.area.x + Math.cos(a) * r; let y = s.area.y + Math.sin(a) * r;
        if (inWater(x, y) || hitsBuilding(x, y, 20)) { x = 560 + i * 70; y = 745; }
        state.crates.push({ x, y, active: true });
      }
    } else if (s.type === 'evade') {
      state.wanted = Math.max(state.wanted, s.level);
      state.stepTimer = s.seconds;
    } else if (s.type === 'wanted') {
      state.wanted = Math.max(state.wanted, s.level);
    }
    const m = currentMission();
    say(`${m.name} — ${s.text}`, 4);
  }

  function advanceStep() {
    const m = currentMission();
    state.stepIndex += 1;
    if (state.stepIndex >= m.steps.length) {
      state.cash += m.reward;
      say(`${m.name} complete! +$${m.reward}`, 4);
      // Mama Odette's crew patches up the ride between jobs.
      if (state.player.vehicle) state.player.vehicle.hp = state.player.vehicle.kind === 'boat' ? BOAT.hp : CAR.hp;
      state.missionIndex += 1;
      state.stepIndex = 0;
      if (state.missionIndex >= MISSIONS.length) {
        state.allDone = true;
        return EVENT_CASH | EVENT_MISSION | EVENT_ALL_DONE;
      }
      startStep();
      return EVENT_CASH | EVENT_MISSION;
    }
    startStep();
    return EVENT_MISSION;
  }

  function addWanted(n) {
    state.wanted = clamp(state.wanted + n, 0, 5);
    state.crimeTimer = 0;
  }

  // Move a vehicle one step. Returns true if it hit something hard.
  function moveVehicle(v, dt, throttle, steer, isBoat) {
    const tune = isBoat ? BOAT : CAR;
    const max = isBoat ? tune.maxSpeed : (onRoad(v.x, v.y) ? tune.maxSpeed : CAR.offroadMax);
    v.speed += throttle * tune.accel * dt;
    if (throttle === 0) v.speed *= Math.max(0, 1 - 1.4 * dt);
    v.speed = clamp(v.speed, -tune.reverseMax, max);
    const dir = v.speed >= 0 ? 1 : -1;
    // A car can still turn a little at crawl speed, so a U-turn on a bridge is possible.
    v.angle += steer * tune.turn * dt * (0.35 + 0.65 * clamp(Math.abs(v.speed) / 120, 0, 1)) * dir;
    const nx = v.x + Math.cos(v.angle) * v.speed * dt;
    const ny = v.y + Math.sin(v.angle) * v.speed * dt;
    const blocked = (x, y) => {
      if (x < 20 || x > WORLD.width - 20 || y < 20 || y > WORLD.height - 20) return true;
      if (hitsBuilding(x, y, tune.radius)) return true;
      // Boats pass under bridges; cars and walkers cannot enter open water.
      return isBoat ? (!inWater(x, y) && !onBridge(x, y)) : inWater(x, y);
    };
    let hitHard = false;
    if (!blocked(nx, ny)) { v.x = nx; v.y = ny; }
    // A slide only counts when it actually moves the car; a head-on grind that goes
    // nowhere is a bounce, so the car backs off and can hit again (otherwise it would
    // sit against a wall forever, never taking another hit).
    else if (!blocked(nx, v.y) && Math.abs(nx - v.x) > 0.5) { v.x = nx; if (Math.abs(v.speed) > 180) hitHard = true; v.speed *= 0.5; }
    else if (!blocked(v.x, ny) && Math.abs(ny - v.y) > 0.5) { v.y = ny; if (Math.abs(v.speed) > 180) hitHard = true; v.speed *= 0.5; }
    else {
      const hard = Math.abs(v.speed) > 180;
      if (hard) hitHard = true;
      v.speed *= -0.3;
      // On a hard hit, shove the car back off the wall so it has room to build speed
      // for the next hit; without the shove it grinds at crawl speed and never
      // takes another hit.
      if (hard) {
        const bx = v.x - Math.cos(v.angle) * 60;
        const by = v.y - Math.sin(v.angle) * 60;
        if (!blocked(bx, by)) { v.x = bx; v.y = by; }
      }
    }
    return hitHard;
  }

  function moveOnFoot(p, dt, dx, dy, run) {
    const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;
    const nx = clamp(p.x + (dx / len) * speed * dt, 20, WORLD.width - 20);
    const ny = clamp(p.y + (dy / len) * speed * dt, 20, WORLD.height - 20);
    const blocked = (x, y) => hitsBuilding(x, y, PLAYER.radius) || inWater(x, y);
    if (!blocked(nx, p.y)) p.x = nx;
    if (!blocked(p.x, ny)) p.y = ny;
    p.angle = Math.atan2(dy, dx);
  }

  function nearestEnterable(x, y, maxDist) {
    let best = null; let bestD = maxDist;
    for (const v of state.vehicles) {
      if (!v.active || !v.parked) continue;
      if (v.kind !== 'car' && v.kind !== 'boat') continue;
      const d = dist(x, y, v.x, v.y);
      if (d < bestD) { bestD = d; best = v; }
    }
    return best;
  }

  function spawnPolice(dt) {
    const wantCars = Math.min(state.wanted, 4);
    const inBoat = state.player.vehicle && state.player.vehicle.kind === 'boat';
    const wantBoats = inBoat && state.wanted >= 2 ? Math.min(2, state.wanted - 1) : 0;
    let cars = 0; let boats = 0;
    for (const v of state.vehicles) {
      if (!v.active) continue;
      if (v.kind === 'policeCar') cars += 1;
      if (v.kind === 'policeBoat') boats += 1;
    }
    const p = state.player;
    function spawnSpot(boat) {
      for (let tries = 0; tries < 12; tries += 1) {
        const a = random() * TAU; const r = 650 + random() * 250;
        const x = clamp(p.x + Math.cos(a) * r, 60, WORLD.width - 60);
        const y = clamp(p.y + Math.sin(a) * r, 60, WORLD.height - 60);
        if (boat ? inWater(x, y) : (!inWater(x, y) && !hitsBuilding(x, y, 30))) return { x, y };
      }
      return { x: clamp(p.x + 700, 60, WORLD.width - 60), y: p.y };
    }
    if (cars < wantCars) {
      const s = spawnSpot(false);
      const v = makeVehicle('policeCar', s.x, s.y, 0);
      v.parked = false; state.vehicles.push(v);
    }
    if (boats < wantBoats) {
      const s = spawnSpot(true);
      const v = makeVehicle('policeBoat', s.x, s.y, 0);
      v.parked = false; state.vehicles.push(v);
    }
    // No heat, no law: the police leave at once instead of haunting the player.
    if (state.wanted === 0) {
      for (const v of state.vehicles) {
        if (v.kind === 'policeCar' || v.kind === 'policeBoat') v.active = false;
      }
    }
  }

  function stepPolice(dt) {
    const p = state.player;
    let minD = Infinity;
    for (const v of state.vehicles) {
      if (!v.active || (v.kind !== 'policeCar' && v.kind !== 'policeBoat')) continue;
      const boat = v.kind === 'policeBoat';
      const desired = Math.atan2(p.y - v.y, p.x - v.x);
      const steer = clamp(wrapAngle(desired - v.angle) * 2, -1, 1);
      // Slow down on the approach so the car can stop next to the player instead of
      // orbiting past them at full speed, never close enough to make an arrest.
      const d0 = dist(v.x, v.y, p.x, p.y);
      const throttle = d0 < 40 ? 0 : clamp(d0 / 250, 0.2, 1);
      moveVehicle(v, dt, throttle, steer, boat);
      v.ramTimer = Math.max(0, v.ramTimer - dt);
      const d = dist(v.x, v.y, p.x, p.y);
      if (d < minD) minD = d;
      // A police car wedged on terrain for a while is repositioned nearer the player.
      if (Math.abs(v.speed) < 20) v.stuckTimer = (v.stuckTimer || 0) + dt;
      else v.stuckTimer = 0;
      if (v.stuckTimer > 3) {
        const a = random() * TAU;
        const nx = clamp(p.x + Math.cos(a) * 350, 60, WORLD.width - 60);
        const ny = clamp(p.y + Math.sin(a) * 350, 60, WORLD.height - 60);
        if (boat ? inWater(nx, ny) : (!inWater(nx, ny) && !hitsBuilding(nx, ny, 30))) {
          v.x = nx; v.y = ny; v.speed = 0;
        }
        v.stuckTimer = 0;
      }
      const pv = p.vehicle;
      if (d < 46 && v.ramTimer <= 0) {
        v.ramTimer = POLICE.ramCooldown;
        v.speed *= 0.4; // a ram costs the police car its run-up, so it cannot chain-ram
        if (pv) {
          pv.hp -= POLICE.ramDamage;
          if (pv.hp <= 0) return EVENT_WASTED;
        } else if (Math.abs(p.speed) < 60) {
          state.bustTimer += dt * 3;
        }
      }
    }
    // The arrest clock is judged once per step, on the CLOSEST police car: far cars
    // must not cancel a near car's arrest by decaying the timer in the same step.
    // A bust needs the player nearly stopped — a car still rolling at 20+ gets away.
    if (minD < 55 && Math.abs(p.speed) < 15 && state.wanted > 0) state.bustTimer += dt;
    else if (minD > 90 || Math.abs(p.speed) > 90) state.bustTimer = Math.max(0, state.bustTimer - dt * 2);
    if (state.bustTimer > 1.5 && state.wanted > 0) return EVENT_BUSTED;
    return 0;
  }

  function stepTraffic(dt) {
    for (const v of state.vehicles) {
      if (!v.active || v.kind !== 'traffic') continue;
      const wp = v.route[v.routeIndex];
      const desired = Math.atan2(wp.y - v.y, wp.x - v.x);
      const steer = clamp(wrapAngle(desired - v.angle) * 2, -1, 1);
      v.speed = clamp(v.speed, 0, 190);
      moveVehicle(v, dt, 1, steer, false);
      v.speed = Math.min(v.speed, 190);
      if (dist(v.x, v.y, wp.x, wp.y) < 40) v.routeIndex = (v.routeIndex + 1) % v.route.length;
    }
    // Player bumps into traffic.
    const p = state.player;
    if (p.vehicle) {
      for (const v of state.vehicles) {
        if (!v.active || v.kind !== 'traffic') continue;
        if (dist(v.x, v.y, p.vehicle.x, p.vehicle.y) < 40) {
          if (Math.abs(p.vehicle.speed) > 200) {
            p.vehicle.hp -= 3;
            // A fender-bender dents the car but is not a crime spree: no wanted.
            if (p.vehicle.hp <= 0) return EVENT_WASTED;
          }
          v.speed *= 0.5; p.vehicle.speed *= 0.6;
        }
      }
    }
    return 0;
  }

  function stepPeds(dt) {
    const p = state.player;
    for (const ped of state.peds) {
      if (ped.down > 0) {
        ped.down -= dt;
        if (ped.down <= 0) { ped.x = 300 + random() * 2600; ped.y = 250 + random() * 1900; if (inWater(ped.x, ped.y)) { ped.x = 500; ped.y = 250; } }
        continue;
      }
      ped.wait -= dt;
      if (ped.wait <= 0) {
        ped.tx = clamp(ped.x + (random() - 0.5) * 500, 60, WORLD.width - 60);
        ped.ty = clamp(ped.y + (random() - 0.5) * 500, 60, WORLD.height - 60);
        if (inWater(ped.tx, ped.ty) || hitsBuilding(ped.tx, ped.ty, 20)) { ped.tx = ped.x; ped.ty = ped.y; }
        ped.wait = 2 + random() * 4;
      }
      const d = dist(ped.x, ped.y, ped.tx, ped.ty);
      if (d > 8) {
        const nx = ped.x + ((ped.tx - ped.x) / d) * ped.speed * dt;
        const ny = ped.y + ((ped.ty - ped.y) / d) * ped.speed * dt;
        if (!inWater(nx, ny) && !hitsBuilding(nx, ny, 12)) { ped.x = nx; ped.y = ny; ped.angle = Math.atan2(ped.ty - ped.y, ped.tx - ped.x); }
      }
      // Run over by the player's vehicle.
      if (p.vehicle && Math.abs(p.vehicle.speed) > 120 && dist(ped.x, ped.y, p.vehicle.x, p.vehicle.y) < 34) {
        ped.down = 10;
        addWanted(2);
        p.vehicle.hp -= 3;
      }
    }
  }

  function stepMission(dt) {
    const s = currentStep();
    if (!s) return 0;
    const p = state.player;
    if (s.type === 'goto') {
      if (dist(p.x, p.y, s.x, s.y) < 70) return advanceStep();
    } else if (s.type === 'collect') {
      for (const c of state.crates) {
        if (c.active && dist(p.x, p.y, c.x, c.y) < 42) {
          c.active = false; state.collected += 1;
          if (state.collected >= s.count) return advanceStep();
        }
      }
    } else if (s.type === 'evade') {
      state.stepTimer -= dt;
      if (state.stepTimer <= 0) return advanceStep();
    } else if (s.type === 'wanted') {
      return advanceStep();
    }
    return 0;
  }

  function stepTrial(dt) {
    const t = state.trial;
    const p = state.player;
    if (!t.active) {
      if (!t.done && p.vehicle && p.vehicle.kind === 'boat' && dist(p.x, p.y, TRIAL_GATES[0].x, TRIAL_GATES[0].y) < 60) {
        t.active = true; t.gate = 1; t.timeLeft = TRIAL_TIME;
        say('River trial started! 6 gates, 95 seconds.', 3);
      }
      return 0;
    }
    t.timeLeft -= dt;
    const g = TRIAL_GATES[t.gate];
    if (g && dist(p.x, p.y, g.x, g.y) < 60) {
      t.gate += 1;
      if (t.gate >= TRIAL_GATES.length) {
        t.active = false; t.done = true;
        state.cash += TRIAL_REWARD;
        say(`River trial done! +$${TRIAL_REWARD}`, 4);
        return EVENT_CASH;
      }
    }
    if (t.timeLeft <= 0) {
      t.active = false;
      say('River trial failed — try again at gate 1.', 3);
    }
    return 0;
  }

  function step(dt, input, harmless) {
    let events = 0;
    state.elapsed += dt;
    if (state.toastTimer > 0) {
      state.toastTimer -= dt;
      if (state.toastTimer <= 0) state.toast = '';
    }
    const p = state.player;
    p.speed = p.vehicle ? p.vehicle.speed : 0;

    if (!harmless) {
      // Enter / exit vehicle.
      if (input.enter) {
        if (p.vehicle) {
          const v = p.vehicle;
          p.vehicle = null; p.onFoot = true;
          p.x = clamp(v.x + Math.cos(v.angle + Math.PI / 2) * 34, 20, WORLD.width - 20);
          p.y = clamp(v.y + Math.sin(v.angle + Math.PI / 2) * 34, 20, WORLD.height - 20);
          if (inWater(p.x, p.y) || hitsBuilding(p.x, p.y, 16)) {
            p.x = clamp(v.x - Math.cos(v.angle + Math.PI / 2) * 34, 20, WORLD.width - 20);
            p.y = clamp(v.y - Math.sin(v.angle + Math.PI / 2) * 34, 20, WORLD.height - 20);
          }
          p.speed = 0;
        } else {
          const v = nearestEnterable(p.x, p.y, 56);
          if (v) {
            p.vehicle = v; p.onFoot = false; v.parked = false;
            if (v.kind === 'car') addWanted(1); // stealing a parked car
          }
        }
      }

      if (p.vehicle) {
        const v = p.vehicle;
        const isBoat = v.kind === 'boat';
        const throttle = input.held.up ? 1 : input.held.down ? -0.6 : 0;
        const steer = (input.held.left ? -1 : 0) + (input.held.right ? 1 : 0);
        let useThrottle = throttle;
        if (input.held.brake) { v.speed *= Math.max(0, 1 - 3.2 * dt); useThrottle = 0; }
        const hitHard = moveVehicle(v, dt, useThrottle, steer, isBoat);
        p.x = v.x; p.y = v.y; p.angle = v.angle; p.speed = v.speed;
        if (hitHard) {
          v.hp -= 4;
          events |= EVENT_CRASH;
          if (v.hp <= 0) return events | EVENT_WASTED;
        }
      } else {
        const dx = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
        const dy = (input.held.down ? 1 : 0) - (input.held.up ? 1 : 0);
        moveOnFoot(p, dt, dx, dy, input.held.brake);
        p.speed = (dx || dy) ? (input.held.brake ? PLAYER.runSpeed : PLAYER.walkSpeed) : 0;
      }

      // Caches.
      for (const c of state.caches) {
        if (!c.taken && dist(p.x, p.y, c.x, c.y) < 36) {
          c.taken = true; state.cash += 25;
          say('Swamp cache found! +$25', 2.5);
          events |= EVENT_CASH | EVENT_PICKUP;
        }
      }

      events |= stepMission(dt);
      events |= stepTrial(dt);

      // Wanted decay: quiet for a while and the heat drops.
      state.crimeTimer += dt;
      if (state.wanted > 0 && state.crimeTimer > WANTED_DECAY_SECONDS) {
        let near = false;
        for (const v of state.vehicles) {
          if ((v.kind === 'policeCar' || v.kind === 'policeBoat') && v.active && dist(v.x, v.y, p.x, p.y) < 500) { near = true; break; }
        }
        if (!near) { state.wanted -= 1; state.crimeTimer = 0; }
      }

      spawnPolice(dt);
      events |= stepPolice(dt);
      if (events & (EVENT_BUSTED | EVENT_WASTED)) return events;
      events |= stepTraffic(dt);
      if (events & EVENT_WASTED) return events;
      stepPeds(dt);
    }

    // Ambient life runs even on the title screen.
    if (harmless) {
      for (const v of state.vehicles) {
        if (!v.active || v.kind !== 'traffic') continue;
        const wp = v.route[v.routeIndex];
        const desired = Math.atan2(wp.y - v.y, wp.x - v.x);
        const steer = clamp(wrapAngle(desired - v.angle) * 2, -1, 1);
        v.speed = clamp(v.speed, 0, 190);
        moveVehicle(v, dt, 1, steer, false);
        v.speed = Math.min(v.speed, 190);
        if (dist(v.x, v.y, wp.x, wp.y) < 40) v.routeIndex = (v.routeIndex + 1) % v.route.length;
      }
    }
    return events;
  }

  function serialize() {
    return {
      cash: state.cash, missionIndex: state.missionIndex, stepIndex: state.stepIndex,
      caches: state.caches.map((c) => c.taken), trialDone: state.trial.done,
    };
  }

  function applySave(save) {
    if (!save) return;
    state.cash = save.cash | 0;
    state.missionIndex = Math.min(save.missionIndex | 0, MISSIONS.length);
    state.stepIndex = save.stepIndex | 0;
    if (save.caches) for (let i = 0; i < save.caches.length && i < state.caches.length; i += 1) state.caches[i].taken = !!save.caches[i];
    state.trial.done = !!save.trialDone;
    state.allDone = state.missionIndex >= MISSIONS.length;
    state.crates = [];
    startStep();
  }

  const debug = {
    teleport(x, y) {
      const p = state.player;
      if (p.vehicle) { p.vehicle.x = x; p.vehicle.y = y; }
      p.x = x; p.y = y;
    },
    giveVehicle(kind, x, y) {
      const v = makeVehicle(kind, x, y, 0);
      v.parked = false; state.vehicles.push(v);
      state.player.vehicle = v; state.player.onFoot = false;
      return v;
    },
    setWanted(n) { state.wanted = n; state.crimeTimer = 0; },
    setMission(i) {
      state.missionIndex = i; state.stepIndex = 0; state.allDone = false;
      state.crates = []; startStep();
    },
    setNight(n) { state.night = !!n; },
    setCash(n) { state.cash = n; },
  };

  reset();
  return { state, reset, step, objective, serialize, applySave, debug };
}
