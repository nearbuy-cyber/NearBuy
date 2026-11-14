'use strict';
// End-to-end tests for the Seller Hub server. They boot the real HTTP server on a random port with a throwaway
// data directory and drive it over HTTP, exactly as the browser app does.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'nearbuy-seller-test-'));
process.env.NEARBUY_DATA_DIR = DATA_DIR;
process.env.DEV_MAIL_PREVIEW = '1'; // tests read the verification / invitation links from the API response
process.env.DEMO_AUTO_REVIEW = '0'; // exercise the real review path through the operations API
process.env.OPS_API_KEY = 'test-ops-key-0123456789';
process.env.SEED_DEMO = '1';
delete process.env.SMTP_HOST;
const quiet = console.log; console.log = () => {};
const { start, server } = require('../server/index.js');
console.log = quiet;

let base;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

function client() {
  let cookie = '';
  const call = async (method, url, body, extra = {}) => {
    const headers = { ...(method === 'GET' ? {} : { 'X-NearBuy-Request': '1' }), cookie, ...extra.headers };
    let payload;
    if (Buffer.isBuffer(body)) { payload = body; headers['Content-Type'] = extra.type || 'application/octet-stream'; }
    else if (body !== undefined) { payload = JSON.stringify(body); headers['Content-Type'] = 'application/json'; }
    const res = await fetch(base + url, { method, headers, body: payload, redirect: 'manual' });
    const set = res.headers.getSetCookie();
    if (set.length) cookie = set.map((c) => c.split(';')[0]).filter((c) => !c.endsWith('=')).join('; ');
    const type = res.headers.get('content-type') || '';
    const data = type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer());
    return { status: res.status, data, type, headers: res.headers };
  };
  const api = { get: (u, o) => call('GET', u, undefined, o), post: (u, b = {}, o) => call('POST', u, b, o), put: (u, b, o) => call('PUT', u, b, o), patch: (u, b, o) => call('PATCH', u, b, o), del: (u, o) => call('DELETE', u, undefined, o), call };
  api.login = async (email, password) => { const r = await api.post('/api/auth/login', { email, password }); assert.equal(r.status, 200, `login ${email}: ${JSON.stringify(r.data)}`); return r; };
  return api;
}
const ops = (method, url, body) => client().call(method, url, body, { headers: { 'X-Ops-Key': process.env.OPS_API_KEY, 'X-Ops-Staff': 'Test Reviewer' } });
const tokenOf = (link) => new URL(link).searchParams.get('token');
const ok = (r, status = 200) => { assert.equal(r.status, status, `expected ${status}, got ${r.status}: ${Buffer.isBuffer(r.data) ? r.data.slice(0, 200) : JSON.stringify(r.data)}`); return r.data; };

test.before(async () => { await start(0); base = `http://127.0.0.1:${server.address().port}`; });
test.after(() => { server.close(); fs.rmSync(DATA_DIR, { recursive: true, force: true }); });

const owner = client();
const fresh = client(); // a brand-new seller created during the tests
const state = {};

test('security: sessions, CSRF header, blocked paths and headers', async () => {
  const anon = client();
  assert.equal((await anon.get('/api/auth/me')).status, 401);
  assert.equal((await anon.get('/api/products')).status, 401);
  assert.equal((await anon.post('/api/auth/login', { email: 'owner@nearbuy.demo', password: 'wrong-password' })).status, 401);
  // State-changing requests without the custom header are rejected even with valid credentials.
  const noHeader = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'owner@nearbuy.demo', password: 'Seller123!' }) });
  assert.equal(noHeader.status, 403);
  for (const blocked of ['/server/index.js', '/data/seller-hub.sqlite', '/package.json', '/.gitignore', '/tests/seller-hub.test.cjs', '/seller/app/../../server/lib.js']) {
    const res = await fetch(base + blocked);
    const text = await res.text();
    assert.ok(!/require\(|SQLite format|"scripts"/.test(text), `${blocked} must not leak server files`);
  }
  const page = await fetch(`${base}/seller/orders/ORD-1`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /script-src 'self'/);
  assert.equal(page.headers.get('x-content-type-options'), 'nosniff');
  const login = await owner.login('owner@nearbuy.demo', 'Seller123!');
  assert.match(login.headers.getSetCookie().join(';'), /HttpOnly/i);
  assert.match(login.headers.getSetCookie().join(';'), /SameSite=Lax/i);
  const me = ok(await owner.get('/api/auth/me'));
  assert.equal(me.role, 'owner');
  assert.equal(me.seller.code, 'SLR-5001');
});

test('sign-in works behind an HTTPS proxy and inside an embedded preview', async () => {
  const credentials = JSON.stringify({ email: 'owner@nearbuy.demo', password: 'Seller123!' });
  const send = (headers) => fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-NearBuy-Request': '1', ...headers }, body: credentials });
  // A hosted preview is HTTPS and shown in a frame on another site. A SameSite=Lax cookie is dropped there, so the
  // session cookie must be SameSite=None; Secure; Partitioned or every demo login silently bounces back to the form.
  const forwarded = await send({ 'X-Forwarded-Proto': 'https', Origin: 'https://4173-preview.example.app', 'Sec-Fetch-Site': 'same-origin' });
  assert.equal(forwarded.status, 200);
  const cookie = forwarded.headers.getSetCookie().join(';');
  for (const flag of [/HttpOnly/i, /SameSite=None/i, /Secure/i, /Partitioned/i]) assert.match(cookie, flag);
  // Some proxies rewrite Host and send no X-Forwarded-* headers; the browser's Origin still shows the page is HTTPS.
  const rewritten = await send({ Origin: 'https://4173-preview.example.app', 'Sec-Fetch-Site': 'same-origin' });
  assert.equal(rewritten.status, 200);
  assert.match(rewritten.headers.getSetCookie().join(';'), /SameSite=None; Secure; Partitioned/i);
  // The session set that way is usable.
  const sid = rewritten.headers.getSetCookie()[0].split(';')[0];
  const me = await (await fetch(`${base}/api/auth/me`, { headers: { cookie: sid } })).json();
  assert.equal(me.user.email, 'owner@nearbuy.demo');
  // Loosening SameSite must not loosen CSRF protection: requests from another site are still refused.
  assert.equal((await send({ 'X-Forwarded-Proto': 'https', Origin: 'https://evil.example', 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  assert.equal((await send({ 'X-Forwarded-Proto': 'https', Origin: 'https://evil.example' })).status, 403);
  // Every demo account signs in.
  for (const [email, password, role] of [['owner@nearbuy.demo', 'Seller123!', 'owner'], ['catalogue@nearbuy.demo', 'Team123!', 'catalogue_manager'], ['orders@nearbuy.demo', 'Team123!', 'order_manager'], ['stock@nearbuy.demo', 'Team123!', 'inventory_manager'], ['finance@nearbuy.demo', 'Team123!', 'finance_viewer']]) {
    const c = client();
    assert.equal((await c.login(email, password)).status, 200, `${email} can sign in`);
    assert.equal(ok(await c.get('/api/auth/me')).role, role);
    assert.equal((await c.get('/api/dashboard')).status, 200, `${email} can load the dashboard`);
  }
});

test('registration → email verification → onboarding → marketplace review', async () => {
  const weak = await fresh.post('/api/auth/register', { name: 'Asha Verma', email: 'asha@example.test', mobile: '9876501234', password: 'short', confirm_password: 'short', business_name: 'Verma Crafts', business_type: 'Sole proprietorship', accept_terms: true });
  assert.equal(weak.status, 400);
  assert.ok(weak.data.fields.password);
  const cfg = ok(await fresh.get('/api/public-config'));
  const reg = ok(await fresh.post('/api/auth/register', { name: 'Asha Verma', email: 'asha@example.test', mobile: '9876501234', password: 'Crafts#2026', confirm_password: 'Crafts#2026', business_name: 'Verma Crafts', business_type: cfg.business_types[0], accept_terms: true }), 201);
  assert.equal(reg.verification.delivered, false, 'no SMTP in tests: the email must not be reported as delivered');
  assert.ok(reg.verification.dev_link, 'dev preview link is returned only because DEV_MAIL_PREVIEW=1');
  const dupe = await client().post('/api/auth/register', { name: 'Asha Verma', email: 'asha@example.test', mobile: '9876501234', password: 'Crafts#2026', confirm_password: 'Crafts#2026', business_name: 'Verma Crafts', business_type: cfg.business_types[0], accept_terms: true });
  assert.equal(dupe.status, 400);

  // Unverified accounts cannot use the hub.
  const before = await fresh.get('/api/products');
  assert.equal(before.status, 403);
  assert.equal(before.data.code, 'email_unverified');
  assert.equal((await fresh.post('/api/auth/verify-email', { token: 'not-a-real-token' })).status, 400);
  ok(await fresh.post('/api/auth/verify-email', { token: tokenOf(reg.verification.dev_link) }));
  assert.equal((await fresh.post('/api/auth/verify-email', { token: tokenOf(reg.verification.dev_link) })).status, 400, 'verification links are single-use');

  let ob = ok(await fresh.get('/api/onboarding'));
  assert.equal(ob.status, 'not_started');
  assert.equal((await fresh.post('/api/onboarding/submit', { confirm: true })).status, 409, 'cannot submit before the steps are complete');

  const badBiz = await fresh.put('/api/settings/business', { legal_name: 'Verma Crafts', business_type: cfg.business_types[0], gstin: '07ABCDE1234F1Z5', pan: 'ZZZZZ9999Z', address: '14 Craft Lane, Lajpat Nagar', city: 'New Delhi', state: 'Delhi', pincode: '110024' });
  assert.equal(badBiz.status, 400);
  assert.match(badBiz.data.fields.pan, /does not match/);
  ok(await fresh.put('/api/settings/business', { legal_name: 'Verma Crafts', business_type: cfg.business_types[0], gstin: '07ABCDE1234F1Z5', pan: 'ABCDE1234F', address: '14 Craft Lane, Lajpat Nagar', city: 'New Delhi', state: 'Delhi', pincode: '110024' }));
  ok(await fresh.post('/api/settings/pickup-locations', { name: 'Home studio', contact_person: 'Asha Verma', mobile: '9876501234', address: '14 Craft Lane, Lajpat Nagar', pincode: '110024', city: 'New Delhi', state: 'Delhi', is_default: true }), 201);
  const mismatch = await fresh.put('/api/settings/bank', { holder_name: 'Verma Crafts', bank_name: 'Test Bank', account_number: '123456789012', confirm_account_number: '123456789013', ifsc: 'TEST0123456' });
  assert.equal(mismatch.status, 400);
  ok(await fresh.put('/api/settings/bank', { holder_name: 'Verma Crafts', bank_name: 'Test Bank', account_number: '123456789012', confirm_account_number: '123456789012', ifsc: 'TEST0123456' }));
  ok(await fresh.put('/api/settings/store', { store_name: 'Verma Crafts', store_description: 'Handmade home decor and gifts from Delhi artisans.', contact_email: 'asha@example.test', contact_phone: '9876501234' }));

  // Sensitive values never come back in full.
  const settings = ok(await fresh.get('/api/settings'));
  const dump = JSON.stringify(settings);
  assert.ok(!dump.includes('123456789012') && !dump.includes('ABCDE1234F"'), 'account number and PAN must be masked');
  assert.match(settings.bank.account_masked, /9012$/);
  const db = fs.readFileSync(path.join(DATA_DIR, 'seller-hub.sqlite'));
  assert.ok(!db.includes(Buffer.from('123456789012')), 'bank account number must be encrypted at rest');

  // First product (draft is enough for onboarding).
  const up = ok(await fresh.call('POST', '/api/uploads?kind=product_image&name=runner.png', PNG, { type: 'image/png' }), 201);
  const fake = await fresh.call('POST', '/api/uploads?kind=product_image&name=fake.png', Buffer.from('<script>alert(1)</script>'), { type: 'image/png' });
  assert.equal(fake.status, 400, 'uploads are checked by content, not by name');
  state.product = {
    action: 'submit', title: 'Handwoven Cotton Table Runner', sku: 'VC-RUN-01', category: 'Home and Kitchen', brand: 'Verma Crafts',
    description: 'Handwoven cotton table runner with a natural finish. Suitable for six-seater dining tables.', highlights: ['Pure cotton', 'Machine washable'],
    mrp: 899, price: 649, gst_rate: 5, quantity: 12, safety_stock: 3, dispatch_days: 2, image_ids: [up.id], primary_image_id: up.id,
    specs: { manufacturer: 'Verma Crafts', country_of_origin: 'India', hsn_code: '6302', material: 'Cotton' }, package: { weight_g: 320, length_cm: 30, width_cm: 20, height_cm: 4 }, attributes: {},
  };
  const meta = ok(await fresh.get('/api/meta/catalog'));
  for (const def of meta.category_attributes['Home and Kitchen']) if (def.required) state.product.attributes[def.key] = def.options ? def.options[0] : def.type === 'number' ? '1' : '1 table runner';
  const overpriced = await fresh.post('/api/products', { ...state.product, price: 999 });
  assert.equal(overpriced.status, 400);
  assert.match(overpriced.data.fields.price, /MRP/);
  const created = ok(await fresh.post('/api/products', { ...state.product, action: 'draft' }), 201);
  state.freshProduct = created.code || created.product.code;

  ob = ok(await fresh.get('/api/onboarding'));
  assert.equal(ob.completed, ob.total - 1, `only the review step should remain: ${JSON.stringify(ob.steps)}`);
  const submitted = ok(await fresh.post('/api/onboarding/submit', { confirm: true }));
  assert.equal(submitted.status, 'under_review', 'with automatic review off the account waits for staff');

  // The operations API is the only way to approve, and it needs its key.
  assert.equal((await client().post('/api/ops/sellers/SLR-5002/review', { decision: 'approve' })).status, 401);
  const sellers = ok(await ops('GET', '/api/ops/sellers?status=under_review'));
  const mine = sellers.sellers.find((s) => s.owner_email === 'asha@example.test');
  assert.ok(mine);
  state.freshSeller = mine.code;
  ok(await ops('POST', `/api/ops/sellers/${mine.code}/review`, { decision: 'approve' }));
  assert.equal(ok(await fresh.get('/api/auth/me')).seller.status, 'approved');
});

test('listing review, tenant isolation and listing rules', async () => {
  const code = state.freshProduct;
  const submit = ok(await fresh.put(`/api/products/${code}`, state.product));
  let product = ok(await fresh.get(`/api/products/${code}`)).product;
  assert.equal(product.status, 'pending_approval', JSON.stringify(submit).slice(0, 200));
  const pending = ok(await ops('GET', '/api/ops/listings'));
  assert.ok(pending.listings.some((l) => l.code === code));
  assert.equal((await ops('POST', `/api/ops/listings/${code}/review`, { decision: 'reject' })).status, 400, 'a rejection needs a reason');
  ok(await ops('POST', `/api/ops/listings/${code}/review`, { decision: 'approve' }));
  product = ok(await fresh.get(`/api/products/${code}`)).product;
  assert.equal(product.status, 'active');

  // Another seller's records are invisible.
  assert.equal((await owner.get(`/api/products/${code}`)).status, 404);
  assert.equal((await fresh.get('/api/products/PRD-10001')).status, 404);
  assert.equal((await fresh.get('/api/orders/ORD-240001')).status, 404);
  assert.equal((await fresh.get('/api/payments/settlements/STL-5001')).status, 404);
  assert.equal(ok(await fresh.get('/api/orders')).total, 0);
  const dupSku = await fresh.post('/api/products', { ...state.product, action: 'draft' });
  assert.equal(dupSku.status, 400);
  assert.ok(dupSku.data.fields.sku);
});

test('order lifecycle: stock, enforced transitions, documents, ledger and settlement', async () => {
  const inv = () => fresh.get('/api/inventory').then((r) => ok(r).rows.find((row) => row.sku === 'VC-RUN-01'));
  const start0 = await inv();
  assert.equal(start0.available, 12);
  const sim = ok(await fresh.post('/api/orders/simulate'), 201);
  const code = sim.code;
  let order = ok(await fresh.get(`/api/orders/${code}`)).order;
  const qty = order.items[0].qty;
  assert.equal(order.status, 'new');
  let row = await inv();
  assert.equal(row.available, 12 - qty);
  assert.equal(row.reserved, qty);

  const act = (action, extra) => fresh.post(`/api/orders/${code}/actions`, { action, ...extra });
  // Steps cannot be skipped.
  for (const early of ['pack', 'dispatch', 'deliver', 'ready']) assert.equal((await act(early)).status, 409, `${early} must be rejected on a new order`);
  assert.equal((await fresh.get(`/api/orders/${code}/invoice.pdf`)).status, 409, 'no invoice before the order is accepted');
  ok(await act('accept'));
  const invoice = await fresh.get(`/api/orders/${code}/invoice.pdf`);
  assert.equal(invoice.status, 200);
  assert.equal(invoice.data.subarray(0, 5).toString(), '%PDF-');
  ok(await act('process'));
  ok(await act('pack'));
  assert.equal((await act('ready')).status, 409, 'a shipment record is needed first');
  assert.equal((await fresh.get(`/api/orders/${code}/label.pdf`)).status, 409);
  ok(await act('shipment'));
  const label = await fresh.get(`/api/orders/${code}/label.pdf`);
  assert.equal(label.status, 200);
  assert.equal(label.data.subarray(0, 5).toString(), '%PDF-');
  ok(await act('ready'));
  ok(await act('dispatch'));
  row = await inv();
  assert.equal(row.on_hand ?? row.stock, 12 - qty, 'stock is deducted when the order ships');
  assert.equal(row.reserved, 0);
  assert.equal((await act('cancel', { reason: 'Out of stock' })).status, 409, 'a shipped order cannot be cancelled');
  assert.equal(ok(await fresh.get('/api/payments/transactions')).total, 0, 'nothing is posted to the ledger before delivery');
  ok(await act('deliver'));
  order = ok(await fresh.get(`/api/orders/${code}`)).order;
  assert.equal(order.status, 'delivered');
  assert.equal(order.actions.length, 0);

  const tx = ok(await fresh.get('/api/payments/transactions'));
  const sum = tx.rows.reduce((a, t) => a + t.amount, 0);
  assert.ok(tx.rows.some((t) => t.type === 'sale' && t.amount === order.total));
  assert.ok(Math.abs(sum - order.fees_estimate.net) < 0.011, 'ledger entries add up to the net shown on the order');

  const run = ok(await fresh.post('/api/payments/settlements/run'), 201);
  const stl = ok(await fresh.get(`/api/payments/settlements/${run.code}`));
  assert.equal(stl.settlement.status, 'awaiting_payout', 'a settlement is never reported as paid by the seller app');
  assert.ok(Math.abs(stl.settlement.net - sum) < 0.011);
  assert.ok(Math.abs(stl.computed_net - stl.settlement.net) < 0.011);
  assert.equal((await fresh.post('/api/payments/settlements/run')).status, 409, 'nothing left to settle');
  const pdf = await fresh.get(`/api/payments/settlements/${run.code}/report.pdf`);
  assert.equal(pdf.data.subarray(0, 5).toString(), '%PDF-');
  const csv = await fresh.get(`/api/payments/settlements/${run.code}/report.csv`);
  assert.match(csv.type, /text\/csv/);
  assert.match(csv.data.toString(), new RegExp(code));
  // Only marketplace finance can mark it paid, and only with a bank reference.
  assert.equal((await ops('POST', `/api/ops/settlements/${run.code}/paid`, {})).status, 400);
  ok(await ops('POST', `/api/ops/settlements/${run.code}/paid`, { payout_reference: 'UTR20261114000123' }));
  assert.equal(ok(await fresh.get(`/api/payments/settlements/${run.code}`)).settlement.status, 'paid');
  state.deliveredOrder = code; state.qty = qty;

  // Cancelling releases the reservation.
  const second = ok(await fresh.post('/api/orders/simulate'), 201).code;
  const reservedQty = ok(await fresh.get(`/api/orders/${second}`)).order.items[0].qty;
  const beforeCancel = await inv();
  assert.equal((await fresh.post(`/api/orders/${second}/actions`, { action: 'cancel' })).status, 400, 'cancelling needs a reason');
  ok(await fresh.post(`/api/orders/${second}/actions`, { action: 'cancel', reason: 'Out of stock', note: 'Counted wrong' }));
  const afterCancel = await inv();
  assert.equal(afterCancel.available, beforeCancel.available + reservedQty);
  assert.equal(afterCancel.reserved, 0);
});

test('returns: review, restock and refund deduction', async () => {
  const sim = ok(await fresh.post('/api/returns/simulate'), 201);
  const code = sim.code;
  const act = (action, extra) => fresh.post(`/api/returns/${code}/actions`, { action, ...extra });
  assert.equal((await act('refund')).status, 409, 'a refund cannot be recorded before the product is received');
  assert.equal((await act('reject', { reason: 'no' })).status, 400, 'a rejection needs a real reason');
  ok(await act('approve'));
  assert.equal((await act('receive', {})).status, 400);
  const stockBefore = ok(await fresh.get('/api/inventory')).rows.find((r) => r.sku === 'VC-RUN-01').available;
  ok(await act('receive', { condition: 'Sellable — restock' }));
  const stockAfter = ok(await fresh.get('/api/inventory')).rows.find((r) => r.sku === 'VC-RUN-01').available;
  assert.equal(stockAfter, stockBefore + 1, 'sellable returns go back to available stock');
  ok(await act('refund'));
  const ret = ok(await fresh.get(`/api/returns/${code}`)).return;
  assert.equal(ret.status, 'completed');
  assert.equal(ret.refund_status, 'recorded');
  const refunds = ok(await fresh.get('/api/payments/transactions?type=refund'));
  assert.equal(refunds.total, 1);
  assert.equal(refunds.rows[0].amount, -ret.refund_amount);
  const history = ok(await fresh.get('/api/inventory/history'));
  assert.ok(history.rows.length >= 4, 'every stock movement is logged');
});

test('inventory edits are validated and logged', async () => {
  const row = ok(await fresh.get('/api/inventory')).rows.find((r) => r.sku === 'VC-RUN-01');
  assert.equal((await fresh.patch(`/api/inventory/${row.id}`, { available: -4 })).status, 400);
  const r = await fresh.patch(`/api/inventory/${row.id}`, { available: 40, reason: 'Stock count' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(ok(await fresh.get('/api/inventory')).rows.find((x) => x.sku === 'VC-RUN-01').available, 40);
});

test('promotions and campaigns validate on the server', async () => {
  const { products } = ok(await fresh.get('/api/promotions/products'));
  const ids = products.map((p) => p.id);
  const today = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
  const later = new Date(Date.now() + 9 * 86400000).toISOString().slice(0, 10);
  const tooDeep = await fresh.post('/api/promotions', { name: 'Everything must go', product_ids: ids, discount_type: 'percentage', discount_value: 95, start_date: today, end_date: later, publish: true });
  assert.equal(tooDeep.status, 400);
  const backwards = await fresh.post('/api/promotions', { name: 'Backwards dates', product_ids: ids, discount_type: 'percentage', discount_value: 10, start_date: later, end_date: today, publish: true });
  assert.equal(backwards.status, 400);
  const promo = ok(await fresh.post('/api/promotions', { name: 'Festive runner offer', product_ids: ids, discount_type: 'percentage', discount_value: 10, start_date: today, end_date: later, publish: true }), 201);
  const detail = ok(await fresh.get(`/api/promotions/${promo.code}`)).promotion;
  assert.equal(detail.status, 'active');
  assert.equal(detail.lines[0].promo_price, 584.1);
  // A new order uses the promotion price.
  const order = ok(await fresh.get(`/api/orders/${ok(await fresh.post('/api/orders/simulate'), 201).code}`)).order;
  assert.equal(order.items[0].unit_price, 584.1);
  ok(await fresh.post(`/api/promotions/${promo.code}/status`, { action: 'pause' }));
  assert.equal((await fresh.post(`/api/promotions/${promo.code}/status`, { action: 'pause' })).status, 409);

  const lowBudget = await fresh.post('/api/ads/campaigns', { name: 'Tiny budget', objective: 'Increase sales', product_ids: ids, daily_budget: 20, start_date: today, targeting: { type: 'automatic', placements: ['Search results'] }, bid_strategy: 'automatic' });
  assert.equal(lowBudget.status, 400);
  const camp = ok(await fresh.post('/api/ads/campaigns', { name: 'Runner launch', objective: 'Increase sales', product_ids: ids, daily_budget: 300, start_date: today, targeting: { type: 'automatic', placements: ['Search results'] }, bid_strategy: 'automatic' }), 201);
  ok(await fresh.post(`/api/ads/campaigns/${camp.code}/status`, { action: 'launch' }));
  const c = ok(await fresh.get(`/api/ads/campaigns/${camp.code}`)).campaign;
  assert.equal(c.status, 'active');
  assert.equal(c.metrics.impressions, 0, 'no ad network is connected, so a real campaign records no delivery');
  assert.equal(c.metrics.spend, 0);
});

test('support tickets: routing, replies through the operations API, close and reopen', async () => {
  const short = await fresh.post('/api/support/tickets', { category: 'payment', subject: 'Help', description: 'too short' });
  assert.equal(short.status, 400);
  const wrongRef = await fresh.post('/api/support/tickets', { category: 'order', related_type: 'order', related_ref: 'ORD-240001', subject: 'Order belongs to someone else', description: 'This order is not in my account and must not be accepted.' });
  assert.equal(wrongRef.status, 400);
  const t = ok(await fresh.post('/api/support/tickets', { category: 'payment', related_type: 'order', related_ref: state.deliveredOrder, subject: 'Question about my first settlement', description: 'Please confirm when the payout for my first settlement will reach my bank account.' }), 201);
  let d = ok(await fresh.get(`/api/support/tickets/${t.code}`));
  assert.equal(d.ticket.assigned_team, 'Seller Finance');
  assert.equal(d.ticket.status, 'open');
  assert.equal((await owner.get(`/api/support/tickets/${t.code}`)).status, 404);
  ok(await ops('POST', `/api/ops/tickets/${t.code}/reply`, { message: 'Thanks — could you share the settlement ID?', status: 'waiting_for_seller' }));
  d = ok(await fresh.get(`/api/support/tickets/${t.code}`));
  assert.equal(d.ticket.status, 'waiting_for_seller');
  assert.ok(d.messages.some((m) => m.author_type === 'support'));
  ok(await fresh.post(`/api/support/tickets/${t.code}/replies`, { body: 'It is the settlement generated today.' }));
  assert.equal(ok(await fresh.get(`/api/support/tickets/${t.code}`)).ticket.status, 'in_progress');
  ok(await fresh.post(`/api/support/tickets/${t.code}/status`, { action: 'close' }));
  assert.equal((await fresh.post(`/api/support/tickets/${t.code}/replies`, { body: 'One more thing' })).status, 409);
  ok(await fresh.post(`/api/support/tickets/${t.code}/status`, { action: 'reopen' }));
});

test('team roles are enforced on the server', async () => {
  const expectations = {
    'catalogue@nearbuy.demo': { allow: ['/api/products', '/api/promotions', '/api/inventory'], deny: ['/api/orders', '/api/payments/summary', '/api/team', '/api/activity'] },
    'orders@nearbuy.demo': { allow: ['/api/orders', '/api/returns', '/api/shipments', '/api/products'], deny: ['/api/payments/summary', '/api/promotions', '/api/team'] },
    'stock@nearbuy.demo': { allow: ['/api/inventory', '/api/orders', '/api/products'], deny: ['/api/payments/summary', '/api/returns', '/api/team'] },
    'finance@nearbuy.demo': { allow: ['/api/payments/summary', '/api/payments/settlements', '/api/orders', '/api/analytics/sales'], deny: ['/api/products', '/api/inventory', '/api/team'] },
  };
  for (const [email, rule] of Object.entries(expectations)) {
    const c = client();
    await c.login(email, 'Team123!');
    for (const url of rule.allow) assert.equal((await c.get(url)).status, 200, `${email} should read ${url}`);
    for (const url of rule.deny) assert.equal((await c.get(url)).status, 403, `${email} must not read ${url}`);
  }
  const finance = client(); await finance.login('finance@nearbuy.demo', 'Team123!');
  assert.equal((await finance.post('/api/orders/ORD-240042/actions', { action: 'accept' })).status, 403, 'read-only roles cannot change orders');
  assert.equal((await finance.post('/api/payments/settlements/run')).status, 403);
  assert.equal((await finance.put('/api/settings/bank', { holder_name: 'X Y', bank_name: 'Bank', account_number: '111122223333', confirm_account_number: '111122223333', ifsc: 'TEST0123456' })).status, 403);
  const stock = client(); await stock.login('stock@nearbuy.demo', 'Team123!');
  assert.equal((await stock.post('/api/orders/simulate')).status, 403);
  const settings = ok(await stock.get('/api/settings'));
  assert.equal(settings.bank, undefined, 'bank details are hidden from roles without payment access');
});

test('team invitations, password reset and session control', async () => {
  const invite = ok(await owner.post('/api/team', { name: 'Kabir Mehta', email: 'kabir@example.test', role: 'order_manager' }), 201);
  assert.equal(invite.invite.delivered, false);
  assert.equal((await owner.post('/api/team', { name: 'Someone', email: 'x@example.test', role: 'owner' })).status, 400, 'ownership cannot be handed out by invitation');
  const kabir = client();
  assert.equal((await kabir.post('/api/auth/login', { email: 'kabir@example.test', password: 'Anything#1' })).status, 401, 'invited users cannot sign in before setting a password');
  const token = tokenOf(invite.invite.dev_link);
  assert.equal(ok(await kabir.get(`/api/auth/token-info?token=${token}`)).purpose, 'team_invite');
  ok(await kabir.post('/api/auth/reset-password', { token, password: 'Kabir#2026', confirm_password: 'Kabir#2026' }));
  await kabir.login('kabir@example.test', 'Kabir#2026');
  assert.equal(ok(await kabir.get('/api/auth/me')).role, 'order_manager');
  const member = ok(await owner.get('/api/team')).members.find((m) => m.email === 'kabir@example.test');
  ok(await owner.del(`/api/team/${member.id}`));
  assert.equal((await kabir.get('/api/auth/me')).status, 401, 'removing a team member signs them out everywhere');

  // Forgot password never reveals whether an account exists.
  const unknown = ok(await client().post('/api/auth/forgot-password', { email: 'nobody@example.test' }));
  const known = ok(await client().post('/api/auth/forgot-password', { email: 'asha@example.test' }));
  assert.equal(unknown.message, known.message);
  assert.equal(unknown.dev_link, undefined);
  const reset = tokenOf(known.dev_link);
  ok(await client().post('/api/auth/reset-password', { token: reset, password: 'Crafts#2027', confirm_password: 'Crafts#2027' }));
  assert.equal((await fresh.get('/api/auth/me')).status, 401, 'a password reset ends existing sessions');
  assert.equal((await client().post('/api/auth/reset-password', { token: reset, password: 'Crafts#2028', confirm_password: 'Crafts#2028' })).status, 400, 'reset links are single-use');
  await fresh.login('asha@example.test', 'Crafts#2027');
  ok(await fresh.post('/api/auth/logout'));
  assert.equal((await fresh.get('/api/auth/me')).status, 401);
});

test('every seller page and export answers for the demo store', async () => {
  const reports = ['sales', 'revenue', 'products', 'categories', 'orders', 'returns', 'inventory', 'customers', 'advertising'];
  const pages = ['overview', 'opportunities', 'recommendations', 'trending', 'pricing', 'selection', 'sales-growth'];
  const urls = ['/api/dashboard', '/api/notifications', '/api/products?tab=active&q=bottle&sort=-price', '/api/inventory?status=low', '/api/inventory/history', '/api/warehouses', '/api/orders?tab=delivered&sort=-total',
    '/api/returns?tab=refunds', '/api/shipping/overview', '/api/shipments?tab=transit', '/api/payments/summary?range=90d', '/api/payments/transactions?kind=deductions', '/api/payments/settlements', '/api/payments/bank',
    '/api/promotions', '/api/ads/overview', '/api/ads/campaigns', '/api/ads/product-ads', '/api/support/tickets', '/api/settings', '/api/team', '/api/roles', '/api/activity', '/api/learning/progress', '/api/auth/sessions',
    ...reports.map((r) => `/api/analytics/${r}?range=30d`), ...pages.map((p) => `/api/growth/${p}`)];
  for (const url of urls) assert.equal((await owner.get(url)).status, 200, url);
  for (const url of ['/api/products/export.csv', '/api/inventory/export.csv', '/api/orders/export.csv', '/api/payments/statement.csv', '/api/payments/settlements.csv', '/api/ads/report.csv', '/api/analytics/sales/export.csv']) {
    const r = await owner.get(url);
    assert.equal(r.status, 200, url);
    assert.match(r.type, /text\/csv/, url);
    assert.ok(r.data.toString().split('\n').length > 2, `${url} has rows`);
  }
  assert.equal((await owner.get('/api/analytics/sales?range=custom&from=2026-11-10&to=2026-11-01')).status, 400, 'a reversed date range is rejected');
  const dash = ok(await owner.get('/api/dashboard'));
  assert.equal(dash.has_demo, true, 'demo figures are flagged');
  const adv = ok(await owner.get('/api/ads/overview'));
  assert.ok(adv.total.roas > 0.5 && adv.total.roas < 12, `sample ad metrics should be plausible (ROAS ${adv.total.roas})`);
});
