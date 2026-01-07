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
import { FileDoc, ChatMessage, Language } from './types';
import { translations } from './translations';
import { Sparkles, Layout, PenTool, Eye, Save, MapPin, PanelLeftClose, PanelLeft } from 'lucide-react';

// Robust Electron IPC Helper
const getIpcRenderer = () => {
  try {
    // @ts-ignore
    if (typeof window !== 'undefined' && window.require) {
      // @ts-ignore
      const electron = window.require('electron');
      return electron.ipcRenderer;
    }
  } catch (e) {
    console.warn("Electron require failed", e);
  }
  return null;
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
  const [language, setLanguage] = useState<Language>('en');
  
  // Hidden input for browser fallback
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeFile = files.find(f => f.id === activeFileId);
  const t = translations[language]; // Current translation object

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

  // Load Settings from local storage
  useEffect(() => {
    const savedKey = localStorage.getItem('winmd_apikey');
    if (savedKey) {
        setApiKey(savedKey);
    }
    const savedLang = localStorage.getItem('winmd_language') as Language;
    if (savedLang && (savedLang === 'en' || savedLang === 'zh')) {
        setLanguage(savedLang);
    }
  }, []);

  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('winmd_apikey', key);
  };

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('winmd_language', lang);
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

WinMD is a **Windows 11 inspired** Markdown explorer and editor powered by Gemini AI.

## Features at a Glance 🚀
- **Tabbed Interface**: Work on multiple files simultaneously.
- **Split View**: Edit and preview in real-time with synchronized scrolling.
- **Gemini AI**: Click the **AI** button to chat with your documents, summarize text, or ask questions.
- **Native File System**: Open, edit, and save files directly to your computer.

---

## Rich Content Support

### 1. Code Highlighting
WinMD uses Monaco Editor (VS Code) for editing and Prism for highlighting.

\`\`\`typescript
const greeting = "Hello, WinMD!";
console.log(greeting);
\`\`\`

### 2. Mathematical Equations
Native support for KaTeX.

**Inline:** $E = mc^2$

**Block:**
$$
\\frac{1}{\\sigma\\sqrt{2\\pi}}\\exp\\left(-\\frac{(x-\\mu)^2}{2\\sigma^2}\\right)
$$

### 3. Mermaid Diagrams
Visualize charts and graphs directly in your markdown.

\`\`\`mermaid
graph TD
    A[Start] --> B{Is it working?}
    B -- Yes --> C[Great!]
    B -- No --> D[Debug]
    D --> B
\`\`\`

### 4. GFM Tables & Tasks
| Feature | Status |
| :--- | :--- |
| **Tables** | ✅ Supported |
| **Task Lists** | ✅ Supported |
| **Strikethrough** | ✅ Supported |

- [x] Install WinMD
- [x] Try Split View
- [ ] Star the repo

---

## Getting Started
1. **Open a File**: Click "Open" in the sidebar to browse your disk.
2. **Create a Folder**: Organize your project structure.
3. **Settings**: Click the gear icon to configure your **Gemini API Key**.
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
        if (newOpenIds.length > 0) {
            setActiveFileId(newOpenIds[newOpenIds.length - 1]);
        } else {
            setActiveFileId(null);
        }
    }
  };

  // --- Native & Browser File Operations ---

  const loadFileFromIpc = async (filePath: string) => {
    const ipc = getIpcRenderer();
    if (!ipc) return;

    // Check if already open
    const existingFile = files.find(f => f.path === filePath);
    if (existingFile) {
        handleFileActivate(existingFile.id);
        return;
    }

    try {
        const { content, lastModified } = await ipc.invoke('read-file', filePath);
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
    } catch (error) {
        console.error("Failed to read file from IPC", error);
    }
  };

  const handleOpenFile = async () => {
      const ipc = getIpcRenderer();
      let ipcSuccess = false;

      if (ipc) {
          try {
              const filePaths: string[] = await ipc.invoke('open-file-dialog');
              if (filePaths && filePaths.length > 0) {
                  for (const filePath of filePaths) {
                      await loadFileFromIpc(filePath);
                  }
              }
              // Even if user cancels dialog, we consider IPC call successful in initiating
              ipcSuccess = true;
          } catch (e) {
              console.error("Electron open dialog failed", e);
              ipcSuccess = false;
          }
      }

      // Fallback: Trigger hidden browser file input if IPC is not available or failed
      if (!ipcSuccess && fileInputRef.current) {
          fileInputRef.current.click();
      }
  };

  const handleBrowserFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        for (let i = 0; i < e.target.files.length; i++) {
            const file = e.target.files[i];
            const text = await file.text();
            
            // Basic deduplication by name for browser files
            const existing = files.find(f => f.name === file.name && !f.path);
            if (existing) {
                handleFileActivate(existing.id);
                continue;
            }

            const newFile: FileDoc = {
                id: Math.random().toString(36).substr(2, 9),
                name: file.name,
                content: text,
                type: 'file',
                parentId: null,
                lastModified: file.lastModified,
                chatHistory: []
            };
            setFiles(prev => [...prev, newFile]);
            handleFileActivate(newFile.id);
        }
    }
    // Reset value
    e.target.value = ''; 
  };

  const saveFileToDisk = async (file: FileDoc) => {
      const ipc = getIpcRenderer();

      // Electron Save
      if (ipc) {
          try {
              let savePath = file.path;

              // If no path, ask for location (Save As)
              if (!savePath) {
                  const resultPath: string = await ipc.invoke('save-file-dialog', file.name);
                  if (!resultPath) return; // User cancelled
                  savePath = resultPath;
              }

              // Write file
              await ipc.invoke('write-file', savePath, file.content);

              // Update file state with new path and name
              const newName = savePath.replace(/^.*[\\/]/, '');
              setFiles(prev => prev.map(f => 
                  f.id === file.id ? { ...f, path: savePath, name: newName, lastModified: Date.now() } : f
              ));
              return;

          } catch (e) {
              console.error("Failed to save file via IPC", e);
              // Fallthrough to browser download
          }
      }

      // Fallback: Browser Download
      const blob = new Blob([file.content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
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

  // --- End File Operations ---

  const handleCreateFile = () => {
    const newFile: FileDoc = {
        id: Math.random().toString(36).substr(2, 9),
        name: `${t.common.untitled}-${files.filter(f => f.type === 'file').length + 1}.md`,
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
      name: `${t.common.untitled} Folder`,
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
            const ipc = getIpcRenderer();
            if (ipc) {
                ipc.send('show-in-folder', file.path);
            } else {
                 alert(`File path is: ${file.path}`);
            }
        } catch (e) {
            alert(`File path is: ${file.path}`);
        }
    } else {
        alert(t.sidebar.fileIsInMemory);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-black text-white overflow-hidden border border-[#333] shadow-2xl rounded-none sm:rounded-lg sm:my-4 sm:mx-4 sm:h-[calc(100vh-2rem)] sm:w-[calc(100vw-2rem)]">
      
      {/* Fallback File Input */}
      <input 
          type="file" 
          multiple 
          accept=".md,.txt,.markdown" 
          className="hidden" 
          ref={fileInputRef}
          onChange={handleBrowserFileSelect}
      />

      <TitleBar 
        onHelp={() => setIsHelpOpen(true)}
        language={language}
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
                language={language}
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
                      title={isEditing ? t.common.preview : t.common.edit}
                    >
                      {isEditing ? <Eye size={14} /> : <PenTool size={14} />}
                      <span>{isEditing ? t.common.preview : t.common.edit}</span>
                    </button>
                    
                    <div className="h-3 w-[1px] bg-[#333]"></div>

                    <button 
                      onClick={() => saveFileToDisk(activeFile)}
                      className="flex items-center space-x-1.5 px-2 py-1 rounded-md transition-colors hover:bg-[#333] text-gray-400 hover:text-white"
                      title={activeFile.path ? `${t.common.save} (Ctrl+S)` : t.common.download}
                    >
                      <Save size={14} />
                      <span>{activeFile.path ? t.common.save : t.common.download}</span>
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
                                <span className="hidden xl:inline">{t.common.locate}</span>
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
                            language={language}
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
                        <MarkdownViewer 
                          content={activeFile?.content || ''} 
                          language={language}
                        />
                    )
                ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-500 flex-col space-y-4 select-none">
                        <div className="text-4xl">👋</div>
                        <p>{t.viewer.selectFile}</p>
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
                    language={language}
                />
             )}
           </div>
        </main>
      </div>

      <HelpDialog 
        isOpen={isHelpOpen} 
        onClose={() => setIsHelpOpen(false)} 
        language={language}
      />
      
      <SettingsDialog 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        apiKey={apiKey}
        onSaveApiKey={handleSaveApiKey}
        language={language}
        onLanguageChange={handleLanguageChange}
      />
    </div>
  );
};

export default App;
