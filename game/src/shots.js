// The screenshot scenes behind ?shot=start|mission|chase|night. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot (drive
// toward the objective, or away from the nearest police car in a chase), so the frame is what a
// short game really looks like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function wrapAngle(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }

/**
 * Drive input toward a target point. Returns {held, enter} shaped like the real input object.
 * If the vehicle is barely moving while throttling, back up and turn to unstick it.
 */
function autopilotDrive(world, tx, ty, stuck) {
  const p = world.state.player;
  const held = { up: false, down: false, left: false, right: false, brake: false };
  const dx = tx - p.x; const dy = ty - p.y;
  const desired = Math.atan2(dy, dx);
  const diff = wrapAngle(desired - p.angle);
  if (stuck > 1) {
    held.down = true;
    held.left = diff > 0;
    held.right = diff <= 0;
    return { held, enter: false };
  }
  held.up = true;
  if (diff > 0.15) held.right = true;
  else if (diff < -0.15) held.left = true;
  return { held, enter: false };
}

function runSteps(world, seconds, drive) {
  let stuck = 0;
  let lastX = world.state.player.x; let lastY = world.state.player.y;
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const input = drive(world, stuck);
    const before = world.state.player.speed;
    world.step(STEP, input, false);
    const p = world.state.player;
    const moved = Math.hypot(p.x - lastX, p.y - lastY);
    if (input.held.up && Math.abs(before) > 30 && moved < 0.4) stuck += STEP;
    else stuck = 0;
    lastX = p.x; lastY = p.y;
    if (world.state.allDone) break;
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the best cash to show.
 * start: title over a live bayou. mission: Fog Run mid-collection. chase: wanted 3 with police
 * on the tail. night: a boat run down the river after dark.
 */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name === 'mission') {
    world.debug.setMission(1);
    const v = world.debug.giveVehicle('car', 700, 1245);
    v.angle = -Math.PI / 2;
    const obj = world.objective();
    runSteps(world, 16, (w, stuck) => autopilotDrive(w, obj.x, obj.y, stuck));
    return { screen: SCREEN_PLAY, best: state.cash };
  }
  if (name === 'chase') {
    const v = world.debug.giveVehicle('car', 1000, 1245);
    v.angle = 0;
    world.debug.setWanted(3);
    runSteps(world, 10, (w, stuck) => {
      // Flee: aim away from the nearest police car.
      let nearest = null; let best = Infinity;
      for (const pv of w.state.vehicles) {
        if (!pv.active || (pv.kind !== 'policeCar' && pv.kind !== 'policeBoat')) continue;
        const d = Math.hypot(pv.x - w.state.player.x, pv.y - w.state.player.y);
        if (d < best) { best = d; nearest = pv; }
      }
      const p = w.state.player;
      const tx = nearest ? p.x + (p.x - nearest.x) : p.x + 600;
      const ty = nearest ? p.y + (p.y - nearest.y) : p.y;
      return autopilotDrive(w, tx, ty, stuck);
    });
    return { screen: SCREEN_PLAY, best: state.cash };
  }
  if (name === 'night') {
    world.debug.setNight(true);
    const v = world.debug.giveVehicle('boat', 1660, 900);
    v.angle = Math.PI / 2;
    runSteps(world, 12, (w, stuck) => autopilotDrive(w, 1660, 2000, stuck));
    return { screen: SCREEN_PLAY, best: state.cash };
  }
  // start (default): a few seconds of ambient traffic behind the title.
  for (let i = 0; i < 5 / STEP; i += 1) world.step(STEP, { held: {}, enter: false }, true);
  return { screen: SCREEN_TITLE, best: 0 };
}
