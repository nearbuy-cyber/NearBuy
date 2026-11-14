'use strict';
// Ledger entries created by order and return events. Settlement totals are always derived from these rows.
const { all, insert, nextCode } = require('./db');
const { r2, nowIso, COMMISSION_RATE } = require('./lib');

const FIXED_FEE = 10; // closing fee per order (illustrative schedule)
const FEE_GST = 0.18;

function shippingFee(weightGrams) {
  const slabs = Math.max(1, Math.ceil((weightGrams || 500) / 500));
  return 45 + (slabs - 1) * 15;
}
function addTransaction(sellerId, row) {
  return insert('transactions', { seller_id: sellerId, code: nextCode('TXN', 900000), created_at: nowIso(), ...row });
}
/** Estimate fees for an order (also used for previews before delivery). */
function feeBreakdown(sellerId, order) {
  const items = all(`SELECT oi.*, p.package FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ? AND oi.seller_id = ?`, order.id, sellerId);
  let commission = 0;
  let weight = 0;
  for (const item of items) {
    commission += item.line_total * (COMMISSION_RATE[item.category] || 0.1);
    let pkg = {};
    try { pkg = JSON.parse(item.package || '{}'); } catch { /* ignore */ }
    weight += (pkg.weight_g || 500) * item.qty;
  }
  const platform = r2(commission + FIXED_FEE);
  const shipping = r2(shippingFee(weight));
  const tax = r2((platform + shipping) * FEE_GST);
  return { gross: r2(order.total), platform_fee: platform, shipping_fee: shipping, tax, net: r2(order.total - platform - shipping - tax) };
}
function recordSale(sellerId, order, at) {
  const f = feeBreakdown(sellerId, order);
  const common = { order_id: order.id, order_ref: order.code, is_demo: order.is_demo, created_at: at || nowIso() };
  addTransaction(sellerId, { ...common, type: 'sale', amount: f.gross, description: `Sale proceeds for ${order.code}` });
  addTransaction(sellerId, { ...common, type: 'platform_fee', amount: -f.platform_fee, description: `Commission and closing fee for ${order.code}` });
  addTransaction(sellerId, { ...common, type: 'shipping_fee', amount: -f.shipping_fee, description: `Shipping fee for ${order.code}` });
  addTransaction(sellerId, { ...common, type: 'tax', amount: -f.tax, description: `GST @18% on marketplace fees for ${order.code}` });
  return f;
}
function recordRefund(sellerId, order, ret, amount, at) {
  addTransaction(sellerId, { order_id: order.id, return_id: ret.id, order_ref: order.code, is_demo: order.is_demo, created_at: at || nowIso(), type: 'refund', amount: -r2(amount), description: `Refund deduction for return ${ret.code}` });
}
module.exports = { recordSale, recordRefund, feeBreakdown, addTransaction, FIXED_FEE, FEE_GST };
