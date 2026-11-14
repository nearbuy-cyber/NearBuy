// Notifications, pickup locations, package settings, support, learning and settings.
import { h, icon, state, api, ApiError, can, navigate, reload, toast, field, onSubmit, formModal, confirmDialog, busy, banner, integrationNote, badge, statusBadge, demoTag, pageHead, card, statCard, tabs, subnav, dataTable, pager, searchBox, selectFilter, emptyState, kv, fmtDate, fmtDateTime, ago, hrefWith, setQuery, titleCase, refreshMe, uploadFile, pickFile, uploadUrl, initials } from './core.js';
import { NOTIF_ICON, signOut } from './shell.js';
import { SHIP_NAV } from './pages-orders.js';
import { bankForm } from './pages-business.js';
import { MODULES, ALL_LESSONS, findModule, FAQS } from './learning-data.js';

/* ---------- Notifications ---------- */
const NOTIF_TYPES = [['order', 'Orders'], ['inventory', 'Inventory'], ['listing', 'Listings'], ['return', 'Returns'], ['payment', 'Payments'], ['shipping', 'Shipping'], ['support', 'Support'], ['account', 'Account']];
export async function notifications(ctx) {
  const q = ctx.query;
  const data = await api('/notifications', { query: { unread: q.unread, type: q.type, page: q.page } });
  if (state.shell) state.shell.setUnread(data.unread);
  const mark = async (body) => { const r = await api('/notifications/read', { method: 'POST', body }); if (state.shell) state.shell.setUnread(r.unread); reload(); };
  return h('div.stack', pageHead({ title: 'Notifications', subtitle: `${data.unread} unread`, trail: ['Notifications'], actions: [h('a.btn', { href: '/seller/settings/notifications' }, icon('settings', 'sm'), 'Preferences'), h('button.btn.primary', { type: 'button', disabled: !data.unread, onClick: (e) => busy(e.currentTarget, () => mark({ all: true })) }, icon('check', 'sm'), 'Mark all as read')] }),
    h('div.card', h('div.toolbar', h('div.seg', h(`a${q.unread === '1' ? '' : '.active'}`, { href: hrefWith({ unread: null, page: null }) }, 'All'), h(`a${q.unread === '1' ? '.active' : ''}`, { href: hrefWith({ unread: '1', page: null }) }, 'Unread')), selectFilter('type', NOTIF_TYPES, 'All types')),
      data.rows.length ? h('div.list', data.rows.map((n) => h(`div.list-row.notif-item${n.read_at ? '' : '.unread'}`, h('span.notif-ico', icon(NOTIF_ICON[n.type] || 'bell')),
        h('div.grow', n.link ? h('a.strong', { href: n.link, onClick: () => { if (!n.read_at) api('/notifications/read', { method: 'POST', body: { ids: [n.id] } }).catch(() => {}); } }, n.title) : h('b.strong', n.title), n.body ? h('div.small.muted', n.body) : null, h('div.tiny.muted', `${fmtDateTime(n.created_at)} · ${ago(n.created_at)}`)),
        n.read_at ? null : h('button.btn.sm.ghost', { type: 'button', onClick: () => mark({ ids: [n.id] }) }, 'Mark as read'))))
        : emptyState({ ico: 'bell', title: q.unread === '1' ? 'You are all caught up' : 'No notifications', text: 'Alerts about orders, stock, listings, returns and payments appear here.' }),
      data.rows.length ? pager(data) : null));
}

/* ---------- Pickup locations and package settings (under Shipping) ---------- */
const pickupFields = (loc, states) => [
  { name: 'name', label: 'Location name', required: true, value: loc.name, placeholder: 'e.g. Main warehouse' }, { name: 'contact_person', label: 'Contact person', required: true, value: loc.contact_person },
  { name: 'mobile', label: 'Contact mobile', required: true, value: loc.mobile, inputmode: 'numeric', maxlength: 10, placeholder: '10-digit mobile number' }, { name: 'pincode', label: 'PIN code', required: true, value: loc.pincode, inputmode: 'numeric', maxlength: 6 },
  { name: 'address', label: 'Address', type: 'textarea', rows: 2, required: true, value: loc.address, full: true }, { name: 'city', label: 'City', required: true, value: loc.city }, { name: 'state', label: 'State', type: 'select', options: states, required: true, value: loc.state },
  { name: 'is_default', label: 'Use as the default pickup location', type: 'checkbox', value: loc.is_default, full: true }];
export async function pickupLocations() {
  const d = await api('/settings');
  const edit = d.can_edit_pickups;
  const open = (loc) => formModal({ title: loc ? 'Edit pickup location' : 'Add pickup location', subtitle: 'Orders are collected from this address. The PIN code decides the shipping zone.', wide: true, submitLabel: loc ? 'Save changes' : 'Add location', fields: pickupFields(loc || {}, d.states),
    onSubmit: async (v) => { const r = await api(loc ? `/settings/pickup-locations/${loc.id}` : '/settings/pickup-locations', { method: loc ? 'PUT' : 'POST', body: v }); toast(r.message, 'success'); reload(); } });
  const remove = async (loc) => { if (!(await confirmDialog({ title: `Remove ${loc.name}?`, message: 'Shipments already created keep this address. New shipments use your default location.', confirmLabel: 'Remove', danger: true }))) return; try { const r = await api(`/settings/pickup-locations/${loc.id}`, { method: 'DELETE' }); toast(r.message, 'success'); reload(); } catch (err) { toast(err.message, 'error'); } };
  return h('div.stack', pageHead({ title: 'Pickup locations', subtitle: 'Addresses your orders are dispatched from.', trail: [['Shipping', '/seller/shipping'], 'Pickup locations'], actions: [edit ? h('button.btn.primary', { type: 'button', onClick: () => open(null) }, icon('plus', 'sm'), 'Add location') : null] }), subnav(SHIP_NAV),
    d.pickup_locations.length ? h('div.grid.c2', d.pickup_locations.map((l) => card({ title: [l.name, ' ', l.is_default ? badge('Default', 'green') : null], actions: edit ? h('span.row', h('button.btn.sm', { type: 'button', onClick: () => open(l) }, 'Edit'), l.is_default && d.pickup_locations.length > 1 ? null : h('button.btn.sm.danger', { type: 'button', onClick: () => remove(l) }, 'Remove')) : null,
      body: kv([['Contact', `${l.contact_person} · ${l.mobile}`], ['Address', l.address], ['City', `${l.city}, ${l.state}`], ['PIN code', l.pincode]]) })))
      : h('div.card', emptyState({ ico: 'pin', title: 'No pickup location yet', text: 'Add the address your orders are collected from. You need one before you can ship.', action: edit ? h('button.btn.primary', { type: 'button', onClick: () => open(null) }, 'Add location') : null })),
    integrationNote('PIN codes are checked for format only. Verifying serviceability for a courier needs a logistics API.'));
}

export async function packageSettings() {
  const d = await api('/settings');
  const p = d.package_settings || {};
  const edit = d.can_edit_pickups;
  const form = h('form.stack', h('div', { dataset: { formError: '' } }), h('div.form-grid',
    field({ name: 'default_weight_g', label: 'Default packed weight', type: 'number', suffix: 'g', required: true, min: 1, max: 50000, step: 1, value: p.default_weight_g, disabled: !edit }), field({ name: 'packaging_type', label: 'Packaging type', type: 'select', options: ['Corrugated box', 'Poly mailer', 'Padded envelope', 'Custom packaging'], required: true, value: p.packaging_type, disabled: !edit }),
    field({ name: 'default_length_cm', label: 'Length', type: 'number', suffix: 'cm', required: true, min: 1, max: 300, step: '0.1', value: p.default_length_cm, disabled: !edit }), field({ name: 'default_width_cm', label: 'Width', type: 'number', suffix: 'cm', required: true, min: 1, max: 300, step: '0.1', value: p.default_width_cm, disabled: !edit }),
    field({ name: 'default_height_cm', label: 'Height', type: 'number', suffix: 'cm', required: true, min: 1, max: 300, step: '0.1', value: p.default_height_cm, disabled: !edit }), field({ name: 'fragile_handling', label: 'Mark packages as fragile by default', type: 'checkbox', value: p.fragile_handling, disabled: !edit, full: true })),
    edit ? h('div.form-actions', h('button.btn.primary', { type: 'submit' }, 'Save package settings')) : h('p.small.muted', 'Your role can view these settings but not change them.'));
  onSubmit(form, async (v) => { const r = await api('/settings/package', { method: 'PUT', body: v }); toast(r.message, 'success'); });
  return h('div.stack', pageHead({ title: 'Package settings', subtitle: 'Defaults used when a product has no packed weight or dimensions of its own.', trail: [['Shipping', '/seller/shipping'], 'Package settings'] }), subnav(SHIP_NAV), card({ title: 'Default package', body: form }),
    banner('', 'Shipping fees are charged by packed weight slab, so accurate weights keep your fee estimates and settlements in line.'));
}

/* ---------- Support ---------- */
const SUPPORT_NAV = [['Help home', '/seller/support'], ['My tickets', '/seller/support/tickets'], ['Raise a ticket', '/seller/support/tickets/new'], ['FAQs', '/seller/support/faqs'], ['Learning Center', '/seller/learning']];
const CAT_ICON = { account: 'user', listing: 'box', order: 'cart', payment: 'wallet', return: 'undo', technical: 'settings' };
const deskNote = () => integrationNote('A live support desk is not connected. Tickets are stored and routed to a team, and replies appear here when marketplace staff answer through the operations API. There is no chat or phone support in this build.');

export async function supportHome() {
  const [meta, list] = await Promise.all([api('/support/meta'), api('/support/tickets', { query: { status: 'active', page_size: 5 } })]);
  const c = list.counts;
  return h('div.stack', pageHead({ title: 'Support', subtitle: 'Find answers or raise a ticket with the right team.', trail: ['Support'], actions: [h('a.btn.primary', { href: '/seller/support/tickets/new' }, icon('plus', 'sm'), 'Raise a ticket')] }), subnav(SUPPORT_NAV),
    h('div.grid.c4', statCard({ label: 'Open', value: c.open, ico: 'help', tone: 'orange', href: '/seller/support/tickets?status=open' }), statCard({ label: 'In progress', value: c.in_progress, ico: 'clock', href: '/seller/support/tickets?status=in_progress' }), statCard({ label: 'Waiting for you', value: c.waiting_for_seller, ico: 'alert', tone: 'amber', href: '/seller/support/tickets?status=waiting_for_seller' }), statCard({ label: 'Resolved', value: c.resolved + c.closed, ico: 'check', tone: 'green', href: '/seller/support/tickets?status=resolved' })),
    card({ title: 'What do you need help with?', body: h('div.grid.c3', Object.entries(meta.categories).map(([key, cat]) => h('a.quick', { href: `/seller/support/tickets/new?category=${key}` }, h('span.notif-ico', icon(CAT_ICON[key] || 'help')), h('div', h('b.strong', cat.label), h('div.small.muted', `Handled by ${cat.team}`))))) }),
    h('div.grid.c2', card({ title: 'Tickets that are still open', flush: true, actions: h('a.btn.sm', { href: '/seller/support/tickets' }, 'All tickets'), body: list.rows.length ? h('div.list', list.rows.map((t) => h('a.list-row', { href: `/seller/support/tickets/${t.code}` }, h('div.grow', h('b.strong', t.subject), h('div.small.muted', `${t.code} · ${t.category_label} · updated ${ago(t.updated_at)}`)), statusBadge(t.status, t.status_label)))) : emptyState({ ico: 'check', title: 'No open tickets', text: 'Tickets you raise appear here until they are resolved.' }) }),
      card({ title: 'Help yourself', flush: true, body: h('div.list', h('a.list-row', { href: '/seller/support/faqs' }, h('span.notif-ico', icon('help')), h('div.grow', h('b.strong', 'Frequently asked questions'), h('div.small.muted', 'Short answers on accounts, listings, orders, payments and returns')), icon('right', 'sm')), h('a.list-row', { href: '/seller/learning' }, h('span.notif-ico', icon('book')), h('div.grow', h('b.strong', 'Learning Center'), h('div.small.muted', `${ALL_LESSONS.length} step-by-step guides`)), icon('right', 'sm'))) })),
    deskNote());
}

export async function tickets(ctx) {
  const q = ctx.query;
  const [meta, data] = await Promise.all([api('/support/meta'), api('/support/tickets', { query: { status: q.status, category: q.category, q: q.q, sort: q.sort, page: q.page } })]);
  const status = q.status || 'all';
  return h('div.stack', pageHead({ title: 'My tickets', subtitle: 'Every request you have raised and where it stands.', trail: [['Support', '/seller/support'], 'My tickets'], actions: [h('a.btn.primary', { href: '/seller/support/tickets/new' }, icon('plus', 'sm'), 'Raise a ticket')] }), subnav(SUPPORT_NAV),
    h('div.card', tabs([{ key: 'all', label: 'All', count: data.counts.all }, ...Object.entries(meta.statuses).map(([key, label]) => ({ key, label, count: data.counts[key] }))], status, (key) => hrefWith({ status: key === 'all' ? null : key, page: null })),
      h('div.toolbar', searchBox('Search by ticket ID, subject or related ID'), selectFilter('category', Object.entries(meta.categories).map(([k, v]) => [k, v.label]), 'All categories')),
      dataTable({ rows: data.rows, sort: q.sort, columns: [
        { label: 'Ticket', render: (t) => h('div', h('a.strong', { href: `/seller/support/tickets/${t.code}` }, t.subject), ' ', demoTag(t.is_demo), h('div.small.muted', `${t.code}${t.related_ref ? ` · about ${t.related_ref}` : ''}`)) }, { label: 'Category', render: (t) => t.category_label }, { label: 'Team', render: (t) => t.assigned_team },
        { label: 'Priority', render: (t) => badge(t.priority, t.priority === 'High' ? 'red' : t.priority === 'Medium' ? 'amber' : '') }, { label: 'Created', sort: 'created', render: (t) => h('span.nowrap', fmtDate(t.created_at)) }, { label: 'Updated', sort: 'updated', render: (t) => h('span.nowrap.small.muted', ago(t.updated_at)) }, { label: 'Status', render: (t) => statusBadge(t.status, t.status_label) }],
        empty: emptyState(q.q || q.category || q.status ? { ico: 'search', title: 'No tickets match your filters' } : { ico: 'help', title: 'No tickets yet', text: 'Raise a ticket when you need help from the marketplace team.', action: h('a.btn.primary', { href: '/seller/support/tickets/new' }, 'Raise a ticket') }) }), data.rows.length ? pager(data) : null));
}

export async function ticketForm(ctx) {
  const meta = await api('/support/meta');
  let attachment = null;
  const fileLabel = h('span.small.muted', 'No file chosen');
  const attach = h('div.field.full', { dataset: { field: 'attachment' } }, h('span.label', 'Attachment (optional)'), h('div.row.wrap', h('button.btn', { type: 'button', onClick: async (e) => { const file = await pickFile('image/jpeg,image/png,image/webp,application/pdf'); if (!file) return; await busy(e.currentTarget, async () => { try { attachment = await uploadFile(file, 'attachment'); fileLabel.textContent = `${attachment.name} · ${Math.max(1, Math.round(attachment.size / 1024))} KB`; } catch (err) { toast(err.message, 'error'); } }); } }, icon('upload', 'sm'), 'Choose file'), fileLabel,
    h('button.btn.sm.ghost', { type: 'button', onClick: () => { attachment = null; fileLabel.textContent = 'No file chosen'; } }, 'Remove')), h('div.hint', 'JPG, PNG, WebP or PDF, up to 3 MB.'), h('div.error', { hidden: true }));
  const relatedRef = field({ name: 'related_ref', label: 'Order or product ID', placeholder: 'e.g. ORD-240012 or PRD-10004', value: ctx.query.ref || '' });
  const relatedType = field({ name: 'related_type', label: 'Related to', type: 'select', placeholderOption: false, options: [['none', 'Not related to an order or product'], ['order', 'An order'], ['product', 'A product']], value: ctx.query.related || 'none', onChange: () => sync() });
  const sync = () => { relatedRef.hidden = relatedType.querySelector('select').value === 'none'; };
  sync();
  const team = h('p.small.muted');
  const category = field({ name: 'category', label: 'Issue category', type: 'select', required: true, options: Object.entries(meta.categories).map(([k, v]) => [k, v.label]), value: ctx.query.category || '', onChange: () => showTeam() });
  const showTeam = () => { const cat = meta.categories[category.querySelector('select').value]; team.textContent = cat ? `This ticket will be routed to ${cat.team} with ${cat.priority.toLowerCase()} priority.` : 'Choose a category so that the ticket reaches the right team.'; };
  showTeam();
  const form = h('form.stack', h('div', { dataset: { formError: '' } }), h('div.form-grid', category, h('div.field', h('span.label', 'Routing'), team), relatedType, relatedRef,
    field({ name: 'subject', label: 'Subject', required: true, full: true, maxlength: 140, placeholder: 'A short summary of the problem' }), field({ name: 'description', label: 'Describe the issue', type: 'textarea', rows: 6, required: true, full: true, hint: 'At least 20 characters. Include what you expected and what happened.' }), attach),
    h('div.form-actions', h('a.btn', { href: '/seller/support/tickets' }, 'Cancel'), h('button.btn.primary', { type: 'submit' }, 'Submit ticket')));
  onSubmit(form, async (v) => { const r = await api('/support/tickets', { method: 'POST', body: { ...v, related_ref: v.related_type === 'none' ? undefined : v.related_ref, attachment_upload_id: attachment ? attachment.id : undefined } }); toast(r.message, 'success'); navigate(`/seller/support/tickets/${r.code}`); });
  return h('div.stack', pageHead({ title: 'Raise a ticket', subtitle: 'Tell us what went wrong and we will route it to the right team.', trail: [['Support', '/seller/support'], ['My tickets', '/seller/support/tickets'], 'New ticket'] }), subnav(SUPPORT_NAV), h('div.grid.main-side', card({ body: form }),
    h('div.stack', card({ title: 'Before you raise a ticket', body: h('ul.plain', h('li', h('a', { href: '/seller/support/faqs' }, 'Check the FAQs'), ' for a quick answer.'), h('li', 'Add the order or product ID so the team can find the record.'), h('li', 'One issue per ticket gets a faster reply.')) }), deskNote())));
}

export async function ticketDetail(ctx) {
  const d = await api(`/support/tickets/${ctx.params.code}`);
  const t = d.ticket;
  const act = async (action) => { if (action === 'close' && !(await confirmDialog({ title: 'Close this ticket?', message: 'Close the ticket if your issue is solved. You can reopen it later.', confirmLabel: 'Close ticket' }))) return; try { const r = await api(`/support/tickets/${t.code}/status`, { method: 'POST', body: { action } }); toast(r.message, 'success'); reload(); } catch (err) { toast(err.message, 'error'); } };
  const reply = h('form.stack.sm', h('div', { dataset: { formError: '' } }), field({ name: 'body', label: 'Add a reply', type: 'textarea', rows: 3, required: true, placeholder: 'Write your message…' }), h('div.form-actions', h('button.btn.primary', { type: 'submit' }, icon('send', 'sm'), 'Send reply')));
  onSubmit(reply, async (v) => { const r = await api(`/support/tickets/${t.code}/replies`, { method: 'POST', body: v }); toast(r.message, 'success'); reload(); });
  const relatedHref = t.related_ref ? (t.related_type === 'order' ? `/seller/orders/${t.related_ref}` : `/seller/products/${t.related_ref}`) : null;
  return h('div.stack.lg', pageHead({ title: t.subject, trail: [['Support', '/seller/support'], ['My tickets', '/seller/support/tickets'], t.code], tag: [statusBadge(t.status, t.status_label), ' ', demoTag(t.is_demo)], subtitle: `${t.code} · ${t.category_label} · raised ${fmtDateTime(t.created_at)} by ${t.created_by}`, actions: [d.can_reopen ? h('button.btn', { type: 'button', onClick: () => act('reopen') }, 'Reopen ticket') : null, d.can_close ? h('button.btn', { type: 'button', onClick: () => act('close') }, 'Close ticket') : null] }),
    t.status === 'waiting_for_seller' ? banner('warn', [h('b', 'Waiting for your reply. '), 'The support team has asked for more information.']) : null,
    h('div.grid.main-side', card({ title: 'Conversation', body: h('div.stack', h('div.thread', d.messages.map((m) => h(`div.msg.${m.author_type}`, h('div.msg-head', h('span.avatar.sm', m.author_type === 'system' ? icon('info', 'sm') : initials(m.author_name)), h('b', m.author_name), m.author_type === 'support' ? badge('Marketplace staff', 'blue') : m.author_type === 'system' ? badge('System', '') : null, h('span.tiny.muted', fmtDateTime(m.created_at))), h('div.msg-body', m.body)))),
      d.can_reply ? reply : h('p.muted', 'This ticket is closed. Reopen it to add a reply.')) }),
      h('div.stack', card({ title: 'Ticket details', body: kv([['Ticket ID', t.code], ['Category', t.category_label], ['Assigned team', t.assigned_team], ['Priority', badge(t.priority, t.priority === 'High' ? 'red' : t.priority === 'Medium' ? 'amber' : '')], ['Related to', relatedHref ? h('a', { href: relatedHref }, t.related_ref) : 'Nothing'], ['Attachment', t.attachment ? h('a', { href: uploadUrl(t.attachment.id), target: '_blank', rel: 'noopener' }, t.attachment.original_name || 'View attachment') : 'None'], ['Last updated', fmtDateTime(t.updated_at)]]) }), deskNote())));
}

export async function faqs(ctx) {
  const term = (ctx.query.q || '').toLowerCase();
  const groups = FAQS.map(([group, items]) => [group, items.filter(([question, answer]) => !term || `${question} ${answer}`.toLowerCase().includes(term))]).filter(([, items]) => items.length);
  return h('div.stack', pageHead({ title: 'Frequently asked questions', subtitle: 'Short answers to common seller questions.', trail: [['Support', '/seller/support'], 'FAQs'] }), subnav(SUPPORT_NAV), h('div.card', h('div.toolbar', searchBox('Search the FAQs'))),
    groups.length ? groups.map(([group, items]) => card({ title: group, flush: true, body: h('div.faq', items.map(([question, answer]) => h('details', h('summary', question), h('p', answer)))) }))
      : h('div.card', emptyState({ ico: 'search', title: 'No answers match your search', text: 'Try different words, or raise a ticket.', action: h('a.btn.primary', { href: '/seller/support/tickets/new' }, 'Raise a ticket') })));
}

/* ---------- Learning Center ---------- */
const pct = (done, total) => (total ? Math.round((done / total) * 100) : 0);
const progressBar = (value) => h('div.progress', { role: 'progressbar', 'aria-valuenow': value, 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('span', { style: { width: `${value}%` } }));
export async function learning(ctx) {
  const p = await api('/learning/progress');
  const done = new Set(p.completed); const saved = new Set(p.bookmarked);
  const term = (ctx.query.q || '').toLowerCase();
  const hits = term ? ALL_LESSONS.filter((l) => `${l.title} ${l.summary} ${l.moduleTitle} ${l.steps.map((s) => s.join(' ')).join(' ')}`.toLowerCase().includes(term)) : [];
  const lessonRow = (l) => h('a.list-row', { href: `/seller/learning/${l.module}/${l.id}` }, h('span.notif-ico', icon(done.has(l.id) ? 'check' : 'book')), h('div.grow', h('b.strong', l.title), h('div.small.muted', `${l.moduleTitle} · ${l.minutes} min read`)), saved.has(l.id) ? badge('Saved', 'amber') : null, done.has(l.id) ? badge('Completed', 'green') : null);
  const total = ALL_LESSONS.length; const completed = ALL_LESSONS.filter((l) => done.has(l.id)).length;
  const next = ALL_LESSONS.find((l) => !done.has(l.id));
  return h('div.stack', pageHead({ title: 'Learning Center', subtitle: 'Step-by-step guides to selling on NearBuy. All lessons are written guides.', trail: ['Learning Center'] }),
    h('div.card', h('div.card-body.row.between.wrap', h('div.grow', { style: { minWidth: '240px' } }, h('div.row.between', h('b.strong', 'Your progress'), h('span.small.muted', `${completed} of ${total} lessons · ${pct(completed, total)}%`)), progressBar(pct(completed, total))), next ? h('a.btn.primary', { href: `/seller/learning/${next.module}/${next.id}` }, completed ? 'Continue learning' : 'Start learning') : badge('All lessons completed', 'green'))),
    h('div.card', h('div.toolbar', searchBox('Search lessons'))),
    term ? card({ title: `${hits.length} lesson${hits.length === 1 ? '' : 's'} found`, flush: true, body: hits.length ? h('div.list', hits.map(lessonRow)) : emptyState({ ico: 'search', title: 'No lessons match your search' }) })
      : [h('div.grid.c3', MODULES.map((m) => { const n = m.lessons.filter((l) => done.has(l.id)).length; return h('a.module-card', { href: `/seller/learning/${m.key}` }, h('span.notif-ico', icon(m.ico)), h('b.strong', m.title), h('p.small.muted', m.summary), progressBar(pct(n, m.lessons.length)), h('span.tiny.muted', `${n} of ${m.lessons.length} lessons completed`)); })),
        saved.size ? card({ title: 'Saved lessons', flush: true, body: h('div.list', ALL_LESSONS.filter((l) => saved.has(l.id)).map(lessonRow)) }) : null]);
}

export async function learningModule(ctx) {
  const m = findModule(ctx.params.module);
  if (!m) throw new ApiError(404, { error: 'There is no learning module with that name.' });
  const p = await api('/learning/progress');
  const done = new Set(p.completed); const saved = new Set(p.bookmarked);
  const n = m.lessons.filter((l) => done.has(l.id)).length;
  return h('div.stack', pageHead({ title: m.title, subtitle: m.summary, trail: [['Learning Center', '/seller/learning'], m.title] }),
    h('div.card', h('div.card-body', h('div.row.between', h('b.strong', 'Module progress'), h('span.small.muted', `${n} of ${m.lessons.length} lessons`)), progressBar(pct(n, m.lessons.length)))),
    card({ title: 'Lessons', flush: true, body: h('div.list', m.lessons.map((l, i) => h('a.list-row', { href: `/seller/learning/${m.key}/${l.id}` }, h('span.notif-ico', done.has(l.id) ? icon('check') : String(i + 1)), h('div.grow', h('b.strong', l.title), h('div.small.muted', `${l.summary} · ${l.minutes} min read`)), saved.has(l.id) ? badge('Saved', 'amber') : null, done.has(l.id) ? badge('Completed', 'green') : null, icon('right', 'sm')))) }));
}

export async function learningLesson(ctx) {
  const m = findModule(ctx.params.module);
  const index = m ? m.lessons.findIndex((l) => l.id === ctx.params.lesson) : -1;
  if (index < 0) throw new ApiError(404, { error: 'That lesson does not exist.' });
  const l = m.lessons[index];
  const p = await api('/learning/progress');
  const isDone = p.completed.includes(l.id); const isSaved = p.bookmarked.includes(l.id);
  const set = async (patch, message) => { await api('/learning/progress', { method: 'POST', body: { lesson_id: l.id, ...patch } }); toast(message, 'success'); reload(); };
  const prev = m.lessons[index - 1]; const next = m.lessons[index + 1];
  return h('div.stack', pageHead({ title: l.title, subtitle: `${m.title} · Lesson ${index + 1} of ${m.lessons.length} · ${l.minutes} min read`, trail: [['Learning Center', '/seller/learning'], [m.title, `/seller/learning/${m.key}`], l.title], tag: isDone ? badge('Completed', 'green') : null, actions: [
    h('button.btn', { type: 'button', 'aria-pressed': String(isSaved), onClick: (e) => busy(e.currentTarget, () => set({ bookmarked: !isSaved }, isSaved ? 'Removed from saved lessons.' : 'Lesson saved.')) }, icon('bookmark', 'sm'), isSaved ? 'Saved' : 'Save lesson')] }),
    h('div.grid.main-side', h('article.card.lesson', h('div.card-body.stack', h('p.lead', l.summary), h('ol.lesson-steps', l.steps.map(([title, text]) => h('li', h('b', title), h('p', text)))), l.link ? h('div', h('a.btn', { href: l.link[1] }, l.link[0], icon('right', 'sm'))) : null),
      h('div.card-foot.row.between.wrap', isDone ? h('button.btn', { type: 'button', onClick: (e) => busy(e.currentTarget, () => set({ completed: false }, 'Marked as not completed.')) }, 'Mark as not completed') : h('button.btn.primary', { type: 'button', onClick: (e) => busy(e.currentTarget, () => set({ completed: true }, 'Lesson completed.')) }, icon('check', 'sm'), 'Mark as completed'),
        h('div.row', prev ? h('a.btn', { href: `/seller/learning/${m.key}/${prev.id}` }, icon('left', 'sm'), 'Previous') : null, next ? h('a.btn', { href: `/seller/learning/${m.key}/${next.id}` }, 'Next lesson', icon('right', 'sm')) : h('a.btn', { href: '/seller/learning' }, 'All modules')))),
      card({ title: 'In this module', flush: true, body: h('div.list', m.lessons.map((x, i) => h(`a.list-row${x.id === l.id ? '.current' : ''}`, { href: `/seller/learning/${m.key}/${x.id}` }, h('span.notif-ico', p.completed.includes(x.id) ? icon('check') : String(i + 1)), h('div.grow', h('span.strong', x.title))))) })));
}

/* ---------- Settings ---------- */
const settingsNav = () => [['Store', '/seller/settings/store'], ['Business details', '/seller/settings/business'], ['Bank account', '/seller/settings/bank'], ['Pickup locations', '/seller/shipping/pickup-locations'], ['Notifications', '/seller/settings/notifications'],
  can('team.manage') ? ['Team', '/seller/settings/team'] : null, ['Roles', '/seller/settings/roles'], can('activity.read') ? ['Activity log', '/seller/settings/activity'] : null, ['My profile', '/seller/settings/profile'], ['Security', '/seller/settings/security']].filter(Boolean);
const SETTINGS_TITLES = { store: 'Store settings', business: 'Business details', bank: 'Bank account', notifications: 'Notification preferences', team: 'Team', roles: 'Roles and permissions', activity: 'Activity log', profile: 'My profile', security: 'Security' };
const readOnlyNote = () => h('p.small.muted', icon('lock', 'sm'), ' Only the store owner can change these settings.');

export async function settings(ctx) {
  const page = ctx.params.page || 'store';
  if (!SETTINGS_TITLES[page]) throw new ApiError(404, { error: 'There is no settings page with that name.' });
  const body = await SETTINGS[page](ctx);
  return h('div.stack', pageHead({ title: SETTINGS_TITLES[page], trail: [['Settings', '/seller/settings/store'], SETTINGS_TITLES[page]] }), subnav(settingsNav(), `/seller/settings/${page}`), body);
}

const SETTINGS = {
  async store() {
    const d = await api('/settings');
    const s = d.store; const edit = d.can_manage;
    let logoId = s.logo_upload_id;
    const preview = h('div.logo-preview');
    const draw = () => preview.replaceChildren(logoId ? h('img', { src: uploadUrl(logoId), alt: 'Store logo' }) : h('span', initials(s.store_name)));
    draw();
    const form = h('form.stack', h('div', { dataset: { formError: '' } }),
      h('div.field', { dataset: { field: 'logo_upload_id' } }, h('span.label', 'Store logo'), h('div.row.wrap', preview, edit ? h('button.btn', { type: 'button', onClick: async (e) => { const file = await pickFile('image/jpeg,image/png,image/webp'); if (!file) return; await busy(e.currentTarget, async () => { try { const up = await uploadFile(file, 'logo'); logoId = up.id; draw(); toast('Logo uploaded. Save to apply it.', 'success'); } catch (err) { toast(err.message, 'error'); } }); } }, icon('upload', 'sm'), 'Upload logo') : null, edit && logoId ? h('button.btn.ghost', { type: 'button', onClick: () => { logoId = null; draw(); } }, 'Remove') : null), h('div.hint', 'JPG, PNG or WebP up to 1 MB.'), h('div.error', { hidden: true })),
      h('div.form-grid', field({ name: 'store_name', label: 'Store name', required: true, value: s.store_name, maxlength: 60, disabled: !edit }), field({ name: 'contact_email', label: 'Customer support email', type: 'email', required: true, value: s.contact_email, disabled: !edit }), field({ name: 'contact_phone', label: 'Customer support phone', required: true, value: s.contact_phone, inputmode: 'numeric', maxlength: 10, disabled: !edit }), h('div'),
        field({ name: 'store_description', label: 'Store description', type: 'textarea', rows: 3, required: true, value: s.store_description, full: true, disabled: !edit, hint: 'Shown to customers on your store page. 20 to 600 characters.' })),
      edit ? h('div.form-actions', h('button.btn.primary', { type: 'submit' }, 'Save store settings')) : readOnlyNote());
    onSubmit(form, async (v) => { const r = await api('/settings/store', { method: 'PUT', body: { ...v, logo_upload_id: logoId || undefined } }); toast(r.message, 'success'); await refreshMe(); reload(); });
    return h('div.grid.main-side', card({ title: 'Store profile', body: form }), card({ title: 'Seller account', body: kv([['Seller ID', d.seller.code], ['Account status', statusBadge(d.seller.status, d.seller.status_label)], d.seller.status_note ? ['Note', d.seller.status_note] : null, ['Registered', fmtDate(d.seller.created_at)], ['Signed in as', `${d.me.name} · ${d.me.role_label}`]]) }));
  },
  async business() {
    const d = await api('/settings');
    const b = d.business; const edit = d.can_manage;
    const form = h('form.stack', h('div', { dataset: { formError: '' } }), h('div.form-grid',
      field({ name: 'legal_name', label: 'Business legal name', required: true, value: b.legal_name, disabled: !edit }), field({ name: 'business_type', label: 'Business type', type: 'select', options: d.business_types, required: true, value: b.business_type, disabled: !edit }),
      field({ name: 'gstin', label: 'GSTIN', required: true, value: b.gstin, maxlength: 15, placeholder: '22AAAAA0000A1Z5', disabled: !edit, hint: '15 characters. The format and checksum are validated.' }),
      field({ name: 'pan', label: b.has_pan ? 'PAN (leave blank to keep)' : 'PAN', required: !b.has_pan, maxlength: 10, placeholder: b.has_pan ? b.pan_masked : 'AAAAA0000A', disabled: !edit, hint: b.has_pan ? `Saved as ${b.pan_masked}. Stored encrypted.` : 'Must match characters 3–12 of the GSTIN.' }),
      field({ name: 'address', label: 'Registered address', type: 'textarea', rows: 2, required: true, value: b.address, full: true, disabled: !edit }), field({ name: 'city', label: 'City', required: true, value: b.city, disabled: !edit }), field({ name: 'state', label: 'State', type: 'select', options: d.states, required: true, value: b.state, disabled: !edit }),
      field({ name: 'pincode', label: 'PIN code', required: true, value: b.pincode, inputmode: 'numeric', maxlength: 6, disabled: !edit })), edit ? h('div.form-actions', h('button.btn.primary', { type: 'submit' }, 'Save business details')) : readOnlyNote());
    onSubmit(form, async (v) => { const r = await api('/settings/business', { method: 'PUT', body: { ...v, pan: v.pan || undefined } }); toast(r.message, 'success'); await refreshMe(); reload(); });
    return h('div.stack', card({ title: 'Business information', subtitle: b.updated_at ? `Last updated ${fmtDateTime(b.updated_at)}` : null, body: form }), integrationNote('GSTIN and PAN are checked for format and for consistency with each other. Confirming them against government records needs a KYC verification API.'));
  },
  async bank() {
    const d = await api('/settings');
    if (d.bank === undefined) return h('div.card', emptyState({ ico: 'lock', title: 'Bank details are restricted', text: 'Only the store owner and finance viewers can see payout details.' }));
    const b = d.bank;
    return h('div.stack', h('div.grid.c2', card({ title: 'Saved account', body: b ? kv([['Account holder', b.holder_name], ['Bank', b.bank_name], ['Account number', b.account_masked], ['IFSC', b.ifsc], ['Verification', badge('Not verified', 'amber')], ['Last updated', fmtDateTime(b.updated_at)]]) : emptyState({ ico: 'bank', title: 'No bank account yet', text: 'Add the account your settlements should be addressed to.' }) }),
      d.can_manage ? card({ title: b ? 'Replace bank account' : 'Add bank account', body: bankForm(b) }) : card({ title: 'Changing bank details', body: readOnlyNote() })),
    integrationNote('Bank accounts are not verified, and no payouts are made by this system. Both need a bank or payment-provider integration.'));
  },
  async notifications() {
    const d = await api('/settings');
    const edit = d.can_manage;
    const form = h('form.stack', h('div', { dataset: { formError: '' } }), h('div.list', Object.entries(d.notification_types).map(([key, label]) => h('div.list-row.pref', h('div.grow', h('b.strong', titleCase(key)), h('div.small.muted', label)), h('label.switch', h('input', { type: 'checkbox', name: key, checked: d.notification_prefs[key], disabled: !edit, 'aria-label': label }), h('span'))))),
      edit ? h('div.form-actions', h('button.btn.primary', { type: 'submit' }, 'Save preferences')) : readOnlyNote());
    onSubmit(form, async (v) => { const r = await api('/settings/notifications', { method: 'PUT', body: v }); toast(r.message, 'success'); });
    return h('div.stack', card({ title: 'In-app notifications', subtitle: 'Choose which alerts appear under the bell for your store.', flush: true, body: form }), integrationNote(state.me.mail.configured ? 'Email is configured for account messages (verification, password reset, invitations). Order and stock alerts are shown in the app only.' : 'No email provider is configured, so alerts are shown in the app only. SMS and push alerts need a messaging provider.'));
  },
  async team() {
    if (!can('team.manage')) throw new ApiError(403, { error: 'Only the store owner can manage the team.' });
    const d = await api('/team');
    const roles = d.roles.filter((r) => r.key !== 'owner');
    const showInvite = (r) => { toast(r.message, r.invite.delivered ? 'success' : 'info', 7000); if (r.invite.dev_link) openDevLink(r.invite.dev_link); reload(); };
    const invite = () => formModal({ title: 'Invite a team member', subtitle: 'They receive a link to set their own password. The link is valid for 72 hours.', submitLabel: 'Send invitation', fields: [{ name: 'name', label: 'Full name', required: true }, { name: 'email', label: 'Work email', type: 'email', required: true }, { name: 'role', label: 'Role', type: 'select', required: true, options: roles.map((r) => [r.key, r.label]), hint: 'See the Roles tab for what each role can do.' }],
      onSubmit: async (v) => { const r = await api('/team', { method: 'POST', body: v }); setTimeout(() => showInvite(r), 0); } });
    const changeRole = (m) => formModal({ title: `Change role for ${m.name}`, submitLabel: 'Change role', fields: [{ name: 'role', label: 'Role', type: 'select', required: true, placeholderOption: false, value: m.role, options: roles.map((r) => [r.key, `${r.label} — ${r.description}`]) }], onSubmit: async (v) => { const r = await api(`/team/${m.id}`, { method: 'PATCH', body: v }); toast(r.message, 'success'); reload(); } });
    const remove = async (m) => { if (!(await confirmDialog({ title: `Remove ${m.name}?`, message: 'They are signed out of every device immediately and can no longer access this store.', confirmLabel: 'Remove access', danger: true }))) return; try { const r = await api(`/team/${m.id}`, { method: 'DELETE' }); toast(r.message, 'success'); reload(); } catch (err) { toast(err.message, 'error'); } };
    const resend = async (m) => { try { const r = await api(`/team/${m.id}/resend-invite`, { method: 'POST', body: {} }); toast(r.message, r.invite.delivered ? 'success' : 'info', 7000); if (r.invite.dev_link) openDevLink(r.invite.dev_link); } catch (err) { toast(err.message, 'error'); } };
    return h('div.stack', state.me.mail.configured ? null : banner('warn', [h('b', 'Email is not configured. '), 'Invitations are created but cannot be delivered until an email provider (SMTP) is set up on the server.', state.me.mail.dev_preview ? ' In development preview mode the invitation link is shown to you instead.' : '']),
      card({ title: `Team members · ${d.members.length}`, flush: true, actions: h('button.btn.primary.sm', { type: 'button', onClick: invite }, icon('plus', 'sm'), 'Invite member'), body: dataTable({ rows: d.members, columns: [
        { label: 'Member', render: (m) => h('div.row', h('span.avatar.sm', initials(m.name)), h('div', h('b.strong', m.name), h('div.small.muted', m.email))) }, { label: 'Role', render: (m) => m.role_label }, { label: 'Status', render: (m) => statusBadge(m.status === 'active' ? 'active' : 'invited', m.status === 'active' ? 'Active' : 'Invitation pending') },
        { label: 'Last sign-in', render: (m) => (m.last_login_at ? ago(m.last_login_at) : 'Never') }, { label: '', cls: 'actions', render: (m) => (m.is_owner ? h('span.small.muted', 'Owner') : h('span.row', { style: { justifyContent: 'flex-end' } }, m.status === 'invited' ? h('button.btn.sm', { type: 'button', onClick: (e) => busy(e.currentTarget, () => resend(m)) }, 'Resend') : null, h('button.btn.sm', { type: 'button', onClick: () => changeRole(m) }, 'Change role'), h('button.btn.sm.danger', { type: 'button', onClick: () => remove(m) }, 'Remove'))) }] }) }));
  },
  async roles() {
    const d = await api('/roles');
    const groups = {};
    for (const perm of d.permissions) { const [area, level] = perm.split('.'); (groups[area] = groups[area] || []).push(level); }
    const cell = (role, area) => { const has = groups[area].filter((level) => role.permissions.includes(`${area}.${level}`)); if (!has.length) return h('span.muted', '—'); const full = has.length === groups[area].length; const label = has.some((x) => ['write', 'manage'].includes(x)) ? 'Manage' : has.includes('use') ? 'Use' : 'View'; return badge(label, full && label !== 'View' ? 'green' : 'blue'); };
    return h('div.stack', h('div.grid.c3', d.roles.map((r) => h('div.card', h('div.card-body', h('b.strong', r.label), ' ', r.key === state.me.role ? badge('Your role', 'amber') : null, h('p.small.muted', { style: { marginTop: '6px' } }, r.description))))),
      card({ title: 'Permission matrix', subtitle: 'The server enforces these on every request, not just in the menu.', flush: true, body: h('div.table-wrap', h('table.data.compact', h('thead', h('tr', h('th', 'Area'), d.roles.map((r) => h('th', r.label)))), h('tbody', Object.keys(groups).map((area) => h('tr', h('td', h('b.strong', titleCase(area))), d.roles.map((r) => h('td', cell(r, area)))))))) }));
  },
  async activity(ctx) {
    if (!can('activity.read')) throw new ApiError(403, { error: 'Only the store owner can view the activity log.' });
    const q = ctx.query;
    const data = await api('/activity', { query: { q: q.q, entity: q.entity, page: q.page } });
    return h('div.card', h('div.toolbar', searchBox('Search by person, action or reference'), selectFilter('entity', ['product', 'inventory', 'order', 'return', 'shipment', 'payment', 'promotion', 'campaign', 'support', 'settings', 'team', 'security'].map((e) => [e, titleCase(e)]), 'All areas')),
      dataTable({ compact: true, rows: data.rows, columns: [{ label: 'When', render: (a) => h('span.nowrap', fmtDateTime(a.created_at)) }, { label: 'Who', key: 'actor' }, { label: 'Action', render: (a) => h('b.strong', a.action) }, { label: 'Area', render: (a) => badge(titleCase(a.entity), '') }, { label: 'Reference', render: (a) => a.entity_ref || '—' }, { label: 'Detail', render: (a) => a.detail || '—' }], empty: emptyState({ ico: 'clock', title: q.q || q.entity ? 'No activity matches your filters' : 'No activity recorded yet' }) }), data.rows.length ? pager(data) : null);
  },
  async profile() {
    const d = await api('/settings');
    const form = h('form.stack', h('div', { dataset: { formError: '' } }), h('div.form-grid', field({ name: 'name', label: 'Full name', required: true, value: d.me.name }), field({ name: 'mobile', label: 'Mobile number', required: true, value: d.me.mobile, inputmode: 'numeric', maxlength: 10 }), field({ name: 'email_display', label: 'Email', value: d.me.email, disabled: true, hint: 'Your email is your sign-in ID and cannot be changed here.' }), field({ name: 'role_display', label: 'Role', value: d.me.role_label, disabled: true })),
      h('div.form-actions', h('button.btn.primary', { type: 'submit' }, 'Save profile')));
    onSubmit(form, async (v) => { const r = await api('/settings/profile', { method: 'PUT', body: { name: v.name, mobile: v.mobile } }); toast(r.message, 'success'); await refreshMe(); reload(); });
    return card({ title: 'Your details', body: form });
  },
  async security() {
    const d = await api('/auth/sessions');
    const form = h('form.stack', h('div', { dataset: { formError: '' } }), field({ name: 'current_password', label: 'Current password', type: 'password', required: true }), field({ name: 'new_password', label: 'New password', type: 'password', required: true, autocomplete: 'new-password', hint: 'At least 8 characters with an uppercase letter, a lowercase letter and a number.' }), field({ name: 'confirm_password', label: 'Confirm new password', type: 'password', required: true, autocomplete: 'new-password' }), h('div.form-actions', h('button.btn.primary', { type: 'submit' }, 'Change password')));
    onSubmit(form, async (v) => { const r = await api('/auth/change-password', { method: 'POST', body: v }); toast(r.other_sessions_signed_out ? `Password changed. ${r.other_sessions_signed_out} other session${r.other_sessions_signed_out === 1 ? ' was' : 's were'} signed out.` : 'Password changed.', 'success'); reload(); });
    const end = async (sess) => { try { await api(`/auth/sessions/${sess.id}`, { method: 'DELETE' }); toast('Session ended.', 'success'); reload(); } catch (err) { toast(err.message, 'error'); } };
    const device = (ua) => { const s = String(ua || ''); const browser = /Edg\//.test(s) ? 'Edge' : /Chrome\//.test(s) ? 'Chrome' : /Firefox\//.test(s) ? 'Firefox' : /Safari\//.test(s) ? 'Safari' : 'Unknown browser'; const os = /Windows/.test(s) ? 'Windows' : /Android/.test(s) ? 'Android' : /iPhone|iPad/.test(s) ? 'iOS' : /Mac OS/.test(s) ? 'macOS' : /Linux/.test(s) ? 'Linux' : ''; return os ? `${browser} on ${os}` : browser; };
    return h('div.grid.c2', card({ title: 'Change password', subtitle: 'Changing your password signs you out of every other device.', body: form }),
      card({ title: 'Signed-in devices', flush: true, actions: h('button.btn.sm', { type: 'button', onClick: () => signOut() }, 'Sign out'), body: h('div.list', d.sessions.map((sess) => h('div.list-row', h('span.notif-ico', icon('shield')), h('div.grow', h('b.strong', device(sess.user_agent)), ' ', sess.current ? badge('This device', 'green') : null, h('div.small.muted', `Signed in ${fmtDateTime(sess.created_at)} · last active ${ago(sess.last_seen_at)}`)), sess.current ? null : h('button.btn.sm.danger', { type: 'button', onClick: () => end(sess) }, 'End session')))) }));
  },
};

function openDevLink(link) {
  import('./core.js').then(({ openModal }) => {
    const input = h('input.input', { value: link, readOnly: true, 'aria-label': 'Invitation link', onFocus: (e) => e.target.select() });
    openModal({ title: 'Development preview: invitation link', subtitle: 'No email provider is configured, so the email was not sent. This link is shown only because DEV_MAIL_PREVIEW is enabled on the server.', body: h('div.stack', input, h('div.form-actions', h('button.btn.primary', { type: 'button', onClick: async () => { try { await navigator.clipboard.writeText(link); toast('Link copied.', 'success'); } catch { input.select(); toast('Select the link and copy it.', 'info'); } } }, 'Copy link'))) });
  });
}
