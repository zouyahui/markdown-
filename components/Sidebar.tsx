import React, { useState, useRef, useEffect } from 'react';
import { FileText, Folder, FolderOpen, Plus, Search, Edit2, ChevronRight, ChevronDown, FolderPlus, LocateFixed } from 'lucide-react';
import { FileDoc } from '../types';

interface SidebarProps {
  files: FileDoc[];
  activeFileId: string | null;
  onSelectFile: (id: string) => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onRenameFile: (id: string, newName: string) => void;
  onMoveFile: (fileId: string, targetFolderId: string | null) => void;
  onToggleFolder: (folderId: string) => void;
  onLocateFile: (file: FileDoc) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  files, 
  activeFileId, 
  onSelectFile, 
  onFileUpload,
  onCreateFile,
  onCreateFolder,
  onRenameFile,
  onMoveFile,
  onToggleFolder,
  onLocateFile
}) => {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
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

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    e.stopPropagation(); // Stop bubbling to prevent parent container from resetting target to null
    setDragOverFolderId(folderId);
  };

  const handleDrop = (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    e.stopPropagation(); // Stop bubbling
    setDragOverFolderId(null);
    const draggedId = e.dataTransfer.getData('text/plain');
    
    // Logic handles in App.tsx to prevent self-drop or circular folder drops
    if (draggedId) {
       onMoveFile(draggedId, targetFolderId);
    }
  };

  const renderTree = (parentId: string | null, depth: number = 0) => {
    const items = files
        .filter(f => f.parentId === parentId)
        .sort((a, b) => {
            // Folders first, then files
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'folder' ? -1 : 1;
        });

    return items.map(item => {
      const isFolder = item.type === 'folder';
      const isRenaming = renamingId === item.id;
      const isActive = activeFileId === item.id;
      
      // Calculate padding based on depth
      const paddingLeft = `${depth * 12 + 12}px`;

      // Determine effective drop target
      // If dragging over a folder, target is that folder.
      // If dragging over a file, target is that file's parent (so we can drop "next to" it).
      const dropTargetId = isFolder ? item.id : item.parentId;
      
      // Highlight logic: if we are dragging over this folder OR dragging over a child of this folder (conceptually), highlight it.
      // But since we use dropTargetId in handleDragOver, dragOverFolderId will equal this folder's ID when hovering children.
      const isDragTarget = isFolder && dragOverFolderId === item.id;

      return (
        <React.Fragment key={item.id}>
            <div 
                className={`
                    relative group flex items-center pr-2 py-1 cursor-pointer select-none transition-colors border border-transparent
                    ${isActive ? 'bg-[#333]' : 'hover:bg-[#2a2a2a]'}
                    ${isDragTarget ? 'bg-[#3d3d3d] border-[#0078d4]' : ''}
                `}
                style={{ paddingLeft }}
                onClick={() => isFolder ? onToggleFolder(item.id) : onSelectFile(item.id)}
                draggable={!isRenaming}
                onDragStart={(e) => handleDragStart(e, item.id)}
                onDragOver={(e) => handleDragOver(e, dropTargetId)}
                onDrop={(e) => handleDrop(e, dropTargetId)}
            >
                {/* Arrow for folders */}
                <div className="w-4 h-4 flex items-center justify-center mr-1 text-gray-500">
                    {isFolder && (
                        item.isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />
                    )}
                </div>

                {/* Icon */}
                <div className="mr-2 text-gray-400">
                    {isFolder ? (
                        item.isExpanded ? <FolderOpen size={16} className="text-yellow-500" /> : <Folder size={16} className="text-yellow-500" />
                    ) : (
                        <FileText size={16} className={isActive ? 'text-[#4cc2ff]' : 'text-gray-500'} />
                    )}
                </div>

                {/* Name / Rename Input */}
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
                        <div className={`truncate text-sm ${isActive ? 'text-white' : 'text-gray-300'}`}>
                            {item.name}
                        </div>
                    )}
                </div>

                {/* Hover Actions */}
                <div className="hidden group-hover:flex items-center space-x-1 ml-2">
                    {/* Locate (Reveal in Explorer) */}
                    {item.path && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onLocateFile(item); }}
                            className="p-1 hover:bg-[#444] rounded text-gray-400 hover:text-white"
                            title="Reveal in Explorer"
                        >
                            <LocateFixed size={12} />
                        </button>
                    )}
                    {/* Rename */}
                    <button 
                        onClick={(e) => startRenaming(e, item)}
                        className="p-1 hover:bg-[#444] rounded text-gray-400 hover:text-white"
                        title="Rename"
                    >
                        <Edit2 size={12} />
                    </button>
                </div>
            </div>
            
            {/* Recursive render for folder children */}
            {isFolder && item.isExpanded && renderTree(item.id, depth + 1)}
        </React.Fragment>
      );
    });
  };

  const filteredItems = files.filter(file => 
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-64 bg-[#202020] border-r border-[#333] flex flex-col h-full">
      <div className="p-4 space-y-4">
        {/* Search / Filter */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2 text-gray-500" size={14} />
          <input 
            type="text" 
            placeholder="Search..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#2d2d2d] text-sm text-white pl-8 pr-3 py-1.5 rounded-md border border-transparent focus:border-[#4cc2ff] focus:bg-[#1f1f1f] outline-none transition-all placeholder-gray-500"
          />
        </div>

        {/* Actions */}
        <div className="flex space-x-1">
            <button 
                onClick={onCreateFile}
                className="flex-1 flex items-center justify-center space-x-1 bg-[#2d2d2d] hover:bg-[#3d3d3d] text-white text-xs py-2 rounded-md transition-colors border border-[#333]"
                title="New File"
            >
                <Plus size={14} />
                <span>File</span>
            </button>
            <button 
                onClick={onCreateFolder}
                className="flex-1 flex items-center justify-center space-x-1 bg-[#2d2d2d] hover:bg-[#3d3d3d] text-white text-xs py-2 rounded-md transition-colors border border-[#333]"
                title="New Folder"
            >
                <FolderPlus size={14} />
                <span>Folder</span>
            </button>
            <label className="flex-1 flex items-center justify-center space-x-1 bg-[#0078d4] hover:bg-[#006cc0] text-white text-xs py-2 rounded-md cursor-pointer transition-colors shadow-sm">
                <FolderOpen size={14} />
                <span>Open</span>
                <input type="file" multiple accept=".md,.markdown,.txt" className="hidden" onChange={onFileUpload} />
            </label>
        </div>
      </div>

      <div 
        className="flex-1 overflow-y-auto pb-2 space-y-0.5 custom-scrollbar transition-colors"
        onDragOver={(e) => handleDragOver(e, null)} // Root drop zone
        onDrop={(e) => handleDrop(e, null)}
      >
        <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider flex justify-between">
          <span>Explorer</span>
          {files.some(f => f.path) && <span title="Some files are linked to disk">HDD Linked</span>}
        </div>
        
        {files.length === 0 ? (
          <div className="text-center mt-10 text-gray-500 text-sm italic px-4">
            No files open.<br/>Drag & drop or click Open.
          </div>
        ) : searchQuery ? (
            // Search Results (Flat View)
            <div className="px-2">
                {filteredItems.length === 0 ? (
                    <div className="text-center mt-4 text-gray-500 text-sm italic">No matches</div>
                ) : (
                    filteredItems.map(item => (
                        <div 
                            key={item.id} 
                            onClick={() => item.type === 'folder' ? onToggleFolder(item.id) : onSelectFile(item.id)}
                            className="flex items-center p-2 hover:bg-[#333] rounded cursor-pointer text-sm text-gray-300"
                        >
                            {item.type === 'folder' ? <Folder size={14} className="mr-2 text-yellow-500" /> : <FileText size={14} className="mr-2 text-blue-400" />}
                            {item.name}
                        </div>
                    ))
                )}
            </div>
        ) : (
            // Tree View
            <div className="min-h-[100px]">
                {renderTree(null)}
            </div>
        )}
      </div>

      <div className="p-3 border-t border-[#333] bg-[#1d1d1d] text-xs text-gray-500 flex justify-between items-center">
        <span>{files.filter(f => f.type === 'file').length} files</span>
        <span>Drag to move</span>
      </div>
    </div>
  );
};