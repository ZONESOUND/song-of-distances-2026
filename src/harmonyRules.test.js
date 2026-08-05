import {
  getScaleNote,
  HARMONY_SEQUENCE,
  pitchClassSet,
  resolveHarmonicState,
  resolveSoundEventV2,
  stepIndexFor,
} from './harmonyRules';
import {getDorianNote, resolveSoundEvent} from './soundRules';

it('advances the step clock with the period and caps the crowd speedup at 2x', () => {
  expect(stepIndexFor(0, 180000)).toBe(0);
  expect(stepIndexFor(179999, 180000)).toBe(0);
  expect(stepIndexFor(180000, 180000)).toBe(1);
  expect(stepIndexFor(360000, 180000)).toBe(2);
  expect(stepIndexFor(180000, 180000, 6)).toBe(1);
  expect(stepIndexFor(270000, 180000, 6)).toBe(2);
  expect(stepIndexFor(180000, 180000, 12)).toBe(2);
  expect(stepIndexFor(180000, 180000, 1000)).toBe(2);
});

it('keeps every root within a fifth of home and wraps the cycle', () => {
  HARMONY_SEQUENCE.forEach((state) => {
    expect(['F', 'C', 'G']).toContain(state.root);
  });
  expect(resolveHarmonicState(0)).toBe(HARMONY_SEQUENCE[0]);
  expect(resolveHarmonicState(12)).toBe(HARMONY_SEQUENCE[0]);
  expect(resolveHarmonicState(25)).toBe(HARMONY_SEQUENCE[1]);
  expect(resolveHarmonicState(-1)).toBe(HARMONY_SEQUENCE[11]);
});

it('changes exactly one pitch class between adjacent steps, including the wrap', () => {
  for (let step = 0; step < HARMONY_SEQUENCE.length; step++) {
    const current = pitchClassSet(resolveHarmonicState(step));
    const next = pitchClassSet(resolveHarmonicState(step + 1));
    const gained = [...next].filter((pc) => !current.has(pc));
    const lost = [...current].filter((pc) => !next.has(pc));
    const label = `step ${step} -> ${step + 1}`;
    expect({label, gained: gained.length, lost: lost.length})
      .toEqual({label, gained: 1, lost: 1});
  }
});

it('reproduces the 2020 nine-note C Dorian collection at step zero', () => {
  const home = resolveHarmonicState(0);
  for (let index = 0; index < 9; index++) {
    expect(getScaleNote(index, home).name).toBe(getDorianNote(index));
  }
});

it('numbers octaves midi-style for non-C roots', () => {
  const gDorian = HARMONY_SEQUENCE[3];
  expect(getScaleNote(0, gDorian)).toEqual({name: 'G2', midi: 43});
  expect(getScaleNote(1, gDorian)).toEqual({name: 'A2', midi: 45});
  expect(getScaleNote(3, gDorian)).toEqual({name: 'C3', midi: 48});
  expect(getScaleNote(7, gDorian)).toEqual({name: 'G3', midi: 55});
  const fMixolydian = HARMONY_SEQUENCE[8];
  expect(getScaleNote(0, fMixolydian)).toEqual({name: 'F2', midi: 41});
  expect(getScaleNote(4, fMixolydian)).toEqual({name: 'C3', midi: 48});
});

it('matches resolveSoundEvent behaviour at the home state', () => {
  const home = resolveHarmonicState(0);
  const cases = [
    {layer: 4.25, leave: true},
    {layer: 4.25, leave: false},
    {layer: 4.25},
    {layer: 4.25, leave: 'true'},
    {layer: 1.1},
    {layer: 8.9},
  ];
  cases.forEach((data) => {
    const legacy = resolveSoundEvent(data, 0.34);
    const v2 = resolveSoundEventV2(data, 0.34, home);
    expect(v2.layerIndex).toBe(legacy.layerIndex);
    expect(v2.note).toBe(legacy.note);
    expect(v2.distanceScalar).toBe(legacy.distanceScalar);
    expect(v2.sourceType).toBe(legacy.sourceType);
    expect(typeof v2.midi).toBe('number');
  });
});
