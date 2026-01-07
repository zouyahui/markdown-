const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const http = require('http');
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