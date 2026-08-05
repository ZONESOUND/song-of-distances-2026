// v2 sound engine: a thin Tone.js layer over the pure rule modules.
//
// Design constraints (see docs/superpowers plan):
// - Tone stays pinned at 13.8.25 (UMD, .toMaster() API).
// - Tone.Sampler rounds midi notes, so per-voice pitch/detune goes through
//   Tone.Buffer + Tone.BufferSource playbackRate instead.
// - Voices are PERSISTENT node chains (filter -> panner -> gain); only the
//   BufferSource is created per trigger and disposes itself onended. This is
//   what fixes the legacy per-trigger Filter/connect leak.

import Tone from 'tone';
import C3 from './sound/C3_mid_long_44.1k.mp3';
import C2 from './sound/C2_low_short_44.1k.mp3';
import {soundConfig} from './soundConfig';
import {
  clamp,
  pickRoundRobin,
  playbackRateFor,
  resolveCutoff,
  resolveDetuneCents,
  resolveOctaveShift,
  resolvePan,
  resolveSweep,
  resolveVelocity,
} from './variationRules';
import {
  resolveHarmonicState,
  resolveSoundEventV2,
  stepIndexFor,
} from './harmonyRules';
import {resolveDroneTargets} from './droneRules';

const LONG_ROOT_MIDI = 48; // C3 sample
const SHORT_ROOT_MIDI = 36; // C2 sample
const HISTORY_GATE_MS = 200;

let initialized = false;
let bus = null;
let bufferLong = null;
let bufferShort = null;
let voices = [];
let voiceCursor = 0;
let triggerCounter = 0;
let historyGate = {};
let engineStartMs = null;
let lastHarmonicStep = 0;
let scene = {activeCount: 0, totalCount: 0};
let drone = null;
let droneRetryTimer = null;
let lastDroneTargets = null;

const dbToGain = (db) => Math.pow(10, db / 20);

const nowMs = () => Tone.now() * 1000;

export const initEngine = () => {
  if (initialized) return;
  initialized = true;
  const limiter = new Tone.Limiter(-0.5).toMaster();
  const comp = new Tone.Compressor(-30, 3).connect(limiter);
  comp.ratio.value = 20;
  const reverb = new Tone.Reverb({
    pre_delay: 0.05,
    decay: 5,
    wet: 0.6,
  }).connect(comp);
  reverb.generate();
  const busFilter = new Tone.Filter(6000, 'lowpass');
  busFilter.rolloff = -12;
  busFilter.connect(reverb);
  bus = {limiter, comp, reverb, busFilter};
  bufferLong = new Tone.Buffer(C3);
  bufferShort = new Tone.Buffer(C2);
  engineStartMs = nowMs();
  buildVoicePool();
};

const disposeVoice = (voice) => {
  if (voice.activeSource) {
    try {
      voice.activeSource.stop();
    } catch (error) { /* already stopped */ }
  }
  voice.filter.dispose();
  voice.panner.dispose();
  voice.gain.dispose();
};

const buildVoicePool = () => {
  voices.forEach(disposeVoice);
  voices = [];
  voiceCursor = 0;
  const count = clamp(Math.floor(soundConfig.voiceCount) || 12, 4, 24);
  for (let i = 0; i < count; i++) {
    const filter = new Tone.Filter(6000, 'lowpass');
    filter.Q.value = 2;
    const panner = new Tone.Panner(0);
    const gain = new Tone.Gain(1);
    filter.connect(panner);
    panner.connect(gain);
    gain.connect(bus.busFilter);
    voices.push({filter, panner, gain, activeSource: null});
  }
};

// Called from the GUI when voiceCount changes; other params are read live.
export const applySoundConfig = () => {
  if (!initialized) return;
  if (voices.length !== clamp(Math.floor(soundConfig.voiceCount) || 12, 4, 24)) {
    buildVoicePool();
  }
  if (drone) applyDroneTargets(true);
};

const currentHarmonicState = () => {
  if (!soundConfig.harmonyEnabled) return resolveHarmonicState(0);
  const elapsed = nowMs() - engineStartMs;
  const step = stepIndexFor(
    elapsed,
    soundConfig.harmonicPeriodSec * 1000,
    scene.activeCount
  );
  if (step !== lastHarmonicStep) {
    lastHarmonicStep = step;
    if (drone) applyDroneTargets(true);
  }
  return resolveHarmonicState(step);
};

export const triggerEngine = (d) => {
  if (!initialized) return;
  const state = currentHarmonicState();
  const event = resolveSoundEventV2(d, Math.random(), state);
  const isHistory = event.sourceType === 'history';
  const buffer = isHistory ? bufferShort : bufferLong;
  if (!buffer || !buffer.loaded) return;

  if (isHistory) {
    const now = nowMs();
    if (historyGate[event.layerIndex] &&
        now - historyGate[event.layerIndex] < HISTORY_GATE_MS) {
      return;
    }
    historyGate[event.layerIndex] = now;
  }

  const variant = pickRoundRobin(triggerCounter++);
  const detune = resolveDetuneCents(Math.random(), soundConfig) +
    variant.detuneOffset;
  const octaveShift = resolveOctaveShift(Math.random(), soundConfig);
  const targetMidi = Math.min(event.midi + octaveShift, 84);
  const rate = playbackRateFor(
    targetMidi,
    isHistory ? SHORT_ROOT_MIDI : LONG_ROOT_MIDI,
    detune
  );
  const dist = Number.isFinite(d.dist) ? d.dist : 0;
  const degree = Number.isFinite(d.degree) ? d.degree : 0;
  const velocity = resolveVelocity(dist, Math.random(), soundConfig) *
    (isHistory ? 0.6 : 1);
  const cutoff = clamp(
    resolveCutoff(dist, soundConfig) * variant.cutoffMul,
    150,
    12000
  );
  const pan = resolvePan(degree, dist, soundConfig);

  const voice = voices[voiceCursor++ % voices.length];
  const now = Tone.now();
  if (voice.activeSource) {
    try {
      voice.activeSource.stop(now + 0.05);
    } catch (error) { /* already stopped */ }
    voice.activeSource = null;
  }
  const sweep = resolveSweep(Math.random(), degree, dist, soundConfig);
  if (sweep) {
    voice.filter.type = 'bandpass';
    voice.filter.Q.value = sweep.q;
    voice.filter.frequency.cancelScheduledValues(now);
    voice.filter.frequency.setValueAtTime(sweep.startHz, now);
    voice.filter.frequency.exponentialRampTo(sweep.endHz, sweep.seconds, now);
  } else {
    voice.filter.type = 'lowpass';
    voice.filter.Q.value = 2;
    voice.filter.frequency.cancelScheduledValues(now);
    voice.filter.frequency.setValueAtTime(cutoff, now);
  }
  voice.panner.pan.setValueAtTime(pan, now);
  // A resonant bandpass passes far less energy than the open lowpass, so
  // sweeping notes get makeup gain scaled with sweep depth to stay
  // level-matched with non-sweeping notes (measured against the 2020 chain).
  const makeup = sweep ? 1 + 2.6 * clamp(soundConfig.sweepDepth, 0, 1) : 1;
  voice.gain.gain.setValueAtTime(velocity * makeup, now);

  const source = new Tone.BufferSource(buffer);
  source.fadeIn = 0.02;
  source.fadeOut = 0.08;
  source.playbackRate.value = rate;
  source.connect(voice.filter);
  source.onended = () => {
    try {
      source.dispose();
    } catch (error) { /* double-dispose is harmless */ }
    if (voice.activeSource === source) voice.activeSource = null;
  };
  voice.activeSource = source;
  source.start(now, variant.startOffset);
};

// ---- drone bed -------------------------------------------------------------

const buildDroneLayer = (buffer, rate) => {
  const gain = new Tone.Gain(0);
  gain.connect(drone.filter);
  const source = new Tone.BufferSource(buffer);
  source.loop = true;
  source.playbackRate.value = rate;
  source.connect(gain);
  source.start(Tone.now());
  return {gain, source};
};

const applyDroneTargets = (force = false) => {
  if (!drone) return;
  const state = soundConfig.harmonyEnabled ?
    resolveHarmonicState(lastHarmonicStep) :
    resolveHarmonicState(0);
  const targets = resolveDroneTargets(scene, state, soundConfig);
  const key = JSON.stringify(targets);
  if (!force && key === lastDroneTargets) return;
  lastDroneTargets = key;
  drone.root.gain.gain.rampTo(dbToGain(targets.rootDb), 8);
  drone.fifth.gain.gain.rampTo(dbToGain(targets.fifthDb), 8);
  drone.noiseGain.gain.rampTo(dbToGain(targets.noiseDb), 8);
  // Root changes glide over 12 seconds: a tide, not a modulation.
  drone.root.source.playbackRate.rampTo(targets.rootRate, 12);
  drone.fifth.source.playbackRate.rampTo(targets.fifthRate, 12);
};

export const startDrone = () => {
  if (!initialized || drone || !soundConfig.droneEnabled) return;
  if (!bufferLong || !bufferLong.loaded) {
    // Samples still decoding: retry shortly instead of racing the load.
    if (!droneRetryTimer) {
      droneRetryTimer = setTimeout(() => {
        droneRetryTimer = null;
        startDrone();
      }, 500);
    }
    return;
  }
  const filter = new Tone.Filter(600, 'lowpass');
  filter.connect(bus.busFilter);
  drone = {filter};
  const state = resolveHarmonicState(soundConfig.harmonyEnabled ? lastHarmonicStep : 0);
  const targets = resolveDroneTargets(scene, state, soundConfig);
  drone.root = buildDroneLayer(bufferLong, targets.rootRate);
  drone.fifth = buildDroneLayer(bufferLong, targets.fifthRate);
  const noiseGain = new Tone.Gain(0);
  const noiseFilter = new Tone.Filter(400, 'lowpass');
  noiseGain.connect(drone.filter);
  noiseFilter.connect(noiseGain);
  const noise = new Tone.Noise('pink');
  noise.connect(noiseFilter);
  noise.start();
  drone.noiseGain = noiseGain;
  drone.noiseFilter = noiseFilter;
  drone.noise = noise;
  lastDroneTargets = null;
  applyDroneTargets(true);
};

export const stopDrone = () => {
  if (droneRetryTimer) {
    clearTimeout(droneRetryTimer);
    droneRetryTimer = null;
  }
  if (!drone) return;
  const dying = drone;
  drone = null;
  lastDroneTargets = null;
  [dying.root.gain, dying.fifth.gain, dying.noiseGain].forEach((gain) => {
    gain.gain.rampTo(0, 2);
  });
  setTimeout(() => {
    [dying.root.source, dying.fifth.source, dying.noise].forEach((node) => {
      try {
        node.stop();
      } catch (error) { /* already stopped */ }
      node.dispose();
    });
    [dying.root.gain, dying.fifth.gain, dying.noiseGain,
      dying.noiseFilter, dying.filter].forEach((node) => node.dispose());
  }, 2500);
};

// Fed by ControlPanel whenever the session list refreshes (~5 s cadence).
export const updateSoundScene = (summary) => {
  scene = {
    activeCount: Math.max(0, summary && summary.activeCount || 0),
    totalCount: Math.max(0, summary && summary.totalCount || 0),
  };
  if (drone) applyDroneTargets();
};
