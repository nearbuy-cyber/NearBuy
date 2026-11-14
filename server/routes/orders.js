'use strict';
// Orders, shipments and returns — including the status workflows and their effect on stock and the ledger.
const { route, reply } = require('../router');
const { get, all, run, tx, insert, nextCode, parseJson, paged, notify, logActivity } = require('../db');
const { bad, notFound, conflict, nowIso, r2, validate, toCsv, maskMobile, maskName, isYmd, istDayStart, istDayEnd, istDate } = require('../lib');
const { moveStock } = require('../stock');
const { recordSale, recordRefund, feeBreakdown } = require('../ledger');
const { Pdf } = require('../pdf');

/* ---------- Order workflow ---------- */
const ORDER_STATUS = {
  new: 'New', pending_confirmation: 'Pending confirmation', processing: 'Processing', packed: 'Packed', ready_to_ship: 'Ready to ship',
  shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled',
};
const ORDER_TABS = {
  new: ['new'], pending_confirmation: ['pending_confirmation'], processing: ['processing', 'packed'], ready_to_ship: ['ready_to_ship'],
  shipped: ['shipped'], delivered: ['delivered'], cancelled: ['cancelled'],
};
// The only transitions the server accepts. Anything else is rejected with 409.
const ORDER_ACTIONS = {
  accept: { from: ['new'], to: 'pending_confirmation', label: 'Accept order', title: 'Order accepted', note: 'Seller accepted the order.' },
  process: { from: ['pending_confirmation'], to: 'processing', label: 'Mark as processing', title: 'Processing started', note: 'Stock confirmed. Order is being prepared.' },
  pack: { from: ['processing'], to: 'packed', label: 'Mark as packed', title: 'Order packed', note: 'Items packed and ready for a shipment record.' },
  ready: { from: ['packed'], to: 'ready_to_ship', label: 'Mark ready to ship', title: 'Ready to ship', note: 'Package is waiting for pickup.' },
  dispatch: { from: ['ready_to_ship'], to: 'shipped', label: 'Mark dispatched', title: 'Dispatched', note: 'Package handed over for delivery.' },
  deliver: { from: ['shipped'], to: 'delivered', label: 'Record delivery', title: 'Delivered', note: 'Delivery recorded manually by the seller.' },
  cancel: { from: ['new', 'pending_confirmation', 'processing', 'packed', 'ready_to_ship'], to: 'cancelled', label: 'Cancel order', title: 'Order cancelled' },
};
const CANCEL_REASONS = ['Out of stock', 'Pricing error', 'Cannot ship to this PIN code', 'Product damaged or defective', 'Customer requested cancellation', 'Other'];
const SHIPMENT_STATUS = { pending_dispatch: 'Pending dispatch', ready_for_pickup: 'Ready for pickup', in_transit: 'In transit', delivered: 'Delivered', failed_delivery: 'Failed delivery', returned: 'Returned to seller' };

function findOrder(sellerId, code) {
  const order = get('SELECT * FROM orders WHERE code = ? AND seller_id = ?', code, sellerId);
  if (!order) throw notFound('Order');
  return order;
}
const orderItems = (sellerId, orderId) => all(`SELECT oi.*, p.code AS product_code,
  (SELECT upload_id FROM product_images WHERE product_id = oi.product_id ORDER BY is_primary DESC, position LIMIT 1) AS image_id
  FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ? AND oi.seller_id = ? ORDER BY oi.id`, orderId, sellerId);
function addOrderEvent(sellerId, orderId, status, title, note, actor, at) {
  insert('order_events', { seller_id: sellerId, order_id: orderId, status, title, note: note || null, actor: actor || 'System', created_at: at || nowIso() });
}
function addShipmentEvent(sellerId, shipmentId, status, title, note, actor, at) {
  insert('shipment_events', { seller_id: sellerId, shipment_id: shipmentId, status, title, note: note || null, actor: actor || 'System', created_at: at || nowIso() });
}

/** Reserve stock for every line, or nothing at all. Returns true when the whole order is reserved. */
function reserveOrderStock(sellerId, order, actor) {
  if (order.stock_state !== 'none') return true;
  const items = all('SELECT * FROM order_items WHERE order_id = ? AND seller_id = ?', order.id, sellerId);
  for (const item of items) {
    const inv = item.inventory_id ? get('SELECT * FROM inventory WHERE id = ? AND seller_id = ?', item.inventory_id, sellerId) : null;
    if (!inv || inv.on_hand - inv.reserved < item.qty) return false;
  }
  for (const item of items) moveStock(sellerId, item.inventory_id, { reservedDelta: item.qty, kind: 'reserve', reason: 'Reserved for order', ref: order.code, actor });
  run("UPDATE orders SET stock_state = 'reserved' WHERE id = ?", order.id);
  order.stock_state = 'reserved';
  return true;
}
function releaseOrderStock(sellerId, order, actor) {
  if (order.stock_state !== 'reserved') return;
  for (const item of all('SELECT * FROM order_items WHERE order_id = ? AND seller_id = ?', order.id, sellerId)) {
    const inv = item.inventory_id ? get('SELECT * FROM inventory WHERE id = ? AND seller_id = ?', item.inventory_id, sellerId) : null;
    if (inv) moveStock(sellerId, inv.id, { reservedDelta: -Math.min(item.qty, inv.reserved), kind: 'release', reason: 'Order cancelled — reservation released', ref: order.code, actor, quiet: true });
  }
  run("UPDATE orders SET stock_state = 'released' WHERE id = ?", order.id);
}
function deductOrderStock(sellerId, order, actor) {
  if (order.stock_state !== 'reserved') throw conflict('Stock for this order has not been reserved, so it cannot be dispatched.');
  for (const item of all('SELECT * FROM order_items WHERE order_id = ? AND seller_id = ?', order.id, sellerId)) {
    const inv = item.inventory_id ? get('SELECT * FROM inventory WHERE id = ? AND seller_id = ?', item.inventory_id, sellerId) : null;
    if (inv) moveStock(sellerId, inv.id, { onHandDelta: -item.qty, reservedDelta: -item.qty, kind: 'dispatch', reason: 'Dispatched to customer', ref: order.code, actor });
  }
  run("UPDATE orders SET stock_state = 'deducted' WHERE id = ?", order.id);
}

/**
 * Create an order with consistent pricing, tax and stock reservation. Used by the demo seeder and the
 * "simulate customer order" action; a real storefront integration would call the same function.
 */
function createOrder(sellerId, { lines, customer, placedAt, paymentMethod = 'Prepaid', isDemo = true, quietNotify = false, applyPromotions = false }) {
  const at = placedAt || nowIso();
  const promosApplied = [];
  let subtotal = 0;
  let taxTotal = 0;
  let dispatchDays = 1;
  const rows = lines.map(({ inventoryId, qty }) => {
    const inv = get(`SELECT i.*, p.title, p.category, p.price AS base_price, p.gst_rate, p.dispatch_days, p.id AS pid, v.price AS variant_price, v.size, v.colour
      FROM inventory i JOIN products p ON p.id = i.product_id LEFT JOIN product_variants v ON v.id = i.variant_id WHERE i.id = ? AND i.seller_id = ?`, inventoryId, sellerId);
    if (!inv) throw notFound('Inventory record');
    let unit = r2(inv.variant_price || inv.base_price);
    if (applyPromotions) {
      // Lazy require: growth.js depends on this module.
      const promo = require('./growth').promotionPrice(sellerId, inv.pid, unit);
      if (promo) { unit = promo.price; promosApplied.push(`${promo.name} (${promo.code})`); }
    }
    const lineTotal = r2(unit * qty);
    const taxable = r2(lineTotal / (1 + inv.gst_rate / 100));
    subtotal += lineTotal; taxTotal += lineTotal - taxable;
    dispatchDays = Math.max(dispatchDays, inv.dispatch_days || 2);
    return { product_id: inv.pid, inventory_id: inv.id, title: inv.title, variant_label: [inv.size, inv.colour].filter(Boolean).join(' / ') || null, sku: inv.sku, category: inv.category, qty, unit_price: unit, gst_rate: inv.gst_rate, taxable_value: taxable, tax_amount: r2(lineTotal - taxable), line_total: lineTotal };
  });
  const shipping = subtotal >= 499 ? 0 : 40;
  const code = nextCode('ORD', 240000);
  const orderId = insert('orders', {
    seller_id: sellerId, code, placed_at: at, status: 'new', customer_ref: customer.ref, customer_name: customer.name, customer_phone: customer.phone,
    ship_address: customer.address, ship_city: customer.city, ship_state: customer.state, ship_pincode: customer.pincode, payment_method: paymentMethod,
    payment_status: paymentMethod === 'Prepaid' ? 'paid' : 'cod_pending', subtotal: r2(subtotal), shipping_charge: shipping, tax_total: r2(taxTotal),
    total: r2(subtotal + shipping), dispatch_by: new Date(Date.parse(at) + dispatchDays * 86400000).toISOString(), is_demo: isDemo ? 1 : 0, updated_at: at,
  });
  rows.forEach((row) => insert('order_items', { seller_id: sellerId, order_id: orderId, ...row }));
  addOrderEvent(sellerId, orderId, 'new', 'Order placed', `${paymentMethod} order received from the marketplace.`, 'Customer', at);
  const order = get('SELECT * FROM orders WHERE id = ?', orderId);
  if (promosApplied.length) addOrderEvent(sellerId, orderId, 'new', 'Promotion price applied', [...new Set(promosApplied)].join(', '), 'System', at);
  const reserved = reserveOrderStock(sellerId, order, 'System');
  if (!reserved) addOrderEvent(sellerId, orderId, 'new', 'Stock check needed', 'Available stock is lower than the ordered quantity. Update inventory before accepting.', 'System', at);
  if (!quietNotify) notify(sellerId, 'order', `New order ${code}`, `${rows[0].title}${rows.length > 1 ? ` and ${rows.length - 1} more` : ''} · ₹${r2(subtotal + shipping).toLocaleString('en-IN')}`, `/seller/orders/${code}`);
  return get('SELECT * FROM orders WHERE id = ?', orderId);
}

function allowedActions(order, shipment, canWrite) {
  if (!canWrite) return [];
  const actions = [];
  for (const [key, def] of Object.entries(ORDER_ACTIONS)) {
    if (!def.from.includes(order.status)) continue;
    const action = { key, label: def.label };
    if (key === 'accept' && order.stock_state === 'none') action.blocked = 'Not enough stock to reserve this order. Update inventory or cancel it.';
    if (key === 'ready' && !shipment) action.blocked = 'Generate a shipment record first.';
    if (key === 'cancel') action.danger = true;
    actions.push(action);
  }
  if (order.status === 'packed' && !shipment) actions.unshift({ key: 'shipment', label: 'Generate shipment record' });
  if (order.status === 'shipped') {
    if (shipment && shipment.status === 'in_transit') actions.push({ key: 'fail', label: 'Record failed delivery', danger: true });
    if (shipment && shipment.status === 'failed_delivery') actions.push({ key: 'reattempt', label: 'Record re-attempt' }, { key: 'rto', label: 'Record return to seller', danger: true });
  }
  return actions;
}

function orderDetail(ctx, order) {
  const sellerId = ctx.sellerId;
  const items = orderItems(sellerId, order.id);
  const shipment = get('SELECT * FROM shipments WHERE order_id = ? AND seller_id = ?', order.id, sellerId);
  const profile = get('SELECT state FROM seller_business_profiles WHERE seller_id = ?', sellerId) || {};
  const sameState = profile.state && order.ship_state && profile.state === order.ship_state;
  const taxable = r2(items.reduce((s, i) => s + i.taxable_value, 0));
  const tax = r2(items.reduce((s, i) => s + i.tax_amount, 0));
  return {
    code: order.code, placed_at: order.placed_at, status: order.status, status_label: ORDER_STATUS[order.status], is_demo: Boolean(order.is_demo),
    items: items.map((i) => ({ title: i.title, variant_label: i.variant_label, sku: i.sku, qty: i.qty, unit_price: i.unit_price, gst_rate: i.gst_rate, taxable_value: i.taxable_value, tax_amount: i.tax_amount, line_total: i.line_total, product_code: i.product_code, image_id: i.image_id, category: i.category })),
    subtotal: order.subtotal, shipping_charge: order.shipping_charge, total: order.total,
    tax: { taxable_value: taxable, total: tax, cgst: sameState ? r2(tax / 2) : 0, sgst: sameState ? r2(tax / 2) : 0, igst: sameState ? 0 : tax, basis: profile.state ? (sameState ? `Intra-state supply (${profile.state})` : `Inter-state supply (${profile.state} → ${order.ship_state})`) : 'Seller state not set — shown as IGST' },
    customer: { ref: order.customer_ref, name: maskName(order.customer_name), phone: maskMobile(order.customer_phone), city: order.ship_city, state: order.ship_state, pincode: order.ship_pincode },
    payment: { method: order.payment_method, status: order.payment_status },
    dispatch_by: order.dispatch_by, stock_state: order.stock_state,
    cancellation: order.status === 'cancelled' ? { reason: order.cancel_reason, by: order.cancelled_by, at: order.cancelled_at } : null,
    shipment: shipment ? shipmentView(sellerId, shipment, false) : null,
    timeline: all('SELECT status, title, note, actor, created_at FROM order_events WHERE order_id = ? AND seller_id = ? ORDER BY id', order.id, sellerId),
    returns: all('SELECT code, status, refund_status, requested_at FROM returns WHERE order_id = ? AND seller_id = ?', order.id, sellerId),
    fees_estimate: ctx.can('payments.read') ? feeBreakdown(sellerId, order) : null,
    actions: allowedActions(order, shipment, ctx.can('orders.write')),
    cancel_reasons: CANCEL_REASONS,
    documents: { invoice: order.status !== 'new' && order.status !== 'cancelled', label: Boolean(shipment) && order.status !== 'cancelled' },
  };
}

function createShipment(ctx, order) {
  if (order.status !== 'packed') throw conflict('A shipment record can be generated once the order is packed.');
  if (get('SELECT 1 FROM shipments WHERE order_id = ? AND seller_id = ?', order.id, ctx.sellerId)) throw conflict('This order already has a shipment record.');
  const pickup = get('SELECT * FROM seller_pickup_locations WHERE seller_id = ? ORDER BY is_default DESC, id LIMIT 1', ctx.sellerId);
  if (!pickup) throw conflict('Add a pickup location in Shipping → Pickup locations before generating a shipment record.');
  const settings = parseJson(ctx.seller.package_settings, {});
  const items = all('SELECT oi.qty, p.package FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ? AND oi.seller_id = ?', order.id, ctx.sellerId);
  let weight = 0;
  let dims = null;
  for (const item of items) {
    const pkg = parseJson(item.package, {});
    weight += (pkg.weight_g || settings.default_weight_g || 500) * item.qty;
    if (!dims && pkg.length_cm) dims = `${pkg.length_cm} × ${pkg.width_cm} × ${pkg.height_cm} cm`;
  }
  if (!dims && settings.default_length_cm) dims = `${settings.default_length_cm} × ${settings.default_width_cm} × ${settings.default_height_cm} cm`;
  const code = nextCode('SHP', 70000);
  const id = insert('shipments', {
    seller_id: ctx.sellerId, code, order_id: order.id, carrier: 'Self-ship (no carrier integration)', reference: code, status: 'pending_dispatch',
    pickup_location_id: pickup.id, weight_g: weight, dimensions: dims, created_at: nowIso(), updated_at: nowIso(),
  });
  addShipmentEvent(ctx.sellerId, id, 'pending_dispatch', 'Shipment record created', `Pickup from ${pickup.name}.`, ctx.user.name);
  addOrderEvent(ctx.sellerId, order.id, order.status, 'Shipment record generated', `${code} · ${Math.round(weight)} g`, ctx.user.name);
  return get('SELECT * FROM shipments WHERE id = ?', id);
}
function setShipmentStatus(ctx, shipment, status, title, note) {
  const patch = { status, updated_at: nowIso() };
  if (status === 'in_transit' && !shipment.dispatched_at) patch.dispatched_at = nowIso();
  if (status === 'delivered') patch.delivered_at = nowIso();
  run(`UPDATE shipments SET ${Object.keys(patch).map((k) => `${k} = ?`).join(', ')} WHERE id = ? AND seller_id = ?`, ...Object.values(patch), shipment.id, ctx.sellerId);
  addShipmentEvent(ctx.sellerId, shipment.id, status, title, note, ctx.user.name);
}

function applyOrderAction(ctx, order, action, body) {
  const actor = ctx.user.name;
  const shipment = get('SELECT * FROM shipments WHERE order_id = ? AND seller_id = ?', order.id, ctx.sellerId);
  if (action === 'shipment') { createShipment(ctx, order); logActivity(ctx, 'Generated shipment record', 'order', order.code); return 'Shipment record generated.'; }
  if (['fail', 'reattempt', 'rto'].includes(action)) {
    if (order.status !== 'shipped' || !shipment) throw conflict('This action is only available for dispatched orders.');
    if (action === 'fail') {
      if (shipment.status !== 'in_transit') throw conflict('Only shipments in transit can be marked as a failed delivery.');
      const reason = validate(body, { reason: { required: true, min: 3, max: 200 } }).reason;
      setShipmentStatus(ctx, shipment, 'failed_delivery', 'Delivery attempt failed', reason);
      addOrderEvent(ctx.sellerId, order.id, 'shipped', 'Delivery attempt failed', reason, actor);
      notify(ctx.sellerId, 'shipping', `Failed delivery: ${order.code}`, reason, `/seller/orders/${order.code}`);
      return 'Failed delivery recorded.';
    }
    if (shipment.status !== 'failed_delivery') throw conflict('This action follows a failed delivery.');
    if (action === 'reattempt') {
      setShipmentStatus(ctx, shipment, 'in_transit', 'Out for re-delivery', 'Re-attempt recorded by the seller.');
      addOrderEvent(ctx.sellerId, order.id, 'shipped', 'Re-delivery attempt', null, actor);
      return 'Re-attempt recorded.';
    }
    // Return to origin: the order is closed and the units come back into stock.
    setShipmentStatus(ctx, shipment, 'returned', 'Returned to seller', 'Undelivered package received back.');
    for (const item of all('SELECT * FROM order_items WHERE order_id = ? AND seller_id = ?', order.id, ctx.sellerId)) {
      if (item.inventory_id && get('SELECT 1 FROM inventory WHERE id = ? AND seller_id = ?', item.inventory_id, ctx.sellerId)) moveStock(ctx.sellerId, item.inventory_id, { onHandDelta: item.qty, kind: 'return', reason: 'Undelivered package returned', ref: order.code, actor, quiet: true });
    }
    run("UPDATE orders SET status = 'cancelled', stock_state = 'restocked', cancel_reason = 'Undelivered — returned to seller', cancelled_by = 'Carrier (return to origin)', cancelled_at = ?, updated_at = ? WHERE id = ?", nowIso(), nowIso(), order.id);
    addOrderEvent(ctx.sellerId, order.id, 'cancelled', 'Order closed — returned to seller', 'Units added back to stock.', actor);
    logActivity(ctx, 'Recorded return to origin', 'order', order.code);
    return 'Return to seller recorded and stock restored.';
  }

  const def = ORDER_ACTIONS[action];
  if (!def) throw bad('Unknown order action.');
  if (!def.from.includes(order.status)) {
    throw conflict(`"${def.label}" is not allowed while the order is ${ORDER_STATUS[order.status]}. ${order.status === 'cancelled' || order.status === 'delivered' ? 'This order is closed.' : `Allowed next steps: ${Object.values(ORDER_ACTIONS).filter((a) => a.from.includes(order.status)).map((a) => a.label).join(', ')}.`}`);
  }
  let note = def.note;
  const patch = { status: def.to, updated_at: nowIso() };
  if (action === 'accept') {
    if (!reserveOrderStock(ctx.sellerId, order, actor)) throw conflict('Not enough stock to accept this order. Update inventory first, or cancel the order.');
  } else if (action === 'ready') {
    if (!shipment) throw conflict('Generate a shipment record before marking the order ready to ship.');
    setShipmentStatus(ctx, shipment, 'ready_for_pickup', 'Ready for pickup', 'Package is packed and labelled.');
  } else if (action === 'dispatch') {
    if (!shipment) throw conflict('This order has no shipment record.');
    deductOrderStock(ctx.sellerId, order, actor);
    setShipmentStatus(ctx, shipment, 'in_transit', 'Dispatched', 'Handed over for delivery. Tracking updates are recorded manually.');
  } else if (action === 'deliver') {
    if (!shipment || !['in_transit'].includes(shipment.status)) throw conflict('Delivery can be recorded only while the shipment is in transit.');
    setShipmentStatus(ctx, shipment, 'delivered', 'Delivered', 'Delivery recorded manually by the seller.');
    patch.delivered_at = nowIso();
    if (order.payment_status === 'cod_pending') patch.payment_status = 'cod_collected';
  } else if (action === 'cancel') {
    const data = validate(body, { reason: { required: true, enum: CANCEL_REASONS, label: 'Cancellation reason' }, note: { max: 300 } });
    releaseOrderStock(ctx.sellerId, order, actor);
    patch.cancel_reason = data.note ? `${data.reason} — ${data.note}` : data.reason;
    patch.cancelled_by = `Seller (${actor})`;
    patch.cancelled_at = nowIso();
    if (order.payment_status === 'paid') patch.payment_status = 'refund_pending_gateway';
    if (order.payment_status === 'cod_pending') patch.payment_status = 'not_collected';
    note = patch.cancel_reason;
    if (shipment) setShipmentStatus(ctx, shipment, 'returned', 'Shipment cancelled', 'Order cancelled before dispatch.');
  }
  run(`UPDATE orders SET ${Object.keys(patch).map((k) => `${k} = ?`).join(', ')} WHERE id = ? AND seller_id = ?`, ...Object.values(patch), order.id, ctx.sellerId);
  addOrderEvent(ctx.sellerId, order.id, def.to, def.title, note, actor);
  if (action === 'deliver') {
    const fees = recordSale(ctx.sellerId, { ...order, ...patch });
    notify(ctx.sellerId, 'payment', `Sale recorded for ${order.code}`, `₹${fees.net.toLocaleString('en-IN')} net added to your unsettled balance.`, '/seller/payments/transactions');
  }
  logActivity(ctx, def.title, 'order', order.code, note);
  return `${def.title}.`;
}

/* ---------- Order routes ---------- */
function orderFilters(ctx) {
  const where = ['o.seller_id = ?'];
  const params = [ctx.sellerId];
  const tab = ctx.query.tab;
  if (ORDER_TABS[tab]) { where.push(`o.status IN (${ORDER_TABS[tab].map(() => '?').join(', ')})`); params.push(...ORDER_TABS[tab]); }
  if (isYmd(ctx.query.from)) { where.push('o.placed_at >= ?'); params.push(istDayStart(ctx.query.from)); }
  if (isYmd(ctx.query.to)) { where.push('o.placed_at <= ?'); params.push(istDayEnd(ctx.query.to)); }
  if (ctx.query.overdue === '1') { where.push("o.dispatch_by < ? AND o.status IN ('new', 'pending_confirmation', 'processing', 'packed', 'ready_to_ship')"); params.push(nowIso()); }
  return { where, params };
}
const ORDER_SELECT = `o.code, o.placed_at, o.status, o.total, o.customer_ref, o.ship_pincode, o.ship_city, o.dispatch_by, o.payment_method, o.payment_status, o.is_demo, o.stock_state,
  (SELECT title FROM order_items WHERE order_id = o.id ORDER BY id LIMIT 1) AS title,
  (SELECT sku FROM order_items WHERE order_id = o.id ORDER BY id LIMIT 1) AS sku,
  (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) AS line_count,
  (SELECT SUM(qty) FROM order_items WHERE order_id = o.id) AS qty,
  (SELECT pi.upload_id FROM order_items oi JOIN product_images pi ON pi.product_id = oi.product_id WHERE oi.order_id = o.id ORDER BY oi.id, pi.is_primary DESC, pi.position LIMIT 1) AS image_id`;
const ORDER_SEARCH = ['o.code', 'o.customer_ref', 'o.ship_pincode', '(SELECT GROUP_CONCAT(title || \' \' || sku) FROM order_items WHERE order_id = o.id)'];

route('GET', '/api/orders', { perm: 'orders.read' }, (ctx) => {
  const { where, params } = orderFilters(ctx);
  const list = paged({
    select: ORDER_SELECT, from: 'orders o', where, params, search: { q: ctx.query.q, cols: ORDER_SEARCH },
    sortMap: { placed: 'o.placed_at', total: 'o.total', dispatch: 'o.dispatch_by', code: 'o.code' }, sort: ctx.query.sort, defaultSort: 'o.placed_at DESC',
    page: ctx.query.page, pageSize: ctx.query.page_size,
  });
  const counts = { all: 0 };
  for (const key of Object.keys(ORDER_TABS)) counts[key] = 0;
  for (const row of all('SELECT status, COUNT(*) AS n FROM orders WHERE seller_id = ? GROUP BY status', ctx.sellerId)) {
    counts.all += row.n;
    const tab = Object.keys(ORDER_TABS).find((k) => ORDER_TABS[k].includes(row.status));
    counts[tab] += row.n;
  }
  list.rows.forEach((r) => { r.status_label = ORDER_STATUS[r.status]; });
  return { ...list, counts, can_simulate: ctx.can('orders.write') };
});
route('GET', '/api/orders/export.csv', { perm: 'orders.read' }, (ctx) => {
  const { where, params } = orderFilters(ctx);
  const rows = all(`SELECT ${ORDER_SELECT} FROM orders o WHERE ${where.join(' AND ')} ORDER BY o.placed_at DESC LIMIT 5000`, ...params);
  logActivity(ctx, 'Exported orders', 'order', null, `${rows.length} rows`);
  return reply.csv('nearbuy-orders.csv', toCsv([['code', 'Order ID'], ['placed_at', 'Order date'], ['title', 'Product'], ['sku', 'Seller SKU'], ['qty', 'Quantity'], ['total', 'Total amount (INR)'], ['customer_ref', 'Customer reference'], ['ship_pincode', 'Delivery PIN code'], ['dispatch_by', 'Dispatch deadline'], [(r) => ORDER_STATUS[r.status], 'Order status'], ['payment_method', 'Payment method'], [(r) => (r.is_demo ? 'DEMO DATA' : ''), 'Record type']], rows));
});

const DEMO_CUSTOMERS = [
  ['Aarav Sharma', '9810045612', '14 Lodhi Estate', 'New Delhi', 'Delhi', '110003'], ['Ananya Verma', '9820178234', '5B Hill Road, Bandra West', 'Mumbai', 'Maharashtra', '400050'],
  ['Rohan Gupta', '9845012378', '221 12th Main, Indiranagar', 'Bengaluru', 'Karnataka', '560038'], ['Diya Singh', '9831099812', '8 Park Street', 'Kolkata', 'West Bengal', '700016'],
  ['Kabir Mehta', '9898076541', '32 CG Road, Navrangpura', 'Ahmedabad', 'Gujarat', '380009'], ['Ishita Jain', '9829034567', '17 MI Road', 'Jaipur', 'Rajasthan', '302001'],
  ['Vikram Nair', '9847023456', '9 MG Road, Ernakulam', 'Kochi', 'Kerala', '682016'], ['Meera Iyer', '9840067890', '45 TTK Road, Alwarpet', 'Chennai', 'Tamil Nadu', '600018'],
  ['Arjun Reddy', '9849011223', '6-3-1 Somajiguda', 'Hyderabad', 'Telangana', '500082'], ['Sneha Kulkarni', '9822045678', '12 FC Road, Shivajinagar', 'Pune', 'Maharashtra', '411005'],
  ['Farhan Qureshi', '9839012345', '27 Hazratganj', 'Lucknow', 'Uttar Pradesh', '226001'], ['Pooja Bansal', '9814056789', 'SCO 14, Sector 17', 'Chandigarh', 'Chandigarh', '160017'],
];
const demoCustomer = (n) => {
  const c = DEMO_CUSTOMERS[n % DEMO_CUSTOMERS.length];
  return { ref: `CUST-${String(4100 + (n % DEMO_CUSTOMERS.length) * 7).padStart(5, '0')}`, name: c[0], phone: c[1], address: c[2], city: c[3], state: c[4], pincode: c[5] };
};
route('POST', '/api/orders/simulate', { perm: 'orders.write' }, (ctx) => {
  const candidates = all(`SELECT i.id, (i.on_hand - i.reserved) AS available FROM inventory i JOIN products p ON p.id = i.product_id
    WHERE i.seller_id = ? AND p.status = 'active' AND (i.on_hand - i.reserved) > 0`, ctx.sellerId);
  if (!candidates.length) throw conflict('A test order needs at least one active listing with stock. Add or activate a product first.');
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  const qty = Math.min(pick.available, 1 + Math.floor(Math.random() * 2));
  const order = tx(() => createOrder(ctx.sellerId, { lines: [{ inventoryId: pick.id, qty }], customer: demoCustomer(Math.floor(Math.random() * 12)), paymentMethod: Math.random() < 0.3 ? 'Cash on delivery' : 'Prepaid', isDemo: true, applyPromotions: true }));
  logActivity(ctx, 'Created test order', 'order', order.code, 'DEMO DATA — simulated customer order');
  return reply.created({ code: order.code, message: `Test order ${order.code} created (DEMO DATA). Stock has been reserved.` });
});

route('GET', '/api/orders/:code', { perm: 'orders.read' }, (ctx) => ({ order: orderDetail(ctx, findOrder(ctx.sellerId, ctx.params.code)) }));
route('POST', '/api/orders/:code/actions', { perm: 'orders.write' }, (ctx) => {
  const action = String(ctx.body.action || '');
  const message = tx(() => applyOrderAction(ctx, findOrder(ctx.sellerId, ctx.params.code), action, ctx.body));
  return { ok: true, message, order: orderDetail(ctx, findOrder(ctx.sellerId, ctx.params.code)) };
});
route('POST', '/api/orders/bulk-action', { perm: 'orders.write' }, (ctx) => {
  const data = validate(ctx.body, { action: { required: true, enum: ['accept', 'process', 'pack'] }, codes: { type: 'array', of: 'string', min: 1, max: 50 } });
  const result = { done: 0, failed: [] };
  for (const code of data.codes) {
    try { tx(() => applyOrderAction(ctx, findOrder(ctx.sellerId, code), data.action, {})); result.done += 1; } catch (err) { if (!err.status) throw err; result.failed.push({ code, message: err.message }); }
  }
  return result;
});

/* ---------- Documents ---------- */
const inr = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '-');
function sellerHeader(sellerId) {
  const seller = get('SELECT * FROM sellers WHERE id = ?', sellerId);
  const profile = get('SELECT * FROM seller_business_profiles WHERE seller_id = ?', sellerId) || {};
  return { seller, profile };
}
route('GET', '/api/orders/:code/invoice.pdf', { perm: 'orders.read' }, (ctx) => {
  const order = findOrder(ctx.sellerId, ctx.params.code);
  if (order.status === 'new' || order.status === 'cancelled') throw conflict('An invoice is available after the order is accepted and before it is cancelled.');
  const detail = orderDetail(ctx, order);
  const { seller, profile } = sellerHeader(ctx.sellerId);
  const pdf = new Pdf();
  pdf.rect(0, 0, 595, 74, { fill: 0.11, stroke: null });
  pdf.text(40, 34, 'NearBuy', { size: 20, bold: true, color: 1 }).text(40, 54, 'Seller Hub - order invoice', { size: 10, color: 0.85 });
  pdf.text(555, 34, 'TAX INVOICE', { size: 14, bold: true, align: 'right', color: 1 }).text(555, 54, `Invoice no. INV-${order.code.replace('ORD-', '')}`, { size: 10, align: 'right', color: 0.85 });
  if (order.is_demo) pdf.text(297, 96, 'DEMO DATA - NOT A VALID TAX DOCUMENT', { size: 10, bold: true, align: 'center', color: 0.45 });
  let y = 122;
  pdf.text(40, y, 'Sold by', { size: 9, color: 0.45 }).text(320, y, 'Order details', { size: 9, color: 0.45 });
  y += 15;
  pdf.text(40, y, profile.legal_name || seller.business_name, { size: 11, bold: true }).text(320, y, `Order ID: ${order.code}`, { size: 10 });
  y += 14;
  const afterAddr = pdf.wrap(40, y, [profile.address, profile.city, profile.state, profile.pincode].filter(Boolean).join(', ') || 'Business address not provided', 240, { size: 9 });
  pdf.text(320, y, `Order date: ${fmtDate(order.placed_at)}`, { size: 10 });
  pdf.text(320, y + 14, `Invoice date: ${fmtDate(nowIso())}`, { size: 10 });
  pdf.text(320, y + 28, `Payment: ${order.payment_method}`, { size: 10 });
  pdf.text(40, afterAddr + 2, `GSTIN: ${profile.gstin || 'Not provided'}`, { size: 9 });
  y = Math.max(afterAddr + 26, y + 52);
  pdf.text(40, y, 'Ship to', { size: 9, color: 0.45 });
  y += 15;
  pdf.text(40, y, order.customer_name, { size: 11, bold: true });
  y = pdf.wrap(40, y + 14, `${order.ship_address}, ${order.ship_city}, ${order.ship_state} - ${order.ship_pincode}`, 300, { size: 9 }) + 12;
  pdf.rect(40, y, 515, 22, { fill: 0.94, stroke: null });
  const cols = [[46, 'Item', 'left'], [300, 'Qty', 'right'], [365, 'Unit price', 'right'], [435, 'Taxable', 'right'], [490, 'GST', 'right'], [549, 'Amount', 'right']];
  cols.forEach(([x, label, align]) => pdf.text(x, y + 15, label, { size: 9, bold: true, align }));
  y += 22;
  for (const item of detail.items) {
    const title = `${item.title}${item.variant_label ? ` (${item.variant_label})` : ''}`;
    const bottom = pdf.wrap(46, y + 15, title, 225, { size: 9 });
    pdf.text(46, bottom + 1, `SKU ${item.sku}`, { size: 8, color: 0.45 });
    pdf.text(300, y + 15, String(item.qty), { size: 9, align: 'right' }).text(365, y + 15, inr(item.unit_price), { size: 9, align: 'right' })
      .text(435, y + 15, inr(item.taxable_value), { size: 9, align: 'right' }).text(490, y + 15, `${item.gst_rate}%`, { size: 9, align: 'right' }).text(549, y + 15, inr(item.line_total), { size: 9, align: 'right' });
    y = bottom + 10;
    pdf.line(40, y, 555, y);
  }
  y += 18;
  const totals = [['Taxable value', inr(detail.tax.taxable_value)], ...(detail.tax.igst ? [['IGST', inr(detail.tax.igst)]] : [['CGST', inr(detail.tax.cgst)], ['SGST', inr(detail.tax.sgst)]]), ['Shipping charge', inr(order.shipping_charge)]];
  totals.forEach(([label, value]) => { pdf.text(435, y, label, { size: 10, align: 'right' }).text(549, y, value, { size: 10, align: 'right' }); y += 16; });
  pdf.line(360, y - 6, 555, y - 6, 1, 0.3);
  pdf.text(435, y + 10, 'Invoice total', { size: 12, bold: true, align: 'right' }).text(549, y + 10, inr(order.total), { size: 12, bold: true, align: 'right' });
  y += 44;
  pdf.text(40, y, detail.tax.basis, { size: 9, color: 0.35 });
  pdf.wrap(40, y + 16, 'Prices are inclusive of GST. This document is generated from order records in NearBuy Seller Hub. GST registration details are entered by the seller and have not been verified against the GST portal.', 515, { size: 8 });
  logActivity(ctx, 'Downloaded invoice', 'order', order.code);
  return reply.pdf(`invoice-${order.code}.pdf`, pdf.build());
});

route('GET', '/api/orders/:code/label.pdf', { perm: 'orders.read' }, (ctx) => {
  const order = findOrder(ctx.sellerId, ctx.params.code);
  const shipment = get('SELECT * FROM shipments WHERE order_id = ? AND seller_id = ?', order.id, ctx.sellerId);
  if (!shipment) throw conflict('Generate a shipment record before downloading the shipping label.');
  if (order.status === 'cancelled') throw conflict('This order is cancelled. No label is available.');
  const { seller, profile } = sellerHeader(ctx.sellerId);
  const pickup = get('SELECT * FROM seller_pickup_locations WHERE id = ? AND seller_id = ?', shipment.pickup_location_id, ctx.sellerId) || {};
  const items = orderItems(ctx.sellerId, order.id);
  const pdf = new Pdf({ width: 288, height: 432 }); // 4 x 6 inch label
  pdf.rect(8, 8, 272, 416, { stroke: 0, width: 1.2 });
  pdf.text(18, 30, 'NearBuy', { size: 15, bold: true }).text(270, 30, order.payment_method === 'Prepaid' ? 'PREPAID' : 'COD', { size: 13, bold: true, align: 'right' });
  if (order.payment_method !== 'Prepaid') pdf.text(270, 44, `Collect ${inr(order.total)}`, { size: 9, bold: true, align: 'right' });
  pdf.line(8, 52, 280, 52, 1, 0);
  pdf.text(18, 68, 'DELIVER TO', { size: 7, bold: true, color: 0.4 });
  pdf.text(18, 84, order.customer_name, { size: 12, bold: true });
  let y = pdf.wrap(18, 99, order.ship_address, 250, { size: 10 });
  pdf.text(18, y, `${order.ship_city}, ${order.ship_state}`, { size: 10 });
  pdf.text(18, y + 20, `PIN ${order.ship_pincode}`, { size: 16, bold: true });
  y += 34;
  pdf.line(8, y, 280, y, 1, 0);
  pdf.barcode(30, y + 12, shipment.code, { height: 44, module: 1.25 });
  pdf.text(144, y + 70, shipment.code, { size: 11, bold: true, align: 'center' });
  pdf.text(144, y + 82, 'Internal shipment reference - not a carrier AWB', { size: 6.5, align: 'center', color: 0.4 });
  y += 92;
  pdf.line(8, y, 280, y, 1, 0);
  pdf.text(18, y + 14, `Order ${order.code}`, { size: 9, bold: true }).text(270, y + 14, `${fmtDate(order.placed_at)}`, { size: 9, align: 'right' });
  pdf.text(18, y + 27, `Weight ${shipment.weight_g || '-'} g`, { size: 8 }).text(270, y + 27, latinDims(shipment.dimensions), { size: 8, align: 'right' });
  let iy = y + 42;
  for (const item of items.slice(0, 3)) { pdf.text(18, iy, `${item.qty} x ${item.title}`.slice(0, 52), { size: 8 }); pdf.text(18, iy + 9, `SKU ${item.sku}`, { size: 7, color: 0.4 }); iy += 21; }
  if (items.length > 3) pdf.text(18, iy, `+ ${items.length - 3} more item(s)`, { size: 8 });
  pdf.line(8, 356, 280, 356, 1, 0);
  pdf.text(18, 369, 'RETURN ADDRESS', { size: 7, bold: true, color: 0.4 });
  pdf.text(18, 381, seller.store_name, { size: 9, bold: true });
  pdf.wrap(18, 392, [pickup.address || profile.address, pickup.city || profile.city, pickup.state || profile.state, pickup.pincode || profile.pincode].filter(Boolean).join(', '), 250, { size: 8 });
  if (order.is_demo) pdf.text(144, 419, 'DEMO DATA', { size: 7, bold: true, align: 'center', color: 0.4 });
  run('UPDATE shipments SET label_generated_at = COALESCE(label_generated_at, ?) WHERE id = ?', nowIso(), shipment.id);
  logActivity(ctx, 'Downloaded shipping label', 'order', order.code, shipment.code);
  return reply.pdf(`label-${order.code}.pdf`, pdf.build());
});
function latinDims(d) { return d ? String(d) : ''; }

/* ---------- Shipping ---------- */
function shipmentView(sellerId, s, withOrder = true) {
  const view = {
    code: s.code, carrier: s.carrier, reference: s.reference, status: s.status, status_label: SHIPMENT_STATUS[s.status], weight_g: s.weight_g, dimensions: s.dimensions,
    label_generated_at: s.label_generated_at, dispatched_at: s.dispatched_at, delivered_at: s.delivered_at, created_at: s.created_at,
    pickup: (get('SELECT name, city, pincode FROM seller_pickup_locations WHERE id = ? AND seller_id = ?', s.pickup_location_id, sellerId) || null),
    timeline: all('SELECT status, title, note, actor, created_at FROM shipment_events WHERE shipment_id = ? AND seller_id = ? ORDER BY id', s.id, sellerId),
  };
  if (withOrder) {
    const o = get('SELECT code, status, ship_city, ship_state, ship_pincode, total, payment_method, is_demo FROM orders WHERE id = ? AND seller_id = ?', s.order_id, sellerId);
    view.order = { ...o, status_label: ORDER_STATUS[o.status], is_demo: Boolean(o.is_demo) };
  }
  return view;
}
const SHIP_TABS = { pending: ['pending_dispatch'], pickup: ['ready_for_pickup'], transit: ['in_transit'], delivered: ['delivered'], failed: ['failed_delivery'], returned: ['returned'] };
route('GET', '/api/shipping/overview', { perm: 'shipping.read' }, (ctx) => {
  const counts = { pending_dispatch: 0, ready_for_pickup: 0, in_transit: 0, delivered: 0, failed_delivery: 0, returned: 0 };
  for (const row of all('SELECT status, COUNT(*) AS n FROM shipments WHERE seller_id = ? GROUP BY status', ctx.sellerId)) counts[row.status] = row.n;
  const awaiting = get("SELECT COUNT(*) AS n FROM orders o WHERE o.seller_id = ? AND o.status IN ('new', 'pending_confirmation', 'processing', 'packed') ", ctx.sellerId).n;
  const overdue = get("SELECT COUNT(*) AS n FROM orders WHERE seller_id = ? AND dispatch_by < ? AND status IN ('new', 'pending_confirmation', 'processing', 'packed', 'ready_to_ship')", ctx.sellerId, nowIso()).n;
  return {
    counts, orders_awaiting_shipment: awaiting, overdue,
    pickup_locations: get('SELECT COUNT(*) AS n FROM seller_pickup_locations WHERE seller_id = ?', ctx.sellerId).n,
    recent: all('SELECT * FROM shipments WHERE seller_id = ? ORDER BY updated_at DESC LIMIT 6', ctx.sellerId).map((s) => shipmentView(ctx.sellerId, s)),
    integration: { carrier_connected: false, note: 'Carrier booking and live tracking need an authorised logistics integration. Shipment records and status updates here are entered by your team.' },
  };
});
route('GET', '/api/shipments', { perm: 'shipping.read' }, (ctx) => {
  const where = ['s.seller_id = ?'];
  const params = [ctx.sellerId];
  if (SHIP_TABS[ctx.query.tab]) { where.push(`s.status IN (${SHIP_TABS[ctx.query.tab].map(() => '?').join(',')})`); params.push(...SHIP_TABS[ctx.query.tab]); }
  if (ctx.query.tab === 'closed') where.push("s.status IN ('delivered', 'returned')");
  if (ctx.query.tab === 'open') where.push("s.status NOT IN ('delivered', 'returned')");
  if (ctx.query.labels === '1') where.push("o.status NOT IN ('cancelled')");
  const list = paged({
    select: 's.code, s.status, s.carrier, s.weight_g, s.dimensions, s.label_generated_at, s.dispatched_at, s.delivered_at, s.created_at, s.updated_at, o.code AS order_code, o.status AS order_status, o.ship_city, o.ship_pincode, o.dispatch_by, o.is_demo, (SELECT title FROM order_items WHERE order_id = o.id ORDER BY id LIMIT 1) AS title',
    from: 'shipments s JOIN orders o ON o.id = s.order_id', where, params, search: { q: ctx.query.q, cols: ['s.code', 'o.code', 'o.ship_pincode', 'o.ship_city'] },
    sortMap: { created: 's.created_at', updated: 's.updated_at' }, sort: ctx.query.sort, defaultSort: 's.updated_at DESC', page: ctx.query.page, pageSize: ctx.query.page_size,
  });
  list.rows.forEach((r) => { r.status_label = SHIPMENT_STATUS[r.status]; r.order_status_label = ORDER_STATUS[r.order_status]; });
  const counts = { all: 0, pending: 0, pickup: 0, transit: 0, delivered: 0, failed: 0, returned: 0 };
  for (const row of all('SELECT status, COUNT(*) AS n FROM shipments WHERE seller_id = ? GROUP BY status', ctx.sellerId)) { counts.all += row.n; counts[Object.keys(SHIP_TABS).find((k) => SHIP_TABS[k].includes(row.status))] += row.n; }
  return { ...list, counts };
});
route('GET', '/api/shipments/:code', { perm: 'shipping.read' }, (ctx) => {
  const s = get('SELECT * FROM shipments WHERE code = ? AND seller_id = ?', ctx.params.code, ctx.sellerId);
  if (!s) throw notFound('Shipment');
  const order = get('SELECT * FROM orders WHERE id = ?', s.order_id);
  return { shipment: shipmentView(ctx.sellerId, s), actions: allowedActions(order, s, ctx.can('orders.write')).filter((a) => ['ready', 'dispatch', 'deliver', 'fail', 'reattempt', 'rto'].includes(a.key)) };
});

/* ---------- Returns ---------- */
const RETURN_STATUS = { new: 'New request', under_review: 'Under review', approved: 'Approved', rejected: 'Rejected', received: 'Product received', completed: 'Completed' };
const REFUND_STATUS = { not_initiated: 'Not initiated', pending: 'Pending', recorded: 'Deducted in ledger' };
const RETURN_REASONS = ['Damaged in transit', 'Item not as described', 'Wrong item delivered', 'Size or fit issue', 'Defective or not working', 'Quality not as expected', 'No longer needed'];
const RETURN_TABS = { new: "r.status = 'new'", under_review: "r.status = 'under_review'", approved: "r.status IN ('approved', 'received')", rejected: "r.status = 'rejected'", refunds: "r.refund_status != 'not_initiated'", completed: "r.status = 'completed'" };
const RETURN_ACTIONS = {
  review: { from: ['new'], label: 'Start review' },
  approve: { from: ['new', 'under_review'], label: 'Approve request' },
  reject: { from: ['new', 'under_review'], label: 'Reject request', danger: true },
  receive: { from: ['approved'], label: 'Record received product' },
  refund: { from: ['received'], label: 'Record refund' },
};
function addReturnEvent(sellerId, returnId, action, title, note, actor, at) {
  insert('return_events', { seller_id: sellerId, return_id: returnId, action, title, note: note || null, actor: actor || 'System', created_at: at || nowIso() });
}
function createReturn(sellerId, { order, item, qty, reason, description, requestedAt, isDemo = true, quiet = false }) {
  const at = requestedAt || nowIso();
  const code = nextCode('RET', 4100);
  const id = insert('returns', { seller_id: sellerId, code, order_id: order.id, order_item_id: item.id, qty, reason, description: description || null, requested_at: at, updated_at: at, is_demo: isDemo ? 1 : 0 });
  addReturnEvent(sellerId, id, 'requested', 'Return requested', `${reason}${description ? ` — "${description}"` : ''}`, 'Customer', at);
  if (!quiet) notify(sellerId, 'return', `New return request ${code}`, `${item.title} · ${reason}`, `/seller/returns/${code}`);
  return get('SELECT * FROM returns WHERE id = ?', id);
}
function returnView(ctx, r, full) {
  const order = get('SELECT * FROM orders WHERE id = ? AND seller_id = ?', r.order_id, ctx.sellerId);
  const item = get(`SELECT oi.*, p.code AS product_code, (SELECT upload_id FROM product_images WHERE product_id = oi.product_id ORDER BY is_primary DESC, position LIMIT 1) AS image_id
    FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.id = ? AND oi.seller_id = ?`, r.order_item_id, ctx.sellerId) || {};
  const refund = get('SELECT * FROM refunds WHERE return_id = ? AND seller_id = ?', r.id, ctx.sellerId);
  const view = {
    code: r.code, order_code: order.code, product: item.title, variant_label: item.variant_label, sku: item.sku, product_code: item.product_code, image_id: item.image_id, qty: r.qty,
    reason: r.reason, description: r.description, status: r.status, status_label: RETURN_STATUS[r.status], refund_status: r.refund_status, refund_status_label: REFUND_STATUS[r.refund_status],
    refund_amount: refund ? refund.amount : r2((item.unit_price || 0) * r.qty), requested_at: r.requested_at, updated_at: r.updated_at, is_demo: Boolean(r.is_demo),
  };
  if (full) {
    view.reject_reason = r.reject_reason; view.condition_note = r.condition_note; view.restocked = Boolean(r.restocked);
    view.refund = refund ? { code: refund.code, amount: refund.amount, status: refund.status, created_at: refund.created_at, recorded_at: refund.recorded_at } : null;
    view.order = { code: order.code, placed_at: order.placed_at, delivered_at: order.delivered_at, total: order.total, payment_method: order.payment_method, customer_ref: order.customer_ref, pincode: order.ship_pincode };
    view.history = all('SELECT action, title, note, actor, created_at FROM return_events WHERE return_id = ? AND seller_id = ? ORDER BY id', r.id, ctx.sellerId);
    view.actions = ctx.can('returns.write') ? Object.entries(RETURN_ACTIONS).filter(([, def]) => def.from.includes(r.status)).map(([key, def]) => ({ key, label: def.label, danger: def.danger })) : [];
  }
  return view;
}
function applyReturnAction(ctx, r, action, body) {
  const def = RETURN_ACTIONS[action];
  if (!def) throw bad('Unknown return action.');
  if (!def.from.includes(r.status)) throw conflict(`"${def.label}" is not allowed while the return is ${RETURN_STATUS[r.status]}.`);
  const actor = ctx.user.name;
  const order = get('SELECT * FROM orders WHERE id = ? AND seller_id = ?', r.order_id, ctx.sellerId);
  const item = get('SELECT * FROM order_items WHERE id = ? AND seller_id = ?', r.order_item_id, ctx.sellerId);
  const set = (patch) => run(`UPDATE returns SET ${Object.keys(patch).map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ? AND seller_id = ?`, ...Object.values(patch), nowIso(), r.id, ctx.sellerId);
  let message;
  if (action === 'review') {
    set({ status: 'under_review' });
    addReturnEvent(ctx.sellerId, r.id, 'review', 'Review started', validate(body, { note: { max: 300 } }).note, actor);
    message = 'Return moved to Under review.';
  } else if (action === 'approve') {
    const note = validate(body, { note: { max: 300 } }).note;
    const amount = r2(item.unit_price * r.qty);
    set({ status: 'approved', refund_status: 'pending' });
    insert('refunds', { seller_id: ctx.sellerId, code: nextCode('RFD', 3000), return_id: r.id, order_id: order.id, amount, status: 'pending', created_at: nowIso() });
    addReturnEvent(ctx.sellerId, r.id, 'approve', 'Return approved', note || `Refund of ₹${amount.toLocaleString('en-IN')} is pending until the product is received.`, actor);
    message = 'Return approved. Record the product when it arrives.';
  } else if (action === 'reject') {
    const data = validate(body, { reason: { required: true, min: 10, max: 400, label: 'Rejection reason' } });
    set({ status: 'rejected', reject_reason: data.reason });
    addReturnEvent(ctx.sellerId, r.id, 'reject', 'Return rejected', data.reason, actor);
    message = 'Return rejected.';
  } else if (action === 'receive') {
    const data = validate(body, { condition: { required: true, enum: ['Sellable — restock', 'Damaged — do not restock', 'Used — do not restock'], label: 'Condition' }, note: { max: 300 } });
    const restock = data.condition.startsWith('Sellable');
    if (restock && item.inventory_id && get('SELECT 1 FROM inventory WHERE id = ? AND seller_id = ?', item.inventory_id, ctx.sellerId)) {
      moveStock(ctx.sellerId, item.inventory_id, { onHandDelta: r.qty, kind: 'return', reason: 'Customer return restocked', ref: r.code, actor, quiet: true });
    }
    set({ status: 'received', condition_note: data.note ? `${data.condition} — ${data.note}` : data.condition, restocked: restock ? 1 : 0 });
    addReturnEvent(ctx.sellerId, r.id, 'receive', 'Product received', `${data.condition}${restock ? ` · ${r.qty} unit(s) added back to stock` : ''}${data.note ? ` · ${data.note}` : ''}`, actor);
    message = restock ? 'Product received and added back to stock.' : 'Product received. Stock was not changed.';
  } else if (action === 'refund') {
    const refund = get('SELECT * FROM refunds WHERE return_id = ? AND seller_id = ?', r.id, ctx.sellerId);
    run("UPDATE refunds SET status = 'recorded', recorded_at = ? WHERE id = ?", nowIso(), refund.id);
    recordRefund(ctx.sellerId, order, r, refund.amount);
    set({ status: 'completed', refund_status: 'recorded' });
    addReturnEvent(ctx.sellerId, r.id, 'refund', 'Refund deducted in ledger', `₹${refund.amount.toLocaleString('en-IN')} recorded as a refund deduction. Paying the customer requires a payment-gateway integration.`, actor);
    addReturnEvent(ctx.sellerId, r.id, 'complete', 'Return completed', null, 'System');
    message = 'Refund deduction recorded in your ledger and the return is complete. No money was moved — a payment gateway is not connected.';
  }
  logActivity(ctx, `Return: ${def.label}`, 'return', r.code);
  return message;
}
route('GET', '/api/returns', { perm: 'returns.read' }, (ctx) => {
  const where = ['r.seller_id = ?'];
  const params = [ctx.sellerId];
  if (RETURN_TABS[ctx.query.tab]) where.push(RETURN_TABS[ctx.query.tab]);
  const list = paged({
    select: 'r.*', from: 'returns r JOIN orders o ON o.id = r.order_id LEFT JOIN order_items oi ON oi.id = r.order_item_id', where, params,
    search: { q: ctx.query.q, cols: ['r.code', 'o.code', 'oi.title', 'r.reason'] }, sortMap: { requested: 'r.requested_at', updated: 'r.updated_at' },
    sort: ctx.query.sort, defaultSort: 'r.requested_at DESC', page: ctx.query.page, pageSize: ctx.query.page_size,
  });
  const counts = { all: get('SELECT COUNT(*) AS n FROM returns WHERE seller_id = ?', ctx.sellerId).n };
  for (const [key, sql] of Object.entries(RETURN_TABS)) counts[key] = get(`SELECT COUNT(*) AS n FROM returns r WHERE r.seller_id = ? AND ${sql}`, ctx.sellerId).n;
  return { ...list, rows: list.rows.map((r) => returnView(ctx, r, false)), counts, can_simulate: ctx.can('returns.write') };
});
route('POST', '/api/returns/simulate', { perm: 'returns.write' }, (ctx) => {
  const order = get(`SELECT o.* FROM orders o WHERE o.seller_id = ? AND o.status = 'delivered' AND NOT EXISTS (SELECT 1 FROM returns r WHERE r.order_id = o.id) ORDER BY RANDOM() LIMIT 1`, ctx.sellerId);
  if (!order) throw conflict('A test return needs a delivered order that has no return yet. Deliver an order first.');
  const item = get('SELECT * FROM order_items WHERE order_id = ? ORDER BY id LIMIT 1', order.id);
  const reason = RETURN_REASONS[Math.floor(Math.random() * RETURN_REASONS.length)];
  const ret = tx(() => createReturn(ctx.sellerId, { order, item, qty: 1, reason, description: 'Simulated customer request for testing the returns workflow.', isDemo: true }));
  logActivity(ctx, 'Created test return', 'return', ret.code, 'DEMO DATA — simulated return request');
  return reply.created({ code: ret.code, message: `Test return ${ret.code} created (DEMO DATA).` });
});
route('GET', '/api/returns/:code', { perm: 'returns.read' }, (ctx) => {
  const r = get('SELECT * FROM returns WHERE code = ? AND seller_id = ?', ctx.params.code, ctx.sellerId);
  if (!r) throw notFound('Return');
  return { return: returnView(ctx, r, true) };
});
route('POST', '/api/returns/:code/actions', { perm: 'returns.write' }, (ctx) => {
  const find = () => { const r = get('SELECT * FROM returns WHERE code = ? AND seller_id = ?', ctx.params.code, ctx.sellerId); if (!r) throw notFound('Return'); return r; };
  const message = tx(() => applyReturnAction(ctx, find(), String(ctx.body.action || ''), ctx.body));
  return { ok: true, message, return: returnView(ctx, find(), true) };
});

module.exports = { createOrder, createReturn, applyOrderAction, applyReturnAction, createShipment, demoCustomer, ORDER_STATUS, ORDER_TABS, RETURN_STATUS, RETURN_REASONS, SHIPMENT_STATUS, addOrderEvent, addShipmentEvent, addReturnEvent };
