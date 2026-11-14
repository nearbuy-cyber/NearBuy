// Dashboard, global search, products (list, form, detail, bulk upload) and inventory.
import { h, icon, state, api, ApiError, can, navigate, reload, toast, download, field, onSubmit, showErrors, clearErrors, readForm, formModal, confirmDialog, openModal, busy, banner, demoBanner, badge, statusBadge, demoTag, thumb, uploadUrl, pageHead, card, statCard, tabs, subnav, dataTable, pager, searchBox, selectFilter, emptyState, kv, rowMenu, lineChart, barChart, hbarChart, donutChart, inr, num, fmtDate, fmtDateTime, ago, hrefWith, currentQuery, setQuery, pickFile, readText, uploadFile, titleCase } from './core.js';

/* ---------- Dashboard ---------- */
export async function dashboard() {
  const d = await api('/dashboard');
  const k = d.kpis;
  const cards = [
    ['Total sales', k.total_sales ? inr(k.total_sales.value) : '', k.total_sales, 'wallet', 'orange', d.can['analytics.read'] ? '/seller/analytics/sales' : null],
    ["Today's sales", k.today_sales ? inr(k.today_sales.value) : '', k.today_sales, 'trending', 'green', d.can['orders.read'] ? '/seller/orders' : null],
    ['Total orders', k.total_orders ? num(k.total_orders.value) : '', k.total_orders, 'cart', '', d.can['orders.read'] ? '/seller/orders' : null],
    ['Pending orders', k.pending_orders ? num(k.pending_orders.value) : '', k.pending_orders, 'clock', 'amber', d.can['orders.read'] ? '/seller/orders?tab=new' : null],
    ['Products listed', k.products_listed ? num(k.products_listed.value) : '', k.products_listed, 'box', 'violet', d.can['products.read'] ? '/seller/products' : null],
    ['Active listings', k.active_listings ? num(k.active_listings.value) : '', k.active_listings, 'check', 'green', d.can['products.read'] ? '/seller/products?tab=active' : null],
    ['Return requests', k.return_requests ? num(k.return_requests.value) : '', k.return_requests, 'undo', 'red', d.can['returns.read'] ? '/seller/returns' : null],
    ['Pending settlements', k.pending_settlements ? inr(k.pending_settlements.value) : '', k.pending_settlements, 'bank', 'orange', d.can['payments.read'] ? '/seller/payments/upcoming' : null],
  ];
  const shown = cards.filter(([, , item]) => item);
  const quick = [
    d.can['products.write'] && ['Add product', '/seller/products/new', 'plus'], d.can['inventory.write'] && ['Update inventory', '/seller/inventory', 'layers'], d.can['orders.read'] && ['View orders', '/seller/orders', 'cart'],
    d.can['products.write'] && ['Bulk upload', '/seller/products/bulk-upload', 'upload'], d.can['growth.write'] && ['Create promotion', '/seller/growth/promotions/new', 'tag'], d.can['payments.read'] && ['Download report', '/seller/payments/statements', 'download'],
    ['Raise a ticket', '/seller/support/tickets/new', 'lifebuoy'], ['Learning centre', '/seller/learning', 'book'],
  ].filter(Boolean);
  const pay = d.payments;
  const empty = Boolean(k.products_listed && !k.products_listed.value && (!k.total_orders || !k.total_orders.value));
  return h('div.stack.lg',
    pageHead({ title: `Welcome back, ${d.user_name.split(' ')[0]}`, subtitle: `${d.seller.store_name} · ${fmtDate(d.today)} · Every figure below is calculated from your store's records.`, actions: [d.can['products.write'] ? h('a.btn.primary', { href: '/seller/products/new' }, icon('plus', 'sm'), 'Add product') : null] }),
    d.has_demo ? demoBanner('This store contains sample products, orders and payments marked DEMO DATA. The figures on this page are calculated from those records.') : null,
    empty ? banner('', [h('b', 'Your store is empty. '), 'Add a product to get started, or load a labelled sample data set to explore the Seller Hub.'], d.can['settings.manage'] ? h('button.btn.sm', { type: 'button', onClick: (e) => busy(e.currentTarget, async () => { const r = await api('/demo/load', { method: 'POST', body: {} }); toast(r.message, 'success'); state.shell = null; reload(); }) }, 'Load sample data') : null) : null,
    shown.length ? h('div.grid.c4', shown.map(([label, value, item, ico, t, href]) => statCard({ label, value, hint: item.hint, delta: item.delta, ico, tone: t, href }))) : null,
    h('div.grid.c2-1',
      d.sales_chart && card({ title: 'Sales overview', subtitle: 'Last 30 days compared with the 30 days before', body: lineChart({ labels: d.sales_chart.labels, series: [{ name: 'Last 30 days', data: d.sales_chart.sales, format: 'inr' }, { name: 'Previous 30 days', data: d.sales_chart.previous, format: 'inr', muted: true }] }) }),
      card({ title: 'Action centre', subtitle: 'Things that need you', flush: true, body: d.actions.length ? h('div', d.actions.map((a) => h('div.action-item', h(`span.action-count.${a.tone}`, a.count), h('div.grow', h('b.strong', a.title), h('div.small.muted', a.detail)), h('a.btn.sm', { href: a.link }, a.cta)))) : emptyState({ ico: 'check', title: 'All caught up', text: 'No orders, stock alerts, returns or tickets need action right now.' }) })),
    card({ title: 'Quick actions', body: h('div.quick', quick.map(([label, href, ico]) => h('a', { href }, icon(ico), label))) }),
    h('div.grid.c2',
      d.sales_chart && card({ title: 'Order trends', subtitle: 'Orders placed per day, last 30 days', body: barChart({ labels: d.sales_chart.labels, series: [{ name: 'Orders', data: d.sales_chart.orders, format: 'num', tone: 'orange' }] }) }),
      d.revenue_trend && card({ title: 'Revenue trend', subtitle: 'Weekly gross sales and net proceeds', body: lineChart({ labels: d.revenue_trend.labels, series: [{ name: 'Gross sales', data: d.revenue_trend.gross, format: 'inr' }, { name: 'Net proceeds', data: d.revenue_trend.net, format: 'inr', tone: 'green' }] }) }),
      d.top_products && card({ title: 'Top products', subtitle: 'By revenue, last 30 days', flush: true, body: d.top_products.length ? dataTable({ compact: true, rows: d.top_products, columns: [
        { label: 'Product', render: (p) => h('div.cell-product', thumb(p.image_id, p.title), h('div', h('a', { href: `/seller/products/${p.code}` }, p.title), h('small', p.category))) },
        { label: 'Units', align: 'right', render: (p) => num(p.units) }, { label: 'Revenue', align: 'right', render: (p) => inr(p.revenue) }] }) : emptyState({ ico: 'chart', title: 'No sales yet', text: 'Your best sellers appear here after your first orders.' }) }),
      d.categories && card({ title: 'Category performance', subtitle: 'Revenue share, last 30 days', body: donutChart({ labels: d.categories.map((c) => c.category), series: [{ data: d.categories.map((c) => c.revenue), format: 'inr' }] }) }),
      pay && card({ title: 'Payment summary', subtitle: 'Delivered orders, last 30 days', actions: d.can['payments.read'] ? h('a.btn.sm', { href: '/seller/payments' }, 'Open payments') : null, body: kv([
        ['Gross sales', inr(pay.total_sales)], ['Platform fees', inr(-pay.platform_fees)], ['Shipping charges', inr(-pay.shipping_charges)], ['Taxes and deductions', inr(-pay.taxes_and_deductions)], ['Refund deductions', inr(-pay.refund_deductions)], ['Net proceeds', h('b', inr(pay.net_settlement))], ['Awaiting settlement', inr(pay.upcoming)]]) }),
      d.recent_orders && card({ title: 'Recent orders', flush: true, actions: d.can['orders.read'] ? h('a.btn.sm', { href: '/seller/orders' }, 'View all') : null, body: d.recent_orders.length ? h('div.list', d.recent_orders.map((o) => h('a.list-row', { href: `/seller/orders/${o.code}` }, h('div.grow', h('b.strong', o.code, ' ', demoTag(o.is_demo)), h('div.small.muted.truncate', o.title)), h('div.right', h('div.strong', inr(o.total)), statusBadge(o.status, o.status_label))))) : emptyState({ ico: 'cart', title: 'No orders yet', text: 'New orders appear here as soon as customers place them.' }) })),
    d.inventory && card({ title: 'Inventory health', actions: d.can['inventory.read'] ? h('a.btn.sm', { href: '/seller/inventory' }, 'Manage inventory') : null, body: h('div.grid.c4', [['SKUs', d.inventory.skus, ''], ['Healthy', d.inventory.healthy, 'green'], ['Low or critical', d.inventory.low, 'amber'], ['Out of stock', d.inventory.out_of_stock, 'red']].map(([label, value, t]) => h('div', h('div.small.muted', label), h('div.stat-value', { class: t === 'red' && value ? 'neg' : '' }, num(value))))) }));
}

/* ---------- Global search ---------- */
export async function searchResults(ctx) {
  const q = (ctx.query.q || '').trim();
  const head = pageHead({ title: 'Search', subtitle: q ? `Results for “${q}”` : 'Search across products, orders, returns and support tickets.', trail: ['Search'] });
  if (q.length < 2) return h('div.stack', head, h('div.card', emptyState({ ico: 'search', title: 'Type something to search', text: 'Use the search box at the top of the page. Try a product name, SKU, order ID, return ID or ticket ID.' })));
  const sources = [
    can('products.read') && ['Products', '/products', (r) => [`/seller/products/${r.code}`, r.title, `${r.code} · SKU ${r.sku}`, statusBadge(r.status)], '/seller/products'],
    can('orders.read') && ['Orders', '/orders', (r) => [`/seller/orders/${r.code}`, r.code, `${r.title} · ${inr(r.total)}`, statusBadge(r.status, r.status_label)], '/seller/orders'],
    can('returns.read') && ['Returns', '/returns', (r) => [`/seller/returns/${r.code}`, r.code, `${r.product} · order ${r.order_code}`, statusBadge(r.status, r.status_label)], '/seller/returns'],
    can('support.use') && ['Support tickets', '/support/tickets', (r) => [`/seller/support/tickets/${r.code}`, r.code, r.subject, statusBadge(r.status, r.status_label)], '/seller/support/tickets'],
  ].filter(Boolean);
  const results = await Promise.all(sources.map(([, path]) => api(path, { query: { q, page_size: 6 } }).catch((err) => ({ rows: [], total: 0, error: err.message }))));
  const total = results.reduce((a, r) => a + r.total, 0);
  return h('div.stack', head, total === 0 ? h('div.card', emptyState({ ico: 'search', title: 'No matches', text: `Nothing in your store matches “${q}”. Check the spelling or try an ID such as ORD-240001.` })) : null,
    sources.map(([label, , map, listHref], i) => (results[i].total ? card({ title: `${label} · ${results[i].total}`, flush: true, actions: results[i].total > 6 ? h('a.btn.sm', { href: `${listHref}?q=${encodeURIComponent(q)}` }, 'See all') : null,
      body: h('div.list', results[i].rows.map((row) => { const [href, title, sub, tag] = map(row); return h('a.list-row', { href }, h('div.grow', h('b.strong', title), h('div.small.muted.truncate', sub)), tag); })) }) : null)));
}

/* ---------- Products ---------- */
const PRODUCT_TABS = [['all', 'All listings'], ['active', 'Active'], ['inactive', 'Inactive'], ['pending_approval', 'Pending approval'], ['qc_failed', 'QC failed'], ['rejected', 'Rejected'], ['out_of_stock', 'Out of stock'], ['draft', 'Drafts']];
const STATUS_LABEL = { active: 'Active', inactive: 'Inactive', pending_approval: 'Pending approval', qc_failed: 'QC failed', rejected: 'Rejected', draft: 'Draft' };

async function stockModal(product) {
  const data = await api('/inventory', { query: { q: product.code, page_size: 50 } });
  const rows = data.rows.filter((r) => r.product_code === product.code);
  if (!rows.length) { toast('This listing has no stock records yet. Save it with a quantity first.', 'error'); return; }
  const inputs = rows.map((r) => h('input.input.sm.num', { type: 'number', min: 0, step: 1, value: r.available, 'aria-label': `Available for ${r.sku}`, style: { width: '110px' } }));
  const reason = h('input.input', { placeholder: 'Reason (optional), e.g. new stock received', maxlength: 160 });
  const save = h('button.btn.primary', { type: 'button', onClick: () => busy(save, async () => {
    let changed = 0;
    for (let i = 0; i < rows.length; i += 1) {
      const value = Number(inputs[i].value);
      if (inputs[i].value === '' || !Number.isInteger(value) || value < 0) throw new ApiError(400, { error: `Enter a whole number, 0 or more, for ${rows[i].sku}.` });
      if (value !== rows[i].available) { await api(`/inventory/${rows[i].id}`, { method: 'PATCH', body: { available: value, reason: reason.value.trim() || undefined } }); changed += 1; }
    }
    m.close();
    toast(changed ? `Stock updated for ${changed} SKU${changed === 1 ? '' : 's'}.` : 'No changes to save.', changed ? 'success' : 'info');
    if (changed) reload();
  }) }, 'Save stock');
  const m = openModal({ title: 'Update stock', subtitle: product.title, actions: [h('button.btn', { type: 'button', onClick: () => m.close() }, 'Cancel'), save],
    body: h('div.stack', dataTable({ compact: true, rows, columns: [{ label: 'SKU', render: (r) => h('div', h('b.strong', r.sku), r.variant_label ? h('div.small.muted', r.variant_label) : null) }, { label: 'Reserved', align: 'right', render: (r) => num(r.reserved) }, { label: 'Available', align: 'right', render: (r, i) => inputs[i] }] }), reason) });
}
const priceModal = (p) => formModal({ title: 'Update price', subtitle: p.title, submitLabel: 'Save price', fields: [
  { name: 'mrp', label: 'MRP', type: 'number', prefix: '₹', value: p.mrp, required: true, min: 1, step: '0.01' }, { name: 'price', label: 'Selling price', type: 'number', prefix: '₹', value: p.price, required: true, min: 1, step: '0.01', hint: 'Cannot be higher than MRP.' }],
  onSubmit: async (v) => { const r = await api(`/products/${p.code}/price`, { method: 'PATCH', body: v }); toast(r.message, 'success'); reload(); } });
async function listingAction(p, action) {
  try { const r = await api(`/products/${p.code}/status`, { method: 'POST', body: { action } }); toast(r.message, r.status === 'qc_failed' ? 'error' : 'success'); reload(); } catch (err) { toast(err.message, 'error'); }
}
async function duplicateProduct(p) {
  try { const r = await api(`/products/${p.code}/duplicate`, { method: 'POST', body: {} }); toast(r.message || 'Listing duplicated as a draft.', 'success'); navigate(`/seller/products/${r.code}/edit`); } catch (err) { toast(err.message, 'error'); }
}
async function deleteProduct(p, after) {
  if (!(await confirmDialog({ title: 'Delete this listing?', message: `“${p.title}” will be permanently removed. This cannot be undone.`, confirmLabel: 'Delete listing', danger: true }))) return;
  try { const r = await api(`/products/${p.code}`, { method: 'DELETE' }); toast(r.message, 'success'); if (after) after(); else reload(); } catch (err) { toast(err.message, 'error'); }
}
function productActions(p, write) {
  return [
    { label: 'View', href: `/seller/products/${p.code}`, ico: 'eye' },
    write && { label: 'Edit', href: `/seller/products/${p.code}/edit`, ico: 'edit' },
    write && { label: 'Duplicate', ico: 'copy', onClick: () => duplicateProduct(p) },
    write && p.status === 'active' && { label: 'Deactivate', ico: 'x', onClick: () => listingAction(p, 'deactivate') },
    write && p.status === 'inactive' && { label: 'Activate', ico: 'check', onClick: () => listingAction(p, 'activate') },
    write && ['draft', 'qc_failed', 'rejected'].includes(p.status) && { label: 'Submit for review', ico: 'upload', onClick: () => listingAction(p, 'submit') },
    write && { label: 'Update price', ico: 'tag', onClick: () => priceModal(p) },
    can('inventory.write') && p.status !== 'draft' && { label: 'Update stock', ico: 'layers', onClick: () => stockModal(p).catch((err) => toast(err.message, 'error')) },
    write && ['draft', 'qc_failed', 'rejected'].includes(p.status) && { label: 'Delete', ico: 'trash', danger: true, onClick: () => deleteProduct(p) },
  ];
}

export async function products(ctx) {
  const q = ctx.query;
  const tab = q.tab || 'all';
  const [list, meta] = await Promise.all([api('/products', { query: { tab, q: q.q, category: q.category, sort: q.sort, page: q.page } }), api('/meta/catalog')]);
  const write = can('products.write');
  const filtered = q.q || q.category;
  const table = dataTable({ rows: list.rows, sort: q.sort, rowKey: 'code', columns: [
    { label: 'Product', sort: 'title', render: (p) => h('div.cell-product', thumb(p.image_id, p.title), h('div', h('a', { href: `/seller/products/${p.code}` }, p.title), h('small', `${p.code} · SKU ${p.sku}${p.variant_count ? ` · ${p.variant_count} variants` : ''} `, demoTag(p.is_demo)))) },
    { label: 'Category', render: (p) => p.category || '—' },
    { label: 'Price', sort: 'price', align: 'right', render: (p) => (p.price ? h('div', h('div.strong', inr(p.price)), p.mrp > p.price ? h('div.tiny.muted', `MRP ${inr(p.mrp)}`) : null) : '—') },
    { label: 'Stock', sort: 'stock', align: 'right', render: (p) => h('span', { class: p.available <= 0 && p.status === 'active' ? 'neg strong' : '' }, num(p.available || 0)) },
    { label: 'Status', render: (p) => (p.status === 'active' && p.available <= 0 ? h('div.stack.sm', statusBadge('active', 'Active'), badge('Out of stock', 'red')) : statusBadge(p.status, STATUS_LABEL[p.status])) },
    { label: 'Updated', sort: 'updated', render: (p) => h('span.nowrap.small.muted', ago(p.updated_at)) },
    { label: '', cls: 'actions', render: (p) => rowMenu(productActions(p, write)) }],
    empty: emptyState(filtered ? { ico: 'search', title: 'No listings match your filters', text: 'Try a different search term or clear the filters.', action: h('a.btn', { href: hrefWith({ q: null, category: null, page: null }) }, 'Clear filters') }
      : tab === 'all' ? { ico: 'box', title: 'No products yet', text: 'Add your first product to start building your catalogue.', action: write ? h('a.btn.primary', { href: '/seller/products/new' }, icon('plus', 'sm'), 'Add product') : null }
        : { ico: 'box', title: `No ${PRODUCT_TABS.find((t) => t[0] === tab)[1].toLowerCase()} listings`, text: 'Listings appear here when they reach this status.' }) });
  return h('div.stack',
    pageHead({ title: 'Products', subtitle: 'Create, review and manage every listing in your catalogue.', trail: ['Products'], actions: [
      h('button.btn', { type: 'button', onClick: () => download('/products/export.csv', { tab, q: q.q, category: q.category }) }, icon('download', 'sm'), 'Export CSV'),
      write ? h('a.btn', { href: '/seller/products/bulk-upload' }, icon('upload', 'sm'), 'Bulk upload') : null, write ? h('a.btn.primary', { href: '/seller/products/new' }, icon('plus', 'sm'), 'Add product') : null] }),
    h('div.card', tabs(PRODUCT_TABS.map(([key, label]) => ({ key, label, count: list.counts[key] })), tab, (key) => hrefWith({ tab: key === 'all' ? null : key, page: null })),
      h('div.toolbar', searchBox('Search by title, SKU, brand or product ID'), selectFilter('category', meta.categories, 'All categories'), h('span.spacer'), h('span.small.muted', `${list.total} listing${list.total === 1 ? '' : 's'}`)), table, list.rows.length ? pager(list) : null));
}

export async function productView(ctx) {
  const { product: p } = await api(`/products/${ctx.params.code}`);
  const write = can('products.write');
  const meta = await api('/meta/catalog');
  const attrDefs = meta.category_attributes[p.category] || [];
  let current = (p.images.find((i) => i.is_primary) || p.images[0] || {}).upload_id;
  const main = h('div.gallery-main');
  const thumbs = h('div.gallery-thumbs');
  const draw = () => { main.replaceChildren(current ? h('img', { src: uploadUrl(current), alt: p.title }) : h('div.center', icon('box', 'lg'), h('div.small', 'No image uploaded'))); thumbs.replaceChildren(...p.images.map((img) => h(`button${img.upload_id === current ? '.active' : ''}`, { type: 'button', 'aria-label': 'Show image', onClick: () => { current = img.upload_id; draw(); } }, h('img', { src: uploadUrl(img.upload_id), alt: '' })))); };
  draw();
  const specs = p.specs || {};
  return h('div.stack.lg',
    pageHead({ title: p.title, trail: [['Products', '/seller/products'], p.code], tag: [statusBadge(p.status, STATUS_LABEL[p.status]), ' ', demoTag(p.is_demo)], subtitle: `${p.code} · SKU ${p.sku} · Updated ${fmtDateTime(p.updated_at)}`, actions: [
      write ? h('a.btn.primary', { href: `/seller/products/${p.code}/edit` }, icon('edit', 'sm'), 'Edit') : null,
      write ? h('button.btn', { type: 'button', onClick: () => duplicateProduct(p) }, icon('copy', 'sm'), 'Duplicate') : null,
      write && p.status === 'active' ? h('button.btn', { type: 'button', onClick: () => listingAction(p, 'deactivate') }, 'Deactivate') : null,
      write && p.status === 'inactive' ? h('button.btn', { type: 'button', onClick: () => listingAction(p, 'activate') }, 'Activate') : null,
      write && ['draft', 'qc_failed', 'rejected'].includes(p.status) ? h('button.btn', { type: 'button', onClick: () => listingAction(p, 'submit') }, 'Submit for review') : null,
      write && ['draft', 'qc_failed', 'rejected'].includes(p.status) ? h('button.btn.danger', { type: 'button', onClick: () => deleteProduct(p, () => navigate('/seller/products')) }, icon('trash', 'sm'), 'Delete') : null] }),
    p.qc_notes && p.qc_notes.length ? banner(p.status === 'rejected' ? 'error' : 'warn', [h('b', p.status === 'rejected' ? 'Rejected. ' : 'Quality check issues. '), h('ul', { style: { listStyle: 'disc', paddingLeft: '18px' } }, p.qc_notes.map((n) => h('li', n)))]) : null,
    p.status === 'pending_approval' ? banner('', 'This listing is waiting for catalogue approval and is not visible to customers yet.') : null,
    h('div.grid', { style: { gridTemplateColumns: 'minmax(0, 340px) minmax(0, 1fr)', alignItems: 'start' }, class: 'product-view' },
      h('div.card', h('div.card-body', h('div.gallery', main, thumbs))),
      h('div.stack',
        card({ title: 'Price and stock', actions: [write ? h('button.btn.sm', { type: 'button', onClick: () => priceModal(p) }, 'Update price') : null, can('inventory.write') && p.status !== 'draft' ? h('button.btn.sm', { type: 'button', onClick: () => stockModal(p).catch((err) => toast(err.message, 'error')) }, 'Update stock') : null],
          body: h('div.grid.c4', [['Selling price', p.price ? inr(p.price) : '—'], ['MRP', p.mrp ? inr(p.mrp) : '—'], ['Discount', p.discount_pct ? `${p.discount_pct}%` : '—'], ['GST', p.gst_rate != null ? `${p.gst_rate}%` : '—'], ['Available', num(p.stock.available)], ['Reserved', num(p.stock.reserved)], ['Units sold', num(p.sales.units)], ['Revenue', inr(p.sales.revenue)]].map(([l, v]) => h('div', h('div.small.muted', l), h('div.strong', { style: { fontSize: '17px' } }, v)))) }),
        card({ title: 'Basic information', body: h('div.stack', kv([['Category', p.category], ['Brand', p.brand], ['Model number', p.model_number], ['Dispatch time', p.dispatch_days ? `${p.dispatch_days} day${p.dispatch_days === 1 ? '' : 's'}` : null]]), p.description ? h('p', { style: { whiteSpace: 'pre-wrap' } }, p.description) : null, p.highlights.length ? h('ul', { style: { listStyle: 'disc', paddingLeft: '18px' } }, p.highlights.map((x) => h('li', x))) : null) }),
        card({ title: 'Specifications', body: kv([['Colour', specs.colour], ['Material', specs.material], ['Size', specs.size], ['Dimensions', specs.dimensions], ['Weight', specs.weight], ['Manufacturer', specs.manufacturer], ['Country of origin', specs.country_of_origin], ['HSN code', specs.hsn_code], ...attrDefs.map((a) => [a.label, p.attributes[a.key]]), ['Package', p.package && p.package.weight_g ? `${p.package.weight_g} g · ${p.package.length_cm} × ${p.package.width_cm} × ${p.package.height_cm} cm` : null]]) }),
        p.variants.length ? card({ title: `Variants · ${p.variants.length}`, flush: true, body: dataTable({ compact: true, rows: p.variants, columns: [{ label: 'SKU', key: 'sku' }, { label: 'Size', render: (v) => v.size || '—' }, { label: 'Colour', render: (v) => v.colour || '—' }, { label: 'Price', align: 'right', render: (v) => inr(v.price || p.price) }, { label: 'Available', align: 'right', render: (v) => num(v.available) }, { label: 'Reserved', align: 'right', render: (v) => num(v.reserved) }] }) }) : null)));
}

/* ---------- Product form (7 sections) ---------- */
export async function productForm(ctx) {
  const editing = Boolean(ctx.params.code);
  const [meta, detail] = await Promise.all([api('/meta/catalog'), editing ? api(`/products/${ctx.params.code}`) : null]);
  const p = detail ? detail.product : { highlights: [], specs: { country_of_origin: 'India' }, attributes: {}, package: {}, images: [], variants: [], gst_rate: 18, tax_category: 'Taxable goods', dispatch_days: 2, status: 'draft' };
  if (!can('products.write')) throw new ApiError(403, { error: 'Your role does not have permission to edit products.' });
  const live = ['active', 'inactive', 'pending_approval'].includes(p.status);
  let images = p.images.map((i) => i.upload_id);
  let primary = (p.images.find((i) => i.is_primary) || {}).upload_id || images[0] || null;
  let highlights = [...p.highlights];
  let variants = p.variants.map((v) => ({ id: v.id, sku: v.sku, size: v.size || '', colour: v.colour || '', price: v.price ?? '', quantity: v.quantity ?? v.available ?? 0 }));
  const section = (n, title, text, body) => card({ title: h('span.section-title', h('span.section-num', n), title), subtitle: text, body });
  const F = (o) => field(o);

  // 3 — category attributes are redrawn whenever the category changes.
  const attrBox = h('div');
  const drawAttrs = (category, values) => {
    const defs = meta.category_attributes[category] || [];
    attrBox.replaceChildren(!category ? h('p.muted', 'Choose a category in section 1 to see its required attributes.') : defs.length ? h('div.form-grid', defs.map((a) => { const el = F({ name: `attr__${a.key}`, label: a.label, required: a.required, type: a.type === 'select' ? 'select' : a.type === 'number' ? 'number' : 'text', options: a.options, placeholder: a.placeholder, value: values[a.key] }); el.dataset.field = `attributes.${a.key}`; return el; })) : h('p.muted', 'This category has no extra attributes.'));
  };
  drawAttrs(p.category, p.attributes || {});
  const categoryField = F({ name: 'category', label: 'Category', type: 'select', options: meta.categories, required: true, value: p.category, onChange: (e) => drawAttrs(e.target.value, collectAttrs()) });
  function collectAttrs() { const out = {}; attrBox.querySelectorAll('[name^="attr__"]').forEach((el) => { out[el.name.slice(6)] = el.value.trim(); }); return out; }

  // Highlights
  const hlList = h('div.chips');
  const hlInput = h('input.input', { placeholder: 'e.g. 20-hour battery life', maxlength: 160, 'aria-label': 'Add a highlight' });
  const drawHl = () => hlList.replaceChildren(...highlights.map((text, i) => h('span.chip', text, h('button', { type: 'button', 'aria-label': `Remove highlight ${text}`, onClick: () => { highlights.splice(i, 1); drawHl(); } }, icon('x', 'sm')))));
  const addHl = () => { const v = hlInput.value.trim(); if (!v) return; if (highlights.length >= 8) { toast('You can add up to 8 highlights.', 'error'); return; } highlights.push(v); hlInput.value = ''; drawHl(); hlInput.focus(); };
  hlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addHl(); } });
  drawHl();

  // Pricing preview
  const pricePreview = h('div.price-preview');
  const mrpField = F({ name: 'mrp', label: 'MRP', type: 'number', prefix: '₹', required: true, value: p.mrp, min: 1, step: '0.01', onInput: () => drawPrice() });
  const priceField = F({ name: 'price', label: 'Selling price', type: 'number', prefix: '₹', required: true, value: p.price, min: 1, step: '0.01', onInput: () => drawPrice() });
  const gstField = F({ name: 'gst_rate', label: 'GST rate', type: 'select', options: meta.gst_rates.map((r) => [r, `${r}%`]), value: p.gst_rate, placeholderOption: false, onChange: () => drawPrice() });
  const taxField = F({ name: 'tax_category', label: 'Tax category', type: 'select', options: meta.tax_categories, value: p.tax_category, placeholderOption: false, onChange: () => drawPrice() });
  function drawPrice() {
    const mrp = Number(mrpField.querySelector('input').value); const price = Number(priceField.querySelector('input').value);
    const taxable = taxField.querySelector('select').value === 'Taxable goods';
    gstField.querySelector('select').disabled = !taxable;
    const gst = taxable ? Number(gstField.querySelector('select').value) : 0;
    if (!(mrp > 0) || !(price > 0)) { pricePreview.replaceChildren(h('span.muted', 'Enter the MRP and selling price to see the discount and tax breakdown.')); return; }
    if (price > mrp) { pricePreview.replaceChildren(h('span.neg.strong', 'Selling price cannot be higher than MRP.')); return; }
    const base = price / (1 + gst / 100);
    pricePreview.replaceChildren(h('div.row.between', h('span', 'Discount shown to customers'), h('b', `${Math.round(((mrp - price) / mrp) * 100)}% off`)), h('div.row.between', h('span', 'Taxable value (price before GST)'), h('b', inr(base, { decimals: 2 }))), h('div.row.between', h('span', `GST included @ ${gst}%`), h('b', inr(price - base, { decimals: 2 }))));
  }
  drawPrice();

  // Variants
  const variantBox = h('div');
  const qtyField = F({ name: 'quantity', label: editing ? 'Available quantity' : 'Opening quantity', type: 'number', required: true, min: 0, step: 1, value: editing ? p.quantity : '', hint: 'Units you can dispatch right now.' });
  function drawVariants() {
    qtyField.hidden = variants.length > 0;
    variantBox.replaceChildren(variants.length ? h('div.table-wrap', h('table.data.compact', h('thead', h('tr', ['Variant SKU *', 'Size', 'Colour', 'Price (optional)', 'Quantity *', ''].map((t) => h('th', t)))), h('tbody', variants.map((v, i) => {
      const cell = (key, attrs) => h('td', h('div.field', { dataset: { field: `variants.${i}.${key}` }, style: { minWidth: key === 'sku' ? '170px' : '96px' } }, h('input.input.sm', { value: v[key], 'aria-label': `Variant ${i + 1} ${key}`, onInput: (e) => { v[key] = e.target.value; }, ...attrs }), h('div.error', { hidden: true })));
      return h('tr', cell('sku', { maxlength: 40 }), cell('size', { maxlength: 30 }), cell('colour', { maxlength: 30 }), cell('price', { type: 'number', min: 1, step: '0.01', placeholder: 'Same as listing' }), cell('quantity', { type: 'number', min: 0, step: 1 }),
        h('td.actions', h('button.icon-btn', { type: 'button', 'aria-label': `Remove variant ${i + 1}`, onClick: () => { variants.splice(i, 1); drawVariants(); } }, icon('trash', 'sm'))));
    })))) : h('p.small.muted', 'No variants. This listing is sold as a single SKU. Add variants if it comes in several sizes or colours.'));
  }
  const addVariant = () => { if (variants.length >= 30) { toast('A listing can have up to 30 variants.', 'error'); return; } const base = (form.elements.sku.value || 'SKU').trim(); variants.push({ id: null, sku: `${base}-${variants.length + 1}`.slice(0, 40), size: '', colour: '', price: '', quantity: 0 }); drawVariants(); };
  drawVariants();

  // Images
  const imageGrid = h('div.image-grid');
  const drawImages = () => imageGrid.replaceChildren(...images.map((id) => h(`div.image-tile${id === primary ? '.primary' : ''}`, h('img', { src: uploadUrl(id), alt: 'Product image' }), id === primary ? h('span.flag', 'Primary') : null,
    h('div.tile-actions', id === primary ? h('span') : h('button', { type: 'button', onClick: () => { primary = id; drawImages(); } }, 'Make primary'), h('button', { type: 'button', 'aria-label': 'Remove image', onClick: () => { images = images.filter((x) => x !== id); if (primary === id) primary = images[0] || null; drawImages(); } }, '✕')))));
  async function addFiles(files) {
    for (const file of files) {
      if (images.length >= 8) { toast('A listing can have up to 8 images.', 'error'); break; }
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { toast(`${file.name}: only JPG, PNG or WebP images are accepted.`, 'error'); continue; }
      if (file.size > 2 * 1024 * 1024) { toast(`${file.name} is larger than 2 MB.`, 'error'); continue; }
      try { const up = await uploadFile(file, 'product_image'); images.push(up.id); if (!primary) primary = up.id; drawImages(); } catch (err) { toast(`${file.name}: ${err.message}`, 'error'); }
    }
  }
  const fileInput = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', multiple: true, class: 'sr-only', 'aria-label': 'Upload product images', onChange: async (e) => { const files = [...e.target.files]; e.target.value = ''; dropzone.classList.add('over'); await addFiles(files); dropzone.classList.remove('over'); } });
  const dropzone = h('label.dropzone', { onDragover: (e) => { e.preventDefault(); dropzone.classList.add('over'); }, onDragleave: () => dropzone.classList.remove('over'), onDrop: async (e) => { e.preventDefault(); await addFiles([...e.dataTransfer.files]); dropzone.classList.remove('over'); } }, fileInput, icon('upload', 'lg'), h('b.strong', 'Click to upload or drag images here'), h('span.small', 'JPG, PNG or WebP · up to 2 MB each · up to 8 images'));
  drawImages();

  const specs = p.specs || {}; const pkg = p.package || {};
  const form = h('form.stack.lg', h('div', { dataset: { formError: '' } }),
    section(1, 'Basic information', 'What the product is.', h('div.form-grid',
      F({ name: 'title', label: 'Product title', required: true, value: p.title, full: true, maxlength: 150, hint: '10–150 characters. Include brand, product type and the key feature.' }), categoryField, F({ name: 'brand', label: 'Brand', required: true, value: p.brand, maxlength: 60 }),
      F({ name: 'description', label: 'Product description', type: 'textarea', rows: 5, required: true, value: p.description, full: true, hint: 'At least 30 characters. Describe materials, use and what is in the box.' }),
      h('div.field.full', { dataset: { field: 'highlights' } }, h('span.label', 'Product highlights'), h('div.row', hlInput, h('button.btn', { type: 'button', onClick: addHl }, 'Add')), hlList, h('div.hint', 'Up to 8 short bullet points. Press Enter to add.'), h('div.error', { hidden: true })))),
    section(2, 'Product details', 'Identifiers and specifications.', h('div.form-grid.c3',
      F({ name: 'sku', label: 'Seller SKU', required: true, value: p.sku, maxlength: 40, hint: 'Your own stock code. Letters, numbers, - _ . only.' }), F({ name: 'model_number', label: 'Model number', value: p.model_number, maxlength: 60 }), F({ name: 'spec_hsn_code', label: 'HSN code', value: specs.hsn_code, inputmode: 'numeric', maxlength: 8, hint: '4–8 digits, printed on invoices.' }),
      F({ name: 'spec_colour', label: 'Colour', value: specs.colour }), F({ name: 'spec_material', label: 'Material', value: specs.material }), F({ name: 'spec_size', label: 'Size', value: specs.size }),
      F({ name: 'spec_dimensions', label: 'Product dimensions', value: specs.dimensions, placeholder: '20 x 18 x 8 cm' }), F({ name: 'spec_weight', label: 'Product weight', value: specs.weight, placeholder: '320 g' }), F({ name: 'spec_country_of_origin', label: 'Country of origin', required: true, value: specs.country_of_origin }),
      F({ name: 'spec_manufacturer', label: 'Manufacturer details', required: true, value: specs.manufacturer, full: true, hint: 'Name and address of the manufacturer, packer or importer.' }))),
    section(3, 'Category attributes', 'Details customers filter by in this category.', attrBox),
    section(4, 'Pricing and tax', 'All prices are in ₹ and include GST.', h('div.stack', h('div.form-grid', mrpField, priceField, taxField, gstField), pricePreview)),
    section(5, 'Inventory and variants', 'Stock, dispatch time and size or colour variants.', h('div.stack', h('div.form-grid.c3', qtyField,
      F({ name: 'safety_stock', label: 'Safety stock', type: 'number', min: 0, step: 1, value: editing ? p.stock.safety_stock : meta.low_stock_default, hint: 'You are alerted when available stock falls to this level.' }),
      F({ name: 'dispatch_days', label: 'Dispatch time', type: 'select', options: [1, 2, 3, 4, 5, 6, 7].map((d) => [d, `${d} day${d === 1 ? '' : 's'}`]), value: p.dispatch_days, placeholderOption: false }),
      F({ name: 'warehouse_id', label: 'Warehouse', type: 'select', options: meta.warehouses.map((w) => [w.id, `${w.name} · ${w.city || ''} ${w.pincode || ''}`]), value: p.warehouse_id || (meta.warehouses[0] && meta.warehouses[0].id), placeholderOption: false })),
      h('div.row.between', h('h3', 'Variants'), h('button.btn.sm', { type: 'button', onClick: addVariant }, icon('plus', 'sm'), 'Add variant')), variantBox)),
    section(6, 'Product images', 'The primary image is shown first on your listing. At least one image is needed to submit.', h('div.stack', h('div.field', { dataset: { field: 'image_ids' } }, dropzone, h('div.error', { hidden: true })), imageGrid)),
    section(7, 'Shipping package', 'Weight and size of the packed parcel. Used for shipping fees and labels.', h('div.form-grid', { style: { gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' } },
      (() => { const el = F({ name: 'pkg_weight_g', label: 'Package weight', type: 'number', suffix: 'g', required: true, min: 1, step: 1, value: pkg.weight_g }); el.dataset.field = 'package.weight_g'; return el; })(),
      ...['length', 'width', 'height'].map((dim) => { const el = F({ name: `pkg_${dim}_cm`, label: titleCase(dim), type: 'number', suffix: 'cm', required: true, min: 1, step: '0.1', value: pkg[`${dim}_cm`] }); el.dataset.field = `package.${dim}_cm`; return el; }))),
    h('div.card', h('div.card-body.row.between.wrap', h('div.small.muted', live ? 'This listing is live or under review, so it must stay complete. Saving re-runs the quality check.' : meta.auto_review ? 'Demo review mode: submitted listings that pass the automated quality check go live without a human review.' : 'Submitted listings go live after the catalogue team approves them.'),
      h('div.row.wrap', h('a.btn', { href: editing ? `/seller/products/${p.code}` : '/seller/products' }, 'Cancel'), live ? null : h('button.btn', { type: 'submit', value: 'draft' }, 'Save draft'), h('button.btn.primary', { type: 'submit', value: 'submit' }, live ? 'Save changes' : 'Submit listing')))));

  onSubmit(form, async (v, button) => {
    const action = button && button.value === 'draft' ? 'draft' : 'submit';
    const body = {
      action, title: v.title, sku: v.sku, category: v.category || undefined, brand: v.brand, description: v.description, highlights, model_number: v.model_number,
      specs: { colour: v.spec_colour, material: v.spec_material, size: v.spec_size, dimensions: v.spec_dimensions, weight: v.spec_weight, manufacturer: v.spec_manufacturer, country_of_origin: v.spec_country_of_origin, hsn_code: v.spec_hsn_code },
      attributes: collectAttrs(), package: { weight_g: v.pkg_weight_g ?? undefined, length_cm: v.pkg_length_cm ?? undefined, width_cm: v.pkg_width_cm ?? undefined, height_cm: v.pkg_height_cm ?? undefined },
      mrp: v.mrp ?? undefined, price: v.price ?? undefined, tax_category: v.tax_category, gst_rate: v.gst_rate === undefined || v.gst_rate === '' ? undefined : Number(v.gst_rate), quantity: variants.length ? undefined : v.quantity ?? undefined, safety_stock: v.safety_stock ?? undefined,
      warehouse_id: v.warehouse_id ? Number(v.warehouse_id) : undefined, dispatch_days: Number(v.dispatch_days) || 2, image_ids: images, primary_image_id: primary || undefined, variants: variants.map((x) => ({ ...x })),
    };
    let result;
    try { result = await api(editing ? `/products/${p.code}` : '/products', { method: editing ? 'PUT' : 'POST', body }); } catch (err) {
      if (err.fields) { for (const key of Object.keys(err.fields)) { if (key.startsWith('specs.')) { err.fields[`spec_${key.slice(6)}`] = err.fields[key]; delete err.fields[key]; } } }
      throw err;
    }
    toast(result.message, result.status === 'qc_failed' ? 'error' : 'success');
    navigate(ctx.query.from === 'onboarding' && result.status !== 'qc_failed' ? '/seller/onboarding?step=product' : `/seller/products/${result.code}`);
  });
  return h('div.stack.lg', pageHead({ title: editing ? 'Edit product' : 'Add product', subtitle: editing ? `${p.code} · currently ${STATUS_LABEL[p.status].toLowerCase()}` : 'Seven short sections. Save a draft at any point and finish later.', trail: [['Products', '/seller/products'], editing ? [p.code, `/seller/products/${p.code}`] : 'Add product', ...(editing ? ['Edit'] : [])] }),
    editing && p.qc_notes && p.qc_notes.length ? banner('warn', [h('b', 'Fix these before resubmitting: '), p.qc_notes.join(' ')]) : null, form);
}

/* ---------- Bulk upload ---------- */
function csvUploadCard({ title, text, endpoint, template, onDone, renderResult }) {
  const result = h('div');
  let file = null;
  const name = h('span.small.muted', 'No file chosen');
  const upload = h('button.btn.primary', { type: 'button', disabled: true, onClick: () => busy(upload, async () => {
    const csv = await readText(file);
    if (!csv.trim()) throw new ApiError(400, { error: 'The file is empty.' });
    const r = await api(endpoint, { method: 'POST', body: { csv } });
    result.replaceChildren(renderResult(r));
    if (onDone) onDone(r);
  }) }, icon('upload', 'sm'), 'Upload and process');
  const choose = h('button.btn', { type: 'button', onClick: async () => { const f = await pickFile('.csv,text/csv'); if (!f) return; if (f.size > 900 * 1024) { toast('The file is larger than 900 KB. Split it into smaller files.', 'error'); return; } file = f; name.textContent = `${f.name} · ${Math.max(1, Math.round(f.size / 1024))} KB`; upload.disabled = false; result.replaceChildren(); } }, icon('file', 'sm'), 'Choose CSV file');
  return card({ title, subtitle: text, body: h('div.stack', h('div.row.wrap', choose, name), h('div.row.wrap', upload, template), result) });
}
const errorTable = (errors) => dataTable({ compact: true, rows: errors, columns: [{ label: 'Line', render: (e) => e.line ?? '—' }, { label: 'SKU', render: (e) => e.sku || '—' }, { label: 'Problem', render: (e) => e.message }] });

export async function bulkUpload() {
  if (!can('products.write')) throw new ApiError(403, { error: 'Your role does not have permission to upload products.' });
  return h('div.stack.lg', pageHead({ title: 'Bulk upload', subtitle: 'Create or update up to 500 listings from one CSV file.', trail: [['Products', '/seller/products'], 'Bulk upload'] }),
    h('div.grid.c2-1',
      csvUploadCard({ title: 'Upload product file', text: 'Rows are matched by SKU: new SKUs become drafts, existing SKUs are updated.', endpoint: '/products/import', template: h('button.btn.ghost', { type: 'button', onClick: () => download('/products/import-template.csv') }, icon('download', 'sm'), 'Download template'),
        renderResult: (r) => h('div.stack', banner(r.errors.length ? (r.created + r.updated ? 'warn' : 'error') : 'success', [h('b', `${r.created} created, ${r.updated} updated, ${r.errors.length} rejected. `), r.created ? 'New listings were saved as drafts — review and submit them from the Drafts tab.' : '']), r.errors.length ? errorTable(r.errors) : null, r.created + r.updated ? h('a.btn', { href: '/seller/products?tab=draft' }, 'Open drafts') : null) }),
      card({ title: 'How it works', body: h('ol.prose', { style: { fontSize: '13.5px' } }, h('li', 'Download the template and keep the header row unchanged.'), h('li', 'Fill one product per row. "title" and "sku" are required; separate highlights with the | character.'), h('li', 'Upload the file. Each row is validated on the server and problems are listed with their line number.'), h('li', 'Imported listings are saved as drafts. Add images, then submit them for review.')) })));
}

/* ---------- Inventory ---------- */
const INV_NAV = [['Stock levels', '/seller/inventory'], ['Bulk update', '/seller/inventory/bulk-update'], ['Stock history', '/seller/inventory/history'], ['Warehouses', '/seller/inventory/warehouses']];
const STOCK_LABEL = { healthy: 'Healthy', low: 'Low stock', critical: 'Critical', out_of_stock: 'Out of stock' };

export async function inventory(ctx) {
  const q = ctx.query;
  const data = await api('/inventory', { query: { status: q.status, warehouse: q.warehouse, q: q.q, sort: q.sort, page: q.page } });
  const write = can('inventory.write');
  const s = data.summary;
  const edit = (row) => formModal({ title: 'Update stock', subtitle: `${row.title}${row.variant_label ? ` · ${row.variant_label}` : ''} · ${row.sku}`, submitLabel: 'Save', fields: [
    { name: 'available', label: 'Available quantity', type: 'number', min: 0, step: 1, value: row.available, required: true, hint: `${row.reserved} unit${row.reserved === 1 ? ' is' : 's are'} reserved for open orders and not included.` },
    { name: 'safety_stock', label: 'Safety stock (low-stock threshold)', type: 'number', min: 0, step: 1, value: row.safety_stock, required: true }, { name: 'reason', label: 'Reason', placeholder: 'e.g. New stock received, damaged units removed', maxlength: 160 }],
    onSubmit: async (v) => { if (v.available === null || v.safety_stock === null) throw new ApiError(400, { error: 'Please correct the highlighted fields.', fields: { [v.available === null ? 'available' : 'safety_stock']: 'Enter a whole number, 0 or more.' } }); const r = await api(`/inventory/${row.id}`, { method: 'PATCH', body: { available: v.available, safety_stock: v.safety_stock, reason: v.reason || undefined } }); toast(r.message, 'success'); reload(); } });
  const threshold = () => formModal({ title: 'Low-stock threshold', subtitle: 'The safety stock level that triggers low-stock alerts.', submitLabel: 'Save threshold', fields: [
    { name: 'safety_stock', label: 'Default safety stock', type: 'number', min: 0, step: 1, value: data.low_stock_default, required: true, hint: 'Critical is reached at half of this level.' }, { name: 'apply_to_all', type: 'checkbox', label: 'Also apply this level to all existing SKUs' }],
    onSubmit: async (v) => { const r = await api('/inventory/threshold', { method: 'POST', body: v }); toast(r.message || 'Threshold saved.', 'success'); reload(); } });
  return h('div.stack',
    pageHead({ title: 'Inventory', subtitle: 'Available, reserved and safety stock for every SKU. Orders reserve and deduct stock automatically.', trail: ['Inventory'], actions: [
      h('button.btn', { type: 'button', onClick: () => download('/inventory/export.csv', { status: q.status, warehouse: q.warehouse, q: q.q }) }, icon('download', 'sm'), 'Export CSV'), write ? h('button.btn', { type: 'button', onClick: threshold }, 'Low-stock threshold') : null, write ? h('a.btn.primary', { href: '/seller/inventory/bulk-update' }, icon('upload', 'sm'), 'Bulk update') : null] }),
    subnav(INV_NAV),
    h('div.grid.c4', statCard({ label: 'Available units', value: num(s.available), hint: `${s.skus} SKUs`, ico: 'layers' }), statCard({ label: 'Reserved for orders', value: num(s.reserved), hint: 'Held until dispatch', ico: 'lock', tone: 'violet' }),
      statCard({ label: 'Low or critical', value: num(s.low), hint: `${s.critical} critical`, ico: 'alert', tone: 'amber', href: '/seller/inventory?status=attention' }), statCard({ label: 'Out of stock', value: num(s.out_of_stock), hint: 'Cannot be ordered', ico: 'x', tone: 'red', href: '/seller/inventory?status=out_of_stock' })),
    h('div.card', h('div.toolbar', searchBox('Search by product, SKU or product ID'), selectFilter('status', [['attention', 'Needs attention'], ['healthy', 'Healthy'], ['low', 'Low stock'], ['critical', 'Critical'], ['out_of_stock', 'Out of stock']], 'All stock levels'), data.warehouses.length > 1 ? selectFilter('warehouse', data.warehouses.map((w) => [w.id, w.name]), 'All warehouses') : null, h('span.spacer'), h('span.small.muted', `${data.total} SKU${data.total === 1 ? '' : 's'}`)),
      dataTable({ rows: data.rows, sort: q.sort, rowKey: 'sku', columns: [
        { label: 'Product', sort: 'title', render: (r) => h('div.cell-product', thumb(r.image_id, r.title), h('div', h('a', { href: `/seller/products/${r.product_code}` }, r.title), h('small', `${r.variant_label ? `${r.variant_label} · ` : ''}${STATUS_LABEL[r.listing_status] || r.listing_status} `, demoTag(r.is_demo)))) },
        { label: 'SKU', sort: 'sku', render: (r) => h('span.nowrap', r.sku) }, { label: 'Available', sort: 'available', align: 'right', render: (r) => h('b', num(r.available)) }, { label: 'Reserved', sort: 'reserved', align: 'right', render: (r) => num(r.reserved) },
        { label: 'Safety stock', sort: 'safety', align: 'right', render: (r) => num(r.safety_stock) }, { label: 'Warehouse', render: (r) => r.warehouse || '—' }, { label: 'Status', render: (r) => statusBadge(r.stock_status, STOCK_LABEL[r.stock_status]) },
        { label: 'Updated', sort: 'updated', render: (r) => h('span.small.muted.nowrap', ago(r.updated_at)) },
        { label: '', cls: 'actions', render: (r) => h('span.row', { style: { justifyContent: 'flex-end' } }, write ? h('button.btn.sm', { type: 'button', onClick: () => edit(r) }, 'Update') : null, h('a.btn.sm.ghost', { href: `/seller/inventory/history?q=${encodeURIComponent(r.sku)}`, title: 'Stock history' }, icon('history', 'sm'))) }],
        empty: emptyState(q.q || q.status || q.warehouse ? { ico: 'search', title: 'No SKUs match your filters', action: h('a.btn', { href: '/seller/inventory' }, 'Clear filters') } : { ico: 'layers', title: 'No inventory yet', text: 'Stock records are created when you add a product.', action: can('products.write') ? h('a.btn.primary', { href: '/seller/products/new' }, 'Add product') : null }) }),
      data.rows.length ? pager(data) : null));
}

export async function inventoryBulk() {
  if (!can('inventory.write')) throw new ApiError(403, { error: 'Your role does not have permission to update inventory.' });
  return h('div.stack', pageHead({ title: 'Bulk stock update', subtitle: 'Update available quantity and safety stock for many SKUs from one CSV file.', trail: [['Inventory', '/seller/inventory'], 'Bulk update'] }), subnav(INV_NAV),
    h('div.grid.c2-1',
      csvUploadCard({ title: 'Upload stock file', text: 'The file needs a "sku" column and an "available" and/or "safety_stock" column. Up to 2,000 rows.', endpoint: '/inventory/bulk', template: h('button.btn.ghost', { type: 'button', onClick: () => download('/inventory/export.csv') }, icon('download', 'sm'), 'Download current stock as a starting file'),
        renderResult: (r) => h('div.stack', banner(r.errors.length ? (r.updated ? 'warn' : 'error') : 'success', h('b', `${r.updated} updated, ${r.unchanged} unchanged, ${r.errors.length} rejected.`)), r.errors.length ? errorTable(r.errors) : null, h('a.btn', { href: '/seller/inventory/history' }, 'View stock history')) }),
      card({ title: 'Good to know', body: h('ul.prose', { style: { fontSize: '13.5px' } }, h('li', '"available" is the number of units you can dispatch now. Units reserved for open orders are kept separately and are not changed.'), h('li', 'Every change is written to the stock history with your name.'), h('li', 'Rows with an unknown SKU or an invalid number are skipped and listed with their line number.')) })));
}

const KIND_LABEL = { initial: 'Opening stock', adjustment: 'Manual update', import: 'Bulk update', reserve: 'Reserved for order', release: 'Reservation released', dispatch: 'Dispatched', return: 'Return restocked', rto: 'Returned to seller' };
export async function inventoryHistory(ctx) {
  const q = ctx.query;
  const data = await api('/inventory/history', { query: { q: q.q, kind: q.kind, page: q.page } });
  return h('div.stack', pageHead({ title: 'Stock history', subtitle: 'Every stock movement, who made it and why.', trail: [['Inventory', '/seller/inventory'], 'Stock history'] }), subnav(INV_NAV),
    h('div.card', h('div.toolbar', searchBox('Search by product, SKU or order ID'), selectFilter('kind', Object.entries(KIND_LABEL), 'All movement types'), h('span.spacer'), h('span.small.muted', `${data.total} movement${data.total === 1 ? '' : 's'}`)),
      dataTable({ rows: data.rows, compact: true, columns: [
        { label: 'When', render: (r) => h('span.nowrap', fmtDateTime(r.created_at)) }, { label: 'Product', render: (r) => h('div', h('a.strong', { href: `/seller/products/${r.product_code}` }, r.title), h('div.small.muted', r.sku)) },
        { label: 'Movement', render: (r) => badge(KIND_LABEL[r.kind] || titleCase(r.kind), r.kind === 'dispatch' || r.kind === 'reserve' ? 'blue' : r.kind === 'release' || r.kind === 'return' ? 'green' : '') },
        { label: 'Change', align: 'right', render: (r) => h('b', { class: r.change > 0 ? 'pos' : r.change < 0 ? 'neg' : '' }, r.change > 0 ? `+${r.change}` : String(r.change)) }, { label: 'On hand', align: 'right', render: (r) => num(r.on_hand_after) }, { label: 'Reserved', align: 'right', render: (r) => num(r.reserved_after) },
        { label: 'Reason', render: (r) => h('span', r.reason || '—', r.ref ? [' · ', r.ref.startsWith('ORD-') ? h('a', { href: `/seller/orders/${r.ref}` }, r.ref) : r.ref] : null) }, { label: 'By', render: (r) => r.actor || '—' }],
        empty: emptyState({ ico: 'history', title: q.q || q.kind ? 'No movements match your filters' : 'No stock movements yet', text: 'Movements are recorded when stock is added, adjusted, reserved or dispatched.' }) }), data.rows.length ? pager(data) : null));
}

export async function warehouses() {
  const data = await api('/warehouses');
  const add = () => formModal({ title: 'Add warehouse', submitLabel: 'Add warehouse', fields: [{ name: 'name', label: 'Warehouse name', required: true }, { name: 'city', label: 'City', required: true }, { name: 'pincode', label: 'PIN code', required: true, inputmode: 'numeric', maxlength: 6 }],
    onSubmit: async (v) => { const r = await api('/warehouses', { method: 'POST', body: v }); toast(r.message || 'Warehouse added.', 'success'); reload(); } });
  return h('div.stack', pageHead({ title: 'Warehouses', subtitle: 'Locations where your stock is held.', trail: [['Inventory', '/seller/inventory'], 'Warehouses'], actions: [can('inventory.write') ? h('button.btn.primary', { type: 'button', onClick: add }, icon('plus', 'sm'), 'Add warehouse') : null] }), subnav(INV_NAV),
    h('div.card', dataTable({ rows: data.warehouses, columns: [{ label: 'Code', key: 'code' }, { label: 'Warehouse', render: (w) => h('b.strong', w.name) }, { label: 'City', render: (w) => w.city || '—' }, { label: 'PIN code', render: (w) => w.pincode || '—' }, { label: 'SKUs', align: 'right', render: (w) => num(w.skus) }, { label: 'Units on hand', align: 'right', render: (w) => num(w.units) }, { label: '', cls: 'actions', render: (w) => h('a.btn.sm', { href: `/seller/inventory?warehouse=${w.id}` }, 'View stock') }],
      empty: emptyState({ ico: 'store', title: 'No warehouses yet', text: 'A warehouse is created automatically from your default pickup location when you add your first product.' }) })));
}
