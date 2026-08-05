// Dev-only audition helper. Records the real engine output (same Tone
// instance as the app) into webm takes and POSTs them to a local receiver,
// so sound-design changes can be compared by ear outside the browser.
//
// Usage from the browser console on a running dev server:
//   import('/src/devRecorder.js').then((m) => m.recordTakes())
//
// Never imported by application code.

import Tone from 'tone';
import {setEngine, triggerSound, updateSoundScene} from './sound';
import {setSoundParam} from './soundConfig';

const mulberry = (seed) => () => {
  seed |= 0;
  seed = seed + 0x6D2B79F5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};

// One deterministic 17-second radar-like trigger sequence shared by every take.
const makeSequence = () => {
  const rnd = mulberry(20260805);
  const sequence = [];
  let t = 0;
  while (t < 17000) {
    sequence.push({
      t,
      layer: 1 + Math.floor(rnd() * 8) + rnd() * 0.9,
      dist: 40 + rnd() * 700,
      degree: rnd() * 360 - 180,
      leave: rnd() < 0.35,
    });
    t += 220 + rnd() * 260;
  }
  return sequence;
};

export const recordTakes = async (uploadBase = 'http://127.0.0.1:8899') => {
  const log = (message) => console.log('REC2:', message);
  const raw = Tone.context._context || Tone.context.rawContext;
  const dest = raw.createMediaStreamDestination();
  const analyser = raw.createAnalyser();
  analyser.fftSize = 2048;
  Tone.Master.connect(dest);
  Tone.Master.connect(analyser);

  const peakLevel = () => {
    const data = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(data);
    let peak = 0;
    for (let i = 0; i < data.length; i++) {
      peak = Math.max(peak, Math.abs(data[i]));
    }
    return peak;
  };

  const record = (name) => new Promise((resolve) => {
    const recorder = new MediaRecorder(dest.stream, {mimeType: 'audio/webm'});
    const chunks = [];
    let peak = 0;
    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.onstop = async () => {
      const blob = new Blob(chunks, {type: 'audio/webm'});
      try {
        const response = await fetch(`${uploadBase}/save?name=${name}`, {
          method: 'POST',
          body: blob,
        });
        log(`${name} uploaded ${blob.size} bytes, peak=${peak.toFixed(3)}, ` +
          await response.text());
      } catch (error) {
        log(`UPLOAD FAIL ${name}: ${error.message}`);
      }
      resolve();
    };
    recorder.start();
    const sequence = makeSequence();
    sequence.forEach((event) => {
      setTimeout(() => triggerSound(event), event.t);
    });
    const meter = setInterval(() => {
      peak = Math.max(peak, peakLevel());
    }, 250);
    setTimeout(() => {
      clearInterval(meter);
      log(`${name} finished, peak=${peak.toFixed(3)}`);
      recorder.stop();
    }, 21000);
  });

  updateSoundScene({activeCount: 6, totalCount: 80});
  log('take A: 2020 original');
  setSoundParam('sweepDepth', 0);
  setSoundParam('octaveSpread', 0);
  setEngine('legacy');
  await record('take-A-2020-original.webm');
  await new Promise((resolve) => setTimeout(resolve, 3000));

  log('take B: v2 subtle (no sweep/octave)');
  setEngine('v2');
  await record('take-B-v2-subtle.webm');
  await new Promise((resolve) => setTimeout(resolve, 3000));

  log('take C: v2 + bandpass sweep + octave spread');
  setSoundParam('sweepDepth', 0.7);
  setSoundParam('octaveSpread', 0.5);
  await record('take-C-v2-sweep-octave.webm');
  log('ALL DONE');
};
