// Deterministic harmonic evolution for the v2 sound engine.
//
// The artwork's 2020 home key is C Dorian. The v2 engine walks a fixed
// twelve-step cycle around it in which every adjacent pair of steps (including
// the wrap-around) differs by exactly ONE pitch class, so a listener never
// hears an abrupt modulation — only a slow tidal drift of colour:
//   brightness axis  Aeolian <-> Dorian <-> Mixolydian (same root)
//   root axis        F <-> C <-> G (a fifth either side of home)
// The clock is a pure function of elapsed time and the online-node count, so
// the whole path is reproducible and testable.

import {scaleNumber} from './soundRules';

const NOTE_TO_SEMITONE = {
  C: 0, D: 2, Eb: 3, E: 4, F: 5, 'F#': 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11,
};

export const HARMONY_SEQUENCE = [
  {root: 'C', mode: 'dorian', scale: ['C', 'D', 'Eb', 'F', 'G', 'A', 'Bb']},
  {root: 'C', mode: 'aeolian', scale: ['C', 'D', 'Eb', 'F', 'G', 'Ab', 'Bb']},
  {root: 'C', mode: 'dorian', scale: ['C', 'D', 'Eb', 'F', 'G', 'A', 'Bb']},
  {root: 'G', mode: 'dorian', scale: ['G', 'A', 'Bb', 'C', 'D', 'E', 'F']},
  {root: 'G', mode: 'mixolydian', scale: ['G', 'A', 'B', 'C', 'D', 'E', 'F']},
  {root: 'G', mode: 'dorian', scale: ['G', 'A', 'Bb', 'C', 'D', 'E', 'F']},
  {root: 'C', mode: 'dorian', scale: ['C', 'D', 'Eb', 'F', 'G', 'A', 'Bb']},
  {root: 'C', mode: 'mixolydian', scale: ['C', 'D', 'E', 'F', 'G', 'A', 'Bb']},
  {root: 'F', mode: 'mixolydian', scale: ['F', 'G', 'A', 'Bb', 'C', 'D', 'Eb']},
  {root: 'F', mode: 'dorian', scale: ['F', 'G', 'Ab', 'Bb', 'C', 'D', 'Eb']},
  {root: 'C', mode: 'dorian', scale: ['C', 'D', 'Eb', 'F', 'G', 'A', 'Bb']},
  {root: 'C', mode: 'aeolian', scale: ['C', 'D', 'Eb', 'F', 'G', 'Ab', 'Bb']},
];

export const pitchClassSet = (state) =>
  new Set(state.scale.map((name) => NOTE_TO_SEMITONE[name]));

// More listeners online -> the harmony breathes faster, capped at 2x.
export const stepIndexFor = (elapsedMs, periodMs, activeCount = 0) => {
  const speedup = 1 + Math.min(1, activeCount / 12);
  const effectivePeriod = Math.max(1, periodMs) / speedup;
  return Math.floor(Math.max(0, elapsedMs) / effectivePeriod);
};

export const resolveHarmonicState = (stepIndex) => {
  const size = HARMONY_SEQUENCE.length;
  return HARMONY_SEQUENCE[((stepIndex % size) + size) % size];
};

// Generalisation of soundRules.getDorianNote to any root/mode. Octaves count
// upward from the scale root at octaveStart, midi-style (C4 = 60), and are
// capped at octaveMax exactly like the 2020 naming scheme.
export const getScaleNote = (index, state, octaveStart = 2, octaveMax = 5) => {
  const scale = state.scale;
  const length = scale.length;
  const degree = index % length;
  const wrap = Math.floor(index / length);
  const rootSemitone = NOTE_TO_SEMITONE[state.root];
  const semitone = NOTE_TO_SEMITONE[scale[degree]];
  const intervalFromRoot = ((semitone - rootSemitone) + 12) % 12;
  const rootMidi = (octaveStart + 1) * 12 + rootSemitone;
  let midi = rootMidi + intervalFromRoot + 12 * wrap;
  let octave = Math.floor(midi / 12) - 1;
  if (octave > octaveMax) {
    midi -= 12 * (octave - octaveMax);
    octave = octaveMax;
  }
  return {name: scale[degree] + octave, midi};
};

// v2 twin of soundRules.resolveSoundEvent: identical layer/random behaviour,
// but the note comes from the current harmonic state and carries its midi
// number for sample-rate playback.
export const resolveSoundEventV2 = (data, randomValue, state) => {
  const ceiledLayer = Math.ceil(data.layer);
  const layerIndex = scaleNumber(ceiledLayer, randomValue);
  const {name, midi} = getScaleNote(layerIndex, state);
  return {
    ceiledLayer,
    layerIndex,
    note: name,
    midi,
    distanceScalar: Math.max(0.5, ceiledLayer - data.layer),
    sourceType: data.leave === true ? 'history' : 'current',
  };
};
