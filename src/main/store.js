'use strict';
// Luu tru JSON don gian: %APPDATA%\Sticky Note\sticky-note-data.json
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');

const DEFAULT_SETTINGS = {
  alwaysOnTop: true,
  ghost: false,
  launchAtLogin: false,
  quickCaptureHotkey: 'Control+Alt+N',
  toggleAllHotkey: 'Control+Alt+H',
  ghostHotkey: 'Control+Alt+G',
  newNoteHotkey: 'Control+Alt+T',
  captureTargetNoteId: null,
};

const DEFAULT_NOTE = {
  title: 'Việc hôm nay',
  color: 'yellow',
  body: '',
  tasks: [],
  justify: true,
  fontScale: 1,
  font: 'hand',
  tilt: 0,
  compact: false,
  ghost: false,
  opacity: 1,
};

let cache = null;
let timer = null;

const file = () => path.join(app.getPath('userData'), 'sticky-note-data.json');

function uid() {
  return crypto.randomBytes(8).toString('hex');
}

function empty() {
  return { version: 1, settings: { ...DEFAULT_SETTINGS }, notes: [] };
}

function load() {
  try {
    const raw = fs.readFileSync(file(), 'utf8');
    const parsed = JSON.parse(raw);
    cache = {
      version: 1,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
    };
  } catch {
    cache = empty();
  }
  return cache;
}

function read() {
  if (!cache) load();
  return cache;
}

function flush() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!cache) return;
  const target = file();
  const tmp = target + '.tmp';
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(cache, null, 2), 'utf8');
    fs.renameSync(tmp, target);
  } catch (err) {
    console.error('[store] ghi that bai:', err.message);
  }
}

function save() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(flush, 350);
}

function getNote(id) {
  return read().notes.find((n) => n.id === id) || null;
}

function createNote(partial = {}) {
  const area = require('electron').screen.getPrimaryDisplay().workArea;
  const count = read().notes.length;
  const width = 320;
  const height = 380;
  const note = {
    id: uid(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    x: Math.max(area.x + 40, area.x + area.width - width - 40 - count * 34),
    y: area.y + 60 + count * 34,
    width,
    height,
    ...DEFAULT_NOTE,
    ...partial,
  };
  read().notes.push(note);
  save();
  return note;
}

function updateNote(id, patch) {
  const note = getNote(id);
  if (!note) return null;
  Object.assign(note, patch, { updatedAt: Date.now() });
  save();
  return note;
}

function removeNote(id) {
  const db = read();
  const i = db.notes.findIndex((n) => n.id === id);
  if (i >= 0) {
    db.notes.splice(i, 1);
    save();
  }
}

function updateSettings(patch) {
  Object.assign(read().settings, patch);
  save();
  return read().settings;
}

module.exports = {
  DEFAULT_SETTINGS,
  uid,
  read,
  flush,
  save,
  getNote,
  createNote,
  updateNote,
  removeNote,
  updateSettings,
};
