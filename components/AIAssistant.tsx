import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, Bot, User, Loader2, FileText, ChevronDown } from 'lucide-react';
import { ChatMessage, MessageRole, AVAILABLE_MODELS } from '../types';
import { chatWithDocument, summarizeMarkdown } from '../services/geminiService';

interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  markdownContent: string;
  fileName: string;
  chatHistory: ChatMessage[];
  onUpdateChatHistory: (history: ChatMessage[]) => void;
  apiKey: string;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ 
    isOpen, 
    onClose, 
    markdownContent, 
    fileName, 
    chatHistory, 
    onUpdateChatHistory,
    apiKey
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(chatHistory);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0].id);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

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
            text: `Hi! I'm your Gemini AI assistant. I've read "${fileName}". Ask me to summarize it or explain any section.`
        }]);
    }
  }, [isOpen, fileName]); // messages is intentionally omitted from deps to avoid re-triggering after setting it

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: MessageRole.User,
      text: input
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const responseText = await chatWithDocument(markdownContent, messages, userMsg.text, selectedModel, apiKey);

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
        text: "Summarize this document."
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    const summary = await summarizeMarkdown(markdownContent, selectedModel, apiKey);
    
    const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: MessageRole.Model,
        text: summary
    };
    
    setMessages(prev => [...prev, botMsg]);
    setIsLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="w-80 border-l border-[#333] bg-[#202020] flex flex-col h-full absolute right-0 top-0 shadow-2xl z-10 transition-transform duration-300">
      {/* Header */}
      <div className="h-12 border-b border-[#333] flex items-center justify-between px-4 bg-[#252525]">
        <div className="flex items-center space-x-2 text-[#4cc2ff]">
          <Sparkles size={16} />
          <span className="font-semibold text-sm">Gemini</span>
        </div>

        {/* Model Selector */}
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

        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors ml-2">
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex items-start space-x-2 ${msg.role === MessageRole.User ? 'flex-row-reverse space-x-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === MessageRole.User ? 'bg-[#333]' : 'bg-[#0078d4]'}`}>
              {msg.role === MessageRole.User ? <User size={14} className="text-gray-300" /> : <Bot size={14} className="text-white" />}
            </div>
            <div className={`max-w-[80%] rounded-lg p-3 text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === MessageRole.User 
                ? 'bg-[#333] text-white' 
                : 'bg-[#2b2b2b] text-gray-200 border border-[#333]'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center space-x-2 text-gray-500 text-xs pl-2">
            <Loader2 size={12} className="animate-spin" />
            <span>Gemini is thinking...</span>
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
            <span>Summarize</span>
        </button>
        <button 
             onClick={() => { setInput('What are the key takeaways?'); handleSendMessage(); }}
             disabled={isLoading}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#333] hover:bg-[#444] rounded-full text-xs text-white whitespace-nowrap transition-colors border border-[#444]"
        >
            <Sparkles size={12} />
            <span>Key Takeaways</span>
        </button>
      </div>

      {/* Input */}
      <div className="p-4 border-t border-[#333] bg-[#202020]">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Ask about the file..."
            className="w-full bg-[#2d2d2d] text-white rounded-md py-2.5 pl-3 pr-10 text-sm focus:outline-none focus:ring-1 focus:ring-[#4cc2ff] border border-transparent placeholder-gray-500"
          />
          <button 
            onClick={handleSendMessage}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-2 p-1 text-[#4cc2ff] hover:text-white disabled:text-gray-600 transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};