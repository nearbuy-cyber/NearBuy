// NearBuy Seller Hub — shared client helpers: DOM, API, router, formatting and UI components.
import { withSession } from '/delivery/session.js';
// No inline scripts or handlers are used so that the page can run under a strict Content-Security-Policy.

export const state = { me: null, routes: [], shell: null };

/* ---------- DOM ---------- */
export function h(spec, props, ...children) {
  const [tag, ...classes] = spec.split('.');
  const el = document.createElement(tag || 'div');
  if (classes.length) el.className = classes.join(' ');
  if (props instanceof Node || typeof props === 'string' || typeof props === 'number' || Array.isArray(props)) { children.unshift(props); props = null; }
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.className = `${el.className} ${value}`.trim();
    else if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key in el && !['list', 'form', 'type'].includes(key) && typeof value !== 'string') el[key] = value;
    else if (key === 'value' || key === 'checked' || key === 'disabled' || key === 'selected' || key === 'open') el[key] = value;
    else el.setAttribute(key, value === true ? '' : value);
  }
  append(el, children);
  return el;
}
export function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false || child === '') continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}
const SVG_NS = 'http://www.w3.org/2000/svg';
export function s(tag, attrs, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v !== null && v !== undefined && v !== false) el.setAttribute(k, v);
  for (const c of children.flat()) if (c) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}

const ICONS = {
  dashboard: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  box: 'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  layers: 'm12 3 9 5-9 5-9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5',
  cart: 'M3 4h2.5l2.3 11h10.4l2-8H7M9.5 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM17.5 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  truck: 'M2 6h11v10H2zM13 9h4.5l3.5 3.5V16h-8zM6.5 19.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  wallet: 'M3 7a2 2 0 0 1 2-2h13v4M3 7v10a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2zM16.5 14h.01',
  trending: 'm3 17 6-6 4 4 8-8M15 7h6v6',
  megaphone: 'M3 10v4l3 .5V9.5zM6 9.5 19 5v14L6 14.5M9 15.5V19a1.5 1.5 0 0 0 3 0v-2.5',
  chart: 'M4 20V10M10 20V4M16 20v-7M21 20H3',
  lifebuoy: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM5.6 5.6l3.9 3.9M14.5 14.5l3.9 3.9M18.4 5.6l-3.9 3.9M9.5 14.5l-3.9 3.9',
  book: 'M4 5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2zM4 20a2 2 0 0 0 2 2h13v-4',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13.5a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.8 1.2V20a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-2.8-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.8H4a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.2-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.8-1.2V4a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 2.8 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.8h.2a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.4.5z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  bell: 'M6 9a6 6 0 1 1 12 0c0 6 2.5 7 2.5 7h-17S6 15 6 9zM10 20a2 2 0 0 0 4 0',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8M12 17h.01',
  menu: 'M4 6h16M4 12h16M4 18h16',
  right: 'm9 6 6 6-6 6', left: 'm15 6-6 6 6 6', down: 'm6 9 6 6 6-6', up: 'm6 15 6-6 6 6',
  plus: 'M12 5v14M5 12h14', x: 'M6 6l12 12M18 6 6 18', check: 'm5 12.5 4.5 4.5L19 7.5',
  download: 'M12 4v11M7 10.5l5 5 5-5M5 20h14', upload: 'M12 16V5M7 9.5l5-5 5 5M5 20h14',
  alert: 'M12 3 2.5 19.5h19zM12 10v4.5M12 17.2h.01', info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5.5M12 7.8h.01',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeoff: 'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3 3.9M6.5 6.6A16.500 16.500 0 0 0 2 12s3.600 7 10 7a9.700 9.700 0 0 0 4.300-1M9.900 9.900a3 3 0 0 0 4.200 4.200',
  edit: 'M4 20h4L19.500 8.500a2.100 2.100 0 0 0-3-3L5 17zM14.500 7.500l3 3',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1', trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  more: 'M12 6h.01M12 12h.01M12 18h.01', filter: 'M3 5h18l-7 8.500V19l-4 1.500v-7z', external: 'M14 4h6v6M20 4l-9 9M18 13.500V20H4V6h6.500',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10', user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  users: 'M9 11a3.500 3.500 0 1 0 0-7 3.500 3.500 0 0 0 0 7zM2.500 20a6.500 6.500 0 0 1 13 0M16 4.200a3.500 3.500 0 0 1 0 6.600M18 14.200a6.500 6.500 0 0 1 3.500 5.800',
  store: 'M4 9.500V20h16V9.500M3 9.500 5 4h14l2 5.500a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0zM9.500 20v-5.500h5V20',
  bank: 'M3 9.500 12 4l9 5.500zM5 10v8M9.500 10v8M14.500 10v8M19 10v8M3 20h18', pin: 'M12 21s7-6.100 7-11.500A7 7 0 0 0 5 9.500C5 14.900 12 21 12 21zM12 12a2.500 2.500 0 1 0 0-5 2.500 2.500 0 0 0 0 5z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5.500l3.500 2', bookmark: 'M6 3h12v18l-6-4.500L6 21z', play: 'M7 4.500v15l12-7.500z',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h6', refresh: 'M20 11a8 8 0 0 0-14.500-4.500L4 8M4 4v4h4M4 13a8 8 0 0 0 14.500 4.500L20 16M20 20v-4h-4',
  shield: 'M12 3 4.500 6v6c0 4.500 3.200 7.800 7.500 9 4.300-1.200 7.500-4.500 7.500-9V6zM9 12l2.200 2.200L15.500 10', tag: 'M3 12.500V4h8.500l9 9-8.500 8.500zM7.500 8.500h.01',
  sparkle: 'M12 3l1.800 5.200L19 10l-5.200 1.800L12 17l-1.800-5.200L5 10l5.200-1.800zM19 16l.800 2.200L22 19l-2.200.800L19 22l-.800-2.200L16 19l2.200-.800z',
  mail: 'M3 6h18v12H3zM3 7l9 6.500L21 7', lock: 'M6 11h12v9H6zM8.500 11V8a3.500 3.500 0 0 1 7 0v3', calendar: 'M4 6h16v14H4zM4 10h16M8.500 3.500v4M15.500 3.500v4',
  printer: 'M7 9V4h10v5M7 17H4V9h16v8h-3M7 14h10v6H7z', panel: 'M4 5h16v14H4zM9.500 5v14', receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16.500a4.500 4.500 0 1 0 0-9 4.500 4.500 0 0 0 0 9zM12 12h.01', percent: 'M19 5 5 19M7.500 9.500a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM16.500 18.500a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  send: 'M4 12l16-8-6 16-2.500-6.500zM11.500 13.500L20 4', bookmarkfill: 'M6 3h12v18l-6-4-6 4z',
  history: 'M4 12a8 8 0 1 0 2.500-5.800L4 8.500M4 4v4.500h4.500M12 8v4.500l3 1.800', plug: 'M9 3v5M15 3v5M6.500 8h11v4a5.500 5.500 0 0 1-11 0zM12 17.500V21',
};
export function icon(name, cls = '') {
  const svg = s('svg', { viewBox: '0 0 24 24', class: `icon ${cls}`.trim(), 'aria-hidden': 'true' });
  svg.append(s('path', { d: ICONS[name] || ICONS.info }));
  return svg;
}

/* ---------- Formatting ---------- */
const TZ = 'Asia/Kolkata';
const dFmt = new Intl.DateTimeFormat('en-IN', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric' });
const dtFmt = new Intl.DateTimeFormat('en-IN', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
const toDate = (v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00+05:30`) : new Date(v));
export const fmtDate = (v) => (v ? dFmt.format(toDate(v)) : '—');
export const fmtDateTime = (v) => (v ? dtFmt.format(toDate(v)).replace(/\b(am|pm)\b/, (m) => m.toUpperCase()) : '—');
export function ago(v) {
  if (!v) return '—';
  const mins = Math.round((Date.now() - new Date(v).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
  if (mins < 10080) return `${Math.round(mins / 1440)} d ago`;
  return fmtDate(v);
}
export function inr(v, { decimals } = {}) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—';
  const n = Number(v);
  const whole = Math.abs(n % 1) < 0.005;
  const d = decimals ?? (whole ? 0 : 2);
  return `${n < 0 ? '−' : ''}₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
}
export const num = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 }));
export function fmt(value, format) {
  if (value === null || value === undefined || value === '') return '—';
  switch (format) {
    case 'inr': return inr(value);
    case 'num': return num(value);
    case 'pct': return `${num(value)}%`;
    case 'delta': return `${value > 0 ? '+' : ''}${num(value)}%`;
    case 'x': return `${num(value)}×`;
    case 'hours': return `${num(value)} h`;
    case 'days': return `${num(value)} days`;
    case 'date': return fmtDate(value);
    default: return typeof value === 'number' ? num(value) : String(value);
  }
}
export const compact = (v) => { const n = Math.abs(v); return n >= 10000000 ? `${(v / 10000000).toFixed(1)}Cr` : n >= 100000 ? `${(v / 100000).toFixed(1)}L` : n >= 1000 ? `${(v / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(Math.round(v * 10) / 10); };
export const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
export const todayYmd = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
export const titleCase = (v) => String(v || '').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

/* ---------- API ---------- */
export class ApiError extends Error {
  constructor(status, data) { super((data && data.error) || 'Request failed.'); this.status = status; this.fields = (data && data.fields) || null; this.code = data && data.code; this.data = data || {}; }
}
export async function api(path, { method = 'GET', body, query, raw, signal } = {}) {
  let url = `/api${path}`;
  if (query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') qs.set(k, v);
    const text = qs.toString();
    if (text) url += (url.includes('?') ? '&' : '?') + text;
  }
  const headers = { Accept: 'application/json' };
  const init = { method, headers, credentials: 'same-origin', signal };
  if (method !== 'GET') headers['X-NearBuy-Request'] = '1';
  if (raw) { init.body = raw; headers['Content-Type'] = raw.type || 'application/octet-stream'; } else if (body !== undefined) { init.body = JSON.stringify(body); headers['Content-Type'] = 'application/json'; }
  let res;
  try { res = await fetch(url, init); } catch (err) { if (err.name === 'AbortError') throw err; throw new ApiError(0, { error: 'Could not reach the server. Check your connection and try again.' }); }
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await res.json().catch(() => ({})) : null;
  if (!res.ok) {
    const error = new ApiError(res.status, data || { error: `Request failed (${res.status}).` });
    if (res.status === 401 && error.code === 'unauthenticated' && state.me) { state.me = null; sessionExpired(); }
    throw error;
  }
  return data;
}
function sessionExpired() {
  const next = location.pathname + location.search;
  toast('Your session has ended. Please sign in again.', 'error');
  navigate(`/seller/login?next=${encodeURIComponent(next)}`, { replace: true });
}
/** Download a server-generated file. Failures are reported — the browser is never told a download worked when it did not. */
export async function download(path, query) {
  let url = `/api${path}`;
  if (query) { const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString(); if (qs) url += `?${qs}`; }
  try {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) { const data = await res.json().catch(() => ({})); throw new ApiError(res.status, data); }
    const blob = await res.blob();
    const match = /filename="?([^";]+)"?/.exec(res.headers.get('content-disposition') || '');
    const name = match ? match[1] : path.split('/').pop();
    const link = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 4000);
    toast(`Downloaded ${name}`, 'success');
    return true;
  } catch (err) { toast(err.message || 'Download failed.', 'error'); return false; }
}
export const can = (perm) => Boolean(state.me && state.me.permissions.includes(perm));
export async function refreshMe() {
  try { state.me = await api('/auth/me'); } catch (err) { if (err.status === 401) state.me = null; else throw err; }
  return state.me;
}

/* ---------- Router ---------- */
let renderRoute = () => {};
export function setRenderer(fn) { renderRoute = fn; }
export function navigate(to, { replace = false } = {}) {
  const current = location.pathname + location.search;
  if (to !== current) history[replace ? 'replaceState' : 'pushState']({}, '', to);
  return renderRoute();
}
export const reload = () => renderRoute({ soft: true });
export function currentQuery() { return Object.fromEntries(new URLSearchParams(location.search)); }
/** Update query-string filters in place (keeps filters shareable and alive across refresh). */
export function setQuery(patch, { replace = true } = {}) {
  const qs = new URLSearchParams(location.search);
  for (const [k, v] of Object.entries(patch)) { if (v === null || v === undefined || v === '') qs.delete(k); else qs.set(k, v); }
  const text = qs.toString();
  return navigate(location.pathname + (text ? `?${text}` : ''), { replace });
}
export function hrefWith(patch, base = location.pathname) {
  const qs = new URLSearchParams(base === location.pathname ? location.search : '');
  for (const [k, v] of Object.entries(patch)) { if (v === null || v === undefined || v === '') qs.delete(k); else qs.set(k, v); }
  const text = qs.toString();
  return base + (text ? `?${text}` : '');
}
export function initLinks() {
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href]');
    if (!link || link.target || link.hasAttribute('download')) return;
    const href = link.getAttribute('href');
    if (!href.startsWith('/seller') || href.startsWith('/seller/app/')) return;
    event.preventDefault();
    navigate(href);
  });
  window.addEventListener('popstate', () => renderRoute());
}
export function matchRoute(pathname) {
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  for (const route of state.routes) {
    const want = route.path.split('/').filter(Boolean);
    if (want.length !== parts.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < want.length; i += 1) {
      if (want[i].startsWith(':')) params[want[i].slice(1)] = decodeURIComponent(parts[i]);
      else if (want[i] !== parts[i]) { ok = false; break; }
    }
    if (ok) return { route, params };
  }
  return null;
}

/* ---------- Feedback ---------- */
let toastHost;
export function toast(message, type = 'info', ms = 4500) {
  if (!toastHost) { toastHost = h('div.toasts', { role: 'status', 'aria-live': 'polite' }); document.body.append(toastHost); }
  const el = h(`div.toast.${type}`, icon(type === 'error' ? 'alert' : type === 'success' ? 'check' : 'info'), h('div', message), h('button', { 'aria-label': 'Dismiss', onClick: () => el.remove() }, icon('x', 'sm')));
  toastHost.append(el);
  setTimeout(() => el.remove(), type === 'error' ? ms + 3000 : ms);
}
export function openModal({ title, subtitle, body, actions = [], wide = false, onClose }) {
  const previous = document.activeElement;
  const close = () => { layer.remove(); document.removeEventListener('keydown', onKey); if (previous && previous.focus) previous.focus(); if (onClose) onClose(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const foot = actions.length ? h('div.modal-foot', actions) : null;
  const dialog = h(`div.modal${wide ? '.wide' : ''}`, { role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div.modal-head', h('div', h('h2', title), subtitle ? h('p', subtitle) : null), h('button.icon-btn', { 'aria-label': 'Close', onClick: close }, icon('x'))),
    h('div.modal-body', body), foot);
  const layer = h('div.modal-layer', { onMousedown: (e) => { if (e.target === layer) close(); } }, dialog);
  document.body.append(layer);
  document.addEventListener('keydown', onKey);
  const first = dialog.querySelector('input:not([type=hidden]), select, textarea, .modal-foot .btn.primary, .modal-foot .btn');
  if (first) first.focus();
  return { close, dialog };
}
export function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (done) return; done = true; resolve(v); m.close(); };
    const m = openModal({
      title, body: typeof message === 'string' ? h('p', message) : message, onClose: () => { if (!done) { done = true; resolve(false); } },
      actions: [h('button.btn', { onClick: () => finish(false) }, 'Cancel'), h(`button.btn.${danger ? 'danger.solid' : 'primary'}`, { onClick: () => finish(true) }, confirmLabel)],
    });
  });
}
/** Run an async action from a button: disables it, shows progress, reports the real outcome. */
export async function busy(button, fn) {
  if (!button || button.disabled) return undefined;
  const label = [...button.childNodes];
  button.disabled = true;
  button.replaceChildren(h('span.spinner.sm'), ' Working…');
  try { return await fn(); } catch (err) { if (err.name !== 'AbortError') toast(err.message || 'Something went wrong.', 'error'); return undefined; } finally { button.disabled = false; button.replaceChildren(...label); }
}

/* ---------- Forms ---------- */
export function field(opts) {
  const { name, label, type = 'text', value, options, hint, required, placeholder, full, prefix, suffix, rows, disabled, attrs = {}, onInput, onChange } = opts;
  const id = `f-${name}-${Math.random().toString(36).slice(2, 7)}`;
  let control;
  const common = { id, name, disabled, required: undefined, onInput, onChange, ...attrs };
  if (type === 'select') {
    control = h('select.select', common, (opts.placeholderOption === false ? [] : [h('option', { value: '' }, placeholder || 'Select…')]).concat((options || []).map((o) => { const [val, text] = Array.isArray(o) ? o : typeof o === 'object' ? [o.value, o.label] : [o, o]; return h('option', { value: val, selected: String(value ?? '') === String(val) }, text); })));
  } else if (type === 'textarea') control = h('textarea.textarea', { ...common, rows: rows || 4, placeholder }, value ?? '');
  else if (type === 'password') {
    const input = h('input.input', { ...common, type: 'password', placeholder, autocomplete: opts.autocomplete || 'current-password', value: value ?? '' });
    const toggle = h('button', { type: 'button', 'aria-label': 'Show or hide password', onClick: () => { const show = input.type === 'password'; input.type = show ? 'text' : 'password'; toggle.replaceChildren(icon(show ? 'eyeoff' : 'eye', 'sm')); } }, icon('eye', 'sm'));
    control = h('div.pw-wrap', input, toggle);
  } else if (type === 'checkbox') {
    return h('div.field', { class: full ? 'full' : '', dataset: { field: name } }, h('label.check', h('input', { ...common, type: 'checkbox', checked: Boolean(value) }), h('span', label)), hint ? h('div.hint', hint) : null, h('div.error', { hidden: true }));
  } else {
    control = h('input.input', { ...common, type, placeholder, value: value ?? '', autocomplete: opts.autocomplete || 'off', inputmode: opts.inputmode, min: opts.min, max: opts.max, step: opts.step, maxlength: opts.maxlength });
    if (prefix) control = h('div.input-group', h('span.addon', prefix), control);
    else if (suffix) control = h('div.input-group.suffix', control, h('span.addon', suffix));
  }
  return h('div.field', { class: full ? 'full' : '', dataset: { field: name } },
    label ? h('label', { for: id }, label, required ? h('span.req', ' *') : null) : null, control, hint ? h('div.hint', hint) : null, h('div.error', { hidden: true }));
}
export function readForm(root) {
  const out = {};
  root.querySelectorAll('[name]').forEach((el) => {
    if (el.disabled) return;
    if (el.type === 'checkbox') out[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
    else if (el.type === 'number' || el.dataset.number !== undefined) out[el.name] = el.value === '' ? null : Number(el.value);
    else out[el.name] = el.value.trim();
  });
  return out;
}
export function clearErrors(root) {
  root.querySelectorAll('.field.invalid').forEach((f) => f.classList.remove('invalid'));
  root.querySelectorAll('.field .error').forEach((e) => { e.hidden = true; e.textContent = ''; });
  root.querySelectorAll('.form-error').forEach((e) => e.remove());
}
export function showErrors(root, error) {
  clearErrors(root);
  const fields = (error && error.fields) || {};
  let first = null;
  const unplaced = [];
  for (const [name, message] of Object.entries(fields)) {
    const holder = root.querySelector(`[data-field="${CSS.escape(name)}"]`);
    if (!holder) { unplaced.push(message); continue; }
    holder.classList.add('invalid');
    const slot = holder.querySelector('.error');
    if (slot) { slot.textContent = message; slot.hidden = false; }
    if (!first) first = holder;
  }
  const summary = [error && error.message, ...unplaced].filter(Boolean).join(' ');
  if (summary) {
    const box = h('div.banner.error.form-error', { role: 'alert' }, icon('alert'), h('div', summary));
    const anchor = root.querySelector('[data-form-error]') || root;
    anchor.prepend(box);
  }
  const target = first ? first.querySelector('input, select, textarea') : null;
  if (target) target.focus({ preventScroll: false }); else if (summary) root.querySelector('.form-error').scrollIntoView({ block: 'center', behavior: 'smooth' });
}
/** Standard submit wiring: disable, call, show server validation next to fields. Returns the response or undefined. */
export function onSubmit(form, handler) {
  form.setAttribute('novalidate', '');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.submitter || form.querySelector('button[type=submit]');
    clearErrors(form);
    const label = button ? [...button.childNodes] : null;
    if (button) { if (button.disabled) return; button.disabled = true; button.replaceChildren(h('span.spinner.sm'), ' Saving…'); }
    try { await handler(readForm(form), button); } catch (err) { if (err instanceof ApiError) showErrors(form, err); else { console.error(err); toast('Something went wrong in the page. Please retry.', 'error'); } } finally { if (button) { button.disabled = false; button.replaceChildren(...label); } }
  });
  return form;
}
export function formModal({ title, subtitle, fields, submitLabel = 'Save', danger = false, wide = false, intro, onSubmit: submit }) {
  return new Promise((resolve) => {
    let settled = false;
    const form = h('form.stack', h('div', { dataset: { formError: '' } }), intro || null, h(`div.${fields.length > 3 ? 'form-grid' : 'stack'}`, fields.map((f) => (f instanceof Node ? f : field({ full: fields.length > 3 ? f.full : undefined, ...f })))),
      h('div.form-actions', h('button.btn', { type: 'button', onClick: () => m.close() }, 'Cancel'), h(`button.btn.${danger ? 'danger.solid' : 'primary'}`, { type: 'submit' }, submitLabel)));
    const m = openModal({ title, subtitle, body: form, wide, onClose: () => { if (!settled) resolve(undefined); } });
    onSubmit(form, async (values) => { const result = await submit(values); settled = true; m.close(); resolve(result === undefined ? true : result); });
  });
}

/* ---------- Components ---------- */
const TONES = {
  green: ['active', 'approved', 'delivered', 'completed', 'paid', 'healthy', 'resolved', 'published', 'verified', 'refunded', 'recorded', 'done'],
  amber: ['pending_approval', 'pending_confirmation', 'pending_verification', 'under_review', 'low', 'waiting_for_seller', 'awaiting_payout', 'scheduled', 'pending', 'pending_dispatch', 'invited', 'paused', 'action_required', 'unverified', 'packed'],
  red: ['rejected', 'cancelled', 'qc_failed', 'out_of_stock', 'critical', 'failed_delivery', 'returned', 'failed', 'expired', 'removed'],
  blue: ['new', 'open', 'processing', 'in_progress', 'in_transit', 'shipped', 'ready_to_ship', 'ready_for_pickup', 'received'],
  violet: ['demo_recorded'],
};
export function tone(status) { for (const [name, list] of Object.entries(TONES)) if (list.includes(status)) return name; return ''; }
export const badge = (label, t = '') => h(`span.badge${t ? `.${t}` : ''}`, label);
export const statusBadge = (status, label) => badge(label || titleCase(status), tone(status));
export const demoTag = (show = true) => (show ? h('span.demo-tag', { title: 'This record is sample data created for demonstration' }, 'DEMO DATA') : null);
export const uploadUrl = (id) => withSession(`/api/uploads/${id}`);
export function thumb(imageId, title, cls = '') {
  const el = h(`span.thumb${cls ? `.${cls}` : ''}`);
  if (imageId) el.append(h('img', { src: uploadUrl(imageId), alt: '', loading: 'lazy' })); else el.textContent = initials(title);
  return el;
}
export const banner = (kind, content, action) => h(`div.banner${kind ? `.${kind}` : ''}`, icon(kind === 'error' ? 'alert' : kind === 'warn' ? 'alert' : kind === 'success' ? 'check' : kind === 'integration' ? 'plug' : 'info'), h('div.grow', content), action || null);
export const demoBanner = (text) => h('div.banner.demo', icon('info'), h('div.grow', h('b', 'DEMO DATA. '), text || 'Records marked DEMO DATA are samples created so you can explore the Seller Hub. They are not real customer orders or payments.'));
export const integrationNote = (text) => h('div.banner.integration', icon('plug'), h('div.grow', h('b', 'Needs an external integration. '), text));
export function emptyState({ ico = 'box', title, text, action }) { return h('div.empty', h('div.ico', icon(ico, 'lg')), h('h3', title), text ? h('p', text) : null, action || null); }
export function crumbs(items) {
  const out = [];
  items.forEach((item, i) => { if (i) out.push(icon('right')); out.push(Array.isArray(item) ? h('a', { href: item[1] }, item[0]) : h('span', item)); });
  return h('nav.crumbs', { 'aria-label': 'Breadcrumb' }, out);
}
export function pageHead({ title, subtitle, actions, trail, tag }) {
  return h('div', trail ? crumbs([['Seller Hub', '/seller/dashboard'], ...trail]) : null,
    h('div.page-head', h('div', h('h1', title, tag ? [' ', tag] : null), subtitle ? h('p', subtitle) : null), actions && actions.filter(Boolean).length ? h('div.actions', actions) : null));
}
export function card({ title, subtitle, actions, body, flush = false, foot, cls = '' }) {
  return h(`section.card${cls ? `.${cls}` : ''}`, title ? h('div.card-head', h('div', h('h2', title), subtitle ? h('p', subtitle) : null), actions ? h('div.row.wrap', actions) : null) : null, h(`div.card-body${flush ? '.flush' : ''}`, body), foot ? h('div.card-foot', foot) : null);
}
export function statCard({ label, value, hint, ico = 'chart', tone: t = '', delta, href }) {
  const deltaEl = delta === null || delta === undefined ? null : h(`span.delta.${delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'}`, `${delta > 0 ? '▲' : delta < 0 ? '▼' : '•'} ${Math.abs(delta)}%`);
  return h(href ? 'a.stat' : 'div.stat', { href }, h('div.stat-top', h('span', label), h(`span.stat-ico${t ? `.${t}` : ''}`, icon(ico))), h('div.stat-value', value), h('div.stat-hint', deltaEl, hint ? h('span', hint) : null));
}
export function tabs(items, active, makeHref) {
  return h('div.tabs', { role: 'tablist' }, items.map((item) => h(`a.tab${item.key === active ? '.active' : ''}`, { href: makeHref(item.key), role: 'tab', 'aria-selected': item.key === active ? 'true' : 'false' }, item.label, item.count !== undefined ? h('span.count', item.count) : null)));
}
export function subnav(items, activePath = location.pathname) {
  return h('nav.subnav', items.map(([label, href]) => h(`a${href === activePath ? '.active' : ''}`, { href }, label)));
}
/** columns: [{ key, label, align, sort, render(row), width }] — sort keys map to the server's whitelist. */
export function dataTable({ columns, rows, empty, sort, compact: isCompact, rowKey }) {
  if (!rows.length) return empty instanceof Node ? empty : emptyState(empty || { title: 'Nothing here yet' });
  const head = columns.map((c) => {
    let content = c.label;
    if (c.sort) {
      const asc = sort === c.sort; const desc = sort === `-${c.sort}`;
      content = h('button', { type: 'button', class: asc || desc ? 'sorted' : '', title: 'Sort', onClick: () => setQuery({ sort: asc ? `-${c.sort}` : desc ? null : c.sort, page: null }) }, c.label, icon(desc ? 'down' : asc ? 'up' : 'filter', 'sm'));
    }
    return h(`th${c.align === 'right' ? '.right' : ''}`, { style: c.width ? { width: c.width } : null, scope: 'col' }, content);
  });
  return h('div.table-wrap', h(`table.data${isCompact ? '.compact' : ''}`, h('thead', h('tr', head)), h('tbody', rows.map((row, i) => h('tr', { dataset: rowKey ? { key: row[rowKey] } : null }, columns.map((c) => h(`td${c.align === 'right' ? '.right.mono' : ''}${c.cls ? `.${c.cls}` : ''}`, c.render ? c.render(row, i) : row[c.key] ?? '—')))))));
}
export function pager(list, param = 'page') {
  if (!list || list.total === undefined) return null;
  const from = list.total ? (list.page - 1) * list.pageSize + 1 : 0;
  const to = Math.min(list.total, list.page * list.pageSize);
  return h('div.pager', h('span', list.total ? `Showing ${from}–${to} of ${list.total}` : 'No results'),
    h('div.row', h('button.btn.sm', { disabled: list.page <= 1, onClick: () => setQuery({ [param]: list.page - 1 }) }, icon('left', 'sm'), 'Previous'), h('span', `Page ${list.page} of ${list.pages}`), h('button.btn.sm', { disabled: list.page >= list.pages, onClick: () => setQuery({ [param]: list.page + 1 }) }, 'Next', icon('right', 'sm'))));
}
/** Debounced search box bound to a query-string key; focus survives the re-render. */
export function searchBox(placeholder, key = 'q') {
  let timer;
  const input = h('input', { type: 'search', placeholder, value: currentQuery()[key] || '', 'aria-label': placeholder, dataset: { keep: `search-${key}` }, onInput: () => { clearTimeout(timer); timer = setTimeout(() => setQuery({ [key]: input.value.trim(), page: null }), 320); } });
  return h('div.search', icon('search'), input);
}
export function selectFilter(key, options, placeholder) {
  const current = currentQuery()[key] || '';
  return h('select.select.sm', { style: { width: 'auto', minWidth: '150px' }, 'aria-label': placeholder, onChange: (e) => setQuery({ [key]: e.target.value, page: null }) }, [h('option', { value: '' }, placeholder), ...options.map((o) => { const [val, text] = Array.isArray(o) ? o : [o, o]; return h('option', { value: val, selected: current === String(val) }, text); })]);
}
export const RANGES = [['today', 'Today'], ['yesterday', 'Yesterday'], ['7d', '7 days'], ['30d', '30 days'], ['90d', '90 days'], ['custom', 'Custom']];
export function rangeFilter(fallback = '30d', extra = []) {
  const q = currentQuery();
  const active = q.range || fallback;
  const seg = h('div.seg', { role: 'group', 'aria-label': 'Date range' }, [...RANGES.slice(0, 5), ...extra, RANGES[5]].map(([key, label]) => h(`button${active === key ? '.active' : ''}`, { type: 'button', onClick: () => (key === 'custom' ? setQuery({ range: 'custom', from: q.from || todayYmd(), to: q.to || todayYmd(), page: null }) : setQuery({ range: key, from: null, to: null, page: null })) }, label)));
  if (active !== 'custom') return h('div.row.wrap', seg);
  const from = h('input.input.sm', { type: 'date', value: q.from || '', max: todayYmd(), 'aria-label': 'From date', style: { width: 'auto' } });
  const to = h('input.input.sm', { type: 'date', value: q.to || '', max: todayYmd(), 'aria-label': 'To date', style: { width: 'auto' } });
  const apply = h('button.btn.sm.navy', { type: 'button', onClick: () => { if (!from.value || !to.value) { toast('Choose both dates.', 'error'); return; } if (from.value > to.value) { toast('The start date must be on or before the end date.', 'error'); return; } setQuery({ range: 'custom', from: from.value, to: to.value, page: null }); } }, 'Apply');
  return h('div.row.wrap', seg, from, h('span.muted', 'to'), to, apply);
}
export const rangeQuery = (fallback = '30d') => { const q = currentQuery(); return { range: q.range || fallback, from: q.from, to: q.to }; };
export function kv(pairs) { return h('dl.kv', pairs.filter(Boolean).flatMap(([k, v]) => [h('dt', k), h('dd', v === null || v === undefined || v === '' ? '—' : v)])); }
export function timeline(events, { doneAll = false } = {}) {
  if (!events.length) return h('p.muted', 'No history yet.');
  return h('ol.timeline', events.map((e, i) => h(`li${doneAll || i < events.length - 1 ? '.done' : ''}`, h('b', e.title), e.note ? h('div.small', e.note) : null, h('div.tiny.muted', `${fmtDateTime(e.created_at)}${e.actor ? ` · ${e.actor}` : ''}`))));
}
export function rowMenu(items) {
  const visible = items.filter(Boolean);
  if (!visible.length) return null;
  const wrap = h('span.row-menu');
  let pop = null;
  const close = () => { if (pop) { pop.remove(); pop = null; document.removeEventListener('click', outside, true); } };
  const outside = (e) => { if (!wrap.contains(e.target)) close(); };
  const button = h('button.icon-btn', { type: 'button', 'aria-label': 'More actions', 'aria-haspopup': 'menu', onClick: () => {
    if (pop) { close(); return; }
    pop = h('div.popover.menu', { role: 'menu' }, visible.map((item) => (item.href ? h('a', { href: item.href, role: 'menuitem', onClick: close }, icon(item.ico || 'right', 'sm'), item.label) : h('button', { type: 'button', role: 'menuitem', class: item.danger ? 'neg' : '', onClick: () => { close(); item.onClick(); } }, icon(item.ico || 'right', 'sm'), item.label))));
    wrap.append(pop);
    const rect = pop.getBoundingClientRect();
    if (rect.bottom > window.innerHeight - 8) { pop.style.top = 'auto'; pop.style.bottom = 'calc(100% + 6px)'; }
    document.addEventListener('click', outside, true);
  } }, icon('more'));
  wrap.append(button);
  return wrap;
}
export function loadingBlock(lines = 6) { return h('div.loading-block', { 'aria-busy': 'true', 'aria-label': 'Loading' }, Array.from({ length: lines }, (_, i) => h('div.skeleton', { style: { width: `${92 - (i % 3) * 18}%` } }))); }
export function errorState(err, retry) {
  const forbidden = err && err.status === 403;
  const missing = err && err.status === 404;
  return h('div.card', emptyState({
    ico: forbidden ? 'lock' : missing ? 'search' : 'alert', title: forbidden ? 'You do not have access to this page' : missing ? 'Not found' : 'This page could not be loaded',
    text: (err && err.message) || 'Please try again.', action: h('div.row', retry && !forbidden && !missing ? h('button.btn.primary', { onClick: retry }, icon('refresh', 'sm'), 'Try again') : null, h('a.btn', { href: '/seller/dashboard' }, 'Go to dashboard')),
  }));
}

/* ---------- Charts (SVG, no library) ---------- */
export const PALETTE = ['#1c3d78', '#f47718', '#2f7d4f', '#6b4fb3', '#2f8f9a', '#c0392b', '#a86200', '#7b8794', '#d2548f'];
const TONE_COLOR = { navy: '#1c3d78', orange: '#f47718', green: '#2f7d4f', violet: '#6b4fb3', red: '#c0392b', amber: '#a86200', grey: '#9aa5b5' };
const colorOf = (series, i) => (series.muted ? '#b3bccb' : TONE_COLOR[series.tone] || PALETTE[i % PALETTE.length]);
function niceMax(v) { if (v <= 0) return 1; const p = 10 ** Math.floor(Math.log10(v)); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }
function axes(svg, { W, H, L, T, B, R, max, labels, format, band }) {
  const plotW = W - L - R; const plotH = H - T - B;
  for (let i = 0; i <= 4; i += 1) {
    const y = T + plotH - (plotH * i) / 4;
    svg.append(s('line', { x1: L, x2: W - R, y1: y, y2: y, class: 'gridline' }));
    const v = (max * i) / 4;
    svg.append(s('text', { x: L - 8, y: y + 4, 'text-anchor': 'end', class: 'axis' }, format === 'inr' ? `₹${compact(v)}` : format === 'pct' ? `${compact(v)}%` : compact(v)));
  }
  const n = labels.length;
  const step = Math.max(1, Math.ceil(n / Math.max(3, Math.floor((W - L - R) / 86))));
  labels.forEach((label, i) => {
    if (i % step !== 0 && i !== n - 1) return;
    if (i === n - 1 && (n - 1) % step !== 0 && (n - 1) % step < step / 2) return;
    const x = band ? L + (plotW * (i + 0.5)) / n : L + (n === 1 ? plotW / 2 : (plotW * i) / (n - 1));
    svg.append(s('text', { x, y: H - 6, 'text-anchor': 'middle', class: 'axis' }, label));
  });
  return { plotW, plotH };
}
function tipFor(wrap) {
  const tip = h('div.chart-tip', { hidden: true });
  wrap.append(tip);
  return { show(xPct, yPct, title, rows) { tip.hidden = false; tip.style.left = `${Math.min(88, Math.max(12, xPct))}%`; tip.style.top = `${yPct}%`; tip.replaceChildren(h('b', title), ...rows.map(([color, name, value]) => h('div', h('i', { style: { background: color } }), `${name}: ${value}`))); }, hide() { tip.hidden = true; } };
}
const legend = (series) => (series.length > 1 ? h('div.legend', series.map((se, i) => h('span', h('i', { style: { background: colorOf(se, i) } }), se.name))) : null);
const allZero = (series) => series.every((se) => se.data.every((v) => !v));
function chartEmpty(text) { return h('div.empty', { style: { padding: '30px 12px' } }, h('div.ico', icon('chart', 'lg')), h('p', text || 'No data for this period yet.')); }

/** Charts are drawn at the real pixel width of their container and redrawn when it changes, so text never scales. */
function responsive(draw) {
  const host = h('div.chart-host');
  let last = 0;
  const render = (width) => { const W = Math.max(280, Math.round(width)); if (Math.abs(W - last) < 6) return; last = W; host.replaceChildren(draw(W)); };
  render(720);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver((entries) => { const w = entries[0].contentRect.width; if (w) render(w); }).observe(host);
  return host;
}
export function lineChart(def) { return !def.labels.length || allZero(def.series) ? chartEmpty() : responsive((W) => drawLine(def, W)); }
export function barChart(def) { return !def.labels.length || allZero(def.series) ? chartEmpty() : responsive((W) => drawBar(def, W)); }
function drawLine({ labels, series, height = 230 }, W) {
  const narrow = W < 480; const H = narrow ? Math.min(height, 200) : height; const L = 50; const R = 12; const T = 12; const B = 26;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': `Line chart: ${series.map((x) => x.name).join(', ')}` });
  const max = niceMax(Math.max(...series.flatMap((x) => x.data)));
  const { plotW, plotH } = axes(svg, { W, H, L, T, B, R, max, labels, format: series[0].format });
  const X = (i) => L + (labels.length === 1 ? plotW / 2 : (plotW * i) / (labels.length - 1));
  const Y = (v) => T + plotH - (plotH * v) / max;
  series.forEach((se, si) => {
    const color = colorOf(se, si);
    const pts = se.data.map((v, i) => `${X(i).toFixed(1)},${Y(v || 0).toFixed(1)}`);
    if (si === 0 && !se.muted) svg.append(s('polygon', { points: `${X(0)},${T + plotH} ${pts.join(' ')} ${X(se.data.length - 1)},${T + plotH}`, fill: color, opacity: 0.08 }));
    svg.append(s('polyline', { points: pts.join(' '), fill: 'none', stroke: color, 'stroke-width': se.muted ? 1.6 : 2.3, 'stroke-dasharray': se.muted ? '5 4' : null, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    if (labels.length <= 14) se.data.forEach((v, i) => svg.append(s('circle', { cx: X(i), cy: Y(v || 0), r: 2.8, fill: '#fff', stroke: color, 'stroke-width': 1.8 })));
  });
  const cursor = s('line', { y1: T, y2: T + plotH, stroke: '#9aa5b5', 'stroke-dasharray': '3 3', visibility: 'hidden' });
  svg.append(cursor);
  const wrap = h('div.chart', svg);
  const tip = tipFor(wrap);
  svg.addEventListener('pointermove', (e) => {
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.max(0, Math.min(labels.length - 1, Math.round(((x - L) / plotW) * (labels.length - 1))));
    cursor.setAttribute('x1', X(i)); cursor.setAttribute('x2', X(i)); cursor.setAttribute('visibility', 'visible');
    const top = Math.min(...series.map((se) => Y(se.data[i] || 0)));
    tip.show((X(i) / W) * 100, (top / H) * 100, labels[i], series.map((se, si) => [colorOf(se, si), se.name, fmt(se.data[i] || 0, se.format)]));
  });
  svg.addEventListener('pointerleave', () => { cursor.setAttribute('visibility', 'hidden'); tip.hide(); });
  return h('div.stack.sm', wrap, legend(series));
}
function drawBar({ labels, series, height = 230 }, W) {
  const H = W < 480 ? Math.min(height, 200) : height; const L = 50; const R = 12; const T = 12; const B = 26;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': `Bar chart: ${series.map((x) => x.name).join(', ')}` });
  const max = niceMax(Math.max(...series.flatMap((x) => x.data)));
  const { plotW, plotH } = axes(svg, { W, H, L, T, B, R, max, labels, format: series[0].format, band: true });
  const wrap = h('div.chart', svg);
  const tip = tipFor(wrap);
  const bandW = plotW / labels.length;
  const barW = Math.min(34, (bandW * 0.72) / series.length);
  labels.forEach((label, i) => {
    const group = s('g', {});
    const x0 = L + bandW * i + (bandW - barW * series.length) / 2;
    let top = T + plotH;
    series.forEach((se, si) => { const v = se.data[i] || 0; const bh = (plotH * v) / max; top = Math.min(top, T + plotH - bh); group.append(s('rect', { x: x0 + barW * si, y: T + plotH - bh, width: Math.max(1, barW - 2), height: Math.max(0, bh), rx: 3, fill: colorOf(se, si) })); });
    group.append(s('rect', { x: L + bandW * i, y: T, width: bandW, height: plotH, fill: 'transparent' }));
    group.addEventListener('pointerenter', () => tip.show(((L + bandW * (i + 0.5)) / W) * 100, (top / H) * 100, label, series.map((se, si) => [colorOf(se, si), se.name, fmt(se.data[i] || 0, se.format)])));
    group.addEventListener('pointerleave', () => tip.hide());
    svg.append(group);
  });
  return h('div.stack.sm', wrap, legend(series));
}
export function hbarChart({ labels, series }) {
  const se = series[0];
  if (!labels.length || allZero(series)) return chartEmpty();
  const max = Math.max(...se.data, 1);
  return h('div.hbar', labels.map((label, i) => h('div.hbar-row', h('span.truncate', { title: label }, label), h('div.bar-track', h('span', { style: { width: `${Math.max(2, (se.data[i] / max) * 100)}%`, background: colorOf(se, 0) } })), h('b.mono', fmt(se.data[i], se.format)))));
}
export function donutChart({ labels, series }) {
  const se = series[0];
  const total = se.data.reduce((a, b) => a + b, 0);
  if (!total) return chartEmpty();
  const svg = s('svg', { viewBox: '0 0 120 120', role: 'img', 'aria-label': 'Share chart' });
  const r = 46; const c = 2 * Math.PI * r;
  let offset = 0;
  se.data.forEach((v, i) => { if (!v) return; const len = (v / total) * c; svg.append(s('circle', { cx: 60, cy: 60, r, fill: 'none', stroke: PALETTE[i % PALETTE.length], 'stroke-width': 17, 'stroke-dasharray': `${len} ${c - len}`, 'stroke-dashoffset': -offset, transform: 'rotate(-90 60 60)' })); offset += len; });
  svg.append(s('text', { x: 60, y: 58, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 750, fill: '#1b2942', 'font-family': 'Manrope, sans-serif' }, se.format === 'inr' ? `₹${compact(total)}` : compact(total)), s('text', { x: 60, y: 72, 'text-anchor': 'middle', 'font-size': 7.5, fill: '#6c788d' }, 'Total'));
  return h('div.donut-wrap', svg, h('div.donut-legend', labels.map((label, i) => h('div', h('span', h('i', { style: { background: PALETTE[i % PALETTE.length] } }), label), h('b.mono', `${fmt(se.data[i], se.format)} · ${Math.round((se.data[i] / total) * 100)}%`)))));
}
export function chart(def) { return def.type === 'bar' ? barChart(def) : def.type === 'hbar' ? hbarChart(def) : def.type === 'donut' ? donutChart(def) : lineChart(def); }

/* ---------- Files ---------- */
export function pickFile(accept) {
  return new Promise((resolve) => {
    const input = h('input', { type: 'file', accept, style: { display: 'none' } });
    input.addEventListener('change', () => { resolve(input.files[0] || null); input.remove(); });
    input.addEventListener('cancel', () => { resolve(null); input.remove(); });
    document.body.append(input);
    input.click();
  });
}
export const readText = (file) => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(new Error('The file could not be read.')); r.readAsText(file); });
export const uploadFile = (file, kind) => api('/uploads', { method: 'POST', query: { kind, name: file.name }, raw: file });
