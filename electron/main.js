'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { BrowserWindow, Menu, app, ipcMain, net, protocol, shell } = require('electron');

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

function buildMenu () {
  const template = [
    {
      label: 'File',
      submenu: [
        // Import/Export live in the app UI (nav), not the native menu.
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

    // Files served over app:// arrive without a charset, so the renderer guesses
    // a legacy encoding and mangles non-ASCII text (é, the — placeholder, ♀/♂).
    // Force UTF-8 on text assets so it matches how the bundle is actually
    // written. (The <meta charset> in index.html is the belt to this braces.)
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
