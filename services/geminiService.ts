import { GoogleGenAI, Content } from "@google/genai";
import { ChatMessage, MessageRole, Language, AIProvider } from "../types";

// --- Helper to get IPC Renderer ---
const getIpcRenderer = () => {
    try {
        // @ts-ignore
        if (typeof window !== 'undefined' && window.require) {
            // @ts-ignore
            return window.require('electron').ipcRenderer;
        }
    } catch (e) {
        return null;
    }
    return null;
};

// --- Google Gemini Implementation ---
const getGeminiClient = (apiKey?: string) => {
    // Safe access to process.env for browser environments
    const envKey = typeof process !== 'undefined' && process.env ? process.env.API_KEY : undefined;
    const key = apiKey || envKey;
    
    if (!key) {
        throw new Error("Missing API Key. Please configure it in Settings.");
    }
    return new GoogleGenAI({ apiKey: key });
};

// --- Local AI / OpenAI Compatible Implementation ---
const chatWithLocalAI = async (
    baseUrl: string, 
    modelName: string, 
    messages: { role: string; content: string }[]
): Promise<string> => {
    
    // Try via Electron IPC first (avoids CORS)
    const ipc = getIpcRenderer();
    if (ipc) {
        try {
            return await ipc.invoke('chat-local-ai', { baseUrl, modelName, messages });
        } catch (error: any) {
             console.error("IPC Local AI Failed", error);
             throw new Error(`Local AI Error (IPC): ${error.message}`);
        }
    }

    // Fallback for browser-only mode (might fail CORS)
    const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Add Authorization header if needed in future
            },
            body: JSON.stringify({
                model: modelName,
                messages: messages,
                stream: false
            })
        });

        if (!response.ok) {
            throw new Error(`Local AI Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || "";
    } catch (error) {
        console.error("Local AI Request Failed", error);
        throw error;
    }
};

// --- Unified Exports ---

export const summarizeMarkdown = async (
    markdownContent: string, 
    modelId: string, 
    apiKey?: string, 
    language: Language = 'en',
    provider: AIProvider = 'gemini',
    localConfig?: { baseUrl: string, model: string }
): Promise<string> => {
    
    const langInstruction = language === 'zh' ? "Please reply in Simplified Chinese." : "Please reply in English.";
    const systemPrompt = `You are a helpful desktop assistant. Keep summaries professional and structured. ${langInstruction}`;
    const userPrompt = `Please provide a concise summary of the following Markdown document. Highlight key points and potential action items if any. ${langInstruction}\n\nDocument Content:\n${markdownContent}`;

    try {
        if (provider === 'local' && localConfig) {
            return await chatWithLocalAI(
                localConfig.baseUrl, 
                localConfig.model, 
                [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ]
            );
        } else {
            // Default to Gemini
            const ai = getGeminiClient(apiKey);
            const response = await ai.models.generateContent({
                model: modelId,
                contents: userPrompt,
                config: { systemInstruction: systemPrompt }
            });
            return response.text || "No summary generated.";
        }
    } catch (error: any) {
        console.error("Summarization error:", error);
        if (error.message.includes("Missing API Key")) {
            return language === 'zh' ? "请在设置中配置 Gemini API Key。" : "Please set your Gemini API Key in Settings.";
        }
        return language === 'zh' 
            ? `生成总结出错: ${error.message}` 
            : `Error generating summary: ${error.message}`;
    }
};

export const chatWithDocument = async (
  markdownContent: string,
  history: ChatMessage[],
  newMessage: string,
  modelId: string,
  apiKey?: string,
  language: Language = 'en',
  provider: AIProvider = 'gemini',
  localConfig?: { baseUrl: string, model: string }
): Promise<string> => {
  
  const langInstruction = language === 'zh' ? "You must reply in Simplified Chinese." : "You must reply in English.";
  const contextInstruction = `You are a smart assistant integrated into a Markdown file viewer. 
    The user is currently viewing a file with the following content:
    
    --- START OF FILE ---
    ${markdownContent}
    --- END OF FILE ---
    
    Answer the user's questions based on the file content provided above. If the answer is not in the file, use your general knowledge but mention that it's not in the file.
    ${langInstruction}`;

  try {
    if (provider === 'local' && localConfig) {
        // Prepare messages for Local AI (OpenAI format)
        const localMessages = [
            { role: 'system', content: contextInstruction },
            ...history
                .filter(m => m.id !== 'init' && m.role !== MessageRole.System)
                .map(m => ({
                    role: m.role === MessageRole.User ? 'user' : 'assistant',
                    content: m.text
                })),
            { role: 'user', content: newMessage }
        ];

        return await chatWithLocalAI(localConfig.baseUrl, localConfig.model, localMessages);

    } else {
        // Gemini Implementation
        const ai = getGeminiClient(apiKey);

        // Convert app history to SDK history format
        const sdkHistory: Content[] = history
          .filter(m => m.id !== 'init' && m.role !== MessageRole.System)
          .map(m => ({
            role: m.role === MessageRole.User ? 'user' : 'model',
            parts: [{ text: m.text }]
          }));
    
        const chat = ai.chats.create({
          model: modelId,
          history: sdkHistory,
          config: {
            systemInstruction: contextInstruction,
          },
        });
    
        const response = await chat.sendMessage({
          message: newMessage
        });
        
        return response.text || (language === 'zh' ? "我没听懂。" : "I couldn't understand that.");
    }

  } catch (error: any) {
    console.error("Chat error:", error);
    if (error.message.includes("Missing API Key")) {
        return language === 'zh' ? "请在设置中配置 Gemini API Key。" : "Please set your Gemini API Key in Settings.";
    }
    return language === 'zh' 
        ? `抱歉，遇到错误: ${error.message}` 
        : `Sorry, I encountered an error: ${error.message}`;
  }
};