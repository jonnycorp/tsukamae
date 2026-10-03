'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { BrowserWindow, Menu, app, ipcMain, net, protocol, screen, shell } = require('electron');

const DEV_SERVER_URL = 'http://localhost:9898';
const SAVE_DEBOUNCE_MS = 300;
const BUILD_DIR = path.join(__dirname, '..', 'build');
// page area, not window: two boxes across at their native size, and a whole row of them down
const DEFAULT_SIZE = { width: 1400, height: 900 };
// narrow enough for the list view (under 750px), short of collapsing
const MIN_SIZE = { width: 480, height: 480 };
// generous title bar + border allowance when checking the default against a screen
const FRAME = { width: 40, height: 80 };
// keep in sync with $nav-height in app/styles/variables.scss
const NAV_HEIGHT = 54;
// Windows and Linux: the app's nav is the title bar; the native bar (and its page title) goes, and the system window
// buttons float over the nav's right end, recoloured with each theme (window:title-bar); macOS keeps its native bar
const TITLE_BAR = process.platform === 'darwin'
  ? {}
  : { titleBarStyle: 'hidden', titleBarOverlay: { color: '#f4c9ac', symbolColor: '#543428', height: NAV_HEIGHT } };

// yarn electron:dev:fresh runs on a throwaway profile, so testing never touches real progress
if (process.argv.includes('--fresh')) {
  app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'tsukamae-')));
}

function progressFile () {
  return path.join(app.getPath('userData'), 'dex_data.json');
}

// set while the data file on disk is one that couldn't be read or parsed: the load error screen still offers Import, and
// the first write after copies that file aside before replacing it, so restoring an export never destroys the only copy
let unreadable = false;

// the first keeps the name the error screen gives; a later one is numbered rather than written over it
function unreadableFile (n) {
  return path.join(app.getPath('userData'), n > 1 ? `dex_data.unreadable-${n}.json` : 'dex_data.unreadable.json');
}

// the tracker as the renderer last left it: replaced whole by a save, edited in place by a tile's patch
let latestProgress = null;
// bumped by every change, so a write knows which changes it caught, and one made while it wrote still gets written
let revision = 0;
let savedRevision = 0;
let saveTimer = null;
// writes are debounced, atomic (temp file + rename) and serialized, so two can never share the temp file or land out of order
let writeChain = Promise.resolve();
// a write waiting behind the one in flight; it saves whatever is newest when it starts, so one is ever enough
let queuedWrite = null;
let flushedForQuit = false;
// bumped by each session-end save that lands, so a write already in flight never renames an older snapshot over it
let sessionSaves = 0;
// what the renderer was last told, so it hears about a failed save, and the recovery after, once each
let saveOk = true;

// antivirus, the search indexer or a backup tool can hold a file on Windows for a moment; those errors pass on a retry
const TRANSIENT_ERRORS = new Set(['EPERM', 'EACCES', 'EBUSY']);

async function retrying (task) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await task();
    } catch (err) {
      if (!TRANSIENT_ERRORS.has(err.code) || attempt === 20) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 100 * Math.min(attempt, 5)));
    }
  }
}

// copied rather than moved, so there's a dex_data.json at every moment until the new file's rename replaces it
async function setAside (file) {
  for (let n = 1; ; n++) {
    try {
      return await retrying(() => fsp.copyFile(file, unreadableFile(n), fs.constants.COPYFILE_EXCL));
    } catch (err) {
      if (err.code !== 'EEXIST') {
        throw err;
      }
    }
  }
}

function setAsideSync (file) {
  for (let n = 1; ; n++) {
    try {
      return fs.copyFileSync(file, unreadableFile(n), fs.constants.COPYFILE_EXCL);
    } catch (err) {
      if (err.code !== 'EEXIST') {
        throw err;
      }
    }
  }
}

// the text is taken before the first wait, so patches landing during the write can't tear it
async function writeProgress (text) {
  const generation = sessionSaves;
  const file = progressFile();
  const tmp = `${file}.tmp`;
  await fsp.mkdir(path.dirname(file), { recursive: true });
  // on disk before the rename, so a power cut can't swap in a file that was never written
  const handle = await retrying(() => fsp.open(tmp, 'w'));
  try {
    await handle.writeFile(text);
    await handle.sync();
  } finally {
    await handle.close();
  }
  if (unreadable) {
    await setAside(file).catch((err) => {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    });
    unreadable = false;
  }
  // checked inside the retry, whose waits are where a shutdown's save can land first; false when one did
  return retrying(async () => {
    if (generation !== sessionSaves) {
      return false;
    }
    await fsp.rename(tmp, file);
    return true;
  });
}

// Windows shutdown and logoff skip the quit events, so the last save can't wait on anything
function flushSaveSync () {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (revision === savedRevision || !latestProgress) {
    return;
  }
  const file = progressFile();
  const tmp = `${file}.session-end.tmp`;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const fd = fs.openSync(tmp, 'w');
    try {
      fs.writeFileSync(fd, JSON.stringify(latestProgress, null, 2));
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    if (unreadable) {
      try {
        setAsideSync(file);
      } catch (err) {
        if (err.code !== 'ENOENT') {
          throw err;
        }
      }
      unreadable = false;
    }
    fs.renameSync(tmp, file);
    sessionSaves++;
    savedRevision = revision;
  } catch (err) {
    console.error('failed to save progress:', err);
  }
}

// a failed save is otherwise only in this console, and the renderer carries on as if its changes were safe
function reportSaveStatus (ok) {
  if (ok !== saveOk) {
    saveOk = ok;
    BrowserWindow.getAllWindows()[0]?.webContents.send('tracker:save-status', ok);
  }
}

// queues a write of whatever is newest when its turn comes, unless one is already waiting; never rejects
function flushSave () {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (!queuedWrite) {
    queuedWrite = writeChain = writeChain.then(async () => {
      // cleared as it starts, so a change made while it writes queues the next one
      queuedWrite = null;
      // nothing to write before a tracker exists here: a load that failed, an import that was refused
      if (revision !== savedRevision && latestProgress) {
        const written = revision;
        if (await writeProgress(JSON.stringify(latestProgress, null, 2))) {
          savedRevision = Math.max(savedRevision, written);
        }
      }
      reportSaveStatus(true);
    }).catch((err) => {
      console.error('failed to save progress:', err);
      reportSaveStatus(false);
    });
  }
  return writeChain;
}

function markChanged () {
  revision++;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, SAVE_DEBOUNCE_MS);
}

function scheduleSave (progress) {
  latestProgress = progress;
  markChanged();
}

// a tile's record (null once released) merged into the tracker held here; false when there's no such dex to merge
// into, and the renderer sends the whole tracker instead
function applyPatch (dexId, entries) {
  const dex = Array.isArray(latestProgress?.dexes) ? latestProgress.dexes.find((entry) => entry?.id === dexId) : null;
  if (!dex || typeof dex.progress !== 'object' || dex.progress === null || typeof entries !== 'object' || entries === null) {
    return false;
  }
  for (const [id, entry] of Object.entries(entries)) {
    if (entry === null) {
      delete dex.progress[id];
    } else {
      dex.progress[id] = entry;
    }
  }
  markChanged();
  return true;
}

function windowStateFile () {
  return path.join(app.getPath('userData'), 'window-state.json');
}

// null when there's none, or its window was centred on a display that's since gone; otherwise clamped to that display,
// so a window saved on a bigger or less scaled screen keeps its title bar buttons on this one
function readWindowState () {
  try {
    const state = JSON.parse(fs.readFileSync(windowStateFile(), 'utf8'));
    const { x, y, width, height } = state.bounds;
    if (![x, y, width, height].every(Number.isInteger) || width <= 0 || height <= 0) {
      return null;
    }
    const cx = x + width / 2;
    const cy = y + height / 2;
    const display = screen.getAllDisplays().find(({ workArea: area }) =>
      cx >= area.x && cx < area.x + area.width && cy >= area.y && cy < area.y + area.height);
    if (!display) {
      return null;
    }
    const area = display.workArea;
    const w = Math.min(width, area.width);
    const h = Math.min(height, area.height);
    return {
      maximized: Boolean(state.maximized),
      bounds: {
        width: w,
        height: h,
        x: Math.min(Math.max(x, area.x), area.x + area.width - w),
        y: Math.min(Math.max(y, area.y), area.y + area.height - h),
      },
    };
  } catch {
    return null;
  }
}

// the page never zooms (the dex has its own zoom): at anything but 100% the nav stops matching the window buttons drawn
// over it, which stay NAV_HEIGHT tall; at a leftover 91% it sat 5px short of them
function pinZoom (webContents) {
  if (webContents.getZoomLevel() !== 0) {
    webContents.setZoomLevel(0);
  }
}

// Windows reports a minimized window as neither maximized nor fullscreen, so those are passed in as last seen
function saveWindowState (win, maximized) {
  const state = { bounds: win.getNormalBounds(), maximized: win.isMinimized() ? maximized : win.isMaximized() || win.isFullScreen() };
  try {
    fs.writeFileSync(windowStateFile(), JSON.stringify(state));
  } catch (err) {
    console.error('failed to save window state:', err);
  }
}

// app:// lets the bundle's absolute paths (publicPath '/', url('/pokesprite-v12.png')) resolve without a server
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function createWindow () {
  const saved = readWindowState();
  const { workAreaSize } = screen.getPrimaryDisplay();
  const width = Math.min(DEFAULT_SIZE.width, workAreaSize.width - FRAME.width);
  const height = Math.min(DEFAULT_SIZE.height, workAreaSize.height - FRAME.height);
  // a screen too small for the default opens maximized
  const maximize = saved ? saved.maximized : width < DEFAULT_SIZE.width || height < DEFAULT_SIZE.height;

  const win = new BrowserWindow({
    width,
    height,
    minWidth: MIN_SIZE.width,
    minHeight: MIN_SIZE.height,
    useContentSize: true,
    // the packaged exe carries it too; this covers `electron .`, whose exe is Electron's own (macOS takes the bundle's)
    icon: path.join(__dirname, process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    ...TITLE_BAR,
    // shown once painted, so launch never flashes an unthemed page
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (saved) {
    win.setBounds(saved.bounds);
  }

  win.once('ready-to-show', () => {
    if (maximize) {
      win.maximize();
      // maximizing a hidden window shows it on macOS, but doesn't focus it
      if (process.platform === 'darwin') {
        win.focus();
      }
    } else {
      win.show();
    }
  });

  let maximized = false;
  win.on('maximize', () => {
    maximized = true;
  });
  win.on('unmaximize', () => {
    maximized = false;
  });
  win.on('enter-full-screen', () => {
    maximized = true;
  });
  win.on('leave-full-screen', () => {
    maximized = win.isMaximized();
  });
  win.on('close', () => saveWindowState(win, maximized));
  // shutdown and logoff close nothing gracefully and skip the quit events
  win.on('session-end', () => {
    saveWindowState(win, maximized);
    flushSaveSync();
  });
  win.webContents.on('did-navigate', () => pinZoom(win.webContents));

  // there's no menu bar on Windows, so the shortcuts it carried live here
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') {
      return;
    }
    const key = input.key.toLowerCase();
    const mod = input.control || input.meta;
    if (key === 'f11') {
      win.setFullScreen(!win.isFullScreen());
    } else if (!app.isPackaged && (key === 'f12' || (mod && input.shift && key === 'i'))) {
      win.webContents.toggleDevTools();
    } else if (!app.isPackaged && (key === 'f5' || (mod && key === 'r'))) {
      win.webContents.reload();
    } else {
      return;
    }
    event.preventDefault();
  });

  // the page only ever reloads itself (after an import, or the dev server's live reload); anywhere else, such as a file
  // dropped on the window, would replace the app with that file, and a packaged build can't reload its way back
  win.webContents.on('will-navigate', (event) => {
    if (event.url !== win.webContents.getURL()) {
      event.preventDefault();
    }
  });

  // the only links out are to reference sites; nothing but the web leaves the app
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  if (app.isPackaged || process.env.TSUKAMAE_LOAD_BUILD) {
    win.loadURL('app://bundle/');
  } else {
    win.loadURL(DEV_SERVER_URL);
  }
}

// no menu bar on Windows; macOS keeps the standard menus, which carry Cmd+Q and the clipboard shortcuts
function buildMenu () {
  Menu.setApplicationMenu(process.platform === 'darwin'
    ? Menu.buildFromTemplate([
      { role: 'appMenu' },
      { role: 'editMenu' },
      { label: 'View', submenu: [{ role: 'togglefullscreen' }] },
      { role: 'windowMenu' },
    ])
    : null);
}

// a second copy would race this one's writes to the same file, so it hands over and exits
if (app.requestSingleInstanceLock()) {
  // no file is a first run; a file that can't be read or parsed is an error, never an empty tracker, or the next save
  // would write that over it
  ipcMain.handle('tracker:load', async (event) => {
    await flushSave();
    // a reloaded page starts out believing its saves land; it hears otherwise from here, not from a change of status
    if (!saveOk) {
      event.sender.send('tracker:save-status', false);
    }
    // saves aren't reaching the disk, so the tracker held here is newer than the file, and is what a reload must show
    if (latestProgress && revision !== savedRevision) {
      return latestProgress;
    }
    let text;
    try {
      text = await retrying(() => fsp.readFile(progressFile(), 'utf8'));
    } catch (err) {
      latestProgress = null;
      if (err.code === 'ENOENT') {
        unreadable = false;
        return {};
      }
      unreadable = true;
      throw err;
    }
    try {
      // a hand edit in Notepad can leave a byte-order mark, which JSON.parse refuses
      const progress = JSON.parse(text.replace(/^\uFEFF/, ''));
      // JSON that isn't tracker state (a 1.x captures map, a hand edit that broke the shape) would open as an empty
      // tracker for the first save to replace, so it's refused like a file that can't be parsed; {} is a first run
      const isState = Boolean(progress) && typeof progress === 'object' && !Array.isArray(progress) &&
        (Array.isArray(progress.dexes) || Object.keys(progress).length === 0);
      if (!isState) {
        throw new Error('dex_data.json does not hold tracker data');
      }
      unreadable = false;
      // the copy patches merge into (the renderer gets a clone); it saves the whole tracker if loading changed any of it
      latestProgress = progress;
      savedRevision = revision;
      return progress;
    } catch (err) {
      latestProgress = null;
      unreadable = true;
      throw err;
    }
  });

  ipcMain.handle('tracker:save', (_event, progress) => {
    scheduleSave(progress);
  });

  // a tile's change: just the records that changed, rather than the whole tracker every click
  ipcMain.handle('tracker:patch', (_event, patch) => applyPatch(patch?.dexId, patch?.entries));

  // unlike a save, resolves only once the import is on disk, so a failure leaves the renderer on the old data
  ipcMain.handle('tracker:import', async (_event, progress) => {
    const previous = latestProgress;
    scheduleSave(progress);
    const imported = revision;
    await flushSave();
    // refused too if something replaced it before it was written: the file then holds that, not the import
    if (savedRevision < imported || latestProgress !== progress) {
      // a refused import mustn't land later, with the next save or at quit; what it replaced is pending again
      if (latestProgress === progress) {
        latestProgress = previous;
        if (previous) {
          revision++;
        } else {
          savedRevision = revision;
        }
      }
      throw new Error('the import could not be saved');
    }
  });

  // the renderer sends its nav colours on every theme change, so the window buttons match the bar they sit on
  ipcMain.on('window:title-bar', (event, colors) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && TITLE_BAR.titleBarOverlay && typeof colors?.color === 'string' && typeof colors?.symbolColor === 'string') {
      win.setTitleBarOverlay({ color: colors.color, symbolColor: colors.symbolColor, height: NAV_HEIGHT });
    }
  });

  // the renderer reports every change of pixel ratio, which a page zoom is one of
  ipcMain.on('window:pin-zoom', (event) => pinZoom(event.sender));

  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) {
        win.restore();
      }
      win.focus();
    }
  });

  app.whenReady().then(() => {
    protocol.handle('app', async (request) => {
      const { pathname } = new URL(request.url);
      const relativePath = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
      const target = path.normalize(path.join(BUILD_DIR, relativePath));
      if (!target.startsWith(BUILD_DIR + path.sep)) {
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

    buildMenu();
    createWindow();
  });

  // quitting waits for the last write, including one already in flight and one a closing window sent on its way out
  // (will-quit comes after the windows have closed; on macOS before-quit comes before)
  app.on('will-quit', (event) => {
    if (flushedForQuit || (saveTimer === null && revision === savedRevision)) {
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
} else {
  // `electron .` shares the installed app's profile, and so this lock; under concurrently -k the dev server goes too
  if (!app.isPackaged) {
    console.error('tsukamae is already running on this profile, so its window was focused instead; close it, or use yarn electron:dev:fresh');
  }
  app.quit();
}
