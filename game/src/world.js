// The world state: everything the game simulates, and the collision helpers every
// system uses. Subsystems (vehicles, traffic, police, missions, player) take the
// state and a step and act on it; this file owns no behaviour of its own.

import {
  WORLD, WATER, ROADS, BRIDGES, BUILDINGS, TREES, CACHES, TRIAL_GATES,
  PLACES, PLAYER, CAR, BOAT,
} from './config.js';

const CAR_NAMES = ['Crawdad', 'Gator', 'Swamp Rat', 'Mudcat', 'Herone', 'Pirogue'];
const CAR_COLORS = ['#d95f4b', '#7a9e4f', '#c9a227', '#5f7fa8', '#a85f9e', '#c97b4a'];
const BOAT_NAMES = ['Bayou Queen', 'Skiff', 'Airboat', 'Crawfish', 'Mudskipper'];
const BOAT_COLORS = ['#4fb3a9', '#8a6a4a', '#c9a227', '#5f7fa8', '#7a9e4f'];

/** True when the point is in the water (river, bayou or backwater) — bridges are dry. */
export function isWater(x, y) {
  for (const b of BRIDGES) {
    if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return false;
  }
  for (const w of WATER) {
    if (x >= w.x && x < w.x + w.w && y >= w.y && y < w.y + w.h) return true;
  }
  return false;
}

/** True when the point is on a bridge deck. */
export function isBridge(x, y) {
  for (const b of BRIDGES) {
    if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return true;
  }
  return false;
}

/** True when the point is on a road (levee roads and streets included). */
export function isRoad(x, y) {
  for (const r of ROADS) {
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return true;
  }
  return false;
}

function circleHitsRect(x, y, r, rect) {
  const cx = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const cy = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy < r * r;
}

function circleHitsTree(x, y, r, tree) {
  const dx = x - tree.x;
  const dy = y - tree.y;
  const rr = r + tree.r * 0.55;
  return dx * dx + dy * dy < rr * rr;
}

/**
 * Whether a circle of radius r at (x, y) is blocked.
 * mode 'land': water blocks, buildings and trees block.
 * mode 'water': land blocks (boats stay in the water), buildings block.
 * mode 'foot': water blocks, buildings and trees block.
 */
export function pointBlocked(x, y, r, mode) {
  if (x < r || y < r || x > WORLD.width - r || y > WORLD.height - r) return true;
  const wet = isWater(x, y);
  // Boats pass under bridges: a bridge deck is dry ground for cars and feet,
  // but the river still flows beneath it. Without this the river is cut in
  // two at every bridge and a boat rams the deck until it wrecks.
  if (mode === 'water' && !wet && !isBridge(x, y)) return true;
  if (mode !== 'water' && wet) return true;
  for (const b of BUILDINGS) {
    if (circleHitsRect(x, y, r, b)) return true;
  }
  for (const t of TREES) {
    if (circleHitsTree(x, y, r, t)) return true;
  }
  return false;
}

/** Move a circle by (dx, dy) with axis separation, so it slides along walls. */
export function moveCircle(x, y, dx, dy, r, mode) {
  let nx = x;
  let ny = y;
  if (!pointBlocked(x + dx, y, r, mode)) nx = x + dx;
  if (!pointBlocked(nx, y + dy, r, mode)) ny = y + dy;
  return { x: nx, y: ny };
}

/** Whether the straight line from (x1, y1) to (x2, y2) crosses a building
 * (with margin r): a car or boat driving straight at a target must not be
 * sent through a wall it will ram at full speed. */
export function lineHitsBuilding(x1, y1, x2, y2, r) {
  const d = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(1, Math.ceil(d / 20));
  for (let i = 0; i <= steps; i += 1) {
    const x = x1 + ((x2 - x1) * i) / steps;
    const y = y1 + ((y2 - y1) * i) / steps;
    for (const b of BUILDINGS) {
      if (circleHitsRect(x, y, r, b)) return true;
    }
  }
  return false;
}

/** Whether the straight line from (x1, y1) to (x2, y2) passes within r of
 * a tree: a car cannot thread the grove's tree field, so a line through it
 * is not a drivable shortcut. */
export function lineHitsTree(x1, y1, x2, y2, r) {
  const d = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(1, Math.ceil(d / 20));
  for (let i = 0; i <= steps; i += 1) {
    const x = x1 + ((x2 - x1) * i) / steps;
    const y = y1 + ((y2 - y1) * i) / steps;
    for (const t of TREES) {
      const dx = x - t.x;
      const dy = y - t.y;
      if (dx * dx + dy * dy < (r + t.r) * (r + t.r)) return true;
    }
  }
  return false;
}

/** A random point on a road, for traffic spawning. */
export function randomRoadPoint(random) {
  const road = ROADS[Math.floor(random.next() * ROADS.length)];
  return {
    x: road.x + random.range(10, road.w - 10),
    y: road.y + random.range(10, road.h - 10),
  };
}

/** A random point in the water, for boat spawning. */
export function randomWaterPoint(random) {
  const w = WATER[Math.floor(random.next() * WATER.length)];
  return {
    x: w.x + random.range(20, w.w - 20),
    y: w.y + random.range(20, w.h - 20),
  };
}

/** A random walkable land point near a road, for pedestrian spawning.
 * Off the road: peds walk the grass, not the street, so a car on the road
 * meets them only while they cross — a hit used to draw the law every time
 * the autopilot drove through town. */
export function randomLandPoint(random) {
  for (let tries = 0; tries < 40; tries += 1) {
    const p = randomRoadPoint(random);
    const x = p.x + random.range(-120, 120);
    const y = p.y + random.range(-120, 120);
    if (!pointBlocked(x, y, 14, 'foot') && !isRoad(x, y)) return { x, y };
  }
  return { x: 300, y: 1200 };
}

function makeVehicle(random, kind, x, y, angle, opts = {}) {
  const spec = kind === 'boat' ? BOAT : CAR;
  return {
    id: opts.id ?? `${kind}-${Math.floor(random.next() * 1e9)}`,
    kind,
    name: opts.name ?? (kind === 'boat' ? random.pick(BOAT_NAMES) : random.pick(CAR_NAMES)),
    color: opts.color ?? (kind === 'boat' ? random.pick(BOAT_COLORS) : random.pick(CAR_COLORS)),
    x, y, angle,
    speed: 0,
    fuel: opts.fuel ?? 100,
    damage: 0,
    police: !!opts.police,
    traffic: !!opts.traffic,
    target: null,
    stuckTimer: 0,
    length: spec.length,
    width: spec.width,
  };
}

/** Build a fresh world. The random generator is seeded, so the same seed builds the same town. */
export function createWorld(random) {
  const state = {
    time: 0,
    dayTime: 0.32, // morning: fog hangs over the swamp
    cash: 0,
    missionIndex: 0, // 0..4 story missions, 5 = all done
    missionStage: 0,
    missionData: {},
    wanted: 0,
    wantedTimer: 0,
    carrying: false, // carrying a mission crate
    trial: { active: false, gate: 0, timeLeft: 0 },
    fog: 0.55,
    stats: { busted: 0, wasted: 0, missionsDone: 0, caches: 0 },
    message: '',
    messageTimer: 0,
    player: {
      x: PLACES.odette.x + 40, y: PLACES.odette.y + 60,
      angle: -Math.PI / 2, speed: 0, health: PLAYER.health,
      onFoot: true, vehicle: null,
    },
    vehicles: [],
    peds: [],
    police: [],
    caches: CACHES.map((c) => ({ ...c, taken: false })),
    trialGates: TRIAL_GATES.map((g) => ({ ...g })),
  };

  // The player's loaner truck, parked by Mama Odette's shack.
  state.vehicles.push(makeVehicle(random, 'car', 1180, 1010, Math.PI / 2, {
    id: 'loaner', name: 'Mudbug', color: '#d95f4b', fuel: 100,
  }));
  // Parked cars around town.
  state.vehicles.push(makeVehicle(random, 'car', 760, 940, 0, { id: 'park1' }));
  state.vehicles.push(makeVehicle(random, 'car', 2500, 940, Math.PI, { id: 'park2' }));
  state.vehicles.push(makeVehicle(random, 'car', 2920, 1120, -Math.PI / 2, { id: 'park3' }));
  state.vehicles.push(makeVehicle(random, 'car', 560, 1300, Math.PI / 2, { id: 'park4' }));
  // Boats at the marina and the docks (all afloat in the river).
  state.vehicles.push(makeVehicle(random, 'boat', 1600, 1850, -Math.PI / 2, { id: 'boat1', name: 'Bayou Queen' }));
  state.vehicles.push(makeVehicle(random, 'boat', 1560, 1960, Math.PI / 2, { id: 'boat2', name: 'Skiff' }));
  state.vehicles.push(makeVehicle(random, 'boat', 1700, 1700, 0, { id: 'boat3', name: 'Airboat' }));

  // Traffic cars on the roads.
  for (let i = 0; i < 8; i += 1) {
    const p = randomRoadPoint(random);
    const v = makeVehicle(random, 'car', p.x, p.y, random.range(0, Math.PI * 2), { traffic: true });
    v.target = randomRoadPoint(random);
    state.vehicles.push(v);
  }
  // Traffic boats on the water.
  for (let i = 0; i < 4; i += 1) {
    const p = randomWaterPoint(random);
    const v = makeVehicle(random, 'boat', p.x, p.y, random.range(0, Math.PI * 2), { traffic: true });
    v.target = randomWaterPoint(random);
    state.vehicles.push(v);
  }
  // Pedestrians wandering the town.
  for (let i = 0; i < 12; i += 1) {
    const p = randomLandPoint(random);
    state.peds.push({
      x: p.x, y: p.y, angle: random.range(0, Math.PI * 2),
      speed: random.range(30, 55), target: null, panic: 0,
    });
  }
  return state;
}

/** Reset a world in place for a new game (keeps the same town layout). */
export function resetWorld(state, random) {
  const fresh = createWorld(random);
  for (const key of Object.keys(fresh)) state[key] = fresh[key];
}
