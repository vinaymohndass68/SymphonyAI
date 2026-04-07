/**
 * Utilities for generating Standard MIDI Files (SMF) Type 1.
 */

// Frequency to MIDI Note conversion
export const freqToMidi = (freq: number): number => {
  if (freq === 0) return 0;
  // MIDI Note 69 is A4 (440Hz)
  const note = 69 + 12 * Math.log2(freq / 440);
  return Math.round(note);
};

export interface MidiEvent {
  deltaTime: number; // Ticks since last event
  type: number;      // 0x80=NoteOff, 0x90=NoteOn, etc.
  channel: number;   // 0-15
  param1: number;    // Note number
  param2: number;    // Velocity
}

export class MidiTrack {
  events: MidiEvent[] = [];
  private currentTime: number = 0; // Absolute ticks

  addNote(channel: number, note: number, durationTicks: number, startTicks: number, velocity: number = 80) {
    if (note < 0 || note > 127) return;

    // Note On
    this.events.push({
      deltaTime: 0, // Calculated later relative to sorted list
      type: 0x90,
      channel,
      param1: note,
      param2: velocity
    });
    // Store absolute time for sorting
    (this.events[this.events.length - 1] as any)._absTime = startTicks;

    // Note Off
    this.events.push({
      deltaTime: 0,
      type: 0x80,
      channel,
      param1: note,
      param2: 0
    });
    (this.events[this.events.length - 1] as any)._absTime = startTicks + durationTicks;
  }

  // Convert absolute times to delta times
  finalize() {
    this.events.sort((a: any, b: any) => a._absTime - b._absTime);

    let lastTime = 0;
    this.events.forEach((ev: any) => {
      ev.deltaTime = ev._absTime - lastTime;
      lastTime = ev._absTime;
    });
    
    // Add End of Track
    this.events.push({
        deltaTime: 0,
        type: 0xFF,
        channel: 0,
        param1: 0x2F,
        param2: 0x00
    });
  }
}

// Write Variable Length Quantity
const writeVarInt = (value: number): number[] => {
  const bytes = [];
  let buffer = value & 0x7F;
  while ((value >>= 7)) {
    buffer <<= 8;
    buffer |= (value & 0x7F) | 0x80;
  }
  while (true) {
    bytes.push(buffer & 0xFF);
    if (buffer & 0x80) buffer >>= 8;
    else break;
  }
  return bytes;
};

// Create the binary MIDI file
export const createMidiFile = (tracks: MidiTrack[], bpm: number): Blob => {
  const parts: number[] = [];

  // 1. Header Chunk
  // "MThd"
  parts.push(0x4D, 0x54, 0x68, 0x64); 
  // Length (6 bytes)
  parts.push(0x00, 0x00, 0x00, 0x06);
  // Format 1 (Multiple tracks)
  parts.push(0x00, 0x01);
  // Number of tracks (tracks.length + 1 for tempo track)
  const numTracks = tracks.length + 1;
  parts.push((numTracks >> 8) & 0xFF, numTracks & 0xFF);
  // Time Division (Ticks per Quarter Note = 480)
  const ppq = 480;
  parts.push((ppq >> 8) & 0xFF, ppq & 0xFF);

  // 2. Tempo Track (Track 0)
  parts.push(0x4D, 0x54, 0x72, 0x6B); // "MTrk"
  
  // Calculate Tempo in Microseconds per Quarter Note
  // 60,000,000 / BPM
  const mpqn = Math.floor(60000000 / bpm);
  
  const tempoTrackData: number[] = [];
  
  // Set Tempo Event (FF 51 03 t t t) at time 0
  tempoTrackData.push(0x00); // Delta time 0
  tempoTrackData.push(0xFF, 0x51, 0x03);
  tempoTrackData.push((mpqn >> 16) & 0xFF, (mpqn >> 8) & 0xFF, mpqn & 0xFF);
  
  // End of Track
  tempoTrackData.push(0x00, 0xFF, 0x2F, 0x00);

  // Write Tempo Track Length
  parts.push((tempoTrackData.length >> 24) & 0xFF, (tempoTrackData.length >> 16) & 0xFF, (tempoTrackData.length >> 8) & 0xFF, tempoTrackData.length & 0xFF);
  parts.push(...tempoTrackData);

  // 3. Instrument Tracks
  tracks.forEach(track => {
    track.finalize();
    parts.push(0x4D, 0x54, 0x72, 0x6B); // "MTrk"
    
    const trackData: number[] = [];
    
    track.events.forEach(ev => {
      // Delta Time
      trackData.push(...writeVarInt(ev.deltaTime));
      
      if (ev.type >= 0x80 && ev.type <= 0xEF) {
        // Voice Event (Note On/Off)
        trackData.push((ev.type & 0xF0) | (ev.channel & 0x0F));
        trackData.push(ev.param1);
        trackData.push(ev.param2);
      } else if (ev.type === 0xFF) {
        // Meta Event
        trackData.push(0xFF, ev.param1, ev.param2);
      }
    });

    // Write Track Length
    parts.push((trackData.length >> 24) & 0xFF, (trackData.length >> 16) & 0xFF, (trackData.length >> 8) & 0xFF, trackData.length & 0xFF);
    parts.push(...trackData);
  });

  return new Blob([new Uint8Array(parts)], { type: 'audio/midi' });
};