'use strict';
// Single place where stock levels change, so every movement is validated, recorded and checked against thresholds.
const { get, run, insert, notify } = require('./db');
const { conflict, nowIso } = require('./lib');

const STOCK_STATUS_SQL = `CASE WHEN (i.on_hand - i.reserved) <= 0 THEN 'out_of_stock'
  WHEN (i.on_hand - i.reserved) * 2 <= i.safety_stock THEN 'critical'
  WHEN (i.on_hand - i.reserved) <= i.safety_stock THEN 'low' ELSE 'healthy' END`;

function stockStatus(available, safety) {
  if (available <= 0) return 'out_of_stock';
  if (available * 2 <= safety) return 'critical';
  if (available <= safety) return 'low';
  return 'healthy';
}

/**
 * Apply a stock movement to one inventory row owned by sellerId.
 * kind: adjustment | import | reserve | release | dispatch | return | initial
 */
function moveStock(sellerId, inventoryId, { onHandDelta = 0, reservedDelta = 0, kind, reason, ref, actor, quiet = false }) {
  const row = get('SELECT i.*, p.title, p.code AS product_code FROM inventory i JOIN products p ON p.id = i.product_id WHERE i.id = ? AND i.seller_id = ?', inventoryId, sellerId);
  if (!row) return null;
  const onHand = row.on_hand + onHandDelta;
  const reserved = row.reserved + reservedDelta;
  if (onHand < 0 || reserved < 0) throw conflict(`Stock for ${row.sku} cannot go below zero.`);
  if (reserved > onHand) throw conflict(`Only ${row.on_hand - row.reserved} unit(s) of ${row.sku} are available. ${row.reserved} unit(s) are reserved for open orders.`);
  if (!onHandDelta && !reservedDelta && kind !== 'initial') return row;
  run('UPDATE inventory SET on_hand = ?, reserved = ?, updated_at = ? WHERE id = ?', onHand, reserved, nowIso(), row.id);
  insert('stock_movements', {
    seller_id: sellerId, inventory_id: row.id, kind, change: kind === 'reserve' || kind === 'release' ? reservedDelta : onHandDelta,
    on_hand_after: onHand, reserved_after: reserved, reason: reason || null, ref: ref || null, actor: actor || 'System', created_at: nowIso(),
  });
  const before = stockStatus(row.on_hand - row.reserved, row.safety_stock);
  const after = stockStatus(onHand - reserved, row.safety_stock);
  const rank = { healthy: 0, low: 1, critical: 2, out_of_stock: 3 };
  if (!quiet && rank[after] > rank[before]) {
    const label = { low: 'Low stock', critical: 'Critically low stock', out_of_stock: 'Out of stock' }[after];
    notify(sellerId, 'inventory', `${label}: ${row.title}`, `${row.sku} has ${Math.max(0, onHand - reserved)} unit(s) available (safety stock ${row.safety_stock}).`, `/seller/inventory?q=${encodeURIComponent(row.sku)}`);
  }
  return { ...row, on_hand: onHand, reserved };
}

module.exports = { moveStock, stockStatus, STOCK_STATUS_SQL };
