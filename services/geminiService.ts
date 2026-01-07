import { GoogleGenAI, Content } from "@google/genai";
import { ChatMessage, MessageRole, Language } from "../types";

// Helper to create client with user provided key or fallback to env
const getClient = (apiKey?: string) => {
    const key = apiKey || process.env.API_KEY;
    if (!key) {
        throw new Error("Missing API Key. Please configure it in Settings.");
    }
    return new GoogleGenAI({ apiKey: key });
};

export const summarizeMarkdown = async (markdownContent: string, modelId: string, apiKey?: string, language: Language = 'en'): Promise<string> => {
  try {
    const ai = getClient(apiKey);
    
    const langInstruction = language === 'zh' ? "Please reply in Simplified Chinese." : "Please reply in English.";
    
    const prompt = `Please provide a concise summary of the following Markdown document. Highlight key points and potential action items if any. ${langInstruction}\n\nDocument Content:\n${markdownContent}`;
    
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        systemInstruction: `You are a helpful desktop assistant. Keep summaries professional and structured. ${langInstruction}`,
      }
    });

    return response.text || "No summary generated.";
  } catch (error: any) {
    console.error("Summarization error:", error);
    if (error.message.includes("Missing API Key")) {
        return language === 'zh' ? "请在设置中配置 Gemini API Key。" : "Please set your Gemini API Key in Settings (Gear icon).";
    }
    return language === 'zh' ? "生成总结出错，请检查网络或 API Key。" : "Error generating summary. Please check your API key and network connection.";
  }
};

export const chatWithDocument = async (
  markdownContent: string,
  history: ChatMessage[],
  newMessage: string,
  modelId: string,
  apiKey?: string,
  language: Language = 'en'
): Promise<string> => {
  try {
    const ai = getClient(apiKey);
    
    const langInstruction = language === 'zh' ? "You must reply in Simplified Chinese." : "You must reply in English.";

    const contextInstruction = `You are a smart assistant integrated into a Markdown file viewer. 
    The user is currently viewing a file with the following content:
    
    --- START OF FILE ---
    ${markdownContent}
    --- END OF FILE ---
    
    Answer the user's questions based on the file content provided above. If the answer is not in the file, use your general knowledge but mention that it's not in the file.
    ${langInstruction}`;

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

  } catch (error: any) {
    console.error("Chat error:", error);
    if (error.message.includes("Missing API Key")) {
        return language === 'zh' ? "请在设置中配置 Gemini API Key。" : "Please set your Gemini API Key in Settings (Gear icon).";
    }
    return language === 'zh' ? "抱歉，遇到错误。请检查您的 API Key。" : "Sorry, I encountered an error. Please check your API key.";
  }
};
