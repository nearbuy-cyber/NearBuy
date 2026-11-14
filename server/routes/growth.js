'use strict';
// Dashboard, analytics reports, growth insights, promotions and advertising campaigns.
const { route, reply } = require('../router');
const { get, all, run, tx, insert, nextCode, parseJson, paged, logActivity } = require('../db');
const { bad, notFound, conflict, nowIso, r2, validate, toCsv, resolveRange, istDate, addDays, isYmd, CATEGORIES } = require('../lib');
const { STOCK_STATUS_SQL } = require('../stock');
const { totals: ledgerTotals, upcomingPayout } = require('./finance');
const { inventorySummary } = require('./catalog');
const { ORDER_STATUS, RETURN_STATUS } = require('./orders');
const { SELLER_STATUS } = require('./account');

const OPEN_ORDER = "('new', 'pending_confirmation', 'processing', 'packed', 'ready_to_ship')";
const pct = (cur, prev) => (prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDay = (ymd) => `${Number(ymd.slice(8, 10))} ${MONTHS[Number(ymd.slice(5, 7)) - 1]}`;

/* ---------- Time buckets ---------- */
function bucketPlan(range) {
  if (range.days === 1) return { mode: 'hour', n: 24, labels: Array.from({ length: 24 }, (_, h) => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`) };
  if (range.days <= 31) return { mode: 'day', n: range.days, labels: Array.from({ length: range.days }, (_, i) => shortDay(addDays(range.from, i))) };
  const n = Math.ceil(range.days / 7);
  return { mode: 'week', n, labels: Array.from({ length: n }, (_, i) => `w/c ${shortDay(addDays(range.from, i * 7))}`) };
}
function bucketExpr(col, plan, fromYmd) {
  if (!isYmd(fromYmd)) throw bad('Invalid date range.');
  if (plan.mode === 'hour') return `CAST(strftime('%H', ${col}, '+330 minutes') AS INTEGER)`;
  const days = `(julianday(date(${col}, '+330 minutes')) - julianday('${fromYmd}'))`;
  return plan.mode === 'day' ? `CAST(${days} AS INTEGER)` : `CAST(${days} / 7 AS INTEGER)`;
}
function fill(rows, n, key) {
  const out = new Array(n).fill(0);
  for (const row of rows) if (row.b >= 0 && row.b < n) out[row.b] = r2(row[key] || 0);
  return out;
}
function orderSeries(sellerId, plan, fromYmd, fromIso, toIso) {
  const rows = all(`SELECT ${bucketExpr('placed_at', plan, fromYmd)} AS b, COUNT(*) AS orders, SUM(total) AS sales FROM orders
    WHERE seller_id = ? AND status != 'cancelled' AND placed_at BETWEEN ? AND ? GROUP BY b`, sellerId, fromIso, toIso);
  return { sales: fill(rows, plan.n, 'sales'), orders: fill(rows, plan.n, 'orders') };
}
function orderTotals(sellerId, fromIso, toIso) {
  const o = get("SELECT COUNT(*) AS orders, COALESCE(SUM(total), 0) AS sales FROM orders WHERE seller_id = ? AND status != 'cancelled' AND placed_at BETWEEN ? AND ?", sellerId, fromIso, toIso);
  const units = get("SELECT COALESCE(SUM(oi.qty), 0) AS units FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.seller_id = ? AND o.status != 'cancelled' AND o.placed_at BETWEEN ? AND ?", sellerId, fromIso, toIso).units;
  return { orders: o.orders, sales: r2(o.sales), units, aov: o.orders ? r2(o.sales / o.orders) : 0 };
}
const topProducts = (sellerId, fromIso, toIso, limit = 50) => all(`SELECT p.code, oi.title, oi.category, SUM(oi.qty) AS units, SUM(oi.line_total) AS revenue, COUNT(DISTINCT oi.order_id) AS orders,
    (SELECT upload_id FROM product_images WHERE product_id = oi.product_id ORDER BY is_primary DESC, position LIMIT 1) AS image_id,
    (SELECT COUNT(*) FROM returns r JOIN order_items x ON x.id = r.order_item_id WHERE x.product_id = oi.product_id AND r.seller_id = oi.seller_id AND r.requested_at BETWEEN ? AND ?) AS returns
  FROM order_items oi JOIN orders o ON o.id = oi.order_id LEFT JOIN products p ON p.id = oi.product_id
  WHERE oi.seller_id = ? AND o.status != 'cancelled' AND o.placed_at BETWEEN ? AND ? GROUP BY oi.product_id, oi.title ORDER BY revenue DESC LIMIT ?`, fromIso, toIso, sellerId, fromIso, toIso, limit)
  .map((r) => ({ ...r, revenue: r2(r.revenue) }));
const categorySales = (sellerId, fromIso, toIso) => all(`SELECT COALESCE(oi.category, 'Uncategorised') AS category, SUM(oi.qty) AS units, SUM(oi.line_total) AS revenue, COUNT(DISTINCT oi.order_id) AS orders
  FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.seller_id = ? AND o.status != 'cancelled' AND o.placed_at BETWEEN ? AND ? GROUP BY category ORDER BY revenue DESC`, sellerId, fromIso, toIso)
  .map((r) => ({ ...r, revenue: r2(r.revenue) }));
const hasDemo = (sellerId) => Boolean(get('SELECT has_demo_data FROM sellers WHERE id = ?', sellerId).has_demo_data);

/* ---------- Dashboard ---------- */
route('GET', '/api/dashboard', (ctx) => {
  const id = ctx.sellerId;
  const seller = ctx.seller;
  const can = ctx.can;
  const today = resolveRange({ range: 'today' });
  const range = resolveRange({ range: '30d' });
  const out = {
    seller: { store_name: seller.store_name, status: seller.status, status_label: SELLER_STATUS[seller.status], code: seller.code },
    user_name: ctx.user.name, today: istDate(), has_demo: hasDemo(id), can: {}, kpis: {}, actions: [],
  };
  for (const p of ['products.read', 'products.write', 'inventory.read', 'inventory.write', 'orders.read', 'orders.write', 'returns.read', 'payments.read', 'growth.write', 'analytics.read', 'settings.manage']) out.can[p] = can(p);
  const showSales = can('orders.read') || can('analytics.read') || can('payments.read');

  if (showSales) {
    const allTime = get("SELECT COUNT(*) AS orders, COALESCE(SUM(total), 0) AS sales FROM orders WHERE seller_id = ? AND status != 'cancelled'", id);
    const t = orderTotals(id, today.fromIso, today.toIso);
    const y = orderTotals(id, today.prevFromIso, today.prevToIso);
    const cur = orderTotals(id, range.fromIso, range.toIso);
    const prev = orderTotals(id, range.prevFromIso, range.prevToIso);
    out.kpis.total_sales = { value: r2(allTime.sales), hint: `${cur.sales ? `₹${Math.round(cur.sales).toLocaleString('en-IN')} in the last 30 days` : 'No sales in the last 30 days'}`, delta: pct(cur.sales, prev.sales) };
    out.kpis.today_sales = { value: t.sales, hint: `${t.orders} order${t.orders === 1 ? '' : 's'} today`, delta: pct(t.sales, y.sales) };
    out.kpis.total_orders = { value: allTime.orders, hint: `${cur.orders} in the last 30 days`, delta: pct(cur.orders, prev.orders) };
    out.kpis.pending_orders = { value: get(`SELECT COUNT(*) AS n FROM orders WHERE seller_id = ? AND status IN ${OPEN_ORDER}`, id).n, hint: 'Not yet dispatched' };
    const plan = bucketPlan(range);
    const series = orderSeries(id, plan, range.from, range.fromIso, range.toIso);
    const prevSeries = orderSeries(id, plan, range.prevFrom, range.prevFromIso, range.prevToIso);
    out.sales_chart = { labels: plan.labels, sales: series.sales, previous: prevSeries.sales, orders: series.orders };
    out.top_products = topProducts(id, range.fromIso, range.toIso, 5);
    out.categories = categorySales(id, range.fromIso, range.toIso).slice(0, 6);
    out.recent_orders = all(`SELECT o.code, o.placed_at, o.status, o.total, o.is_demo, (SELECT title FROM order_items WHERE order_id = o.id ORDER BY id LIMIT 1) AS title FROM orders o WHERE o.seller_id = ? ORDER BY o.placed_at DESC LIMIT 6`, id)
      .map((o) => ({ ...o, status_label: ORDER_STATUS[o.status] }));
  }
  if (can('products.read')) {
    const p = get("SELECT COUNT(*) AS listed, SUM(status = 'active') AS active, SUM(status IN ('qc_failed', 'rejected')) AS correction, SUM(status = 'pending_approval') AS pending FROM products WHERE seller_id = ?", id);
    out.kpis.products_listed = { value: p.listed, hint: `${p.pending || 0} awaiting approval` };
    out.kpis.active_listings = { value: p.active || 0, hint: p.listed ? `${Math.round(((p.active || 0) / p.listed) * 100)}% of catalogue live` : 'No listings yet' };
    if (p.correction) out.actions.push({ key: 'listings', tone: 'danger', count: p.correction, title: 'Listings requiring correction', detail: 'Failed the quality check or were rejected.', link: '/seller/products?tab=qc_failed', cta: 'Fix listings' });
    if (p.pending) out.actions.push({ key: 'approval', tone: 'info', count: p.pending, title: 'Products not yet approved', detail: 'Submitted and waiting for catalogue review.', link: '/seller/products?tab=pending_approval', cta: 'View pending' });
  }
  if (can('returns.read')) {
    const r = get("SELECT COUNT(*) AS total, SUM(status IN ('new', 'under_review')) AS open FROM returns WHERE seller_id = ?", id);
    out.kpis.return_requests = { value: r.open || 0, hint: `${r.total} in total` };
    if (r.open) out.actions.push({ key: 'returns', tone: 'warning', count: r.open, title: 'Return requests awaiting response', detail: 'Review and approve or reject each request.', link: '/seller/returns?tab=new', cta: 'Review returns' });
  }
  if (can('payments.read')) {
    const up = upcomingPayout(id);
    out.kpis.pending_settlements = { value: up.total, hint: up.awaiting_count ? `${up.awaiting_count} statement${up.awaiting_count === 1 ? '' : 's'} awaiting payout` : 'Unsettled ledger balance' };
    out.payments = { ...ledgerTotals(id, range.fromIso, range.toIso), upcoming: up.total };
    const weeks = resolveRange({ range: 'custom', from: addDays(istDate(), -55), to: istDate() });
    const plan = bucketPlan(weeks);
    const rows = all(`SELECT ${bucketExpr('created_at', plan, weeks.from)} AS b, SUM(CASE WHEN type = 'sale' THEN amount ELSE 0 END) AS gross, SUM(amount) AS net FROM transactions WHERE seller_id = ? AND created_at BETWEEN ? AND ? GROUP BY b`, id, weeks.fromIso, weeks.toIso);
    out.revenue_trend = { labels: plan.labels, gross: fill(rows, plan.n, 'gross'), net: fill(rows, plan.n, 'net') };
    const bank = get('SELECT verification_status FROM seller_bank_accounts WHERE seller_id = ?', id);
    if (!bank) out.actions.push({ key: 'payments', tone: 'danger', count: 1, title: 'Payments requiring attention', detail: 'Add a bank account so settlements can be paid out.', link: '/seller/payments/bank-account', cta: 'Add bank account' });
    else if (up.awaiting_count) out.actions.push({ key: 'payments', tone: 'warning', count: up.awaiting_count, title: 'Payments requiring attention', detail: 'Settlement statements are awaiting payout.', link: '/seller/payments/settlements', cta: 'View settlements' });
  }
  if (can('inventory.read')) {
    out.inventory = inventorySummary(id);
    if (out.inventory.low + out.inventory.out_of_stock) out.actions.push({ key: 'stock', tone: 'warning', count: out.inventory.low + out.inventory.out_of_stock, title: 'Products with low stock', detail: `${out.inventory.out_of_stock} out of stock, ${out.inventory.low} running low.`, link: '/seller/inventory?status=attention', cta: 'Update inventory' });
  }
  if (can('orders.read')) {
    const waiting = get("SELECT COUNT(*) AS n FROM orders WHERE seller_id = ? AND status IN ('new', 'pending_confirmation')", id).n;
    const overdue = get(`SELECT COUNT(*) AS n FROM orders WHERE seller_id = ? AND dispatch_by < ? AND status IN ${OPEN_ORDER}`, id, nowIso()).n;
    if (waiting) out.actions.unshift({ key: 'orders', tone: overdue ? 'danger' : 'info', count: waiting, title: 'Orders waiting for processing', detail: overdue ? `${overdue} order${overdue === 1 ? ' is' : 's are'} past the dispatch deadline.` : 'Accept and start processing new orders.', link: '/seller/orders?tab=new', cta: 'Process orders' });
  }
  return out;
});

/* ---------- Analytics reports ---------- */
const REPORTS = {
  sales(id, range) {
    const plan = bucketPlan(range);
    const cur = orderTotals(id, range.fromIso, range.toIso);
    const prev = orderTotals(id, range.prevFromIso, range.prevToIso);
    const s = orderSeries(id, plan, range.from, range.fromIso, range.toIso);
    const p = orderSeries(id, plan, range.prevFrom, range.prevFromIso, range.prevToIso);
    return {
      title: 'Sales analytics', subtitle: 'Order value of all non-cancelled orders, by order date.',
      kpis: [
        { label: 'Sales', value: cur.sales, format: 'inr', delta: pct(cur.sales, prev.sales) }, { label: 'Orders', value: cur.orders, format: 'num', delta: pct(cur.orders, prev.orders) },
        { label: 'Units sold', value: cur.units, format: 'num', delta: pct(cur.units, prev.units) }, { label: 'Average order value', value: cur.aov, format: 'inr', delta: pct(cur.aov, prev.aov) },
      ],
      charts: [
        { type: 'line', span: 2, title: 'Sales comparison', note: 'Current period against the previous period of the same length.', labels: plan.labels, series: [{ name: range.label, data: s.sales, format: 'inr' }, { name: 'Previous period', data: p.sales, format: 'inr', muted: true }] },
        { type: 'bar', span: 2, title: 'Orders', labels: plan.labels, series: [{ name: 'Orders', data: s.orders, format: 'num' }] },
      ],
      table: { title: plan.mode === 'hour' ? 'Hourly breakdown' : plan.mode === 'day' ? 'Daily breakdown' : 'Weekly breakdown', columns: [{ key: 'period', label: 'Period' }, { key: 'orders', label: 'Orders', format: 'num', align: 'right' }, { key: 'sales', label: 'Sales', format: 'inr', align: 'right' }, { key: 'previous', label: 'Previous period', format: 'inr', align: 'right' }],
        rows: plan.labels.map((label, i) => ({ period: label, orders: s.orders[i], sales: s.sales[i], previous: p.sales[i] })) },
    };
  },
  revenue(id, range) {
    const plan = bucketPlan(range);
    const cur = ledgerTotals(id, range.fromIso, range.toIso);
    const prev = ledgerTotals(id, range.prevFromIso, range.prevToIso);
    const rows = all(`SELECT ${bucketExpr('created_at', plan, range.from)} AS b, SUM(CASE WHEN type = 'sale' THEN amount ELSE 0 END) AS gross,
      SUM(CASE WHEN type IN ('platform_fee', 'shipping_fee', 'tax') THEN -amount ELSE 0 END) AS fees, SUM(CASE WHEN type = 'refund' THEN -amount ELSE 0 END) AS refunds, SUM(amount) AS net
      FROM transactions WHERE seller_id = ? AND created_at BETWEEN ? AND ? GROUP BY b`, id, range.fromIso, range.toIso);
    const gross = fill(rows, plan.n, 'gross'); const fees = fill(rows, plan.n, 'fees'); const refunds = fill(rows, plan.n, 'refunds'); const net = fill(rows, plan.n, 'net');
    const feeTotal = r2(cur.platform_fees + cur.shipping_charges + cur.taxes_and_deductions);
    return {
      title: 'Revenue analytics', subtitle: 'Ledger view: sale proceeds of delivered orders less marketplace fees and refunds, by ledger date.',
      kpis: [
        { label: 'Sale proceeds', value: cur.total_sales, format: 'inr', delta: pct(cur.total_sales, prev.total_sales) }, { label: 'Fees and tax on fees', value: feeTotal, format: 'inr', hint: cur.total_sales ? `${Math.round((feeTotal / cur.total_sales) * 100)}% of proceeds` : '' },
        { label: 'Refund deductions', value: cur.refund_deductions, format: 'inr' }, { label: 'Net revenue', value: cur.net_settlement, format: 'inr', delta: pct(cur.net_settlement, prev.net_settlement) },
      ],
      charts: [
        { type: 'line', span: 2, title: 'Revenue trend', labels: plan.labels, series: [{ name: 'Sale proceeds', data: gross, format: 'inr' }, { name: 'Net revenue', data: net, format: 'inr', tone: 'green' }] },
        { type: 'donut', title: 'Where sale proceeds go', labels: ['Net revenue', 'Platform fees', 'Shipping charges', 'Tax on fees', 'Refunds'], series: [{ name: 'Amount', format: 'inr', data: [Math.max(cur.net_settlement, 0), cur.platform_fees, cur.shipping_charges, cur.taxes_and_deductions, cur.refund_deductions] }] },
        { type: 'bar', title: 'Fees and refunds', labels: plan.labels, series: [{ name: 'Fees', data: fees, format: 'inr', tone: 'amber' }, { name: 'Refunds', data: refunds, format: 'inr', tone: 'red' }] },
      ],
      table: { title: 'Ledger by period', columns: [{ key: 'period', label: 'Period' }, { key: 'gross', label: 'Sale proceeds', format: 'inr', align: 'right' }, { key: 'fees', label: 'Fees', format: 'inr', align: 'right' }, { key: 'refunds', label: 'Refunds', format: 'inr', align: 'right' }, { key: 'net', label: 'Net revenue', format: 'inr', align: 'right' }],
        rows: plan.labels.map((label, i) => ({ period: label, gross: gross[i], fees: fees[i], refunds: refunds[i], net: net[i] })) },
    };
  },
  products(id, range) {
    const rows = topProducts(id, range.fromIso, range.toIso, 100);
    const top = rows.slice(0, 8);
    const noSales = get(`SELECT COUNT(*) AS n FROM products p WHERE p.seller_id = ? AND p.status = 'active' AND NOT EXISTS (SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.product_id = p.id AND o.status != 'cancelled' AND o.placed_at BETWEEN ? AND ?)`, id, range.fromIso, range.toIso).n;
    return {
      title: 'Product performance', subtitle: 'Ranking of products by revenue from non-cancelled orders.',
      kpis: [{ label: 'Products sold', value: rows.length, format: 'num' }, { label: 'Units sold', value: rows.reduce((a, r) => a + r.units, 0), format: 'num' }, { label: 'Best seller revenue', value: top[0] ? top[0].revenue : 0, format: 'inr', hint: top[0] ? top[0].title : 'No sales yet' }, { label: 'Active listings without sales', value: noSales, format: 'num' }],
      charts: [{ type: 'hbar', span: 2, title: 'Top products by revenue', labels: top.map((r) => r.title), series: [{ name: 'Revenue', data: top.map((r) => r.revenue), format: 'inr' }] }],
      table: { title: 'Product rankings', columns: [{ key: 'rank', label: '#', align: 'right' }, { key: 'title', label: 'Product', link: 'product' }, { key: 'category', label: 'Category' }, { key: 'orders', label: 'Orders', format: 'num', align: 'right' }, { key: 'units', label: 'Units', format: 'num', align: 'right' }, { key: 'revenue', label: 'Revenue', format: 'inr', align: 'right' }, { key: 'returns', label: 'Returns', format: 'num', align: 'right' }],
        rows: rows.map((r, i) => ({ rank: i + 1, title: r.title, code: r.code, category: r.category, orders: r.orders, units: r.units, revenue: r.revenue, returns: r.returns })) },
    };
  },
  categories(id, range) {
    const rows = categorySales(id, range.fromIso, range.toIso);
    const prev = Object.fromEntries(categorySales(id, range.prevFromIso, range.prevToIso).map((r) => [r.category, r.revenue]));
    const total = rows.reduce((a, r) => a + r.revenue, 0);
    return {
      title: 'Category performance', subtitle: 'How each product category contributes to sales.',
      kpis: [{ label: 'Categories with sales', value: rows.length, format: 'num' }, { label: 'Top category', value: rows[0] ? rows[0].revenue : 0, format: 'inr', hint: rows[0] ? rows[0].category : 'No sales yet' }, { label: 'Top category share', value: total ? Math.round((rows[0].revenue / total) * 100) : 0, format: 'pct' }, { label: 'Total sales', value: r2(total), format: 'inr' }],
      charts: [
        { type: 'donut', title: 'Category breakdown', labels: rows.map((r) => r.category), series: [{ name: 'Revenue', data: rows.map((r) => r.revenue), format: 'inr' }] },
        { type: 'hbar', title: 'Units by category', labels: rows.map((r) => r.category), series: [{ name: 'Units', data: rows.map((r) => r.units), format: 'num' }] },
      ],
      table: { title: 'Category table', columns: [{ key: 'category', label: 'Category' }, { key: 'orders', label: 'Orders', format: 'num', align: 'right' }, { key: 'units', label: 'Units', format: 'num', align: 'right' }, { key: 'revenue', label: 'Revenue', format: 'inr', align: 'right' }, { key: 'share', label: 'Share', format: 'pct', align: 'right' }, { key: 'change', label: 'vs previous', format: 'delta', align: 'right' }],
        rows: rows.map((r) => ({ ...r, share: total ? Math.round((r.revenue / total) * 1000) / 10 : 0, change: pct(r.revenue, prev[r.category] || 0) })) },
    };
  },
  orders(id, range) {
    const plan = bucketPlan(range);
    const status = all('SELECT status, COUNT(*) AS n, SUM(total) AS value FROM orders WHERE seller_id = ? AND placed_at BETWEEN ? AND ? GROUP BY status', id, range.fromIso, range.toIso);
    const total = status.reduce((a, r) => a + r.n, 0);
    const cancelled = (status.find((r) => r.status === 'cancelled') || { n: 0 }).n;
    const ship = get(`SELECT COUNT(*) AS shipped, SUM(s.dispatched_at <= o.dispatch_by) AS on_time, AVG((julianday(s.dispatched_at) - julianday(o.placed_at)) * 24) AS hours
      FROM orders o JOIN shipments s ON s.order_id = o.id WHERE o.seller_id = ? AND s.dispatched_at IS NOT NULL AND o.placed_at BETWEEN ? AND ?`, id, range.fromIso, range.toIso);
    const pay = all('SELECT payment_method, COUNT(*) AS n FROM orders WHERE seller_id = ? AND placed_at BETWEEN ? AND ? GROUP BY payment_method', id, range.fromIso, range.toIso);
    const rows = all(`SELECT ${bucketExpr('placed_at', plan, range.from)} AS b, COUNT(*) AS orders, SUM(status = 'cancelled') AS cancelled FROM orders WHERE seller_id = ? AND placed_at BETWEEN ? AND ? GROUP BY b`, id, range.fromIso, range.toIso);
    const order = ['new', 'pending_confirmation', 'processing', 'packed', 'ready_to_ship', 'shipped', 'delivered', 'cancelled'];
    const sorted = order.map((k) => status.find((r) => r.status === k)).filter(Boolean);
    return {
      title: 'Order analytics', subtitle: 'Order volumes, status distribution and dispatch performance, by order date.',
      kpis: [
        { label: 'Orders received', value: total, format: 'num' }, { label: 'Cancellation rate', value: total ? Math.round((cancelled / total) * 1000) / 10 : 0, format: 'pct', hint: `${cancelled} cancelled` },
        { label: 'On-time dispatch', value: ship.shipped ? Math.round(((ship.on_time || 0) / ship.shipped) * 100) : 0, format: 'pct', hint: ship.shipped ? `${ship.shipped} dispatched` : 'No dispatches yet' },
        { label: 'Average time to dispatch', value: ship.hours ? Math.round(ship.hours * 10) / 10 : 0, format: 'hours' },
      ],
      charts: [
        { type: 'donut', title: 'Order status distribution', labels: sorted.map((r) => ORDER_STATUS[r.status]), series: [{ name: 'Orders', data: sorted.map((r) => r.n), format: 'num' }] },
        { type: 'donut', title: 'Payment method', labels: pay.map((r) => r.payment_method), series: [{ name: 'Orders', data: pay.map((r) => r.n), format: 'num' }] },
        { type: 'bar', span: 2, title: 'Orders received and cancelled', labels: plan.labels, series: [{ name: 'Received', data: fill(rows, plan.n, 'orders'), format: 'num' }, { name: 'Cancelled', data: fill(rows, plan.n, 'cancelled'), format: 'num', tone: 'red' }] },
      ],
      table: { title: 'Status table', columns: [{ key: 'status', label: 'Order status' }, { key: 'orders', label: 'Orders', format: 'num', align: 'right' }, { key: 'value', label: 'Order value', format: 'inr', align: 'right' }, { key: 'share', label: 'Share', format: 'pct', align: 'right' }],
        rows: sorted.map((r) => ({ status: ORDER_STATUS[r.status], orders: r.n, value: r2(r.value), share: Math.round((r.n / total) * 1000) / 10 })) },
    };
  },
  returns(id, range) {
    const reasons = all('SELECT reason, COUNT(*) AS n, SUM(qty) AS units FROM returns WHERE seller_id = ? AND requested_at BETWEEN ? AND ? GROUP BY reason ORDER BY n DESC', id, range.fromIso, range.toIso);
    const byStatus = all('SELECT status, COUNT(*) AS n FROM returns WHERE seller_id = ? AND requested_at BETWEEN ? AND ? GROUP BY status', id, range.fromIso, range.toIso);
    const total = reasons.reduce((a, r) => a + r.n, 0);
    const delivered = get("SELECT COUNT(*) AS n FROM orders WHERE seller_id = ? AND status = 'delivered' AND placed_at BETWEEN ? AND ?", id, range.fromIso, range.toIso).n;
    const refunds = get("SELECT COALESCE(SUM(-amount), 0) AS v FROM transactions WHERE seller_id = ? AND type = 'refund' AND created_at BETWEEN ? AND ?", id, range.fromIso, range.toIso).v;
    const products = all(`SELECT oi.title, COUNT(*) AS returns FROM returns r JOIN order_items oi ON oi.id = r.order_item_id WHERE r.seller_id = ? AND r.requested_at BETWEEN ? AND ? GROUP BY oi.title ORDER BY returns DESC LIMIT 20`, id, range.fromIso, range.toIso);
    return {
      title: 'Returns analytics', subtitle: 'Return requests received in the period, by request date.',
      kpis: [{ label: 'Return requests', value: total, format: 'num' }, { label: 'Return rate', value: delivered ? Math.round((total / delivered) * 1000) / 10 : 0, format: 'pct', hint: `Against ${delivered} delivered orders placed in the period` }, { label: 'Refund deductions', value: r2(refunds), format: 'inr' }, { label: 'Top reason', value: reasons[0] ? reasons[0].n : 0, format: 'num', hint: reasons[0] ? reasons[0].reason : 'No returns' }],
      charts: [
        { type: 'hbar', title: 'Return reasons', labels: reasons.map((r) => r.reason), series: [{ name: 'Requests', data: reasons.map((r) => r.n), format: 'num', tone: 'amber' }] },
        { type: 'donut', title: 'Return status', labels: byStatus.map((r) => RETURN_STATUS[r.status]), series: [{ name: 'Requests', data: byStatus.map((r) => r.n), format: 'num' }] },
      ],
      table: { title: 'Returns by product', columns: [{ key: 'title', label: 'Product' }, { key: 'returns', label: 'Return requests', format: 'num', align: 'right' }], rows: products },
    };
  },
  inventory(id, range) {
    const summary = inventorySummary(id);
    const rows = all(`SELECT i.sku, p.title, p.code, (i.on_hand - i.reserved) AS available, i.reserved, i.safety_stock, ${STOCK_STATUS_SQL} AS stock_status, r2v.units AS sold, (i.on_hand * COALESCE(p.price, 0)) AS stock_value
      FROM inventory i JOIN products p ON p.id = i.product_id LEFT JOIN (SELECT oi.inventory_id, SUM(oi.qty) AS units FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.seller_id = ? AND o.status != 'cancelled' AND o.placed_at BETWEEN ? AND ? GROUP BY oi.inventory_id) r2v ON r2v.inventory_id = i.id
      WHERE i.seller_id = ? ORDER BY stock_value DESC LIMIT 500`, id, range.fromIso, range.toIso, id);
    const value = rows.reduce((a, r) => a + r.stock_value, 0);
    const table = rows.map((r) => {
      const perDay = (r.sold || 0) / range.days;
      return { sku: r.sku, title: r.title, code: r.code, available: r.available, reserved: r.reserved, sold: r.sold || 0, cover: perDay > 0 ? Math.round(r.available / perDay) : null, stock_value: r2(r.stock_value), status: { healthy: 'Healthy', low: 'Low stock', critical: 'Critical', out_of_stock: 'Out of stock' }[r.stock_status] };
    });
    const top = [...table].sort((a, b) => b.stock_value - a.stock_value).slice(0, 8);
    return {
      title: 'Inventory analytics', subtitle: 'Current stock position, with sell-through measured over the selected period.',
      kpis: [{ label: 'SKUs', value: summary.skus, format: 'num' }, { label: 'Available units', value: summary.available, format: 'num', hint: `${summary.reserved} reserved for open orders` }, { label: 'Stock value at selling price', value: r2(value), format: 'inr' }, { label: 'SKUs needing attention', value: summary.low + summary.out_of_stock, format: 'num', hint: `${summary.out_of_stock} out of stock` }],
      charts: [
        { type: 'donut', title: 'Inventory health', labels: ['Healthy', 'Low stock', 'Critical', 'Out of stock'], series: [{ name: 'SKUs', data: [summary.healthy, summary.low - summary.critical, summary.critical, summary.out_of_stock], format: 'num' }], tones: ['green', 'amber', 'orange', 'red'] },
        { type: 'hbar', title: 'Highest stock value', labels: top.map((r) => r.title), series: [{ name: 'Stock value', data: top.map((r) => r.stock_value), format: 'inr' }] },
      ],
      table: { title: 'Stock cover by SKU', columns: [{ key: 'sku', label: 'SKU' }, { key: 'title', label: 'Product', link: 'product' }, { key: 'status', label: 'Status', format: 'status' }, { key: 'available', label: 'Available', format: 'num', align: 'right' }, { key: 'sold', label: 'Sold in period', format: 'num', align: 'right' }, { key: 'cover', label: 'Days of cover', format: 'days', align: 'right' }, { key: 'stock_value', label: 'Stock value', format: 'inr', align: 'right' }], rows: table },
    };
  },
  customers(id, range) {
    const cur = get("SELECT COUNT(DISTINCT customer_ref) AS customers, COUNT(*) AS orders, COALESCE(SUM(total), 0) AS sales FROM orders WHERE seller_id = ? AND status != 'cancelled' AND placed_at BETWEEN ? AND ?", id, range.fromIso, range.toIso);
    const repeat = get(`SELECT COUNT(*) AS n FROM (SELECT customer_ref FROM orders WHERE seller_id = ? AND status != 'cancelled' AND placed_at BETWEEN ? AND ? GROUP BY customer_ref
      HAVING (SELECT COUNT(*) FROM orders o2 WHERE o2.seller_id = ? AND o2.customer_ref = orders.customer_ref AND o2.status != 'cancelled' AND o2.placed_at <= ?) > 1)`, id, range.fromIso, range.toIso, id, range.toIso).n;
    const states = all("SELECT ship_state AS state, COUNT(*) AS orders, COUNT(DISTINCT customer_ref) AS customers, SUM(total) AS sales FROM orders WHERE seller_id = ? AND status != 'cancelled' AND placed_at BETWEEN ? AND ? GROUP BY ship_state ORDER BY sales DESC", id, range.fromIso, range.toIso);
    const cities = all("SELECT ship_city AS city, COUNT(*) AS orders FROM orders WHERE seller_id = ? AND status != 'cancelled' AND placed_at BETWEEN ? AND ? GROUP BY ship_city ORDER BY orders DESC LIMIT 8", id, range.fromIso, range.toIso);
    return {
      title: 'Customer trends', subtitle: 'Aggregated by anonymised customer reference and delivery region. No personal details are shown.',
      kpis: [{ label: 'Customers', value: cur.customers, format: 'num' }, { label: 'Repeat customers', value: cur.customers ? Math.round((repeat / cur.customers) * 100) : 0, format: 'pct', hint: `${repeat} ordered more than once` }, { label: 'Orders per customer', value: cur.customers ? Math.round((cur.orders / cur.customers) * 100) / 100 : 0, format: 'num' }, { label: 'Sales per customer', value: cur.customers ? r2(cur.sales / cur.customers) : 0, format: 'inr' }],
      charts: [
        { type: 'hbar', title: 'Sales by delivery state', labels: states.slice(0, 8).map((r) => r.state), series: [{ name: 'Sales', data: states.slice(0, 8).map((r) => r2(r.sales)), format: 'inr' }] },
        { type: 'hbar', title: 'Orders by city', labels: cities.map((r) => r.city), series: [{ name: 'Orders', data: cities.map((r) => r.orders), format: 'num', tone: 'green' }] },
      ],
      table: { title: 'Delivery regions', columns: [{ key: 'state', label: 'State' }, { key: 'customers', label: 'Customers', format: 'num', align: 'right' }, { key: 'orders', label: 'Orders', format: 'num', align: 'right' }, { key: 'sales', label: 'Sales', format: 'inr', align: 'right' }], rows: states.map((r) => ({ ...r, sales: r2(r.sales) })) },
    };
  },
  advertising(id, range) {
    const a = adAggregate(id, range);
    return {
      title: 'Advertising analytics', subtitle: 'Campaign delivery metrics for the selected period.', sample: a.sampleNote,
      kpis: [{ label: 'Ad spend', value: a.total.spend, format: 'inr' }, { label: 'Impressions', value: a.total.impressions, format: 'num' }, { label: 'Clicks', value: a.total.clicks, format: 'num', hint: `CTR ${a.total.ctr}%` }, { label: 'Return on ad spend', value: a.total.roas, format: 'x', hint: `₹${Math.round(a.total.revenue).toLocaleString('en-IN')} attributed revenue` }],
      charts: [
        { type: 'line', span: 2, title: 'Spend and attributed revenue', labels: a.plan.labels, series: [{ name: 'Attributed revenue', data: a.series.revenue, format: 'inr', tone: 'green' }, { name: 'Ad spend', data: a.series.spend, format: 'inr' }] },
        { type: 'bar', span: 2, title: 'Clicks', labels: a.plan.labels, series: [{ name: 'Clicks', data: a.series.clicks, format: 'num' }] },
      ],
      table: { title: 'Campaign performance', columns: [{ key: 'name', label: 'Campaign' }, { key: 'status', label: 'Status', format: 'status' }, { key: 'impressions', label: 'Impressions', format: 'num', align: 'right' }, { key: 'clicks', label: 'Clicks', format: 'num', align: 'right' }, { key: 'ctr', label: 'CTR', format: 'pct', align: 'right' }, { key: 'conversions', label: 'Conversions', format: 'num', align: 'right' }, { key: 'spend', label: 'Spend', format: 'inr', align: 'right' }, { key: 'revenue', label: 'Revenue', format: 'inr', align: 'right' }, { key: 'roas', label: 'ROAS', format: 'x', align: 'right' }], rows: a.campaigns },
    };
  },
};
const REPORT_PERMS = { advertising: 'ads.read' };
function buildReport(ctx, key) {
  const builder = REPORTS[key];
  if (!builder) throw notFound('Report');
  if (REPORT_PERMS[key] && !ctx.can(REPORT_PERMS[key]) && !ctx.can('analytics.read')) throw notFound('Report');
  const range = resolveRange(ctx.query, '30d');
  const report = builder(ctx.sellerId, range);
  return { key, range: { key: range.key, from: range.from, to: range.to, label: range.label, days: range.days }, has_demo: hasDemo(ctx.sellerId), exportable: true, ...report };
}
function reportCsv(report) {
  const cols = report.table.columns.filter((c) => c.key !== 'rank');
  return toCsv(cols.map((c) => [c.key, c.label]), report.table.rows.map((r) => Object.fromEntries(cols.map((c) => [c.key, r[c.key] == null ? '' : r[c.key]]))));
}
route('GET', '/api/analytics/:report', { perm: 'analytics.read' }, (ctx) => buildReport(ctx, ctx.params.report));
route('GET', '/api/analytics/:report/export.csv', { perm: 'analytics.read' }, (ctx) => {
  const report = buildReport(ctx, ctx.params.report);
  logActivity(ctx, 'Exported analytics report', 'analytics', report.key, `${report.range.from} to ${report.range.to}`);
  return reply.csv(`nearbuy-${report.key}-${report.range.from}-to-${report.range.to}.csv`, reportCsv(report));
});

/* ---------- Growth insights ---------- */
// Illustrative marketplace-wide demand signals. A real build would read these from the marketplace search and demand feed.
const SAMPLE_DEMAND = {
  Electronics: { index: 92, growth: 18, searches: ['wireless earbuds', 'power bank 20000mah', 'smart watch'] },
  Fashion: { index: 88, growth: 12, searches: ['cotton kurta set', 'oversized t-shirt', 'running shoes men'] },
  'Home and Kitchen': { index: 81, growth: 9, searches: ['steel water bottle', 'air fryer', 'storage containers'] },
  Beauty: { index: 76, growth: 21, searches: ['vitamin c serum', 'sunscreen spf 50', 'hair oil'] },
  Grocery: { index: 70, growth: 6, searches: ['dry fruits combo', 'cold pressed oil', 'millet snacks'] },
  Books: { index: 48, growth: 3, searches: ['upsc books', 'children story books', 'self help books'] },
  Toys: { index: 63, growth: 15, searches: ['building blocks', 'remote control car', 'board games'] },
  Sports: { index: 67, growth: 14, searches: ['yoga mat 6mm', 'badminton racket', 'resistance bands'] },
  Accessories: { index: 72, growth: 10, searches: ['laptop backpack', 'analog watch men', 'sunglasses uv400'] },
};
const SAMPLE_NOTE = 'Sample data: marketplace-wide demand and search figures are illustrative because no marketplace demand feed is connected. Figures about your own catalogue, stock and sales are real.';
function productSignals(id) {
  const range = resolveRange({ range: '30d' });
  return all(`SELECT p.id, p.code, p.title, p.category, p.status, p.price, p.mrp, p.highlights, p.description, p.created_at,
      COALESCE(s.available, 0) AS available, COALESCE(s.safety, 0) AS safety,
      (SELECT COUNT(*) FROM product_images WHERE product_id = p.id) AS images,
      (SELECT COUNT(*) FROM product_variants WHERE product_id = p.id) AS variants,
      COALESCE(x.units, 0) AS units_30d, COALESCE(x.revenue, 0) AS revenue_30d
    FROM products p
    LEFT JOIN (SELECT product_id, SUM(on_hand - reserved) AS available, MIN(safety_stock) AS safety FROM inventory WHERE seller_id = ? GROUP BY product_id) s ON s.product_id = p.id
    LEFT JOIN (SELECT oi.product_id, SUM(oi.qty) AS units, SUM(oi.line_total) AS revenue FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.seller_id = ? AND o.status != 'cancelled' AND o.placed_at BETWEEN ? AND ? GROUP BY oi.product_id) x ON x.product_id = p.id
    WHERE p.seller_id = ?`, id, id, range.fromIso, range.toIso, id).map((p) => ({ ...p, highlights: parseJson(p.highlights, []), discount: p.mrp ? Math.round((1 - p.price / p.mrp) * 100) : 0 }));
}
const GROWTH = {
  overview(id) {
    const range = resolveRange({ range: '30d' });
    const cur = orderTotals(id, range.fromIso, range.toIso);
    const prev = orderTotals(id, range.prevFromIso, range.prevToIso);
    const signals = productSignals(id);
    const active = signals.filter((p) => p.status === 'active');
    const slow = active.filter((p) => p.units_30d === 0 && p.available > 0);
    const restock = active.filter((p) => p.units_30d > 0 && p.available <= Math.max(p.safety, p.units_30d));
    const today = istDate();
    const promos = all('SELECT * FROM promotions WHERE seller_id = ?', id).filter((p) => promoStatus(p, today) === 'active').length;
    const plan = bucketPlan(range);
    const s = orderSeries(id, plan, range.from, range.fromIso, range.toIso);
    const cats = categorySales(id, range.fromIso, range.toIso);
    return {
      title: 'Growth overview', subtitle: 'Where your store stands over the last 30 days and what to do next.', sample: false,
      kpis: [{ label: 'Sales, last 30 days', value: cur.sales, format: 'inr', delta: pct(cur.sales, prev.sales) }, { label: 'Active promotions', value: promos, format: 'num' }, { label: 'Stock opportunities', value: restock.length, format: 'num', hint: 'Selling products that may run out' }, { label: 'Slow-moving products', value: slow.length, format: 'num', hint: 'In stock, no sales in 30 days' }],
      charts: [
        { type: 'line', span: 2, title: 'Sales trend', labels: plan.labels, series: [{ name: 'Sales', data: s.sales, format: 'inr' }] },
        { type: 'hbar', title: 'High-performing categories', labels: cats.slice(0, 6).map((c) => c.category), series: [{ name: 'Revenue', data: cats.slice(0, 6).map((c) => c.revenue), format: 'inr', tone: 'green' }] },
        { type: 'hbar', title: 'Product performance', labels: [...active].sort((a, b) => b.revenue_30d - a.revenue_30d).slice(0, 6).map((p) => p.title), series: [{ name: 'Revenue', data: [...active].sort((a, b) => b.revenue_30d - a.revenue_30d).slice(0, 6).map((p) => r2(p.revenue_30d)), format: 'inr' }] },
      ],
      insights: [
        restock.length ? { tone: 'warning', tag: 'Stock', title: `${restock.length} selling product${restock.length === 1 ? '' : 's'} may run out`, detail: `${restock[0].title} has ${restock[0].available} unit(s) left after selling ${restock[0].units_30d} in 30 days.`, link: '/seller/growth/opportunities', link_label: 'See stock opportunities' } : null,
        slow.length ? { tone: 'info', tag: 'Slow-moving', title: `${slow.length} product${slow.length === 1 ? ' has' : 's have'} stock but no recent sales`, detail: 'A time-bound discount can help clear slow stock.', link: '/seller/growth/promotions/new', link_label: 'Create a promotion' } : null,
        { tone: 'success', tag: 'Promotions', title: promos ? `${promos} promotion${promos === 1 ? ' is' : 's are'} running` : 'No promotion is running', detail: promos ? 'Review performance and end dates.' : 'Schedule a discount campaign for your best sellers.', link: '/seller/growth/promotions', link_label: 'Open promotions' },
      ].filter(Boolean),
    };
  },
  opportunities(id) {
    const signals = productSignals(id);
    const insights = [];
    for (const p of signals) {
      if (p.status === 'active' && p.units_30d > 0 && p.available <= Math.max(p.safety, p.units_30d)) insights.push({ tone: 'warning', tag: 'Stock opportunity', title: p.title, detail: `Sold ${p.units_30d} in 30 days and only ${p.available} left. Restock to avoid losing orders.`, link: `/seller/inventory?q=${encodeURIComponent(p.code)}`, link_label: 'Update stock' });
      else if (p.status === 'active' && p.available > 0 && p.units_30d === 0) insights.push({ tone: 'info', tag: 'Slow-moving', title: p.title, detail: `${p.available} unit(s) in stock with no sales in 30 days. Current discount ${p.discount}%.`, link: '/seller/growth/promotions/new', link_label: 'Create promotion' });
      else if (p.status === 'inactive' && p.available > 0) insights.push({ tone: 'success', tag: 'Reactivate', title: p.title, detail: `Inactive listing with ${p.available} unit(s) in stock.`, link: `/seller/products/${p.code}`, link_label: 'Open listing' });
      else if (p.status === 'draft') insights.push({ tone: 'neutral', tag: 'Unfinished draft', title: p.title, detail: 'Complete and submit this draft to start selling it.', link: `/seller/products/${p.code}/edit`, link_label: 'Finish listing' });
      else if (p.status === 'qc_failed' || p.status === 'rejected') insights.push({ tone: 'danger', tag: 'Needs correction', title: p.title, detail: 'This listing is offline until its issues are fixed.', link: `/seller/products/${p.code}`, link_label: 'Fix listing' });
    }
    const rank = { danger: 0, warning: 1, success: 2, info: 3, neutral: 4 };
    insights.sort((a, b) => rank[a.tone] - rank[b.tone]);
    return { title: 'Product opportunities', subtitle: 'Calculated from your own listings, stock and the last 30 days of orders.', sample: false, kpis: [{ label: 'Opportunities found', value: insights.length, format: 'num' }, { label: 'Stock opportunities', value: insights.filter((i) => i.tag === 'Stock opportunity').length, format: 'num' }, { label: 'Slow-moving products', value: insights.filter((i) => i.tag === 'Slow-moving').length, format: 'num' }, { label: 'Listings offline', value: insights.filter((i) => ['Needs correction', 'Unfinished draft', 'Reactivate'].includes(i.tag)).length, format: 'num' }], insights, insights_empty: 'No opportunities right now. Your active listings are selling and in stock.' };
  },
  recommendations(id) {
    const signals = productSignals(id).filter((p) => ['active', 'inactive', 'pending_approval'].includes(p.status));
    const rows = signals.map((p) => {
      const tips = [];
      if (p.images < 3) tips.push(`Add ${3 - p.images} more image${3 - p.images === 1 ? '' : 's'}`);
      if (p.highlights.length < 4) tips.push('Add more highlights');
      if ((p.description || '').length < 150) tips.push('Write a fuller description');
      if (!p.variants && ['Fashion', 'Sports', 'Accessories'].includes(p.category)) tips.push('Add size or colour variants');
      const score = Math.max(0, 100 - tips.length * 20);
      return { title: p.title, code: p.code, category: p.category, images: p.images, score, tips: tips.join(' · ') || 'Listing content is complete' };
    }).sort((a, b) => a.score - b.score);
    return {
      title: 'Product recommendations', subtitle: 'Content checks on your live listings. Scores are a simple completeness measure, not a marketplace ranking.', sample: false,
      kpis: [{ label: 'Listings reviewed', value: rows.length, format: 'num' }, { label: 'Average content score', value: rows.length ? Math.round(rows.reduce((a, r) => a + r.score, 0) / rows.length) : 0, format: 'pct' }, { label: 'Listings to improve', value: rows.filter((r) => r.score < 100).length, format: 'num' }, { label: 'Listings with fewer than 3 images', value: rows.filter((r) => r.images < 3).length, format: 'num' }],
      table: { title: 'Recommendations by listing', columns: [{ key: 'title', label: 'Product', link: 'product' }, { key: 'category', label: 'Category' }, { key: 'score', label: 'Content score', format: 'pct', align: 'right' }, { key: 'tips', label: 'Recommended actions' }], rows },
    };
  },
  trending(id) {
    const mine = Object.fromEntries(all("SELECT category, COUNT(*) AS n FROM products WHERE seller_id = ? AND status = 'active' GROUP BY category", id).map((r) => [r.category, r.n]));
    const rows = CATEGORIES.map((c) => ({ category: c, demand_index: SAMPLE_DEMAND[c].index, growth: SAMPLE_DEMAND[c].growth, searches: SAMPLE_DEMAND[c].searches.join(', '), your_listings: mine[c] || 0 })).sort((a, b) => b.demand_index - a.demand_index);
    return {
      title: 'Trending categories', subtitle: 'Category demand compared with the number of active listings you have.', sample: SAMPLE_NOTE,
      kpis: [{ label: 'Highest demand (sample)', value: rows[0].demand_index, format: 'num', hint: rows[0].category }, { label: 'Fastest growing (sample)', value: Math.max(...rows.map((r) => r.growth)), format: 'pct', hint: [...rows].sort((a, b) => b.growth - a.growth)[0].category }, { label: 'Categories you sell in', value: Object.keys(mine).length, format: 'num' }, { label: 'Categories with no active listing', value: rows.filter((r) => !r.your_listings).length, format: 'num' }],
      charts: [{ type: 'hbar', span: 2, title: 'Search demand index by category (sample data)', labels: rows.map((r) => r.category), series: [{ name: 'Demand index', data: rows.map((r) => r.demand_index), format: 'num', tone: 'amber' }] }],
      table: { title: 'Category demand (sample) and your presence (real)', columns: [{ key: 'category', label: 'Category' }, { key: 'demand_index', label: 'Demand index (sample)', format: 'num', align: 'right' }, { key: 'growth', label: 'Monthly growth (sample)', format: 'delta', align: 'right' }, { key: 'searches', label: 'Popular searches (sample)' }, { key: 'your_listings', label: 'Your active listings', format: 'num', align: 'right' }], rows },
    };
  },
  pricing(id) {
    const signals = productSignals(id).filter((p) => p.status === 'active' && p.price);
    const rows = [];
    for (const p of signals) {
      let suggestion = null; let reason = null;
      if (p.units_30d === 0 && p.available > 0 && p.discount < 25) { suggestion = Math.max(1, Math.round(p.price * 0.92)); reason = 'No sales in 30 days with stock on hand — test a price about 8% lower.'; }
      else if (p.units_30d >= 5 && p.available <= p.safety && p.discount > 30) { suggestion = Math.min(p.mrp, Math.round(p.price * 1.05)); reason = 'Selling fast with low stock and a deep discount — a 5% higher price protects margin.'; }
      else if (p.discount < 5 && p.units_30d < 2) { suggestion = Math.max(1, Math.round(p.price * 0.95)); reason = 'Almost no discount to MRP and few sales — a visible discount usually improves conversion.'; }
      if (suggestion && suggestion !== p.price) rows.push({ title: p.title, code: p.code, price: p.price, mrp: p.mrp, discount: p.discount, units: p.units_30d, suggested: suggestion, reason });
    }
    return {
      title: 'Price recommendations', subtitle: 'Rule-based estimates from your own sales velocity, stock and discount to MRP.', sample: 'Estimated: these suggestions use simple rules on your own data. No competitor or marketplace price feed is connected, so treat them as prompts, not guarantees.',
      kpis: [{ label: 'Active products reviewed', value: signals.length, format: 'num' }, { label: 'Price suggestions', value: rows.length, format: 'num' }, { label: 'Average discount to MRP', value: signals.length ? Math.round(signals.reduce((a, p) => a + p.discount, 0) / signals.length) : 0, format: 'pct' }, { label: 'Products with no 30-day sales', value: signals.filter((p) => !p.units_30d).length, format: 'num' }],
      table: { title: 'Suggested price changes (estimates)', empty: 'No price changes suggested. Prices look consistent with current sales.', columns: [{ key: 'title', label: 'Product', link: 'product' }, { key: 'price', label: 'Current price', format: 'inr', align: 'right' }, { key: 'discount', label: 'Discount', format: 'pct', align: 'right' }, { key: 'units', label: 'Units, 30 days', format: 'num', align: 'right' }, { key: 'suggested', label: 'Suggested price', format: 'inr', align: 'right' }, { key: 'reason', label: 'Why' }], rows },
    };
  },
  selection(id) {
    const mine = Object.fromEntries(all('SELECT category, COUNT(*) AS n FROM products WHERE seller_id = ? GROUP BY category', id).map((r) => [r.category, r.n]));
    const range = resolveRange({ range: '90d' });
    const sales = Object.fromEntries(categorySales(id, range.fromIso, range.toIso).map((r) => [r.category, r.revenue]));
    const insights = CATEGORIES.map((c) => {
      const d = SAMPLE_DEMAND[c];
      const n = mine[c] || 0;
      if (!n && d.index >= 70) return { tone: 'success', tag: 'Gap', title: `${c}: high demand, no listings`, detail: `Sample demand index ${d.index}. Popular searches (sample): ${d.searches.join(', ')}.`, link: '/seller/products/new', link_label: 'Add a product' };
      if (n && n < 3 && d.growth >= 12) return { tone: 'info', tag: 'Expand', title: `${c}: growing category, only ${n} listing${n === 1 ? '' : 's'}`, detail: `Sample monthly growth ${d.growth}%. Your 90-day sales here: ₹${Math.round(sales[c] || 0).toLocaleString('en-IN')}.`, link: '/seller/products/new', link_label: 'Add a product' };
      if (n >= 3 && !(sales[c] > 0)) return { tone: 'warning', tag: 'Review', title: `${c}: ${n} listings, no sales in 90 days`, detail: 'Check pricing, images and stock for this category.', link: `/seller/products?category=${encodeURIComponent(c)}`, link_label: 'View listings' };
      return null;
    }).filter(Boolean);
    const rows = CATEGORIES.map((c) => ({ category: c, listings: mine[c] || 0, sales_90d: r2(sales[c] || 0), demand_index: SAMPLE_DEMAND[c].index, searches: SAMPLE_DEMAND[c].searches.join(', ') }));
    return {
      title: 'Selection insights', subtitle: 'Where your catalogue is thin compared with category demand.', sample: SAMPLE_NOTE,
      kpis: [{ label: 'Total listings', value: Object.values(mine).reduce((a, b) => a + b, 0), format: 'num' }, { label: 'Categories covered', value: Object.keys(mine).length, format: 'num', hint: `of ${CATEGORIES.length}` }, { label: 'Selection gaps', value: insights.filter((i) => i.tag === 'Gap').length, format: 'num' }, { label: 'Categories to review', value: insights.filter((i) => i.tag === 'Review').length, format: 'num' }],
      insights, insights_empty: 'No selection gaps flagged.',
      table: { title: 'Catalogue coverage', columns: [{ key: 'category', label: 'Category' }, { key: 'listings', label: 'Your listings', format: 'num', align: 'right' }, { key: 'sales_90d', label: 'Your sales, 90 days', format: 'inr', align: 'right' }, { key: 'demand_index', label: 'Demand index (sample)', format: 'num', align: 'right' }, { key: 'searches', label: 'Search demand (sample)' }], rows },
    };
  },
  'sales-growth': function salesGrowth(id) {
    const range = resolveRange({ range: '90d' });
    const plan = bucketPlan(range);
    const s = orderSeries(id, plan, range.from, range.fromIso, range.toIso);
    const cur = orderTotals(id, range.fromIso, range.toIso);
    const prev = orderTotals(id, range.prevFromIso, range.prevToIso);
    const last4 = s.sales.slice(-4).reduce((a, b) => a + b, 0);
    const prior4 = s.sales.slice(-8, -4).reduce((a, b) => a + b, 0);
    const cats = categorySales(id, range.fromIso, range.toIso);
    const prevCats = Object.fromEntries(categorySales(id, range.prevFromIso, range.prevToIso).map((r) => [r.category, r.revenue]));
    return {
      title: 'Sales growth', subtitle: 'Weekly sales over the last 90 days compared with the 90 days before.', sample: false,
      kpis: [{ label: 'Sales, last 90 days', value: cur.sales, format: 'inr', delta: pct(cur.sales, prev.sales) }, { label: 'Orders, last 90 days', value: cur.orders, format: 'num', delta: pct(cur.orders, prev.orders) }, { label: 'Last 4 weeks vs prior 4', value: pct(last4, prior4) == null ? 0 : pct(last4, prior4), format: 'delta' }, { label: 'Average order value', value: cur.aov, format: 'inr', delta: pct(cur.aov, prev.aov) }],
      charts: [{ type: 'bar', span: 2, title: 'Weekly sales', labels: plan.labels, series: [{ name: 'Sales', data: s.sales, format: 'inr' }] }, { type: 'line', span: 2, title: 'Weekly orders', labels: plan.labels, series: [{ name: 'Orders', data: s.orders, format: 'num', tone: 'green' }] }],
      table: { title: 'Growth by category', columns: [{ key: 'category', label: 'Category' }, { key: 'revenue', label: 'Sales, 90 days', format: 'inr', align: 'right' }, { key: 'previous', label: 'Previous 90 days', format: 'inr', align: 'right' }, { key: 'change', label: 'Growth', format: 'delta', align: 'right' }], rows: cats.map((c) => ({ category: c.category, revenue: c.revenue, previous: r2(prevCats[c.category] || 0), change: pct(c.revenue, prevCats[c.category] || 0) })) },
    };
  },
};
route('GET', '/api/growth/:page', { perm: 'growth.read' }, (ctx) => {
  const builder = GROWTH[ctx.params.page];
  if (!builder) throw notFound('Page');
  return { key: ctx.params.page, has_demo: hasDemo(ctx.sellerId), ...builder(ctx.sellerId) };
});

/* ---------- Promotions ---------- */
const PROMO_STATUS = { draft: 'Draft', scheduled: 'Scheduled', active: 'Active', paused: 'Paused', expired: 'Expired' };
function promoStatus(p, today = istDate()) {
  if (p.state === 'draft' || p.state === 'paused') return p.state === 'paused' && p.end_date < today ? 'expired' : p.state;
  if (p.end_date < today) return 'expired';
  return p.start_date > today ? 'scheduled' : 'active';
}
function promoLines(sellerId, productIds, type, value) {
  const lines = [];
  for (const pid of productIds) {
    const p = get('SELECT id, code, title, price, mrp, status FROM products WHERE id = ? AND seller_id = ?', pid, sellerId);
    if (!p) throw bad('Please correct the highlighted fields.', { product_ids: 'One of the selected products was not found in your catalogue.' });
    const promoPrice = type === 'percentage' ? r2(p.price * (1 - value / 100)) : r2(p.price - value);
    lines.push({ id: p.id, code: p.code, title: p.title, status: p.status, price: p.price, mrp: p.mrp, promo_price: promoPrice, saving: r2(p.price - promoPrice), total_discount_pct: p.mrp ? Math.round((1 - promoPrice / p.mrp) * 100) : 0 });
  }
  return lines;
}
function readPromotion(ctx, existing) {
  const data = validate(ctx.body, {
    name: { required: true, min: 4, max: 80, label: 'Campaign name' }, product_ids: { type: 'array', of: 'int', min: 1, max: 50, label: 'Products', message: 'Select at least one product.' },
    discount_type: { required: true, enum: ['percentage', 'flat'], label: 'Discount type' }, discount_value: { type: 'number', required: true, min: 1, max: 1000000, label: 'Discount value' },
    start_date: { required: true, format: 'date', label: 'Start date' }, end_date: { required: true, format: 'date', label: 'End date' },
    budget: { type: 'number', min: 0, max: 100000000 }, publish: { type: 'bool' },
  });
  const errors = {};
  const today = istDate();
  if (data.end_date < data.start_date) errors.end_date = 'End date cannot be before the start date.';
  if (data.publish && data.end_date < today) errors.end_date = 'End date is in the past.';
  if (!existing && data.start_date < today) errors.start_date = 'Start date cannot be in the past.';
  if (data.discount_type === 'percentage' && data.discount_value > 90) errors.discount_value = 'Percentage discount must be between 1 and 90.';
  if (Object.keys(errors).length) throw bad('Please correct the highlighted fields.', errors);
  data.product_ids = [...new Set(data.product_ids)];
  const lines = promoLines(ctx.sellerId, data.product_ids, data.discount_type, data.discount_value);
  if (data.discount_type === 'flat') {
    const cheapest = Math.min(...lines.map((l) => l.price));
    if (data.discount_value >= cheapest) throw bad('Please correct the highlighted fields.', { discount_value: `Flat discount must be lower than the cheapest selected product (₹${cheapest}).` });
  }
  if (data.publish) {
    const notLive = lines.filter((l) => l.status !== 'active');
    if (notLive.length) throw bad('Please correct the highlighted fields.', { product_ids: `Only active listings can be promoted. Not active: ${notLive.map((l) => l.title).slice(0, 3).join(', ')}.` });
  }
  return { data, lines };
}
function promoView(sellerId, p, withLines) {
  const ids = parseJson(p.product_ids, []);
  const view = { code: p.code, name: p.name, discount_type: p.discount_type, discount_value: p.discount_value, start_date: p.start_date, end_date: p.end_date, budget: p.budget, state: p.state, status: promoStatus(p), status_label: PROMO_STATUS[promoStatus(p)], product_count: ids.length, product_ids: ids, is_demo: Boolean(p.is_demo), created_at: p.created_at };
  if (withLines) {
    view.lines = ids.map((pid) => { try { return promoLines(sellerId, [pid], p.discount_type, p.discount_value)[0]; } catch { return null; } }).filter(Boolean);
    // Orders placed while the promotion was running for the promoted products (real order data).
    const orders = get(`SELECT COUNT(DISTINCT o.id) AS orders, COALESCE(SUM(oi.qty), 0) AS units, COALESCE(SUM(oi.line_total), 0) AS revenue FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.seller_id = ? AND o.status != 'cancelled' AND oi.product_id IN (${ids.map(() => '?').join(',') || 'NULL'}) AND date(o.placed_at, '+330 minutes') BETWEEN ? AND ?`, sellerId, ...ids, p.start_date, p.end_date);
    view.performance = { orders: orders.orders, units: orders.units, revenue: r2(orders.revenue) };
  }
  return view;
}
route('GET', '/api/promotions', { perm: 'growth.read' }, (ctx) => {
  let rows = all('SELECT * FROM promotions WHERE seller_id = ? ORDER BY created_at DESC', ctx.sellerId).map((p) => promoView(ctx.sellerId, p));
  const counts = { all: rows.length, active: 0, scheduled: 0, expired: 0, draft: 0, paused: 0 };
  rows.forEach((r) => { counts[r.status] += 1; });
  if (PROMO_STATUS[ctx.query.tab]) rows = rows.filter((r) => r.status === ctx.query.tab);
  if (ctx.query.q) { const q = String(ctx.query.q).toLowerCase(); rows = rows.filter((r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q)); }
  const size = 10; const pages = Math.max(1, Math.ceil(rows.length / size)); const page = Math.min(Math.max(parseInt(ctx.query.page, 10) || 1, 1), pages);
  return { rows: rows.slice((page - 1) * size, page * size), total: rows.length, page, pages, pageSize: size, counts, can_write: ctx.can('growth.write') };
});
route('GET', '/api/promotions/products', { perm: 'growth.read' }, (ctx) => ({
  products: all("SELECT id, code, title, category, price, mrp, status FROM products WHERE seller_id = ? AND status IN ('active', 'inactive', 'pending_approval') AND price IS NOT NULL ORDER BY title LIMIT 500", ctx.sellerId),
}));
route('POST', '/api/promotions/preview', { perm: 'growth.write' }, (ctx) => {
  const { data, lines } = readPromotion(ctx, null);
  const probe = { state: data.publish ? 'published' : 'draft', start_date: data.start_date, end_date: data.end_date };
  return { valid: true, lines, status_label: PROMO_STATUS[promoStatus(probe)], days: Math.round((Date.parse(data.end_date) - Date.parse(data.start_date)) / 86400000) + 1, max_saving: Math.max(...lines.map((l) => l.saving)) };
});
route('POST', '/api/promotions', { perm: 'growth.write' }, (ctx) => {
  const { data } = readPromotion(ctx, null);
  const code = nextCode('PRM', 300);
  insert('promotions', { seller_id: ctx.sellerId, code, name: data.name, product_ids: data.product_ids, discount_type: data.discount_type, discount_value: data.discount_value, start_date: data.start_date, end_date: data.end_date, budget: data.budget, state: data.publish ? 'published' : 'draft', created_at: nowIso(), updated_at: nowIso() });
  logActivity(ctx, data.publish ? 'Published promotion' : 'Saved promotion draft', 'promotion', code, data.name);
  return reply.created({ code, message: data.publish ? 'Promotion saved and scheduled.' : 'Promotion saved as a draft.' });
});
const findPromo = (ctx) => { const p = get('SELECT * FROM promotions WHERE code = ? AND seller_id = ?', ctx.params.code, ctx.sellerId); if (!p) throw notFound('Promotion'); return p; };
route('GET', '/api/promotions/:code', { perm: 'growth.read' }, (ctx) => ({ promotion: promoView(ctx.sellerId, findPromo(ctx), true), can_write: ctx.can('growth.write') }));
route('PUT', '/api/promotions/:code', { perm: 'growth.write' }, (ctx) => {
  const p = findPromo(ctx);
  if (promoStatus(p) === 'expired') throw conflict('Expired promotions cannot be edited. Create a new one instead.');
  const { data } = readPromotion(ctx, p);
  run('UPDATE promotions SET name = ?, product_ids = ?, discount_type = ?, discount_value = ?, start_date = ?, end_date = ?, budget = ?, state = ?, updated_at = ? WHERE id = ? AND seller_id = ?', data.name, JSON.stringify(data.product_ids), data.discount_type, data.discount_value, data.start_date, data.end_date, data.budget, data.publish ? 'published' : (p.state === 'paused' ? 'paused' : 'draft'), nowIso(), p.id, ctx.sellerId);
  logActivity(ctx, 'Updated promotion', 'promotion', p.code, data.name);
  return { ok: true, code: p.code, message: 'Promotion updated.' };
});
route('POST', '/api/promotions/:code/status', { perm: 'growth.write' }, (ctx) => {
  const p = findPromo(ctx);
  const status = promoStatus(p);
  const action = ctx.body.action;
  let state;
  if (action === 'pause') { if (!['active', 'scheduled'].includes(status)) throw conflict('Only active or scheduled promotions can be paused.'); state = 'paused'; }
  else if (action === 'resume') { if (status !== 'paused') throw conflict('Only paused promotions can be resumed.'); state = 'published'; }
  else if (action === 'publish') {
    if (status !== 'draft') throw conflict('Only drafts can be published.');
    if (p.end_date < istDate()) throw conflict('The end date has passed. Edit the dates before publishing.');
    const lines = promoLines(ctx.sellerId, parseJson(p.product_ids, []), p.discount_type, p.discount_value);
    if (lines.some((l) => l.status !== 'active')) throw conflict('Only active listings can be promoted. Edit the product selection first.');
    state = 'published';
  } else if (action === 'end') { if (!['active', 'scheduled', 'paused'].includes(status)) throw conflict('This promotion is not running.'); run('UPDATE promotions SET end_date = ?, state = ?, updated_at = ? WHERE id = ?', addDays(istDate(), -1), 'published', nowIso(), p.id); logActivity(ctx, 'Ended promotion', 'promotion', p.code); return { ok: true, message: 'Promotion ended.' }; }
  else throw bad('Unknown promotion action.');
  run('UPDATE promotions SET state = ?, updated_at = ? WHERE id = ? AND seller_id = ?', state, nowIso(), p.id, ctx.sellerId);
  logActivity(ctx, `Promotion ${action}`, 'promotion', p.code);
  return { ok: true, message: { pause: 'Promotion paused.', resume: 'Promotion resumed.', publish: 'Promotion published.' }[action] };
});
route('DELETE', '/api/promotions/:code', { perm: 'growth.write' }, (ctx) => {
  const p = findPromo(ctx);
  if (promoStatus(p) !== 'draft') throw conflict('Only draft promotions can be deleted. End a running promotion instead.');
  run('DELETE FROM promotions WHERE id = ? AND seller_id = ?', p.id, ctx.sellerId);
  logActivity(ctx, 'Deleted promotion draft', 'promotion', p.code);
  return { ok: true, message: 'Draft deleted.' };
});
/** Price of a product under the best running promotion, used when an order is created. */
function promotionPrice(sellerId, productId, price) {
  const today = istDate();
  let best = null;
  for (const p of all("SELECT * FROM promotions WHERE seller_id = ? AND state = 'published' AND start_date <= ? AND end_date >= ?", sellerId, today, today)) {
    if (!parseJson(p.product_ids, []).includes(productId)) continue;
    const promo = p.discount_type === 'percentage' ? r2(price * (1 - p.discount_value / 100)) : r2(price - p.discount_value);
    if (promo > 0 && (!best || promo < best.price)) best = { price: promo, code: p.code, name: p.name };
  }
  return best;
}

/* ---------- Advertising ---------- */
const AD_STATUS = { draft: 'Draft', scheduled: 'Scheduled', active: 'Active', paused: 'Paused', completed: 'Completed' };
const AD_OBJECTIVES = ['Increase sales', 'Boost product visibility', 'Launch a new product', 'Clear slow-moving stock'];
const AD_PLACEMENTS = ['Search results', 'Product pages', 'Home page'];
const AD_NOTE = 'No advertising network is connected. Campaigns are saved, scheduled and validated here, but ads are not served and no budget is charged.';
function adStatus(c, today = istDate()) {
  if (c.state === 'draft' || c.state === 'completed') return c.state;
  if (c.end_date && c.end_date < today) return 'completed';
  if (c.state === 'scheduled' && c.start_date <= today) return 'active';
  return c.state;
}
function adMetrics(c, fromYmd, toYmd) {
  const rows = parseJson(c.metrics, []).filter((m) => (!fromYmd || m.date >= fromYmd) && (!toYmd || m.date <= toYmd));
  const t = rows.reduce((a, m) => ({ impressions: a.impressions + m.impressions, clicks: a.clicks + m.clicks, conversions: a.conversions + m.conversions, spend: a.spend + m.spend, revenue: a.revenue + m.revenue }), { impressions: 0, clicks: 0, conversions: 0, spend: 0, revenue: 0 });
  return { ...t, spend: r2(t.spend), revenue: r2(t.revenue), ctr: t.impressions ? Math.round((t.clicks / t.impressions) * 1000) / 10 : 0, roas: t.spend ? Math.round((t.revenue / t.spend) * 100) / 100 : 0, rows };
}
function adAggregate(sellerId, range) {
  const plan = bucketPlan(range.days === 1 ? { ...range, days: 2, from: addDays(range.from, -1) } : range);
  const from = range.days === 1 ? addDays(range.from, -1) : range.from;
  const campaigns = all('SELECT * FROM advertising_campaigns WHERE seller_id = ? ORDER BY created_at DESC', sellerId);
  const series = { spend: new Array(plan.n).fill(0), revenue: new Array(plan.n).fill(0), clicks: new Array(plan.n).fill(0), impressions: new Array(plan.n).fill(0) };
  const total = { impressions: 0, clicks: 0, conversions: 0, spend: 0, revenue: 0 };
  const table = campaigns.map((c) => {
    const m = adMetrics(c, from, range.to);
    for (const row of m.rows) {
      const days = Math.round((Date.parse(row.date) - Date.parse(from)) / 86400000);
      const b = plan.mode === 'week' ? Math.floor(days / 7) : days;
      if (b < 0 || b >= plan.n) continue;
      series.spend[b] = r2(series.spend[b] + row.spend); series.revenue[b] = r2(series.revenue[b] + row.revenue); series.clicks[b] += row.clicks; series.impressions[b] += row.impressions;
    }
    for (const k of Object.keys(total)) total[k] += m[k];
    return { code: c.code, name: c.name, status: AD_STATUS[adStatus(c)], impressions: m.impressions, clicks: m.clicks, ctr: m.ctr, conversions: m.conversions, spend: m.spend, revenue: m.revenue, roas: m.roas, is_demo: Boolean(c.is_demo) };
  });
  total.spend = r2(total.spend); total.revenue = r2(total.revenue);
  total.ctr = total.impressions ? Math.round((total.clicks / total.impressions) * 1000) / 10 : 0;
  total.roas = total.spend ? Math.round((total.revenue / total.spend) * 100) / 100 : 0;
  const anyDemo = campaigns.some((c) => c.is_demo);
  return { plan, series, total, campaigns: table, sampleNote: anyDemo ? `Sample data: delivery metrics shown for DEMO campaigns are illustrative. ${AD_NOTE}` : AD_NOTE };
}
function campaignView(c, withDaily) {
  const m = adMetrics(c);
  const view = {
    code: c.code, name: c.name, objective: c.objective, product_ids: parseJson(c.product_ids, []), daily_budget: c.daily_budget, start_date: c.start_date, end_date: c.end_date,
    targeting: parseJson(c.targeting, {}), bid_strategy: c.bid_strategy, bid_amount: c.bid_amount, state: c.state, status: adStatus(c), status_label: AD_STATUS[adStatus(c)], is_demo: Boolean(c.is_demo),
    created_at: c.created_at, metrics: { impressions: m.impressions, clicks: m.clicks, conversions: m.conversions, spend: m.spend, revenue: m.revenue, ctr: m.ctr, roas: m.roas },
  };
  if (withDaily) view.daily = m.rows;
  return view;
}
function readCampaign(ctx, existing) {
  const data = validate(ctx.body, {
    name: { required: true, min: 4, max: 80, label: 'Campaign name' }, objective: { required: true, enum: AD_OBJECTIVES, label: 'Campaign objective' },
    product_ids: { type: 'array', of: 'int', min: 1, max: 30, label: 'Products', message: 'Select at least one product to advertise.' },
    daily_budget: { type: 'number', required: true, min: 100, max: 1000000, label: 'Daily budget' }, start_date: { required: true, format: 'date', label: 'Start date' }, end_date: { format: 'date', label: 'End date' },
    targeting: { type: 'object' }, bid_strategy: { required: true, enum: ['automatic', 'manual'], label: 'Bid strategy' }, bid_amount: { type: 'number', min: 1, max: 500, label: 'Bid per click' },
  });
  const errors = {};
  const today = istDate();
  if (data.end_date && data.end_date < data.start_date) errors.end_date = 'End date cannot be before the start date.';
  if ((!existing || existing.state === 'draft') && data.start_date < today) errors.start_date = 'Start date cannot be in the past.';
  if (data.bid_strategy === 'manual' && data.bid_amount == null) errors.bid_amount = 'Enter a bid per click for manual bidding.';
  if (data.bid_strategy === 'manual' && data.bid_amount > data.daily_budget) errors.bid_amount = 'Bid per click cannot be higher than the daily budget.';
  const t = data.targeting || {};
  const targeting = { type: ['automatic', 'keyword', 'category'].includes(t.type) ? t.type : 'automatic', keywords: [], categories: [], placements: [] };
  if (targeting.type === 'keyword') {
    targeting.keywords = [...new Set((Array.isArray(t.keywords) ? t.keywords : String(t.keywords || '').split(',')).map((k) => String(k).trim().toLowerCase().slice(0, 40)).filter(Boolean))].slice(0, 25);
    if (!targeting.keywords.length) errors['targeting.keywords'] = 'Add at least one keyword.';
  }
  if (targeting.type === 'category') {
    targeting.categories = (Array.isArray(t.categories) ? t.categories : []).filter((c) => CATEGORIES.includes(c));
    if (!targeting.categories.length) errors['targeting.categories'] = 'Choose at least one category.';
  }
  targeting.placements = (Array.isArray(t.placements) ? t.placements : []).filter((p) => AD_PLACEMENTS.includes(p));
  if (!targeting.placements.length) targeting.placements = [...AD_PLACEMENTS];
  data.product_ids = [...new Set(data.product_ids)];
  for (const pid of data.product_ids) {
    const p = get('SELECT status, title FROM products WHERE id = ? AND seller_id = ?', pid, ctx.sellerId);
    if (!p) { errors.product_ids = 'One of the selected products was not found in your catalogue.'; break; }
    if (p.status !== 'active') { errors.product_ids = `Only active listings can be advertised. "${p.title}" is not active.`; break; }
  }
  if (Object.keys(errors).length) throw bad('Please correct the highlighted fields.', errors);
  return { ...data, targeting, bid_amount: data.bid_strategy === 'manual' ? data.bid_amount : null };
}
const findCampaign = (ctx) => { const c = get('SELECT * FROM advertising_campaigns WHERE code = ? AND seller_id = ?', ctx.params.code, ctx.sellerId); if (!c) throw notFound('Campaign'); return c; };
route('GET', '/api/ads/overview', { perm: 'ads.read' }, (ctx) => {
  const range = resolveRange(ctx.query, '30d');
  const a = adAggregate(ctx.sellerId, range);
  const counts = { draft: 0, scheduled: 0, active: 0, paused: 0, completed: 0 };
  all('SELECT * FROM advertising_campaigns WHERE seller_id = ?', ctx.sellerId).forEach((c) => { counts[adStatus(c)] += 1; });
  return { range: { key: range.key, from: range.from, to: range.to, label: range.label }, total: a.total, labels: a.plan.labels, series: a.series, campaigns: a.campaigns, counts, note: a.sampleNote, integration_note: AD_NOTE, can_write: ctx.can('ads.write') };
});
route('GET', '/api/ads/meta', { perm: 'ads.read' }, (ctx) => ({
  objectives: AD_OBJECTIVES, placements: AD_PLACEMENTS, categories: CATEGORIES, statuses: AD_STATUS, note: AD_NOTE,
  products: all("SELECT id, code, title, category, price FROM products WHERE seller_id = ? AND status = 'active' ORDER BY title LIMIT 500", ctx.sellerId),
}));
route('GET', '/api/ads/campaigns', { perm: 'ads.read' }, (ctx) => {
  let rows = all('SELECT * FROM advertising_campaigns WHERE seller_id = ? ORDER BY created_at DESC', ctx.sellerId).map((c) => campaignView(c));
  const counts = { all: rows.length, draft: 0, scheduled: 0, active: 0, paused: 0, completed: 0 };
  rows.forEach((r) => { counts[r.status] += 1; });
  if (AD_STATUS[ctx.query.tab]) rows = rows.filter((r) => r.status === ctx.query.tab);
  if (ctx.query.q) { const q = String(ctx.query.q).toLowerCase(); rows = rows.filter((r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q)); }
  const size = 10; const pages = Math.max(1, Math.ceil(rows.length / size)); const page = Math.min(Math.max(parseInt(ctx.query.page, 10) || 1, 1), pages);
  return { rows: rows.slice((page - 1) * size, page * size), total: rows.length, page, pages, pageSize: size, counts, can_write: ctx.can('ads.write'), note: AD_NOTE };
});
route('GET', '/api/ads/product-ads', { perm: 'ads.read' }, (ctx) => {
  const byProduct = new Map();
  for (const c of all('SELECT * FROM advertising_campaigns WHERE seller_id = ?', ctx.sellerId)) {
    const ids = parseJson(c.product_ids, []);
    const m = adMetrics(c);
    for (const pid of ids) {
      if (!byProduct.has(pid)) byProduct.set(pid, { campaigns: 0, active: 0, impressions: 0, clicks: 0, conversions: 0, spend: 0, revenue: 0, demo: false });
      const row = byProduct.get(pid);
      row.campaigns += 1; if (adStatus(c) === 'active') row.active += 1; if (c.is_demo) row.demo = true;
      // Campaign totals are split evenly across its products (no per-product delivery data is available).
      for (const k of ['impressions', 'clicks', 'conversions', 'spend', 'revenue']) row[k] += m[k] / ids.length;
    }
  }
  const rows = [...byProduct.entries()].map(([pid, r]) => {
    const p = get('SELECT code, title, category, price, (SELECT upload_id FROM product_images WHERE product_id = products.id ORDER BY is_primary DESC, position LIMIT 1) AS image_id FROM products WHERE id = ? AND seller_id = ?', pid, ctx.sellerId);
    return p ? { ...p, campaigns: r.campaigns, active_campaigns: r.active, impressions: Math.round(r.impressions), clicks: Math.round(r.clicks), conversions: Math.round(r.conversions), spend: r2(r.spend), revenue: r2(r.revenue), roas: r.spend ? Math.round((r.revenue / r.spend) * 100) / 100 : 0, is_demo: r.demo } : null;
  }).filter(Boolean).sort((a, b) => b.revenue - a.revenue);
  return { rows, note: AD_NOTE, split_note: 'Campaign totals are divided evenly between the products in each campaign.' };
});
route('GET', '/api/ads/report.csv', { perm: 'ads.read' }, (ctx) => {
  const range = resolveRange(ctx.query, '30d');
  logActivity(ctx, 'Exported advertising report', 'advertising', ctx.query.type || 'campaigns');
  if (ctx.query.type === 'daily') {
    const rows = [];
    for (const c of all('SELECT * FROM advertising_campaigns WHERE seller_id = ?', ctx.sellerId)) for (const m of adMetrics(c, range.from, range.to).rows) rows.push({ date: m.date, code: c.code, name: c.name, ...m, type: c.is_demo ? 'DEMO DATA (sample metrics)' : '' });
    rows.sort((a, b) => (a.date < b.date ? -1 : 1));
    return reply.csv(`nearbuy-ads-daily-${range.from}-to-${range.to}.csv`, toCsv([['date', 'Date'], ['code', 'Campaign ID'], ['name', 'Campaign'], ['impressions', 'Impressions'], ['clicks', 'Clicks'], ['conversions', 'Conversions'], ['spend', 'Spend (INR)'], ['revenue', 'Attributed revenue (INR)'], ['type', 'Record type']], rows));
  }
  const a = adAggregate(ctx.sellerId, range);
  return reply.csv(`nearbuy-ads-campaigns-${range.from}-to-${range.to}.csv`, toCsv([['code', 'Campaign ID'], ['name', 'Campaign'], ['status', 'Status'], ['impressions', 'Impressions'], ['clicks', 'Clicks'], ['ctr', 'CTR %'], ['conversions', 'Conversions'], ['spend', 'Spend (INR)'], ['revenue', 'Attributed revenue (INR)'], ['roas', 'ROAS'], [(r) => (r.is_demo ? 'DEMO DATA (sample metrics)' : ''), 'Record type']], a.campaigns));
});
route('GET', '/api/ads/campaigns/:code', { perm: 'ads.read' }, (ctx) => {
  const c = findCampaign(ctx);
  const view = campaignView(c, true);
  view.products = view.product_ids.map((pid) => get('SELECT id, code, title, price, status FROM products WHERE id = ? AND seller_id = ?', pid, ctx.sellerId)).filter(Boolean);
  return { campaign: view, can_write: ctx.can('ads.write'), note: c.is_demo ? `Sample data: this is a DEMO campaign with illustrative delivery metrics. ${AD_NOTE}` : AD_NOTE };
});
route('POST', '/api/ads/campaigns', { perm: 'ads.write' }, (ctx) => {
  const data = readCampaign(ctx, null);
  const launch = ctx.body.launch === true;
  const code = nextCode('ADC', 600);
  const state = launch ? (data.start_date > istDate() ? 'scheduled' : 'active') : 'draft';
  insert('advertising_campaigns', { seller_id: ctx.sellerId, code, name: data.name, objective: data.objective, product_ids: data.product_ids, daily_budget: data.daily_budget, start_date: data.start_date, end_date: data.end_date, targeting: data.targeting, bid_strategy: data.bid_strategy, bid_amount: data.bid_amount, state, created_at: nowIso(), updated_at: nowIso() });
  logActivity(ctx, launch ? 'Launched ad campaign' : 'Saved ad campaign draft', 'advertising', code, data.name);
  return reply.created({ code, status: state, message: launch ? `Campaign saved as ${AD_STATUS[state]}. No budget is charged — an advertising network is not connected.` : 'Campaign saved as a draft.' });
});
route('PUT', '/api/ads/campaigns/:code', { perm: 'ads.write' }, (ctx) => {
  const c = findCampaign(ctx);
  if (adStatus(c) === 'completed') throw conflict('Completed campaigns cannot be edited.');
  const data = readCampaign(ctx, c);
  run('UPDATE advertising_campaigns SET name = ?, objective = ?, product_ids = ?, daily_budget = ?, start_date = ?, end_date = ?, targeting = ?, bid_strategy = ?, bid_amount = ?, updated_at = ? WHERE id = ? AND seller_id = ?', data.name, data.objective, JSON.stringify(data.product_ids), data.daily_budget, data.start_date, data.end_date, JSON.stringify(data.targeting), data.bid_strategy, data.bid_amount, nowIso(), c.id, ctx.sellerId);
  logActivity(ctx, 'Updated ad campaign', 'advertising', c.code, data.name);
  return { ok: true, code: c.code, message: 'Campaign updated.' };
});
route('POST', '/api/ads/campaigns/:code/status', { perm: 'ads.write' }, (ctx) => {
  const c = findCampaign(ctx);
  const status = adStatus(c);
  const action = ctx.body.action;
  const allowed = { launch: ['draft'], pause: ['active', 'scheduled'], resume: ['paused'], end: ['active', 'scheduled', 'paused'] };
  if (!allowed[action]) throw bad('Unknown campaign action.');
  if (!allowed[action].includes(status)) throw conflict(`A ${AD_STATUS[status].toLowerCase()} campaign cannot be ${{ launch: 'launched', pause: 'paused', resume: 'resumed', end: 'ended' }[action]}.`);
  const today = istDate();
  let state;
  if (action === 'launch') {
    if (c.end_date && c.end_date < today) throw conflict('The end date has passed. Edit the campaign dates first.');
    state = c.start_date > today ? 'scheduled' : 'active';
  } else if (action === 'pause') state = 'paused';
  else if (action === 'resume') state = c.start_date > today ? 'scheduled' : 'active';
  else state = 'completed';
  run('UPDATE advertising_campaigns SET state = ?, updated_at = ? WHERE id = ? AND seller_id = ?', state, nowIso(), c.id, ctx.sellerId);
  logActivity(ctx, `Ad campaign ${action}`, 'advertising', c.code, c.name);
  return { ok: true, status: state, message: `Campaign is now ${AD_STATUS[state].toLowerCase()}. No budget is charged — an advertising network is not connected.` };
});
route('DELETE', '/api/ads/campaigns/:code', { perm: 'ads.write' }, (ctx) => {
  const c = findCampaign(ctx);
  if (c.state !== 'draft') throw conflict('Only draft campaigns can be deleted. End a running campaign instead.');
  run('DELETE FROM advertising_campaigns WHERE id = ? AND seller_id = ?', c.id, ctx.sellerId);
  logActivity(ctx, 'Deleted ad campaign draft', 'advertising', c.code);
  return { ok: true, message: 'Draft deleted.' };
});

module.exports = { promotionPrice, promoStatus, adStatus, AD_OBJECTIVES, AD_PLACEMENTS };
