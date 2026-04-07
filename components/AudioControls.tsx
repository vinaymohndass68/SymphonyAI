import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Download, RotateCcw, FileMusic } from 'lucide-react';
import Visualizer from './Visualizer';

interface AudioControlsProps {
  audioBlob: Blob;
  midiBlob?: Blob | null;
  onReset: () => void;
}

const AudioControls: React.FC<AudioControlsProps> = ({ audioBlob, midiBlob, onReset }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [sourceNode, setSourceNode] = useState<AudioBufferSourceNode | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [startedAt, setStartedAt] = useState<number>(0);
  const [pausedAt, setPausedAt] = useState<number>(0);

  // Initialize Audio Context and decode blob
  useEffect(() => {
    const initAudio = async () => {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      setAudioContext(ctx);

      const arrayBuffer = await audioBlob.arrayBuffer();
      const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
      setAudioBuffer(decodedBuffer);
    };

    initAudio();

    return () => {
      if (audioContext) audioContext.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioBlob]);

  const play = () => {
    if (!audioContext || !audioBuffer) return;

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    
    // Resume context if suspended (browser policy)
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    const offset = pausedAt % audioBuffer.duration;
    source.start(0, offset);
    
    setSourceNode(source);
    setStartedAt(audioContext.currentTime - offset);
    setIsPlaying(true);

    source.onended = () => {
       setIsPlaying(false);
       setPausedAt(0);
    };
  };

  const pause = () => {
    if (sourceNode && audioContext) {
      sourceNode.stop();
      setPausedAt(audioContext.currentTime - startedAt);
      setSourceNode(null);
      setIsPlaying(false);
    }
  };

  const download = () => {
    const url = URL.createObjectURL(audioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'symphony_creation.wav';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadMidi = () => {
    if (!midiBlob) return;
    const url = URL.createObjectURL(midiBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'symphony_creation.mid';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
       <div className="relative w-full">
         <Visualizer 
            audioContext={audioContext}
            sourceNode={sourceNode}
            isActive={isPlaying}
            color="#4ade80" // Green-400
         />
       </div>

      <div className="flex justify-center items-center gap-6">
        <button
          onClick={onReset}
          className="p-4 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          title="Record New"
        >
          <RotateCcw className="w-6 h-6" />
        </button>

        <button
          onClick={isPlaying ? pause : play}
          className="p-6 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 transform transition-all active:scale-95"
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <Pause className="w-8 h-8 fill-current" />
          ) : (
            <Play className="w-8 h-8 fill-current ml-1" />
          )}
        </button>

        <div className="flex flex-col gap-2">
            <button
            onClick={download}
            className="p-4 rounded-full bg-slate-800 hover:bg-slate-700 text-green-400 transition-colors"
            title="Download Audio (WAV)"
            >
            <Download className="w-6 h-6" />
            </button>
            
            {midiBlob && (
                <button
                onClick={downloadMidi}
                className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-indigo-400 transition-colors flex justify-center items-center"
                title="Download MIDI"
                >
                <FileMusic className="w-4 h-4" />
                </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default AudioControls;