const CATEGORIES = [
  { id: 'all', label: 'Shop all', icon: '✳' },
  { id: 'grocery', label: 'Groceries', icon: '◉' },
  { id: 'stationery', label: 'Books & stationery', icon: '▤' },
  { id: 'general', label: 'General store', icon: '⌂' },
  { id: 'home', label: 'Home & kitchen', icon: '⌑' },
  { id: 'personal', label: 'Personal care', icon: '✿' }
];
const SHOPS = [
  { id: 'greenbasket', name: 'Green Basket Market', cat: 'Grocery & daily essentials', area: 'Hauz Khas', distance: '0.4 km', rating: '4.9', time: '15–25 min', emoji: '🥬', color: 'sage', open: true, description: 'Fresh produce and everyday essentials, carefully picked from your neighbourhood.' },
  { id: 'paperlane', name: 'Paper Lane Books & More', cat: 'Books & stationery', area: 'Saket', distance: '0.8 km', rating: '4.8', time: '20–30 min', emoji: '📚', color: 'peach', open: true, description: 'A much-loved neighbourhood bookshop for school, work and curious minds.' },
  { id: 'cornercart', name: 'The Corner Cart', cat: 'General store', area: 'Malviya Nagar', distance: '0.6 km', rating: '4.7', time: '15–25 min', emoji: '🛍️', color: 'blue', open: true, description: 'All the little things you need, from a shop that knows your street.' },
  { id: 'dailyroot', name: 'Daily Roots', cat: 'Grocery & fresh produce', area: 'Greater Kailash', distance: '1.1 km', rating: '4.9', time: '25–35 min', emoji: '🍊', color: 'yellow', open: false, description: 'Seasonal produce, pantry favourites and a friendly hello every visit.' }
];
const PRODUCTS = [
  { id: 'p101', name: 'Farm fresh whole milk', detail: 'Full cream · 500 ml', price: 34, mrp: 38, cat: 'grocery', shop: 'greenbasket', emoji: '🥛', color: 'milk', badge: 'Bestseller', stock: 18 },
  { id: 'p102', name: 'Sunrise bananas', detail: 'Naturally sweet · 6 pcs', price: 42, mrp: 48, cat: 'grocery', shop: 'greenbasket', emoji: '🍌', color: 'banana', badge: 'Fresh today', stock: 24 },
  { id: 'p103', name: 'Sourdough country loaf', detail: 'Baked this morning · 400 g', price: 95, mrp: 110, cat: 'grocery', shop: 'greenbasket', emoji: '🍞', color: 'bread', badge: 'Local favourite', stock: 8 },
  { id: 'p104', name: 'Farm eggs', detail: 'Free range · pack of 6', price: 72, mrp: 78, cat: 'grocery', shop: 'greenbasket', emoji: '🥚', color: 'egg', badge: '', stock: 12 },
  { id: 'p105', name: 'Seasonal red apples', detail: 'Crisp & juicy · 4 pcs', price: 119, mrp: 140, cat: 'grocery', shop: 'greenbasket', emoji: '🍎', color: 'apple', badge: '−15%', stock: 10 },
  { id: 'p106', name: 'Everyday ruled notebook', detail: 'A5 · 180 pages', price: 55, mrp: 65, cat: 'stationery', shop: 'paperlane', emoji: '📓', color: 'notebook', badge: 'Back to school', stock: 30 },
  { id: 'p107', name: 'Colour pencils', detail: '12 bright colours', price: 85, mrp: 99, cat: 'stationery', shop: 'paperlane', emoji: '🖍️', color: 'pencils', badge: '', stock: 16 },
  { id: 'p108', name: 'The little book of big ideas', detail: 'Paperback · Ages 8+', price: 199, mrp: 250, cat: 'stationery', shop: 'paperlane', emoji: '📔', color: 'book', badge: 'Staff pick', stock: 6 },
  { id: 'p109', name: 'Black gel pens', detail: 'Smooth 0.5 mm · set of 5', price: 60, mrp: 75, cat: 'stationery', shop: 'paperlane', emoji: '🖊️', color: 'pens', badge: '', stock: 22 },
  { id: 'p110', name: 'Canvas tote bag', detail: 'Reusable · natural cotton', price: 149, mrp: 179, cat: 'general', shop: 'cornercart', emoji: '👜', color: 'tote', badge: 'Local pick', stock: 9 },
  { id: 'p111', name: 'Stainless steel bottle', detail: 'Keeps cool · 750 ml', price: 249, mrp: 299, cat: 'general', shop: 'cornercart', emoji: '🧴', color: 'bottle', badge: '', stock: 11 },
  { id: 'p112', name: 'Kitchen cotton towels', detail: 'Set of 2 · soft weave', price: 129, mrp: 160, cat: 'home', shop: 'cornercart', emoji: '🧺', color: 'towels', badge: '−19%', stock: 7 },
  { id: 'p113', name: 'Gentle aloe hand wash', detail: 'Refill pouch · 500 ml', price: 89, mrp: 105, cat: 'personal', shop: 'cornercart', emoji: '🫧', color: 'wash', badge: '', stock: 13 },
  { id: 'p114', name: 'Fresh spinach bunch', detail: 'Locally grown · 1 bunch', price: 28, mrp: 32, cat: 'grocery', shop: 'dailyroot', emoji: '🥬', color: 'spinach', badge: 'Fresh today', stock: 14 },
  { id: 'p115', name: 'Sweet oranges', detail: 'Juicy season pick · 1 kg', price: 88, mrp: 105, cat: 'grocery', shop: 'dailyroot', emoji: '🍊', color: 'orange', badge: '', stock: 12 }
];
const DEMO_USERS = [
  { id: 'riya', name: 'Riya Sharma', email: 'riya@nearbuy.demo', phone: '98765 43210', password: 'NearBuy123!', area: 'Hauz Khas', initials: 'RS' },
  { id: 'aarav', name: 'Aarav Mehta', email: 'aarav@nearbuy.demo', phone: '98765 43211', password: 'NearBuy123!', area: 'Saket', initials: 'AM' },
  { id: 'sana', name: 'Sana Khan', email: 'sana@nearbuy.demo', phone: '98765 43212', password: 'NearBuy123!', area: 'Greater Kailash', initials: 'SK' }
];
const seedOrders = {
  riya: [{ id: 'NB-250610-1842', date: '10 Jun 2025', status: 'Out for delivery', method: 'Delivery', total: 165, shop: 'Green Basket Market', items: [{ name: 'Farm fresh whole milk', qty: 2, price: 34 }, { name: 'Sunrise bananas', qty: 1, price: 42 }, { name: 'Sourdough country loaf', qty: 1, price: 95 }], address: 'B-14, Hauz Khas, New Delhi' }],
  aarav: [{ id: 'NB-250608-0931', date: '8 Jun 2025', status: 'Ready for pickup', method: 'Pickup', total: 140, shop: 'Paper Lane Books & More', items: [{ name: 'Everyday ruled notebook', qty: 1, price: 55 }, { name: 'Black gel pens', qty: 1, price: 60 }], address: 'Collect at Paper Lane Books & More' }],
  sana: [{ id: 'NB-250605-7716', date: '5 Jun 2025', status: 'Delivered', method: 'Delivery', total: 161, shop: 'The Corner Cart', items: [{ name: 'Kitchen cotton towels', qty: 1, price: 129 }], address: 'A-7, Greater Kailash, New Delhi' }]
};

const storage = {
  get(key, fallback) { try { const value = localStorage.getItem(`nearbuy:${key}`); return value ? JSON.parse(value) : fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(`nearbuy:${key}`, JSON.stringify(value)); } catch { /* browsing still works without storage */ } }
};
let currentUser = storage.get('user', null);
let cart = storage.get('cart', []);
let wishlist = storage.get('wishlist', []);
let locationName = storage.get('location', 'South Delhi');
let coupon = storage.get('coupon', '');
let pendingCheckout = false;
let activeCategory = 'all';
let activeQuery = '';
let toastTimer;
const app = document.getElementById('app');
const modalRoot = document.getElementById('modalRoot');

function money(value) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value); }
function esc(value = '') { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
function persist() { storage.set('user', currentUser); storage.set('cart', cart); storage.set('wishlist', wishlist); storage.set('location', locationName); storage.set('coupon', coupon); }
function shopFor(id) { return SHOPS.find(shop => shop.id === id) || SHOPS[0]; }
function productFor(id) { return PRODUCTS.find(product => product.id === id); }
function routePath() { return decodeURIComponent(location.hash.replace(/^#\/?/, '') || 'home'); }
function go(route) { location.hash = route === 'home' ? '#home' : `#${route}`; }
function notice(text) { const el = document.getElementById('toast'); el.textContent = text; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2700); }
function updateHeader() {
  document.getElementById('announceArea').textContent = locationName;
  document.getElementById('headerArea').textContent = locationName;
  document.getElementById('accountLabel').textContent = currentUser ? currentUser.name.split(' ')[0] : 'Account';
  document.getElementById('cartCount').textContent = cart.reduce((sum, item) => sum + item.qty, 0);
  document.getElementById('wishCount').textContent = wishlist.length;
  const notificationCount = currentUser ? userData('notifications', []).filter(item => item.unread).length : 0;
  document.getElementById('notificationCount').textContent = notificationCount;
  document.getElementById('categoryNav').innerHTML = CATEGORIES.map(item => `<button class="category-nav-item${activeCategory === item.id ? ' active' : ''}" data-route="${item.id === 'all' ? 'explore' : `category/${item.id}`}"><span>${item.icon}</span>${item.label}</button>`).join('');
}
function pageHeader(kicker, title, description = '') { return `<div class="page-heading"><div><span class="eyebrow">${kicker}</span><h1>${title}</h1>${description ? `<p>${description}</p>` : ''}</div></div>`; }
function productCard(product) {
  const shop = shopFor(product.shop);
  return `<article class="product-card"><button class="product-visual ${product.color}" data-route="product/${product.id}" aria-label="View ${esc(product.name)}"><span class="product-emoji">${product.emoji}</span>${product.badge ? `<span class="product-badge">${esc(product.badge)}</span>` : ''}</button><button class="heart-button${wishlist.includes(product.id) ? ' saved' : ''}" data-action="wishlist-toggle" data-id="${product.id}" aria-label="${wishlist.includes(product.id) ? 'Remove from' : 'Add to'} saved items">${wishlist.includes(product.id) ? '♥' : '♡'}</button><div class="product-info"><button class="product-name" data-route="product/${product.id}">${esc(product.name)}</button><span class="product-detail">${esc(product.detail)}</span><button class="product-shop" data-route="shop/${shop.id}"><span>⌖</span>${esc(shop.name)}</button><div class="product-price-row"><div><strong>${money(product.price)}</strong>${product.mrp > product.price ? `<del>${money(product.mrp)}</del>` : ''}</div><button class="add-button" data-action="add" data-id="${product.id}" aria-label="Add ${esc(product.name)} to cart">+</button></div><span class="product-fulfil">Pickup · Local delivery</span></div></article>`;
}
function productGrid(items, extra = '') {
  if (!items.length) return `<div class="empty-state"><span>⌕</span><h3>Nothing nearby just yet</h3><p>Try another search or explore all the neighbourhood favourites.</p><button class="button button-dark" data-route="explore">Explore all products</button></div>`;
  return `<div class="product-grid ${extra}">${items.map(productCard).join('')}</div>`;
}
function shopCard(shop) {
  return `<article class="shop-card"><button class="shop-cover ${shop.color}" data-route="shop/${shop.id}"><span class="shop-emoji">${shop.emoji}</span><span class="shop-open ${shop.open ? '' : 'closed'}">${shop.open ? '● Open now' : 'Opens tomorrow'}</span><span class="shop-art-orbit"></span></button><div class="shop-card-content"><div class="shop-heading"><div><button class="shop-name" data-route="shop/${shop.id}">${esc(shop.name)}</button><span class="shop-category">${esc(shop.cat)}</span></div><span class="shop-rating">★ ${shop.rating}</span></div><div class="shop-meta"><span>⌖ ${shop.area} · ${shop.distance}</span><span>◷ ${shop.time}</span></div><p>${esc(shop.description)}</p><div class="shop-card-bottom"><span class="fulfil-badge">Pickup</span><span class="fulfil-badge">Local delivery</span><button data-route="shop/${shop.id}">View shop <b>↗</b></button></div></div></article>`;
}
function sectionTitle(kicker, title, action = '', route = '') { return `<div class="section-title"><div><span class="eyebrow">${kicker}</span><h2>${title}</h2></div>${action ? `<button class="inline-link" data-route="${route}">${action} <b>↗</b></button>` : ''}</div>`; }
function homePage() {
  const firstProducts = PRODUCTS.filter(product => ['p101', 'p102', 'p106', 'p110', 'p103', 'p107'].includes(product.id));
  return `<div class="home-wrap">
    <section class="hero-market"><div class="hero-copy"><span class="hero-kicker"><i></i> YOUR NEIGHBOURHOOD, JUST A CLICK AWAY</span><h1>One neighbourhood.<br/><em>Hundreds</em> of local shops.</h1><p>Find the everyday things you need from the shops you already love — and the ones you’re about to.</p><div class="hero-cta-row"><button class="button button-orange" data-route="explore">Explore nearby <span>↗</span></button><button class="hero-secondary" data-route="shops"><span class="round-play">⌖</span> Meet your local shops</button></div><div class="hero-availability"><span class="mini-avatars"><i>R</i><i>A</i><i>S</i></span><span><b>Good things, closer.</b><small>Pickup or local delivery · You choose</small></span></div></div><div class="hero-scene"><div class="scene-halo"></div><div class="scene-label"><i></i> THE LOCAL LOOP <span>${esc(locationName)}</span></div><div class="scene-map"><div class="map-park park-a"></div><div class="map-park park-b"></div><div class="map-road road-a"></div><div class="map-road road-b"></div><div class="map-road road-c"></div><div class="isometric-shop shop-a"><i class="roof"></i><i class="awning"></i><i class="storebody"><b></b><b></b></i></div><div class="isometric-shop shop-b"><i class="roof"></i><i class="awning"></i><i class="storebody"><b></b><b></b></i></div><div class="tree-dot tree-a">✿</div><div class="tree-dot tree-b">✿</div><div class="tree-dot tree-c">✿</div><span class="map-marker">⌂</span><span class="scene-route"></span><div class="scene-runner"><span>NB</span>◉</div></div><div class="scene-note note-shop"><span>⌂</span><div><b>Shop around the corner</b><small>Real stores. Local people.</small></div></div><div class="scene-note note-delivery"><span>↗</span><div><b>Your order, on its way</b><small>Delivered close to home</small></div></div><span class="scene-caption">Small radius. <b>Big local energy.</b></span></div></section>
    <section class="trust-ribbon"><div><span>✳</span><b>Real neighbourhood shops</b><small>Not a faceless warehouse</small></div><i></i><div><span>⌖</span><b>Close by, by design</b><small>Discover what’s around you</small></div><i></i><div><span>↗</span><b>Pickup or local delivery</b><small>Your order, your way</small></div><i></i><div><span>♡</span><b>Good for your community</b><small>Keep local thriving</small></div></section>
    <section class="section-block category-block">${sectionTitle('A LITTLE BIT OF EVERYTHING', 'What are you looking for?')}<div class="category-tiles">${CATEGORIES.filter(item => item.id !== 'all').map((item, index) => `<button class="category-tile cat-tile-${index}" data-route="category/${item.id}"><span class="category-illustration">${item.icon}</span><b>${item.label}</b><small>${categoryCount(item.id)} finds nearby</small><i>↗</i></button>`).join('')}</div></section>
    <section class="section-block">${sectionTitle('GOOD FINDS, RIGHT AROUND YOU', 'Popular near you', 'See all products', 'explore')}${productGrid(firstProducts)}</section>
    <section class="section-block"><div class="section-title"><div><span class="eyebrow">PICKED FRESH FROM NEARBY</span><h2>Daily essentials</h2></div><button class="inline-link" data-route="category/grocery">Shop groceries <b>↗</b></button></div>${productGrid(PRODUCTS.filter(item => item.cat === 'grocery').slice(0, 4))}</section>
    <section class="section-block"><div class="section-title"><div><span class="eyebrow">A LITTLE INSPIRATION FOR YOUR DESK</span><h2>Stationery corner</h2></div><button class="inline-link" data-route="category/stationery">Books & stationery <b>↗</b></button></div>${productGrid(PRODUCTS.filter(item => item.cat === 'stationery').slice(0, 4))}</section>
    <section class="section-block"><div class="section-title"><div><span class="eyebrow">LOCAL FINDS, NICE PRICES</span><h2>Neighbourhood offers</h2></div><button class="inline-link" data-route="explore">Explore all deals <b>↗</b></button></div>${productGrid(PRODUCTS.filter(item => item.mrp > item.price).slice(0, 4))}</section>
    <section class="local-feature"><div class="feature-copy"><span class="eyebrow">NOT JUST A SHOPPING APP</span><h2>Know the shop.<br/><em>Love the find.</em></h2><p>Every product comes from a real store in your neighbourhood. See who’s selling, how far they are, and choose how your order gets to you.</p><button class="inline-link" data-route="shops">Get to know your local shops <b>↗</b></button></div><div class="feature-shop-grid">${SHOPS.slice(0, 3).map((shop, index) => `<button class="mini-shop-card mini-shop-${index}" data-route="shop/${shop.id}"><span class="mini-shop-art ${shop.color}">${shop.emoji}</span><span><b>${esc(shop.name)}</b><small>${shop.distance} away · ${shop.cat.split('&')[0]}</small></span><i>↗</i></button>`).join('')}<div class="feature-stamp"><span>LOCAL</span><b>IS A<br/>FEELING</b><i>✳</i></div></div></section>
    <section class="section-block shop-section">${sectionTitle('THE PEOPLE BEHIND THE GOOD STUFF', 'Shops around your corner', 'Meet all local shops', 'shops')}<div class="shop-grid">${SHOPS.slice(0, 3).map(shopCard).join('')}</div></section>
    <section class="pickup-strip"><div class="pickup-icon">⌖</div><div><span>YOUR ORDER, YOUR WAY</span><b>Get it delivered, or pop by and pick it up.</b><small>Pickup is always free. Local delivery availability depends on your area.</small></div><button data-route="shops">Find a nearby shop <b>↗</b></button></section>
    <section class="closing-card"><div class="closing-doodle">✳</div><span class="eyebrow">GOOD THINGS ARE CLOSER</span><h2>Your corner of the world<br/>is <em>waiting.</em></h2><button class="button button-light" data-route="explore">Start exploring <span>↗</span></button><div class="closing-orbit"></div></section>
  </div>`;
}
function categoryCount(id) { return PRODUCTS.filter(product => product.cat === id).length; }
function filteredProducts(query = '', category = 'all') {
  const normalized = query.trim().toLowerCase();
  return PRODUCTS.filter(product => {
    const shop = shopFor(product.shop);
    const inCategory = category === 'all' || product.cat === category;
    const matches = !normalized || `${product.name} ${product.detail} ${shop.name} ${shop.cat} ${product.cat} ${product.id}`.toLowerCase().includes(normalized);
    return inCategory && matches;
  });
}
function applyProductFilters() {
  const path = routePath().split('/');
  const category = path[0] === 'category' ? path[1] : 'all';
  const query = path[0] === 'search' ? path.slice(1).join('/') : '';
  let items = filteredProducts(query, category);
  const shop = document.getElementById('productShopFilter')?.value || 'all';
  if (shop !== 'all') items = items.filter(item => item.shop === shop);
  const sort = document.getElementById('productSort')?.value;
  if (sort === 'price-low') items.sort((a, b) => a.price - b.price);
  if (sort === 'price-high') items.sort((a, b) => b.price - a.price);
  if (sort === 'name') items.sort((a, b) => a.name.localeCompare(b.name));
  const grid = document.getElementById('listingGrid');
  if (grid) grid.innerHTML = productGrid(items);
  const count = document.getElementById('filterCount'); if (count) count.textContent = `${items.length} finds`;
  const summary = document.querySelector('.results-meta span'); if (summary) summary.textContent = `${items.length} local finds`;
}
function listingPage(title, kicker, products, description = '', tools = '') {
  const shopChoices = SHOPS.map(shop => `<option value="${shop.id}">${esc(shop.name)}</option>`).join('');
  const filters = tools || `<div class="product-toolbar"><label>Shop <select id="productShopFilter"><option value="all">All local shops</option>${shopChoices}</select></label><label>Sort <select id="productSort"><option value="recommended">Recommended</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="name">Name</option></select></label><span id="filterCount">${products.length} finds</span></div>`;
  return `<div class="content-shell">${pageHeader(kicker, title, description)}${filters}<div class="results-meta"><span>${products.length} local finds</span><button data-action="location">⌖ ${esc(locationName)} <b>⌄</b></button></div><div id="listingGrid">${productGrid(products)}</div></div>`;
}
function shopsPage() {
  return `<div class="content-shell">${pageHeader('REAL SHOPS. RIGHT AROUND YOU.', 'Your neighbourhood shops', `Discover independent stores close to ${esc(locationName)} — with pickup and local delivery.`)}<div class="shop-toolbar"><div class="filter-chips"><button class="filter-chip selected" data-shop-filter="all">All shops <span>${SHOPS.length}</span></button><button class="filter-chip" data-shop-filter="open">Open now</button><button class="filter-chip" data-shop-filter="delivery">Delivery available</button></div><label class="sort-label">Sort by <select id="shopSort"><option value="near">Nearest</option><option value="rating">Top rated</option><option value="name">Name</option></select></label></div><div class="shop-grid shop-listing" id="shopListing">${SHOPS.map(shopCard).join('')}</div></div>`;
}
function shopPage(id) {
  const shop = SHOPS.find(item => item.id === id);
  if (!shop) return notFound();
  const items = PRODUCTS.filter(product => product.shop === shop.id);
  const isFollowed = currentUser && userData('followedShops', []).includes(shop.id);
  return `<div class="content-shell shop-detail-page"><div class="breadcrumbs"><button data-route="home">Home</button><span>›</span><button data-route="shops">Local shops</button><span>›</span><b>${esc(shop.name)}</b></div><section class="shop-hero-card"><div class="shop-hero-visual ${shop.color}"><span>${shop.emoji}</span><i class="shop-hero-orbit"></i></div><div class="shop-hero-copy"><span class="shop-open ${shop.open ? '' : 'closed'}">${shop.open ? '● Open now' : 'Opens tomorrow'}</span><span class="eyebrow">${esc(shop.cat.toUpperCase())}</span><h1>${esc(shop.name)}</h1><p>${esc(shop.description)}</p><div class="shop-detail-meta"><span>★ <b>${shop.rating}</b> neighbourhood rating</span><span>⌖ ${shop.area}, ${shop.distance} away</span><span>◷ ${shop.time}</span></div><div class="shop-detail-actions"><button class="button button-orange" data-action="scroll-products">Browse products <span>↓</span></button><button class="button button-outline" data-action="follow-shop" data-id="${shop.id}">${isFollowed ? '♥ Following' : '♡ Follow shop'}</button><button class="button button-outline" data-action="share-shop" data-id="${shop.id}">Share ↗</button></div></div></section><div class="shop-info-strip"><span>⌖ ${shop.area}, South Delhi</span><span>◷ Open today · 9:00 am – 9:00 pm</span><span>♧ Pickup available</span><span>↗ Local delivery available</span></div><section class="shop-products" id="shopProducts">${sectionTitle('FROM THIS LOCAL SHOP', `${items.length} good finds`)}${productGrid(items)}</section></div>`;
}
function productPage(id) {
  const product = productFor(id);
  if (!product) return notFound();
  const shop = shopFor(product.shop);
  const productReviews = currentUser ? userData('reviews', []).filter(review => review.product === product.name) : [];
  return `<div class="content-shell product-detail-page"><div class="breadcrumbs"><button data-route="home">Home</button><span>›</span><button data-route="category/${product.cat}">${CATEGORIES.find(c => c.id === product.cat)?.label || 'Explore'}</button><span>›</span><b>${esc(product.name)}</b></div><div class="product-detail-layout"><div class="product-detail-art ${product.color}"><span>${product.emoji}</span>${product.badge ? `<small>${esc(product.badge)}</small>` : ''}<i class="detail-art-shape"></i></div><div class="product-detail-info"><span class="eyebrow">A NEARBY FIND · ${product.id.toUpperCase()}</span><h1>${esc(product.name)}</h1><p class="detail-subtitle">${esc(product.detail)}</p><div class="detail-price"><strong>${money(product.price)}</strong>${product.mrp > product.price ? `<del>${money(product.mrp)}</del><span>SAVE ${Math.round((1 - product.price / product.mrp) * 100)}%</span>` : ''}</div><div class="tax-note">Inclusive of applicable taxes · Final price shown at checkout</div><button class="seller-line" data-route="shop/${shop.id}"><span class="seller-avatar ${shop.color}">${shop.emoji}</span><span><small>SOLD BY</small><b>${esc(shop.name)}</b><i>★ ${shop.rating} · ${shop.distance} away</i></span><b>↗</b></button><div class="availability-box"><span class="available-dot"></span><div><b>Available around ${esc(locationName)}</b><small>Choose pickup or local delivery at checkout</small></div><button data-action="location">Change</button></div><div class="detail-actions"><div class="qty-control"><button data-action="qty-detail" data-delta="-1" aria-label="Decrease quantity">−</button><span id="detailQty">1</span><button data-action="qty-detail" data-delta="1" aria-label="Increase quantity">+</button></div><button class="button button-orange add-detail" data-action="add" data-id="${product.id}">Add to cart <span>+</span></button><button class="detail-heart${wishlist.includes(product.id) ? ' saved' : ''}" data-action="wishlist-toggle" data-id="${product.id}" aria-label="Save product">${wishlist.includes(product.id) ? '♥' : '♡'}</button></div><div class="product-service-points"><span>✓ Local shop, verified by NearBuy</span><span>✓ Free pickup from the store</span><span>✓ Order updates every step of the way</span></div></div></div>${productReviews.length ? `<section class="product-reviews"><h2>Neighbour notes</h2>${productReviews.map(review => `<article><span>${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</span><p>${esc(review.comment)}</p><small>${esc(review.date)} · Private demo review</small></article>`).join('')}</section>` : ''}<section class="related-section">${sectionTitle('MORE GOOD THINGS', 'From this neighbourhood')}${productGrid(PRODUCTS.filter(item => item.shop === product.shop && item.id !== product.id).slice(0, 4))}</section></div>`;
}
function cartTotals() {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const discount = coupon === 'LOCAL10' ? Math.floor(subtotal * 0.1) : 0;
  const delivery = subtotal >= 399 ? 0 : 25;
  return { subtotal, discount, delivery, total: subtotal - discount + delivery };
}
function cartPage() {
  if (!cart.length) return `<div class="content-shell">${pageHeader('YOUR LITTLE SHOPPING BAG', 'Your cart')}<div class="empty-cart"><span class="empty-cart-icon">▱</span><h2>Your cart is ready for a good find.</h2><p>Take a look around your neighbourhood. Your next favourite thing is close.</p><button class="button button-orange" data-route="explore">Explore nearby <span>↗</span></button><button class="empty-shop-link" data-route="shops">Or browse local shops</button></div></div>`;
  const shop = shopFor(cart[0].shop);
  const totals = cartTotals();
  return `<div class="content-shell">${pageHeader('A LITTLE SOMETHING FROM NEARBY', 'Your cart', 'One neighbourhood shop per order for this demo checkout.') }<div class="cart-layout"><div class="cart-main"><div class="cart-shop-header"><span class="shop-mini-avatar ${shop.color}">${shop.emoji}</span><span><small>YOUR ORDER FROM</small><b>${esc(shop.name)}</b></span><button data-route="shop/${shop.id}">View shop ↗</button></div>${cart.map(item => { const product = productFor(item.id); return `<div class="cart-item"><button class="cart-product-art ${product.color}" data-route="product/${product.id}">${product.emoji}</button><div class="cart-item-info"><button data-route="product/${product.id}">${esc(product.name)}</button><small>${esc(product.detail)}</small><span>${money(product.price)} each</span></div><div class="cart-quantity"><button data-action="cart-qty" data-id="${item.id}" data-delta="-1">−</button><b>${item.qty}</b><button data-action="cart-qty" data-id="${item.id}" data-delta="1">+</button></div><strong class="cart-line-price">${money(item.price * item.qty)}</strong><button class="remove-item" data-action="remove-cart" data-id="${item.id}" aria-label="Remove item">×</button></div>`; }).join('')}<button class="continue-shopping" data-route="explore">← Keep looking around</button></div><aside class="cart-summary"><h3>Order summary</h3><div class="summary-line"><span>Subtotal</span><b>${money(totals.subtotal)}</b></div>${totals.discount ? `<div class="summary-line discount-line"><span>Neighbourhood offer</span><b>−${money(totals.discount)}</b></div>` : ''}<div class="summary-line"><span>Local delivery</span><b>${totals.delivery ? money(totals.delivery) : 'FREE'}</b></div><div class="coupon-form"><label for="couponInput">Have a neighbourhood code?</label><div><input id="couponInput" placeholder="Enter code" value="${coupon}" /><button data-action="apply-coupon">Apply</button></div><small>Try <b>LOCAL10</b> for 10% off this demo order.</small></div><div class="summary-total"><span>Total</span><strong>${money(totals.total)}</strong></div><button class="button button-orange checkout-button" data-action="checkout">Continue to checkout <span>↗</span></button><p class="demo-payment-note">Demo checkout · No real payment is taken</p><div class="secure-note">⌑ Secure checkout · Local support</div></aside></div></div>`;
}
function checkoutPage() {
  if (!cart.length) { go('cart'); return ''; }
  const user = currentUser;
  const savedAddresses = userData('addresses', defaultAddresses());
  const defaultAddress = savedAddresses.find(address => address.isDefault) || savedAddresses[0];
  const shop = shopFor(cart[0].shop);
  const totals = cartTotals();
  return `<div class="content-shell checkout-page">${pageHeader('JUST A FEW LITTLE DETAILS', 'Checkout', 'You’re almost there. Your order is coming from one local shop.') }<div class="checkout-layout"><form id="checkoutForm" class="checkout-form"><section class="checkout-panel"><div class="checkout-step"><i>1</i><div><h2>Who’s receiving this?</h2><p>We’ll send order updates to these details.</p></div>${user ? `<span class="verified-label">✓ Signed in as ${esc(user.name)}</span>` : ''}</div><div class="form-grid"><label>Full name<input name="name" required value="${esc(user?.name || '')}" placeholder="Your name" /></label><label>Mobile number<input name="phone" required minlength="8" value="${esc(user?.phone || '')}" placeholder="10-digit mobile number" /></label></div></section><section class="checkout-panel"><div class="checkout-step"><i>2</i><div><h2>How would you like it?</h2><p>Choose delivery to your door or free pickup.</p></div></div><div class="fulfil-options"><label class="fulfil-option selected"><input type="radio" name="fulfilment" value="Delivery" checked /><span class="fulfil-icon">↗</span><span><b>Local delivery</b><small>From ${esc(shop.name)} · Usually ${shop.time}</small></span><strong>${totals.delivery ? money(totals.delivery) : 'FREE'}</strong></label><label class="fulfil-option"><input type="radio" name="fulfilment" value="Pickup" /><span class="fulfil-icon">⌖</span><span><b>Pick up at the shop</b><small>${esc(shop.area)} · Free, when they’re ready</small></span><strong>FREE</strong></label></div>${savedAddresses.length ? `<label class="saved-address-select">Use a saved address<select id="checkoutSavedAddress">${savedAddresses.map(address => `<option value="${esc(address.id)}"${address.isDefault ? ' selected' : ''}>${esc(address.label)}${address.isDefault ? ' · Default' : ''} — ${esc(address.address)}</option>`).join('')}</select></label>` : ''}<label class="address-label" id="addressField">Delivery address<textarea name="address" required placeholder="Flat / house, street, locality, landmark">${esc(defaultAddress?.address || '')}</textarea></label><button class="checkout-address-link" type="button" data-action="addresses">Manage saved addresses ↗</button></section><section class="checkout-panel"><div class="checkout-step"><i>3</i><div><h2>Payment method</h2><p>Payments are simulated in this demo.</p></div></div><div class="payment-options"><label><input type="radio" name="payment" value="UPI (demo)" checked /><span>◉</span> UPI <small>Demo</small></label><label><input type="radio" name="payment" value="Cash on delivery (demo)" /><span>▣</span> Cash on delivery <small>Demo</small></label></div></section><div class="demo-alert"><span>ⓘ</span><span><b>Demo mode</b> — Placing this order saves a sample order to your account. No payment is processed.</span></div><button class="button button-orange place-order-button" type="submit">Place demo order <span>↗</span></button></form><aside class="checkout-summary"><h3>Your order <span>${cart.reduce((n, x) => n + x.qty, 0)} items</span></h3><div class="checkout-shop"><span class="shop-mini-avatar ${shop.color}">${shop.emoji}</span><b>${esc(shop.name)}</b></div>${cart.map(item => `<div class="checkout-item"><span>${item.qty} × ${esc(productFor(item.id)?.name || 'Item')}</span><b>${money(item.price * item.qty)}</b></div>`).join('')}<div class="summary-line"><span>Subtotal</span><b>${money(totals.subtotal)}</b></div>${totals.discount ? `<div class="summary-line discount-line"><span>Offer</span><b>−${money(totals.discount)}</b></div>` : ''}<div class="summary-line"><span>Delivery</span><b id="checkoutDelivery">${money(totals.delivery)}</b></div><div class="summary-total"><span>Total</span><strong id="checkoutTotal">${money(totals.total)}</strong></div><p class="checkout-policy">By placing a demo order, you agree to the sample order flow. This prototype does not process real transactions.</p></aside></div></div>`;
}
function accountPage() {
  if (!currentUser) return loginPrompt('Your NearBuy account', 'Sign in to see orders, saved finds and account details.');
  const orders = storage.get(`orders:${currentUser.id}`, seedOrders[currentUser.id] || []);
  const savedAddressCount = userData('addresses', defaultAddresses()).length;
  return `<div class="content-shell account-page">${pageHeader('YOUR LOCAL SHOPPING, ALL IN ONE PLACE', `Hello, ${esc(currentUser.name.split(' ')[0])}.`, 'Here’s your little corner of NearBuy.') }<div class="account-layout"><aside class="account-side"><div class="profile-card"><span class="profile-avatar">${currentUser.initials || currentUser.name.split(' ').map(x => x[0]).join('').slice(0, 2)}</span><b>${esc(currentUser.name)}</b><small>${esc(currentUser.email)}</small><span class="demo-account-pill">DEMO CUSTOMER</span></div><button class="account-nav active" data-action="account">◉ Overview</button><button class="account-nav" data-action="orders">▤ My orders <i>${orders.length}</i></button><button class="account-nav" data-action="wishlist">♡ Saved items <i>${wishlist.length}</i></button><button class="account-nav" data-route="profile">♙ Profile</button><button class="account-nav" data-route="addresses">⌖ Addresses</button><button class="account-nav" data-route="payments">₹ Payments</button><button class="account-nav" data-route="notifications">◉ Notifications</button><button class="account-nav" data-route="returns">↩ Returns & refunds</button><button class="account-nav" data-route="followed">♡ Followed shops</button><button class="account-nav" data-route="reviews">★ My reviews</button><button class="account-nav" data-action="logout">↗ Sign out</button></aside><div class="account-main"><section class="account-welcome"><span class="eyebrow">YOUR NEIGHBOURHOOD, YOUR WAY</span><h2>Welcome back, ${esc(currentUser.name.split(' ')[0])}.</h2><p>There’s always something good close by.</p><button class="button button-orange" data-route="explore">Find your next good thing <span>↗</span></button><div class="welcome-doodle">✳</div></section><div class="account-stats"><button data-action="orders"><span>▤</span><b>${orders.length}</b><small>Orders</small></button><button data-action="wishlist"><span>♡</span><b>${wishlist.length}</b><small>Saved finds</small></button><button data-action="addresses"><span>⌖</span><b>${savedAddressCount}</b><small>Addresses</small></button></div><section class="account-orders">${sectionTitle('YOUR LATEST LOCAL FINDS', 'Recent orders', 'See all orders', 'orders')}${orders.length ? orders.slice(0, 2).map(orderCard).join('') : `<div class="empty-inline">No orders yet. Your first local find is waiting. <button data-route="explore">Explore products ↗</button></div>`}</section><div class="account-help"><span>Need a hand?</span><b>Our neighbourhood support is here for you.</b><button data-action="help">Visit the help centre ↗</button></div></div></div></div>`;
}
function orderCard(order) {
  const status = order.status || 'Placed';
  return `<article class="order-card"><div class="order-card-top"><div><small>ORDER ${esc(order.id)}</small><b>${esc(order.shop)}</b></div><span class="order-status ${status.toLowerCase().replaceAll(' ', '-')}">${esc(status)}</span></div><div class="order-items-preview">${order.items.map(item => `<span>${item.qty} × ${esc(item.name)}</span>`).join(' · ')}</div><div class="order-card-bottom"><span>${esc(order.date)} · ${esc(order.method)}</span><b>${money(order.total)}</b><button data-route="order/${encodeURIComponent(order.id)}">View order ↗</button>${order.status === 'Delivered' ? `<button data-action="review-start" data-id="${esc(order.id)}">Review</button>` : ''}</div></article>`;
}
function ordersPage() {
  if (!currentUser) return loginPrompt('Your orders', 'Sign in to see updates on pickup, local delivery and completed orders.');
  const orders = storage.get(`orders:${currentUser.id}`, seedOrders[currentUser.id] || []);
  return `<div class="content-shell">${pageHeader('EVERY LOCAL FIND, RIGHT HERE', 'Your orders', 'See what’s on its way, ready for pickup or already enjoyed.') }<div class="orders-toolbar"><button class="filter-chip selected">All orders <span>${orders.length}</span></button><button class="filter-chip" data-action="order-filter" data-filter="active">Active</button><button class="filter-chip" data-action="order-filter" data-filter="delivered">Delivered</button></div><div class="orders-list">${orders.length ? orders.map(orderCard).join('') : `<div class="empty-cart compact"><span class="empty-cart-icon">▤</span><h2>No orders yet</h2><p>When you find something lovely nearby, it’ll show up here.</p><button class="button button-orange" data-route="explore">Explore local finds ↗</button></div>`}</div></div>`;
}
function orderDetailPage(id) {
  if (!currentUser) return loginPrompt('Your order', 'Sign in to view order details.');
  const orders = storage.get(`orders:${currentUser.id}`, seedOrders[currentUser.id] || []);
  const order = orders.find(item => item.id === id);
  if (!order) return notFound();
  const delivered = order.status === 'Delivered';
  const steps = order.method === 'Pickup' ? ['Order placed', 'Shop preparing', 'Ready for pickup', 'Picked up'] : ['Order placed', 'Shop preparing', 'Runner assigned', 'Out for delivery', 'Delivered'];
  const activeIndex = Math.max(0, steps.indexOf(order.status));
  return `<div class="content-shell order-detail-page"><div class="breadcrumbs"><button data-action="orders">My orders</button><span>›</span><b>${esc(order.id)}</b></div>${pageHeader('ORDER PLACED · ' + esc(order.date).toUpperCase(), 'Good things are on their way.', `${esc(order.id)} · ${esc(order.method)} from ${esc(order.shop)}`)}<div class="tracking-card"><div class="tracking-head"><span class="order-status ${order.status.toLowerCase().replaceAll(' ', '-')}">${esc(order.status)}</span><span>${delivered ? 'All set — enjoy your local find!' : 'We’ll keep you posted as things move along.'}</span></div><div class="tracking-steps">${steps.map((step, i) => `<div class="tracking-step ${i < activeIndex ? 'complete' : ''} ${i === activeIndex ? 'current' : ''}"><i>${i < activeIndex ? '✓' : i + 1}</i><span>${step}</span></div>`).join('')}</div><div class="tracking-shop"><span class="shop-mini-avatar sage">⌖</span><div><small>${order.method === 'Pickup' ? 'PICKUP FROM' : 'FROM YOUR LOCAL SHOP'}</small><b>${esc(order.shop)}</b><span>${esc(order.address)}</span></div></div></div><div class="order-detail-items"><h2>In this order</h2>${order.items.map(item => `<div><span>${item.qty} × ${esc(item.name)}</span><b>${money(item.price * item.qty)}</b></div>`).join('')}<div class="order-detail-total"><span>Total paid (demo)</span><b>${money(order.total)}</b></div></div><div class="order-actions"><button class="button button-outline" data-action="help">Need help with this order?</button>${!delivered && order.status === 'Placed' ? `<button class="text-danger" data-action="cancel-order" data-id="${esc(order.id)}">Cancel order</button>` : ''}${delivered ? `<button class="button button-outline" data-action="return-start" data-id="${esc(order.id)}">Request return</button><button class="button button-outline" data-action="review-start" data-id="${esc(order.id)}">Review items</button>` : ''}<button class="inline-link" data-action="reorder" data-id="${esc(order.id)}">Order these items again ↗</button></div></div>`;
}
function wishlistPage() {
  const items = wishlist.map(productFor).filter(Boolean);
  return `<div class="content-shell">${pageHeader('THE LITTLE THINGS YOU LOVE', 'Your saved finds', 'Your wishlist is a bookmark for all the good things nearby.')}${items.length ? productGrid(items) : `<div class="empty-cart"><span class="empty-cart-icon">♡</span><h2>Nothing saved just yet.</h2><p>Tap the little heart on a product to keep it close for later.</p><button class="button button-orange" data-route="explore">Explore products <span>↗</span></button></div>`}</div>`;
}
function loginPrompt(title, text) { return `<div class="content-shell">${pageHeader('WELCOME BACK TO NEARBUY', title, text)}<div class="login-prompt"><span>♙</span><h2>Your local account is a few taps away.</h2><p>Sign in with one of our demo accounts to explore orders, saved products and checkout.</p><button class="button button-orange" data-action="login">Sign in to NearBuy <span>↗</span></button><small>Three demo customer accounts · details on the sign-in screen</small></div></div>`; }
function helpPage() { return `<div class="content-shell">${pageHeader('HERE FOR THE NEIGHBOURHOOD', 'How can we help?', 'Questions about a local shop, your order or how NearBuy works? We’re all ears.') }<div class="help-layout"><div class="help-options"><button class="help-option" data-action="orders"><span>▤</span><b>Order updates</b><small>Track pickup or delivery</small><i>↗</i></button><button class="help-option" data-route="cart"><span>▱</span><b>Payment & checkout</b><small>Questions about the demo cart</small><i>↗</i></button><button class="help-option" data-action="location"><span>⌖</span><b>Neighbourhood coverage</b><small>Check your local area</small><i>↗</i></button><a class="help-option" href="mailto:hello@nearbuy.in"><span>✉</span><b>Talk to a human</b><small>hello@nearbuy.in</small><i>↗</i></a></div><form class="support-form" id="supportForm"><span class="eyebrow">SEND US A NOTE</span><h2>We’ll be right here.</h2><label>Your email<input type="email" name="email" required placeholder="you@example.com" value="${esc(currentUser?.email || '')}" /></label><label>What can we help with?<select name="topic"><option>Order question</option><option>Product or shop feedback</option><option>Account help</option><option>Something else</option></select></label><label>Your message<textarea required name="message" placeholder="Tell us a little more..."></textarea></label><button class="button button-orange">Send message <span>↗</span></button><small>Demo form — your message is not sent to a support team.</small></form></div></div>`; }
function userData(key, fallback) { return currentUser ? storage.get(`${key}:${currentUser.id}`, fallback) : fallback; }
function saveUserData(key, value) { if (currentUser) storage.set(`${key}:${currentUser.id}`, value); }
function defaultAddresses() { return currentUser ? [{ id: 'home', label: 'Home', name: currentUser.name, phone: currentUser.phone, address: `${currentUser.area}, South Delhi, New Delhi`, isDefault: true }] : []; }
function addNotification(title, body, type = 'order') {
  if (!currentUser) return;
  const list = userData('notifications', []);
  list.unshift({ id: `NT-${Date.now()}`, title, body, type, date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), unread: true });
  saveUserData('notifications', list.slice(0, 30));
}
function accountSubnav(active) { return `<nav class="account-subnav"><button class="${active === 'profile' ? 'active' : ''}" data-route="profile">Profile</button><button class="${active === 'addresses' ? 'active' : ''}" data-route="addresses">Addresses</button><button class="${active === 'payments' ? 'active' : ''}" data-route="payments">Payments</button><button class="${active === 'notifications' ? 'active' : ''}" data-route="notifications">Notifications</button><button class="${active === 'returns' ? 'active' : ''}" data-route="returns">Returns</button><button class="${active === 'followed' ? 'active' : ''}" data-route="followed">Followed shops</button><button class="${active === 'reviews' ? 'active' : ''}" data-route="reviews">My reviews</button></nav>`; }
function profilePage() {
  if (!currentUser) return loginPrompt('Your profile', 'Sign in to manage your NearBuy profile.');
  return `<div class="content-shell">${pageHeader('YOUR DETAILS, YOUR WAY', 'Your profile', 'Keep your contact details up to date for local orders.')}${accountSubnav('profile')}<form class="settings-card" id="profileForm"><div class="settings-title"><span class="profile-avatar">${esc(currentUser.initials)}</span><div><b>Personal details</b><small>Demo profile · Changes are saved in this browser</small></div></div><div class="form-grid"><label>Full name<input name="name" required value="${esc(currentUser.name)}" /></label><label>Email address<input name="email" type="email" required value="${esc(currentUser.email)}" /></label><label>Mobile number<input name="phone" required minlength="8" value="${esc(currentUser.phone)}" /></label><label>Preferred neighbourhood<input name="area" value="${esc(currentUser.area)}" /></label></div><button class="button button-orange">Save profile <span>↗</span></button><p class="settings-note">No details are sent to a server. Demo profile data stays in local storage.</p></form></div>`;
}
function addressesPage() {
  if (!currentUser) return loginPrompt('Your addresses', 'Sign in to manage delivery addresses.');
  const addresses = userData('addresses', defaultAddresses());
  return `<div class="content-shell">${pageHeader('YOUR PLACES AROUND THE NEIGHBOURHOOD', 'Saved addresses', 'Keep delivery details ready for your next local order.')}${accountSubnav('addresses')}<div class="address-list">${addresses.map(address => `<article class="address-card"><span class="address-pin">⌖</span><div><span class="address-label-pill">${esc(address.label)}${address.isDefault ? ' · DEFAULT' : ''}</span><b>${esc(address.name)}</b><p>${esc(address.address)}</p><small>${esc(address.phone)}</small></div><div class="address-actions">${!address.isDefault ? `<button data-action="default-address" data-id="${address.id}">Set default</button>` : ''}<button data-action="edit-address" data-id="${address.id}">Edit</button><button class="danger-link" data-action="delete-address" data-id="${address.id}">Remove</button></div></article>`).join('')}<button class="add-address-card" data-action="edit-address"><span>＋</span><b>Add a new address</b><small>Home, work or another favourite place</small></button></div></div>`;
}
function addressModal(address = null) {
  const data = address || { label: 'Home', name: currentUser.name, phone: currentUser.phone, address: '' };
  openModal(`<span class="eyebrow">DELIVERY DETAILS</span><h2>${address ? 'Edit this address.' : 'Add an address.'}</h2><p class="modal-intro">This demo saves addresses only in your browser.</p><form id="addressForm" class="settings-form"><input type="hidden" name="id" value="${esc(address?.id || '')}" /><label>Address label<select name="label"><option${data.label === 'Home' ? ' selected' : ''}>Home</option><option${data.label === 'Work' ? ' selected' : ''}>Work</option><option${data.label === 'Other' ? ' selected' : ''}>Other</option></select></label><label>Contact name<input name="name" required value="${esc(data.name)}" /></label><label>Mobile number<input name="phone" required minlength="8" value="${esc(data.phone)}" /></label><label>Flat, street, locality and landmark<textarea name="address" required placeholder="e.g. B-14, Hauz Khas, near the market">${esc(data.address)}</textarea></label><button class="button button-orange full-button">Save address <span>↗</span></button></form>`, 'address-modal');
}
function paymentsPage() {
  if (!currentUser) return loginPrompt('Payment history', 'Sign in to see your demo payment records.');
  const orders = userData('orders', seedOrders[currentUser.id] || []);
  return `<div class="content-shell">${pageHeader('A CLEAR RECORD OF EVERY DEMO ORDER', 'Payments', 'Sample transaction history — no real money is moved.')}${accountSubnav('payments')}<div class="payment-records"><div class="demo-notice">Payments in this prototype are simulated. No card, UPI PIN or banking details are collected.</div>${orders.map(order => `<article class="payment-record"><span class="payment-mark">₹</span><div><b>${esc(order.payment || 'Demo payment')}</b><small>${esc(order.id)} · ${esc(order.date)}</small><small>${esc(order.shop)}</small></div><strong>${money(order.total)}</strong><i>Demo</i></article>`).join('') || `<div class="empty-inline">Your demo payment history will appear after an order.</div>`}</div></div>`;
}
function notificationsPage() {
  if (!currentUser) return loginPrompt('Notifications', 'Sign in to see order and account updates.');
  const list = userData('notifications', [{ id: 'welcome', title: 'Welcome to NearBuy', body: 'Discover good things from shops around your corner.', date: 'Today', type: 'welcome', unread: false }]);
  return `<div class="content-shell">${pageHeader('THE IMPORTANT LITTLE UPDATES', 'Notifications', 'Order milestones and account messages, all in one place.')}${accountSubnav('notifications')}<div class="notification-actions"><button data-action="mark-read">Mark all as read</button></div><div class="notification-list">${list.map(item => `<article class="notification-card ${item.unread ? 'unread' : ''}"><span class="notification-icon">${item.type === 'return' ? '↩' : item.type === 'welcome' ? '✳' : '▤'}</span><div><b>${esc(item.title)}</b><p>${esc(item.body)}</p><small>${esc(item.date)}</small></div>${item.unread ? '<i>NEW</i>' : ''}</article>`).join('') || `<div class="empty-inline">You’re all caught up.</div>`}</div></div>`;
}
function returnsPage() {
  if (!currentUser) return loginPrompt('Returns & refunds', 'Sign in to track return requests.');
  const requests = userData('returns', []);
  const orders = userData('orders', seedOrders[currentUser.id] || []);
  return `<div class="content-shell">${pageHeader('HERE IF SOMETHING WASN’T RIGHT', 'Returns & refunds', 'Start a return from an eligible delivered order, then follow its progress.')}${accountSubnav('returns')}<div class="return-page-grid"><section><h2 class="minor-heading">Your return requests</h2>${requests.length ? requests.map(request => `<article class="return-card"><div><small>REQUEST ${esc(request.id)} · ORDER ${esc(request.orderId)}</small><b>${esc(request.product)} · ${esc(request.reason)}</b><span>${esc(request.date)}</span></div><i>${esc(request.status)}</i></article>`).join('') : `<div class="empty-inline">No return requests yet. Delivered demo orders can be returned from their details page.</div>`}</section><section><h2 class="minor-heading">Eligible demo orders</h2>${orders.filter(order => order.status === 'Delivered').map(order => `<article class="eligible-order"><span>✓ Delivered</span><b>${esc(order.shop)}</b><small>${esc(order.id)} · ${esc(order.date)}</small><button data-action="return-start" data-id="${esc(order.id)}">Start a return ↗</button></article>`).join('') || `<div class="empty-inline">No delivered orders are eligible yet.</div>`}</section></div></div>`;
}
function refundsPage() {
  if (!currentUser) return loginPrompt('Refunds', 'Sign in to see demo refund updates.');
  const requests = userData('returns', []);
  return `<div class="content-shell">${pageHeader('FOLLOW YOUR REFUND STATUS', 'Refunds', 'Demo requests show a sample review status; no actual refund is issued.')}${accountSubnav('returns')}<div class="payment-records">${requests.map(item => `<article class="payment-record"><span class="payment-mark">↩</span><div><b>${esc(item.product)}</b><small>Request ${esc(item.id)} · Order ${esc(item.orderId)}</small><small>${esc(item.status)} · We’ll update this page if the status changes.</small></div><strong>${money(item.amount)}</strong></article>`).join('') || `<div class="empty-inline">No refunds to show. Submit an eligible return request to see a demo status here.</div>`}</div></div>`;
}
function followedPage() {
  if (!currentUser) return loginPrompt('Followed shops', 'Sign in to keep your neighbourhood favourites together.');
  const ids = userData('followedShops', []);
  const shops = SHOPS.filter(shop => ids.includes(shop.id));
  return `<div class="content-shell">${pageHeader('YOUR NEIGHBOURHOOD FAVOURITES', 'Followed shops', 'Keep the local stores you love close at hand.')}${accountSubnav('followed')}${shops.length ? `<div class="shop-grid">${shops.map(shopCard).join('')}</div>` : `<div class="empty-cart compact"><span class="empty-cart-icon">♡</span><h2>No followed shops yet</h2><p>Visit a shop page and tap Follow shop to save it here.</p><button class="button button-orange" data-route="shops">Find local shops ↗</button></div>`}</div>`;
}
function reviewsPage() {
  if (!currentUser) return loginPrompt('My reviews', 'Sign in to see your product feedback.');
  const reviews = userData('reviews', []);
  return `<div class="content-shell">${pageHeader('YOUR VOICE HELPS THE NEIGHBOURHOOD', 'My reviews', 'Reviews are saved locally in this demo and aren’t published.')}${accountSubnav('reviews')}${reviews.length ? reviews.map(review => `<article class="review-card"><div><b>${esc(review.product)}</b><span>${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</span></div><p>${esc(review.comment)}</p><small>${esc(review.date)} · Demo review</small></article>`).join('') : `<div class="empty-inline">You haven’t reviewed anything yet. Delivered orders can be reviewed from order details.</div>`}</div>`;
}
function returnModal(order) {
  openModal(`<span class="eyebrow">LET’S MAKE THIS RIGHT</span><h2>Request a return.</h2><p class="modal-intro">${esc(order.id)} · ${esc(order.shop)}. This creates a demo request only.</p><form id="returnForm"><input type="hidden" name="orderId" value="${esc(order.id)}"/><label class="modal-field">Choose an item<select name="product">${order.items.map(item => `<option>${esc(item.name)}</option>`).join('')}</select></label><label class="modal-field">Reason<select name="reason"><option>Damaged product</option><option>Wrong product</option><option>Missing item</option><option>Product not as described</option><option>Other eligible reason</option></select></label><label class="modal-field">Tell us a little more<textarea name="comment" required placeholder="What happened?"></textarea></label><button class="button button-orange full-button">Submit demo request ↗</button></form>`, 'address-modal');
}
function reviewModal(order) {
  const products = order.items.map(item => PRODUCTS.find(product => product.name === item.name)).filter(Boolean);
  openModal(`<span class="eyebrow">HELP YOUR NEIGHBOURS CHOOSE WELL</span><h2>Leave a product review.</h2><p class="modal-intro">Your review is saved in this browser only; it will not be publicly posted.</p><form id="reviewForm"><input type="hidden" name="orderId" value="${esc(order.id)}"/><label class="modal-field">Product<select name="productId">${products.map(product => `<option value="${product.id}">${esc(product.name)}</option>`).join('')}</select></label><label class="modal-field">Your rating<select name="rating"><option value="5">★★★★★ · Loved it</option><option value="4">★★★★☆ · Really good</option><option value="3">★★★☆☆ · It was okay</option><option value="2">★★☆☆☆ · Could be better</option><option value="1">★☆☆☆☆ · Not for me</option></select></label><label class="modal-field">Your review<textarea name="comment" required placeholder="What should a neighbour know?"></textarea></label><button class="button button-orange full-button">Save demo review ↗</button></form>`, 'address-modal');
}
function notFound() { return `<div class="content-shell"><div class="empty-cart"><span class="empty-cart-icon">⌕</span><h2>We can’t find that page.</h2><p>Let’s get you back to the good things nearby.</p><button class="button button-orange" data-route="home">Go to NearBuy home ↗</button></div></div>`; }
function renderRoute() {
  updateHeader();
  const path = routePath().split('/');
  const page = path[0];
  activeCategory = page === 'category' ? path[1] : page === 'explore' ? 'all' : '';
  if (page === 'home') app.innerHTML = homePage();
  else if (page === 'explore') app.innerHTML = listingPage('SHOP YOUR NEIGHBOURHOOD', 'ALL THE GOOD THINGS, ALL AROUND YOU', filteredProducts(), 'A handpicked mix from local shops close to home.');
  else if (page === 'search') { activeQuery = path.slice(1).join('/'); app.innerHTML = listingPage(`Results for “${esc(activeQuery)}”`, 'YOUR SEARCH, MADE LOCAL', filteredProducts(activeQuery), 'Products and shops from around your neighbourhood.'); }
  else if (page === 'category') { const cat = CATEGORIES.find(item => item.id === path[1]); app.innerHTML = cat ? listingPage(cat.label, 'GOOD THINGS IN YOUR CATEGORY', filteredProducts('', cat.id), `Local ${cat.label.toLowerCase()} from shops close by.`) : notFound(); }
  else if (page === 'shops') app.innerHTML = shopsPage();
  else if (page === 'shop') app.innerHTML = shopPage(path[1]);
  else if (page === 'product') app.innerHTML = productPage(path[1]);
  else if (page === 'cart') app.innerHTML = cartPage();
  else if (page === 'checkout') app.innerHTML = currentUser ? checkoutPage() : loginPrompt('Checkout', 'Sign in with a demo customer account to place a sample order.');
  else if (page === 'account') app.innerHTML = accountPage();
  else if (page === 'orders') app.innerHTML = ordersPage();
  else if (page === 'order') app.innerHTML = orderDetailPage(path[1]);
  else if (page === 'wishlist') app.innerHTML = wishlistPage();
  else if (page === 'help') app.innerHTML = helpPage();
  else if (page === 'profile') app.innerHTML = profilePage();
  else if (page === 'addresses') app.innerHTML = addressesPage();
  else if (page === 'payments') app.innerHTML = paymentsPage();
  else if (page === 'notifications') app.innerHTML = notificationsPage();
  else if (page === 'returns') app.innerHTML = returnsPage();
  else if (page === 'refunds') app.innerHTML = refundsPage();
  else if (page === 'followed') app.innerHTML = followedPage();
  else if (page === 'reviews') app.innerHTML = reviewsPage();
  else app.innerHTML = notFound();
  document.querySelectorAll('.category-nav-item').forEach(button => button.classList.toggle('active', button.dataset.route === (page === 'category' ? `category/${path[1]}` : page === 'explore' ? 'explore' : '')));
  document.body.classList.remove('menu-is-open');
}

function openModal(content, className = '') {
  modalRoot.innerHTML = `<div class="modal-backdrop" data-action="backdrop"><section class="modal ${className}" role="dialog" aria-modal="true"><button class="modal-close" data-action="close-modal" aria-label="Close dialog">×</button>${content}</section></div>`;
  requestAnimationFrame(() => modalRoot.querySelector('.modal-backdrop')?.classList.add('visible'));
  modalRoot.querySelector('input,button')?.focus();
}
function closeModal() { const backdrop = modalRoot.querySelector('.modal-backdrop'); if (!backdrop) return; if (modalRoot.querySelector('#loginForm') && !currentUser) pendingCheckout = false; backdrop.classList.remove('visible'); setTimeout(() => { if (!backdrop.classList.contains('visible')) modalRoot.innerHTML = ''; }, 170); }
function loginModal() {
  const chips = DEMO_USERS.map(user => `<button type="button" class="demo-user" data-demo-user="${user.id}"><span>${user.initials}</span><i><b>${user.name}</b><small>${user.email}</small></i><strong>Use</strong></button>`).join('');
  openModal(`<span class="eyebrow">YOUR NEIGHBOURHOOD, YOUR ACCOUNT</span><h2>Welcome back.</h2><p class="modal-intro">Sign in to keep your local finds, orders and favourites together.</p><form id="loginForm" class="login-form"><label>Email address<input name="email" type="email" required autocomplete="username" placeholder="you@example.com" /></label><label>Password<input name="password" type="password" required autocomplete="current-password" placeholder="Your password" /></label><button class="button button-orange login-submit">Sign in <span>↗</span></button><div class="login-error" id="loginError"></div></form><div class="demo-divider"><span>OR TRY A DEMO ACCOUNT</span></div><div class="demo-user-list">${chips}</div><div class="demo-password-note">All three demo accounts use password <b>NearBuy123!</b></div><div class="demo-notice">Demo sign-in only · No real account or personal information is created.</div>`, 'login-modal');
}
function locationModal() {
  const areas = ['South Delhi', 'Hauz Khas', 'Saket', 'Greater Kailash', 'Malviya Nagar', 'Gurugram · coming soon', 'Noida · coming soon'];
  openModal(`<span class="eyebrow">START CLOSE TO HOME</span><h2>Choose your neighbourhood.</h2><p class="modal-intro">We’ll show you local shops and products around your area.</p><div class="location-list">${areas.map(area => { const disabled = area.includes('coming soon'); const value = area.split(' ·')[0]; return `<button class="location-choice${locationName === value ? ' selected' : ''}" data-action="select-location" data-area="${esc(value)}" ${disabled ? 'data-coming="true"' : ''}><span class="location-choice-icon">⌖</span><span><b>${esc(value)}</b><small>${disabled ? 'We’re mapping this area next' : 'South Delhi neighbourhood'}</small></span><i>${locationName === value ? '✓' : '↗'}</i></button>`; }).join('')}</div><div class="demo-notice">Currently showing sample local shops for the South Delhi pilot area.</div>`, 'location-modal');
}
function addToCart(id, quantity = 1) {
  const product = productFor(id); if (!product) return;
  const existingShop = cart.length ? cart[0].shop : product.shop;
  if (cart.length && existingShop !== product.shop) {
    const oldShop = shopFor(existingShop);
    const newShop = shopFor(product.shop);
    openModal(`<span class="eyebrow">ONE SHOP AT A TIME</span><h2>Start a new local order?</h2><p class="modal-intro">Your cart has items from <b>${esc(oldShop.name)}</b>. This demo checkout is one shop per order. We can clear it and start a new cart from ${esc(newShop.name)}.</p><div class="confirm-actions"><button class="button button-outline" data-action="close-modal">Keep my cart</button><button class="button button-orange" data-action="switch-shop-add" data-id="${product.id}">Start new cart ↗</button></div>`, 'confirm-modal');
    return;
  }
  const item = cart.find(row => row.id === product.id);
  if (item) item.qty = Math.min(product.stock, item.qty + quantity);
  else cart.push({ id: product.id, qty: Math.min(product.stock, quantity), price: product.price, shop: product.shop });
  persist(); updateHeader(); notice(`${product.name} added to your cart.`);
}
function toggleWishlist(id) {
  const product = productFor(id); if (!product) return;
  if (wishlist.includes(id)) { wishlist = wishlist.filter(item => item !== id); notice('Removed from your saved finds.'); }
  else { wishlist.push(id); notice('Saved for later — nice choice.'); }
  persist(); renderRoute();
}
function changeCart(id, delta) {
  const item = cart.find(row => row.id === id); const product = productFor(id); if (!item || !product) return;
  item.qty += delta;
  if (item.qty < 1) cart = cart.filter(row => row.id !== id);
  else item.qty = Math.min(item.qty, product.stock);
  persist(); renderRoute();
}
function login(email, password) {
  const found = DEMO_USERS.find(user => user.email.toLowerCase() === email.trim().toLowerCase() && user.password === password);
  if (!found) { const error = document.getElementById('loginError'); if (error) error.textContent = 'That email and password don’t match a demo account. Try one of the demo profiles below.'; return; }
  currentUser = { id: found.id, name: found.name, email: found.email, phone: found.phone, area: found.area, initials: found.initials };
  persist(); closeModal(); if (pendingCheckout) { pendingCheckout = false; go('checkout'); } else renderRoute(); notice(`Welcome to NearBuy, ${found.name.split(' ')[0]}!`);
}
function placeOrder(form) {
  const data = new FormData(form); const fulfilment = data.get('fulfilment');
  const totals = cartTotals();
  const items = cart.map(item => ({ name: productFor(item.id).name, qty: item.qty, price: item.price }));
  const id = `NB-${new Date().toISOString().slice(2, 10).replaceAll('-', '')}-${Math.floor(1000 + Math.random() * 9000)}`;
  const order = { id, date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }), status: 'Placed', method: fulfilment, total: totals.total - (fulfilment === 'Pickup' ? totals.delivery : 0), shop: shopFor(cart[0].shop).name, items, address: fulfilment === 'Pickup' ? `Pickup at ${shopFor(cart[0].shop).name}, ${shopFor(cart[0].shop).area}` : data.get('address'), payment: data.get('payment') };
  let orders = storage.get(`orders:${currentUser.id}`, seedOrders[currentUser.id] || []);
  orders = [order, ...orders]; storage.set(`orders:${currentUser.id}`, orders);
  addNotification('Your order is placed', `${order.id} from ${order.shop} is in the demo order queue.`);
  cart = []; coupon = ''; persist();
  openModal(`<div class="success-mark">✓</div><span class="eyebrow">THAT’S A GOOD LOCAL FIND</span><h2>Your demo order is in.</h2><p class="modal-intro">${esc(order.shop)} has your sample order. This is a prototype — no payment was taken and no shop was notified.</p><div class="success-order"><small>ORDER ID</small><b>${esc(order.id)}</b><span>${esc(order.method)} · ${money(order.total)}</span></div><div class="confirm-actions"><button class="button button-outline" data-action="close-modal" data-after-order="home">Back to shopping</button><button class="button button-orange" data-action="view-new-order" data-id="${esc(order.id)}">View demo order ↗</button></div>`, 'success-modal');
}
function cancelOrder(id) {
  let orders = storage.get(`orders:${currentUser.id}`, seedOrders[currentUser.id] || []);
  orders = orders.map(order => order.id === id ? { ...order, status: 'Cancelled' } : order);
  storage.set(`orders:${currentUser.id}`, orders); addNotification('Demo order cancelled', `${id} has been marked cancelled in your sample history.`); renderRoute(); notice('Your demo order has been cancelled.');
}

// All page actions are delegated so freshly rendered cards remain interactive.
document.addEventListener('click', event => {
  const target = event.target.closest('[data-action],[data-route],[data-shop-filter],[data-demo-user]');
  if (!target) return;
  if (target.dataset.route) { event.preventDefault(); if (target.dataset.action === 'close-and-route') closeModal(); go(target.dataset.route); return; }
  if (target.dataset.demoUser) { const user = DEMO_USERS.find(item => item.id === target.dataset.demoUser); if (user) login(user.email, user.password); return; }
  if (target.dataset.shopFilter) {
    document.querySelectorAll('[data-shop-filter]').forEach(button => button.classList.toggle('selected', button === target));
    let shops = [...SHOPS];
    if (target.dataset.shopFilter === 'open') shops = shops.filter(shop => shop.open);
    if (target.dataset.shopFilter === 'delivery') shops = shops.filter(shop => shop.open);
    const listing = document.getElementById('shopListing'); if (listing) listing.innerHTML = shops.map(shopCard).join('');
    return;
  }
  const action = target.dataset.action;
  if (action === 'location') locationModal();
  else if (action === 'login') loginModal();
  else if (action === 'account') { if (!currentUser) loginModal(); else go('account'); }
  else if (action === 'orders') go('orders');
  else if (action === 'wishlist') go('wishlist');
  else if (action === 'cart') go('cart');
  else if (action === 'help') go('help');
  else if (action === 'mobile-menu') openModal(`<span class="eyebrow">NEARBUY, AT A GLANCE</span><h2>Where to next?</h2><p class="modal-intro">Good things are closer than you think.</p><div class="mobile-quick-links"><button data-route="explore" data-action="close-and-route"><span>✳</span><b>Shop all products</b><i>↗</i></button><button data-route="shops" data-action="close-and-route"><span>⌖</span><b>Find local shops</b><i>↗</i></button><button data-action="close-and-route" data-route="orders"><span>▤</span><b>My orders</b><i>↗</i></button><button data-action="close-and-route" data-route="account"><span>♙</span><b>My account</b><i>↗</i></button></div>`, 'location-modal');
  else if (action === 'close-modal') { closeModal(); if (target.dataset.afterOrder) go(target.dataset.afterOrder); }
  else if (action === 'backdrop' && event.target === target) closeModal();
  else if (action === 'select-location') {
    if (target.dataset.coming) { notice(`${target.dataset.area} is on our expansion map. South Delhi is the first pilot.`); return; }
    locationName = target.dataset.area; persist(); closeModal(); updateHeader(); renderRoute(); notice(`Showing local finds around ${locationName}.`);
  }
  else if (action === 'wishlist-toggle') toggleWishlist(target.dataset.id);
  else if (action === 'add') addToCart(target.dataset.id, document.getElementById('detailQty') ? Number(document.getElementById('detailQty').textContent) : 1);
  else if (action === 'cart-qty') changeCart(target.dataset.id, Number(target.dataset.delta));
  else if (action === 'remove-cart') { cart = cart.filter(item => item.id !== target.dataset.id); persist(); renderRoute(); notice('Removed from your cart.'); }
  else if (action === 'checkout') { if (!currentUser) { pendingCheckout = true; loginModal(); notice('Sign in with a demo account to try checkout.'); } else go('checkout'); }
  else if (action === 'apply-coupon') {
    const input = document.getElementById('couponInput'); const code = input?.value.trim().toUpperCase();
    if (code === 'LOCAL10') { coupon = code; persist(); renderRoute(); notice('LOCAL10 applied — 10% off your demo order.'); }
    else notice('That code didn’t work. Try LOCAL10.');
  }
  else if (action === 'qty-detail') {
    const qty = document.getElementById('detailQty'); const product = productFor(routePath().split('/')[1]);
    if (qty && product) qty.textContent = Math.max(1, Math.min(product.stock, Number(qty.textContent) + Number(target.dataset.delta)));
  }
  else if (action === 'scroll-products') document.getElementById('shopProducts')?.scrollIntoView({ behavior: 'smooth' });
  else if (action === 'follow-shop') {
    if (!currentUser) { loginModal(); notice('Sign in to follow your neighbourhood shops.'); return; }
    const ids = userData('followedShops', []); const id = target.dataset.id;
    saveUserData('followedShops', ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id]);
    renderRoute(); notice(ids.includes(id) ? 'Shop removed from your favourites.' : 'Shop added to your neighbourhood favourites.');
  }
  else if (action === 'return-start') {
    if (!currentUser) { loginModal(); return; }
    const orders = userData('orders', seedOrders[currentUser.id] || []); const order = orders.find(item => item.id === target.dataset.id);
    if (order?.status === 'Delivered') returnModal(order); else notice('Only delivered demo orders can start a return.');
  }
  else if (action === 'review-start') {
    if (!currentUser) { loginModal(); return; }
    const orders = userData('orders', seedOrders[currentUser.id] || []); const order = orders.find(item => item.id === target.dataset.id);
    if (order?.status === 'Delivered') reviewModal(order); else notice('Reviews are available for delivered demo orders.');
  }
  else if (action === 'share-shop') { const shop = shopFor(target.dataset.id); if (navigator.share) navigator.share({ title: shop.name, text: shop.description, url: location.href }).catch(() => {}); else { navigator.clipboard?.writeText(location.href); notice('Shop link copied (if clipboard access is allowed).'); } }
  else if (action === 'logout') { currentUser = null; persist(); go('home'); notice('You’ve signed out. See you around.'); }
  else if (action === 'mark-read') { const list = userData('notifications', []); saveUserData('notifications', list.map(item => ({ ...item, unread: false }))); updateHeader(); renderRoute(); notice('You’re all caught up.'); }
  else if (action === 'addresses') go('addresses');
  else if (action === 'edit-address') { const addresses = userData('addresses', defaultAddresses()); const address = target.dataset.id ? addresses.find(item => item.id === target.dataset.id) : null; addressModal(address); }
  else if (action === 'delete-address') { let addresses = userData('addresses', defaultAddresses()).filter(item => item.id !== target.dataset.id); if (addresses.length && !addresses.some(item => item.isDefault)) addresses[0].isDefault = true; saveUserData('addresses', addresses); renderRoute(); notice('Address removed from this demo profile.'); }
  else if (action === 'default-address') { const addresses = userData('addresses', defaultAddresses()).map(item => ({ ...item, isDefault: item.id === target.dataset.id })); saveUserData('addresses', addresses); renderRoute(); notice('Default address updated.'); }
  else if (action === 'cancel-order') { cancelOrder(target.dataset.id); }
  else if (action === 'reorder') {
    const orders = storage.get(`orders:${currentUser.id}`, seedOrders[currentUser.id] || []); const order = orders.find(item => item.id === target.dataset.id);
    if (order) { const foundProducts = order.items.map(row => PRODUCTS.find(product => product.name === row.name)).filter(Boolean); if (foundProducts.length) { cart = foundProducts.map(product => ({ id: product.id, qty: order.items.find(item => item.name === product.name)?.qty || 1, price: product.price, shop: product.shop })); persist(); go('cart'); notice('Items from your order are back in your cart.'); } else notice('Those products are no longer in this demo catalogue.'); }
  }
  else if (action === 'view-new-order') { closeModal(); go(`order/${encodeURIComponent(target.dataset.id)}`); }
  else if (action === 'order-filter') {
    document.querySelectorAll('[data-action="order-filter"]').forEach(button => button.classList.toggle('selected', button === target));
    const orders = storage.get(`orders:${currentUser.id}`, seedOrders[currentUser.id] || []);
    const filtered = target.dataset.filter === 'delivered' ? orders.filter(order => order.status === 'Delivered') : orders.filter(order => !['Delivered', 'Cancelled'].includes(order.status));
    document.querySelector('.orders-list').innerHTML = filtered.length ? filtered.map(orderCard).join('') : `<div class="empty-inline">No ${target.dataset.filter} orders to show.</div>`;
  }
  else if (action === 'switch-shop-add') { const product = productFor(target.dataset.id); closeModal(); cart = []; coupon = ''; addToCart(product.id); }
});

document.addEventListener('submit', event => {
  if (event.target.id === 'searchForm') {
    event.preventDefault(); const query = new FormData(event.target).get('q').trim(); if (!query) { go('explore'); return; } go(`search/${encodeURIComponent(query)}`);
  } else if (event.target.id === 'loginForm') {
    event.preventDefault(); const data = new FormData(event.target); login(data.get('email'), data.get('password'));
  } else if (event.target.id === 'checkoutForm') {
    event.preventDefault(); if (!currentUser || !cart.length) { notice('Please sign in and add an item first.'); return; }
    const fulfilment = new FormData(event.target).get('fulfilment'); if (fulfilment === 'Delivery' && !new FormData(event.target).get('address').trim()) { notice('Please enter a delivery address.'); return; }
    placeOrder(event.target);
  } else if (event.target.id === 'supportForm') {
    event.preventDefault(); event.target.reset(); notice('Thanks for the note! This demo form does not send messages yet.');
  } else if (event.target.id === 'profileForm') {
    event.preventDefault(); const data = new FormData(event.target); const name = data.get('name').trim();
    currentUser = { ...currentUser, name, email: data.get('email').trim(), phone: data.get('phone').trim(), area: data.get('area').trim() || currentUser.area, initials: name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() };
    persist(); renderRoute(); notice('Your demo profile has been updated.');
  } else if (event.target.id === 'addressForm') {
    event.preventDefault(); const data = new FormData(event.target); let addresses = userData('addresses', defaultAddresses()); const id = data.get('id') || `addr-${Date.now()}`;
    const existing = addresses.find(item => item.id === id); const record = { id, label: data.get('label'), name: data.get('name').trim(), phone: data.get('phone').trim(), address: data.get('address').trim(), isDefault: existing?.isDefault || addresses.length === 0 };
    addresses = existing ? addresses.map(item => item.id === id ? record : item) : [...addresses, record]; saveUserData('addresses', addresses); closeModal(); renderRoute(); notice('Address saved to this demo profile.');
  } else if (event.target.id === 'returnForm') {
    event.preventDefault(); const data = new FormData(event.target); const orders = userData('orders', seedOrders[currentUser.id] || []); const order = orders.find(item => item.id === data.get('orderId')); if (!order || order.status !== 'Delivered') { notice('That order is not eligible for a demo return.'); return; }
    const item = order.items.find(row => row.name === data.get('product')); const requests = userData('returns', []); const request = { id: `RT-${Date.now().toString().slice(-6)}`, orderId: order.id, product: data.get('product'), reason: data.get('reason'), comment: data.get('comment').trim(), amount: item ? item.price * item.qty : 0, status: 'Under review (demo)', date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) };
    saveUserData('returns', [request, ...requests]); addNotification('Return request received', `${request.product} · request ${request.id} is under demo review.`, 'return'); closeModal(); go('returns'); notice('Demo return request saved. No refund has been initiated.');
  } else if (event.target.id === 'reviewForm') {
    event.preventDefault(); const data = new FormData(event.target); const product = productFor(data.get('productId')); const reviews = userData('reviews', []); reviews.unshift({ product: product?.name || 'Local find', rating: Number(data.get('rating')), comment: data.get('comment').trim(), date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) });
    saveUserData('reviews', reviews); closeModal(); go('reviews'); notice('Your demo review is saved privately in this browser.');
  }
});
document.addEventListener('change', event => {
  if (event.target.id === 'checkoutSavedAddress') {
    const address = userData('addresses', defaultAddresses()).find(item => item.id === event.target.value);
    const field = document.querySelector('#addressField textarea'); if (address && field) field.value = address.address;
  }
  if (event.target.id === 'productShopFilter' || event.target.id === 'productSort') applyProductFilters();
  if (event.target.name === 'fulfilment') {
    const pickup = event.target.value === 'Pickup';
    document.querySelectorAll('.fulfil-option').forEach(label => label.classList.toggle('selected', label.contains(event.target)));
    const address = document.getElementById('addressField'); if (address) { address.style.display = pickup ? 'none' : 'grid'; const field = address.querySelector('textarea'); field.required = !pickup; }
    const totals = cartTotals(); const delivery = pickup || totals.subtotal >= 399 ? 0 : 25;
    const deliveryNode = document.getElementById('checkoutDelivery'); const totalNode = document.getElementById('checkoutTotal');
    if (deliveryNode) deliveryNode.textContent = delivery ? money(delivery) : 'FREE';
    if (totalNode) totalNode.textContent = money(totals.subtotal - totals.discount + delivery);
  }
  if (event.target.id === 'shopSort') {
    const value = event.target.value; let shops = [...SHOPS];
    if (value === 'rating') shops.sort((a, b) => Number(b.rating) - Number(a.rating));
    if (value === 'name') shops.sort((a, b) => a.name.localeCompare(b.name));
    if (value === 'near') shops.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
    document.getElementById('shopListing').innerHTML = shops.map(shopCard).join('');
  }
});
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeModal(); });
window.addEventListener('hashchange', renderRoute);
window.addEventListener('storage', event => { if (event.key?.startsWith('nearbuy:')) { currentUser = storage.get('user', null); cart = storage.get('cart', []); wishlist = storage.get('wishlist', []); renderRoute(); } });

renderRoute();
