import React from 'react';
import { MusicStyle } from '../types';

interface StyleSelectorProps {
  selectedStyle: MusicStyle;
  onSelect: (style: MusicStyle) => void;
  disabled: boolean;
}

const StyleSelector: React.FC<StyleSelectorProps> = ({ selectedStyle, onSelect, disabled }) => {
  return (
    <div className="flex flex-wrap gap-2 justify-center mb-6">
      {Object.values(MusicStyle).map((style) => (
        <button
          key={style}
          onClick={() => onSelect(style)}
          disabled={disabled}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 
            ${
              selectedStyle === style
                ? 'bg-indigo-600 text-white shadow-lg scale-105'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          {style}
        </button>
      ))}
    </div>
  );
};

export default StyleSelector;
