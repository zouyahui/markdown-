const { app, BrowserWindow, ipcMain, shell, dialog, Menu, session } = require('electron');
const path = require('path');
const fs = require('fs');

// Global reference to prevent garbage collection
let mainWindow;

// --- MCP Global State ---
let mcpClients = new Map(); // Map<configId, Client>
let mcpSdk = null; // Dynamically imported SDK

// --- Helper to load MCP SDK (ESM) in CommonJS ---
async function ensureMcpSdk() {
  if (mcpSdk) return mcpSdk;
  try {
    const client = await import('@modelcontextprotocol/sdk/client/index.js');
    const stdio = await import('@modelcontextprotocol/sdk/client/stdio.js');
    const sse = await import('@modelcontextprotocol/sdk/client/sse.js');
    mcpSdk = {
      Client: client.Client,
      StdioClientTransport: stdio.StdioClientTransport,
      SSEClientTransport: sse.SSEClientTransport
    };
    return mcpSdk;
  } catch (e) {
    console.error("Failed to load MCP SDK:", e);
    throw e;
  }
}

// --- Create Application Menu to enable Shortcuts (Ctrl+C, Ctrl+V, etc.) ---
// This must be set for shortcuts to work, especially in frameless windows on Windows/Linux
const createMenu = () => {
  const isMac = process.platform === 'darwin';

  const template = [
    // { role: 'appMenu' }
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    // { role: 'fileMenu' }
    {
      label: 'File',
      submenu: [
        { role: 'quit' }
      ]
    },
    // { role: 'editMenu' }
    {
      label: 'Edit',
      submenu: [
        { role: 'undo', accelerator: 'CmdOrCtrl+Z' },
        { role: 'redo', accelerator: 'CmdOrCtrl+Y' },
        { type: 'separator' },
        { role: 'cut', accelerator: 'CmdOrCtrl+X' },
        { role: 'copy', accelerator: 'CmdOrCtrl+C' },
        { role: 'paste', accelerator: 'CmdOrCtrl+V' },
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll', accelerator: 'CmdOrCtrl+A' }
      ]
    },
    // { role: 'viewMenu' }
    {
      label: 'View',
      submenu: [
        { role: 'reload', accelerator: 'CmdOrCtrl+R' },
        { role: 'forceReload', accelerator: 'CmdOrCtrl+Shift+R' },
        { role: 'toggleDevTools', accelerator: 'F12' },
        { type: 'separator' },
        { role: 'resetZoom', accelerator: 'CmdOrCtrl+0' },
        { role: 'zoomIn', accelerator: 'CmdOrCtrl+Plus' },
        { role: 'zoomOut', accelerator: 'CmdOrCtrl+-' },
        { type: 'separator' },
        { role: 'togglefullscreen', accelerator: 'F11' }
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            await shell.openExternal('https://electronjs.org');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

const createWindow = async () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false, // Frameless for custom titlebar
    titleBarStyle: 'hidden',
    backgroundColor: '#1e1e1e', // Match theme
    webPreferences: {
      nodeIntegration: true, // Allow using Node.js features in the renderer
      contextIsolation: false, // Required for simple IPC communication in this setup
      webSecurity: false // Allow loading resources
    },
    icon: path.join(__dirname, 'icon.png')
  });

  // Load the app via Vite dev server
  const isDev = !app.isPackaged;
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  // Handle Permission Requests (Fix for Clipboard API errors)
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['clipboard-read', 'clipboard-write', 'media'];
    if (allowedPermissions.includes(permission)) {
      callback(true);
    } else {
      callback(false);
    }
  });

  // IPC Event Handlers for Custom Title Bar
  ipcMain.on('app-minimize', () => {
    mainWindow.minimize();
  });

  ipcMain.on('app-maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  ipcMain.on('app-close', () => {
    mainWindow.close();
  });

  // Show item in folder
  ipcMain.on('show-in-folder', (event, fullPath) => {
    if (fullPath) {
      shell.showItemInFolder(fullPath);
    }
  });

  // --- Native File System Operations ---

  // Read File
  ipcMain.handle('read-file', async (event, filePath) => {
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      const stats = await fs.promises.stat(filePath);
      return { content, lastModified: stats.mtimeMs };
    } catch (error) {
      console.error('Failed to read file:', error);
      throw error;
    }
  });

  // Write File
  ipcMain.handle('write-file', async (event, filePath, content) => {
    try {
      await fs.promises.writeFile(filePath, content, 'utf8');
      return true;
    } catch (error) {
      console.error('Failed to write file:', error);
      throw error;
    }
  });

  // Open File Dialog
  ipcMain.handle('open-file-dialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Markdown & Text', extensions: ['md', 'markdown', 'txt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    return result.filePaths;
  });

  // Save File Dialog
  ipcMain.handle('save-file-dialog', async (event, defaultName) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultName,
      filters: [
        { name: 'Markdown', extensions: ['md'] },
        { name: 'Text', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    return result.filePath;
  });

  // --- Local AI Proxy (Avoids CORS in Renderer) ---
  ipcMain.handle('chat-local-ai', async (event, { baseUrl, modelName, messages, apiKey, tools }) => {
    // 1. Prepare logic to fetch from a specific URL
    const doFetch = async (targetUrl) => {
        console.log(`[Local AI] Requesting: ${targetUrl}`);
        const headers = { 'Content-Type': 'application/json' };
        
        // Add Authorization header if apiKey is present
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

        const payload = {
            model: modelName,
            messages: messages,
            stream: false
        };

        // Inject tools if present
        if (tools && Array.isArray(tools) && tools.length > 0) {
            payload.tools = tools;
            payload.tool_choice = "auto";
        }

        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Local AI Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        // Return the whole message object (content + tool_calls)
        return data.choices?.[0]?.message || { content: "" }; 
    };

    // 2. Clean up base URL
    // Remove trailing slashes and potential trailing /chat/completions if user added it manually
    let cleanBase = baseUrl.replace(/\/+$/, '').replace(/\/chat\/completions$/, '');
    
    // 3. Construct default URL
    const defaultUrl = `${cleanBase}/chat/completions`;

    try {
        return await doFetch(defaultUrl);
    } catch (error) {
        // 4. Smart Retry Logic for 404s
        // If we get a 404 and the URL didn't have /v1, try adding it.
        // This fixes common config errors with Ollama (localhost:11434 vs localhost:11434/v1)
        if (error.message.includes('404') && !cleanBase.includes('/v1')) {
            console.log("[Local AI] 404 encountered. Retrying with /v1 prefix...");
            const v1Url = `${cleanBase}/v1/chat/completions`;
            return await doFetch(v1Url);
        }
        
        console.error("Main Process Local AI Request Failed:", error);
        throw error; 
    }
  });

  // --- MCP (Model Context Protocol) Implementation ---

  // Connect to Servers
  ipcMain.handle('mcp-connect', async (event, serverConfigs) => {
    const sdk = await ensureMcpSdk();
    
    // Close existing clients not in new config or if re-connect forced
    for (const [id, clientObj] of mcpClients.entries()) {
        try {
            await clientObj.client.close();
        } catch(e) { console.error(`Error closing client ${id}`, e); }
    }
    mcpClients.clear();

    const results = [];

    for (const config of serverConfigs) {
        if (!config.enabled) continue;

        try {
            let transport;
            if (config.type === 'stdio') {
                transport = new sdk.StdioClientTransport({
                    command: config.command,
                    args: config.args || [],
                    env: { ...process.env, ...(config.env || {}) }
                });
            } else if (config.type === 'sse') {
                transport = new sdk.SSEClientTransport({
                    url: new URL(config.url),
                });
            } else {
                continue;
            }

            const client = new sdk.Client(
                { name: "WinMD-Explorer", version: "1.0.0" },
                { capabilities: {} }
            );

            await client.connect(transport);
            
            mcpClients.set(config.id, { client, config });
            results.push({ id: config.id, status: 'connected' });
            console.log(`MCP Connected: ${config.name}`);

        } catch (error) {
            console.error(`MCP Connection Failed [${config.name}]:`, error);
            results.push({ id: config.id, status: 'error', error: error.message });
        }
    }
    return results;
  });

  // Test Connection
  ipcMain.handle('mcp-test-connection', async (event, config) => {
    const sdk = await ensureMcpSdk();
    let client = null;
    try {
        let transport;
        if (config.type === 'stdio') {
             if (!config.command) throw new Error("Command is required");
             transport = new sdk.StdioClientTransport({
                command: config.command,
                args: config.args || [],
                env: { ...process.env, ...(config.env || {}) }
            });
        } else if (config.type === 'sse') {
            if (!config.url) throw new Error("URL is required");
            transport = new sdk.SSEClientTransport({
                url: new URL(config.url),
            });
        } else {
            throw new Error("Unknown transport type");
        }

        client = new sdk.Client(
            { name: "WinMD-Explorer-Test", version: "1.0.0" },
            { capabilities: {} }
        );

        // Set a timeout for connection test to avoid hanging
        const connectPromise = client.connect(transport);
        // Increase timeout to 15s to account for potential npx download times
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Connection timed out (15s)")), 15000));
        
        await Promise.race([connectPromise, timeoutPromise]);
        
        const tools = await client.listTools();
        await client.close();
        
        return { 
            success: true, 
            toolCount: tools.tools.length, 
            toolNames: tools.tools.map(t => t.name) // Return names for UI
        };

    } catch (error) {
        console.error("MCP Test Failed:", error);
        try { if (client) await client.close(); } catch(e) {}
        return { success: false, error: error.message };
    }
  });

  // List Tools
  ipcMain.handle('mcp-list-tools', async () => {
    const allTools = [];
    
    for (const [id, { client, config }] of mcpClients.entries()) {
        try {
            const result = await client.listTools();
            if (result && result.tools) {
                // Tag tools with server ID so we know who to call later
                const taggedTools = result.tools.map(t => ({
                    ...t,
                    serverId: id,
                    serverName: config.name
                }));
                allTools.push(...taggedTools);
            }
        } catch (e) {
            console.error(`Error listing tools for ${config.name}:`, e);
        }
    }
    return allTools;
  });

  // Call Tool
  ipcMain.handle('mcp-call-tool', async (event, { serverId, toolName, args }) => {
     const clientObj = mcpClients.get(serverId);
     if (!clientObj) {
         throw new Error(`Server ${serverId} not found or not connected.`);
     }

     try {
         const result = await clientObj.client.callTool({
             name: toolName,
             arguments: args
         });
         return result;
     } catch (e) {
         console.error(`Error calling tool ${toolName} on ${clientObj.config.name}:`, e);
         throw e;
     }
  });
};

app.whenReady().then(() => {
  createMenu(); // Set menu immediately
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Clean up MCP clients
  for (const { client } of mcpClients.values()) {
      try { client.close(); } catch(e) {}
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});