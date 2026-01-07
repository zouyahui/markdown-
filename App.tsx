import React, { useState, useEffect } from 'react';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { MarkdownViewer } from './components/MarkdownViewer';
import { MarkdownEditor } from './components/MarkdownEditor';
import { AIAssistant } from './components/AIAssistant';
import { HelpDialog } from './components/HelpDialog';
import { FileDoc } from './types';
import { Sparkles, Layout, PenTool, Eye, Save, MapPin } from 'lucide-react';

const App: React.FC = () => {
  const [files, setFiles] = useState<FileDoc[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const activeFile = files.find(f => f.id === activeFileId);

  // Reset edit mode when switching files
  useEffect(() => {
    setIsEditing(false);
  }, [activeFileId]);

  // Load from LocalStorage on mount
  useEffect(() => {
    const savedFiles = localStorage.getItem('winmd_files');
    if (savedFiles) {
      try {
        const parsedFiles = JSON.parse(savedFiles);
        if (parsedFiles.length > 0) {
          // Migration: Ensure new fields exist for old data
          const migratedFiles = parsedFiles.map((f: any) => ({
            ...f,
            type: f.type || 'file',
            parentId: f.parentId || null,
            isExpanded: f.isExpanded !== undefined ? f.isExpanded : false
          }));
          setFiles(migratedFiles);
          // Find first file to activate
          const firstFile = migratedFiles.find((f: FileDoc) => f.type === 'file');
          if (firstFile) setActiveFileId(firstFile.id);
          return;
        }
      } catch (e) {
        console.error("Failed to load files", e);
      }
    }

    // Fallback to Welcome file if no storage
    const welcomeFile: FileDoc = {
      id: 'welcome',
      name: 'Welcome.md',
      type: 'file',
      parentId: null,
      lastModified: Date.now(),
      content: `# Welcome to WinMD Explorer

This is a **Windows 11 inspired** Markdown explorer.

## New Features 🚀
- **Folders**: Create folders and organize your files.
- **Drag & Drop**: Drag files into folders to move them.
- **Locate File**: Click the target icon to find the file on your disk (if opened from disk).

## Storage Note 💾
- **Auto-Save**: Files are saved to local storage.
- **HDD Link**: If you open a file from disk, WinMD remembers the path.

## How to use
1. Use the "Open" button in the sidebar.
2. Click "Folder" to create a new folder.
3. Drag items to organize.
      `
    };
    setFiles([welcomeFile]);
    setActiveFileId('welcome');
  }, []);

  // Save to LocalStorage whenever files change
  useEffect(() => {
    if (files.length > 0) {
      localStorage.setItem('winmd_files', JSON.stringify(files));
    }
  }, [files]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList) return;

    Array.from(fileList).forEach((file: File) => {
      // Electron hack: 'path' property exists on File object in Electron
      // @ts-ignore
      const realPath = file.path;

      // Check for existence
      const existingFile = files.find(f => f.path === realPath || (f.name === file.name && !f.path));
      
      if (existingFile) {
        if (!window.confirm(`The file "${file.name}" is already open. Update content?`)) {
            setActiveFileId(existingFile.id);
            return;
        }
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        
        if (existingFile) {
            // Overwrite existing
            setFiles(prev => prev.map(f => 
                f.id === existingFile.id 
                ? { ...f, content: text, lastModified: file.lastModified, path: realPath }
                : f
            ));
            setActiveFileId(existingFile.id);
        } else {
            // Create new
            const newFile: FileDoc = {
                id: Math.random().toString(36).substr(2, 9),
                name: file.name,
                content: text,
                type: 'file',
                parentId: null,
                lastModified: file.lastModified,
                path: realPath // Store the real path
            };
            setFiles(prev => [...prev, newFile]);
            setActiveFileId(newFile.id);
        }
      };
      reader.readAsText(file);
    });
    event.target.value = '';
  };

  const handleCreateFile = () => {
    const newFile: FileDoc = {
        id: Math.random().toString(36).substr(2, 9),
        name: `Untitled-${files.filter(f => f.type === 'file').length + 1}.md`,
        content: '# New Document\n\nStart typing...',
        type: 'file',
        parentId: null, // Create in root by default
        lastModified: Date.now()
    };
    setFiles(prev => [...prev, newFile]);
    setActiveFileId(newFile.id);
    setIsEditing(true); 
  };

  const handleCreateFolder = () => {
    const newFolder: FileDoc = {
      id: Math.random().toString(36).substr(2, 9),
      name: `New Folder`,
      content: '',
      type: 'folder',
      parentId: null,
      lastModified: Date.now(),
      isExpanded: true
    };
    setFiles(prev => [...prev, newFolder]);
  };

  const handleRenameFile = (id: string, newName: string) => {
      let finalName = newName.trim();
      if (!finalName) return;
      
      const file = files.find(f => f.id === id);
      if (file?.type === 'file') {
        if (!finalName.toLowerCase().endsWith('.md') && !finalName.toLowerCase().endsWith('.txt')) {
            finalName += '.md';
        }
      }

      setFiles(prev => prev.map(f => f.id === id ? { ...f, name: finalName } : f));
  };

  const handleContentChange = (newContent: string) => {
    if (!activeFileId) return;
    setFiles(prev => prev.map(f => 
      f.id === activeFileId ? { ...f, content: newContent, lastModified: Date.now() } : f
    ));
  };

  const handleSaveToDisk = () => {
    if (!activeFile) return;
    // Standard web save
    const blob = new Blob([activeFile.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleMoveFile = (fileId: string, targetFolderId: string | null) => {
    if (fileId === targetFolderId) return;

    // Cycle detection: Prevent moving a folder into itself or its children
    let currentId = targetFolderId;
    while (currentId) {
        if (currentId === fileId) return; // Cycle detected
        const parent = files.find(f => f.id === currentId)?.parentId;
        currentId = parent || null;
    }

    setFiles(prev => prev.map(f => {
        if (f.id === fileId) {
            return { ...f, parentId: targetFolderId };
        }
        // Auto-expand target folder
        if (targetFolderId && f.id === targetFolderId) {
            return { ...f, isExpanded: true };
        }
        return f;
    }));
  };

  const handleToggleFolder = (folderId: string) => {
    setFiles(prev => prev.map(f => 
        f.id === folderId ? { ...f, isExpanded: !f.isExpanded } : f
    ));
  };

  const handleLocateFile = (file: FileDoc) => {
    if (file.path) {
        try {
            // @ts-ignore
            if (window.require) {
                // @ts-ignore
                const { ipcRenderer } = window.require('electron');
                ipcRenderer.send('show-in-folder', file.path);
            }
        } catch (e) {
            alert(`File path is: ${file.path}`);
        }
    } else {
        alert("This file is stored in browser memory and not linked to a physical file yet.");
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-black text-white overflow-hidden border border-[#333] shadow-2xl rounded-none sm:rounded-lg sm:my-4 sm:mx-4 sm:h-[calc(100vh-2rem)] sm:w-[calc(100vw-2rem)]">
      <TitleBar 
        title={activeFile ? `${activeFile.name} - WinMD Explorer` : 'WinMD Explorer'} 
        onHelp={() => setIsHelpOpen(true)}
      />
      
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar 
          files={files} 
          activeFileId={activeFileId} 
          onSelectFile={setActiveFileId}
          onFileUpload={handleFileUpload}
          onCreateFile={handleCreateFile}
          onCreateFolder={handleCreateFolder}
          onRenameFile={handleRenameFile}
          onMoveFile={handleMoveFile}
          onToggleFolder={handleToggleFolder}
          onLocateFile={handleLocateFile}
        />
        
        <main className="flex-1 flex flex-col relative min-w-0 bg-[#272727]">
           {/* Toolbar for Main View */}
           {activeFile && (
             <div className="h-10 border-b border-[#333] bg-[#202020] flex items-center justify-between px-4">
                <div className="flex items-center text-xs text-gray-400 space-x-3">
                    <button 
                      onClick={() => setIsEditing(!isEditing)}
                      className={`flex items-center space-x-1.5 px-2 py-1 rounded-md transition-colors ${isEditing ? 'bg-[#333] text-white' : 'hover:bg-[#333] text-gray-400'}`}
                      title={isEditing ? "Switch to Preview" : "Switch to Edit Mode"}
                    >
                      {isEditing ? <Eye size={14} /> : <PenTool size={14} />}
                      <span>{isEditing ? 'Preview' : 'Edit'}</span>
                    </button>
                    
                    <div className="h-3 w-[1px] bg-[#333]"></div>

                    <button 
                      onClick={handleSaveToDisk}
                      className="flex items-center space-x-1.5 px-2 py-1 rounded-md transition-colors hover:bg-[#333] text-gray-400 hover:text-white"
                      title="Download to computer"
                    >
                      <Save size={14} />
                      <span>Save</span>
                    </button>

                    {activeFile.path && (
                        <>
                            <div className="h-3 w-[1px] bg-[#333]"></div>
                            <button
                                onClick={() => handleLocateFile(activeFile)}
                                className="flex items-center space-x-1.5 px-2 py-1 rounded-md transition-colors hover:bg-[#333] text-gray-400 hover:text-white"
                                title={activeFile.path}
                            >
                                <MapPin size={14} />
                                <span>Locate</span>
                            </button>
                        </>
                    )}

                    <div className="h-3 w-[1px] bg-[#333]"></div>
                    <span className="hidden sm:inline-block">{new Date(activeFile.lastModified).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center space-x-2">
                    <button 
                        onClick={() => setIsAiOpen(!isAiOpen)}
                        className={`p-1.5 rounded-md transition-colors flex items-center space-x-1.5 text-xs font-medium ${isAiOpen ? 'bg-[#0078d4] text-white' : 'hover:bg-[#333] text-gray-300'}`}
                    >
                        <Sparkles size={14} />
                        <span>AI Assistant</span>
                    </button>
                    <button className="p-1.5 hover:bg-[#333] rounded-md text-gray-300">
                        <Layout size={14} />
                    </button>
                </div>
             </div>
           )}

           <div className="flex-1 relative overflow-hidden">
             {isEditing && activeFile ? (
               <MarkdownEditor content={activeFile.content} onChange={handleContentChange} />
             ) : (
               <MarkdownViewer content={activeFile?.content || ''} />
             )}
             
             {activeFile && (
                <AIAssistant 
                    key={activeFile.id}
                    isOpen={isAiOpen} 
                    onClose={() => setIsAiOpen(false)} 
                    markdownContent={activeFile.content}
                    fileName={activeFile.name}
                />
             )}
           </div>
        </main>
      </div>

      <HelpDialog isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
};

export default App;