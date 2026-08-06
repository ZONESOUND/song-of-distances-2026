# Dependency upgrades

Record of what moves, what deliberately does not, and why. Prepared with
Claude (Claude Code); see the `Co-Authored-By` trailers in `git log`.

## 2026-08-06

### Upgraded

| Package | From | To | Note |
| --- | --- | --- | --- |
| `socket.io-client` | 2.5.0 | 4.8.3 | Correctness fix, see below |
| `eslint-plugin-react-hooks` | 5.2.0 | 7.1.1 | Adds the React Compiler rule set |
| `jsdom` | 26.1.0 | 30.0.1 | Test environment only |
| `vitest` | 3.2.7 | 4.1.10 | |
| `globals` | 16.5.0 | 17.9.0 | |
| `@eslint/js` | 10.0.1 | 9.39.5 | Downgraded on purpose, see below |
| `bootstrap` | `^4.4.1` | `^4.6.2` | Range tightened to the installed version |
| `dat.gui` | `^0.7.6` | `^0.7.9` | Range only |
| `react`, `react-dom` | `^16.10.2` | `^16.14.0` | Range only |
| `react-bootstrap` | `^1.0.0-beta.16` | `^1.6.8` | Range only; the old floor allowed a beta |
| `react-p5-wrapper` | `^2.0.0` | `^2.4.1` | Range only |
| `tone` | `^13.8.25` | `^13.8.34` | Range only |

The lockfile was regenerated. The tree now resolves without
`--legacy-peer-deps` and `npm audit` reports **0 vulnerabilities**.

### socket.io-client v2 could not talk to the relay

`docs/backend-modernization.md` used to record the v2 client as intentionally
frozen. That was correct when written, but the `node-for-max` relay in the
sibling `song-of-distance` checkout has since moved to Socket.IO 4.8.3, and a
v2 client cannot handshake with a v4 server. The client is now 4.8.3 and
`src/socketUsage.js` uses v4's named `io` export.

### @eslint/js was pinned ahead of eslint

`package.json` asked for `@eslint/js@^10`, which peer-requires `eslint@^10`,
while `eslint` itself was pinned to `^9`. Every install had to paper over this
with `--legacy-peer-deps`. The fix is to align `@eslint/js` down to 9 rather
than push eslint up to 10, because the current `eslint-plugin-react@7.37.5`
still declares support only through eslint 9.7. Revisit when that plugin
ships eslint 10 support.

### Vite 8 was tried and reverted

Vite 8 builds and passes the suite, and its build is roughly four times
faster, but the artwork does not run: `react-p5-wrapper` 2.4.1 is CJS built by
Babel (`exports.default` plus `__esModule`), and Vite 8's prebundler re-exports
the whole CJS object as the default. `import P5Wrapper from 'react-p5-wrapper'`
then arrives as `{default: Component}` and React throws "Element type is
invalid" at `ControlPanel.jsx:393`. `optimizeDeps.needsInterop` did not change
the prebundle output. p5, Tone and socket.io-client assign `module.exports`
directly and are unaffected.

Neither `npm test` nor `npm run build` catches this — only loading the page
does. Vite stays on 7 (and `@vitejs/plugin-react` on 5, which requires Vite 8
at version 6) rather than carrying a hand-written interop shim into an
exhibition build. The real fix is `@p5-wrapper/react` v4, which needs React 18;
do both together.

### .env.test

`src/runtimeConfig.test.js` asserts what an unconfigured build does. It read
whatever `.env.local` the developer happened to have, so a staging Firebase
config turned two tests red for reasons unrelated to the code. Vite loads
`.env.[mode]` at a higher priority than `.env.local` and Vitest runs in mode
`test`, so a committed `.env.test` that blanks the `REACT_APP_*` values
restores the unconfigured state. Values are left empty rather than set to
`fixture` so `runtimeConfig` still exercises its own fallbacks.

### Deliberately not upgraded

These all change what the piece looks or sounds like, so they want their own
branch and their own A/B check, not a dependency sweep:

- **React 16 → 18.3.** Prerequisite for the two below. StrictMode's double
  effect invocation needs checking against audio and p5 setup.
- **`react-p5-wrapper` 2 → `@p5-wrapper/react` 4.** Package was renamed and is
  deprecated at 2.x. Needs React 18.
- **p5 0.10 → 2.** Compare topology and radar by screenshot.
- **Tone 13 → 15.** `toMaster()`, the Sampler and PolySynth constructors, and
  the AudioContext start flow all changed. Needs real speaker/headphone
  listening, not a test run.
- **Bootstrap 4 → 5 with react-bootstrap 1 → 2.** Only the three modals use
  it; the upgrade is mostly restyling them.

### Verification

- `npm test` — 12 files, 47 tests, all passing, with `.env.local` present.
- `npm run lint` — 0 errors, 59 warnings (all pre-existing advisories on the
  2019/2020 sources).
- `npm run build` — succeeds.
- Browser, fixture mode: radar sweep, topology rings, compass markers and the
  diagnostics panel all render and animate; no console errors.
- Not verified: live browser-to-Max Socket.IO run, and any Firebase read/write
  (the staging database is currently deactivated, see below).

### Staging Firebase

`.env.local` now points at the `song-of-distance-testing` project. The config
loads and passes the guards in `src/runtimeConfig.js`, but the Realtime
Database instance answers with
`FIREBASE WARNING: The Firebase database 'song-of-distance-testing-default-rtdb'
has been deactivated`. Enable that instance in the Firebase console before
using staging for anything.
