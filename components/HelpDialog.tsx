import React from 'react';
import { X, Cpu, HardDrive, Layout, FileCode } from 'lucide-react';
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
      <div className="w-[450px] bg-[#202020] border border-[#333] rounded-lg shadow-2xl p-0 overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#333] bg-[#252525]">
          <h3 className="font-semibold text-sm">{t.title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={16} />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6">
          {/* Logo & Version */}
          <div className="text-center mb-6">
             <div className="text-4xl mb-2">🚀</div>
             <h2 className="text-xl font-bold text-white">{t.appName}</h2>
             <p className="text-xs text-gray-500 mt-1">{t.version}</p>
             <p className="text-sm text-gray-400 mt-3 px-4 leading-relaxed">
               {t.description}
             </p>
          </div>

          {/* Features Grid */}
          <div className="bg-[#1a1a1a] rounded-lg p-4 border border-[#333] mb-5">
             <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3">{t.features}</h4>
             <ul className="space-y-2">
                <li className="flex items-center space-x-2 text-xs text-gray-400">
                    <Cpu size={14} className="text-[#4cc2ff]" />
                    <span>{t.feature1}</span>
                </li>
                <li className="flex items-center space-x-2 text-xs text-gray-400">
                    <Layout size={14} className="text-[#e8b339]" />
                    <span>{t.feature2}</span>
                </li>
                <li className="flex items-center space-x-2 text-xs text-gray-400">
                    <HardDrive size={14} className="text-green-500" />
                    <span>{t.feature3}</span>
                </li>
                <li className="flex items-center space-x-2 text-xs text-gray-400">
                    <FileCode size={14} className="text-purple-500" />
                    <span>{t.feature4}</span>
                </li>
             </ul>
          </div>

          {/* Storage Note */}
          <div className="flex items-start space-x-2 text-xs text-gray-500">
            <HardDrive size={14} className="mt-0.5 flex-shrink-0" />
            <div>
               <span className="font-semibold text-gray-400 mr-1">{t.storage}:</span>
               {t.storageDesc}
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
