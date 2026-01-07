const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const handler = require('serve-handler');

// Global reference to prevent garbage collection
let mainWindow;
let server;

// Create a simple local server to serve the app files
const startServer = () => {
  return new Promise((resolve) => {
    server = http.createServer((request, response) => {
      return handler(request, response, {
        public: __dirname,
        rewrites: [
          { source: '**', destination: '/index.html' }
        ]
      });
    });
    
    // Listen on a random available port
    server.listen(0, () => {
      resolve(server.address().port);
    });
  });
};

const createWindow = async () => {
  const port = await startServer();

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false, // Frameless for custom titlebar
    titleBarStyle: 'hidden',
    backgroundColor: '#000000',
    webPreferences: {
      nodeIntegration: true, // Allow using Node.js features in the renderer
      contextIsolation: false, // Required for simple IPC communication in this setup
      webSecurity: false // Allow loading resources from remote CDNs (esm.sh)
    },
    icon: path.join(__dirname, 'icon.png') // Optional: add an icon.png to root if you have one
  });

  // Load the app via the local server
  mainWindow.loadURL(`http://localhost:${port}`);

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
};

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
  if (server) {
    server.close();
  }
});