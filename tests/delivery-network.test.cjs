'use strict';
// End-to-end tests for the delivery network. They boot the real server with a throwaway data directory and drive the
// partner app, Seller Hub, control tower, fleet portal and customer tracking APIs over HTTP against one database.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'nearbuy-delivery-test-'));
process.env.NEARBUY_DATA_DIR = DATA_DIR;
process.env.DEV_MAIL_PREVIEW = '1';
process.env.SEED_DEMO = '1';
process.env.DELIVERY_BACKGROUND = '0'; // the dispatch tick is driven by the tests
delete process.env.SMTP_HOST;
const quiet = console.log; console.log = () => {};
const { start, server } = require('../server/index.js');
const delivery = require('../server/delivery');
console.log = quiet;

let base;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
function client() {
  let cookie = '';
  const call = async (method, url, body, extra = {}) => {
    const headers = { ...(method === 'GET' ? {} : { 'X-NearBuy-Request': '1' }), cookie, ...extra.headers };
    let payload;
    if (Buffer.isBuffer(body)) { payload = body; headers['Content-Type'] = 'application/octet-stream'; } else if (body !== undefined) { payload = JSON.stringify(body); headers['Content-Type'] = 'application/json'; }
    const res = await fetch(base + url, { method, headers, body: payload, redirect: 'manual' });
    const set = res.headers.getSetCookie();
    if (set.length) cookie = set.map((c) => c.split(';')[0]).filter((c) => !c.endsWith('=')).join('; ');
    const type = res.headers.get('content-type') || '';
    return { status: res.status, data: type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer()), type, headers: res.headers };
  };
  return { get: (u) => call('GET', u), post: (u, b = {}) => call('POST', u, b), put: (u, b) => call('PUT', u, b), patch: (u, b) => call('PATCH', u, b), del: (u) => call('DELETE', u) };
}
const ok = (r, status = 200) => { assert.equal(r.status, status, `expected ${status}, got ${r.status}: ${Buffer.isBuffer(r.data) ? r.data.slice(0, 200) : JSON.stringify(r.data)}`); return r.data; };

test.before(async () => { await start(0); base = `http://127.0.0.1:${server.address().port}`; });
test.after(() => { server.close(); fs.rmSync(DATA_DIR, { recursive: true, force: true }); });

const partner = client(); const admin = client(); const seller = client(); const fleet = client(); const rohan = client(); const anon = client();
const s = {};

test('a partner registers and completes the onboarding steps', async () => {
  const weak = await partner.post('/api/partners/applications', { name: 'Asha Verma', mobile: '9876501234', email: 'asha@example.com', password: 'short', accept_terms: true });
  assert.equal(weak.status, 400);
  const made = ok(await partner.post('/api/partners/applications', { name: 'Asha Verma', mobile: '9876501234', email: 'asha@example.com', password: 'Deliver#2026x', accept_terms: true }), 201);
  s.partnerCode = made.code;
  assert.equal(ok(await partner.get('/api/partners/me')).partner.status, 'draft');
  assert.equal((await client().post('/api/partners/applications', { name: 'Copy', mobile: '9876501234', email: 'other@example.com', password: 'Deliver#2026x', accept_terms: true })).status, 400);
  // Submitting an incomplete application is refused and names the missing steps.
  assert.equal((await partner.post('/api/partners/applications/submit')).status, 400);
  for (const channel of ['mobile', 'email']) {
    const otp = ok(await partner.post(`/api/partners/verify/${channel}/request`));
    assert.match(otp.test_code, /^\d{6}$/);
    assert.equal((await partner.post(`/api/partners/verify/${channel}/confirm`, { code: '000000' })).status, 400);
    ok(await partner.post(`/api/partners/verify/${channel}/confirm`, { code: otp.test_code }));
  }
  const zones = ok(await partner.get('/api/partners/zones')).zones;
  s.zone = zones.find((z) => z.name === 'South Delhi');
  ok(await partner.patch('/api/partners/profile', { city: 'New Delhi', home_zone_id: s.zone.id, language: 'Hindi', emergency_name: 'Ravi Verma', emergency_phone: '9876509999' }));
  assert.equal((await partner.put('/api/partners/vehicle', { type: 'two_wheeler' })).status, 400); // registration needed
  ok(await partner.put('/api/partners/vehicle', { type: 'bicycle' }));
  assert.equal((await partner.post('/api/partners/documents?kind=identity&name=id.txt', Buffer.from('not an image'))).status, 400);
  ok(await partner.post('/api/partners/documents?kind=photo&name=me.png', PNG), 201);
  ok(await partner.post('/api/partners/documents?kind=identity&name=id.png', PNG), 201);
  assert.equal((await partner.put('/api/partners/payout', { holder: 'Asha Verma', bank: 'State Bank', account: '12', ifsc: 'SBIN0001234' })).status, 400);
  const me = ok(await partner.put('/api/partners/payout', { holder: 'Asha Verma', bank: 'State Bank', account: '123456789012', ifsc: 'SBIN0001234' }));
  assert.equal(me.partner.payout.account_ending, '9012');
  assert.ok(!JSON.stringify(me).includes('123456789012'), 'full account number is never returned');
  const config = ok(await partner.get('/api/partners/config'));
  for (const m of config.training) ok(await partner.post('/api/partners/training', { module: m.key }));
  const done = ok(await partner.post('/api/partners/applications/submit'));
  assert.equal(done.partner.status, 'submitted');
  assert.ok(done.checklist.every((c) => c.done));
});

test('an unapproved partner cannot go online or see delivery work', async () => {
  const r = await partner.patch('/api/partners/availability', { online: true });
  assert.equal(r.status, 409);
  assert.equal((await partner.get('/api/delivery/offers')).status, 403);
  assert.equal((await partner.get('/api/partners/earnings')).status, 403);
});

test('portals are isolated from each other', async () => {
  for (const url of ['/api/admin/dashboard', '/api/admin/partners', '/api/fleet/roster', '/api/seller/deliveries']) {
    assert.equal((await anon.get(url)).status, 401, url);
    assert.ok([401, 403].includes((await partner.get(url)).status), `partner session must not open ${url}`);
  }
  assert.equal((await anon.post('/api/tower/login', { email: 'tower@nearbuy.demo', password: 'nope-nope-1' })).status, 401);
  // A partner password does not open the control tower.
  assert.equal((await anon.post('/api/tower/login', { email: 'asha@example.com', password: 'Deliver#2026x' })).status, 401);
  assert.equal((await anon.get('/api/realtime?portal=admin')).status, 401);
});

test('the control tower verifies documents and approves the partner', async () => {
  ok(await admin.post('/api/tower/login', { email: 'tower@nearbuy.demo', password: 'Tower123!' }));
  const list = ok(await admin.get('/api/admin/partners?tab=submitted'));
  assert.ok(list.rows.some((p) => p.code === s.partnerCode));
  const detail = ok(await admin.get(`/api/admin/partners/${s.partnerCode}`)).partner;
  // Approval is refused until the documents have been checked.
  assert.equal((await admin.patch(`/api/admin/partners/${s.partnerCode}/approval`, { decision: 'approve' })).status, 409);
  for (const doc of detail.documents) {
    const link = ok(await admin.post(`/api/admin/partners/${s.partnerCode}/documents/${doc.id}/link`));
    const file = await anon.get(link.url);
    assert.equal(file.status, 200);
    assert.equal((await anon.get(link.url.replace(/sig=[^&]+/, 'sig=forged'))).status, 403);
    ok(await admin.post(`/api/admin/partners/${s.partnerCode}/documents/${doc.id}/review`, { decision: 'verified' }));
  }
  ok(await admin.post(`/api/admin/partners/${s.partnerCode}/vehicle-review`, { decision: 'verified' }));
  ok(await admin.post(`/api/admin/partners/${s.partnerCode}/payout-review`, { decision: 'verified' }));
  ok(await admin.patch(`/api/admin/partners/${s.partnerCode}/approval`, { decision: 'approve', note: 'Documents checked.' }));
  const status = ok(await partner.get('/api/partners/verification-status'));
  assert.equal(status.status, 'approved');
  assert.ok(status.history.some((h) => h.status === 'approved'));
  const audit = ok(await admin.get('/api/admin/audit'));
  assert.ok(JSON.stringify(audit).includes(s.partnerCode));
});

test('a seller order becomes a delivery, and the seller marks it ready', async () => {
  ok(await seller.post('/api/auth/login', { email: 'owner@nearbuy.demo', password: 'Seller123!' }));
  const body = { category: 'grocery', payment: 'cod', customer_name: 'Kavya Suri', customer_phone: '9810455512', address: 'C-14 Green Park Extension', pincode: '110016' };
  const quote = ok(await seller.post('/api/seller/deliveries/test-orders/quote', body));
  assert.ok(quote.fee.total > 0, 'the delivery fee is quoted before the order is placed');
  assert.equal((await seller.post('/api/seller/deliveries/test-orders/quote', { ...body, pincode: '560001' })).status, 409);
  const made = ok(await seller.post('/api/seller/deliveries/test-orders', body), 201);
  Object.assign(s, { order: made.order_code, code: made.delivery_code, token: new URL(made.track_url, base).searchParams.get('t') });
  const board = ok(await seller.get('/api/seller/deliveries'));
  assert.ok(board.board.new.some((d) => d.code === s.code));
  ok(await seller.post(`/api/seller/deliveries/${s.code}/prepare`, { prep_minutes: 10 }));
  const ready = ok(await seller.post(`/api/seller/deliveries/${s.code}/ready`));
  assert.equal(ready.delivery.order_status, 'ready_to_ship');
  assert.match(ready.delivery.pickup_pin, /^\d{4}$/);
  s.pickupPin = ready.delivery.pickup_pin;
  const track = ok(await anon.get(`/api/track/${s.token}`));
  assert.match(track.delivery.delivery_code, /^\d{4}$/);
  s.dropCode = track.delivery.delivery_code;
  assert.equal((await anon.get('/api/track/not-a-real-token-000000')).status, 404);
  // The seller can no longer mark the order shipped or delivered by hand: the network owns those steps.
  const order = ok(await seller.get(`/api/orders/${s.order}`)).order;
  assert.equal(order.network_delivery.code, s.code);
  assert.equal((await seller.post(`/api/orders/${s.order}/actions`, { action: 'dispatch' })).status, 409);
});

test('dispatch offers the task and prevents double acceptance', async () => {
  ok(await rohan.post('/api/partners/login', { identifier: 'rohan@nearbuy.demo', password: 'Runner123!' }));
  const d = ok(await admin.get(`/api/admin/deliveries/${s.code}`)).delivery;
  s.pickup = d.pickup; s.drop = d.drop;
  for (const c of [partner, rohan]) {
    ok(await c.patch('/api/partners/availability', { online: true }));
    ok(await c.post('/api/partners/location', { lat: s.pickup.lat, lng: s.pickup.lng, source: 'test' }));
  }
  const ranked = ok(await admin.get(`/api/admin/deliveries/${s.code}/candidates`));
  assert.ok(ranked.candidates.length >= 2);
  assert.ok(ranked.candidates[0].score_parts, 'the score is explained, not distance-only');
  // Offers go to one partner at a time; walk the queue until our new partner holds the offer.
  let offer = null;
  for (let i = 0; i < 6 && !offer; i += 1) {
    delivery.tick();
    const mine = ok(await partner.get('/api/delivery/offers')).offers[0];
    if (mine) { offer = mine; break; }
    const theirs = ok(await rohan.get('/api/delivery/offers')).offers[0];
    if (theirs) { assert.ok(!('drop' in theirs), 'an offer shows the drop area only'); ok(await rohan.post(`/api/delivery/offers/${theirs.id}/decline`, { reason: 'Too far' })); }
  }
  assert.ok(offer, 'the next eligible partner receives the offer after a decline');
  assert.equal(offer.delivery_code, s.code);
  assert.ok(offer.earning > 0 && offer.drop_area && offer.seconds_left > 0);
  assert.ok(!JSON.stringify(offer).includes('9810455512'));
  // Another partner cannot accept someone else's offer, and one offer can be accepted only once.
  assert.ok([403, 404, 409].includes((await rohan.post(`/api/delivery/offers/${offer.id}/accept`)).status));
  const [a, b] = await Promise.all([partner.post(`/api/delivery/offers/${offer.id}/accept`), partner.post(`/api/delivery/offers/${offer.id}/accept`)]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  const after = ok(await admin.get(`/api/admin/deliveries/${s.code}`)).delivery;
  assert.equal(after.status, 'partner_assigned');
  assert.equal(after.partner.code, s.partnerCode);
  assert.equal(after.assignments.filter((x) => x.active).length, 1);
  assert.equal((await rohan.get(`/api/deliveries/${s.code}`)).status, 404, 'other partners cannot open the task');
});

test('pickup and delivery need location and verification', async () => {
  const task = () => partner.get(`/api/deliveries/${s.code}`);
  let d = ok(await task()).delivery;
  assert.ok(d.drop.approximate && !d.drop.address, 'the customer address is hidden before pickup');
  ok(await partner.post(`/api/deliveries/${s.code}/start`));
  ok(await partner.post(`/api/deliveries/${s.code}/location`, { lat: s.pickup.lat + 0.05, lng: s.pickup.lng, source: 'test' }));
  assert.equal((await partner.post(`/api/deliveries/${s.code}/arrived-at-pickup`)).status, 409, 'arrival is refused outside the geofence');
  ok(await partner.post(`/api/deliveries/${s.code}/location`, { lat: s.pickup.lat, lng: s.pickup.lng, source: 'test' }));
  ok(await partner.post(`/api/deliveries/${s.code}/arrived-at-pickup`));
  assert.equal((await partner.post(`/api/deliveries/${s.code}/picked-up`)).status, 409, 'pickup needs verification first');
  assert.equal((await partner.post(`/api/deliveries/${s.code}/verify-pickup`, { method: 'pin', code: '0000' === s.pickupPin ? '1111' : '0000', package_count: 1 })).status, 400);
  ok(await partner.post(`/api/deliveries/${s.code}/verify-pickup`, { method: 'pin', code: s.pickupPin, package_count: d.package_count }));
  d = ok(await partner.post(`/api/deliveries/${s.code}/picked-up`)).delivery;
  assert.equal(d.status, 'en_route_to_customer');
  assert.ok(d.drop.address && /•/.test(d.drop.phone_masked), 'address appears after pickup, phone stays masked');
  assert.equal(ok(await seller.get(`/api/orders/${s.order}`)).order.status, 'shipped');
  const live = ok(await anon.get(`/api/track/${s.token}`)).delivery;
  assert.ok(live.partner_location && live.partner.first_name === 'Asha' && live.eta_at);
  assert.ok(!JSON.stringify(live).includes('9876501234'), 'the customer never sees the partner phone number');
  assert.equal((await partner.post(`/api/deliveries/${s.code}/arrived-at-destination`)).status, 409);
  ok(await partner.post(`/api/deliveries/${s.code}/location`, { lat: s.drop.lat, lng: s.drop.lng, source: 'test' }));
  ok(await partner.post(`/api/deliveries/${s.code}/arrived-at-destination`));
  assert.equal((await partner.post(`/api/deliveries/${s.code}/complete`, { cod_collected: true, payment_method: 'cash', amount: d.cod_amount })).status, 409, 'no completion without proof');
  assert.equal((await partner.post(`/api/deliveries/${s.code}/proof`, { method: 'otp', code: 'x' })).status, 400);
  ok(await partner.post(`/api/deliveries/${s.code}/proof`, { method: 'otp', code: s.dropCode }));
  assert.equal((await partner.post(`/api/deliveries/${s.code}/complete`, {})).status, 400, 'cash collection must be confirmed');
  d = ok(await partner.post(`/api/deliveries/${s.code}/complete`, { cod_collected: true, payment_method: 'cash', amount: d.cod_amount })).delivery;
  assert.equal(d.status, 'delivered');
  s.earning = d.earning; s.cod = d.cod_amount;
  assert.equal((await partner.post(`/api/deliveries/${s.code}/complete`, { cod_collected: true, payment_method: 'cash', amount: d.cod_amount })).status, 409, 'a delivery completes once');
});

test('every dashboard shows the same completed delivery', async () => {
  assert.equal(ok(await seller.get(`/api/orders/${s.order}`)).order.status, 'delivered');
  const sv = ok(await seller.get(`/api/seller/deliveries/${s.code}`)).delivery;
  assert.equal(sv.status, 'delivered');
  assert.equal(sv.pickup_pin, null);
  assert.equal((await seller.post(`/api/seller/deliveries/${s.code}/ready`)).status, 409, 'a seller cannot alter a completed delivery');
  const av = ok(await admin.get(`/api/admin/deliveries/${s.code}`)).delivery;
  const seen = av.timeline.map((h) => h.status);
  for (const st of ['searching_partner', 'offer_sent', 'partner_assigned', 'en_route_to_pickup', 'arrived_at_pickup', 'picked_up', 'en_route_to_customer', 'arrived_at_destination', 'delivered']) assert.ok(seen.includes(st), `history has ${st}`);
  assert.ok(av.timeline.every((h) => h.created_at && h.actor_type));
  assert.equal(av.proofs.length, 1);
  assert.equal(av.pickup_confirmations.length, 1);
  const cv = ok(await anon.get(`/api/track/${s.token}`)).delivery;
  assert.equal(cv.status, 'delivered');
  assert.equal(cv.delivery_code, null);
  assert.equal(cv.partner_location, null, 'location sharing stops when the delivery is closed');
  ok(await anon.post(`/api/track/${s.token}/rating`, { rating: 5 }));
  assert.equal((await anon.post(`/api/track/${s.token}/rating`, { rating: 1 })).status, 409);
  const tasks = ok(await partner.get('/api/partners/tasks'));
  assert.ok(tasks.history.some((t) => t.code === s.code && t.status === 'delivered'));
});

test('earnings, cash reconciliation and payout are separate records', async () => {
  let e = ok(await partner.get('/api/partners/earnings'));
  assert.equal(e.today.total, s.earning);
  assert.equal(e.wallet.pending, s.earning, 'earnings of a cash order are held until the cash is deposited');
  assert.equal(e.wallet.available, 0);
  const cod = ok(await partner.get('/api/partners/cod'));
  assert.equal(cod.cash_in_hand, s.cod);
  assert.equal((await partner.post('/api/partners/cod/deposits', { amount: s.cod + 500, method: 'upi', reference: 'UTR000111' })).status, 400);
  const dep = ok(await partner.post('/api/partners/cod/deposits', { amount: s.cod, method: 'upi', reference: 'UTR000111' }), 201);
  ok(await admin.post(`/api/admin/cod/${dep.code}/review`, { decision: 'confirm' }));
  e = ok(await partner.get('/api/partners/earnings'));
  assert.equal(e.wallet.available, s.earning);
  assert.equal(ok(await partner.get('/api/partners/cod')).cash_in_hand, 0);
  const payout = ok(await admin.post('/api/admin/payouts', { partner_code: s.partnerCode }), 201);
  assert.equal((await admin.post('/api/admin/payouts', { partner_code: s.partnerCode })).status, 409, 'nothing left to pay twice');
  ok(await admin.post(`/api/admin/payouts/${payout.code}/settle`, { status: 'paid', reference: 'NEFT123456' }));
  e = ok(await partner.get('/api/partners/earnings'));
  assert.equal(e.wallet.paid, s.earning);
  const txns = ok(await partner.get('/api/partners/transactions')).transactions;
  assert.ok(txns.length && txns.every((t) => t.txn_code && t.status === 'paid'));
  const csv = await partner.get('/api/partners/statement.csv');
  assert.equal(csv.status, 200);
  assert.match(csv.data.toString(), /Transaction ID/);
  const st = ok(await admin.get(`/api/admin/deliveries/${s.code}`)).delivery.settlement;
  assert.ok(st.reconciled_at, 'the settlement record is reconciled after cash and payout');
});

test('manual assignment is audited; failed delivery goes back to the seller', async () => {
  const made = ok(await seller.post('/api/seller/deliveries/test-orders', { category: 'ecommerce', payment: 'prepaid', customer_name: 'Imran Sheikh', customer_phone: '9811277345', address: 'Flat 6, J Block, Saket', pincode: '110017' }), 201);
  const code = made.delivery_code; const token = new URL(made.track_url, base).searchParams.get('t');
  const pin = ok(await seller.post(`/api/seller/deliveries/${code}/ready`)).delivery.pickup_pin;
  assert.equal((await admin.post(`/api/admin/deliveries/${code}/assign`, { partner_code: s.partnerCode })).status, 400, 'a reason is required');
  ok(await admin.post(`/api/admin/deliveries/${code}/assign`, { partner_code: s.partnerCode, reason: 'Testing manual dispatch' }));
  let d = ok(await admin.get(`/api/admin/deliveries/${code}`)).delivery;
  assert.equal(d.partner.code, s.partnerCode);
  assert.ok(d.assignments.some((a) => a.mode === 'manual' && a.assigned_by && a.reason));
  // Reassign to another partner: the first partner loses access at once.
  ok(await admin.post(`/api/admin/deliveries/${code}/reassign`, { partner_code: 'DP-2001', reason: 'Vehicle breakdown reported' }));
  assert.equal((await partner.get(`/api/deliveries/${code}`)).status, 404);
  ok(await rohan.post(`/api/deliveries/${code}/location`, { lat: d.pickup.lat, lng: d.pickup.lng, source: 'test' }));
  ok(await rohan.post(`/api/deliveries/${code}/arrived-at-pickup`));
  // Seller confirmation is an alternative to the PIN.
  ok(await seller.post(`/api/seller/deliveries/${code}/confirm-handover`, { package_count: d.package_count }));
  ok(await rohan.post(`/api/deliveries/${code}/picked-up`));
  ok(await rohan.post(`/api/deliveries/${code}/location`, { lat: d.drop.lat, lng: d.drop.lng, source: 'test' }));
  ok(await rohan.post(`/api/deliveries/${code}/arrived-at-destination`));
  ok(await rohan.post(`/api/deliveries/${code}/failed-attempt`, { reason: 'Customer unavailable' }));
  assert.equal(ok(await anon.get(`/api/track/${token}`)).delivery.exception.status, 'delivery_attempt_failed');
  ok(await admin.post(`/api/admin/deliveries/${code}/resolve-failed`, { decision: 'return' }));
  const sv = ok(await seller.get(`/api/seller/deliveries/${code}`)).delivery;
  assert.equal(sv.status, 'return_in_progress');
  assert.match(sv.return_code, /^\d{4}$/);
  assert.notEqual(sv.return_code, undefined);
  ok(await rohan.post(`/api/deliveries/${code}/location`, { lat: d.pickup.lat, lng: d.pickup.lng, source: 'test' }));
  ok(await rohan.post(`/api/deliveries/${code}/arrived-at-destination`));
  ok(await rohan.post(`/api/deliveries/${code}/proof`, { method: 'otp', code: sv.return_code }));
  d = ok(await rohan.post(`/api/deliveries/${code}/complete`, {})).delivery;
  assert.equal(d.status, 'returned_to_seller');
  assert.equal(pin.length, 4);
  // Admin cancellation of a fresh delivery cancels the order as well.
  const third = ok(await seller.post('/api/seller/deliveries/test-orders', { category: 'food', payment: 'prepaid' }), 201);
  ok(await admin.post(`/api/admin/deliveries/${third.delivery_code}/cancel`, { reason: 'Customer asked to cancel' }));
  assert.equal(ok(await seller.get(`/api/orders/${third.order_code}`)).order.status, 'cancelled');
});

test('fleet portal sees only its own members; support tickets reach the control tower', async () => {
  ok(await fleet.post('/api/fleet/login', { email: 'fleet@nearbuy.demo', password: 'Fleet123!' }));
  const roster = ok(await fleet.get('/api/fleet/roster')).members;
  assert.deepEqual(roster.map((m) => m.name).sort(), ['Farhan Ali', 'Meena Joshi']);
  assert.equal((await fleet.post('/api/fleet/roster/DP-2001/hold', { hold: true, reason: 'Not ours' })).status, 404);
  assert.equal((await fleet.get('/api/admin/partners')).status, 401);
  const held = roster.find((m) => m.name === 'Meena Joshi');
  ok(await fleet.post(`/api/fleet/roster/${held.code}/hold`, { hold: true, reason: 'Vehicle under repair' }));
  const meena = client();
  ok(await meena.post('/api/partners/login', { identifier: 'meena@nearbuy.demo', password: 'Runner123!' }));
  assert.equal((await meena.patch('/api/partners/availability', { online: true })).status, 409);
  ok(await fleet.get('/api/fleet/overview')); ok(await fleet.get('/api/fleet/performance')); ok(await fleet.get('/api/fleet/settlements'));
  assert.equal((await fleet.get('/api/fleet/invoice.csv')).status, 200);
  const t = ok(await partner.post('/api/partners/tickets', { category: Object.keys(ok(await partner.get('/api/partners/config')).ticket_categories)[0], description: 'The pickup point was closed when I arrived.', delivery_code: s.code }), 201);
  ok(await admin.post(`/api/admin/tickets/${t.code}/reply`, { body: 'Thanks, we are checking with the seller.' }));
  const thread = ok(await partner.get(`/api/partners/tickets/${t.code}`)).ticket;
  assert.equal(thread.messages.at(-1).author_type, 'support');
  assert.equal((await rohan.get(`/api/partners/tickets/${t.code}`)).status, 404);
  ok(await anon.post(`/api/track/${s.token}/issues`, { category: Object.keys(ok(await anon.get(`/api/track/${s.token}`)).complaint_categories)[0], description: 'The package arrived with a torn cover.' }), 201);
  assert.ok(ok(await admin.get('/api/admin/tickets')).tickets.length >= 2);
});

test('control tower pages, zones, reports and suspension', async () => {
  for (const url of ['/api/admin/dashboard', '/api/admin/map', '/api/admin/deliveries?tab=delivered', '/api/admin/zones', '/api/admin/finance', '/api/admin/reports', '/api/admin/incidents', '/api/admin/fleets', '/api/admin/notifications', '/api/tower/me']) ok(await admin.get(url));
  assert.equal((await admin.get('/api/admin/reports.csv')).status, 200);
  const dash = ok(await admin.get('/api/admin/dashboard'));
  assert.equal(typeof dash, 'object');
  // Suspending a zone stops new deliveries there.
  const zone = ok(await admin.get('/api/admin/zones')).zones.find((z) => z.name === 'South Delhi');
  ok(await admin.patch(`/api/admin/zones/${zone.code}`, { status: 'suspended', status_note: 'Heavy rain' }));
  { const q = await seller.post('/api/seller/deliveries/test-orders/quote', { category: 'food', payment: 'prepaid' }); assert.equal(q.status, 409, JSON.stringify(q.data)); }
  ok(await admin.patch(`/api/admin/zones/${zone.code}`, { status: 'active' }));
  // A suspended partner is taken offline and loses access to delivery work.
  ok(await admin.patch(`/api/admin/partners/${s.partnerCode}/approval`, { decision: 'suspend', note: 'Policy review in progress' }));
  assert.equal((await partner.get('/api/partners/me')).status, 401, 'suspension revokes the partner sessions');
  ok(await partner.post('/api/partners/login', { identifier: '9876501234', password: 'Deliver#2026x' }));
  assert.equal(ok(await partner.get('/api/partners/me')).partner.status, 'suspended');
  assert.equal((await partner.get('/api/delivery/offers')).status, 403);
  assert.equal((await partner.patch('/api/partners/availability', { online: true })).status, 409);
  // Signing out ends the session.
  ok(await partner.post('/api/partners/logout'));
  assert.equal((await partner.get('/api/partners/me')).status, 401);
});

test('delivery apps are served with a strict content security policy', async () => {
  for (const page of ['/runner/', '/control-tower/', '/fleet/', '/track/']) {
    const res = await fetch(base + page);
    assert.equal(res.status, 200, page);
    assert.match(res.headers.get('content-security-policy') || '', /script-src 'self'/, page);
    assert.ok(!/<script(?![^>]*\bsrc=)/i.test(await res.text()), `${page} has no inline script`);
  }
});
