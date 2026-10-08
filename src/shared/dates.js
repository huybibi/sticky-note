'use strict';
// Parse cu phap them nhanh: "Mua sua @mai 8h30 #nha !2"
// Tra ve {text, due (ms|null), tags[], priority 0..3}
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StickyDates = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const WEEK_EN = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0 };

  function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function nextWeekday(now, dow) {
    const today = startOfDay(now);
    let diff = (dow - today.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    today.setDate(today.getDate() + diff);
    return today;
  }

  function normalize(s) {
    return s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\u0111/g, 'd');
  }

  function parseDateToken(tok, now) {
    const t = normalize(tok);
    if (t === 'hn' || t === 'today' || t === 'homnay' || t === 'hom' || t === 'nay') return startOfDay(now);
    if (t === 'mai' || t === 'tomorrow' || t === 'ngaymai') {
      const d = startOfDay(now);
      d.setDate(d.getDate() + 1);
      return d;
    }
    if (t === 'mot' || t === 'ngaymot' || t === 'kia') {
      const d = startOfDay(now);
      d.setDate(d.getDate() + 2);
      return d;
    }
    let m = /^\+?(\d{1,3})d$/.exec(t) || /^in(\d{1,3})d$/.exec(t);
    if (m) {
      const d = startOfDay(now);
      d.setDate(d.getDate() + Number(m[1]));
      return d;
    }
    m = /^\+?(\d{1,2})w$/.exec(t);
    if (m) {
      const d = startOfDay(now);
      d.setDate(d.getDate() + Number(m[1]) * 7);
      return d;
    }
    m = /^t([2-7])$/.exec(t);
    if (m) return nextWeekday(now, Number(m[1]) - 1);
    if (t === 'cn' || t === 'sun' || t === 'chunhat') return nextWeekday(now, 0);
    if (WEEK_EN[t] != null) return nextWeekday(now, WEEK_EN[t]);
    m = /^(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?$/.exec(t);
    if (m) {
      const day = Number(m[1]);
      const month = Number(m[2]) - 1;
      let year = m[3] ? Number(m[3]) : now.getFullYear();
      if (year < 100) year += 2000;
      const d = new Date(year, month, day, 0, 0, 0, 0);
      if (!m[3] && d.getTime() < startOfDay(now).getTime()) d.setFullYear(year + 1);
      return d;
    }
    return null;
  }

  function parseTimeToken(tok) {
    const t = normalize(tok).replace(/\s+/g, '');
    let m = /^(\d{1,2})[h:g](\d{2})$/.exec(t);
    if (m) return { h: Number(m[1]), m: Number(m[2]) };
    m = /^(\d{1,2})[hg]$/.exec(t);
    if (m) return { h: Number(m[1]), m: 0 };
    m = /^(\d{1,2})(am|pm)$/.exec(t);
    if (m) {
      let h = Number(m[1]);
      if (m[2] === 'pm' && h < 12) h += 12;
      if (m[2] === 'am' && h === 12) h = 0;
      return { h, m: 0 };
    }
    return null;
  }

  function parsePriority(tok) {
    const t = normalize(tok);
    if (t === 'cao' || t === 'high' || t === 'gap') return 3;
    if (t === 'tb' || t === 'medium' || t === 'vua') return 2;
    if (t === 'thap' || t === 'low') return 1;
    if (/^[1-3]$/.test(t)) return 4 - Number(t);
    return 0;
  }

  function formatDue(ms, opts) {
    const now = new Date();
    const d = new Date(ms);
    const time = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    const sameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime();
    const withTime = !opts || opts.withTime !== false;
    const midnight = d.getHours() === 0 && d.getMinutes() === 0;
    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    let label;
    if (sameDay(d, now)) label = 'h\u00f4m nay';
    else {
      const tmr = startOfDay(now);
      tmr.setDate(tmr.getDate() + 1);
      const diff = Math.round((startOfDay(d) - startOfDay(now)) / 86400000);
      if (sameDay(d, tmr)) label = 'mai';
      else if (diff > 1 && diff < 7) label = dayNames[d.getDay()];
      else
        label =
          String(d.getDate()).padStart(2, '0') +
          '/' +
          String(d.getMonth() + 1).padStart(2, '0') +
          (d.getFullYear() !== now.getFullYear() ? '/' + d.getFullYear() : '');
    }
    if (withTime && !midnight) return time + ' ' + label;
    return label;
  }

  function parse(input, nowMs) {
    const now = new Date(nowMs || Date.now());
    const out = { text: '', due: null, time: null, tags: [], priority: 0 };
    const tokens = String(input || '').split(/\s+/).filter(Boolean);
    const keep = [];

    for (const tok of tokens) {
      if (tok[0] === '@' && tok.length > 1) {
        const body = tok.slice(1);
        const date = parseDateToken(body, now);
        if (date) {
          out.due = date.getTime();
          continue;
        }
        const time = parseTimeToken(body);
        if (time && time.h < 24 && time.m < 60) {
          out.time = time;
          continue;
        }
      } else if (/^(\d{1,2}[h:g]\d{2}|\d{1,2}[hg]|\d{1,2}(am|pm)|\d{1,2}:\d{2})$/.test(tok)) {
        const time = parseTimeToken(tok);
        if (time && time.h < 24 && time.m < 60) {
          out.time = time;
          continue;
        }
      } else if (tok[0] === '#' && tok.length > 1) {
        out.tags.push(tok.slice(1));
        continue;
      } else if (tok[0] === '!' && tok.length > 1) {
        const p = parsePriority(tok.slice(1));
        if (p) {
          out.priority = p;
          continue;
        }
      }
      keep.push(tok);
    }

    if (out.due != null) {
      const base = new Date(out.due);
      if (out.time) {
        base.setHours(out.time.h, out.time.m, 0, 0);
      } else if (base.getHours() === 0 && base.getMinutes() === 0) {
        if (base.getTime() <= startOfDay(now).getTime()) {
          const soon = new Date(now.getTime() + 3600000);
          base.setHours(soon.getHours(), 0, 0, 0);
        } else {
          base.setHours(9, 0, 0, 0);
        }
      }
      out.due = base.getTime();
    } else if (out.time) {
      const base = startOfDay(now);
      base.setHours(out.time.h, out.time.m, 0, 0);
      if (base.getTime() < now.getTime()) base.setDate(base.getDate() + 1);
      out.due = base.getTime();
    }

    out.text = keep.join(' ').trim();
    return out;
  }

  return { parse, formatDue, parseDateToken, parseTimeToken, startOfDay, normalize };
});
