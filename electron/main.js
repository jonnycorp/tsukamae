'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { BrowserWindow, Menu, app, dialog, ipcMain, net, protocol, shell } = require('electron');

const DEV_SERVER_URL = 'http://localhost:9898';
const SAVE_DEBOUNCE_MS = 300;
const BUILD_DIR = path.join(__dirname, '..', 'build');

// Testing hook: redirect the app data directory so automated smoke tests
// never touch real progress.
if (process.env.TSUKAMAE_USER_DATA) {
  app.setPath('userData', process.env.TSUKAMAE_USER_DATA);
}

// All progress lives in a single JSON file in the per-user app data directory
// (e.g. %APPDATA%\tsukamae\captures.json on Windows) — never in the repo.
function progressFile () {
  return path.join(app.getPath('userData'), 'captures.json');
}

// ---------------------------------------------------------------------------
// Persistence: debounced, atomic writes. The renderer sends the full progress
// object on every change; we coalesce rapid changes into one write and always
// write via a temp file + rename so a crash can't corrupt the file.
// ---------------------------------------------------------------------------

let pendingProgress = null;
let saveTimer = null;

async function writeProgress (progress) {
  const file = progressFile();
  const tmp = `${file}.tmp`;
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(tmp, JSON.stringify(progress, null, 2));
  await fsp.rename(tmp, file);
}

async function flushSave () {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (pendingProgress) {
    const progress = pendingProgress;
    pendingProgress = null;
    await writeProgress(progress);
  }
}

function scheduleSave (progress) {
  pendingProgress = progress;
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    flushSave().catch((err) => console.error('failed to save progress:', err));
  }, SAVE_DEBOUNCE_MS);
}

// Synchronous last-chance flush so quitting right after a change never loses it.
function flushSaveSync () {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (pendingProgress) {
    const file = progressFile();
    const tmp = `${file}.tmp`;
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(tmp, JSON.stringify(pendingProgress, null, 2));
      fs.renameSync(tmp, file);
    } catch (err) {
      console.error('failed to save progress on quit:', err);
    }
    pendingProgress = null;
  }
}

ipcMain.handle('tracker:load', async () => {
  await flushSave();
  try {
    return JSON.parse(await fsp.readFile(progressFile(), 'utf8'));
  } catch {
    // First run (or unreadable file): start with an empty tracker.
    return {};
  }
});

ipcMain.handle('tracker:save', (_event, progress) => {
  scheduleSave(progress);
});

// ---------------------------------------------------------------------------
// Export / Import: the only way progress moves between machines.
// ---------------------------------------------------------------------------

async function exportProgress (win) {
  await flushSave();
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Export Progress',
    defaultPath: 'tsukamae-progress.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (canceled || !filePath) {
    return;
  }
  let contents = '{}';
  try {
    contents = await fsp.readFile(progressFile(), 'utf8');
  } catch {
    // No progress yet; export an empty object.
  }
  await fsp.writeFile(filePath, contents);
}

async function importProgress (win) {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Import Progress',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (canceled || filePaths.length === 0) {
    return;
  }
  let progress;
  try {
    progress = JSON.parse(await fsp.readFile(filePaths[0], 'utf8'));
    if (!progress || typeof progress !== 'object' || Array.isArray(progress)) {
      throw new Error('not a progress object');
    }
  } catch (err) {
    dialog.showErrorBox('Import Failed', `That file doesn't look like a Tsukamae progress export.\n\n${err.message}`);
    return;
  }
  const { response } = await dialog.showMessageBox(win, {
    type: 'warning',
    buttons: ['Replace', 'Cancel'],
    defaultId: 1,
    title: 'Import Progress',
    message: 'Importing will replace ALL current progress with the file contents. Continue?',
  });
  if (response !== 0) {
    return;
  }
  pendingProgress = null;
  await writeProgress(progress);
  win.reload();
}

// ---------------------------------------------------------------------------
// App / window setup
// ---------------------------------------------------------------------------

// Serve the built bundle over app:// so the SPA's absolute paths (publicPath
// '/', sprite sheet url('/pokesprite-v12.png')) resolve without a web server.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function createWindow () {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // External links (Bulbapedia, Serebii) open in the default browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (app.isPackaged || process.env.TSUKAMAE_LOAD_BUILD) {
    win.loadURL('app://bundle/');
  } else {
    win.loadURL(DEV_SERVER_URL);
  }

  return win;
}

function buildMenu (win) {
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'Export Progress…', click: () => exportProgress(win).catch((err) => dialog.showErrorBox('Export Failed', err.message)) },
        { label: 'Import Progress…', click: () => importProgress(win).catch((err) => dialog.showErrorBox('Import Failed', err.message)) },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    const relativePath = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
    const target = path.normalize(path.join(BUILD_DIR, relativePath));
    if (!target.startsWith(BUILD_DIR)) {
      return new Response('Not found', { status: 404 });
    }
    return net.fetch(pathToFileURL(target).toString());
  });

  const win = createWindow();
  buildMenu(win);
});

app.on('before-quit', flushSaveSync);

app.on('window-all-closed', () => {
  app.quit();
});
