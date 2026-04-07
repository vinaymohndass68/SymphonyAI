import React, { useState, useRef, useEffect } from 'react';
import { Mic, Loader2, Music2 } from 'lucide-react';
import { AppState, MusicStyle, Instrument } from './types';
import { analyzeVocalTrack } from './services/geminiService';
import { 
  blobToBase64, 
  audioBufferToWav
} from './utils/audioUtils';
import { createProceduralBackingTrack, mixAudioTracks, adjustStereoWidth, processVocalTrack, applyDelay } from './services/audioMixer';
import { extendVocalTrack } from './services/songExtender';
import { generateMidiSequence } from './services/midiGenerator';
import Visualizer from './components/Visualizer';
import AudioControls from './components/AudioControls';
import StyleSelector from './components/StyleSelector';
import BackingTrackControl from './components/BackingTrackControl';
import InstrumentSelector from './components/InstrumentSelector';
import PitchControl from './components/PitchControl';
import BpmControl from './components/BpmControl';
import DelayControl from './components/DelayControl';
import DurationControl from './components/DurationControl';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.IDLE);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [selectedStyle, setSelectedStyle] = useState<MusicStyle>(MusicStyle.POP);
  const [generatedBlob, setGeneratedBlob] = useState<Blob | null>(null);
  const [generatedMidiBlob, setGeneratedMidiBlob] = useState<Blob | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  
  // Backing Track State
  const [useBackingTrack, setUseBackingTrack] = useState<boolean>(true);
  const [backingVolume, setBackingVolume] = useState<number>(0.5);
  const [stereoWidth, setStereoWidth] = useState<number>(1.2);
  const [selectedInstruments, setSelectedInstruments] = useState<Instrument[]>([Instrument.DRUMS, Instrument.PIANO]);
  
  // Delay Effects
  const [delayEnabled, setDelayEnabled] = useState<boolean>(false);
  const [delayTime, setDelayTime] = useState<number>(0.3);
  const [delayFeedback, setDelayFeedback] = useState<number>(0.4);
  const [delayMix, setDelayMix] = useState<number>(0.3);

  // Voice Effects
  const [pitchShift, setPitchShift] = useState<number>(0);
  
  // BPM State
  const [targetBpm, setTargetBpm] = useState<number>(120);
  const [isAutoBpm, setIsAutoBpm] = useState<boolean>(true);

  // Duration State
  const [targetDuration, setTargetDuration] = useState<number>(180); // Default 3 minutes

  // Recording Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Audio Context for Recording Visualizer
  const [recAudioContext, setRecAudioContext] = useState<AudioContext | null>(null);
  const [recSourceNode, setRecSourceNode] = useState<MediaStreamAudioSourceNode | null>(null);

  // Initialize Audio Context for Visualizer
  useEffect(() => {
    return () => {
      recAudioContext?.close();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Setup Visualizer
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      setRecAudioContext(audioCtx);
      setRecSourceNode(source);

      // Setup Recorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setState(AppState.RECORDING);
      setErrorMsg('');
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setErrorMsg("Could not access microphone. Please allow permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && state === AppState.RECORDING) {
      mediaRecorderRef.current.onstop = async () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
        
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' }); 
        processAudio(audioBlob);
      };
      mediaRecorderRef.current.stop();
      setState(AppState.PROCESSING);
    }
  };

  const processAudio = async (recordedBlob: Blob) => {
    try {
      setStatusMessage("Analysing rhythm and key...");
      
      const processingCtx = new AudioContext();
      
      // 1. Convert blob to base64 for Gemini Analysis
      const base64Audio = await blobToBase64(recordedBlob);
      
      // 2. Analyze Audio with Gemini (Get BPM, Key, Mood)
      const analysis = await analyzeVocalTrack(base64Audio, recordedBlob.type, selectedStyle);
      console.log("Analysis Result:", analysis);

      // Determine final BPM
      const finalBpm = isAutoBpm ? analysis.bpm : targetBpm;

      // 3. Decode the ORIGINAL recording for processing
      setStatusMessage(`Polishing vocals (${analysis.mood})...`);
      const arrayBuffer = await recordedBlob.arrayBuffer();
      let originalVocalBuffer = await processingCtx.decodeAudioData(arrayBuffer);

      // CHECK: If recording is < 20s, extend it to target duration
      if (originalVocalBuffer.duration < 20) {
        console.log(`Recording is short, extending song to ${targetDuration}s...`);
        setStatusMessage(`Extending song to ${targetDuration / 60} minutes (AI Magic)...`);
        originalVocalBuffer = await extendVocalTrack(
          processingCtx, 
          originalVocalBuffer, 
          recordedBlob, 
          selectedStyle,
          targetDuration,
          (msg) => setStatusMessage(msg)
        );
      }

      // 4. Apply Studio Effects
      setStatusMessage("Applying studio effects...");
      const polishedVocalBuffer = await processVocalTrack(originalVocalBuffer, pitchShift);

      // 5. Generate Procedural Backing Track
      let finalBuffer = polishedVocalBuffer;

      if (useBackingTrack && selectedInstruments.length > 0) {
         setStatusMessage(`Composing backing track at ${finalBpm} BPM...`);
         
         const duration = polishedVocalBuffer.duration;

         let backingBuffer = await createProceduralBackingTrack(
           processingCtx, 
           duration, 
           selectedStyle,
           selectedInstruments,
           finalBpm 
         );
         
         // Generate MIDI alongside audio
         const midi = generateMidiSequence(
             duration, 
             selectedStyle, 
             selectedInstruments, 
             finalBpm
         );
         setGeneratedMidiBlob(midi);

         // Apply Stereo Width to backing track
         if (stereoWidth !== 1.0) {
             backingBuffer = adjustStereoWidth(processingCtx, backingBuffer, stereoWidth);
         }

         // Apply Delay to backing track
         if (delayEnabled) {
             setStatusMessage("Applying delay effect...");
             backingBuffer = await applyDelay(processingCtx, backingBuffer, delayTime, delayFeedback, delayMix);
         }

         setStatusMessage("Mixing final track...");
         finalBuffer = mixAudioTracks(processingCtx, polishedVocalBuffer, backingBuffer, backingVolume);
      } else {
        setGeneratedMidiBlob(null);
      }
      
      // 6. Convert to WAV Blob
      const wavBlob = audioBufferToWav(finalBuffer);
      
      setGeneratedBlob(wavBlob);
      setState(AppState.COMPLETED);
      processingCtx.close();
      
    } catch (err: any) {
      console.error("Processing failed:", err);
      let message = "Failed to generate music. Please try again.";
      if (err.message) message = err.message;
      setErrorMsg(message);
      setState(AppState.ERROR);
    }
  };

  const toggleInstrument = (inst: Instrument) => {
    setSelectedInstruments(prev => {
      if (prev.includes(inst)) {
        return prev.filter(i => i !== inst);
      } else {
        return [...prev, inst];
      }
    });
  };

  const resetApp = () => {
    setGeneratedBlob(null);
    setGeneratedMidiBlob(null);
    setState(AppState.IDLE);
    setErrorMsg('');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950">
      
      {/* Header */}
      <header className="absolute top-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Music2 className="w-8 h-8 text-indigo-400" />
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
            SymphonyAI
          </h1>
        </div>
        <p className="text-slate-400 text-sm">Turn your voice into a hit song</p>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-4xl z-10 mt-16 md:mt-0">
        
        {/* State: IDLE or RECORDING */}
        {(state === AppState.IDLE || state === AppState.RECORDING) && (
          <div className="flex flex-col items-center space-y-8 animate-fade-in">
            
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
               {/* Controls Column */}
               <div className="flex flex-col gap-6 order-2 md:order-1">
                  <div className="bg-slate-800/30 p-4 rounded-2xl border border-slate-700/50">
                    <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">Musical Style</h3>
                    <StyleSelector 
                      selectedStyle={selectedStyle} 
                      onSelect={setSelectedStyle} 
                      disabled={state === AppState.RECORDING}
                    />
                  </div>
                  
                  <div className="bg-slate-800/30 p-4 rounded-2xl border border-slate-700/50">
                    <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">Instruments</h3>
                    <InstrumentSelector
                       selectedInstruments={selectedInstruments}
                       onToggle={toggleInstrument}
                       disabled={state === AppState.RECORDING}
                    />
                  </div>

                  <DurationControl
                    duration={targetDuration}
                    onChange={setTargetDuration}
                    disabled={state === AppState.RECORDING}
                  />

                  <PitchControl 
                    pitch={pitchShift} 
                    onChange={setPitchShift} 
                    disabled={state === AppState.RECORDING} 
                  />
                  
                  <BpmControl
                    bpm={targetBpm}
                    setBpm={setTargetBpm}
                    isAuto={isAutoBpm}
                    setIsAuto={setIsAutoBpm}
                    disabled={state === AppState.RECORDING}
                  />

                  <BackingTrackControl 
                    enabled={useBackingTrack}
                    onToggle={setUseBackingTrack}
                    volume={backingVolume}
                    onVolumeChange={setBackingVolume}
                    stereoWidth={stereoWidth}
                    onStereoWidthChange={setStereoWidth}
                    disabled={state === AppState.RECORDING}
                  />
                  
                  <DelayControl
                    enabled={delayEnabled}
                    onToggle={setDelayEnabled}
                    time={delayTime}
                    onTimeChange={setDelayTime}
                    feedback={delayFeedback}
                    onFeedbackChange={setDelayFeedback}
                    mix={delayMix}
                    onMixChange={setDelayMix}
                    disabled={state === AppState.RECORDING}
                  />
               </div>

               {/* Visualization & Record Column */}
               <div className="flex flex-col items-center gap-6 order-1 md:order-2 h-full justify-center">
                 <div className="relative w-full">
                    {state === AppState.RECORDING && (
                      <div className="absolute top-2 right-2 flex items-center gap-2 px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-xs font-bold animate-pulse z-10">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        REC
                      </div>
                    )}
                    <Visualizer 
                      audioContext={recAudioContext} 
                      sourceNode={recSourceNode} 
                      isActive={state === AppState.RECORDING} 
                    />
                  </div>

                  <button
                    onClick={state === AppState.IDLE ? startRecording : stopRecording}
                    className={`
                      relative group flex items-center justify-center w-24 h-24 rounded-full transition-all duration-300
                      ${state === AppState.RECORDING 
                        ? 'bg-red-500 hover:bg-red-600 shadow-[0_0_40px_rgba(239,68,68,0.4)]' 
                        : 'bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_40px_rgba(79,70,229,0.4)] hover:scale-105'
                      }
                    `}
                  >
                    {state === AppState.RECORDING ? (
                       <div className="w-8 h-8 bg-white rounded-md transition-transform group-hover:scale-90" />
                    ) : (
                      <Mic className="w-10 h-10 text-white transition-transform group-hover:scale-110" />
                    )}
                  </button>
                  
                  <p className="text-slate-400 font-medium h-6">
                    {state === AppState.IDLE ? 'Tap to start recording' : 'Sing your heart out...'}
                  </p>
               </div>
            </div>

          </div>
        )}

        {/* State: PROCESSING */}
        {state === AppState.PROCESSING && (
          <div className="flex flex-col items-center justify-center space-y-6 animate-fade-in py-12">
             <div className="relative">
                <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full"></div>
                <Loader2 className="w-16 h-16 text-indigo-400 animate-spin relative z-10" />
             </div>
             <div className="text-center space-y-2">
               <h2 className="text-2xl font-semibold text-white">Composing your masterpiece...</h2>
               <p className="text-slate-400">{statusMessage || "Analyzing..."}</p>
             </div>
          </div>
        )}

        {/* State: COMPLETED */}
        {state === AppState.COMPLETED && generatedBlob && (
          <div className="flex flex-col items-center space-y-8 animate-fade-in w-full">
            <div className="text-center space-y-2">
               <h2 className="text-3xl font-bold text-white">Your Song is Ready!</h2>
               <p className="text-slate-400">Style: <span className="text-indigo-400">{selectedStyle}</span></p>
            </div>
            
            <AudioControls 
              audioBlob={generatedBlob} 
              midiBlob={generatedMidiBlob}
              onReset={resetApp} 
            />
          </div>
        )}

        {/* State: ERROR */}
        {state === AppState.ERROR && (
           <div className="flex flex-col items-center space-y-6 animate-fade-in text-center py-12">
             <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg max-w-md">
                <p className="text-red-400 font-medium break-words">{errorMsg || "An unexpected error occurred."}</p>
             </div>
             <button
               onClick={resetApp}
               className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-full transition-colors"
             >
               Try Again
             </button>
           </div>
        )}

      </main>

      {/* Footer */}
      <footer className="absolute bottom-4 text-slate-600 text-xs text-center w-full">
        <p>Powered by Google Gemini</p>
      </footer>

    </div>
  );
};

export default App;