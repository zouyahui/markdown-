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
import { FileDoc, ChatMessage, Language, AIProvider, DEFAULT_LOCAL_CONFIG, MCPServerConfig } from './types';
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
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]); // Multi-select state
  const [lastFocusedId, setLastFocusedId] = useState<string | null>(null); // Anchor for Shift selection
  const [searchQuery, setSearchQuery] = useState(''); // Lifted from Sidebar
  
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSplitView, setIsSplitView] = useState(false);

  // Resize State
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [aiWidth, setAiWidth] = useState(320);
  const isResizingSidebar = useRef(false);
  const isResizingAi = useRef(false);
  // Store start X to calculate delta if needed, but absolute tracking is fine
  const startX = useRef(0);
  const startWidth = useRef(0);
  
  // Settings State
  const [apiKey, setApiKey] = useState('');
  const [language, setLanguage] = useState<Language>('en');
  const [aiProvider, setAiProvider] = useState<AIProvider>('gemini');
  const [localBaseUrl, setLocalBaseUrl] = useState(DEFAULT_LOCAL_CONFIG.baseUrl);
  const [localModelName, setLocalModelName] = useState(DEFAULT_LOCAL_CONFIG.model);
  const [localApiKey, setLocalApiKey] = useState(''); // New state
  const [mcpServers, setMcpServers] = useState<MCPServerConfig[]>([]);
  
  // Hidden input for browser fallback
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeFile = files.find(f => f.id === activeFileId);
  const t = translations[language]; // Current translation object

  // --- Resize Logic ---
  const handleSidebarResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingSidebar.current = true;
    document.body.style.cursor = 'col-resize';
  };

  const handleAiResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingAi.current = true;
    // Capture initial width and mouse position to calculate delta
    startX.current = e.clientX;
    startWidth.current = aiWidth;
    document.body.style.cursor = 'col-resize';
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
        if (isResizingSidebar.current) {
            // Sidebar is left aligned, width is simply mouse X
            // Add constraints: Min 150px, Max 50% of window
            const newWidth = Math.max(150, Math.min(window.innerWidth * 0.5, e.clientX));
            setSidebarWidth(newWidth);
        }
        if (isResizingAi.current) {
            // AI is right aligned (absolute) inside a relative container
            // Dragging LEFT increases width
            const deltaX = startX.current - e.clientX;
            const newWidth = Math.max(250, Math.min(window.innerWidth * 0.6, startWidth.current + deltaX));
            setAiWidth(newWidth);
        }
    };

    const handleMouseUp = () => {
        if (isResizingSidebar.current || isResizingAi.current) {
            isResizingSidebar.current = false;
            isResizingAi.current = false;
            document.body.style.cursor = 'default';
        }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []); // Dependencies are refs, safe to be empty

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
    if (savedKey) setApiKey(savedKey);

    const savedLang = localStorage.getItem('winmd_language') as Language;
    if (savedLang && (savedLang === 'en' || savedLang === 'zh')) setLanguage(savedLang);

    const savedProvider = localStorage.getItem('winmd_ai_provider') as AIProvider;
    if (savedProvider && (savedProvider === 'gemini' || savedProvider === 'local')) setAiProvider(savedProvider);

    const savedBaseUrl = localStorage.getItem('winmd_local_base_url');
    if (savedBaseUrl) setLocalBaseUrl(savedBaseUrl);

    const savedModelName = localStorage.getItem('winmd_local_model_name');
    if (savedModelName) setLocalModelName(savedModelName);

    const savedLocalKey = localStorage.getItem('winmd_local_api_key');
    if (savedLocalKey) setLocalApiKey(savedLocalKey);

    const savedMcpServers = localStorage.getItem('winmd_mcp_servers');
    if (savedMcpServers) {
        try {
            setMcpServers(JSON.parse(savedMcpServers));
        } catch (e) {
            console.error("Failed to parse MCP servers", e);
        }
    }
  }, []);

  // --- MCP Backend Connection Logic ---
  useEffect(() => {
    const connectToMcp = async () => {
        const ipc = getIpcRenderer();
        if (ipc && mcpServers.length > 0) {
            try {
                console.log("Connecting to MCP servers...", mcpServers);
                const results = await ipc.invoke('mcp-connect', mcpServers);
                console.log("MCP Connect Results:", results);
            } catch (e) {
                console.error("Failed to connect to MCP servers via IPC", e);
            }
        }
    };
    
    // Debounce slightly or just run when mcpServers changes
    if (mcpServers.length > 0) {
        const timeout = setTimeout(connectToMcp, 1000); // 1s delay to allow typing to finish if user is editing
        return () => clearTimeout(timeout);
    }
  }, [mcpServers]);


  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('winmd_apikey', key);
  };

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('winmd_language', lang);
  };

  const handleAiProviderChange = (provider: AIProvider) => {
    setAiProvider(provider);
    localStorage.setItem('winmd_ai_provider', provider);
  };

  const handleLocalBaseUrlChange = (url: string) => {
    setLocalBaseUrl(url);
    localStorage.setItem('winmd_local_base_url', url);
  };

  const handleLocalModelNameChange = (name: string) => {
    setLocalModelName(name);
    localStorage.setItem('winmd_local_model_name', name);
  };

  const handleLocalApiKeyChange = (key: string) => {
    setLocalApiKey(key);
    localStorage.setItem('winmd_local_api_key', key);
  };

  const handleMcpServersChange = (servers: MCPServerConfig[]) => {
      setMcpServers(servers);
      localStorage.setItem('winmd_mcp_servers', JSON.stringify(servers));
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
            chatHistory: f.chatHistory || [],
            isUnsaved: f.isUnsaved || false
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
      chatHistory: [],
      isUnsaved: false
    };
    setFiles([welcomeFile]);
    setOpenFileIds(['welcome']);
    setActiveFileId('welcome');
    setSelectedFileIds(['welcome']);
    setLastFocusedId('welcome');
  }, []);

  // Save to LocalStorage whenever files change
  useEffect(() => {
    if (files.length > 0) {
      localStorage.setItem('winmd_files', JSON.stringify(files));
    }
  }, [files]);

  // --- Logic to ensure tree visibility ---
  const ensureVisible = (targetId: string) => {
    setFiles(prevFiles => {
        const newFiles = [...prevFiles];
        let changed = false;
        // Optimization: Create map for fast lookup
        const fileMap = new Map(newFiles.map(f => [f.id, f]));
        
        let current = fileMap.get(targetId);
        
        // Traverse up the tree
        while (current && current.parentId) {
            const parent = fileMap.get(current.parentId);
            if (parent) {
                if (!parent.isExpanded) {
                    // Update parent expansion
                    const parentIndex = newFiles.findIndex(f => f.id === parent.id);
                    if (parentIndex !== -1) {
                        newFiles[parentIndex] = { ...newFiles[parentIndex], isExpanded: true };
                        changed = true;
                    }
                }
                current = parent;
            } else {
                break;
            }
        }
        return changed ? newFiles : prevFiles;
    });
  };

  // --- Tab Management ---

  const handleFileActivate = (id: string) => {
    if (!openFileIds.includes(id)) {
        setOpenFileIds(prev => [...prev, id]);
    }
    setActiveFileId(id);
    setSelectedFileIds([id]); // Sync selection
    setLastFocusedId(id);
    ensureVisible(id);
  };

  const handleCloseTab = (id: string) => {
    const newOpenIds = openFileIds.filter(fid => fid !== id);
    setOpenFileIds(newOpenIds);
    
    if (activeFileId === id) {
        if (newOpenIds.length > 0) {
            const nextId = newOpenIds[newOpenIds.length - 1];
            setActiveFileId(nextId);
            setSelectedFileIds([nextId]);
            setLastFocusedId(nextId);
            ensureVisible(nextId);
        } else {
            setActiveFileId(null);
            setSelectedFileIds([]);
            setLastFocusedId(null);
        }
    } else {
        if (selectedFileIds.includes(id)) {
            setSelectedFileIds(prev => prev.filter(sid => sid !== id));
        }
    }
  };

  const handleTabClick = (id: string, modifiers: { ctrl: boolean, shift: boolean }) => {
    const { ctrl, shift } = modifiers;

    setActiveFileId(id);
    ensureVisible(id);
    
    let newSelection: string[] = [];
    
    if (shift && lastFocusedId && openFileIds.includes(lastFocusedId)) {
        const startIdx = openFileIds.indexOf(lastFocusedId);
        const endIdx = openFileIds.indexOf(id);
        
        if (startIdx !== -1 && endIdx !== -1) {
             const min = Math.min(startIdx, endIdx);
             const max = Math.max(startIdx, endIdx);
             const range = openFileIds.slice(min, max + 1);
             
             if (ctrl) {
                 newSelection = Array.from(new Set([...selectedFileIds, ...range]));
             } else {
                 newSelection = range;
             }
        } else {
             newSelection = [id];
        }
    } else if (ctrl) {
        newSelection = Array.from(new Set([...selectedFileIds, id]));
    } else {
        newSelection = [id];
    }
    
    setSelectedFileIds(newSelection);
    setLastFocusedId(id);
  };

  // --- Sidebar Selection & Multi-select ---
  
  const getVisibleFileIds = useCallback(() => {
    if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return files
            .filter(f => f.name.toLowerCase().includes(query))
            .map(f => f.id);
    }

    const visibleIds: string[] = [];
    const traverse = (parentId: string | null) => {
        const children = files
            .filter(f => f.parentId === parentId)
            .sort((a, b) => {
                if (a.type === b.type) return a.name.localeCompare(b.name);
                return a.type === 'folder' ? -1 : 1;
            });
        
        for (const child of children) {
            visibleIds.push(child.id);
            if (child.type === 'folder' && child.isExpanded) {
                traverse(child.id);
            }
        }
    };
    traverse(null);
    return visibleIds;
  }, [files, searchQuery]);

  const handleSidebarItemClick = (id: string, modifiers: { ctrl: boolean, shift: boolean }) => {
    const { ctrl, shift } = modifiers;
    
    ensureVisible(id);

    let newSelection: string[] = [];
    
    if (shift && lastFocusedId) {
        const visibleIds = getVisibleFileIds();
        const startIdx = visibleIds.indexOf(lastFocusedId);
        const endIdx = visibleIds.indexOf(id);
        
        if (startIdx !== -1 && endIdx !== -1) {
             const min = Math.min(startIdx, endIdx);
             const max = Math.max(startIdx, endIdx);
             const range = visibleIds.slice(min, max + 1);
             
             if (ctrl) {
                 const newSet = new Set([...selectedFileIds, ...range]);
                 newSelection = Array.from(newSet);
             } else {
                 newSelection = range;
             }
        } else {
             newSelection = [id];
             setLastFocusedId(id);
        }
    } else if (ctrl) {
        if (selectedFileIds.includes(id)) {
            newSelection = selectedFileIds.filter(sid => sid !== id);
        } else {
            newSelection = [...selectedFileIds, id];
        }
        setLastFocusedId(id);
    } else {
        newSelection = [id];
        setLastFocusedId(id);
    }
    
    if (!ctrl && !shift && newSelection.length === 0) {
        newSelection = [id];
    }

    setSelectedFileIds(newSelection);
    
    if (!ctrl && !shift) {
        const item = files.find(f => f.id === id);
        if (item && item.type === 'file') {
             if (!openFileIds.includes(id)) {
                setOpenFileIds(prev => [...prev, id]);
             }
             setActiveFileId(id);
        }
    }
  };

  // --- Native & Browser File Operations ---

  const loadFileFromIpc = async (filePath: string) => {
    const ipc = getIpcRenderer();
    if (!ipc) return;

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
            chatHistory: [],
            isUnsaved: false
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
              ipcSuccess = true;
          } catch (e) {
              console.error("Electron open dialog failed", e);
              ipcSuccess = false;
          }
      }

      if (!ipcSuccess && fileInputRef.current) {
          fileInputRef.current.click();
      }
  };

  const handleBrowserFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        for (let i = 0; i < e.target.files.length; i++) {
            const file = e.target.files[i];
            const text = await file.text();
            
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
                chatHistory: [],
                isUnsaved: false
            };
            setFiles(prev => [...prev, newFile]);
            handleFileActivate(newFile.id);
        }
    }
    e.target.value = ''; 
  };

  const saveFileToDisk = async (file: FileDoc) => {
      const ipc = getIpcRenderer();

      if (ipc) {
          try {
              let savePath = file.path;

              if (!savePath) {
                  const resultPath: string = await ipc.invoke('save-file-dialog', file.name);
                  if (!resultPath) return;
                  savePath = resultPath;
              }

              await ipc.invoke('write-file', savePath, file.content);

              const newName = savePath.replace(/^.*[\\/]/, '');
              setFiles(prev => prev.map(f => 
                  f.id === file.id ? { ...f, path: savePath, name: newName, lastModified: Date.now(), isUnsaved: false } : f
              ));
              return;

          } catch (e) {
              console.error("Failed to save file via IPC", e);
          }
      }

      const blob = new Blob([file.content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setFiles(prev => prev.map(f => 
        f.id === file.id ? { ...f, lastModified: Date.now(), isUnsaved: false } : f
      ));
  };

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 's') {
              e.preventDefault();
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
        parentId: null,
        lastModified: Date.now(),
        chatHistory: [],
        isUnsaved: true
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
      isExpanded: true,
      isUnsaved: false
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
      f.id === activeFileId ? { ...f, content: newContent, lastModified: Date.now(), isUnsaved: true } : f
    ));
  };

  const handleUpdateChatHistory = (fileId: string, history: ChatMessage[]) => {
    setFiles(prev => prev.map(f =>
      f.id === fileId ? { ...f, chatHistory: history } : f
    ));
  };

  const handleMoveFile = (fileIds: string[], targetFolderId: string | null) => {
    const movesToProcess: string[] = [];

    for (const fileId of fileIds) {
        if (fileId === targetFolderId) continue;

        let isCycle = false;
        let currentId = targetFolderId;
        while (currentId) {
            if (currentId === fileId) {
                isCycle = true;
                break;
            }
            const parent = files.find(f => f.id === currentId)?.parentId;
            currentId = parent || null;
        }

        if (!isCycle) {
            movesToProcess.push(fileId);
        }
    }

    if (movesToProcess.length === 0) return;

    setFiles(prev => prev.map(f => {
        if (movesToProcess.includes(f.id)) {
            return { ...f, parentId: targetFolderId };
        }
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
      
      <input 
          type="file" 
          multiple 
          accept=".md,.txt,.markdown" 
          style={{ display: 'none' }}
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
                selectedFileIds={selectedFileIds}
                onSelect={handleSidebarItemClick}
                onOpenFile={handleOpenFile}
                onCreateFile={handleCreateFile}
                onCreateFolder={handleCreateFolder}
                onRenameFile={handleRenameFile}
                onMoveFile={handleMoveFile}
                onToggleFolder={handleToggleFolder}
                onLocateFile={handleLocateFile}
                onOpenSettings={() => setIsSettingsOpen(true)}
                language={language}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                width={sidebarWidth}
                onResizeStart={handleSidebarResizeStart}
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
                        selectedFileIds={selectedFileIds}
                        onSelect={handleTabClick}
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
                                onScroll={handleEditorScroll} 
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
             
             {activeFile && isAiOpen && (
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
                    allFiles={files}
                    aiProvider={aiProvider}
                    localBaseUrl={localBaseUrl}
                    localModelName={localModelName}
                    localApiKey={localApiKey}
                    width={aiWidth}
                    onResizeStart={handleAiResizeStart}
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
        aiProvider={aiProvider}
        onAiProviderChange={handleAiProviderChange}
        localBaseUrl={localBaseUrl}
        onLocalBaseUrlChange={handleLocalBaseUrlChange}
        localModelName={localModelName}
        onLocalModelNameChange={handleLocalModelNameChange}
        localApiKey={localApiKey} 
        onLocalApiKeyChange={handleLocalApiKeyChange}
        mcpServers={mcpServers}
        onMcpServersChange={handleMcpServersChange}
      />
    </div>
  );
};

export default App;