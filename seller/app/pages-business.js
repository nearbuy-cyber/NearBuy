// Payments, growth insights, promotions, advertising and analytics.
import { h, icon, state, api, ApiError, can, navigate, reload, toast, download, field, onSubmit, readForm, showErrors, clearErrors, formModal, confirmDialog, busy, banner, demoBanner, integrationNote, badge, statusBadge, demoTag, thumb, pageHead, card, statCard, tabs, subnav, dataTable, pager, searchBox, selectFilter, rangeFilter, rangeQuery, emptyState, kv, chart, lineChart, barChart, fmt, inr, num, fmtDate, fmtDateTime, hrefWith, currentQuery, setQuery, todayYmd, titleCase, refreshMe } from './core.js';

/* ---------- Payments ---------- */
const PAY_NAV = [['Overview', '/seller/payments'], ['Transactions', '/seller/payments/transactions'], ['Settlements', '/seller/payments/settlements'], ['Upcoming payments', '/seller/payments/upcoming'], ['Deductions', '/seller/payments/deductions'], ['Statements', '/seller/payments/statements'], ['Bank account', '/seller/payments/bank-account']];
const payoutNote = () => integrationNote('No payout or banking system is connected. Settlements are statements of what you are owed; this system never moves money and never reports a bank transfer that did not happen. Real payouts need a payment-gateway or bank payout API.');
const amount = (v) => h('span', { class: v < 0 ? 'neg' : v > 0 ? 'pos' : '' }, inr(v));
const bankLine = (bank) => (bank ? `${bank.bank_name} ${bank.account_masked}` : 'No bank account added');

export async function paymentsOverview() {
  const d = await api('/payments/summary', { query: rangeQuery() });
  const s = d.summary;
  return h('div.stack', pageHead({ title: 'Payments', subtitle: 'What you earned, what was deducted and what is still to be settled.', trail: ['Payments'], actions: [h('a.btn', { href: '/seller/payments/statements' }, icon('download', 'sm'), 'Statements')] }), subnav(PAY_NAV),
    d.has_demo ? demoBanner('Amounts here come from sample orders marked DEMO DATA. Demo settlements are ledger records only.') : null,
    h('div.row.between.wrap', rangeFilter('30d', [['all', 'All time']]), h('span.small.muted', d.range.label)),
    h('div.grid.c4',
      statCard({ label: 'Total sales', value: inr(s.total_sales), hint: `${s.orders} delivered order${s.orders === 1 ? '' : 's'}`, ico: 'cart', tone: 'orange' }), statCard({ label: 'Gross revenue', value: inr(s.gross_revenue), hint: 'Sales excluding GST collected', ico: 'trending', tone: 'green' }),
      statCard({ label: 'Platform fees', value: inr(-s.platform_fees), hint: 'Commission and closing fee', ico: 'percent', tone: 'violet' }), statCard({ label: 'Shipping charges', value: inr(-s.shipping_charges), hint: 'Weight-slab shipping fees', ico: 'truck' }),
      statCard({ label: 'Taxes and deductions', value: inr(-s.taxes_and_deductions), hint: 'GST on fees and adjustments', ico: 'receipt', tone: 'amber' }), statCard({ label: 'Refund deductions', value: inr(-s.refund_deductions), hint: 'Completed returns', ico: 'undo', tone: 'red' }),
      statCard({ label: 'Net settlement', value: inr(s.net_settlement), hint: 'Sales minus all deductions', ico: 'wallet', tone: 'green' }), statCard({ label: 'Upcoming payment', value: inr(d.upcoming.total), hint: `${d.upcoming.unsettled_orders} unsettled order${d.upcoming.unsettled_orders === 1 ? '' : 's'}`, ico: 'clock', tone: 'orange', href: '/seller/payments/upcoming' })),
    h('div.grid.c2-1',
      card({ title: 'Sales and net proceeds', subtitle: 'By delivery date', body: lineChart({ labels: d.daily.map((x) => fmtDate(x.day).slice(0, 6)), series: [{ name: 'Gross sales', data: d.daily.map((x) => x.gross), format: 'inr' }, { name: 'Net proceeds', data: d.daily.map((x) => x.net), format: 'inr', tone: 'green' }] }) }),
      card({ title: 'Payout account', actions: h('a.btn.sm', { href: '/seller/payments/bank-account' }, 'Manage'), body: d.bank ? kv([['Account holder', d.bank.holder_name], ['Bank', d.bank.bank_name], ['Account', d.bank.account_masked], ['IFSC', d.bank.ifsc], ['Verification', badge('Not verified', 'amber')]]) : emptyState({ ico: 'bank', title: 'No bank account', text: 'Add a bank account before closing a settlement cycle.', action: h('a.btn.primary', { href: '/seller/payments/bank-account' }, 'Add bank account') }) })),
    payoutNote());
}

export async function transactions(ctx) { return ledgerPage(ctx, { title: 'Transactions', subtitle: 'Every sale, fee, tax and refund written to your ledger.', path: '/seller/payments/transactions', query: {} }); }
export async function deductions(ctx) { return ledgerPage(ctx, { title: 'Deductions', subtitle: 'Platform fees, shipping charges, tax on fees and refund deductions.', path: '/seller/payments/deductions', query: { kind: 'deductions' } }); }
async function ledgerPage(ctx, { title, subtitle, path, query }) {
  const q = ctx.query;
  const filters = { ...query, type: q.type, q: q.q, from: q.from, to: q.to, sort: q.sort, page: q.page };
  const data = await api('/payments/transactions', { query: filters });
  const from = h('input.input.sm', { type: 'date', value: q.from || '', max: todayYmd(), 'aria-label': 'From date', style: { width: 'auto' }, onChange: (e) => setQuery({ from: e.target.value, page: null }) });
  const to = h('input.input.sm', { type: 'date', value: q.to || '', max: todayYmd(), 'aria-label': 'To date', style: { width: 'auto' }, onChange: (e) => setQuery({ to: e.target.value, page: null }) });
  const types = Object.entries(data.types).filter(([key]) => !query.kind || key !== 'sale');
  const filtered = q.type || q.q || q.from || q.to;
  return h('div.stack', pageHead({ title, subtitle, trail: [['Payments', '/seller/payments'], title], actions: [h('button.btn', { type: 'button', onClick: () => download('/payments/statement.csv', { ...query, type: q.type, q: q.q, from: q.from, to: q.to }) }, icon('download', 'sm'), 'Export CSV')] }), subnav(PAY_NAV),
    h('div.grid.c3', statCard({ label: 'Credits', value: inr(data.totals.credits), ico: 'plus', tone: 'green', hint: 'In the current filter' }), statCard({ label: 'Debits', value: inr(data.totals.debits), ico: 'receipt', tone: 'red', hint: 'In the current filter' }), statCard({ label: 'Net', value: inr(data.totals.net), ico: 'wallet', tone: 'orange', hint: `${data.total} transaction${data.total === 1 ? '' : 's'}` })),
    query.kind && data.by_type.length ? card({ title: 'Deductions by type', flush: true, body: dataTable({ compact: true, rows: data.by_type, columns: [{ label: 'Type', render: (r) => h('a', { href: hrefWith({ type: r.type, page: null }) }, r.label) }, { label: 'Entries', align: 'right', render: (r) => num(r.count) }, { label: 'Amount', align: 'right', render: (r) => amount(r.amount) }] }) }) : null,
    h('div.card', h('div.toolbar', searchBox('Search by transaction ID, order ID or description'), selectFilter('type', types, 'All types'), h('div.row', from, h('span.small.muted', 'to'), to), filtered ? h('a.btn.sm.ghost', { href: path }, 'Clear filters') : null),
      dataTable({ rows: data.rows, sort: q.sort, columns: [
        { label: 'Transaction', render: (t) => h('div', h('b.strong', t.code), ' ', demoTag(t.is_demo)) }, { label: 'Date', sort: 'date', render: (t) => h('span.nowrap', fmtDateTime(t.created_at)) }, { label: 'Type', render: (t) => badge(t.type_label, t.type === 'sale' ? 'green' : t.type === 'refund' ? 'red' : '') },
        { label: 'Order', render: (t) => (t.order_ref ? h('a', { href: `/seller/orders/${t.order_ref}` }, t.order_ref) : '—') }, { label: 'Description', render: (t) => t.description }, { label: 'Settlement', render: (t) => (t.settlement_code ? h('a', { href: `/seller/payments/settlements/${t.settlement_code}` }, t.settlement_code) : badge('Unsettled', 'amber')) },
        { label: 'Amount', sort: 'amount', align: 'right', render: (t) => h('b', amount(t.amount)) }],
        empty: emptyState(filtered ? { ico: 'search', title: 'No transactions match your filters', action: h('a.btn', { href: path }, 'Clear filters') } : { ico: 'wallet', title: 'No transactions yet', text: 'Ledger entries are written when an order is delivered or a refund is recorded.' }) }), data.rows.length ? pager(data) : null));
}

async function closeCycle(button) {
  if (!(await confirmDialog({ title: 'Close the settlement cycle?', message: 'All unsettled ledger entries are grouped into one settlement statement with the status "Awaiting payout". No bank transfer is made by this system.', confirmLabel: 'Generate settlement' }))) return;
  await busy(button, async () => { const r = await api('/payments/settlements/run', { method: 'POST', body: {} }); toast(r.message, 'success'); navigate(`/seller/payments/settlements/${r.code}`); });
}
export async function settlements(ctx) {
  const q = ctx.query;
  const data = await api('/payments/settlements', { query: { q: q.q, status: q.status, from: q.from, to: q.to, sort: q.sort, page: q.page } });
  const run = data.can_manage ? h('button.btn.primary', { type: 'button', disabled: !data.upcoming.unsettled, title: data.upcoming.unsettled ? '' : 'There are no unsettled transactions', onClick: (e) => closeCycle(e.currentTarget) }, 'Close settlement cycle') : null;
  return h('div.stack', pageHead({ title: 'Settlements', subtitle: 'Statements that group your ledger entries into amounts owed to you.', trail: [['Payments', '/seller/payments'], 'Settlements'], actions: [h('button.btn', { type: 'button', onClick: () => download('/payments/settlements.csv', { q: q.q, status: q.status }) }, icon('download', 'sm'), 'Export CSV'), run] }), subnav(PAY_NAV), payoutNote(),
    h('div.card', h('div.toolbar', searchBox('Search by settlement ID or order ID'), selectFilter('status', Object.entries(data.statuses).map(([k, v]) => [k, v.split(' — ')[0]]), 'All statuses'), h('span.spacer'), h('span.small.muted', `Payout account: ${bankLine(data.bank)}`)),
      dataTable({ rows: data.rows, sort: q.sort, columns: [
        { label: 'Settlement', render: (s) => h('div', h('a.strong', { href: `/seller/payments/settlements/${s.code}` }, s.code), ' ', demoTag(s.is_demo)) }, { label: 'Date', sort: 'date', render: (s) => h('span.nowrap', fmtDate(s.settlement_date)) }, { label: 'Period', render: (s) => h('span.nowrap.small', `${fmtDate(s.period_start)} – ${fmtDate(s.period_end)}`) },
        { label: 'Gross', align: 'right', render: (s) => inr(s.gross) }, { label: 'Fees', align: 'right', render: (s) => inr(-s.fees) }, { label: 'Deductions', align: 'right', render: (s) => inr(-s.deductions) }, { label: 'Net', sort: 'net', align: 'right', render: (s) => h('b', inr(s.net)) },
        { label: 'Status', render: (s) => h('span', { title: s.status_label }, statusBadge(s.status, s.status_label.split(' — ')[0])) }, { label: '', cls: 'actions', render: (s) => h('a.btn.sm', { href: `/seller/payments/settlements/${s.code}` }, 'Details') }],
        empty: emptyState(q.q || q.status ? { ico: 'search', title: 'No settlements match your filters' } : { ico: 'bank', title: 'No settlements yet', text: 'Deliver an order, then close the settlement cycle to generate your first statement.' }) }), data.rows.length ? pager(data) : null));
}

export async function settlementDetail(ctx) {
  const d = await api(`/payments/settlements/${ctx.params.code}`);
  const s = d.settlement;
  return h('div.stack.lg', pageHead({ title: `Settlement ${s.code}`, trail: [['Payments', '/seller/payments'], ['Settlements', '/seller/payments/settlements'], s.code], tag: [statusBadge(s.status, s.status_label.split(' — ')[0]), ' ', demoTag(s.is_demo)], subtitle: `Generated ${fmtDateTime(s.settlement_date)} · Period ${fmtDate(s.period_start)} – ${fmtDate(s.period_end)}`, actions: [
    h('button.btn', { type: 'button', onClick: () => download(`/payments/settlements/${s.code}/report.csv`) }, icon('download', 'sm'), 'CSV report'), h('button.btn.primary', { type: 'button', onClick: () => download(`/payments/settlements/${s.code}/report.pdf`) }, icon('file', 'sm'), 'PDF statement')] }),
    s.status === 'paid' ? banner('success', [h('b', 'Paid. '), `Marketplace finance recorded bank reference ${s.payout_reference}.`]) : s.status === 'demo_recorded' ? banner('demo', [h('b', 'DEMO DATA. '), 'This settlement belongs to the sample data set. It is a ledger record only — no payout was made or is owed.']) : banner('warn', [h('b', 'Awaiting payout. '), 'This statement shows what you are owed. It has not been paid: no bank transfer is made by this system, and it will only show as paid when marketplace finance records a bank reference.']),
    h('div.grid.c2',
      card({ title: 'Settlement calculation', body: h('table.calc', { style: { width: '100%', borderCollapse: 'collapse' } }, h('tbody', [...d.calculation, { label: 'Net settlement', amount: s.net }].map((row) => h('tr', h('td', row.label), h('td.right.mono', inr(row.amount, { decimals: 2 })))))) }),
      card({ title: 'Summary', body: kv([['Settlement ID', s.code], ['Status', s.status_label], ['Orders included', num(d.orders.length)], ['Ledger entries', num(d.lines.length)], ['Net amount', h('b', inr(s.net, { decimals: 2 }))], ['Recalculated from entries', `${inr(d.computed_net, { decimals: 2 })} ${Math.abs(d.computed_net - s.net) < 0.01 ? '✓ matches' : '— mismatch'}`], ['Bank reference', s.payout_reference || 'None — not paid']]) })),
    card({ title: 'Order-wise breakdown', flush: true, body: dataTable({ compact: true, rows: d.orders, columns: [
      { label: 'Order', render: (o) => (o.order_ref ? h('a.strong', { href: `/seller/orders/${o.order_ref}` }, o.order_ref) : 'Adjustment') }, { label: 'Sale', align: 'right', render: (o) => inr(o.sale) }, { label: 'Platform fee', align: 'right', render: (o) => inr(o.platform_fee) }, { label: 'Shipping', align: 'right', render: (o) => inr(o.shipping_fee) },
      { label: 'Tax on fees', align: 'right', render: (o) => inr(o.tax) }, { label: 'Refunds', align: 'right', render: (o) => inr(o.refund) }, { label: 'Net', align: 'right', render: (o) => h('b', inr(o.net)) }] }) }),
    card({ title: 'Ledger entries', flush: true, body: dataTable({ compact: true, rows: d.lines, columns: [{ label: 'Transaction', key: 'code' }, { label: 'Date', render: (t) => h('span.nowrap', fmtDateTime(t.created_at)) }, { label: 'Type', key: 'type_label' }, { label: 'Description', key: 'description' }, { label: 'Amount', align: 'right', render: (t) => amount(t.amount) }] }) }));
}

export async function upcomingPayments(ctx) {
  const q = ctx.query;
  const [list, tx] = await Promise.all([api('/payments/settlements', { query: { status: 'awaiting_payout' } }), api('/payments/transactions', { query: { settled: 'no', page: q.page } })]);
  const up = list.upcoming;
  return h('div.stack', pageHead({ title: 'Upcoming payments', subtitle: 'Amounts you are owed that have not been paid out.', trail: [['Payments', '/seller/payments'], 'Upcoming payments'], actions: [list.can_manage ? h('button.btn.primary', { type: 'button', disabled: !up.unsettled, onClick: (e) => closeCycle(e.currentTarget) }, 'Close settlement cycle') : null] }), subnav(PAY_NAV),
    h('div.grid.c3', statCard({ label: 'Not yet in a settlement', value: inr(up.unsettled), hint: `${up.unsettled_orders} order${up.unsettled_orders === 1 ? '' : 's'}`, ico: 'clock', tone: 'amber' }), statCard({ label: 'Awaiting payout', value: inr(up.awaiting_payout), hint: `${up.awaiting_count} settlement${up.awaiting_count === 1 ? '' : 's'}`, ico: 'bank', tone: 'orange' }), statCard({ label: 'Total upcoming', value: inr(up.total), hint: bankLine(list.bank), ico: 'wallet', tone: 'green' })),
    payoutNote(),
    card({ title: 'Settlements awaiting payout', flush: true, body: dataTable({ rows: list.rows, columns: [{ label: 'Settlement', render: (s) => h('a.strong', { href: `/seller/payments/settlements/${s.code}` }, s.code) }, { label: 'Generated', render: (s) => fmtDate(s.settlement_date) }, { label: 'Net', align: 'right', render: (s) => h('b', inr(s.net)) }, { label: 'Status', render: () => badge('Awaiting payout', 'amber') }], empty: emptyState({ ico: 'bank', title: 'Nothing awaiting payout', text: 'Settlements you generate appear here until marketplace finance records a payout.' }) }) }),
    card({ title: 'Unsettled ledger entries', subtitle: 'Included in the next settlement cycle', flush: true, body: h('div', dataTable({ compact: true, rows: tx.rows, columns: [{ label: 'Transaction', render: (t) => h('span', h('b.strong', t.code), ' ', demoTag(t.is_demo)) }, { label: 'Date', render: (t) => h('span.nowrap', fmtDateTime(t.created_at)) }, { label: 'Type', key: 'type_label' }, { label: 'Order', render: (t) => (t.order_ref ? h('a', { href: `/seller/orders/${t.order_ref}` }, t.order_ref) : '—') }, { label: 'Amount', align: 'right', render: (t) => amount(t.amount) }], empty: emptyState({ ico: 'check', title: 'No unsettled entries', text: 'Everything in your ledger has been included in a settlement.' }) }), tx.rows.length ? pager(tx) : null) }));
}

export async function statements(ctx) {
  const q = ctx.query;
  const range = { from: q.from, to: q.to };
  const from = h('input.input', { type: 'date', value: q.from || '', max: todayYmd(), 'aria-label': 'Statement from' });
  const to = h('input.input', { type: 'date', value: q.to || '', max: todayYmd(), 'aria-label': 'Statement to' });
  const check = () => { if (from.value && to.value && from.value > to.value) { toast('The start date must be on or before the end date.', 'error'); return false; } setQuery({ from: from.value, to: to.value }); return true; };
  const list = await api('/payments/settlements', { query: { page_size: 5 } });
  const dl = (label, path, query, text) => h('div.row.between.wrap', { style: { padding: '12px 0', borderBottom: '1px solid var(--line)' } }, h('div', h('b.strong', label), h('div.small.muted', text)), h('button.btn', { type: 'button', onClick: () => { if (check()) download(path, { ...query, from: from.value, to: to.value }); } }, icon('download', 'sm'), 'Download CSV'));
  return h('div.stack', pageHead({ title: 'Statements and reports', subtitle: 'Download your ledger for accounting and reconciliation.', trail: [['Payments', '/seller/payments'], 'Statements'] }), subnav(PAY_NAV),
    card({ title: 'Statement period', subtitle: 'Leave both dates empty to download everything.', body: h('div.stack', h('div.form-grid', h('div.field', h('label', 'From'), from), h('div.field', h('label', 'To'), to)), range.from || range.to ? h('p.small.muted', `Selected: ${range.from ? fmtDate(range.from) : 'the beginning'} to ${range.to ? fmtDate(range.to) : 'today'}`) : null) }),
    card({ title: 'Reports', body: h('div', dl('Transaction statement', '/payments/statement.csv', {}, 'Every sale, fee, tax and refund entry with its settlement reference.'), dl('Deductions report', '/payments/statement.csv', { kind: 'deductions' }, 'Platform fees, shipping charges, tax on fees and refunds only.'), dl('Unsettled entries', '/payments/statement.csv', { settled: 'no' }, 'Ledger entries not yet included in a settlement.'),
      h('div.row.between.wrap', { style: { padding: '12px 0' } }, h('div', h('b.strong', 'Settlement summary'), h('div.small.muted', 'One row per settlement with gross, fees, deductions and net.')), h('button.btn', { type: 'button', onClick: () => download('/payments/settlements.csv') }, icon('download', 'sm'), 'Download CSV'))) }),
    card({ title: 'Recent settlement statements', flush: true, actions: h('a.btn.sm', { href: '/seller/payments/settlements' }, 'All settlements'), body: dataTable({ compact: true, rows: list.rows, columns: [{ label: 'Settlement', render: (s) => h('span', h('a.strong', { href: `/seller/payments/settlements/${s.code}` }, s.code), ' ', demoTag(s.is_demo)) }, { label: 'Date', render: (s) => fmtDate(s.settlement_date) }, { label: 'Net', align: 'right', render: (s) => inr(s.net) },
      { label: '', cls: 'actions', render: (s) => h('span.row', { style: { justifyContent: 'flex-end' } }, h('button.btn.sm', { type: 'button', onClick: () => download(`/payments/settlements/${s.code}/report.pdf`) }, 'PDF'), h('button.btn.sm', { type: 'button', onClick: () => download(`/payments/settlements/${s.code}/report.csv`) }, 'CSV')) }], empty: emptyState({ ico: 'file', title: 'No settlement statements yet' }) }) }));
}

export function bankForm(bank, after) {
  const form = h('form.stack', h('div', { dataset: { formError: '' } }), h('div.form-grid',
    field({ name: 'holder_name', label: 'Account holder name', required: true, value: bank ? bank.holder_name : '' }), field({ name: 'bank_name', label: 'Bank name', required: true, value: bank ? bank.bank_name : '' }),
    field({ name: 'account_number', label: bank ? 'New account number' : 'Account number', type: 'password', required: true, inputmode: 'numeric', autocomplete: 'off', hint: '9–18 digits. Stored encrypted on the server.' }), field({ name: 'confirm_account_number', label: 'Confirm account number', required: true, inputmode: 'numeric' }),
    field({ name: 'ifsc', label: 'IFSC code', required: true, value: bank ? bank.ifsc : '', maxlength: 11, placeholder: 'HDFC0001234' }), bank ? field({ name: 'current_password', label: 'Your password', type: 'password', required: true, hint: 'Needed to change payout details.' }) : null),
    h('div.form-actions', h('button.btn.primary', { type: 'submit' }, bank ? 'Replace bank account' : 'Save bank account')));
  onSubmit(form, async (v) => { const r = await api('/settings/bank', { method: 'PUT', body: v }); toast(r.message || 'Bank details saved.', 'success'); if (after) after(); else reload(); });
  return form;
}
export async function bankAccount() {
  const d = await api('/payments/bank');
  const b = d.bank;
  return h('div.stack', pageHead({ title: 'Bank account', subtitle: 'The account your settlements are addressed to.', trail: [['Payments', '/seller/payments'], 'Bank account'] }), subnav(PAY_NAV),
    h('div.grid.c2', card({ title: 'Saved account', body: b ? h('div.stack', kv([['Account holder', b.holder_name], ['Bank', b.bank_name], ['Account number', b.account_masked], ['IFSC', b.ifsc], ['Verification', badge('Not verified', 'amber')], ['Last updated', fmtDateTime(b.updated_at)]]), h('p.small.muted', icon('lock', 'sm'), ' The full account number is encrypted on the server and is never sent back to the browser.')) : emptyState({ ico: 'bank', title: 'No bank account yet', text: d.can_edit ? 'Add the account that should receive your settlements.' : 'Only the store owner can add bank details.' }) }),
      d.can_edit ? card({ title: b ? 'Replace bank account' : 'Add bank account', body: bankForm(b) }) : card({ title: 'Changing bank details', body: h('p.muted', 'Only the store owner can add or change the payout account.') })),
    integrationNote('Bank accounts are not verified. Confirming that an account exists and belongs to you needs a bank verification (penny-drop) API.'));
}

/* ---------- Generic report renderer (analytics + growth) ---------- */
function reportTable(table) {
  if (!table) return null;
  const columns = table.columns.map((c) => ({ label: c.label, align: c.align, render: (row) => {
    const v = row[c.key];
    if (c.link === 'product' && row.code) return h('a.strong', { href: `/seller/products/${row.code}` }, v);
    if (c.format === 'status') return statusBadge(String(v).toLowerCase().replace(/ /g, '_'), row[`${c.key}_label`] || titleCase(v));
    if (c.format === 'delta') return v === null || v === undefined ? '—' : h('span', { class: v > 0 ? 'pos' : v < 0 ? 'neg' : '' }, fmt(v, 'delta'));
    return fmt(v, c.format);
  } }));
  return card({ title: table.title, flush: true, body: dataTable({ compact: true, rows: table.rows, columns, empty: emptyState({ ico: 'chart', title: 'Nothing to show', text: table.empty || 'There is no data for this period yet.' }) }) });
}
const KPI_ICONS = ['trending', 'cart', 'wallet', 'chart', 'box', 'target'];
const KPI_TONES = ['orange', '', 'green', 'violet', 'amber', ''];
function reportBody(d) {
  return [
    d.sample ? banner('demo', [h('b', 'Sample or estimated data. '), d.sample === true ? 'Figures on this page are illustrative.' : d.sample]) : null,
    d.kpis && d.kpis.length ? h('div.grid.c4', d.kpis.map((k, i) => statCard({ label: k.label, value: fmt(k.value, k.format), hint: k.hint, delta: k.delta, ico: KPI_ICONS[i % 6], tone: KPI_TONES[i % 6] }))) : null,
    d.charts && d.charts.length ? h('div.grid.c2', d.charts.map((c) => h('div', { class: c.span === 2 ? 'span-all' : '' }, card({ title: c.title, subtitle: c.note, body: chart(c) })))) : null,
    d.insights && d.insights.length ? card({ title: 'What to do next', flush: true, body: h('div', d.insights.map((it) => h('div.insight', h(`span.action-count.${it.tone || 'info'}`, icon(it.tone === 'danger' || it.tone === 'warning' ? 'alert' : it.tone === 'success' ? 'check' : 'sparkle')), h('div.grow', h('div.row.wrap', h('b.strong', it.title), it.tag ? badge(it.tag, '') : null), h('div.small.muted', it.detail)), it.link ? h('a.btn.sm', { href: it.link }, it.link_label || 'Open') : null))) }) : d.insights ? card({ body: emptyState({ ico: 'check', title: 'No recommendations right now', text: 'Nothing in your store needs attention on this page.' }) }) : null,
    reportTable(d.table),
  ];
}

const REPORTS = [['sales', 'Sales'], ['revenue', 'Revenue'], ['products', 'Products'], ['categories', 'Categories'], ['orders', 'Orders'], ['returns', 'Returns'], ['inventory', 'Inventory'], ['customers', 'Customers'], ['advertising', 'Advertising']];
export async function analytics(ctx) {
  const report = ctx.params.report || 'sales';
  if (!REPORTS.some(([key]) => key === report)) throw new ApiError(404, { error: 'There is no analytics report with that name.' });
  const d = await api(`/analytics/${report}`, { query: rangeQuery() });
  return h('div.stack', pageHead({ title: d.title, subtitle: d.subtitle, trail: [['Analytics', '/seller/analytics'], REPORTS.find(([key]) => key === report)[1]], actions: [d.exportable === false ? null : h('button.btn', { type: 'button', onClick: () => download(`/analytics/${report}/export.csv`, rangeQuery()) }, icon('download', 'sm'), 'Export CSV')] }),
    subnav(REPORTS.map(([key, label]) => [label, `/seller/analytics/${key}`]), `/seller/analytics/${report}`),
    h('div.row.between.wrap', rangeFilter('30d'), h('span.small.muted', `${d.range.label} · ${fmtDate(d.range.from)} – ${fmtDate(d.range.to)}`)),
    d.has_demo ? demoBanner('These reports are calculated from your store records, which include sample orders marked DEMO DATA.') : null, reportBody(d));
}

const GROWTH = [['overview', 'Overview'], ['opportunities', 'Product opportunities'], ['recommendations', 'Product recommendations'], ['trending', 'Trending categories'], ['pricing', 'Price recommendations'], ['selection', 'Selection insights'], ['sales-growth', 'Sales growth']];
const growthNav = (active) => subnav([...GROWTH.map(([key, label]) => [label, key === 'overview' ? '/seller/growth' : `/seller/growth/${key}`]), ['Promotions', '/seller/growth/promotions']], active);
export async function growth(ctx) {
  const page = ctx.params.page || 'overview';
  if (!GROWTH.some(([key]) => key === page)) throw new ApiError(404, { error: 'There is no growth page with that name.' });
  const d = await api(`/growth/${page}`);
  return h('div.stack', pageHead({ title: d.title, subtitle: d.subtitle, trail: page === 'overview' ? ['Growth'] : [['Growth', '/seller/growth'], GROWTH.find(([key]) => key === page)[1]], actions: [can('growth.write') ? h('a.btn.primary', { href: '/seller/growth/promotions/new' }, icon('tag', 'sm'), 'Create promotion') : null] }),
    growthNav(page === 'overview' ? '/seller/growth' : `/seller/growth/${page}`), reportBody(d));
}

/* ---------- Promotions ---------- */
const PROMO_TABS = [['all', 'All'], ['active', 'Active'], ['scheduled', 'Scheduled'], ['paused', 'Paused'], ['draft', 'Drafts'], ['expired', 'Expired']];
const discountText = (p) => (p.discount_type === 'percentage' ? `${p.discount_value}% off` : `${inr(p.discount_value)} off`);
async function promoAction(code, action, label) {
  if (action === 'end' && !(await confirmDialog({ title: 'End this promotion?', message: 'Promotion prices stop applying immediately. This cannot be undone.', confirmLabel: 'End promotion', danger: true }))) return;
  try { const r = await api(`/promotions/${code}/status`, { method: 'POST', body: { action } }); toast(r.message || `Promotion ${label}.`, 'success'); reload(); } catch (err) { toast(err.message, 'error'); }
}
function promoButtons(p, write, small = true) {
  if (!write) return [];
  const cls = small ? 'button.btn.sm' : 'button.btn';
  return [
    p.status === 'draft' ? h(`${cls}.primary`, { type: 'button', onClick: () => promoAction(p.code, 'publish', 'published') }, 'Publish') : null,
    ['active', 'scheduled'].includes(p.status) ? h(cls, { type: 'button', onClick: () => promoAction(p.code, 'pause', 'paused') }, 'Pause') : null,
    p.status === 'paused' ? h(`${cls}.primary`, { type: 'button', onClick: () => promoAction(p.code, 'resume', 'resumed') }, 'Resume') : null,
    ['active', 'scheduled', 'paused'].includes(p.status) ? h(`${cls}.danger`, { type: 'button', onClick: () => promoAction(p.code, 'end', 'ended') }, 'End') : null,
  ];
}
export async function promotions(ctx) {
  const q = ctx.query;
  const tab = q.tab || 'all';
  const data = await api('/promotions', { query: { tab, q: q.q, page: q.page } });
  return h('div.stack', pageHead({ title: 'Promotions', subtitle: 'Time-bound discounts on your own listings. Promotion prices are applied to new orders while a promotion is active.', trail: [['Growth', '/seller/growth'], 'Promotions'], actions: [data.can_write ? h('a.btn.primary', { href: '/seller/growth/promotions/new' }, icon('plus', 'sm'), 'Create promotion') : null] }), growthNav('/seller/growth/promotions'),
    h('div.card', tabs(PROMO_TABS.map(([key, label]) => ({ key, label, count: data.counts[key] })), tab, (key) => hrefWith({ tab: key === 'all' ? null : key, page: null })), h('div.toolbar', searchBox('Search promotions by name or ID')),
      dataTable({ rows: data.rows, columns: [
        { label: 'Promotion', render: (p) => h('div', h('a.strong', { href: `/seller/growth/promotions/${p.code}` }, p.name), ' ', demoTag(p.is_demo), h('div.small.muted', p.code)) }, { label: 'Discount', render: (p) => discountText(p) }, { label: 'Products', align: 'right', render: (p) => num(p.product_count) },
        { label: 'Runs', render: (p) => h('span.nowrap', `${fmtDate(p.start_date)} – ${fmtDate(p.end_date)}`) }, { label: 'Budget', align: 'right', render: (p) => (p.budget ? inr(p.budget) : '—') }, { label: 'Status', render: (p) => statusBadge(p.status === 'expired' ? 'expired' : p.status, p.status_label) },
        { label: '', cls: 'actions', render: (p) => h('span.row', { style: { justifyContent: 'flex-end' } }, promoButtons(p, data.can_write), h('a.btn.sm', { href: `/seller/growth/promotions/${p.code}` }, 'View')) }],
        empty: emptyState(q.q ? { ico: 'search', title: 'No promotions match your search' } : { ico: 'tag', title: tab === 'all' ? 'No promotions yet' : 'No promotions with this status', text: 'Create a promotion to run a discount on selected products for a fixed period.', action: data.can_write ? h('a.btn.primary', { href: '/seller/growth/promotions/new' }, 'Create promotion') : null }) }), data.rows.length ? pager(data) : null));
}

function productPicker(products, selected, name = 'product_ids') {
  const filter = h('input.input.sm', { type: 'search', placeholder: 'Filter products…', 'aria-label': 'Filter products' });
  const count = h('span.small.muted');
  const list = h('div.pick-list');
  const draw = () => {
    const term = filter.value.trim().toLowerCase();
    const shown = products.filter((p) => !term || `${p.title} ${p.code} ${p.category}`.toLowerCase().includes(term));
    list.replaceChildren(...(shown.length ? shown.map((p) => h('label', h('input', { type: 'checkbox', checked: selected.has(p.id), onChange: (e) => { if (e.target.checked) selected.add(p.id); else selected.delete(p.id); sync(); } }), h('div.grow', h('b.strong', p.title), h('div.small.muted', `${p.code} · ${p.category} · ${inr(p.price)}${p.status && p.status !== 'active' ? ` · ${titleCase(p.status)}` : ''}`)))) : [h('div.empty', { style: { padding: '18px' } }, h('p', products.length ? 'No products match the filter.' : 'You have no eligible products. Add and activate a product first.'))]));
  };
  const listeners = [];
  const sync = () => { count.textContent = `${selected.size} selected`; listeners.forEach((fn) => fn()); };
  filter.addEventListener('input', draw);
  draw(); sync();
  const el = h('div.field.full', { dataset: { field: name } }, h('div.row.between', h('span.label', 'Products ', h('span.req', '*')), count), filter, list, h('div.error', { hidden: true }));
  el.onPick = (fn) => listeners.push(fn);
  return el;
}

export async function promotionForm(ctx) {
  const editing = Boolean(ctx.params.code);
  const [{ products }, existing] = await Promise.all([api('/promotions/products'), editing ? api(`/promotions/${ctx.params.code}`) : null]);
  if (!can('growth.write')) throw new ApiError(403, { error: 'Your role does not have permission to manage promotions.' });
  const p = existing ? existing.promotion : { discount_type: 'percentage', start_date: todayYmd(), product_ids: [] };
  if (editing && !['draft', 'scheduled', 'paused', 'active'].includes(p.status)) throw new ApiError(409, { error: 'An expired promotion cannot be edited. Create a new one instead.' });
  const selected = new Set(p.product_ids);
  const picker = productPicker(products, selected);
  const preview = h('div');
  const form = h('form.stack.lg', h('div', { dataset: { formError: '' } }),
    card({ title: 'Promotion details', body: h('div.form-grid',
      field({ name: 'name', label: 'Campaign name', required: true, value: p.name, full: true, maxlength: 80, placeholder: 'e.g. Winter Essentials Sale' }),
      field({ name: 'discount_type', label: 'Discount type', type: 'select', options: [['percentage', 'Percentage off'], ['flat', 'Flat amount off (₹)']], value: p.discount_type, required: true, placeholderOption: false }),
      field({ name: 'discount_value', label: 'Discount value', type: 'number', required: true, min: 1, step: '0.01', value: p.discount_value, hint: 'Percentage: 1–90. Flat: must be less than the selling price of every selected product.' }),
      field({ name: 'start_date', label: 'Start date', type: 'date', required: true, value: p.start_date, min: editing ? undefined : todayYmd() }), field({ name: 'end_date', label: 'End date', type: 'date', required: true, value: p.end_date, min: todayYmd() }),
      field({ name: 'budget', label: 'Budget (optional)', type: 'number', prefix: '₹', min: 0, step: 1, value: p.budget, hint: 'For your own planning. It is not charged or enforced.' })) }),
    card({ title: 'Products', subtitle: 'Choose the listings this promotion applies to.', body: picker }),
    card({ title: 'Preview', subtitle: 'Promotion prices are calculated on the server.', actions: h('button.btn.sm', { type: 'button', dataset: { preview: '' }, onClick: (e) => busy(e.currentTarget, runPreview) }, icon('eye', 'sm'), 'Update preview'), body: preview }),
    h('div.card', h('div.card-body.row.between.wrap', h('span.small.muted', 'A published promotion starts automatically on its start date. Drafts never affect prices.'), h('div.row.wrap', h('a.btn', { href: editing ? `/seller/growth/promotions/${p.code}` : '/seller/growth/promotions' }, 'Cancel'), !editing || p.status === 'draft' ? h('button.btn', { type: 'submit', value: 'draft' }, 'Save draft') : null, h('button.btn.primary', { type: 'submit', value: 'publish' }, editing && p.status !== 'draft' ? 'Save changes' : 'Publish promotion')))));
  const payload = (v, publish) => ({ name: v.name, discount_type: v.discount_type, discount_value: v.discount_value ?? undefined, start_date: v.start_date, end_date: v.end_date, budget: v.budget ?? undefined, product_ids: [...selected], publish });
  async function runPreview() {
    clearErrors(form);
    try {
      const r = await api('/promotions/preview', { method: 'POST', body: payload(readForm(form), true) });
      preview.replaceChildren(h('div.stack', h('div.row.wrap', badge(`Would be: ${r.status_label}`, 'blue'), badge(`${r.days} day${r.days === 1 ? '' : 's'}`, ''), badge(`Largest saving ${inr(r.max_saving)}`, 'green')),
        dataTable({ compact: true, rows: r.lines, columns: [{ label: 'Product', render: (l) => h('span.strong', l.title) }, { label: 'MRP', align: 'right', render: (l) => inr(l.mrp) }, { label: 'Current price', align: 'right', render: (l) => inr(l.price) }, { label: 'Promotion price', align: 'right', render: (l) => h('b.pos', inr(l.promo_price)) }, { label: 'Customer saves', align: 'right', render: (l) => inr(l.saving) }, { label: 'Total off MRP', align: 'right', render: (l) => `${l.total_discount_pct}%` }] })));
    } catch (err) { preview.replaceChildren(h('p.muted', 'Fix the highlighted fields to see the preview.')); if (err instanceof ApiError) showErrors(form, err); else throw err; }
  }
  preview.append(h('p.muted', 'Fill in the details and choose products, then select “Update preview”.'));
  onSubmit(form, async (v, button) => {
    const publish = !(button && button.value === 'draft');
    const r = await api(editing ? `/promotions/${p.code}` : '/promotions', { method: editing ? 'PUT' : 'POST', body: payload(v, publish) });
    toast(r.message || 'Promotion saved.', 'success');
    navigate(`/seller/growth/promotions/${r.code || p.code}`);
  });
  return h('div.stack.lg', pageHead({ title: editing ? 'Edit promotion' : 'Create promotion', subtitle: editing ? `${p.code} · ${p.status_label}` : 'Run a discount on selected products for a fixed period.', trail: [['Growth', '/seller/growth'], ['Promotions', '/seller/growth/promotions'], editing ? p.code : 'Create'] }), form);
}

export async function promotionDetail(ctx) {
  const { promotion: p, can_write: write } = await api(`/promotions/${ctx.params.code}`);
  const remove = async () => { if (!(await confirmDialog({ title: 'Delete this promotion?', message: 'The promotion is removed permanently.', confirmLabel: 'Delete', danger: true }))) return; try { const r = await api(`/promotions/${p.code}`, { method: 'DELETE' }); toast(r.message || 'Promotion deleted.', 'success'); navigate('/seller/growth/promotions'); } catch (err) { toast(err.message, 'error'); } };
  return h('div.stack.lg', pageHead({ title: p.name, trail: [['Growth', '/seller/growth'], ['Promotions', '/seller/growth/promotions'], p.code], tag: [statusBadge(p.status, p.status_label), ' ', demoTag(p.is_demo)], subtitle: `${p.code} · ${discountText(p)} · ${fmtDate(p.start_date)} – ${fmtDate(p.end_date)}`, actions: [
    ...promoButtons(p, write, false), write && p.status !== 'expired' ? h('a.btn', { href: `/seller/growth/promotions/${p.code}/edit` }, icon('edit', 'sm'), 'Edit') : null, write && ['draft', 'expired'].includes(p.status) ? h('button.btn.danger', { type: 'button', onClick: remove }, icon('trash', 'sm'), 'Delete') : null] }),
    h('div.grid.c4', statCard({ label: 'Orders in period', value: num(p.performance.orders), ico: 'cart', hint: 'For the selected products' }), statCard({ label: 'Units sold', value: num(p.performance.units), ico: 'box', tone: 'violet' }), statCard({ label: 'Revenue', value: inr(p.performance.revenue), ico: 'wallet', tone: 'green' }), statCard({ label: 'Budget', value: p.budget ? inr(p.budget) : '—', ico: 'target', tone: 'orange', hint: 'Planning figure, not charged' })),
    card({ title: `Products · ${p.lines.length}`, flush: true, body: dataTable({ rows: p.lines, columns: [{ label: 'Product', render: (l) => h('a.strong', { href: `/seller/products/${l.code}` }, l.title) }, { label: 'Listing', render: (l) => statusBadge(l.status) }, { label: 'MRP', align: 'right', render: (l) => inr(l.mrp) }, { label: 'Current price', align: 'right', render: (l) => inr(l.price) }, { label: 'Promotion price', align: 'right', render: (l) => h('b.pos', inr(l.promo_price)) }, { label: 'Saving', align: 'right', render: (l) => inr(l.saving) }, { label: 'Total off MRP', align: 'right', render: (l) => `${l.total_discount_pct}%` }],
      empty: emptyState({ ico: 'box', title: 'The selected products no longer exist' }) }) }));
}

/* ---------- Advertising ---------- */
const AD_NAV = [['Overview', '/seller/advertising'], ['Campaigns', '/seller/advertising/campaigns'], ['Product ads', '/seller/advertising/product-ads'], ['Advertising report', '/seller/analytics/advertising']];
const adNote = (text) => integrationNote(text || 'No advertising network is connected. Campaigns are saved, scheduled and validated here, but ads are not served and no budget is charged.');
async function adAction(code, action) {
  const confirmText = { launch: ['Launch this campaign?', 'The campaign becomes active on its start date. No ads are served and nothing is charged because no advertising network is connected.', 'Launch campaign'], end: ['End this campaign?', 'An ended campaign cannot be restarted.', 'End campaign'] }[action];
  if (confirmText && !(await confirmDialog({ title: confirmText[0], message: confirmText[1], confirmLabel: confirmText[2], danger: action === 'end' }))) return;
  try { const r = await api(`/ads/campaigns/${code}/status`, { method: 'POST', body: { action } }); toast(r.message || 'Campaign updated.', 'success'); reload(); } catch (err) { toast(err.message, 'error'); }
}
function adButtons(c, write, small = true) {
  if (!write) return [];
  const cls = small ? 'button.btn.sm' : 'button.btn';
  return [c.status === 'draft' ? h(`${cls}.primary`, { type: 'button', onClick: () => adAction(c.code, 'launch') }, 'Launch') : null, ['active', 'scheduled'].includes(c.status) ? h(cls, { type: 'button', onClick: () => adAction(c.code, 'pause') }, 'Pause') : null,
    c.status === 'paused' ? h(`${cls}.primary`, { type: 'button', onClick: () => adAction(c.code, 'resume') }, 'Resume') : null, ['active', 'scheduled', 'paused'].includes(c.status) ? h(`${cls}.danger`, { type: 'button', onClick: () => adAction(c.code, 'end') }, 'End') : null];
}
export async function adsOverview() {
  const d = await api('/ads/overview', { query: rangeQuery() });
  const t = d.total;
  return h('div.stack', pageHead({ title: 'Advertising', subtitle: 'Plan and manage sponsored-product campaigns.', trail: ['Advertising'], actions: [d.can_write ? h('a.btn.primary', { href: '/seller/advertising/campaigns/new' }, icon('plus', 'sm'), 'Create campaign') : null] }), subnav(AD_NAV), adNote(d.integration_note),
    h('div.row.between.wrap', rangeFilter('30d'), h('span.small.muted', d.range.label)),
    h('div.banner.demo', icon('info'), h('div.grow', h('b', 'Illustrative metrics. '), d.note)),
    h('div.grid.c4', statCard({ label: 'Impressions', value: num(t.impressions), ico: 'eye' }), statCard({ label: 'Clicks', value: num(t.clicks), hint: `CTR ${t.ctr}%`, ico: 'target', tone: 'violet' }), statCard({ label: 'Ad spend', value: inr(t.spend), hint: 'Not charged', ico: 'wallet', tone: 'orange' }), statCard({ label: 'Attributed sales', value: inr(t.revenue), hint: `ROAS ${t.roas}×`, ico: 'trending', tone: 'green' })),
    h('div.grid.c2', card({ title: 'Spend and attributed sales', body: lineChart({ labels: d.labels, series: [{ name: 'Attributed sales', data: d.series.revenue, format: 'inr', tone: 'green' }, { name: 'Ad spend', data: d.series.spend, format: 'inr', tone: 'orange' }] }) }), card({ title: 'Clicks', body: barChart({ labels: d.labels, series: [{ name: 'Clicks', data: d.series.clicks, format: 'num' }] }) })),
    card({ title: 'Campaigns', flush: true, actions: h('a.btn.sm', { href: '/seller/advertising/campaigns' }, 'Manage campaigns'), body: dataTable({ compact: true, rows: d.campaigns, columns: [{ label: 'Campaign', render: (c) => h('span', h('a.strong', { href: `/seller/advertising/campaigns/${c.code}` }, c.name), ' ', demoTag(c.is_demo)) }, { label: 'Status', render: (c) => statusBadge(c.status.toLowerCase(), c.status) }, { label: 'Impressions', align: 'right', render: (c) => num(c.impressions) }, { label: 'Clicks', align: 'right', render: (c) => num(c.clicks) }, { label: 'CTR', align: 'right', render: (c) => `${c.ctr}%` }, { label: 'Spend', align: 'right', render: (c) => inr(c.spend) }, { label: 'Sales', align: 'right', render: (c) => inr(c.revenue) }, { label: 'ROAS', align: 'right', render: (c) => `${c.roas}×` }],
      empty: emptyState({ ico: 'megaphone', title: 'No campaigns yet', text: 'Create a campaign to plan your sponsored products.', action: d.can_write ? h('a.btn.primary', { href: '/seller/advertising/campaigns/new' }, 'Create campaign') : null }) }) }));
}

const AD_TABS = [['all', 'All'], ['draft', 'Draft'], ['scheduled', 'Scheduled'], ['active', 'Active'], ['paused', 'Paused'], ['completed', 'Completed']];
export async function campaigns(ctx) {
  const q = ctx.query;
  const tab = q.tab || 'all';
  const data = await api('/ads/campaigns', { query: { tab, q: q.q, page: q.page } });
  return h('div.stack', pageHead({ title: 'Campaigns', subtitle: 'Create, schedule, pause and end advertising campaigns.', trail: [['Advertising', '/seller/advertising'], 'Campaigns'], actions: [h('button.btn', { type: 'button', onClick: () => download('/ads/report.csv') }, icon('download', 'sm'), 'Export CSV'), data.can_write ? h('a.btn.primary', { href: '/seller/advertising/campaigns/new' }, icon('plus', 'sm'), 'Create campaign') : null] }), subnav(AD_NAV), adNote(data.note),
    h('div.card', tabs(AD_TABS.map(([key, label]) => ({ key, label, count: data.counts[key] })), tab, (key) => hrefWith({ tab: key === 'all' ? null : key, page: null })), h('div.toolbar', searchBox('Search campaigns by name or ID')),
      dataTable({ rows: data.rows, columns: [
        { label: 'Campaign', render: (c) => h('div', h('a.strong', { href: `/seller/advertising/campaigns/${c.code}` }, c.name), ' ', demoTag(c.is_demo), h('div.small.muted', `${c.code} · ${c.objective}`)) }, { label: 'Daily budget', align: 'right', render: (c) => inr(c.daily_budget) },
        { label: 'Runs', render: (c) => h('span.nowrap.small', `${fmtDate(c.start_date)} – ${c.end_date ? fmtDate(c.end_date) : 'no end date'}`) }, { label: 'Clicks', align: 'right', render: (c) => num(c.metrics.clicks) }, { label: 'Spend', align: 'right', render: (c) => inr(c.metrics.spend) }, { label: 'ROAS', align: 'right', render: (c) => `${c.metrics.roas}×` },
        { label: 'Status', render: (c) => statusBadge(c.status, c.status_label) }, { label: '', cls: 'actions', render: (c) => h('span.row', { style: { justifyContent: 'flex-end' } }, adButtons(c, data.can_write), h('a.btn.sm', { href: `/seller/advertising/campaigns/${c.code}` }, 'View')) }],
        empty: emptyState(q.q ? { ico: 'search', title: 'No campaigns match your search' } : { ico: 'megaphone', title: tab === 'all' ? 'No campaigns yet' : 'No campaigns with this status', action: data.can_write ? h('a.btn.primary', { href: '/seller/advertising/campaigns/new' }, 'Create campaign') : null }) }), data.rows.length ? pager(data) : null));
}

export async function campaignForm(ctx) {
  const editing = Boolean(ctx.params.code);
  const [meta, existing] = await Promise.all([api('/ads/meta'), editing ? api(`/ads/campaigns/${ctx.params.code}`) : null]);
  if (!can('ads.write')) throw new ApiError(403, { error: 'Your role does not have permission to manage campaigns.' });
  const c = existing ? existing.campaign : { product_ids: [], targeting: { type: 'automatic', keywords: [], categories: [], placements: meta.placements.slice(0, 2) }, bid_strategy: 'automatic', start_date: todayYmd() };
  if (editing && c.status === 'completed') throw new ApiError(409, { error: 'A completed campaign cannot be edited.' });
  const selected = new Set(c.product_ids);
  const picker = productPicker(meta.products, selected);
  const targetBox = h('div.full');
  const typeField = field({ name: 'targeting_type', label: 'Targeting', type: 'select', options: [['automatic', 'Automatic — matched to your product details'], ['keyword', 'Keywords you choose'], ['category', 'Categories you choose']], value: c.targeting.type, placeholderOption: false, onChange: () => drawTarget() });
  const bidField = field({ name: 'bid_strategy', label: 'Bid strategy', type: 'select', options: [['automatic', 'Automatic bidding'], ['manual', 'Manual bid per click']], value: c.bid_strategy, placeholderOption: false, onChange: () => drawBid() });
  const bidAmount = field({ name: 'bid_amount', label: 'Bid per click', type: 'number', prefix: '₹', min: 1, max: 500, step: '0.5', value: c.bid_amount });
  const drawBid = () => { bidAmount.hidden = bidField.querySelector('select').value !== 'manual'; };
  function drawTarget() {
    const type = typeField.querySelector('select').value;
    targetBox.replaceChildren(type === 'keyword' ? (() => { const el = field({ name: 'keywords', label: 'Keywords', type: 'textarea', rows: 2, value: (c.targeting.keywords || []).join(', '), hint: 'Separate keywords with commas. Up to 25.' }); el.dataset.field = 'targeting.keywords'; return el; })()
      : type === 'category' ? h('div.field', { dataset: { field: 'targeting.categories' } }, h('span.label', 'Categories'), h('div.row.wrap', meta.categories.map((cat) => h('label.check', h('input', { type: 'checkbox', name: `cat__${cat}`, checked: (c.targeting.categories || []).includes(cat) }), h('span', cat)))), h('div.error', { hidden: true }))
        : h('p.small.muted', 'Automatic targeting needs no further settings.'));
  }
  drawTarget(); drawBid();
  const form = h('form.stack.lg', h('div', { dataset: { formError: '' } }),
    card({ title: 'Campaign', body: h('div.form-grid', field({ name: 'name', label: 'Campaign name', required: true, value: c.name, maxlength: 80 }), field({ name: 'objective', label: 'Campaign objective', type: 'select', options: meta.objectives, value: c.objective, required: true }),
      field({ name: 'daily_budget', label: 'Daily budget', type: 'number', prefix: '₹', required: true, min: 100, step: 1, value: c.daily_budget, hint: 'Minimum ₹100. Not charged — no ad network is connected.' }), h('div'),
      field({ name: 'start_date', label: 'Start date', type: 'date', required: true, value: c.start_date }), field({ name: 'end_date', label: 'End date (optional)', type: 'date', value: c.end_date || '' })) }),
    card({ title: 'Products to advertise', body: picker }),
    card({ title: 'Targeting and bidding', body: h('div.form-grid', typeField, bidField, targetBox, bidAmount,
      h('div.field.full', { dataset: { field: 'targeting.placements' } }, h('span.label', 'Placements'), h('div.row.wrap', meta.placements.map((pl) => h('label.check', h('input', { type: 'checkbox', name: `pl__${pl}`, checked: (c.targeting.placements || []).includes(pl) }), h('span', pl)))), h('div.error', { hidden: true }))) }),
    h('div.card', h('div.card-body.row.between.wrap', h('span.small.muted', meta.note), h('div.row.wrap', h('a.btn', { href: editing ? `/seller/advertising/campaigns/${c.code}` : '/seller/advertising/campaigns' }, 'Cancel'), h('button.btn.primary', { type: 'submit' }, editing ? 'Save changes' : 'Save as draft')))));
  onSubmit(form, async (v) => {
    const body = { name: v.name, objective: v.objective || undefined, product_ids: [...selected], daily_budget: v.daily_budget ?? undefined, start_date: v.start_date, end_date: v.end_date || undefined, bid_strategy: v.bid_strategy, bid_amount: v.bid_strategy === 'manual' ? v.bid_amount ?? undefined : undefined,
      targeting: { type: v.targeting_type, keywords: v.keywords ? v.keywords.split(',') : [], categories: meta.categories.filter((cat) => v[`cat__${cat}`]), placements: meta.placements.filter((pl) => v[`pl__${pl}`]) } };
    const r = await api(editing ? `/ads/campaigns/${c.code}` : '/ads/campaigns', { method: editing ? 'PUT' : 'POST', body });
    toast(r.message || 'Campaign saved.', 'success');
    navigate(`/seller/advertising/campaigns/${r.code || c.code}`);
  });
  return h('div.stack.lg', pageHead({ title: editing ? 'Edit campaign' : 'Create campaign', subtitle: editing ? `${c.code} · ${c.status_label}` : 'New campaigns are saved as drafts. Launch them from the campaign page.', trail: [['Advertising', '/seller/advertising'], ['Campaigns', '/seller/advertising/campaigns'], editing ? c.code : 'Create'] }), adNote(), form);
}

export async function campaignDetail(ctx) {
  const { campaign: c, can_write: write, note } = await api(`/ads/campaigns/${ctx.params.code}`);
  const m = c.metrics;
  const remove = async () => { if (!(await confirmDialog({ title: 'Delete this campaign?', message: 'The campaign is removed permanently.', confirmLabel: 'Delete', danger: true }))) return; try { const r = await api(`/ads/campaigns/${c.code}`, { method: 'DELETE' }); toast(r.message || 'Campaign deleted.', 'success'); navigate('/seller/advertising/campaigns'); } catch (err) { toast(err.message, 'error'); } };
  const t = c.targeting;
  return h('div.stack.lg', pageHead({ title: c.name, trail: [['Advertising', '/seller/advertising'], ['Campaigns', '/seller/advertising/campaigns'], c.code], tag: [statusBadge(c.status, c.status_label), ' ', demoTag(c.is_demo)], subtitle: `${c.code} · ${c.objective}`, actions: [...adButtons(c, write, false), write && c.status !== 'completed' ? h('a.btn', { href: `/seller/advertising/campaigns/${c.code}/edit` }, icon('edit', 'sm'), 'Edit') : null, write && ['draft', 'completed'].includes(c.status) ? h('button.btn.danger', { type: 'button', onClick: remove }, icon('trash', 'sm'), 'Delete') : null] }),
    adNote(note), c.daily.length ? h('div.banner.demo', icon('info'), h('div.grow', h('b', 'Illustrative metrics. '), 'The delivery figures for this sample campaign are demonstration data. Campaigns you create record no delivery because no ads are served.')) : null,
    h('div.grid.c4', statCard({ label: 'Impressions', value: num(m.impressions), ico: 'eye' }), statCard({ label: 'Clicks', value: num(m.clicks), hint: `CTR ${m.ctr}%`, ico: 'target', tone: 'violet' }), statCard({ label: 'Spend', value: inr(m.spend), hint: 'Not charged', ico: 'wallet', tone: 'orange' }), statCard({ label: 'Attributed sales', value: inr(m.revenue), hint: `${m.conversions} orders · ROAS ${m.roas}×`, ico: 'trending', tone: 'green' })),
    h('div.grid.c2', card({ title: 'Settings', body: kv([['Daily budget', inr(c.daily_budget)], ['Schedule', `${fmtDate(c.start_date)} – ${c.end_date ? fmtDate(c.end_date) : 'no end date'}`], ['Bid strategy', c.bid_strategy === 'manual' ? `Manual · ${inr(c.bid_amount)} per click` : 'Automatic'], ['Targeting', titleCase(t.type)], t.keywords.length ? ['Keywords', t.keywords.join(', ')] : null, t.categories.length ? ['Categories', t.categories.join(', ')] : null, ['Placements', t.placements.join(', ') || '—'], ['Created', fmtDateTime(c.created_at)]]) }),
      card({ title: `Advertised products · ${c.products.length}`, flush: true, body: h('div.list', c.products.map((p) => h('a.list-row', { href: `/seller/products/${p.code}` }, h('div.grow', h('b.strong', p.title), h('div.small.muted', `${p.code} · ${inr(p.price)}`)), statusBadge(p.status)))) })),
    card({ title: 'Daily performance', body: c.daily.length ? lineChart({ labels: c.daily.map((d) => fmtDate(d.date).slice(0, 6)), series: [{ name: 'Attributed sales', data: c.daily.map((d) => d.revenue), format: 'inr', tone: 'green' }, { name: 'Spend', data: c.daily.map((d) => d.spend), format: 'inr', tone: 'orange' }] }) : emptyState({ ico: 'chart', title: 'No delivery data', text: 'This campaign has no delivery metrics because no advertising network is connected.' }) }));
}

export async function productAds() {
  const d = await api('/ads/product-ads');
  return h('div.stack', pageHead({ title: 'Product ads', subtitle: 'How each advertised product performs across your campaigns.', trail: [['Advertising', '/seller/advertising'], 'Product ads'] }), subnav(AD_NAV), adNote(d.note),
    h('div.card', dataTable({ rows: d.rows, columns: [{ label: 'Product', render: (p) => h('div.cell-product', thumb(p.image_id, p.title), h('div', h('a', { href: `/seller/products/${p.code}` }, p.title), h('small', `${p.category} · ${inr(p.price)} `, demoTag(p.is_demo)))) }, { label: 'Campaigns', align: 'right', render: (p) => `${p.active_campaigns} active / ${p.campaigns}` }, { label: 'Impressions', align: 'right', render: (p) => num(p.impressions) }, { label: 'Clicks', align: 'right', render: (p) => num(p.clicks) }, { label: 'Spend', align: 'right', render: (p) => inr(p.spend) }, { label: 'Sales', align: 'right', render: (p) => inr(p.revenue) }, { label: 'ROAS', align: 'right', render: (p) => `${p.roas}×` }],
      empty: emptyState({ ico: 'megaphone', title: 'No advertised products', text: 'Products appear here when they are added to a campaign.' }) })), h('p.small.muted', d.split_note));
}
