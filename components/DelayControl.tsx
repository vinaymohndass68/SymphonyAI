import React from 'react';
import { Repeat } from 'lucide-react';

interface DelayControlProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  time: number;
  onTimeChange: (val: number) => void;
  feedback: number;
  onFeedbackChange: (val: number) => void;
  mix: number;
  onMixChange: (val: number) => void;
  disabled?: boolean;
}

const DelayControl: React.FC<DelayControlProps> = ({
  enabled,
  onToggle,
  time,
  onTimeChange,
  feedback,
  onFeedbackChange,
  mix,
  onMixChange,
  disabled
}) => {
  return (
    <div className={`
      flex flex-col gap-3 p-4 rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm
      transition-all duration-300 ${disabled ? 'opacity-50 pointer-events-none' : ''}
    `}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-indigo-300 font-medium">
          <Repeat className="w-5 h-5" />
          <span>Backing Delay</span>
        </div>
        
        <button
          onClick={() => onToggle(!enabled)}
          className={`
            relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none
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
        <div className="space-y-3 pt-2 animate-fade-in-down">
          {/* Time */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-400">
                <span>Time</span>
                <span>{time.toFixed(2)}s</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="1.0"
              step="0.05"
              value={time}
              onChange={(e) => onTimeChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Feedback */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-400">
                <span>Feedback</span>
                <span>{Math.round(feedback * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="0.9"
              step="0.05"
              value={feedback}
              onChange={(e) => onFeedbackChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Mix */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-400">
                <span>Mix</span>
                <span>{Math.round(mix * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={mix}
              onChange={(e) => onMixChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default DelayControl;