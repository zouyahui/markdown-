import React, { useState, useRef, useEffect } from 'react';
import { FileText, FolderOpen, Plus, Search, Edit2, Check, X } from 'lucide-react';
import { FileDoc } from '../types';

interface SidebarProps {
  files: FileDoc[];
  activeFileId: string | null;
  onSelectFile: (id: string) => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onCreateFile: () => void;
  onRenameFile: (id: string, newName: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  files, 
  activeFileId, 
  onSelectFile, 
  onFileUpload,
  onCreateFile,
  onRenameFile
}) => {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renamingId]);

  const startRenaming = (e: React.MouseEvent, file: FileDoc) => {
    e.stopPropagation();
    setRenamingId(file.id);
    setTempName(file.name);
  };

  const cancelRenaming = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setRenamingId(null);
    setTempName('');
  };

  const saveRename = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (renamingId && tempName.trim()) {
      onRenameFile(renamingId, tempName);
    }
    setRenamingId(null);
    setTempName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveRename();
    } else if (e.key === 'Escape') {
      cancelRenaming();
    }
  };

  return (
    <div className="w-64 bg-[#202020] border-r border-[#333] flex flex-col h-full">
      <div className="p-4 space-y-4">
        {/* Search / Filter (Visual only for now) */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2 text-gray-500" size={14} />
          <input 
            type="text" 
            placeholder="Search files..." 
            className="w-full bg-[#2d2d2d] text-sm text-white pl-8 pr-3 py-1.5 rounded-md border border-transparent focus:border-[#4cc2ff] focus:bg-[#1f1f1f] outline-none transition-all placeholder-gray-500"
          />
        </div>

        {/* Actions */}
        <div className="flex space-x-2">
          <label className="flex-1 flex items-center justify-center space-x-2 bg-[#2d2d2d] hover:bg-[#3d3d3d] text-white text-xs py-2 rounded-md cursor-pointer transition-colors border border-[#333]">
            <FolderOpen size={14} />
            <span>Open</span>
            <input type="file" multiple accept=".md,.markdown,.txt" className="hidden" onChange={onFileUpload} />
          </label>
          <button 
            onClick={onCreateFile}
            className="flex-1 flex items-center justify-center space-x-2 bg-[#0078d4] hover:bg-[#006cc0] text-white text-xs py-2 rounded-md transition-colors shadow-sm"
          >
            <Plus size={14} />
            <span>New</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
        <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Explorer
        </div>
        
        {files.length === 0 ? (
          <div className="text-center mt-10 text-gray-500 text-sm italic px-4">
            No files open.<br/>Drag & drop or click Open.
          </div>
        ) : (
          files.map(file => (
            <div key={file.id} className="relative group">
              {renamingId === file.id ? (
                <div className="flex items-center px-2 py-1 bg-[#2d2d2d] rounded-md border border-[#0078d4]">
                   <FileText size={16} className="text-[#4cc2ff] mr-2 flex-shrink-0" />
                   <input
                      ref={inputRef}
                      type="text"
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onBlur={() => saveRename()}
                      className="w-full bg-transparent text-white text-sm outline-none"
                   />
                </div>
              ) : (
                <button
                  onClick={() => onSelectFile(file.id)}
                  className={`w-full text-left flex items-center space-x-2.5 px-3 py-2 rounded-md transition-all ${
                    activeFileId === file.id 
                      ? 'bg-[#333] text-white' 
                      : 'text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200'
                  }`}
                >
                  <FileText size={16} className={activeFileId === file.id ? 'text-[#4cc2ff]' : 'text-gray-500 group-hover:text-gray-400'} />
                  <div className="flex-1 truncate text-sm pr-6">
                    {file.name}
                  </div>
                  
                  {/* Rename Trigger */}
                  <div 
                    onClick={(e) => startRenaming(e, file)}
                    className="absolute right-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-[#444] rounded text-gray-400 hover:text-white transition-all"
                    title="Rename"
                  >
                    <Edit2 size={12} />
                  </div>
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <div className="p-3 border-t border-[#333] bg-[#1d1d1d] text-xs text-gray-500 flex justify-between items-center">
        <span>{files.length} items</span>
        <span>UTF-8</span>
      </div>
    </div>
  );
};