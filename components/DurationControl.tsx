import React from 'react';
import { Clock } from 'lucide-react';

interface DurationControlProps {
  duration: number; // in seconds
  onChange: (duration: number) => void;
  disabled: boolean;
}

const DurationControl: React.FC<DurationControlProps> = ({ duration, onChange, disabled }) => {
  const options = [
    { label: '1 Min', value: 60 },
    { label: '3 Min', value: 180 },
    { label: '5 Min', value: 300 },
  ];

  return (
    <div className={`
      flex flex-col gap-3 p-4 rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm
      transition-all duration-300 ${disabled ? 'opacity-50 pointer-events-none' : ''}
    `}>
      <div className="flex items-center gap-2 text-indigo-300 font-medium">
        <Clock className="w-5 h-5" />
        <span>Target Duration</span>
      </div>

      <div className="flex bg-slate-700/50 rounded-lg p-1">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`
              flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-all duration-200
              ${duration === option.value 
                ? 'bg-indigo-600 text-white shadow-sm' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-600/50'
              }
            `}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-slate-500 text-center">
        {duration === 60 ? "Short & Sweet (Verse + Chorus)" : 
         duration === 180 ? "Standard Radio Edit" : 
         "Extended Club Mix / Epic"}
      </p>
    </div>
  );
};

export default DurationControl;
