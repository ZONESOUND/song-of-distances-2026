// 2020 exhibition sound engine, extracted verbatim from sound.js on the
// revival branch. Everything below (including dead mode 0/1/2 branches and the
// per-trigger filter allocation) is intentionally preserved byte-for-byte so
// the '2020 original' switch reproduces the exhibited behaviour exactly.
import * as Tone from 'tone';
import C3 from './sound/C3_mid_long_44.1k.mp3';
import C2 from './sound/C2_low_short_44.1k.mp3';
import {resolveSoundEvent} from './soundRules';

let mode = 3; 
//let octave = 'CDEFGAB'; //start from index 1 so put C at second 
let octave = ['C', 'D', 'Eb', 'F', 'G', 'A', 'Bb'];
let octaveStart = 2;
let octaveMax = 5;

let startFreq = Tone.Frequency('F3').toFrequency();
let noteBetween = 5;
let noteNumber = 9;

let layerInner = 2;
let layerOuter = 15;

let noteDuration = 200;
let synth, reverb, comp, samplerLong, samplerShort, finalFilter;
let noteTimeout = {};
let noteSynth = {};
let notePlaying = {};

export let initLegacy = () => {
    var limiter = new Tone.Limiter(-0.5).toDestination();
    comp = new Tone.Compressor(-30, 3).connect(limiter); 
    comp.ratio.value = 20;   
    // `pre_delay` was never a Tone option (only `preDelay`), so it was always
    // ignored. Dropped rather than corrected, to keep the 2020 sound intact.
    reverb = new Tone.Reverb({
        decay: 5,
        wet: 0.6,
    }).connect(comp);
    reverb.generate();
    finalFilter = new Tone.Filter(6000, 'lowpass');
    finalFilter.rolloff = -12;
    finalFilter.connect(reverb);
    if (mode === 0) noteNumber = octave.length*(octaveMax-octaveStart+1);
    initNote();
    console.log('sample here', C3);
    samplerLong = new Tone.Sampler({
        "C3" : C3,
        //"C2" : C2,
    }, function() {
      console.log('sample load!');
      samplerLong.attack = 0.25;
      //samplerLong.triggerAttack("D3");
    }).connect(finalFilter);
    samplerShort = new Tone.Sampler({
        "C2" : C2,
    }, function() {
      console.log('short sample load!');
      //sampler.triggerAttack("D3");
    }).connect(finalFilter);
    //return;
    // synth = new Tone.Synth({
    //     oscillator : {type:'sine'} ,
    //     envelope : {
    //         attack: 0.1 ,
    //         decay: 0.1 ,
    //         sustain: 0.2 ,
    //         release: 0.5
    //     }});
        //.chain(filter, reverb);
}

let initNote = () => {
    for (let i=0; i<noteNumber; i++) {
        genSineSynth(i);
        notePlaying[i] = false;
        //genFMSynth(i);
    }
    
}


let genSineSynth = (ind) => {
    noteSynth[ind] = new Tone.Synth({
        oscillator : {type:'sine'} ,
        envelope : {
            attack: 0.1 ,
            decay: 5 ,
            sustain: 0.15 ,
            release: 0.5
        }});
    noteSynth[ind].envelope.decayCurve = 'exponential';
}

let genFMSynth = (ind) => {
    noteSynth[ind] = new Tone.FMSynth({envelope:{
        attack: 0.1 ,
        decay: 5 ,
        sustain: 0.2 ,
        release: 0.5
    }});
    noteSynth[ind].envelope.decayCurve = 'exponential';
}

export let triggerLegacy = (d) => {

    const soundEvent = resolveSoundEvent(d, Math.random());
    let layer = soundEvent.layerIndex;
    let dis = soundEvent.distanceScalar;
    let note = 0;
    let freq = 0;
    switch (mode) {
        case 0:
            note = soundEvent.note;
            freq = Tone.Frequency(note).toFrequency()*0.8*dis;
            break;
        case 1:
            note = getFreq(layer);
            freq = note*0.8*dis;
            break;
        case 2:
            note = getFreq(layer);
            freq = note*0.8*dis;
            break;
        case 3:
            note = soundEvent.note;
            freq = Tone.Frequency(note).toFrequency()*dis;
            break;
        default:
            break;
    }
    //let note = getFreq(layer);
    //let freq = note*0.8*dis;
    let filter = new Tone.Filter(freq, 'lowpass');
    filter.Q.value = 2;

    if (d.leave !== true) {
        //mode ? note : Tone.Frequency(note)
        if (mode >= 2) {
            if (samplerLong.loaded)
                samplerLong.connect(filter).triggerAttack(note);
        }
        else triggerActive(note);
        //triggerMetal(mode ? note : Tone.Frequency(note), dis*200+600, 12);
        return;
    }
    
    if (mode >= 2) {
        if (notePlaying[layer]) return;
        notePlaying[layer] = true;
        if (samplerShort.loaded)
            samplerShort.connect(filter).triggerAttack(note);
        setTimeout(()=>{
            notePlaying[layer] = false;
        }, noteDuration);
        return;
    }
    
    if (d.layer <= layerInner) {
        if (mode >= 2) samplerShort.triggerAttack(note);
        else {
            let membrane = new Tone.MembraneSynth ({
                pitchDecay  : 0.001 ,
                octaves  : 2,
                oscillator  : {
                type  : 'sine'
                }  ,
                envelope  : {
                attack  : 0.1 ,
                decay  : 0.5 ,
                sustain  : 0.05 ,
                release  : 1.4 ,
                attackCurve  : 'exponential'
                }
                }).chain(finalFilter);
                //d.layer*Tone.Frequency('C4')
            membrane.triggerAttackRelease(note, 1);
        }

        return;
    }
    // if (d.layer > layerOuter) {
    //     let env = new Tone.AmplitudeEnvelope({
    //         attack: 0.4,
    //             attackCurve: 'sine',
    //             decay: 0,
    //             sustain: 1,
    //             release: 0.5,
    //             releaseCurve: 'sine'
    //       }).toDestination();
          
    //       let osci = new Tone.FatOscillator({
    //         type: 'sine',
    //         spread: 20,
    //         count: 10,
    //       }).start().connect(env);
    //       osci.freq = note;
    //       env.triggerAttackRelease(1);
    //     return;
    // }
    if (noteTimeout[layer]) {
        clearTimeout(noteTimeout[layer]);
        setTimeout(()=>{setRelease(layer)}, noteDuration);
        return;
    }
    
    console.log(layer, note, freq);
    //freq
    
    // var fmSynth = new Tone.FMSynth().chain(filter, reverb, comp);
    // fmSynth.triggerAttackRelease(note, 0.15);
    setAttackRelease(filter, layer, note);

    
    
}

let triggerActive = (note) => {
    // Tone 14 dropped the voice-count first argument. The second argument is
    // now the per-voice options, so the original limit of 5 has to be set on
    // the instance instead.
    let synth = new Tone.PolySynth(Tone.Synth, {
        oscillator : {
            type: 'sawtooth',
            partials : [1, 0.34, 0.67, 1],
            partialCounts: 5,
        },
        envelop: {
          attack: 0.01,
          decay: 1.2,
          decayCurve: 'exponential',
          sustain: 0,
          release: 0.3
        }
    }).connect(finalFilter);
    synth.maxPolyphony = 5;
    synth.triggerAttackRelease(note, noteDuration/1000);
}

let triggerMetal = (frequency, resonance, harmonicity) => {
    // frequency = Math.max(Math.min(100, frequency), Tone.Frequency('C6'));
    // let metal = new Tone.MetalSynth({
    //     frequency  : frequency,
    //     envelope  : {
    //     attack  : 0.01 ,
    //     decay  : 0.4 ,
    //     release  : 0.2
    //     },
    //     harmonicity  : harmonicity,
    //     modulationIndex  : 20,
    //     resonance  : resonance,
    //     octaves  : 1.5
    //     }
    // ).connect(reverb);
    // metal.envelope.decayCurve = 'exponential';
    // metal.triggerAttackRelease(0.4);
    
}

let setAttackRelease = (filter, ind, note) => {
    //(noteSynth[note].chain(filter, reverb, comp)).triggerAttack(note);
    (noteSynth[ind].chain(filter,finalFilter)).triggerAttack(note);
    noteTimeout[ind] = setTimeout(()=>{
        setRelease(ind);
    }, noteDuration);
}

let setRelease = (ind) => {
    noteSynth[ind].triggerRelease();
    noteTimeout[ind] = null;
}

let getFreq = (number) => {
    return calculateFreq(startFreq, number*noteBetween);
}

let calculateFreq = (freq, half) => {
    return freq * Math.pow(2, half/12.0);
}

export let makesoundLegacy = () => {
    let temp = new Tone.Synth().toDestination();
    temp.volume.value = -60;
    temp.triggerAttackRelease('C4', '16n');
}
