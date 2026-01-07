import { GoogleGenAI, Content } from "@google/genai";
import { ChatMessage, MessageRole } from "../types";

// Helper to create client with user provided key or fallback to env
const getClient = (apiKey?: string) => {
    const key = apiKey || process.env.API_KEY;
    if (!key) {
        throw new Error("Missing API Key. Please configure it in Settings.");
    }
    return new GoogleGenAI({ apiKey: key });
};

export const summarizeMarkdown = async (markdownContent: string, modelId: string, apiKey?: string): Promise<string> => {
  try {
    const ai = getClient(apiKey);
    const prompt = `Please provide a concise summary of the following Markdown document. Highlight key points and potential action items if any.\n\nDocument Content:\n${markdownContent}`;
    
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        systemInstruction: "You are a helpful desktop assistant. Keep summaries professional and structured.",
      }
    });

    return response.text || "No summary generated.";
  } catch (error: any) {
    console.error("Summarization error:", error);
    if (error.message.includes("Missing API Key")) {
        return "Please set your Gemini API Key in Settings (Gear icon).";
    }
    return "Error generating summary. Please check your API key and network connection.";
  }
};

export const chatWithDocument = async (
  markdownContent: string,
  history: ChatMessage[],
  newMessage: string,
  modelId: string,
  apiKey?: string
): Promise<string> => {
  try {
    const ai = getClient(apiKey);
    const contextInstruction = `You are a smart assistant integrated into a Markdown file viewer. 
    The user is currently viewing a file with the following content:
    
    --- START OF FILE ---
    ${markdownContent}
    --- END OF FILE ---
    
    Answer the user's questions based on the file content provided above. If the answer is not in the file, use your general knowledge but mention that it's not in the file.`;

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
    
    return response.text || "I couldn't understand that.";

  } catch (error: any) {
    console.error("Chat error:", error);
    if (error.message.includes("Missing API Key")) {
        return "Please set your Gemini API Key in Settings (Gear icon).";
    }
    return "Sorry, I encountered an error. Please check your API key.";
  }
};