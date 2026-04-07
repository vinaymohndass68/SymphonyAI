import { GoogleGenAI, Modality, Type } from "@google/genai";
import { MusicStyle } from "../types";
import { rawPcmToAudioBuffer, blobToBase64 } from "../utils/audioUtils";
import { concatenateAudioBuffers } from "./audioMixer";

const API_KEY = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey: API_KEY });

interface SongStructure {
  sections: Array<{
    type: string;
    lyrics: string;
  }>;
}

/**
 * Generates lyrics for a full song structure based on the user's initial recording, style, and target duration.
 */
const generateLyrics = async (
  base64Audio: string, 
  mimeType: string, 
  style: MusicStyle,
  targetDuration: number
): Promise<SongStructure> => {
  try {
    const minutes = Math.ceil(targetDuration / 60);
    
    let structureHint = "";
    if (targetDuration <= 60) {
        structureHint = "Structure: Verse 1, Chorus, Outro.";
    } else if (targetDuration <= 180) {
        structureHint = "Structure: Verse 1, Chorus, Verse 2, Chorus, Outro.";
    } else {
        structureHint = "Structure: Verse 1, Chorus, Verse 2, Chorus, Bridge, Verse 3, Chorus, Outro.";
    }

    const prompt = `
      The user has recorded a short audio clip (attached). 
      The musical style is ${style}.
      I need you to write full song lyrics that expand upon the theme/mood of the audio clip.
      
      Target Length: ~${minutes} minute(s).
      ${structureHint}
      
      Structure the response as a JSON object with a 'sections' array.
      Each section should have 'type' and 'lyrics'.
      Make the lyrics creative and consistent with the user's voice tone.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
            role: 'user',
            parts: [
                { text: prompt },
                { inlineData: { mimeType, data: base64Audio } }
            ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  lyrics: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as SongStructure;
    }
    throw new Error("No lyrics generated");

  } catch (error) {
    console.error("Lyric generation failed:", error);
    // Fallback structure
    return {
      sections: [
        { type: "Verse", lyrics: "La la la, singing a song..." },
        { type: "Chorus", lyrics: "This is the extended part of the song." }
      ]
    };
  }
};

/**
 * Generates audio for a specific lyric section using the original audio as a style reference.
 */
const generateAudioSegment = async (
  ctx: AudioContext,
  lyricText: string,
  referenceBase64: string,
  mimeType: string,
  style: string
): Promise<AudioBuffer | null> => {
  try {
    const prompt = `
      Sing the following lyrics. 
      Important: Match the voice, tone, pitch, and emotion of the provided audio clip as closely as possible.
      Style: ${style}.
      Lyrics: "${lyricText}"
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: referenceBase64 } }
          ]
        }
      ],
      config: {
        responseModalities: [Modality.AUDIO],
      }
    });

    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (audioData) {
      const bytes = Uint8Array.from(atob(audioData), c => c.charCodeAt(0));
      return await rawPcmToAudioBuffer(bytes, ctx, 24000);
    }
    return null;

  } catch (e) {
    console.warn("Segment generation failed, skipping segment", e);
    return null;
  }
};

/**
 * Main function to extend the user's recording to the target duration.
 */
export const extendVocalTrack = async (
  ctx: AudioContext,
  originalBuffer: AudioBuffer,
  originalBlob: Blob,
  style: MusicStyle,
  targetDuration: number,
  onProgress: (msg: string) => void
): Promise<AudioBuffer> => {
  
  // 1. Analyze input
  const base64Audio = await blobToBase64(originalBlob);
  onProgress(`Planning a ${Math.ceil(targetDuration / 60)}-minute arrangement...`);
  
  // 2. Generate Lyrics
  const songStructure = await generateLyrics(base64Audio, originalBlob.type, style, targetDuration);
  
  const extendedBuffers: AudioBuffer[] = [originalBuffer];
  let currentDuration = originalBuffer.duration;
  
  // 3. Loop through sections and generate audio
  let sectionIndex = 0;
  
  // We check if we have reached the target duration. 
  // We also ensure we don't loop infinitely if generation is very short.
  while (currentDuration < targetDuration && sectionIndex < songStructure.sections.length) {
    const section = songStructure.sections[sectionIndex];
    
    onProgress(`Recording Part ${sectionIndex + 1}: ${section.type}... (${Math.round(currentDuration)}s / ${targetDuration}s)`);
    
    const generatedBuffer = await generateAudioSegment(
        ctx, 
        section.lyrics, 
        base64Audio, 
        originalBlob.type, 
        style
    );

    if (generatedBuffer) {
      extendedBuffers.push(generatedBuffer);
      currentDuration += generatedBuffer.duration;
    } else {
      console.warn("Audio generation returned empty. Stopping extension early.");
      break; 
    }
    
    sectionIndex++;
    
    // If we ran out of sections but haven't hit target time (rare for 1m/3m, possible for 5m),
    // loop back to chorus if available, or just end to avoid repetition fatigue.
    if (sectionIndex >= songStructure.sections.length && currentDuration < targetDuration * 0.8) {
       // Only loop if we are significantly under time (less than 80%)
       // Simple heuristic: find a Chorus to repeat
       const chorus = songStructure.sections.find(s => s.type.toLowerCase().includes('chorus'));
       if (chorus) {
           songStructure.sections.push(chorus);
       }
    }
  }

  onProgress("Stitching vocals together...");
  return concatenateAudioBuffers(ctx, extendedBuffers);
};
