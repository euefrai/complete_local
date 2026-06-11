const { app, BrowserWindow, Menu } = require('electron');
const { fork } = require('child_process');
const path = require('path');
const net = require('net');

let mainWindow = null;
let serverProcess = null;
const SERVER_PORT = 3000;

function isPortListening(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let completed = false;

    socket.setTimeout(300);

    const done = (isListening) => {
      if (completed) return;
      completed = true;
      socket.destroy();
      resolve(isListening);
    };

    socket.on('connect', () => done(true));
    socket.on('timeout', () => done(false));
    socket.on('error', () => done(false));
    socket.connect(port, '127.0.0.1');
  });
}

// Check if a port is available (server is running)
function waitForServer(port, maxAttempts = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      attempts++;
      const socket = new net.Socket();
      let completed = false;

      socket.setTimeout(300);

      const done = (err) => {
        if (completed) return;
        completed = true;
        socket.destroy();

        if (err) {
          if (attempts >= maxAttempts) {
            reject(err);
          } else {
            setTimeout(check, 300);
          }
        } else {
          resolve();
        }
      };

      socket.on('connect', () => {
        done(null);
      });

      socket.on('timeout', () => {
        done(new Error('Server startup timed out'));
      });

      socket.on('error', (err) => {
        done(err);
      });

      socket.connect(port, '127.0.0.1');
    };
    check();
  });
}

// Start the Express backend server in-process
async function startServer() {
  if (await isPortListening(SERVER_PORT)) {
    console.log(`Backend server already running on port ${SERVER_PORT}; reusing it.`);
    return;
  }

  console.log('Starting Express backend server in-process...');
  try {
    process.env.PORT = SERVER_PORT.toString();
    require('./server.js');
  } catch (err) {
    console.error('Failed to load in-process Express server:', err);
  }
}

// Kill the server process cleanly
function stopServer() {
  // No-op: the in-process server is automatically cleaned up when Electron exits
}

// Create the main application window
function createWindow() {
  // Hide the default menu bar for a cleaner native look
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Vexx AI Debate Arena',
    icon: path.join(__dirname, 'public', 'favicon.ico'),
    backgroundColor: '#0d0f12',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    show: false // Don't show until ready
  });

  // Load the Express server URL
  mainWindow.loadURL(`http://localhost:${SERVER_PORT}`);

  // Show window when content is ready (avoids white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(async () => {
  console.log('Starting Vexx AI Debate Arena Desktop...');
  
  // 1. Start the backend server
  await startServer();
  
  // 2. Wait for the server to be ready
  try {
    await waitForServer(SERVER_PORT);
    console.log(`Server is ready on port ${SERVER_PORT}`);
  } catch (err) {
    console.error('Could not connect to backend server:', err.message);
    app.quit();
    return;
  }
  
  // 3. Create the desktop window
  createWindow();

  // macOS: re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  stopServer();
  app.quit();
});

// Clean up on before-quit
app.on('before-quit', () => {
  stopServer();
});

// Handle process termination signals
process.on('SIGINT', () => {
  stopServer();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopServer();
  process.exit(0);
});
