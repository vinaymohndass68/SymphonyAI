import React from 'react';
import { Instrument } from '../types';
import { Drum, Guitar, Keyboard, Wind, Music } from 'lucide-react';

interface InstrumentSelectorProps {
  selectedInstruments: Instrument[];
  onToggle: (instrument: Instrument) => void;
  disabled: boolean;
}

const InstrumentSelector: React.FC<InstrumentSelectorProps> = ({ 
  selectedInstruments, 
  onToggle, 
  disabled 
}) => {
  
  const getIcon = (inst: Instrument) => {
    switch (inst) {
      case Instrument.DRUMS: return <Drum className="w-4 h-4" />;
      case Instrument.TABLA: return <div className="w-4 h-4 rounded-full border-2 border-current flex items-center justify-center text-[8px] font-bold">T</div>;
      case Instrument.GUITAR: return <Guitar className="w-4 h-4" />;
      case Instrument.FLUTE: return <Wind className="w-4 h-4" />;
      case Instrument.HARMONIUM: return <Music className="w-4 h-4" />;
      case Instrument.PIANO: return <Keyboard className="w-4 h-4" />;
      default: return <Music className="w-4 h-4" />;
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {Object.values(Instrument).map((inst) => {
        const isSelected = selectedInstruments.includes(inst);
        return (
          <button
            key={inst}
            onClick={() => onToggle(inst)}
            disabled={disabled}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 border
              ${isSelected 
                ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300 shadow-[0_0_10px_rgba(99,102,241,0.2)]' 
                : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            {getIcon(inst)}
            {inst}
          </button>
        );
      })}
    </div>
  );
};

export default InstrumentSelector;