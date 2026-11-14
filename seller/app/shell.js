// Application frame: collapsible sidebar, top header (search, notifications, help, profile) and mobile drawer.
import { h, icon, state, api, can, navigate, toast, ago, initials, refreshMe, uploadUrl } from './core.js';

export const NAV = [
  { group: 'Sell', items: [
    { label: 'Dashboard', href: '/seller/dashboard', ico: 'dashboard' },
    { label: 'Products', href: '/seller/products', ico: 'box', perm: 'products.read' },
    { label: 'Inventory', href: '/seller/inventory', ico: 'layers', perm: 'inventory.read' },
    { label: 'Orders', href: '/seller/orders', ico: 'cart', perm: 'orders.read' },
    { label: 'Deliveries', href: '/seller/deliveries', ico: 'send', perm: 'orders.read' },
    { label: 'Returns', href: '/seller/returns', ico: 'undo', perm: 'returns.read' },
    { label: 'Shipping', href: '/seller/shipping', ico: 'truck', perm: 'shipping.read' },
  ] },
  { group: 'Grow', items: [
    { label: 'Payments', href: '/seller/payments', ico: 'wallet', perm: 'payments.read' },
    { label: 'Growth & promotions', href: '/seller/growth', ico: 'trending', perm: 'growth.read' },
    { label: 'Advertising', href: '/seller/advertising', ico: 'megaphone', perm: 'ads.read' },
    { label: 'Analytics & reports', href: '/seller/analytics', ico: 'chart', perm: 'analytics.read' },
  ] },
  { group: 'Help & account', items: [
    { label: 'Seller support', href: '/seller/support', ico: 'lifebuoy', perm: 'support.use' },
    { label: 'Learning centre', href: '/seller/learning', ico: 'book' },
    { label: 'Settings', href: '/seller/settings', ico: 'settings' },
  ] },
];
const COLLAPSE_KEY = 'nb-seller-sidebar'; // interface preference only; no account data is kept in browser storage

function popover(button, build) {
  const wrap = h('div.popover-wrap', button);
  let pop = null;
  const close = () => { if (pop) { pop.remove(); pop = null; button.setAttribute('aria-expanded', 'false'); document.removeEventListener('click', outside, true); document.removeEventListener('keydown', onKey); } };
  const outside = (e) => { if (!wrap.contains(e.target)) close(); };
  const onKey = (e) => { if (e.key === 'Escape') { close(); button.focus(); } };
  button.setAttribute('aria-expanded', 'false');
  button.addEventListener('click', () => {
    if (pop) { close(); return; }
    pop = build(close);
    wrap.append(pop);
    button.setAttribute('aria-expanded', 'true');
    document.addEventListener('click', outside, true);
    document.addEventListener('keydown', onKey);
  });
  return wrap;
}

export function buildShell() {
  const me = state.me;
  const collapsed = localStorage.getItem(COLLAPSE_KEY) === '1';
  const content = h('main.content', { id: 'content', tabindex: '-1' });
  const notice = h('div');
  const app = h(`div.app${collapsed ? '.collapsed' : ''}`);
  const links = [];

  const nav = h('nav.sidebar-nav', { 'aria-label': 'Seller Hub sections' }, NAV.map((group) => {
    const items = group.items.filter((item) => !item.perm || can(item.perm));
    if (!items.length) return null;
    return [h('div.nav-group', group.group), items.map((item) => { const a = h('a.nav-link', { href: item.href, title: item.label }, icon(item.ico), h('span', item.label)); links.push([item.href, a]); return a; })];
  }));
  const logo = me.seller && me.seller.logo_upload_id ? h('span.avatar', h('img', { src: uploadUrl(me.seller.logo_upload_id), alt: '' })) : h('span.avatar', initials(me.seller ? me.seller.store_name : me.user.name));
  const sidebar = h('aside.sidebar', { id: 'sidebar' },
    h('div.sidebar-head', h('a', { href: '/seller/dashboard', 'aria-label': 'NearBuy Seller Hub home' }, h('span.sidebar-logo', h('img', { src: '/public/assets/nearbuy-logo.png', alt: 'NearBuy' })), h('span.sidebar-mark', 'NB'), h('span.sidebar-title', 'Seller Hub'))),
    nav,
    h('div.sidebar-foot', h('a.store-card', { href: '/seller/settings/store', title: 'Store settings' }, logo, h('div.grow', h('div.truncate', me.seller ? me.seller.store_name : '—'), h('small', me.seller ? me.seller.code : '')))));

  const closeDrawer = () => app.classList.remove('drawer');
  const menuButton = h('button.icon-btn.bordered', { type: 'button', 'aria-label': 'Toggle navigation', 'aria-controls': 'sidebar', onClick: () => {
    if (window.matchMedia('(max-width: 980px)').matches) app.classList.toggle('drawer');
    else { const now = app.classList.toggle('collapsed'); localStorage.setItem(COLLAPSE_KEY, now ? '1' : '0'); }
  } }, icon('menu'));

  const searchInput = h('input', { type: 'search', name: 'q', placeholder: 'Search products, orders, returns, tickets…', 'aria-label': 'Search the Seller Hub', autocomplete: 'off' });
  const searchForm = h('form.search', { role: 'search', onSubmit: (e) => { e.preventDefault(); const q = searchInput.value.trim(); if (q.length < 2) { toast('Type at least 2 characters to search.', 'info'); return; } navigate(`/seller/search?q=${encodeURIComponent(q)}`); } }, icon('search'), searchInput);

  const dot = h('span.dot', { hidden: true });
  const setUnread = (n) => { dot.hidden = !n; dot.textContent = n > 99 ? '99+' : String(n); bell.setAttribute('aria-label', n ? `Notifications, ${n} unread` : 'Notifications'); };
  const bell = h('button.icon-btn', { type: 'button', 'aria-haspopup': 'true' }, icon('bell'), dot);
  const bellWrap = popover(bell, (close) => {
    const list = h('div', h('div.loading-block', h('div.skeleton'), h('div.skeleton', { style: { width: '70%' } })));
    const pop = h('div.popover.notif-pop',
      h('div.menu-head.row.between', h('b.strong', 'Notifications'), h('button.link-btn.small', { type: 'button', onClick: async () => { try { const r = await api('/notifications/read', { method: 'POST', body: { all: true } }); setUnread(r.unread ?? 0); load(); } catch (err) { toast(err.message, 'error'); } } }, 'Mark all as read')),
      list, h('div.menu', h('a', { href: '/seller/notifications', onClick: close }, icon('right', 'sm'), 'View all notifications')));
    async function load() {
      try {
        const data = await api('/notifications', { query: { page_size: 6 } });
        setUnread(data.unread);
        list.replaceChildren(...(data.rows.length ? data.rows.map((n) => h(`a.notif-item${n.read_at ? '' : '.unread'}`, { href: n.link || '/seller/notifications', onClick: () => { close(); if (!n.read_at) api('/notifications/read', { method: 'POST', body: { ids: [n.id] } }).then((r) => setUnread(r.unread ?? 0)).catch(() => {}); } },
          h(`span.notif-ico.${n.type}`, icon(NOTIF_ICON[n.type] || 'bell', 'sm')), h('div.grow', h('b', n.title), n.body ? h('div.small.muted', n.body) : null, h('div.tiny.faint', ago(n.created_at))))) : [h('div.empty', { style: { padding: '26px' } }, h('p', 'You have no notifications yet.'))]));
      } catch (err) { list.replaceChildren(h('div.empty', { style: { padding: '22px' } }, h('p', err.message))); }
    }
    load();
    return pop;
  });

  const profileButton = h('button.profile-btn', { type: 'button', 'aria-haspopup': 'menu', 'aria-label': 'Account menu' }, h('span.avatar.navy', initials(me.user.name)), h('div', h('b', me.user.name), h('small', me.role_label)));
  const profileWrap = popover(profileButton, (close) => h('div.popover.menu', { role: 'menu' },
    h('div.menu-head', h('b.strong', me.user.name), h('div.small.muted', me.user.email), h('div.tiny.muted', `${me.role_label} · ${me.seller ? me.seller.store_name : ''}`)),
    h('a', { href: '/seller/settings/profile', onClick: close }, icon('user', 'sm'), 'My profile'),
    h('a', { href: '/seller/account-status', onClick: close }, icon('shield', 'sm'), 'Account status'),
    h('a', { href: '/seller/settings', onClick: close }, icon('settings', 'sm'), 'Settings'),
    h('a', { href: '/', onClick: close }, icon('external', 'sm'), 'NearBuy website'),
    h('hr'),
    h('button', { type: 'button', onClick: async () => { close(); await signOut(); } }, icon('logout', 'sm'), 'Sign out')));

  const topbar = h('header.topbar', menuButton, searchForm,
    h('div.topbar-right', bellWrap, h('a.icon-btn', { href: '/seller/support', 'aria-label': 'Help and support', title: 'Help and support' }, icon('help')), profileWrap));

  app.append(sidebar, h('div.backdrop', { onClick: closeDrawer }), h('div.main', topbar, notice, content, h('div.footer-note', 'NearBuy Seller Hub · Records marked DEMO DATA are samples · Carrier booking, payouts, ad delivery and KYC need external integrations')));
  setUnread(me.unread_notifications || 0);

  function setActive(path) {
    let best = null;
    for (const [href, a] of links) { a.classList.remove('active'); a.removeAttribute('aria-current'); if ((path === href || path.startsWith(`${href}/`)) && (!best || href.length > best[0].length)) best = [href, a]; }
    if (best) { best[1].classList.add('active'); best[1].setAttribute('aria-current', 'page'); }
    closeDrawer();
    const seller = state.me && state.me.seller;
    const onStatusPages = path.startsWith('/seller/onboarding') || path.startsWith('/seller/account-status');
    notice.replaceChildren();
    if (seller && seller.status !== 'approved' && !onStatusPages) {
      const text = { pending_verification: 'Finish onboarding to start selling.', not_started: 'Finish onboarding to start selling.', under_review: 'Your onboarding details are under review.', rejected: 'Your seller application was not approved.', action_required: 'Your seller account needs attention.' }[seller.status] || 'Complete onboarding to start selling.';
      notice.append(h('div', { style: { padding: '14px 26px 0' } }, h('div.banner.warn', icon('alert'), h('div.grow', h('b', 'Seller account not approved yet. '), text), h('a.btn.sm', { href: seller.status === 'under_review' ? '/seller/account-status' : '/seller/onboarding' }, seller.status === 'under_review' ? 'View status' : 'Continue onboarding'))));
    }
  }
  async function refreshUnread() { try { const me2 = await refreshMe(); if (me2) setUnread(me2.unread_notifications || 0); } catch { /* shown on next navigation */ } }
  return { root: app, content, setActive, setUnread, refreshUnread, searchInput };
}
const NOTIF_ICON = { order: 'cart', inventory: 'layers', payment: 'wallet', return: 'undo', support: 'lifebuoy', listing: 'box', shipping: 'truck', account: 'shield', security: 'lock' };
export { NOTIF_ICON };

export async function signOut() {
  try { await api('/auth/logout', { method: 'POST', body: {} }); } catch (err) { toast(err.message, 'error'); return; }
  state.me = null; state.shell = null;
  navigate('/seller/login', { replace: true });
  toast('You have been signed out.', 'success');
}

/* Layout used by sign-in, registration and password pages. */
export function authLayout(cardNode, { wide = false } = {}) {
  return h('div.auth',
    h('aside.auth-side',
      h('a.brand-chip', { href: '/' }, h('img', { src: '/public/assets/nearbuy-logo.png', alt: 'NearBuy' }), h('span', 'Seller Hub')),
      h('div', h('h1', 'Run your whole store from one place.'), h('p', { style: { marginTop: '14px' } }, 'List products, manage stock, process orders and returns, and keep track of every rupee you are owed.'),
        h('ul', [['box', 'Catalogue, inventory and bulk uploads'], ['cart', 'A guided order workflow with invoices and labels'], ['wallet', 'Itemised settlements and downloadable statements'], ['chart', 'Sales, returns and inventory analytics']].map(([ico, text]) => h('li', icon(ico), h('span', text))))),
      h('p.small', { style: { color: '#9fb0d0' } }, '© NearBuy. Sample records in this build are marked DEMO DATA.')),
    h('div.auth-main', h('div', { style: { width: '100%', maxWidth: wide ? '560px' : '470px' } },
      h('a.brand-chip.auth-mobile-brand', { href: '/' }, h('img', { src: '/public/assets/nearbuy-logo.png', alt: 'NearBuy' }), h('span', 'Seller Hub')),
      h(`div.auth-card${wide ? '.wide' : ''}`, cardNode))));
}
