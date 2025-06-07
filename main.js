const { app, BrowserWindow, session, ipcMain, net, Tray, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { ElectronBlocker } = require('@cliqz/adblocker-electron');
const fetch = require('cross-fetch');

let store;

(async () => {
  const Store = (await import('electron-store')).default;

  store = new Store({
    defaults: {
      theme: 'system',
      downloadsPath: path.join(app.getPath('downloads'), 'TheCub4'),
      adblockEnabled: true,
      notificationsEnabled: true,
      nickname: "",
      lastNotificationCheck: 0
    }
  });

  const downloadsPath = store.get('downloadsPath');
  fs.mkdirSync(downloadsPath, { recursive: true });

  let mainWindow;
  let splashWindow;
  let settingsWindow;
  let mystuffWindow;
  let tray;
  let isOnline = false;
  let lastNetworkCheck = 0;
  let networkPopupTimeout;
  
  
  // ✅ Enable ad blocking
  const blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);
  blocker.enableBlockingInSession(session.defaultSession);
  console.log("🔒 Ad blocker is active");

ElectronBlocker.fromPrebuiltFull(fetch).then(blocker => {
  blocker.enableBlockingInSession(session.defaultSession);

  blocker.on('request-blocked', (request) => {
    console.log('⛔ Blocked:', request.url);
  });

  blocker.on('request-whitelisted', (request) => {
    console.log('⚪ Whitelisted:', request.url);
  });

  blocker.on('request-redirected', (request) => {
    console.log('➡️ Redirected:', request.url);
  });

  console.log('🛡️ Full uBlock-style blocker is active.');
});

  function updateNetworkIndicator() {
    if (tray) {
      const iconName = isOnline ? 'online' : 'offline';
      tray.setImage(path.join(__dirname, `assets/icons/${iconName}.png`));
    }
  }

  function checkNetworkStatus() {
    const now = Date.now();
    if (now - lastNetworkCheck < 5000) return isOnline;

    lastNetworkCheck = now;
    const online = net.isOnline();
    if (online !== isOnline) {
      isOnline = online;
      updateNetworkIndicator();
      if (mainWindow) {
        mainWindow.webContents.send('network-status', isOnline);
        mainWindow.webContents.send('show-network-popup', isOnline);
        clearTimeout(networkPopupTimeout);
        networkPopupTimeout = setTimeout(() => {
          mainWindow.webContents.send('hide-network-popup');
        }, 10000);
      }
    }
    return isOnline;
  }
  

  // Splash screen
let audioWindow; // define globally at top alongside splashWindow, mainWindow, etc.

function createSplashScreen() {
  splashWindow = new BrowserWindow({
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

  splashWindow.loadFile(path.join(__dirname, 'assets/splash.html'));

  // Play audio in hidden window once splash is ready
  splashWindow.webContents.once('did-finish-load', () => {
    audioWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    audioWindow.loadURL(`data:text/html,
      <html>
        <body style="margin:0;background:black;">
          <audio autoplay loop>
            <source src="file://${__dirname}/assets/splash.mp3" type="audio/mp3" />
          </audio>
        </body>
      </html>
    `);
  });
  
 // hehe .. am a genius.. day 4 without sleeping finally blocked all ads
  // After 4 seconds close splash and open main window (audioWindow stays)
  setTimeout(() => {
    if (splashWindow) splashWindow.close();
    splashWindow = null;
    createMainWindow();
  }, 4000);
}


  function createMainWindow() {
    mainWindow = new BrowserWindow({
      width: 1024,
      height: 700,
      icon: path.join(__dirname, 'assets', 'logo.png'),
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        partition: 'persist:myAppSession'
      }
    });

 // Block popups, new windows, etc:
  mainWindow.webContents.setWindowOpenHandler(() => {
    console.log('Popup blocked');
    return { action: 'deny' };
  });

  mainWindow.loadURL('https://thecub4.vercel.app');
    mainWindow.webContents.setZoomFactor(0.8);

    mainWindow.on('closed', () => {
      mainWindow = null;
    });

    setAppMenu();
  }

  function createSettingsWindow() {
    if (settingsWindow) {
      settingsWindow.focus();
      return;
    }
    settingsWindow = new BrowserWindow({
      width: 500,
      height: 400,
      resizable: false,
      title: 'Settings',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    settingsWindow.loadFile(path.join(__dirname, 'assets/settings.html'));

    settingsWindow.on('closed', () => {
      settingsWindow = null;
    });
  }
  
function createDonateWindow() {
  const donateWindow = new BrowserWindow({
    width: 500,
    height: 400,
    title: 'Donate to The Cube',
    resizable: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  donateWindow.loadFile(path.join(__dirname, 'assets/donate.html'));

  donateWindow.on('closed', () => {
    donateWindow = null;
  });
}

function createDevelopersWindow() {
  const devWindow = new BrowserWindow({
    width: 600,
    height: 450,
    title: 'Developers',
    resizable: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  devWindow.loadFile(path.join(__dirname, 'assets/developers.html'));

  devWindow.on('closed', () => {
    devWindow = null;
  });
}

  function createMystuffWindow() {
    if (mystuffWindow) {
      mystuffWindow.focus();
      return;
    }
    mystuffWindow = new BrowserWindow({
      width: 600,
      height: 500,
      title: 'My Stuff',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    mystuffWindow.loadFile(path.join(__dirname, 'assets/downloads.html'));

    mystuffWindow.on('closed', () => {
      mystuffWindow = null;
    });
  }

function setAppMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'Settings', click: () => createSettingsWindow() },
        { type: 'separator' },
        { label: 'Exit', role: 'quit' }
      ]
    },
        {
      label: 'Home',
      click: () => {
        if (mainWindow) {
          mainWindow.loadURL('https://thecub4.vercel.app/browse');
        }
      }
    },
    {
      label: 'Refresh',
      click: () => {
        if (mainWindow) mainWindow.reload();
      }
    },
    {
      label: 'DOWNLOADS',
      click: () => {
        if (mainWindow) {
          mainWindow.loadURL('https://thecub4.vercel.app/embedded-download');
        }
      }
    },
    {
      label: 'Music',
      click: () => {
        if (mainWindow) {
          mainWindow.loadURL('https://cubic-stream.vercel.app');
        }
      }
    },
    {
      label: 'Donate',
      submenu: [
        {
          label: '💸 Donate',
          click: () => {
            createDonateWindow();
          }
        },
        {
          label: '👨‍💻 Developers',
          click: () => {
            createDevelopersWindow();
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
ipcMain.on('open-settings', () => {
  createSettingsWindow();
});

ipcMain.on('open-downloads', () => {
  createMystuffWindow();
});

// Add these two new handlers:
ipcMain.on('open-donate', () => {
  createDonateWindow();
});

ipcMain.on('open-developers', () => {
  createDevelopersWindow();
});


  app.whenReady().then(() => {
    createSplashScreen();
    checkNetworkStatus();
    setInterval(checkNetworkStatus, 5000);

    tray = new Tray(path.join(__dirname, 'assets/icons/offline.png'));
    tray.setToolTip('TheCub4 Network Status');
    updateNetworkIndicator();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
})();

