// Synthesized sound only (WebAudio, no audio files): engine hum that follows speed, pickup
// blips, a mission-complete arpeggio, a two-tone siren while wanted, and a crash thud. Created
// lazily on the first user gesture; M mutes.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;
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
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenLfo = ctx.createOscillator();
      sirenLfo.type = 'square';
      sirenLfo.frequency.value = 0.6;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 180;
      sirenLfo.connect(lfoGain);
      lfoGain.connect(sirenOsc.frequency);
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      sirenLfo.start();
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, dur, type, vol) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol || 0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
    },
    isMuted() { return muted; },
    /** Called every frame with the player's speed and wanted level. */
    update(speed, wanted) {
      if (!ctx || muted) return;
      if (engineOsc) {
        engineOsc.frequency.value = 45 + Math.abs(speed) * 0.35;
        engineGain.gain.value = Math.abs(speed) > 5 ? 0.05 : 0;
      }
      if (sirenGain) sirenGain.gain.value = wanted > 0 ? 0.045 : 0;
    },
    pickup() { blip(880, 0.12, 'sine', 0.25); setTimeout(() => blip(1320, 0.14, 'sine', 0.22), 70); },
    mission() {
      blip(523, 0.14, 'triangle', 0.28);
      setTimeout(() => blip(659, 0.14, 'triangle', 0.28), 120);
      setTimeout(() => blip(784, 0.22, 'triangle', 0.3), 240);
    },
    crash() { blip(70, 0.3, 'sawtooth', 0.4); },
    busted() { blip(220, 0.5, 'square', 0.2); setTimeout(() => blip(180, 0.6, 'square', 0.2), 200); },
  };
}
