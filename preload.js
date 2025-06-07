const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSetting: (key, value) => ipcRenderer.send('set-setting', { key, value }),
  selectFolder: () => ipcRenderer.invoke('open-folder-dialog'),
  openSettings: () => ipcRenderer.send('open-settings'),
  openDownloads: () => ipcRenderer.send('open-downloads'),
  setTheme: (theme) => ipcRenderer.send('set-setting', { key: 'theme', value: theme }),
  onThemeChanged: (callback) => ipcRenderer.on('theme-changed', (event, theme) => callback(theme))
});

