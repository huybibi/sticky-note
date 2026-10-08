'use strict';
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const {
  app,
  BrowserWindow,
  Menu,
  Notification,
  Tray,
  globalShortcut,
  ipcMain,
  nativeImage,
  screen,
  shell,
} = require('electron');
const store = require('./store');

const RENDERER = path.join(__dirname, '..', 'renderer');
const ICON = path.join(__dirname, '..', '..', 'assets', 'icon.png');
const MIN_W = 180;
const MIN_H = 110;
const COMPACT_H = 74;
const EDGE = 60; // phan cua so toi thieu phai con tren man hinh

const isDev = process.argv.includes('--dev');
const noteWins = new Map(); // noteId -> BrowserWindow
const live = new Map(); // webContents.id -> trang thai keo/keo gian
let captureWin = null;
let fontWin = null;
let tray = null;
let quitting = false;
let hideAll = false;

const winOf = (noteId) => noteWins.get(noteId) || null;

// ---------- hinh hoc ----------

function displayFor(bounds) {
  return screen.getDisplayMatching(bounds);
}

function clampBounds(input) {
  const b = { ...input };
  const area = displayFor(b).workArea;
  b.width = Math.max(MIN_W, Math.round(b.width));
  b.height = Math.max(MIN_H, Math.round(b.height));
  b.x = Math.round(
    Math.min(Math.max(b.x, area.x - b.width + EDGE), area.x + area.width - EDGE)
  );
  b.y = Math.round(
    Math.min(Math.max(b.y, area.y - b.height + EDGE + 20), area.y + area.height - 20)
  );
  return b;
}

function applyLive(state, dx, dy) {
  const win = state.win;
  if (win.isDestroyed()) return;
  const start = state.start;
  if (state.mode === 'move') {
    state.accX = dx;
    state.accY = dy;
    win.setBounds(
      clampBounds({
        x: start.x + dx,
        y: start.y + dy,
        width: start.width,
        height: start.height,
      })
    );
    return;
  }

  state.accX = dx;
  state.accY = dy;
  let { x, y, width, height } = start;
  if (state.dir.includes('e')) width = start.width + dx;
  if (state.dir.includes('s')) height = start.height + dy;
  if (state.dir.includes('w')) {
    width = start.width - dx;
    x = start.x + dx;
  }
  if (state.dir.includes('n')) {
    height = start.height - dy;
    y = start.y + dy;
  }
  if (width < MIN_W) {
    if (state.dir.includes('w')) x -= MIN_W - width;
    width = MIN_W;
  }
  if (height < MIN_H) {
    if (state.dir.includes('n')) y -= MIN_H - height;
    height = MIN_H;
  }
  win.setBounds({ x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) });
}

// ---------- ghost / luon tren cung ----------

function setGhost(win, on) {
  if (!win || win.isDestroyed()) return;
  win.setIgnoreMouseEvents(on, { forward: true });
  win.setOpacity(on ? 0.22 : 1);
}

function keepOnTop() {
  const always = store.read().settings.alwaysOnTop;
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    if (!always) {
      win.setAlwaysOnTop(false);
      continue;
    }
    win.setAlwaysOnTop(true, 'screen-saver');
    if (process.platform === 'darwin') {
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    }
  }
}

// ---------- cua so giay nho ----------

function createNoteWindow(note, opts = {}) {
  const existing = winOf(note.id);
  if (existing && !existing.isDestroyed()) {
    existing.show();
    existing.focus();
    return existing;
  }

  const b = clampBounds({ x: note.x, y: note.y, width: note.width, height: note.height });
  const win = new BrowserWindow({
    x: b.x,
    y: b.y,
    width: b.width,
    height: b.height,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    roundedCorners: false,
    thickFrame: false,
    show: false,
    icon: ICON,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      spellcheck: false,
    },
  });

  noteWins.set(note.id, win);
  const wcId = win.webContents.id;
  win.loadFile(path.join(RENDERER, 'note.html'), { query: { id: note.id } });

  win.once('ready-to-show', () => {
    if (opts.activate === false) win.showInactive();
    else win.show();
    setGhost(win, !!store.getNote(note.id)?.ghost);
    keepOnTop();
    if (isDev) win.webContents.openDevTools({ mode: 'detach' });
  });

  win.on('closed', () => {
    noteWins.delete(note.id);
    live.delete(wcId);
  });

  // bam nut X cua Windows / Alt+F4 -> chi an, khong thoat app
  win.on('close', (e) => {
    if (quitting) return;
    e.preventDefault();
    win.hide();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return win;
}

function showAllNotes() {
  hideAll = false;
  for (const win of noteWins.values()) {
    if (!win.isDestroyed()) {
      win.showInactive();
      win.focus();
    }
  }
}

// ---------- ghi nhanh ----------

function createCaptureWindow() {
  const pt = screen.getCursorScreenPoint();
  const area = screen.getDisplayNearestPoint(pt).workArea;
  const width = 560;
  const height = 104;
  captureWin = new BrowserWindow({
    x: Math.round(area.x + (area.width - width) / 2),
    y: Math.round(area.y + area.height * 0.28),
    width,
    height,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    roundedCorners: false,
    show: false,
    icon: ICON,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  captureWin.loadFile(path.join(RENDERER, 'capture.html'), { query: { capture: '1' } });
  captureWin.on('blur', () => captureWin && captureWin.hide());
  captureWin.on('closed', () => {
    captureWin = null;
  });
  return captureWin;
}

function showCapture() {
  if (!captureWin || captureWin.isDestroyed()) createCaptureWindow();
  const pt = screen.getCursorScreenPoint();
  const area = screen.getDisplayNearestPoint(pt).workArea;
  const b = captureWin.getBounds();
  captureWin.setBounds({
    x: Math.round(area.x + (area.width - b.width) / 2),
    y: Math.round(area.y + area.height * 0.28),
    width: b.width,
    height: b.height,
  });
  captureWin.show();
  captureWin.focus();
  captureWin.webContents.send('capture:focus');
}

function targetNote() {
  const db = store.read();
  const wanted = db.settings.captureTargetNoteId;
  return db.notes.find((n) => n.id === wanted) || db.notes[0] || null;
}

// ---------- chon font tren may ----------

let fontCache = null;
let fontScript = null;

// script PowerShell duoc doc bang fs (doc duoc ca trong asar) roi truyen qua -EncodedCommand
function listFontsCommand() {
  if (!fontScript) {
    fontScript = Buffer.from(
      fs.readFileSync(path.join(__dirname, 'list-fonts.ps1'), 'utf8'),
      'utf16le'
    ).toString('base64');
  }
  return ['-sta', '-NoProfile', '-EncodedCommand', fontScript];
}

function listSystemFonts() {
  if (fontCache) return Promise.resolve(fontCache);
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      listFontsCommand(),
      { windowsHide: true, timeout: 20000, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout) => {
        const fonts = String(stdout || '')
          .split(/\r?\n/)
          .map((line) => {
            const i = line.lastIndexOf('|');
            // dong dang <family>|<so ky tu dau thieu>: chi giu font khong thieu dau nao
            if (i < 1 || line.slice(i + 1).trim() !== '0') return null;
            return line.slice(0, i);
          })
          .filter(Boolean);
        if (err || !fonts.length) return resolve([]);
        fontCache = fonts;
        resolve(fonts);
      }
    );
  });
}

function openFontWindow(id) {
  if (fontWin && !fontWin.isDestroyed()) fontWin.close();

  const pt = screen.getCursorScreenPoint();
  const area = screen.getDisplayNearestPoint(pt).workArea;
  const width = Math.min(480, area.width - 40);
  const height = Math.min(600, area.height - 40);

  const win = new BrowserWindow({
    x: Math.round(area.x + (area.width - width) / 2),
    y: Math.round(area.y + (area.height - height) / 2),
    width,
    height,
    minWidth: 340,
    minHeight: 300,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: true,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    roundedCorners: false,
    show: false,
    icon: ICON,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  win.setMenu(null);
  fontWin = win;
  win.loadFile(path.join(RENDERER, 'fonts.html'), { query: { id, fonts: '1' } });
  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });
  win.on('closed', () => {
    if (fontWin === win) fontWin = null;
  });
  return win;
}

// ---------- khoi dong cung Windows ----------

// Ban dong goi chay chinh file exe; ban dev phai truyen them duong dan app,
// neu khong Windows chi mo electron.exe tran chu khong mo Sticky Note.
function loginItemTarget() {
  return app.isPackaged
    ? { path: process.execPath, args: [] }
    : { path: process.execPath, args: [app.getAppPath()] };
}

function loginItemEnabled() {
  return app.getLoginItemSettings(loginItemTarget()).openAtLogin;
}

function setLoginItem(open) {
  app.setLoginItemSettings({ ...loginItemTarget(), openAtLogin: open });
}

// ---------- tray ----------

function buildTray() {
  if (tray) return;
  const img = nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 });
  tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img);
  tray.setToolTip('Sticky Note');
  tray.on('click', () => toggleAllNotes());
  refreshTray();
}

function refreshTray() {
  if (!tray) return;
  const db = store.read();
  const notes = db.notes.map((n) => ({
    label: `${n.title || 'Giấy nhớ'}  (${n.tasks.filter((t) => !t.done).length} việc)`,
    click: () => {
      const w = createNoteWindow(n);
      w.show();
      w.focus();
    },
  }));

  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Sticky Note', enabled: false },
      { type: 'separator' },
      { label: 'Giấy nhớ mới', accelerator: 'Ctrl+Alt+T', click: () => addNote({}, true) },
      { label: 'Ghi nhanh…', accelerator: 'Ctrl+Alt+N', click: showCapture },
      { label: 'Ẩn / hiện tất cả', accelerator: 'Ctrl+Alt+H', click: toggleAllNotes },
      {
        label: 'Giấy nhớ đang có',
        enabled: notes.length > 0,
        submenu: notes.length
          ? notes
          : [{ label: '(chưa có)', enabled: false }],
      },
      { type: 'separator' },
      {
        label: 'Chế độ mờ (ghost) mọi giấy nhớ',
        type: 'checkbox',
        checked: db.notes.length > 0 && db.notes.every((n) => n.ghost),
        click: (item) => {
          for (const n of store.read().notes) {
            store.updateNote(n.id, { ghost: item.checked });
            setGhost(winOf(n.id), item.checked);
            const w = winOf(n.id);
            if (w) w.webContents.send('note:changed', { ghost: item.checked });
          }
          refreshTray();
        },
      },
      {
        label: 'Luôn nổi trên mọi cửa sổ',
        type: 'checkbox',
        checked: db.settings.alwaysOnTop,
        click: (item) => {
          store.updateSettings({ alwaysOnTop: item.checked });
          keepOnTop();
        },
      },
      {
        label: 'Khởi động cùng Windows',
        type: 'checkbox',
        checked: loginItemEnabled(),
        click: (item) => {
          setLoginItem(item.checked);
          store.updateSettings({ launchAtLogin: item.checked });
        },
      },
      { type: 'separator' },
      {
        label: 'Mở thư mục dữ liệu',
        click: () => shell.openPath(app.getPath('userData')),
      },
      { label: 'Thoát Sticky Note', click: () => quitApp() },
    ])
  );
}

// ---------- IPC ----------

function registerIpc() {
  ipcMain.handle('note:boot', (e, id) => ({
    note: store.getNote(id),
    notes: store.read().notes.map((n) => ({ id: n.id, title: n.title, color: n.color })),
    settings: store.read().settings,
    loginAtStartup: app.getLoginItemSettings().openAtLogin,
  }));

  ipcMain.handle('note:save', (e, { id, patch }) => {
    const note = store.updateNote(id, patch || {});
    scheduleTrayRefresh();
    return note;
  });

  ipcMain.handle('note:create', (e, partial) => addNote(partial || {}, true));

  ipcMain.handle('note:delete', (e, id) => {
    const win = winOf(id);
    store.removeNote(id);
    if (win && !win.isDestroyed()) {
      noteWins.delete(id);
      win.destroy();
    }
    const db = store.read();
    if (!db.notes.length) addNote({ title: 'Giấy nhớ mới' }, false);
    else if (db.settings.captureTargetNoteId === id)
      store.updateSettings({ captureTargetNoteId: db.notes[0].id });
    refreshTray();
    return true;
  });

  ipcMain.handle('note:list', () =>
    store.read().notes.map((n) => ({
      id: n.id,
      title: n.title,
      color: n.color,
      tasks: n.tasks.length,
      undone: n.tasks.filter((t) => !t.done).length,
    }))
  );

  ipcMain.on('note:show', (e, id) => {
    const note = store.getNote(id);
    if (!note) return;
    const win = createNoteWindow(note);
    hideAll = false;
    win.show();
    win.focus();
  });

  ipcMain.handle('settings:get', () => store.read().settings);
  ipcMain.handle('settings:set', (e, patch) => {
    const s = store.updateSettings(patch || {});
    if (patch && 'alwaysOnTop' in patch) keepOnTop();
    if (patch && 'launchAtLogin' in patch) setLoginItem(!!patch.launchAtLogin);
    refreshTray();
    return s;
  });

  ipcMain.on('win:close', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (win) win.hide();
  });

  ipcMain.handle('win:topmost', (e, on) => {
    const s = store.updateSettings({ alwaysOnTop: !!on });
    keepOnTop();
    refreshTray();
    return s.alwaysOnTop;
  });

  ipcMain.handle('win:ghost', (e, on) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return false;
    setGhost(win, !!on);
    for (const [id, w] of noteWins) if (w === win) store.updateNote(id, { ghost: !!on });
    refreshTray();
    return !!on;
  });

  ipcMain.handle('win:compact', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return false;
    const entry = [...noteWins.entries()].find(([, w]) => w === win);
    const id = entry ? entry[0] : null;
    const b = win.getBounds();
    const stored = id ? store.getNote(id) : null;
    const expandedHeight = (stored && stored.expandedHeight) || Math.max(b.height, 300);
    const compact = !(stored && stored.compact);
    if (id)
      store.updateNote(id, {
        compact,
        expandedHeight,
        height: compact ? COMPACT_H : expandedHeight,
      });
    win.setBounds({ x: b.x, y: b.y, width: b.width, height: compact ? COMPACT_H : expandedHeight });
    return compact;
  });

  ipcMain.on('win:opacity', (e, value) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return;
    const v = Math.min(1, Math.max(0.2, Number(value) || 1));
    const entry = [...noteWins.entries()].find(([, w]) => w === win);
    if (entry) store.updateNote(entry[0], { opacity: v });
    win.setOpacity(v);
  });

  // keo / keo gian bang tay (cua so frameless trong suot)
  const startLive = (e, mode, dir) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return;
    const entry = [...noteWins.entries()].find(([, w]) => w === win);
    if (entry && dir && dir.includes('s')) {
      // dang thu nho ma keo canh duoi -> mo lai truoc cho de keo
      const note = store.getNote(entry[0]);
      if (note && note.compact) {
        const h = note.expandedHeight || 320;
        store.updateNote(entry[0], { compact: false, height: h });
        const b = win.getBounds();
        win.setBounds({ x: b.x, y: b.y, width: b.width, height: h });
        win.webContents.send('note:changed', { compact: false });
      }
    }
    live.set(e.sender.id, {
      win,
      mode,
      dir: dir || '',
      start: win.getBounds(),
      accX: 0,
      accY: 0,
    });
  };

  ipcMain.on('win:drag-start', (e) => startLive(e, 'move'));
  ipcMain.on('win:resize-start', (e, dir) => startLive(e, 'resize', dir));

  ipcMain.on('win:drag-move', (e, { dx, dy }) => {
    const state = live.get(e.sender.id);
    if (!state) return;
    applyLive(state, state.accX + dx, state.accY + dy);
  });

  ipcMain.on('win:resize-move', (e, { dx, dy }) => {
    const state = live.get(e.sender.id);
    if (!state) return;
    applyLive(state, state.accX + dx, state.accY + dy);
  });

  const endLive = (e, mode) => {
    const state = live.get(e.sender.id);
    if (!state) return;
    live.delete(e.sender.id);
    const entry = [...noteWins.entries()].find(([, w]) => w === state.win);
    if (entry) {
      const b = state.win.getBounds();
      const note = store.getNote(entry[0]);
      const patch = { x: b.x, y: b.y, width: b.width };
      if (note && note.compact) patch.compact = true;
      else patch.height = b.height;
      store.updateNote(entry[0], patch);
    }
    if (!state.win.isDestroyed())
      state.win.webContents.send('note:changed', { settled: true, mode });
  };

  ipcMain.on('win:drag-end', (e) => endLive(e, 'move'));
  ipcMain.on('win:resize-end', (e) => endLive(e, 'resize'));

  ipcMain.on('app:notify', (e, { title, body }) => {
    if (!Notification.isSupported()) return;
    new Notification({ title: title || 'Sticky Note', body: body || '', icon: ICON }).show();
  });

  ipcMain.on('capture:hide', () => {
    if (captureWin && !captureWin.isDestroyed()) captureWin.hide();
  });

  ipcMain.handle('capture:submit', (e, text) => {
    const value = String(text || '').trim();
    if (!value) return { ok: false };
    const note = targetNote();
    if (!note) return { ok: false };
    const parsed = require('../shared/dates').parse(value);
    const task = {
      id: store.uid(),
      text: parsed.text || value,
      done: false,
      due: parsed.due,
      priority: parsed.priority,
      tags: parsed.tags,
      ord: (fresh.tasks || []).length,
      createdAt: Date.now(),
    };
    const fresh = store.getNote(note.id) || note;
    store.updateNote(note.id, { tasks: [...fresh.tasks, task] });
    const win = winOf(note.id) || createNoteWindow(store.getNote(note.id), { activate: false });
    win.webContents.send('note:changed', { tasks: true });
    refreshTray();
    return { ok: true, note: note.title, due: parsed.due };
  });

  ipcMain.handle('note:context-menu', (e, id) => showNoteMenu(id));

  // ---------- chon font tren may ----------

  ipcMain.handle('fonts:list', () => listSystemFonts());

  ipcMain.on('fonts:apply', (e, { id, family }) => {
    const name = String(family || '').trim();
    if (!name) return;
    const note = store.updateNote(id, { font: name });
    if (!note) return;
    const win = winOf(id);
    if (win && !win.isDestroyed()) win.webContents.send('note:changed', { settled: true, font: name });
    if (fontWin && !fontWin.isDestroyed()) fontWin.close();
  });

  ipcMain.on('fonts:close', () => {
    if (fontWin && !fontWin.isDestroyed()) fontWin.close();
  });
}

// ---------- menu chuot phai tren giay nho ----------

const FONTS = [
  ['hand', 'Viết tay'],
  ['ui', 'Nét mảnh'],
  ['serif', 'Có chân'],
  ['mono', 'Đánh máy'],
];

const COLORS = [
  ['yellow', 'Vàng'],
  ['pink', 'Hồng'],
  ['blue', 'Xanh dương'],
  ['green', 'Xanh lá'],
  ['purple', 'Tím'],
  ['orange', 'Cam'],
  ['dark', 'Tối'],
];

function showNoteMenu(id) {
  const note = store.getNote(id);
  const win = winOf(id);
  if (!note || !win) return Promise.resolve(null);
  const others = store.read().notes.filter((n) => n.id !== id);

  return new Promise((resolve) => {
    let answered = false;
    const pick = (action, value) => {
      if (answered) return;
      answered = true;
      resolve({ action, value });
    };

    const menu = Menu.buildFromTemplate([
      {
        label: 'Màu giấy',
        submenu: COLORS.map(([key, label]) => ({
          label,
          type: 'radio',
          checked: note.color === key,
          click: () => pick('color', key),
        })),
      },
      {
        label: note.justify ? 'Dàn đều chữ  (đang bật)' : 'Dàn đều chữ',
        type: 'checkbox',
        checked: !!note.justify,
        click: () => pick('justify'),
      },
      {
        label: 'Cỡ chữ',
        submenu: [
          { label: 'Nhỏ hơn', click: () => pick('font', -1) },
          { label: 'Lớn hơn', click: () => pick('font', 1) },
          { label: 'Mặc định', click: () => pick('font', 0) },
        ],
      },
      {
        label: 'Kiểu chữ',
        submenu: [
          ...FONTS.map(([key, label]) => ({
            label,
            type: 'radio',
            checked: (note.font || 'hand') === key,
            click: () => pick('fontFamily', key),
          })),
          { type: 'separator' },
          {
            label: 'Chọn font trên máy…',
            click: () => {
              pick(null);
              openFontWindow(id);
            },
          },
        ],
      },
      {
        label: 'Độ mờ',
        submenu: [
          { label: 'Đậm', click: () => pick('opacity', 1) },
          { label: '90%', click: () => pick('opacity', 0.9) },
          { label: '80%', click: () => pick('opacity', 0.8) },
          { label: '65%', click: () => pick('opacity', 0.65) },
        ],
      },
      { type: 'separator' },
      { label: 'Xoá việc đã xong', click: () => pick('clear-done') },
      { label: 'Giấy nhớ mới', click: () => pick('new') },
      { label: 'Nhân đôi giấy nhớ', click: () => pick('duplicate') },
      {
        label: 'Chuyển sang giấy nhớ khác',
        enabled: others.length > 0,
        submenu: others.map((n) => ({
          label: n.title || 'Giấy nhớ',
          click: () => pick('show', n.id),
        })),
      },
      { type: 'separator' },
      { label: 'Xoá giấy nhớ này', click: () => pick('delete') },
    ]);

    menu.popup({ window: win, callback: () => pick(null) });
  });
}

// ---------- phim tat toan cuc ----------

function noteUnderCursor() {
  const pt = screen.getCursorScreenPoint();
  for (const win of noteWins.values()) {
    if (win.isDestroyed() || !win.isVisible()) continue;
    const b = win.getBounds();
    if (pt.x >= b.x && pt.x <= b.x + b.width && pt.y >= b.y && pt.y <= b.y + b.height) return win;
  }
  return null;
}

function toggleGhostHotkey() {
  const target = noteUnderCursor();
  const wins = target ? [target] : [...noteWins.values()];
  for (const win of wins) {
    const entry = [...noteWins.entries()].find(([, w]) => w === win);
    if (!entry) continue;
    const note = store.getNote(entry[0]);
    const on = !(note && note.ghost);
    setGhost(win, on);
    store.updateNote(entry[0], { ghost: on });
    win.webContents.send('note:changed', { ghost: on });
  }
  refreshTray();
}

function registerShortcuts() {
  const s = store.read().settings;
  const bind = (acc, fn) => {
    if (!acc) return;
    try {
      globalShortcut.register(acc, fn);
    } catch (err) {
      console.warn('[hotkey] khong dang ky duoc', acc, err.message);
    }
  };
  bind(s.quickCaptureHotkey, showCapture);
  bind(s.toggleAllHotkey, toggleAllNotes);
  bind(s.newNoteHotkey, () => addNote({}, true));
  bind(s.ghostHotkey, toggleGhostHotkey);
}

// ---------- vong doi app ----------

let trayTimer = null;
function scheduleTrayRefresh() {
  if (trayTimer) clearTimeout(trayTimer);
  trayTimer = setTimeout(refreshTray, 400);
}

function quitApp() {
  quitting = true;
  store.flush();
  app.quit();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showAllNotes);

  app.whenReady().then(() => {
    app.setAppUserModelId('com.local.stickynote');
    Menu.setApplicationMenu(null);
    registerIpc();
    buildTray();

    const db = store.read();
    // dong bo lai voi Windows: muc Run co the lech sau khi doi duong dan app
    if (loginItemEnabled() !== !!db.settings.launchAtLogin) setLoginItem(!!db.settings.launchAtLogin);
    if (!db.notes.length) addNote({ title: 'Việc hôm nay' }, false);
    else db.notes.forEach((n) => createNoteWindow(n, { activate: false }));

    registerShortcuts();
    setInterval(keepOnTop, 2500);
    console.log('[sticky-note] san sang, ' + store.read().notes.length + ' giay nho');
  });

  app.on('activate', showAllNotes);

  app.on('before-quit', () => {
    quitting = true;
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    store.flush();
  });

  // app chay nen: dong het cua so cung khong thoat
  app.on('window-all-closed', () => {});
}

function addNote(partial, show) {
  const note = store.createNote(partial);
  const win = createNoteWindow(note, { activate: false });
  if (show) {
    win.show();
    win.focus();
  }
  refreshTray();
  return note;
}


function toggleAllNotes() {
  hideAll = !hideAll;
  for (const win of noteWins.values()) {
    if (win.isDestroyed()) continue;
    if (hideAll) win.hide();
    else win.showInactive();
  }
}
