'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { BrowserWindow, Menu, app, ipcMain, net, protocol, shell } = require('electron');

const DEV_SERVER_URL = 'http://localhost:9898';
const SAVE_DEBOUNCE_MS = 300;
const BUILD_DIR = path.join(__dirname, '..', 'build');

// yarn electron:dev:fresh points this at a temp dir so testing never touches real progress
if (process.env.TSUKAMAE_USER_DATA) {
  app.setPath('userData', process.env.TSUKAMAE_USER_DATA);
}

function progressFile () {
  return path.join(app.getPath('userData'), 'dex_data.json');
}

// the renderer sends the whole state on every change; writes are debounced, and atomic via temp file + rename
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

// synchronous so quitting right after a change never loses it
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
    return {};
  }
});

ipcMain.handle('tracker:save', (_event, progress) => {
  scheduleSave(progress);
});

// app:// lets the bundle's absolute paths (publicPath '/', url('/pokesprite-v12.png')) resolve without a server
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

function buildMenu () {
  const template = [
    {
      label: 'File',
      submenu: [
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
  protocol.handle('app', async (request) => {
    const { pathname } = new URL(request.url);
    const relativePath = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
    const target = path.normalize(path.join(BUILD_DIR, relativePath));
    if (!target.startsWith(BUILD_DIR)) {
      return new Response('Not found', { status: 404 });
    }

    const response = await net.fetch(pathToFileURL(target).toString());

    // app:// responses carry no charset, so the renderer would guess a legacy encoding and mangle é, ♀ and —
    const contentType = response.headers.get('content-type');
    if (contentType && /^(text\/|application\/(javascript|json))/.test(contentType) && !/charset/i.test(contentType)) {
      const headers = new Headers(response.headers);
      headers.set('content-type', `${contentType}; charset=utf-8`);
      return new Response(response.body, { status: response.status, headers });
    }

    return response;
  });

  createWindow();
  buildMenu();
});

app.on('before-quit', flushSaveSync);

app.on('window-all-closed', () => {
  app.quit();
});
