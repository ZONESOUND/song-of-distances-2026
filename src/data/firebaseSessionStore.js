import {assertFirebaseAccessIsSafe} from '../runtimeConfig';
import {getApps, initializeApp} from 'firebase/app';
import {getAuth, signInAnonymously} from 'firebase/auth';
import {
  child,
  getDatabase,
  onDisconnect,
  onValue,
  push,
  ref,
  serverTimestamp,
  update,
} from 'firebase/database';

const APP_NAME = 'song-of-distance-revival';
const HEARTBEAT_INTERVAL_MS = 15000;

// Every SDK touchpoint goes through this api object so tests can inject a
// fake with the same modular shape (see firebaseSessionStore.test.js).
const realFirebaseApi = {
  getApps,
  initializeApp,
  getAuth,
  signInAnonymously,
  getDatabase,
  ref,
  child,
  onValue,
  push,
  update,
  onDisconnect,
  serverTimestamp,
};

export const createFirebaseSessionStore = (runtimeConfig, firebaseOverride) => {
  assertFirebaseAccessIsSafe(runtimeConfig);
  const api = firebaseOverride || realFirebaseApi;
  const app = api.getApps().find((candidate) => candidate.name === APP_NAME) ||
    api.initializeApp(runtimeConfig.firebase, APP_NAME);
  const database = api.getDatabase(app);
  const auth = api.getAuth(app);
  const sessionsRef = api.ref(database, 'earthlocations');
  const connectedRef = api.ref(database, '.info/connected');
  let activeSession = null;
  let connectedUnsubscribe = null;
  let presenceQueue = Promise.resolve();
  let heartbeatTimer = null;
  let authRequest = null;

  // The database rules bind every session write to the anonymous auth uid,
  // so all queued writes wait for sign-in to complete first.
  const ensureSignedIn = () => {
    if (auth.currentUser) return Promise.resolve(auth.currentUser);
    if (!authRequest) {
      authRequest = api.signInAnonymously(auth).then(
        (credential) => credential.user,
        (error) => {
          authRequest = null;
          throw error;
        }
      );
    }
    return authRequest;
  };

  const sessionChild = (id) => api.child(sessionsRef, id);

  const enqueuePresence = (operation) => {
    const task = async () => {
      await ensureSignedIn();
      return operation();
    };
    const result = presenceQueue.then(task, task);
    presenceQueue = result.catch(() => {});
    return result;
  };

  const activateSession = async () => {
    if (!activeSession) return;
    const {id, payload} = activeSession;
    const sessionRef = sessionChild(id);
    // Create the node *before* registering the disconnect handler. The rules
    // require newData.child('uid') === auth.uid, and the server validates an
    // onDisconnect operation when it is registered: against a node that does
    // not exist yet the merged newData has no uid, so the registration is
    // rejected with PERMISSION_DENIED and the browser-died fallback silently
    // never exists. That is what left stale "active" points on the radar.
    await api.update(sessionRef, {
      ...payload,
      key: id,
      uid: auth.currentUser ? auth.currentUser.uid : null,
      leave: false,
      endedAt: null,
      lastSeen: api.serverTimestamp(),
    });
    // Best effort only. If this fails the session still works; the 60s
    // lastSeen window in sessionPresence.js is the real guarantee that a
    // silent client stops counting as active.
    try {
      await api.onDisconnect(sessionRef).update({
        leave: true,
        endedAt: api.serverTimestamp(),
      });
    } catch (error) {
      console.error('Failed to register Firebase disconnect fallback', error);
    }
  };

  const stopHeartbeat = () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  };

  const startHeartbeat = () => {
    if (heartbeatTimer) return;
    heartbeatTimer = setInterval(() => {
      enqueuePresence(async () => {
        if (!activeSession) return;
        await api.update(sessionChild(activeSession.id), {
          lastSeen: api.serverTimestamp(),
        });
      }).catch((error) => {
        console.error('Failed to update Firebase presence heartbeat', error);
      });
    }, HEARTBEAT_INTERVAL_MS);
  };

  return {
    mode: 'firebase',
    subscribeSessions(listener) {
      return api.onValue(sessionsRef, (snapshot) => listener(snapshot.val() || {}));
    },
    reserveSessionId() {
      return api.push(sessionsRef).key;
    },
    startSession(id, payload) {
      const result = enqueuePresence(async () => {
        activeSession = {id, payload};
        await activateSession();
        startHeartbeat();
      });
      if (!connectedUnsubscribe) {
        connectedUnsubscribe = api.onValue(connectedRef, (snapshot) => {
          if (snapshot.val() === true) {
            enqueuePresence(activateSession).catch((error) => {
              console.error('Failed to restore Firebase presence', error);
            });
          }
        });
      }
      return result;
    },
    renameSession(id, showId) {
      return enqueuePresence(async () => {
        if (activeSession && activeSession.id === id) {
          activeSession = {
            ...activeSession,
            payload: {...activeSession.payload, showId},
          };
        }
        await api.update(sessionChild(id), {showId});
      });
    },
    updatePosition(id, position) {
      return enqueuePresence(async () => {
        if (!activeSession || activeSession.id !== id) return;
        const patch = {
          lat: position.lat,
          lon: position.lon,
          timeStamp: position.timeStamp,
          date: position.date,
          lastSeen: api.serverTimestamp(),
        };
        activeSession = {
          ...activeSession,
          payload: {...activeSession.payload, ...patch},
        };
        await api.update(sessionChild(id), patch);
      });
    },
    endSession(id) {
      return enqueuePresence(async () => {
        if (!activeSession || activeSession.id !== id) return;
        stopHeartbeat();
        const sessionRef = sessionChild(id);
        activeSession = null;
        await api.update(sessionRef, {
          leave: true,
          endedAt: api.serverTimestamp(),
        });
        // Cancel only after the explicit history update succeeds. If the browser
        // closes mid-write, the registered onDisconnect operation remains as the
        // reliable fallback.
        await api.onDisconnect(sessionRef).cancel();
        if (connectedUnsubscribe) connectedUnsubscribe();
        connectedUnsubscribe = null;
      });
    },
    dispose() {
      stopHeartbeat();
      if (connectedUnsubscribe) connectedUnsubscribe();
      connectedUnsubscribe = null;
    },
  };
};
