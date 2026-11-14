// Shared interface kit for the delivery network apps. No framework, no build step, no inline scripts.
import '/delivery/session.js';
export function h(tag, attrs, ...kids) {
  const el = document.createElementNS(tag === 'svg' || h.svg ? 'http://www.w3.org/2000/svg' : 'http://www.w3.org/1999/xhtml', tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.setAttribute('class', v);
    else if (k === 'value' && 'value' in el) el.value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'required') { if (v) el.setAttribute(k, ''); }
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) if (kid !== null && kid !== undefined && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}
export const svg = (tag, attrs, ...kids) => { h.svg = true; try { return h(tag, attrs, ...kids); } finally { h.svg = false; } };
export const mount = (root, ...kids) => { root.replaceChildren(...kids.flat(Infinity).filter(Boolean)); return root; };

/* ---------- API ---------- */
export async function api(path, { method = 'GET', body, query, raw } = {}) {
  const url = new URL(path, location.origin);
  for (const [k, v] of Object.entries(query || {})) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  const headers = {};
  if (method !== 'GET') { headers['X-NearBuy-Request'] = '1'; headers['Idempotency-Key'] = crypto.randomUUID ? crypto.randomUUID() : String(Math.random()); }
  let payload;
  if (raw) { payload = raw; headers['Content-Type'] = 'application/octet-stream'; } else if (method !== 'GET') { payload = JSON.stringify(body || {}); headers['Content-Type'] = 'application/json'; }
  let res;
  try { res = await fetch(url, { method, headers, body: payload, credentials: 'same-origin' }); } catch { const e = new Error('No connection. Check your internet and try again.'); e.status = 0; throw e; }
  const data = (res.headers.get('content-type') || '').includes('json') ? await res.json() : null;
  if (!res.ok) { const e = new Error((data && data.error) || `Request failed (${res.status}).`); e.status = res.status; e.fields = (data && data.fields) || {}; e.data = data || {}; throw e; }
  return data;
}
/** Run an action from a button: disables it while pending and reports failure. */
export async function act(button, fn, done) {
  if (button) button.disabled = true;
  try { const out = await fn(); if (done) toast(done, 'ok'); return out; } catch (e) { toast(e.message, 'bad'); return null; } finally { if (button && button.isConnected) button.disabled = false; }
}

/* ---------- Formatting ---------- */
export const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(Number(n || 0)) ? 0 : 2, maximumFractionDigits: 2 })}`;
const IST = { timeZone: 'Asia/Kolkata' };
export const dt = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { ...IST, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—');
export const day = (iso) => (iso ? new Date(iso.length === 10 ? `${iso}T00:00:00+05:30` : iso).toLocaleDateString('en-IN', { ...IST, day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const clock = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-IN', { ...IST, hour: 'numeric', minute: '2-digit' }) : '—');
export function ago(iso) {
  if (!iso) return '—';
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  return s < 60 ? 'just now' : s < 3600 ? `${Math.floor(s / 60)} min ago` : s < 86400 ? `${Math.floor(s / 3600)} h ago` : dt(iso);
}
export const mins = (iso) => (iso ? Math.max(0, Math.round((Date.parse(iso) - Date.now()) / 60000)) : null);
export const pct = (v) => (v === null || v === undefined ? '—' : `${v}%`);
export const val = (v, unit = '') => (v === null || v === undefined || v === '' ? '—' : `${v}${unit}`);
export const title = (s) => String(s || '').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

/* ---------- Small components ---------- */
const TONES = {
  ok: ['delivered', 'approved', 'verified', 'paid', 'confirmed', 'available', 'reconciled', 'active', 'resolved', 'accepted', 'online'],
  bad: ['cancelled', 'rejected', 'suspended', 'failed', 'delivery_attempt_failed', 'disputed', 'expired', 'urgent', 'returned_to_seller', 'return_in_progress'],
  warn: ['info_required', 'pending', 'unverified', 'reassignment_required', 'searching_partner', 'awaiting_assignment', 'offer_sent', 'in_payout', 'open', 'declined', 'draft', 'missing', 'in_progress', 'pickup_verification_pending', 'delivery_verification_pending'],
};
export const tone = (status) => Object.keys(TONES).find((t) => TONES[t].includes(status)) || 'info';
export const badge = (label, t) => h('span', { class: `badge ${t || ''}` }, label);
export const statusBadge = (status, label) => badge(label || title(status), tone(status));
export const demoTag = (show = true) => (show ? h('span', { class: 'badge demo', title: 'Sample record created for testing. Not a real person or order.' }, 'DEMO') : null);
export const spinner = () => h('div', { class: 'spinner', role: 'status', 'aria-label': 'Loading' });
export const empty = (text) => h('div', { class: 'empty' }, text);
export const note = (text, kind) => h('div', { class: `note ${kind || ''}` }, text);
export const stat = (label, value, sub) => h('div', { class: 'stat' }, h('div', { class: 'l' }, label), h('div', { class: 'v' }, value), sub ? h('div', { class: 's' }, sub) : null);
export const card = (heading, ...body) => h('section', { class: 'card stack' }, heading ? (typeof heading === 'string' ? h('h2', null, heading) : heading) : null, ...body);
export const kv = (pairs) => h('dl', { class: 'kv' }, pairs.filter((p) => p && p[1] !== undefined && p[1] !== null && p[1] !== '').map(([k, v]) => [h('dt', null, k), h('dd', null, v)]));
export const btn = (label, onclick, cls = '') => { const b = h('button', { type: 'button', class: `btn ${cls}` }, label); b.addEventListener('click', () => onclick(b)); return b; };
export function brand(sub, href = '#/') {
  return h('a', { class: 'brand', href }, h('img', { src: '/delivery/logo.svg', alt: '', width: 34, height: 34 }), h('span', null, 'Routely', sub ? h('small', null, sub) : null));
}
export function table(columns, rows, { emptyText = 'Nothing to show yet.', onRow } = {}) {
  if (!rows || !rows.length) return h('div', { class: 'table-wrap' }, empty(emptyText));
  return h('div', { class: 'table-wrap' }, h('table', { class: 't' },
    h('thead', null, h('tr', null, columns.map((c) => h('th', { class: c.right ? 'right' : null }, c.label)))),
    h('tbody', null, rows.map((r) => {
      const tr = h('tr', { class: onRow ? 'click' : null, tabindex: onRow ? 0 : null }, columns.map((c) => h('td', { class: c.right ? 'right nowrap' : null }, c.render ? c.render(r) : val(r[c.key]))));
      if (onRow) { tr.addEventListener('click', (e) => { if (!e.target.closest('button,a,input,select')) onRow(r); }); tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') onRow(r); }); }
      return tr;
    }))));
}
export const timeline = (items) => (items && items.length
  ? h('ol', { class: 'tl' }, items.map((i) => h('li', null, h('div', { class: 't1' }, i.label || i.title), h('div', { class: 't2' }, [dt(i.created_at || i.at), i.actor_name || i.actor, i.note].filter(Boolean).join(' · ')))))
  : empty('No events yet.'));
export function tabs(items, active, onPick) {
  return h('div', { class: 'tabs', role: 'tablist' }, items.map(([key, label, n]) => h('button', { class: 'tab', role: 'tab', type: 'button', 'aria-selected': String(key === active), onclick: () => onPick(key) }, label, n !== undefined && n !== null ? h('span', { class: 'n' }, n) : null)));
}
export function pager(list, onPage) {
  if (!list.pages || list.pages < 2) return null;
  return h('div', { class: 'row between small muted' }, `Page ${list.page} of ${list.pages} · ${list.total} records`, h('div', { class: 'row' },
    h('button', { class: 'btn sm', type: 'button', disabled: list.page <= 1, onclick: () => onPage(list.page - 1) }, 'Previous'), h('button', { class: 'btn sm', type: 'button', disabled: list.page >= list.pages, onclick: () => onPage(list.page + 1) }, 'Next')));
}

/* ---------- Toasts and dialogs ---------- */
let toastBox;
export function toast(text, kind = '') {
  if (!toastBox) { toastBox = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }); document.body.append(toastBox); }
  const t = h('div', { class: `toast ${kind}` }, text);
  toastBox.append(t);
  setTimeout(() => t.remove(), kind === 'bad' ? 7000 : 3500);
}
export function modal(heading, body, { wide } = {}) {
  const last = document.activeElement;
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey); if (last && last.focus) last.focus(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const box = h('div', { class: `modal ${wide ? 'wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': heading },
    h('button', { class: 'btn ghost sm x', type: 'button', 'aria-label': 'Close', onclick: close }, '✕'), h('h2', null, heading), typeof body === 'function' ? body(close) : body);
  const back = h('div', { class: 'modal-back', onmousedown: (e) => { if (e.target === back) close(); } }, box);
  document.body.append(back);
  document.addEventListener('keydown', onKey);
  const first = box.querySelector('input,select,textarea,button:not(.x)');
  if (first) first.focus();
  return close;
}
/**
 * Build a form. fields: [{ name, label, type, options, value, hint, required, placeholder, attrs }]
 * onSubmit(values, form) may throw an API error; field errors are shown next to their inputs.
 */
export function form(fields, { submit = 'Save', onSubmit, cancel, danger, intro } = {}) {
  const controls = {};
  const errs = {};
  const row = (f) => {
    if (f.el) return f.el;
    const id = `f-${f.name}-${Math.random().toString(36).slice(2, 7)}`;
    let input;
    if (f.type === 'select') input = h('select', { class: 'input', id, name: f.name, required: f.required }, f.options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return h('option', { value: v, selected: String(f.value ?? '') === String(v) }, l); }));
    else if (f.type === 'textarea') input = h('textarea', { class: 'input', id, name: f.name, required: f.required, placeholder: f.placeholder, maxlength: f.max }, f.value || '');
    else if (f.type === 'checkbox') input = h('input', { type: 'checkbox', id, name: f.name, checked: Boolean(f.value) });
    else input = h('input', { class: `input ${f.code ? 'code' : ''}`, id, name: f.name, type: f.type || 'text', value: f.value ?? '', required: f.required, placeholder: f.placeholder, autocomplete: f.autocomplete || 'off', inputmode: f.inputmode, maxlength: f.max, min: f.min, step: f.step, ...(f.attrs || {}) });
    controls[f.name] = input;
    errs[f.name] = h('div', { class: 'err', role: 'alert' });
    if (f.type === 'checkbox') return h('div', { class: 'field' }, h('label', { class: 'check', for: id }, input, h('span', null, f.label)), errs[f.name]);
    return h('div', { class: 'field' }, h('label', { for: id }, f.label, f.required ? '' : h('span', { class: 'muted' }, f.optional === false ? '' : ' (optional)')), input, f.hint ? h('div', { class: 'hint' }, f.hint) : null, errs[f.name]);
  };
  const general = h('div', { class: 'err', role: 'alert' });
  const go = h('button', { class: `btn primary ${danger ? 'danger solid' : ''}`, type: 'submit' }, submit);
  const el = h('form', { class: 'stack', novalidate: true }, intro ? (typeof intro === 'string' ? h('p', { class: 'muted small' }, intro) : intro) : null, fields.filter(Boolean).map(row), general,
    h('div', { class: 'row' }, go, cancel ? h('button', { class: 'btn', type: 'button', onclick: cancel }, 'Cancel') : null));
  el.values = () => Object.fromEntries(fields.filter((f) => f && !f.el).map((f) => {
    const c = controls[f.name];
    if (f.type === 'checkbox') return [f.name, c.checked];
    const v = c.value.trim();
    if (f.type === 'number') return [f.name, v === '' ? undefined : Number(v)];
    return [f.name, v === '' ? undefined : v];
  }));
  el.addEventListener('submit', async (e) => {
    e.preventDefault();
    general.textContent = '';
    Object.entries(errs).forEach(([k, n]) => { n.textContent = ''; controls[k].classList.remove('bad'); });
    go.disabled = true;
    try { await onSubmit(el.values(), el); } catch (err) {
      let shown = false;
      for (const [k, msg] of Object.entries(err.fields || {})) if (errs[k]) { errs[k].textContent = msg; controls[k].classList.add('bad'); shown = true; }
      general.textContent = err.message || 'Something went wrong.';
      if (!shown && !err.status) console.error(err);
      const firstBad = el.querySelector('.input.bad'); if (firstBad) firstBad.focus();
    } finally { go.disabled = false; }
  });
  el.controls = controls;
  return el;
}
/** A dialog with a form; closes when onSubmit resolves. */
export function formModal(heading, fields, opts) {
  return modal(heading, (close) => form(fields, { ...opts, cancel: close, onSubmit: async (v, f) => { await opts.onSubmit(v, f); close(); } }), { wide: opts.wide });
}
export function confirmModal(heading, text, label, fn, danger) {
  return modal(heading, (close) => h('div', { class: 'stack' }, h('p', null, text), h('div', { class: 'row' }, btn(label, async (b) => { const r = await act(b, fn); if (r !== null) close(); }, danger ? 'danger solid primary' : 'primary'), btn('Cancel', close))));
}

/* ---------- Hash router ---------- */
export function currentRoute() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  return { path, parts: path.split('/').filter(Boolean), query: Object.fromEntries(new URLSearchParams(qs || '')) };
}
export const go = (path) => { if (location.hash === `#${path}`) window.dispatchEvent(new Event('hashchange')); else location.hash = path; };
export function onRoute(fn) { window.addEventListener('hashchange', () => fn(currentRoute())); fn(currentRoute()); }

/* ---------- Live updates ---------- */
/** Subscribe to server events for this portal. The callback is debounced: events only say "something changed". */
export function live(params, onChange) {
  let es; let timer; let closed = false;
  const fire = (data) => { clearTimeout(timer); timer = setTimeout(() => onChange(data), 250); };
  const open = () => {
    if (closed) return;
    es = new EventSource(`/api/realtime?${new URLSearchParams(params)}`);
    es.addEventListener('change', (e) => { try { fire(JSON.parse(e.data)); } catch { fire({}); } });
    es.onerror = () => { es.close(); if (!closed) setTimeout(open, 5000); };
  };
  open();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) fire({ kind: 'resume' }); });
  return () => { closed = true; if (es) es.close(); };
}

/* ---------- Position plot ---------- */
/**
 * Plot real coordinates on a plain grid. No map provider is connected, so there are no streets: positions are
 * projected from latitude/longitude to scale. points: [{ lat, lng, label, kind }], zones: [{ lat, lng, km, label }]
 */
const KIND = { pickup: '#12211c', drop: '#b42318', partner: '#0b6e4f', idle: '#1f5f8b', incident: '#d49a00' };
export function plot(points, zones = [], { height = 300 } = {}) {
  const pts = points.filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (!pts.length && !zones.length) return empty('No positions to plot yet.');
  const W = 600; const H = height; const pad = 34;
  const lat0 = (pts[0] || zones[0]).lat;
  const kx = 111.32 * Math.cos((lat0 * Math.PI) / 180); const ky = 110.57;
  const xs = []; const ys = [];
  pts.forEach((p) => { xs.push(p.lng * kx); ys.push(p.lat * ky); });
  zones.forEach((z) => { xs.push(z.lng * kx - z.km, z.lng * kx + z.km); ys.push(z.lat * ky - z.km, z.lat * ky + z.km); });
  let [x1, x2, y1, y2] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const span = Math.max(x2 - x1, (y2 - y1) * (W / H), 0.6);
  const cx = (x1 + x2) / 2; const cy = (y1 + y2) / 2;
  const scale = (W - pad * 2) / span;
  const X = (lng) => W / 2 + (lng * kx - cx) * scale; const Y = (lat) => H / 2 - (lat * ky - cy) * scale;
  const kmBar = span > 8 ? 2 : span > 3 ? 1 : 0.5;
  const el = svg('svg', { class: 'plot', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `Position plot: ${pts.map((p) => p.label).filter(Boolean).join(', ')}` },
    zones.map((z) => [svg('circle', { cx: X(z.lng), cy: Y(z.lat), r: z.km * scale, fill: z.off ? '#e9e2e1' : '#dcebe4', stroke: z.off ? '#c9a9a5' : '#9cc9b6', 'stroke-dasharray': '5 5' }), svg('text', { x: X(z.lng), y: Y(z.lat) - z.km * scale + 16, 'text-anchor': 'middle', opacity: 0.6 }, z.label)]),
    points.filter((p) => p && p.to && Number.isFinite(p.to.lat)).map((p) => svg('line', { x1: X(p.lng), y1: Y(p.lat), x2: X(p.to.lng), y2: Y(p.to.lat), stroke: '#7e918a', 'stroke-width': 1.5, 'stroke-dasharray': '4 4' })),
    pts.map((p) => [p.kind === 'pickup' ? svg('rect', { x: X(p.lng) - 6, y: Y(p.lat) - 6, width: 12, height: 12, rx: 2, fill: KIND.pickup }) : svg('circle', { cx: X(p.lng), cy: Y(p.lat), r: p.kind === 'partner' ? 8 : 6, fill: KIND[p.kind] || KIND.idle, stroke: '#fff', 'stroke-width': 2 }),
      p.label ? svg('text', { x: X(p.lng) + 10, y: Y(p.lat) + 4 }, p.label) : null]),
    svg('line', { x1: 14, y1: H - 14, x2: 14 + kmBar * scale, y2: H - 14, stroke: '#12211c', 'stroke-width': 2 }), svg('text', { x: 14, y: H - 20 }, `${kmBar} km`));
  return el;
}
export const plotLegend = (kinds = ['pickup', 'drop', 'partner']) => h('div', { class: 'legend' }, kinds.map((k) => h('span', null, h('i', { style: `background:${KIND[k]}` }), { pickup: 'Pickup point', drop: 'Drop point', partner: 'Partner on delivery', idle: 'Partner online', incident: 'Open incident' }[k])),
  h('span', null, 'Positions plotted to scale from GPS coordinates. No street map provider is connected.'));
export const mapsLink = (lat, lng, label = 'Open navigation') => h('a', { class: 'btn', href: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, target: '_blank', rel: 'noopener noreferrer' }, label);
export async function readFileInput(input, maxMb = 5) {
  const file = input.files && input.files[0];
  if (!file) throw new Error('Choose a file first.');
  if (file.size > maxMb * 1024 * 1024) throw new Error(`The file is larger than ${maxMb} MB.`);
  return file;
}
