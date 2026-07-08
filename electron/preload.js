'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// The narrow bridge the React app uses for persistence. Saving happens
// automatically on every change — there is no user-facing save action.
contextBridge.exposeInMainWorld('tracker', {
  load: () => ipcRenderer.invoke('tracker:load'),
  save: (progress) => ipcRenderer.invoke('tracker:save', progress),
});
