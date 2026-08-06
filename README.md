# Song of Distances — 2026 revival branch

This branch restores the maintainable source for the installation while keeping
the published `gh-pages` branch untouched.

`npm run deploy` is intentionally blocked on this branch. Publishing must be a
separate, explicit release step after local and staging validation.

## Safe local start

```sh
npm ci
npm start
```

The dependency tree resolves cleanly, so `--legacy-peer-deps` is no longer
needed. See `docs/dependency-upgrades.md`.

Open <http://localhost:5173>. With no `.env.local`, the application uses fixed
GPS, deterministic current/history fixtures, no Firebase connection, and no
Socket.IO connection. The default rehearsal dataset contains 100 nodes, with
exactly 10 active nodes. Its seeded Gaussian layout is denser near the centre
while retaining a broad, irregular tail toward the outer rings. Fixture motion
is off by default, so the active count remains stable during visual checks. The
preview uses 100 original, exhibition-style display names with short phrases,
multiple languages, and emoji. They evoke the audience energy of the earlier
installation without copying names from the production Firebase archive.

The radar sweep length follows the canvas diagonal instead of using a fixed
pixel length, so the beam reaches the edge on wide exhibition displays.

Run the checks with:

```sh
npm test
npm run lint
npm run build
```

`npm test` runs Vitest once and exits; the old Jest `--watchAll=false` flag no
longer applies. `npm run lint` is expected to report warnings and no errors:
the warnings flag the 2019/2020 exhibition sources, which stay as they are.

## Topology controls

Press `H` while the artwork is open to show or hide the dat.GUI panel. The
controls are saved for the current browser tab; use `還原原始參數` to return to
the defaults.

- `距離比例 globalScale`: overall geographic zoom. Increasing it moves the same
  GPS separation farther from the centre.
- `拓樸曲線 globalPow`: nonlinear near/far spacing. It changes the relationship
  between inner and outer rings rather than applying a uniform zoom.
- `雷達速度 radioSpeed`: angular speed of the scanning beam.

The fixture defaults can be changed in `.env.local`:

```text
REACT_APP_FIXTURE_COUNT=100
REACT_APP_FIXTURE_ACTIVE_COUNT=10
REACT_APP_FIXTURE_MOTION=false
```

The build still uses the legacy CRA/Webpack architecture. Webpack and Firebase
remain in their original major versions, with compatibility updates that allow
installation and builds on the current Mac/Node environment.

## Exhibition connection

Copy `.env.example` to `.env.local` and opt in to a local Socket.IO relay:

```text
REACT_APP_SOCKET_MODE=client
REACT_APP_SOCKET_URL=http://127.0.0.1:3001
REACT_APP_OSC_OUTPUT=on
```

See [docs/exhibition-protocol.md](docs/exhibition-protocol.md) for the legacy
`/gps/radio` and `/gps/trigger` message contract.

## Firebase

Local development should use fixture mode or a separate staging project. There
are no production Firebase credentials in this branch. Production database URLs
and project IDs are completely blocked until authentication, database rules, and
staging validation are complete.

Ending a session marks it as historical with `leave: true` and `endedAt`; session
nodes are never deleted by the web application. While a visitor keeps the page
open, every browser GPS fix updates that same session node. The latest coordinate
is therefore retained when the session becomes historical.

Online status is presence-based rather than trusting `leave: false` forever.
Firebase sessions publish a server-timed heartbeat every 15 seconds; a node is
shown as active only when it is explicitly active and was seen within the last
60 seconds. Stale legacy sessions are rendered as history without rewriting or
deleting their stored coordinates.
