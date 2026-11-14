const SELLER_USERS = [
  { id: 'owner', name: 'Riya Sharma', email: 'owner@nearbuy.demo', password: 'Seller123!', role: 'Shop owner', initials: 'RS', permissions: ['all'] },
  { id: 'manager', name: 'Aarav Mehta', email: 'manager@nearbuy.demo', password: 'Seller123!', role: 'Shop manager', initials: 'AM', permissions: ['dashboard', 'orders', 'products', 'inventory', 'delivery', 'returns', 'shop', 'support', 'notifications'] },
  { id: 'stock', name: 'Sana Khan', email: 'inventory@nearbuy.demo', password: 'Seller123!', role: 'Inventory manager', initials: 'SK', permissions: ['dashboard', 'products', 'inventory', 'shop', 'support', 'notifications'] }
];
const SEED_PRODUCTS = [
  { id: 'NB-1001', sku: 'GB-MILK-01', name: 'Farm fresh whole milk', category: 'Grocery', price: 34, mrp: 38, stock: 18, lowAt: 8, sold: 42, emoji: '🥛', status: 'Active' },
  { id: 'NB-1002', sku: 'GB-BANA-06', name: 'Sunrise bananas · 6 pcs', category: 'Fresh produce', price: 42, mrp: 48, stock: 5, lowAt: 8, sold: 37, emoji: '🍌', status: 'Active' },
  { id: 'NB-1003', sku: 'GB-BREAD-04', name: 'Sourdough country loaf', category: 'Bakery', price: 95, mrp: 110, stock: 8, lowAt: 5, sold: 28, emoji: '🍞', status: 'Active' },
  { id: 'NB-1004', sku: 'GB-EGGS-06', name: 'Free range eggs · 6 pack', category: 'Dairy & eggs', price: 72, mrp: 78, stock: 12, lowAt: 5, sold: 24, emoji: '🥚', status: 'Active' },
  { id: 'NB-1005', sku: 'GB-APPLE-04', name: 'Seasonal red apples · 4 pcs', category: 'Fresh produce', price: 119, mrp: 140, stock: 3, lowAt: 6, sold: 18, emoji: '🍎', status: 'Active' },
  { id: 'NB-1006', sku: 'GB-OATS-05', name: 'Rolled oats · 500 g', category: 'Grocery', price: 145, mrp: 165, stock: 0, lowAt: 4, sold: 16, emoji: '🥣', status: 'Out of stock' },
  { id: 'NB-1007', sku: 'GB-SPIN-01', name: 'Baby spinach · 1 bunch', category: 'Fresh produce', price: 28, mrp: 32, stock: 16, lowAt: 5, sold: 13, emoji: '🥬', status: 'Active' },
  { id: 'NB-1008', sku: 'GB-HONEY-25', name: 'Wildflower honey · 250 g', category: 'Pantry', price: 189, mrp: 220, stock: 9, lowAt: 4, sold: 12, emoji: '🍯', status: 'Active' }
];
const SEED_ORDERS = [
  { id: 'NB-20486', customer: 'Kavya S.', area: 'Hauz Khas', placed: 'Today, 10:42 am', status: 'New', method: 'Runner delivery', total: 286, items: [{ name: 'Farm fresh whole milk', qty: 2, price: 34 }, { name: 'Sunrise bananas · 6 pcs', qty: 1, price: 42 }, { name: 'Sourdough country loaf', qty: 1, price: 95 }, { name: 'Free range eggs · 6 pack', qty: 1, price: 72 }] },
  { id: 'NB-20485', customer: 'Dev M.', area: 'Hauz Khas', placed: 'Today, 10:18 am', status: 'New', method: 'Store pickup', total: 186, items: [{ name: 'Seasonal red apples · 4 pcs', qty: 1, price: 119 }, { name: 'Baby spinach · 1 bunch', qty: 2, price: 28 }] },
  { id: 'NB-20482', customer: 'Ananya R.', area: 'Green Park', placed: 'Today, 9:55 am', status: 'Preparing', method: 'Runner delivery', total: 217, items: [{ name: 'Rolled oats · 500 g', qty: 1, price: 145 }, { name: 'Farm fresh whole milk', qty: 1, price: 34 }, { name: 'Wildflower honey · 250 g', qty: 1, price: 189 }] },
  { id: 'NB-20479', customer: 'Rahul P.', area: 'Hauz Khas', placed: 'Today, 9:20 am', status: 'Preparing', method: 'Runner delivery', total: 161, items: [{ name: 'Farm fresh whole milk', qty: 1, price: 34 }, { name: 'Seasonal red apples · 4 pcs', qty: 1, price: 119 }] },
  { id: 'NB-20470', customer: 'Mira T.', area: 'Saket', placed: 'Yesterday, 7:46 pm', status: 'Completed', method: 'Store pickup', total: 214, items: [{ name: 'Sourdough country loaf', qty: 1, price: 95 }, { name: 'Free range eggs · 6 pack', qty: 1, price: 72 }, { name: 'Baby spinach · 1 bunch', qty: 1, price: 28 }] }
];
const DEFAULT_PROMOS = [{ id: 'LP-102', title: 'Neighbourhood welcome', code: 'HELLO10', type: '10% off', status: 'Active', uses: 12, ends: '30 Jun 2025' }, { id: 'LP-098', title: 'Fresh Friday', code: 'FRESH15', type: '₹15 off ₹199', status: 'Scheduled', uses: 0, ends: '20 Jun 2025' }];
const DEFAULT_RETURNS = [{ id: 'RT-0084', order: 'NB-20452', customer: 'Nisha D.', product: 'Farm fresh whole milk', reason: 'Product arrived damaged', status: 'Needs review', amount: 34, date: 'Today, 9:12 am' }, { id: 'RT-0081', order: 'NB-20387', customer: 'Arjun K.', product: 'Seasonal red apples · 4 pcs', reason: 'Quality concern', status: 'Approved', amount: 119, date: 'Yesterday' }];
const sellerStorage = {
  get(key, fallback) { try { const value = localStorage.getItem(`nearbuy-seller:${key}`); return value ? JSON.parse(value) : fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(`nearbuy-seller:${key}`, JSON.stringify(value)); return true; } catch { return false; } }
};
let sellerUser = sellerStorage.get('session', null);
let view = 'dashboard';
let orderFilter = 'All orders';
let productQuery = '';
let toastTimer;
const loginRoot = document.getElementById('sellerLogin');
const sellerApp = document.getElementById('sellerApp');
const sellerMain = document.getElementById('sellerMain');
const sellerModal = document.getElementById('sellerModal');
function sellerMoney(amount) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount); }
function safe(value = '') { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
function sellerData(key, fallback) { return sellerStorage.get(`greenbasket:${key}`, fallback); }
function saveSellerData(key, value) { sellerStorage.set(`greenbasket:${key}`, value); }
function sellerProducts() { return sellerData('products', SEED_PRODUCTS).map(product => ({ listingStatus: 'Active', ...product })); }
function sellerOrders() {
  const orders = sellerData('orders', SEED_ORDERS);
  let deliveryTasks = []; try { deliveryTasks = JSON.parse(localStorage.getItem('nearbuy-delivery:tasks') || '[]'); } catch {}
  const stateMap = { Requested: 'Runner requested', Assigned: 'Runner assigned', 'At shop': 'Runner at shop', 'Picked up': 'Picked up', 'En route': 'Out for delivery', Delivered: 'Completed', Returned: 'Returned', Cancelled: 'Cancelled' };
  const ownDeliveries=sellerOwnDeliveries();
  return orders.map(order => { const task = deliveryTasks.find(item => item.id === order.id); if(task&&stateMap[task.status]) return { ...order, status: stateMap[task.status], deliveryTask: task }; const own=ownDeliveries.find(item=>item.id===order.id); return own ? { ...order, status: own.status==='Completed'?'Completed':'Own delivery', ownDelivery:own } : order; });
}
function sellerPromos() { return sellerData('promotions', DEFAULT_PROMOS); }
function sellerReturns() { return sellerData('returns', DEFAULT_RETURNS); }
function sellerOwnDeliveries() { return sellerData('ownDeliveries', []); }
function sellerSettings() { return sellerData('settings', { open: true, delivery: true, pickup: true, autoAccept: false, radius: '2 km', prep: '15–25 min' }); }
function toast(message) { const node = document.getElementById('sellerToast'); node.textContent = message; node.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove('show'), 2600); }
function canAccess(page) { return sellerUser?.permissions?.includes('all') || sellerUser?.permissions?.includes(page); }
function goView(next) { view = next; renderSeller(); document.getElementById('sellerSidebar').classList.remove('open'); }
function pageTitle(kicker, title, desc, actions = '') { return `<div class="seller-page-heading"><div><span class="eyebrow">${kicker}</span><h1>${title}</h1><p>${desc}</p></div><div class="seller-heading-actions">${actions}</div></div>`; }
function panelTitle(title, sub = '', action = '') { return `<div class="panel-head"><div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div>${action}</div>`; }
function productStatus(product) { return product.stock <= 0 ? 'Out of stock' : product.stock <= product.lowAt ? 'Low stock' : product.status || 'Active'; }
function pill(status) { const type = status === 'Active' || status === 'Completed' || status === 'Ready for pickup' ? '' : ['New', 'Runner requested', 'Scheduled', 'Low stock'].includes(status) ? 'warning' : ['Preparing', 'Runner assigned'].includes(status) ? 'blue' : ['Out of stock', 'Rejected', 'Cancelled'].includes(status) ? 'red' : 'neutral'; return `<span class="status-pill ${type}">${safe(status)}</span>`; }
function showLogin() {
  const demos = SELLER_USERS.map(user => `<button class="seller-demo-user" data-seller-demo="${user.id}"><span>${user.initials}</span><div><b>${user.name} · ${user.role}</b><small>${user.email}</small></div><strong>Use ↗</strong></button>`).join('');
  loginRoot.innerHTML = `<div class="seller-modal-backdrop"><section class="seller-modal seller-demo-login"><div class="login-promo"><span class="seller-logo-crop"><img src="/public/assets/nearbuy-logo.png" alt="NearBuy"/></span><span class="eyebrow">YOUR NEIGHBOURHOOD, YOUR BUSINESS</span><h1>Run your shop.<br/><em>Grow it locally.</em></h1><p>Products, stock, orders and earnings — all the little business details, in one place.</p><div class="login-orbit"></div></div><div class="login-form-side"><span class="eyebrow">NEARBUY SELLER HUB</span><h2>Welcome back.</h2><p>Sign in with a demo shop account to explore Seller Hub.</p><form id="sellerLoginForm" class="modal-form"><label>Email address<input type="email" name="email" required placeholder="you@yourshop.in"/></label><label>Password<input type="password" name="password" required placeholder="Your password"/></label><button class="seller-btn primary">Sign in to Seller Hub ↗</button><div class="login-error" id="sellerLoginError"></div></form><div class="seller-demo-users">${demos}</div><div class="seller-pass-note">All seller demos use password <b>Seller123!</b> · Sample data only</div></div></section></div>`;
}
function updateSellerShell() {
  const settings = sellerSettings();
  document.getElementById('topShopStatus').textContent = settings.open ? 'Open' : 'Closed';
  document.querySelector('.top-shop-status i').style.background = settings.open ? '#5cb274' : '#c47a69';
  document.getElementById('sellerName').textContent = sellerUser.name;
  document.getElementById('sellerRole').textContent = sellerUser.role;
  document.getElementById('sellerInitials').textContent = sellerUser.initials;
  const pending = sellerOrders().filter(order => order.status === 'New').length;
  document.getElementById('newOrderCount').textContent = pending;
  const listingAttention = document.getElementById('listingAttention');
  if (listingAttention) { const attention = sellerProducts().filter(product => ['Draft', 'Incomplete', 'Changes required', 'Rejected'].includes(listingState(product))).length; listingAttention.textContent = attention; listingAttention.hidden = !attention; }
  document.getElementById('sellerNotificationCount').textContent = Math.min(9, sellerData('notifications', [{ unread: true }, { unread: true }, { unread: true }]).filter(n => n.unread).length);
  document.querySelectorAll('[data-view]').forEach(button => {
    const page = button.dataset.view;
    button.classList.toggle('active', page === view);
    button.hidden = !canAccess(page);
  });
  const labels = { dashboard: 'Overview', orders: 'Orders', products: 'Products & catalogue', inventory: 'Inventory & stock', delivery: 'Delivery & pickup', returns: 'Returns & issues', payments: 'Payments & earnings', promotions: 'Promotions', analytics: 'Business insights', shop: 'My shop', support: 'Support & Academy', team: 'Team & access', security: 'Account & security', notifications: 'Notifications' };
  document.getElementById('currentPageName').textContent = labels[view] || 'Overview';
}
function dashboardPage() {
  const products = sellerProducts(); const orders = sellerOrders(); const settings = sellerSettings();
  const newOrders = orders.filter(order => order.status === 'New'); const low = products.filter(p => listingState(p) === 'Active' && p.stock <= p.lowAt).slice(0, 4);
  const bars = [38, 56, 49, 72, 61, 85, 67];
  return `${pageTitle('SAMPLE DASHBOARD · SOUTH DELHI', `Good morning, ${safe(sellerUser.name.split(' ')[0])}.`, 'Illustrative sample activity at Green Basket Market. These are not live shop figures.', '<button class="seller-btn" data-action="export-report">↓ Export report</button><button class="seller-btn primary" data-view="products" data-action="add-product">＋ Add product</button>')}<div class="seller-stats"><article class="stat-card"><div>Sales today <span class="stat-icon">₹</span></div><strong>₹8,460</strong><small><span class="positive">↑ 12.8%</span> vs. last Tuesday</small></article><article class="stat-card"><div>Orders today <span class="stat-icon">▤</span></div><strong>${orders.filter(o => o.placed.startsWith('Today')).length + 18}</strong><small><span class="positive">↑ 4 orders</span> vs. last Tuesday</small></article><article class="stat-card"><div>Need your attention <span class="stat-icon">◷</span></div><strong>${newOrders.length}</strong><small>New orders waiting for a response</small></article><article class="stat-card"><div>Net earnings <span class="stat-icon">↗</span></div><strong>₹7,184</strong><small>Next settlement · 18 Jun</small></article></div><div class="seller-grid-two"><section class="panel">${panelTitle('Sales at a glance', 'Your shop’s sales over the last 7 days', '<button data-view="analytics">View insights ↗</button>')}<div class="chart-wrap"><div class="chart-topline"><strong>₹42,680</strong><small>↑ 8.2%</small></div><div class="chart-caption"><span>vs. previous week</span><span>Last 7 days</span></div><div class="bar-chart">${bars.map((height, i) => `<div class="bar-column ${i === 5 ? 'today' : ''}"><i style="--bar:${height}%"></i><small>${['Wed','Thu','Fri','Sat','Sun','Mon','Tue'][i]}</small></div>`).join('')}</div><div class="chart-caption"><span>Shop sales · illustrative demo data</span><span class="seller-chart-legend"><i></i> Sales</span></div></div></section><section class="panel">${panelTitle('A little activity', 'Latest updates from your shop')}<div class="activity-list"><div class="activity-item"><span class="activity-icon">▤</span><div><b>3 new orders are ready for you</b><small>Just now · South Delhi neighbours</small></div><span>New</span></div><div class="activity-item"><span class="activity-icon">↗</span><div><b>Runner requested for NB-20479</b><small>3 minutes ago · Hauz Khas</small></div><span>On it</span></div><div class="activity-item"><span class="activity-icon">♡</span><div><b>A new 5-star shop review</b><small>Today · A happy local customer</small></div><span>New</span></div><div class="activity-item"><span class="activity-icon">₹</span><div><b>Settlement is on its way</b><small>Today · Expected 18 Jun</small></div><span>Paid</span></div></div></section></div><section class="panel" style="margin-bottom:14px">${panelTitle('Quick actions', 'The things you do most often')}<div class="quick-actions"><button class="quick-action" data-action="add-product"><span>＋</span>Add a listing</button><button class="quick-action" data-view="orders"><span>▤</span>See new orders</button><button class="quick-action" data-view="inventory"><span>▥</span>Update stock</button><button class="quick-action" data-view="shop"><span>⌂</span>Shop settings</button></div></section><div class="seller-grid-two"><section class="panel">${panelTitle('Orders that need you', `${newOrders.length} new orders · respond soon`, '<button data-view="orders">All orders ↗</button>')}${newOrders.length ? newOrders.slice(0, 3).map(orderSummary).join('') : '<div class="seller-empty">You’re all caught up.</div>'}</section><section class="panel">${panelTitle('A few things are running low', 'Keep your local favourites on the shelf', '<button data-view="inventory">Manage stock ↗</button>')}<div class="table-overflow"><table class="dashboard-table"><thead><tr><th>PRODUCT</th><th>LEFT</th><th>STATUS</th></tr></thead><tbody>${low.map(p => `<tr><td><div class="prod-cell"><span class="prod-thumb">${p.emoji}</span><span><b>${safe(p.name)}</b><small>${p.sku}</small></span></div></td><td class="stock-low">${p.stock}</td><td>${pill(productStatus(p))}</td></tr>`).join('')}</tbody></table></div></section></div>`;
}
function orderSummary(order) { return `<article class="seller-order"><div class="seller-order-id"><b>${safe(order.id)} · ${safe(order.customer)}</b><small>${safe(order.placed)} · ${safe(order.area)}</small></div><div class="seller-order-items">${order.items.slice(0, 2).map(i => `${i.qty} × ${safe(i.name)}`).join(' · ')}${order.items.length > 2 ? ` <small>+ ${order.items.length - 2} more</small>` : ''}</div><div class="seller-order-total">${sellerMoney(order.total)}</div><div class="seller-order-actions"><button data-action="accept-order" data-id="${order.id}">Accept order</button><button data-action="view-order" data-id="${order.id}">Details</button></div></article>`; }
function orderPage() {
  const orders = sellerOrders(); const filters = ['All orders', 'New', 'Preparing', 'Runner requested', 'Ready for pickup', 'Completed'];
  const filtered = orderFilter === 'All orders' ? orders : orders.filter(o => o.status === orderFilter);
  return `${pageTitle('YOUR SHOP, YOUR ORDERS', 'Orders', 'A clear view of every order from your neighbours.', '<button class="seller-btn" data-action="export-orders">↓ Export orders</button>')}<section class="panel">${panelTitle('Order queue', 'Confirm new orders and keep each one moving')}<div class="filter-tabs">${filters.map(f => `<button class="${orderFilter === f ? 'active' : ''}" data-action="order-filter" data-filter="${f}">${f}${f === 'New' ? ` <i>${orders.filter(o => o.status === 'New').length}</i>` : ''}</button>`).join('')}<label class="search-small"><span>⌕</span><input id="orderSearch" placeholder="Order ID or customer"/></label></div><div id="orderList" class="orders-list">${filtered.length ? filtered.map(orderSummary).join('') : '<div class="seller-empty"><b>No orders in this queue</b>New activity will show up here.</div>'}</div></section>`;
}
function productRow(p) {
  const state = listingState(p);
  return `<tr><td><div class="prod-cell">${listingThumb(p)}<span><b>${safe(p.name)}</b><small>${safe(p.sku)} · ${safe(p.category)}${p.brand ? ` · ${safe(p.brand)}` : ''}</small></span></div></td><td>${listingPill(state)}${p.reviewNote ? `<small class="row-note">${safe(p.reviewNote)}</small>` : ''}</td><td>${sellerMoney(p.price)}${Number(p.mrp) > Number(p.price) ? `<small class="row-note"><s>${sellerMoney(p.mrp)}</s></small>` : ''}</td><td><b class="${p.stock <= p.lowAt ? 'stock-low' : 'stock-ok'}">${p.stock}</b><small class="row-note">${safe(stockLabel(p))}</small></td><td>${p.sold || 0}</td><td><div class="product-row-actions"><button class="small-icon-btn" data-action="edit-listing" data-id="${p.id}">Edit</button><button class="small-icon-btn" data-action="listing-menu" data-id="${p.id}" aria-label="More listing actions">⋯</button></div></td></tr>`;
}
function productPage() {
  const all = sellerProducts();
  const active = all.filter(p => listingState(p) === 'Active');
  const drafts = all.filter(p => ['Draft', 'Incomplete'].includes(listingState(p)));
  const review = all.filter(p => listingState(p) === 'Under review');
  const needsChanges = all.filter(p => ['Changes required', 'Rejected'].includes(listingState(p)));
  const query = productQuery.toLowerCase();
  const visible = all.filter(p => !query || `${p.name} ${p.sku} ${p.brand || ''} ${p.category}`.toLowerCase().includes(query));
  const quality = catalogueQuality(all);
  const categories = [...new Set(all.map(p => p.category))];
  return `${pageTitle('YOUR ONLINE SHELF', 'Products & catalogue', `${all.length} listings · ${active.length} live · ${drafts.length + needsChanges.length} need your attention.`, '<button class="seller-btn" data-action="export-products">↓ Export catalogue</button><button class="seller-btn" data-action="bulk-import">⇧ Bulk import</button><button class="seller-btn primary" data-action="add-product">＋ Add listing</button>')}<div class="seller-stats"><article class="stat-card"><div>Live listings<span class="stat-icon">▧</span></div><strong>${active.length}</strong><small>Visible to nearby customers</small></article><article class="stat-card"><div>Drafts & incomplete<span class="stat-icon">✎</span></div><strong>${drafts.length}</strong><small>Finish these before submitting</small></article><article class="stat-card"><div>Under review<span class="stat-icon">◷</span></div><strong>${review.length}</strong><small>Waiting for a sample check</small></article><article class="stat-card"><div>Needs changes<span class="stat-icon">!</span></div><strong>${needsChanges.length}</strong><small>Fix the note and resubmit</small></article></div><section class="panel" style="margin-bottom:13px">${panelTitle('Add a listing', 'Choose the fastest way to get a product on your shelf')}${listingMethodCards()}<div class="listing-extra-rows"><div class="mini-block"><b>Copy an existing listing</b><small>Duplicate a product and change only what is different.</small><div class="mini-inline"><select id="copyListing">${all.map(p => `<option value="${p.id}">${safe(p.name)}</option>`).join('') || '<option value="">No listings yet</option>'}</select><button class="small-icon-btn" data-action="listing-copy-start">Copy ↗</button></div></div><div class="mini-block"><b>Barcode or SKU lookup</b><small>Demo lookup checks your local catalogue only.</small><div class="mini-inline"><input id="barcodeLookup" placeholder="e.g. GB-MILK-01"/><button class="small-icon-btn" data-action="listing-barcode-start">Look up ↗</button></div></div></div></section><section class="panel">${panelTitle('Your listings', 'Listing state and stock are separate — a live listing can still run out of stock.')}<div class="listing-toolbar"><div><label class="search-small"><span>⌕</span><input id="productSearch" value="${safe(productQuery)}" placeholder="Search products, brand or SKU"/></label><select id="productCategory"><option value="all">All categories</option>${categories.map(category => `<option>${safe(category)}</option>`).join('')}</select><select id="listingState"><option value="all">All listing states</option>${LISTING_STATES.map(state => `<option>${state}</option>`).join('')}</select><select id="productState"><option value="all">All stock states</option><option>Active</option><option>Low stock</option><option>Out of stock</option></select></div><span class="eyebrow" id="listingCount">${visible.length} LISTINGS</span></div><div class="table-overflow"><table class="data-table"><thead><tr><th>LISTING</th><th>LISTING STATUS</th><th>PRICE</th><th>STOCK</th><th>SOLD</th><th>ACTIONS</th></tr></thead><tbody id="productRows">${visible.map(productRow).join('') || '<tr><td colspan="6"><div class="seller-empty">No products found.</div></td></tr>'}</tbody></table></div></section><div class="two-panel" style="margin-top:13px"><section class="panel">${panelTitle('Catalogue quality', 'Small fixes that help neighbours choose')}<div class="quality-list">${quality.map(issue => `<div class="quality-row"><i>!</i><div><b>${issue.items.length} · ${issue.label}</b><small>${issue.detail}</small></div><button data-action="listing-fix" data-id="${issue.items[0].id}" data-step="${issue.step}">Fix ↗</button></div>`).join('') || '<div class="seller-empty">Every listing has the basics covered. Nice work.</div>'}</div></section><section class="panel">${panelTitle('Review queue', 'Sample NearBuy catalogue checks')}<div class="review-queue">${review.length ? review.map(p => `<div class="review-card"><div>${listingThumb(p)}<div><b>${safe(p.name)}</b><small>${safe(p.sku)} · ${safe(p.updatedAt || 'just now')}</small></div>${listingPill('Under review')}</div><div class="confirm-row"><button class="seller-btn" data-action="listing-request-changes" data-id="${p.id}">Ask for changes</button><button class="seller-btn primary" data-action="listing-approve" data-id="${p.id}">Approve (demo) ↗</button></div></div>`).join('') : '<div class="seller-empty"><b>Nothing waiting for review</b>Submitted listings appear here for a sample check.</div>'}</div></section></div>`;
}
function inventoryPage() {
  const products = sellerProducts().filter(p => listingState(p) !== 'Archived'); const low = products.filter(p => p.stock <= p.lowAt).length;
  return `${pageTitle('KEEP YOUR DIGITAL SHELF TRUE', 'Inventory & stock', `${low} products need a stock check. Stock changes apply instantly to this demo catalogue.`, '<button class="seller-btn" data-action="stock-audit">▤ Stock audit</button><button class="seller-btn primary" data-action="bulk-stock">⇧ Bulk update</button>')}<div class="seller-stats"><article class="stat-card"><div>Active products<span class="stat-icon">▧</span></div><strong>${products.filter(p => p.stock > 0).length}</strong><small>Available to local shoppers</small></article><article class="stat-card"><div>Low stock<span class="stat-icon">!</span></div><strong>${low}</strong><small>Below your restock reminder</small></article><article class="stat-card"><div>Out of stock<span class="stat-icon">×</span></div><strong>${products.filter(p => p.stock <= 0).length}</strong><small>Hidden from new orders</small></article><article class="stat-card"><div>Stock movements<span class="stat-icon">↕</span></div><strong>${sellerData('movements', []).length + 24}</strong><small>Demo history this month</small></article></div><section class="panel">${panelTitle('Stock by product', 'Use + / − to make a quick count adjustment')}<div class="listing-toolbar"><label class="search-small"><span>⌕</span><input id="inventorySearch" placeholder="Find a product"/></label><span class="eyebrow">LIVE DEMO STOCK</span></div><div class="table-overflow"><table class="data-table"><thead><tr><th>PRODUCT</th><th>SELLING PRICE</th><th>AVAILABLE</th><th>RESTOCK AT</th><th>STATUS</th><th>QUICK ADJUST</th></tr></thead><tbody id="inventoryRows">${products.map(p => `<tr><td><div class="prod-cell"><span class="prod-thumb">${p.emoji}</span><span><b>${safe(p.name)}</b><small>${safe(p.sku)}</small></span></div></td><td>${sellerMoney(p.price)}</td><td><b class="${p.stock <= p.lowAt ? 'stock-low' : 'stock-ok'}">${p.stock}</b></td><td>${p.lowAt} units</td><td>${pill(productStatus(p))}</td><td><div class="stock-control"><button data-action="adjust-stock" data-id="${p.id}" data-delta="-1" aria-label="Decrease stock">−</button><b>${p.stock}</b><button data-action="adjust-stock" data-id="${p.id}" data-delta="1" aria-label="Increase stock">+</button><button class="inline-link" data-action="set-stock" data-id="${p.id}">Set</button></div></td></tr>`).join('')}</tbody></table></div></section>`;
}
function sellerDeliveryTasks() { try { return JSON.parse(localStorage.getItem('nearbuy-delivery:tasks') || '[]'); } catch { return []; } }
function sellerRequestCandidates() { const sent = new Set(sellerDeliveryTasks().map(t => t.id)); return sellerOrders().filter(o => o.method === 'Runner delivery' && ['Preparing','Ready for Runner'].includes(o.status) && !sent.has(o.id)); }
function createSellerRunnerRequest(orderId, note='') {
  const order=sellerOrders().find(o=>o.id===orderId); if(!order||order.method!=='Runner delivery') return toast('Choose a prepared Runner delivery order.');
  const list=sellerDeliveryTasks(); if(list.some(t=>t.id===orderId)) return toast('A Runner task already exists for this order.');
  const distance=order.area==='Saket'?2.2:order.area==='Green Park'?1.3:.4; let bands=[{max:.3,pay:10},{max:.5,pay:12},{max:1,pay:15},{max:2,pay:20},{max:3,pay:25}];try{bands=JSON.parse(localStorage.getItem('nearbuy-delivery:pricing')||'null')||bands}catch{} const payout=bands.find(b=>distance<=Number(b.max))?.pay||25;
  const task={id:order.id,shop:'Green Basket Market',shopArea:'Hauz Khas Market',customer:order.customer,area:order.area,pickupDistance:.2,distance,payout,category:'Grocery',weight:Math.max(.5,Number((order.items.reduce((sum,item)=>sum+item.qty,0)*.45).toFixed(1))),items:order.items.reduce((sum,item)=>sum+item.qty,0),instructions:note||'Please handle the parcel with care. Contact details are masked in this demo.',status:'Requested',pickupPin:String(1000+Math.floor(Math.random()*8999)),deliveryPin:String(1000+Math.floor(Math.random()*8999)),createdAt:'Just now',partnerId:null,shopDemoId:'greenbasket'};
  list.unshift(task); try { localStorage.setItem('nearbuy-delivery:tasks',JSON.stringify(list)); } catch {} closeSellerModal(); renderSeller(); toast('Demo delivery request added to NearBuy Runner. No partner was notified.');
}
function createSellerOwnDelivery(orderId,note='') {
  const order=sellerOrders().find(o=>o.id===orderId); if(!order||order.method!=='Runner delivery') return toast('Choose a ready delivery order.');
  const deliveries=sellerOwnDeliveries(); if(deliveries.some(d=>d.id===orderId)) return toast('A delivery plan already exists for this order.');
  deliveries.unshift({id:orderId,status:'Assigned',method:'Own shop staff',note,assignedTo:'Shop delivery staff · sample',createdAt:new Date().toLocaleString('en-IN')});saveSellerData('ownDeliveries',deliveries);closeSellerModal();renderSeller();toast('Own-staff delivery recorded in the demo. No staff member was notified.');
}
function runnerRequestModal() {
  const candidates = sellerRequestCandidates();
  if (!candidates.length) { openSellerModal(`<span class="eyebrow">NEARBUY RUNNER · DEMO</span><h2>No ready order to request.</h2><p>Accept and prepare a Runner delivery order first. Delivery requests only use orders marked as preparing and not already sent.</p><button class="seller-btn primary" data-action="modal-close">Got it</button>`); return; }
  openSellerModal(`<span class="eyebrow">DELIVERY REQUEST · SIMULATED</span><h2>Choose how this parcel travels.</h2><p>Select one of the shop’s three delivery choices. Runner requests appear in the shared partner queue; other options stay in this Seller Hub demo.</p><form id="runnerRequestForm" class="modal-form"><label>Delivery choice<select name="choice"><option value="runner">NearBuy Delivery Partner · sample match</option><option value="own">Own shop delivery staff · sample record</option></select></label><label>Prepared delivery order<select name="id">${candidates.map(o=>`<option value="${o.id}">${safe(o.id)} · ${safe(o.customer)} · ${sellerMoney(o.total)} · ${safe(o.area)}</option>`).join('')}</select></label><label>Pickup parcel note<input name="note" maxlength="100" placeholder="Bag ready at the counter"/></label><button class="seller-btn primary">Request demo delivery ↗</button></form><div class="demo-notice seller-demo-notice">No delivery partner receives a real notification. Distance, matching and payment are illustrative only.</div>`);
}
function deliveryPage() {
  const orders = sellerOrders().filter(o => ['Runner requested', 'Runner assigned', 'Runner at shop', 'Picked up', 'Out for delivery', 'Own delivery', 'Completed', 'Preparing', 'Ready for Runner', 'Ready for pickup'].includes(o.status));
  const taskStatus = sellerDeliveryTasks();
  const runnerRows = taskStatus.map(t => { const order = sellerOrders().find(o => o.id === t.id); return `<div class="delivery-row"><span>↗</span><div><b>${safe(t.id)} · ${safe(order?.customer || t.customer || 'Neighbour')}</b><small>${safe(order?.area || t.area || '')} · ${safe(t.shop)} · ${Number(t.distance||0).toFixed(1)} km · ${safe(t.status)}${t.partnerId?` · ${safe(t.partnerName || 'Partner assigned')}`:''}</small></div>${t.status === 'Requested' ? `<button data-action="assign-runner" data-id="${t.id}">View request</button>` : `<button data-action="view-order" data-id="${t.id}">Details</button>`}</div>`; }).join('');
  return `${pageTitle('EVERY ORDER, ON ITS WAY', 'Delivery & pickup', 'Request a short local delivery, then follow the shared demo status from shop to neighbour.', '<button class="seller-btn" data-action="runner-help">Runner help ↗</button><button class="seller-btn primary" data-action="request-runner">＋ Request Runner</button>')}<div class="two-panel"><section class="panel">${panelTitle('Runner deliveries', `${taskStatus.length} shared delivery task${taskStatus.length===1?'':'s'} · simulated matching`)}<div class="delivery-timeline">${runnerRows || '<div class="seller-empty"><b>No Runner requests yet.</b>Prepare a delivery order, then request a sample Runner handover.</div>'}</div></section><section class="panel">${panelTitle('Own shop delivery', 'Record work for your own local staff')}<div class="delivery-timeline">${sellerOwnDeliveries().map(d=>`<div class="delivery-row"><span>⌖</span><div><b>${safe(d.id)} · ${safe(d.assignedTo)}</b><small>${safe(d.status)} · ${safe(d.note||'No delivery note')} · Demo only</small></div>${d.status==='Assigned'?`<button data-action="complete-own-delivery" data-id="${d.id}">Mark delivered</button>`:pill('Completed')}</div>`).join('') || '<div class="seller-empty">No own-staff delivery records.</div>'}</div></section><section class="panel">${panelTitle('Store pickup', 'Keep customer collection separate from delivery')}<div class="delivery-timeline">${orders.filter(o => o.method === 'Store pickup').map(o => `<div class="delivery-row"><span>⌖</span><div><b>${safe(o.id)} · ${safe(o.customer)}</b><small>${safe(o.area)} · ${sellerMoney(o.total)} · ${safe(o.status)}</small></div><button data-action="view-order" data-id="${o.id}">Update</button></div>`).join('') || '<div class="seller-empty">No pickup orders in progress.</div>'}</div></section></div><section class="panel" style="margin-top:13px">${panelTitle('Orders ready for Runner delivery', 'Prepare the parcel before you send the request')}<div class="delivery-timeline">${sellerRequestCandidates().map(o=>`<div class="delivery-row"><span>▤</span><div><b>${safe(o.id)} · ${safe(o.customer)}</b><small>${safe(o.area)} · ${sellerMoney(o.total)} · ${o.items.reduce((n,x)=>n+x.qty,0)} items · Ready for a request</small></div><button data-action="request-runner" data-id="${o.id}">Request Runner</button></div>`).join('') || '<div class="seller-empty">No prepared Runner delivery orders are waiting.</div>'}</div></section><div class="demo-notice seller-demo-notice">Runner assignment, matching, distance, pricing, status updates and partner details are simulated across the NearBuy Runner demo. No partner is contacted and no customer address or live location is shared.</div>`;
}
function returnsPage() {
  const returns = sellerReturns();
  return `${pageTitle('A FAIR WAY TO SORT IT OUT', 'Returns & issues', 'Review customer concerns with a clear record and a reasoned response.')}<div class="seller-stats"><article class="stat-card"><div>Need review<span class="stat-icon">!</span></div><strong>${returns.filter(r => r.status === 'Needs review').length}</strong><small>Respond with care</small></article><article class="stat-card"><div>Approved this month<span class="stat-icon">✓</span></div><strong>${returns.filter(r => r.status === 'Approved').length + 4}</strong><small>Resolved requests</small></article><article class="stat-card"><div>Return value<span class="stat-icon">₹</span></div><strong>₹${returns.reduce((sum, r) => sum + r.amount, 0)}</strong><small>Illustrative demo total</small></article><article class="stat-card"><div>Average response<span class="stat-icon">◷</span></div><strong>2.4h</strong><small>Demo service indicator</small></article></div><section class="panel">${panelTitle('Return requests', 'Check order details and choose a fair next step')}<div class="table-overflow"><table class="data-table"><thead><tr><th>REQUEST</th><th>PRODUCT & REASON</th><th>CUSTOMER</th><th>VALUE</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>${returns.map(r => `<tr><td><b>${safe(r.id)}</b><small style="display:block;color:#969eaa;margin-top:4px">${safe(r.date)} · ${safe(r.order)}</small></td><td>${safe(r.product)}<small style="display:block;color:#939ba5;margin-top:4px">${safe(r.reason)}</small></td><td>${safe(r.customer)}</td><td>${sellerMoney(r.amount)}</td><td>${pill(r.status)}</td><td>${r.status === 'Needs review' ? `<button class="table-action" data-action="return-decision" data-id="${r.id}" data-decision="Approved">Approve</button> <button class="table-action danger-text" data-action="return-decision" data-id="${r.id}" data-decision="Declined">Decline</button>` : '<span class="eyebrow">RECORDED</span>'}</td></tr>`).join('')}</tbody></table></div></section>`;
}
function paymentsPage() {
  const orders = sellerOrders().filter(o => o.status === 'Completed'); const gross = orders.reduce((sum, o) => sum + o.total, 0) + 18420;
  return `${pageTitle('CLEAR NUMBERS, NO SURPRISES', 'Payments & earnings', 'Illustrative seller ledger for the demo shop. No payouts are initiated.', '<button class="seller-btn" data-action="export-payments">↓ Download statement</button>')}<div class="money-banner"><div><span>AVAILABLE IN DEMO LEDGER</span><strong>₹7,184</strong><span>Sample balance · next illustrative payout 18 Jun</span></div><button data-action="settlement-info">How settlements work ↗</button></div><div class="seller-stats"><article class="stat-card"><div>Gross sales this month<span class="stat-icon">₹</span></div><strong>${sellerMoney(gross)}</strong><small>Before fees and adjustments</small></article><article class="stat-card"><div>Completed orders<span class="stat-icon">▤</span></div><strong>${orders.length + 64}</strong><small>All sample fulfilment types</small></article><article class="stat-card"><div>Refunds & adjustments<span class="stat-icon">↩</span></div><strong>−₹618</strong><small>Itemized in demo ledger</small></article><article class="stat-card"><div>NearBuy service fee<span class="stat-icon">⌑</span></div><strong>−₹1,492</strong><small>Illustrative only, not contractual</small></article></div><section class="panel">${panelTitle('Recent settlements', 'Every amount in a sample ledger for this prototype')}<div class="table-overflow"><table class="data-table"><thead><tr><th>SETTLEMENT</th><th>PERIOD</th><th>GROSS SALES</th><th>ADJUSTMENTS</th><th>NET PAYABLE</th><th>STATUS</th></tr></thead><tbody><tr><td>ST-2025-0611</td><td>3–9 Jun</td><td>₹18,460</td><td>−₹1,204</td><td><b>₹17,256</b></td><td>${pill('Completed')}</td></tr><tr><td>ST-2025-0604</td><td>27 May–2 Jun</td><td>₹14,820</td><td>−₹968</td><td><b>₹13,852</b></td><td>${pill('Completed')}</td></tr><tr><td>ST-2025-0618</td><td>10–16 Jun</td><td>₹8,460</td><td>Pending</td><td><b>₹7,184</b></td><td>${pill('Scheduled')}</td></tr></tbody></table></div></section><p class="ledger-footnote">The actual marketplace commission, tax treatment and payout schedule must be agreed and configured before a real launch.</p>`;
}
function promotionsPage() {
  const promos = sellerPromos();
  return `${pageTitle('GIVE YOUR NEIGHBOURHOOD A REASON TO DROP BY', 'Promotions', 'Create a simple shop offer. These demo campaigns are not visible to real customers.', '<button class="seller-btn primary" data-action="create-promo">＋ Create offer</button>')}<div class="two-panel"><section class="panel">${panelTitle('Your offers', `${promos.length} campaigns`)}<div style="display:grid;gap:8px;padding:12px">${promos.map(p => `<article class="offer-card"><span>✳</span><div><b>${safe(p.title)} · ${safe(p.type)}</b><small>Code ${safe(p.code)} · ${p.uses} sample uses · Ends ${safe(p.ends)}</small></div>${pill(p.status)}<button data-action="delete-promo" data-id="${p.id}">×</button></article>`).join('') || '<div class="seller-empty">No promotions yet. Add a little local offer.</div>'}</div></section><section class="panel">${panelTitle('A few thoughtful tips', 'Keep your offer clear and manageable')}<div class="activity-list"><div class="activity-item"><span class="activity-icon">♡</span><div><b>Try a welcome offer</b><small>A small first-order discount can introduce your shop.</small></div></div><div class="activity-item"><span class="activity-icon">◷</span><div><b>Choose an end date</b><small>Set a clear time window and review results.</small></div></div><div class="activity-item"><span class="activity-icon">₹</span><div><b>Check the margin first</b><small>Only publish prices that work for your business.</small></div></div></div></section></div>`;
}
function analyticsPage() {
  const products = sellerProducts();
  return `${pageTitle('YOUR SHOP, IN GOOD PERSPECTIVE', 'Business insights', 'Illustrative sample insights to help you understand how a seller dashboard can work.', '<select class="seller-range"><option>Last 7 days</option><option>Last 30 days</option><option>This month</option></select>')}<div class="seller-stats"><article class="stat-card"><div>Local customers<span class="stat-icon">♙</span></div><strong>184</strong><small><span class="positive">↑ 9%</span> this month</small></article><article class="stat-card"><div>Average order value<span class="stat-icon">₹</span></div><strong>₹238</strong><small>Across sample orders</small></article><article class="stat-card"><div>Order completion<span class="stat-icon">✓</span></div><strong>96.4%</strong><small>Sample fulfilment score</small></article><article class="stat-card"><div>Shop rating<span class="stat-icon">★</span></div><strong>4.9</strong><small>From neighbourhood feedback</small></article></div><div class="seller-grid-two"><section class="panel">${panelTitle('Weekly order trend', 'Order activity · demo sample')}<div class="chart-wrap"><div class="bar-chart">${[41,55,49,66,70,92,73].map((h,i)=>`<div class="bar-column ${i===5?'today':''}"><i style="--bar:${h}%"></i><small>${['Wed','Thu','Fri','Sat','Sun','Mon','Tue'][i]}</small></div>`).join('')}</div></div></section><section class="panel">${panelTitle('What neighbours are buying', 'Most ordered items in this demo')}<div class="activity-list">${[...products].sort((a,b)=>b.sold-a.sold).slice(0,4).map(p=>`<div class="activity-item"><span class="prod-thumb">${p.emoji}</span><div><b>${safe(p.name)}</b><small>${p.sold} sample units · ${sellerMoney(p.price)}</small></div><span>${Math.round(p.sold/42*100)}%</span></div>`).join('')}</div></section></div><div class="demo-notice seller-demo-notice">These figures are seeded examples, not live shop performance or predictions.</div>`;
}
function shopPage() {
  const s = sellerSettings();
  return `${pageTitle('YOUR DIGITAL FRONT DOOR', 'My shop', 'Manage how Green Basket Market appears to nearby customers.', '<button class="seller-btn primary" data-action="save-shop">Save shop details</button>')}<div class="shop-profile-banner"><div class="big-shop-avatar">🥬</div><div><span class="eyebrow">SAMPLE SELLER PROFILE · SOUTH DELHI</span><h2>Green Basket Market</h2><p>Fresh produce and everyday essentials, carefully picked from your neighbourhood.</p><span class="profile-location">⌖ B-12, Hauz Khas Market · South Delhi</span></div><button class="seller-btn" data-action="preview-shop">Preview customer view ↗</button></div><div class="two-panel"><section class="panel info-card">${panelTitle('Shop availability', 'Let neighbours know when you can take orders')}<div class="setting-row"><div><b>Accepting online orders</b><small>Customers can browse and order from your shop</small></div><button class="toggle ${s.open?'on':''}" data-action="shop-toggle" data-key="open" aria-label="Toggle shop status"></button></div><div class="setting-row"><div><b>NearBuy Runner delivery</b><small>Request a delivery partner for eligible orders</small></div><button class="toggle ${s.delivery?'on':''}" data-action="shop-toggle" data-key="delivery"></button></div><div class="setting-row"><div><b>Customer pickup</b><small>Let customers collect prepared orders</small></div><button class="toggle ${s.pickup?'on':''}" data-action="shop-toggle" data-key="pickup"></button></div><div class="setting-row"><div><b>Auto-accept new orders</b><small>Review stock before turning this on</small></div><button class="toggle ${s.autoAccept?'on':''}" data-action="shop-toggle" data-key="autoAccept"></button></div></section><section class="panel info-card">${panelTitle('Service area & timing', 'Set expectations you can reliably meet')}<div class="shop-form-grid"><label class="modal-form-label">Delivery radius<select id="shopRadius"><option${s.radius==='1 km'?' selected':''}>1 km</option><option${s.radius==='2 km'?' selected':''}>2 km</option><option${s.radius==='3 km'?' selected':''}>3 km</option></select></label><label class="modal-form-label">Preparation time<select id="shopPrep"><option${s.prep==='15–25 min'?' selected':''}>15–25 min</option><option${s.prep==='25–35 min'?' selected':''}>25–35 min</option><option>35–45 min</option></select></label></div><div class="setting-row"><div><b>Shop address</b><small>Hauz Khas Market, South Delhi · Sample address, not verified</small></div><button class="inline-link" data-action="edit-shop">Edit</button></div><div class="setting-row"><div><b>Opening hours</b><small>Mon–Sat · 8:00 am – 9:00 pm</small></div><button class="inline-link" data-action="edit-hours">Edit hours</button></div></section></div><section class="panel info-card" style="margin-top:13px">${panelTitle('Shop profile completion', 'A complete profile helps nearby customers feel confident')}<div class="profile-progress"><span style="width:82%"></span></div><div class="completion-line"><b>82% complete · Demo only</b><small>Illustrative checklist. Real identity, address and business verification are not performed here.</small><button class="inline-link" data-action="verification-info">View onboarding steps ↗</button></div><div class="onboarding-steps"><span class="onboarding-done">✓ Shop details · sample</span><span class="onboarding-done">✓ Service area · sample</span><span class="onboarding-pending">○ Identity & business documents · not verified</span><span class="onboarding-pending">○ Payout account · not connected</span></div></section>`;
}
function supportPage() { return `${pageTitle('WE’RE HERE FOR YOUR SHOP', 'Support & Academy', 'Get practical answers, open a demo support ticket, or learn a new Seller Hub skill.')}<div class="two-panel"><section class="panel support-panel">${panelTitle('Send a support request', 'This form creates a local demo ticket only')}<form id="sellerSupportForm"><label>What do you need help with?<select name="topic"><option>Orders & fulfilment</option><option>Products & catalogue</option><option>Inventory & stock</option><option>Payments & settlements</option><option>Account & verification</option></select></label><label>Related order or product (optional)<input name="reference" placeholder="e.g. NB-20486"/></label><label>Tell us a little more<textarea name="message" required placeholder="Describe what happened and what you need..."></textarea></label><button class="seller-btn primary">Create demo ticket ↗</button></form></section><section class="panel">${panelTitle('NearBuy Academy', 'Short, practical lessons for local shops')}<div class="activity-list">${[['▧','Add your first products','Catalogue · 4 min'],['▥','Keep stock up to date','Inventory · 3 min'],['▤','A smooth order handover','Orders · 5 min'],['₹','Read your demo settlement','Payments · 4 min']].map(([i,t,s])=>`<div class="activity-item"><span class="activity-icon">${i}</span><div><b>${t}</b><small>${s}</small></div><button class="table-action" data-action="academy-lesson">Start ↗</button></div>`).join('')}</div></section></div><section class="panel" style="margin-top:13px">${panelTitle('Your demo support tickets', 'Tickets are stored locally in this browser')}<div class="activity-list">${sellerData('tickets', []).map(t=>`<div class="activity-item"><span class="activity-icon">♡</span><div><b>${safe(t.topic)}</b><small>${safe(t.id)} · ${safe(t.date)} · ${safe(t.message)}</small></div>${pill('Open')}</div>`).join('')||'<div class="seller-empty">No support tickets yet.</div>'}</div></section>`; }
function teamPage() {
  if (sellerUser.id !== 'owner') return `${pageTitle('YOUR TEAM, YOUR PERMISSIONS', 'Team & access', 'Only the shop owner can manage staff access in this demo.')}<div class="seller-empty panel"><b>Owner permission required</b>Sign in with owner@nearbuy.demo to invite team members.</div>`;
  const team = sellerData('team', [{ name: 'Riya Sharma', email: 'owner@nearbuy.demo', role: 'Owner', initials: 'RS' }, { name: 'Aarav Mehta', email: 'manager@nearbuy.demo', role: 'Shop manager', initials: 'AM' }, { name: 'Sana Khan', email: 'inventory@nearbuy.demo', role: 'Inventory manager', initials: 'SK' }]);
  return `${pageTitle('SHARE THE WORK, KEEP ACCESS CLEAR', 'Team & access', 'Give each teammate only the tools they need.', '<button class="seller-btn primary" data-action="invite-team">＋ Invite teammate</button>')}<section class="panel">${panelTitle('People with shop access', 'Demo roles illustrate role-based access')}<div class="table-overflow"><table class="data-table"><thead><tr><th>TEAM MEMBER</th><th>EMAIL</th><th>ROLE</th><th>ACCESS</th></tr></thead><tbody>${team.map(person=>`<tr><td><div class="prod-cell"><span class="profile-initials">${safe(person.initials)}</span><b>${safe(person.name)}</b></div></td><td>${safe(person.email)}</td><td><span class="role-label">${safe(person.role)}</span></td><td>${person.role==='Owner'?'Full access':'Scoped demo access'}</td></tr>`).join('')}</tbody></table></div></section><div class="demo-notice seller-demo-notice">A production team invitation would require secure account verification and explicit permissions.</div>`;
}
function securityPage() {
  const settings=sellerSettings(); const security=settings.security||{twoStep:false,alerts:true};
  return `${pageTitle('KEEP YOUR SHOP ACCOUNT SAFE', 'Account & security', 'Local demo settings only. No real authentication, recovery or device checks are connected.')}<div class="two-panel"><section class="panel info-card">${panelTitle('Sign-in protection', 'Illustrative account preferences')}<div class="setting-row"><div><b>Two-step sign-in</b><small>Require an extra verification step on a real account</small></div><button class="toggle ${security.twoStep?'on':''}" data-action="security-toggle" data-key="twoStep" aria-label="Toggle two-step sign-in"></button></div><div class="setting-row"><div><b>Security alerts</b><small>Notify the shop owner about unusual sign-in activity</small></div><button class="toggle ${security.alerts?'on':''}" data-action="security-toggle" data-key="alerts" aria-label="Toggle security alerts"></button></div><div class="setting-row"><div><b>Signed in as</b><small>${safe(sellerUser.email)} · ${safe(sellerUser.role)}</small></div><span class="role-label">DEMO</span></div><button class="seller-btn" data-action="logout-seller">Sign out of this demo</button></section><section class="panel info-card">${panelTitle('Account recovery & access', 'What a production service should support')}<div class="activity-list"><div class="activity-item"><span class="activity-icon">♙</span><div><b>Verified email & recovery</b><small>Not connected in this browser demo.</small></div></div><div class="activity-item"><span class="activity-icon">▣</span><div><b>Device and session review</b><small>No server-side sessions are available to revoke.</small></div></div><div class="activity-item"><span class="activity-icon">⌑</span><div><b>Data and privacy requests</b><small>Production account controls would be required.</small></div></div></div></section></div><div class="demo-notice seller-demo-notice">Changing these preference toggles only stores sample settings in this browser. Passwords are demo credentials and must never be reused.</div>`;
}
function notificationsPage() {
  const list = sellerData('notifications', [{ id: 'a', title: '3 new orders need your response', body: 'New customer orders are waiting in your queue.', time: 'Just now', unread: true }, { id: 'b', title: 'Stock is running low', body: 'Bananas and apples are below your restock reminder.', time: 'Today, 9:40 am', unread: true }, { id: 'c', title: 'Settlement scheduled', body: 'An illustrative payout is expected on 18 Jun.', time: 'Yesterday', unread: false }]);
  return `${pageTitle('THE LITTLE BUSINESS UPDATES', 'Notifications', 'Important order, stock and account updates for your shop.', '<button class="seller-btn" data-action="mark-notifications">Mark all read</button>')}<section class="panel">${panelTitle('Recent updates', 'Only sample alerts are generated in this prototype')}<div>${list.map(n=>`<div class="notice-row"><i class="notice-dot" style="${n.unread?'':'background:#c7cdd3'}"></i><div><b>${safe(n.title)}</b><small>${safe(n.body)} · ${safe(n.time)}</small></div></div>`).join('')}</div></section>`;
}
function renderSeller() {
  if (!sellerUser) { sellerApp.hidden = true; showLogin(); return; }
  loginRoot.innerHTML = ''; sellerApp.hidden = false; updateSellerShell();
  if (!canAccess(view)) view = 'dashboard';
  const pages = { dashboard: dashboardPage, orders: orderPage, products: productPage, inventory: inventoryPage, delivery: deliveryPage, returns: returnsPage, payments: paymentsPage, promotions: promotionsPage, analytics: analyticsPage, shop: shopPage, support: supportPage, team: teamPage, security: securityPage, notifications: notificationsPage };
  sellerMain.innerHTML = `<div class="seller-prototype-banner"><b>DEMO MODE</b><span>Sample data and local-only actions — no live verification, payments, inventory sync or Runner dispatch.</span></div>${(pages[view] || dashboardPage)()}`;
  updateSellerShell();
}
function openSellerModal(content, extra = '') { sellerModal.innerHTML = `<div class="seller-modal-backdrop" data-action="modal-backdrop"><section class="seller-modal ${extra}"><button class="seller-modal-close" data-action="modal-close" aria-label="Close">×</button>${content}</section></div>`; }
function closeSellerModal() { sellerModal.innerHTML = ''; }
function productModal(product = null) {
  const p = product || { name:'', sku:'', category:'Grocery', price:'', mrp:'', stock:0, lowAt:5, emoji:'🛍️' };
  openSellerModal(`<span class="eyebrow">${product?'UPDATE A LISTING':'ADD TO YOUR DIGITAL SHELF'}</span><h2>${product?'Edit product':'Add a product'}</h2><p>Keep the customer-facing details clear and stock accurate.</p><form class="modal-form" id="productForm"><input type="hidden" name="id" value="${safe(product?.id||'')}"/><label>Product name<input name="name" required value="${safe(p.name)}" placeholder="e.g. Basmati rice · 1 kg"/></label><div class="shop-form-grid"><label>Category<select name="category"><option${p.category==='Grocery'?' selected':''}>Grocery</option><option${p.category==='Fresh produce'?' selected':''}>Fresh produce</option><option${p.category==='Bakery'?' selected':''}>Bakery</option><option${p.category==='Dairy & eggs'?' selected':''}>Dairy & eggs</option><option${p.category==='Pantry'?' selected':''}>Pantry</option><option>General store</option></select></label><label>Product emoji<input name="emoji" maxlength="4" value="${safe(p.emoji)}"/></label><label>Selling price (₹)<input name="price" type="number" min="1" required value="${safe(p.price)}"/></label><label>MRP (₹)<input name="mrp" type="number" min="1" value="${safe(p.mrp)}"/></label><label>Available stock<input name="stock" type="number" min="0" required value="${safe(p.stock)}"/></label><label>Restock reminder at<input name="lowAt" type="number" min="0" value="${safe(p.lowAt)}"/></label></div><button class="seller-btn primary">Save product ↗</button></form>`, 'product-editor');
}
function orderModal(order) {
  if (!order) return;
  const next = { 'New': ['Accept order','accept-order'], 'Preparing': ['Mark ready','mark-ready'], 'Ready for Runner': ['Request Runner','request-runner'], 'Out for delivery': ['Track delivery','track-runner'], 'Ready for pickup': ['Complete pickup','complete-order'] }[order.status];
  openSellerModal(`<span class="eyebrow">ORDER · ${safe(order.placed)}</span><h2>${safe(order.id)}</h2><p>${safe(order.customer)} · ${safe(order.area)} · ${pill(order.status)}</p><div class="modal-order-lines">${order.items.map(item=>`<div><span>${item.qty} × ${safe(item.name)}</span><b>${sellerMoney(item.qty*item.price)}</b></div>`).join('')}<div class="modal-order-total"><span>Order total</span><b>${sellerMoney(order.total)}</b></div></div><div class="order-modal-meta"><span>Fulfilment</span><b>${safe(order.method)}</b><span>Delivery status</span><b>${safe(order.deliveryTask?.status || order.status)}</b><span>Runner</span><b>${safe(order.deliveryTask?.partnerName || (order.deliveryTask?.partnerId ? 'Partner assigned in demo' : 'Not assigned'))}</b><span>Customer contact</span><b>Masked in demo for privacy</b><span>Payment</span><b>Sample payment · not processed</b></div><div class="seller-heading-actions" style="margin-top:16px"><button class="seller-btn" data-action="modal-close">Close</button>${next?`<button class="seller-btn primary" data-action="${next[1]}" data-id="${order.id}">${next[0]} ↗</button>`:''}${order.status==='New'?`<button class="seller-btn" data-action="reject-order" data-id="${order.id}">Decline</button>`:''}</div>`, 'order-detail-modal');
}
function updateOrder(id, status) {
  const orders = sellerOrders().map(order => order.id === id ? { ...order, status } : order); saveSellerData('orders', orders); closeSellerModal(); renderSeller(); toast(`${id} updated · ${status}.`);
}
function adjustStock(id, delta) {
  const products = sellerProducts(); const product = products.find(p => p.id === id); if (!product) return;
  product.stock = Math.max(0, product.stock + delta); product.status = product.stock ? 'Active' : 'Out of stock'; saveSellerData('products', products);
  const movements = sellerData('movements', []); movements.unshift({ id, amount: delta, date: new Date().toLocaleString('en-IN'), by: sellerUser.name }); saveSellerData('movements', movements.slice(0, 50)); renderSeller();
}
function exportCsv(filename, rows) { const content = rows.map(row => row.map(value => `"${String(value ?? '').replaceAll('"','""')}"`).join(',')).join('\n'); const blob = new Blob([content], { type:'text/csv;charset=utf-8' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); toast('Your demo CSV is ready.'); }
function downloadProducts() { exportCsv('nearbuy-products-demo.csv', [['SKU','Product','Category','Price','Stock','Status'], ...sellerProducts().map(p=>[p.sku,p.name,p.category,p.price,p.stock,productStatus(p)])]); }
function filterProductTable() {
  const query = (document.getElementById('productSearch')?.value || '').toLowerCase();
  const category = document.getElementById('productCategory')?.value || 'all';
  const state = document.getElementById('listingState')?.value || 'all';
  const stock = document.getElementById('productState')?.value || 'all';
  const list = sellerProducts().filter(product => `${product.name} ${product.sku} ${product.brand || ''} ${product.category}`.toLowerCase().includes(query) && (category === 'all' || product.category === category) && (state === 'all' || listingState(product) === state) && (stock === 'all' || productStatus(product) === stock));
  const tbody = document.getElementById('productRows');
  if (tbody) tbody.innerHTML = list.map(productRow).join('') || '<tr><td colspan="6"><div class="seller-empty">No listings match those filters.</div></td></tr>';
  const count = document.getElementById('listingCount');
  if (count) count.textContent = `${list.length} LISTINGS`;
}

function sellerLogin(email, password) {
  const user = SELLER_USERS.find(item => item.email.toLowerCase() === email.toLowerCase().trim() && item.password === password);
  if (!user) { const node = document.getElementById('sellerLoginError'); if (node) node.textContent = 'That email and password do not match a demo seller account.'; return; }
  sellerUser = { id:user.id, name:user.name, email:user.email, role:user.role, initials:user.initials, permissions:user.permissions };
  sellerStorage.set('session', sellerUser); view = 'dashboard'; renderSeller(); toast(`Welcome to Seller Hub, ${user.name.split(' ')[0]}.`);
}
function createPromoModal() {
  openSellerModal(`<span class="eyebrow">A SMALL OFFER, RIGHT AROUND THE CORNER</span><h2>Create a demo promotion</h2><p>Campaigns in this prototype are private sample data.</p><form id="promoForm" class="modal-form"><label>Offer name<input name="title" required placeholder="e.g. Weekend local favourite"/></label><div class="shop-form-grid"><label>Promo code<input name="code" required maxlength="14" placeholder="LOCAL10"/></label><label>Offer type<select name="type"><option>10% off</option><option>₹20 off ₹199</option><option>Free pickup offer</option></select></label></div><label>End date<input type="date" name="ends" required/></label><button class="seller-btn primary">Save demo offer ↗</button></form>`, '');
}
function editStockModal(product) { openSellerModal(`<span class="eyebrow">INVENTORY ADJUSTMENT</span><h2>Update ${safe(product.name)}</h2><p>Current count: ${product.stock}. This stock change is saved in your browser.</p><form id="stockForm" class="modal-form"><input type="hidden" name="id" value="${product.id}"/><label>New available quantity<input type="number" min="0" name="stock" required value="${product.stock}"/></label><label>Reason<select name="reason"><option>Stock count</option><option>New stock received</option><option>Damaged or unsellable</option><option>Physical shop sale adjustment</option></select></label><button class="seller-btn primary">Save stock count ↗</button></form>`, ''); }

/* =========================================================================
   LISTING STUDIO
   Add, edit, review and manage product listings inside the Seller Hub demo.
   ========================================================================= */
const LISTING_STATES = ['Draft', 'Incomplete', 'Under review', 'Changes required', 'Active', 'Paused', 'Rejected', 'Archived'];
const LISTING_CATEGORIES = {
  'Grocery': ['Staples & grains', 'Oils & masala', 'Snacks & biscuits', 'Beverages', 'Household essentials'],
  'Fresh produce': ['Fruits', 'Vegetables', 'Herbs & leafy greens'],
  'Bakery': ['Breads', 'Cakes & pastries', 'Cookies & rusks'],
  'Dairy & eggs': ['Milk', 'Curd & paneer', 'Eggs', 'Butter & cheese'],
  'Pantry': ['Honey & spreads', 'Sauces & condiments', 'Breakfast'],
  'Stationery & books': ['Notebooks & pads', 'Pens & pencils', 'Art supplies', 'School books'],
  'General store': ['Home care', 'Personal care', 'Kitchen basics']
};
const LISTING_UNITS = ['1 pc', 'pack of 2', 'pack of 6', '250 g', '500 g', '1 kg', '5 kg', '250 ml', '500 ml', '1 L', '1 bunch', '1 dozen'];
const LISTING_ICONS = ['🛍️', '🥛', '🍞', '🥚', '🍎', '🍌', '🥬', '🍯', '🥣', '📓', '✏️', '📚', '🧴', '🧹', '🫙', '🍫', '☕', '🧻'];
const LISTING_STEPS = [
  { key: 'identity', label: 'Identity', hint: 'Pick the category and give the product a clear, specific name.' },
  { key: 'details', label: 'Details', hint: 'Describe exactly what a neighbour receives when they order.' },
  { key: 'photos', label: 'Photos', hint: 'Add clear photos. The first photo becomes the catalogue image.' },
  { key: 'price', label: 'Price & stock', hint: 'Set the price, shelf stock and how this product reaches the customer.' },
  { key: 'review', label: 'Review', hint: 'Check everything once more, then save a draft or submit it for review.' }
];
let listingWizard = null;
let aiListingDraft = null;

function listingState(product) { return product.listingStatus || 'Active'; }
function listingPill(state) {
  const tone = state === 'Active' ? '' : state === 'Under review' ? 'blue' : ['Draft', 'Incomplete', 'Changes required'].includes(state) ? 'warning' : state === 'Rejected' ? 'red' : 'neutral';
  return `<span class="status-pill ${tone}">${safe(state)}</span>`;
}
function stockLabel(product) {
  const stock = Number(product.stock) || 0;
  const low = Number(product.lowAt) || 0;
  if (stock <= 0) return 'Out of stock';
  if (stock <= low) return 'Low stock';
  return 'In stock';
}
function listingThumb(product) {
  const image = (product.images || [])[0];
  const art = image && image.src ? `<img src="${image.src}" alt=""/>` : (image && image.emoji) || product.emoji || '🛍️';
  return `<span class="prod-thumb">${art}</span>`;
}
function blankListing() {
  return {
    id: '', sku: '', name: '', brand: '', category: 'Grocery', subcategory: '', barcode: '',
    description: '', highlights: '', unit: '1 pc', netQty: '', origin: 'India', tax: '5', shelfLife: '',
    emoji: '🛍️', price: '', mrp: '', stock: '', lowAt: '5', prep: '15–25 min',
    delivery: true, pickup: true, aiUsed: false
  };
}
function listingChecks(data) {
  const highlights = String(data.highlights || '').split('\n').filter(line => line.trim());
  return [
    { key: 'name', step: 1, required: true, label: 'Product name is clear', fix: 'Add a product name of at least 3 characters.', ok: String(data.name || '').trim().length >= 3 },
    { key: 'category', step: 1, required: true, label: 'Category and subcategory chosen', fix: 'Choose a category and subcategory.', ok: !!data.category && !!data.subcategory },
    { key: 'brand', step: 1, required: true, label: 'Brand or maker recorded', fix: 'Add a brand, or use “Local / unbranded”.', ok: !!String(data.brand || '').trim() },
    { key: 'description', step: 2, required: true, label: 'Description of 30+ characters', fix: 'Describe what the customer receives in at least 30 characters.', ok: String(data.description || '').trim().length >= 30 },
    { key: 'unit', step: 2, required: true, label: 'Unit or pack size set', fix: 'Choose how this product is sold.', ok: !!data.unit },
    { key: 'tax', step: 2, required: true, label: 'Tax rate selected', fix: 'Pick the applicable GST rate.', ok: data.tax !== '' && data.tax != null },
    { key: 'photo', step: 3, required: true, label: 'At least one product photo', fix: 'Add a photo, or use the demo placeholder.', ok: (data.images || []).length > 0 },
    { key: 'price', step: 4, required: true, label: 'Selling price entered', fix: 'Enter a selling price above zero.', ok: Number(data.price) > 0 },
    { key: 'mrp', step: 4, required: true, label: 'MRP is not below the selling price', fix: 'Correct the MRP or the selling price.', ok: Number(data.mrp) > 0 && Number(data.mrp) >= Number(data.price) },
    { key: 'stock', step: 4, required: true, label: 'Stock count entered', fix: 'Enter the stock you have on the shelf.', ok: data.stock !== '' && data.stock != null && Number(data.stock) >= 0 },
    { key: 'fulfilment', step: 4, required: true, label: 'Delivery or pickup enabled', fix: 'Enable at least one fulfilment option.', ok: !!(data.delivery || data.pickup) },
    { key: 'highlights', step: 2, required: false, label: 'Two or more highlights added', fix: 'Add short highlights customers can scan.', ok: highlights.length >= 2 }
  ];
}
function masterMatches(query = '') {
  const needle = query.toLowerCase();
  return sellerProducts().filter(product => !needle || `${product.name} ${product.brand || ''} ${product.sku}`.toLowerCase().includes(needle)).slice(0, 6);
}
function masterResultsHtml(query = '') {
  const matches = masterMatches(query);
  if (!matches.length) return '<small class="field-hint">No matching product in your own catalogue. You can create a new product identity.</small>';
  return matches.map(product => `<button type="button" class="master-chip" data-action="listing-use-master" data-id="${product.id}">${product.emoji || '🛍️'} ${safe(product.name)}</button>`).join('');
}
function listingPriceLine(data) {
  const mrp = Number(data.mrp) || 0;
  const price = Number(data.price) || 0;
  if (!price) return '<span class="field-hint">Add a selling price to preview what customers will see.</span>';
  if (mrp && price > mrp) return '<b class="price-warn">Selling price is above MRP.</b><small>Customers may read this as an incorrect price. Check both numbers before submitting.</small>';
  const off = mrp > price ? Math.round((1 - price / mrp) * 100) : 0;
  return `<b>Customers pay ${sellerMoney(price)}${off ? ` · ${off}% below MRP` : ''}</b><small>MRP ${sellerMoney(mrp || price)} · Commission, taxes and settlement are not calculated in this demo.</small>`;
}
function listingMethodCards(withSubModals = false) {
  const cards = [
    ['listing-create-manual', '✎', 'Add manually', 'A guided five-step listing form', 'Recommended'],
    ['listing-ai-start', '✳', 'AI-assisted draft', 'Suggestions that you verify yourself', 'Rule-based demo'],
    ['bulk-import', '⇧', 'Bulk spreadsheet', 'Paste rows for several products', 'Goes to review']
  ];
  if (withSubModals) cards.push(
    ['listing-copy-modal', '⧉', 'Copy a listing', 'Start from something you already sell', 'Edit before submitting'],
    ['listing-barcode-modal', '▥', 'Barcode / SKU', 'Look up a product or start with a code', 'Demo lookup']
  );
  return `<div class="listing-method-grid">${cards.map(([action, icon, title, text, note]) => `<button class="method-card" data-action="${action}"><span>${icon}</span><b>${title}</b><small>${text}</small><em>${note}</em></button>`).join('')}</div>`;
}
function catalogueQuality(products) {
  return [
    { label: 'Listings without a product photo', detail: 'A clear photo helps neighbours choose.', items: products.filter(product => !(product.images || []).length), step: 3 },
    { label: 'Descriptions under 30 characters', detail: 'Explain what the customer receives.', items: products.filter(product => String(product.description || '').trim().length < 30), step: 2 },
    { label: 'No brand or maker recorded', detail: 'Use “Local / unbranded” where there is no brand.', items: products.filter(product => !String(product.brand || '').trim()), step: 1 },
    { label: 'Selling price above MRP', detail: 'Check the numbers before customers see them.', items: products.filter(product => Number(product.mrp) && Number(product.price) > Number(product.mrp)), step: 4 }
  ].filter(issue => issue.items.length);
}

/* ---------- Starting a listing ---------- */
function listingStartModal() {
  openSellerModal(`<span class="eyebrow">LISTING STUDIO</span><h2>Add a listing</h2><p>Choose the fastest way to put a product on your digital shelf. Every listing is checked before nearby customers can see it.</p>${listingMethodCards(true)}<div class="demo-notice seller-demo-notice">Listings, photos and review decisions are stored only in this browser. No NearBuy catalogue review, barcode database or AI service is connected.</div>`, 'listing-start-modal');
}
function listingCopyModal() {
  openSellerModal(`<span class="eyebrow">COPY A LISTING</span><h2>Start from something you already sell.</h2><p>Details, photos and price are copied into a new draft. Change what is different before submitting.</p><div class="modal-form"><label>Existing listing<select id="listingCopySelect">${sellerProducts().map(product => `<option value="${product.id}">${safe(product.name)} · ${safe(product.sku)}</option>`).join('')}</select></label><button class="seller-btn primary" data-action="listing-copy-start">Create a draft copy ↗</button></div>`);
}
function listingBarcodeModal() {
  openSellerModal(`<span class="eyebrow">BARCODE / SKU LOOKUP · DEMO</span><h2>Look up a product.</h2><p>Enter a barcode or one of your own SKUs. This demo checks only your local catalogue — no real barcode database is connected.</p><div class="modal-form"><label>Barcode or SKU<input id="listingBarcodeInput" list="demoBarcodeList" placeholder="e.g. GB-MILK-01"/></label><datalist id="demoBarcodeList">${sellerProducts().map(product => `<option value="${safe(product.sku)}">${safe(product.name)}</option>`).join('')}</datalist><button class="seller-btn primary" data-action="listing-barcode-start">Look up ↗</button></div>`);
}
function listingCopyStart() {
  const id = document.getElementById('listingCopySelect')?.value || document.getElementById('copyListing')?.value;
  const product = sellerProducts().find(item => item.id === id);
  if (!product) return toast('Choose a listing to copy.');
  const preset = { ...product, name: `${product.name} (copy)`, sku: '', sold: 0, images: (product.images || []).map(image => ({ ...image })) };
  startListingWizard('copy', null, preset, 1);
  toast('Copied as a new draft. Check the details before submitting.');
}
function listingBarcodeStart() {
  const value = String(document.getElementById('listingBarcodeInput')?.value || document.getElementById('barcodeLookup')?.value || '').trim();
  if (!value) return toast('Enter a demo barcode or SKU to look up.');
  const match = sellerProducts().find(product => product.sku.toLowerCase() === value.toLowerCase() || product.id.toLowerCase() === value.toLowerCase() || (product.barcode || '') === value);
  if (match) {
    startListingWizard('copy', null, { ...match, name: match.name, sku: '', sold: 0, barcode: match.barcode || value, images: (match.images || []).map(image => ({ ...image })) }, 1);
    toast('Found in your catalogue — details are prefilled.');
    return;
  }
  if (/^[A-Za-z0-9-]{4,}$/.test(value)) {
    startListingWizard('manual', null, { barcode: value }, 1);
    toast('No local catalogue match. Start a new listing with that code.');
    return;
  }
  toast('Use one of your SKUs (like GB-MILK-01) or a code of 4+ characters.');
}
function startListingWizard(mode = 'manual', product = null, preset = {}, startStep = 1) {
  const base = { ...blankListing(), ...(product || {}), ...preset };
  const images = ((preset.images || product?.images || [])).map(image => ({ ...image }));
  listingWizard = { step: Math.min(Math.max(Number(startStep) || 1, 1), LISTING_STEPS.length), mode, editingId: product?.id || null, data: base, images, errors: [] };
  renderListingWizard();
}

/* ---------- AI-assisted draft (local rules only) ---------- */
function aiListingModal() {
  openSellerModal(`<span class="eyebrow">AI LISTING ASSISTANT · DEMO</span><h2>Start with a rough description.</h2><p>The sample assistant suggests a title, category and draft description. It never invents ingredients, dimensions, model numbers, warranties or certifications — you must verify every field before submitting.</p><form id="aiListingForm" class="modal-form"><label>What are you selling?<textarea name="prompt" required placeholder="e.g. Classmate A4 spiral notebook, 200 pages"></textarea></label><label>Preferred category<select name="category">${Object.keys(LISTING_CATEGORIES).map(category => `<option>${safe(category)}</option>`).join('')}</select></label><button class="seller-btn primary">Suggest a draft ↗</button></form><div class="demo-notice seller-demo-notice">No AI service is connected in this prototype. Suggestions come from simple keyword rules, and nothing is published automatically.</div>`);
}
function buildAiSuggestion(prompt, category) {
  const clean = prompt.trim().replace(/\s+/g, ' ');
  const lower = clean.toLowerCase();
  const title = clean.charAt(0).toUpperCase() + clean.slice(1);
  let guess = category;
  if (/notebook|pencil|pen\b|eraser|stationery|art suppl|textbook|novel/.test(lower)) guess = 'Stationery & books';
  else if (/milk|curd|paneer|egg|butter|cheese/.test(lower)) guess = 'Dairy & eggs';
  else if (/bread|loaf|cake|cookie|bun|rusk/.test(lower)) guess = 'Bakery';
  else if (/apple|banana|spinach|tomato|onion|potato|fruit|vegetable|herb/.test(lower)) guess = 'Fresh produce';
  else if (/rice|atta|flour|dal|oil|masala|tea|coffee|snack|biscuit|soap|detergent/.test(lower)) guess = 'Grocery';
  const subcategory = (LISTING_CATEGORIES[guess] || [''])[0];
  return {
    title,
    category: guess,
    subcategory,
    description: `${title}, available from Green Basket Market in Hauz Khas. Add the pack size, quantity or material your neighbours need, and mention anything that helps them choose this product.`,
    highlights: 'Available for local delivery or shop pickup\nAsk the shop if you need more product details',
    notes: [
      `Suggested category: ${guess} · ${subcategory}. Confirm it fits the product.`,
      'Add the real brand, or choose “Local / unbranded”.',
      'Replace the draft description with verified pack, material and quantity details.'
    ]
  };
}
function aiSuggestionModal(suggestion) {
  openSellerModal(`<span class="eyebrow">SUGGESTED DRAFT · VERIFY BEFORE USE</span><h2>${safe(suggestion.title)}</h2><p>This is a starting point, not a finished listing. Nothing here is published until you complete the wizard and submit.</p><div class="ai-block"><b>Suggested description</b><p>${safe(suggestion.description)}</p></div><div class="review-checks">${suggestion.notes.map(note => `<div class="review-check"><i>!</i><div>${safe(note)}</div></div>`).join('')}</div><div class="confirm-row"><button class="seller-btn" data-action="listing-ai-restart">Start over</button><button class="seller-btn primary" data-action="listing-ai-use">Use this draft ↗</button></div>`, 'listing-ai-modal');
}

/* ---------- Wizard rendering ---------- */
function renderListingWizard() {
  const wizard = listingWizard;
  if (!wizard) return;
  const step = LISTING_STEPS[wizard.step - 1];
  const checks = listingChecks({ ...wizard.data, images: wizard.images });
  const missing = checks.filter(check => check.required && !check.ok).length;
  const editingProduct = wizard.editingId ? sellerProducts().find(product => product.id === wizard.editingId) : null;
  const draftLabel = editingProduct && ['Active', 'Paused', 'Under review'].includes(listingState(editingProduct)) ? 'Save changes' : 'Save draft';
  const last = wizard.step === LISTING_STEPS.length;
  const modeLabel = { manual: 'ADD MANUALLY', ai: 'AI-ASSISTED DRAFT', copy: 'COPIED LISTING', edit: 'EDITING LISTING' }[wizard.mode] || 'LISTING STUDIO';
  openSellerModal(`<div class="wizard-shell"><div class="wizard-head"><span class="eyebrow">LISTING STUDIO · ${modeLabel}</span><h2>${wizard.editingId ? 'Edit listing' : 'Add a listing'}</h2><p>${step.hint}</p></div><div class="wizard-rail">${LISTING_STEPS.map((item, index) => `<button type="button" class="wizard-step ${index + 1 === wizard.step ? 'current' : ''} ${index + 1 < wizard.step ? 'done' : ''}" data-action="listing-goto-step" data-step="${index + 1}"><i>${index + 1 < wizard.step ? '✓' : index + 1}</i><span>${item.label}</span></button>`).join('')}</div><form class="wizard-form" id="listingStepForm"><div class="wizard-body">${wizard.errors.length ? `<div class="wizard-error"><b>Almost there — a few details need attention.</b><ul>${wizard.errors.map(error => `<li>${safe(error)}</li>`).join('')}</ul></div>` : ''}${listingStepBody(wizard)}</div><div class="wizard-foot"><button type="button" class="seller-btn" data-action="listing-back" ${wizard.step === 1 ? 'disabled' : ''}>← Back</button><span class="wizard-progress">Step ${wizard.step} of ${LISTING_STEPS.length} · checks ${checks.filter(check => check.ok).length}/${checks.length}<br/>${missing ? `${missing} required detail${missing === 1 ? '' : 's'} left` : 'Ready to submit'}</span><button type="submit" formnovalidate name="intent" value="draft" class="seller-btn">${draftLabel}</button><button type="submit" name="intent" value="${last ? 'submit' : 'next'}" class="seller-btn primary">${last ? 'Submit for review ↗' : 'Continue →'}</button></div></form></div>`, 'seller-modal-wide listing-wizard');
}
function listingStepBody(wizard) {
  const d = wizard.data;
  if (wizard.step === 1) {
    const subcategories = LISTING_CATEGORIES[d.category] || [];
    return `<div class="field-grid"><label>Category<select name="category" id="listingCategory" required>${Object.keys(LISTING_CATEGORIES).map(category => `<option${d.category === category ? ' selected' : ''}>${safe(category)}</option>`).join('')}</select></label><label>Subcategory<select name="subcategory" required><option value="">Choose a subcategory</option>${subcategories.map(subcategory => `<option${d.subcategory === subcategory ? ' selected' : ''}>${safe(subcategory)}</option>`).join('')}</select></label><label class="field-wide">Product name<input name="name" required minlength="3" maxlength="90" value="${safe(d.name)}" placeholder="e.g. Basmati rice · 1 kg"/></label><label>Brand or maker<input name="brand" required maxlength="60" value="${safe(d.brand)}" placeholder="e.g. India Gate, or Local / unbranded"/></label><label>Barcode or model (optional)<input name="barcode" maxlength="40" value="${safe(d.barcode)}" placeholder="e.g. 8901234567890"/></label><label>Seller SKU<input name="sku" maxlength="24" value="${safe(d.sku)}" placeholder="Leave blank to generate"/></label><label>Listing icon<select name="emoji">${LISTING_ICONS.map(icon => `<option${d.emoji === icon ? ' selected' : ''}>${icon}</option>`).join('')}</select></label></div><div class="master-box"><label>Find it in your catalogue<span class="field-hint">Prefills name, brand and category from a product you already sell. Price and stock stay under your control.</span><input type="search" id="listingMasterSearch" placeholder="Search products, brand or SKU"/></label><div class="master-results" id="masterResults">${masterResultsHtml(String(d.name || ''))}</div></div>`;
  }
  if (wizard.step === 2) {
    return `<div class="field-grid"><label class="field-wide">Description<textarea name="description" required minlength="30" maxlength="600" placeholder="What does the customer receive? Include pack size, material or quantity where relevant.">${safe(d.description)}</textarea></label><label class="field-wide">Highlights · one per line<textarea name="highlights" maxlength="400" placeholder="200 pages&#10;Smooth 70 gsm paper">${safe(d.highlights)}</textarea></label><label>Unit or pack size<select name="unit" required>${LISTING_UNITS.map(unit => `<option${d.unit === unit ? ' selected' : ''}>${unit}</option>`).join('')}</select></label><label>Net quantity (optional)<input name="netQty" maxlength="30" value="${safe(d.netQty)}" placeholder="e.g. 200 pages, 500 g"/></label><label>Country of origin<input name="origin" maxlength="40" value="${safe(d.origin)}"/></label><label>GST rate<select name="tax" required>${['0', '5', '12', '18'].map(rate => `<option value="${rate}"${String(d.tax) === rate ? ' selected' : ''}>${rate}% GST</option>`).join('')}</select></label><label>Shelf life or best before (optional)<input name="shelfLife" maxlength="40" value="${safe(d.shelfLife)}" placeholder="e.g. 6 months from packing"/></label></div><span class="field-hint">Only add facts you can verify. In this demo nothing is checked against a real product database.</span>`;
  }
  if (wizard.step === 3) {
    const notes = [];
    if (!wizard.images.length) notes.push({ tone: 'warn', text: 'No photo yet — add one, or use the demo placeholder to continue.' });
    wizard.images.forEach((image, index) => {
      if (image.placeholder) notes.push({ tone: 'warn', text: `Image ${index + 1} is demo placeholder art. A real listing needs a real photo.` });
      else {
        if (image.w && image.w < 600) notes.push({ tone: 'warn', text: `Image ${index + 1} is ${image.w}×${image.h}px — 800×800px or larger looks sharper.` });
        if (image.w && image.h && Math.abs(image.w - image.h) > image.w * 0.25) notes.push({ tone: 'warn', text: `Image ${index + 1} is not square — square photos crop best in the catalogue.` });
      }
    });
    if (wizard.images.length && !notes.length) notes.push({ tone: 'ok', text: 'Photos look ready for this demo catalogue.' });
    return `<div class="upload-grid">${wizard.images.map((image, index) => `<div class="image-tile">${index === 0 ? '<span class="primary-badge">PRIMARY</span>' : ''}${image.placeholder ? '<span class="tile-placeholder">DEMO</span>' : ''}${image.src ? `<img src="${image.src}" alt=""/>` : `<span class="tile-art">${image.emoji || d.emoji || '🛍️'}</span>`}<div class="tile-tools">${index > 0 ? `<button type="button" data-action="listing-img-primary" data-index="${index}">Make primary</button>` : ''}<button type="button" data-action="listing-img-remove" data-index="${index}">Remove</button></div></div>`).join('')}${wizard.images.length < 3 ? '<label class="upload-drop"><input type="file" id="listingImageInput" accept="image/*" multiple hidden/><span>＋</span>Add photo<small>Up to 3 · JPG or PNG</small></label>' : ''}</div><div class="image-checks">${notes.map(note => `<span class="${note.tone}">${safe(note.text)}</span>`).join('')}</div><div class="confirm-row"><button type="button" class="seller-btn" data-action="listing-add-placeholder">＋ Use a demo placeholder</button><button type="button" class="seller-btn" data-action="listing-goto-step" data-step="4">Continue to price</button></div><div class="demo-notice seller-demo-notice">Photos are resized in your browser and stored locally. Nothing is uploaded to a server in this prototype.</div>`;
  }
  if (wizard.step === 4) {
    return `<div class="field-grid"><label>MRP (₹)<input id="mrpInput" name="mrp" type="number" min="0" step="1" required value="${safe(d.mrp)}" placeholder="e.g. 120"/></label><label>Selling price (₹)<input id="priceInput" name="price" type="number" min="1" step="1" required value="${safe(d.price)}" placeholder="e.g. 99"/></label><label>Stock on the shelf<input name="stock" type="number" min="0" step="1" required value="${safe(d.stock)}" placeholder="e.g. 12"/></label><label>Restock reminder at<input name="lowAt" type="number" min="0" step="1" value="${safe(d.lowAt)}"/></label><label>Preparation time<select name="prep">${['10–15 min', '15–25 min', '25–40 min', 'Same day'].map(time => `<option${d.prep === time ? ' selected' : ''}>${time}</option>`).join('')}</select></label></div><div class="price-preview" id="pricePreview">${listingPriceLine(d)}</div><div class="check-box"><span class="eyebrow">HOW THIS PRODUCT REACHES THE CUSTOMER</span><label class="check-row"><input type="checkbox" name="delivery" ${d.delivery ? 'checked' : ''}/><span><b>Local delivery</b><small>Offer this product for Runner or shop delivery.</small></span></label><label class="check-row"><input type="checkbox" name="pickup" ${d.pickup ? 'checked' : ''}/><span><b>Store pickup</b><small>Neighbours can collect from the shop.</small></span></label></div><span class="field-hint">Only one shop location exists in this demo. Multi-branch stock is outside this prototype.</span>`;
  }
  const checks = listingChecks({ ...d, images: wizard.images });
  const highlights = String(d.highlights || '').split('\n').map(line => line.trim()).filter(Boolean);
  return `<div class="review-grid">${listingPreviewCard({ ...d, images: wizard.images })}<div><span class="eyebrow">QUALITY CHECKS · ${checks.filter(check => check.ok).length}/${checks.length} PASSED</span><div class="review-checks">${checks.map(check => `<div class="review-check ${check.ok ? '' : 'fail'}"><i>${check.ok ? '✓' : '!'}</i><div>${safe(check.label)}${check.ok ? '' : `<small>${safe(check.fix)}</small>`}</div></div>`).join('')}</div></div></div>${String(d.description || '').trim() ? `<div><span class="eyebrow">WHAT CUSTOMERS WILL SEE</span><p class="review-desc">${safe(d.description)}</p>${highlights.length ? `<div class="tag-row">${highlights.map(line => `<span class="soft-tag">${safe(line)}</span>`).join('')}</div>` : ''}</div>` : ''}<div class="demo-notice">Submitting sends this listing to the sample review queue. An authorised teammate can approve it or ask for changes from Products &amp; catalogue. No real NearBuy moderation happens.</div>`;
}
function listingPreviewCard(data) {
  const images = data.images || [];
  const first = images[0];
  const art = first ? (first.src ? `<img src="${first.src}" alt=""/>` : `<span>${first.emoji || '🛍️'}</span>`) : `<span>${data.emoji || '🛍️'}</span>`;
  const price = Number(data.price) || 0;
  const mrp = Number(data.mrp) || price;
  const off = mrp > price && price > 0 ? Math.round((1 - price / mrp) * 100) : 0;
  const stock = Number(data.stock);
  const delivery = data.delivery !== false;
  const pickup = data.pickup !== false;
  return `<div class="review-preview"><div class="review-art">${art}</div><div class="review-copy"><span class="eyebrow">${safe(String(data.brand || 'LOCAL SHOP').toUpperCase())} · ${safe(data.category || 'CATEGORY')}</span><b>${safe(data.name || 'Your product name')}</b><div class="price-line"><strong>${price ? sellerMoney(price) : '₹ —'}</strong>${mrp > price ? `<s>${sellerMoney(mrp)}</s><span class="offer-tag">${off}% off</span>` : ''}</div><small>${safe(data.unit || 'Unit not set')} · ${stock > 0 ? `${stock} available` : 'Out of stock'}</small><small>${delivery ? '↗ Local delivery' : ''}${delivery && pickup ? ' · ' : ''}${pickup ? '⌂ Pickup' : ''}${!delivery && !pickup ? 'No fulfilment selected' : ''}</small><small>${safe(data.prep || '15–25 min')} preparation</small></div></div>`;
}

/* ---------- Capturing and saving ---------- */
function captureListingStep(form) {
  if (!listingWizard) return;
  const data = new FormData(form);
  for (const [key, value] of data.entries()) {
    if (key === 'intent') continue;
    listingWizard.data[key] = typeof value === 'string' ? value : value;
  }
  form.querySelectorAll('input[type="checkbox"]').forEach(box => { listingWizard.data[box.name] = box.checked; });
}
function saveListing(intent) {
  const wizard = listingWizard;
  if (!wizard) return;
  const checks = listingChecks({ ...wizard.data, images: wizard.images });
  const missing = checks.filter(check => check.required && !check.ok);
  if (intent === 'submit' && missing.length) {
    wizard.errors = missing.map(check => check.fix);
    renderListingWizard();
    toast(`${missing.length} detail${missing.length === 1 ? '' : 's'} still need attention.`);
    return;
  }
  if (intent !== 'submit' && !wizard.editingId && String(wizard.data.name || '').trim().length < 3) {
    wizard.errors = ['Add a product name before saving this draft.'];
    renderListingWizard();
    toast('Add a product name before saving this draft.');
    return;
  }
  const existing = wizard.editingId ? sellerProducts().find(product => product.id === wizard.editingId) : null;
  const prior = existing ? listingState(existing) : null;
  let status = 'Under review';
  let note = 'Submitted for a sample NearBuy catalogue check.';
  if (intent !== 'submit') {
    if (missing.length && prior && ['Active', 'Paused'].includes(prior)) {
      status = prior;
      note = `${missing.length} required detail${missing.length === 1 ? '' : 's'} still missing — ${missing[0].fix}`;
    } else if (missing.length) {
      status = 'Incomplete';
      note = `${missing.length} required detail${missing.length === 1 ? '' : 's'} still missing.`;
    } else if (prior && ['Active', 'Paused', 'Under review'].includes(prior)) {
      status = prior;
      note = 'Listing details updated by the shop in this demo.';
    } else {
      status = 'Draft';
      note = 'Saved as a draft — not visible to customers.';
    }
  }
  persistListing(wizard, status, note);
  toast(intent === 'submit' ? 'Listing submitted to the sample review queue.' : 'Listing saved in this browser.');
}
function persistListing(wizard, status, note) {
  const products = sellerProducts();
  const id = wizard.editingId || `NB-${Date.now().toString().slice(-6)}`;
  const existing = products.find(product => product.id === id);
  const d = wizard.data;
  const stock = Number(d.stock) || 0;
  const history = [...(existing?.history || []), { status, note, at: new Date().toLocaleString('en-IN'), by: sellerUser.name }];
  const product = {
    ...(existing || {}),
    id,
    sku: String(d.sku || existing?.sku || '').trim() || `GB-${Date.now().toString().slice(-5)}`,
    name: String(d.name || '').trim(),
    brand: String(d.brand || '').trim(),
    category: d.category,
    subcategory: d.subcategory || '',
    barcode: d.barcode || '',
    description: String(d.description || '').trim(),
    highlights: d.highlights || '',
    unit: d.unit || '',
    netQty: d.netQty || '',
    origin: d.origin || '',
    tax: d.tax || '',
    shelfLife: d.shelfLife || '',
    emoji: d.emoji || '🛍️',
    images: wizard.images.slice(0, 3),
    price: Number(d.price) || 0,
    mrp: Number(d.mrp) || Number(d.price) || 0,
    stock,
    lowAt: Number(d.lowAt) || 5,
    sold: existing?.sold || 0,
    status: stock > 0 ? 'Active' : 'Out of stock',
    prep: d.prep || '15–25 min',
    delivery: !!d.delivery,
    pickup: !!d.pickup,
    listingStatus: status,
    reviewNote: note,
    createdAt: existing?.createdAt || new Date().toLocaleString('en-IN'),
    updatedAt: new Date().toLocaleString('en-IN'),
    history
  };
  let next = existing ? products.map(item => (item.id === id ? product : item)) : [product, ...products];
  let saved = saveSellerData('products', next);
  if (!saved && product.images.length) {
    product.images = [{ placeholder: true, emoji: d.emoji || '🛍️' }];
    next = existing ? products.map(item => (item.id === id ? product : item)) : [product, ...products];
    saved = saveSellerData('products', next);
    if (saved) toast('This browser could not keep those photos, so a placeholder was saved instead.');
  }
  if (!saved) toast('This browser could not store the listing. Try removing photos and saving again.');
  listingWizard = null;
  closeSellerModal();
  goView('products');
  return saved;
}
function setListingStatus(id, status, note) {
  const products = sellerProducts();
  const target = products.find(product => product.id === id);
  if (!target) return;
  const history = [...(target.history || []), { status, note, at: new Date().toLocaleString('en-IN'), by: sellerUser.name }];
  const next = products.map(product => (product.id === id ? { ...product, listingStatus: status, reviewNote: note, updatedAt: new Date().toLocaleString('en-IN'), history } : product));
  saveSellerData('products', next);
  closeSellerModal();
  renderSeller();
}

/* ---------- Listing management screens ---------- */
function listingMenuModal(product) {
  if (!product) return;
  const state = listingState(product);
  return openSellerModal(`<span class="eyebrow">LISTING · ${safe(product.sku)}</span><h2>${safe(product.name)}</h2><p>${listingPill(state)} ${product.reviewNote ? safe(product.reviewNote) : 'Manage this listing in the demo catalogue.'}</p><div class="listing-menu"><button data-action="edit-listing" data-id="${product.id}"><span>✎</span>Edit listing details</button><button data-action="listing-preview" data-id="${product.id}"><span>◉</span>Preview as a nearby customer</button><button data-action="edit-product" data-id="${product.id}"><span>▥</span>Quick edit price and stock</button>${['Active', 'Paused'].includes(state) ? `<button data-action="listing-toggle-pause" data-id="${product.id}"><span>${state === 'Active' ? '❙❙' : '▶'}</span>${state === 'Active' ? 'Pause this listing' : 'Resume this listing'}</button>` : ''}${['Draft', 'Incomplete', 'Changes required', 'Rejected'].includes(state) ? `<button data-action="listing-submit" data-id="${product.id}"><span>↗</span>Submit for review</button>` : ''}<button data-action="listing-duplicate" data-id="${product.id}"><span>⧉</span>Duplicate as a new draft</button><button data-action="listing-archive" data-id="${product.id}"><span>▤</span>Archive this listing</button>${['Draft', 'Incomplete'].includes(state) ? `<button data-action="listing-discard" data-id="${product.id}"><span>×</span>Discard this draft</button>` : ''}</div><div class="demo-notice seller-demo-notice">Every action updates only this browser’s sample catalogue.</div>`, 'listing-menu-modal');
}
function listingPreviewModal(product) {
  if (!product) return;
  const checks = listingChecks({ ...product, images: product.images || [] });
  const history = (product.history || []).slice(-4).reverse();
  const facts = [
    ['Listing state', listingPill(listingState(product))],
    ['SKU', safe(product.sku)],
    ['Category', `${safe(product.category || '—')}${product.subcategory ? ` · ${safe(product.subcategory)}` : ''}`],
    ['Brand', safe(product.brand || 'Not recorded')],
    ['Unit', safe(product.unit || 'Not recorded')],
    ['GST', product.tax !== undefined && product.tax !== '' ? `${safe(product.tax)}%` : 'Not recorded'],
    ['Stock', `${Number(product.stock) || 0} available${Number(product.stock) <= Number(product.lowAt || 0) ? ' · restock soon' : ''}`],
    ['Fulfilment', `${product.delivery !== false ? 'Delivery' : ''}${product.delivery !== false && product.pickup !== false ? ' · ' : ''}${product.pickup !== false ? 'Pickup' : ''}` || 'Not set'],
    ['Updated', safe(product.updatedAt || 'Not saved yet')]
  ];
  openSellerModal(`<span class="eyebrow">CUSTOMER PREVIEW</span><h2>${safe(product.name)}</h2><p>This is how the listing appears in this demo storefront. Prices and stock stay under your control.</p>${listingPreviewCard({ ...product, images: product.images || [] })}<div class="two-panel" style="margin-top:13px"><div><span class="eyebrow">LISTING DETAILS</span><div class="listing-facts">${facts.map(([label, value]) => `<div><span>${label}</span><b>${value}</b></div>`).join('')}</div></div><div><span class="eyebrow">QUALITY CHECKS</span><div class="review-checks">${checks.map(check => `<div class="review-check ${check.ok ? '' : 'fail'}"><i>${check.ok ? '✓' : '!'}</i><div>${safe(check.label)}${check.ok ? '' : `<small>${safe(check.fix)}</small>`}</div></div>`).join('')}</div></div></div>${history.length ? `<div><span class="eyebrow">LISTING ACTIVITY</span><div class="listing-timeline">${history.map(event => `<div class="timeline-item"><i></i><div><b>${safe(event.status)}</b>${safe(event.note || '')} · ${safe(event.at)}</div></div>`).join('')}</div></div>` : ''}<div class="confirm-row"><button class="seller-btn" data-action="modal-close">Close</button><button class="seller-btn primary" data-action="edit-listing" data-id="${product.id}">Edit listing ↗</button></div>`, 'listing-preview-modal');
}
function listingChangesModal(product) {
  openSellerModal(`<span class="eyebrow">SAMPLE CATALOGUE REVIEW</span><h2>Ask for changes</h2><p>${safe(product.name)} · ${safe(product.sku)}</p><form id="listingChangesForm" class="modal-form"><input type="hidden" name="id" value="${product.id}"/><label>What needs fixing?<select name="reason"><option>Primary image is unclear or missing</option><option>Product title could be clearer</option><option>Description is missing key details</option><option>Category looks incorrect</option><option>Price or MRP looks wrong</option><option>Something else (add a note)</option></select></label><label>Note for the shop (optional)<textarea name="note" placeholder="Say exactly what to fix so it can be corrected quickly."></textarea></label><button class="seller-btn primary">Send back for changes ↗</button></form>`);
}
function duplicateListing(id) {
  const products = sellerProducts();
  const source = products.find(product => product.id === id);
  if (!source) return;
  const copy = {
    ...source,
    id: `NB-${Date.now().toString().slice(-6)}`,
    sku: `${source.sku || 'GB'}-C${Date.now().toString().slice(-3)}`,
    name: `${source.name} (copy)`,
    sold: 0,
    listingStatus: 'Draft',
    reviewNote: `Copied from ${source.sku}. Update the details before submitting.`,
    createdAt: new Date().toLocaleString('en-IN'),
    updatedAt: new Date().toLocaleString('en-IN'),
    history: [{ status: 'Draft', note: `Copied from ${source.name}.`, at: new Date().toLocaleString('en-IN'), by: sellerUser.name }]
  };
  saveSellerData('products', [copy, ...products]);
  closeSellerModal();
  renderSeller();
  toast('A draft copy was added to this demo catalogue.');
}

/* ---------- Image handling ---------- */
function handleListingImages(files) {
  if (!listingWizard) return;
  const room = 3 - listingWizard.images.length;
  if (room <= 0) return toast('This demo keeps up to three photos per listing.');
  [...files].slice(0, room).forEach(file => {
    if (!file.type.startsWith('image/')) return toast('Only image files can be added.');
    if (file.size > 4 * 1024 * 1024) return toast('That file is larger than 4 MB. Use a smaller image.');
    const reader = new FileReader();
    reader.onload = () => {
      const source = String(reader.result || '');
      const image = new Image();
      image.onload = () => addListingImage(source, image, file.name);
      image.onerror = () => toast('That image could not be read.');
      image.src = source;
    };
    reader.readAsDataURL(file);
  });
}
function addListingImage(source, image, name) {
  if (!listingWizard) return;
  const max = 640;
  const scale = Math.min(1, max / Math.max(image.width || 1, image.height || 1));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round((image.width || 1) * scale));
  canvas.height = Math.max(1, Math.round((image.height || 1) * scale));
  let src = source;
  try {
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    src = canvas.toDataURL('image/jpeg', 0.78);
  } catch {}
  listingWizard.images.push({ src, name, w: canvas.width, h: canvas.height, placeholder: false });
  listingWizard.errors = [];
  renderListingWizard();
  toast('Photo added to this demo listing.');
}

// Navigation and action delegation keeps all rendered screens interactive.
document.addEventListener('click', event => {
  const target = event.target.closest('[data-view],[data-action],[data-seller-demo]'); if (!target) return;
  if (target.dataset.sellerDemo) { const user = SELLER_USERS.find(item=>item.id===target.dataset.sellerDemo); if(user) sellerLogin(user.email,user.password); return; }
  if (target.dataset.view && !target.dataset.action) { goView(target.dataset.view); return; }
  const action = target.dataset.action;
  if (action === 'modal-close' || (action === 'modal-backdrop' && event.target === target)) closeSellerModal();
  else if (action === 'add-product') listingStartModal();
  else if (action === 'edit-product') productModal(sellerProducts().find(p=>p.id===target.dataset.id));
  else if (action === 'listing-create-manual') { closeSellerModal(); startListingWizard('manual'); }
  else if (action === 'listing-ai-start') aiListingModal();
  else if (action === 'listing-copy-modal') listingCopyModal();
  else if (action === 'listing-barcode-modal') listingBarcodeModal();
  else if (action === 'listing-copy-start') listingCopyStart();
  else if (action === 'listing-barcode-start') listingBarcodeStart();
  else if (action === 'listing-ai-restart') aiListingModal();
  else if (action === 'listing-ai-use') { if (!aiListingDraft) return aiListingModal(); const draft = aiListingDraft; aiListingDraft = null; closeSellerModal(); startListingWizard('ai', null, { name: draft.title, category: draft.category, subcategory: draft.subcategory, description: draft.description, highlights: draft.highlights, aiUsed: true }, 1); toast('Draft added. Verify every field before submitting.'); }
  else if (action === 'listing-use-master') { const master = sellerProducts().find(p=>p.id===target.dataset.id); if (master && listingWizard) { listingWizard.data = { ...listingWizard.data, name: master.name, brand: master.brand || 'Local / unbranded', category: master.category, subcategory: master.subcategory || (LISTING_CATEGORIES[master.category]||[''])[0], barcode: master.barcode || '', emoji: master.emoji || listingWizard.data.emoji }; listingWizard.errors = []; renderListingWizard(); toast('Catalogue details added — check them before submitting.'); } }
  else if (action === 'listing-back') { if (listingWizard && listingWizard.step > 1) { const stepForm = document.getElementById('listingStepForm'); if (stepForm) captureListingStep(stepForm); listingWizard.step -= 1; listingWizard.errors = []; renderListingWizard(); } }
  else if (action === 'listing-goto-step') { if (listingWizard) { const stepForm = document.getElementById('listingStepForm'); if (stepForm) captureListingStep(stepForm); listingWizard.step = Math.min(LISTING_STEPS.length, Math.max(1, Number(target.dataset.step) || 1)); listingWizard.errors = []; renderListingWizard(); } }
  else if (action === 'listing-img-primary') { if (listingWizard) { const index = Number(target.dataset.index); const image = listingWizard.images[index]; if (image) { listingWizard.images.splice(index, 1); listingWizard.images.unshift(image); renderListingWizard(); toast('Primary photo updated in this demo.'); } } }
  else if (action === 'listing-img-remove') { if (listingWizard) { listingWizard.images.splice(Number(target.dataset.index), 1); listingWizard.errors = []; renderListingWizard(); } }
  else if (action === 'listing-add-placeholder') { if (listingWizard) { if (listingWizard.images.length >= 3) toast('This demo keeps up to three photos per listing.'); else { listingWizard.images.push({ placeholder: true, emoji: listingWizard.data.emoji || '🛍️' }); listingWizard.errors = []; renderListingWizard(); } } }
  else if (action === 'edit-listing') { const product = sellerProducts().find(p=>p.id===target.dataset.id); if (product) startListingWizard('edit', product, {}, 1); }
  else if (action === 'listing-menu') listingMenuModal(sellerProducts().find(p=>p.id===target.dataset.id));
  else if (action === 'listing-preview') listingPreviewModal(sellerProducts().find(p=>p.id===target.dataset.id));
  else if (action === 'listing-toggle-pause') { const product = sellerProducts().find(p=>p.id===target.dataset.id); if (!product) return; const resume = listingState(product) === 'Paused'; setListingStatus(product.id, resume ? 'Active' : 'Paused', resume ? 'Resumed by the shop in this demo.' : 'Paused by the shop — hidden from customers in this demo.'); toast(resume ? 'Listing is live again in this demo.' : 'Listing paused in this demo.'); }
  else if (action === 'listing-archive') { const product = sellerProducts().find(p=>p.id===target.dataset.id); if (!product) return; setListingStatus(product.id, 'Archived', 'Archived by the shop in this demo.'); toast('Listing archived. It stays in your catalogue history.'); }
  else if (action === 'listing-discard') { const products = sellerProducts(); const product = products.find(p=>p.id===target.dataset.id); if (!product) return; saveSellerData('products', products.filter(p=>p.id!==product.id)); closeSellerModal(); renderSeller(); toast('Draft discarded from this demo catalogue.'); }
  else if (action === 'listing-duplicate') duplicateListing(target.dataset.id);
  else if (action === 'listing-submit') {
    const product = sellerProducts().find(p=>p.id===target.dataset.id);
    if (!product) return;
    const checks = listingChecks({ ...product, images: product.images || [] });
    const missing = checks.filter(check => check.required && !check.ok);
    closeSellerModal();
    if (!missing.length) { setListingStatus(product.id, 'Under review', 'Submitted for a sample NearBuy catalogue check.'); toast('Listing submitted to the sample review queue.'); return; }
    startListingWizard('edit', product, {}, missing[0].step);
    if (listingWizard) { listingWizard.errors = missing.map(check => check.fix); renderListingWizard(); }
    toast(`${missing.length} detail${missing.length === 1 ? '' : 's'} need attention before submitting.`);
  }
  else if (action === 'listing-approve') { const product = sellerProducts().find(p=>p.id===target.dataset.id); if (!product) return; setListingStatus(product.id, 'Active', 'Approved in the sample catalogue review.'); toast('Listing approved and live in this demo.'); }
  else if (action === 'listing-request-changes') { const product = sellerProducts().find(p=>p.id===target.dataset.id); if (product) listingChangesModal(product); }
  else if (action === 'listing-fix') { const product = sellerProducts().find(p=>p.id===target.dataset.id); const step = Number(target.dataset.step) || 1; closeSellerModal(); if (product) startListingWizard('edit', product, {}, step); }
  else if (action === 'stock-product') { const p=sellerProducts().find(x=>x.id===target.dataset.id); if(p) editStockModal(p); }
  else if (action === 'adjust-stock') adjustStock(target.dataset.id,Number(target.dataset.delta));
  else if (action === 'set-stock') { const p=sellerProducts().find(x=>x.id===target.dataset.id); if(p) editStockModal(p); }
  else if (action === 'view-order') orderModal(sellerOrders().find(o=>o.id===target.dataset.id));
  else if (action === 'accept-order') updateOrder(target.dataset.id,'Preparing');
  else if (action === 'mark-ready') { const order=sellerOrders().find(o=>o.id===target.dataset.id); updateOrder(target.dataset.id,order?.method==='Store pickup'?'Ready for pickup':'Ready for Runner'); }
  else if (action === 'assign-runner' || action === 'track-runner') { window.open('/partner.html','_blank','noopener'); toast('Open the Runner demo to accept and update sample delivery tasks.'); }
  else if (action === 'request-runner') { if(target.dataset.id) createSellerRunnerRequest(target.dataset.id); else runnerRequestModal(); }
  else if (action === 'complete-own-delivery') { const deliveries=sellerOwnDeliveries().map(d=>d.id===target.dataset.id?{...d,status:'Completed',completedAt:new Date().toLocaleString('en-IN')}:d);saveSellerData('ownDeliveries',deliveries);renderSeller();toast('Own-staff delivery marked complete in demo only.'); }
  else if (action === 'complete-order') updateOrder(target.dataset.id,'Completed');
  else if (action === 'reject-order') updateOrder(target.dataset.id,'Cancelled');
  else if (action === 'order-filter') { orderFilter=target.dataset.filter; renderSeller(); }
  else if (action === 'bulk-import') openSellerModal(`<span class="eyebrow">CATALOGUE IMPORT</span><h2>Bring in a few products.</h2><p>One per line: product name, category, selling price, stock. The importer checks every row before adding it to this demo shop.</p><form id="bulkForm" class="modal-form"><label>Paste rows<textarea name="rows" required placeholder="Brown rice, Grocery, 120, 8\nGreen tea, Pantry, 160, 5"></textarea></label><button class="seller-btn primary">Check & import rows ↗</button></form>`);
  else if (action === 'bulk-stock') openSellerModal(`<span class="eyebrow">QUICK STOCK ADJUSTMENT</span><h2>Restock low items.</h2><p>Choose a product and enter its counted quantity.</p><form id="stockForm" class="modal-form"><label>Product<select name="id">${sellerProducts().map(p=>`<option value="${p.id}">${safe(p.name)}</option>`).join('')}</select></label><label>New count<input type="number" name="stock" min="0" required value="10"/></label><button class="seller-btn primary">Save count ↗</button></form>`);
  else if (action === 'create-promo') createPromoModal();
  else if (action === 'delete-promo') { saveSellerData('promotions',sellerPromos().filter(p=>p.id!==target.dataset.id)); renderSeller(); toast('Demo promotion removed.'); }
  else if (action === 'return-decision') { const records=sellerReturns(); saveSellerData('returns',records.map(r=>r.id===target.dataset.id?{...r,status:target.dataset.decision}:r)); renderSeller(); toast(`Return request marked ${target.dataset.decision.toLowerCase()}.`); }
  else if (action === 'shop-toggle') { const settings=sellerSettings(); settings[target.dataset.key]=!settings[target.dataset.key]; saveSellerData('settings',settings); renderSeller(); toast(`${target.dataset.key==='open'?'Shop status':target.dataset.key==='delivery'?'Runner delivery':target.dataset.key==='pickup'?'Pickup':'Auto-accept'} updated.`); }
  else if (action === 'security-toggle') { const settings=sellerSettings(); settings.security={...(settings.security||{twoStep:false,alerts:true}),[target.dataset.key]:!(settings.security||{twoStep:false,alerts:true})[target.dataset.key]}; saveSellerData('settings',settings); renderSeller(); toast('Demo security preference saved in this browser.'); }
  else if (action === 'save-shop') { const settings=sellerSettings(); settings.radius=document.getElementById('shopRadius')?.value||settings.radius; settings.prep=document.getElementById('shopPrep')?.value||settings.prep; saveSellerData('settings',settings); toast('Shop service settings saved in this browser.'); }
  else if (action === 'verification-info') openSellerModal(`<span class="eyebrow">SELLER ONBOARDING · DEMO ONLY</span><h2>Getting a shop ready.</h2><p>A real NearBuy onboarding process would collect and securely review the shop owner’s identity, business details, shop address, operating hours, bank or payout information, tax information where applicable, and consent to seller terms.</p><div class="demo-notice seller-demo-notice">This browser demo does not collect documents, verify identity, validate a shop address or connect a payout account. No verification is represented as completed.</div>`);
  else if (action === 'edit-shop' || action === 'edit-hours') openSellerModal(`<span class="eyebrow">SHOP PROFILE</span><h2>Shop profile details</h2><p>This sample profile is currently read-only. Contact NearBuy support to change verified shop identity details.</p><div class="setting-row"><div><b>Green Basket Market</b><small>B-12, Hauz Khas Market · South Delhi</small></div>${pill('Demo only')}</div><div class="setting-row"><div><b>Opening hours</b><small>Mon–Sat · 8:00 am – 9:00 pm</small></div><span>Sample</span></div><button class="seller-btn primary" data-action="modal-close">Got it</button>`);
  else if (action === 'preview-shop') { window.open('/#shop/greenbasket','_blank','noopener'); }
  else if (action === 'export-report') exportCsv('nearbuy-sales-demo.csv',[['Date','Sales','Orders'],['Today',8460,21],['Yesterday',7920,18],['This week',42680,103]]);
  else if (action === 'export-orders') exportCsv('nearbuy-orders-demo.csv',[['Order ID','Customer','Status','Fulfilment','Total'],...sellerOrders().map(o=>[o.id,o.customer,o.status,o.method,o.total])]);
  else if (action === 'export-products' || action === 'download-products') downloadProducts();
  else if (action === 'export-payments') exportCsv('nearbuy-settlements-demo.csv',[['Settlement','Period','Gross','Adjustments','Net','Status'],['ST-2025-0611','3–9 Jun',18460,-1204,17256,'Completed'],['ST-2025-0604','27 May–2 Jun',14820,-968,13852,'Completed']]);
  else if (action === 'stock-audit') openSellerModal(`<span class="eyebrow">STOCK CHECK</span><h2>Quick stock audit</h2><p>Compare the digital count with the shelf. Make a correction in Inventory & Stock.</p><div class="activity-list">${sellerProducts().filter(p=>p.stock<=p.lowAt).map(p=>`<div class="activity-item"><span class="prod-thumb">${p.emoji}</span><div><b>${safe(p.name)}</b><small>${p.stock} available · restock reminder at ${p.lowAt}</small></div><button class="table-action" data-action="modal-stock" data-id="${p.id}">Update</button></div>`).join('')}</div>`);
  else if (action === 'modal-stock') { const p=sellerProducts().find(x=>x.id===target.dataset.id); closeSellerModal(); if(p) editStockModal(p); }
  else if (action === 'settlement-info') openSellerModal(`<span class="eyebrow">A CLEAR SELLER LEDGER</span><h2>How settlements should work.</h2><p>A production settlement should show order totals, refunds, applicable platform fees, taxes, adjustments and the net payout. Actual fees and payout timing depend on NearBuy’s signed seller terms and payment setup.</p><div class="demo-notice seller-demo-notice">The values in this Seller Hub are illustrative sample data. No payout is scheduled or initiated.</div>`);
  else if (action === 'runner-help') { window.open('/partner.html','_blank','noopener'); }
  else if (action === 'partner-demo') { window.open('/partner.html','_blank','noopener'); }
  else if (action === 'invite-team') openSellerModal(`<span class="eyebrow">TEAM ACCESS</span><h2>Invite a teammate.</h2><p>This form adds a sample row to the local team list. It does not send an invitation.</p><form id="teamForm" class="modal-form"><label>Teammate name<input name="name" required/></label><label>Email<input name="email" type="email" required/></label><label>Role<select name="role"><option>Order operator</option><option>Inventory manager</option><option>Shop manager</option></select></label><button class="seller-btn primary">Add demo teammate ↗</button></form>`);
  else if (action === 'academy-lesson') openSellerModal(`<span class="eyebrow">NEARBUY ACADEMY · DEMO</span><h2>A useful skill, one step at a time.</h2><p>This lesson preview explains how Seller Hub can guide local shopkeepers. Training content is a placeholder in this prototype.</p><button class="seller-btn primary" data-action="modal-close">Done</button>`);
  else if (action === 'mark-notifications') { const list=sellerData('notifications',[{id:'a',unread:true},{id:'b',unread:true},{id:'c',unread:false}]).map(n=>({...n,unread:false})); saveSellerData('notifications',list); renderSeller(); toast('You’re all caught up.'); }
  else if (action === 'profile-menu') openSellerModal(`<span class="eyebrow">SIGNED IN AS</span><h2>${safe(sellerUser.name)}</h2><p>${safe(sellerUser.email)} · ${safe(sellerUser.role)}</p><div class="confirm-row"><button class="seller-btn" data-action="switch-demo">Switch demo account</button><button class="seller-btn primary" data-action="logout-seller">Sign out</button></div>`);
  else if (action === 'switch-demo') { closeSellerModal(); sellerStorage.set('session',null); sellerUser=null; showLogin(); sellerApp.hidden=true; }
  else if (action === 'logout-seller') { closeSellerModal(); sellerStorage.set('session',null); sellerUser=null; showLogin(); sellerApp.hidden=true; }
});

document.addEventListener('submit', event => {
  const form=event.target; const data=new FormData(form);
  if(form.id==='sellerLoginForm'){event.preventDefault();sellerLogin(data.get('email'),data.get('password'));}
  else if(form.id==='productForm'){
    event.preventDefault();const products=sellerProducts();const id=data.get('id')||`NB-${Date.now().toString().slice(-6)}`;const current=products.find(p=>p.id===id);const product={...(current||{}),id,sku:current?.sku||`GB-${Date.now().toString().slice(-5)}`,name:data.get('name').trim(),category:data.get('category'),emoji:data.get('emoji')||'🛍️',price:Number(data.get('price')),mrp:Number(data.get('mrp')||data.get('price')),stock:Number(data.get('stock')),lowAt:Number(data.get('lowAt')||5),sold:current?.sold||0,status:Number(data.get('stock'))>0?'Active':'Out of stock'};saveSellerData('products',current?products.map(p=>p.id===id?product:p):[product,...products]);closeSellerModal();renderSeller();toast('Product saved to the demo catalogue.');
  }
  else if(form.id==='bulkForm'){
    event.preventDefault();const rows=data.get('rows').split(/\r?\n/).map(row=>row.split(',').map(x=>x.trim())).filter(row=>row.length>=4&&row[0]);const valid=rows.filter(row=>row[0]&&Number(row[2])>0&&Number(row[3])>=0);if(!valid.length){toast('No valid rows found. Use name, category, price, stock.');return;}const products=sellerProducts();valid.forEach((row,i)=>products.unshift({id:`NB-${Date.now().toString().slice(-5)}${i}`,sku:`BULK-${Date.now().toString().slice(-4)}${i}`,name:row[0],category:row[1]||'Grocery',subcategory:'',price:Number(row[2]),mrp:Number(row[2]),stock:Number(row[3]),lowAt:5,sold:0,emoji:'🛍️',status:Number(row[3])?'Active':'Out of stock',listingStatus:'Under review',reviewNote:'Bulk import — photos and details still need a catalogue check.',createdAt:new Date().toLocaleString('en-IN'),updatedAt:new Date().toLocaleString('en-IN'),history:[{status:'Under review',note:'Imported from a pasted spreadsheet.',at:new Date().toLocaleString('en-IN'),by:sellerUser.name}]}));saveSellerData('products',products);closeSellerModal();goView('products');toast(`${valid.length} demo product${valid.length===1?'':'s'} imported.`);
  }
  else if(form.id==='stockForm'){
    event.preventDefault();const products=sellerProducts();const id=data.get('id');const product=products.find(p=>p.id===id);if(!product)return;product.stock=Math.max(0,Number(data.get('stock')));product.status=product.stock?'Active':'Out of stock';saveSellerData('products',products);const movements=sellerData('movements',[]);movements.unshift({id,amount:product.stock,date:new Date().toLocaleString('en-IN'),by:sellerUser.name});saveSellerData('movements',movements.slice(0,50));closeSellerModal();renderSeller();toast('Stock count updated.');
  }
  else if(form.id==='promoForm'){
    event.preventDefault();const promos=sellerPromos();promos.unshift({id:`LP-${Date.now().toString().slice(-4)}`,title:data.get('title').trim(),code:data.get('code').toUpperCase(),type:data.get('type'),status:'Scheduled',uses:0,ends:data.get('ends')});saveSellerData('promotions',promos);closeSellerModal();renderSeller();toast('Demo offer saved. It is not visible to customers.');
  }
  else if(form.id==='runnerRequestForm'){
    event.preventDefault();if(data.get('choice')==='own')createSellerOwnDelivery(data.get('id'),data.get('note')||'');else createSellerRunnerRequest(data.get('id'),data.get('note')||'');
  }
  else if(form.id==='sellerSupportForm'){
    event.preventDefault();const tickets=sellerData('tickets',[]);tickets.unshift({id:`NBH-${Date.now().toString().slice(-6)}`,topic:data.get('topic'),message:data.get('message').trim(),date:new Date().toLocaleDateString('en-IN')});saveSellerData('tickets',tickets);renderSeller();toast('Demo support ticket saved in this browser.');
  }
  else if(form.id==='listingStepForm'){
    event.preventDefault();
    if(!listingWizard) return;
    const submitter = event.submitter;
    const intent = String(submitter?.value || form.dataset.intent || new FormData(form).get('intent') || 'next');
    delete form.dataset.intent;
    captureListingStep(form);
    if(intent==='next'){
      const issue = listingChecks({ ...listingWizard.data, images: listingWizard.images }).filter(check => check.step === listingWizard.step && check.required && !check.ok);
      if(issue.length){ listingWizard.errors = issue.map(check => check.fix); renderListingWizard(); return; }
      listingWizard.step = Math.min(LISTING_STEPS.length, listingWizard.step + 1); listingWizard.errors = []; renderListingWizard(); return;
    }
    saveListing(intent);
  }
  else if(form.id==='aiListingForm'){
    event.preventDefault();
    const prompt = String(data.get('prompt') || '').trim();
    if(!prompt) return;
    aiListingDraft = buildAiSuggestion(prompt, String(data.get('category') || 'Grocery'));
    aiSuggestionModal(aiListingDraft);
  }
  else if(form.id==='listingChangesForm'){
    event.preventDefault();
    const reason = String(data.get('reason') || 'Changes needed');
    const note = String(data.get('note') || '').trim();
    const id = String(data.get('id') || '');
    setListingStatus(id, 'Changes required', note ? `${reason} — ${note}` : reason);
    toast('Listing sent back for changes in this demo.');
  }
  else if(form.id==='teamForm'){
    event.preventDefault();const team=sellerData('team',[{name:'Riya Sharma',email:'owner@nearbuy.demo',role:'Owner',initials:'RS'},{name:'Aarav Mehta',email:'manager@nearbuy.demo',role:'Shop manager',initials:'AM'},{name:'Sana Khan',email:'inventory@nearbuy.demo',role:'Inventory manager',initials:'SK'}]);const name=data.get('name').trim();team.push({name,email:data.get('email').trim(),role:data.get('role'),initials:name.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase()});saveSellerData('team',team);closeSellerModal();renderSeller();toast('Demo teammate added. No invitation was sent.');
  }
});
document.addEventListener('input', event=>{
  if(event.target.id==='productSearch'){productQuery=event.target.value;filterProductTable();}
  if(event.target.id==='listingMasterSearch'){const results=document.getElementById('masterResults');if(results)results.innerHTML=masterResultsHtml(event.target.value);}
  if(event.target.id==='mrpInput'||event.target.id==='priceInput'){const preview=document.getElementById('pricePreview');if(preview)preview.innerHTML=listingPriceLine({mrp:document.getElementById('mrpInput')?.value,price:document.getElementById('priceInput')?.value});}
  if(event.target.id==='orderSearch'){const query=event.target.value.toLowerCase();const filtered=sellerOrders().filter(o=>(orderFilter==='All orders'||o.status===orderFilter)&&`${o.id} ${o.customer} ${o.area}`.toLowerCase().includes(query));const list=document.getElementById('orderList');if(list)list.innerHTML=filtered.map(orderSummary).join('')||'<div class="seller-empty">No orders match this search.</div>';}
  if(event.target.id==='inventorySearch'){const query=event.target.value.toLowerCase();const rows=document.getElementById('inventoryRows');if(rows){rows.querySelectorAll('tr').forEach(row=>row.hidden=!row.textContent.toLowerCase().includes(query));}}
});
document.addEventListener('change',event=>{if(event.target.id==='productCategory'||event.target.id==='productState'||event.target.id==='listingState')filterProductTable();if(event.target.id==='listingCategory'&&listingWizard){captureListingStep(event.target.form);const subs=LISTING_CATEGORIES[listingWizard.data.category]||[];if(!subs.includes(listingWizard.data.subcategory))listingWizard.data.subcategory='';listingWizard.errors=[];renderListingWizard();return;}if(event.target.id==='listingImageInput'){handleListingImages(event.target.files);return;}if(event.target.id==='shopRadius'||event.target.id==='shopPrep'){const settings=sellerSettings();if(event.target.id==='shopRadius')settings.radius=event.target.value;else settings.prep=event.target.value;saveSellerData('settings',settings);}});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeSellerModal();});
window.addEventListener('storage',event=>{if(event.key==='nearbuy-delivery:tasks'&&sellerUser)renderSeller();});
document.getElementById('sellerNav').addEventListener('click',event=>{const item=event.target.closest('[data-view]');if(item)goView(item.dataset.view);});
document.getElementById('sidebarToggle').addEventListener('click',()=>document.getElementById('sellerSidebar').classList.toggle('open'));
document.getElementById('profileMenu').addEventListener('click',()=>{if(sellerUser)openSellerModal(`<span class="eyebrow">SIGNED IN AS</span><h2>${safe(sellerUser.name)}</h2><p>${safe(sellerUser.email)} · ${safe(sellerUser.role)}</p><div class="confirm-row"><button class="seller-btn" data-action="switch-demo">Switch demo account</button><button class="seller-btn primary" data-action="logout-seller">Sign out</button></div>`);});
renderSeller();
