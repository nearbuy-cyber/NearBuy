'use strict';
// Shared building blocks of the delivery network: geography, pricing, ETA, status changes, notifications,
// audit logging, private file storage and the real-time event bus.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { get, all, run, insert, nextCode, parseJson, notify } = require('../db');
const { DATA_DIR, HttpError, bad, nowIso, r2, sha256, randomToken } = require('../lib');
const S = require('./schema');

const PRODUCTION = () => process.env.NODE_ENV === 'production';
const TEST_TOOLS = () => !PRODUCTION() && process.env.DELIVERY_TEST_TOOLS !== '0';
const CONFIG = {
  offerSeconds: () => Math.max(1, Number(process.env.DELIVERY_OFFER_SECONDS || 45)),
  geofenceM: () => Number(process.env.DELIVERY_GEOFENCE_M || 250),
  locationFreshMs: () => Number(process.env.DELIVERY_LOCATION_FRESH_SECONDS || 300) * 1000,
  locationRetentionDays: () => Number(process.env.DELIVERY_LOCATION_RETENTION_DAYS || 30),
  roadFactor: 1.35,
};

/* ---------- Geography ---------- */
const rad = (d) => (d * Math.PI) / 180;
function haversineKm(aLat, aLng, bLat, bLng) {
  const dLat = rad(bLat - aLat); const dLng = rad(bLng - aLng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(x));
}
/** Estimated road distance. No routing provider is connected, so straight-line distance is scaled by a fixed factor. */
const roadKm = (aLat, aLng, bLat, bLng) => r2(haversineKm(aLat, aLng, bLat, bLng) * CONFIG.roadFactor);
const validCoord = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
const zonePins = (zone) => parseJson(zone.pincodes, []);
function zoneForPincode(pincode) {
  for (const zone of all('SELECT * FROM service_zones ORDER BY id')) {
    const pin = zonePins(zone).find((p) => p.pin === String(pincode));
    if (pin) return { zone, pin };
  }
  return null;
}
/**
 * Geocode an address inside a zone. No geocoding provider is connected: the point is the PIN-code centroid from the
 * zone configuration, moved by a small offset derived from the address text so that different addresses do not overlap.
 */
function geocode(address, pincode) {
  const hit = zoneForPincode(pincode);
  if (!hit) return null;
  const hash = crypto.createHash('sha256').update(`${address}|${pincode}`).digest();
  const dLat = ((hash[0] / 255) - 0.5) * 0.008; // about ±450 m
  const dLng = ((hash[1] / 255) - 0.5) * 0.008;
  return { lat: Number((hit.pin.lat + dLat).toFixed(6)), lng: Number((hit.pin.lng + dLng).toFixed(6)), area: hit.pin.area, zone: hit.zone, source: 'pincode_centroid' };
}
function zoneOpenNow(zone, at = Date.now()) {
  const hm = new Date(at + 330 * 60000).toISOString().slice(11, 16);
  return zone.open_time <= zone.close_time ? hm >= zone.open_time && hm <= zone.close_time : hm >= zone.open_time || hm <= zone.close_time;
}

/* ---------- Pricing ---------- */
function feeRule(zoneId, category) {
  const rule = get('SELECT * FROM delivery_fee_rules WHERE zone_id = ? AND category = ?', zoneId, category);
  if (!rule) throw new HttpError(409, `No delivery fee rule is configured for ${S.CATEGORIES[category] || category} in this zone.`);
  return rule;
}
/** Customer delivery fee. Every component is returned so that the total can be shown before payment. */
function quoteFee(zone, category, distanceKm, { scheduled = false, special = false } = {}) {
  const rule = feeRule(zone.id, category);
  const distance = r2(Math.max(0, distanceKm - rule.free_km) * rule.per_km_fee);
  const sched = scheduled ? rule.scheduled_fee : 0;
  const handling = special ? rule.handling_fee : 0;
  const subtotal = r2(rule.base_fee + distance + sched + handling);
  const tax = r2(subtotal * rule.tax_rate / 100);
  return { base: rule.base_fee, distance, distance_km: distanceKm, scheduled: sched, handling, tax, tax_rate: rule.tax_rate, total: r2(subtotal + tax) };
}
/** Partner earning for a task. The incentive is a flat zone amount set by an administrator; nothing depends on speed. */
function quoteEarning(zone, category, distanceKm) {
  const rule = feeRule(zone.id, category);
  const distance = r2(distanceKm * rule.partner_per_km);
  const incentive = r2(zone.demand_incentive || 0);
  return { base: rule.partner_base, distance, incentive, total: r2(rule.partner_base + distance + incentive) };
}

/* ---------- ETA ---------- */
const travelMin = (km, vehicleType) => (km / ((S.VEHICLES[vehicleType] || S.VEHICLES.two_wheeler).speed_kmh)) * 60;
function partnerPoint(partner) {
  if (!partner || partner.last_lat === null || partner.last_lat === undefined) return null;
  return { lat: partner.last_lat, lng: partner.last_lng, at: partner.last_location_at };
}
function estimateEta(d, partner, vehicleType) {
  const now = Date.now();
  const readyAt = d.ready_at ? Date.parse(d.ready_at) : d.expected_ready_at ? Date.parse(d.expected_ready_at) : now;
  const point = partnerPoint(partner);
  // A failed forward delivery travels back to its pickup point; everything else travels to the drop point.
  const dest = d.kind === 'forward' && d.status === 'return_in_progress' ? { lat: d.pickup_lat, lng: d.pickup_lng } : { lat: d.drop_lat, lng: d.drop_lng };
  let at; let basis;
  if (S.AFTER_PICKUP.includes(d.status) && d.status !== 'delivery_attempt_failed') {
    const km = point ? roadKm(point.lat, point.lng, dest.lat, dest.lng) : d.distance_km;
    at = now + (travelMin(km, vehicleType) + 2) * 60000; basis = point ? 'partner_location' : 'route_distance';
  } else if (S.BEFORE_PICKUP.includes(d.status)) {
    const km = point ? roadKm(point.lat, point.lng, d.pickup_lat, d.pickup_lng) : 1.5;
    const atPickup = Math.max(readyAt, now + travelMin(km, vehicleType) * 60000);
    at = atPickup + (3 + travelMin(d.distance_km, vehicleType) + 2) * 60000; basis = point ? 'partner_location' : 'route_distance';
  } else if (S.UNASSIGNED.includes(d.status)) {
    const start = Math.max(readyAt, now, d.scheduled_for ? Date.parse(d.scheduled_for) : 0);
    at = start + (8 + travelMin(d.distance_km, 'two_wheeler') + 5) * 60000; basis = 'awaiting_partner';
  } else return null;
  return { eta_at: new Date(at).toISOString(), minutes: Math.max(1, Math.round((at - now) / 60000)), basis };
}
function refreshEta(deliveryId) {
  const d = get('SELECT * FROM deliveries WHERE id = ?', deliveryId);
  if (!d) return null;
  const partner = d.partner_id ? get('SELECT * FROM delivery_partners WHERE id = ?', d.partner_id) : null;
  const vehicle = partner ? get('SELECT type FROM partner_vehicles WHERE partner_id = ?', partner.id) : null;
  const eta = estimateEta(d, partner, vehicle && vehicle.type);
  if (!eta) return null;
  if (!d.eta_at || Math.abs(Date.parse(d.eta_at) - Date.parse(eta.eta_at)) > 60000) {
    run('UPDATE deliveries SET eta_at = ? WHERE id = ?', eta.eta_at, d.id);
    insert('delivery_eta_records', { delivery_id: d.id, eta_at: eta.eta_at, minutes: eta.minutes, basis: eta.basis, created_at: nowIso() });
  }
  return eta;
}

/* ---------- Real-time bus (server-sent events) ---------- */
const subscribers = new Set();
function publish(topics, payload) {
  const wanted = [].concat(topics).filter(Boolean);
  if (!wanted.length) return;
  const frame = `event: change\ndata: ${JSON.stringify({ at: Date.now(), ...payload })}\n\n`;
  for (const sub of subscribers) if (wanted.some((t) => sub.topics.has(t))) { try { sub.res.write(frame); } catch { subscribers.delete(sub); } }
}
function subscribe(res, topics) {
  const sub = { res, topics: new Set(topics) };
  subscribers.add(sub);
  return () => subscribers.delete(sub);
}
setInterval(() => { for (const sub of subscribers) { try { sub.res.write(': keep-alive\n\n'); } catch { subscribers.delete(sub); } } }, 20000).unref();
const deliveryTopics = (d) => ['admin', `seller:${d.seller_id}`, `delivery:${d.id}`, d.partner_id ? `partner:${d.partner_id}` : null, d.fleet_id ? `fleet:${d.fleet_id}` : null];

/* ---------- Audit, notifications ---------- */
function audit(actor, action, entity, ref, detail) {
  insert('audit_logs', {
    actor_type: actor.type, actor_user_id: actor.userId || null, actor_name: actor.name || null, action, entity: entity || null,
    entity_ref: ref || null, detail: detail ? String(detail).slice(0, 500) : null, ip: actor.ip || null, created_at: nowIso(),
  });
}
const SYSTEM = { type: 'system', name: 'Dispatch engine' };
function dnotify(audience, target, type, title, body) {
  insert('delivery_notifications', {
    audience, partner_id: target.partner_id || null, fleet_id: target.fleet_id || null, delivery_id: target.delivery_id || null,
    type, title, body: body || null, created_at: nowIso(),
  });
  publish(audience === 'partner' ? `partner:${target.partner_id}` : audience === 'fleet' ? `fleet:${target.fleet_id}` : audience === 'customer' ? `delivery:${target.delivery_id}` : 'admin', { kind: 'notification', type });
}
const notifySeller = (d, title, body) => notify(d.seller_id, 'shipping', title, body, '/seller/deliveries');
const notifyCustomer = (d, type, title, body) => dnotify('customer', { delivery_id: d.id }, type, title, body);
const notifyPartner = (partnerId, type, title, body, deliveryId) => dnotify('partner', { partner_id: partnerId, delivery_id: deliveryId }, type, title, body);
const notifyAdmin = (type, title, body, deliveryId) => dnotify('admin', { delivery_id: deliveryId }, type, title, body);

/* ---------- Status changes ---------- */
/** The single writer of delivery status: every change gets a timestamp, an actor and a history row. */
function setStatus(d, status, actor, note, patch = {}) {
  if (!S.DELIVERY_STATUS[status]) throw new Error(`Unknown delivery status ${status}`);
  const at = nowIso();
  const fields = { status, updated_at: at, ...patch };
  run(`UPDATE deliveries SET ${Object.keys(fields).map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, ...Object.values(fields), d.id);
  const partner = (fields.partner_id || d.partner_id) ? get('SELECT last_lat, last_lng, last_location_at FROM delivery_partners WHERE id = ?', fields.partner_id || d.partner_id) : null;
  const fresh = partner && partner.last_location_at && Date.now() - Date.parse(partner.last_location_at) < CONFIG.locationFreshMs();
  insert('delivery_status_history', {
    delivery_id: d.id, status, actor_type: actor.type, actor_name: actor.name || null, actor_user_id: actor.userId || null, note: note || null,
    lat: actor.type === 'partner' && fresh ? partner.last_lat : null, lng: actor.type === 'partner' && fresh ? partner.last_lng : null, created_at: at,
  });
  const next = get('SELECT * FROM deliveries WHERE id = ?', d.id);
  refreshEta(d.id);
  publish([...deliveryTopics(d), ...deliveryTopics(next)], { kind: 'delivery', code: d.code, status });
  return get('SELECT * FROM deliveries WHERE id = ?', d.id);
}

/* ---------- Private files (documents, proofs, evidence) ---------- */
const FILE_DIR = path.join(DATA_DIR, 'delivery-private');
fs.mkdirSync(FILE_DIR, { recursive: true });
function sniff(buffer) {
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length > 12 && buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  if (buffer.length > 5 && buffer.subarray(0, 5).toString() === '%PDF-') return 'application/pdf';
  return null;
}
/** Store an uploaded file outside the web root. The type is decided from the content, never from the file name. */
function storeFile(buffer, { allowPdf = false } = {}) {
  if (!buffer || !buffer.length) throw bad('Choose a file to upload.');
  const mime = sniff(buffer);
  if (!mime || (mime === 'application/pdf' && !allowPdf)) throw bad(allowPdf ? 'Upload a JPG, PNG, WebP or PDF file.' : 'Upload a JPG, PNG or WebP image.');
  const key = `${randomToken(18)}`;
  fs.writeFileSync(path.join(FILE_DIR, key), buffer, { mode: 0o600 });
  return { key, mime, size: buffer.length };
}
const readFile = (key) => (/^[A-Za-z0-9_-]+$/.test(key) ? fs.readFileSync(path.join(FILE_DIR, key)) : null);
const removeFile = (key) => { try { if (/^[A-Za-z0-9_-]+$/.test(key)) fs.unlinkSync(path.join(FILE_DIR, key)); } catch { /* already gone */ } };
// Short-lived signed links for sensitive files: the link carries an expiry and an HMAC, and stops working after five minutes.
let linkSecret = null;
function secret() {
  if (linkSecret) return linkSecret;
  const row = get("SELECT value FROM meta WHERE key = 'delivery_link_secret'");
  if (row) linkSecret = row.value;
  else { linkSecret = randomToken(32); run("INSERT INTO meta (key, value) VALUES ('delivery_link_secret', ?)", linkSecret); }
  return linkSecret;
}
const sign = (text) => crypto.createHmac('sha256', secret()).update(text).digest('base64url');
function signedFileLink(kind, id, seconds = 300) {
  const exp = Date.now() + seconds * 1000;
  return { url: `/api/files/${kind}/${id}?exp=${exp}&sig=${sign(`${kind}:${id}:${exp}`)}`, expires_at: new Date(exp).toISOString() };
}
function checkFileLink(kind, id, exp, sig) {
  const expected = Buffer.from(sign(`${kind}:${id}:${exp}`));
  const given = Buffer.from(String(sig || ''));
  if (!Number(exp) || Number(exp) < Date.now() || expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) throw new HttpError(403, 'This file link has expired. Open the file again from the dashboard.');
}

const newCode = (digits = 4) => String(crypto.randomInt(0, 10 ** digits)).padStart(digits, '0');
const label = (status) => S.DELIVERY_STATUS[status] || status;
const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || 'Partner';
const txnCode = () => nextCode('ETX', 500000);

module.exports = {
  PRODUCTION, TEST_TOOLS, CONFIG, haversineKm, roadKm, validCoord, zonePins, zoneForPincode, geocode, zoneOpenNow, feeRule, quoteFee, quoteEarning,
  travelMin, estimateEta, refreshEta, publish, subscribe, deliveryTopics, audit, SYSTEM, dnotify, notifySeller, notifyCustomer, notifyPartner,
  notifyAdmin, setStatus, storeFile, readFile, removeFile, signedFileLink, checkFileLink, newCode, label, firstName, txnCode, sha256,
};
