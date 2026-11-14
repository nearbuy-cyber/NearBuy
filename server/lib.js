'use strict';
// Shared helpers for the NearBuy Seller Hub server: errors, validation, CSV, crypto, money and dates.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.resolve(process.env.NEARBUY_DATA_DIR || path.join(ROOT, 'data'));
fs.mkdirSync(DATA_DIR, { recursive: true });

class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra || {};
  }
}
const bad = (message, fields) => new HttpError(400, message, fields ? { fields } : undefined);
const notFound = (what = 'Record') => new HttpError(404, `${what} not found.`);
const forbidden = (message = 'You do not have permission to do this.') => new HttpError(403, message);
const conflict = (message) => new HttpError(409, message);

// The demo seeder back-dates records by pinning the clock; in normal operation the clock is the real time.
let pinnedClock = null;
function setClock(iso) { pinnedClock = iso ? Date.parse(iso) : null; }
function nowIso() {
  if (pinnedClock === null) return new Date().toISOString();
  pinnedClock += 1000; // keep seeded events in a stable order
  return new Date(pinnedClock).toISOString();
}
const daysFromNow = (days, base = Date.now()) => new Date(base + days * 86400000).toISOString();
// Business days are counted in India Standard Time.
const IST_OFFSET_MIN = 330;
const istDate = (iso) => new Date((iso ? Date.parse(iso) : Date.now()) + IST_OFFSET_MIN * 60000).toISOString().slice(0, 10);
const istDayStart = (ymd) => new Date(`${ymd}T00:00:00+05:30`).toISOString();
const istDayEnd = (ymd) => new Date(`${ymd}T23:59:59.999+05:30`).toISOString();
const addDays = (ymd, n) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const isYmd = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
/** Resolve a ?range= / ?from= / ?to= query into concrete IST dates plus the equally long previous period. */
function resolveRange(query, fallback = '30d') {
  const today = istDate();
  let key = query.range || fallback;
  let from; let to;
  if (key === 'custom') {
    // A custom range that cannot be honoured is refused rather than silently swapped for another period.
    if (!isYmd(query.from) || !isYmd(query.to)) throw bad('Choose both a start date and an end date.', { from: 'Enter dates as YYYY-MM-DD.' });
    if (query.from > query.to) throw bad('The start date must be on or before the end date.', { from: 'Start date is after the end date.' });
    from = query.from; to = query.to;
  }
  else if (key === 'today') { from = today; to = today; }
  else if (key === 'yesterday') { from = addDays(today, -1); to = from; }
  else if (key === 'all') { from = '2000-01-01'; to = today; }
  else {
    const days = { '7d': 7, '30d': 30, '90d': 90 }[key] || 30;
    if (!{ '7d': 1, '30d': 1, '90d': 1 }[key]) key = '30d';
    from = addDays(today, -(days - 1)); to = today;
  }
  const length = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  const labels = { today: 'Today', yesterday: 'Yesterday', '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days', all: 'All time', custom: 'Custom range' };
  return { key, from, to, days: length, label: labels[key], fromIso: istDayStart(from), toIso: istDayEnd(to), prevFromIso: istDayStart(addDays(from, -length)), prevToIso: istDayEnd(addDays(from, -1)), prevFrom: addDays(from, -length) };
}
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/* ---------- Validation ---------- */
const PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  mobile: /^[6-9]\d{9}$/,
  pincode: /^[1-9]\d{5}$/,
  gstin: /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/,
  pan: /^[A-Z]{5}\d{4}[A-Z]$/,
  ifsc: /^[A-Z]{4}0[A-Z0-9]{6}$/,
  account: /^\d{9,18}$/,
  sku: /^[A-Za-z0-9][A-Za-z0-9._-]{1,39}$/,
  date: /^\d{4}-\d{2}-\d{2}$/,
};
const PATTERN_HINT = {
  email: 'Enter a valid email address.',
  mobile: 'Enter a 10-digit Indian mobile number starting with 6–9.',
  pincode: 'Enter a valid 6-digit PIN code.',
  gstin: 'Enter a valid 15-character GSTIN (for example 07ABCDE1234F1Z5).',
  pan: 'Enter a valid 10-character PAN (for example ABCDE1234F).',
  ifsc: 'Enter a valid 11-character IFSC (for example HDFC0001234).',
  account: 'Enter a bank account number of 9 to 18 digits.',
  sku: 'Use 2–40 letters, digits, dots, hyphens or underscores.',
  date: 'Enter a valid date.',
};

/**
 * validate(input, schema) -> cleaned object. Throws 400 with per-field messages.
 * Rule: { type: 'string'|'number'|'int'|'bool'|'array'|'object', required, min, max, enum, format, label, upper, default }
 */
function validate(input, schema, { partial = false, into = null, prefix = '' } = {}) {
  const src = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const out = {};
  const errors = {};
  for (const [key, rule] of Object.entries(schema)) {
    let val = src[key];
    const label = rule.label || key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
    const missing = val === undefined || val === null || (typeof val === 'string' && val.trim() === '');
    if (missing) {
      if (partial && val === undefined) continue;
      if (rule.required) { errors[key] = `${label} is required.`; continue; }
      if (rule.default !== undefined) out[key] = typeof rule.default === 'function' ? rule.default() : rule.default;
      else out[key] = rule.type === 'array' ? [] : rule.type === 'bool' ? false : null;
      continue;
    }
    const type = rule.type || 'string';
    if (type === 'string') {
      if (typeof val === 'number') val = String(val);
      if (typeof val !== 'string') { errors[key] = `${label} must be text.`; continue; }
      val = val.replace(/\u0000/g, '').trim();
      if (rule.upper) val = val.toUpperCase();
      if (rule.lower) val = val.toLowerCase();
      if (rule.min && val.length < rule.min) { errors[key] = `${label} must be at least ${rule.min} characters.`; continue; }
      if (val.length > (rule.max || 500)) { errors[key] = `${label} must be at most ${rule.max || 500} characters.`; continue; }
      if (rule.format && !PATTERNS[rule.format].test(val)) { errors[key] = PATTERN_HINT[rule.format]; continue; }
      if (rule.format === 'date' && Number.isNaN(Date.parse(val))) { errors[key] = PATTERN_HINT.date; continue; }
      if (rule.enum && !rule.enum.includes(val)) { errors[key] = `Choose a valid ${label.toLowerCase()}.`; continue; }
    } else if (type === 'number' || type === 'int') {
      const num = typeof val === 'string' ? Number(val.trim()) : val;
      if (typeof num !== 'number' || !Number.isFinite(num)) { errors[key] = `${label} must be a number.`; continue; }
      if (type === 'int' && !Number.isInteger(num)) { errors[key] = `${label} must be a whole number.`; continue; }
      if (rule.min !== undefined && num < rule.min) { errors[key] = `${label} must be at least ${rule.min}.`; continue; }
      if (rule.max !== undefined && num > rule.max) { errors[key] = `${label} must be at most ${rule.max}.`; continue; }
      val = type === 'int' ? num : r2(num);
    } else if (type === 'bool') {
      val = val === true || val === 'true' || val === 1 || val === '1' || val === 'on';
      if (rule.mustBeTrue && !val) { errors[key] = rule.message || `${label} must be accepted.`; continue; }
    } else if (type === 'array') {
      if (!Array.isArray(val)) { errors[key] = `${label} must be a list.`; continue; }
      if (rule.min && val.length < rule.min) { errors[key] = rule.message || `Add at least ${rule.min} ${label.toLowerCase()}.`; continue; }
      if (val.length > (rule.max || 100)) { errors[key] = `${label} can have at most ${rule.max || 100} entries.`; continue; }
      if (rule.of === 'string') val = val.map((x) => String(x == null ? '' : x).trim().slice(0, rule.itemMax || 200)).filter(Boolean);
      if (rule.of === 'int') {
        val = val.map((x) => Number(x));
        if (val.some((x) => !Number.isInteger(x))) { errors[key] = `${label} is not valid.`; continue; }
      }
    } else if (type === 'object') {
      if (typeof val !== 'object' || Array.isArray(val)) { errors[key] = `${label} is not valid.`; continue; }
    }
    out[key] = val;
  }
  // With `into`, problems are collected for the caller (so one response can report every field) instead of thrown.
  if (into) { for (const [key, message] of Object.entries(errors)) into[`${prefix}${key}`] = message; return out; }
  if (Object.keys(errors).length) throw bad('Please correct the highlighted fields.', errors);
  return out;
}

/* ---------- CSV ---------- */
function csvCell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(headers, rows) {
  // headers: [[key, label], ...]
  const lines = [headers.map((h) => csvCell(h[1])).join(',')];
  for (const row of rows) lines.push(headers.map((h) => csvCell(typeof h[0] === 'function' ? h[0](row) : row[h[0]])).join(','));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const src = String(text || '').replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i += 1; } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  if (!rows.length) return { headers: [], records: [] };
  const headers = rows[0].map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''));
  const records = rows.slice(1).map((r, idx) => {
    const rec = { _line: idx + 2 };
    headers.forEach((h, i) => { rec[h] = (r[i] || '').trim().replace(/^'(?=[=+\-@])/, ''); });
    return rec;
  });
  return { headers, records };
}

/* ---------- Secrets and encryption at rest ---------- */
let dataKey = null;
function getDataKey() {
  if (dataKey) return dataKey;
  if (process.env.NEARBUY_DATA_KEY) {
    const key = Buffer.from(process.env.NEARBUY_DATA_KEY, 'base64');
    if (key.length !== 32) throw new Error('NEARBUY_DATA_KEY must be 32 random bytes, base64-encoded.');
    dataKey = key;
    return dataKey;
  }
  const file = path.join(DATA_DIR, '.data-key');
  if (fs.existsSync(file)) dataKey = Buffer.from(fs.readFileSync(file, 'utf8').trim(), 'base64');
  else {
    dataKey = crypto.randomBytes(32);
    fs.writeFileSync(file, dataKey.toString('base64'), { mode: 0o600 });
    console.warn('[nearbuy] NEARBUY_DATA_KEY is not set — generated a local key at data/.data-key. Set NEARBUY_DATA_KEY from a secret manager in production.');
  }
  return dataKey;
}
function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getDataKey(), iv);
  const body = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${body.toString('base64')}`;
}
function decrypt(blob) {
  const [, iv, tag, body] = String(blob).split('.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getDataKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(body, 'base64')), decipher.final()]).toString('utf8');
}
const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$${salt.toString('base64')}$${hash.toString('base64')}`;
}
function verifyPassword(password, stored) {
  try {
    const [scheme, n, salt, hash] = String(stored).split('$');
    if (scheme !== 'scrypt') return false;
    const expected = Buffer.from(hash, 'base64');
    const actual = crypto.scryptSync(String(password), Buffer.from(salt, 'base64'), expected.length, { N: Number(n), r: 8, p: 1 });
    return crypto.timingSafeEqual(expected, actual);
  } catch { return false; }
}
function passwordProblems(password) {
  const p = String(password || '');
  if (p.length < 8) return 'Password must be at least 8 characters.';
  if (p.length > 128) return 'Password must be at most 128 characters.';
  if (!/[a-z]/.test(p) || !/[A-Z]/.test(p) || !/\d/.test(p)) return 'Password needs an uppercase letter, a lowercase letter and a number.';
  return null;
}

const maskMobile = (m) => (m ? `${String(m).slice(0, 2)}••••••${String(m).slice(-2)}` : '');
const maskName = (name) => String(name || '').split(/\s+/).filter(Boolean).map((part) => `${part[0]}${'•'.repeat(Math.max(2, Math.min(part.length - 1, 5)))}`).join(' ');
const maskEmail = (email) => {
  const [user, domain] = String(email || '').split('@');
  return domain ? `${user.slice(0, 2)}•••@${domain}` : '';
};

const INDIAN_STATES = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Chandigarh', 'Andaman and Nicobar Islands', 'Dadra and Nagar Haveli and Daman and Diu', 'Lakshadweep'].sort();
const BUSINESS_TYPES = ['Sole proprietorship', 'Partnership', 'Private limited company', 'Limited liability partnership', 'One person company', 'Hindu undivided family', 'Other'];
const CATEGORIES = ['Electronics', 'Fashion', 'Home and Kitchen', 'Beauty', 'Grocery', 'Books', 'Toys', 'Sports', 'Accessories'];
// Illustrative marketplace fee schedule used for settlement calculations in this build.
const COMMISSION_RATE = { Electronics: 0.08, Fashion: 0.15, 'Home and Kitchen': 0.12, Beauty: 0.1, Grocery: 0.06, Books: 0.07, Toys: 0.11, Sports: 0.11, Accessories: 0.14 };
const GST_RATES = [0, 5, 12, 18, 28];

module.exports = {
  ROOT, DATA_DIR, setClock, istDate, istDayStart, istDayEnd, addDays, isYmd, resolveRange, HttpError, bad, notFound, forbidden, conflict, nowIso, daysFromNow, r2, validate, PATTERNS,
  toCsv, parseCsv, encrypt, decrypt, sha256, randomToken, hashPassword, verifyPassword, passwordProblems,
  maskMobile, maskName, maskEmail, INDIAN_STATES, BUSINESS_TYPES, CATEGORIES, COMMISSION_RATE, GST_RATES,
};
