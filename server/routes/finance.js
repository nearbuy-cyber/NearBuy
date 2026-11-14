'use strict';
// Payments: ledger transactions, settlement statements and reports. Every total is computed from transaction rows.
const { route, reply } = require('../router');
const { get, all, run, tx, insert, nextCode, paged, notify, logActivity } = require('../db');
const { bad, notFound, conflict, nowIso, r2, toCsv, resolveRange, istDate, isYmd, istDayStart, istDayEnd } = require('../lib');
const { Pdf } = require('../pdf');

const TX_TYPES = { sale: 'Sale', platform_fee: 'Platform fee', shipping_fee: 'Shipping charge', tax: 'Tax on fees', refund: 'Refund deduction', adjustment: 'Adjustment' };
const SETTLEMENT_STATUS = {
  awaiting_payout: 'Awaiting payout — bank integration required',
  demo_recorded: 'Demo ledger entry — no bank transfer',
  paid: 'Paid — recorded by marketplace finance',
};

function totals(sellerId, fromIso, toIso) {
  const rows = all('SELECT type, COALESCE(SUM(amount), 0) AS amount, COUNT(*) AS n FROM transactions WHERE seller_id = ? AND created_at BETWEEN ? AND ? GROUP BY type', sellerId, fromIso, toIso);
  const by = Object.fromEntries(rows.map((r) => [r.type, r]));
  const amt = (t) => r2(by[t] ? by[t].amount : 0);
  const sales = amt('sale');
  const taxable = get(`SELECT COALESCE(SUM(o.total - o.tax_total), 0) AS v FROM transactions t JOIN orders o ON o.id = t.order_id WHERE t.seller_id = ? AND t.type = 'sale' AND t.created_at BETWEEN ? AND ?`, sellerId, fromIso, toIso).v;
  return {
    total_sales: sales, orders: by.sale ? by.sale.n : 0, gross_revenue: r2(taxable), platform_fees: Math.abs(amt('platform_fee')), shipping_charges: Math.abs(amt('shipping_fee')),
    taxes_and_deductions: r2(Math.abs(amt('tax')) - amt('adjustment')), refund_deductions: Math.abs(amt('refund')),
    net_settlement: r2(sales + amt('platform_fee') + amt('shipping_fee') + amt('tax') + amt('refund') + amt('adjustment')),
  };
}
function upcomingPayout(sellerId) {
  const unsettled = get('SELECT COALESCE(SUM(amount), 0) AS v, COUNT(DISTINCT order_id) AS orders FROM transactions WHERE seller_id = ? AND settlement_id IS NULL', sellerId);
  const awaiting = get("SELECT COALESCE(SUM(net), 0) AS v, COUNT(*) AS n FROM settlements WHERE seller_id = ? AND status = 'awaiting_payout'", sellerId);
  return { unsettled: r2(unsettled.v), unsettled_orders: unsettled.orders, awaiting_payout: r2(awaiting.v), awaiting_count: awaiting.n, total: r2(unsettled.v + awaiting.v) };
}
function bankView(sellerId) {
  const b = get('SELECT * FROM seller_bank_accounts WHERE seller_id = ?', sellerId);
  if (!b) return null;
  // The full account number never leaves the server.
  return { holder_name: b.holder_name, bank_name: b.bank_name, account_masked: `•••• •••• ${b.account_last4}`, ifsc: b.ifsc, verification_status: b.verification_status, updated_at: b.updated_at };
}

route('GET', '/api/payments/summary', { perm: 'payments.read' }, (ctx) => {
  const range = resolveRange(ctx.query, '30d');
  const summary = totals(ctx.sellerId, range.fromIso, range.toIso);
  const daily = all(`SELECT date(created_at, '+330 minutes') AS day, SUM(CASE WHEN type = 'sale' THEN amount ELSE 0 END) AS gross, SUM(amount) AS net
    FROM transactions WHERE seller_id = ? AND created_at BETWEEN ? AND ? GROUP BY day ORDER BY day`, ctx.sellerId, range.fromIso, range.toIso);
  return {
    range, summary, upcoming: upcomingPayout(ctx.sellerId), daily: daily.map((d) => ({ day: d.day, gross: r2(d.gross), net: r2(d.net) })),
    bank: bankView(ctx.sellerId), has_demo: Boolean(get('SELECT 1 FROM transactions WHERE seller_id = ? AND is_demo = 1 LIMIT 1', ctx.sellerId)),
    can_manage: ctx.can('payments.manage'),
    integration: { payouts_connected: false, note: 'No banking or payout provider is connected. Settlement statements are calculated from your ledger, but money is not transferred by this system.' },
  };
});

function txFilters(ctx) {
  const where = ['t.seller_id = ?'];
  const params = [ctx.sellerId];
  if (TX_TYPES[ctx.query.type]) { where.push('t.type = ?'); params.push(ctx.query.type); }
  if (ctx.query.kind === 'deductions') where.push('t.amount < 0');
  if (ctx.query.settled === 'no') where.push('t.settlement_id IS NULL');
  if (isYmd(ctx.query.from)) { where.push('t.created_at >= ?'); params.push(istDayStart(ctx.query.from)); }
  if (isYmd(ctx.query.to)) { where.push('t.created_at <= ?'); params.push(istDayEnd(ctx.query.to)); }
  return { where, params };
}
const TX_SELECT = 't.code, t.type, t.amount, t.description, t.order_ref, t.created_at, t.is_demo, s.code AS settlement_code';
const TX_FROM = 'transactions t LEFT JOIN settlements s ON s.id = t.settlement_id';
route('GET', '/api/payments/transactions', { perm: 'payments.read' }, (ctx) => {
  const { where, params } = txFilters(ctx);
  const list = paged({
    select: TX_SELECT, from: TX_FROM, where, params, search: { q: ctx.query.q, cols: ['t.code', 't.order_ref', 't.description'] },
    sortMap: { date: 't.created_at', amount: 't.amount' }, sort: ctx.query.sort, defaultSort: 't.created_at DESC, t.id DESC', page: ctx.query.page, pageSize: ctx.query.page_size || 12,
  });
  list.rows.forEach((r) => { r.type_label = TX_TYPES[r.type]; });
  const sum = get(`SELECT COALESCE(SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END), 0) AS credits, COALESCE(SUM(CASE WHEN t.amount < 0 THEN t.amount ELSE 0 END), 0) AS debits, COUNT(*) AS n
    FROM ${TX_FROM} WHERE ${where.join(' AND ')}`, ...params);
  const byType = all(`SELECT t.type, SUM(t.amount) AS amount, COUNT(*) AS n FROM ${TX_FROM} WHERE ${where.join(' AND ')} GROUP BY t.type`, ...params).map((r) => ({ type: r.type, label: TX_TYPES[r.type], amount: r2(r.amount), count: r.n }));
  return { ...list, totals: { credits: r2(sum.credits), debits: r2(sum.debits), net: r2(sum.credits + sum.debits) }, by_type: byType, types: TX_TYPES };
});
route('GET', '/api/payments/statement.csv', { perm: 'payments.read' }, (ctx) => {
  const { where, params } = txFilters(ctx);
  const rows = all(`SELECT ${TX_SELECT} FROM ${TX_FROM} WHERE ${where.join(' AND ')} ORDER BY t.created_at, t.id LIMIT 20000`, ...params);
  let balance = 0;
  rows.forEach((r) => { balance = r2(balance + r.amount); r.balance = balance; });
  logActivity(ctx, 'Downloaded payment statement', 'payment', null, `${rows.length} rows`);
  return reply.csv(`nearbuy-statement-${istDate()}.csv`, toCsv([['code', 'Transaction ID'], ['created_at', 'Date (UTC)'], [(r) => TX_TYPES[r.type], 'Type'], ['order_ref', 'Order reference'], ['description', 'Description'], [(r) => (r.amount > 0 ? r.amount : ''), 'Credit (INR)'], [(r) => (r.amount < 0 ? Math.abs(r.amount) : ''), 'Debit (INR)'], ['balance', 'Running net (INR)'], ['settlement_code', 'Settlement ID'], [(r) => (r.is_demo ? 'DEMO DATA' : ''), 'Record type']], rows));
});

/* ---------- Settlements ---------- */
function settlementFilters(ctx) {
  const where = ['seller_id = ?'];
  const params = [ctx.sellerId];
  if (SETTLEMENT_STATUS[ctx.query.status]) { where.push('status = ?'); params.push(ctx.query.status); }
  if (isYmd(ctx.query.from)) { where.push('settlement_date >= ?'); params.push(istDayStart(ctx.query.from)); }
  if (isYmd(ctx.query.to)) { where.push('settlement_date <= ?'); params.push(istDayEnd(ctx.query.to)); }
  return { where, params };
}
const settlementRow = (s) => ({ code: s.code, settlement_date: s.settlement_date, period_start: s.period_start, period_end: s.period_end, order_refs: s.order_refs, gross: s.gross, fees: s.fees, deductions: s.deductions, net: s.net, status: s.status, status_label: SETTLEMENT_STATUS[s.status], payout_reference: s.payout_reference, is_demo: Boolean(s.is_demo) });
route('GET', '/api/payments/settlements', { perm: 'payments.read' }, (ctx) => {
  const { where, params } = settlementFilters(ctx);
  const list = paged({ select: '*', from: 'settlements', where, params, search: { q: ctx.query.q, cols: ['code', 'order_refs'] }, sortMap: { date: 'settlement_date', net: 'net' }, sort: ctx.query.sort, defaultSort: 'settlement_date DESC', page: ctx.query.page, pageSize: ctx.query.page_size });
  return { ...list, rows: list.rows.map(settlementRow), upcoming: upcomingPayout(ctx.sellerId), statuses: SETTLEMENT_STATUS, can_manage: ctx.can('payments.manage'), bank: bankView(ctx.sellerId) };
});
route('GET', '/api/payments/settlements.csv', { perm: 'payments.read' }, (ctx) => {
  const { where, params } = settlementFilters(ctx);
  const rows = all(`SELECT * FROM settlements WHERE ${where.join(' AND ')} ORDER BY settlement_date DESC LIMIT 5000`, ...params);
  logActivity(ctx, 'Downloaded settlement report', 'payment', null, `${rows.length} rows`);
  return reply.csv(`nearbuy-settlements-${istDate()}.csv`, toCsv([['code', 'Settlement ID'], ['settlement_date', 'Settlement date (UTC)'], ['order_refs', 'Order references'], ['gross', 'Gross amount (INR)'], ['fees', 'Fees (INR)'], ['deductions', 'Deductions (INR)'], ['net', 'Net amount (INR)'], [(r) => SETTLEMENT_STATUS[r.status], 'Payment status'], ['payout_reference', 'Payout reference'], [(r) => (r.is_demo ? 'DEMO DATA' : ''), 'Record type']], rows));
});
function settlementDetail(sellerId, code) {
  const s = get('SELECT * FROM settlements WHERE code = ? AND seller_id = ?', code, sellerId);
  if (!s) throw notFound('Settlement');
  const lines = all('SELECT code, type, amount, description, order_ref, created_at FROM transactions WHERE settlement_id = ? AND seller_id = ? ORDER BY order_ref, id', s.id, sellerId);
  const byOrder = new Map();
  for (const line of lines) {
    const key = line.order_ref || 'Adjustments';
    if (!byOrder.has(key)) byOrder.set(key, { order_ref: key, sale: 0, platform_fee: 0, shipping_fee: 0, tax: 0, refund: 0, adjustment: 0, net: 0 });
    const o = byOrder.get(key);
    o[line.type] = r2(o[line.type] + line.amount);
    o.net = r2(o.net + line.amount);
  }
  const sum = (type) => r2(lines.filter((l) => l.type === type).reduce((a, l) => a + l.amount, 0));
  return {
    settlement: settlementRow(s),
    calculation: [
      { label: 'Sale proceeds', amount: sum('sale') }, { label: 'Commission and closing fees', amount: sum('platform_fee') }, { label: 'Shipping charges', amount: sum('shipping_fee') },
      { label: 'GST on marketplace fees', amount: sum('tax') }, { label: 'Refund deductions', amount: sum('refund') }, { label: 'Adjustments', amount: sum('adjustment') },
    ],
    orders: [...byOrder.values()],
    lines: lines.map((l) => ({ ...l, type_label: TX_TYPES[l.type] })),
    // Recomputed from the transaction rows so the statement can be checked against the stored totals.
    computed_net: r2(lines.reduce((a, l) => a + l.amount, 0)),
  };
}
route('GET', '/api/payments/settlements/:code', { perm: 'payments.read' }, (ctx) => settlementDetail(ctx.sellerId, ctx.params.code));
route('GET', '/api/payments/settlements/:code/report.csv', { perm: 'payments.read' }, (ctx) => {
  const d = settlementDetail(ctx.sellerId, ctx.params.code);
  logActivity(ctx, 'Downloaded settlement report', 'payment', d.settlement.code);
  return reply.csv(`settlement-${d.settlement.code}.csv`, toCsv([['code', 'Transaction ID'], ['created_at', 'Date (UTC)'], ['order_ref', 'Order reference'], ['type_label', 'Type'], ['description', 'Description'], ['amount', 'Amount (INR)']], [...d.lines, { code: '', created_at: '', order_ref: '', type_label: 'NET SETTLEMENT', description: d.settlement.status_label, amount: d.computed_net }]));
});
const inr = (n) => `${n < 0 ? '-' : ''}Rs. ${Math.abs(Number(n || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '-');
route('GET', '/api/payments/settlements/:code/report.pdf', { perm: 'payments.read' }, (ctx) => {
  const d = settlementDetail(ctx.sellerId, ctx.params.code);
  const s = d.settlement;
  const pdf = new Pdf();
  pdf.rect(0, 0, 595, 74, { fill: 0.11, stroke: null });
  pdf.text(40, 34, 'NearBuy', { size: 20, bold: true, color: 1 }).text(40, 54, 'Seller Hub - settlement statement', { size: 10, color: 0.85 });
  pdf.text(555, 34, s.code, { size: 14, bold: true, align: 'right', color: 1 }).text(555, 54, fmtDate(s.settlement_date), { size: 10, align: 'right', color: 0.85 });
  let y = 104;
  pdf.text(40, y, ctx.seller.business_name, { size: 12, bold: true }).text(555, y, `Seller ID ${ctx.seller.code}`, { size: 10, align: 'right' });
  y += 16;
  pdf.text(40, y, `Period: ${fmtDate(s.period_start)} to ${fmtDate(s.period_end)}`, { size: 10 });
  y += 16;
  pdf.text(40, y, `Status: ${s.status_label}${s.payout_reference ? ` (ref ${s.payout_reference})` : ''}`, { size: 10, bold: true });
  if (s.is_demo) pdf.text(555, y, 'DEMO DATA', { size: 10, bold: true, align: 'right', color: 0.45 });
  y += 26;
  pdf.rect(40, y, 515, 22, { fill: 0.94, stroke: null }).text(46, y + 15, 'Calculation', { size: 10, bold: true }).text(549, y + 15, 'Amount', { size: 10, bold: true, align: 'right' });
  y += 22;
  for (const row of d.calculation) { pdf.text(46, y + 15, row.label, { size: 10 }).text(549, y + 15, inr(row.amount), { size: 10, align: 'right' }); y += 20; pdf.line(40, y, 555, y); }
  pdf.text(46, y + 18, 'Net settlement', { size: 12, bold: true }).text(549, y + 18, inr(d.computed_net), { size: 12, bold: true, align: 'right' });
  y += 44;
  pdf.rect(40, y, 515, 22, { fill: 0.94, stroke: null });
  [[46, 'Order', 'left'], [200, 'Sale', 'right'], [280, 'Fees', 'right'], [350, 'Shipping', 'right'], [410, 'Tax', 'right'], [480, 'Refunds', 'right'], [549, 'Net', 'right']].forEach(([x, label, align]) => pdf.text(x, y + 15, label, { size: 9, bold: true, align }));
  y += 22;
  for (const o of d.orders) {
    if (y > 780) { pdf.addPage(); y = 50; }
    pdf.text(46, y + 14, o.order_ref, { size: 9 }).text(200, y + 14, inr(o.sale), { size: 9, align: 'right' }).text(280, y + 14, inr(o.platform_fee), { size: 9, align: 'right' })
      .text(350, y + 14, inr(o.shipping_fee), { size: 9, align: 'right' }).text(410, y + 14, inr(o.tax), { size: 9, align: 'right' }).text(480, y + 14, inr(o.refund), { size: 9, align: 'right' }).text(549, y + 14, inr(o.net), { size: 9, align: 'right' });
    y += 19;
    pdf.line(40, y, 555, y);
  }
  pdf.wrap(40, Math.min(y + 24, 800), 'This statement is calculated from ledger transactions in NearBuy Seller Hub. It is not proof of a bank transfer: no payout provider is connected to this system.', 515, { size: 8 });
  logActivity(ctx, 'Downloaded settlement statement', 'payment', s.code);
  return reply.pdf(`settlement-${s.code}.pdf`, pdf.build());
});

/** Close the current cycle: every unsettled ledger row is grouped into one settlement statement. */
function runSettlement(sellerId, { isDemo = false, status = 'awaiting_payout', at, upTo } = {}) {
  const cutoff = upTo || nowIso();
  const rows = all('SELECT * FROM transactions WHERE seller_id = ? AND settlement_id IS NULL AND created_at <= ? ORDER BY created_at', sellerId, cutoff);
  if (!rows.length) return null;
  const sum = (types) => r2(rows.filter((r) => types.includes(r.type)).reduce((a, r) => a + r.amount, 0));
  const gross = sum(['sale']);
  const fees = Math.abs(sum(['platform_fee', 'shipping_fee']));
  const deductions = r2(-(sum(['tax', 'refund', 'adjustment'])));
  const refs = [...new Set(rows.map((r) => r.order_ref).filter(Boolean))];
  const id = insert('settlements', {
    seller_id: sellerId, code: nextCode('STL', 5000), period_start: rows[0].created_at, period_end: rows[rows.length - 1].created_at, settlement_date: at || nowIso(),
    gross, fees, deductions, net: r2(gross - fees - deductions), status, order_refs: refs.slice(0, 6).join(', ') + (refs.length > 6 ? ` +${refs.length - 6} more` : ''), is_demo: isDemo ? 1 : 0, created_at: at || nowIso(),
  });
  run(`UPDATE transactions SET settlement_id = ? WHERE seller_id = ? AND settlement_id IS NULL AND created_at <= ?`, id, sellerId, cutoff);
  return get('SELECT * FROM settlements WHERE id = ?', id);
}
route('POST', '/api/payments/settlements/run', { perm: 'payments.manage' }, (ctx) => {
  if (!get('SELECT 1 FROM seller_bank_accounts WHERE seller_id = ?', ctx.sellerId)) throw conflict('Add your bank account under Payments → Bank account before closing a settlement cycle.');
  const s = tx(() => runSettlement(ctx.sellerId));
  if (!s) throw conflict('There are no unsettled transactions. Deliver an order first.');
  notify(ctx.sellerId, 'payment', `Settlement ${s.code} generated`, `Net ₹${s.net.toLocaleString('en-IN')} is awaiting payout. No bank transfer was made — a payout integration is not connected.`, `/seller/payments/settlements/${s.code}`);
  logActivity(ctx, 'Closed settlement cycle', 'payment', s.code, `Net ₹${s.net}`);
  return reply.created({ code: s.code, message: `Settlement ${s.code} generated from ${s.order_refs ? 'your unsettled transactions' : 'ledger rows'}. Status: awaiting payout (no bank transfer is made by this system).` });
});
route('GET', '/api/payments/bank', { perm: 'payments.read' }, (ctx) => ({ bank: bankView(ctx.sellerId), can_edit: ctx.can('settings.manage') }));

module.exports = { totals, upcomingPayout, bankView, runSettlement, TX_TYPES, SETTLEMENT_STATUS };
