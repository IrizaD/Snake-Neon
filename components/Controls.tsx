import React from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { Direction } from '../types';

interface ControlsProps {
  onDirectionChange: (dir: Direction) => void;
}

export const Controls: React.FC<ControlsProps> = ({ onDirectionChange }) => {
  const btnClass = "bg-gray-800 active:bg-purple-600 border border-gray-600 rounded-xl p-4 transition-colors duration-150 touch-manipulation shadow-lg";

  return (
    <div className="grid grid-cols-3 gap-2 max-w-[200px] mx-auto mt-6 select-none">
      <div className="col-start-2">
        <button 
          className={btnClass} 
          onPointerDown={(e) => { e.preventDefault(); onDirectionChange(Direction.UP); }}
          aria-label="Up"
        >
          <ArrowUp className="w-8 h-8 text-cyan-400" />
        </button>
      </div>
      <div className="col-start-1 row-start-2">
        <button 
          className={btnClass} 
          onPointerDown={(e) => { e.preventDefault(); onDirectionChange(Direction.LEFT); }}
          aria-label="Left"
        >
          <ArrowLeft className="w-8 h-8 text-cyan-400" />
        </button>
      </div>
      <div className="col-start-2 row-start-2">
        <button 
          className={btnClass} 
          onPointerDown={(e) => { e.preventDefault(); onDirectionChange(Direction.DOWN); }}
          aria-label="Down"
        >
          <ArrowDown className="w-8 h-8 text-cyan-400" />
        </button>
      </div>
      <div className="col-start-3 row-start-2">
        <button 
          className={btnClass} 
          onPointerDown={(e) => { e.preventDefault(); onDirectionChange(Direction.RIGHT); }}
          aria-label="Right"
        >
          <ArrowRight className="w-8 h-8 text-cyan-400" />
        </button>
      </div>
    </div>
  );
};