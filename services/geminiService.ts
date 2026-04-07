import { GoogleGenAI, Type } from "@google/genai";
import { MusicStyle } from "../types";

const API_KEY = process.env.API_KEY || '';

if (!API_KEY) {
  console.warn("Gemini API Key is missing. Please check your environment configuration.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

export interface VocalAnalysis {
  bpm: number;
  key: string;
  mood: string;
}

/**
 * Analyzes the user's vocal recording to extract musical metadata.
 * Does NOT generate new audio, ensuring the original voice/timing is preserved.
 */
export const analyzeVocalTrack = async (
  vocalBase64: string,
  mimeType: string,
  style: MusicStyle
): Promise<VocalAnalysis> => {
  try {
    console.log("Analyzing Vocal Track for BPM and Key...");
    
    // Use gemini-2.5-flash for accurate multimodal analysis
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { 
              text: `Analyze this vocal recording. 
              1. Estimate the Tempo (BPM) as a single integer. If unclear, estimate based on the style ${style}.
              2. Estimate the Musical Key (e.g., "C Major", "F Minor").
              3. Describe the mood in 1-2 words.
              ` 
            },
            { 
              inlineData: { 
                mimeType: mimeType, 
                data: vocalBase64 
              } 
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            bpm: { type: Type.NUMBER, description: "The estimated beats per minute" },
            key: { type: Type.STRING, description: "The musical key estimate" },
            mood: { type: Type.STRING, description: "The emotional mood of the singing" }
          },
          required: ["bpm", "key", "mood"]
        }
      }
    });

    const analysisJson = response.text;
    if (!analysisJson) {
      throw new Error("Could not analyze audio input.");
    }

    let result: VocalAnalysis = { bpm: 120, key: "C Major", mood: "Energetic" };

    try {
      const parsed = JSON.parse(analysisJson);
      if (parsed.bpm) result.bpm = parsed.bpm;
      if (parsed.key) result.key = parsed.key;
      if (parsed.mood) result.mood = parsed.mood;
    } catch (e) {
      console.warn("Failed to parse JSON analysis, using defaults", e);
    }

    console.log(`Analysis Complete. BPM: ${result.bpm}, Key: ${result.key}, Mood: ${result.mood}`);
    return result;

  } catch (error) {
    console.error("Gemini API Error:", error);
    // Return safe defaults if API fails, so the user still gets a song
    return { bpm: 120, key: "C Major", mood: "Happy" };
  }
};