// The law: police cars on the levee roads, police boats on the river. They spawn
// with the wanted level, chase the player, and ram. Outrun them and stay out of
// sight and the heat cools off, one star at a time.

import { WANTED_DECAY_SECONDS, PLACES } from './config.js';
import { isWater, pointBlocked } from './world.js';
import { driveToward, stepVehicle } from './vehicles.js';
import { findRoute } from './routes.js';

let policeId = 0;

function makePolice(random, kind, x, y) {
  policeId += 1;
  return {
    id: `police-${policeId}`,
    kind,
    name: kind === 'boat' ? 'Police Boat' : 'Police Cruiser',
    color: kind === 'boat' ? '#2f5cb8' : '#3a6fd8',
    x, y, angle: 0, speed: 0, fuel: 100, damage: 0,
    police: true, traffic: false, target: null, stuckTimer: 0,
    length: kind === 'boat' ? 58 : 52, width: 26,
    bustTimer: 0,
  };
}

/** How many police cars and boats the current heat calls for. One star is
 * a warning — the law only rolls out at two stars, so a single mistake in
 * the early missions does not end the run before the heat is introduced. */
function wantedForce(state) {
  const onWater = isWater(state.player.x, state.player.y) || (state.player.vehicle && state.player.vehicle.kind === 'boat');
  const cars = state.wanted >= 2 ? Math.min(state.wanted - 1, 3) : 0;
  const boats = onWater && state.wanted >= 3 ? 1 : 0;
  return { cars, boats };
}


/** Chase the player: route along the road / water graph while far away, so a
 * cruiser does not nose into the river, then close in directly. */
/**
 * Whether the straight line from (x, y) to (tx, ty) is blocked for a vehicle
 * of radius r: a cop driving straight at the player through a stilt house
 * just pins itself to the wall, so a blocked line takes the road graph even
 * at close range.
 */
function lineBlocked(x, y, tx, ty, r, mode) {
  const d = Math.hypot(tx - x, ty - y);
  const steps = Math.max(1, Math.ceil(d / 30));
  for (let i = 1; i <= steps; i += 1) {
    if (pointBlocked(x + ((tx - x) * i) / steps, y + ((ty - y) * i) / steps, r, mode)) return true;
  }
  return false;
}

function chase(state, cop, dt, tx, ty) {
  const p = state.player;
  const d = Math.hypot(tx - cop.x, ty - cop.y);
  const kind = cop.kind === 'boat' ? 'water' : 'land';
  if (d > 450 || lineBlocked(cop.x, cop.y, tx, ty, cop.length / 2, kind)) {
    const key = `${kind}:${Math.round(tx / 100)},${Math.round(ty / 100)}`;
    if (!cop._route || cop._route.key !== key || state.time - cop._routeAt > 2) {
      cop._route = { key, points: findRoute(cop.x, cop.y, tx, ty, kind), index: 0 };
      cop._routeAt = state.time;
    }
    const route = cop._route;
    while (route.index < route.points.length) {
      const wp = route.points[route.index];
      if (Math.hypot(wp.x - cop.x, wp.y - cop.y) < 70) route.index += 1;
      else break;
    }
    if (route.index < route.points.length) {
      const wp = route.points[route.index];
      return driveToward(cop, wp.x, wp.y);
    }
  }
  return driveToward(cop, tx, ty);
}

/** Step the police for dt seconds. Returns 'busted' when the law takes the player in. */
export function stepPolice(state, random, dt, audio) {
  const p = state.player;

  // Spawn / despawn to match the wanted level.
  if (state.wanted === 0) {
    if (state.police.length > 0) state.police = [];
    state.wantedTimer = 0;
    return null;
  }
  const force = wantedForce(state);
  const cars = state.police.filter((v) => v.kind === 'car').length;
  const boats = state.police.filter((v) => v.kind === 'boat').length;
  if (cars < force.cars) {
    // On Main St by the office: the old spot (sheriff +60,+40) sat 20px from
    // the office wall, inside a cruiser's 26px radius, so the cars spawned
    // pinned and never moved while the heat decayed to zero.
    const spawn = { x: 2400, y: 1040 };
    state.police.push(makePolice(random, 'car', spawn.x, spawn.y));
  }
  if (boats < force.boats) {
    state.police.push(makePolice(random, 'boat', 1560, 1850));
  }
  if (cars > force.cars) {
    const idx = state.police.findIndex((v) => v.kind === 'car');
    if (idx >= 0) state.police.splice(idx, 1);
  }
  if (boats > force.boats) {
    const idx = state.police.findIndex((v) => v.kind === 'boat');
    if (idx >= 0) state.police.splice(idx, 1);
  }

  // Chase.
  let nearest = Infinity;
  for (const cop of state.police) {
    const d = Math.hypot(cop.x - p.x, cop.y - p.y);
    nearest = Math.min(nearest, d);
    // Police boats stay on the water; police cars stay on land. If the player
    // switches medium, the wrong kind of unit holds at the shore.
    const copOnWater = isWater(cop.x, cop.y);
    const playerOnWater = isWater(p.x, p.y);
    let tx = p.x;
    let ty = p.y;
    if (cop.kind === 'boat' && !playerOnWater) {
      // Hold at the nearest river point.
      tx = 1675;
      ty = p.y;
    } else if (cop.kind === 'car' && playerOnWater) {
      tx = p.x < 1675 ? 1400 : 1950;
      ty = p.y;
    }
    const drive = chase(state, cop, dt, tx, ty);
    // Police are a touch slower than the player's top speed, so escape is possible.
    stepVehicle(state, cop, dt, drive);
    if (cop.speed > 380) cop.speed = 380;

    // Contact: ramming damages the player's vehicle; on foot it wears the player down.
    if (d < cop.length / 2 + 20) {
      if (p.vehicle) {
        p.vehicle.damage = Math.min(100, p.vehicle.damage + 6 * dt);
        cop.speed *= 0.92;
        if (Math.abs(p.vehicle.speed) < 30) {
          cop.bustTimer += dt;
          if (cop.bustTimer > 2) return 'busted';
        } else {
          cop.bustTimer = 0;
        }
      } else {
        p.health -= 6 * dt;
        audio.bad();
        if (p.health <= 0) return 'wasted';
      }
    } else {
      cop.bustTimer = 0;
    }
  }

  // Heat cools when no police can see the player.
  if (nearest > 600) {
    state.wantedTimer += dt;
    if (state.wantedTimer >= WANTED_DECAY_SECONDS) {
      state.wantedTimer = 0;
      state.wanted = Math.max(0, state.wanted - 1);
      if (state.wanted === 0) state.message = 'You lost them.';
      else state.message = 'The heat is cooling off.';
      state.messageTimer = 2;
    }
  } else {
    state.wantedTimer = 0;
  }
  return null;
}
