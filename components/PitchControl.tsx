
import React from 'react';
import { Sliders } from 'lucide-react';

interface PitchControlProps {
  pitch: number;
  onChange: (val: number) => void;
  disabled?: boolean;
}

const PitchControl: React.FC<PitchControlProps> = ({ pitch, onChange, disabled }) => {
  return (
    <div className={`
      flex flex-col gap-3 p-4 rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm
      transition-all duration-300 ${disabled ? 'opacity-50 pointer-events-none' : ''}
    `}>
      <div className="flex items-center gap-2 text-indigo-300 font-medium">
        <Sliders className="w-5 h-5" />
        <span>Vocal Pitch Shift</span>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-xs text-slate-400 font-medium w-8">Low</span>
        <input
          type="range"
          min="-12"
          max="12"
          step="1"
          value={pitch}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
        />
        <span className="text-xs text-slate-400 font-medium w-8 text-right">High</span>
      </div>
      
      <div className="text-center text-xs font-mono text-indigo-400">
        {pitch > 0 ? `+${pitch}` : pitch} Semitones
      </div>
    </div>
  );
};

export default PitchControl;
