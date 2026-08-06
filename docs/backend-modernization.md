# Backend modernization — Firebase RTDB v12 + security rules

This branch upgrades the Firebase SDK from 7.24.0 (namespaced) to v12
(modular) and adds real database security rules. The session data model and
presence behaviour (15-second heartbeat, 60-second online window,
`onDisconnect` fallback) are unchanged.

## What changed in code

- `src/data/firebaseSessionStore.js` now uses the modular API
  (`initializeApp` / `getDatabase` / `ref` / `onValue` / `update` /
  `onDisconnect` / `serverTimestamp`) through an injectable `api` object, so
  the tests keep running against a fake with the same shape.
- Sessions now sign in with **Anonymous Authentication** before any write and
  stamp their `uid` into the session node. Reads stay public (the artwork is
  a shared radar), but a session node can only be written by the anonymous
  user that created it.
- `firebase/database.rules.json` (this repo) is the single source of truth
  for the rules described below.

## Rules summary (`firebase/database.rules.json`)

- Everything outside `earthlocations` is locked.
- `earthlocations` is world-readable.
- A session node can be created only with your own `auth.uid`, and can be
  modified only by that same uid afterwards. Deleting a node is impossible
  (`newData.exists()` is required), matching the artwork's "history is never
  erased" principle.
- Field validation: lat/lon ranges, string length caps for `showId`/`date`,
  booleans and numbers where expected, and no unknown fields (`$other`
  validate false). `lastSeen`/`endedAt` accept the numbers produced by
  `serverTimestamp()`.

Legacy 2020 session nodes have no `uid` field, so under these rules they
become read-only history: visible, never modifiable. That is exactly the
desired behaviour for the revival.

## Staging setup SOP (owner actions)

1. In the Firebase console create a **new project**, e.g.
   `song-of-distance-staging` (any ID except the production
   `song-of-distance-47ab8`, which stays blocked in `runtimeConfig.js`).
2. Add a Web App to obtain the config values; enable **Realtime Database**
   (asia-southeast1 or closest region) and **Anonymous** sign-in under
   Authentication → Sign-in method.
3. Deploy the rules: paste `firebase/database.rules.json` into the console's
   Realtime Database → Rules tab (or `firebase deploy --only database` with a
   `firebase.json` pointing at that file).
4. Copy `.env.example` → `.env.local` and fill in:

   ```text
   REACT_APP_DATA_MODE=firebase
   REACT_APP_LOCATION_MODE=browser
   REACT_APP_FIREBASE_API_KEY=...
   REACT_APP_FIREBASE_AUTH_DOMAIN=...
   REACT_APP_FIREBASE_DATABASE_URL=https://song-of-distance-staging-default-rtdb...firebasedatabase.app
   REACT_APP_FIREBASE_PROJECT_ID=song-of-distance-staging
   REACT_APP_FIREBASE_APP_ID=...
   ```

5. `npm run dev`, open two browser windows, verify: both sessions appear,
   closing a window marks it as history within 60 seconds, and the Rules
   playground rejects writes to another session's node.

## Production checklist (before ever re-enabling the 2020 database)

- [ ] Check the **current** rules of `song-of-distance-47ab8` in the console.
      The 2020 prototype likely shipped with world-writable rules; until they
      are replaced with this rules file, anyone can overwrite the archive.
      Consider exporting a JSON backup of `earthlocations` first
      (Database → ⋮ → Export JSON), stored under `private-backups/`.
- [ ] Enable Anonymous Auth on the production project.
- [ ] Deploy `firebase/database.rules.json`.
- [ ] Only then discuss removing the production block in
      `src/runtimeConfig.js` (a deliberate, separate decision).

## Socket relay note

Resolved on 2026-08-06. This note previously said the v2 client was
intentionally untouched, with the caveat that it would have to move if the
relay server were ever rewritten. The relay was in fact rewritten: the
`node-for-max` relay in the sibling `song-of-distance` checkout runs
Socket.IO 4.8.3, so the v2 client here could no longer complete a handshake
with it.

`socket.io-client` is now 4.8.3, matching the relay. The only source change is
in `src/socketUsage.js`: v4 exposes `io` as a named export, so the default
import became `import {io} from 'socket.io-client'`. The wire contract in
`docs/exhibition-protocol.md` is unchanged — same `osc` event name, same
envelope — because that contract is owned by the Max patch, not the transport.

Still untested end to end: no live browser-to-Max run has been done since the
upgrade. Do that before relying on it in an exhibition.
