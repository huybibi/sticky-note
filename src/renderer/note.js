'use strict';
const api = window.sticky;
const D = window.StickyDates;
const $ = (id) => document.getElementById(id);

const UI = {
  stage: $('stage'),
  paper: $('paper'),
  bar: $('bar'),
  title: $('title'),
  tasks: $('tasks'),
  addRow: $('addRow'),
  newTask: $('newTask'),
  preview: $('preview'),
  quick: $('quick'),
  btnQuick: $('btnQuick'),
  body: $('body'),
  count: $('count'),
  saved: $('saved'),
  btnGhost: $('btnGhost'),
  btnPin: $('btnPin'),
  btnMenu: $('btnMenu'),
  btnClose: $('btnClose'),
  btnJustify: $('btnJustify'),
  btnFontUp: $('btnFontUp'),
  btnFontDown: $('btnFontDown'),
  toast: $('toast'),
  picker: $('picker'),
};

let note = null;
let settings = {};
let saveTimer = null;
let toastTimer = null;
let editingId = null;

const FONTS = {
  hand: '"Segoe Print", "Bradley Hand", "Comic Sans MS", "Segoe UI", system-ui, sans-serif',
  ui: '"Segoe UI", system-ui, "Helvetica Neue", Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: '"Cascadia Mono", Consolas, "Courier New", monospace',
};

// font nguoi dung chon tu danh sach font tren may: uu tien dung dung font do,
// cac ky tu font do thieu (vd dau tieng Viet) se roi ve font he thong.
const FONT_FALLBACK = '"Segoe UI", system-ui, sans-serif';

function fontStack(value) {
  if (FONTS[value]) return FONTS[value];
  if (!value) return FONTS.hand;
  return '"' + String(value).replace(/["\\]/g, '') + '", ' + FONT_FALLBACK;
}

// ---------- luu tru ----------

function queueSave(patch) {
  Object.assign(note, patch);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 280);
}

async function flushSave() {
  if (!note) return;
  clearTimeout(saveTimer);
  await api.save({
    title: note.title,
    body: note.body,
    tasks: note.tasks,
    color: note.color,
    justify: note.justify,
    fontScale: note.fontScale,
    font: note.font,
  });
  flashSaved();
}

function flashSaved() {
  UI.saved.classList.add('show');
  setTimeout(() => UI.saved.classList.remove('show'), 900);
}

function toast(text) {
  UI.toast.textContent = text;
  UI.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => UI.toast.classList.remove('show'), 1600);
}

// ---------- hien thi ----------

function applyAppearance() {
  UI.paper.dataset.color = note.color || 'yellow';
  UI.paper.classList.toggle('justify', note.justify !== false);
  UI.paper.classList.toggle('compact', !!note.compact);
  document.documentElement.style.setProperty(
    '--fs',
    (15 * (note.fontScale || 1)).toFixed(2) + 'px'
  );
  document.documentElement.style.setProperty('--font-hand', fontStack(note.font));
  UI.title.value = note.title || '';
  if (UI.body.value !== (note.body || '')) UI.body.value = note.body || '';
  UI.btnPin.classList.toggle('on', !!settings.alwaysOnTop);
  UI.btnGhost.classList.toggle('on', !!note.ghost);
  if (typeof note.opacity === 'number' && note.opacity < 0.999) api.window.opacity(note.opacity);
}

function updateCount() {
  const list = note.tasks || [];
  const done = list.filter((t) => t.done).length;
  UI.count.textContent = list.length ? `${done}/${list.length} việc xong` : 'chưa có việc nào';
}

// ---------- danh sach viec ----------

// thu tu cu (han -> uu tien -> ngay tao): giu lai de chuyen du lieu cu sang ord
function legacyTaskCompare(a, b) {
  const ad = a.due == null ? Infinity : a.due;
  const bd = b.due == null ? Infinity : b.due;
  if (ad !== bd) return ad - bd;
  if ((b.priority || 0) !== (a.priority || 0)) return (b.priority || 0) - (a.priority || 0);
  return (a.createdAt || 0) - (b.createdAt || 0);
}

function sortedTasks(list) {
  return [...list].sort((a, b) => {
    if (!!a.done !== !!b.done) return a.done ? 1 : -1;
    if (a.done && b.done) return (b.doneAt || 0) - (a.doneAt || 0);
    // viec chua xong: thu tu tay dat (ord) len truoc, han/uu tien chi de hoa giai du lieu cu
    const ao = typeof a.ord === 'number' ? a.ord : 0;
    const bo = typeof b.ord === 'number' ? b.ord : 0;
    if (ao !== bo) return ao - bo;
    return legacyTaskCompare(a, b);
  });
}

// cap ord cho viec chua co: lay max hien co + 1 cho tung viec theo thu tu hien thi hien tai.
// vi sortedTasks xep viec chua-co-ord truoc viec co-ord, "thu tu hien thi" luc nay chinh la
// thu tu cu (han -> uu tien -> ngay tao) nen mo app len lan dau danh sach khong bi dao.

function nextOrd() {
  const list = note.tasks || [];
  let m = -1;
  for (const t of list) if (typeof t.ord === 'number' && t.ord > m) m = t.ord;
  return m + 1;
}

function priorityLabel(p) {
  return '!' + (4 - p);
}

function dueClass(task) {
  if (task.due == null || task.done) return '';
  if (task.due < Date.now()) return 'late';
  const endOfToday = D.startOfDay(new Date()).getTime() + 86400000;
  return task.due < endOfToday ? 'today' : '';
}

function taskRow(task) {
  const li = document.createElement('li');
  li.className = 'task' + (task.done ? ' done' : '') + (task.priority ? ' p' + task.priority : '');
  li.dataset.id = task.id;

  // tay cam de keo doi thu tu (viec da xong thi an di: nhom xong van xep theo gio tick)
  const grip = document.createElement('span');
  grip.className = 'grip';
  grip.textContent = '⋮⋮';
  grip.title = 'Kéo để đổi thứ tự (hoặc Alt+↑/↓ khi đang gõ trong dòng)';
  grip.draggable = true;
  li.append(grip);

  const chk = document.createElement('button');
  chk.className = 'chk';
  chk.type = 'button';
  chk.textContent = task.done ? '✓' : '';
  chk.title = task.done ? 'Bỏ đánh dấu xong' : 'Đánh dấu xong';
  li.append(chk);

  const tx = document.createElement('div');
  tx.className = 'tx';

  const line = document.createElement('div');
  line.className = 'line';
  line.contentEditable = 'true';
  line.textContent = task.text || '';
  line.spellcheck = false;
  tx.append(line);

  const meta = document.createElement('div');
  meta.className = 'meta';

  if (task.due != null) {
    const cls = dueClass(task);
    const chip = document.createElement('button');
    chip.className = 'chip due' + (cls ? ' ' + cls : '');
    chip.type = 'button';
    chip.title = 'Bấm để đổi hạn · Shift+Bấm để xoá hạn';
    chip.textContent =
      (cls === 'late' ? '⚠ ' : '⏰ ') + D.formatDue(task.due, { withTime: task.due % 60000 !== 0 });
    meta.append(chip);
  }

  for (const tag of task.tags || []) {
    const chip = document.createElement('span');
    chip.className = 'chip tag';
    chip.textContent = '#' + tag;
    meta.append(chip);
  }

  if (task.priority) {
    const chip = document.createElement('span');
    chip.className = 'chip prio';
    chip.textContent = priorityLabel(task.priority);
    chip.title = ['', 'ưu tiên thấp', 'ưu tiên vừa', 'ưu tiên cao'][task.priority];
    meta.append(chip);
  }

  if (meta.childElementCount) tx.append(meta);
  li.append(tx);

  const del = document.createElement('button');
  del.className = 'del';
  del.type = 'button';
  del.textContent = '×';
  del.title = 'Xoá việc';
  li.append(del);

  return li;
}

function normalizeTasks() {
  const list = note.tasks || [];
  const missing = sortedTasks(list.filter((t) => typeof t.ord !== 'number'));
  if (!missing.length) return false;
  let m = -1;
  for (const t of list) if (typeof t.ord === 'number' && t.ord > m) m = t.ord;
  for (const t of missing) {
    m += 1;
    t.ord = m;
  }
  return true;
}

function renderTasks(focusId) {
  if (normalizeTasks()) queueSave({ tasks: note.tasks });
  UI.tasks.textContent = '';
  for (const task of sortedTasks(note.tasks || [])) UI.tasks.append(taskRow(task));
  updateCount();
  if (focusId) {
    const row = UI.tasks.querySelector('.task[data-id="' + focusId + '"] .line');
    if (row) {
      row.focus();
      const range = document.createRange();
      range.selectNodeContents(row);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }
}


function newId() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2);
}

function findTask(id) {
  return (note.tasks || []).find((t) => t.id === id) || null;
}

function addTask(text, parsed) {
  const p = parsed || D.parse(text);
  const task = {
    id: newId(),
    text: (p.text || text || '').trim(),
    done: false,
    due: p.due,
    priority: p.priority,
    tags: p.tags,
    ord: nextOrd(),
    createdAt: Date.now(),
  };
  if (!task.text && task.due == null) return null;
  note.tasks = [...(note.tasks || []), task];
  queueSave({ tasks: note.tasks });
  renderTasks();
  UI.tasks.scrollTop = UI.tasks.scrollHeight;
  return task;
}

function removeTask(id) {
  note.tasks = (note.tasks || []).filter((t) => t.id !== id);
  queueSave({ tasks: note.tasks });
  renderTasks();
}

function toggleTask(id) {
  const task = findTask(id);
  if (!task) return;
  task.done = !task.done;
  task.doneAt = task.done ? Date.now() : null;
  task.notified = false;
  queueSave({ tasks: note.tasks });
  renderTasks();
  if (task.done) toast('Xong: ' + task.text);
}

// doi cho ord cua viec voi viec ke tren/duoi trong nhom chua xong (Alt+Arrow)
function moveTask(id, dir) {
  const order = sortedTasks(note.tasks || []).filter((t) => !t.done);
  const i = order.findIndex((t) => t.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return false;
  const tmp = order[i].ord;
  order[i].ord = order[j].ord;
  order[j].ord = tmp;
  queueSave({ tasks: note.tasks });
  renderTasks(id);
  return true;
}

// tha viec keo vao vi tri moi: chi xep trong nhom (chua xong/xong) cua no,
// tha sang nhom kia thi roi ve cuoi nhom cua minh. danh lai ord lien tu 0 tren toan bo.
function dropTask(dragId, targetId, after) {
  const dragged = findTask(dragId);
  if (!dragged || dragged.done) return false;
  const sameGroup = (t) => !t.done;
  const group = sortedTasks(note.tasks || []).filter((t) => sameGroup(t) && t.id !== dragId);
  let idx = group.length;
  const target = targetId ? findTask(targetId) : null;
  if (target && sameGroup(target)) {
    idx = group.findIndex((t) => t.id === targetId) + (after ? 1 : 0);
  }
  group.splice(idx, 0, dragged);
  const others = sortedTasks(note.tasks || []).filter((t) => !sameGroup(t));
  [...group, ...others].forEach((t, i) => {
    t.ord = i;
  });
  queueSave({ tasks: note.tasks });
  renderTasks();
  return true;
}

function clearDropIndicator() {
  UI.tasks.querySelectorAll('.drop-before, .drop-after, .dragging').forEach((el) => {
    el.classList.remove('drop-before', 'drop-after', 'dragging');
  });
}

function updatePreview() {
  const value = UI.newTask.value;
  const parsed = D.parse(value);
  const bits = [];
  if (parsed.due) bits.push('⏰ ' + D.formatDue(parsed.due));
  if (parsed.priority) bits.push(priorityLabel(parsed.priority));
  if (parsed.tags.length) bits.push(parsed.tags.map((t) => '#' + t).join(' '));
  UI.preview.textContent = bits.join('   ');
  UI.preview.classList.toggle('show', !!value.trim() && bits.length > 0);
}

function openAddRow(on) {
  UI.addRow.classList.toggle('hidden', !on);
  UI.quick.classList.toggle('hidden', on);
  if (on) UI.newTask.focus();
}

function commitAdd() {
  const value = UI.newTask.value.trim();
  if (!value) {
    openAddRow(false);
    return;
  }
  addTask(value);
  UI.newTask.value = '';
  updatePreview();
}

// ---------- chon han bang lich native ----------

function toLocalInput(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getFullYear() +
    '-' +
    pad(d.getMonth() + 1) +
    '-' +
    pad(d.getDate()) +
    'T' +
    pad(d.getHours()) +
    ':' +
    pad(d.getMinutes())
  );
}

function openDuePicker(task, anchor) {
  const rect = anchor.getBoundingClientRect();
  UI.picker.style.left = Math.min(rect.left, window.innerWidth - 40) + 'px';
  UI.picker.style.top = Math.min(rect.top + 18, window.innerHeight - 40) + 'px';
  UI.picker.value = toLocalInput(task.due == null ? Date.now() + 3600000 : task.due);
  UI.picker.dataset.taskId = task.id;
  try {
    UI.picker.showPicker();
  } catch (err) {
    toast('Dùng cú pháp @mai 8h30 khi thêm việc để đặt hạn');
  }
}

// ---------- nhac han ----------

function checkDue() {
  if (!note) return;
  let changed = false;
  for (const task of note.tasks || []) {
    if (task.done || task.notified || task.due == null) continue;
    if (task.due <= Date.now()) {
      task.notified = true;
      changed = true;
      api.notify(
        'Đến hạn: ' + task.text,
        D.formatDue(task.due) + (note.title ? '  ·  ' + note.title : '')
      );
      UI.paper.classList.add('pulse');
      setTimeout(() => UI.paper.classList.remove('pulse'), 2400);
    }
  }
  if (changed) {
    queueSave({ tasks: note.tasks });
    renderTasks();
  }
}

// ---------- keo di chuyen / keo gian cua so ----------

let flutterSide = 1;

function flutter() {
  UI.paper.classList.remove('flutter', 'flutter-l');
  void UI.paper.offsetWidth;
  UI.paper.classList.add(flutterSide > 0 ? 'flutter' : 'flutter-l');
  flutterSide *= -1;
  setTimeout(() => UI.paper.classList.remove('flutter', 'flutter-l'), 620);
}

function isControl(target) {
  return !!target.closest('button, textarea, .chip, .chk, .del, .picker');
}

function bindPointerDrag(target, opts) {
  const pending = { dx: 0, dy: 0 };
  target.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (opts.skipControls && isControl(e.target)) return;

    const startX = e.screenX;
    const startY = e.screenY;
    let lastX = startX;
    let lastY = startY;
    let started = false;
    let queued = false;

    // giu chuot cho ca thao tac: cua so tu doi kich thuoc co the lam mat capture giua chung
    try {
      target.setPointerCapture(e.pointerId);
    } catch (err) {
      /* bo qua */
    }

    const move = (ev) => {
      if (ev.buttons === 0) {
        end();
        return;
      }
      if (!started) {
        if (Math.abs(ev.screenX - startX) < 4 && Math.abs(ev.screenY - startY) < 4) return;
        started = true;
        const sel = window.getSelection();
        if (sel) sel.removeAllRanges();
        if (document.activeElement && document.activeElement !== document.body) {
          document.activeElement.blur();
        }
        opts.start();
        lastX = startX;
        lastY = startY;
      }
      const dx = ev.screenX - lastX;
      const dy = ev.screenY - lastY;
      lastX = ev.screenX;
      lastY = ev.screenY;
      if (!dx && !dy) return;
      if (queued) {
        pending.dx += dx;
        pending.dy += dy;
        return;
      }
      queued = true;
      pending.dx = dx;
      pending.dy = dy;
      requestAnimationFrame(() => {
        queued = false;
        opts.move(pending.dx, pending.dy);
      });
    };

    const end = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', end);
      target.removeEventListener('pointercancel', end);
      window.removeEventListener('pointerup', end, true);
      window.removeEventListener('pointercancel', end, true);
      try {
        target.releasePointerCapture(e.pointerId);
      } catch (err) {
        /* bo qua */
      }
      if (started) opts.end();
    };

    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', end);
    target.addEventListener('pointercancel', end);
    // luoi an toan: chuot nha ngoai tay nam van phai ket thuc keo
    window.addEventListener('pointerup', end, true);
    window.addEventListener('pointercancel', end, true);
  });
}

function bindWindowHandles() {
  bindPointerDrag(UI.bar, {
    skipControls: true,
    start: () => api.window.dragStart(),
    move: (dx, dy) => api.window.dragMove(dx, dy),
    end: () => {
      api.window.dragEnd();
      flutter();
    },
  });

  for (const handle of document.querySelectorAll('.rz')) {
    bindPointerDrag(handle, {
      start: () => api.window.resizeStart(handle.dataset.dir),
      move: (dx, dy) => api.window.resizeMove(dx, dy),
      end: () => api.window.resizeEnd(),
    });
  }
}

// ---------- menu ----------

async function handleMenu() {
  const res = await api.contextMenu();
  if (!res || !res.action) return;
  const { action, value } = res;
  if (action === 'color') {
    queueSave({ color: value });
    applyAppearance();
  } else if (action === 'justify') {
    queueSave({ justify: note.justify === false });
    applyAppearance();
  } else if (action === 'font') {
    const next = value === 0 ? 1 : (note.fontScale || 1) + value * 0.08;
    queueSave({ fontScale: Number(Math.min(1.6, Math.max(0.7, next)).toFixed(2)) });
    applyAppearance();
  } else if (action === 'fontFamily') {
    queueSave({ font: value });
    applyAppearance();
  } else if (action === 'opacity') {
    api.window.opacity(value);
  } else if (action === 'clear-done') {
    const before = note.tasks.length;
    note.tasks = note.tasks.filter((t) => !t.done);
    queueSave({ tasks: note.tasks });
    renderTasks();
    toast('Đã xoá ' + (before - note.tasks.length) + ' việc xong');
  } else if (action === 'new') {
    await api.createNote({ color: note.color });
  } else if (action === 'duplicate') {
    await api.createNote({
      title: (note.title || 'Giấy nhớ') + ' (bản sao)',
      color: note.color,
      body: note.body,
      justify: note.justify,
      fontScale: note.fontScale,
      tasks: note.tasks.map((t, i) => ({ ...t, id: newId(), ord: i, done: false, notified: false })),
    });
    toast('Đã nhân đôi giấy nhớ');
  } else if (action === 'show') {
    api.showNote(value);
  } else if (action === 'delete') {
    await api.deleteNote(note.id);
  }
}

// ---------- su kien ----------

function bindEvents() {
  UI.title.addEventListener('input', () => queueSave({ title: UI.title.value }));
  UI.body.addEventListener('input', () => queueSave({ body: UI.body.value }));

  UI.bar.addEventListener('dblclick', (e) => {
    if (isControl(e.target)) return;
    api.window.compact().then((compact) => {
      note.compact = compact;
      UI.paper.classList.toggle('compact', compact);
      toast(compact ? 'Thu gọn · nháy đúp để mở lại' : 'Mở rộng');
    });
  });

  UI.btnClose.addEventListener('click', () => api.window.close());

  UI.btnGhost.addEventListener('click', async () => {
    const on = !note.ghost;
    await api.window.ghost(on);
    note.ghost = on;
    UI.btnGhost.classList.toggle('on', on);
    toast(on ? 'Chế độ mờ: Ctrl+Alt+G để hiện lại' : 'Đã hiện lại');
  });

  UI.btnPin.addEventListener('click', async () => {
    const on = await api.window.topmost(!settings.alwaysOnTop);
    settings.alwaysOnTop = on;
    UI.btnPin.classList.toggle('on', on);
    toast(on ? 'Luôn nổi trên mọi cửa sổ' : 'Không còn luôn nổi');
  });

  UI.btnMenu.addEventListener('click', handleMenu);

  UI.btnJustify.addEventListener('click', () => {
    queueSave({ justify: note.justify === false });
    applyAppearance();
  });

  UI.btnFontUp.addEventListener('click', () => {
    queueSave({ fontScale: Math.min(1.6, (note.fontScale || 1) + 0.08) });
    applyAppearance();
  });

  UI.btnFontDown.addEventListener('click', () => {
    queueSave({ fontScale: Math.max(0.7, (note.fontScale || 1) - 0.08) });
    applyAppearance();
  });

  UI.btnQuick.addEventListener('click', () => openAddRow(true));
  UI.newTask.addEventListener('input', updatePreview);
  UI.newTask.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitAdd();
    } else if (e.key === 'Escape') {
      UI.newTask.value = '';
      updatePreview();
      openAddRow(false);
    }
  });
  UI.addRow.addEventListener('submit', (e) => e.preventDefault());
  UI.newTask.addEventListener('blur', () => {
    if (!UI.newTask.value.trim()) openAddRow(false);
  });

  UI.picker.addEventListener('change', () => {
    const task = findTask(UI.picker.dataset.taskId);
    if (!task || !UI.picker.value) return;
    task.due = new Date(UI.picker.value).getTime();
    task.notified = false;
    queueSave({ tasks: note.tasks });
    renderTasks();
    toast('Hạn mới: ' + D.formatDue(task.due, { withTime: true }));
  });

  bindTaskEvents();
  bindWindowHandles();

  api.onChanged(async (payload) => {
    if (!payload.settled) return;
    if (payload.font) {
      // font duoc chon tu cua so "font tren may" -> cap nhat ngay, tranh ghi de khi flushSave
      note.font = payload.font;
      applyAppearance();
    }
    await flushSave();
    const data = await api.boot();
    if (!data || !data.note) return;
    note.tasks = data.note.tasks || [];
    note.compact = data.note.compact;
    note.ghost = data.note.ghost;
    UI.paper.classList.toggle('compact', !!note.compact);
    UI.btnGhost.classList.toggle('on', !!note.ghost);
    renderTasks();
  });
}

function bindTaskEvents() {
  UI.tasks.addEventListener('click', (e) => {
    const row = e.target.closest('.task');
    if (!row) return;
    const id = row.dataset.id;

    if (e.target.closest('.chk')) {
      toggleTask(id);
      return;
    }
    if (e.target.closest('.del')) {
      removeTask(id);
      toast('Đã xoá việc');
      return;
    }
    const chip = e.target.closest('.chip.due');
    if (chip) {
      const task = findTask(id);
      if (!task) return;
      if (e.shiftKey) {
        task.due = null;
        task.notified = false;
        queueSave({ tasks: note.tasks });
        renderTasks();
        toast('Đã bỏ hạn');
        return;
      }
      openDuePicker(task, chip);
      return;
    }
    const line = e.target.closest('.line');
    if (line) line.focus();
  });

  UI.tasks.addEventListener('keydown', (e) => {
    const line = e.target.closest('.line');
    if (!line) return;
    const task = findTask(line.closest('.task').dataset.id);
    if (!task) return;

    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      moveTask(task.id, e.key === 'ArrowUp' ? -1 : 1);
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      line.textContent = line.textContent.trim();
      task.text = line.textContent;
      queueSave({ tasks: note.tasks });
      line.blur();
      openAddRow(true);
      return;
    }

    if (e.key === 'Backspace' && !line.textContent.trim()) {
      e.preventDefault();
      const rows = [...UI.tasks.querySelectorAll('.task')];
      const prev = rows[rows.indexOf(line.closest('.task')) - 1];
      removeTask(task.id);
      if (prev) renderTasks(prev.dataset.id);
    }
  });

  UI.tasks.addEventListener('input', (e) => {
    const line = e.target.closest && e.target.closest('.line');
    if (!line) return;
    const task = findTask(line.closest('.task').dataset.id);
    if (!task) return;
    task.text = line.textContent.replace(/\s+/g, ' ').trim();
    queueSave({ tasks: note.tasks });
  });

  UI.tasks.addEventListener(
    'blur',
    (e) => {
      const line = e.target.closest && e.target.closest('.line');
      if (!line) return;
      const task = findTask(line.closest('.task').dataset.id);
      if (task && !task.text && task.due == null) removeTask(task.id);
    },
    true
  );

  // ---------- keo-tha doi thu tu ----------
  let dragId = null;

  UI.tasks.addEventListener('dragstart', (e) => {
    const grip = e.target.closest && e.target.closest('.grip');
    if (!grip) return;
    const row = grip.closest('.task');
    if (!row || row.classList.contains('done')) return;
    dragId = row.dataset.id;
    try {
      e.dataTransfer.setData('text/plain', dragId);
      e.dataTransfer.effectAllowed = 'move';
    } catch {}
    requestAnimationFrame(() => row.classList.add('dragging'));
  });

  UI.tasks.addEventListener('dragend', () => {
    dragId = null;
    clearDropIndicator();
  });

  UI.tasks.addEventListener('dragleave', (e) => {
    const row = e.target.closest && e.target.closest('.task');
    if (row) row.classList.remove('drop-before', 'drop-after');
  });

  UI.tasks.addEventListener('dragover', (e) => {
    if (!dragId) return;
    e.preventDefault();
    try {
      e.dataTransfer.dropEffect = 'move';
    } catch {}
    // tu cuon khi keo sat mep tren/duoi
    const box = UI.tasks.getBoundingClientRect();
    if (e.clientY - box.top < 28) UI.tasks.scrollTop -= 14;
    else if (box.bottom - e.clientY < 28) UI.tasks.scrollTop += 14;
    const row = e.target.closest && e.target.closest('.task');
    UI.tasks.querySelectorAll('.drop-before, .drop-after').forEach((el) => {
      if (el !== row) el.classList.remove('drop-before', 'drop-after');
    });
    if (!row || row.dataset.id === dragId) return;
    const r = row.getBoundingClientRect();
    const after = e.clientY - r.top > r.height / 2;
    row.classList.toggle('drop-before', !after);
    row.classList.toggle('drop-after', after);
  });

  UI.tasks.addEventListener('drop', (e) => {
    if (!dragId) return;
    e.preventDefault();
    const row = e.target.closest && e.target.closest('.task');
    let after = true;
    if (row) {
      const r = row.getBoundingClientRect();
      after = e.clientY - r.top > r.height / 2;
    }
    const id = dragId;
    dragId = null;
    clearDropIndicator();
    dropTask(id, row ? row.dataset.id : null, after);
  });
}

// ---------- khoi dong ----------

async function boot() {
  const data = await api.boot();
  if (!data || !data.note) return;
  note = data.note;
  settings = data.settings || {};
  note.tasks = note.tasks || [];
  applyAppearance();
  renderTasks();
  bindEvents();
  setInterval(checkDue, 30000);
  checkDue();
  if (!note.tasks.length) openAddRow(true);
}

window.addEventListener('beforeunload', () => clearTimeout(saveTimer));

boot();
