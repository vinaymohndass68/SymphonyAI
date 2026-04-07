
/**
 * Converts a Blob to a Base64 string.
 */
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove the Data URL prefix (e.g., "data:audio/wav;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Decodes a Base64 string into an AudioBuffer.
 */
export const decodeBase64Audio = async (
  base64String: string,
  audioContext: AudioContext
): Promise<AudioBuffer> => {
  const binaryString = atob(base64String);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return await audioContext.decodeAudioData(bytes.buffer);
};

/**
 * Creates a standard WAV file from an AudioBuffer.
 * This is crucial because the API returns raw PCM, which isn't directly downloadable/playable universally.
 */
export const audioBufferToWav = (buffer: AudioBuffer): Blob => {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArray = new ArrayBuffer(length);
  const view = new DataView(bufferArray);
  const channels = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;

  // Write WAV header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit (hardcoded in this writer)

  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  // Write interleaved data
  for (i = 0; i < buffer.numberOfChannels; i++)
    channels.push(buffer.getChannelData(i));

  while (pos < buffer.length) {
    for (i = 0; i < numOfChan; i++) {
      // clamp
      sample = Math.max(-1, Math.min(1, channels[i][pos]));
      // scale to 16-bit signed int
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      view.setInt16(44 + offset, sample, true);
      offset += 2;
    }
    pos++;
  }

  return new Blob([bufferArray], { type: 'audio/wav' });

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
};

/**
 * Helper to decode raw PCM from Gemini (often 24kHz, mono)
 * Note: Gemini often returns raw PCM without headers.
 */
export const rawPcmToAudioBuffer = async (
  rawPcmData: Uint8Array,
  audioContext: AudioContext,
  sampleRate: number = 24000
): Promise<AudioBuffer> => {
  // Convert 8-bit bytes to 16-bit integers
  const dataInt16 = new Int16Array(rawPcmData.buffer);
  const numChannels = 1; // Usually mono from this specific API configuration
  const frameCount = dataInt16.length / numChannels;

  const buffer = audioContext.createBuffer(numChannels, frameCount, sampleRate);
  const channelData = buffer.getChannelData(0);

  for (let i = 0; i < frameCount; i++) {
    // Convert int16 to float32 [-1.0, 1.0]
    channelData[i] = dataInt16[i] / 32768.0;
  }

  return buffer;
};

export const base64ToUint8Array = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

/**
 * Shifts the pitch of an AudioBuffer by resampling.
 * Note: This changes the duration/speed of the audio (Mickey Mouse effect).
 * @param inputBuffer The source AudioBuffer
 * @param semitones Number of semitones to shift (-12 to +12)
 */
export const changeAudioPitch = async (
  inputBuffer: AudioBuffer,
  semitones: number
): Promise<AudioBuffer> => {
  if (semitones === 0) return inputBuffer;

  // Calculate the playback rate change
  // 2^(semitones/12)
  const rate = Math.pow(2, semitones / 12);
  
  // New length will be inversely proportional to rate
  const newLength = Math.ceil(inputBuffer.length / rate);
  
  // Use OfflineAudioContext for faster-than-realtime rendering
  const offlineCtx = new OfflineAudioContext(
    inputBuffer.numberOfChannels,
    newLength,
    inputBuffer.sampleRate
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = inputBuffer;
  source.playbackRate.value = rate;
  source.connect(offlineCtx.destination);
  source.start(0);

  return await offlineCtx.startRendering();
};
