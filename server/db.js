'use strict';
// SQLite persistence for the NearBuy Seller Hub (Node's built-in node:sqlite — no native dependencies).
const path = require('node:path');
const { DATA_DIR, nowIso } = require('./lib');

const originalEmit = process.emitWarning;
process.emitWarning = function emitWarning(warning, ...rest) {
  const text = typeof warning === 'string' ? warning : (warning && warning.message) || '';
  if (/SQLite is an experimental feature/.test(text)) return;
  originalEmit.call(process, warning, ...rest);
};
const { DatabaseSync } = require('node:sqlite');

const DB_FILE = process.env.NEARBUY_DB_FILE || path.join(DATA_DIR, 'seller-hub.sqlite');
const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 4000;');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS counters (name TEXT PRIMARY KEY, value INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT, name TEXT NOT NULL, mobile TEXT,
  email_verified_at TEXT, created_at TEXT NOT NULL, last_login_at TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, expires_at TEXT NOT NULL, user_agent TEXT, ip TEXT
);
CREATE TABLE IF NOT EXISTS auth_tokens (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, purpose TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS email_outbox (
  id INTEGER PRIMARY KEY, to_email TEXT NOT NULL, purpose TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL,
  link TEXT, status TEXT NOT NULL, error TEXT, created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sellers (
  id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, owner_user_id INTEGER NOT NULL REFERENCES users(id),
  store_name TEXT NOT NULL, business_name TEXT NOT NULL, business_type TEXT, status TEXT NOT NULL DEFAULT 'not_started',
  status_note TEXT, onboarding TEXT NOT NULL DEFAULT '{}', onboarding_submitted_at TEXT, store_description TEXT,
  store_logo_upload_id INTEGER, contact_email TEXT, contact_phone TEXT, low_stock_default INTEGER NOT NULL DEFAULT 10,
  notification_prefs TEXT NOT NULL DEFAULT '{}', package_settings TEXT NOT NULL DEFAULT '{}', has_demo_data INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS seller_business_profiles (
  seller_id INTEGER PRIMARY KEY REFERENCES sellers(id) ON DELETE CASCADE, legal_name TEXT, business_type TEXT, gstin TEXT,
  pan_enc TEXT, pan_last4 TEXT, address TEXT, city TEXT, state TEXT, pincode TEXT, updated_at TEXT
);
CREATE TABLE IF NOT EXISTS seller_pickup_locations (
  id INTEGER PRIMARY KEY, seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE, name TEXT NOT NULL,
  contact_person TEXT, mobile TEXT, address TEXT, city TEXT, state TEXT, pincode TEXT, is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS seller_bank_accounts (
  id INTEGER PRIMARY KEY, seller_id INTEGER NOT NULL UNIQUE REFERENCES sellers(id) ON DELETE CASCADE, holder_name TEXT NOT NULL,
  bank_name TEXT NOT NULL, account_enc TEXT NOT NULL, account_last4 TEXT NOT NULL, ifsc TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'unverified', updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS seller_team_members (
  id INTEGER PRIMARY KEY, seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, role TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active',
  invited_by INTEGER, created_at TEXT NOT NULL, UNIQUE (seller_id, user_id)
);
CREATE TABLE IF NOT EXISTS warehouses (
  id INTEGER PRIMARY KEY, seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE, code TEXT NOT NULL, name TEXT NOT NULL,
  pickup_location_id INTEGER, city TEXT, pincode TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS uploads (
  id INTEGER PRIMARY KEY, seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE, user_id INTEGER, kind TEXT NOT NULL,
  mime TEXT NOT NULL, size INTEGER NOT NULL, file TEXT NOT NULL, original_name TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY, seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE, code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL, category TEXT, brand TEXT, description TEXT, highlights TEXT NOT NULL DEFAULT '[]', model_number TEXT,
  sku TEXT NOT NULL, specs TEXT NOT NULL DEFAULT '{}', attributes TEXT NOT NULL DEFAULT '{}', mrp REAL, price REAL,
  tax_category TEXT, gst_rate REAL NOT NULL DEFAULT 18, package TEXT NOT NULL DEFAULT '{}', dispatch_days INTEGER NOT NULL DEFAULT 2,
  warehouse_id INTEGER, status TEXT NOT NULL DEFAULT 'draft', qc_notes TEXT NOT NULL DEFAULT '[]', art TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE (seller_id, sku)
);
CREATE TABLE IF NOT EXISTS product_images (
  id INTEGER PRIMARY KEY, seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE, upload_id INTEGER NOT NULL REFERENCES uploads(id),
  is_primary INTEGER NOT NULL DEFAULT 0, position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS product_variants (
  id INTEGER PRIMARY KEY, seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE, sku TEXT NOT NULL, size TEXT, colour TEXT,
  price REAL, UNIQUE (seller_id, sku)
);
CREATE TABLE IF NOT EXISTS inventory (
  id INTEGER PRIMARY KEY, seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE, variant_id INTEGER REFERENCES product_variants(id) ON DELETE CASCADE,
  warehouse_id INTEGER, sku TEXT NOT NULL, on_hand INTEGER NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
  reserved INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0), safety_stock INTEGER NOT NULL DEFAULT 10, updated_at TEXT NOT NULL,
  UNIQUE (seller_id, sku)
);
CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY, seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  inventory_id INTEGER NOT NULL REFERENCES inventory(id) ON DELETE CASCADE, kind TEXT NOT NULL, change INTEGER NOT NULL,
  on_hand_after INTEGER NOT NULL, reserved_after INTEGER NOT NULL, reason TEXT, ref TEXT, actor TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY, seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE, code TEXT NOT NULL UNIQUE,
  placed_at TEXT NOT NULL, status TEXT NOT NULL, customer_ref TEXT, customer_name TEXT, customer_phone TEXT, ship_address TEXT,
  ship_city TEXT, ship_state TEXT, ship_pincode TEXT, payment_method TEXT, payment_status TEXT, subtotal REAL NOT NULL,
  shipping_charge REAL NOT NULL DEFAULT 0, tax_total REAL NOT NULL DEFAULT 0, total REAL NOT NULL, dispatch_by TEXT,
  stock_state TEXT NOT NULL DEFAULT 'none', cancel_reason TEXT, cancelled_by TEXT, cancelled_at TEXT, delivered_at TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY, seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE, product_id INTEGER, inventory_id INTEGER, title TEXT NOT NULL,
  variant_label TEXT, sku TEXT NOT NULL, category TEXT, qty INTEGER NOT NULL, unit_price REAL NOT NULL, gst_rate REAL NOT NULL DEFAULT 18,
  taxable_value REAL NOT NULL, tax_amount REAL NOT NULL, line_total REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS order_events (
  id INTEGER PRIMARY KEY, seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE, status TEXT NOT NULL, title TEXT NOT NULL, note TEXT,
  actor TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS shipments (
  id INTEGER PRIMARY KEY, seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE, code TEXT NOT NULL UNIQUE,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE, carrier TEXT, reference TEXT, status TEXT NOT NULL,
  pickup_location_id INTEGER, weight_g INTEGER, dimensions TEXT, label_generated_at TEXT, dispatched_at TEXT, delivered_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS shipment_events (
  id INTEGER PRIMARY KEY, seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  shipment_id INTEGER NOT NULL REFERENCES shipments(id) ON DELETE CASCADE, status TEXT NOT NULL, title TEXT NOT NULL, note TEXT,
  actor TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS returns (
  id INTEGER PRIMARY KEY, seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE, code TEXT NOT NULL UNIQUE,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE, order_item_id INTEGER, qty INTEGER NOT NULL, reason TEXT NOT NULL,
  description TEXT, status TEXT NOT NULL DEFAULT 'new', refund_status TEXT NOT NULL DEFAULT 'not_initiated', reject_reason TEXT,
  condition_note TEXT, restocked INTEGER NOT NULL DEFAULT 0, requested_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS return_events (
  id INTEGER PRIMARY KEY, seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  return_id INTEGER NOT NULL REFERENCES returns(id) ON DELETE CASCADE, action TEXT NOT NULL, title TEXT NOT NULL, note TEXT,
  actor TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS refunds (
  id INTEGER PRIMARY KEY, seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE, code TEXT NOT NULL UNIQUE,
  return_id INTEGER NOT NULL REFERENCES returns(id) ON DELETE CASCADE, order_id INTEGER NOT NULL, amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL, recorded_at TEXT
);
CREATE TABLE IF NOT EXISTS settlements (
  id INTEGER PRIMARY KEY, seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE, code TEXT NOT NULL UNIQUE,
  period_start TEXT, period_end TEXT, settlement_date TEXT NOT NULL, gross REAL NOT NULL, fees REAL NOT NULL, deductions REAL NOT NULL,
  net REAL NOT NULL, status TEXT NOT NULL, order_refs TEXT, payout_reference TEXT, is_demo INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY, seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE, code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL, order_id INTEGER, return_id INTEGER, order_ref TEXT, amount REAL NOT NULL, description TEXT,
  settlement_id INTEGER REFERENCES settlements(id), is_demo INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS promotions (
  id INTEGER PRIMARY KEY, seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE, code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL, product_ids TEXT NOT NULL DEFAULT '[]', discount_type TEXT NOT NULL, discount_value REAL NOT NULL,
  start_date TEXT NOT NULL, end_date TEXT NOT NULL, budget REAL, state TEXT NOT NULL DEFAULT 'draft', is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS advertising_campaigns (
  id INTEGER PRIMARY KEY, seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE, code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL, objective TEXT NOT NULL, product_ids TEXT NOT NULL DEFAULT '[]', daily_budget REAL NOT NULL, start_date TEXT NOT NULL,
  end_date TEXT, targeting TEXT NOT NULL DEFAULT '{}', bid_strategy TEXT NOT NULL, bid_amount REAL, state TEXT NOT NULL DEFAULT 'draft',
  metrics TEXT NOT NULL DEFAULT '[]', is_demo INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS support_tickets (
  id INTEGER PRIMARY KEY, seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE, code TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL, related_type TEXT, related_ref TEXT, subject TEXT NOT NULL, description TEXT NOT NULL,
  attachment_upload_id INTEGER, assigned_team TEXT NOT NULL, priority TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open',
  created_by TEXT, is_demo INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ticket_messages (
  id INTEGER PRIMARY KEY, seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  ticket_id INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE, author_type TEXT NOT NULL, author_name TEXT,
  body TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY, seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE, type TEXT NOT NULL,
  title TEXT NOT NULL, body TEXT, link TEXT, read_at TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY, seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE, user_id INTEGER, actor TEXT,
  action TEXT NOT NULL, entity TEXT, entity_ref TEXT, detail TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS learning_progress (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, lesson_id TEXT NOT NULL, completed_at TEXT,
  bookmarked INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_products_seller ON products (seller_id, status);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory (seller_id, product_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders (seller_id, status, placed_at);
CREATE INDEX IF NOT EXISTS idx_items_order ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_tx_seller ON transactions (seller_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notif_seller ON notifications (seller_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activity_seller ON activity_logs (seller_id, created_at);
CREATE INDEX IF NOT EXISTS idx_moves_inv ON stock_movements (inventory_id, created_at);
`;
db.exec(SCHEMA);

const statements = new Map();
function stmt(sql) {
  let s = statements.get(sql);
  if (!s) { s = db.prepare(sql); statements.set(sql, s); }
  return s;
}
const clean = (params) => params.map((p) => (p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : p));
const get = (sql, ...params) => stmt(sql).get(...clean(params));
const all = (sql, ...params) => stmt(sql).all(...clean(params));
const run = (sql, ...params) => stmt(sql).run(...clean(params));

let depth = 0;
function tx(fn) {
  if (depth > 0) return fn();
  db.exec('BEGIN IMMEDIATE');
  depth += 1;
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  } finally { depth -= 1; }
}

const jsonify = (v) => (v !== null && typeof v === 'object' ? JSON.stringify(v) : v);
function insert(table, row) {
  const keys = Object.keys(row);
  const info = run(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`, ...keys.map((k) => jsonify(row[k])));
  return Number(info.lastInsertRowid);
}
/** Update a row that belongs to the given seller. Returns the number of rows changed. */
function update(table, sellerId, id, patch) {
  const keys = Object.keys(patch);
  if (!keys.length) return 0;
  return run(`UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ? AND seller_id = ?`, ...keys.map((k) => jsonify(patch[k])), id, sellerId).changes;
}
function nextCode(prefix, start = 1000) {
  run('INSERT INTO counters (name, value) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET value = value + 1', prefix, start + 1);
  return `${prefix}-${get('SELECT value FROM counters WHERE name = ?', prefix).value}`;
}
const parseJson = (text, fallback) => { try { return text ? JSON.parse(text) : fallback; } catch { return fallback; } };

/**
 * Paged, searchable, sortable list. `where` is an array of SQL fragments, all AND-ed; the caller must always
 * include the seller scope.
 */
function paged({ select, from, where = [], params = [], search, sortMap = {}, sort, defaultSort, page, pageSize, group }) {
  const clauses = [...where];
  const args = [...params];
  if (search && search.q) {
    clauses.push(`(${search.cols.map((c) => `${c} LIKE ? ESCAPE '\\'`).join(' OR ')})`);
    const like = `%${String(search.q).slice(0, 80).replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    search.cols.forEach(() => args.push(like));
  }
  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const size = Math.min(Math.max(parseInt(pageSize, 10) || 10, 1), 100);
  const total = get(`SELECT COUNT(*) AS n FROM (SELECT 1 FROM ${from} ${whereSql} ${group ? `GROUP BY ${group}` : ''})`, ...args).n;
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(parseInt(page, 10) || 1, 1), pages);
  let order = defaultSort;
  if (sort) {
    const desc = String(sort).startsWith('-');
    const key = String(sort).replace(/^-/, '');
    if (sortMap[key]) order = `${sortMap[key]} ${desc ? 'DESC' : 'ASC'}`;
  }
  const rows = all(`SELECT ${select} FROM ${from} ${whereSql} ${group ? `GROUP BY ${group}` : ''} ORDER BY ${order} LIMIT ? OFFSET ?`, ...args, size, (current - 1) * size);
  return { rows, total, page: current, pageSize: size, pages };
}

/* ---------- Cross-cutting writers ---------- */
const ALWAYS_NOTIFY = new Set(['account', 'security']);
function notify(sellerId, type, title, body, link) {
  // Sellers can switch individual notification types off in Settings → Notification preferences.
  if (!ALWAYS_NOTIFY.has(type)) {
    const seller = get('SELECT notification_prefs FROM sellers WHERE id = ?', sellerId);
    if (seller && parseJson(seller.notification_prefs, {})[type] === false) return;
  }
  insert('notifications', { seller_id: sellerId, type, title, body: body || null, link: link || null, created_at: nowIso() });
}
function logActivity(ctx, action, entity, entityRef, detail) {
  insert('activity_logs', {
    seller_id: ctx.sellerId, user_id: ctx.user ? ctx.user.id : null, actor: ctx.user ? ctx.user.name : (ctx.actor || 'System'),
    action, entity: entity || null, entity_ref: entityRef || null, detail: detail || null, created_at: nowIso(),
  });
}

module.exports = { db, get, all, run, tx, insert, update, nextCode, parseJson, paged, notify, logActivity, DB_FILE };
