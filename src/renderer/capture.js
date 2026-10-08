'use strict';
const api = window.sticky;
const input = document.getElementById('q');
const pv = document.getElementById('pv');

function updatePreview() {
  const value = input.value.trim();
  if (!value) {
    pv.textContent = '';
    return;
  }
  const parsed = window.StickyDates.parse(value);
  const bits = [];
  if (parsed.due) bits.push('⏰ ' + window.StickyDates.formatDue(parsed.due));
  if (parsed.priority) bits.push('!' + (4 - parsed.priority));
  if (parsed.tags.length) bits.push(parsed.tags.map((t) => '#' + t).join(' '));
  pv.textContent = bits.join('  ');
}

async function submit() {
  const value = input.value.trim();
  if (!value) {
    api.capture.hide();
    return;
  }
  const res = await api.capture.submit(value);
  if (res && res.ok) {
    input.value = '';
    updatePreview();
    pv.textContent = '✓ đã thêm vào "' + (res.note || 'giấy nhớ') + '"';
    setTimeout(() => api.capture.hide(), 550);
  } else {
    api.capture.hide();
  }
}

input.addEventListener('input', updatePreview);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    submit();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    api.capture.hide();
  }
});

window.addEventListener('focus', () => input.focus());
setTimeout(() => input.focus(), 30);
