// Bayou — every tuning number, colour and named place in one place.
// The world is a fixed 3200x2400 swamp river-delta town; the renderer scales the
// camera view to the window, so no rule below depends on the screen size.

export const WORLD = { width: 3200, height: 2400 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Water: the river, the bayou channels and the backwater pond. Boats live here; cars and feet do not. */
export const WATER = [
  { x: 1500, y: 0, w: 350, h: 2400, name: 'river' },          // main river, north-south
  { x: 0, y: 1500, w: 1500, h: 150, name: 'west bayou' },      // west bayou channel
  { x: 1850, y: 700, w: 1350, h: 120, name: 'east bayou' },    // east bayou channel
  { x: 300, y: 1980, w: 1250, h: 340, name: 'backwater' },     // southern backwater pond (joins the river)
];

/** Roads: drivable land strips. Bridges are the road strips that cross the river. */
export const ROADS = [
  { x: 0, y: 1000, w: 3200, h: 80, name: 'Main Street' },
  { x: 1300, y: 0, w: 80, h: 2400, name: 'West Levee Road' },
  { x: 1950, y: 0, w: 80, h: 2400, name: 'East Levee Road' },
  { x: 500, y: 800, w: 80, h: 1000, name: 'Cypress Street' },
  { x: 900, y: 800, w: 80, h: 1000, name: 'Magnolia Street' },
  { x: 2400, y: 400, w: 80, h: 1600, name: 'Mill Road' },
  { x: 2800, y: 400, w: 80, h: 1600, name: 'Depot Street' },
  { x: 0, y: 2000, w: 3200, h: 70, name: 'South Bridge Road' },
  { x: 200, y: 400, w: 1100, h: 60, name: 'Grove Dirt Road' },
];

/** Buildings: solid rectangles the player, cars and boats cannot pass through. */
export const BUILDINGS = [
  // Riverfront shanty town (west bank)
  { x: 1050, y: 880, w: 90, h: 70, name: "Mama Odette's Shack", kind: 'shack' },
  { x: 1150, y: 1150, w: 80, h: 60, name: 'Stilt House 1', kind: 'stilt' },
  { x: 1150, y: 1280, w: 80, h: 60, name: 'Stilt House 2', kind: 'stilt' },
  { x: 1150, y: 1410, w: 80, h: 60, name: 'Stilt House 3', kind: 'stilt' },
  { x: 600, y: 880, w: 110, h: 80, name: 'Bayou Church', kind: 'church' },
  { x: 750, y: 1180, w: 120, h: 80, name: 'Crawdad Cafe', kind: 'cafe' },
  { x: 400, y: 1180, w: 100, h: 70, name: 'Bait Shop', kind: 'shop' },
  // Shrimp docks (east bank of the river)
  { x: 1900, y: 1820, w: 140, h: 90, name: 'Shrimp Dock Warehouse', kind: 'dock' },
  { x: 2100, y: 1900, w: 100, h: 70, name: 'Ice House', kind: 'dock' },
  // East town
  { x: 2550, y: 560, w: 170, h: 110, name: 'Old Sugar Mill', kind: 'mill' },
  { x: 2500, y: 1120, w: 130, h: 90, name: 'Crawdad Motel', kind: 'motel' },
  { x: 2350, y: 1120, w: 120, h: 80, name: "Sheriff's Office", kind: 'sheriff' },
  { x: 2650, y: 1300, w: 110, h: 80, name: 'General Store', kind: 'store' },
  { x: 2850, y: 900, w: 100, h: 70, name: 'Depot', kind: 'depot' },
  // Gas & Go on Main Street (west)
  { x: 640, y: 1120, w: 120, h: 70, name: 'Gas & Go', kind: 'gas' },
];

/** Named places the missions and HUD point at. */
export const PLACES = {
  odette: { x: 1100, y: 960, label: "Mama Odette's Shack" },
  stiltRow: { x: 1190, y: 1350, label: 'Stilt-House Row' },
  docks: { x: 1880, y: 1890, label: 'Shrimp Docks' },
  mill: { x: 2635, y: 640, label: 'Old Sugar Mill' },
  motel: { x: 2565, y: 1165, label: 'Crawdad Motel' },
  gas: { x: 700, y: 1160, label: 'Gas & Go' },
  marina: { x: 1470, y: 1900, label: 'Marina' },
  sheriff: { x: 2410, y: 1180, label: "Sheriff's Office" },
  grove: { x: 700, y: 500, label: 'Cypress Grove' },
  backwater: { x: 800, y: 2120, label: 'Backwater' },
};

/** Bridges: road decks over the water, where a car crosses and a boat cannot. */
export const BRIDGES = [
  { x: 1500, y: 1000, w: 350, h: 80, name: 'Main Street Bridge' },
  { x: 1500, y: 2000, w: 350, h: 70, name: 'South Bridge' },
  { x: 1300, y: 1500, w: 80, h: 150, name: 'West Levee Bridge' },
  { x: 500, y: 1500, w: 80, h: 150, name: 'Cypress Bridge' },
  { x: 900, y: 1500, w: 80, h: 150, name: 'Magnolia Bridge' },
  { x: 1950, y: 700, w: 80, h: 120, name: 'East Levee Bridge' },
  { x: 2400, y: 700, w: 80, h: 120, name: 'Mill Road Bridge' },
  { x: 2800, y: 700, w: 80, h: 120, name: 'Depot Bridge' },
];

/** The sheriff checkpoint on the Main Street bridge: crossing it with contraband raises the heat. */
export const CHECKPOINT = { x: 1560, y: 1000, w: 230, h: 80 };

/** Cypress trees: solid circles, dense in the grove and scattered through the swamp. */
/** Stash crates for mission 2, hidden in the foggy Cypress Grove. */
export const STASH_SPOTS = [
  { x: 350, y: 300 }, { x: 800, y: 250 }, { x: 1150, y: 550 },
  { x: 450, y: 700 }, { x: 950, y: 180 },
];

export const TREES = [
  // Cypress grove (north-west) — kept clear around each stash crate, so the
  // crates are reachable on foot between the trees.
  ...Array.from({ length: 26 }, (_, i) => ({
    x: 220 + ((i * 173) % 950), y: 130 + ((i * 97) % 480), r: 26 + ((i * 13) % 14),
  })).filter((t) => !STASH_SPOTS.some((s) => Math.hypot(t.x - s.x, t.y - s.y) < 90)),
  // Swamp south-west
  ...Array.from({ length: 14 }, (_, i) => ({
    x: 150 + ((i * 211) % 1200), y: 1750 + ((i * 61) % 300), r: 24 + ((i * 11) % 12),
  })),
  // East bayou banks
  ...Array.from({ length: 10 }, (_, i) => ({
    x: 2050 + ((i * 127) % 1000), y: 560 + ((i * 53) % 110), r: 22 + ((i * 7) % 10),
  })),
  ...Array.from({ length: 8 }, (_, i) => ({
    x: 2100 + ((i * 149) % 900), y: 880 + ((i * 41) % 90), r: 22 + ((i * 5) % 10),
  })),
];

/** The 12 swamp caches (side work, +$25 each). */
export const CACHES = [
  { x: 350, y: 300 }, { x: 800, y: 250 }, { x: 1150, y: 550 }, { x: 450, y: 700 },
  { x: 250, y: 1600 }, { x: 600, y: 2050 }, { x: 1000, y: 2250 }, { x: 1350, y: 2100 },
  { x: 1700, y: 350 }, { x: 2200, y: 950 }, { x: 2900, y: 1500 }, { x: 3050, y: 2100 },
];

/** The river time-trial gates (boat only): 6 gates down the river, 95 seconds, $150. */
export const TRIAL_GATES = [
  { x: 1675, y: 300 }, { x: 1675, y: 650 }, { x: 1675, y: 1000 },
  { x: 1675, y: 1350 }, { x: 1675, y: 1700 }, { x: 1675, y: 2050 },
];

export const PLAYER = {
  radius: 14,
  walkSpeed: 210,
  runSpeed: 300,
  health: 100,
};

export const CAR = {
  length: 52,
  width: 26,
  accel: 420,
  brake: 700,
  maxSpeed: 460,
  reverseSpeed: 160,
  turnRate: 2.6,
  offRoadFactor: 0.45,
  fuelDrain: 0.9, // per second at full throttle
};

export const BOAT = {
  length: 58,
  width: 26,
  accel: 300,
  brake: 500,
  maxSpeed: 420,
  reverseSpeed: 120,
  turnRate: 1.9,
  fuelDrain: 0.8,
};

export const WANTED_MAX = 5;
/** Seconds with no police in sight before one star drops. */
export const WANTED_DECAY_SECONDS = 10;

export const MISSIONS = [
  { id: 1, name: 'First Haul', pay: 150, brief: 'See Mama Odette at her shack, then deliver the crate to the Stilt-House Row.' },
  { id: 2, name: 'Fog Run', pay: 300, brief: 'Collect 5 stash crates hidden in the foggy Cypress Grove.' },
  { id: 3, name: 'Levee Dodge', pay: 400, brief: 'Pick up at the Old Sugar Mill, deliver to the Shrimp Docks. The sheriff checkpoint on the Main Street bridge is watching — take the levee road or the river instead.' },
  { id: 4, name: 'Hot Pursuit', pay: 600, brief: 'The law is all over you. Lose the heat, then slip into Mama Odette’s shack.' },
  { id: 5, name: 'The Big Haul', pay: 1000, brief: 'Three drops while the heat is on: Shrimp Docks, Old Sugar Mill, Crawdad Motel.' },
];

export const TRIAL = { pay: 150, timeLimit: 95, gates: 6 };
export const CACHE_PAY = 25;

export const PALETTE = {
  water: '#1d4e5f',
  waterDeep: '#14394a',
  waterShallow: '#2a6b7d',
  land: '#4a5d3a',
  landDry: '#5d6b43',
  swamp: '#3d5230',
  road: '#5a5148',
  roadLine: '#c9b458',
  levee: '#6b5d4a',
  bridge: '#7a6a52',
  building: '#7a5c42',
  buildingRoof: '#8a6a4a',
  stilt: '#6b4a35',
  tree: '#2c4a26',
  treeDark: '#1e3319',
  fog: 'rgba(200, 210, 200, 0.16)',
  night: 'rgba(6, 10, 26, 0.55)',
  player: '#f2c94c',
  car: '#d95f4b',
  boat: '#4fb3a9',
  police: '#3a6fd8',
  policeBoat: '#2f5cb8',
  ped: '#e8dcc8',
  hud: '#101820',
  hudText: '#eef1f5',
  hudMuted: '#9aa5b1',
  gold: '#f2c94c',
  danger: '#e5534b',
  ok: '#58b368',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save lives between visits (this browser only). */
export const SAVE_KEY = 'bayou.save.v1';

/** Fog banks drift across the swamp; each is a soft circle of mist. */
export const FOG_BANKS = [
  { x: 600, y: 500, r: 420 }, { x: 1200, y: 1600, r: 380 }, { x: 2400, y: 800, r: 360 },
  { x: 800, y: 2100, r: 460 }, { x: 2800, y: 1800, r: 380 }, { x: 1700, y: 1200, r: 300 },
];
