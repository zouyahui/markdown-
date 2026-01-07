import React, { useState, useEffect } from 'react';
import { X, Key, ExternalLink, Save, ShieldAlert } from 'lucide-react';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onSaveApiKey: (key: string) => void;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ isOpen, onClose, apiKey, onSaveApiKey }) => {
  const [inputKey, setInputKey] = useState(apiKey);

  useEffect(() => {
    setInputKey(apiKey);
  }, [apiKey, isOpen]);

  const handleSave = () => {
    onSaveApiKey(inputKey);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[450px] bg-[#202020] border border-[#333] rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#333] bg-[#252525]">
          <h3 className="font-semibold text-sm">Settings</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-6">
          
          {/* API Key Section */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-200 flex items-center space-x-2">
              <Key size={16} className="text-[#4cc2ff]" />
              <span>Google Gemini API Key</span>
            </label>
            
            <div className="relative">
                <input 
                    type="password" 
                    value={inputKey}
                    onChange={(e) => setInputKey(e.target.value)}
                    placeholder="Enter your API Key here (starts with AIza...)"
                    className="w-full bg-[#1e1e1e] border border-[#444] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-[#4cc2ff] transition-colors placeholder-gray-600"
                />
            </div>

            <div className="flex items-start space-x-2 text-xs text-gray-400 bg-[#2d2d2d] p-3 rounded-md border border-[#333]">
                <ShieldAlert size={14} className="mt-0.5 flex-shrink-0 text-yellow-500" />
                <p>
                    Your API key is stored locally in your browser's Local Storage. It is never sent to any server other than Google's API endpoints.
                </p>
            </div>
          </div>

          {/* Links */}
          <div className="pt-2 border-t border-[#333]">
             <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center text-xs text-[#4cc2ff] hover:underline space-x-1"
             >
                <span>Get a free API Key from Google AI Studio</span>
                <ExternalLink size={10} />
             </a>
          </div>

        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-[#1a1a1a] border-t border-[#333] flex justify-end space-x-2">
          <button 
            onClick={onClose}
            className="px-4 py-1.5 bg-[#333] hover:bg-[#444] text-white text-xs rounded-[4px] transition-colors border border-[#444]"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="flex items-center space-x-1.5 px-4 py-1.5 bg-[#0078d4] hover:bg-[#006cc0] text-white text-xs rounded-[4px] transition-colors"
          >
            <Save size={14} />
            <span>Save Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};