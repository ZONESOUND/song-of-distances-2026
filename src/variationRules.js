// Pure per-trigger variation maths for the v2 sound engine. Everything here is
// deterministic given its inputs; randomness is injected by the caller, in the
// same style as soundRules.resolveSoundEvent.

export const clamp = (value, low, high) => Math.min(Math.max(value, low), high);

// degree follows p5's heading in degrees: 0 = screen right, ±180 = screen
// left. Nodes close to the centre collapse toward the middle of the image so
// the listener's own position never hard-pans.
export const resolvePan = (degree, dist, config) => {
  const nearRadius = Math.max(1, config.nearRadius);
  const nearFactor = Math.min(1, dist / nearRadius);
  const pan = Math.cos(degree * Math.PI / 180) * config.panWidth * nearFactor;
  return clamp(pan, -1, 1);
};

export const resolveVelocity = (dist, randomValue, config) => {
  const normDist = Math.min(1, dist / Math.max(1, config.maxDist));
  const jitter = (randomValue - 0.5) * config.velocityJitter;
  return clamp(0.95 - config.velocityDepth * normDist + jitter, 0.15, 1);
};

// Exponential brightness map: close nodes open the filter fully, far nodes
// darken toward the floor without ever fully closing.
export const resolveCutoff = (dist, config) => {
  const normDist = Math.min(1, dist / Math.max(1, config.maxDist));
  return clamp(8000 * Math.pow(2, -3 * normDist), 300, 8000);
};

export const resolveDetuneCents = (randomValue, config) =>
  (randomValue * 2 - 1) * config.detuneCents;

// Four micro-variants emulate round-robin multisampling with only two source
// files: tiny detune, start-point and brightness offsets per repetition.
export const ROUND_ROBIN_VARIANTS = [
  {detuneOffset: 0, startOffset: 0, cutoffMul: 1},
  {detuneOffset: 4, startOffset: 0.012, cutoffMul: 0.92},
  {detuneOffset: -3, startOffset: 0.02, cutoffMul: 1.06},
  {detuneOffset: 2, startOffset: 0.008, cutoffMul: 0.97},
];

export const pickRoundRobin = (counter) => {
  const size = ROUND_ROBIN_VARIANTS.length;
  return ROUND_ROBIN_VARIANTS[((counter % size) + size) % size];
};

// Sample-accurate pitch: ratio between the wanted midi note (plus detune in
// cents) and the midi note the sample file was recorded at.
export const playbackRateFor = (targetMidi, rootMidi, detuneCents = 0) =>
  Math.pow(2, (targetMidi + detuneCents / 100 - rootMidi) / 12);

// Registral spread: occasionally lift a note one or two octaves so the piece
// is not confined to the original C2–D3 band. Same pitch class, so the modal
// harmony is untouched. octaveSpread 0..1 scales how much probability mass
// leaves the home octave (at 1: 50% stay, 35% +1 oct, 15% +2 oct).
export const resolveOctaveShift = (randomValue, config) => {
  const spread = clamp(config.octaveSpread || 0, 0, 1);
  if (spread <= 0) return 0;
  if (randomValue < 1 - spread * 0.5) return 0;
  if (randomValue < 1 - spread * 0.15) return 12;
  return 24;
};

// Spectral motion: a per-note bandpass whose centre glides during the note's
// decay. Nodes east of the listener sweep upward, west sweeps downward, so
// space and timbre stay coupled. Returns null when the feature is off.
export const resolveSweep = (randomValue, degree, dist, config) => {
  const depth = clamp(config.sweepDepth || 0, 0, 1);
  if (depth <= 0) return null;
  const startHz = clamp(resolveCutoff(dist, config) * 0.5, 200, 4000);
  const upward = Math.cos(degree * Math.PI / 180) >= 0;
  const octaves = (0.75 + randomValue * 0.75) * 1.5 * depth;
  const endHz = clamp(
    startHz * Math.pow(2, upward ? octaves : -octaves),
    120,
    8000
  );
  return {
    startHz,
    endHz,
    seconds: 1.5 + randomValue * 2,
    q: 3 + 4 * depth,
  };
};
