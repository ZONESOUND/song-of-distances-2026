// Dispatcher between the two sound engines.
//
// 'v2' (default): the 2026 variation engine — voice pool, stereo placement,
//   velocity/brightness variation, harmonic drift, ambient drone.
// 'legacy': the 2020 exhibition engine, preserved verbatim in soundLegacy.js.
//
// Both engines initialise up front and share the master output, so switching
// via the dat.GUI (press H) is instant and needs no reload. sketch.js keeps
// calling initSound()/triggerSound(d) exactly as it always has.

import {initLegacy, triggerLegacy, makesoundLegacy} from './soundLegacy';
import {
  applySoundConfig,
  initEngine,
  startDrone,
  stopDrone,
  triggerEngine,
  updateSoundScene as engineUpdateSoundScene,
} from './soundEngine';
import {loadSoundControls, setSoundParam, soundConfig} from './soundConfig';

export let initSound = () => {
  loadSoundControls();
  initLegacy();
  initEngine();
  if (soundConfig.engine === 'v2') startDrone();
};

export let triggerSound = (d) => {
  if (soundConfig.engine === 'legacy') triggerLegacy(d);
  else triggerEngine(d);
};

export let makesound = () => makesoundLegacy();

export const setEngine = (mode) => {
  setSoundParam('engine', mode === 'legacy' ? 'legacy' : 'v2');
  if (soundConfig.engine === 'legacy') stopDrone();
  else startDrone();
};

export const updateSoundScene = (summary) => engineUpdateSoundScene(summary);

export {applySoundConfig};
