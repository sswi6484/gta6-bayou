// The story: five missions for Mama Odette, plus swamp caches and the river
// time trial. Objectives trigger on arrival — no extra keys to learn — and the
// HUD reads the current objective from here.

import { MISSIONS, PLACES, CHECKPOINT, CACHE_PAY, TRIAL, STASH_SPOTS } from './config.js';

function near(state, place, radius = 90) {
  return Math.hypot(state.player.x - place.x, state.player.y - place.y) < radius;
}

function say(state, message, seconds = 3) {
  state.message = message;
  state.messageTimer = seconds;
}

function completeMission(state, audio) {
  const m = MISSIONS[state.missionIndex];
  state.cash += m.pay;
  state.stats.missionsDone += 1;
  state.carrying = false;
  state.missionIndex += 1;
  state.missionStage = 0;
  state.missionData = {};
  say(state, `${m.name} done — $${m.pay} in your pocket.`, 4);
  audio.jingle();
}

/** The current objective text for the HUD. */
export function objectiveText(state) {
  if (state.missionIndex >= MISSIONS.length) return 'All missions done. The bayou is yours — keep the cash coming.';
  const m = MISSIONS[state.missionIndex];
  switch (state.missionIndex) {
    case 0:
      return state.missionStage === 0
        ? 'Mission 1 — First Haul: see Mama Odette at her shack.'
        : 'Mission 1 — First Haul: deliver the crate to the Stilt-House Row.';
    case 1:
      return `Mission 2 — Fog Run: collect the stash crates in the Cypress Grove (${state.missionData.collected ?? 0}/5).`;
    case 2:
      return state.missionStage === 0
        ? 'Mission 3 — Levee Dodge: pick up at the Old Sugar Mill.'
        : 'Mission 3 — Levee Dodge: deliver to the Shrimp Docks. Avoid the checkpoint on the Main Street bridge!';
    case 3:
      return state.missionStage === 0
        ? 'Mission 4 — Hot Pursuit: lose the heat (wanted 3 → 0).'
        : 'Mission 4 — Hot Pursuit: slip into Mama Odette’s shack.';
    case 4: {
      const drops = ['Shrimp Docks', 'Old Sugar Mill', 'Crawdad Motel'];
      return `Mission 5 — The Big Haul: drop ${state.missionStage + 1} of 3 — ${drops[state.missionStage]}.`;
    }
    default:
      return m.brief;
  }
}

/** Step the missions, caches and time trial for dt seconds. */
export function stepMissions(state, dt, audio) {
  const idx = state.missionIndex;

  if (idx === 0) {
    if (state.missionStage === 0 && near(state, PLACES.odette, 110)) {
      state.missionStage = 1;
      state.carrying = true;
      say(state, 'Mama Odette: "Take this crate to the Stilt-House Row, boy. No detours."');
      audio.blip();
    } else if (state.missionStage === 1 && near(state, PLACES.stiltRow, 110)) {
      completeMission(state, audio);
    }
  } else if (idx === 1) {
    if (!state.missionData.stash) {
      state.missionData.stash = STASH_SPOTS.map((s) => ({ ...s, taken: false }));
      state.missionData.collected = 0;
    }
    for (const s of state.missionData.stash) {
      if (!s.taken && Math.hypot(state.player.x - s.x, state.player.y - s.y) < 55) {
        s.taken = true;
        state.missionData.collected += 1;
        say(state, `Stash crate ${state.missionData.collected}/5 — the fog hides the rest.`);
        audio.cash();
      }
    }
    if (state.missionData.collected >= 5) completeMission(state, audio);
  } else if (idx === 2) {
    if (state.missionStage === 0 && near(state, PLACES.mill, 130)) {
      state.missionStage = 1;
      state.carrying = true;
      say(state, 'Crate loaded at the mill. The checkpoint on the bridge is watching.');
      audio.blip();
    } else if (state.missionStage === 1) {
      if (state.carrying && state.player.x > CHECKPOINT.x && state.player.x < CHECKPOINT.x + CHECKPOINT.w
        && state.player.y > CHECKPOINT.y && state.player.y < CHECKPOINT.y + CHECKPOINT.h) {
        state.wanted = Math.max(state.wanted, 2);
        state.wantedTimer = 0;
        say(state, 'Checkpoint! The sheriff flagged your crate — heat is on.');
        audio.bad();
        state.carrying = false; // the flag is raised; the crate still rides along
        state.missionData.flagged = true;
      }
      if (near(state, PLACES.docks, 130)) completeMission(state, audio);
    }
  } else if (idx === 3) {
    if (!state.missionData.started) {
      state.missionData.started = true;
      state.wanted = 3;
      state.wantedTimer = 0;
      say(state, 'The whole parish is after you. Lose them!', 4);
      audio.bad();
    }
    if (state.missionStage === 0 && state.wanted === 0) {
      state.missionStage = 1;
      say(state, 'Clean. Now slip into Mama Odette’s shack.');
      audio.blip();
    } else if (state.missionStage === 1 && near(state, PLACES.odette, 110)) {
      completeMission(state, audio);
    }
  } else if (idx === 4) {
    if (!state.missionData.started) {
      state.missionData.started = true;
      state.wanted = 2;
      state.wantedTimer = 0;
      state.carrying = true;
      say(state, 'Three drops, heat on your tail. Go!', 4);
      audio.bad();
    }
    const drops = [PLACES.docks, PLACES.mill, PLACES.motel];
    const drop = drops[state.missionStage];
    if (drop && near(state, drop, 130)) {
      state.missionStage += 1;
      if (state.missionStage >= 3) {
        completeMission(state, audio);
      } else {
        say(state, `Drop ${state.missionStage} of 3 done — next: ${['Shrimp Docks', 'Old Sugar Mill', 'Crawdad Motel'][state.missionStage]}.`);
        audio.cash();
      }
    }
  }

  // Swamp caches: walk or drive over one and it is yours.
  for (const c of state.caches) {
    if (!c.taken && Math.hypot(state.player.x - c.x, state.player.y - c.y) < 45) {
      c.taken = true;
      state.cash += CACHE_PAY;
      state.stats.caches += 1;
      say(state, `Swamp cache found — +$${CACHE_PAY}.`);
      audio.cash();
    }
  }

  // River time trial: sail through gate 1 to start the clock, then gates 2–6 in order.
  const p = state.player;
  const inBoat = p.vehicle && p.vehicle.kind === 'boat';
  if (!state.trial.active && inBoat) {
    const g0 = state.trialGates[0];
    if (Math.hypot(p.x - g0.x, p.y - g0.y) < 90) {
      state.trial.active = true;
      state.trial.gate = 1;
      state.trial.timeLeft = TRIAL.timeLimit;
      say(state, `Time trial started — 6 gates down the river, ${TRIAL.timeLimit}s!`);
      audio.blip();
    }
  } else if (state.trial.active) {
    state.trial.timeLeft -= dt;
    const g = state.trialGates[state.trial.gate];
    if (g && Math.hypot(p.x - g.x, p.y - g.y) < 90) {
      state.trial.gate += 1;
      audio.blip();
      if (state.trial.gate >= TRIAL.gates) {
        state.trial.active = false;
        state.cash += TRIAL.pay;
        say(state, `Time trial done — $${TRIAL.pay}!`, 4);
        audio.jingle();
      } else {
        say(state, `Gate ${state.trial.gate} of ${TRIAL.gates} — keep it pinned!`);
      }
    }
    if (state.trial.timeLeft <= 0) {
      state.trial.active = false;
      say(state, 'Time trial failed — the river keeps its secrets. Sail back to gate 1 to retry.');
      audio.bad();
    }
  }
}

/** Where the HUD arrow and the minimap point right now (null when there is none). */
export function currentTarget(state) {
  const idx = state.missionIndex;
  if (state.trial.active) {
    const g = state.trialGates[state.trial.gate];
    return g ? { x: g.x, y: g.y } : null;
  }
  if (idx === 0) return state.missionStage === 0 ? PLACES.odette : PLACES.stiltRow;
  if (idx === 1) {
    if (state.missionData.stash) {
      const next = state.missionData.stash.find((s) => !s.taken);
      if (next) return { x: next.x, y: next.y };
    }
    return PLACES.grove;
  }
  if (idx === 2) return state.missionStage === 0 ? PLACES.mill : PLACES.docks;
  if (idx === 3) return state.missionStage === 0 ? null : PLACES.odette;
  if (idx === 4) {
    const drops = [PLACES.docks, PLACES.mill, PLACES.motel];
    return drops[state.missionStage] ?? null;
  }
  return null;
}
