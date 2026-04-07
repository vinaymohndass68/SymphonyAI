
import React from 'react';
import { Gauge } from 'lucide-react';

interface BpmControlProps {
  bpm: number;
  setBpm: (bpm: number) => void;
  isAuto: boolean;
  setIsAuto: (auto: boolean) => void;
  disabled?: boolean;
}

const BpmControl: React.FC<BpmControlProps> = ({ 
  bpm, 
  setBpm, 
  isAuto, 
  setIsAuto, 
  disabled 
}) => {
  return (
    <div className={`
      flex flex-col gap-3 p-4 rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm
      transition-all duration-300 ${disabled ? 'opacity-50 pointer-events-none' : ''}
    `}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-indigo-300 font-medium">
          <Gauge className="w-5 h-5" />
          <span>Tempo (BPM)</span>
        </div>
        
        <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Auto</span>
            <button
            onClick={() => setIsAuto(!isAuto)}
            className={`
                relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none
                ${isAuto ? 'bg-indigo-600' : 'bg-slate-700'}
            `}
            >
            <span
                className={`
                inline-block h-3 w-3 transform rounded-full bg-white transition-transform
                ${isAuto ? 'translate-x-5' : 'translate-x-1'}
                `}
            />
            </button>
        </div>
      </div>

      <div className={`transition-all duration-300 ${isAuto ? 'opacity-50 grayscale' : 'opacity-100'}`}>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="60"
            max="180"
            step="1"
            value={bpm}
            onChange={(e) => setBpm(parseInt(e.target.value))}
            disabled={isAuto || disabled}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:cursor-not-allowed"
          />
          <span className="text-sm font-mono text-slate-300 w-8 text-right">
            {bpm}
          </span>
        </div>
        <div className="flex justify-between text-[10px] text-slate-500 mt-1">
          <span>Slow (60)</span>
          <span>Fast (180)</span>
        </div>
      </div>
    </div>
  );
};

export default BpmControl;
