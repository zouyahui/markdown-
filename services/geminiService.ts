
import { GoogleGenAI, Content, FunctionDeclaration, FunctionCall, Part } from "@google/genai";
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

// --- MCP Tool Helpers ---

// Get tools from MCP servers and format for OpenAI
const getMcpTools = async () => {
    const ipc = getIpcRenderer();
    if (!ipc) return [];

    try {
        const mcpTools = await ipc.invoke('mcp-list-tools');
        // Map MCP tool definition to OpenAI Function Definition
        return mcpTools.map((t: any) => ({
            type: "function",
            function: {
                name: t.name,
                description: t.description || `Tool from ${t.serverName}`,
                parameters: t.inputSchema || {} // MCP inputSchema is compatible with OpenAI parameters
            },
            // Metadata for execution later
            _serverId: t.serverId
        }));
    } catch (e) {
        console.error("Failed to list MCP tools", e);
        return [];
    }
};

// --- Local AI / OpenAI Compatible Implementation ---
const chatWithLocalAI = async (
    baseUrl: string, 
    modelName: string, 
    messages: { role: string; content: string; tool_calls?: any[]; tool_call_id?: string; name?: string }[],
    apiKey?: string,
    tools: any[] = []
): Promise<string> => {
    
    // Max turns to prevent infinite loops
    const MAX_TURNS = 10;
    let turnCount = 0;
    
    // We work on a copy of messages to append tool calls
    let currentMessages = [...messages];

    while (turnCount < MAX_TURNS) {
        turnCount++;
        
        // 1. Send Request
        let responseMessage: any;
        
        // Try via Electron IPC first (avoids CORS)
        const ipc = getIpcRenderer();
        if (ipc) {
            try {
                // Strip internal metadata (_serverId) from tools before sending to API
                const apiTools = tools.length > 0 ? tools.map(({ _serverId, ...rest }) => rest) : undefined;
                
                responseMessage = await ipc.invoke('chat-local-ai', { 
                    baseUrl, 
                    modelName, 
                    messages: currentMessages, 
                    apiKey,
                    tools: apiTools
                });
            } catch (error: any) {
                 console.error("IPC Local AI Failed", error);
                 throw new Error(`${error.message}`);
            }
        } else {
            // Browser Fallback (Usually fails CORS or no MCP access)
            const doFetch = async (targetUrl: string) => {
                const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

                const payload: any = { model: modelName, messages: currentMessages, stream: false };
                if (tools.length > 0) {
                     payload.tools = tools.map(({ _serverId, ...rest }) => rest);
                     payload.tool_choice = "auto";
                }

                const response = await fetch(targetUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload)
                });

                if (!response.ok) throw new Error(`Local AI Error: ${response.status} ${response.statusText}`);
                const data = await response.json();
                return data.choices?.[0]?.message || { content: "" };
            };

            let cleanBase = baseUrl.replace(/\/+$/, '').replace(/\/chat\/completions$/, '');
            const defaultUrl = `${cleanBase}/chat/completions`;

            try {
                responseMessage = await doFetch(defaultUrl);
            } catch (error: any) {
                if (error.message.includes('404') && !cleanBase.includes('/v1')) {
                    const v1Url = `${cleanBase}/v1/chat/completions`;
                    responseMessage = await doFetch(v1Url);
                } else {
                    throw error;
                }
            }
        }

        // 2. Check for Tool Calls
        if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
            // Append the model's response (with tool calls) to history
            currentMessages.push(responseMessage);
            
            console.log("AI wants to call tools:", responseMessage.tool_calls);

            // Execute each tool
            for (const toolCall of responseMessage.tool_calls) {
                const functionName = toolCall.function.name;
                const argsString = toolCall.function.arguments;
                let args = {};
                try { args = JSON.parse(argsString); } catch(e) { console.error("Failed to parse tool args", e); }

                // Find the server ID from our original tools list
                const toolDef = tools.find(t => t.function.name === functionName);
                
                let result = "Error: Tool not found or execution failed.";
                
                if (toolDef && toolDef._serverId && ipc) {
                    try {
                        console.log(`Executing ${functionName} on server ${toolDef._serverId}...`);
                        const toolResult = await ipc.invoke('mcp-call-tool', {
                            serverId: toolDef._serverId,
                            toolName: functionName,
                            args: args
                        });
                        
                        // MCP results usually come as { content: [ { type: 'text', text: '...' } ] }
                        if (toolResult && toolResult.content) {
                            result = toolResult.content.map((c: any) => c.text || JSON.stringify(c)).join('\n');
                        } else {
                            result = JSON.stringify(toolResult);
                        }
                    } catch (e: any) {
                        result = `Error executing tool: ${e.message}`;
                    }
                } else {
                    result = "Error: MCP tools are only available in the desktop app.";
                }

                // Append Tool Result to history
                currentMessages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    name: functionName,
                    content: result
                });
            }
            // Loop continues to send tool results back to model
        } else {
            // No tool calls, just return the content
            return responseMessage.content || "";
        }
    }

    return "Error: Maximum conversation turns exceeded during tool execution.";
};

// --- Unified Exports ---

export const summarizeMarkdown = async (
    markdownContent: string, 
    modelId: string, 
    apiKey?: string, 
    language: Language = 'en',
    provider: AIProvider = 'gemini',
    localConfig?: { baseUrl: string, model: string, apiKey?: string }
): Promise<string> => {
    
    const langInstruction = language === 'zh' ? "Please reply in Simplified Chinese." : "Please reply in English.";
    const systemPrompt = `You are a helpful desktop assistant. Keep summaries professional and structured. ${langInstruction}`;
    const userPrompt = `Please provide a concise summary of the following Markdown document. Highlight key points and potential action items if any. ${langInstruction}\n\nDocument Content:\n${markdownContent}`;

    try {
        if (provider === 'local' && localConfig) {
            // Note: Summarization typically doesn't need tools, passing empty list
            return await chatWithLocalAI(
                localConfig.baseUrl, 
                localConfig.model, 
                [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                localConfig.apiKey,
                [] 
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
        if (error.message.includes("401") || error.message.includes("Unauthorized")) {
             return language === 'zh' 
                ? "鉴权失败 (401)。请检查设置中的“本地 AI API Key”是否正确。" 
                : "Authentication failed (401). Please check your Local AI API Key in Settings.";
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
  localConfig?: { baseUrl: string, model: string, apiKey?: string }
): Promise<string> => {
  
  const langInstruction = language === 'zh' ? "You must reply in Simplified Chinese." : "You must reply in English.";
  
  // Fetch MCP Tools if available
  const openAiTools = await getMcpTools();
  const toolNames = openAiTools.map((t: any) => t.function.name).join(', ');
  const hasTools = openAiTools.length > 0;

  const toolInstruction = hasTools 
      ? `\n\n### ACTIVE MCP TOOLS\nYou have access to the following external tools (Model Context Protocol): [${toolNames}].\nIMPORTANT: If the user asks about your capabilities, "What MCP tools do you have?", or "What can you do?", you MUST list these tools and explain them. Do NOT look for this information in the markdown file content.` 
      : "\n\nNo external MCP tools are currently connected.";

  // Enhanced Context Instruction to force tool usage
  const contextInstruction = `You are a helpful and smart desktop assistant integrated into a Markdown file viewer.
    ${toolInstruction}

    ### FILE CONTEXT
    The user is currently viewing a file with the following content:
    
    --- START OF FILE ---
    ${markdownContent}
    --- END OF FILE ---
    
    ### INSTRUCTIONS
    1. **Prioritize File Context**: If the user asks about the content of the file, answer based on the "FILE CONTEXT".
    2. **Tool Capabilities**: If the user asks about available tools, list the "ACTIVE MCP TOOLS".
    3. **Active Tool Usage**: 
       - If the user asks a question that requires **external information** (e.g., "current stock price", "today's date", "search for...", "weather", "latest news"), **YOU MUST USE A TOOL** (like a search tool) if available.
       - Do NOT say "I cannot access real-time information" if you have a tool that can do it.
       - Do NOT say "I cannot predict the future" if the user asks for a future date's data; instead, use a search tool to find forecasts, expectations, or relevant discussions.
       - If the user explicitly asks to "use browser" or "use query tool", always attempt to use the relevant tool.
    4. **General Knowledge**: If the answer is not in the file and no tool is relevant, use your general knowledge.
    5. ${langInstruction}`;

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

        return await chatWithLocalAI(
            localConfig.baseUrl, 
            localConfig.model, 
            localMessages, 
            localConfig.apiKey, 
            openAiTools
        );

    } else {
        // Gemini Implementation
        const ai = getGeminiClient(apiKey);
        
        // Convert OpenAI-style tools to Gemini FunctionDeclarations
        const geminiTools: FunctionDeclaration[] = openAiTools.map((t: any) => ({
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters
        }));

        const toolsConfig = geminiTools.length > 0 ? [{ functionDeclarations: geminiTools }] : undefined;

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
            tools: toolsConfig
          },
        });
        
        // Send message
        let response = await chat.sendMessage({
          message: newMessage
        });

        // Loop for tool calls (Gemini doesn't auto-execute tools on client side)
        const MAX_GEMINI_TURNS = 10;
        let turn = 0;
        
        const ipc = getIpcRenderer();

        while (turn < MAX_GEMINI_TURNS) {
            // Check for function calls
            const functionCalls = response.functionCalls;
            if (!functionCalls || functionCalls.length === 0) {
                break;
            }
            
            turn++;
            console.log("Gemini wants to call tools:", functionCalls);

            const functionResponses: { name: string, response: any }[] = [];
            
            for (const fc of functionCalls) {
                const toolDef = openAiTools.find((t: any) => t.function.name === fc.name);
                let result = "Error: Tool execution failed.";

                if (toolDef && toolDef._serverId && ipc) {
                    try {
                        const toolResult = await ipc.invoke('mcp-call-tool', {
                            serverId: toolDef._serverId,
                            toolName: fc.name,
                            args: fc.args
                        });
                        
                        if (toolResult && toolResult.content) {
                            result = toolResult.content.map((c: any) => c.text || JSON.stringify(c)).join('\n');
                        } else {
                            result = JSON.stringify(toolResult);
                        }
                    } catch (e: any) {
                        result = `Error: ${e.message}`;
                    }
                } else {
                    result = "Error: Tool unavailable.";
                }

                functionResponses.push({
                    name: fc.name,
                    response: { result: result } 
                });
            }

            // Send tool responses back to Gemini
            // CRITICAL: Must wrap in 'functionResponse' part for the SDK to recognize it
            const responseParts: Part[] = functionResponses.map(fr => ({
                functionResponse: {
                    name: fr.name,
                    response: fr.response
                }
            }));

            // Fix: Wrap parts in a message object as required by the new SDK
            response = await chat.sendMessage({ message: responseParts });
        }
        
        return response.text || (language === 'zh' ? "我没听懂。" : "I couldn't understand that.");
    }

  } catch (error: any) {
    console.error("Chat error:", error);
    if (error.message.includes("Missing API Key")) {
        return language === 'zh' ? "请在设置中配置 Gemini API Key。" : "Please set your Gemini API Key in Settings.";
    }
    if (error.message.includes("401") || error.message.includes("Unauthorized")) {
        return language === 'zh' 
           ? "鉴权失败 (401)。请检查设置中的“本地 AI API Key”是否正确。" 
           : "Authentication failed (401). Please check your Local AI API Key in Settings.";
   }
    return language === 'zh' 
        ? `抱歉，遇到错误: ${error.message}` 
        : `Sorry, I encountered an error: ${error.message}`;
  }
};
