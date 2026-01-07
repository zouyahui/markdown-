import React from 'react';
import { X, Monitor, Download, HardDrive } from 'lucide-react';
import { Language } from '../types';
import { translations } from '../translations';

interface HelpDialogProps {
  isOpen: boolean;
  onClose: () => void;
  language?: Language;
}

export const HelpDialog: React.FC<HelpDialogProps> = ({ isOpen, onClose, language = 'en' }) => {
  const t = translations[language].help;
  const commonT = translations[language].common;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[400px] bg-[#202020] border border-[#333] rounded-lg shadow-2xl p-0 overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#333] bg-[#252525]">
          <h3 className="font-semibold text-sm">{t.title}</h3>
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
              <h4 className="font-medium text-sm mb-1">{t.whereSavedTitle}</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                {t.whereSavedDesc}
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="p-2 bg-[#333] rounded-md text-[#4cc2ff]">
              <Download size={24} />
            </div>
            <div>
              <h4 className="font-medium text-sm mb-1">{t.installTitle}</h4>
              <p className="text-xs text-gray-400 leading-relaxed mb-2">
                {t.installDesc}
              </p>
              <ol className="text-xs text-gray-400 list-decimal pl-4 space-y-1">
                <li>{t.installStep1}</li>
                <li>{t.installStep2}</li>
                <li>{t.installStep3}</li>
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
            {commonT.close}
          </button>
        </div>
      </div>
    </div>
  );
};
