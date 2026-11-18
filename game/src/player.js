// The player: on foot, or in a car or a boat. Entering, exiting, walking,
// refuelling, and the busted / wasted recoveries.

import { PLAYER, PLACES } from './config.js';
import { isWater, moveCircle, pointBlocked } from './world.js';
import { nearestVehicle, stepVehicle } from './vehicles.js';

/** Put the player on foot at (x, y), out of any vehicle. */
export function putOnFoot(state, x, y) {
  state.player.onFoot = true;
  state.player.vehicle = null;
  state.player.x = x;
  state.player.y = y;
  state.player.speed = 0;
}

/** Where the player steps out of a vehicle: the first of the four spots
 * around it (left, right, front, back) the player can actually stand on.
 * Without this check the exit can land inside a tree's blocking circle, and
 * the player is wedged there for good — every direction stays blocked. */
function exitSpot(v) {
  const cos = Math.cos(v.angle);
  const sin = Math.sin(v.angle);
  const px = -sin;
  const py = cos;
  const spots = [
    { x: v.x + px * 46, y: v.y + py * 46 },
    { x: v.x - px * 46, y: v.y - py * 46 },
    { x: v.x + cos * 60, y: v.y + sin * 60 },
    { x: v.x - cos * 60, y: v.y - sin * 60 },
  ];
  for (const s of spots) {
    if (!pointBlocked(s.x, s.y, PLAYER.radius, 'foot')) return s;
  }
  return { x: v.x, y: v.y };
}

/** The player's current vehicle, or null. */
export function currentVehicle(state) {
  return state.player.vehicle;
}

/** Step the player for dt seconds. `input` is the keyboard state, `acts` the edge actions. */
export function stepPlayer(state, input, acts, dt, audio) {
  const p = state.player;

  if (!p.onFoot && p.vehicle) {
    const v = p.vehicle;
    const dir = input.direction();
    const drive = {
      throttle: dir.y !== 0 ? -dir.y : 0, // up = forward
      steer: dir.x,
    };
    if (input.braking()) drive.throttle = 0;
    stepVehicle(state, v, dt, drive);
    p.x = v.x;
    p.y = v.y;
    p.angle = v.angle;
    // Wrecked: the vehicle dies under the player.
    if (v.damage >= 100) {
      state.message = `${v.name} is wrecked!`;
      state.messageTimer = 3;
      audio.bad();
      const side = exitSpot(v);
      putOnFoot(state, side.x, side.y);
      state.cash = Math.max(0, state.cash - 50);
      return;
    }
    if (acts.enter) {
      // Step out beside the vehicle, on dry land the player can stand on.
      let side = exitSpot(v);
      if (isWater(side.x, side.y) && v.kind === 'car') {
        // Do not step out of a car into the river; use the far side instead.
        const other = { x: v.x - Math.cos(v.angle + Math.PI / 2) * 46, y: v.y - Math.sin(v.angle + Math.PI / 2) * 46 };
        if (!isWater(other.x, other.y)) side = other;
      }
      putOnFoot(state, side.x, side.y);
    }
    return;
  }

  // On foot.
  const dir = input.direction();
  const speed = input.running() ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const len = Math.hypot(dir.x, dir.y) || 1;
  const dx = (dir.x / len) * speed * dt;
  const dy = (dir.y / len) * speed * dt;
  const moved = moveCircle(p.x, p.y, dx, dy, PLAYER.radius, 'foot');
  p.x = moved.x;
  p.y = moved.y;
  if (dir.x !== 0 || dir.y !== 0) p.angle = Math.atan2(dir.y, dir.x);
  p.speed = Math.hypot(dx, dy) / Math.max(dt, 0.0001);

  if (acts.enter) {
    const v = nearestVehicle(state, p.x, p.y, 80);
    if (v) {
      p.onFoot = false;
      p.vehicle = v;
      p.x = v.x;
      p.y = v.y;
      // Stealing a car in sight of the law draws heat.
      if (v.traffic && state.wanted < 5 && state.police.length > 0) {
        const near = state.police.some((cop) => Math.hypot(cop.x - p.x, cop.y - p.y) < 500);
        if (near) {
          state.wanted = Math.min(5, state.wanted + 1);
          state.message = 'The law saw you steal that ride!';
          state.messageTimer = 3;
        }
      }
      if (v.kind === 'boat') audio.splash();
    }
  }
  if (acts.refuel) {
    const nearGas = Math.hypot(p.x - PLACES.gas.x, p.y - PLACES.gas.y) < 140;
    const nearMarina = Math.hypot(p.x - PLACES.marina.x, p.y - PLACES.marina.y) < 160;
    if (nearGas || nearMarina) {
      let filled = false;
      for (const v of state.vehicles) {
        if (Math.hypot(v.x - p.x, v.y - p.y) < 130 && v.fuel < 100) {
          v.fuel = 100;
          filled = true;
        }
      }
      if (filled) {
        state.message = 'Tank full.';
        state.messageTimer = 2;
        audio.blip();
      }
    }
  }
}

/** Busted: the law takes the player in. Cash lost, heat cleared, back at Odette's. */
export function bustPlayer(state) {
  state.stats.busted += 1;
  state.cash = Math.max(0, state.cash - 50);
  state.wanted = 0;
  state.carrying = false;
  state.trial.active = false;
  state.police = [];
  putOnFoot(state, PLACES.odette.x + 40, PLACES.odette.y + 60);
  state.player.health = PLAYER.health;
}

/** Wasted: the player goes down. Cash lost, heat cleared, back at the motel clinic. */
export function wastePlayer(state) {
  state.stats.wasted += 1;
  state.cash = Math.max(0, state.cash - 50);
  state.wanted = 0;
  state.carrying = false;
  state.trial.active = false;
  state.police = [];
  // South of the motel building (its south edge is motel.y + 45): the old
  // offset (+30,+40) landed inside the building and wedged the player there.
  putOnFoot(state, PLACES.motel.x, PLACES.motel.y + 80);
  state.player.health = PLAYER.health;
}
