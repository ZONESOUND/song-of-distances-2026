import {createFirebaseSessionStore} from './firebaseSessionStore';

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return {promise, resolve};
};

// Fake with the same modular shape the store injects via firebaseOverride.
const createFakeFirebase = () => {
  const activationStarted = deferred();
  const releaseActivation = deferred();
  const state = {};
  const writes = [];
  const disconnectPatches = {};
  let connectedHandler = null;

  const authState = {currentUser: null};
  const app = {name: 'song-of-distance-revival'};
  const sessionsRef = {path: 'earthlocations'};
  const connectedRef = {path: '.info/connected'};

  const firebase = {
    getApps: () => [],
    initializeApp: () => app,
    getAuth: () => authState,
    async signInAnonymously(auth) {
      auth.currentUser = {uid: 'anon-uid'};
      return {user: auth.currentUser};
    },
    getDatabase: () => ({}),
    ref: (database, path) =>
      path === '.info/connected' ? connectedRef : sessionsRef,
    child: (parentRef, id) => ({path: `${parentRef.path}/${id}`, id}),
    onValue(target, handler) {
      if (target === connectedRef) {
        connectedHandler = handler;
        return () => { connectedHandler = null; };
      }
      return () => {};
    },
    push: () => ({key: 'generated-id'}),
    async update(target, patch) {
      state[target.id] = {...(state[target.id] || {}), ...patch};
      writes.push({type: 'update', id: target.id, patch});
    },
    onDisconnect: (target) => ({
      async update(patch) {
        writes.push({type: 'disconnect-update', id: target.id, patch});
        activationStarted.resolve();
        await releaseActivation.promise;
        disconnectPatches[target.id] = patch;
      },
      async cancel() {
        writes.push({type: 'disconnect-cancel', id: target.id});
        delete disconnectPatches[target.id];
      },
    }),
    serverTimestamp: () => 'SERVER_TIMESTAMP',
  };

  return {
    firebase,
    state,
    writes,
    activationStarted,
    releaseActivation,
    getConnectedHandler: () => connectedHandler,
    simulateDisconnect() {
      Object.entries(disconnectPatches).forEach(([id, patch]) => {
        state[id] = {...(state[id] || {}), ...patch};
      });
    },
  };
};

it('serializes an in-flight activation before ending the session', async () => {
  const fake = createFakeFirebase();
  const store = createFirebaseSessionStore({
    firebase: {
      projectId: 'song-of-distance-staging',
      databaseURL: 'https://song-of-distance-staging.firebaseio.com',
    },
  }, fake.firebase);

  const start = store.startSession('session-a', {
    lat: 25.033,
    lon: 121.5654,
    timeStamp: 1700000000000,
  });
  await fake.activationStarted.promise;
  const end = store.endSession('session-a');
  fake.releaseActivation.resolve();
  await Promise.all([start, end]);

  const directUpdates = fake.writes.filter((write) => write.type === 'update');
  expect(directUpdates.map((write) => write.patch.leave)).toEqual([false, true]);
  expect(fake.state['session-a']).toMatchObject({
    leave: true,
    endedAt: 'SERVER_TIMESTAMP',
  });
  expect(fake.getConnectedHandler()).toBeNull();
});

it('updates the active session in place and keeps its final coordinates', async () => {
  const fake = createFakeFirebase();
  const store = createFirebaseSessionStore({
    firebase: {
      projectId: 'song-of-distance-staging',
      databaseURL: 'https://song-of-distance-staging.firebaseio.com',
    },
  }, fake.firebase);
  fake.releaseActivation.resolve();

  await store.startSession('session-a', {
    lat: 25.033,
    lon: 121.5654,
    timeStamp: 1700000000000,
    date: 'start',
  });
  await store.updatePosition('session-a', {
    lat: 25.091,
    lon: 121.602,
    timeStamp: 1700000005000,
    date: 'moved',
  });
  await store.endSession('session-a');

  expect(Object.keys(fake.state)).toEqual(['session-a']);
  expect(fake.state['session-a']).toMatchObject({
    lat: 25.091,
    lon: 121.602,
    timeStamp: 1700000005000,
    leave: true,
    endedAt: 'SERVER_TIMESTAMP',
  });
  store.dispose();
});

it('keeps the last synchronized coordinates when Firebase disconnects', async () => {
  const fake = createFakeFirebase();
  const store = createFirebaseSessionStore({
    firebase: {
      projectId: 'song-of-distance-staging',
      databaseURL: 'https://song-of-distance-staging.firebaseio.com',
    },
  }, fake.firebase);
  fake.releaseActivation.resolve();

  await store.startSession('session-a', {
    lat: 25.033,
    lon: 121.5654,
    timeStamp: 1700000000000,
    date: 'start',
  });
  await store.updatePosition('session-a', {
    lat: 25.091,
    lon: 121.602,
    timeStamp: 1700000005000,
    date: 'moved',
  });
  fake.simulateDisconnect();

  expect(Object.keys(fake.state)).toEqual(['session-a']);
  expect(fake.state['session-a']).toMatchObject({
    lat: 25.091,
    lon: 121.602,
    timeStamp: 1700000005000,
    leave: true,
    endedAt: 'SERVER_TIMESTAMP',
  });
  store.dispose();
});
