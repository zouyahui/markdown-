import React, { useState, useEffect } from 'react';
import { X, Key, ExternalLink, Save, ShieldAlert, Globe, Cpu, Server, Database, Plug, Plus, Trash2, Command, Link, Activity, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Language, AIProvider, MCPServerConfig } from '../types';
import { translations } from '../translations';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onSaveApiKey: (key: string) => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  // AI Provider Props
  aiProvider: AIProvider;
  onAiProviderChange: (provider: AIProvider) => void;
  localBaseUrl: string;
  onLocalBaseUrlChange: (url: string) => void;
  localModelName: string;
  onLocalModelNameChange: (name: string) => void;
  // MCP Props
  mcpServers: MCPServerConfig[];
  onMcpServersChange: (servers: MCPServerConfig[]) => void;
}

type Tab = 'general' | 'ai' | 'mcp';

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ 
  isOpen, 
  onClose, 
  apiKey, 
  onSaveApiKey,
  language,
  onLanguageChange,
  aiProvider,
  onAiProviderChange,
  localBaseUrl,
  onLocalBaseUrlChange,
  localModelName,
  onLocalModelNameChange,
  mcpServers,
  onMcpServersChange
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [inputKey, setInputKey] = useState(apiKey);
  const [inputBaseUrl, setInputBaseUrl] = useState(localBaseUrl);
  const [inputModelName, setInputModelName] = useState(localModelName);
  
  // Local state for managing MCP servers list edits
  const [localServers, setLocalServers] = useState<MCPServerConfig[]>(mcpServers);
  
  // State for connection testing
  const [testResults, setTestResults] = useState<Record<string, { loading: boolean, success?: boolean, msg?: string }>>({});

  const t = translations[language].settings;
  const commonT = translations[language].common;

  useEffect(() => {
    setInputKey(apiKey);
    setInputBaseUrl(localBaseUrl);
    setInputModelName(localModelName);
    setLocalServers(mcpServers);
  }, [apiKey, localBaseUrl, localModelName, mcpServers, isOpen]);

  const handleSave = () => {
    onSaveApiKey(inputKey);
    onLocalBaseUrlChange(inputBaseUrl);
    onLocalModelNameChange(inputModelName);
    onMcpServersChange(localServers);
    onClose();
  };

  const addMcpServer = () => {
    setLocalServers([...localServers, {
      id: Date.now().toString(),
      name: `Server ${localServers.length + 1}`,
      type: 'stdio',
      command: '',
      args: [],
      enabled: true
    }]);
  };

  const removeMcpServer = (id: string) => {
    setLocalServers(localServers.filter(s => s.id !== id));
  };

  const updateMcpServer = (id: string, field: keyof MCPServerConfig, value: any) => {
    setLocalServers(localServers.map(s => {
      if (s.id === id) {
        if (field === 'args' && typeof value === 'string') {
           // Basic space splitting, simple implementation
           return { ...s, args: value.split(' ') };
        }
        return { ...s, [field]: value };
      }
      return s;
    }));
  };

  const addPreset = (presetName: string) => {
      // Detect Windows platform
      // @ts-ignore
      const isWindows = typeof process !== 'undefined' && process.platform === 'win32';
      
      let config: MCPServerConfig = {
          id: Date.now().toString(),
          name: presetName,
          type: 'stdio',
          enabled: true,
          // Use npx.cmd on Windows, otherwise npx
          command: isWindows ? 'npx.cmd' : 'npx',
          args: []
      };

      switch (presetName) {
          case 'Filesystem':
              // Use C:\ on Windows, / on Mac/Linux as a default valid path
              const defaultPath = isWindows ? 'C:\\' : '/';
              config.args = ['-y', '@modelcontextprotocol/server-filesystem', defaultPath];
              break;
          case 'Git':
              config.args = ['-y', '@modelcontextprotocol/server-git'];
              break;
          case 'PostgreSQL':
              config.args = ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://localhost/mydb'];
              break;
          case 'Google Drive':
              config.args = ['-y', '@modelcontextprotocol/server-google-drive'];
              break;
          case 'Brave Search':
              config.args = ['-y', '@modelcontextprotocol/server-brave-search'];
              config.env = { 'BRAVE_API_KEY': 'your-key-here' };
              break;
      }
      setLocalServers([...localServers, config]);
  };

  const testConnection = async (server: MCPServerConfig) => {
    setTestResults(prev => ({ ...prev, [server.id]: { loading: true } }));
    
    try {
        // @ts-ignore
        if (typeof window !== 'undefined' && window.require) {
            // @ts-ignore
            const { ipcRenderer } = window.require('electron');
            const res = await ipcRenderer.invoke('mcp-test-connection', server);
            if (res.success) {
                setTestResults(prev => ({ ...prev, [server.id]: { loading: false, success: true, msg: `OK: ${res.toolCount} tools found` } }));
            } else {
                setTestResults(prev => ({ ...prev, [server.id]: { loading: false, success: false, msg: res.error } }));
            }
        } else {
            setTestResults(prev => ({ ...prev, [server.id]: { loading: false, success: false, msg: "Not in Electron" } }));
        }
    } catch (e: any) {
        setTestResults(prev => ({ ...prev, [server.id]: { loading: false, success: false, msg: e.message } }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[600px] bg-[#202020] border border-[#333] rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#333] bg-[#252525] flex-shrink-0">
          <h3 className="font-semibold text-sm">{t.title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-4 pt-4 space-x-2 bg-[#202020]">
            {(['general', 'ai', 'mcp'] as Tab[]).map(tab => (
                <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`
                        px-4 py-1.5 text-xs font-medium rounded-full transition-colors border border-transparent
                        ${activeTab === tab 
                            ? 'bg-[#333] text-white border-[#444]' 
                            : 'text-gray-400 hover:text-gray-200 hover:bg-[#2a2a2a]'
                        }
                    `}
                >
                    {t.tabs[tab]}
                </button>
            ))}
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          
          {activeTab === 'general' && (
             <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-200 flex items-center space-x-2">
                    <Globe size={16} className="text-[#4cc2ff]" />
                    <span>{t.languageLabel}</span>
                    </label>
                    <div className="relative">
                    <select
                        value={language}
                        onChange={(e) => onLanguageChange(e.target.value as Language)}
                        className="w-full bg-[#1e1e1e] border border-[#444] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-[#4cc2ff] transition-colors appearance-none cursor-pointer"
                    >
                        <option value="en">English</option>
                        <option value="zh">中文 (Chinese)</option>
                    </select>
                    </div>
                </div>
             </div>
          )}

          {activeTab === 'ai' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-200 flex items-center space-x-2">
                        <Cpu size={16} className="text-[#e8b339]" />
                        <span>{t.providerLabel}</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2 bg-[#1e1e1e] p-1 rounded-md border border-[#444]">
                        <button
                            onClick={() => onAiProviderChange('gemini')}
                            className={`text-xs py-2 rounded transition-colors ${aiProvider === 'gemini' ? 'bg-[#0078d4] text-white font-medium shadow-sm' : 'text-gray-400 hover:text-white'}`}
                        >
                            Google Gemini
                        </button>
                        <button
                            onClick={() => onAiProviderChange('local')}
                            className={`text-xs py-2 rounded transition-colors ${aiProvider === 'local' ? 'bg-[#0078d4] text-white font-medium shadow-sm' : 'text-gray-400 hover:text-white'}`}
                        >
                            Local AI / OpenAI
                        </button>
                    </div>
                </div>

                {/* Dynamic Config Fields */}
                {aiProvider === 'gemini' ? (
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-200 flex items-center space-x-2">
                            <Key size={16} className="text-[#4cc2ff]" />
                            <span>{t.apiKeyLabel}</span>
                        </label>
                        <input 
                            type="password" 
                            value={inputKey}
                            onChange={(e) => setInputKey(e.target.value)}
                            placeholder={t.apiKeyPlaceholder}
                            className="w-full bg-[#1e1e1e] border border-[#444] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-[#4cc2ff] transition-colors placeholder-gray-600"
                        />
                        <div className="flex items-start space-x-2 text-xs text-gray-400 bg-[#2d2d2d] p-3 rounded-md border border-[#333]">
                            <ShieldAlert size={14} className="mt-0.5 flex-shrink-0 text-yellow-500" />
                            <p>{t.apiKeyWarning}</p>
                        </div>
                        <div className="pt-1">
                            <a 
                                href="https://aistudio.google.com/app/apikey" 
                                target="_blank" 
                                rel="noreferrer"
                                className="flex items-center text-xs text-[#4cc2ff] hover:underline space-x-1"
                            >
                                <span>{t.getKeyLink}</span>
                                <ExternalLink size={10} />
                            </a>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 bg-[#1a1a1a] p-4 rounded-md border border-[#333]">
                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t.localSetupTitle}</h4>
                        
                        <div className="space-y-2">
                            <label className="text-sm text-gray-300 flex items-center space-x-2">
                                <Server size={14} />
                                <span>{t.baseUrlLabel}</span>
                            </label>
                            <input 
                                type="text" 
                                value={inputBaseUrl}
                                onChange={(e) => setInputBaseUrl(e.target.value)}
                                className="w-full bg-[#2d2d2d] border border-[#444] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-[#e8b339] transition-colors placeholder-gray-600 font-mono"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm text-gray-300 flex items-center space-x-2">
                                <Database size={14} />
                                <span>{t.modelNameLabel}</span>
                            </label>
                            <input 
                                type="text" 
                                value={inputModelName}
                                onChange={(e) => setInputModelName(e.target.value)}
                                className="w-full bg-[#2d2d2d] border border-[#444] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-[#e8b339] transition-colors placeholder-gray-600 font-mono"
                            />
                        </div>
                    </div>
                )}
             </div>
          )}

          {activeTab === 'mcp' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex items-start space-x-2 text-xs text-gray-400 bg-[#2d2d2d] p-3 rounded-md border border-[#333]">
                        <Plug size={14} className="mt-0.5 flex-shrink-0 text-purple-400" />
                        <p>{t.mcpDescription}</p>
                  </div>
                  
                  {/* Toolbar */}
                  <div className="flex items-center space-x-2">
                      <button 
                         onClick={addMcpServer}
                         className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#333] hover:bg-[#444] text-white text-xs rounded transition-colors border border-[#444]"
                      >
                         <Plus size={12} />
                         <span>{t.addMcpServer}</span>
                      </button>

                      {/* Presets Dropdown (Simple implementation) */}
                      <div className="relative group">
                          <button className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#333] hover:bg-[#444] text-gray-300 text-xs rounded transition-colors border border-[#444]">
                             <span>{t.mcpPresets}</span>
                          </button>
                          <div className="absolute top-full left-0 mt-1 w-48 bg-[#252525] border border-[#333] rounded shadow-xl hidden group-hover:block z-10">
                              {['Filesystem', 'Git', 'PostgreSQL', 'Google Drive', 'Brave Search'].map(p => (
                                  <button 
                                    key={p}
                                    onClick={() => addPreset(p)}
                                    className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-[#333] hover:text-white"
                                  >
                                      {p}
                                  </button>
                              ))}
                          </div>
                      </div>
                  </div>

                  {/* List */}
                  <div className="space-y-3">
                      {localServers.length === 0 ? (
                          <div className="text-center py-8 text-gray-500 text-xs italic border-2 border-dashed border-[#333] rounded-md">
                              {t.noMcpServers}
                          </div>
                      ) : (
                          localServers.map((server) => (
                              <div key={server.id} className="bg-[#1a1a1a] border border-[#333] rounded-md p-3 space-y-3 relative group">
                                  <button 
                                    onClick={() => removeMcpServer(server.id)}
                                    className="absolute top-2 right-2 text-gray-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                      <Trash2 size={14} />
                                  </button>

                                  <div className="grid grid-cols-3 gap-2">
                                      {/* Name */}
                                      <div className="col-span-2 space-y-1">
                                          <label className="text-[10px] text-gray-500 uppercase">{t.mcpName}</label>
                                          <input 
                                              type="text" 
                                              value={server.name}
                                              onChange={(e) => updateMcpServer(server.id, 'name', e.target.value)}
                                              className="w-full bg-[#2d2d2d] border border-[#444] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#4cc2ff]"
                                          />
                                      </div>
                                      {/* Type */}
                                      <div className="space-y-1">
                                          <label className="text-[10px] text-gray-500 uppercase">{t.mcpType}</label>
                                          <select 
                                              value={server.type}
                                              onChange={(e) => updateMcpServer(server.id, 'type', e.target.value)}
                                              className="w-full bg-[#2d2d2d] border border-[#444] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#4cc2ff]"
                                          >
                                              <option value="stdio">Stdio</option>
                                              <option value="sse">SSE</option>
                                          </select>
                                      </div>
                                  </div>

                                  {/* Type Specific Fields */}
                                  {server.type === 'stdio' ? (
                                      <>
                                        <div className="space-y-1">
                                            <label className="text-[10px] text-gray-500 uppercase flex items-center gap-1">
                                                <Command size={10} /> {t.mcpCommand}
                                            </label>
                                            <input 
                                                type="text" 
                                                value={server.command}
                                                onChange={(e) => updateMcpServer(server.id, 'command', e.target.value)}
                                                placeholder="npx"
                                                className="w-full bg-[#2d2d2d] border border-[#444] rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-[#4cc2ff]"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] text-gray-500 uppercase">{t.mcpArgs}</label>
                                            <input 
                                                type="text" 
                                                value={server.args?.join(' ')}
                                                onChange={(e) => updateMcpServer(server.id, 'args', e.target.value)}
                                                placeholder="-y @modelcontextprotocol/server-filesystem ..."
                                                className="w-full bg-[#2d2d2d] border border-[#444] rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-[#4cc2ff]"
                                            />
                                        </div>
                                      </>
                                  ) : (
                                      <div className="space-y-1">
                                          <label className="text-[10px] text-gray-500 uppercase flex items-center gap-1">
                                              <Link size={10} /> {t.mcpUrl}
                                          </label>
                                          <input 
                                              type="text" 
                                              value={server.url || ''}
                                              onChange={(e) => updateMcpServer(server.id, 'url', e.target.value)}
                                              placeholder="http://localhost:8080/sse"
                                              className="w-full bg-[#2d2d2d] border border-[#444] rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-[#4cc2ff]"
                                          />
                                      </div>
                                  )}

                                  {/* Test Button & Result */}
                                  <div>
                                      <div className="flex justify-end pt-2 border-t border-[#333] mt-2">
                                        <button 
                                            onClick={() => testConnection(server)}
                                            disabled={testResults[server.id]?.loading}
                                            className="flex items-center space-x-1 px-2 py-1 bg-[#252525] hover:bg-[#333] border border-[#444] rounded text-[10px] text-gray-300 transition-colors disabled:opacity-50"
                                        >
                                            {testResults[server.id]?.loading ? <Loader2 size={10} className="animate-spin"/> : <Activity size={10} />}
                                            <span>{t.testConnection}</span>
                                        </button>
                                      </div>
                                      {testResults[server.id]?.msg && (
                                        <div className={`text-[10px] mt-1 flex items-center space-x-1 ${testResults[server.id].success ? 'text-green-500' : 'text-red-400'}`}>
                                            {testResults[server.id].success ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />}
                                            <span className="truncate" title={testResults[server.id].msg}>{testResults[server.id].msg}</span>
                                        </div>
                                      )}
                                  </div>
                              </div>
                          ))
                      )}
                  </div>
              </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-[#1a1a1a] border-t border-[#333] flex justify-end space-x-2 flex-shrink-0">
          <button 
            onClick={onClose}
            className="px-4 py-1.5 bg-[#333] hover:bg-[#444] text-white text-xs rounded-[4px] transition-colors border border-[#444]"
          >
            {commonT.cancel}
          </button>
          <button 
            onClick={handleSave}
            className="flex items-center space-x-1.5 px-4 py-1.5 bg-[#0078d4] hover:bg-[#006cc0] text-white text-xs rounded-[4px] transition-colors"
          >
            <Save size={14} />
            <span>{t.saveSettings}</span>
          </button>
        </div>
      </div>
    </div>
  );
};