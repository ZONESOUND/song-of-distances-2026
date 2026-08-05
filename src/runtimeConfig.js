const PRODUCTION_PROJECT_ID = 'song-of-distance-47ab8';

const readBoolean = (value, fallback = false) => {
  if (value === undefined) return fallback;
  return value === 'true' || value === 'on' || value === '1';
};

const readNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const dataMode = import.meta.env.REACT_APP_DATA_MODE || 'fixture';
const locationMode = import.meta.env.REACT_APP_LOCATION_MODE ||
  (dataMode === 'fixture' ? 'fixture' : 'browser');
const socketMode = import.meta.env.REACT_APP_SOCKET_MODE || 'off';

if (!['fixture', 'firebase'].includes(dataMode)) {
  throw new Error(`Unsupported REACT_APP_DATA_MODE: ${dataMode}`);
}

if (!['fixture', 'browser'].includes(locationMode)) {
  throw new Error(`Unsupported REACT_APP_LOCATION_MODE: ${locationMode}`);
}

if (!['off', 'client'].includes(socketMode)) {
  throw new Error(`Unsupported REACT_APP_SOCKET_MODE: ${socketMode}`);
}

export const runtimeConfig = {
  dataMode,
  locationMode,
  fixedLocation: {
    lat: readNumber(import.meta.env.REACT_APP_FIXED_LAT, 25.033),
    lon: readNumber(import.meta.env.REACT_APP_FIXED_LON, 121.5654),
  },
  fixtureCount: Math.max(0, Math.floor(
    readNumber(import.meta.env.REACT_APP_FIXTURE_COUNT, 100)
  )),
  fixtureActiveCount: Math.max(0, Math.floor(
    readNumber(import.meta.env.REACT_APP_FIXTURE_ACTIVE_COUNT, 10)
  )),
  fixtureMotionEnabled: readBoolean(
    import.meta.env.REACT_APP_FIXTURE_MOTION,
    false
  ),
  fixtureMotionIntervalMs: Math.max(250, Math.floor(
    readNumber(import.meta.env.REACT_APP_FIXTURE_MOTION_INTERVAL, 1500)
  )),
  socketMode,
  socketUrl: (import.meta.env.REACT_APP_SOCKET_URL || '').trim(),
  oscOutputEnabled: readBoolean(import.meta.env.REACT_APP_OSC_OUTPUT),
  showDiagnostics: readBoolean(
    import.meta.env.REACT_APP_SHOW_DIAGNOSTICS,
    dataMode === 'fixture'
  ),
  firebase: {
    apiKey: import.meta.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: import.meta.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    databaseURL: import.meta.env.REACT_APP_FIREBASE_DATABASE_URL,
    projectId: import.meta.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.REACT_APP_FIREBASE_APP_ID,
  },
};

const parseDatabaseUrl = (databaseURL) => {
  try {
    const parsed = new URL(databaseURL);
    return {
      protocol: parsed.protocol,
      hostname: parsed.hostname.toLowerCase().replace(/\.$/, ''),
      namespace: parsed.searchParams.get('ns'),
    };
  } catch (error) {
    throw new Error('REACT_APP_FIREBASE_DATABASE_URL must be a valid URL.');
  }
};

const databaseUrlMatchesProject = (databaseURL, projectId) => {
  const {protocol, hostname, namespace} = parseDatabaseUrl(databaseURL);
  if (protocol !== 'https:') return false;
  if (namespace && namespace !== projectId) return false;
  return hostname === `${projectId}.firebaseio.com` ||
    hostname === `${projectId}-default-rtdb.firebaseio.com` ||
    (
      hostname.startsWith(`${projectId}-`) &&
      hostname.endsWith('.firebasedatabase.app')
    );
};

const databaseUrlTargetsProduction = (databaseURL) => {
  const {hostname, namespace} = parseDatabaseUrl(databaseURL);
  const productionPrefix = `${PRODUCTION_PROJECT_ID}-`;
  return namespace === PRODUCTION_PROJECT_ID ||
    Boolean(namespace && namespace.startsWith(productionPrefix)) ||
    hostname === `${PRODUCTION_PROJECT_ID}.firebaseio.com` ||
    (
      hostname.startsWith(productionPrefix) &&
      (
        hostname.endsWith('.firebaseio.com') ||
        hostname.endsWith('.firebasedatabase.app')
      )
    );
};

export const assertFirebaseAccessIsSafe = (config = runtimeConfig) => {
  const firebaseConfig = config.firebase;
  if (!firebaseConfig.projectId || !firebaseConfig.databaseURL) {
    throw new Error(
      'Firebase mode requires REACT_APP_FIREBASE_PROJECT_ID and ' +
      'REACT_APP_FIREBASE_DATABASE_URL.'
    );
  }

  if (firebaseConfig.projectId === PRODUCTION_PROJECT_ID ||
      databaseUrlTargetsProduction(firebaseConfig.databaseURL)) {
    throw new Error(
      'Production Firebase is disabled on the revival branch. Use fixture or staging mode.'
    );
  }

  if (!databaseUrlMatchesProject(
    firebaseConfig.databaseURL,
    firebaseConfig.projectId
  )) {
    throw new Error(
      'Firebase project ID and database URL are inconsistent; access is blocked.'
    );
  }
};

const isLoopbackUrl = (value) => {
  try {
    const parsed = new URL(value);
    return parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
  } catch (error) {
    return false;
  }
};

export const assertSocketAccessIsSafe = (config = runtimeConfig) => {
  if (config.socketMode === 'off') return;
  if (!config.socketUrl) {
    throw new Error('Socket client mode requires REACT_APP_SOCKET_URL.');
  }
  if (config.dataMode === 'fixture' && !isLoopbackUrl(config.socketUrl)) {
    throw new Error('Fixture mode only permits a localhost Socket.IO server.');
  }
};
