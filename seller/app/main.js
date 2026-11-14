// NearBuy Seller Hub — route table, access guards and page rendering.
import { h, state, api, can, refreshMe, setRenderer, initLinks, matchRoute, navigate, currentQuery, loadingBlock, errorState, emptyState, reload } from './core.js';
import { buildShell, authLayout } from './shell.js';
import * as auth from './pages-auth.js';
import * as catalog from './pages-catalog.js';
import * as orders from './pages-orders.js';
import * as business from './pages-business.js';
import * as account from './pages-account.js';
import * as dlv from './pages-deliveries.js';

const root = document.getElementById('app');
// access: 'guest' = signed-out only, 'open' = anyone, 'pending' = signed in (email may be unverified), default = signed in and verified.
const R = (path, page, title, extra = {}) => ({ path, page, title, ...extra });
state.routes = [
  R('/seller/login', auth.login, 'Sign in', { access: 'guest', layout: 'auth' }),
  R('/seller/register', auth.register, 'Create seller account', { access: 'guest', layout: 'auth', wide: true }),
  R('/seller/forgot-password', auth.forgotPassword, 'Forgot password', { access: 'open', layout: 'auth' }),
  R('/seller/reset-password', auth.resetPassword, 'Set a new password', { access: 'open', layout: 'auth' }),
  R('/seller/verify-email', auth.verifyEmail, 'Verify email', { access: 'open', layout: 'auth' }),
  R('/seller/account-status', auth.accountStatus, 'Account status'),
  R('/seller/onboarding', auth.onboarding, 'Seller onboarding'),

  R('/seller/dashboard', catalog.dashboard, 'Dashboard'),
  R('/seller/search', catalog.searchResults, 'Search'),
  R('/seller/notifications', account.notifications, 'Notifications'),
  R('/seller/products', catalog.products, 'Products'),
  R('/seller/products/new', catalog.productForm, 'Add product'),
  R('/seller/products/bulk-upload', catalog.bulkUpload, 'Bulk upload'),
  R('/seller/products/:code', catalog.productView, 'Product'),
  R('/seller/products/:code/edit', catalog.productForm, 'Edit product'),
  R('/seller/inventory', catalog.inventory, 'Inventory'),
  R('/seller/inventory/bulk-update', catalog.inventoryBulk, 'Bulk stock update'),
  R('/seller/inventory/history', catalog.inventoryHistory, 'Stock history'),
  R('/seller/inventory/warehouses', catalog.warehouses, 'Warehouses'),

  R('/seller/orders', orders.orders, 'Orders'),
  R('/seller/orders/:code', orders.orderDetail, 'Order'),
  R('/seller/deliveries', dlv.deliveries, 'Deliveries'),
  R('/seller/deliveries/tickets', dlv.deliveryTickets, 'Delivery issues'),
  R('/seller/deliveries/:code', dlv.deliveryDetail, 'Delivery'),
  R('/seller/returns', orders.returns, 'Returns'),
  R('/seller/returns/:code', orders.returnDetail, 'Return'),
  R('/seller/shipping', orders.shippingOverview, 'Shipping'),
  R('/seller/shipping/shipments', orders.shipments, 'Shipments'),
  R('/seller/shipping/shipments/:code', orders.shipmentDetail, 'Shipment'),
  R('/seller/shipping/labels', orders.shippingLabels, 'Shipping labels'),
  R('/seller/shipping/tracking', orders.shippingTracking, 'Shipment tracking'),
  R('/seller/shipping/pickup-locations', account.pickupLocations, 'Pickup locations', { section: 'shipping' }),
  R('/seller/shipping/package-settings', account.packageSettings, 'Package settings'),
  R('/seller/shipping/carriers', orders.shippingCarriers, 'Carrier integration'),

  R('/seller/payments', business.paymentsOverview, 'Payments'),
  R('/seller/payments/transactions', business.transactions, 'Transactions'),
  R('/seller/payments/settlements', business.settlements, 'Settlements'),
  R('/seller/payments/settlements/:code', business.settlementDetail, 'Settlement'),
  R('/seller/payments/upcoming', business.upcomingPayments, 'Upcoming payments'),
  R('/seller/payments/deductions', business.deductions, 'Deductions'),
  R('/seller/payments/statements', business.statements, 'Statements'),
  R('/seller/payments/bank-account', business.bankAccount, 'Bank account'),

  R('/seller/growth', business.growth, 'Growth'),
  R('/seller/growth/promotions', business.promotions, 'Promotions'),
  R('/seller/growth/promotions/new', business.promotionForm, 'Create promotion'),
  R('/seller/growth/promotions/:code', business.promotionDetail, 'Promotion'),
  R('/seller/growth/promotions/:code/edit', business.promotionForm, 'Edit promotion'),
  R('/seller/growth/:page', business.growth, 'Growth'),
  R('/seller/advertising', business.adsOverview, 'Advertising'),
  R('/seller/advertising/campaigns', business.campaigns, 'Campaigns'),
  R('/seller/advertising/campaigns/new', business.campaignForm, 'Create campaign'),
  R('/seller/advertising/campaigns/:code', business.campaignDetail, 'Campaign'),
  R('/seller/advertising/campaigns/:code/edit', business.campaignForm, 'Edit campaign'),
  R('/seller/advertising/product-ads', business.productAds, 'Product ads'),
  R('/seller/analytics', business.analytics, 'Analytics'),
  R('/seller/analytics/:report', business.analytics, 'Analytics'),

  R('/seller/support', account.supportHome, 'Seller support'),
  R('/seller/support/tickets', account.tickets, 'Support tickets'),
  R('/seller/support/tickets/new', account.ticketForm, 'Raise a ticket'),
  R('/seller/support/tickets/:code', account.ticketDetail, 'Ticket'),
  R('/seller/support/faqs', account.faqs, 'FAQs'),
  R('/seller/learning', account.learning, 'Learning centre'),
  R('/seller/learning/:module', account.learningModule, 'Learning centre'),
  R('/seller/learning/:module/:lesson', account.learningLesson, 'Learning centre'),
  R('/seller/settings', account.settings, 'Settings'),
  R('/seller/settings/:page', account.settings, 'Settings'),
];

let seq = 0;
let lastPath = null;
const PENDING_OK = ['/seller/verify-email', '/seller/account-status'];

async function render({ soft = false } = {}) {
  const token = ++seq;
  const path = location.pathname.replace(/\/+$/, '') || '/seller';
  if (path === '/seller') { navigate(state.me ? '/seller/dashboard' : '/seller/login', { replace: true }); return; }
  const found = matchRoute(path);
  const me = state.me;

  if (!found) {
    if (!me) { navigate('/seller/login', { replace: true }); return; }
    mountShell(path).replaceChildren(h('div.card', emptyState({ ico: 'search', title: 'Page not found', text: `There is no Seller Hub page at ${path}.`, action: h('a.btn.primary', { href: '/seller/dashboard' }, 'Go to dashboard') })));
    document.title = 'Page not found · NearBuy Seller Hub';
    lastPath = path;
    return;
  }
  const { route, params } = found;
  const access = route.access || 'verified';
  if (access === 'guest' && me) { navigate(safeNext(currentQuery().next) || '/seller/dashboard', { replace: true }); return; }
  if ((access === 'verified' || access === 'pending') && !me) { navigate(`/seller/login?next=${encodeURIComponent(location.pathname + location.search)}`, { replace: true }); return; }
  if (access === 'verified' && me && !me.user.email_verified && !PENDING_OK.includes(path)) { navigate('/seller/verify-email', { replace: true }); return; }

  const ctx = { params, query: currentQuery(), path, route };
  document.title = `${route.title} · NearBuy Seller Hub`;
  const useShell = route.layout !== 'auth' && me && (me.user.email_verified || !PENDING_OK.includes(path));
  let target;
  if (useShell) {
    target = mountShell(path);
    if (lastPath !== path && !soft) { target.replaceChildren(loadingBlock(8)); window.scrollTo(0, 0); }
  } else {
    state.shell = null;
    if (lastPath !== path) { root.replaceChildren(h('div.boot', h('div.spinner'))); window.scrollTo(0, 0); }
  }
  let node;
  try { node = await route.page(ctx); } catch (err) {
    if (err && err.status === 401) return; // the API layer is already redirecting to sign-in
    if (err && err.code === 'email_unverified') { navigate('/seller/verify-email', { replace: true }); return; }
    if (!(err && err.status)) console.error(err);
    node = errorState(err && err.status ? err : { message: 'Something went wrong while drawing this page. Please reload.' }, () => reload());
  }
  if (token !== seq || !node) return; // a newer navigation has taken over, or the page redirected
  const active = document.activeElement;
  const keep = active && active.dataset ? active.dataset.keep : null;
  const caret = keep && typeof active.selectionStart === 'number' ? active.selectionStart : null;
  if (useShell) target.replaceChildren(node);
  else root.replaceChildren(route.layout === 'auth' || !me ? authLayout(node, { wide: route.wide }) : authLayout(node, { wide: true }));
  if (keep) { const again = document.querySelector(`[data-keep="${keep}"]`); if (again) { again.focus(); if (caret !== null) { try { again.setSelectionRange(caret, caret); } catch { /* not a text field */ } } } }
  lastPath = path;
}
// Cross-links to sections the signed-in role cannot open are removed, so nobody is led to an "access denied" page.
// The server enforces the same permissions on every request; this only keeps the interface honest.
const LINK_PERMS = [
  ['/seller/products/new', 'products.write'], ['/seller/products/bulk-upload', 'products.write'], ['/seller/inventory/bulk-update', 'inventory.write'],
  ['/seller/products', 'products.read'], ['/seller/inventory', 'inventory.read'], ['/seller/orders', 'orders.read'], ['/seller/returns', 'returns.read'],
  ['/seller/shipping', 'shipping.read'], ['/seller/payments', 'payments.read'], ['/seller/growth', 'growth.read'], ['/seller/advertising', 'ads.read'],
  ['/seller/analytics', 'analytics.read'], ['/seller/settings/team', 'team.manage'], ['/seller/settings/activity', 'activity.read'],
];
function linkAllowed(href) {
  const path = href.split(/[?#]/)[0].replace(/\/+$/, '');
  if (/\/edit$/.test(path) && path.startsWith('/seller/products/') && !can('products.write')) return false;
  const rule = LINK_PERMS.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
  return !rule || can(rule[1]);
}
function pruneLinks(scope) {
  if (!state.me || !scope.querySelectorAll) return;
  const links = scope.matches && scope.matches('a[href^="/seller/"]') ? [scope] : [...scope.querySelectorAll('a[href^="/seller/"]')];
  for (const a of links) {
    if (linkAllowed(a.getAttribute('href'))) continue;
    if (a.classList.contains('btn') || a.closest('.quick')) { a.remove(); continue; }
    const span = document.createElement('span');
    span.className = a.className;
    span.append(...a.childNodes);
    a.replaceWith(span);
  }
}
new MutationObserver((records) => { for (const rec of records) for (const node of rec.addedNodes) if (node.nodeType === 1) pruneLinks(node); }).observe(root, { childList: true, subtree: true });

function safeNext(next) { return next && next.startsWith('/seller/') && !next.startsWith('//') ? next : null; }
function mountShell(path) {
  if (!state.shell || !root.contains(state.shell.root)) { state.shell = buildShell(); root.replaceChildren(state.shell.root); lastPath = null; }
  state.shell.setActive(path);
  return state.shell.content;
}

async function boot() {
  setRenderer(render);
  initLinks();
  try { await refreshMe(); } catch (err) {
    root.replaceChildren(h('div.boot', h('div.card', { style: { maxWidth: '460px' } }, emptyState({ ico: 'alert', title: 'The Seller Hub server is not responding', text: err.message, action: h('button.btn.primary', { onClick: () => location.reload() }, 'Reload') }))));
    return;
  }
  await render();
}
window.addEventListener('unhandledrejection', (event) => { if (event.reason && event.reason.status === 401) event.preventDefault(); });
boot();
export { api };
