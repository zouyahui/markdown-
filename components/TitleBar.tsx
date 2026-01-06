import React from 'react';
import { Minus, Square, X, AppWindow, HelpCircle } from 'lucide-react';

interface TitleBarProps {
  title: string;
  onHelp?: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({ title, onHelp }) => {
  return (
    <div className="h-8 bg-[#1a1a1a] flex items-center justify-between select-none draggable border-b border-[#333]">
      <div className="flex items-center px-3 space-x-2 text-xs text-gray-400">
        <AppWindow size={14} className="text-blue-400" />
        <span className="font-medium tracking-wide pt-0.5">{title}</span>
      </div>
      
      <div className="flex h-full items-center">
        {onHelp && (
            <button 
                onClick={onHelp}
                className="h-full w-10 flex items-center justify-center hover:bg-[#333] text-gray-400 hover:text-white transition-colors mr-1"
                title="How to install"
            >
                <HelpCircle size={14} />
            </button>
        )}
        <div className="h-4 w-[1px] bg-[#333] mx-1"></div>
        <button className="h-full w-12 flex items-center justify-center hover:bg-[#333] text-gray-400 transition-colors">
          <Minus size={14} />
        </button>
        <button className="h-full w-12 flex items-center justify-center hover:bg-[#333] text-gray-400 transition-colors">
          <Square size={12} />
        </button>
        <button className="h-full w-12 flex items-center justify-center hover:bg-[#e81123] hover:text-white text-gray-400 transition-colors">
          <X size={14} />
        </button>
      </div>
    </div>
  );
};