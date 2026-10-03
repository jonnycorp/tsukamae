'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tracker', {
  load: () => ipcRenderer.invoke('tracker:load'),
  save: (progress) => ipcRenderer.invoke('tracker:save', progress),
  patch: (dexId, entries) => ipcRenderer.invoke('tracker:patch', { dexId, entries }),
  importState: (progress) => ipcRenderer.invoke('tracker:import', progress),
  onSaveStatus: (listener) => {
    const relay = (_event, ok) => listener(ok);
    ipcRenderer.on('tracker:save-status', relay);
    return () => ipcRenderer.removeListener('tracker:save-status', relay);
  },
  setTitleBarColors: (colors) => ipcRenderer.send('window:title-bar', colors),
  pinZoom: () => ipcRenderer.send('window:pin-zoom'),
});
