import React from 'react';
import { X, Monitor, Download, HardDrive } from 'lucide-react';

interface HelpDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpDialog: React.FC<HelpDialogProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[400px] bg-[#202020] border border-[#333] rounded-lg shadow-2xl p-0 overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#333] bg-[#252525]">
          <h3 className="font-semibold text-sm">About WinMD Explorer</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={16} />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-[#333] rounded-md text-[#4cc2ff]">
              <HardDrive size={24} />
            </div>
            <div>
              <h4 className="font-medium text-sm mb-1">Where are files saved?</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Files are automatically saved to your browser's <b>Local Storage</b> so they persist after a refresh.
                <br/><br/>
                To save a file permanently to your computer, click the <b>Save</b> button in the toolbar.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="p-2 bg-[#333] rounded-md text-[#4cc2ff]">
              <Download size={24} />
            </div>
            <div>
              <h4 className="font-medium text-sm mb-1">Install on Windows</h4>
              <p className="text-xs text-gray-400 leading-relaxed mb-2">
                Install this app for a native Windows experience:
              </p>
              <ol className="text-xs text-gray-400 list-decimal pl-4 space-y-1">
                <li>Open this page in <b>Edge</b> or <b>Chrome</b>.</li>
                <li>Look for the <b>Install</b> icon (computer with down arrow) in the address bar.</li>
                <li>Click <b>Install</b> to add it to your Start Menu and Desktop.</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-[#1a1a1a] border-t border-[#333] flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-1.5 bg-[#0078d4] hover:bg-[#006cc0] text-white text-xs rounded-[4px] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};