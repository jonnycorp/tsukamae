'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tracker', {
  load: () => ipcRenderer.invoke('tracker:load'),
  save: (progress) => ipcRenderer.invoke('tracker:save', progress),
});
