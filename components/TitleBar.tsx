import React from 'react';
import { Minus, Square, X, AppWindow, HelpCircle } from 'lucide-react';

interface TitleBarProps {
  onHelp?: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({ onHelp }) => {
  
  // Helper to send commands to Electron main process
  const sendIpc = (channel: string) => {
    try {
      // @ts-ignore
      if (window.require) {
        // @ts-ignore
        const { ipcRenderer } = window.require('electron');
        ipcRenderer.send(channel);
      }
    } catch (e) {
      console.warn('Electron IPC not available');
    }
  };

  return (
    <div className="h-8 bg-[#181818] flex items-center justify-between select-none draggable" style={{ WebkitAppRegion: 'drag' } as any}>
      <div className="flex items-center px-4 space-x-3 text-xs text-gray-400">
        <div className="flex items-center space-x-2">
            <div className="bg-[#4cc2ff] text-black p-0.5 rounded-sm">
                 <AppWindow size={12} strokeWidth={3} />
            </div>
            <span className="font-semibold tracking-wide text-gray-300">WinMD Explorer</span>
        </div>
      </div>
      
      {/* Buttons need 'no-drag' to be clickable because the parent is draggable */}
      <div className="flex h-full items-center" style={{ WebkitAppRegion: 'no-drag' } as any}>
        {onHelp && (
            <button 
                onClick={onHelp}
                className="h-full w-10 flex items-center justify-center hover:bg-[#333] text-gray-400 hover:text-white transition-colors mr-1"
                title="About"
            >
                <HelpCircle size={14} />
            </button>
        )}
        
        <button 
          onClick={() => sendIpc('app-minimize')}
          className="h-full w-12 flex items-center justify-center hover:bg-[#333] text-gray-400 transition-colors"
        >
          <Minus size={14} />
        </button>
        
        <button 
          onClick={() => sendIpc('app-maximize')}
          className="h-full w-12 flex items-center justify-center hover:bg-[#333] text-gray-400 transition-colors"
        >
          <Square size={12} />
        </button>
        
        <button 
          onClick={() => sendIpc('app-close')}
          className="h-full w-12 flex items-center justify-center hover:bg-[#e81123] hover:text-white text-gray-400 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};