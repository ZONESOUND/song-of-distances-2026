# Dependency upgrades

Record of what moves, what deliberately does not, and why. Prepared with
Claude (Claude Code); see the `Co-Authored-By` trailers in `git log`.

## 2026-08-06, round 1

Superseded in part by round 2 below: the Vite 8 revert and the "deliberately
not upgraded" list were both undone the same day, on request.

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
does. Vite stayed on 7 for round 1 rather than carrying a hand-written interop
shim into an exhibition build. The real fix was to replace the deprecated
wrapper, which round 2 did; Vite 8 went in cleanly afterwards.

### .env.test

`src/runtimeConfig.test.js` asserts what an unconfigured build does. It read
whatever `.env.local` the developer happened to have, so a staging Firebase
config turned two tests red for reasons unrelated to the code. Vite loads
`.env.[mode]` at a higher priority than `.env.local` and Vitest runs in mode
`test`, so a committed `.env.test` that blanks the `REACT_APP_*` values
restores the unconfigured state. Values are left empty rather than set to
`fixture` so `runtimeConfig` still exercises its own fallbacks.

### Deferred at the time (all done in round 2)

These all change what the piece looks or sounds like, so the recommendation was
to give each its own branch and its own A/B check rather than fold them into a
dependency sweep. Po-Hao asked for all of them anyway; see round 2.

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

## 2026-08-06, round 2: the deferred majors

Po-Hao asked for all of them. The caution in round 1 stands as a record of the
recommendation; this section records what actually happened.

### Upgraded

| Package | From | To |
| --- | --- | --- |
| `react`, `react-dom` | 16.14.0 | **19.2.8** |
| `p5` | 0.10.2 | **2.3.2** |
| `react-p5-wrapper` | 2.4.1 | **`@p5-wrapper/react` 5.0.4** |
| `tone` | 13.8.34 | **15.1.22** |
| `bootstrap` | 4.6.2 | **5.3.8** |
| `react-bootstrap` | 1.6.8 | **2.10.10** |
| `vite` | 7.3.6 | **8.2.1** |
| `@vitejs/plugin-react` | 5.2.0 | **6.0.5** |

`npm audit` still reports 0 vulnerabilities.

### These four are locked together by peer ranges

`@p5-wrapper/react` 5 requires React >= 19 **and** p5 >= 2, and v4 requires
React >= 18. So p5 2 forces wrapper 5, which forces React 19. There is no
intermediate step at React 18 that also gets p5 2. React 19 in turn forces
react-bootstrap 2 (1.6.8 renders `Modal` as `undefined` under React 19), and
react-bootstrap 2 targets Bootstrap 5. One coherent stack, not five choices.

### Source changes

- `src/index.jsx`: `ReactDOM.render` → `createRoot`. StrictMode is left off on
  purpose — its double effect invocation would start the audio graph and the
  p5 sketch twice in development.
- `src/ControlPanel.jsx`: `P5Wrapper` → `P5Canvas`. Note the rename: v4 called
  it `ReactP5Wrapper`, v5 calls it `P5Canvas`.
- `src/sketch.js`: `p.myCustomRedrawAccordingToNewPropsHandler` →
  `p.updateWithProps`. Same contract.
- Tests: `createRoot` + `act` from `react` (React 19 removed
  `ReactDOM.render`, `unmountComponentAtNode` and `react-dom/test-utils`),
  and a new `src/setupTests.js` setting `IS_REACT_ACT_ENVIRONMENT`.
- Tone: namespace import (`import * as Tone from 'tone'` — v15 has no default
  export), `.toMaster()` → `.toDestination()`, `Tone.Buffer` →
  `Tone.ToneAudioBuffer`, `Tone.BufferSource` → `Tone.ToneBufferSource`,
  `Tone.context` → `Tone.getContext()`, `Tone.Master` →
  `Tone.getDestination()`, and `new PolySynth(5, Synth, opts)` →
  `new PolySynth(Synth, opts)` with `maxPolyphony = 5` set on the instance
  (v14 made the second argument the per-voice options).
- `Tone.Sampler`'s positional `(urls, onload)` form still works in v15, so the
  legacy sampler construction is unchanged.

### A dead reverb parameter, left dead

Both engines built their reverb with `pre_delay: 0.05`. Tone has only ever
accepted `preDelay` — verified against the 13.8.34 build still present in the
sibling checkout — so the option has been silently discarded since 2020 and
the reverb has always run at the default pre-delay.

It is removed rather than corrected. Correcting the spelling would introduce a
50 ms pre-delay the piece has never had, which is a compositional change, not
an upgrade. Set `preDelay` deliberately if that is ever wanted.

### p5 2 turned out to be cheap

The sketch uses no `preload()` and loads no assets through p5, so the headline
p5 2.0 break (preload removed in favour of async setup) does not apply. Every
p5 call in `src/sketch.js` is core 2D drawing that survived the major.

### Vite 8, second attempt

Clean. The round 1 blocker was entirely `react-p5-wrapper`'s Babel-style CJS
interop; with that package gone, Vite 8 builds and runs with no console errors.
Build time dropped to roughly 0.4 s. `@p5-wrapper/react` also lazy-loads p5, so
the main chunk fell from 1,887 kB to 828 kB with p5 split into its own chunk.

### Verification

- `npm test` — 47 tests pass.
- `npm run lint` — 0 errors.
- `npm run build` — succeeds.
- Browser, fixture mode, read live off the running page: React **19.2.8**,
  p5 **2.3.2**, Tone **15.1.22**, one canvas at 2560x1440 inside
  `.canvas-container`, radar sweep and topology rings animating, **no console
  errors**. Both legacy samples load under Tone 15 (`sample load!`,
  `short sample load!`).

### Not verified, and it matters

**Nobody has listened to this.** The audio was confirmed to construct, load its
samples and raise no errors — not to sound the same. Tone 15 changed scheduling
internals, and the v2 engine's whole reason to exist is voice behaviour over a
long run. Before this goes near an exhibition:

- A/B the v2 engine and the `2020 原味` legacy engine against the recordings in
  `audition-takes/` on real speakers.
- Run the piece long enough to see whether the voice pool still behaves.
- Check `devRecorder.js` still captures, since it was ported blind
  (`Tone.getContext().rawContext`, `Tone.getDestination()`).

Also still unverified from round 1: the live browser-to-Max Socket.IO run, and
anything touching Firebase.

