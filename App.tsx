import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { TabBar } from './components/TabBar';
import { Breadcrumbs } from './components/Breadcrumbs';
import { MarkdownViewer } from './components/MarkdownViewer';
import { MarkdownEditor } from './components/MarkdownEditor';
import { AIAssistant } from './components/AIAssistant';
import { HelpDialog } from './components/HelpDialog';
import { SettingsDialog } from './components/SettingsDialog';
import { FileDoc, ChatMessage } from './types';
import { Sparkles, Layout, PenTool, Eye, Save, MapPin, PanelLeftClose, PanelLeft } from 'lucide-react';

// Electron IPC Helper
const electron = {
    get ipcRenderer() {
        // @ts-ignore
        return window.require ? window.require('electron').ipcRenderer : null;
    }
};

const App: React.FC = () => {
  const [files, setFiles] = useState<FileDoc[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [openFileIds, setOpenFileIds] = useState<string[]>([]); // Track open tabs
  
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSplitView, setIsSplitView] = useState(false);
  const [apiKey, setApiKey] = useState('');

  const activeFile = files.find(f => f.id === activeFileId);

  // --- Sync Scrolling Refs ---
  const editorInstanceRef = useRef<any>(null); // Monaco instance
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef<'editor' | 'viewer' | null>(null);
  const scrollTimeoutRef = useRef<any>(null);

  // Helper to release the scroll lock after a short delay
  const clearScrollLock = () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
          isScrollingRef.current = null;
      }, 100);
  };

  // Editor -> Viewer
  const handleEditorScroll = (scrollTop: number, scrollHeight: number, clientHeight: number) => {
    if (isScrollingRef.current === 'viewer') return;
    
    isScrollingRef.current = 'editor';
    if (viewerContainerRef.current) {
        // Calculate percentage
        const maxEditorScroll = scrollHeight - clientHeight;
        const percentage = maxEditorScroll > 0 ? scrollTop / maxEditorScroll : 0;
        
        const viewerNode = viewerContainerRef.current;
        const maxViewerScroll = viewerNode.scrollHeight - viewerNode.clientHeight;
        
        viewerNode.scrollTop = percentage * maxViewerScroll;
    }
    clearScrollLock();
  };

  // Viewer -> Editor
  const handleViewerScroll = (e: React.UIEvent<HTMLDivElement>) => {
      if (isScrollingRef.current === 'editor') return;
      
      isScrollingRef.current = 'viewer';
      const target = e.currentTarget;
      const percentage = target.scrollTop / (target.scrollHeight - target.clientHeight);

      if (editorInstanceRef.current) {
          const editor = editorInstanceRef.current;
          const maxEditorScroll = editor.getScrollHeight() - editor.getLayoutInfo().height;
          editor.setScrollTop(percentage * maxEditorScroll);
      }
      clearScrollLock();
  };
  // --- End Sync Scrolling ---

  // Reset edit mode when switching files, but keep split view state if desired
  useEffect(() => {
    editorInstanceRef.current = null; // Reset editor ref
  }, [activeFileId]);

  // Load API Key from local storage
  useEffect(() => {
    const savedKey = localStorage.getItem('winmd_apikey');
    if (savedKey) {
        setApiKey(savedKey);
    }
  }, []);

  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('winmd_apikey', key);
  };

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
            isExpanded: f.isExpanded !== undefined ? f.isExpanded : false,
            chatHistory: f.chatHistory || []
          }));
          setFiles(migratedFiles);
          
          // Restore open tabs if possible, or just open the last active one
          // For simplicity in this version, we start with no tabs open unless we want to persist that too.
          // Let's persist a simple welcome or nothing.
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
- **Tabs Support**: Multitask like a pro.
- **Professional Editor**: Integrated Monaco Editor (VS Code core).
- **Sync Scrolling**: Editor and preview scroll together.
- **Native File System**: Open and Save files directly to your hard drive.

## Storage Note 💾
- **Auto-Save**: Files are saved to local storage automatically.
- **HDD Link**: If you open a file from disk, WinMD remembers the path.

## How to use
1. Use the "Open" button in the sidebar.
2. Click "Folder" to create a new folder.
3. Drag items to organize.
      `,
      chatHistory: []
    };
    setFiles([welcomeFile]);
    setOpenFileIds(['welcome']);
    setActiveFileId('welcome');
  }, []);

  // Save to LocalStorage whenever files change
  useEffect(() => {
    if (files.length > 0) {
      localStorage.setItem('winmd_files', JSON.stringify(files));
    }
  }, [files]);

  // --- Tab Management ---

  const handleFileActivate = (id: string) => {
    if (!openFileIds.includes(id)) {
        setOpenFileIds(prev => [...prev, id]);
    }
    setActiveFileId(id);
  };

  const handleCloseTab = (id: string) => {
    const newOpenIds = openFileIds.filter(fid => fid !== id);
    setOpenFileIds(newOpenIds);
    
    if (activeFileId === id) {
        // Switch to the previous tab or null
        if (newOpenIds.length > 0) {
            setActiveFileId(newOpenIds[newOpenIds.length - 1]);
        } else {
            setActiveFileId(null);
        }
    }
  };

  // --- Native File Operations ---

  const handleOpenFile = async () => {
      if (!electron.ipcRenderer) {
          alert("This feature is only available in the desktop app.");
          return;
      }

      try {
          const filePaths: string[] = await electron.ipcRenderer.invoke('open-file-dialog');
          
          if (!filePaths || filePaths.length === 0) return;

          for (const filePath of filePaths) {
              // Check if already open
              const existingFile = files.find(f => f.path === filePath);
              if (existingFile) {
                  handleFileActivate(existingFile.id);
                  continue;
              }

              // Read file content
              const { content, lastModified } = await electron.ipcRenderer.invoke('read-file', filePath);
              
              // Extract name from path (cross-platform way)
              const name = filePath.replace(/^.*[\\/]/, '');

              const newFile: FileDoc = {
                  id: Math.random().toString(36).substr(2, 9),
                  name: name,
                  content: content,
                  type: 'file',
                  parentId: null,
                  lastModified: lastModified,
                  path: filePath,
                  chatHistory: []
              };

              setFiles(prev => [...prev, newFile]);
              handleFileActivate(newFile.id);
          }
      } catch (e) {
          console.error("Failed to open file", e);
          alert("Error opening file");
      }
  };

  const saveFileToDisk = async (file: FileDoc) => {
      if (!electron.ipcRenderer) {
          // Fallback to blob download for browser mode
          const blob = new Blob([file.content], { type: 'text/markdown' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = file.name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          return;
      }

      try {
          let savePath = file.path;

          // If no path, ask for location (Save As)
          if (!savePath) {
              const resultPath: string = await electron.ipcRenderer.invoke('save-file-dialog', file.name);
              if (!resultPath) return; // User cancelled
              savePath = resultPath;
          }

          // Write file
          await electron.ipcRenderer.invoke('write-file', savePath, file.content);

          // Update file state with new path and name
          const newName = savePath.replace(/^.*[\\/]/, '');
          setFiles(prev => prev.map(f => 
              f.id === file.id ? { ...f, path: savePath, name: newName, lastModified: Date.now() } : f
          ));

      } catch (e) {
          console.error("Failed to save file", e);
          alert("Error saving file");
      }
  };

  // Keyboard Shortcuts (Ctrl+S)
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 's') {
              e.preventDefault(); // Prevent browser save dialog
              if (activeFileId) {
                  const currentFile = files.find(f => f.id === activeFileId);
                  if (currentFile) {
                      saveFileToDisk(currentFile);
                  }
              }
          }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFileId, files]);

  // --- End Native File Operations ---

  const handleCreateFile = () => {
    const newFile: FileDoc = {
        id: Math.random().toString(36).substr(2, 9),
        name: `Untitled-${files.filter(f => f.type === 'file').length + 1}.md`,
        content: '# New Document\n\nStart typing...',
        type: 'file',
        parentId: null, // Create in root by default
        lastModified: Date.now(),
        chatHistory: []
    };
    setFiles(prev => [...prev, newFile]);
    handleFileActivate(newFile.id);
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

  const handleUpdateChatHistory = (fileId: string, history: ChatMessage[]) => {
    setFiles(prev => prev.map(f =>
      f.id === fileId ? { ...f, chatHistory: history } : f
    ));
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
            if (electron.ipcRenderer) {
                electron.ipcRenderer.send('show-in-folder', file.path);
            }
        } catch (e) {
            alert(`File path is: ${file.path}`);
        }
    } else {
        alert("This file is stored in browser memory and not linked to a physical file yet. Save it first.");
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-black text-white overflow-hidden border border-[#333] shadow-2xl rounded-none sm:rounded-lg sm:my-4 sm:mx-4 sm:h-[calc(100vh-2rem)] sm:w-[calc(100vw-2rem)]">
      <TitleBar 
        onHelp={() => setIsHelpOpen(true)}
      />
      
      <div className="flex flex-1 overflow-hidden relative">
        {isSidebarOpen && (
            <Sidebar 
                files={files} 
                activeFileId={activeFileId} 
                onSelectFile={handleFileActivate}
                onOpenFile={handleOpenFile}
                onCreateFile={handleCreateFile}
                onCreateFolder={handleCreateFolder}
                onRenameFile={handleRenameFile}
                onMoveFile={handleMoveFile}
                onToggleFolder={handleToggleFolder}
                onLocateFile={handleLocateFile}
                onOpenSettings={() => setIsSettingsOpen(true)}
            />
        )}
        
        <main className="flex-1 flex flex-col relative min-w-0 bg-[#272727]">
           {/* Tab Bar */}
           <div className="flex items-center bg-[#181818]">
                {!isSidebarOpen && (
                    <button 
                        onClick={() => setIsSidebarOpen(true)}
                        className="h-full px-3 text-gray-500 hover:text-white"
                        title="Show Sidebar"
                    >
                        <PanelLeft size={16} />
                    </button>
                )}
                <div className="flex-1 overflow-hidden">
                    <TabBar 
                        files={files}
                        openFileIds={openFileIds}
                        activeFileId={activeFileId}
                        onSelectFile={setActiveFileId}
                        onCloseFile={handleCloseTab}
                    />
                </div>
           </div>

           {/* Toolbar / Breadcrumbs */}
           {activeFile ? (
             <div className="h-9 border-b border-[#333] bg-[#202020] flex items-center justify-between px-3">
                <div className="flex items-center space-x-2">
                    {isSidebarOpen && (
                        <button 
                            onClick={() => setIsSidebarOpen(false)} 
                            className="mr-1 text-gray-500 hover:text-white"
                            title="Hide Sidebar"
                        >
                            <PanelLeftClose size={14} />
                        </button>
                    )}
                    <Breadcrumbs file={activeFile} allFiles={files} />
                </div>

                <div className="flex items-center text-xs text-gray-400 space-x-2">
                    <button 
                      onClick={() => {
                        setIsEditing(!isEditing);
                        if (isSplitView) setIsSplitView(false);
                      }}
                      className={`flex items-center space-x-1.5 px-2 py-1 rounded-md transition-colors ${isEditing && !isSplitView ? 'bg-[#333] text-white' : 'hover:bg-[#333] text-gray-400'}`}
                      title={isEditing ? "Switch to Preview" : "Switch to Edit Mode"}
                    >
                      {isEditing ? <Eye size={14} /> : <PenTool size={14} />}
                      <span>{isEditing ? 'Preview' : 'Edit'}</span>
                    </button>
                    
                    <div className="h-3 w-[1px] bg-[#333]"></div>

                    <button 
                      onClick={() => saveFileToDisk(activeFile)}
                      className="flex items-center space-x-1.5 px-2 py-1 rounded-md transition-colors hover:bg-[#333] text-gray-400 hover:text-white"
                      title={activeFile.path ? "Save (Ctrl+S)" : "Save As..."}
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
                                <span className="hidden xl:inline">Locate</span>
                            </button>
                        </>
                    )}

                    <div className="h-3 w-[1px] bg-[#333]"></div>
                    
                    <button 
                        onClick={() => setIsSplitView(!isSplitView)}
                        className={`p-1.5 rounded-md transition-colors ${isSplitView ? 'bg-[#333] text-white' : 'hover:bg-[#333] text-gray-300'}`}
                        title="Toggle Split View"
                    >
                        <Layout size={14} />
                    </button>

                    <button 
                        onClick={() => setIsAiOpen(!isAiOpen)}
                        className={`p-1.5 rounded-md transition-colors flex items-center space-x-1.5 text-xs font-medium ${isAiOpen ? 'bg-[#0078d4] text-white' : 'hover:bg-[#333] text-gray-300'}`}
                        title="AI Assistant"
                    >
                        <Sparkles size={14} />
                        <span className="hidden lg:inline">AI</span>
                    </button>
                </div>
             </div>
           ) : (
                <div className="h-9 border-b border-[#333] bg-[#202020]"></div>
           )}

           <div className="flex-1 relative overflow-hidden flex bg-[#1e1e1e]">
             {isSplitView && activeFile ? (
                <>
                    <div className="w-1/2 h-full border-r border-[#333] bg-[#1e1e1e]">
                        <MarkdownEditor 
                            content={activeFile.content} 
                            onChange={handleContentChange}
                            onScroll={handleEditorScroll}
                            editorRefProp={editorInstanceRef}
                        />
                    </div>
                    <div className="w-1/2 h-full bg-[#272727]">
                        <MarkdownViewer 
                            content={activeFile.content} 
                            ref={viewerContainerRef}
                            onScroll={handleViewerScroll}
                        />
                    </div>
                </>
             ) : (
                activeFile ? (
                    isEditing ? (
                        <MarkdownEditor 
                                content={activeFile.content} 
                                onChange={handleContentChange}
                                onScroll={handleEditorScroll} // Even in single view, we update ref for switching
                                editorRefProp={editorInstanceRef}
                        />
                    ) : (
                        <MarkdownViewer content={activeFile?.content || ''} />
                    )
                ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-500 flex-col space-y-4">
                        <div className="text-4xl">👋</div>
                        <p>Select a file to start editing</p>
                    </div>
                )
             )}
             
             {activeFile && (
                <AIAssistant 
                    key={activeFile.id}
                    isOpen={isAiOpen} 
                    onClose={() => setIsAiOpen(false)} 
                    markdownContent={activeFile.content}
                    fileName={activeFile.name}
                    chatHistory={activeFile.chatHistory || []}
                    onUpdateChatHistory={(history) => handleUpdateChatHistory(activeFile.id, history)}
                    apiKey={apiKey}
                />
             )}
           </div>
        </main>
      </div>

      <HelpDialog isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      
      <SettingsDialog 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        apiKey={apiKey}
        onSaveApiKey={handleSaveApiKey}
      />
    </div>
  );
};

export default App;