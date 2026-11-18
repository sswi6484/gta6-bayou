// Keyboard input: held keys as a direction, plus edge-triggered actions.
// WASD and arrows drive and walk; E enters/exits a vehicle and interacts;
// F refuels; Space is handbrake (and confirm on menus); P pauses; M mutes.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_REFUEL = 8;
export const ACTION_MUTE = 16;

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'brake',
  ShiftLeft: 'run', ShiftRight: 'run',
};

export function createInput(canvas) {
  const held = new Set();
  let queued = 0;
  let lastDirection = { x: 0, y: 0 };

  function onKeyDown(event) {
    const name = KEYMAP[event.code];
    if (name) {
      held.add(name);
      event.preventDefault();
    }
    if (event.code === 'Space' || event.code === 'Enter') queued |= ACTION_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') queued |= ACTION_PAUSE;
    if (event.code === 'KeyE') queued |= ACTION_ENTER;
    if (event.code === 'KeyF') queued |= ACTION_REFUEL;
    if (event.code === 'KeyM') queued |= ACTION_MUTE;
  }
  function onKeyUp(event) {
    const name = KEYMAP[event.code];
    if (name) held.delete(name);
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  // Clicking the canvas also confirms (start the game from the title screen).
  canvas.addEventListener('pointerdown', () => {
    queued |= ACTION_CONFIRM;
  });

  /** The current drive/walk direction, -1/0/1 on each axis. */
  function direction() {
    const x = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
    const y = (held.has('down') ? 1 : 0) - (held.has('up') ? 1 : 0);
    lastDirection = { x, y };
    return lastDirection;
  }

  /** Whether the run key is held (on foot: run; in a vehicle: nothing). */
  function running() {
    return held.has('run');
  }

  /** Whether the handbrake is held. */
  function braking() {
    return held.has('brake');
  }

  /** Actions pressed since the last call (edge-triggered). */
  function takeActions() {
    const out = queued;
    queued = 0;
    return out;
  }

  /** Test/debug: release every held key. */
  function releaseAll() {
    held.clear();
  }

  /** Test/debug: pretend keys are held (used by the autopilot and play-tests). */
  function setHeld(name, value) {
    if (value) held.add(name);
    else held.delete(name);
  }

  /** Test/debug: queue an edge-triggered action (used by the autopilot). */
  function queueAction(action) {
    queued |= action;
  }

  return { direction, running, braking, takeActions, setHeld, queueAction, releaseAll };
}
