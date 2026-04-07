import { MusicStyle, Instrument } from '../types';
import { MidiTrack, createMidiFile, freqToMidi } from '../utils/midiUtils';

export const generateMidiSequence = (
  duration: number,
  style: MusicStyle,
  instruments: Instrument[],
  bpm: number
): Blob => {
  const tracks: MidiTrack[] = [];
  
  // Channels:
  // Drums: Ch 10 (index 9)
  // Piano: Ch 1 (index 0)
  // Guitar: Ch 2 (index 1)
  // Aux (Tabla/Harmonium): Ch 3 (index 2)
  // Lead (Flute): Ch 4 (index 3)

  const drumTrack = new MidiTrack();
  const pianoTrack = new MidiTrack();
  const guitarTrack = new MidiTrack();
  const auxTrack = new MidiTrack();
  const leadTrack = new MidiTrack();

  const ppq = 480; // Ticks per Quarter Note
  // We don't strictly need secondsPerBeat for MIDI ticks, but keeping the loop structure similar helps
  const secondsPerBeat = 60 / bpm; 
  const totalBeats = Math.ceil(duration / secondsPerBeat);

  // --- CHORD PROGRESSIONS (Synced with audioMixer.ts) ---
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

  const funkProgression = [ 
     [164.81, 207.65, 246.94, 293.66], 
     [164.81, 207.65, 246.94, 293.66], 
     [174.61, 220.00, 261.63], 
     [164.81, 207.65, 246.94, 293.66]
  ];

  let progression = popProgression;
  if (style === MusicStyle.BLUES) progression = bluesProgression;
  if (style === MusicStyle.REGGAE) progression = reggaeProgression;
  if (style === MusicStyle.HIPHOP) progression = hiphopProgression;
  if (style === MusicStyle.COUNTRY) progression = popProgression;
  if (style === MusicStyle.FUNK) progression = funkProgression;

  // Loop through beats (0.25 increment for 16th notes)
  for (let beat = 0; beat < totalBeats; beat += 0.25) {
     const bar = Math.floor(beat / 4);
     const beatInBar = beat % 4;
     const chordIdx = bar % progression.length;
     const currentChordFreqs = progression[chordIdx];
     // Convert Frequencies to MIDI Note Numbers
     const currentChordMidi = currentChordFreqs.map(f => freqToMidi(f));
     const rootMidi = currentChordMidi[0];
     
     const ticks = Math.round(beat * ppq); // Absolute start time in ticks

     // 1. DRUMS (Channel 10, index 9)
     // GM Map: Kick=36, Snare=38, ClosedHH=42
     if (instruments.includes(Instrument.DRUMS)) {
        const addDrum = (note: number, vel: number = 100) => {
            drumTrack.addNote(9, note, 60, ticks, vel);
        };

        if (style === MusicStyle.REGGAE) {
            if (Math.abs(beatInBar - 2) < 0.1) addDrum(36); 
            if (beatInBar % 0.5 < 0.1) addDrum(42); 
            if (Math.abs(beatInBar - 2) < 0.1) addDrum(38); 
        } else if (style === MusicStyle.HIPHOP) {
            if (Math.abs(beatInBar) < 0.1) addDrum(36);
            if (Math.abs(beatInBar - 1.5) < 0.1) addDrum(36);
            if (Math.abs(beatInBar - 1) < 0.1 || Math.abs(beatInBar - 3) < 0.1) addDrum(38);
            if (beatInBar % 0.5 < 0.1) addDrum(42);
        } else if (style === MusicStyle.FUNK) {
            if (beatInBar % 1 < 0.1) addDrum(36);
            if (Math.abs(beatInBar - 2.75) < 0.1) addDrum(36);
            if (Math.abs(beatInBar - 1) < 0.1 || Math.abs(beatInBar - 3) < 0.1) addDrum(38);
            if (beatInBar % 0.25 < 0.1) addDrum(42);
        } else if (style === MusicStyle.BLUES) {
             if (Math.abs(beatInBar % 1) < 0.1) addDrum(36);
             if (Math.abs(beatInBar - 1) < 0.1 || Math.abs(beatInBar - 3) < 0.1) addDrum(38);
             if (beatInBar % 1 < 0.1 || (beatInBar % 1 > 0.6 && beatInBar % 1 < 0.7)) addDrum(42);
        } else if (style === MusicStyle.EDM) {
            if (beatInBar % 1 < 0.1) addDrum(36, 120);
            if ((beatInBar + 0.5) % 1 < 0.1) drumTrack.addNote(9, 42, 60, ticks + (ppq/2), 90); 
        } else {
            // Standard
            if (beatInBar % 2 < 0.1) addDrum(36);
            if ((beatInBar + 1) % 2 < 0.1) addDrum(38);
            if (beatInBar % 0.5 < 0.1) addDrum(42);
        }
     }

     // 2. PIANO (Ch 1) & GUITAR (Ch 2)
     if (instruments.includes(Instrument.PIANO) || instruments.includes(Instrument.GUITAR)) {
         const isPiano = instruments.includes(Instrument.PIANO);
         const track = isPiano ? pianoTrack : guitarTrack;
         const chan = isPiano ? 0 : 1;
         const durTicks = isPiano ? ppq : ppq / 2;

         const addChord = (dur: number) => {
             currentChordMidi.forEach(n => track.addNote(chan, n, dur, ticks, 90));
         };

         if (style === MusicStyle.REGGAE) {
             if (Math.abs(beatInBar % 1 - 0.5) < 0.1) addChord(ppq * 0.25); 
         } else if (style === MusicStyle.FUNK) {
             if (beatInBar % 0.5 < 0.1) addChord(ppq * 0.25);
         } else if (style === MusicStyle.BLUES) {
             if (beatInBar % 1 < 0.1) addChord(ppq * 0.8);
         } else {
             if (Math.abs(beatInBar) < 0.1) addChord(durTicks * 2);
             if ((style === MusicStyle.POP || style === MusicStyle.COUNTRY) && Math.abs(beatInBar - 2.5) < 0.1) {
                 addChord(durTicks);
             }
         }
     }

     // 3. TABLA (Use Percussion Ch 10 Bongo sounds)
     if (instruments.includes(Instrument.TABLA)) {
         // Low Bongo = 61, High Bongo = 60
         if (Math.abs(beatInBar % 1) < 0.1) auxTrack.addNote(9, 61, 100, ticks, 80); 
         if (Math.abs((beatInBar + 0.25) % 0.5) < 0.1) auxTrack.addNote(9, 60, 100, ticks + (ppq*0.25), 70); 
     }

     // 4. HARMONIUM (Ch 4)
     if (instruments.includes(Instrument.HARMONIUM)) {
         if (Math.abs(beatInBar) < 0.1) {
             auxTrack.addNote(3, rootMidi, ppq * 4, ticks, 70);
             if (currentChordMidi.length > 2) auxTrack.addNote(3, currentChordMidi[2], ppq * 4, ticks, 70);
         }
     }

     // 5. FLUTE (Ch 5)
     if (instruments.includes(Instrument.FLUTE)) {
          if (bar % 2 === 1) { 
              if (beatInBar === 0 || beatInBar === 2 || beatInBar === 3) {
                  const note = currentChordMidi[Math.floor(Math.random() * currentChordMidi.length)] + 12; 
                  leadTrack.addNote(4, note, ppq, ticks, 85);
              }
          }
     }
  }

  // Aggregate non-empty tracks
  [drumTrack, pianoTrack, guitarTrack, auxTrack, leadTrack].forEach(t => {
      if(t.events.length > 0) tracks.push(t);
  });

  return createMidiFile(tracks, bpm);
}