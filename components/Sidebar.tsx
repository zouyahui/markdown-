import React, { useState, useRef, useEffect } from 'react';
import { FileText, Folder, FolderOpen, Plus, Search, Edit2, ChevronRight, ChevronDown, FolderPlus, LocateFixed, Settings } from 'lucide-react';
import { FileDoc, Language } from '../types';
import { translations } from '../translations';

interface SidebarProps {
  files: FileDoc[];
  activeFileId: string | null;
  selectedFileIds: string[];
  onSelect: (id: string, modifiers: { ctrl: boolean, shift: boolean }) => void;
  onOpenFile: () => void;
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onRenameFile: (id: string, newName: string) => void;
  onMoveFile: (fileIds: string[], targetFolderId: string | null) => void;
  onToggleFolder: (folderId: string) => void;
  onLocateFile: (file: FileDoc) => void;
  onOpenSettings: () => void;
  language: Language;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  // New props for resizing
  width: number;
  onResizeStart: (e: React.MouseEvent) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  files, 
  activeFileId, 
  selectedFileIds,
  onSelect, 
  onOpenFile,
  onCreateFile,
  onCreateFolder,
  onRenameFile,
  onMoveFile,
  onToggleFolder,
  onLocateFile,
  onOpenSettings,
  language,
  searchQuery,
  onSearchChange,
  width,
  onResizeStart
}) => {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const t = translations[language].sidebar;

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

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.stopPropagation();
    
    // Determine which IDs to drag.
    let idsToDrag = [id];
    if (selectedFileIds.includes(id)) {
        idsToDrag = selectedFileIds;
    }

    e.dataTransfer.setData('text/plain', JSON.stringify(idsToDrag));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    e.stopPropagation(); 
    setDragOverFolderId(folderId);
  };

  const handleDrop = (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);
    
    const data = e.dataTransfer.getData('text/plain');
    if (data) {
        try {
            const parsed = JSON.parse(data);
            const ids = Array.isArray(parsed) ? parsed : [data];
            onMoveFile(ids, targetFolderId);
        } catch (e) {
            onMoveFile([data], targetFolderId);
        }
    }
  };

  const renderTree = (parentId: string | null, depth: number = 0) => {
    const items = files
        .filter(f => f.parentId === parentId)
        .sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'folder' ? -1 : 1;
        });

    return items.map(item => {
      const isFolder = item.type === 'folder';
      const isRenaming = renamingId === item.id;
      const isSelected = selectedFileIds.includes(item.id);
      
      const paddingLeft = `${depth * 12 + 12}px`;
      const dropTargetId = isFolder ? item.id : item.parentId;
      const isDragTarget = isFolder && dragOverFolderId === item.id;

      return (
        <React.Fragment key={item.id}>
            <div 
                className={`
                    relative group flex items-center pr-2 py-1 cursor-pointer select-none transition-colors border-l-2
                    ${isDragTarget ? 'bg-[#3d3d3d] border-[#0078d4]' : ''}
                    ${isSelected ? 'bg-[#37373d] border-[#4cc2ff]' : 'border-transparent hover:bg-[#2a2a2a]'}
                `}
                style={{ paddingLeft }}
                onClick={(e) => onSelect(item.id, { ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey })}
                draggable={!isRenaming}
                onDragStart={(e) => handleDragStart(e, item.id)}
                onDragOver={(e) => handleDragOver(e, dropTargetId)}
                onDrop={(e) => handleDrop(e, dropTargetId)}
            >
                <div 
                    className="w-4 h-4 flex items-center justify-center mr-1 text-gray-500 hover:text-white"
                    onClick={(e) => { e.stopPropagation(); if(isFolder) onToggleFolder(item.id); }}
                >
                    {isFolder && (
                        item.isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />
                    )}
                </div>

                <div className="mr-2 text-gray-400">
                    {isFolder ? (
                        item.isExpanded ? <FolderOpen size={16} className="text-[#e8b339]" /> : <Folder size={16} className="text-[#e8b339]" />
                    ) : (
                        <FileText size={16} className="text-[#4cc2ff]" />
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    {isRenaming ? (
                        <input
                            ref={inputRef}
                            type="text"
                            value={tempName}
                            onChange={(e) => setTempName(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={() => saveRename()}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full bg-[#111] text-white text-sm px-1 py-0.5 border border-[#0078d4] outline-none rounded-sm"
                        />
                    ) : (
                        <div className={`truncate text-sm flex items-center ${isSelected ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}>
                            {item.name}
                            {item.isUnsaved && <span className="text-yellow-400 ml-1 text-xs">*</span>}
                        </div>
                    )}
                </div>

                <div className="hidden group-hover:flex items-center space-x-1 ml-2">
                    {item.path && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onLocateFile(item); }}
                            className="p-1 hover:bg-[#444] rounded text-gray-400 hover:text-white"
                            title={t.reveal}
                        >
                            <LocateFixed size={12} />
                        </button>
                    )}
                    <button 
                        onClick={(e) => startRenaming(e, item)}
                        className="p-1 hover:bg-[#444] rounded text-gray-400 hover:text-white"
                        title={t.rename}
                    >
                        <Edit2 size={12} />
                    </button>
                </div>
            </div>
            {isFolder && item.isExpanded && renderTree(item.id, depth + 1)}
        </React.Fragment>
      );
    });
  };

  const filteredItems = files.filter(file => 
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div 
        className="bg-[#202020] border-r border-[#2b2b2b] flex flex-col h-full relative flex-shrink-0"
        style={{ width: width }}
    >
      <div className="p-3 space-y-3">
        <div className="relative group">
          <Search className="absolute left-2.5 top-2 text-gray-500 group-focus-within:text-[#4cc2ff]" size={14} />
          <input 
            type="text" 
            placeholder={t.searchPlaceholder} 
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-[#2d2d2d] text-sm text-white pl-8 pr-3 py-1.5 rounded-md border border-transparent focus:border-[#4cc2ff] focus:bg-[#1f1f1f] outline-none transition-all placeholder-gray-500"
          />
        </div>

        <div className="flex space-x-1">
            <button 
                onClick={onCreateFile}
                className="flex-1 flex items-center justify-center space-x-1 bg-[#2d2d2d] hover:bg-[#3d3d3d] text-white text-xs py-1.5 rounded transition-colors border border-[#333]"
                title={t.newFile}
            >
                <Plus size={14} />
                <span>{language === 'zh' ? '文件' : 'File'}</span>
            </button>
            <button 
                onClick={onCreateFolder}
                className="flex-1 flex items-center justify-center space-x-1 bg-[#2d2d2d] hover:bg-[#3d3d3d] text-white text-xs py-1.5 rounded transition-colors border border-[#333]"
                title={t.newFolder}
            >
                <FolderPlus size={14} />
                <span>{language === 'zh' ? '文件夹' : 'Folder'}</span>
            </button>
            <button 
                onClick={onOpenFile}
                className="flex-1 flex items-center justify-center space-x-1 bg-[#0078d4] hover:bg-[#006cc0] text-white text-xs py-1.5 rounded cursor-pointer transition-colors shadow-sm"
                title={t.open}
            >
                <FolderOpen size={14} />
                <span>{t.open}</span>
            </button>
        </div>
      </div>

      <div 
        className="flex-1 overflow-y-auto pb-2 space-y-0.5 custom-scrollbar transition-colors"
        onDragOver={(e) => handleDragOver(e, null)} 
        onDrop={(e) => handleDrop(e, null)}
      >
        <div className="px-3 py-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest flex justify-between">
          <span>{t.project}</span>
        </div>
        
        {files.length === 0 ? (
          <div className="text-center mt-10 text-gray-500 text-sm italic px-4 whitespace-pre-wrap">
            {t.noFiles}
          </div>
        ) : searchQuery ? (
            <div className="px-2">
                {filteredItems.length === 0 ? (
                    <div className="text-center mt-4 text-gray-500 text-sm italic">{t.noMatches}</div>
                ) : (
                    filteredItems.map(item => {
                        const isSelected = selectedFileIds.includes(item.id);
                        return (
                            <div 
                                key={item.id} 
                                onClick={(e) => onSelect(item.id, { ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey })}
                                className={`
                                    flex items-center p-2 rounded cursor-pointer text-sm
                                    ${isSelected ? 'bg-[#37373d] text-white' : 'hover:bg-[#333] text-gray-300'}
                                `}
                            >
                                {item.type === 'folder' ? <Folder size={14} className="mr-2 text-[#e8b339]" /> : <FileText size={14} className="mr-2 text-[#4cc2ff]" />}
                                {item.name}
                            </div>
                        );
                    })
                )}
            </div>
        ) : (
            <div className="min-h-[100px] pt-1">
                {renderTree(null)}
            </div>
        )}
      </div>

      <div className="p-2 border-t border-[#333] bg-[#1d1d1d] text-xs text-gray-500 flex justify-between items-center">
        <span className="pl-1">{files.filter(f => f.type === 'file').length} {t.items}</span>
        <button 
            onClick={onOpenSettings} 
            className="p-1.5 hover:bg-[#333] rounded text-gray-500 hover:text-white transition-colors"
            title={translations[language].settings.title}
        >
            <Settings size={14} />
        </button>
      </div>

      {/* Resize Handle */}
      <div 
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0078d4] z-20 hover:opacity-100 opacity-0 transition-opacity"
        onMouseDown={onResizeStart}
      />
    </div>
  );
};