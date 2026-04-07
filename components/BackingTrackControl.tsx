import React from 'react';
import { Layers, Volume2, MoveHorizontal } from 'lucide-react';

interface BackingTrackControlProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  volume: number;
  onVolumeChange: (val: number) => void;
  stereoWidth: number;
  onStereoWidthChange: (val: number) => void;
  disabled?: boolean;
}

const BackingTrackControl: React.FC<BackingTrackControlProps> = ({
  enabled,
  onToggle,
  volume,
  onVolumeChange,
  stereoWidth,
  onStereoWidthChange,
  disabled
}) => {
  return (
    <div className={`
      flex flex-col gap-3 p-4 rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm
      transition-all duration-300 ${disabled ? 'opacity-50 pointer-events-none' : ''}
    `}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-indigo-300 font-medium">
          <Layers className="w-5 h-5" />
          <span>Layer Backing Music</span>
        </div>
        
        <button
          onClick={() => onToggle(!enabled)}
          className={`
            relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900
            ${enabled ? 'bg-indigo-600' : 'bg-slate-700'}
          `}
        >
          <span
            className={`
              inline-block h-4 w-4 transform rounded-full bg-white transition-transform
              ${enabled ? 'translate-x-6' : 'translate-x-1'}
            `}
          />
        </button>
      </div>

      {enabled && (
        <div className="space-y-4 pt-2 animate-fade-in-down">
          {/* Volume Control */}
          <div className="flex items-center gap-3">
            <Volume2 className="w-4 h-4 text-slate-400" />
            <div className="flex-1 flex flex-col gap-1">
              <input
                type="range"
                min="0.1"
                max="0.8"
                step="0.05"
                value={volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>
            <span className="text-xs text-slate-400 w-8 text-right">
              {Math.round(volume * 100)}%
            </span>
          </div>

          {/* Stereo Width Control */}
          <div className="flex items-center gap-3">
            <MoveHorizontal className="w-4 h-4 text-slate-400" />
            <div className="flex-1 flex flex-col gap-1">
               <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={stereoWidth}
                onChange={(e) => onStereoWidthChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>
            <span className="text-xs text-slate-400 w-8 text-right">
              {Math.round(stereoWidth * 100)}%
            </span>
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 px-7 -mt-2">
            <span>Mono</span>
            <span>Normal</span>
            <span>Wide</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default BackingTrackControl;