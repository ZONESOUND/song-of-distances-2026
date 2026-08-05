import {
  pickRoundRobin,
  playbackRateFor,
  resolveCutoff,
  resolveDetuneCents,
  resolveOctaveShift,
  resolvePan,
  resolveSweep,
  resolveVelocity,
  ROUND_ROBIN_VARIANTS,
} from './variationRules';

const config = {
  panWidth: 0.85,
  nearRadius: 120,
  maxDist: 600,
  velocityDepth: 0.55,
  velocityJitter: 0.2,
  detuneCents: 8,
};

it('pans east to the right, west to the left, and north/south to the centre', () => {
  expect(resolvePan(0, 600, config)).toBeCloseTo(0.85);
  expect(resolvePan(180, 600, config)).toBeCloseTo(-0.85);
  expect(resolvePan(-180, 600, config)).toBeCloseTo(-0.85);
  expect(resolvePan(90, 600, config)).toBeCloseTo(0, 10);
  expect(resolvePan(-90, 600, config)).toBeCloseTo(0, 10);
});

it('collapses pan toward the centre for nodes close to the listener', () => {
  expect(resolvePan(0, 0, config)).toBe(0);
  expect(resolvePan(0, 60, config)).toBeCloseTo(0.425);
  expect(resolvePan(0, 120, config)).toBeCloseTo(0.85);
  expect(resolvePan(0, 10000, config)).toBeLessThanOrEqual(1);
  expect(resolvePan(180, 10000, config)).toBeGreaterThanOrEqual(-1);
});

it('maps distance to velocity inside a clamped range with jitter', () => {
  expect(resolveVelocity(0, 0.5, config)).toBeCloseTo(0.95);
  expect(resolveVelocity(600, 0.5, config)).toBeCloseTo(0.4);
  expect(resolveVelocity(999999, 0.5, config)).toBeCloseTo(0.4);
  expect(resolveVelocity(0, 1, config)).toBeCloseTo(1);
  expect(resolveVelocity(600, 0, config)).toBeCloseTo(0.3);
  expect(resolveVelocity(999999, 0, {...config, velocityDepth: 2}))
    .toBe(0.15);
});

it('darkens far nodes monotonically between the cutoff bounds', () => {
  expect(resolveCutoff(0, config)).toBe(8000);
  expect(resolveCutoff(300, config)).toBeCloseTo(8000 * Math.pow(2, -1.5));
  expect(resolveCutoff(600, config)).toBe(1000);
  expect(resolveCutoff(999999, config)).toBe(1000);
  const samples = [0, 150, 300, 450, 600].map((d) => resolveCutoff(d, config));
  const sorted = [...samples].sort((a, b) => b - a);
  expect(samples).toEqual(sorted);
});

it('spreads detune symmetrically across the configured cents range', () => {
  expect(resolveDetuneCents(0, config)).toBe(-8);
  expect(resolveDetuneCents(0.5, config)).toBe(0);
  expect(resolveDetuneCents(1, config)).toBe(8);
  expect(resolveDetuneCents(1, {...config, detuneCents: 0})).toBe(0);
});

it('cycles the four round-robin variants and exposes full fields', () => {
  expect(pickRoundRobin(0)).toBe(ROUND_ROBIN_VARIANTS[0]);
  expect(pickRoundRobin(5)).toBe(ROUND_ROBIN_VARIANTS[1]);
  expect(pickRoundRobin(7)).toBe(ROUND_ROBIN_VARIANTS[3]);
  expect(pickRoundRobin(-1)).toBe(ROUND_ROBIN_VARIANTS[3]);
  ROUND_ROBIN_VARIANTS.forEach((variant) => {
    expect(variant).toEqual(expect.objectContaining({
      detuneOffset: expect.any(Number),
      startOffset: expect.any(Number),
      cutoffMul: expect.any(Number),
    }));
  });
});

it('spreads notes upward by whole octaves according to octaveSpread', () => {
  const off = {...config, octaveSpread: 0};
  [0, 0.5, 0.99].forEach((r) => expect(resolveOctaveShift(r, off)).toBe(0));
  const full = {...config, octaveSpread: 1};
  expect(resolveOctaveShift(0.49, full)).toBe(0);
  expect(resolveOctaveShift(0.5, full)).toBe(12);
  expect(resolveOctaveShift(0.84, full)).toBe(12);
  expect(resolveOctaveShift(0.86, full)).toBe(24);
  const half = {...config, octaveSpread: 0.5};
  expect(resolveOctaveShift(0.74, half)).toBe(0);
  expect(resolveOctaveShift(0.76, half)).toBe(12);
  expect(resolveOctaveShift(0.95, half)).toBe(24);
});

it('sweeps the bandpass upward east and downward west within bounds', () => {
  expect(resolveSweep(0.5, 0, 300, {...config, sweepDepth: 0})).toBeNull();
  const cfg = {...config, sweepDepth: 1};
  const east = resolveSweep(0.5, 0, 300, cfg);
  expect(east.endHz).toBeGreaterThan(east.startHz);
  const west = resolveSweep(0.5, 180, 300, cfg);
  expect(west.endHz).toBeLessThan(west.startHz);
  [east, west].forEach((sweep) => {
    expect(sweep.startHz).toBeGreaterThanOrEqual(200);
    expect(sweep.startHz).toBeLessThanOrEqual(4000);
    expect(sweep.endHz).toBeGreaterThanOrEqual(120);
    expect(sweep.endHz).toBeLessThanOrEqual(8000);
    expect(sweep.seconds).toBeGreaterThanOrEqual(1.5);
    expect(sweep.seconds).toBeLessThanOrEqual(3.5);
    expect(sweep.q).toBe(7);
  });
  expect(resolveSweep(0.5, 0, 300, {...config, sweepDepth: 0.5}).q).toBe(5);
});

it('derives playback rate from midi distance and detune cents', () => {
  expect(playbackRateFor(48, 48)).toBe(1);
  expect(playbackRateFor(60, 48)).toBe(2);
  expect(playbackRateFor(36, 48)).toBe(0.5);
  expect(playbackRateFor(48, 48, 100)).toBeCloseTo(Math.pow(2, 1 / 12));
  expect(playbackRateFor(48, 48, -100)).toBeCloseTo(Math.pow(2, -1 / 12));
});
