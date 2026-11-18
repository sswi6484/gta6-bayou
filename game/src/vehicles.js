// Vehicle physics: arcade cars and boats. A car steers by its heading and speed;
// a boat is the same idea with more drift. Traffic vehicles steer themselves
// toward waypoints; the player's vehicle answers the input direction.

import { CAR, BOAT } from './config.js';
import { isRoad, isWater, moveCircle, randomRoadPoint, randomWaterPoint } from './world.js';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function angleTo(fromX, fromY, toX, toY) {
  return Math.atan2(toY - fromY, toX - fromX);
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Step one vehicle for dt seconds.
 * drive: { throttle: -1..1, steer: -1..1 } — throttle forward/back, steer left/right.
 * Returns true when the vehicle hit something hard this step.
 */
export function stepVehicle(state, v, dt, drive) {
  const spec = v.kind === 'boat' ? BOAT : CAR;
  const mode = v.kind === 'boat' ? 'water' : 'land';

  // Fuel: no fuel, no drive.
  const hasFuel = v.fuel > 0;
  const throttle = hasFuel ? drive.throttle : 0;
  if (throttle !== 0) v.fuel = Math.max(0, v.fuel - spec.fuelDrain * Math.abs(throttle) * dt);

  const accel = throttle > 0 ? spec.accel : spec.brake;
  v.speed += accel * throttle * dt;
  // Drag and rolling resistance.
  v.speed -= v.speed * (v.kind === 'boat' ? 0.55 : 0.8) * dt;
  const max = throttle < 0 ? spec.reverseSpeed : spec.maxSpeed;
  v.speed = clamp(v.speed, -spec.reverseSpeed, max);

  // Off-road cars crawl; boats are at home only on water.
  let factor = 1;
  if (v.kind === 'car' && !isRoad(v.x, v.y)) factor = CAR.offRoadFactor;
  const speed = v.speed * factor;

  // Steering only bites while moving, and more at low speed.
  const steerAuthority = clamp(Math.abs(speed) / 120, 0.15, 1);
  v.angle += drive.steer * spec.turnRate * steerAuthority * Math.sign(speed || 1) * dt;

  const dx = Math.cos(v.angle) * speed * dt;
  const dy = Math.sin(v.angle) * speed * dt;
  const before = { x: v.x, y: v.y };
  const moved = moveCircle(v.x, v.y, dx, dy, v.length / 2, mode);
  const hit = (moved.x === before.x && Math.abs(dx) > 0.01) || (moved.y === before.y && Math.abs(dy) > 0.01);
  v.x = moved.x;
  v.y = moved.y;
  if (hit && Math.abs(speed) > 120) {
    v.damage = Math.min(100, v.damage + Math.abs(speed) * 0.001 * dt * 60);
    v.speed *= 0.4;
  }
  return hit;
}

/** Steer a traffic vehicle toward its waypoint; pick a new one when it arrives. */
export function driveTraffic(state, v, random, dt) {
  if (!v.target) v.target = v.kind === 'boat' ? randomWaterPoint(random) : randomRoadPoint(random);
  const d = Math.hypot(v.target.x - v.x, v.target.y - v.y);
  if (d < 60) {
    v.target = v.kind === 'boat' ? randomWaterPoint(random) : randomRoadPoint(random);
    return { throttle: 0, steer: 0 };
  }
  const want = angleTo(v.x, v.y, v.target.x, v.target.y);
  const diff = angleDiff(want, v.angle);
  const steer = clamp(diff * 2, -1, 1);
  // Slow down for sharp turns so traffic does not spin out.
  const throttle = Math.abs(diff) > 1.2 ? 0.25 : 0.6;
  // Unstick: if barely moving for a while, reverse briefly.
  if (Math.abs(v.speed) < 5) v.stuckTimer += dt;
  else v.stuckTimer = 0;
  if (v.stuckTimer > 1.5) {
    v.stuckTimer = -1.5;
    return { throttle: -0.8, steer: -steer };
  }
  return { throttle, steer };
}

/** Steer a vehicle toward a point (used by the autopilot and the police). */
export function driveToward(v, tx, ty, fullSpeed = true) {
  const want = angleTo(v.x, v.y, tx, ty);
  const diff = angleDiff(want, v.angle);
  const steer = clamp(diff * 2.2, -1, 1);
  const throttle = fullSpeed ? (Math.abs(diff) > 1.4 ? 0.3 : 1) : 0.6;
  return { throttle, steer };
}

/** The nearest vehicle of any kind within radius of a point (ignores wrecked ones). */
export function nearestVehicle(state, x, y, radius) {
  let best = null;
  let bestD = radius;
  for (const v of state.vehicles) {
    if (v.damage >= 100) continue;
    const d = Math.hypot(v.x - x, v.y - y);
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  return best;
}

/** The nearest boat within radius (for boarding from the shore or the water). */
export function nearestBoat(state, x, y, radius) {
  let best = null;
  let bestD = radius;
  for (const v of state.vehicles) {
    if (v.kind !== 'boat' || v.damage >= 100) continue;
    const d = Math.hypot(v.x - x, v.y - y);
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  return best;
}
