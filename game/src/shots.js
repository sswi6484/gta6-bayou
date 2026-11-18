// The screenshot scenes behind ?shot=cover|mission|chase|night, and the autopilot
// the play-tests use too. Each scene plays the real rules forward from a fresh
// world for a fixed number of steps, steered by a simple driver (aim at the
// objective, slow for sharp turns, reverse out of a jam), so the frame is what
// a short game really looks like and the same seed always gives the same frame.

import { STEP, PLACES } from './config.js';
import { isWater, isRoad, lineHitsBuilding, lineHitsTree } from './world.js';
import { nearestVehicle } from './vehicles.js';
import { findRoute } from './routes.js';
import { currentTarget } from './missions.js';
import { SCREEN_TITLE, SCREEN_PLAY } from './render.js';
import { ACTION_ENTER } from './input.js';

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Drive the player toward a point by holding keys. The player is a car or boat
 * (angle + speed) or on foot (a direction): both answer the same held keys.
 * Returns the distance to the target.
 */
export function autopilotToward(state, input, tx, ty, dt) {
  const p = state.player;
  const dx = tx - p.x;
  const dy = ty - p.y;
  const dist = Math.hypot(dx, dy);
  const want = Math.atan2(dy, dx);
  if (p.vehicle) {
    const diff = angleDiff(want, p.angle);
    const v = p.vehicle;
    // Stuck means not getting anywhere, whatever the speedometer says: a car
    // reversing at full throttle into a tree still reads -154 and never moves.
    // Track the position instead, and count the episodes: three in a row
    // means wedged, and the autopilot gives up the car and walks instead.
    v._posT = (v._posT || 0) + dt;
    if (state.time < (v._recoverUntil || 0)) {
      // Recovery: reverse out steering the other way, then try again.
      input.setHeld('down', true);
      input.setHeld('up', false);
      const side = (v.stuckEpisodes || 0) % 2 === 0 ? 1 : -1;
      input.setHeld('left', side < 0);
      input.setHeld('right', side > 0);
      return dist;
    }
    if (v._posT > 1.5) {
      const moved = Math.hypot(v.x - (v._posX ?? v.x), v.y - (v._posY ?? v.y));
      v._posX = v.x;
      v._posY = v.y;
      v._posT = 0;
      if (moved < 15 && dist > 80) {
        v.stuckEpisodes = (v.stuckEpisodes || 0) + 1;
        v._recoverUntil = state.time + 1.5;
        return dist;
      }
      v.stuckEpisodes = 0;
    }
    // Facing away from the target: reverse to swing around. But reversing
    // flips the steering sense (the physics multiplies the steer by the sign
    // of the speed), so the steer must flip too — otherwise the car turns
    // away from the target, flips back to forward, and oscillates in place.
    // A sharp turn at full speed flies past the turn and into the map edge,
    // so coast through it: keep steering while the car slows and rotates.
    const reversing = Math.abs(diff) >= 2.4;
    const sharpTurn = !reversing && Math.abs(diff) > 1.0;
    input.setHeld('up', !reversing && !sharpTurn);
    input.setHeld('down', reversing);
    input.setHeld('left', reversing ? diff > 0.15 : diff < -0.15);
    input.setHeld('right', reversing ? diff < -0.15 : diff > 0.15);
  } else {
    // On foot: walk at the target, sidestepping when a wall stops us. Walking
    // straight into a flat wall holds no lateral key, so nothing slides: if
    // the player has barely moved in 1.5s, detour 60 degrees to one side
    // (alternating) until clear.
    let mx = dx / (dist || 1);
    let my = dy / (dist || 1);
    p._walkT = (p._walkT || 0) + dt;
    if (p._walkT > 1.5) {
      const moved = Math.hypot(p.x - (p._walkX ?? p.x), p.y - (p._walkY ?? p.y));
      p._walkX = p.x;
      p._walkY = p.y;
      p._walkT = 0;
      if (moved < 12) {
        p._sidestepSide = (p._sidestepSide || 0) + 1;
        p._sidestepUntil = state.time + 1.2;
      }
    }
    if (state.time < (p._sidestepUntil || 0)) {
      // Cycle 60, -60, 120, -120 degrees: a wide tree gets walked around its
      // far side instead of pushed against again.
      const detours = [Math.PI / 3, -Math.PI / 3, (2 * Math.PI) / 3, (-2 * Math.PI) / 3];
      const a = Math.atan2(my, mx) + detours[(p._sidestepSide - 1) % detours.length];
      mx = Math.cos(a);
      my = Math.sin(a);
    }
    input.setHeld('up', my < -0.3);
    input.setHeld('down', my > 0.3);
    input.setHeld('left', mx < -0.3);
    input.setHeld('right', mx > 0.3);
  }
  return dist;
}

/** Release every held key. */
export function autopilotRelease(input) {
  for (const k of ['up', 'down', 'left', 'right']) input.setHeld(k, false);
}

/**
 * The full autopilot: get into a vehicle when the objective is far, drive or
 * sail to it along the road / water graph, get out and walk the last stretch.
 * Boats are for water targets, cars for land ones; when the medium is wrong it
 * heads for a boarding point first. The route is cached on the state and
 * replanned when the objective moves.
 */
const BOARDING_POINTS = [
  { x: 1600, y: 1900 }, // Marina
  { x: 1700, y: 1750 }, // Shrimp docks
];

function routeFor(state, tx, ty, kind) {
  // The key includes the start (coarse) as well as the target: a route planned
  // from the other side of town is stale once the driver has moved.
  const key = `${kind}:${Math.round(state.player.x / 200)},${Math.round(state.player.y / 200)}:${Math.round(tx / 100)},${Math.round(ty / 100)}`;
  if (!state._route || state._route.key !== key) {
    const points = findRoute(state.player.x, state.player.y, tx, ty, kind);
    state._route = { key, points, index: 0 };
  }
  return state._route;
}

function nearestOfKind(state, x, y, radius, kind) {
  let best = null;
  let bestD = radius;
  for (const v of state.vehicles) {
    if (v.kind !== kind || v.damage >= 100) continue;
    const d = Math.hypot(v.x - x, v.y - y);
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  return best;
}

/** Whether the straight line from the player to (tx, ty) crosses water
 * (bridges are dry): on foot the river is a wall, so a crossing needs the
 * road route over a bridge, not a straight walk into the bank. */
function lineCrossesWater(state, tx, ty) {
  const p = state.player;
  const d = Math.hypot(tx - p.x, ty - p.y);
  const steps = Math.max(1, Math.ceil(d / 40));
  for (let i = 1; i <= steps; i += 1) {
    if (isWater(p.x + ((tx - p.x) * i) / steps, p.y + ((ty - p.y) * i) / steps)) return true;
  }
  return false;
}

/** Walk toward (tx, ty), taking the road route over a bridge when the direct
 * line crosses the river. */
function walkTo(state, input, tx, ty, dt) {
  if (lineCrossesWater(state, tx, ty)) {
    routeFor(state, tx, ty, 'land');
    if (!followRoute(state, input, dt)) autopilotToward(state, input, tx, ty, dt);
    return;
  }
  autopilotToward(state, input, tx, ty, dt);
}

/**
 * Whether the straight line from the player to (tx, ty) is drivable: for a
 * car it must not cross water, for a boat it must stay in the water. Sampled
 * every 40px; trees and buildings are left to the stuck logic.
 */
function lineClear(state, tx, ty, inBoat) {
  const p = state.player;
  const d = Math.hypot(tx - p.x, ty - p.y);
  const steps = Math.max(1, Math.ceil(d / 40));
  for (let i = 1; i <= steps; i += 1) {
    const x = p.x + ((tx - p.x) * i) / steps;
    const y = p.y + ((ty - p.y) * i) / steps;
    const wet = isWater(x, y);
    if (inBoat ? !wet : wet) return false;
  }
  // And never drive straight through a building or a tree field: the car
  // rams the wall at full speed, and in the grove it wedges on the same tree
  // forever (drive in, reverse out to the same spot, drive in again). The
  // road route plus the walk-the-last-stretch rule cover those legs instead.
  const r = p.vehicle ? p.vehicle.length / 2 : 14;
  if (lineHitsBuilding(p.x, p.y, tx, ty, r)) return false;
  if (!inBoat && lineHitsTree(p.x, p.y, tx, ty, r)) return false;
  return true;
}

function followRoute(state, input, dt) {
  const route = state._route;
  if (!route || route.points.length === 0) return false;
  const p = state.player;
  while (route.index < route.points.length) {
    const wp = route.points[route.index];
    if (Math.hypot(wp.x - p.x, wp.y - p.y) < 70) route.index += 1;
    else break;
  }
  if (route.index >= route.points.length) return false;
  const wp = route.points[route.index];
  autopilotToward(state, input, wp.x, wp.y, dt);
  return true;
}

export function autopilot(state, input, dt) {
  const target = currentTarget(state);
  if (!target) {
      autopilotRelease(input);
    return;
  }
  const p = state.player;
  const dist = Math.hypot(target.x - p.x, target.y - p.y);
  const targetWet = isWater(target.x, target.y);

  if (!p.vehicle) {
    // Walking the leg the driver abandoned a vehicle for: never climb straight
    // back into the car that was just left behind.
    const walkOnly = state._walkTarget
      && Math.hypot(target.x - state._walkTarget.x, target.y - state._walkTarget.y) < 120;
    if (walkOnly && dist < 90) state._walkTarget = null;
    if (walkOnly || dist < 90) {
      walkTo(state, input, target.x, target.y, dt);
      return;
    }
    // Find a ride of the right kind.
    const ride = nearestOfKind(state, p.x, p.y, 600, targetWet ? 'boat' : 'car');
    if (ride) {
      const rd = Math.hypot(ride.x - p.x, ride.y - p.y);
      if (rd < 80) {
        input.queueAction(ACTION_ENTER);
        autopilotRelease(input);
        return;
      }
      walkTo(state, input, ride.x, ride.y, dt);
      return;
    }
    // No ride in reach: walk toward the objective (or the marina, for water).
    if (targetWet) {
      const bp = BOARDING_POINTS[0];
      walkTo(state, input, bp.x, bp.y, dt);
    } else {
      walkTo(state, input, target.x, target.y, dt);
    }
    return;
  }

  // In a vehicle.
  const inBoat = p.vehicle.kind === 'boat';
  // Wedged three times in a row: abandon the car and walk the rest.
  if (!inBoat && (p.vehicle.stuckEpisodes || 0) >= 3) {
    p.vehicle.stuckEpisodes = 0;
    state._walkTarget = { x: target.x, y: target.y };
    input.queueAction(ACTION_ENTER);
    autopilotRelease(input);
    return;
  }
  // An off-road objective close by is a walk, not a drive: the grove's trees
  // stop a car, and the last stretch is quicker on foot.
  if (!inBoat && !targetWet && dist < 300 && !isRoad(target.x, target.y)) {
    state._walkTarget = { x: target.x, y: target.y };
    input.queueAction(ACTION_ENTER);
    autopilotRelease(input);
    return;
  }
  if (targetWet && !inBoat) {
    // Drive to a boarding point, then swap to a boat.
    let bp = BOARDING_POINTS[0];
    let bd = Infinity;
    for (const point of BOARDING_POINTS) {
      const d = Math.hypot(point.x - p.x, point.y - p.y);
      if (d < bd) {
        bd = d;
        bp = point;
      }
    }
    if (bd < 110) {
      input.queueAction(ACTION_ENTER);
      autopilotRelease(input);
      return;
    }
    routeFor(state, bp.x, bp.y, 'land');
    if (!followRoute(state, input, dt)) autopilotToward(state, input, bp.x, bp.y, dt);
    return;
  }
  if (!targetWet && inBoat) {
    // Sail to the nearest water waypoint to the target, then get out and walk.
    const route = routeFor(state, target.x, target.y, 'water');
    // The route's last point is the land target itself: stop at the last graph node.
    const stopIndex = Math.max(0, route.points.length - 2);
    if (route.index >= stopIndex) {
      input.queueAction(ACTION_ENTER);
      autopilotRelease(input);
      return;
    }
    if (!followRoute(state, input, dt)) autopilotToward(state, input, target.x, target.y, dt);
    return;
  }
  // Same medium as the target: drive straight at it when the line does not
  // cross the water (cutting through the grove beats the 3x-long road loop),
  // and follow the road / water graph when it does.
  if (lineClear(state, target.x, target.y, inBoat)) {
    autopilotToward(state, input, target.x, target.y, dt);
    return;
  }
  routeFor(state, target.x, target.y, inBoat ? 'water' : 'land');
  if (!followRoute(state, input, dt)) {
    if (dist < 60 && !inBoat) {
      // Close enough to walk the rest.
      input.queueAction(ACTION_ENTER);
      autopilotRelease(input);
      return;
    }
    autopilotToward(state, input, target.x, target.y, dt);
  }
}

/** Flee pilot for the chase scene: drive away from the nearest police unit. */
export function fleePilot(state, input, dt) {
  const p = state.player;
  let nearest = null;
  let nearestD = Infinity;
  for (const cop of state.police) {
    const d = Math.hypot(cop.x - p.x, cop.y - p.y);
    if (d < nearestD) {
      nearestD = d;
      nearest = cop;
    }
  }
  if (!nearest) {
    autopilotRelease(input);
    return;
  }
  // Aim at a point on the far side of the player from the cop, down the levee road.
  const away = Math.atan2(p.y - nearest.y, p.x - nearest.x);
  const tx = p.x + Math.cos(away) * 600;
  const ty = p.y + Math.sin(away) * 600;
  autopilotToward(state, input, tx, ty, dt);
}

/**
 * Stage a named scene (cover, mission, chase or night; any other name is cover)
 * on a fresh world and return the screen to draw over it plus the pilot that
 * drives it (null = the mission autopilot). `step` advances the world one fixed
 * step with the chosen pilot driving; the caller runs it in a loop, so scenes
 * stay deterministic for a fixed seed.
 */
export function stageShot(name, state, step) {
  const run = (seconds) => {
    const steps = Math.round(seconds / STEP);
    for (let i = 0; i < steps; i += 1) step();
  };

  if (name === 'mission') {
    // Mission 1 in progress: crate in hand, driving the loaner to the stilt row.
    state.missionIndex = 0;
    state.missionStage = 1;
    state.carrying = true;
    state.cash = 150;
    // Put the player in the loaner truck first.
    const truck = state.vehicles.find((v) => v.id === 'loaner');
    if (truck) {
      state.player.onFoot = false;
      state.player.vehicle = truck;
      state.player.x = truck.x;
      state.player.y = truck.y;
    }
    run(14);
    return { screen: SCREEN_PLAY, pilot: null };
  }
  if (name === 'chase') {
    // Wanted 3 on the levee road, police cruisers closing in.
    state.missionIndex = 3;
    state.missionStage = 0;
    state.missionData = { started: true };
    state.wanted = 3;
    state.cash = 550;
    const truck = state.vehicles.find((v) => v.id === 'loaner');
    if (truck) {
      truck.x = 1340;
      truck.y = 700;
      truck.angle = Math.PI / 2;
      state.player.onFoot = false;
      state.player.vehicle = truck;
      state.player.x = truck.x;
      state.player.y = truck.y;
    }
    run(9);
    return { screen: SCREEN_PLAY, pilot: fleePilot };
  }
  if (name === 'night') {
    // Night on the river: fog, a boat, the marina lights behind.
    state.dayTime = 0.78;
    state.fog = 0.8;
    state.missionIndex = 2;
    state.missionStage = 1;
    state.carrying = true;
    state.cash = 450;
    // Put the player in the Bayou Queen on the river.
    const boat = state.vehicles.find((v) => v.id === 'boat1');
    if (boat) {
      state.player.onFoot = false;
      state.player.vehicle = boat;
      boat.x = 1675;
      boat.y = 1200;
      boat.angle = Math.PI / 2;
      state.player.x = boat.x;
      state.player.y = boat.y;
    }
    run(7);
    return { screen: SCREEN_PLAY, pilot: null };
  }
  // Cover: the title screen over a living town.
  run(5);
  return { screen: SCREEN_TITLE, pilot: null };
}
