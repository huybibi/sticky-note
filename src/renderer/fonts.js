'use strict';
const api = window.sticky;
const listEl = document.getElementById('list');
const searchEl = document.getElementById('q');
const infoEl = document.getElementById('info');

// cau mau co du cac ky tu dau tieng Viet (a a a e o o u d + thanh) de nhin ro tung font
const PREVIEW = 'Đi ăn sáng rồi về làm bài tập, nhớ mua sữa nhé.';
let fonts = [];
let current = '';

function quote(family) {
  return '"' + String(family).replace(/["\\]/g, '') + '"';
}

function render() {
  const needle = searchEl.value.trim().toLowerCase();
  const shown = fonts.filter((f) => !needle || f.toLowerCase().indexOf(needle) !== -1);

  listEl.textContent = '';
  const frag = document.createDocumentFragment();
  for (const family of shown) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'row' + (family === current ? ' now' : '');

    const name = document.createElement('span');
    name.className = 'nm';
    name.textContent = family;

    const pv = document.createElement('span');
    pv.className = 'pv';
    pv.style.fontFamily = quote(family);
    pv.textContent = PREVIEW;

    row.appendChild(name);
    row.appendChild(pv);
    row.addEventListener('click', () => api.fonts.apply(family));
    frag.appendChild(row);
  }

  if (!shown.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = fonts.length ? 'Không có font nào khớp.' : 'Không đọc được danh sách font trên máy.';
    frag.appendChild(empty);
  }
  listEl.appendChild(frag);

  infoEl.textContent = shown.length + '/' + fonts.length + ' font đủ dấu tiếng Việt';
}

async function boot() {
  infoEl.textContent = 'Đang đọc font trên máy…';
  const data = await api.boot();
  current = (data && data.note && data.note.font) || '';
  try {
    fonts = await api.fonts.list();
  } catch (err) {
    fonts = [];
  }
  fonts.sort((a, b) => a.localeCompare(b, 'vi'));
  render();
  searchEl.focus();
}

searchEl.addEventListener('input', render);
document.getElementById('btnClose').addEventListener('click', () => api.fonts.close());
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    api.fonts.close();
  }
});

boot();
