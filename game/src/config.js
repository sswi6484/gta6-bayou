// Bayou — tuning, palette and the whole map in one place. The world is 3200x2400; the camera
// follows the player and the renderer scales the 1280x720 view to the window.
export const WORLD = { width: 3200, height: 2400 };

// Roads are axis-aligned rects; driving on one is full speed, off-road is slower.
export const ROADS = [
  // horizontal roads
  { x: 0, y: 200, w: 3200, h: 90 }, { x: 0, y: 700, w: 3200, h: 90 },
  { x: 0, y: 1200, w: 3200, h: 90 }, { x: 0, y: 1700, w: 3200, h: 90 },
  { x: 0, y: 2200, w: 3200, h: 90 },
  // vertical roads
  { x: 400, y: 0, w: 90, h: 2400 }, { x: 1000, y: 0, w: 90, h: 2400 },
  { x: 2200, y: 0, w: 90, h: 2400 }, { x: 2800, y: 0, w: 90, h: 2400 },
  // levee roads along both river banks
  { x: 1380, y: 0, w: 80, h: 2400 }, { x: 1880, y: 0, w: 80, h: 2400 },
];

// Water: the river band plus bayou ponds and backwater channels. Boats live here; cars and
// pedestrians cannot enter (bridges cross the river).
export const WATER = [
  { x: 1480, y: 0, w: 360, h: 2400 }, // the river
  { x: 150, y: 850, w: 240, h: 300 }, { x: 1120, y: 1800, w: 240, h: 220 }, // west ponds
  { x: 2300, y: 380, w: 250, h: 280 }, { x: 2320, y: 1900, w: 440, h: 300 }, // east ponds
  { x: 1100, y: 950, w: 280, h: 120 }, // backwater channel west -> levee road
  { x: 1960, y: 1500, w: 220, h: 120 }, // backwater channel east -> river
];

// Bridges over the river (land the player can walk/drive across).
export const BRIDGES = [
  { x: 1440, y: 260, w: 440, h: 110 }, { x: 1440, y: 760, w: 440, h: 110 },
  { x: 1440, y: 1260, w: 440, h: 110 }, { x: 1440, y: 1760, w: 440, h: 110 },
  { x: 1440, y: 2120, w: 440, h: 110 },
];

// Buildings (solid rects). Shanty town west, stilt houses east, docks, motel, warehouse, safehouse.
export const BUILDINGS = [
  // shanty town (west)
  { x: 560, y: 900, w: 130, h: 100, name: 'shack' }, { x: 760, y: 900, w: 110, h: 90, name: 'shack' },
  { x: 880, y: 900, w: 120, h: 100, name: 'shack' }, { x: 560, y: 1080, w: 120, h: 90, name: 'shack' },
  { x: 760, y: 1080, w: 100, h: 100, name: 'shack' }, { x: 860, y: 1080, w: 130, h: 90, name: 'shack' },
  { x: 560, y: 1300, w: 110, h: 100, name: 'shack' }, { x: 760, y: 1300, w: 120, h: 90, name: 'shack' },
  // stilt houses (east)
  { x: 2320, y: 900, w: 130, h: 100, name: 'stilt' }, { x: 2450, y: 900, w: 110, h: 90, name: 'stilt' },
  { x: 2640, y: 900, w: 120, h: 100, name: 'stilt' }, { x: 2320, y: 1080, w: 120, h: 90, name: 'stilt' },
  { x: 2450, y: 1080, w: 100, h: 100, name: 'stilt' }, { x: 2640, y: 1080, w: 130, h: 90, name: 'stilt' },
  // landmarks
  { x: 540, y: 2040, w: 180, h: 120, name: 'motel' }, // Mama Odette's motel (home)
  { x: 2560, y: 330, w: 200, h: 130, name: 'warehouse' },
  { x: 520, y: 380, w: 160, h: 110, name: 'safehouse' },
  { x: 1960, y: 1030, w: 220, h: 90, name: 'docks' }, // shrimp docks, east bank
  { x: 1160, y: 1080, w: 220, h: 90, name: 'docks' }, // west bank landing
];

// Fog banks: circles where visibility collapses (drawn as haze; inside one the screen fogs).
export const FOG_BANKS = [
  { x: 700, y: 1000, r: 260 }, { x: 1150, y: 1900, r: 240 }, { x: 1660, y: 500, r: 220 },
  { x: 2500, y: 600, r: 240 }, { x: 2300, y: 2050, r: 260 }, { x: 400, y: 400, r: 200 },
];

// Parked cars (stealable) and docked boats.
export const PARKED_CARS = [
  { x: 480, y: 245, a: 0 }, { x: 1090, y: 745, a: 1.57 }, { x: 2290, y: 1245, a: 0 },
  { x: 445, y: 1745, a: 1.57 }, { x: 2845, y: 745, a: 0 }, { x: 1045, y: 2245, a: 1.57 },
  { x: 2245, y: 1745, a: 0 }, { x: 1420, y: 1245, a: 1.57 }, { x: 1920, y: 245, a: 0 },
  { x: 640, y: 1245, a: 1.57 },
];
export const DOCKED_BOATS = [
  { x: 1660, y: 420, a: 1.57 }, { x: 1660, y: 1180, a: 1.57 }, { x: 1660, y: 1980, a: 1.57 },
];

// 12 swamp caches (side work, +$25 each). All on dry land a car or walker can reach.
export const CACHES = [
  { x: 320, y: 1250 }, { x: 900, y: 1700 }, { x: 1300, y: 500 }, { x: 2500, y: 750 },
  { x: 2150, y: 1800 }, { x: 600, y: 350 }, { x: 2900, y: 1500 }, { x: 150, y: 1500 },
  { x: 1950, y: 900 }, { x: 1150, y: 1650 }, { x: 2650, y: 1250 }, { x: 350, y: 2150 },
];

// River time-trial gates (6, in order, down the river).
export const TRIAL_GATES = [
  { x: 1660, y: 300 }, { x: 1660, y: 700 }, { x: 1660, y: 1100 },
  { x: 1660, y: 1500 }, { x: 1660, y: 1900 }, { x: 1660, y: 2200 },
];
export const TRIAL_TIME = 95;
export const TRIAL_REWARD = 150;

// Mission scripts: goto / collect / evade / wanted steps, in order. Rewards in $.
export const MISSIONS = [
  {
    name: '1. First Haul', reward: 150,
    steps: [
      { type: 'goto', x: 1300, y: 1300, text: 'Pick up the haul at the west docks' },
      { type: 'goto', x: 630, y: 2200, text: 'Deliver it to Mama Odette at the motel' },
    ],
  },
  {
    name: '2. Fog Run', reward: 300,
    steps: [
      { type: 'collect', count: 5, area: { x: 750, y: 550, r: 200 }, text: 'Find 5 stash crates in the fog' },
      { type: 'goto', x: 630, y: 2200, text: 'Deliver the stash to the motel' },
    ],
  },
  {
    name: '3. Levee Dodge', reward: 400,
    steps: [
      { type: 'goto', x: 2660, y: 520, text: 'Pick up the cargo at the warehouse' },
      { type: 'wanted', level: 2, text: 'The law is onto you — take the levee road south' },
      { type: 'goto', x: 1420, y: 1800, text: 'Slip down the levee road' },
      { type: 'goto', x: 600, y: 540, text: 'Reach the safehouse' },
    ],
  },
  {
    name: '4. Hot Pursuit', reward: 600,
    steps: [
      { type: 'evade', seconds: 30, level: 3, text: 'Lose the law — survive 30 seconds at 3 stars' },
      { type: 'goto', x: 600, y: 540, text: 'Get to the safehouse' },
    ],
  },
  {
    name: '5. The Big Haul', reward: 1000,
    steps: [
      { type: 'wanted', level: 2, text: 'Three drops, law on your tail — drop 1 of 3' },
      { type: 'goto', x: 2660, y: 1800, text: 'Drop 1 of 3 — east docks' },
      { type: 'goto', x: 900, y: 400, text: 'Drop 2 of 3 — north levee' },
      { type: 'goto', x: 2200, y: 2200, text: 'Drop 3 of 3 — south flats' },
      { type: 'goto', x: 630, y: 2200, text: 'Bring it home to the motel' },
    ],
  },
];

export const STEP = 1 / 60;
export const VIEW = { width: 1280, height: 720 };

export const PLAYER = { radius: 14, walkSpeed: 210, runSpeed: 300 };
export const CAR = { accel: 520, maxSpeed: 430, offroadMax: 235, reverseMax: 160, turn: 2.7, radius: 17, hp: 100 };
export const BOAT = { accel: 430, maxSpeed: 390, turn: 2.3, radius: 17, hp: 100 };
export const POLICE = { accel: 520, maxSpeed: 400, turn: 3.0, ramDamage: 6, ramCooldown: 1.5 };
export const TRAFFIC_COUNT = 8;
export const PED_COUNT = 10;

export const WANTED_DECAY_SECONDS = 12;

export const PALETTE = {
  day: {
    backdrop: '#0e1420', land: '#3d5a3a', landDry: '#6b7a45', road: '#3a3f47', roadLine: '#c9b458',
    water: '#1d4e5f', waterDeep: '#14404f', bridge: '#5a4632', building: '#7a5a3a', stilt: '#6b4f30',
    motel: '#8a6a2f', warehouse: '#5a6a7a', safehouse: '#4a6a4f', docks: '#6a5138',
    fog: 'rgba(200,210,200,0.16)', fogDense: 'rgba(210,220,210,0.55)',
    player: '#f2c94c', playerFoot: '#e8a33d', car: '#c94f42', boat: '#e8e0c8', police: '#2f6fb2',
    policeBoat: '#2f6fb2', traffic: '#8a93a3', ped: '#d8c9a3', cache: '#7ee787', marker: '#ffd94d',
    text: '#eef1f5', muted: '#b9c2cc', panel: 'rgba(16,20,28,0.88)', danger: '#e5534b', star: '#ffd94d',
  },
  night: {
    backdrop: '#070a12', land: '#22331f', landDry: '#3a4226', road: '#23272f', roadLine: '#8a7a3a',
    water: '#0f2c38', waterDeep: '#0a222c', bridge: '#3a2d1f', building: '#4a3622', stilt: '#41301d',
    motel: '#54401c', warehouse: '#35424e', safehouse: '#2c4230', docks: '#413120',
    fog: 'rgba(160,170,180,0.10)', fogDense: 'rgba(170,180,190,0.4)',
    player: '#f2c94c', playerFoot: '#e8a33d', car: '#8a3328', boat: '#9a9278', police: '#1f4d80',
    policeBoat: '#1f4d80', traffic: '#565e6c', ped: '#8a7c5e', cache: '#4a9a58', marker: '#ffd94d',
    text: '#dfe5ec', muted: '#8a94a3', panel: 'rgba(10,13,18,0.9)', danger: '#c93a32', star: '#ffd94d',
  },
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const SAVE_KEY = 'bayou.save.v1';
export const BEST_KEY = 'bayou.best.v1';
