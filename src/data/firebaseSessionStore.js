import {assertFirebaseAccessIsSafe} from '../runtimeConfig';
// Static imports keep Vite's ESM pipeline happy; the database entry point only
// registers the RTDB module on the firebase namespace (no Firestore/gRPC).
import firebaseApp from 'firebase/app';
import 'firebase/database';

const APP_NAME = 'song-of-distance-revival';
const HEARTBEAT_INTERVAL_MS = 15000;

const getOrCreateApp = (firebase, firebaseConfig) => {
  const existing = firebase.apps.find((app) => app.name === APP_NAME);
  return existing || firebase.initializeApp(firebaseConfig, APP_NAME);
};

export const createFirebaseSessionStore = (runtimeConfig, firebaseOverride) => {
  assertFirebaseAccessIsSafe(runtimeConfig);
  const firebase = firebaseOverride || firebaseApp;
  const app = getOrCreateApp(firebase, runtimeConfig.firebase);
  const database = app.database();
  const sessionsRef = database.ref('earthlocations');
  const connectedRef = database.ref('.info/connected');
  let activeSession = null;
  let connectedHandler = null;
  let presenceQueue = Promise.resolve();
  let heartbeatTimer = null;

  const enqueuePresence = (operation) => {
    const result = presenceQueue.then(operation, operation);
    presenceQueue = result.catch(() => {});
    return result;
  };

  const activateSession = async () => {
    if (!activeSession) return;
    const {id, payload} = activeSession;
    const sessionRef = sessionsRef.child(id);
    await sessionRef.onDisconnect().update({
      leave: true,
      endedAt: firebase.database.ServerValue.TIMESTAMP,
    });
    await sessionRef.update({
      ...payload,
      key: id,
      leave: false,
      endedAt: null,
      lastSeen: firebase.database.ServerValue.TIMESTAMP,
    });
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
        await sessionsRef.child(activeSession.id).update({
          lastSeen: firebase.database.ServerValue.TIMESTAMP,
        });
      }).catch((error) => {
        console.error('Failed to update Firebase presence heartbeat', error);
      });
    }, HEARTBEAT_INTERVAL_MS);
  };

  return {
    mode: 'firebase',
    subscribeSessions(listener) {
      const handler = (snapshot) => listener(snapshot.val() || {});
      sessionsRef.on('value', handler);
      return () => sessionsRef.off('value', handler);
    },
    reserveSessionId() {
      return sessionsRef.push().key;
    },
    startSession(id, payload) {
      const result = enqueuePresence(async () => {
        activeSession = {id, payload};
        await activateSession();
        startHeartbeat();
      });
      if (!connectedHandler) {
        connectedHandler = (snapshot) => {
          if (snapshot.val() === true) {
            enqueuePresence(activateSession).catch((error) => {
              console.error('Failed to restore Firebase presence', error);
            });
          }
        };
        connectedRef.on('value', connectedHandler);
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
        await sessionsRef.child(id).update({showId});
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
          lastSeen: firebase.database.ServerValue.TIMESTAMP,
        };
        activeSession = {
          ...activeSession,
          payload: {...activeSession.payload, ...patch},
        };
        await sessionsRef.child(id).update(patch);
      });
    },
    endSession(id) {
      return enqueuePresence(async () => {
        if (!activeSession || activeSession.id !== id) return;
        stopHeartbeat();
        const sessionRef = sessionsRef.child(id);
        activeSession = null;
        await sessionRef.update({
          leave: true,
          endedAt: firebase.database.ServerValue.TIMESTAMP,
        });
        // Cancel only after the explicit history update succeeds. If the browser
        // closes mid-write, the registered onDisconnect operation remains as the
        // reliable fallback.
        await sessionRef.onDisconnect().cancel();
        if (connectedHandler) connectedRef.off('value', connectedHandler);
        connectedHandler = null;
      });
    },
    dispose() {
      stopHeartbeat();
      if (connectedHandler) connectedRef.off('value', connectedHandler);
      connectedHandler = null;
    },
  };
};
