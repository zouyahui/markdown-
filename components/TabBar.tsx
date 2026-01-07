import React from 'react';
import { X, FileText } from 'lucide-react';
import { FileDoc } from '../types';

interface TabBarProps {
  files: FileDoc[];
  openFileIds: string[];
  activeFileId: string | null;
  selectedFileIds: string[];
  onSelect: (id: string, modifiers: { ctrl: boolean, shift: boolean }) => void;
  onCloseFile: (id: string) => void;
}

export const TabBar: React.FC<TabBarProps> = ({ 
  files, 
  openFileIds, 
  activeFileId,
  selectedFileIds,
  onSelect, 
  onCloseFile 
}) => {
  // Map ids to file objects
  const openFiles = openFileIds
    .map(id => files.find(f => f.id === id))
    .filter((f): f is FileDoc => !!f);

  if (openFiles.length === 0) return null;

  return (
    <div className="flex bg-[#181818] border-b border-[#2b2b2b] pt-2 px-2 space-x-1 overflow-x-auto no-scrollbar select-none" style={{ WebkitAppRegion: 'no-drag' } as any}>
      {openFiles.map(file => {
        const isActive = file.id === activeFileId;
        const isSelected = selectedFileIds.includes(file.id);
        
        return (
          <div
            key={file.id}
            onClick={(e) => onSelect(file.id, { ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey })}
            className={`
              group flex items-center min-w-[120px] max-w-[200px] h-9 px-3 text-xs border-t-2 rounded-t-md cursor-pointer transition-colors relative
              ${isActive 
                ? 'bg-[#272727] text-white border-[#4cc2ff] z-10' 
                : isSelected
                  ? 'bg-[#323232] text-gray-200 border-transparent z-0'
                  : 'bg-[#202020] text-gray-400 border-transparent hover:bg-[#252525] hover:text-gray-200 z-0'
              }
            `}
          >
            <FileText size={13} className={`mr-2 flex-shrink-0 ${isActive ? 'text-[#4cc2ff]' : 'text-gray-500'}`} />
            <span className="truncate flex-1 mr-2">{file.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCloseFile(file.id);
              }}
              className={`
                p-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity
                ${isActive ? 'hover:bg-[#333] text-gray-300' : 'hover:bg-[#444] text-gray-400'}
              `}
            >
              <X size={12} />
            </button>
            
            {/* Divider for inactive/unselected tabs */}
            {!isActive && !isSelected && (
              <div className="absolute right-0 top-2 bottom-2 w-[1px] bg-[#333] opacity-50 group-hover:opacity-0" />
            )}
          </div>
        );
      })}
    </div>
  );
};