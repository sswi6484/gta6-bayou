// Ambient life: traffic cars and boats cruising their routes, and pedestrians
// wandering the town. Pedestrians panic and flee from a speeding vehicle; a
// vehicle that runs one down draws the law.

import { PLAYER } from './config.js';
import { isWater, moveCircle, pointBlocked, randomLandPoint, randomRoadPoint, randomWaterPoint } from './world.js';
import { driveTraffic, stepVehicle } from './vehicles.js';

/** Step all traffic vehicles and pedestrians for dt seconds. */
export function stepTraffic(state, random, dt) {
  for (const v of state.vehicles) {
    if (!v.traffic || v.damage >= 100) continue;
    const drive = driveTraffic(state, v, random, dt);
    stepVehicle(state, v, dt, drive);
  }

  // A fast vehicle bearing down: panic and step off its path BEFORE it
  // arrives. Peds only fled after being hit, so a car at full speed ran them
  // down first — and every hit draws the law, which then wrecks the car.
  const pv0 = state.player.vehicle;
  if (pv0 && Math.abs(pv0.speed) > 100) {
    for (const ped of state.peds) {
      if (ped.panic <= 0 && Math.hypot(ped.x - pv0.x, ped.y - pv0.y) < 220) ped.panic = 2;
    }
  }
  for (const ped of state.peds) {
    if (ped.panic > 0) {
      ped.panic -= dt;
      // Flee off the vehicle's path, not along it: step perpendicular to its
      // heading, on the side the ped is already on, so a car bearing down
      // passes beside them instead of running them down.
      let away = Math.atan2(ped.y - state.player.y, ped.x - state.player.x);
      if (pv0 && Math.abs(pv0.speed) > 60) {
        const cross = (ped.x - pv0.x) * Math.sin(pv0.angle) - (ped.y - pv0.y) * Math.cos(pv0.angle);
        away = pv0.angle + (cross >= 0 ? 1 : -1) * Math.PI / 2;
      }
      const moved = moveCircle(ped.x, ped.y, Math.cos(away) * 150 * dt, Math.sin(away) * 150 * dt, 10, 'foot');
      ped.x = moved.x;
      ped.y = moved.y;
      ped.angle = away;
      continue;
    }
    if (!ped.target || Math.hypot(ped.target.x - ped.x, ped.target.y - ped.y) < 30) {
      ped.target = randomLandPoint(random);
    }
    const want = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
    ped.angle = want;
    const moved = moveCircle(ped.x, ped.y, Math.cos(want) * ped.speed * dt, Math.sin(want) * ped.speed * dt, 10, 'foot');
    ped.x = moved.x;
    ped.y = moved.y;
  }

  // The player's vehicle running a pedestrian down. Test the car's real
  // rectangle (length/width + ped radius), not a circle around its centre:
  // a ped standing beside the car, clear of its body, is not run down.
  const pv = state.player.vehicle;
  if (pv && Math.abs(pv.speed) > 60) {
    const cos = Math.cos(pv.angle);
    const sin = Math.sin(pv.angle);
    for (const ped of state.peds) {
      const dx = ped.x - pv.x;
      const dy = ped.y - pv.y;
      const along = dx * cos + dy * sin;
      const perp = -dx * sin + dy * cos;
      if (Math.abs(along) < pv.length / 2 + 10 && Math.abs(perp) < pv.width / 2 + 10) {
        ped.panic = 6;
        // Shove the pedestrian aside.
        const away = Math.atan2(ped.y - pv.y, ped.x - pv.x);
        const moved = moveCircle(ped.x, ped.y, Math.cos(away) * 60, Math.sin(away) * 60, 10, 'foot');
        ped.x = moved.x;
        ped.y = moved.y;
        if (state.wanted < 5) {
          state.wanted = Math.min(5, state.wanted + 1);
          state.wantedTimer = 0;
          state.message = 'You hit a pedestrian! The law is coming.';
          state.messageTimer = 3;
        }
      }
    }
  }

  // A pedestrian bumping into the player on foot just panics.
  if (state.player.onFoot) {
    for (const ped of state.peds) {
      if (Math.hypot(ped.x - state.player.x, ped.y - state.player.y) < 26) ped.panic = 3;
    }
  }
}
