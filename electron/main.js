'use strict';

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

let latestProgress = null;
let savedProgress = null;
let saveTimer = null;
// writes are debounced, atomic (temp file + rename) and serialized, so two can never share the temp file or land out of order
let writeChain = Promise.resolve();
let flushedForQuit = false;

async function writeProgress (progress) {
  const file = progressFile();
  const tmp = `${file}.tmp`;
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(tmp, JSON.stringify(progress, null, 2));
  await fsp.rename(tmp, file);
}

// queues a write of whatever is newest when its turn comes; never rejects
function flushSave () {
  clearTimeout(saveTimer);
  saveTimer = null;
  writeChain = writeChain.then(async () => {
    if (latestProgress !== savedProgress) {
      const progress = latestProgress;
      await writeProgress(progress);
      savedProgress = progress;
    }
  }).catch((err) => console.error('failed to save progress:', err));
  return writeChain;
}

function scheduleSave (progress) {
  latestProgress = progress;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, SAVE_DEBOUNCE_MS);
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

// quitting waits for the last write, including one already in flight
app.on('before-quit', (event) => {
  if (flushedForQuit || (saveTimer === null && latestProgress === savedProgress)) {
    return;
  }
  event.preventDefault();
  flushSave().finally(() => {
    flushedForQuit = true;
    app.quit();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
