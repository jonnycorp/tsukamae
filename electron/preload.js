'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tracker', {
  load: () => ipcRenderer.invoke('tracker:load'),
  save: (progress) => ipcRenderer.invoke('tracker:save', progress),
  setTitleBarColors: (colors) => ipcRenderer.send('window:title-bar', colors),
  pinZoom: () => ipcRenderer.send('window:pin-zoom'),
});
