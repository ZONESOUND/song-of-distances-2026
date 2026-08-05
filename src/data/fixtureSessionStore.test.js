import {
  createFixtureLayout,
  createFixtureSessionStore,
} from './fixtureSessionStore';
import {FIXTURE_NAMES, getFixtureName} from './fixtureNames';
import {calcLayerFromDistance, projectGpsPoint} from '../spatialRules';

it('contains both current and historical sessions without network access', () => {
  const store = createFixtureSessionStore({
    center: {lat: 25.033, lon: 121.5654},
    count: 8,
    activeCount: 2,
  });
  let sessions;
  store.subscribeSessions((value) => { sessions = value; });

  expect(Object.keys(sessions)).toHaveLength(8);
  expect(Object.values(sessions).some((session) => session.leave === false)).toBe(true);
  expect(Object.values(sessions).some((session) => session.leave === true)).toBe(true);

  const center = {lat: 25.033, lon: 121.5654};
  const values = Object.values(sessions);
  const layers = values.map((session) => {
    const point = projectGpsPoint(session, center, 250000, 0.58);
    return calcLayerFromDistance(point.distance, 250000, 0.58);
  });
  layers.forEach((layer, index) => {
    expect(layer).toBeCloseTo(values[index].data.fixtureLayer, 8);
  });

  const originalProjection = projectGpsPoint(
    values[0], center, 250000, 0.58
  );
  const scaledProjection = projectGpsPoint(
    values[0], center, 500000, 0.58
  );
  const curvedProjection = projectGpsPoint(
    values[0], center, 250000, 0.8
  );
  expect(scaledProjection.distance).not.toBeCloseTo(
    originalProjection.distance,
    3
  );
  expect(curvedProjection.distance).not.toBeCloseTo(
    originalProjection.distance,
    3
  );
});

it('creates one hundred random-looking nodes with exactly ten active', () => {
  const store = createFixtureSessionStore({
    center: {lat: 25.033, lon: 121.5654},
    count: 100,
    activeCount: 10,
  });
  let sessions;
  store.subscribeSessions((value) => { sessions = value; });
  const values = Object.values(sessions);
  const layers = values.map((session) => session.data.fixtureLayer);

  expect(values.filter((session) => session.leave === false)).toHaveLength(10);
  expect(layers.filter((layer) => layer <= 9).length)
    .toBeGreaterThan(layers.filter((layer) => layer > 20).length);
  expect(Math.min(...layers)).toBeLessThan(2);
  expect(Math.max(...layers)).toBeGreaterThan(25);
  expect(new Set(layers.map((layer) => layer.toFixed(6))).size).toBe(100);
});

it('uses unique exhibition-style names instead of engineering IDs', () => {
  const store = createFixtureSessionStore({
    center: {lat: 25.033, lon: 121.5654},
    count: 100,
    activeCount: 10,
  });
  let sessions;
  store.subscribeSessions((value) => { sessions = value; });
  const names = Object.values(sessions).map((session) => session.showId);
  const namesWithEmoji = names.filter((name) => Array.from(name).some(
    (character) => character.codePointAt(0) >= 0x1F000
  ));

  expect(FIXTURE_NAMES).toHaveLength(100);
  expect(new Set(names).size).toBe(100);
  expect(names.some((name) => /^F\d{3}$/.test(name))).toBe(false);
  expect(namesWithEmoji.length).toBeGreaterThan(20);
  expect(names.every((name) => Array.from(name).length <= 24)).toBe(true);
  expect(getFixtureName(100)).toBe(`${FIXTURE_NAMES[0]} · 2`);
});

it('uses a reproducible high-variance Gaussian fixture layout', () => {
  const first = createFixtureLayout(100, 42);
  const second = createFixtureLayout(100, 42);
  const layers = first.map((point) => point.layer);
  const mean = layers.reduce((sum, layer) => sum + layer, 0) / layers.length;
  const variance = layers.reduce(
    (sum, layer) => sum + Math.pow(layer - mean, 2),
    0
  ) / layers.length;

  expect(first).toEqual(second);
  expect(Math.sqrt(variance)).toBeGreaterThan(7);
  expect(new Set(first.map((point) => point.angle.toFixed(6))).size).toBe(100);
});

it('marks a session historical without deleting it', async () => {
  const store = createFixtureSessionStore({
    center: {lat: 25.033, lon: 121.5654},
    count: 0,
  });
  let sessions;
  store.subscribeSessions((value) => { sessions = value; });
  const id = store.reserveSessionId();

  await store.startSession(id, {
    lat: 25.033,
    lon: 121.5654,
    timeStamp: 1700000000000,
    showId: 'A001',
  });
  await store.endSession(id);

  expect(Object.keys(sessions)).toEqual([id]);
  expect(sessions[id]).toMatchObject({leave: true, showId: 'A001'});
  expect(sessions[id].endedAt).toEqual(expect.any(Number));
});

it('moves the same session and preserves its final position as history', async () => {
  const store = createFixtureSessionStore({
    center: {lat: 25.033, lon: 121.5654},
    count: 0,
  });
  let sessions;
  store.subscribeSessions((value) => { sessions = value; });
  const id = store.reserveSessionId();

  await store.startSession(id, {
    lat: 25.033,
    lon: 121.5654,
    timeStamp: 1700000000000,
    date: 'start',
    showId: 'A001',
  });
  await store.updatePosition(id, {
    lat: 25.091,
    lon: 121.602,
    timeStamp: 1700000005000,
    date: 'moved',
  });

  expect(Object.keys(sessions)).toEqual([id]);
  expect(sessions[id]).toMatchObject({
    lat: 25.091,
    lon: 121.602,
    timeStamp: 1700000005000,
    leave: false,
  });

  await store.endSession(id);
  expect(Object.keys(sessions)).toEqual([id]);
  expect(sessions[id]).toMatchObject({
    lat: 25.091,
    lon: 121.602,
    leave: true,
  });
});

it('can simulate one visitor moving outward and leaving their final node', () => {
  vi.useFakeTimers();
  const store = createFixtureSessionStore({
    center: {lat: 25.033, lon: 121.5654},
    count: 1,
    motionEnabled: true,
    motionIntervalMs: 1000,
  });
  let sessions;
  store.subscribeSessions((value) => { sessions = value; });
  const initial = {...sessions['fixture-0001']};

  vi.advanceTimersByTime(9000);

  expect(sessions['fixture-0001']).toMatchObject({leave: false});

  vi.advanceTimersByTime(1000);

  expect(sessions['fixture-0001']).toMatchObject({leave: true});
  expect(sessions['fixture-0001'].endedAt).toEqual(expect.any(Number));
  expect(sessions['fixture-0001'].lat).not.toBe(initial.lat);
  expect(sessions['fixture-0001'].lon).not.toBe(initial.lon);
  store.dispose();
  vi.useRealTimers();
});
