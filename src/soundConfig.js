const STORAGE_KEY = 'soundControlData';

export const DEFAULT_SOUND_CONTROLS = {
  engine: 'v2',
  voiceCount: 12,
  panWidth: 0.85,
  nearRadius: 120,
  maxDist: 600,
  velocityDepth: 0.55,
  velocityJitter: 0.2,
  detuneCents: 8,
  harmonyEnabled: true,
  harmonicPeriodSec: 180,
  droneEnabled: true,
  droneTrimDb: 0,
};

export const soundConfig = {...DEFAULT_SOUND_CONTROLS};

const readStorage = () => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    return {};
  }
};

export const loadSoundControls = () => {
  const saved = readStorage();
  Object.keys(DEFAULT_SOUND_CONTROLS).forEach((key) => {
    if (saved[key] !== undefined) soundConfig[key] = saved[key];
  });
  return soundConfig;
};

export const saveSoundControls = () => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(soundConfig));
  } catch (error) {
    // Storage may be unavailable (private mode); controls simply reset next load.
  }
};

export const setSoundParam = (key, value) => {
  soundConfig[key] = value;
  saveSoundControls();
};

export const resetSoundControls = () => {
  Object.assign(soundConfig, DEFAULT_SOUND_CONTROLS);
  saveSoundControls();
  return soundConfig;
};
