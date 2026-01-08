import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, Bot, User, Loader2, FileText, ChevronDown, Copy, Check, Paperclip, Trash2 } from 'lucide-react';
import { ChatMessage, MessageRole, AVAILABLE_MODELS, Language, FileDoc, AIProvider } from '../types';
import { chatWithDocument, summarizeMarkdown } from '../services/geminiService';
import { translations } from '../translations';

interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  markdownContent: string;
  fileName: string;
  chatHistory: ChatMessage[];
  onUpdateChatHistory: (history: ChatMessage[]) => void;
  apiKey: string;
  language: Language;
  allFiles: FileDoc[];
  aiProvider: AIProvider;
  localBaseUrl: string;
  localModelName: string;
  localApiKey: string;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ 
    isOpen, 
    onClose, 
    markdownContent, 
    fileName, 
    chatHistory, 
    onUpdateChatHistory,
    apiKey,
    language,
    allFiles,
    aiProvider,
    localBaseUrl,
    localModelName,
    localApiKey
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(chatHistory);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0].id);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [attachedContext, setAttachedContext] = useState<{name: string, content: string}[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const t = translations[language].ai;

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen, attachedContext]);

  // Sync state changes to parent (save to FileDoc)
  useEffect(() => {
    onUpdateChatHistory(messages);
  }, [messages, onUpdateChatHistory]);

  // Initial greeting
  useEffect(() => {
    if (isOpen && messages.length === 0) {
        setMessages([{
            id: 'init',
            role: MessageRole.Model,
            text: t.greeting.replace('{fileName}', fileName)
        }]);
    }
  }, [isOpen, fileName, language]);

  const handleSendMessage = async () => {
    if ((!input.trim() && attachedContext.length === 0) || isLoading) return;

    let fullPrompt = input;
    if (attachedContext.length > 0) {
        const contextStr = attachedContext.map(c => `File: ${c.name}\nContent:\n${c.content}`).join('\n\n');
        fullPrompt = `[Additional Context Provided by User]:\n${contextStr}\n\n[User Message]:\n${input}`;
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: MessageRole.User,
      text: input + (attachedContext.length > 0 ? `\n(Attached: ${attachedContext.map(f => f.name).join(', ')})` : '')
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setAttachedContext([]); // Clear context after sending
    setIsLoading(true);

    const responseText = await chatWithDocument(
        markdownContent, 
        messages, 
        fullPrompt, 
        selectedModel, 
        apiKey, 
        language,
        aiProvider,
        { baseUrl: localBaseUrl, model: localModelName, apiKey: localApiKey }
    );

    const botMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: MessageRole.Model,
      text: responseText
    };

    setMessages(prev => [...prev, botMsg]);
    setIsLoading(false);
  };

  const handleSummarize = async () => {
    if (isLoading) return;
    
    const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: MessageRole.User,
        text: t.summarize
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    const summary = await summarizeMarkdown(
        markdownContent, 
        selectedModel, 
        apiKey, 
        language,
        aiProvider,
        { baseUrl: localBaseUrl, model: localModelName, apiKey: localApiKey }
    );
    
    const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: MessageRole.Model,
        text: summary
    };
    
    setMessages(prev => [...prev, botMsg]);
    setIsLoading(false);
  };

  const handleCopy = async (text: string, id: string) => {
    try {
        await navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
        console.error('Failed to copy text', err);
    }
  };

  // --- Drag and Drop Logic ---

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const data = e.dataTransfer.getData('text/plain');
    if (data) {
        try {
            // Attempt to parse internal file IDs from Sidebar
            const parsed = JSON.parse(data);
            const ids = Array.isArray(parsed) ? parsed : [data];
            
            const newContext: {name: string, content: string}[] = [];
            
            // Helper to recursively get files
            const resolveFiles = (fileId: string) => {
                const file = allFiles.find(f => f.id === fileId);
                if (!file) return;

                if (file.type === 'file') {
                    newContext.push({ name: file.name, content: file.content });
                } else {
                    // It's a folder, find children
                    const children = allFiles.filter(f => f.parentId === fileId);
                    children.forEach(child => resolveFiles(child.id));
                }
            };

            ids.forEach(id => resolveFiles(id));
            
            // Append to existing context, deduplicating by name (simple check)
            setAttachedContext(prev => {
                const combined = [...prev, ...newContext];
                // Simple dedupe by name
                return combined.filter((v, i, a) => a.findIndex(t => t.name === v.name) === i);
            });

        } catch (e) {
            console.warn("Failed to parse drop data", e);
        }
    }
  };

  const removeContext = (index: number) => {
    setAttachedContext(prev => prev.filter((_, i) => i !== index));
  };

  if (!isOpen) return null;

  return (
    <div className="w-80 border-l border-[#333] bg-[#202020] flex flex-col h-full absolute right-0 top-0 shadow-2xl z-10 transition-transform duration-300">
      {/* Header */}
      <div className="h-12 border-b border-[#333] flex items-center justify-between px-4 bg-[#252525]">
        <div className="flex items-center space-x-2 text-[#4cc2ff]">
          <Sparkles size={16} />
          <span className="font-semibold text-sm">{t.title}</span>
        </div>

        {/* Model Selector - Only show for Gemini */}
        {aiProvider === 'gemini' ? (
            <div className="relative group">
                <select 
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="appearance-none bg-[#333] hover:bg-[#3d3d3d] text-xs text-gray-200 py-1 pl-2 pr-6 rounded border border-[#444] outline-none cursor-pointer transition-colors w-32 truncate"
                >
                    {AVAILABLE_MODELS.map(model => (
                        <option key={model.id} value={model.id}>{model.name}</option>
                    ))}
                </select>
                <ChevronDown size={12} className="absolute right-2 top-1.5 text-gray-400 pointer-events-none" />
            </div>
        ) : (
            <div className="text-xs text-gray-400 bg-[#333] px-2 py-1 rounded truncate max-w-[120px]" title={localModelName}>
                {localModelName}
            </div>
        )}

        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors ml-2">
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 relative">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex items-start space-x-2 group ${msg.role === MessageRole.User ? 'flex-row-reverse space-x-reverse' : ''}`}>
            {/* Avatar */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === MessageRole.User ? 'bg-[#333]' : (aiProvider === 'local' ? 'bg-[#e8b339]' : 'bg-[#0078d4]')}`}>
              {msg.role === MessageRole.User ? <User size={14} className="text-gray-300" /> : <Bot size={14} className="text-white" />}
            </div>
            
            {/* Message Bubble */}
            <div className={`relative max-w-[80%] rounded-lg p-3 text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === MessageRole.User 
                ? 'bg-[#333] text-white' 
                : 'bg-[#2b2b2b] text-gray-200 border border-[#333]'
            }`}>
              <div className="pr-2">{msg.text}</div>
              
              {/* Copy Button (Visible on Hover) */}
              <button 
                onClick={() => handleCopy(msg.text, msg.id)}
                className={`
                    absolute top-1 right-1 p-1 rounded-md transition-all duration-200 opacity-0 group-hover:opacity-100 bg-[#252525] shadow-sm
                    ${msg.role === MessageRole.User ? 'text-gray-400 hover:text-white hover:bg-[#444]' : 'text-gray-500 hover:text-white hover:bg-[#383838]'}
                `}
                title="Copy text"
              >
                {copiedId === msg.id ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
              </button>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center space-x-2 text-gray-500 text-xs pl-2">
            <Loader2 size={12} className="animate-spin" />
            <span>{t.thinking}</span>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-2 border-t border-[#333] bg-[#252525] flex space-x-2 overflow-x-auto no-scrollbar">
        <button 
            onClick={handleSummarize}
            disabled={isLoading}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#333] hover:bg-[#444] rounded-full text-xs text-white whitespace-nowrap transition-colors border border-[#444]"
        >
            <FileText size={12} />
            <span>{t.summarize}</span>
        </button>
        <button 
             onClick={() => { setInput(language === 'zh' ? '关键要点是什么？' : 'What are the key takeaways?'); handleSendMessage(); }}
             disabled={isLoading}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#333] hover:bg-[#444] rounded-full text-xs text-white whitespace-nowrap transition-colors border border-[#444]"
        >
            <Sparkles size={12} />
            <span>{t.keyTakeaways}</span>
        </button>
      </div>

      {/* Input Area with Drop Zone */}
      <div 
        className={`p-4 border-t border-[#333] bg-[#202020] relative transition-colors ${isDragOver ? 'bg-[#2a2a2a]' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragOver && (
            <div className="absolute inset-0 bg-[#0078d4]/20 border-2 border-dashed border-[#0078d4] flex items-center justify-center z-20 pointer-events-none">
                <span className="text-[#4cc2ff] font-medium text-sm bg-[#1e1e1e] px-2 py-1 rounded">
                    {language === 'zh' ? '添加为上下文' : 'Drop to add context'}
                </span>
            </div>
        )}

        {/* Attached Context Chips */}
        {attachedContext.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2 max-h-20 overflow-y-auto">
                {attachedContext.map((file, index) => (
                    <div key={index} className="flex items-center space-x-1 bg-[#333] text-xs text-gray-200 px-2 py-1 rounded-full border border-[#444]">
                        <Paperclip size={10} />
                        <span className="max-w-[100px] truncate">{file.name}</span>
                        <button 
                            onClick={() => removeContext(index)}
                            className="text-gray-500 hover:text-red-400 ml-1"
                        >
                            <X size={10} />
                        </button>
                    </div>
                ))}
            </div>
        )}

        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={attachedContext.length > 0 ? (language === 'zh' ? '询问关于这些文件...' : 'Ask about these files...') : t.placeholder}
            className="w-full bg-[#2d2d2d] text-white rounded-md py-2.5 pl-3 pr-10 text-sm focus:outline-none focus:ring-1 focus:ring-[#4cc2ff] border border-transparent placeholder-gray-500"
          />
          <button 
            onClick={handleSendMessage}
            disabled={(!input.trim() && attachedContext.length === 0) || isLoading}
            className="absolute right-2 top-2 p-1 text-[#4cc2ff] hover:text-white disabled:text-gray-600 transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};