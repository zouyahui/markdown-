import React, { useState, useEffect } from 'react';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { MarkdownViewer } from './components/MarkdownViewer';
import { MarkdownEditor } from './components/MarkdownEditor';
import { AIAssistant } from './components/AIAssistant';
import { HelpDialog } from './components/HelpDialog';
import { FileDoc } from './types';
import { Sparkles, Layout, PenTool, Eye, Save } from 'lucide-react';

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
          setFiles(parsedFiles);
          setActiveFileId(parsedFiles[0].id);
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
      lastModified: Date.now(),
      content: `# Welcome to WinMD Explorer

This is a **Windows 11 inspired** Markdown explorer capable of reading local files.

## Storage Note 💾
- **Auto-Save**: Files are now automatically saved to your browser's Local Storage. They will survive a page refresh!
- **Save to Disk**: Click the **Save** icon in the toolbar to download the .md file to your computer.

## Features
- 🎨 Modern Dark UI
- 📝 Markdown & GFM Support
- ✏️ **Edit Mode** (Click the Pen icon!)
- ✨ **Gemini AI Integration** (Click the Sparkles icon!)

## How to use
1. Use the "Open" button in the sidebar to select local Markdown files.
2. Click "New" to create a scratchpad.
3. Select a file to view it.
4. Ask Gemini to summarize your documents.

## Running on Windows
Click the **?** icon in the title bar to learn how to install this as a native app on Windows!

## Code Example
\`\`\`javascript
console.log("Hello, WinMD!");
\`\`\`
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
      // Check for existence before reading to prompt user
      const existingFile = files.find(f => f.name === file.name);
      
      if (existingFile) {
        if (!window.confirm(`The file "${file.name}" is already open. Do you want to overwrite it with the uploaded version?`)) {
            // If user cancels, just switch to existing file
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
                ? { ...f, content: text, lastModified: file.lastModified }
                : f
            ));
            setActiveFileId(existingFile.id);
        } else {
            // Create new
            const newFile: FileDoc = {
                id: Math.random().toString(36).substr(2, 9),
                name: file.name,
                content: text,
                lastModified: file.lastModified
            };
            setFiles(prev => [...prev, newFile]);
            setActiveFileId(newFile.id);
        }
      };
      reader.readAsText(file);
    });
    // Reset input
    event.target.value = '';
  };

  const handleCreateFile = () => {
    const newFile: FileDoc = {
        id: Math.random().toString(36).substr(2, 9),
        name: `Untitled-${files.length + 1}.md`,
        content: '# New Document\n\nStart typing...',
        lastModified: Date.now()
    };
    setFiles(prev => [...prev, newFile]);
    setActiveFileId(newFile.id);
    setIsEditing(true); 
  };

  const handleRenameFile = (id: string, newName: string) => {
      let finalName = newName.trim();
      if (!finalName) return;
      
      // Ensure extension exists if desired, but user might want no extension. 
      // Let's force .md if no extension is provided to keep it clean, 
      // or just trust the user. Let's auto-append .md if missing for better UX in this app.
      if (!finalName.toLowerCase().endsWith('.md') && !finalName.toLowerCase().endsWith('.txt')) {
          finalName += '.md';
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
          onRenameFile={handleRenameFile}
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