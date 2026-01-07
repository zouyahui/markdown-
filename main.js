const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Global reference to prevent garbage collection
let mainWindow;

const createWindow = async () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false, // Frameless for custom titlebar
    titleBarStyle: 'hidden',
    backgroundColor: '#000000',
    webPreferences: {
      nodeIntegration: true, // Allow using Node.js features in the renderer
      contextIsolation: false, // Required for simple IPC communication in this setup
      webSecurity: false // Allow loading resources
    },
    icon: path.join(__dirname, 'icon.png')
  });

  // Load the app via Vite dev server
  // Note: 'npm start' runs vite concurrently on port 5173
  // In production, you would load the dist/index.html file
  const isDev = !app.isPackaged;
  
  if (isDev) {
    // Wait for Vite to start? Usually concurrently handles it well enough
    mainWindow.loadURL('http://localhost:5173');
    // mainWindow.webContents.openDevTools(); // Optional: Open DevTools
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

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
});