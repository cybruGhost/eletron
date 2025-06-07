const { app, BrowserWindow, session, ipcMain, net, Tray, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { ElectronBlocker } = require('@cliqz/adblocker-electron');
const fetch = require('cross-fetch');

// Utility function to get correct asset paths in both dev and production
function getAssetPath(...paths) {
  const basePath = app.isPackaged 
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, 'assets');
  
  return path.join(basePath, ...paths);
}

// Global state
const state = {
  windows: {
    main: null,
    splash: null,
    settings: null,
    mystuff: null,
    donate: null,
    developers: null,
    audio: null
  },
  tray: null,
  isOnline: false,
  lastNetworkCheck: 0,
  networkPopupTimeout: null,
  blocker: null,
  store: null
};

async function initializeStore() {
  const Store = (await import('electron-store')).default;
  state.store = new Store({
    defaults: {
      theme: 'system',
      downloadsPath: path.join(app.getPath('downloads'), 'TheCub4'),
      adblockEnabled: true,
      notificationsEnabled: true,
      nickname: "",
      lastNotificationCheck: 0
    }
  });

  const downloadsPath = state.store.get('downloadsPath');
  if (!fs.existsSync(downloadsPath)) {
    fs.mkdirSync(downloadsPath, { recursive: true });
  }
}

async function initializeAdBlocker() {
  try {
    state.blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);
    state.blocker.enableBlockingInSession(session.defaultSession);
    console.log("🔒 Ad blocker is active");

    state.blocker = await ElectronBlocker.fromPrebuiltFull(fetch);
    state.blocker.enableBlockingInSession(session.defaultSession);
    console.log('🛡️ Full uBlock-style blocker is active.');
  } catch (error) {
    console.error('Failed to initialize ad blocker:', error);
  }
}

function updateNetworkIndicator() {
  if (state.tray && !state.tray.isDestroyed()) {
    const iconName = state.isOnline ? 'online' : 'offline';
    state.tray.setImage(getAssetPath('icons', `${iconName}.png`));
  }
}

function checkNetworkStatus() {
  const now = Date.now();
  if (now - state.lastNetworkCheck < 5000) return state.isOnline;

  state.lastNetworkCheck = now;
  const online = net.isOnline();
  if (online !== state.isOnline) {
    state.isOnline = online;
    updateNetworkIndicator();
    
    if (state.windows.main && !state.windows.main.isDestroyed()) {
      state.windows.main.webContents.send('network-status', state.isOnline);
      state.windows.main.webContents.send('show-network-popup', state.isOnline);
      clearTimeout(state.networkPopupTimeout);
      state.networkPopupTimeout = setTimeout(() => {
        if (state.windows.main && !state.windows.main.isDestroyed()) {
          state.windows.main.webContents.send('hide-network-popup');
        }
      }, 10000);
    }
  }
  return state.isOnline;
}

function createSplashScreen() {
  state.windows.splash = new BrowserWindow({
    width: 600,
    height: 400,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  state.windows.splash.loadFile(getAssetPath('splash.html'));

  state.windows.splash.webContents.once('did-finish-load', () => {
    state.windows.audio = new BrowserWindow({
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    state.windows.audio.loadURL(`data:text/html,
      <html>
        <body style="margin:0;background:black;">
          <audio autoplay loop>
            <source src="${getAssetPath('intro.mp3')}" type="audio/mp3" />
          </audio>
        </body>
      </html>
    `);
  });

  setTimeout(() => {
    if (state.windows.splash && !state.windows.splash.isDestroyed()) {
      state.windows.splash.close();
    }
    createMainWindow();
  }, 4000);
}

function createMainWindow() {
  if (state.windows.main && !state.windows.main.isDestroyed()) {
    state.windows.main.focus();
    return;
  }

  state.windows.main = new BrowserWindow({
    width: 1024,
    height: 700,
    icon: getAssetPath('logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      partition: 'persist:myAppSession'
    }
  });

  state.windows.main.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  state.windows.main.loadURL('https://thecub4.vercel.app');
  state.windows.main.webContents.setZoomFactor(0.8);

  state.windows.main.on('close', () => {
    // Close all other windows when main window closes
    Object.values(state.windows).forEach(win => {
      if (win && !win.isDestroyed() && win !== state.windows.main) {
        win.close();
      }
    });
  });

  state.windows.main.on('closed', () => {
    state.windows.main = null;
  });

  setupApplicationMenu();
}

function createSettingsWindow() {
  if (state.windows.settings && !state.windows.settings.isDestroyed()) {
    state.windows.settings.focus();
    return;
  }

  state.windows.settings = new BrowserWindow({
    width: 500,
    height: 400,
    resizable: false,
    title: 'Settings',
    icon: getAssetPath('logo.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  state.windows.settings.loadFile(getAssetPath('settings.html'))
    .catch(err => console.error('Failed to load settings window:', err));

  state.windows.settings.on('closed', () => {
    state.windows.settings = null;
  });
}

function createDonateWindow() {
  if (state.windows.donate && !state.windows.donate.isDestroyed()) {
    state.windows.donate.focus();
    return;
  }

  state.windows.donate = new BrowserWindow({
    width: 500,
    height: 400,
    title: 'Donate to The Cube',
    resizable: false,
    icon: getAssetPath('logo.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  state.windows.donate.loadFile(getAssetPath('donate.html'))
    .catch(err => console.error('Failed to load donate window:', err));

  state.windows.donate.on('closed', () => {
    state.windows.donate = null;
  });
}

function createDevelopersWindow() {
  if (state.windows.developers && !state.windows.developers.isDestroyed()) {
    state.windows.developers.focus();
    return;
  }

  state.windows.developers = new BrowserWindow({
    width: 600,
    height: 450,
    title: 'Developers',
    resizable: false,
    icon: getAssetPath('logo.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  state.windows.developers.loadFile(getAssetPath('developers.html'))
    .catch(err => console.error('Failed to load developers window:', err));

  state.windows.developers.on('closed', () => {
    state.windows.developers = null;
  });
}

function createMystuffWindow() {
  if (state.windows.mystuff && !state.windows.mystuff.isDestroyed()) {
    state.windows.mystuff.focus();
    return;
  }

  state.windows.mystuff = new BrowserWindow({
    width: 600,
    height: 500,
    title: 'My Stuff',
    icon: getAssetPath('logo.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  state.windows.mystuff.loadFile(getAssetPath('downloads.html'))
    .catch(err => console.error('Failed to load mystuff window:', err));

  state.windows.mystuff.on('closed', () => {
    state.windows.mystuff = null;
  });
}

function setupApplicationMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'Settings', click: createSettingsWindow },
        { type: 'separator' },
        { label: 'Exit', role: 'quit' }
      ]
    },
    {
      label: 'Home',
      click: () => {
        if (state.windows.main && !state.windows.main.isDestroyed()) {
          state.windows.main.loadURL('https://thecub4.vercel.app/browse');
        }
      }
    },
    {
      label: 'Refresh',
      click: () => {
        if (state.windows.main && !state.windows.main.isDestroyed()) {
          state.windows.main.reload();
        }
      }
    },
    {
      label: 'DOWNLOADS',
      click: () => {
        if (state.windows.main && !state.windows.main.isDestroyed()) {
          state.windows.main.loadURL('https://thecub4.vercel.app/embedded-download');
        }
      }
    },
    {
      label: 'Music',
      click: () => {
        if (state.windows.main && !state.windows.main.isDestroyed()) {
          state.windows.main.loadURL('https://cubic-stream.vercel.app');
        }
      }
    },
    {
      label: 'Donate',
      submenu: [
        { label: '💸 Donate', click: createDonateWindow },
        { label: '👨‍💻 Developers', click: createDevelopersWindow }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function setupIPCListeners() {
  ipcMain.on('open-settings', createSettingsWindow);
  ipcMain.on('open-downloads', createMystuffWindow);
  ipcMain.on('open-donate', createDonateWindow);
  ipcMain.on('open-developers', createDevelopersWindow);
}

// Update your cleanup function
function cleanup() {
  // Close all windows
  Object.values(state.windows).forEach(win => {
    if (win && !win.isDestroyed()) {
      win.close();
    }
  });

  // Destroy tray
  if (state.tray && !state.tray.isDestroyed()) {
    state.tray.destroy();
  }

  // Clear timeouts
  clearTimeout(state.networkPopupTimeout);
}

async function initializeApp() {
  try {
    await initializeStore();
    await initializeAdBlocker();
    setupIPCListeners();

    app.whenReady().then(() => {
      createSplashScreen();
      checkNetworkStatus();
      setInterval(checkNetworkStatus, 5000);

      state.tray = new Tray(getAssetPath('icons', 'offline.png'));
      state.tray.setToolTip('TheCub4 Network Status');
      updateNetworkIndicator();
    });

// Update your window-all-closed handler
app.on('window-all-closed', () => {
  // Only quit if all windows are closed (including the main window)
  if (BrowserWindow.getAllWindows().length === 0) {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  }
});

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });

    app.on('before-quit', cleanup);
  } catch (error) {
    console.error('App initialization failed:', error);
    app.quit();
  }
}

initializeApp();
