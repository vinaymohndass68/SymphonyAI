export enum AppState {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export enum MusicStyle {
  POP = 'Pop',
  ROCK = 'Rock',
  JAZZ = 'Jazz',
  EDM = 'EDM',
  ACOUSTIC = 'Acoustic',
  EPIC_ORCHESTRAL = 'Epic Orchestral',
  BLUES = 'Blues',
  REGGAE = 'Reggae',
  HIPHOP = 'Hip-Hop',
  FUNK = 'Funk',
  COUNTRY = 'Country'
}

export enum Instrument {
  DRUMS = 'Drums',
  TABLA = 'Tabla',
  GUITAR = 'Guitar',
  FLUTE = 'Flute',
  HARMONIUM = 'Harmonium',
  PIANO = 'Piano'
}

export interface AudioMetadata {
  blob: Blob;
  url: string;
  duration?: number;
}