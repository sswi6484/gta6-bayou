// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. Screens:
// title, play, paused, busted, wasted, done. Progress (cash, missions, caches) autosaves to
// localStorage; Space starts or continues, N starts a new game from the title.
//
// ?seed=N fixes the random pattern. ?shot=start|mission|chase|night (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady.
import { BEST_KEY, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld, EVENT_ALL_DONE, EVENT_BUSTED, EVENT_CASH, EVENT_CRASH, EVENT_MISSION,
  EVENT_PICKUP, EVENT_WASTED,
} from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_NEW, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  createRenderer, SCREEN_BUSTED, SCREEN_DONE, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE,
  SCREEN_WASTED,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(world.serialize()));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}
function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}
function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // See writeSave.
  }
}

// Continue a saved run when there is one.
const saved = readSave();
if (saved) world.applySave(saved);
window.__bayou = { state: world.state, world, objective: () => world.objective() };

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, world.objective());
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  window.__bayou.screen = () => screen;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  // Enter is a one-shot press: take it once per frame and hand it to the first sub-step.
  let pendingEnter = false;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce(`Playing. ${world.objective().text}`);
  }

  function newGame() {
    world.reset();
    writeSave();
    startGame();
  }

  function endRun(nextScreen, message) {
    screen = nextScreen;
    const cash = world.state.cash;
    if (cash > best) { best = cash; saveBest(best); }
    writeSave();
    announce(message);
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) audio.setMuted(!audio.isMuted());
    if (actions & ACTION_ENTER) pendingEnter = true;
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_NEW) newGame();
      else if (actions & ACTION_CONFIRM) startGame();
      return;
    }
    if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) { screen = SCREEN_PAUSED; announce('Paused.'); }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) { screen = SCREEN_PLAY; announce('Playing.'); }
      return;
    }
    if (actions & ACTION_CONFIRM) {
      if (screen === SCREEN_DONE) { screen = SCREEN_PLAY; announce('Playing.'); return; }
      // Busted / wasted: bail out, half the cash gone, back at the motel on foot.
      world.state.cash = Math.floor(world.state.cash / 2);
      const p = world.state.player;
      if (p.vehicle) { p.vehicle.active = false; p.vehicle = null; }
      p.onFoot = true;
      p.x = 630; p.y = 1980; p.angle = -Math.PI / 2; p.speed = 0;
      world.state.wanted = 0;
      world.state.bustTimer = 0;
      // Restart the current mission from its first step.
      world.debug.setMission(world.state.missionIndex);
      writeSave();
      startGame();
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { held: {}, enter: false }, true);
      return;
    }
    const enter = pendingEnter;
    pendingEnter = false;
    const held = input.held;
    const events = world.step(STEP, { held, enter }, false);
    if (events & EVENT_BUSTED) {
      audio.busted();
      endRun(SCREEN_BUSTED, 'Busted. The law caught Remy.');
    } else if (events & EVENT_WASTED) {
      audio.crash();
      endRun(SCREEN_WASTED, 'Wasted. The ride went up in smoke.');
    } else if (events & EVENT_ALL_DONE) {
      audio.mission();
      endRun(SCREEN_DONE, 'All missions done.');
    } else {
      if (events & EVENT_PICKUP) audio.pickup();
      if (events & EVENT_MISSION) audio.mission();
      if (events & EVENT_CRASH) audio.crash();
      if (events & (EVENT_CASH | EVENT_MISSION)) writeSave();
    }
    audio.update(world.state.player.speed, world.state.wanted);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions(input.takeActions());
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, world.objective());
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Bayou. Press Space to play.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
