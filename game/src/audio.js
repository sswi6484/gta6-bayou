// Synthesized WebAudio only — no audio files. Engine hum, pickup blips, a mission
// jingle, a two-tone siren and a splash. Everything is lazy: the AudioContext is
// created on the first user gesture, and the whole thing is silent until then.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = null;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function resume() {
    if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = null) {
    if (!ensure() || muted) return;
    try {
      const t0 = ctx.currentTime + when;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch {
      // Audio is decoration; a failure never stops the game.
    }
  }

  function blip() {
    tone(880, 0.12, 'sine', 0.25, 0, 1320);
  }

  function cash() {
    tone(660, 0.1, 'triangle', 0.25);
    tone(990, 0.16, 'triangle', 0.25, 0.09);
  }

  function jingle() {
    tone(523, 0.14, 'triangle', 0.3);
    tone(659, 0.14, 'triangle', 0.3, 0.13);
    tone(784, 0.22, 'triangle', 0.3, 0.26);
    tone(1047, 0.3, 'triangle', 0.3, 0.39);
  }

  function bad() {
    tone(220, 0.25, 'sawtooth', 0.2, 0, 110);
  }

  function splash() {
    tone(300, 0.3, 'sine', 0.2, 0, 60);
    tone(500, 0.2, 'triangle', 0.12, 0.05, 200);
  }

  function startEngine() {
    if (!ensure() || muted || engineOsc) return;
    try {
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0.0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 400;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
    } catch {
      engineOsc = null;
    }
  }

  /** Engine pitch follows speed (0..1); 0 means idle-quiet. */
  function setEngine(speedNorm, on) {
    if (!engineOsc) return;
    try {
      const target = !on || muted ? 0 : 0.05 + 0.09 * speedNorm;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(55 + 90 * speedNorm, ctx.currentTime, 0.1);
    } catch {
      // Ignore.
    }
  }

  function stopEngine() {
    if (!engineOsc) return;
    try {
      engineOsc.stop();
    } catch {
      // Already stopped.
    }
    engineOsc = null;
    engineGain = null;
  }

  function startSiren() {
    if (!ensure() || muted || sirenOsc) return;
    try {
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0.03;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      let high = true;
      sirenTimer = window.setInterval(() => {
        if (!sirenOsc) return;
        high = !high;
        try {
          sirenOsc.frequency.setValueAtTime(high ? 700 : 950, ctx.currentTime);
        } catch {
          // Ignore.
        }
      }, 450);
    } catch {
      sirenOsc = null;
    }
  }

  function stopSiren() {
    if (sirenTimer !== null) {
      window.clearInterval(sirenTimer);
      sirenTimer = null;
    }
    if (!sirenOsc) return;
    try {
      sirenOsc.stop();
    } catch {
      // Already stopped.
    }
    sirenOsc = null;
    sirenGain = null;
  }

  function setMuted(value) {
    muted = value;
    if (master) {
      try {
        master.gain.value = muted ? 0 : 0.5;
      } catch {
        // Ignore.
      }
    }
    if (muted) {
      stopSiren();
      stopEngine();
    }
  }

  return {
    resume, blip, cash, jingle, bad, splash,
    startEngine, setEngine, stopEngine, startSiren, stopSiren, setMuted,
    get muted() { return muted; },
  };
}
