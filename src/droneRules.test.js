import {resolveDroneTargets} from './droneRules';
import {resolveHarmonicState} from './harmonyRules';

const home = resolveHarmonicState(0); // C dorian
const gDorian = resolveHarmonicState(3);

it('keeps an audible floor when nobody is online', () => {
  const targets = resolveDroneTargets({activeCount: 0, totalCount: 0}, home);
  expect(targets.rootDb).toBe(-34);
  expect(targets.fifthDb).toBe(-40);
  expect(targets.noiseDb).toBe(-46);
});

it('grows with the crowd and caps at the ceiling', () => {
  expect(resolveDroneTargets({activeCount: 1, totalCount: 5}, home).rootDb).toBe(-32);
  expect(resolveDroneTargets({activeCount: 5, totalCount: 5}, home).rootDb).toBe(-24);
  expect(resolveDroneTargets({activeCount: 9, totalCount: 20}, home).rootDb).toBe(-16);
  expect(resolveDroneTargets({activeCount: 50, totalCount: 500}, home)).toMatchObject({
    rootDb: -16,
    noiseDb: -34,
  });
});

it('applies the user trim to every layer', () => {
  const trimmed = resolveDroneTargets(
    {activeCount: 0, totalCount: 0},
    home,
    {droneTrimDb: -6}
  );
  expect(trimmed.rootDb).toBe(-40);
  expect(trimmed.fifthDb).toBe(-46);
  expect(trimmed.noiseDb).toBe(-52);
});

it('tunes the loops to the current harmonic root', () => {
  const atHome = resolveDroneTargets({activeCount: 0, totalCount: 0}, home);
  expect(atHome.rootRate).toBeCloseTo(0.5); // C2 from the C3 sample
  expect(atHome.fifthRate).toBeCloseTo(0.5 * Math.pow(2, 19 / 12));
  const atG = resolveDroneTargets({activeCount: 0, totalCount: 0}, gDorian);
  expect(atG.rootRate).toBeCloseTo(Math.pow(2, (43 - 48) / 12));
});
