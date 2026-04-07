import { MusicStyle, Instrument } from '../types';

/**
 * Creates a synthetic reverb impulse response.
 */
const createReverbImpulse = (ctx: AudioContext, duration: number = 2, decay: number = 2.0): AudioBuffer => {
  const rate = ctx.sampleRate;
  const length = rate * duration;
  const impulse = ctx.createBuffer(2, length, rate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);

  for (let i = 0; i < length; i++) {
    // Randomized impulse with exponential decay
    const n = i / length;
    const gain = Math.pow(1 - n, decay);
    left[i] = (Math.random() * 2 - 1) * gain;
    right[i] = (Math.random() * 2 - 1) * gain;
  }
  return impulse;
};

/**
 * Concatenates multiple AudioBuffers into one.
 */
export const concatenateAudioBuffers = (ctx: AudioContext, buffers: AudioBuffer[]): AudioBuffer => {
  if (buffers.length === 0) return ctx.createBuffer(2, ctx.sampleRate * 1, ctx.sampleRate);
  
  const totalLength = buffers.reduce((acc, b) => acc + b.length, 0);
  const result = ctx.createBuffer(2, totalLength, ctx.sampleRate);
  
  let offset = 0;
  for (const buff of buffers) {
    for (let channel = 0; channel < 2; channel++) {
        // Handle mono inputs by duplicating to stereo if needed
        const inputChannel = channel < buff.numberOfChannels ? channel : 0;
        result.getChannelData(channel).set(buff.getChannelData(inputChannel), offset);
    }
    offset += buff.length;
  }
  
  return result;
};

/**
 * Applies "Studio Polish" to the raw vocal track:
 * 1. Dynamics Compression (even out volume)
 * 2. High-pass Filter (remove rumble)
 * 3. Reverb (Space)
 */
export const processVocalTrack = async (
  rawBuffer: AudioBuffer, 
  pitchShiftSemitones: number = 0
): Promise<AudioBuffer> => {
  // We use OfflineAudioContext to render effects faster than real-time
  const offlineCtx = new OfflineAudioContext(2, rawBuffer.length, rawBuffer.sampleRate);
  
  const source = offlineCtx.createBufferSource();
  source.buffer = rawBuffer;

  // Pitch shift via playback rate if needed (simple resampling)
  if (pitchShiftSemitones !== 0) {
     const rate = Math.pow(2, pitchShiftSemitones / 12);
     source.playbackRate.value = rate;
  }

  // Chain: Source -> EQ -> Compressor -> Reverb -> Destination
  
  // 1. EQ (High Pass)
  const highPass = offlineCtx.createBiquadFilter();
  highPass.type = 'highpass';
  highPass.frequency.value = 80; // Remove low rumble
  
  // 2. Compressor
  const compressor = offlineCtx.createDynamicsCompressor();
  compressor.threshold.value = -24;
  compressor.knee.value = 30;
  compressor.ratio.value = 12;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.25;

  // 3. Reverb (Parallel processing)
  const convolver = offlineCtx.createConvolver();
  convolver.buffer = createReverbImpulse(offlineCtx as any, 1.5, 2.5); // 1.5s reverb
  const reverbGain = offlineCtx.createGain();
  reverbGain.gain.value = 0.15; // 15% wet signal for clarity
  
  const dryGain = offlineCtx.createGain();
  dryGain.gain.value = 1.0;

  // Wiring
  source.connect(highPass);
  highPass.connect(compressor);
  
  // Split to Dry and Wet
  compressor.connect(dryGain);
  compressor.connect(convolver);
  convolver.connect(reverbGain);
  
  // Merge
  dryGain.connect(offlineCtx.destination);
  reverbGain.connect(offlineCtx.destination);

  source.start(0);

  return await offlineCtx.startRendering();
};

/**
 * Generates a procedural backing track based on selected instruments and style.
 * Uses the analyzed BPM to sync with the user's singing.
 */
export const createProceduralBackingTrack = async (
  ctx: AudioContext,
  duration: number,
  style: MusicStyle,
  instruments: Instrument[],
  bpm: number // Explicit BPM from analysis
): Promise<AudioBuffer> => {
  const sampleRate = ctx.sampleRate;
  const frameCount = Math.ceil(sampleRate * duration);
  const buffer = ctx.createBuffer(2, frameCount, sampleRate);
  
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  const subdivision = 0.25; // Quarter notes by default
  const secondsPerBeat = 60 / bpm;

  // --- SYNTHESIS HELPERS ---

  const addToBuffer = (index: number, value: number, pan: number = 0) => {
    if (index >= 0 && index < frameCount) {
      // Pan: -1 (left) to 1 (right)
      const leftGain = Math.min(1, 1 - pan);
      const rightGain = Math.min(1, 1 + pan);
      
      left[index] += value * leftGain;
      right[index] += value * rightGain;
    }
  };

  // 1. DRUMS (Kick, Snare, HiHat)
  const synthDrums = (t: number, type: 'kick' | 'snare' | 'hihat') => {
    const startIdx = Math.floor(t * sampleRate);
    const dur = type === 'kick' ? 0.15 : type === 'snare' ? 0.1 : 0.05;
    const length = Math.floor(dur * sampleRate);
    
    for (let i = 0; i < length; i++) {
        const time = i / sampleRate;
        let val = 0;
        
        if (type === 'kick') {
            const freq = 150 * Math.exp(-time * 25);
            val = Math.sin(2 * Math.PI * freq * time);
            val *= Math.max(0, 1 - time * 6);
        } else if (type === 'snare') {
            const white = Math.random() * 2 - 1;
            val = white * Math.max(0, 1 - time * 15);
            val += Math.sin(2 * Math.PI * 180 * time) * Math.max(0, 1 - time * 10) * 0.5;
        } else {
            const white = Math.random() * 2 - 1;
            if (i % 2 === 0) val = white * 0.5 * Math.max(0, 1 - time * 30);
        }
        
        addToBuffer(startIdx + i, val * 0.4);
    }
  };

  // 2. TABLA
  const synthTabla = (t: number, type: 'na' | 'ge') => {
    const startIdx = Math.floor(t * sampleRate);
    const dur = type === 'ge' ? 0.3 : 0.15;
    const length = Math.floor(dur * sampleRate);
    
    for (let i = 0; i < length; i++) {
        const time = i / sampleRate;
        let val = 0;

        if (type === 'ge') {
            const freq = 80 * (1 - (time * 0.5)); 
            val = Math.sin(2 * Math.PI * freq * time);
            val *= Math.max(0, 1 - time * 3); 
        } else {
            const freq = 600;
            val = Math.sin(2 * Math.PI * freq * time);
            val += Math.sin(2 * Math.PI * freq * 3.5 * time) * 0.2;
            val *= Math.max(0, 1 - time * 10);
        }
        addToBuffer(startIdx + i, val * 0.35, type === 'ge' ? -0.3 : 0.3);
    }
  };

  // 3. PIANO
  const synthPiano = (t: number, freq: number, duration: number) => {
    const startIdx = Math.floor(t * sampleRate);
    const length = Math.floor(duration * sampleRate);
    
    for (let i = 0; i < length; i++) {
       const time = i / sampleRate;
       let val = Math.sin(2 * Math.PI * freq * time);
       val += Math.sin(2 * Math.PI * freq * 2 * time) * 0.4;
       val += Math.sin(2 * Math.PI * freq * 3 * time) * 0.2;
       const envelope = Math.max(0, 1 - time * 3); 
       addToBuffer(startIdx + i, val * envelope * 0.15, Math.sin(t));
    }
  };

  // 4. GUITAR
  const synthGuitar = (t: number, freq: number, duration: number) => {
    const startIdx = Math.floor(t * sampleRate);
    const length = Math.floor(duration * sampleRate);
    
    for (let i = 0; i < length; i++) {
       const time = i / sampleRate;
       let val = 0;
       for(let k=1; k<=4; k++) {
           val += (1/k) * Math.sin(2 * Math.PI * freq * k * time);
       }
       const envelope = Math.max(0, 1 - time * 4); 
       addToBuffer(startIdx + i, val * envelope * 0.12, 0);
    }
  };

  // 5. FLUTE
  const synthFlute = (t: number, freq: number, duration: number) => {
    const startIdx = Math.floor(t * sampleRate);
    const length = Math.floor(duration * sampleRate);
    
    for (let i = 0; i < length; i++) {
       const time = i / sampleRate;
       const vib = 1 + (Math.sin(2 * Math.PI * 5 * time) * 0.02); 
       const f = freq * vib;
       let val = Math.sin(2 * Math.PI * f * time);
       val += Math.sin(2 * Math.PI * f * 2 * time) * 0.1;
       
       let env = 1;
       if (time < 0.1) env = time / 0.1; 
       if (time > duration - 0.1) env = (duration - time) / 0.1; 
       
       addToBuffer(startIdx + i, val * env * 0.1, 0.2);
    }
  };

  // 6. HARMONIUM
  const synthHarmonium = (t: number, freq: number, duration: number) => {
     const startIdx = Math.floor(t * sampleRate);
     const length = Math.floor(duration * sampleRate);
     
     for (let i = 0; i < length; i++) {
        const time = i / sampleRate;
        let val = 0;
        val += Math.sin(2 * Math.PI * freq * time);
        val += Math.sin(2 * Math.PI * (freq * 2.01) * time) * 0.6;
        val += Math.sin(2 * Math.PI * (freq * 3) * time) * 0.3;
        
        if (val > 0.8) val = 0.8;
        if (val < -0.8) val = -0.8;

        let env = 1;
        if (time < 0.05) env = time / 0.05;
        if (time > duration - 0.05) env = (duration - time) / 0.05;

        addToBuffer(startIdx + i, val * env * 0.12, -0.2);
     }
  };


  // --- CHORD PROGRESSIONS ---
  const popProgression = [
    [261.63, 329.63, 392.00], 
    [196.00, 246.94, 293.66], 
    [220.00, 261.63, 329.63], 
    [174.61, 220.00, 261.63]
  ];

  const bluesProgression = [
    [261.63, 329.63, 392.00, 466.16], 
    [174.61, 220.00, 261.63, 311.13], 
    [261.63, 329.63, 392.00, 466.16], 
    [196.00, 246.94, 293.66, 349.23] 
  ];

  const reggaeProgression = [
    [220.00, 261.63, 329.63], 
    [196.00, 246.94, 293.66], 
    [220.00, 261.63, 329.63], 
    [196.00, 246.94, 293.66]  
  ];

  const hiphopProgression = [
    [261.63, 311.13, 392.00], 
    [207.65, 261.63, 311.13], 
    [233.08, 293.66, 349.23], 
    [261.63, 311.13, 392.00] 
  ];

  let progression = popProgression;
  if (style === MusicStyle.BLUES) progression = bluesProgression;
  if (style === MusicStyle.REGGAE) progression = reggaeProgression;
  if (style === MusicStyle.HIPHOP) progression = hiphopProgression;
  if (style === MusicStyle.COUNTRY) progression = popProgression; 
  if (style === MusicStyle.FUNK) progression = [ 
     [164.81, 207.65, 246.94, 293.66], 
     [164.81, 207.65, 246.94, 293.66], 
     [174.61, 220.00, 261.63], 
     [164.81, 207.65, 246.94, 293.66]
  ];

  // --- SEQUENCER LOOP ---

  let currentTime = 0;
  
  while (currentTime < duration) {
    const beat = (currentTime / secondsPerBeat);
    const bar = Math.floor(beat / 4);
    const beatInBar = beat % 4;
    const chordIdx = bar % progression.length;
    const currentChord = progression[chordIdx];
    const root = currentChord[0];

    // 1. DRUMS
    if (instruments.includes(Instrument.DRUMS)) {
       if (style === MusicStyle.REGGAE) {
           if (Math.abs(beatInBar - 2) < 0.1) synthDrums(currentTime, 'kick');
           if (beatInBar % 0.5 < 0.1) synthDrums(currentTime, 'hihat');
           if (Math.abs(beatInBar - 2) < 0.1) synthDrums(currentTime, 'snare');
       } else if (style === MusicStyle.HIPHOP) {
           if (Math.abs(beatInBar) < 0.1) synthDrums(currentTime, 'kick');
           if (Math.abs(beatInBar - 1.5) < 0.1) synthDrums(currentTime, 'kick'); 
           if (Math.abs(beatInBar - 1) < 0.1 || Math.abs(beatInBar - 3) < 0.1) synthDrums(currentTime, 'snare');
           if (beatInBar % 0.5 < 0.1) synthDrums(currentTime, 'hihat');
       } else if (style === MusicStyle.FUNK) {
           if (beatInBar % 1 < 0.1) synthDrums(currentTime, 'kick');
           if (Math.abs(beatInBar - 2.75) < 0.1) synthDrums(currentTime, 'kick');
           if (Math.abs(beatInBar - 1) < 0.1 || Math.abs(beatInBar - 3) < 0.1) synthDrums(currentTime, 'snare');
           if (beatInBar % 0.25 < 0.1) synthDrums(currentTime, 'hihat');
       } else if (style === MusicStyle.BLUES) {
           if (Math.abs(beatInBar % 1) < 0.1) synthDrums(currentTime, 'kick');
           if (Math.abs(beatInBar - 1) < 0.1 || Math.abs(beatInBar - 3) < 0.1) synthDrums(currentTime, 'snare');
           if (beatInBar % 1 < 0.1 || (beatInBar % 1 > 0.6 && beatInBar % 1 < 0.7)) synthDrums(currentTime, 'hihat');
       } else if (style === MusicStyle.EDM) {
           if (beatInBar % 1 < 0.1) synthDrums(currentTime, 'kick');
           if ((beatInBar + 0.5) % 1 < 0.1) synthDrums(currentTime + 0.5 * secondsPerBeat, 'hihat');
       } else {
           if (beatInBar % 2 < 0.1) synthDrums(currentTime, 'kick');
           if ((beatInBar + 1) % 2 < 0.1) synthDrums(currentTime + secondsPerBeat, 'snare');
           if (beatInBar % 0.5 < 0.1) synthDrums(currentTime, 'hihat');
       }
    }

    // 2. PIANO / KEYS / GUITAR
    if (instruments.includes(Instrument.PIANO) || instruments.includes(Instrument.GUITAR)) {
        const isPiano = instruments.includes(Instrument.PIANO);
        const synthFn = isPiano ? synthPiano : synthGuitar;
        const dur = isPiano ? secondsPerBeat : secondsPerBeat * 0.5;

        if (style === MusicStyle.REGGAE) {
            if (Math.abs(beatInBar % 1 - 0.5) < 0.1) {
                currentChord.forEach(note => synthFn(currentTime, note, 0.15));
            }
        } else if (style === MusicStyle.FUNK) {
            if (beatInBar % 0.5 < 0.1) {
                 currentChord.forEach(note => synthFn(currentTime, note, 0.1));
            }
        } else if (style === MusicStyle.BLUES) {
             if (beatInBar % 1 < 0.1) {
                currentChord.forEach(note => synthFn(currentTime, note, 0.3));
             }
        } else {
            if (Math.abs(beatInBar) < 0.1) {
                currentChord.forEach(note => synthFn(currentTime, note, dur * 2));
            }
            if ((style === MusicStyle.POP || style === MusicStyle.COUNTRY) && Math.abs(beatInBar - 2.5) < 0.1) {
                currentChord.forEach(note => synthFn(currentTime, note, dur));
            }
        }
    }

    // 3. TABLA
    if (instruments.includes(Instrument.TABLA)) {
        if (Math.abs(beatInBar % 1) < 0.1) synthTabla(currentTime, 'ge'); 
        if (Math.abs((beatInBar + 0.25) % 0.5) < 0.1) synthTabla(currentTime + (secondsPerBeat * 0.25), 'na');
    }

    // 4. HARMONIUM
    if (instruments.includes(Instrument.HARMONIUM)) {
        if (Math.abs(beatInBar) < 0.1) {
            synthHarmonium(currentTime, root, secondsPerBeat * 4);
            if (currentChord.length > 2) synthHarmonium(currentTime, currentChord[2], secondsPerBeat * 4);
        }
    }

    // 5. FLUTE
    if (instruments.includes(Instrument.FLUTE)) {
         if (bar % 2 === 1) { 
             if (beatInBar === 0 || beatInBar === 2 || beatInBar === 3) {
                 const note = currentChord[Math.floor(Math.random() * currentChord.length)] * 2; 
                 synthFlute(currentTime, note, secondsPerBeat);
             }
         }
    }

    currentTime += (secondsPerBeat * subdivision);
  }

  return buffer;
};

/**
 * Adjusts the stereo width of an AudioBuffer using Mid-Side processing.
 */
export const adjustStereoWidth = (
  ctx: AudioContext, 
  inputBuffer: AudioBuffer, 
  width: number
): AudioBuffer => {
  const sampleRate = inputBuffer.sampleRate;
  const length = inputBuffer.length;
  const outputBuffer = ctx.createBuffer(2, length, sampleRate);
  
  const leftIn = inputBuffer.getChannelData(0);
  const rightIn = inputBuffer.numberOfChannels > 1 ? inputBuffer.getChannelData(1) : inputBuffer.getChannelData(0);
  
  const leftOut = outputBuffer.getChannelData(0);
  const rightOut = outputBuffer.getChannelData(1);

  for (let i = 0; i < length; i++) {
    const l = leftIn[i];
    const r = rightIn[i];
    const mid = (l + r) * 0.5;
    const side = (l - r) * 0.5;
    const newSide = side * width;
    leftOut[i] = mid + newSide;
    rightOut[i] = mid - newSide;
  }
  
  return outputBuffer;
};

/**
 * Applies a delay effect to the audio buffer.
 */
export const applyDelay = async (
  ctx: AudioContext,
  inputBuffer: AudioBuffer,
  delayTime: number,
  feedback: number,
  mix: number
): Promise<AudioBuffer> => {
  // Extend buffer for delay tail (echoes fading out)
  const tailLength = 3.0; 
  const totalLength = inputBuffer.length + Math.ceil(tailLength * inputBuffer.sampleRate);
  
  const offlineCtx = new OfflineAudioContext(
    inputBuffer.numberOfChannels,
    totalLength,
    inputBuffer.sampleRate
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = inputBuffer;

  const delayNode = offlineCtx.createDelay(2.0);
  delayNode.delayTime.value = delayTime;

  const feedbackNode = offlineCtx.createGain();
  feedbackNode.gain.value = feedback;

  const wetGain = offlineCtx.createGain();
  wetGain.gain.value = mix;

  const dryGain = offlineCtx.createGain();
  dryGain.gain.value = 1 - mix;

  // Signal Flow
  // Source -> Dry -> Dest
  // Source -> Delay -> Wet -> Dest
  // Delay -> Feedback -> Delay
  
  source.connect(dryGain);
  dryGain.connect(offlineCtx.destination);

  source.connect(delayNode);
  delayNode.connect(wetGain);
  wetGain.connect(offlineCtx.destination);

  delayNode.connect(feedbackNode);
  feedbackNode.connect(delayNode);

  source.start(0);

  return await offlineCtx.startRendering();
};

/**
 * Mixes the vocal track with the backing track.
 */
export const mixAudioTracks = (
  ctx: AudioContext,
  vocalBuffer: AudioBuffer,
  backingBuffer: AudioBuffer,
  backingVolume: number = 0.5
): AudioBuffer => {
  const duration = Math.max(vocalBuffer.duration, backingBuffer.duration);
  const sampleRate = ctx.sampleRate;
  const length = duration * sampleRate;
  
  const outputBuffer = ctx.createBuffer(2, length, sampleRate);

  for (let channel = 0; channel < 2; channel++) {
    const outputData = outputBuffer.getChannelData(channel);
    // Be careful with channels: vocal might be mono, backing is stereo
    const vocalChannelData = vocalBuffer.getChannelData(channel % vocalBuffer.numberOfChannels);
    const backingChannelData = backingBuffer.getChannelData(channel % backingBuffer.numberOfChannels);

    for (let i = 0; i < length; i++) {
        const vocalSample = (i < vocalBuffer.length) ? vocalChannelData[i] : 0;
        const backingSample = (i < backingBuffer.length) ? backingChannelData[i] : 0;
        
        outputData[i] = (vocalSample * 1.0) + (backingSample * backingVolume);
        
        // Simple Soft Clipper / Limiter
        if (outputData[i] > 1) outputData[i] = 1;
        if (outputData[i] < -1) outputData[i] = -1;
    }
  }

  return outputBuffer;
};