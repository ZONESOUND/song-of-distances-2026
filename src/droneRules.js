// Pure targets for the ambient drone bed: how loud and at which pitch the
// loop layers should sit, given how many people are present. The engine only
// applies these numbers with slow ramps; nothing here touches Tone.js.

import {clamp, playbackRateFor} from './variationRules';
import {getScaleNote} from './harmonyRules';

const LONG_SAMPLE_ROOT_MIDI = 48; // the C3 loop source file

// activeCount = 0 must stay audible: the piece never falls fully silent.
export const resolveDroneTargets = (
  {activeCount = 0, totalCount = 0},
  harmonicState,
  config = {}
) => {
  const trim = config.droneTrimDb || 0;
  const rootDb = clamp(-34 + 2 * activeCount, -34, -16) + trim;
  const fifthDb = rootDb - 6;
  const noiseDb = clamp(-46 + totalCount, -46, -34) + trim;
  const root = getScaleNote(0, harmonicState, 2, 5);
  return {
    rootDb,
    fifthDb,
    noiseDb,
    rootRate: playbackRateFor(root.midi, LONG_SAMPLE_ROOT_MIDI),
    fifthRate: playbackRateFor(root.midi + 19, LONG_SAMPLE_ROOT_MIDI),
  };
};
