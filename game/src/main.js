// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between six screens: title, play, paused,
// busted, wasted and all done.
//
// ?seed=N fixes the world. ?shot=cover|mission|chase|night (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, resetWorld } from './world.js';
import {
  ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER, ACTION_REFUEL, ACTION_MUTE, createInput,
} from './input.js';
import { createAudio } from './audio.js';
import { stepPlayer, bustPlayer, wastePlayer } from './player.js';
import { stepTraffic } from './traffic.js';
import { stepPolice } from './police.js';
import { stepMissions } from './missions.js';
import {
  createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED,
  SCREEN_BUSTED, SCREEN_WASTED, SCREEN_DONE,
} from './render.js';
import { stageShot, autopilot, fleePilot } from './shots.js';
import { saveGame, loadGame, applySave } from './save.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const random = createRandom(seed);
const state = createWorld(random);
const input = createInput(canvas);
const renderer = createRenderer(canvas);
const audio = createAudio();

const saved = loadGame();
if (saved) applySave(state, saved);
let best = saved ? saved.cash : 0;

/** Parse the edge-triggered action bitmask into named booleans. */
function readActions() {
  const bits = input.takeActions();
  return {
    confirm: !!(bits & ACTION_CONFIRM),
    pause: !!(bits & ACTION_PAUSE),
    enter: !!(bits & ACTION_ENTER),
    refuel: !!(bits & ACTION_REFUEL),
    mute: !!(bits & ACTION_MUTE),
  };
}

/** One fixed world step: player, traffic, police, missions, timers, sound.
 * `acts` is the edge-triggered actions for this step (only the first step of a
 * frame carries them, so one key press never fires twice). */
function stepWorld(dt, acts) {
  state.time += dt;
  if (state.messageTimer > 0) state.messageTimer -= dt;
  if (acts.mute) {
    audio.setMuted(!audio.muted);
    state.message = audio.muted ? 'Sound off (M to turn back on).' : 'Sound on.';
    state.messageTimer = 2;
  }
  stepPlayer(state, input, acts, dt, audio);
  stepTraffic(state, random, dt);
  const outcome = stepPolice(state, random, dt, audio);
  if (outcome === 'busted') {
    bustPlayer(state);
    audio.bad();
    return 'busted';
  }
  if (outcome === 'wasted') {
    wastePlayer(state);
    audio.bad();
    return 'wasted';
  }
  stepMissions(state, dt, audio);
  // Fog thickens at dawn and after rain; the night is the darkest watch.
  state.fog = 0.45 + 0.2 * Math.sin(state.time * 0.01);
  // Engine and siren follow the action.
  const veh = state.player.vehicle;
  if (veh && !audio.muted) {
    audio.startEngine();
    audio.setEngine(Math.abs(veh.speed) / 460, true);
  } else {
    audio.setEngine(0, false);
  }
  if (state.wanted > 0 && !audio.muted) audio.startSiren();
  else audio.stopSiren();
  return null;
}

function runShot(name) {
  // The chase scene flees from the law; the others follow the mission autopilot.
  const pilot = name === 'chase' ? fleePilot : null;
  const step = () => {
    // The world steps first and the pilot steers after it, for the same reason
    // as in the game loop: an ENTER queued while on foot must not still be in
    // flight the step the player climbs in. The pilot's held keys carry into
    // the next step.
    stepWorld(STEP, readActions());
    if (pilot) pilot(state, input, STEP);
    else autopilot(state, input, STEP);
  };
  const scene = stageShot(name, state, step);
  // The scene staged itself by calling step() above; paint it twice.
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen, { best, muted: audio.muted });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let saveTimer = 0;
  let autoMode = false; // test hook: the mission autopilot drives while the game runs
  let doneShown = false;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    screen = SCREEN_PLAY;
    announce('Playing. Remy owes Mama Odette — get moving.');
    audio.resume();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const acts = readActions();
    if (acts.mute) {
      audio.setMuted(!audio.muted);
      state.message = audio.muted ? 'Sound off.' : 'Sound on.';
      state.messageTimer = 2;
      acts.mute = false; // handled once here; the world step must not toggle it again
    }
    if (screen === SCREEN_TITLE) {
      if (acts.confirm) startGame();
      // The town lives behind the title.
      while (accumulator >= STEP) {
        stepTraffic(state, random, STEP);
        state.time += STEP;
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      if (acts.pause) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else {
        let outcome = null;
        let firstStep = true;
        while (accumulator >= STEP && screen === SCREEN_PLAY) {
          outcome = stepWorld(STEP, firstStep ? acts : { confirm: false, pause: false, enter: false, refuel: false, mute: false });
          firstStep = false;
          accumulator -= STEP;
          if (outcome === 'busted') {
            screen = SCREEN_BUSTED;
            announce('Busted. The sheriff takes you in.');
            audio.stopSiren();
            audio.stopEngine();
          } else if (outcome === 'wasted') {
            screen = SCREEN_WASTED;
            announce('Wasted. You went down in the swamp.');
            audio.stopSiren();
            audio.stopEngine();
          }
        }
        // The autopilot steers from the state after this frame's steps: if it
        // ran before them, an ENTER queued while on foot would still be in
        // flight the frame the player climbs in, and would climb straight back
        // out again. Its held keys carry into the next frame's steps.
        if (autoMode && screen === SCREEN_PLAY) autopilot(state, input, STEP);
        if (screen === SCREEN_PLAY && state.missionIndex >= 5 && !doneShown) {
          doneShown = true;
          screen = SCREEN_DONE;
          announce('All missions done. The bayou is yours.');
          audio.jingle();
        }
        saveTimer += 1;
        if (saveTimer > 900) {
          saveTimer = 0;
          saveGame(state);
          best = Math.max(best, state.cash);
        }
      }
    } else if (screen === SCREEN_PAUSED) {
      if (acts.pause || acts.confirm) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      accumulator = 0;
    } else if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED || screen === SCREEN_DONE) {
      if (acts.confirm) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      accumulator = 0;
    } else {
      accumulator = 0;
    }
    renderer.draw(state, screen, { best, muted: audio.muted });
  }

  // Leaving the tab pauses a running game rather than letting the law close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // Debug / play-test API: the tests drive the real game through this.
  window.BAYOU = {
    state,
    input,
    screen: () => screen,
    start: () => startGame(),
    teleport(x, y) {
      const p = state.player;
      if (p.vehicle) {
        p.vehicle.x = x;
        p.vehicle.y = y;
        p.vehicle.speed = 0;
      }
      p.x = x;
      p.y = y;
    },
    setMission(index, stage = 0) {
      state.missionIndex = index;
      state.missionStage = stage;
      state.missionData = {};
    },
    setWanted(n) {
      state.wanted = n;
      state.wantedTimer = 0;
    },
    setCash(n) {
      state.cash = n;
    },
    enterVehicle() {
      input.queueAction(ACTION_ENTER);
    },
    setAuto(v) {
      autoMode = !!v;
      if (!autoMode) input.releaseAll();
    },
    reset() {
      resetWorld(state, createRandom(seed));
      const again = loadGame();
      if (again) applySave(state, again);
      doneShown = false;
      screen = SCREEN_TITLE;
    },
  };

  announce('Bayou. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
