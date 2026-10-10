'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const noteId = new URLSearchParams(location.search).get('id');
const isCapture = new URLSearchParams(location.search).get('capture') === '1';

contextBridge.exposeInMainWorld('sticky', {
  noteId,
  isCapture,
  boot: () => ipcRenderer.invoke('note:boot', noteId),
  save: (patch) => ipcRenderer.invoke('note:save', { id: noteId, patch }),
  createNote: (partial) => ipcRenderer.invoke('note:create', partial),
  deleteNote: (id) => ipcRenderer.invoke('note:delete', id || noteId),
  listNotes: () => ipcRenderer.invoke('note:list'),
  showNote: (id) => ipcRenderer.send('note:show', id),
  settings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  contextMenu: () => ipcRenderer.invoke('note:context-menu', noteId),
  notify: (title, body) => ipcRenderer.send('app:notify', { title, body }),

  window: {
    close: () => ipcRenderer.send('win:close'),
    topmost: (on) => ipcRenderer.invoke('win:topmost', on),
    ghost: (on) => ipcRenderer.invoke('win:ghost', on),
    compact: () => ipcRenderer.invoke('win:compact'),
    opacity: (v) => ipcRenderer.send('win:opacity', v),
    autoGrow: (overflow, reset) => ipcRenderer.send('win:auto-grow', { overflow, reset }),
    dragStart: () => ipcRenderer.send('win:drag-start'),
    dragMove: (dx, dy) => ipcRenderer.send('win:drag-move', { dx, dy }),
    dragEnd: () => ipcRenderer.send('win:drag-end'),
    resizeStart: (dir) => ipcRenderer.send('win:resize-start', dir),
    resizeMove: (dx, dy) => ipcRenderer.send('win:resize-move', { dx, dy }),
    resizeEnd: () => ipcRenderer.send('win:resize-end'),
  },

  capture: {
    hide: () => ipcRenderer.send('capture:hide'),
    submit: (text) => ipcRenderer.invoke('capture:submit', text),
  },

  fonts: {
    list: () => ipcRenderer.invoke('fonts:list'),
    apply: (family) => ipcRenderer.send('fonts:apply', { id: noteId, family }),
    close: () => ipcRenderer.send('fonts:close'),
  },

  onChanged: (cb) => ipcRenderer.on('note:changed', (e, payload) => cb(payload || {})),
  onCaptureFocus: (cb) => ipcRenderer.on('capture:focus', () => cb()),
});
