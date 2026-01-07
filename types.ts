export interface FileDoc {
  id: string;
  name: string;
  content: string; // Empty for folders
  lastModified: number;
  type: 'file' | 'folder';
  parentId: string | null;
  path?: string; // Real system path
  isExpanded?: boolean; // For folders UI state
  chatHistory?: ChatMessage[];
}

export enum MessageRole {
  User = 'user',
  Model = 'model',
  System = 'system'
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  isLoading?: boolean;
}

export interface GeminiConfig {
  temperature?: number;
  topK?: number;
  topP?: number;
}

export const AVAILABLE_MODELS = [
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (Fast)' },
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro (Smart)' },
];