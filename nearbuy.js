/* ============================================================================
   NearBuy One — five separately signed-in workspaces, one source of truth.
   Vanilla JS · no build step · all data stays in this browser.
   ========================================================================== */
'use strict';

/* ---------------------------------- utils --------------------------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const num = (n) => Number(n || 0).toLocaleString('en-IN');
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const sumBy = (arr, f) => arr.reduce((t, x) => t + (Number(f(x)) || 0), 0);
const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nowLabel = () => new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' });
const dayLabel = (i = 0) => { const d = new Date(); d.setDate(d.getDate() - i); return d.toLocaleDateString('en-IN', { weekday: 'short' }); };
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

/* ---------------------------------- icons --------------------------------- */
const PATHS = {
  home: '<path d="M3 10.4 12 3l9 7.4"/><path d="M5.6 9.2V20a1 1 0 0 0 1 1h10.8a1 1 0 0 0 1-1V9.2"/><path d="M9.6 21v-6h4.8v6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.9-3.9"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.8"/><rect x="14" y="3" width="7" height="7" rx="1.8"/><rect x="3" y="14" width="7" height="7" rx="1.8"/><rect x="14" y="14" width="7" height="7" rx="1.8"/>',
  store: '<path d="M3.4 9.4 5 4h14l1.6 5.4"/><path d="M4 9.4h16V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M9.4 21v-5.6h5.2V21"/>',
  bag: '<path d="M6 7h12l1.2 12.7a1.2 1.2 0 0 1-1.2 1.3H6a1.2 1.2 0 0 1-1.2-1.3z"/><path d="M9 10V6.5a3 3 0 0 1 6 0V10"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/>',
  users: '<path d="M16 21v-1a5 5 0 0 0-5-5H7a5 5 0 0 0-5 5v1"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-1a5 5 0 0 0-4-4.9"/><path d="M16.6 3.2a4 4 0 0 1 0 7.6"/>',
  truck: '<path d="M2.5 5.5h10.5v11H2.5z"/><path d="M13 8.5h4.2l3.8 3.8v4.2H13z"/><circle cx="6.6" cy="18.4" r="1.9"/><circle cx="17.4" cy="18.4" r="1.9"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="2.6"/>',
  package: '<path d="M12 2.6 21 7v10l-9 4.4L3 17V7z"/><path d="m3 7 9 4.4L21 7"/><path d="M12 21.4V11.4"/>',
  archive: '<rect x="3" y="4" width="18" height="4" rx="1.2"/><path d="M5 8v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/>',
  chart: '<path d="M3 3v18h18"/><path d="m7 15 4-5 3 3 5-7"/>',
  bars: '<path d="M5 21V11"/><path d="M12 21V4"/><path d="M19 21v-6"/>',
  rupee: '<path d="M6 3h12"/><path d="M6 8h12"/><path d="M6 13h3.6a5 5 0 0 0 0-10"/><path d="m6.4 13 8.6 8"/>',
  sliders: '<path d="M4 6h8"/><path d="M18 6h2"/><circle cx="15" cy="6" r="2.2"/><path d="M4 12h2"/><path d="M12 12h8"/><circle cx="9" cy="12" r="2.2"/><path d="M4 18h8"/><path d="M18 18h2"/><circle cx="15" cy="18" r="2.2"/>',
  shield: '<path d="M12 22s8-4 8-10V5.4L12 2.5 4 5.4V12c0 6 8 10 8 10z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.3 9.1a2.9 2.9 0 0 1 5.6.9c0 2-2.9 2.1-2.9 4"/><path d="M12 17.6h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="m4 12.6 5 5L20 6.6"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12.4 2.6 2.6L16 9.6"/>',
  arrowRight: '<path d="M4 12h15"/><path d="m13 6 6 6-6 6"/>',
  arrowUpRight: '<path d="M7 17 17 7"/><path d="M8.5 7H17v8.5"/>',
  chevronRight: '<path d="m9 5 7 7-7 7"/>',
  chevronLeft: '<path d="m15 5-7 7 7 7"/>',
  chevronDown: '<path d="m5 9 7 7 7-7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7.4V12l3.2 2"/>',
  star: '<path d="m12 3 2.7 5.7 6.3.9-4.6 4.4 1.1 6.2-5.5-3-5.5 3 1.1-6.2L3 9.6l6.3-.9z"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3.8V9h-5.2"/>',
  download: '<path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M4 20h16"/>',
  inbox: '<path d="M3.5 12H8l1.8 3h4.4l1.8-3h4.5"/><path d="M5 4.8h14l3 7.2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>',
  zap: '<path d="M13.4 2 4 14h6.6l-1 8L19 10h-6.4z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  layers: '<path d="m12 2.4 9 5-9 5-9-5z"/><path d="m3 12.4 9 5 9-5"/><path d="m3 17.4 9 5 9-5"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9.2 4V2.8h5.6V4"/><path d="M9 9.5h6M9 13.5h6M9 17.5h3"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="2.4"/><path d="M3 10.4h18"/><circle cx="17" cy="15" r="1.3"/>',
  megaphone: '<path d="m3.5 11 13.5-6v14L3.5 13z"/><path d="M7.4 12v5.4a2 2 0 0 0 3.6 1.1"/>',
  tag: '<path d="M20.6 13.4 13 21 3 11V3h8l9.6 9.6a1.4 1.4 0 0 1 0 1.8z"/><circle cx="7.6" cy="7.6" r="1.4"/>',
  alert: '<path d="M12 3 2.6 20h18.8z"/><path d="M12 9.2v5"/><path d="M12 17.4h.01"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2.2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  sparkles: '<path d="m12 3 1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M18.4 15.6l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
  phone: '<path d="M5 3h3.4l1.8 4.4-2.2 1.6a12 12 0 0 0 5 5l1.6-2.2L19 13.6V17a2 2 0 0 1-2.2 2A16 16 0 0 1 3 5.2 2 2 0 0 1 5 3z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.2"/><path d="m3.6 6.5 8.4 6 8.4-6"/>',
  bike: '<circle cx="6" cy="17" r="3.4"/><circle cx="18" cy="17" r="3.4"/><path d="M9.4 17h5.2l-2-6.5H9"/><path d="m14.6 10.5 2.6 6.5"/><path d="M13.4 6.5h3.2"/>',
  walk: '<circle cx="13" cy="4.4" r="1.9"/><path d="m11.4 21 1.2-5.2-2.2-2.2 1-4.4 3 2.6 2.4.6"/><path d="m12.6 15.8 2.6 5.2"/><path d="m11.6 11.4-3 3.4-2.6.6"/>',
  box: '<rect x="3.5" y="7.5" width="17" height="13" rx="2"/><path d="M3.5 12h17"/><path d="M8 7.5V4.5h8v3"/>',
  scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M7.5 12h9"/>',
  pause: '<path d="M9 4v16M15 4v16"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 16l-4-4 4-4"/><path d="M6 12h10"/>',
  spark: '<path d="M12 2v6M12 16v6M2 12h6M16 12h6"/><path d="m5.6 5.6 3.2 3.2M15.2 15.2l3.2 3.2M18.4 5.6l-3.2 3.2M8.8 15.2l-3.2 3.2"/>',
  book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17.5H6.5A2.5 2.5 0 0 0 4 22z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8"/><path d="M12 8v13"/><path d="M12 8S9.5 8 8.2 6.6a2.3 2.3 0 1 1 3.2-3.2C12 4.5 12 8 12 8z"/><path d="M12 8s2.5 0 3.8-1.4a2.3 2.3 0 1 0-3.2-3.2C12 4.5 12 8 12 8z"/>'
};
function icon(name, cls = '') {
  const d = PATHS[name] || PATHS.grid;
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
}

/* ----------------------------------- data ---------------------------------- */
const CATEGORIES = [
  { id: 'all', label: 'All finds', icon: 'sparkles' },
  { id: 'grocery', label: 'Groceries', icon: 'store' },
  { id: 'fresh', label: 'Fresh produce', icon: 'sparkles' },
  { id: 'bakery', label: 'Bakery & dairy', icon: 'box' },
  { id: 'stationery', label: 'Books & stationery', icon: 'book' },
  { id: 'home', label: 'Home & kitchen', icon: 'home' },
  { id: 'personal', label: 'Personal care', icon: 'heart' }
];

const SHOPS = [
  { id: 'greenbasket', name: 'Green Basket Market', cat: 'Grocery & daily essentials', area: 'Hauz Khas', distance: 0.4, rating: 4.9, time: '15–25 min', emoji: '🥬', tone: 'shop-sage', open: true, description: 'Fresh produce and everyday essentials, picked with care from your neighbourhood.' },
  { id: 'paperlane', name: 'Paper Lane Books & More', cat: 'Books & stationery', area: 'Saket', distance: 0.8, rating: 4.8, time: '20–30 min', emoji: '📚', tone: 'shop-peach', open: true, description: 'A much-loved neighbourhood bookshop for school, work and curious minds.' },
  { id: 'cornercart', name: 'The Corner Cart', cat: 'General store', area: 'Malviya Nagar', distance: 0.6, rating: 4.7, time: '15–25 min', emoji: '🛍️', tone: 'shop-blue', open: true, description: 'All the little things you need, from a shop that knows your street.' },
  { id: 'dailyroot', name: 'Daily Roots', cat: 'Grocery & fresh produce', area: 'Greater Kailash', distance: 1.1, rating: 4.9, time: '25–35 min', emoji: '🍊', tone: 'shop-yellow', open: false, description: 'Seasonal produce, pantry favourites and a friendly hello every visit.' }
];

const PRODUCTS = [
  { id: 'p101', name: 'Farm fresh whole milk', detail: 'Full cream · 500 ml', price: 34, mrp: 38, cat: 'bakery', shop: 'greenbasket', emoji: '🥛', tone: 'tone-milk', badge: 'Bestseller', stock: 18, lowAt: 6, sold: 124 },
  { id: 'p102', name: 'Sunrise bananas', detail: 'Naturally sweet · 6 pcs', price: 42, mrp: 48, cat: 'fresh', shop: 'greenbasket', emoji: '🍌', tone: 'tone-banana', badge: 'Fresh today', stock: 24, lowAt: 8, sold: 96 },
  { id: 'p103', name: 'Sourdough country loaf', detail: 'Baked this morning · 400 g', price: 95, mrp: 110, cat: 'bakery', shop: 'greenbasket', emoji: '🍞', tone: 'tone-bread', badge: 'Local favourite', stock: 8, lowAt: 4, sold: 71 },
  { id: 'p104', name: 'Free range eggs', detail: 'Farm eggs · pack of 6', price: 72, mrp: 78, cat: 'bakery', shop: 'greenbasket', emoji: '🥚', tone: 'tone-egg', badge: '', stock: 12, lowAt: 5, sold: 64 },
  { id: 'p105', name: 'Seasonal red apples', detail: 'Crisp & juicy · 4 pcs', price: 119, mrp: 140, cat: 'fresh', shop: 'greenbasket', emoji: '🍎', tone: 'tone-apple', badge: 'Save 15%', stock: 3, lowAt: 6, sold: 52 },
  { id: 'p106', name: 'Everyday ruled notebook', detail: 'A5 · 180 pages', price: 55, mrp: 65, cat: 'stationery', shop: 'paperlane', emoji: '📓', tone: 'tone-notebook', badge: 'Back to school', stock: 30, lowAt: 8, sold: 44 },
  { id: 'p107', name: 'Colour pencils', detail: '12 bright colours', price: 85, mrp: 99, cat: 'stationery', shop: 'paperlane', emoji: '🖍️', tone: 'tone-pencils', badge: '', stock: 16, lowAt: 6, sold: 39 },
  { id: 'p108', name: 'The little book of big ideas', detail: 'Paperback · Ages 8+', price: 199, mrp: 250, cat: 'stationery', shop: 'paperlane', emoji: '📔', tone: 'tone-book', badge: 'Staff pick', stock: 6, lowAt: 4, sold: 28 },
  { id: 'p109', name: 'Black gel pens', detail: 'Smooth 0.5 mm · set of 5', price: 60, mrp: 75, cat: 'stationery', shop: 'paperlane', emoji: '🖊️', tone: 'tone-pens', badge: '', stock: 22, lowAt: 8, sold: 33 },
  { id: 'p110', name: 'Canvas tote bag', detail: 'Reusable · natural cotton', price: 149, mrp: 179, cat: 'home', shop: 'cornercart', emoji: '👜', tone: 'tone-tote', badge: 'Local pick', stock: 9, lowAt: 4, sold: 26 },
  { id: 'p111', name: 'Stainless steel bottle', detail: 'Keeps cool · 750 ml', price: 249, mrp: 299, cat: 'home', shop: 'cornercart', emoji: '🧴', tone: 'tone-bottle', badge: '', stock: 11, lowAt: 4, sold: 21 },
  { id: 'p112', name: 'Kitchen cotton towels', detail: 'Set of 2 · soft weave', price: 129, mrp: 160, cat: 'home', shop: 'cornercart', emoji: '🧺', tone: 'tone-towels', badge: 'Save 19%', stock: 7, lowAt: 4, sold: 18 },
  { id: 'p113', name: 'Gentle aloe hand wash', detail: 'Refill pouch · 500 ml', price: 89, mrp: 105, cat: 'personal', shop: 'cornercart', emoji: '🫧', tone: 'tone-wash', badge: '', stock: 13, lowAt: 5, sold: 15 },
  { id: 'p114', name: 'Sweet oranges', detail: 'Juicy season pick · 1 kg', price: 88, mrp: 105, cat: 'fresh', shop: 'dailyroot', emoji: '🍊', tone: 'tone-orange', badge: 'Fresh today', stock: 12, lowAt: 5, sold: 31 },
  { id: 'p115', name: 'Fresh spinach bunch', detail: 'Locally grown · 1 bunch', price: 28, mrp: 32, cat: 'fresh', shop: 'dailyroot', emoji: '🥬', tone: 'tone-spinach', badge: '', stock: 14, lowAt: 6, sold: 29 },
  { id: 'p116', name: 'Rolled oats', detail: 'Wholegrain · 500 g', price: 145, mrp: 165, cat: 'grocery', shop: 'greenbasket', emoji: '🥣', tone: 'tone-bread', badge: '', stock: 0, lowAt: 4, sold: 19 },
  { id: 'p117', name: 'Wildflower honey', detail: 'Small-batch · 250 g', price: 189, mrp: 220, cat: 'grocery', shop: 'greenbasket', emoji: '🍯', tone: 'tone-banana', badge: 'Local pick', stock: 9, lowAt: 4, sold: 16 },
  { id: 'p118', name: 'Pantry basmati rice', detail: 'Aged · 1 kg', price: 165, mrp: 190, cat: 'grocery', shop: 'greenbasket', emoji: '🍚', tone: 'tone-bottle', badge: '', stock: 21, lowAt: 6, sold: 22 }
];

const CUSTOMER = { id: 'riya', name: 'Riya Sharma', email: 'riya@nearbuy.demo', phone: '98765 43210', initials: 'RS', area: 'Hauz Khas' };
const SELLER = { id: 'owner', name: 'Riya Sharma', role: 'Shop owner', initials: 'RS', shopId: 'greenbasket' };
const RUNNERS = [
  { id: 'runner-rohan', name: 'Rohan Kumar', initials: 'RK', age: 24, mode: 'Walking', zone: 'Hauz Khas', avatar: 'blue' },
  { id: 'runner-meena', name: 'Meena Joshi', initials: 'MJ', age: 31, mode: 'Bicycle', zone: 'Green Park', avatar: 'green' },
  { id: 'runner-farhan', name: 'Farhan Ali', initials: 'FA', age: 21, mode: 'Bicycle', zone: 'Saket', avatar: 'violet' }
];
const OPS_USER = { name: 'Arjun Rao', initials: 'AR', role: 'Ops lead' };
const FLEET_USER = { name: 'Neha Bansal', initials: 'NB', role: 'Fleet lead' };

const AREAS = [
  { id: 'hauz-khas', name: 'Hauz Khas', city: 'Delhi', radius: 2, status: 'Pilot', shops: 12, partners: 4 },
  { id: 'green-park', name: 'Green Park', city: 'Delhi', radius: 2, status: 'Pilot', shops: 8, partners: 3 },
  { id: 'saket', name: 'Saket', city: 'Delhi', radius: 3, status: 'Planning', shops: 5, partners: 2 }
];

const PRICING = [
  { id: 'b1', label: 'Ultra-near', distance: '0–300 m', max: 0.3, pay: 10 },
  { id: 'b2', label: 'Micro', distance: '301–500 m', max: 0.5, pay: 12 },
  { id: 'b3', label: 'Nearby', distance: '501 m–1 km', max: 1, pay: 15 },
  { id: 'b4', label: 'Local', distance: '1–2 km', max: 2, pay: 20 },
  { id: 'b5', label: 'Extended local', distance: '2–3 km', max: 3, pay: 25 }
];

const SEED_ORDERS = [
  {
    id: 'NB-20486', shopId: 'greenbasket', customer: 'Kavya S.', customerId: 'kavya', area: 'Hauz Khas', placed: 'Today, 10:42 am', status: 'Preparing', method: 'Delivery', total: 286,
    items: [{ id: 'p101', name: 'Farm fresh whole milk', qty: 2, price: 34, emoji: '🥛', tone: 'tone-milk' }, { id: 'p102', name: 'Sunrise bananas', qty: 1, price: 42, emoji: '🍌', tone: 'tone-banana' }, { id: 'p103', name: 'Sourdough country loaf', qty: 1, price: 95, emoji: '🍞', tone: 'tone-bread' }, { id: 'p104', name: 'Free range eggs', qty: 1, price: 72, emoji: '🥚', tone: 'tone-egg' }],
    address: 'B-14, Hauz Khas Enclave, New Delhi', taskId: 'DR-1032', timeline: [{ label: 'Order placed', at: 'Today, 10:42 am' }, { label: 'Accepted by shop', at: 'Today, 10:44 am' }, { label: 'Runner requested', at: 'Today, 10:44 am' }]
  },
  {
    id: 'NB-20485', shopId: 'greenbasket', customer: 'Dev M.', customerId: 'dev', area: 'Hauz Khas', placed: 'Today, 10:18 am', status: 'New', method: 'Pickup', total: 175,
    items: [{ id: 'p105', name: 'Seasonal red apples', qty: 1, price: 119, emoji: '🍎', tone: 'tone-apple' }, { id: 'p115', name: 'Fresh spinach bunch', qty: 2, price: 28, emoji: '🥬', tone: 'tone-spinach' }],
    address: 'Collect at Green Basket Market', taskId: null, timeline: [{ label: 'Order placed', at: 'Today, 10:18 am' }]
  },
  {
    id: 'NB-20482', shopId: 'greenbasket', customer: 'Ananya R.', customerId: 'ananya', area: 'Green Park', placed: 'Today, 9:55 am', status: 'Runner assigned', method: 'Delivery', total: 368,
    items: [{ id: 'p116', name: 'Rolled oats', qty: 1, price: 145, emoji: '🥣', tone: 'tone-bread' }, { id: 'p101', name: 'Farm fresh whole milk', qty: 1, price: 34, emoji: '🥛', tone: 'tone-milk' }, { id: 'p117', name: 'Wildflower honey', qty: 1, price: 189, emoji: '🍯', tone: 'tone-banana' }],
    address: 'C-22, Green Park Extension, New Delhi', taskId: 'DR-1031', timeline: [{ label: 'Order placed', at: 'Today, 9:55 am' }, { label: 'Accepted by shop', at: 'Today, 10:02 am' }, { label: 'Runner assigned', at: 'Today, 10:14 am' }]
  },
  {
    id: 'NB-20479', shopId: 'greenbasket', customer: 'Rahul P.', customerId: 'rahul', area: 'Hauz Khas', placed: 'Today, 9:20 am', status: 'Preparing', method: 'Delivery', total: 153,
    items: [{ id: 'p101', name: 'Farm fresh whole milk', qty: 1, price: 34, emoji: '🥛', tone: 'tone-milk' }, { id: 'p105', name: 'Seasonal red apples', qty: 1, price: 119, emoji: '🍎', tone: 'tone-apple' }],
    address: 'A-9, Hauz Khas Village, New Delhi', taskId: null, timeline: [{ label: 'Order placed', at: 'Today, 9:20 am' }, { label: 'Accepted by shop', at: 'Today, 9:26 am' }]
  },
  {
    id: 'NB-20470', shopId: 'greenbasket', customer: 'Mira T.', customerId: 'mira', area: 'Saket', placed: 'Yesterday, 7:46 pm', status: 'Delivered', method: 'Pickup', total: 195,
    items: [{ id: 'p103', name: 'Sourdough country loaf', qty: 1, price: 95, emoji: '🍞', tone: 'tone-bread' }, { id: 'p104', name: 'Free range eggs', qty: 1, price: 72, emoji: '🥚', tone: 'tone-egg' }, { id: 'p115', name: 'Fresh spinach bunch', qty: 1, price: 28, emoji: '🥬', tone: 'tone-spinach' }],
    address: 'Collect at Green Basket Market', taskId: null, timeline: [{ label: 'Order placed', at: 'Yesterday, 7:46 pm' }, { label: 'Collected in store', at: 'Yesterday, 8:12 pm' }]
  },
  {
    id: 'NB-250610-1842', shopId: 'greenbasket', customer: 'Riya Sharma', customerId: 'riya', area: 'Hauz Khas', placed: '10 Jun 2025', status: 'Delivered', method: 'Delivery', total: 199,
    items: [{ id: 'p101', name: 'Farm fresh whole milk', qty: 2, price: 34, emoji: '🥛', tone: 'tone-milk' }, { id: 'p102', name: 'Sunrise bananas', qty: 1, price: 42, emoji: '🍌', tone: 'tone-banana' }, { id: 'p103', name: 'Sourdough country loaf', qty: 1, price: 95, emoji: '🍞', tone: 'tone-bread' }],
    address: 'B-14, Hauz Khas, New Delhi', taskId: null, timeline: [{ label: 'Order placed', at: '10 Jun, 6:12 pm' }, { label: 'Delivered', at: '10 Jun, 6:48 pm' }]
  }
];

const SEED_TASKS = [
  {
    id: 'DR-1032', orderId: 'NB-20486', shop: 'Green Basket Market', shopId: 'greenbasket', shopArea: 'Hauz Khas Market', customer: 'Kavya S.', area: 'Hauz Khas Enclave',
    pickupDistance: 0.1, distance: 0.4, payout: 12, category: 'Grocery', items: 4, weight: 2.4, instructions: 'Ring once. Blue gate beside the chemist.',
    status: 'Requested', pickupPin: '4821', deliveryPin: '7316', createdAt: '2 min ago', partnerId: null, partnerName: null,
    timeline: [{ label: 'Requested by shop', at: '10:44 am' }]
  },
  {
    id: 'DR-1029', orderId: null, shop: 'Paper Lane Books & More', shopId: 'paperlane', shopArea: 'Saket Market', customer: 'Aarav M.', area: 'Deer Park Road',
    pickupDistance: 0.3, distance: 0.8, payout: 15, category: 'Stationery', items: 2, weight: 0.7, instructions: 'Leave with reception if the customer is unavailable.',
    status: 'Requested', pickupPin: '5162', deliveryPin: '2904', createdAt: '6 min ago', partnerId: null, partnerName: null,
    timeline: [{ label: 'Requested by shop', at: '10:38 am' }]
  },
  {
    id: 'DR-1031', orderId: 'NB-20482', shop: 'Green Basket Market', shopId: 'greenbasket', shopArea: 'Hauz Khas Market', customer: 'Ananya R.', area: 'Green Park Extension',
    pickupDistance: 0.2, distance: 1.4, payout: 20, category: 'Grocery', items: 3, weight: 1.9, instructions: 'Call from the lobby; do not use the lift.',
    status: 'At shop', pickupPin: '4093', deliveryPin: '2288', createdAt: '24 min ago', partnerId: 'runner-rohan', partnerName: 'Rohan Kumar',
    timeline: [{ label: 'Requested by shop', at: '10:05 am' }, { label: 'Accepted · Rohan', at: '10:14 am' }, { label: 'Arrived at shop', at: '10:31 am' }]
  },
  {
    id: 'DR-1024', orderId: null, shop: 'The Corner Cart', shopId: 'cornercart', shopArea: 'Malviya Nagar', customer: 'Sana K.', area: 'Greater Kailash',
    pickupDistance: 0.4, distance: 1.9, payout: 20, category: 'General', items: 2, weight: 1.2, instructions: 'Hand over at the door.',
    status: 'Delivered', pickupPin: '3901', deliveryPin: '1487', createdAt: 'Yesterday, 6:02 pm', partnerId: 'runner-rohan', partnerName: 'Rohan Kumar', earned: 20,
    timeline: [{ label: 'Requested', at: '6:02 pm' }, { label: 'Accepted · Rohan', at: '6:06 pm' }, { label: 'Picked up', at: '6:21 pm' }, { label: 'Delivered', at: '6:44 pm' }]
  },
  {
    id: 'DR-1019', orderId: null, shop: 'Green Basket Market', shopId: 'greenbasket', shopArea: 'Hauz Khas Market', customer: 'Nisha D.', area: 'SDA Market',
    pickupDistance: 0.2, distance: 0.9, payout: 12, category: 'Grocery', items: 3, weight: 2.1, instructions: 'Leave at the door.',
    status: 'Delivered', pickupPin: '1122', deliveryPin: '5566', createdAt: 'Yesterday, 1:20 pm', partnerId: 'runner-rohan', partnerName: 'Rohan Kumar', earned: 12,
    timeline: [{ label: 'Requested', at: '1:20 pm' }, { label: 'Accepted · Rohan', at: '1:25 pm' }, { label: 'Delivered', at: '1:52 pm' }]
  }
];

const SEED_PROMOS = [
  { id: 'LP-102', title: 'Neighbourhood welcome', code: 'HELLO10', type: '10% off', status: 'Active', uses: 12, ends: '30 Jun 2025' },
  { id: 'LP-098', title: 'Fresh Friday', code: 'FRESH15', type: '₹15 off above ₹199', status: 'Scheduled', uses: 0, ends: '20 Jun 2025' }
];

const SEED_RETURNS = [
  { id: 'RT-0084', order: 'NB-20452', customer: 'Nisha D.', product: 'Farm fresh whole milk', reason: 'Product arrived damaged', status: 'Needs review', amount: 34, date: 'Today, 9:12 am' },
  { id: 'RT-0081', order: 'NB-20387', customer: 'Arjun K.', product: 'Seasonal red apples', reason: 'Quality concern', status: 'Approved', amount: 119, date: 'Yesterday' }
];

const SEED_AUDIT = [
  { id: 'AUD-100241', action: 'Area reviewed', detail: 'Hauz Khas · 2 km radius · pilot', actor: 'Ops demo', time: 'Today, 9:40 am' },
  { id: 'AUD-100238', action: 'Partner preference', detail: 'Rohan Kumar · walking · max 1.0 km', actor: 'Runner demo', time: 'Today, 9:12 am' },
  { id: 'AUD-100231', action: 'Pricing band viewed', detail: 'Nearby · 501 m–1 km · ₹15', actor: 'Ops demo', time: 'Yesterday, 6:20 pm' }
];

/* ---------------------------------- state ---------------------------------- */
const KEY = 'nearbuy.one.v2';
const DEFAULT_STATE = () => ({
  cart: [{ id: 'p101', qty: 1 }, { id: 'p103', qty: 1 }],
  saved: ['p107', 'p110'],
  catalogue: PRODUCTS.map((p) => ({ ...p })),
  orders: JSON.parse(JSON.stringify(SEED_ORDERS)),
  tasks: JSON.parse(JSON.stringify(SEED_TASKS)),
  runners: RUNNERS.map((r) => ({ ...r, online: r.id === 'runner-rohan', maxKm: r.id === 'runner-rohan' ? 2 : 2, categories: ['Grocery', 'Stationery', 'General'], alerts: true, shareLocation: false })),
  promos: SEED_PROMOS.map((p) => ({ ...p })),
  returns: SEED_RETURNS.map((r) => ({ ...r })),
  incidents: [{ id: 'INC-4821', partnerId: 'runner-rohan', partner: 'Rohan Kumar', task: 'DR-1024', type: 'Route blocked', message: 'Street closed near the market; used the longer lit route.', status: 'Open', date: 'Yesterday, 6:30 pm' }],
  audit: SEED_AUDIT.map((a) => ({ ...a })),
  areas: AREAS.map((a) => ({ ...a })),
  pricing: PRICING.map((p) => ({ ...p })),
  settings: { shopOpen: true, delivery: true, pickup: true, radius: 2, prep: '15–25 min', autoAccept: false, lowStockAlerts: true },
  notifications: [
    { id: 'n1', audience: 'sell', title: 'New order · NB-20486', body: '4 items · ₹286 · Runner delivery', at: '10:42 am', unread: true },
    { id: 'n2', audience: 'sell', title: 'Low stock · Seasonal red apples', body: 'Only 3 left — restock soon.', at: '9:50 am', unread: true },
    { id: 'n3', audience: 'deliver', title: 'Delivery request nearby', body: 'Green Basket Market · 0.4 km · ₹12', at: '2 min ago', unread: true },
    { id: 'n4', audience: 'ops', title: 'Unmatched delivery request', body: 'DR-1032 has no partner for 6 minutes.', at: '10:46 am', unread: true }
  ],
  enquiries: [
    { id: 'ENQ-1041', name: 'Aarti Menon', contact: 'aarti.menon@example.com', topic: 'Fee Structure', message: 'Do you charge a monthly platform fee for neighbourhood shops under ₹1 lakh turnover?', status: 'New', source: 'Homepage', at: 'Yesterday, 5:20 pm', demo: true },
    { id: 'ENQ-1040', name: 'Imran Qureshi', contact: '98••••210', topic: 'Shipping & Delivery', message: 'Can a Runner carry a 3 kg stationery order to Saket?', status: 'Responded', source: 'Homepage', at: '2 days ago', demo: true }
  ],
  orderSeq: 20487,
  onboarding: { seller: sellerBlank(), runner: runnerBlank() }
});

function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_STATE();
    const parsed = JSON.parse(raw);
    const base = DEFAULT_STATE();
    const onboarding = parsed.onboarding && parsed.onboarding.seller
      ? { seller: { ...base.onboarding.seller, ...parsed.onboarding.seller, checks: parsed.onboarding.seller.checks || [] },
          runner: { ...base.onboarding.runner, ...(parsed.onboarding.runner || {}), checks: (parsed.onboarding.runner || {}).checks || [] } }
      : base.onboarding;
    const enquiries = Array.isArray(parsed.enquiries) ? parsed.enquiries : base.enquiries;
    return { ...base, ...parsed, onboarding, enquiries, settings: { ...base.settings, ...(parsed.settings || {}) } };
  } catch { return DEFAULT_STATE(); }
}
const state = loadState();
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch { /* the demo still works without storage */ }
}
const save = persist;

/* The single delivery identity used by the Deliver and Fleet workspaces. */
const me = () => state.runners[0];

/* -------------------------------- selectors -------------------------------- */
const productById = (id) => state.catalogue.find((p) => p.id === id) || state.catalogue[0];
const shopById = (id) => SHOPS.find((s) => s.id === id) || SHOPS[0];
const cartLines = () => state.cart.map((l) => ({ ...productById(l.id), qty: l.qty })).filter((l) => l && l.id);
const cartCount = () => sumBy(state.cart, (l) => l.qty);
const cartSubtotal = () => sumBy(cartLines(), (l) => l.price * l.qty);
const discountFor = (subtotal) => (state.coupon === 'LOCAL10' ? Math.round(subtotal * 0.1) : 0);
const deliveryFeeFor = (subtotal, method) => (method === 'Pickup' || subtotal >= 199 ? 0 : 19);
const savedCount = () => state.saved.length;
const sellerOrders = () => state.orders.filter((o) => o.shopId === SELLER.shopId);
const myOrders = () => state.orders.filter((o) => o.customerId === CUSTOMER.id);
const orderById = (id) => state.orders.find((o) => o.id === id);
const taskById = (id) => state.tasks.find((t) => t.id === id);
const runnerById = (id) => state.runners.find((r) => r.id === id);
const liveTasks = () => state.tasks.filter((t) => !['Delivered', 'Returned', 'Cancelled'].includes(t.status));
const openOrders = () => myOrders().filter((o) => !['Delivered', 'Cancelled'].includes(o.status));
const pendingSellerOrders = () => sellerOrders().filter((o) => ['New', 'Preparing'].includes(o.status));
const runnerQueue = () => state.tasks.filter((t) => t.status === 'Requested' && !(t.skippedBy || []).includes(me().id) && t.distance <= me().maxKm);
const myDeliveries = () => state.tasks.filter((t) => t.partnerId === me().id && t.status !== 'Requested');
const activeDelivery = () => state.tasks.find((t) => t.partnerId === me().id && !['Delivered', 'Returned', 'Cancelled'].includes(t.status));
const earningsFor = (runnerId) => sumBy(state.tasks.filter((t) => t.partnerId === runnerId && t.status === 'Delivered'), (t) => t.earned || t.payout);
const lowStock = () => state.catalogue.filter((p) => p.stock > 0 && p.stock <= p.lowAt);
const outOfStock = () => state.catalogue.filter((p) => p.stock <= 0);
const shopProducts = () => state.catalogue.filter((p) => p.shop === SELLER.shopId);
const todayOrders = () => sellerOrders().filter((o) => String(o.placed).startsWith('Today'));
const sellerRevenue = () => sumBy(sellerOrders().filter((o) => o.status !== 'Cancelled'), (o) => o.total);
const unreadFor = (audience) => state.notifications.filter((n) => n.audience === audience && n.unread);
const openIncidents = () => state.incidents.filter((i) => i.status === 'Open');

/* ------------------------------- tiny helpers ------------------------------ */
function toast(message, iconName = 'checkCircle') {
  const root = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `${icon(iconName)}<span>${esc(message)}</span>`;
  root.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 260); }, 3000);
}
function audit(action, detail, actor = 'NearBuy One') {
  state.audit.unshift({ id: uid('AUD'), action, detail, actor, time: nowLabel() });
  state.audit = state.audit.slice(0, 80);
}
function notify(audience, title, body) {
  state.notifications.unshift({ id: uid('n'), audience, title, body, at: 'Just now', unread: true });
  state.notifications = state.notifications.slice(0, 40);
}
function orderStatusLabel(o) {
  if (o.status === 'Ready') return o.method === 'Pickup' ? 'Ready for pickup' : 'Ready for runner';
  return o.status;
}
const STATUS_TONE = {
  New: 'amber', Preparing: 'blue', Ready: 'violet', 'Runner requested': 'amber', 'Runner assigned': 'blue',
  'Runner at shop': 'violet', 'Out for delivery': 'blue', Delivered: 'green', Returned: 'red', Cancelled: 'red',
  Requested: 'amber', Assigned: 'blue', 'At shop': 'violet', 'Picked up': 'blue', 'En route': 'blue',
  Active: 'green', Scheduled: 'blue', Paid: 'green', Pending: 'amber', Open: 'amber', Resolved: 'green',
  Approved: 'green', 'Needs review': 'amber', Planning: 'amber', Pilot: 'green', Online: 'green', Offline: 'neutral'
};
function pill(text, tone = STATUS_TONE[text] || 'neutral', dot = false) {
  const cls = tone === 'neutral' ? '' : ` pill--${tone}`;
  return `<span class="pill${cls}">${dot ? '<i></i>' : ''}${esc(text)}</span>`;
}
function statusPill(status) { return pill(status, STATUS_TONE[status] || 'neutral', true); }

/* ------------------------------- SVG charts -------------------------------- */
function sparkline(values, opts = {}) {
  const w = opts.w || 110, h = opts.h || 30, pad = 3;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [pad + (i * (w - pad * 2)) / (values.length - 1), h - pad - ((v - min) / span) * (h - pad * 2)]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${w - pad} ${h} L${pad} ${h} Z`;
  return `<div class="sparkline" style="width:${w}px"><svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="none"><path class="area" d="${area}"/><path class="line" d="${line}"${opts.color ? ` style="stroke:${opts.color}"` : ''}/></svg></div>`;
}
function barChart(values, labels, opts = {}) {
  const max = Math.max(...values, 1);
  const height = opts.height || 118;
  return `<div class="bars" style="height:${height}px">${values.map((v, i) => `
    <div class="bars__col" title="${labels[i]}: ${v}">
      <b>${opts.format ? opts.format(v) : v}</b>
      <div class="bars__bar" style="height:${Math.max(4, (v / max) * (height - 34))}px"></div>
      <small>${labels[i]}</small>
    </div>`).join('')}</div>`;
}
function donutChart(segments, centerLabel = '', centerSub = '') {
  const total = sumBy(segments, (s) => s.value) || 1;
  const r = 38, c = 2 * Math.PI * r;
  let acc = 0;
  const arcs = segments.map((s) => {
    const len = (s.value / total) * c;
    const dash = `<circle cx="50" cy="50" r="${r}" fill="none" stroke="${s.color}" stroke-width="13" stroke-dasharray="${len - 3} ${c - len + 3}" stroke-dashoffset="${-acc}" stroke-linecap="round"/>`;
    acc += len;
    return dash;
  }).join('');
  return `<div class="donut">
    <div style="position:relative;width:118px;height:118px;flex:0 0 auto">
      <svg viewBox="0 0 100 100" width="118" height="118"><circle cx="50" cy="50" r="${r}" fill="none" stroke="#f1ebdf" stroke-width="13"/>${arcs}</svg>
      <div style="position:absolute;inset:0;display:grid;place-content:center;text-align:center">
        <b style="font-family:var(--display);font-size:19px;letter-spacing:-.03em;color:var(--ink)">${esc(centerLabel)}</b>
        <small style="font-size:9.5px;color:var(--muted)">${esc(centerSub)}</small>
      </div>
    </div>
    <div class="legend">${segments.map((s) => `<div><i style="background:${s.color}"></i>${esc(s.label)}<b>${num(s.value)}</b></div>`).join('')}</div>
  </div>`;
}

/* ------------------------------ workspace map ------------------------------ */
const SURFACES = {
  shop: {
    label: 'Shop', icon: 'bag', blurb: 'Browse local shops, order, and track every delivery.', persona: 'Customer',
    nav: [
      { group: 'SHOPPING' },
      { view: 'home', label: 'Discover', icon: 'home' },
      { view: 'explore', label: 'Browse everything', icon: 'grid' },
      { view: 'shops', label: 'Local shops', icon: 'store' },
      { view: 'saved', label: 'Saved items', icon: 'heart', count: () => savedCount() },
      { group: 'YOUR ORDERS' },
      { view: 'orders', label: 'Orders & tracking', icon: 'package', count: () => openOrders().length },
      { view: 'cart', label: 'Cart', icon: 'bag', count: () => cartCount() },
      { group: 'ACCOUNT' },
      { view: 'account', label: 'Your account', icon: 'user' },
      { view: 'help', label: 'Help centre', icon: 'help' }
    ],
    mobile: []
  },
  sell: {
    label: 'Sell', icon: 'store', blurb: 'Run your shop: orders, stock, payouts and growth.', persona: 'Green Basket Market',
    nav: [
      { group: 'WORKSPACE' },
      { view: 'overview', label: 'Overview', icon: 'home' },
      { view: 'orders', label: 'Orders', icon: 'clipboard', count: () => sellerOrders().filter((o) => o.status === 'New').length },
      { view: 'catalogue', label: 'Catalogue', icon: 'package' },
      { view: 'inventory', label: 'Inventory & stock', icon: 'archive', count: () => lowStock().length + outOfStock().length },
      { view: 'delivery', label: 'Delivery & pickup', icon: 'truck' },
      { view: 'returns', label: 'Returns & issues', icon: 'refresh' },
      { group: 'GROW THE SHOP' },
      { view: 'payments', label: 'Payments & earnings', icon: 'rupee' },
      { view: 'promotions', label: 'Promotions', icon: 'megaphone' },
      { view: 'insights', label: 'Business insights', icon: 'chart' },
      { group: 'YOUR BUSINESS' },
      { view: 'settings', label: 'Shop settings', icon: 'sliders' },
      { view: 'team', label: 'Team & access', icon: 'users' },
      { view: 'support', label: 'Support & academy', icon: 'help' }
    ],
    mobile: []
  },
  deliver: {
    label: 'Deliver', icon: 'truck', blurb: 'Take nearby deliveries on your own terms.', persona: 'Runner',
    nav: [
      { group: 'TODAY' },
      { view: 'overview', label: 'Runner home', icon: 'home' },
      { view: 'requests', label: 'Delivery requests', icon: 'pin', count: () => runnerQueue().length },
      { view: 'active', label: 'Active delivery', icon: 'zap', count: () => (activeDelivery() ? 1 : 0) },
      { view: 'history', label: 'Delivery history', icon: 'archive' },
      { view: 'earnings', label: 'Earnings', icon: 'rupee' },
      { group: 'YOU' },
      { view: 'profile', label: 'Profile & preferences', icon: 'user' },
      { view: 'safety', label: 'Safety centre', icon: 'shield' },
      { view: 'support', label: 'Help & support', icon: 'help' }
    ],
    mobile: []
  },
  fleet: {
    label: 'Fleet', icon: 'users', blurb: 'Coordinate a neighbourhood delivery team.', persona: 'Hauz Khas Fleet',
    nav: [
      { group: 'FLEET WORKSPACE' },
      { view: 'overview', label: 'Fleet overview', icon: 'home' },
      { view: 'team', label: 'Delivery team', icon: 'users' },
      { view: 'allocation', label: 'Work allocation', icon: 'pin', count: () => state.tasks.filter((t) => t.status === 'Requested').length },
      { view: 'reports', label: 'Reports', icon: 'chart' },
      { group: 'ACCOUNT' },
      { view: 'settings', label: 'Account & safety', icon: 'shield' }
    ],
    mobile: [['overview', 'Overview', 'home'], ['team', 'Team', 'users'], ['allocation', 'Allocate', 'pin'], ['reports', 'Reports', 'chart'], ['settings', 'Safety', 'shield']]
  },
  ops: {
    label: 'Ops', icon: 'shield', blurb: 'The control tower for the whole neighbourhood network.', persona: 'South Delhi Ops',
    nav: [
      { group: 'CONTROL TOWER' },
      { view: 'overview', label: 'Live overview', icon: 'home' },
      { view: 'verifications', label: 'Verifications', icon: 'shield', count: () => opsApplications().filter((a) => !['Approved', 'Rejected'].includes(a.app.status)).length },
      { view: 'enquiries', label: 'Enquiries', icon: 'inbox', count: () => state.enquiries.filter((e) => e.status === 'New').length },
      { view: 'dispatch', label: 'Dispatch', icon: 'pin', count: () => state.tasks.filter((t) => t.status === 'Requested').length },
      { view: 'partners', label: 'Partners', icon: 'users' },
      { group: 'NETWORK SETUP' },
      { view: 'areas', label: 'Service areas', icon: 'grid' },
      { view: 'pricing', label: 'Pricing bands', icon: 'rupee' },
      { view: 'incidents', label: 'Safety & incidents', icon: 'alert', count: () => openIncidents().length },
      { view: 'audit', label: 'Audit log', icon: 'clipboard' }
    ],
    mobile: [['overview', 'Overview', 'home'], ['dispatch', 'Dispatch', 'pin'], ['partners', 'Partners', 'users'], ['incidents', 'Safety', 'alert'], ['audit', 'Audit', 'clipboard']]
  }
};

const route = { surface: 'shop', view: 'home', id: null };
const ui = { drawer: false, modal: null, palette: null, query: '', filters: {}, onboardError: '', signInError: '' };

function readRoute() {
  const raw = location.hash.replace(/^#\/?/, '');
  const hashQuery = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : '';
  const parts = raw.split('?')[0].split('/').filter(Boolean);
  if (hashQuery) {
    const cat = new URLSearchParams(hashQuery).get('cat');
    if (cat) ui.category = cat;
  }
  if (parts.length && SURFACES[parts[0]]) {
    route.surface = parts[0];
    route.view = parts[1] || 'home';
    route.id = parts[2] ? decodeURIComponent(parts.slice(2).join('/')) : null;
  } else {
    route.surface = 'shop'; route.view = 'home'; route.id = null;
  }
  const realViews = SURFACES[route.surface].nav.filter((n) => n.view).map((n) => n.view);
  const detailViews = ['shop', 'product', 'order', 'checkout', 'register'];
  if (!realViews.includes(route.view) && !detailViews.includes(route.view)) {
    route.view = realViews[0] || 'home';
  }
}
function go(surface, view = 'home', id = null) {
  const target = SURFACES[surface] || SURFACES.shop;
  const valid = target.nav.some((n) => n.view === view) || ['shop', 'product', 'order', 'checkout', 'register'].includes(view);
  if (!valid) view = (target.nav.find((n) => n.view) || { view: 'home' }).view;
  const next = `#/${surface}/${view}${id ? `/${encodeURIComponent(id)}` : ''}`;
  if (location.hash === next) { paint(); } else { location.hash = next; }
  ui.drawer = false;
  syncDrawer();
  window.scrollTo({ top: 0 });
}
function currentMeta() { return SURFACES[route.surface]; }
function currentNav() {
  return currentMeta().nav.find((n) => n.view === route.view) || null;
}
const EXTRA_TITLES = { shop: 'Shop details', product: 'Product', order: 'Order', checkout: 'Checkout', register: 'Register' };
function viewTitle() {
  if (route.surface === 'ops' && !adminSession()) return 'Restricted access';
  if (!portalOpen(route.surface) && !portalPublic(route.surface, route.view)) return 'Sign in';
  const nav = currentNav();
  if (nav) return nav.label;
  return EXTRA_TITLES[route.view] || 'Overview';
}

/* --------------------------------- chrome ---------------------------------- */
const LOGO = `<svg class="mark" viewBox="0 0 44 44" aria-hidden="true">
  <defs><linearGradient id="nbMark" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#24467f"/><stop offset="1" stop-color="#0f2a55"/></linearGradient>
  <linearGradient id="nbSwoosh" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff9a3d"/><stop offset="1" stop-color="#ef6c0a"/></linearGradient></defs>
  <path d="M22 4.5c-7.7 0-14 6.1-14 13.6 0 9.6 11 20.4 13.3 22.4a1 1 0 0 0 1.4 0C25 38.5 36 27.7 36 18.1 36 10.6 29.7 4.5 22 4.5Z" fill="url(#nbMark)"/>
  <circle cx="22" cy="18" r="7.4" fill="none" stroke="#fff" stroke-width="3.4"/>
  <path d="M6.5 25.5c5.5 4.6 15 6.6 30.5-1.4" fill="none" stroke="url(#nbSwoosh)" stroke-width="3.6" stroke-linecap="round"/>
</svg>`;

function personaFor(surface) {
  switch (surface) {
    case 'shop': return { name: CUSTOMER.name, sub: `${state.area || 'Hauz Khas'} · customer`, initials: CUSTOMER.initials, avatar: 'orange' };
    case 'sell': return { name: SELLER.name, sub: 'Green Basket Market', initials: SELLER.initials, avatar: 'green' };
    case 'deliver': return { name: me().name, sub: `${me().mode} · ${me().zone}`, initials: me().initials, avatar: 'blue' };
    case 'fleet': return { name: FLEET_USER.name, sub: 'Hauz Khas fleet', initials: FLEET_USER.initials, avatar: 'violet' };
    default: return { name: OPS_USER.name, sub: 'South Delhi ops desk', initials: OPS_USER.initials, avatar: 'sm' };
  }
}
function railHtml() {
  const s = route.surface, meta = SURFACES[s], persona = personaFor(s);
  const locked = (s === 'ops' && !adminSession()) || (!portalOpen(s) && !portalPublic(s, route.view));
  const lockCopy = s === 'ops'
    ? ['CONTROL TOWER', 'Console locked', 'Operations modules stay hidden until the demo access code is entered.']
    : ['THIS PORTAL', 'Sign-in required', `Sign in to the ${portalLabel(s)} portal to open its tools. Other portals stay closed.`];
  const nav = locked ? `<div class="rail__label">${lockCopy[0]}</div>
    <div class="rail__locked">${icon('lock')}<b>${lockCopy[1]}</b><small>${lockCopy[2]}</small></div>`
    : meta.nav.map((item) => {
    if (item.group) return `<div class="rail__label">${item.group}</div>`;
    const count = item.count ? item.count() : 0;
    return `<button class="rail__link ${route.view === item.view ? 'active' : ''}" ${route.view === item.view ? 'aria-current="page"' : ''} data-act="nav" data-surface="${s}" data-view="${item.view}">
      ${icon(item.icon)}<span>${item.label}</span>
      ${count ? `<span class="tail"><span class="count">${count > 99 ? '99+' : count}</span></span>` : ''}
    </button>`;
  }).join('');
  return `<aside class="rail ${ui.drawer ? 'open' : ''}" id="rail">
    <a class="rail__brand" href="#/shop/home" data-act="nav" data-surface="shop" data-view="home" aria-label="NearBuy One home">
      ${LOGO}<span class="word"><b>Near<em>Buy</em></b><small>ONE PORTAL</small></span>
    </a>
    <button class="rail__persona" data-act="account">
      <span class="ava ava--${persona.avatar}">${persona.initials}</span>
      <span class="persona-txt"><b>${esc(persona.name)}</b><small>${esc(persona.sub)}</small></span>
      ${icon('chevronDown', 'sm')}
    </button>
    <div class="rail__portal">${icon(meta.icon)}<span>${esc(meta.label)} workspace</span><small>${esc(portalLabel(s))} portal</small></div>
    <div class="rail__scroll">${nav}</div>
    <div class="rail__foot">
      <button class="rail__link" data-act="sign-out">${icon('logout')}<span>Sign out</span></button>
      <a class="rail__link" href="/classic.html">${icon('store')}<span>Classic storefront</span></a>
      <button class="rail__link" data-act="reset">${icon('refresh')}<span>Reset demo data</span></button>
      <div class="rail__badge"><b>Local demo.</b> Every order, task and payout is simulated in this browser. No real money or dispatch.</div>
    </div>
  </aside>`;
}
function areaLabel() { return state.area || 'Hauz Khas'; }
function topbarHtml() {
  const meta = currentMeta(), persona = personaFor(route.surface);
  const gated = (route.surface === 'ops' && !adminSession()) || (!portalOpen(route.surface) && !portalPublic(route.surface, route.view));
  const bellCount = gated ? 0 : unreadFor(route.surface === 'shop' ? 'shop' : route.surface).length;
  return `<header class="topbar">
    <button class="iconbtn topbar__menu" data-act="drawer" aria-label="Open navigation">${icon('menu')}</button>
    <div class="crumb">
      <span class="ws"><i></i>${esc(meta.label)}</span><span class="slash">/</span><strong>${esc(viewTitle())}</strong>
    </div>
    <div class="topbar__spacer"></div>
    <div class="topbar__tools">
      <span class="pill pill--outline topbar__portal">${icon(meta.icon)} ${esc(portalLabel(route.surface))}</span>
      <button class="searchbtn" data-act="palette" aria-label="Search everything">${icon('search')}<span>Search everything</span><kbd>⌘K</kbd></button>
      ${route.surface === 'shop' ? `
        <button class="pillbtn hide-sm" data-act="area">${icon('pin')}<span>${esc(areaLabel())}</span>${icon('chevronDown', 'sm')}</button>
        <button class="iconbtn" data-act="nav" data-surface="shop" data-view="cart" aria-label="Cart">${icon('bag')}${cartCount() ? `<i class="dot">${cartCount()}</i>` : ''}</button>` : ''}
      ${route.surface === 'ops' ? `<button class="iconbtn" data-act="admin-lock" aria-label="Lock the operations console" title="Lock console">${icon('lock')}</button>` : ''}
      <button class="iconbtn" data-act="inbox" aria-label="Notifications">${icon('bell')}${bellCount ? `<i class="dot">${bellCount}</i>` : ''}</button>
      <button class="avatar-btn" data-act="account">
        <span class="ava ava--${persona.avatar}">${persona.initials}</span>
        <span class="who"><b>${esc(persona.name.split(' ')[0])}</b><small>${esc(meta.label)}</small></span>
      </button>
    </div>
  </header>`;
}
function mobilebarHtml() {
  const items = currentMeta().mobile || [];
  if (!items.length) return '';
  return `<nav class="mobilebar" aria-label="Quick navigation">${items.map(([view, label, ic]) => `
    <button data-act="nav" data-surface="${route.surface}" data-view="${view}" class="${route.view === view ? 'active' : ''}" ${route.view === view ? 'aria-current="page"' : ''}>
      ${icon(ic)}<span>${label}</span>
    </button>`).join('')}</nav>`;
}
function syncDrawer() {
  const rail = $('#rail'), scrim = $('#scrim');
  if (rail) rail.classList.toggle('open', ui.drawer);
  if (scrim) scrim.classList.toggle('show', ui.drawer);
}

/* --------------------------------- overlay -------------------------------- */
function openModal(inner, cls = '') { ui.modal = { inner, cls }; renderOverlay(); }
function closeModal() { ui.modal = null; ui.palette = null; renderOverlay(); }
function renderOverlay() {
  const overlay = $('#overlay');
  if (ui.palette) { overlay.innerHTML = paletteHtml(); return; }
  if (!ui.modal) { overlay.innerHTML = ''; return; }
  overlay.innerHTML = `<div class="backdrop" data-act="backdrop"><section class="modal ${ui.modal.cls}" role="dialog" aria-modal="true">${ui.modal.inner}</section></div>`;
}

/* -------------------------------- palette -------------------------------- */
function paletteIndex() {
  const items = [];
  Object.entries(SURFACES).forEach(([key, s]) => {
    if (key !== route.surface) return;
    s.nav.filter((n) => n.view).forEach((n) => {
      if (['product', 'shop', 'order', 'checkout'].includes(n.view)) return;
      items.push({ group: `Go to ${s.label}`, label: n.label, sub: s.label, icon: n.icon, go: `${key}/${n.view}` });
    });
  });
  state.catalogue.slice(0, 12).forEach((p) => items.push({ group: 'Products', label: p.name, sub: money(p.price), icon: 'bag', go: `shop/product/${p.id}` }));
  SHOPS.forEach((s) => items.push({ group: 'Local shops', label: s.name, sub: s.area, icon: 'store', go: `shop/shop/${s.id}` }));
  state.orders.slice(0, 6).forEach((o) => items.push({ group: 'Orders', label: o.id, sub: `${o.customer} · ${money(o.total)}`, icon: 'package', go: `shop/order/${o.id}` }));
  return items;
}
function paletteMatches() {
  const q = (ui.palette?.q || '').trim().toLowerCase();
  const all = paletteIndex();
  if (!q) return all.filter((i) => ['Go to Shop', 'Go to Sell', 'Go to Deliver', 'Go to Ops'].includes(i.group)).slice(0, 14);
  return all.filter((i) => `${i.label} ${i.sub} ${i.group}`.toLowerCase().includes(q)).slice(0, 12);
}
function paletteHtml() {
  const items = paletteMatches();
  const sel = clamp(ui.palette.idx || 0, 0, Math.max(0, items.length - 1));
  let lastGroup = '';
  const rows = items.map((item, i) => {
    const group = item.group !== lastGroup ? `<div class="palette__group">${esc(item.group)}</div>` : '';
    lastGroup = item.group;
    return `${group}<button class="palette__item ${i === sel ? 'sel' : ''}" data-act="pal-go" data-go="${esc(item.go)}">
      ${icon(item.icon)}<span>${esc(item.label)}</span><small>${esc(item.sub || '')}</small>
    </button>`;
  }).join('');
  return `<div class="backdrop" data-act="backdrop">
    <div class="palette" role="dialog" aria-modal="true" aria-label="Search NearBuy One">
      <div class="palette__input">${icon('search')}
        <input id="paletteInput" type="text" placeholder="Search anything — products, shops, orders, workspaces…" value="${esc(ui.palette.q)}" autocomplete="off" />
        ${icon('command')}
      </div>
      <div class="palette__results">${rows || `<div class="empty" style="padding:26px"><div class="empty__icon">${icon('search')}</div><b>No matches</b><p>Try a product, shop or workspace name.</p></div>`}</div>
      <div class="palette__foot"><span><kbd>↑</kbd><kbd>↓</kbd> to move</span><span><kbd>↵</kbd> to open</span><span><kbd>esc</kbd> to close</span></div>
    </div>
  </div>`;
}
function openPalette() { ui.palette = { q: '', idx: 0 }; renderOverlay(); setTimeout(() => $('#paletteInput')?.focus(), 20); }
function refreshPalette(q) { ui.palette.q = q; ui.palette.idx = 0; renderOverlay(); const input = $('#paletteInput'); if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); } }

/* ------------------------------ common pieces ------------------------------ */
function pageHead(kicker, title, sub = '', actions = '') {
  return `<div class="pagehead">
    <div><span class="kicker"><i></i>${esc(kicker)}</span><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div>
    ${actions ? `<div class="pagehead__actions">${actions}</div>` : ''}
  </div>`;
}
function subHead(title, sub = '', action = '') {
  return `<div class="subhead"><div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div>${action}</div>`;
}
function card({ title = '', sub = '', action = '', body = '', foot = '', cls = '', bodyCls = '' }) {
  return `<section class="card ${cls}">
    ${title ? `<div class="card__head"><div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div>${action}</div>` : ''}
    <div class="card__body ${bodyCls}">${body}</div>
    ${foot ? `<div class="card__foot">${foot}</div>` : ''}
  </section>`;
}
function kpi({ label, value, foot, icon: ic = 'chart', delta = '', dir = 'up', spark = null }) {
  return `<article class="card kpi">
    <span class="kpi__top"><span class="kpi__label">${esc(label)}</span><span class="kpi__icon">${icon(ic)}</span></span>
    <span class="kpi__value">${value}</span>
    <span class="kpi__foot">${delta ? `<span class="delta ${dir === 'down' ? 'down' : dir === 'flat' ? 'flat' : ''}">${dir === 'down' ? '↓' : dir === 'flat' ? '•' : '↑'} ${esc(delta)}</span>` : ''}<span>${foot}</span></span>
    ${spark ? sparkline(spark) : ''}
  </article>`;
}
function emptyState(ic, title, text, action = '') {
  return `<div class="empty"><div class="empty__icon">${icon(ic)}</div><b>${esc(title)}</b><p>${esc(text)}</p>${action}</div>`;
}
function tag(text) { return `<span class="tag">${esc(text)}</span>`; }
function priceBlock(price, mrp) {
  return `<div class="price-block"><b>${money(price)}</b>${mrp > price ? `<del>${money(mrp)}</del>` : ''}${mrp > price ? `<span class="pill pill--green">${Math.round((1 - price / mrp) * 100)}% off</span>` : ''}</div>`;
}
function orderTotals(items, method = 'Delivery') {
  const subtotal = sumBy(items, (i) => i.price * i.qty);
  const discount = discountFor(subtotal);
  const delivery = deliveryFeeFor(subtotal - discount, method);
  const total = subtotal - discount + delivery;
  return { subtotal, discount, delivery, total };
}
function stepper(steps, currentIndex) {
  return `<div class="stepper" style="--steps:${steps.length}">${steps.map((s, i) => `
    <div class="stepper__step ${i < currentIndex ? 'done' : i === currentIndex ? 'now' : ''}"><i></i><small>${esc(s)}</small></div>`).join('')}</div>`;
}
function orderTimeline(order) {
  const steps = ['New', 'Preparing', 'Runner assigned', 'Out for delivery', 'Delivered'];
  const idx = Math.max(0, steps.indexOf(order.status === 'Ready' ? 'Runner assigned' : order.status));
  return stepper(['Placed', 'Preparing', order.method === 'Pickup' ? 'Ready' : 'Runner', order.method === 'Pickup' ? 'Pickup' : 'On the way', 'Delivered'], order.status === 'Delivered' ? 5 : clamp(idx, 1, 4));
}

/* ============================== SHOP WORKSPACE ============================== */
function productCard(p) {
  const shop = shopById(p.shop);
  const saved = state.saved.includes(p.id);
  const out = p.stock <= 0;
  return `<article class="prod">
    <button class="prod__visual ${p.tone}" data-act="nav" data-surface="shop" data-view="product" data-id="${p.id}" aria-label="View ${esc(p.name)}">
      <span class="prod__emoji">${p.emoji}</span>
      ${p.badge ? `<span class="prod__badge">${esc(p.badge)}</span>` : ''}
    </button>
    <button class="prod__save ${saved ? 'on' : ''}" data-act="save" data-id="${p.id}" aria-label="${saved ? 'Remove from' : 'Add to'} saved items">${icon('heart')}</button>
    <div class="prod__body">
      <button class="prod__shop" data-act="nav" data-surface="shop" data-view="shop" data-id="${shop.id}">${icon('pin')}${esc(shop.name)}</button>
      <button class="prod__name" data-act="nav" data-surface="shop" data-view="product" data-id="${p.id}">${esc(p.name)}</button>
      <span class="prod__detail">${esc(p.detail)}</span>
      <div class="prod__foot">
        <div class="prod__price"><b>${money(p.price)}</b>${p.mrp > p.price ? `<del>${money(p.mrp)}</del>` : ''}</div>
        ${out
          ? `<span class="pill pill--red">Sold out</span>`
          : `<button class="prod__add" data-act="add" data-id="${p.id}" aria-label="Add ${esc(p.name)} to cart">${icon('plus')}</button>`}
      </div>
    </div>
  </article>`;
}
function shopCard(shop) {
  const products = state.catalogue.filter((p) => p.shop === shop.id);
  return `<article class="card shop-card">
    <button class="shop-card__cover ${shop.tone}" data-act="nav" data-surface="shop" data-view="shop" data-id="${shop.id}">
      <span class="shop-card__emoji">${shop.emoji}</span>
      <span class="shop-card__open ${shop.open ? '' : 'closed'}">${shop.open ? '● Open now' : 'Opens tomorrow'}</span>
    </button>
    <div class="shop-card__body">
      <div class="shop-card__title"><div><h3>${esc(shop.name)}</h3><small>${esc(shop.cat)}</small></div><span class="rating">${icon('star')}${shop.rating}</span></div>
      <div class="shop-card__meta"><span>${icon('pin')}${shop.area} · ${shop.distance} km</span><span>${icon('clock')}${shop.time}</span></div>
      <p class="shop-card__p">${esc(shop.description)}</p>
      <div class="shop-card__foot">
        <span class="tiny muted">${products.length} items nearby</span>
        <button class="link" data-act="nav" data-surface="shop" data-view="shop" data-id="${shop.id}">Visit shop ${icon('arrowUpRight')}</button>
      </div>
    </div>
  </article>`;
}
function shopHome() {
  const popular = ['p101', 'p102', 'p103', 'p106', 'p110', 'p105', 'p117', 'p107'].map((id) => state.catalogue.find((p) => p.id === id)).filter(Boolean);
  const featured = SHOPS.slice(0, 3);
  const pulse = {
    orders: state.orders.filter((o) => o.status !== 'Delivered' && o.status !== 'Cancelled').length,
    tasks: liveTasks().length,
    online: state.runners.filter((r) => r.online).length
  };
  return `<div class="page">
    <section class="hero">
      <div class="hero__copy">
        <span class="hero__eyebrow"><i></i> ${esc(areaLabel())} · live demo neighbourhood</span>
        <h1>One portal for your <em>whole</em> neighbourhood.</h1>
        <p>Shop the corner shops you love, track your delivery in real time, and see the same order move through the seller, runner and ops workspaces — all in one place.</p>
        <div class="hero__cta">
          <button class="btn btn--primary btn--lg" data-act="nav" data-surface="shop" data-view="explore">Browse nearby ${icon('arrowRight')}</button>
          <button class="btn btn--ghost btn--lg" data-act="nav" data-surface="shop" data-view="orders">${icon('package')} Track your orders</button>
        </div>
        <div class="hero__chips">
          <span class="hero__chip">${icon('checkCircle')} Real neighbourhood shops</span>
          <span class="hero__chip">${icon('checkCircle')} Pickup or local delivery</span>
          <span class="hero__chip">${icon('checkCircle')} One order, one live story</span>
        </div>
      </div>
      <div class="hero__side">
        <form class="hero__search" id="hero-search" data-form="hero-search">
          <label for="heroSearch">FIND SOMETHING NEARBY</label>
          <div class="hero__searchbox">${icon('search')}<input id="heroSearch" name="q" type="search" placeholder="Milk, notebooks, honey…" autocomplete="off" /><button class="btn btn--sm btn--primary" type="submit">Search</button></div>
          <div class="hero__quick">${['Fresh produce', 'Bakery', 'Stationery', 'Home & kitchen'].map((label) => `<button type="button" data-act="quick-search" data-q="${esc(label.split(' ')[0])}">${esc(label)}</button>`).join('')}</div>
        </form>
        <div class="hero__statline">
          <div><b>${SHOPS.length}</b><small>LOCAL SHOPS</small></div>
          <div><b>${state.catalogue.length}</b><small>NEARBY FINDS</small></div>
          <div><b>${pulse.online}</b><small>RUNNERS ONLINE</small>${sparkline([12, 18, 15, 24, 21, 28, 26], { w: 62, h: 18 })}</div>
        </div>
      </div>
    </section>

    <section class="grid grid--4 mb-18">
      ${[
        ['Shops nearby', SHOPS.length, 'store', `in ${esc(areaLabel())}`, 'shops'],
        ['Nearby finds', state.catalogue.length, 'package', 'across groceries, stationery & more', 'explore'],
        ['Open right now', SHOPS.filter((x) => x.open).length, 'clock', 'accepting orders', 'shops'],
        ['Runners online', pulse.online, 'truck', 'for eligible deliveries', 'help']
      ].map(([label, value, ic, foot, view]) => `
        <button class="card kpi" data-act="nav" data-surface="shop" data-view="${view}" style="text-align:left">
          <span class="kpi__top"><span class="kpi__label">${label}</span><span class="kpi__icon">${icon(ic)}</span></span>
          <span class="kpi__value">${value}</span>
          <span class="kpi__foot"><span>${foot}</span>${icon('arrowUpRight', 'sm')}</span>
        </button>`).join('')}
    </section>

    ${subHead('A little bit of everything', 'Shop by what you need — everything nearby, nothing far away.', `<button class="link" data-act="nav" data-surface="shop" data-view="explore">All categories ${icon('arrowRight')}</button>`)}
    <div class="cat-grid mb-18">
      ${CATEGORIES.filter((c) => c.id !== 'all').map((c) => `
        <button class="cat-tile" data-act="category" data-cat="${c.id}">
          <span class="cat-tile__icon">${icon(c.icon)}</span><b>${c.label}</b>
          <small>${state.catalogue.filter((p) => p.cat === c.id).length} finds nearby</small>
        </button>`).join('')}
    </div>

    ${subHead('Good finds, right around you', 'Popular with your neighbours this week.', `<button class="link" data-act="nav" data-surface="shop" data-view="explore">See all ${icon('arrowRight')}</button>`)}
    <div class="prod-grid mb-18">${popular.map(productCard).join('')}</div>

    ${subHead('The people behind the good stuff', 'Real shops, run by people who know your street.', `<button class="link" data-act="nav" data-surface="shop" data-view="shops">All shops ${icon('arrowRight')}</button>`)}
    <div class="grid grid--3 mb-18">${featured.map(shopCard).join('')}</div>

    ${whyUseSection()}

    ${howItWorksStrip()}

    <section class="banner">
      ${icon('sparkles', 'lg')}
      <div><b>Good things are closer than you think.</b><small>Fresh produce, stationery and everyday essentials from ${SHOPS.filter((s) => s.open).length} shops open right now in ${esc(areaLabel())}.</small></div>
      <button class="btn btn--light btn--sm" data-act="nav" data-surface="shop" data-view="explore">Start exploring ${icon('arrowRight')}</button>
    </section>
  </div>`;
}
/* ---- "Why Use NearBuy?" — customer benefits band ---- */
const WHY_USE = [
  { icon: 'pin', title: 'Discover nearby shops', copy: 'Find local stores and businesses around your location, filtered to the area you can actually be served in.', view: 'shops', link: 'See nearby shops' },
  { icon: 'store', title: 'Shop from local stores', copy: 'Explore products from neighbourhood shopkeepers across categories, instead of searching shop by shop.', view: 'explore', link: 'Browse the shelves' },
  { icon: 'search', title: 'Find what you need easily', copy: 'Search, browse and compare eligible nearby stores in one place — with prices side by side.', view: 'explore', link: 'Search everything' },
  { icon: 'truck', title: 'Convenient delivery options', copy: 'Choose a Runner in eligible areas, seller delivery, or free collection from the shop itself.', view: 'cart', link: 'Choose at checkout' },
  { icon: 'heart', title: 'Support local businesses', copy: 'Every order goes to a shop on your street, not a distant warehouse — the shopkeeper keeps the relationship.', view: 'shops', link: 'Meet the shopkeepers' },
  { icon: 'grid', title: 'More local choices', copy: 'Compare different nearby stores and their prices before you commit to one basket.', view: 'explore', link: 'Compare nearby' },
  { icon: 'package', title: 'Track your orders', copy: 'Follow each order and its delivery progress from your customer account, from accepted to delivered.', view: 'orders', link: 'Open your orders' },
  { icon: 'help', title: 'Customer assistance', copy: 'Get help with orders, payments, deliveries and your NearBuy account from the help centre.', view: 'help', link: 'Visit the help centre' }
];

function whyUseSection() {
  return `<section class="why-block why-use" aria-labelledby="whyUseTitle">
    <div class="why-block__head">
      <div class="why-block__copy">
        <span class="kicker kicker--shop"><i></i>WHY USE NEARBUY?</span>
        <p class="why-use__message">Your neighbourhood. Your favourite shops. Everything closer.</p>
        <h2 id="whyUseTitle">Everything you need, closer to home.</h2>
        <p>Discover nearby shops, explore local products and order from the stores in your neighbourhood — all through one convenient platform.</p>
      </div>
      <div class="why-block__actions">
        <button class="btn btn--primary btn--sm" data-act="nav" data-surface="shop" data-view="explore">${icon('bag')} Explore nearby shops</button>
        <span class="tiny muted">One basket, one checkout — from shops around you.</span>
      </div>
    </div>

    <div class="why-grid">
      ${WHY_USE.map((b) => `<article class="why-card">
        <span class="why-card__icon">${icon(b.icon)}</span>
        <div class="why-card__body">
          <div class="why-card__title"><b>${b.title}</b></div>
          <small>${b.copy}</small>
          <button class="link why-card__link" data-act="nav" data-surface="shop" data-view="${b.view}">${b.link} ${icon('arrowRight')}</button>
        </div>
      </article>`).join('')}
    </div>

    <div class="why-use__needs">
      <b class="small">NearBuy brings different neighbourhood shopping needs together</b>
      <div class="why-use__chips">
        <button class="chip" data-act="category" data-cat="grocery">${icon('bag', 'sm')} Grocery &amp; daily essentials</button>
        <button class="chip" data-act="category" data-cat="stationery">${icon('box', 'sm')} Stationery &amp; books</button>
        <button class="chip" data-act="nav" data-surface="shop" data-view="shops">${icon('store', 'sm')} General stores</button>
        <span class="tiny muted">More local categories as the platform expands.</span>
      </div>
    </div>

    <div class="why-use__cta">
      <div>
        <b>Your neighbourhood is closer than you think!</b>
        <small>Discover nearby shops, find products and experience a more connected way to shop locally.</small>
      </div>
      <div class="why-use__cta-actions">
        <span class="why-use__tagline">Shop local. Shop smart. Shop NearBuy.</span>
        <button class="btn btn--primary btn--sm" data-act="nav" data-surface="shop" data-view="explore">Explore nearby shops ${icon('arrowRight')}</button>
      </div>
    </div>

    <div class="why-block__foot">
      ${icon('shield')}
      <p>Delivery is offered <b>where an eligible Runner is available</b>; pickup is always free. Stock and prices are set by each shop and can change. This prototype stores everything in your browser — no real order, payment or delivery takes place.</p>
    </div>
  </section>`;
}

function howItWorksStrip() {
  const steps = [
    ['Discover', 'Find shops and products inside your serviceable area.', 'search'],
    ['Order', 'One basket, one checkout — pickup or delivery.', 'bag'],
    ['Prepare &amp; deliver', 'The shop packs it; a nearby Runner collects it.', 'truck'],
    ['Receive', 'Confirm the handover with your delivery OTP.', 'checkCircle']
  ];
  return `<section class="how-strip mb-18" aria-labelledby="howTitle">
    <div class="between wrap mb-14">
      <div><span class="kicker"><i></i>HOW NEARBUY WORKS</span><h2 id="howTitle" style="font-size:17px;margin-top:6px">From your street to your door in four steps.</h2></div>
      <a class="link" href="/help/">Help centre ${icon('arrowRight')}</a>
    </div>
    <div class="grid grid--4">
      ${steps.map(([title, copy, ic], i) => `<div class="how-step">
        <span class="how-step__num">${i + 1}</span>
        <span class="kpi__icon">${icon(ic)}</span>
        <b>${title}</b>
        <small>${copy}</small>
      </div>`).join('')}
    </div>
  </section>`;
}

function filteredCatalogue() {
  const q = (ui.query || '').trim().toLowerCase();
  let items = state.catalogue.filter((p) => {
    const shop = shopById(p.shop);
    const matchQ = !q || `${p.name} ${p.detail} ${shop.name} ${shop.cat} ${p.id}`.toLowerCase().includes(q);
    const matchCat = !ui.category || ui.category === 'all' || p.cat === ui.category;
    return matchQ && matchCat;
  });
  const sort = ui.sort || 'popular';
  if (sort === 'price-low') items = [...items].sort((a, b) => a.price - b.price);
  else if (sort === 'price-high') items = [...items].sort((a, b) => b.price - a.price);
  else if (sort === 'name') items = [...items].sort((a, b) => a.name.localeCompare(b.name));
  else items = [...items].sort((a, b) => (b.sold || 0) - (a.sold || 0));
  return items;
}
function exploreResults() {
  const items = filteredCatalogue();
  if (!items.length) return emptyState('search', 'Nothing nearby just yet', 'Try a different word, or clear the filters to see every local find.', `<button class="btn btn--ghost btn--sm" data-act="clear-filters">Clear filters</button>`);
  return `<div class="prod-grid">${items.map(productCard).join('')}</div>`;
}
function shopExplore() {
  const items = filteredCatalogue();
  return `<div class="page">
    ${pageHead('BROWSE EVERYTHING NEARBY', 'Every local find, in one place', `Search across ${state.catalogue.length} products from ${SHOPS.length} neighbourhood shops.`, `<button class="btn btn--ghost btn--sm" data-act="nav" data-surface="shop" data-view="cart">${icon('bag')} Cart · ${cartCount()}</button>`)}
    <section class="card mb-18">
      <div class="toolbar">
        <div class="inline-search grow" style="max-width:330px">
          ${icon('search')}<input class="input" id="exploreSearch" type="search" placeholder="Search products, shops, categories…" value="${esc(ui.query || '')}" autocomplete="off" />
        </div>
        <div class="chips">
          ${CATEGORIES.map((c) => `<button class="chip ${(ui.category || 'all') === c.id ? 'active' : ''}" data-act="filter-cat" data-cat="${c.id}">${c.label}</button>`).join('')}
        </div>
        <div class="grow"></div>
        <select class="select" style="width:auto;height:34px" data-act="sort">
          <option value="popular" ${ui.sort === 'popular' ? 'selected' : ''}>Most popular</option>
          <option value="price-low" ${ui.sort === 'price-low' ? 'selected' : ''}>Price: low to high</option>
          <option value="price-high" ${ui.sort === 'price-high' ? 'selected' : ''}>Price: high to low</option>
          <option value="name" ${ui.sort === 'name' ? 'selected' : ''}>Name A–Z</option>
        </select>
      </div>
      <div class="card__body--tight" style="padding:14px 18px 18px">
        <div class="spread mb-10"><span class="tiny muted" id="exploreCount">${items.length} finds · pickup or local delivery</span><span class="tiny muted">Prices include local store pricing</span></div>
        <div id="exploreResults">${exploreResults()}</div>
      </div>
    </section>
  </div>`;
}
function shopShops() {
  return `<div class="page">
    ${pageHead('THE PEOPLE BEHIND THE GOOD STUFF', 'Shops around your corner', 'Every order supports a business on a real street near you.', `<button class="btn btn--ghost btn--sm" data-act="nav" data-surface="shop" data-view="explore">${icon('grid')} Browse products</button>`)}
    <div class="grid grid--2 mb-18">${SHOPS.map(shopCard).join('')}</div>
    ${card({ title: 'Why shop local on NearBuy?', sub: 'A small radius with a big difference.', body: `<div class="grid grid--3">${[
      ['store', 'Real shops, real people', 'Every product comes from a store on a street you know.'],
      ['truck', 'Pickup or local delivery', 'Choose how your order reaches you — free pickup or nearby delivery.'],
      ['heart', 'Money stays nearby', 'Local businesses keep the neighbourhood thriving.']
    ].map(([ic, t, s]) => `<div class="mini-stat"><span class="kpi__icon">${icon(ic)}</span><div><b>${t}</b><small>${s}</small></div></div>`).join('')}</div>` })}
  </div>`;
}
function shopDetail(id) {
  const shop = shopById(id);
  const items = state.catalogue.filter((p) => p.shop === shop.id);
  const following = (state.followed || []).includes(shop.id);
  return `<div class="page">
    <button class="backlink" data-act="nav" data-surface="shop" data-view="shops">${icon('chevronLeft')} All local shops</button>
    <section class="shophero ${shop.tone}" style="border:1px solid var(--line)">
      <span class="shophero__emoji">${shop.emoji}</span>
      <div class="shophero__body">
        <span class="kicker" style="margin:0"><i></i>${esc(shop.area)} · ${shop.distance} km away</span>
        <h1>${esc(shop.name)}</h1>
        <p class="small" style="color:#55617a;max-width:52ch">${esc(shop.description)}</p>
        <div class="shophero__meta">
          <span>${icon('star')} ${shop.rating} rating</span>
          <span>${icon('clock')} ${shop.time}</span>
          <span>${icon('truck')} Pickup & local delivery</span>
          <span>${icon('shield')} ${shop.open ? 'Open now' : 'Closed today'}</span>
        </div>
      </div>
    </section>
    <div class="grid grid--aside">
      <div class="stack">
        ${subHead(`${items.length} nearby finds`, 'Sorted by what your neighbours love most.')}
        <div class="prod-grid">${items.map(productCard).join('')}</div>
      </div>
      <aside class="stack">
        ${card({ title: 'Shop details', body: `<div class="stack-sm">
          <div class="spread small"><span class="muted">Category</span><b>${esc(shop.cat)}</b></div>
          <div class="spread small"><span class="muted">Neighbourhood</span><b>${esc(shop.area)}</b></div>
          <div class="spread small"><span class="muted">Distance</span><b>${shop.distance} km</b></div>
          <div class="spread small"><span class="muted">Typical delivery</span><b>${shop.time}</b></div>
          <div class="spread small"><span class="muted">Payments</span><b>Demo only</b></div>
          <hr class="hr" />
          <button class="btn ${following ? 'btn--soft' : 'btn--ghost'} btn--block" data-act="follow" data-id="${shop.id}">${icon('heart')} ${following ? 'Following this shop' : 'Follow this shop'}</button>
          <p class="hint">Followed shops appear in your account and can notify you about new finds.</p>
        </div>` })}
        ${card({ title: 'This shop runs on NearBuy Sell', sub: 'The circle stays unbroken.', body: `<p class="small muted">Every order you place here appears instantly in the seller workspace — with stock, payouts and a runner request attached.</p><button class="btn btn--ghost btn--sm btn--block mt-10" data-act="switch" data-surface="sell">${icon('store')} Open the seller view</button>` })}
      </aside>
    </div>
  </div>`;
}
function shopProduct(id) {
  const p = productById(id);
  const shop = shopById(p.shop);
  const saved = state.saved.includes(p.id);
  const related = state.catalogue.filter((x) => x.shop === p.shop && x.id !== p.id).slice(0, 4);
  const qty = ui.qty || 1;
  return `<div class="page">
    <button class="backlink" data-act="nav" data-surface="shop" data-view="explore">${icon('chevronLeft')} All local finds</button>
    <div class="grid grid--aside mb-18">
      <div class="stack">
        <div class="pdp__visual ${p.tone}"><span class="pdp__emoji">${p.emoji}</span></div>
        <div class="grid grid--3">
          ${[['Freshness', 'Picked this morning'], ['Local shop', shop.name], ['Fulfilment', 'Pickup or delivery']].map(([k, v]) => `<div class="mini-stat">${icon('checkCircle')}<div><b>${esc(v)}</b><small>${k}</small></div></div>`).join('')}
        </div>
        ${card({ title: 'About this find', body: `<p class="small muted" style="line-height:1.65">${esc(p.detail)}. Sourced by ${esc(shop.name)} in ${esc(shop.area)}, ${shop.distance} km from you. Stock is updated by the shop in the Seller workspace, so what you see is what is on the shelf.</p>
          <div class="stat-strip mt-14">
            <div><b>${p.stock > 0 ? p.stock : '0'}</b><small>In stock now</small></div>
            <div><b>${shop.rating}</b><small>Shop rating</small></div>
            <div><b>${shop.time}</b><small>Typical delivery</small></div>
          </div>` })}
      </div>
      <aside class="stack">
        <div class="card card--pad">
          <button class="prod__shop mb-6" data-act="nav" data-surface="shop" data-view="shop" data-id="${shop.id}">${icon('pin')}${esc(shop.name)} · ${shop.distance} km</button>
          <h1 style="font-size:24px;letter-spacing:-.035em">${esc(p.name)}</h1>
          <p class="small muted" style="margin:4px 0 12px">${esc(p.detail)}</p>
          <div class="price-block mb-14"><b>${money(p.price)}</b>${p.mrp > p.price ? `<del>${money(p.mrp)}</del><span class="pill pill--green">Save ${money(p.mrp - p.price)}</span>` : ''}</div>
          ${p.stock > 0 ? `<div class="row gap-10 mb-14">
            <div class="qty"><button data-act="qty" data-delta="-1" aria-label="Decrease quantity">${icon('minus')}</button><span>${qty}</span><button data-act="qty" data-delta="1" aria-label="Increase quantity">${icon('plus')}</button></div>
            <button class="btn btn--primary flex1" data-act="add" data-id="${p.id}" data-qty="${qty}">${icon('bag')} Add to cart · ${money(p.price * qty)}</button>
          </div>` : `<div class="row gap-10 mb-14"><span class="pill pill--red">Sold out right now</span><span class="tiny muted">The shop updates stock in the Sell workspace.</span></div>`}
          <button class="btn btn--ghost btn--block mb-10 ${saved ? 'btn--soft' : ''}" data-act="save" data-id="${p.id}">${icon('heart')} ${saved ? 'Saved for later' : 'Save for later'}</button>
          <div class="notice notice--plain">${icon('shield')}<span>Demo storefront — no payment is taken and no real order is sent to the shop.</span></div>
        </div>
        ${card({ title: 'Pickup or delivery', body: `<div class="stack-sm">
          <div class="radio-card on"><input type="radio" checked disabled /><div><b>Local delivery · from ₹0</b><small>Free above ₹199 · 15–35 min by nearby shop</small></div></div>
          <div class="radio-card"><input type="radio" disabled /><div><b>Pickup · always free</b><small>Collect from ${esc(shop.area)} when ready</small></div></div>
        </div>` })}
        ${card({ title: 'Stock moves with the shop', sub: 'One catalogue, everywhere.', body: `<p class="small muted">This product lives in the Seller workspace catalogue. Change its stock there and this page updates instantly.</p><button class="btn btn--ghost btn--sm btn--block mt-10" data-act="switch" data-surface="sell" data-view="inventory">${icon('archive')} Check inventory</button>` })}
      </aside>
    </div>
    ${subHead('More from this shop', '', `<button class="link" data-act="nav" data-surface="shop" data-view="shop" data-id="${shop.id}">Visit shop ${icon('arrowRight')}</button>`)}
    <div class="prod-grid">${related.map(productCard).join('')}</div>
  </div>`;
}
function shopCart() {
  const lines = cartLines();
  const totals = orderTotals(lines, 'Delivery');
  if (!lines.length) return `<div class="page">${pageHead('YOUR CART', 'Your cart', 'One small bag of good things from nearby.')}${card({ body: emptyState('bag', 'Your cart is empty', 'Fill it with something from a shop around the corner.', `<button class="btn btn--primary btn--sm" data-act="nav" data-surface="shop" data-view="explore">Browse local finds ${icon('arrowRight')}</button>`) })}</div>`;
  return `<div class="page">
    ${pageHead('YOUR CART', `Your cart · ${cartCount()} item${cartCount() > 1 ? 's' : ''}`, 'Change quantities, then choose pickup or delivery at checkout.')}
    <div class="grid grid--aside">
      <section class="card card--flush">
        ${lines.map((l) => `<div class="cartline">
          <div class="cartline__visual ${l.tone}">${l.emoji}</div>
          <div class="cartline__main"><b>${esc(l.name)}</b><small>${esc(l.detail)} · ${esc(shopById(l.shop).name)}</small>
            <div class="row gap-10 mt-6"><span class="tiny muted">${money(l.price)} each</span>
              <div class="qty" style="transform:scale(.92);transform-origin:left"><button data-act="cart-qty" data-id="${l.id}" data-delta="-1" aria-label="Decrease quantity for ${esc(l.name)}">${icon('minus')}</button><span>${l.qty}</span><button data-act="cart-qty" data-id="${l.id}" data-delta="1" aria-label="Increase quantity for ${esc(l.name)}">${icon('plus')}</button></div>
            </div>
          </div>
          <div class="cartline__end"><span class="cartline__total">${money(l.price * l.qty)}</span><button class="iconlink" data-act="cart-remove" data-id="${l.id}" aria-label="Remove ${esc(l.name)}">${icon('x')}</button></div>
        </div>`).join('')}
        <div class="card__foot between"><button class="link" data-act="nav" data-surface="shop" data-view="explore">${icon('chevronLeft')} Keep shopping</button><span class="tiny muted">Delivery fee is free above ${money(199)}</span></div>
      </section>
      <aside class="card card--pad summary">
        <h2 style="font-size:15px">Order summary</h2>
        <div class="summary__row"><span>Subtotal</span><b>${money(totals.subtotal)}</b></div>
        <div class="summary__row"><span>Local delivery</span><b>${totals.delivery ? money(totals.delivery) : 'Free'}</b></div>
        <div class="summary__row"><span>Coupon</span><b>Apply at checkout</b></div>
        <div class="summary__total"><span>Total</span><span>${money(totals.total)}</span></div>
        <button class="btn btn--primary btn--block mt-6" data-act="nav" data-surface="shop" data-view="checkout">Go to checkout ${icon('arrowRight')}</button>
        <p class="hint" style="text-align:center">Demo checkout · no payment method is charged.</p>
        <hr class="hr" />
        <div class="row gap-8 tiny muted">${icon('shield', 'sm')} Secure, local and simulated end to end.</div>
      </aside>
    </div>
  </div>`;
}
function shopCheckout() {
  const lines = cartLines();
  if (!lines.length) return `<div class="page">${pageHead('CHECKOUT', 'Nothing to check out yet', '')}${card({ body: emptyState('bag', 'Your cart is empty', 'Add something nearby, then come back.', `<button class="btn btn--primary btn--sm" data-act="nav" data-surface="shop" data-view="explore">Browse local finds</button>`) })}</div>`;
  const method = ui.method || 'Delivery';
  const totals = orderTotals(lines, method);
  const address = state.address || 'B-14, Hauz Khas, New Delhi';
  return `<div class="page">
    ${pageHead('CHECKOUT · DEMO', 'Almost at your doorstep', 'Review the order, pick pickup or delivery, and place it. The whole neighbourhood will see it move.', `<button class="btn btn--ghost btn--sm" data-act="nav" data-surface="shop" data-view="cart">${icon('chevronLeft')} Back to cart</button>`)}
    <form id="checkoutForm" class="grid grid--aside" data-method="${method}">
      <div class="stack">
        ${card({ title: '1 · How should it reach you?', body: `<div class="grid grid--2">
          ${[['Delivery', 'truck', 'Local delivery', totals.subtotal >= 199 ? 'Free · above ₹199' : `${money(19)} · nearby shop`], ['Pickup', 'store', 'Pickup', 'Always free · collect in store']].map(([value, ic, title, sub]) => `
            <label class="radio-card ${method === value ? 'on' : ''}">
              <input type="radio" name="method" value="${value}" ${method === value ? 'checked' : ''} data-act="method" />
              <span class="kpi__icon" style="width:28px;height:28px">${icon(ic)}</span>
              <span><b>${title}</b><small>${sub}</small></span>
            </label>`).join('')}
        </div>` })}
        ${method === 'Delivery' ? card({ title: '2 · Where should it go?', body: `<div class="form-grid">
          <div class="form-grid form-grid--2">
            <label class="field"><span>Full name</span><input class="input" type="text" name="name" value="${esc(CUSTOMER.name)}" required /></label>
            <label class="field"><span>Phone</span><input class="input" type="text" name="phone" value="${esc(CUSTOMER.phone)}" required /></label>
          </div>
          <label class="field"><span>Delivery address</span><textarea class="textarea" name="address" required style="min-height:64px">${esc(address)}</textarea></label>
          <label class="field"><span>Neighbourhood</span><select class="select" name="area">${['Hauz Khas', 'Green Park', 'Saket', 'Greater Kailash'].map((a) => `<option ${a === areaLabel() ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
        </div>` }) : card({ title: '2 · Collect in store', body: `<div class="row gap-10"><span class="kpi__icon">${icon('store')}</span><div><b>Green Basket Market</b><div class="tiny muted">Hauz Khas Market · ready in 15–25 min · bring your demo order ID</div></div></div>` })}
        ${card({ title: '3 · Payment', sub: 'Demonstration only — nothing is charged.', body: `<div class="grid grid--3">
          ${[['UPI', 'phone'], ['Card', 'wallet'], ['Pay at pickup', 'store']].map(([label, ic], i) => `<label class="radio-card ${i === 0 ? 'on' : ''}"><input type="radio" name="pay" value="${label}" ${i === 0 ? 'checked' : ''} /><span class="kpi__icon" style="width:26px;height:26px">${icon(ic)}</span><span><b>${label}</b><small>Demo</small></span></label>`).join('')}
        </div>` })}
      </div>
      <aside class="stack">
        <section class="card card--pad summary">
          <h2 style="font-size:15px">Your order</h2>
          <div class="rows" style="margin:0 -6px">
            ${lines.map((l) => `<div class="row gap-10" style="padding:7px 6px"><span class="order-mini" style="width:30px"><span class="${l.tone}">${l.emoji}</span></span><span class="small flex1 clamp1">${esc(l.name)} <span class="muted">× ${l.qty}</span></span><b class="small">${money(l.price * l.qty)}</b></div>`).join('')}
          </div>
          <hr class="hr" />
          <div class="coupon">
            <input class="input" type="text" name="coupon" id="couponInput" placeholder="Coupon code" value="${esc(state.coupon || '')}" />
            <button class="btn btn--ghost btn--sm" type="button" data-act="coupon">Apply</button>
          </div>
          <p class="hint">Try <b>LOCAL10</b> for 10% off this demo order.</p>
          <div class="summary__row"><span>Subtotal</span><b>${money(totals.subtotal)}</b></div>
          ${totals.discount ? `<div class="summary__row"><span>LOCAL10 discount</span><b style="color:var(--green)">−${money(totals.discount)}</b></div>` : ''}
          <div class="summary__row"><span>${method === 'Pickup' ? 'Pickup' : 'Local delivery'}</span><b>${totals.delivery ? money(totals.delivery) : 'Free'}</b></div>
          <div class="summary__total"><span>Total</span><span>${money(totals.total)}</span></div>
          <button class="btn btn--primary btn--block mt-6" type="submit">${icon('checkCircle')} Place demo order</button>
          <p class="hint" style="text-align:center">This creates a real-looking order in the demo and appears in the seller workspace.</p>
        </section>
        <div class="notice">${icon('shield')}<span>No payment is taken, no shop is contacted and no runner is dispatched. All data stays in this browser.</span></div>
      </aside>
    </form>
  </div>`;
}
function orderCard(order) {
  return `<article class="card ordercard">
    <div class="ordercard__top">
      <div class="row gap-10">
        <span class="avatar-mini">${icon('package')}</span>
        <div><div class="ordercard__id">${esc(order.id)}</div><div class="tiny muted">${esc(order.placed)} · ${esc(order.method)}</div></div>
      </div>
      <div class="row gap-8">${statusPill(orderStatusLabel(order))}<b class="small">${money(order.total)}</b></div>
    </div>
    <div class="order-mini">${order.items.slice(0, 5).map((i) => `<span class="${i.tone || ''}">${i.emoji}</span>`).join('')}<span class="tiny muted" style="width:auto;background:none;font-size:11px">${order.items.length} item${order.items.length > 1 ? 's' : ''}</span></div>
    ${orderTimeline(order)}
    <div class="spread">
      <span class="tiny muted">${order.items.map((i) => `${i.name} ×${i.qty}`).join(' · ').slice(0, 62)}${order.items.map((i) => i.name).join('').length > 62 ? '…' : ''}</span>
      <button class="btn btn--ghost btn--xs" data-act="nav" data-surface="shop" data-view="order" data-id="${order.id}">Track order ${icon('arrowRight')}</button>
    </div>
  </article>`;
}
function shopOrders() {
  const orders = myOrders();
  const live = orders.filter((o) => !['Delivered', 'Cancelled'].includes(o.status));
  const past = orders.filter((o) => ['Delivered', 'Cancelled'].includes(o.status));
  return `<div class="page">
    ${pageHead('YOUR ORDERS', 'Orders & tracking', 'Follow every order from the shop shelf to your door.', `<button class="btn btn--ghost btn--sm" data-act="nav" data-surface="shop" data-view="explore">${icon('bag')} Shop again</button>`)}
    ${live.length ? subHead(`${live.length} order${live.length > 1 ? 's' : ''} in motion`, 'Live status, updated by the shop and runner workspaces.') : ''}
    ${live.length ? `<div class="stack mb-18">${live.map(orderCard).join('')}</div>` : ''}
    ${live.length ? '' : card({ body: emptyState('package', 'No orders in motion', 'Your next local find is a few clicks away.', `<button class="btn btn--primary btn--sm" data-act="nav" data-surface="shop" data-view="explore">Browse nearby</button>`) })}
    ${past.length ? subHead('Order history', 'Delivered and past demo orders.') + `<div class="stack">${past.map(orderCard).join('')}</div>` : ''}
  </div>`;
}
function shopOrder(id) {
  const order = orderById(id);
  if (!order) return `<div class="page">${pageHead('ORDER', 'Order not found', '')}${card({ body: emptyState('alert', 'We could not find that order', 'It may have been created in a different browser session.', `<button class="btn btn--ghost btn--sm" data-act="nav" data-surface="shop" data-view="orders">Back to orders</button>`) })}</div>`;
  const task = order.taskId ? taskById(order.taskId) : null;
  const orderSubtotal = sumBy(order.items, (i) => i.price * i.qty);
  const orderDelivery = Math.max(0, order.total - orderSubtotal);
  const totals = { subtotal: orderSubtotal, delivery: orderDelivery };
  return `<div class="page">
    <button class="backlink" data-act="nav" data-surface="shop" data-view="orders">${icon('chevronLeft')} All orders</button>
    ${pageHead(order.method === 'Pickup' ? 'PICKUP ORDER' : 'DELIVERY ORDER', order.id, `${esc(order.placed)} · ${esc(order.method)} · ${esc(order.area)}`, `${statusPill(orderStatusLabel(order))}`)}
    <div class="grid grid--aside">
      <div class="stack">
        ${card({ title: order.method === 'Pickup' ? 'Pickup progress' : 'Delivery progress', sub: task ? `Runner task ${task.id} · ${task.partnerName || 'awaiting a runner'}` : 'Tracked by the shop workspace', body: `${orderTimeline(order)}<div class="timeline mt-14">${(order.timeline || []).slice().reverse().map((t, i) => `<div class="timeline__row ${i === 0 ? 'now' : 'done'}"><span class="timeline__dot">${icon(i === 0 ? 'clock' : 'check')}</span><div class="timeline__body"><b>${esc(t.label)}</b><small>${esc(t.at)}</small></div></div>`).join('')}</div>` })}
        ${card({ title: 'Items in this order', body: `<div class="rows" style="margin:-6px -8px">${order.items.map((i) => `<div class="row gap-10" style="padding:7px 8px"><span class="cartline__visual ${i.tone || ''}" style="width:38px;height:38px;font-size:18px">${i.emoji}</span><div class="flex1"><b class="small">${esc(i.name)}</b><div class="tiny muted">Qty ${i.qty} · ${money(i.price)} each</div></div><b class="small">${money(i.price * i.qty)}</b></div>`).join('')}</div><hr class="hr" /><div class="summary__row"><span>Subtotal</span><b>${money(totals.subtotal)}</b></div><div class="summary__row"><span>Delivery</span><b>${totals.delivery ? money(totals.delivery) : 'Free'}</b></div><div class="summary__total"><span>Total paid in demo</span><span>${money(order.total)}</span></div>` })}
      </div>
      <aside class="stack">
        ${card({ title: order.method === 'Pickup' ? 'Collect from' : 'Delivering to', body: `<div class="row gap-10"><span class="kpi__icon">${icon(order.method === 'Pickup' ? 'store' : 'pin')}</span><div><b class="small">${esc(order.method === 'Pickup' ? 'Green Basket Market' : CUSTOMER.name)}</b><div class="tiny muted">${esc(order.address)}</div></div></div>` })}
        ${card({ title: 'Follow this order across NearBuy', sub: 'One record, every workspace.', body: `<p class="small muted">This exact order is visible to the shop and, when a runner is involved, to the delivery network.</p>
          <div class="stack-sm mt-10">
            <button class="btn btn--ghost btn--sm btn--block" data-act="switch" data-surface="sell" data-view="orders">${icon('store')} See it in Sell</button>
            <button class="btn btn--ghost btn--sm btn--block" data-act="switch" data-surface="deliver" data-view="requests">${icon('truck')} See it in Deliver</button>
            <button class="btn btn--ghost btn--sm btn--block" data-act="switch" data-surface="ops" data-view="dispatch">${icon('shield')} See it in Ops</button>
          </div>` })}
        ${order.status === 'New' || order.status === 'Preparing' ? `<section class="card card--pad"><h2 style="font-size:14px">Need to change something?</h2><p class="small muted mt-6">The shop has not handed this order over yet. In the demo you can cancel it and it will update everywhere.</p><button class="btn btn--danger btn--sm btn--block mt-10" data-act="cancel-order" data-id="${order.id}">${icon('x')} Cancel this order</button></section>` : ''}
        ${card({ body: `<div class="row gap-8 small"><span class="kpi__icon">${icon('help')}</span><div><b>Need help with this order?</b><div class="tiny muted">A demo support note can be saved in your account.</div></div></div><button class="btn btn--soft btn--sm btn--block mt-10" data-act="nav" data-surface="shop" data-view="help">Open help centre</button>` })}
      </aside>
    </div>
  </div>`;
}
function shopSaved() {
  const items = state.saved.map((id) => state.catalogue.find((p) => p.id === id)).filter(Boolean);
  return `<div class="page">
    ${pageHead('SAVED FOR LATER', 'Saved items', 'A little shelf of things you liked around the corner.', `<button class="btn btn--ghost btn--sm" data-act="nav" data-surface="shop" data-view="explore">${icon('grid')} Keep browsing</button>`)}
    ${items.length ? `<div class="prod-grid">${items.map(productCard).join('')}</div>` : card({ body: emptyState('heart', 'Nothing saved yet', 'Tap the heart on any product to keep it here for later.', `<button class="btn btn--primary btn--sm" data-act="nav" data-surface="shop" data-view="explore">Find something nearby</button>`) })}
  </div>`;
}
const ACCOUNT_TABS = [['profile', 'Profile', 'user'], ['addresses', 'Addresses', 'pin'], ['payments', 'Payments', 'wallet'], ['notifications', 'Notifications', 'bell'], ['followed', 'Followed shops', 'heart'], ['reviews', 'Reviews', 'star']];
function shopAccount() {
  const tab = ui.accountTab || 'profile';
  const notes = state.notifications.filter((n) => n.audience === 'shop');
  const followed = SHOPS.filter((s) => (state.followed || []).includes(s.id));
  const body = {
    profile: `<div class="form-grid">
        <div class="form-grid form-grid--2">
          <label class="field"><span>Full name</span><input class="input" type="text" name="name" value="${esc(CUSTOMER.name)}" data-act="profile-save" /></label>
          <label class="field"><span>Phone</span><input class="input" type="text" name="phone" value="${esc(CUSTOMER.phone)}" data-act="profile-save" /></label>
        </div>
        <label class="field"><span>Neighbourhood</span><select class="select" name="area" data-act="area-set">${['Hauz Khas', 'Green Park', 'Saket', 'Greater Kailash'].map((a) => `<option ${a === areaLabel() ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
        <div class="notice notice--plain">${icon('shield')}<span>This is a demo account. Details are stored only in this browser.</span></div>
      </div>`,
    addresses: `<div class="stack-sm">
        <div class="radio-card on"><input type="radio" checked /><div><b>Home · ${esc(CUSTOMER.name)}</b><small>${esc(state.address || 'B-14, Hauz Khas, New Delhi')} · default</small></div></div>
        <div class="radio-card"><input type="radio" /><div><b>Work</b><small>3rd floor, South Delhi · demo address</small></div></div>
        <button class="btn btn--ghost btn--sm" data-act="address-demo">${icon('plus')} Add a demo address</button>
      </div>`,
    payments: `<div class="stack-sm">
        <div class="row gap-10"><span class="kpi__icon">${icon('phone')}</span><div class="flex1"><b class="small">UPI · demo@upi</b><div class="tiny muted">Default demo payment method</div></div>${pill('Demo', 'outline')}</div>
        <div class="row gap-10"><span class="kpi__icon">${icon('wallet')}</span><div class="flex1"><b class="small">Card ending 4242</b><div class="tiny muted">Expires 08/28 · sample only</div></div>${pill('Demo', 'outline')}</div>
        <div class="notice notice--plain">${icon('lock')}<span>No card details are collected and no payment is ever processed in this demo.</span></div>
      </div>`,
    notifications: notes.length ? `<div class="rows" style="margin:-16px -18px">${notes.map((n) => `<div class="list-row"><span class="kpi__icon">${icon('bell')}</span><div class="list-row__main"><b>${esc(n.title)}</b><small>${esc(n.body)}</small></div><div class="list-row__end"><span class="tiny muted">${esc(n.at)}</span>${n.unread ? pill('New', 'amber') : ''}</div></div>`).join('')}</div>` : emptyState('bell', 'You are all caught up', 'Order updates will appear here.'),
    followed: followed.length ? `<div class="grid grid--2">${followed.map(shopCard).join('')}</div>` : emptyState('heart', 'Not following any shops yet', 'Follow a shop from its page to see it here.'),
    reviews: `<div class="rows" style="margin:-16px -18px">${[['Sourdough country loaf', 5, 'Still warm when it arrived. Perfect with breakfast.'], ['Everyday ruled notebook', 4, 'Good paper, lovely little neighbourhood shop.']].map(([name, stars, text]) => `<div class="list-row"><span class="kpi__icon">${icon('star')}</span><div class="list-row__main"><b>${name} · ${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}</b><small>${text}</small></div><div class="list-row__end">${pill('Private demo', 'outline')}</div></div>`).join('')}</div>`
  }[tab];
  return `<div class="page">
    ${pageHead('YOUR ACCOUNT', `Hello, ${esc(CUSTOMER.name.split(' ')[0])}`, 'Profile, addresses, payments and the shops you follow.')}
    <div class="grid grid--aside">
      <div class="stack">
        <section class="card"><div class="toolbar" style="gap:4px">${ACCOUNT_TABS.map(([key, label, ic]) => `<button class="chip ${tab === key ? 'active' : ''}" data-act="account-tab" data-tab="${key}">${icon(ic)} ${label}</button>`).join('')}</div><div class="card__body">${body}</div></section>
      </div>
      <aside class="stack">
        <section class="card card--pad">
          <div class="row gap-10 mb-14"><span class="ava ava--orange" style="--s:46px">${CUSTOMER.initials}</span><div><b>${esc(CUSTOMER.name)}</b><div class="tiny muted">${esc(CUSTOMER.email)}</div></div></div>
          <div class="stat-strip"><div><b>${myOrders().length}</b><small>Orders</small></div><div><b>${savedCount()}</b><small>Saved</small></div><div><b>${followed.length}</b><small>Following</small></div></div>
          <hr class="hr" />
          <div class="stack-sm">
            <button class="btn btn--ghost btn--sm btn--block" data-act="switch" data-surface="sell">${icon('store')} Switch to your shop</button>
            <button class="btn btn--ghost btn--sm btn--block" data-act="switch" data-surface="deliver">${icon('truck')} Switch to Runner</button>
          </div>
        </section>
        <section class="card card--pad">
          <span class="kicker"><i></i>ONE PORTAL, ONE IDENTITY</span>
          <p class="small muted">The same neighbourhood account powers shopping, selling and delivering. Switch workspaces without losing context.</p>
        </section>
      </aside>
    </div>
  </div>`;
}
function shopHelp() {
  const faqs = [
    ['How does local delivery work?', 'A nearby shop prepares your order, a Runner picks it up, and you get a delivery OTP to confirm hand-over. Every step is simulated in this demo.'],
    ['Is pickup always free?', 'Yes. Pickup never has a fee. Local delivery is free above ₹199 in this demo.'],
    ['Can I change an order?', 'Orders that the shop has not handed over yet can be cancelled from the order page. In a real product, changes would depend on the shop.'],
    ['Where is my data stored?', 'Everything lives in your browser via local storage. Reset the demo any time from the sidebar.']
  ];
  return `<div class="page">
    ${pageHead('WE ARE HERE FOR THE NEIGHBOURHOOD', 'How can we help?', 'Questions about an order, a shop or how NearBuy One fits together?')}
    <div class="grid grid--aside">
      <div class="stack">
        ${card({ title: 'Common questions', body: `<div class="stack-sm">${faqs.map(([q, a]) => `<details style="padding:11px 0;border-bottom:1px solid var(--line-soft)"><summary style="cursor:pointer;font-weight:600;font-size:13px;color:var(--ink);list-style:none;display:flex;justify-content:space-between;gap:10px">${q}<span class="muted">+</span></summary><p class="small muted mt-6">${a}</p></details>`).join('')}</div>` })}
        ${card({ title: 'Talk to a human', sub: 'Demo contact points — nothing is sent.', body: `<div class="grid grid--2">
          <div class="mini-stat">${icon('mail')}<div><b>hello@nearbuy.in</b><small>Neighbourhood support</small></div></div>
          <div class="mini-stat">${icon('phone')}<div><b>011 4000 1234</b><small>Mon–Sat · 9am–9pm</small></div></div>
        </div>` })}
      </div>
      <aside class="stack">
        ${card({ title: 'Send a demo note', body: `<form class="form-grid" id="support" data-form="support"><label class="field"><span>Email</span><input class="input" type="email" name="email" value="${esc(CUSTOMER.email)}" required /></label><label class="field"><span>Topic</span><select class="select" name="topic"><option>Order question</option><option>Product or shop feedback</option><option>Account help</option><option>Something else</option></select></label><label class="field"><span>Message</span><textarea class="textarea" name="message" required placeholder="Tell us a little more…"></textarea></label><button class="btn btn--primary btn--block">Save demo note ${icon('arrowRight')}</button></form>` })}
        ${card({ body: `<div class="row gap-8 small"><span class="kpi__icon">${icon('shield')}</span><div><b>Safety first</b><div class="tiny muted">Never share OTPs or personal details in this demo.</div></div></div>` })}
      </aside>
    </div>
  </div>`;
}
function shopPage() {
  switch (route.view) {
    case 'explore': return shopExplore();
    case 'shops': return shopShops();
    case 'shop': return shopDetail(route.id);
    case 'product': return shopProduct(route.id);
    case 'cart': return shopCart();
    case 'checkout': return shopCheckout();
    case 'orders': return shopOrders();
    case 'order': return shopOrder(route.id);
    case 'saved': return shopSaved();
    case 'account': return shopAccount();
    case 'help': return shopHelp();
    default: return shopHome();
  }
}

/* ============================== SELL WORKSPACE ============================== */
function sellerNextAction(o) {
  if (o.status === 'New') return { label: 'Accept order', act: 'accept-order', icon: 'check' };
  if (o.status === 'Preparing') return { label: 'Mark ready', act: 'ready-order', icon: 'checkCircle' };
  if (o.status === 'Ready' && o.method === 'Pickup') return { label: 'Mark collected', act: 'collect-order', icon: 'bag' };
  if (o.status === 'Ready' && o.method === 'Delivery' && !o.taskId) return { label: 'Request runner', act: 'request-runner', icon: 'truck' };
  if (o.status === 'Runner requested') return { label: 'Awaiting runner', act: '', icon: 'clock' };
  return { label: 'View order', act: 'view-order', icon: 'eye' };
}
function orderRow(o, showCustomer = true) {
  const action = sellerNextAction(o);
  const task = o.taskId ? taskById(o.taskId) : null;
  return `<tr>
    <td><b>${esc(o.id)}</b><small>${esc(o.placed)}</small></td>
    ${showCustomer ? `<td><div class="cell-item"><span class="table__thumb">${icon('user')}</span><div><b>${esc(o.customer)}</b><small>${esc(o.area)}</small></div></div></td>` : ''}
    <td><div class="order-mini">${o.items.slice(0, 3).map((i) => `<span class="${i.tone}">${i.emoji}</span>`).join('')}${o.items.length > 3 ? `<span style="background:none;font-size:10px;color:var(--muted)">+${o.items.length - 3}</span>` : ''}</div></td>
    <td>${pill(o.method === 'Pickup' ? 'Pickup' : (task ? `Runner · ${task.partnerName ? task.partnerName.split(' ')[0] : 'unassigned'}` : 'Runner delivery'), o.method === 'Pickup' ? 'neutral' : 'blue')}</td>
    <td class="nowrap"><b>${money(o.total)}</b></td>
    <td>${statusPill(orderStatusLabel(o))}</td>
    <td><div class="actions">${action.act ? `<button class="btn btn--${action.act === 'accept-order' || action.act === 'ready-order' ? 'primary' : 'ghost'} btn--xs" data-act="${action.act}" data-id="${o.id}">${icon(action.icon, 'sm')} ${action.label}</button>` : `<span class="tiny muted">${action.label}</span>`}<button class="btn btn--ghost btn--xs" data-act="view-order" data-id="${o.id}" aria-label="View order">${icon('eye', 'sm')}</button></div></td>
  </tr>`;
}
function sellerOrderFilter() { return ui.orderFilter || 'Active'; }
function sellOverview() {
  const today = todayOrders();
  const sales = sumBy(today, (o) => o.total);
  const revenueWeek = [1240, 1680, 1420, 2100, 1860, 2450, sales || 1890];
  return `<div class="page">
    ${pageHead('SELLER HUB · GREEN BASKET MARKET', 'Good morning, Riya', 'Everything your shop needs today — orders, stock, runners and money.', `
      <button class="btn btn--ghost btn--sm" data-act="nav" data-surface="sell" data-view="orders">${icon('clipboard')} Orders</button>
      <button class="btn btn--primary btn--sm" data-act="add-product">${icon('plus')} Add product</button>`)}
    <div class="grid grid--kpi">
      ${kpi({ label: "Today's sales", value: money(sales || 2740), icon: 'rupee', delta: '12.4%', foot: 'vs yesterday', spark: [18, 24, 21, 30, 27, 35, 33] })}
      ${kpi({ label: 'Orders to fulfil', value: pendingSellerOrders().length, icon: 'clipboard', delta: `${today.length} today`, dir: 'flat', foot: '' })}
      ${kpi({ label: 'Low & out of stock', value: lowStock().length + outOfStock().length, icon: 'alert', delta: `${outOfStock().length} out`, dir: 'down', foot: 'need attention' })}
      ${kpi({ label: 'Next payout', value: money(4820), icon: 'wallet', delta: 'Fri', dir: 'flat', foot: 'settlement due' })}
    </div>

    ${whySellSection()}

    <div class="grid grid--main mb-18">
      <section class="card card--flush">
        <div class="card__head"><div><h2>Orders that need you</h2><p>Accept, prepare and hand over — each step stays in sync with the customer.</p></div><button class="link" data-act="nav" data-surface="sell" data-view="orders">All orders ${icon('arrowRight')}</button></div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>ORDER</th><th>CUSTOMER</th><th>ITEMS</th><th>FULFILMENT</th><th>TOTAL</th><th>STATUS</th><th class="right">ACTION</th></tr></thead>
          <tbody>${sellerOrders().filter((o) => !['Delivered', 'Cancelled'].includes(o.status)).slice(0, 5).map((o) => orderRow(o)).join('') || `<tr><td colspan="7">${emptyState('checkCircle', 'All caught up', 'No open orders right now.')}</td></tr>`}</tbody>
        </table></div>
      </section>
      <div class="stack">
        ${card({ title: 'Runner network', sub: 'Requests from this shop', action: `<button class="link" data-act="nav" data-surface="deliver" data-view="requests">Open Deliver ${icon('arrowUpRight')}</button>`, body: `<div class="stack-sm">${state.tasks.filter((t) => t.shopId === SELLER.shopId && t.status !== 'Delivered').slice(0, 3).map((t) => `<div class="task-card ${t.status !== 'Requested' ? 'task-card--live' : ''}" style="padding:11px 12px">
            <div class="task-card__top"><span class="task-card__id">${esc(t.id)}</span>${statusPill(t.status)}</div>
            <div class="tiny muted">${esc(t.customer)} · ${esc(t.area)} · ${t.distance} km</div>
            <div class="task-card__foot" style="padding-top:6px"><span class="tiny">${t.partnerName ? `${icon('user', 'sm')} ${esc(t.partnerName)}` : `<span class="muted">No partner yet</span>`}</span><b class="small">${money(t.payout)}</b></div>
          </div>`).join('') || `<p class="small muted">No runner tasks right now.</p>`}</div>` })}
        ${card({ title: 'This week', sub: 'Net sales · demo data', body: barChart(revenueWeek, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], { height: 108, format: (v) => `₹${Math.round(v / 100) / 10}k` }) })}
      </div>
    </div>

    <div class="grid grid--2 mb-18">
      <section class="card card--flush">
        <div class="card__head"><div><h2>Stock running low</h2><p>Restock before a neighbour misses out.</p></div><button class="link" data-act="nav" data-surface="sell" data-view="inventory">Inventory ${icon('arrowRight')}</button></div>
        <div class="rows">${[...outOfStock(), ...lowStock()].slice(0, 4).map((p) => `<div class="list-row">
          <span class="cartline__visual ${p.tone}" style="width:38px;height:38px;font-size:18px">${p.emoji}</span>
          <div class="list-row__main"><b>${esc(p.name)}</b><small>${esc(p.category || p.cat)} · ${p.stock <= 0 ? 'Out of stock' : `Only ${p.stock} left`}</small></div>
          <div class="list-row__end"><button class="btn btn--ghost btn--xs" data-act="restock" data-id="${p.id}">${icon('plus', 'sm')} Restock</button></div>
        </div>`).join('') || emptyState('checkCircle', 'Stock looks healthy', 'Nothing below its low-stock threshold.')}</div>
      </section>
      <section class="card card--pad">
        <div class="between mb-14"><div><h2 style="font-size:15px">Shop status</h2><p class="tiny muted">Changes apply instantly to the customer storefront.</p></div>${pill(state.settings.shopOpen ? 'Open now' : 'Closed', state.settings.shopOpen ? 'green' : 'red', true)}</div>
        <div class="stack-sm">
          <label class="row between" style="padding:9px 0;border-bottom:1px solid var(--line-soft)"><span class="small"><b>Accepting orders</b><br><span class="tiny muted">Shop appears open nearby</span></span><span class="toggle"><input type="checkbox" data-act="toggle-setting" data-key="shopOpen" ${state.settings.shopOpen ? 'checked' : ''}/><span class="track"></span></span></label>
          <label class="row between" style="padding:9px 0;border-bottom:1px solid var(--line-soft)"><span class="small"><b>Runner delivery</b><br><span class="tiny muted">Offer delivery with a nearby runner</span></span><span class="toggle"><input type="checkbox" data-act="toggle-setting" data-key="delivery" ${state.settings.delivery ? 'checked' : ''}/><span class="track"></span></span></label>
          <label class="row between" style="padding:9px 0"><span class="small"><b>Store pickup</b><br><span class="tiny muted">Let neighbours collect in store</span></span><span class="toggle"><input type="checkbox" data-act="toggle-setting" data-key="pickup" ${state.settings.pickup ? 'checked' : ''}/><span class="track"></span></span></label>
        </div>
        <hr class="hr" />
        <div class="row gap-10"><span class="kpi__icon">${icon('megaphone')}</span><div class="flex1"><b class="small">Run a promotion</b><div class="tiny muted">2 demo campaigns are live.</div></div><button class="btn btn--ghost btn--xs" data-act="nav" data-surface="sell" data-view="promotions">Manage</button></div>
      </section>
    </div>

    <section class="banner banner--soft">
      ${icon('sparkles', 'lg')}
      <div><b>A little help goes a long way.</b><small>Short lessons for your shop — pricing, photos and packing that travels well.</small></div>
      <button class="btn btn--sm" data-act="nav" data-surface="sell" data-view="support">Visit the academy ${icon('arrowRight')}</button>
    </section>
  </div>`;
}
/* ---- "Why Sell on NearBuy?" — benefits band on the Seller Hub landing ---- */
const WHY_SELL = [
  { icon: 'pin', title: 'Reach nearby customers', copy: 'Your shop appears to neighbours inside your serviceable radius — the street, not the whole city.', state: 'In demo', view: 'settings', link: 'Set your radius' },
  { icon: 'store', title: 'Your digital shop', copy: 'A storefront for your physical shop: timings, fulfilment modes, ratings and shop details.', state: 'In demo', view: 'settings', link: 'Open shop settings' },
  { icon: 'package', title: 'Easy catalogue management', copy: 'Add products with price, MRP, stock and category. Photo upload is a labelled placeholder here.', state: 'In demo', view: 'catalogue', link: 'Manage catalogue' },
  { icon: 'clipboard', title: 'Manage orders easily', copy: 'View, accept, prepare and track every order — pickup or runner delivery — from one queue.', state: 'In demo', view: 'orders', link: 'Open orders' },
  { icon: 'truck', title: 'Delivery support', copy: 'Request a nearby NearBuy Runner for eligible short-distance deliveries, when a partner is available.', state: 'In demo', view: 'delivery', link: 'Delivery & pickup' },
  { icon: 'megaphone', title: 'Promote your shop', copy: 'Run a storefront coupon and see clearly which placements are paid. Advertising products are not built yet.', state: 'Partly', view: 'promotions', link: 'Open promotions' },
  { icon: 'chart', title: 'Business insights', copy: 'Watch orders, sales, product performance and restock alerts — sample figures in this prototype.', state: 'In demo', view: 'insights', link: 'View insights' },
  { icon: 'help', title: 'Seller support', copy: 'Guided onboarding, an academy and a help centre. A real human support desk is not connected yet.', state: 'Partly', view: 'support', link: 'Visit the academy' }
];

function whySellSection() {
  return `<section class="why-sell" aria-labelledby="whySellTitle">
    <div class="why-sell__head">
      <div class="why-sell__copy">
        <span class="kicker kicker--sell"><i></i>WHY SELL ON NEARBUY?</span>
        <h2 id="whySellTitle">Grow your local business. Reach more customers. Sell smarter with NearBuy.</h2>
        <p>Your shop deserves to be discovered. Join the local commerce network that brings neighbourhood shops and nearby customers together.</p>
      </div>
      <div class="why-sell__actions">
        <button class="btn btn--primary btn--sm" data-act="nav" data-surface="sell" data-view="register">${icon('store')} Start selling on NearBuy</button>
        <span class="tiny muted">Already a seller? You are signed in as Green Basket Market.</span>
      </div>
    </div>
    <div class="why-grid">
      ${WHY_SELL.map((b) => `<article class="why-card">
        <span class="why-card__icon">${icon(b.icon)}</span>
        <div class="why-card__body">
          <div class="why-card__title"><b>${b.title}</b>${pill(b.state, b.state === 'In demo' ? 'green' : 'neutral')}</div>
          <small>${b.copy}</small>
          <button class="link why-card__link" data-act="nav" data-surface="sell" data-view="${b.view}">${b.link} ${icon('arrowRight')}</button>
        </div>
      </article>`).join('')}
    </div>
    <div class="why-sell__foot">
      ${icon('shield')}
      <p><b>No guaranteed sales, orders, commission or delivery.</b> NearBuy does not promise a volume of orders or earnings, and delivery depends on an eligible partner being available. <span class="why-legend"><i class="why-dot why-dot--green"></i> In demo — working in this prototype</span> <span class="why-legend"><i class="why-dot"></i> Partly — some of it is still planned</span> Fees and settlement timing live in <button class="link" data-act="nav" data-surface="sell" data-view="payments">Payments &amp; earnings</button>.</p>
    </div>
  </section>`;
}

function sellOrders() {
  const filter = sellerOrderFilter();
  const all = sellerOrders();
  const filtered = all.filter((o) => {
    if (filter === 'Active') return !['Delivered', 'Cancelled'].includes(o.status);
    if (filter === 'All') return true;
    return o.status === filter;
  });
  const q = (ui.sellQuery || '').toLowerCase();
  const rows = filtered.filter((o) => !q || `${o.id} ${o.customer} ${o.area}`.toLowerCase().includes(q));
  const filters = ['Active', 'New', 'Preparing', 'Ready', 'Out for delivery', 'Delivered', 'All'];
  return `<div class="page">
    ${pageHead('SELLER HUB · ORDERS', 'Orders', 'One queue for pickup and runner deliveries. Every update reaches the customer instantly.', `<button class="btn btn--ghost btn--sm" data-act="nav" data-surface="sell" data-view="delivery">${icon('truck')} Delivery queue</button>`)}
    <div class="grid grid--kpi">
      ${kpi({ label: 'Open orders', value: all.filter((o) => !['Delivered', 'Cancelled'].includes(o.status)).length, icon: 'clipboard', foot: 'in the queue' })}
      ${kpi({ label: 'Awaiting accept', value: all.filter((o) => o.status === 'New').length, icon: 'bell', foot: 'need you now' })}
      ${kpi({ label: 'With runners', value: all.filter((o) => ['Runner assigned', 'Runner at shop', 'Out for delivery'].includes(o.status)).length, icon: 'truck', foot: 'out in the neighbourhood' })}
      ${kpi({ label: 'Completed today', value: all.filter((o) => o.status === 'Delivered').length, icon: 'checkCircle', foot: 'delivered or collected' })}
    </div>
    <section class="card card--flush">
      <div class="toolbar">
        <div class="chips">${filters.map((f) => `<button class="chip ${filter === f ? 'active' : ''}" data-act="order-filter" data-filter="${f}">${f}</button>`).join('')}</div>
        <div class="grow"></div>
        <div class="inline-search"><span>${icon('search')}</span><input class="input" type="search" id="sellSearch" placeholder="Order or customer" value="${esc(ui.sellQuery || '')}" data-act="sell-search" /></div>
      </div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>ORDER</th><th>CUSTOMER</th><th>ITEMS</th><th>FULFILMENT</th><th>TOTAL</th><th>STATUS</th><th class="right">ACTION</th></tr></thead>
        <tbody>${rows.map((o) => orderRow(o)).join('') || `<tr><td colspan="7">${emptyState('inbox', 'No orders here', 'Try a different filter, or wait for the next neighbourhood order.')}</td></tr>`}</tbody>
      </table></div>
      <div class="card__foot between"><span class="tiny muted">${rows.length} order${rows.length === 1 ? '' : 's'} shown</span><span class="tiny muted">Statuses sync with the customer, runner and ops workspaces</span></div>
    </section>
  </div>`;
}
function sellCatalogue() {
  const q = (ui.sellQuery || '').toLowerCase();
  const rows = shopProducts().filter((p) => !q || `${p.name} ${p.id} ${p.cat}`.toLowerCase().includes(q));
  return `<div class="page">
    ${pageHead('SELLER HUB · CATALOGUE', 'Products & catalogue', `${shopProducts().length} products live on the customer storefront.`, `<button class="btn btn--primary btn--sm" data-act="add-product">${icon('plus')} Add product</button>`)}
    <div class="grid grid--kpi">
      ${kpi({ label: 'Live products', value: shopProducts().filter((p) => p.stock > 0).length, icon: 'package', foot: 'visible nearby' })}
      ${kpi({ label: 'Categories', value: new Set(shopProducts().map((p) => p.cat)).size, icon: 'grid', foot: 'on the storefront' })}
      ${kpi({ label: 'Average price', value: money(Math.round(sumBy(shopProducts(), (p) => p.price) / (shopProducts().length || 1))), icon: 'rupee', foot: 'across the catalogue' })}
      ${kpi({ label: 'Units sold', value: num(sumBy(shopProducts(), (p) => p.sold || 0)), icon: 'chart', delta: '8.2%', foot: 'this month' })}
    </div>
    <section class="card card--flush">
      <div class="toolbar"><div class="chips"><button class="chip active">All products</button><button class="chip" data-act="nav" data-surface="sell" data-view="inventory">Stock view</button></div><div class="grow"></div><div class="inline-search"><span>${icon('search')}</span><input class="input" type="search" id="sellSearch" placeholder="Search catalogue" value="${esc(ui.sellQuery || '')}" data-act="sell-search" /></div></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>PRODUCT</th><th>SKU</th><th>CATEGORY</th><th>PRICE</th><th>STOCK</th><th>STATUS</th><th class="right">ACTIONS</th></tr></thead>
        <tbody>${rows.map((p) => `<tr>
          <td><div class="cell-item"><span class="cartline__visual ${p.tone}" style="width:34px;height:34px;font-size:16px">${p.emoji}</span><div><b>${esc(p.name)}</b><small>${esc(p.detail)}</small></div></div></td>
          <td class="tiny muted nowrap">GB-${p.id.replace('p', '')}</td>
          <td class="tiny muted">${esc(CATEGORIES.find((c) => c.id === p.cat)?.label || p.cat)}</td>
          <td><b>${money(p.price)}</b><small>MRP ${money(p.mrp)}</small></td>
          <td><div class="stockbar"><div class="meter ${p.stock <= 0 ? 'meter--red' : p.stock <= p.lowAt ? 'meter--amber' : 'meter--green'}"><i style="width:${clamp((p.stock / 24) * 100, 3, 100)}%"></i></div><b>${p.stock}</b></div></td>
          <td>${p.stock <= 0 ? pill('Out of stock', 'red') : p.stock <= p.lowAt ? pill('Low stock', 'amber') : pill('Active', 'green')}</td>
          <td><div class="actions"><button class="btn btn--ghost btn--xs" data-act="edit-product" data-id="${p.id}">${icon('sliders', 'sm')} Edit</button><button class="btn btn--ghost btn--xs" data-act="nav" data-surface="shop" data-view="product" data-id="${p.id}" aria-label="Preview ${esc(p.name)}">${icon('eye', 'sm')}</button></div></td>
        </tr>`).join('') || `<tr><td colspan="7">${emptyState('package', 'No products match', 'Try another search term.')}</td></tr>`}</tbody>
      </table></div>
      <div class="card__foot tiny muted">Product edits update the customer storefront in the same click.</div>
    </section>
  </div>`;
}
function sellInventory() {
  const items = shopProducts();
  const filter = ui.stockFilter || 'all';
  const rows = items.filter((p) => filter === 'all' || (filter === 'low' && p.stock > 0 && p.stock <= p.lowAt) || (filter === 'out' && p.stock <= 0));
  return `<div class="page">
    ${pageHead('SELLER HUB · INVENTORY', 'Inventory & stock', 'Accurate stock keeps the neighbourhood happy and avoids cancellations.', `<button class="btn btn--ghost btn--sm" data-act="restock-all">${icon('refresh')} Restock low items</button>`)}
    <div class="grid grid--kpi">
      ${kpi({ label: 'Units in stock', value: num(sumBy(items, (p) => p.stock)), icon: 'archive', foot: 'across the catalogue' })}
      ${kpi({ label: 'Healthy lines', value: items.filter((p) => p.stock > p.lowAt).length, icon: 'checkCircle', foot: 'above threshold' })}
      ${kpi({ label: 'Low stock', value: lowStock().length, icon: 'alert', foot: 'reorder soon' })}
      ${kpi({ label: 'Out of stock', value: outOfStock().length, icon: 'x', foot: 'hidden from customers' })}
    </div>
    <section class="card card--flush">
      <div class="toolbar">
        <div class="chips">${[['all', 'All products'], ['low', 'Low stock'], ['out', 'Out of stock']].map(([k, l]) => `<button class="chip ${filter === k ? 'active' : ''}" data-act="stock-filter" data-filter="${k}">${l}</button>`).join('')}</div>
        <div class="grow"></div><span class="tiny muted">Low-stock threshold is set per product</span>
      </div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>PRODUCT</th><th>STOCK LEVEL</th><th>THRESHOLD</th><th>ADJUST</th><th class="right">QUICK RESTOCK</th></tr></thead>
        <tbody>${rows.map((p) => `<tr>
          <td><div class="cell-item"><span class="cartline__visual ${p.tone}" style="width:34px;height:34px;font-size:16px">${p.emoji}</span><div><b>${esc(p.name)}</b><small>${esc(p.detail)}</small></div></div></td>
          <td><div class="stockbar"><div class="meter ${p.stock <= 0 ? 'meter--red' : p.stock <= p.lowAt ? 'meter--amber' : 'meter--green'}"><i style="width:${clamp((p.stock / 24) * 100, 3, 100)}%"></i></div><b>${p.stock}</b>${p.stock <= 0 ? pill('Out', 'red') : p.stock <= p.lowAt ? pill('Low', 'amber') : ''}</div></td>
          <td class="tiny muted">${p.lowAt} units</td>
          <td><div class="row gap-4"><button class="btn btn--ghost btn--xs" data-act="stock" data-id="${p.id}" data-delta="-1" aria-label="Remove one unit of ${esc(p.name)}">${icon('minus', 'sm')}</button><button class="btn btn--ghost btn--xs" data-act="stock" data-id="${p.id}" data-delta="1" aria-label="Add one unit of ${esc(p.name)}">${icon('plus', 'sm')}</button><button class="btn btn--ghost btn--xs" data-act="stock" data-id="${p.id}" data-delta="5">+5</button></div></td>
          <td class="right"><button class="btn btn--soft btn--xs" data-act="restock" data-id="${p.id}">${icon('refresh', 'sm')} Set to 20</button></td>
        </tr>`).join('') || `<tr><td colspan="5">${emptyState('checkCircle', 'Nothing in this filter', 'Your stock looks healthy.')}</td></tr>`}</tbody>
      </table></div>
    </section>
  </div>`;
}
function sellDelivery() {
  const delivery = sellerOrders().filter((o) => o.method === 'Delivery' && o.status !== 'Delivered');
  const pickup = sellerOrders().filter((o) => o.method === 'Pickup' && o.status !== 'Delivered');
  const tasks = state.tasks.filter((t) => t.shopId === SELLER.shopId);
  return `<div class="page">
    ${pageHead('SELLER HUB · DELIVERY & PICKUP', 'Delivery & pickup', 'Hand orders to a nearby runner, or get them ready for collection.', `<button class="btn btn--ghost btn--sm" data-act="switch" data-surface="deliver">${icon('truck')} Open Runner workspace</button>`)}
    <div class="grid grid--kpi">
      ${kpi({ label: 'Delivery orders open', value: delivery.length, icon: 'truck', foot: 'runner delivery' })}
      ${kpi({ label: 'Ready for pickup', value: pickup.filter((o) => ['Ready', 'Runner requested'].includes(o.status)).length, icon: 'store', foot: 'waiting in store' })}
      ${kpi({ label: 'Runner tasks live', value: tasks.filter((t) => t.status !== 'Delivered').length, icon: 'pin', foot: 'in the network' })}
      ${kpi({ label: 'Avg. handover', value: '18 min', icon: 'clock', foot: 'demo average' })}
    </div>
    <div class="grid grid--2 mb-18">
      <section class="card card--flush">
        <div class="card__head"><div><h2>Runner deliveries</h2><p>Request a runner once the order is ready.</p></div>${pill(`${delivery.length} open`, 'blue')}</div>
        <div class="rows">${delivery.map((o) => {
          const task = o.taskId ? taskById(o.taskId) : null;
          return `<div class="list-row">
            <span class="table__thumb">${icon('truck')}</span>
            <div class="list-row__main"><b>${esc(o.id)} · ${esc(o.customer)}</b><small>${esc(o.area)} · ${money(o.total)} · ${task ? `task ${esc(task.id)} · ${esc(task.status)}` : 'no runner requested'}</small></div>
            <div class="list-row__end">${statusPill(orderStatusLabel(o))}${!task && o.status === 'Ready' ? `<button class="btn btn--primary btn--xs" data-act="request-runner" data-id="${o.id}">${icon('truck', 'sm')} Request runner</button>` : `<button class="btn btn--ghost btn--xs" data-act="view-order" data-id="${o.id}" aria-label="View order ${esc(o.id)}">${icon('eye', 'sm')}</button>`}</div>
          </div>`; }).join('') || emptyState('truck', 'No delivery orders open', 'New delivery orders will appear here.')}</div>
      </section>
      <section class="card card--flush">
        <div class="card__head"><div><h2>Store pickup</h2><p>Prepare the bag and wait for your neighbour.</p></div>${pill(`${pickup.length} open`, 'violet')}</div>
        <div class="rows">${pickup.map((o) => `<div class="list-row">
          <span class="table__thumb">${icon('store')}</span>
          <div class="list-row__main"><b>${esc(o.id)} · ${esc(o.customer)}</b><small>${esc(o.area)} · collect at the shop · ${money(o.total)}</small></div>
          <div class="list-row__end">${statusPill(orderStatusLabel(o))}<button class="btn btn--ghost btn--xs" data-act="view-order" data-id="${o.id}" aria-label="View order ${esc(o.id)}">${icon('eye', 'sm')}</button></div>
        </div>`).join('') || emptyState('store', 'No pickups open', 'Orders for collection will appear here.')}</div>
      </section>
    </div>
    <section class="card card--pad">
      <div class="between wrap mb-14"><div><span class="kicker"><i></i>HOW HANDOVER WORKS</span><h2 style="font-size:17px">One request, three workspaces.</h2></div><span class="live-dot"><i></i>Live demo loop</span></div>
      <div class="grid grid--4">
        ${[['store', '1 · Shop marks ready', 'The order enters the runner queue as a request.'], ['truck', '2 · Runner accepts', 'A nearby runner takes the task and arrives at the shop.'], ['scan', '3 · Pickup OTP', 'The shop shares a demo pickup code to confirm the handover.'], ['checkCircle', '4 · Delivered', 'The customer OTP confirms delivery and earnings are recorded.']].map(([ic, t, s]) => `<div class="mini-stat"><span class="kpi__icon">${icon(ic)}</span><div><b>${t}</b><small>${s}</small></div></div>`).join('')}
      </div>
    </section>
  </div>`;
}
function sellReturns() {
  return `<div class="page">
    ${pageHead('SELLER HUB · RETURNS', 'Returns & issues', 'Resolve the rare thing that does not go to plan.', `<button class="btn btn--ghost btn--sm" data-act="toast" data-msg="Demo return policy shared with the customer.">${icon('download')} Export policy</button>`)}
    <div class="grid grid--kpi">
      ${kpi({ label: 'Open returns', value: state.returns.filter((r) => r.status === 'Needs review').length, icon: 'refresh', foot: 'need a decision' })}
      ${kpi({ label: 'Approved', value: state.returns.filter((r) => r.status === 'Approved').length, icon: 'checkCircle', foot: 'refund simulated' })}
      ${kpi({ label: 'Return rate', value: '1.4%', icon: 'chart', delta: '0.3%', dir: 'down', foot: 'of demo orders' })}
      ${kpi({ label: 'Refunded value', value: money(sumBy(state.returns, (r) => r.amount)), icon: 'rupee', foot: 'demo totals' })}
    </div>
    <section class="card card--flush">
      <div class="card__head"><div><h2>Return requests</h2><p>Approve or reject to keep the customer informed.</p></div></div>
      <div class="rows">${state.returns.map((r) => `<div class="list-row">
        <span class="table__thumb">${icon('refresh')}</span>
        <div class="list-row__main"><b>${esc(r.product)} · ${esc(r.id)}</b><small>${esc(r.customer)} · order ${esc(r.order)} · ${esc(r.reason)} · ${esc(r.date)}</small></div>
        <div class="list-row__end"><b class="small">${money(r.amount)}</b>${pill(r.status, STATUS_TONE[r.status] || 'neutral')}${r.status === 'Needs review' ? `<button class="btn btn--primary btn--xs" data-act="return-approve" data-id="${r.id}">${icon('check', 'sm')} Approve</button><button class="btn btn--ghost btn--xs" data-act="return-reject" data-id="${r.id}" aria-label="Reject return ${esc(r.id)}">${icon('x', 'sm')}</button>` : ''}</div>
      </div>`).join('')}</div>
    </section>
  </div>`;
}
function sellPayments() {
  const settlements = [
    ['SET-2088', 'Fri, 14 Jun', 4820, 'Paid'], ['SET-2081', 'Fri, 7 Jun', 5310, 'Paid'], ['SET-2074', 'Fri, 31 May', 4690, 'Paid'], ['SET-2069', 'Fri, 24 May', 5120, 'Paid']
  ];
  return `<div class="page">
    ${pageHead('SELLER HUB · PAYMENTS', 'Payments & earnings', 'What the shop earned, what is coming, and where it goes.', `<button class="btn btn--ghost btn--sm" data-act="export-payouts">${icon('download')} Download statement</button>`)}
    <div class="grid grid--kpi">
      ${kpi({ label: 'Net sales', value: money(sellerRevenue()), icon: 'rupee', delta: '12.4%', foot: 'this month', spark: [24, 31, 28, 39, 36, 44, 41] })}
      ${kpi({ label: 'Commission', value: money(Math.round(sellerRevenue() * 0.08)), icon: 'tag', foot: '8% demo rate' })}
      ${kpi({ label: 'Next payout', value: money(4820), icon: 'wallet', foot: 'Friday · demo' })}
      ${kpi({ label: 'Lifetime paid', value: money(19940), icon: 'checkCircle', foot: 'sample settlements' })}
    </div>
    <div class="grid grid--main">
      <section class="card card--flush">
        <div class="card__head"><div><h2>Settlement history</h2><p>Weekly, simulated payouts.</p></div>${pill('Demo data', 'outline')}</div>
        <div class="rows">${settlements.map(([id, date, amount, status]) => `<div class="settlement">
          <span class="table__thumb">${icon('wallet')}</span>
          <div><b class="small">${id}</b><div class="tiny muted">${date} · to HDFC ••4821 (demo)</div></div>
          <div class="settlement__amt"><b>${money(amount)}</b><small>${status}</small></div>
          ${pill(status, 'green')}
        </div>`).join('')}</div>
      </section>
      <div class="stack">
        ${card({ title: 'Earnings breakdown', body: donutChart([{ label: 'Product sales', value: 22400, color: '#2b8a66' }, { label: 'Delivery fees', value: 3100, color: '#2f6bd8' }, { label: 'Promotions', value: 1450, color: '#f47718' }], '₹26.9k', 'gross demo') })}
        ${card({ title: 'Payout account', sub: 'Sample details only', body: `<div class="row gap-10"><span class="kpi__icon">${icon('lock')}</span><div><b class="small">HDFC Bank ••4821</b><div class="tiny muted">IFSC HDFC0001234 · verified in demo</div></div></div><div class="notice notice--plain mt-14">${icon('shield')}<span>No real bank account, UPI ID or payout is connected.</span></div>` })}
      </div>
    </div>
  </div>`;
}
function sellPromotions() {
  return `<div class="page">
    ${pageHead('SELLER HUB · PROMOTIONS', 'Promotions', 'Small offers that bring neighbours in.', `<button class="btn btn--primary btn--sm" data-act="new-promo">${icon('plus')} New promotion</button>`)}
    <div class="grid grid--3 mb-18">
      ${state.promos.map((p) => `<article class="promo-card">
        <div class="spread"><span class="kicker" style="margin:0"><i></i>${esc(p.type)}</span>${pill(p.status, p.status === 'Active' ? 'green' : p.status === 'Paused' ? 'amber' : 'blue')}</div>
        <b style="font-family:var(--display);font-size:15px;letter-spacing:-.02em">${esc(p.title)}</b>
        <span class="promo-card__code">${esc(p.code)}</span>
        <div class="spread tiny muted"><span>${p.uses} demo uses</span><span>Ends ${esc(p.ends)}</span></div>
        <div class="row gap-6 mt-6"><button class="btn btn--ghost btn--xs" data-act="toggle-promo" data-id="${p.id}">${icon('refresh', 'sm')} ${p.status === 'Active' ? 'Pause' : 'Activate'}</button><button class="btn btn--ghost btn--xs" data-act="toast" data-msg="Promotion code copied for the demo.">${icon('tag', 'sm')} Copy code</button></div>
      </article>`).join('')}
      <button class="card card--pad center" style="border-style:dashed;min-height:200px" data-act="new-promo">
        <span><span class="kpi__icon" style="margin:0 auto 8px">${icon('plus')}</span><b class="small" style="display:block">Create a promotion</b><span class="tiny muted">10% off, free delivery or a flat discount.</span></span>
      </button>
    </div>
    <div class="grid grid--2">
      ${card({ title: 'How promotions appear', body: `<p class="small muted">An active promotion shows on the customer storefront banner and is applied at demo checkout when the code is entered.</p><div class="coupon mt-10"><input class="input" type="text" value="LOCAL10" readonly /><span class="pill pill--green" style="align-self:center">10% off</span></div>` })}
      ${card({ title: 'Promotion performance', body: barChart([4, 9, 7, 12, 15, 11, 18], ['M', 'T', 'W', 'T', 'F', 'S', 'S'], { height: 100, format: (v) => v }) })}
    </div>
  </div>`;
}
function sellInsights() {
  const top = [...shopProducts()].sort((a, b) => (b.sold || 0) - (a.sold || 0)).slice(0, 5);
  return `<div class="page">
    ${pageHead('SELLER HUB · INSIGHTS', 'Business insights', 'The shape of your week, in plain numbers.', `<span class="chip active">${icon('chart')} Last 7 days</span>`)}
    <div class="grid grid--kpi">
      ${kpi({ label: 'Store visits', value: '2,184', icon: 'eye', delta: '18.6%', foot: 'vs last week' })}
      ${kpi({ label: 'Conversion', value: '7.4%', icon: 'chart', delta: '1.2%', foot: 'demo storefront' })}
      ${kpi({ label: 'Repeat customers', value: '38%', icon: 'users', delta: '4.1%', foot: 'of all orders' })}
      ${kpi({ label: 'Avg. basket', value: money(212), icon: 'bag', delta: '3.2%', foot: 'per demo order' })}
    </div>
    <div class="grid grid--main mb-18">
      ${card({ title: 'Net sales this week', sub: 'Sample figures from the demo shop.', action: `<span class="pill pill--green">↑ 12.4%</span>`, body: barChart([1240, 1680, 1420, 2100, 1860, 2450, 1890], ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], { height: 170, format: (v) => `₹${Math.round(v / 100) / 10}k` }) })}
      ${card({ title: 'Sales by category', body: donutChart([{ label: 'Fresh produce', value: 42, color: '#2b8a66' }, { label: 'Bakery & dairy', value: 31, color: '#f47718' }, { label: 'Pantry', value: 18, color: '#2f6bd8' }, { label: 'Other', value: 9, color: '#c9bfae' }], '100%', 'of demo sales') })}
    </div>
    <section class="card card--flush">
      <div class="card__head"><div><h2>Top products</h2><p>By units sold this month.</p></div><button class="link" data-act="nav" data-surface="sell" data-view="catalogue">Catalogue ${icon('arrowRight')}</button></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>PRODUCT</th><th>UNITS SOLD</th><th>REVENUE</th><th>STOCK LEFT</th><th class="right">TREND</th></tr></thead>
        <tbody>${top.map((p) => `<tr><td><div class="cell-item"><span class="cartline__visual ${p.tone}" style="width:30px;height:30px;font-size:15px">${p.emoji}</span><div><b>${esc(p.name)}</b><small>${esc(p.cat)}</small></div></div></td><td><b>${p.sold}</b></td><td><b>${money((p.sold || 0) * p.price)}</b></td><td>${p.stock}</td><td class="right">${sparkline([5, 8, 6, 11, 9, 14, 12], { w: 70, h: 22 })}</td></tr>`).join('')}</tbody></table></div>
    </section>
  </div>`;
}
function sellSettings() {
  const s = state.settings;
  return `<div class="page">
    ${pageHead('SELLER HUB · SETTINGS', 'Shop settings', 'How the shop shows up, and how it fulfils orders.', `<button class="btn btn--primary btn--sm" data-act="toast" data-msg="Shop settings saved locally.">${icon('check')} Save changes</button>`)}
    <div class="grid grid--aside">
      <div class="stack">
        ${card({ title: 'Shop details', body: `<div class="form-grid"><div class="form-grid form-grid--2"><label class="field"><span>Shop name</span><input class="input" type="text" value="Green Basket Market" /></label><label class="field"><span>Neighbourhood</span><input class="input" type="text" value="Hauz Khas, South Delhi" /></label></div><label class="field"><span>About the shop</span><textarea class="textarea">Fresh produce and everyday essentials, picked with care from your neighbourhood.</textarea></label><label class="field"><span>Order preparation time</span><select class="select" data-act="setting-select" data-key="prep">${['10–15 min', '15–25 min', '20–30 min', '30–45 min'].map((t) => `<option ${s.prep === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>` })}
        ${card({ title: 'Fulfilment', sub: 'These switches change the customer experience immediately.', body: `<div class="stack-sm">
          ${[['shopOpen', 'Accepting orders', 'Show the shop as open nearby'], ['delivery', 'Runner delivery', 'Let runners deliver nearby orders'], ['pickup', 'Store pickup', 'Allow collection from the shop'], ['autoAccept', 'Auto-accept new orders', 'Skip the manual accept step'], ['lowStockAlerts', 'Low-stock alerts', 'Notify me before items run out']].map(([key, label, sub]) => `<label class="row between" style="padding:10px 0;border-bottom:1px solid var(--line-soft)"><span class="small"><b>${label}</b><br><span class="tiny muted">${sub}</span></span><span class="toggle"><input type="checkbox" data-act="toggle-setting" data-key="${key}" ${s[key] ? 'checked' : ''}/><span class="track"></span></span></label>`).join('')}
        </div>` })}
        ${card({ title: 'Delivery radius', body: `<div class="row between"><div><b class="small">${s.radius} km around the shop</b><div class="tiny muted">Runner payouts follow the network pricing bands.</div></div><select class="select" style="width:auto" data-act="setting-select" data-key="radius"><option ${s.radius == 1 ? 'selected' : ''}>1</option><option ${s.radius == 2 ? 'selected' : ''}>2</option><option ${s.radius == 3 ? 'selected' : ''}>3</option></select></div>` })}
      </div>
      <aside class="stack">
        ${card({ title: 'Live preview', sub: 'What neighbours see', body: `<div class="card card--pad" style="background:#fdfbf7"><div class="row gap-10"><span class="cartline__visual shop-sage" style="width:42px;height:42px;font-size:20px">🥬</span><div><b class="small">Green Basket Market</b><div class="tiny muted">${s.shopOpen ? '● Open now' : 'Closed'} · ${s.prep}</div></div></div><div class="row gap-6 mt-10"><span class="fulfil-badge pill pill--outline">Pickup</span><span class="pill pill--outline">Local delivery</span></div></div>` })}
        ${card({ body: `<div class="row gap-8 small"><span class="kpi__icon">${icon('shield')}</span><div><b>Demo settings</b><div class="tiny muted">No real shop, verification or payout is connected.</div></div></div>` })}
      </aside>
    </div>
  </div>`;
}
function sellTeam() {
  const team = [
    { name: 'Riya Sharma', email: 'owner@nearbuy.demo', role: 'Shop owner', initials: 'RS', avatar: 'green', access: 'Everything' },
    { name: 'Aarav Mehta', email: 'manager@nearbuy.demo', role: 'Shop manager', initials: 'AM', avatar: 'blue', access: 'Orders, catalogue, delivery' },
    { name: 'Sana Khan', email: 'inventory@nearbuy.demo', role: 'Inventory manager', initials: 'SK', avatar: 'violet', access: 'Catalogue, inventory' }
  ];
  return `<div class="page">
    ${pageHead('SELLER HUB · TEAM', 'Team & access', 'Give the right people the right keys to the shop.', `<button class="btn btn--primary btn--sm" data-act="toast" data-msg="Demo invite saved — no email was sent.">${icon('plus')} Invite teammate</button>`)}
    <div class="grid grid--aside">
      <div class="stack">
        ${card({ title: 'People with access', body: `<div class="rows" style="margin:-16px -18px">${team.map((t) => `<div class="list-row"><span class="ava ava--${t.avatar}">${t.initials}</span><div class="list-row__main"><b>${t.name} · ${t.role}</b><small>${t.email}</small></div><div class="list-row__end"><span class="tiny muted hide-sm">${t.access}</span>${pill('Active', 'green')}</div></div>`).join('')}</div>` })}
        ${card({ title: 'Roles in this demo', body: `<div class="grid grid--3">${[['Shop owner', 'Every workspace and setting.'], ['Shop manager', 'Orders, catalogue, delivery, returns.'], ['Inventory manager', 'Catalogue and stock only.']].map(([r, d]) => `<div class="mini-stat">${icon('lock')}<div><b>${r}</b><small>${d}</small></div></div>`).join('')}</div>` })}
      </div>
      <aside class="stack">
        ${card({ title: 'Access rules', body: `<p class="small muted">Permissions in this demo mirror the real Seller Hub roles. This Seller Hub session opens seller tools only — customer, partner, fleet and operations portals each sign in separately.</p><button class="btn btn--ghost btn--sm btn--block mt-10" data-act="launcher">${icon('layers')} Open workspace launcher</button>` })}
        ${card({ body: `<div class="notice notice--info">${icon('shield')}<span>Team access is demo-only. No invitations, passwords or identity checks are real.</span></div>` })}
      </aside>
    </div>
  </div>`;
}
function sellSupport() {
  return `<div class="page">
    ${pageHead('SELLER HUB · SUPPORT', 'Support & academy', 'Short, practical help for running a neighbourhood shop.', `<button class="btn btn--primary btn--sm" data-act="toast" data-msg="Demo support ticket saved in this browser.">${icon('mail')} Contact support</button>`)}
    <div class="grid grid--3 mb-18">
      ${[['Packing that travels well', '8 min · lesson', 'box'], ['Photographing your finds', '6 min · lesson', 'eye'], ['Setting prices neighbours love', '10 min · lesson', 'tag'], ['Handling a return kindly', '5 min · lesson', 'refresh'], ['Your first promotion', '7 min · lesson', 'megaphone'], ['Talking to runners', '4 min · lesson', 'truck']].map(([t, m, ic]) => `<article class="card card--pad" style="cursor:pointer"><span class="kpi__icon" style="margin-bottom:12px">${icon(ic)}</span><b style="font-family:var(--display);font-size:14.5px;display:block">${t}</b><p class="tiny muted mt-6">${m} · NearBuy Academy</p><button class="link mt-10" data-act="toast" data-msg="Demo lesson opened.">Start lesson ${icon('arrowRight')}</button></article>`).join('')}
    </div>
    <div class="grid grid--2">
      ${card({ title: 'Talk to a human', sub: 'Demo contact points.', body: `<div class="grid grid--2"><div class="mini-stat">${icon('phone')}<div><b>011 4000 1234</b><small>Seller support</small></div></div><div class="mini-stat">${icon('mail')}<div><b>sellers@nearbuy.in</b><small>Email demo</small></div></div></div>` })}
      ${card({ title: 'Your recent requests', body: `<div class="rows" style="margin:-16px -18px">${[['Support · payout schedule', 'Resolved · yesterday'], ['Support · catalogue upload', 'Resolved · 3 days ago']].map(([t, s]) => `<div class="list-row"><span class="table__thumb">${icon('inbox')}</span><div class="list-row__main"><b>${t}</b><small>${s}</small></div><div class="list-row__end">${pill('Demo', 'outline')}</div></div>`).join('')}</div>` })}
    </div>
  </div>`;
}
function sellPage() {
  switch (route.view) {
    case 'orders': return sellOrders();
    case 'catalogue': return sellCatalogue();
    case 'inventory': return sellInventory();
    case 'delivery': return sellDelivery();
    case 'returns': return sellReturns();
    case 'payments': return sellPayments();
    case 'promotions': return sellPromotions();
    case 'insights': return sellInsights();
    case 'settings': return sellSettings();
    case 'team': return sellTeam();
    case 'support': return sellSupport();
    case 'register': return sellerOnboarding();
    default: return sellOverview();
  }
}

/* ============================= DELIVER WORKSPACE ============================= */
function taskCard(t, actions = true) {
  const isMine = t.partnerId === me().id;
  return `<article class="task-card ${isMine ? 'task-card--live' : ''}">
    <div class="task-card__top">
      <span class="task-card__id">${esc(t.id)} <span class="muted" style="font-weight:500;font-family:var(--body);font-size:11px">· ${esc(t.createdAt)}</span></span>
      ${statusPill(t.status)}
    </div>
    <div class="task-card__route">
      <div class="route-stop"><i class="dot-a"></i><div><b>${esc(t.shop)}</b><small>Pickup · ${esc(t.shopArea)} · ${t.pickupDistance} km to shop</small></div></div>
      <div class="route-stop"><i class="dot-b"></i><div><b>${esc(t.customer)}</b><small>Drop · ${esc(t.area)} · ${t.distance} km route</small></div></div>
    </div>
    <div class="row gap-8 wrap">
      <span class="pill pill--outline">${icon(t.category === 'Stationery' ? 'book' : 'bag', 'sm')} ${esc(t.category)}</span>
      <span class="pill pill--outline">${t.items} items</span>
      <span class="pill pill--outline">${t.weight} kg</span>
      ${t.partnerName ? `<span class="pill pill--blue">${esc(t.partnerName)}</span>` : ''}
    </div>
    <div class="task-card__foot">
      <div class="payout">${money(t.payout)}<small>sample earning</small></div>
      ${actions ? `<div class="row gap-6">
        <button class="btn btn--ghost btn--xs" data-act="task-detail" data-id="${t.id}">${icon('eye', 'sm')} Details</button>
        <button class="btn btn--ghost btn--xs" data-act="pass-task" data-id="${t.id}">Pass</button>
        <button class="btn btn--primary btn--xs" data-act="accept-task" data-id="${t.id}">${icon('check', 'sm')} Accept</button>
      </div>` : ''}
    </div>
  </article>`;
}
const RUNNER_FLOW = ['Requested', 'Assigned', 'At shop', 'Picked up', 'En route', 'Delivered'];
function deliverOverview() {
  const r = me();
  const queue = runnerQueue();
  const active = activeDelivery();
  const done = myDeliveries().filter((t) => t.status === 'Delivered');
  return `<div class="page">
    ${pageHead('RUNNER · NEARBUY DELIVER', `Hi ${esc(r.name.split(' ')[0])}, ready when you are`, `You are ${r.online ? 'online' : 'offline'} in ${esc(r.zone)}. Accept only what feels safe and comfortable.`, `
      <label class="pillbtn" style="cursor:pointer;gap:10px"><span class="live-dot ${r.online ? '' : 'off'}"><i></i>${r.online ? 'Online' : 'Offline'}</span>
        <span class="toggle"><input type="checkbox" data-act="online-toggle" ${r.online ? 'checked' : ''}/><span class="track"></span></span>
      </label>
      <button class="btn btn--ghost btn--sm" data-act="nav" data-surface="deliver" data-view="safety">${icon('shield')} Safety</button>`)}
    <div class="grid grid--kpi">
      ${kpi({ label: "Today's earnings", value: money(earningsFor(r.id) || 32), icon: 'rupee', delta: '₹32 recorded', dir: 'flat', foot: 'demo only' })}
      ${kpi({ label: 'Deliveries', value: done.length, icon: 'checkCircle', foot: 'all time in demo' })}
      ${kpi({ label: 'Requests near you', value: queue.length, icon: 'pin', foot: `within ${r.maxKm} km` })}
      ${kpi({ label: 'Your mode', value: r.mode, icon: r.mode === 'Walking' ? 'walk' : 'bike', foot: `${r.maxKm} km radius` })}
    </div>

    ${whyDeliverSection()}
    ${deliverHowStrip()}

    ${active ? `<section class="card card--pad mb-18" style="background:linear-gradient(150deg,#fff,#eef4fe);border-color:#d8e3f8">
      <div class="between wrap mb-14">
        <div><span class="kicker" style="margin:0"><i></i>ACTIVE DELIVERY · ${esc(active.id)}</span><h2 style="font-size:20px">${esc(active.shop)} → ${esc(active.customer)}</h2><p class="tiny muted">${esc(active.area)} · ${active.distance} km · ${money(active.payout)} sample earning</p></div>
        <button class="btn btn--primary btn--sm" data-act="nav" data-surface="deliver" data-view="active">${icon('zap')} Continue delivery</button>
      </div>
      ${stepper(['Accepted', 'At shop', 'Picked up', 'On the way', 'Delivered'], clamp(RUNNER_FLOW.indexOf(active.status) - 1, 1, 4))}
    </section>` : ''}

    <div class="grid grid--main mb-18">
      <section class="card card--flush">
        <div class="card__head"><div><h2>Requests for you</h2><p>Nearby, within your distance and parcel preferences.</p></div><button class="link" data-act="nav" data-surface="deliver" data-view="requests">All requests ${icon('arrowRight')}</button></div>
        <div class="card__body stack">${queue.length ? queue.slice(0, 2).map((t) => taskCard(t)).join('') : emptyState('inbox', 'No requests right now', `We will only show tasks within ${r.maxKm} km that match your preferences.`)}</div>
      </section>
      <div class="stack">
        ${card({ title: 'This week', sub: 'Sample earnings', body: barChart([12, 28, 0, 32, 20, 45, earningsFor(r.id) || 32], ['M', 'T', 'W', 'T', 'F', 'S', 'S'], { height: 104, format: (v) => `₹${v}` }) })}
        ${card({ title: 'Task history', sub: 'Delivered in this demo', body: `<div class="stack-sm">${done.slice(0, 3).map((t) => `<div class="row gap-8 small"><span class="kpi__icon" style="width:26px;height:26px">${icon('checkCircle')}</span><div class="flex1"><b>${esc(t.shop)}</b><div class="tiny muted">${esc(t.id)} · ${esc(t.completedAt || t.createdAt)}</div></div><b>${money(t.earned || t.payout)}</b></div>`).join('') || '<p class="small muted">No completed deliveries yet.</p>'}</div>`, foot: `<button class="link" data-act="nav" data-surface="deliver" data-view="earnings">Open earnings ${icon('arrowRight')}</button>` })}
      </div>
    </div>

    ${deliverFeatures()}
  </div>`;
}
/* ---- "Why Become a NearBuy Delivery Partner?" band ---- */
const WHY_DELIVER = [
  { icon: 'pin', title: 'Nearby delivery opportunities', copy: 'Receive eligible short-distance requests from participating shops around your service area.', state: 'In demo', view: 'requests', link: 'See requests' },
  { icon: 'clock', title: 'Flexible availability', copy: 'Go online or offline whenever you like, and pass any request without a penalty.', state: 'In demo', view: 'profile', link: 'Set availability' },
  { icon: 'rupee', title: 'Transparent earnings', copy: 'See the payout for a delivery before you accept it, and a statement of completed tasks.', state: 'In demo', view: 'earnings', link: 'Open earnings' },
  { icon: 'scan', title: 'Easy parcel pickup', copy: 'Verify each parcel with the shop at handover, so the wrong bag never leaves the counter.', state: 'In demo', view: 'active', link: 'Pickup flow' },
  { icon: 'truck', title: 'Simple delivery process', copy: 'One clear sequence from accepting a request to confirming the delivery at the door.', state: 'In demo', view: 'active', link: 'See the steps' },
  { icon: 'package', title: 'Easy task tracking', copy: 'Assigned deliveries, pickup details, the destination and live status in one place.', state: 'In demo', view: 'requests', link: 'Your tasks' },
  { icon: 'help', title: 'Support when needed', copy: 'Get help with delivery issues, customers, shopkeepers, payments and account questions.', state: 'Partly', view: 'support', link: 'Support & safety' },
  { icon: 'shield', title: 'Safety and verification', copy: 'Verified accounts, delivery confirmation and safety-first operating procedures.', state: 'In demo', view: 'safety', link: 'Safety centre' }
];

function whyDeliverSection() {
  return `<section class="why-block why-deliver" aria-labelledby="whyDeliverTitle">
    <div class="why-block__head">
      <div class="why-block__copy">
        <span class="kicker kicker--deliver"><i></i>WHY BECOME A NEARBUY DELIVERY PARTNER?</span>
        <p class="why-deliver__message">Your neighbourhood. Your delivery journey.</p>
        <h2 id="whyDeliverTitle">Deliver locally. Earn fairly. Grow with NearBuy.</h2>
        <p>Become part of your neighbourhood's delivery network. Connect local shops with nearby customers through convenient, short-distance deliveries.</p>
      </div>
      <div class="why-block__actions">
        <button class="btn btn--primary btn--sm" data-act="nav" data-surface="deliver" data-view="register">${icon('plus')} Join as Delivery Partner</button>
        <span class="tiny muted">Already registered? You are signed in — no second account needed.</span>
      </div>
    </div>

    <div class="why-grid">
      ${WHY_DELIVER.map((b) => `<article class="why-card">
        <span class="why-card__icon">${icon(b.icon)}</span>
        <div class="why-card__body">
          <div class="why-card__title"><b>${b.title}</b>${pill(b.state, b.state === 'In demo' ? 'green' : 'neutral')}</div>
          <small>${b.copy}</small>
          <button class="link why-card__link" data-act="nav" data-surface="deliver" data-view="${b.view}">${b.link} ${icon('arrowRight')}</button>
        </div>
      </article>`).join('')}
    </div>

    <div class="why-deliver__cta">
      <div>
        <b>Ready to deliver with NearBuy?</b>
        <small>Join the local delivery network and become an important part of your neighbourhood's shopping experience.</small>
      </div>
      <div class="why-deliver__cta-actions">
        <button class="btn btn--primary btn--sm" data-act="nav" data-surface="deliver" data-view="register">Join as Delivery Partner ${icon('arrowRight')}</button>
        <button class="btn btn--ghost btn--sm" data-act="nav" data-surface="deliver" data-view="earnings">See how earnings work</button>
      </div>
    </div>

    <div class="why-block__foot">
      ${icon('shield')}
      <p><b>No guaranteed orders, fixed earnings or speed incentives.</b> Verified adults aged 18 and over only at launch; every request is yours to accept or decline. Pickup and delivery are confirmed at each handover, payouts are shown before you accept, and settlement details live in Earnings. <span class="why-legend"><i class="why-dot why-dot--green"></i> In demo — working in this prototype</span> <span class="why-legend"><i class="why-dot"></i> Partly — some of it is still planned</span></p>
    </div>
  </section>`;
}

function deliverHowStrip() {
  const steps = [
    ['Register as a delivery partner', 'Registration, identity verification and the 18+ eligibility check.', 'user'],
    ['Receive nearby requests', 'Eligible delivery opportunities from participating local shops.', 'pin'],
    ['Pick up and deliver', 'Accept, collect with QR/OTP verification, then confirm the delivery.', 'scan'],
    ['Receive your earnings', 'Completed deliveries, delivery-wise earnings and payout status.', 'rupee']
  ];
  return `<section class="how-strip mb-18" aria-labelledby="deliverHowTitle">
    <div class="between wrap mb-14">
      <div><span class="kicker"><i></i>HOW NEARBUY RUNNER WORKS</span><h2 id="deliverHowTitle" style="font-size:17px;margin-top:6px">Four steps from registration to your first payout.</h2></div>
      <a class="link" href="/runner/register/">Registration &amp; eligibility ${icon('arrowRight')}</a>
    </div>
    <div class="grid grid--4">
      ${steps.map(([title, copy, ic], i) => `<div class="how-step">
        <span class="how-step__num">${i + 1}</span>
        <span class="kpi__icon">${icon(ic)}</span>
        <b>${title}</b>
        <small>${copy}</small>
      </div>`).join('')}
    </div>
  </section>`;
}

function deliverFeatures() {
  const features = [
    ['Online / offline control', 'Only go live when you want work.', 'requests', 'zap'],
    ['Distance bands', '0–300 m to 2–3 km, chosen by you.', 'profile', 'pin'],
    ['Pickup & delivery OTP', 'Both handovers verified in the app.', 'active', 'scan'],
    ['Earnings statements', 'Delivery-wise payouts and history.', 'earnings', 'rupee'],
    ['Safety centre', 'SOS guidance and incident reports.', 'safety', 'shield'],
    ['Partner support', 'Issues, customers and account help.', 'support', 'help']
  ];
  return `<section class="card card--pad mb-18">
    <div class="between wrap mb-14">
      <div><span class="kicker"><i></i>BUILT FOR THE STREET</span><h2 style="font-size:17px;margin-top:6px">What the partner app gives you.</h2><p class="tiny muted" style="margin-top:4px">Every item below opens a working screen in this prototype.</p></div>
      <button class="btn btn--ghost btn--sm" data-act="nav" data-surface="deliver" data-view="profile">${icon('sliders')} Preferences</button>
    </div>
    <div class="grid grid--3">
      ${features.map(([title, copy, view, ic]) => `<button class="feature-card" data-act="nav" data-surface="deliver" data-view="${view}">
        <span class="kpi__icon">${icon(ic)}</span>
        <b>${title}</b>
        <small>${copy}</small>
        <span class="link">Open ${icon('arrowUpRight')}</span>
      </button>`).join('')}
    </div>
  </section>`;
}

function deliverRequests() {
  const r = me();
  const queue = state.tasks.filter((t) => t.status === 'Requested' && !(t.skippedBy || []).includes(r.id));
  const eligible = queue.filter((t) => t.distance <= r.maxKm && (!r.categories?.length || r.categories.includes(t.category)));
  return `<div class="page">
    ${pageHead('DELIVERY REQUESTS', `${queue.length} request${queue.length === 1 ? '' : 's'} nearby`, `Only tasks within ${r.maxKm} km and your chosen categories are offered. Passing never carries a penalty.`, `<button class="btn btn--ghost btn--sm" data-act="nav" data-surface="deliver" data-view="profile">${icon('sliders')} Preferences</button>`)}
    ${!r.online ? `<div class="notice mb-18">${icon('alert')}<span><b>You are offline.</b> Go online to accept new delivery requests.</span></div>` : ''}
    <div class="grid grid--aside">
      <div class="stack">
        ${eligible.length ? eligible.map((t) => taskCard(t)).join('') : card({ body: emptyState('pin', 'No matching requests', 'Try widening your distance preference, or check back in a moment.', `<button class="btn btn--ghost btn--sm" data-act="nav" data-surface="deliver" data-view="profile">Adjust preferences</button>`) })}
        ${queue.filter((t) => !eligible.includes(t)).length ? `<p class="tiny muted">${queue.filter((t) => !eligible.includes(t)).length} request(s) are outside your distance or category preferences.</p>` : ''}
      </div>
      <aside class="stack">
        ${card({ title: 'Your availability', body: `<div class="spread mb-10"><span class="small">Status</span><label class="toggle"><input type="checkbox" data-act="online-toggle" ${r.online ? 'checked' : ''}/><span class="track"></span><b>${r.online ? 'Online' : 'Offline'}</b></label></div>
          <div class="spread mb-10"><span class="small">Mode</span><b class="small">${r.mode}</b></div>
          <div class="spread mb-10"><span class="small">Max distance</span><b class="small">${r.maxKm} km</b></div>
          <div class="spread"><span class="small">Categories</span><b class="small">${(r.categories || []).length ? r.categories.length : 'All'}</b></div>` })}
        ${card({ title: 'What you earn', sub: 'Proposed demo bands', body: `<div class="stack-sm">${state.pricing.map((b) => `<div class="spread small"><span class="muted">${esc(b.distance)}</span><b>${money(b.pay)}</b></div>`).join('')}</div><p class="hint mt-10">Sample amounts only. No payment is made.</p>` })}
        ${card({ body: `<div class="row gap-8 small"><span class="kpi__icon">${icon('shield')}</span><div><b>No task is worth a risk.</b><div class="tiny muted">You can pause, pass or report anything at any time.</div></div></div>` })}
      </aside>
    </div>
  </div>`;
}
function deliverActive() {
  const t = activeDelivery();
  if (!t) return `<div class="page">
    ${pageHead('ACTIVE DELIVERY', 'No delivery in progress', 'Accept a nearby request and it will appear here, step by step.')}
    ${card({ body: emptyState('zap', 'Nothing on the road right now', 'When you accept a request, the full handover flow lives here.', `<button class="btn btn--primary btn--sm" data-act="nav" data-surface="deliver" data-view="requests">See requests ${icon('arrowRight')}</button>`) })}
  </div>`;
  const idx = clamp(RUNNER_FLOW.indexOf(t.status) - 1, 0, 4);
  const order = t.orderId ? orderById(t.orderId) : null;
  return `<div class="page">
    ${pageHead('ACTIVE DELIVERY · ' + t.id, `${t.shop} → ${t.customer}`, `${t.shopArea} to ${t.area} · ${t.distance} km · ${money(t.payout)} sample earning`, `<button class="btn btn--ghost btn--sm" data-act="nav" data-surface="deliver" data-view="safety">${icon('shield')} Safety centre</button>`)}
    <div class="grid grid--aside">
      <div class="stack">
        <section class="card card--pad">
          ${stepper(['Accepted', 'At shop', 'Picked up', 'On the way', 'Delivered'], idx)}
          <div class="grid grid--2 mt-18">
            <div class="card card--pad" style="background:#fdfbf7">
              <span class="kicker"><i></i>PICKUP</span>
              <b class="small" style="display:block;margin-bottom:2px">${esc(t.shop)}</b>
              <div class="tiny muted">${esc(t.shopArea)} · ${t.pickupDistance} km from your start</div>
              <div class="row gap-6 mt-10 wrap"><span class="otp">${esc(t.pickupPin)}<small>PICKUP OTP</small></span>${['At shop', 'Picked up', 'En route', 'Delivered'].includes(t.status) ? pill('Verified', 'green') : pill('Pending', 'amber')}</div>
            </div>
            <div class="card card--pad" style="background:#fdfbf7">
              <span class="kicker"><i></i>DROP</span>
              <b class="small" style="display:block;margin-bottom:2px">${esc(t.customer)}</b>
              <div class="tiny muted">${esc(t.area)} · customer OTP at the door</div>
              <div class="row gap-6 mt-10 wrap"><span class="otp">${esc(t.deliveryPin)}<small>CUSTOMER OTP</small></span>${t.status === 'Delivered' ? pill('Verified', 'green') : pill('Pending', 'amber')}</div>
            </div>
          </div>
          <div class="notice notice--info mt-14">${icon('scan')}<span>Demo handover: the codes above simulate OTP verification. No real OTP or contact with the customer happens.</span></div>
          <div class="row gap-8 wrap mt-14">
            <button class="btn btn--primary" data-act="arrive-shop" data-id="${t.id}" ${['At shop', 'Picked up', 'En route'].includes(t.status) ? 'disabled' : ''}>${icon('pin')} I am at the shop</button>
            <button class="btn btn--ghost" data-act="verify-pickup" data-id="${t.id}" ${t.status !== 'At shop' ? 'disabled' : ''}>${icon('scan')} Verify pickup OTP</button>
            <button class="btn btn--ghost" data-act="start-route" data-id="${t.id}" ${t.status !== 'Picked up' ? 'disabled' : ''}>${icon('truck')} Start route</button>
            <button class="btn btn--ghost" data-act="verify-delivery" data-id="${t.id}" ${t.status !== 'En route' ? 'disabled' : ''}>${icon('checkCircle')} Verify delivery OTP</button>
            <button class="btn btn--danger btn--sm" data-act="return-task" data-id="${t.id}">${icon('refresh', 'sm')} Cannot deliver</button>
          </div>
        </section>
        ${card({ title: 'Instructions from the shop', body: `<p class="small" style="line-height:1.6">“${esc(t.instructions)}”</p><div class="row gap-8 wrap mt-10"><span class="pill pill--outline">${t.items} items</span><span class="pill pill--outline">${t.weight} kg</span><span class="pill pill--outline">${esc(t.category)}</span></div>` })}
        ${order ? card({ title: 'This is order ' + order.id, sub: 'Linked automatically across the portal.', body: `<div class="stack-sm">${order.items.map((i) => `<div class="row gap-8 small"><span class="table__thumb">${i.emoji}</span><span class="flex1">${esc(i.name)} × ${i.qty}</span><b>${money(i.price * i.qty)}</b></div>`).join('')}</div><button class="btn btn--ghost btn--sm btn--block mt-10" data-act="switch" data-surface="sell" data-view="orders">${icon('store')} See the seller's view</button>` }) : ''}
      </div>
      <aside class="stack">
        ${card({ title: 'Task timeline', body: `<div class="timeline">${(t.timeline || []).map((e, i) => `<div class="timeline__row ${i === t.timeline.length - 1 ? 'now' : 'done'}"><span class="timeline__dot">${icon(i === t.timeline.length - 1 ? 'clock' : 'check')}</span><div class="timeline__body"><b>${esc(e.label)}</b><small>${esc(e.at)}</small></div></div>`).join('')}</div>` })}
        ${card({ title: 'Stay safe', body: `<ul class="stack-sm tiny muted" style="line-height:1.6">${['Use public, well-lit routes.', 'Follow road rules; do not rush.', 'Never open sealed parcels.', 'Stop and report anything unsafe.'].map((s) => `<li class="row gap-8">${icon('checkCircle', 'sm')}<span>${s}</span></li>`).join('')}</ul><button class="btn btn--ghost btn--sm btn--block mt-10" data-act="sos">${icon('alert')} Safety options</button>` })}
      </aside>
    </div>
  </div>`;
}
function deliverHistory() {
  const rows = myDeliveries().filter((t) => ['Delivered', 'Returned'].includes(t.status));
  return `<div class="page">
    ${pageHead('DELIVERY HISTORY', 'Delivery history', 'Every completed demo task, with the sample earning recorded.', `<button class="btn btn--ghost btn--sm" data-act="nav" data-surface="deliver" data-view="earnings">${icon('rupee')} Earnings</button>`)}
    <div class="grid grid--kpi">
      ${kpi({ label: 'Delivered', value: rows.filter((t) => t.status === 'Delivered').length, icon: 'checkCircle', foot: 'in this demo' })}
      ${kpi({ label: 'Returned', value: rows.filter((t) => t.status === 'Returned').length, icon: 'refresh', foot: 'recorded safely' })}
      ${kpi({ label: 'Distance', value: `${sumBy(rows, (t) => t.distance).toFixed(1)} km`, icon: 'pin', foot: 'sample total' })}
      ${kpi({ label: 'Sample earnings', value: money(earningsFor(me().id)), icon: 'rupee', foot: 'not paid out' })}
    </div>
    <section class="card card--flush">
      <div class="card__head"><div><h2>Completed tasks</h2><p>Task IDs match the shop and ops workspaces.</p></div>${pill('Demo data', 'outline')}</div>
      <div class="table-wrap"><table class="table"><thead><tr><th>TASK</th><th>SHOP → CUSTOMER</th><th>COMPLETED</th><th>DISTANCE</th><th>SAMPLE EARNING</th><th>STATUS</th></tr></thead>
        <tbody>${rows.map((t) => `<tr><td><b>${esc(t.id)}</b><small>${esc(t.category)}</small></td><td><b>${esc(t.shop)}</b><small>${esc(t.customer)} · ${esc(t.area)}</small></td><td class="tiny muted">${esc(t.completedAt || t.createdAt)}</td><td>${t.distance} km</td><td><b>${money(t.earned || t.payout)}</b></td><td>${statusPill(t.status)}</td></tr>`).join('') || `<tr><td colspan="6">${emptyState('archive', 'No history yet', 'Complete a delivery to see it here.')}</td></tr>`}</tbody></table></div>
    </section>
  </div>`;
}
function deliverEarnings() {
  const rows = myDeliveries().filter((t) => t.status === 'Delivered');
  const total = earningsFor(me().id);
  return `<div class="page">
    ${pageHead('EARNINGS', 'Earnings & payments', 'Sample amounts for completed demo deliveries. Nothing is paid out.', `<button class="btn btn--ghost btn--sm" data-act="export-earnings">${icon('download')} Export CSV</button>`)}
    <div class="grid grid--kpi">
      ${kpi({ label: 'Total earned', value: money(total), icon: 'rupee', foot: 'demo lifetime' })}
      ${kpi({ label: 'This week', value: money(total || 32), icon: 'chart', delta: '₹12', dir: 'up', foot: 'sample' })}
      ${kpi({ label: 'Deliveries', value: rows.length, icon: 'checkCircle', foot: 'completed' })}
      ${kpi({ label: 'Avg. per task', value: money(rows.length ? total / rows.length : 0), icon: 'tag', foot: 'demo average' })}
    </div>
    <div class="grid grid--main mb-18">
      ${card({ title: 'Last seven days', sub: 'Sample earnings by day', body: barChart([12, 28, 0, 32, 20, 45, total || 32], ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], { height: 170, format: (v) => `₹${v}` }) })}
      ${card({ title: 'Payouts', sub: 'Demo only', body: `<div class="stack-sm">${[['Fri, 14 Jun', 32, 'Scheduled'], ['Fri, 7 Jun', 48, 'Paid'], ['Fri, 31 May', 36, 'Paid']].map(([d, a, s]) => `<div class="settlement" style="padding:11px 0"><span class="table__thumb">${icon('wallet')}</span><div><b class="small">${d}</b><div class="tiny muted">Sample payout</div></div><div class="settlement__amt"><b>${money(a)}</b></div>${pill(s, s === 'Paid' ? 'green' : 'amber')}</div>`).join('')}</div><div class="notice notice--plain mt-10">${icon('shield')}<span>No bank account, UPI ID or real money is involved.</span></div>` })}
    </div>
    <section class="card card--flush">
      <div class="card__head"><div><h2>Earning lines</h2><p>One row per completed demo delivery.</p></div></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>TASK</th><th>SHOP</th><th>DATE</th><th>DISTANCE</th><th class="right">SAMPLE EARNING</th></tr></thead>
        <tbody>${rows.map((t) => `<tr><td><b>${esc(t.id)}</b></td><td>${esc(t.shop)}</td><td class="tiny muted">${esc(t.completedAt || t.createdAt)}</td><td>${t.distance} km</td><td class="right"><b>${money(t.earned || t.payout)}</b></td></tr>`).join('') || `<tr><td colspan="5">${emptyState('rupee', 'No earning lines yet', 'Complete a delivery to record a sample earning.')}</td></tr>`}</tbody></table></div>
    </section>
  </div>`;
}
function deliverProfile() {
  const r = me();
  const modes = ['Walking', 'Bicycle', 'Scooter'];
  return `<div class="page">
    ${pageHead('RUNNER PROFILE', 'Profile & preferences', 'Set the distance, parcel types and pace that feel right for you.', `<span class="live-dot ${r.online ? '' : 'off'}"><i></i>${r.online ? 'Online' : 'Offline'}</span>`)}
    <div class="grid grid--aside">
      <div class="stack">
        ${card({ title: 'Who is delivering', sub: 'Switch demo persona to see another runner.', body: `<div class="grid grid--3">${state.runners.map((x) => `<button class="radio-card ${x.id === r.id ? 'on' : ''}" data-act="runner-switch" data-id="${x.id}" style="text-align:left"><span class="ava ava--${x.avatar}">${x.initials}</span><span><b>${esc(x.name)}</b><small>${x.mode} · ${esc(x.zone)}</small></span></button>`).join('')}</div>` })}
        ${card({ title: 'Work preferences', body: `<form class="form-grid" id="runner-prefs" data-form="runner-prefs">
          <div class="form-grid form-grid--2">
            <label class="field"><span>Travel mode</span><select class="select" name="mode">${modes.map((m) => `<option ${r.mode === m ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
            <label class="field"><span>Home zone</span><select class="select" name="zone">${['Hauz Khas', 'Green Park', 'Saket', 'Greater Kailash'].map((z) => `<option ${r.zone === z ? 'selected' : ''}>${z}</option>`).join('')}</select></label>
          </div>
          <label class="field"><span>Maximum distance · ${r.maxKm} km</span><input type="range" min="0.5" max="3" step="0.5" name="maxKm" value="${r.maxKm}" data-act="range-max" style="accent-color:var(--accent)" /></label>
          <div class="field"><span>Parcel categories</span><div class="chips">${['Grocery', 'Stationery', 'General', 'Fragile'].map((c) => `<label class="chip ${r.categories?.includes(c) ? 'active' : ''}" style="cursor:pointer"><input type="checkbox" name="category" value="${c}" ${r.categories?.includes(c) ? 'checked' : ''} style="display:none" data-act="cat-toggle" />${c}</label>`).join('')}</div></div>
          <div class="stack-sm">
            <label class="row between" style="padding:9px 0;border-bottom:1px solid var(--line-soft)"><span class="small"><b>Task alerts</b><br><span class="tiny muted">Show new nearby requests</span></span><span class="toggle"><input type="checkbox" name="alerts" ${r.alerts ? 'checked' : ''}/><span class="track"></span></span></label>
            <label class="row between" style="padding:9px 0"><span class="small"><b>Share location while online</b><br><span class="tiny muted">Schematic in this demo — no GPS is used</span></span><span class="toggle"><input type="checkbox" name="shareLocation" ${r.shareLocation ? 'checked' : ''}/><span class="track"></span></span></label>
          </div>
          <button class="btn btn--primary">${icon('check')} Save preferences</button>
        </form>` })}
      </div>
      <aside class="stack">
        ${card({ body: `<div class="center" style="padding:6px 0 12px"><span class="ava ava--${r.avatar}" style="--s:64px">${r.initials}</span></div><div class="center"><b style="font-family:var(--display);font-size:16px">${esc(r.name)}</b><div class="tiny muted">Runner · ${esc(r.zone)} · age ${r.age}</div></div><div class="stat-strip mt-14"><div><b>${myDeliveries().filter((t) => t.status === 'Delivered').length}</b><small>Delivered</small></div><div><b>${money(earningsFor(r.id))}</b><small>Sample ₹</small></div><div><b>${r.maxKm} km</b><small>Radius</small></div></div>` })}
        ${card({ title: 'Eligibility', body: `<div class="row gap-8 small"><span class="kpi__icon">${icon('shield')}</span><div><b>Adult demo profile</b><div class="tiny muted">Age ${r.age} · no identity or KYC check is performed.</div></div></div><div class="notice notice--plain mt-10">${icon('lock')}<span>This demo does not create a work arrangement or legal eligibility.</span></div>` })}
      </aside>
    </div>
  </div>`;
}
function deliverSafety() {
  const r = me();
  const incidents = state.incidents.filter((i) => i.partnerId === r.id);
  return `<div class="page">
    ${pageHead('SAFETY CENTRE', 'Pause. Check. Decide.', 'A task is never worth a risk. Everything here is a local demo.', `<button class="btn btn--danger btn--sm" data-act="sos">${icon('alert')} Emergency options</button>`)}
    <div class="grid grid--main">
      <div class="stack">
        ${card({ title: 'Safe delivery checklist', body: `<div class="grid grid--2">${[['Accept what fits', 'Only distances and parcels you can handle comfortably.'], ['Choose the route', 'Public, well-lit and calm — even if it is longer.'], ['Protect the parcel', 'Never open sealed parcels or share contact details.'], ['Stop when unsure', 'Report unsafe conditions, damage or harassment.'], ['Take your time', 'No deadline in this demo asks you to rush.'], ['Keep it private', 'Do not enter personal data anywhere here.']].map(([t, s]) => `<div class="mini-stat">${icon('checkCircle')}<div><b>${t}</b><small>${s}</small></div></div>`).join('')}</div>` })}
        ${card({ title: 'Report a demo issue', sub: 'Reports appear instantly in the Ops workspace.', body: `<form class="form-grid" id="incident" data-form="incident"><div class="form-grid form-grid--2"><label class="field"><span>Issue type</span><select class="select" name="type">${['Route blocked or unsafe', 'Parcel damaged or incorrect', 'Customer unavailable', 'Harassment or safety concern', 'Other'].map((x) => `<option>${x}</option>`).join('')}</select></label><label class="field"><span>Related task (optional)</span><input class="input" type="text" name="task" placeholder="e.g. DR-1031" /></label></div><label class="field"><span>What happened?</span><textarea class="textarea" name="message" required placeholder="Keep it brief. Do not enter sensitive or personal information."></textarea></label><button class="btn btn--primary btn--sm" style="justify-self:start">${icon('shield')} Save sample report</button></form>` })}
      </div>
      <aside class="stack">
        ${card({ title: 'Your recent reports', body: incidents.length ? `<div class="stack-sm">${incidents.map((i) => `<div class="card card--pad" style="background:#fdfbf7"><div class="spread mb-6"><b class="small">${esc(i.type)}</b>${pill(i.status, i.status === 'Open' ? 'amber' : 'green')}</div><div class="tiny muted">${esc(i.message)}</div><div class="tiny muted mt-6">${esc(i.date)} · ${esc(i.id)}</div></div>`).join('')}</div>` : `<p class="small muted">No reports from you yet.</p>` })}
        ${card({ body: `<div class="notice">${icon('alert')}<span><b>This cannot call for help.</b> In a real emergency, move to a safe public place and contact local emergency services directly.</span></div>` })}
      </aside>
    </div>
  </div>`;
}
function deliverSupport() {
  return `<div class="page">
    ${pageHead('HELP & SUPPORT', 'You are not on your own', 'Questions about a task, earnings or the demo? Start here.', `<button class="btn btn--ghost btn--sm" data-act="nav" data-surface="deliver" data-view="safety">${icon('shield')} Safety centre</button>`)}
    <div class="grid grid--2 mb-18">
      ${[['Task questions', 'What happens if I cannot complete a delivery?', 'Use “Cannot deliver” on the active task. The parcel returns to the shop and Ops records the reason — no penalty in this demo.'],
        ['Earnings', 'When would I be paid?', 'In this demo, sample earnings are recorded per delivery. Nothing is transferred and no payout account is connected.'],
        ['Availability', 'Can I go offline at any time?', 'Yes. Your status, distance and categories are always under your control.'],
        ['Privacy', 'Who sees my location?', 'Nobody. This demo uses schematic maps, and location sharing is a toggle that stores a local preference only.']].map(([tagText, q, a]) => `<article class="card card--pad"><span class="tag">${tagText}</span><h3 style="font-size:15px;margin:9px 0 6px">${q}</h3><p class="small muted" style="line-height:1.6">${a}</p></article>`).join('')}
    </div>
    ${card({ title: 'Send a demo support note', sub: 'Saved locally — no one is contacted.', body: `<form class="form-grid" id="runner-support" data-form="runner-support"><div class="form-grid form-grid--2"><label class="field"><span>Topic</span><select class="select" name="topic"><option>Task issue</option><option>Earnings question</option><option>App or demo feedback</option><option>Safety</option></select></label><label class="field"><span>Task ID (optional)</span><input class="input" type="text" name="task" placeholder="e.g. DR-1032" /></label></div><label class="field"><span>Message</span><textarea class="textarea" name="message" required placeholder="How can we help?"></textarea></label><button class="btn btn--primary btn--sm" style="justify-self:start">${icon('mail')} Save note</button></form>` })}
  </div>`;
}
function deliverPage() {
  switch (route.view) {
    case 'requests': return deliverRequests();
    case 'active': return deliverActive();
    case 'history': return deliverHistory();
    case 'earnings': return deliverEarnings();
    case 'profile': return deliverProfile();
    case 'safety': return deliverSafety();
    case 'support': return deliverSupport();
    case 'register': return runnerOnboarding();
    default: return deliverOverview();
  }
}

/* ============================== FLEET WORKSPACE ============================= */
function fleetOverview() {
  const online = state.runners.filter((r) => r.online).length;
  const unassigned = state.tasks.filter((t) => t.status === 'Requested').length;
  const active = state.tasks.filter((t) => ['Assigned', 'At shop', 'Picked up', 'En route'].includes(t.status)).length;
  const delivered = state.tasks.filter((t) => t.status === 'Delivered').length;
  return `<div class="page">
    ${pageHead('BUSINESS PARTNER · HAUZ KHAS FLEET', 'Good morning, Neha', 'A small neighbourhood fleet, coordinated safely. This is a sample operator view.', `<button class="btn btn--primary btn--sm" data-act="nav" data-surface="fleet" data-view="allocation">${icon('pin')} Allocate work</button>`)}
    <div class="grid grid--kpi">
      ${kpi({ label: 'Team online', value: `${online}/${state.runners.length}`, icon: 'users', foot: 'adult demo profiles' })}
      ${kpi({ label: 'Unassigned', value: unassigned, icon: 'pin', foot: 'requests waiting' })}
      ${kpi({ label: 'In progress', value: active, icon: 'truck', foot: 'with a partner' })}
      ${kpi({ label: 'Delivered', value: delivered, icon: 'checkCircle', foot: 'sample records' })}
    </div>
    <div class="grid grid--main mb-18">
      <section class="card card--flush">
        <div class="card__head"><div><h2>Your delivery team</h2><p>Availability is controlled by each partner, not the fleet.</p></div><button class="link" data-act="nav" data-surface="fleet" data-view="team">Manage ${icon('arrowRight')}</button></div>
        <div class="card__body"><div class="seat-grid">${state.runners.map((r) => `<div class="seat">
          <div class="seat__top"><span class="ava ava--${r.avatar}">${r.initials}</span><div class="flex1"><b>${esc(r.name)}</b><small>${esc(r.mode)} · ${esc(r.zone)}</small></div>${pill(r.online ? 'Online' : 'Offline', r.online ? 'green' : 'neutral', true)}</div>
          <div class="seat__row"><span>Active task</span><b>${state.tasks.find((t) => t.partnerId === r.id && !['Delivered', 'Returned'].includes(t.status))?.id || '—'}</b></div>
          <div class="seat__row"><span>Delivered</span><b>${state.tasks.filter((t) => t.partnerId === r.id && t.status === 'Delivered').length}</b></div>
          <div class="seat__row"><span>Sample earnings</span><b>${money(earningsFor(r.id))}</b></div>
        </div>`).join('')}</div></div>
      </section>
      <div class="stack">
        ${card({ title: 'Work waiting', sub: 'Unassigned requests', action: `<button class="link" data-act="nav" data-surface="fleet" data-view="allocation">All ${icon('arrowRight')}</button>`, body: `<div class="stack-sm">${state.tasks.filter((t) => t.status === 'Requested').map((t) => `<div class="row gap-10" style="padding:9px 0;border-bottom:1px solid var(--line-soft)"><span class="kpi__icon">${icon('pin')}</span><div class="flex1"><b class="small">${esc(t.shop)}</b><div class="tiny muted">${esc(t.area)} · ${t.distance} km · ${money(t.payout)}</div></div><button class="btn btn--ghost btn--xs" data-act="auto-match" data-id="${t.id}">Match</button></div>`).join('') || '<p class="small muted">Nothing waiting right now.</p>'}</div>` })}
        ${card({ title: 'Fleet volume', sub: 'Completed tasks · sample', body: barChart([3, 5, 4, 7, 6, 9, 5], ['M', 'T', 'W', 'T', 'F', 'S', 'S'], { height: 96 }) })}
      </div>
    </div>
    <section class="card card--pad">
      <div class="between wrap mb-14"><div><span class="kicker"><i></i>OPERATING BOUNDARIES</span><h2 style="font-size:17px">Proposed for a supervised pilot.</h2></div><button class="btn btn--ghost btn--sm" data-act="nav" data-surface="fleet" data-view="settings">${icon('shield')} Safety & account</button></div>
      <div class="grid grid--4">
        ${[['pin', 'Hauz Khas · Delhi', 'Demo fleet service area'], ['clock', '1–3 km', 'Short distances only'], ['shield', 'Adult partners', 'Proposed 18+ launch policy'], ['bike', 'Walk & cycle first', 'Lightweight parcels']].map(([ic, t, s]) => `<div class="mini-stat"><span class="kpi__icon">${icon(ic)}</span><div><b>${t}</b><small>${s}</small></div></div>`).join('')}
      </div>
    </section>
  </div>`;
}
function fleetTeam() {
  return `<div class="page">
    ${pageHead('FLEET · TEAM', 'Delivery team', 'Every person delivering must meet NearBuy’s individual eligibility rules. This demo verifies nothing.', `<button class="btn btn--ghost btn--sm" data-act="toast" data-msg="Demo invite saved. No email was sent.">${icon('plus')} Add teammate</button>`)}
    <div class="grid grid--kpi">
      ${kpi({ label: 'Teammates', value: state.runners.length, icon: 'users', foot: 'demo profiles' })}
      ${kpi({ label: 'Online now', value: state.runners.filter((r) => r.online).length, icon: 'zap', foot: 'available' })}
      ${kpi({ label: 'Average rating', value: '4.9', icon: 'star', foot: 'sample' })}
      ${kpi({ label: 'Tasks completed', value: state.tasks.filter((t) => t.status === 'Delivered').length, icon: 'checkCircle', foot: 'this demo' })}
    </div>
    <div class="grid grid--3">
      ${state.runners.map((r) => `<section class="card card--pad">
        <div class="between mb-14"><div class="row gap-10"><span class="ava ava--${r.avatar}" style="--s:42px">${r.initials}</span><div><b style="font-family:var(--display);font-size:15px">${esc(r.name)}</b><div class="tiny muted">Age ${r.age} · ${esc(r.mode)}</div></div></div>${pill(r.online ? 'Online' : 'Offline', r.online ? 'green' : 'neutral', true)}</div>
        <div class="stack-sm">
          <div class="spread small"><span class="muted">Home zone</span><b>${esc(r.zone)}</b></div>
          <div class="spread small"><span class="muted">Max distance</span><b>${r.maxKm} km</b></div>
          <div class="spread small"><span class="muted">Categories</span><b>${(r.categories || []).join(', ') || 'All'}</b></div>
          <div class="spread small"><span class="muted">Sample earnings</span><b>${money(earningsFor(r.id))}</b></div>
        </div>
        <hr class="hr" />
        <div class="row gap-6 wrap"><button class="btn btn--ghost btn--xs" data-act="runner-online" data-id="${r.id}">${icon(r.online ? 'pause' : 'zap', 'sm')} ${r.online ? 'Set offline' : 'Set online'}</button><button class="btn btn--ghost btn--xs" data-act="nav" data-surface="deliver" data-view="profile">${icon('eye', 'sm')} Profile</button></div>
        <p class="hint mt-10">Eligibility, identity and work status are not verified in this demo.</p>
      </section>`).join('')}
    </div>
  </div>`;
}
function fleetAllocation() {
  const tasks = state.tasks.filter((t) => !['Delivered', 'Returned', 'Cancelled'].includes(t.status));
  return `<div class="page">
    ${pageHead('FLEET · WORK ALLOCATION', 'Work allocation', 'Match nearby requests to available adult demo profiles. Nothing is dispatched in reality.', `<button class="btn btn--primary btn--sm" data-act="auto-match-all">${icon('zap')} Auto-match all</button>`)}
    <div class="grid grid--aside">
      <section class="card card--flush">
        <div class="card__head"><div><h2>Open work</h2><p>Requests are only visible to partners within their own preferences.</p></div>${pill(`${tasks.length} open`, 'blue')}</div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>TASK</th><th>ROUTE</th><th>DISTANCE</th><th>PARTNER PAY</th><th>STATUS</th><th class="right">ASSIGN</th></tr></thead>
          <tbody>${tasks.map((t) => `<tr>
            <td><b>${esc(t.id)}</b><small>${esc(t.createdAt)}</small></td>
            <td><b>${esc(t.shop)}</b><small>→ ${esc(t.customer)} · ${esc(t.area)}</small></td>
            <td>${t.distance} km</td><td><b>${money(t.payout)}</b></td><td>${statusPill(t.status)}</td>
            <td><div class="actions">${t.status === 'Requested' ? `<button class="btn btn--primary btn--xs" data-act="auto-match" data-id="${t.id}">${icon('zap', 'sm')} Match</button>` : `<span class="tiny muted">${esc(t.partnerName || '—')}</span>`}<button class="btn btn--ghost btn--xs" data-act="task-detail" data-id="${t.id}" aria-label="View task ${esc(t.id)}">${icon('eye', 'sm')}</button></div></td>
          </tr>`).join('') || `<tr><td colspan="6">${emptyState('pin', 'No open work', 'New shop requests will appear here.')}</td></tr>`}</tbody>
        </table></div>
      </section>
      <aside class="stack">
        ${card({ title: 'Available partners', body: `<div class="stack-sm">${state.runners.map((r) => `<div class="row gap-10" style="padding:8px 0;border-bottom:1px solid var(--line-soft)"><span class="ava ava--sm ava--${r.avatar}">${r.initials}</span><div class="flex1"><b class="small">${esc(r.name)}</b><div class="tiny muted">${esc(r.mode)} · ${r.maxKm} km · ${esc(r.zone)}</div></div>${pill(r.online ? 'Online' : 'Offline', r.online ? 'green' : 'neutral', true)}</div>`).join('')}</div>` })}
        ${card({ body: `<div class="notice notice--info">${icon('shield')}<span>Matching here is a simulation. A real system would require verified eligibility, consent and legal review.</span></div>` })}
      </aside>
    </div>
  </div>`;
}
function fleetReports() {
  return `<div class="page">
    ${pageHead('FLEET · REPORTS', 'Reports', 'How the sample fleet is moving this week.', `<button class="btn btn--ghost btn--sm" data-act="export-payouts">${icon('download')} Export report</button>`)}
    <div class="grid grid--kpi">
      ${kpi({ label: 'Tasks this week', value: state.tasks.length, icon: 'clipboard', delta: '12%', foot: 'vs last week' })}
      ${kpi({ label: 'Completion rate', value: `${pct(state.tasks.filter((t) => t.status === 'Delivered').length, state.tasks.length)}%`, icon: 'checkCircle', foot: 'demo tasks' })}
      ${kpi({ label: 'Average distance', value: `${(sumBy(state.tasks, (t) => t.distance) / (state.tasks.length || 1)).toFixed(1)} km`, icon: 'pin', foot: 'short-radius only' })}
      ${kpi({ label: 'Sample partner pay', value: money(sumBy(state.tasks, (t) => t.payout)), icon: 'rupee', foot: 'not paid out' })}
    </div>
    <div class="grid grid--main mb-18">
      ${card({ title: 'Completed tasks', sub: 'Daily totals · demo', body: barChart([3, 5, 4, 7, 6, 9, 5], ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], { height: 160 }) })}
      ${card({ title: 'Task mix', body: donutChart([{ label: 'Grocery', value: 6, color: '#6f4fe0' }, { label: 'Stationery', value: 2, color: '#f47718' }, { label: 'General', value: 2, color: '#2f6bd8' }], '10', 'demo tasks') })}
    </div>
    <section class="card card--flush">
      <div class="card__head"><div><h2>By partner</h2><p>Sample activity only.</p></div></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>PARTNER</th><th>STATUS</th><th>TASKS</th><th>DISTANCE</th><th>COMPLETION</th><th class="right">SAMPLE PAY</th></tr></thead>
        <tbody>${state.runners.map((r) => { const mine = state.tasks.filter((t) => t.partnerId === r.id); const done = mine.filter((t) => t.status === 'Delivered'); return `<tr><td><div class="cell-item"><span class="ava ava--xs ava--${r.avatar}">${r.initials}</span><div><b>${esc(r.name)}</b><small>${esc(r.zone)}</small></div></div></td><td>${pill(r.online ? 'Online' : 'Offline', r.online ? 'green' : 'neutral', true)}</td><td><b>${mine.length}</b></td><td>${sumBy(done, (t) => t.distance).toFixed(1)} km</td><td><div class="stockbar"><div class="meter"><i style="width:${pct(done.length, mine.length || 1)}%"></i></div><b>${pct(done.length, mine.length || 1)}%</b></div></td><td class="right"><b>${money(earningsFor(r.id))}</b></td></tr>`; }).join('')}</tbody></table></div>
    </section>
  </div>`;
}
function fleetSettings() {
  return `<div class="page">
    ${pageHead('FLEET · ACCOUNT & SAFETY', 'Account & safety', 'The rules this demo fleet operates under.', `<button class="btn btn--ghost btn--sm" data-act="nav" data-surface="ops" data-view="incidents">${icon('alert')} Open incidents</button>`)}
    <div class="grid grid--aside">
      <div class="stack">
        ${card({ title: 'Business profile', body: `<div class="form-grid"><div class="form-grid form-grid--2"><label class="field"><span>Business name</span><input class="input" type="text" value="Hauz Khas Neighbourhood Fleet" /></label><label class="field"><span>Contact</span><input class="input" type="text" value="fleet@nearbuy.demo" /></label></div><label class="field"><span>Service area</span><input class="input" type="text" value="Hauz Khas, Green Park, Saket · Delhi" /></label><div class="notice notice--plain">${icon('shield')}<span>Business verification, insurance and worker arrangements are out of scope for this demo.</span></div></div>` })}
        ${card({ title: 'Safety commitments', body: `<div class="grid grid--2">${[['Adult-only demo profiles', 'No one under 18 can take work in this demo.'], ['Short distances', '1–3 km parcels only, walking and cycling first.'], ['Partner control', 'Partners choose availability, distance and categories.'], ['Visible reporting', 'Every safety report appears in the Ops audit trail.'], ['No hidden tracking', 'Location is schematic; no GPS is collected.'], ['No real dispatch', 'Nobody is sent anywhere by this demo.']].map(([t, s]) => `<div class="mini-stat">${icon('checkCircle')}<div><b>${t}</b><small>${s}</small></div></div>`).join('')}</div>` })}
      </div>
      <aside class="stack">
        ${card({ title: 'Demo status', body: `<div class="stack-sm"><div class="spread small"><span class="muted">Mode</span><b>Sample operations</b></div><div class="spread small"><span class="muted">Payouts</span><b>Simulated</b></div><div class="spread small"><span class="muted">Verification</span><b>Not performed</b></div><div class="spread small"><span class="muted">Data</span><b>This browser only</b></div></div><button class="btn btn--danger btn--sm btn--block mt-14" data-act="reset">${icon('refresh')} Reset demo data</button>` })}
      </aside>
    </div>
  </div>`;
}
function fleetPage() {
  switch (route.view) {
    case 'team': return fleetTeam();
    case 'allocation': return fleetAllocation();
    case 'reports': return fleetReports();
    case 'settings': return fleetSettings();
    default: return fleetOverview();
  }
}

/* =============================== OPS WORKSPACE ============================== */
function mapBoard(tasks) {
  const pins = [
    { x: 22, y: 28, cls: 'map-pin--a', label: 'Shop' },
    { x: 63, y: 22, cls: 'map-pin--b', label: 'Drop' },
    { x: 40, y: 62, cls: '', label: 'R1' },
    { x: 76, y: 58, cls: 'map-pin--a', label: 'Shop' }
  ];
  return `<div class="map-board">
    <div class="map-note" style="left:12px;top:10px">Hauz Khas · live demo</div>
    <div class="map-note" style="right:12px;bottom:10px">Schematic · no GPS</div>
    ${tasks.slice(0, 4).map((t, i) => { const p = pins[i % pins.length]; return `<span class="map-pin ${p.cls}" style="left:${p.x}%;top:${p.y}%"><span>${i + 1}</span></span><span class="map-note" style="left:calc(${p.x}% + 22px);top:calc(${p.y}% - 4px)">${esc(t.id)} · ${t.distance} km</span>`; }).join('')}
    <span class="map-pin" style="left:48%;top:44%;background:var(--ink)"><span>HQ</span></span>
  </div>`;
}
function opsOverview() {
  const reqs = state.tasks.filter((t) => t.status === 'Requested');
  const active = state.tasks.filter((t) => ['Assigned', 'At shop', 'Picked up', 'En route'].includes(t.status));
  return `<div class="page">
    ${pageHead('OPERATIONS · SOUTH DELHI', 'Operations control tower', 'A supervisory view of the simulated delivery network. These figures do not describe live operations.', `<button class="btn btn--ghost btn--sm" data-act="nav" data-surface="ops" data-view="audit">${icon('clipboard')} Audit log</button><button class="btn btn--primary btn--sm" data-act="nav" data-surface="ops" data-view="dispatch">${icon('pin')} Dispatch</button>`)}
    <div class="grid grid--kpi">
      ${kpi({ label: 'Requests in queue', value: reqs.length, icon: 'pin', foot: 'no real partner notified' })}
      ${kpi({ label: 'Active tasks', value: active.length, icon: 'truck', foot: 'movement in the demo' })}
      ${kpi({ label: 'Adult demo profiles', value: state.runners.filter((r) => r.age >= 18).length, icon: 'users', foot: 'KYC not performed' })}
      ${kpi({ label: 'Open incidents', value: openIncidents().length, icon: 'alert', foot: 'no safety team receives these' })}
    </div>
    <div class="grid grid--main mb-18">
      <section class="card card--flush">
        <div class="card__head"><div><h2>Network board</h2><p>Requests and active tasks across the neighbourhood.</p></div><span class="live-dot"><i></i>Demo live loop</span></div>
        <div class="card__body">${mapBoard([...reqs, ...active])}</div>
        <div class="card__foot between"><span class="tiny muted">${reqs.length} waiting · ${active.length} moving · ${state.tasks.filter((t) => t.status === 'Delivered').length} delivered</span><button class="link" data-act="nav" data-surface="ops" data-view="dispatch">Open dispatch ${icon('arrowRight')}</button></div>
      </section>
      <div class="stack">
        ${card({ title: 'Awaiting a partner', sub: 'Manual match only — nothing is dispatched.', body: `<div class="stack-sm">${reqs.map((t) => `<div class="row gap-10" style="padding:9px 0;border-bottom:1px solid var(--line-soft)"><span class="kpi__icon">${icon('pin')}</span><div class="flex1"><b class="small">${esc(t.id)} · ${esc(t.shop)}</b><div class="tiny muted">${esc(t.area)} · ${t.distance} km · ${money(t.payout)}</div></div><button class="btn btn--ghost btn--xs" data-act="auto-match" data-id="${t.id}">Match</button></div>`).join('') || '<p class="small muted">Queue is clear.</p>'}</div>` })}
        ${card({ title: 'Recent audit', sub: 'Local only', action: `<button class="link" data-act="nav" data-surface="ops" data-view="audit">All ${icon('arrowRight')}</button>`, body: `<div class="console">${state.audit.slice(0, 4).map((a) => `<div class="console__line"><b>${esc(a.action)}</b><span class="muted clamp1">${esc(a.detail)}</span><small>${esc(a.time)}</small></div>`).join('')}</div>` })}
      </div>
    </div>
    <div class="grid grid--2">
      ${card({ title: 'Partner availability', sub: 'Availability is always the partner’s choice.', action: `<button class="link" data-act="nav" data-surface="ops" data-view="partners">Records ${icon('arrowRight')}</button>`, body: `<div class="seat-grid" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr))">${state.runners.map((r) => `<div class="seat" style="padding:11px"><div class="seat__top"><span class="ava ava--xs ava--${r.avatar}">${r.initials}</span><div class="flex1"><b>${esc(r.name.split(' ')[0])}</b><small>${esc(r.mode)} · age ${r.age}</small></div>${pill(r.online ? 'Online' : 'Offline', r.online ? 'green' : 'neutral', true)}</div></div>`).join('')}</div>` })}
      ${card({ title: 'Safety & incidents', sub: 'Reports land here from the Runner app.', action: `<button class="link" data-act="nav" data-surface="ops" data-view="incidents">Open ${icon('arrowRight')}</button>`, body: `<div class="stack-sm">${state.incidents.slice(0, 3).map((i) => `<div class="spread" style="padding:8px 0;border-bottom:1px solid var(--line-soft)"><div><b class="small">${esc(i.type)}</b><div class="tiny muted">${esc(i.partner)} · ${esc(i.task || 'no task')} · ${esc(i.date)}</div></div>${pill(i.status, i.status === 'Open' ? 'amber' : 'green')}</div>`).join('') || '<p class="small muted">No incidents recorded.</p>'}</div><div class="notice mt-10">${icon('alert')}<span>This console cannot contact emergency services or a real safety team.</span></div>` })}
    </div>
  </div>`;
}
function opsDispatch() {
  const tasks = state.tasks.filter((t) => !['Cancelled'].includes(t.status));
  const req = tasks.filter((t) => t.status === 'Requested');
  const rest = tasks.filter((t) => t.status !== 'Requested');
  return `<div class="page">
    ${pageHead('OPS · DISPATCH', 'Delivery dispatch', 'Manually match requests to eligible adult demo profiles. No real dispatch occurs.', `<button class="btn btn--primary btn--sm" data-act="auto-match-all">${icon('zap')} Auto-match queue</button>`)}
    <div class="grid grid--kpi">
      ${kpi({ label: 'Waiting', value: req.length, icon: 'clock', foot: 'unmatched requests' })}
      ${kpi({ label: 'Assigned', value: rest.filter((t) => ['Assigned', 'At shop', 'Picked up', 'En route'].includes(t.status)).length, icon: 'truck', foot: 'in motion' })}
      ${kpi({ label: 'Delivered', value: tasks.filter((t) => t.status === 'Delivered').length, icon: 'checkCircle', foot: 'sample total' })}
      ${kpi({ label: 'Returned', value: tasks.filter((t) => t.status === 'Returned').length, icon: 'refresh', foot: 'recorded safely' })}
    </div>
    <section class="card card--flush">
      <div class="card__head"><div><h2>Dispatch queue</h2><p>Matching considers availability, distance preference and parcel category only.</p></div>${pill('Manual matching', 'outline')}</div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>TASK</th><th>SHOP</th><th>CUSTOMER AREA</th><th>DISTANCE</th><th>PAY</th><th>PARTNER</th><th>STATUS</th><th class="right">ACTION</th></tr></thead>
        <tbody>${[...req, ...rest].map((t) => `<tr>
          <td><b>${esc(t.id)}</b><small>${esc(t.createdAt)}</small></td>
          <td>${esc(t.shop)}<small>${esc(t.shopArea)}</small></td>
          <td>${esc(t.customer)}<small>${esc(t.area)}</small></td>
          <td>${t.distance} km</td><td><b>${money(t.payout)}</b></td>
          <td>${t.partnerName ? `<span class="pill pill--blue">${esc(t.partnerName)}</span>` : '<span class="tiny muted">Unassigned</span>'}</td>
          <td>${statusPill(t.status)}</td>
          <td><div class="actions">${t.status === 'Requested' ? `<button class="btn btn--primary btn--xs" data-act="auto-match" data-id="${t.id}">${icon('zap', 'sm')} Match</button>` : ''}<button class="btn btn--ghost btn--xs" data-act="task-detail" data-id="${t.id}" aria-label="View task ${esc(t.id)}">${icon('eye', 'sm')}</button></div></td>
        </tr>`).join('') || `<tr><td colspan="8">${emptyState('pin', 'Nothing to dispatch', 'Shop requests will appear here automatically.')}</td></tr>`}</tbody>
      </table></div>
    </section>
  </div>`;
}
function opsPartners() {
  return `<div class="page">
    ${pageHead('OPS · PARTNERS', 'Partner eligibility', 'Every delivery partner must individually meet NearBuy’s adult-eligibility, identity, safety and legal requirements. This demo verifies none of them.', `<span class="chip active">${icon('shield')} Demo records</span>`)}
    <div class="grid grid--kpi">
      ${kpi({ label: 'Demo profiles', value: state.runners.length, icon: 'users', foot: 'all adult (21–31)' })}
      ${kpi({ label: 'Online', value: state.runners.filter((r) => r.online).length, icon: 'zap', foot: 'self-selected' })}
      ${kpi({ label: 'KYC checks', value: '0', icon: 'lock', foot: 'not performed' })}
      ${kpi({ label: 'Age-gate pass rate', value: '100%', icon: 'checkCircle', foot: 'demo profiles only' })}
    </div>
    <section class="card card--flush">
      <div class="card__head"><div><h2>Eligibility records</h2><p>Sample data. No identity document, address or background check exists.</p></div><button class="btn btn--ghost btn--sm" data-act="toast" data-msg="Demo eligibility export prepared (no data leaves this browser).">${icon('download')} Export</button></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>PARTNER</th><th>AGE</th><th>MODE</th><th>ZONE</th><th>PREFERENCES</th><th>ELIGIBILITY</th><th class="right">AVAILABILITY</th></tr></thead>
        <tbody>${state.runners.map((r) => `<tr>
          <td><div class="cell-item"><span class="ava ava--xs ava--${r.avatar}">${r.initials}</span><div><b>${esc(r.name)}</b><small>${esc(r.id)}</small></div></div></td>
          <td><b>${r.age}</b><small>${r.age >= 18 ? 'Adult' : 'Under 18'}</small></td>
          <td>${esc(r.mode)}</td><td>${esc(r.zone)}</td>
          <td class="tiny muted">Max ${r.maxKm} km · ${(r.categories || []).join(', ') || 'all parcels'}</td>
          <td>${pill('Demo eligible', 'green')}<small class="tiny muted">Not verified</small></td>
          <td class="right">${pill(r.online ? 'Online' : 'Offline', r.online ? 'green' : 'neutral', true)}</td>
        </tr>`).join('')}</tbody>
      </table></div>
      <div class="card__foot"><div class="notice notice--plain">${icon('alert')}<span>The proposed adult-only delivery policy, and any real worker arrangement, require qualified Indian legal review. This demo does not determine legal eligibility.</span></div></div>
    </section>
  </div>`;
}
function opsAreas() {
  return `<div class="page">
    ${pageHead('OPS · SERVICE AREAS', 'Service areas', 'Where the demo network is proposed to operate, and how far.', `<button class="btn btn--primary btn--sm" data-act="add-area">${icon('plus')} Add area</button>`)}
    <div class="grid grid--3 mb-18">
      ${state.areas.map((a) => `<section class="card card--pad">
        <div class="between mb-10"><div class="row gap-10"><span class="kpi__icon">${icon('pin')}</span><div><b style="font-family:var(--display);font-size:15px">${esc(a.name)}</b><div class="tiny muted">${esc(a.city)} · ${a.radius} km radius</div></div></div>${pill(a.status, a.status === 'Pilot' ? 'green' : 'amber')}</div>
        <div class="stat-strip mb-10"><div><b>${a.shops}</b><small>Sample shops</small></div><div><b>${a.partners}</b><small>Demo partners</small></div><div><b>${a.radius} km</b><small>Radius</small></div></div>
        <div class="row gap-6 wrap"><button class="btn btn--ghost btn--xs" data-act="area-edit" data-id="${a.id}">${icon('sliders', 'sm')} Radius &amp; status</button><button class="btn btn--ghost btn--xs" data-act="toast" data-msg="${esc(a.name)} map preview is schematic in this demo.">${icon('eye', 'sm')} Preview</button></div>
      </section>`).join('')}
    </div>
    <section class="card card--pad">
      <div class="grid grid--2">
        <div><span class="kicker"><i></i>HOW AREAS WORK</span><h2 style="font-size:17px">Short radius, real neighbourhoods.</h2><p class="small muted mt-6" style="line-height:1.6">Each area has its own radius and proposed pricing band. Shops can only sell to neighbours within the area's radius, and runners only see tasks inside their own preference and the area limit.</p></div>
        <div class="map-board" style="min-height:170px">${state.areas.map((a, i) => `<span class="map-pin ${i === 0 ? 'map-pin--a' : ''}" style="left:${20 + i * 24}%;top:${34 + (i % 2) * 22}%"><span>${esc(a.name[0])}</span></span>`).join('')}<span class="map-note" style="right:10px;bottom:8px">Delhi · schematic</span></div>
      </div>
    </section>
  </div>`;
}
function opsPricing() {
  return `<div class="page">
    ${pageHead('OPS · PRICING BANDS', 'Pricing bands', 'Proposed sample partner pay by distance. These are not promised rates.', `<button class="btn btn--ghost btn--sm" data-act="nav" data-surface="deliver" data-view="earnings">${icon('rupee')} Runner view</button>`)}
    <div class="grid grid--aside">
      <section class="card card--flush">
        <div class="card__head"><div><h2>Distance bands</h2><p>Edit a sample amount and every workspace reflects it.</p></div></div>
        <div class="table-wrap"><table class="table"><thead><tr><th>BAND</th><th>DISTANCE</th><th>MAX KM</th><th>SAMPLE PARTNER PAY</th><th class="right">UPDATE</th></tr></thead>
          <tbody>${state.pricing.map((b) => `<tr><td><b>${esc(b.label)}</b><small>${esc(b.id)}</small></td><td>${esc(b.distance)}</td><td>${b.max} km</td><td><b>${money(b.pay)}</b></td><td class="right"><div class="row gap-6" style="justify-content:flex-end"><input class="input" type="number" min="0" value="${b.pay}" data-act="pricing-input" data-id="${b.id}" style="width:74px;height:30px;text-align:right" /><button class="btn btn--ghost btn--xs" data-act="pricing-save" data-id="${b.id}">${icon('check', 'sm')} Save</button></div></td></tr>`).join('')}</tbody></table></div>
      </section>
      <aside class="stack">
        ${card({ title: 'What a runner sees', body: `<div class="stack-sm">${state.pricing.map((b) => `<div class="spread small"><span class="muted">${esc(b.distance)}</span><b>${money(b.pay)}</b></div>`).join('')}</div><p class="hint mt-10">Sample amounts. No payout is made in this demo.</p>` })}
        ${card({ body: `<div class="notice">${icon('alert')}<span>Pricing here is illustrative only. Real partner pay requires legal, tax and worker-arrangement review.</span></div>` })}
      </aside>
    </div>
  </div>`;
}
function opsIncidents() {
  return `<div class="page">
    ${pageHead('OPS · SAFETY & INCIDENTS', 'Safety & incidents', 'Reports raised in the Runner app land here for review.', `<span class="chip active">${icon('alert')} ${openIncidents().length} open</span>`)}
    <div class="grid grid--main">
      <section class="card card--flush">
        <div class="card__head"><div><h2>Incident log</h2><p>Sample reports only — nobody is notified outside this browser.</p></div></div>
        <div class="rows">${state.incidents.map((i) => `<div class="list-row">
          <span class="kpi__icon">${icon('alert')}</span>
          <div class="list-row__main"><b>${esc(i.type)} · ${esc(i.partner)}</b><small>${esc(i.message)}</small><div class="tiny muted mt-6">${esc(i.id)} · task ${esc(i.task || '—')} · ${esc(i.date)}</div></div>
          <div class="list-row__end">${pill(i.status, i.status === 'Open' ? 'amber' : 'green')}${i.status === 'Open' ? `<button class="btn btn--primary btn--xs" data-act="resolve-incident" data-id="${i.id}">${icon('check', 'sm')} Resolve</button>` : ''}</div>
        </div>`).join('') || emptyState('shield', 'No incidents recorded', 'Reports from the Runner app will appear here.')}</div>
      </section>
      <aside class="stack">
        ${card({ title: 'Escalation policy', sub: 'Demo copy', body: `<div class="timeline">${[['Report raised', 'Runner saves a local report.'], ['Paused task', 'The parcel returns to the shop.'], ['Ops review', 'This log records the decision.'], ['Follow-up', 'Not implemented in this demo.']].map(([t, s], i) => `<div class="timeline__row ${i === 0 ? 'now' : ''}"><span class="timeline__dot">${icon(i === 0 ? 'clock' : 'check')}</span><div class="timeline__body"><b>${t}</b><small>${s}</small></div></div>`).join('')}</div>` })}
        ${card({ body: `<div class="notice">${icon('alert')}<span><b>No emergency response exists here.</b> This demo cannot contact emergency services, safety teams or customers.</span></div>` })}
      </aside>
    </div>
  </div>`;
}
function opsEnquiries() {
  const list = state.enquiries;
  const fresh = list.filter((e) => e.status === 'New');
  const answered = list.filter((e) => e.status === 'Responded');
  const closed = list.filter((e) => e.status === 'Closed');
  const row = (e) => `<div class="list-row">
    <span class="kpi__icon">${icon('mail')}</span>
    <div class="list-row__main">
      <b>${esc(e.name)} <span class="tiny muted">· ${esc(e.contact)}</span></b>
      <small>${esc(e.message)}</small>
      <div class="tiny muted mt-6">${esc(e.id)} · ${esc(e.topic)} · ${esc(e.at)} · ${esc(e.source || 'Homepage')}${e.demo ? ' · sample row' : ''}</div>
    </div>
    <div class="list-row__end">
      ${pill(e.status, e.status === 'New' ? 'amber' : e.status === 'Responded' ? 'blue' : 'neutral')}
      ${e.status === 'New' ? `<button class="btn btn--primary btn--xs" data-act="enquiry-status" data-id="${e.id}" data-status="Responded">${icon('check', 'sm')} Mark answered</button>` : ''}
      ${e.status === 'Closed'
        ? `<button class="btn btn--ghost btn--xs" data-act="enquiry-status" data-id="${e.id}" data-status="New">${icon('refresh', 'sm')} Reopen</button>`
        : `<button class="btn btn--ghost btn--xs" data-act="enquiry-status" data-id="${e.id}" data-status="Closed">${icon('x', 'sm')} Close</button>`}
    </div>
  </div>`;
  return `<div class="page">
    ${pageHead('OPS · ENQUIRIES', 'Enquiry queue', 'Queries submitted through the homepage Help & Support form land here for review.', `<span class="chip active">${icon('inbox')} ${fresh.length} new</span>`)}
    <div class="grid grid--kpi">
      ${kpi({ label: 'New queries', value: fresh.length, icon: 'inbox', foot: 'waiting for a first reply' })}
      ${kpi({ label: 'Answered', value: answered.length, icon: 'checkCircle', foot: 'marked by an operator' })}
      ${kpi({ label: 'Closed', value: closed.length, icon: 'archive', foot: 'no further action' })}
      ${kpi({ label: 'Topics covered', value: new Set(list.map((e) => e.topic)).size, icon: 'tag', foot: 'of 7 form topics' })}
    </div>
    <div class="grid grid--aside">
      <section class="card card--flush">
        <div class="card__head"><div><h2>Enquiry log</h2><p>Newest first. Status changes are written to the audit log.</p></div></div>
        <div class="rows">${list.length ? list.map(row).join('') : emptyState('inbox', 'No enquiries yet', 'Submit the Help & Support form on the homepage and it will appear here.', `<a class="btn btn--ghost btn--sm mt-10" href="/#support">${icon('mail')} Open the form</a>`)}</div>
      </section>
      <aside class="stack">
        ${card({ title: 'How this queue works', sub: 'Demo behaviour', body: `<div class="timeline">${[['Visitor sends a query', 'The homepage form validates four fields.'], ['Stored in this browser', 'The shared demo store holds the enquiry, nothing is emailed.'], ['Operator triage', 'Mark answered or close it — each change is audited.'], ['Reply to the visitor', 'Not implemented: no mail or SMS provider is connected.']].map(([t, x], i) => `<div class="timeline__row ${i === 2 ? 'now' : ''}"><span class="timeline__dot">${icon(i === 2 ? 'clock' : 'check')}</span><div class="timeline__body"><b>${t}</b><small>${x}</small></div></div>`).join('')}</div>` })}
        ${card({ body: `<div class="notice notice--plain">${icon('lock')}<span><b>Internal only.</b> Contact details entered on the homepage stay in this browser. Production needs a real ticket system, consent records, retention limits and role-based access.</span></div>` })}
      </aside>
    </div>
  </div>`;
}

function opsAudit() {
  return `<div class="page">
    ${pageHead('OPS · AUDIT', 'Audit log', 'Every meaningful demo action is recorded locally in this browser.', `<button class="btn btn--ghost btn--sm" data-act="export-audit">${icon('download')} Export log</button>`)}
    <section class="card card--flush">
      <div class="toolbar"><span class="chip active">${icon('clipboard')} ${state.audit.length} entries</span><div class="grow"></div><span class="tiny muted">Newest first · local only</span></div>
      <div class="rows">${state.audit.map((a) => `<div class="list-row">
        <span class="table__thumb">${icon('shield')}</span>
        <div class="list-row__main"><b>${esc(a.action)}</b><small>${esc(a.detail)}</small></div>
        <div class="list-row__end"><span class="tiny muted hide-sm">${esc(a.actor)}</span><span class="tiny muted">${esc(a.time)}</span><span class="pill pill--outline">${esc(a.id)}</span></div>
      </div>`).join('')}</div>
    </section>
  </div>`;
}
function opsPage() {
  switch (route.view) {
    case 'verifications': return opsVerifications();
    case 'enquiries': return opsEnquiries();
    case 'dispatch': return opsDispatch();
    case 'partners': return opsPartners();
    case 'areas': return opsAreas();
    case 'pricing': return opsPricing();
    case 'incidents': return opsIncidents();
    case 'audit': return opsAudit();
    default: return opsOverview();
  }
}

/* ============================ CROSS-PORTAL FLOWS ============================ */
const TASK_TO_ORDER = {
  Assigned: 'Runner assigned', 'At shop': 'Runner at shop', 'Picked up': 'Out for delivery',
  'En route': 'Out for delivery', Delivered: 'Delivered', Returned: 'Returned'
};
function syncOrderFromTask(t) {
  const order = t.orderId ? orderById(t.orderId) : null;
  if (!order) return;
  const next = TASK_TO_ORDER[t.status];
  if (next && order.status !== next) {
    order.status = next;
    order.timeline = order.timeline || [];
    order.timeline.push({ label: next === 'Delivered' ? 'Delivered to customer' : next, at: nowLabel() });
  }
}
function addTaskEvent(t, label) {
  t.timeline = t.timeline || [];
  t.timeline.push({ label, at: nowLabel() });
}
function requestRunnerFor(order) {
  if (order.taskId && taskById(order.taskId)) { toast('A runner request already exists for this order.', 'clock'); return; }
  const shop = shopById(order.shopId);
  const distance = Math.round((0.4 + shop.distance * 0.6) * 10) / 10;
  const band = state.pricing.find((b) => distance <= b.max) || state.pricing[state.pricing.length - 1];
  state.taskSeq = (state.taskSeq || 1040) + 1;
  const task = {
    id: `DR-${state.taskSeq}`, orderId: order.id, shop: shop.name, shopId: shop.id, shopArea: `${shop.area} Market`,
    customer: order.customer, area: order.area, pickupDistance: 0.2, distance, payout: band.pay,
    category: order.items.some((i) => i.cat === 'stationery') ? 'Stationery' : 'Grocery', items: order.items.reduce((n, i) => n + i.qty, 0),
    weight: Math.max(0.4, Math.round(order.items.reduce((n, i) => n + i.qty, 0) * 0.6 * 10) / 10),
    instructions: 'Demo handover. Ring once and leave with the customer at the door.',
    status: 'Requested', pickupPin: String(1000 + Math.floor(Math.random() * 8999)), deliveryPin: String(1000 + Math.floor(Math.random() * 8999)),
    createdAt: 'Just now', partnerId: null, partnerName: null, timeline: [{ label: 'Requested by shop', at: nowLabel() }]
  };
  state.tasks.unshift(task);
  order.taskId = task.id;
  order.status = 'Runner requested';
  order.timeline.push({ label: 'Runner requested', at: nowLabel() });
  notify('deliver', `New delivery request · ${task.id}`, `${shop.name} · ${distance} km · ${money(task.payout)}`);
  notify('ops', `Delivery requested · ${task.id}`, `${shop.name} is waiting for a partner.`);
  audit('Runner requested', `${task.id} · ${shop.name} → ${order.customer} · ${distance} km`);
  toast(`Runner requested for ${order.id}. Check the Deliver workspace.`, 'truck');
}
function matchTask(task) {
  const candidates = state.runners.filter((r) => r.online && task.distance <= r.maxKm && (!r.categories?.length || r.categories.includes(task.category)));
  const partner = candidates.sort((a, b) => {
    const loadA = state.tasks.filter((t) => t.partnerId === a.id && !['Delivered', 'Returned'].includes(t.status)).length;
    const loadB = state.tasks.filter((t) => t.partnerId === b.id && !['Delivered', 'Returned'].includes(t.status)).length;
    return loadA - loadB;
  })[0];
  if (!partner) return null;
  task.partnerId = partner.id;
  task.partnerName = partner.name;
  task.status = 'Assigned';
  addTaskEvent(task, `Assigned · ${partner.name}`);
  syncOrderFromTask(task);
  audit('Task matched', `${task.id} → ${partner.name} · ${task.distance} km`, 'Ops demo');
  return partner;
}
function placeOrder(fd) {
  if (!state.cart.length) { toast('Your cart is empty.', 'bag'); return; }
  const method = ui.method || 'Delivery';
  const items = cartLines().map((l) => ({ id: l.id, name: l.name, qty: l.qty, price: l.price, emoji: l.emoji, tone: l.tone, cat: l.cat }));
  const totals = orderTotals(items, method);
  state.orderSeq = (state.orderSeq || 20487) + 1;
  const order = {
    id: `NB-${state.orderSeq}`, shopId: SELLER.shopId, customer: CUSTOMER.name, customerId: CUSTOMER.id,
    area: fd.get('area') || areaLabel(), placed: 'Just now', status: 'New', method, total: totals.total, items,
    address: method === 'Delivery' ? (fd.get('address') || state.address) : 'Collect at Green Basket Market',
    taskId: null, timeline: [{ label: 'Order placed', at: nowLabel() }]
  };
  if (method === 'Delivery' && fd.get('address')) state.address = fd.get('address');
  state.orders.unshift(order);
  items.forEach((i) => { const p = productById(i.id); p.stock = Math.max(0, p.stock - i.qty); p.sold = (p.sold || 0) + i.qty; });
  notify('sell', `New order · ${order.id}`, `${order.customer} · ${items.length} items · ${money(order.total)} · ${method}`);
  notify('ops', `Order placed · ${order.id}`, `${method} · ${order.area} · awaiting the shop`);
  audit('Order placed', `${order.id} · ${money(order.total)} · ${method}`, 'Shop demo');
  state.cart = [];
  state.coupon = '';
  ui.method = 'Delivery';
  save();
  go('shop', 'order', order.id);
  toast(`Order ${order.id} placed. It is now in the seller's queue.`, 'checkCircle');
}
function setRunnerOnline(value) {
  const r = me();
  r.online = value;
  save(); paint();
  toast(value ? 'You are online. Only nearby tasks will be offered.' : 'You are offline. No new requests will be offered.', value ? 'zap' : 'clock');
}
function acceptTask(id) {
  const t = taskById(id);
  const r = me();
  if (!t || t.status !== 'Requested') { toast('That request is no longer available.', 'clock'); return; }
  if (!r.online) { toast('Go online before accepting a request.', 'alert'); return; }
  if (t.distance > r.maxKm) { toast('This request is outside your distance preference.', 'alert'); return; }
  t.partnerId = r.id; t.partnerName = r.name; t.status = 'Assigned';
  addTaskEvent(t, `Accepted · ${r.name}`);
  syncOrderFromTask(t);
  notify('sell', `Runner accepted · ${t.id}`, `${r.name} is heading to ${t.shop}.`);
  notify('ops', `Task accepted · ${t.id}`, `${r.name} · ${t.distance} km`);
  audit('Task accepted', `${t.id} by ${r.name}`, 'Runner demo');
  save(); go('deliver', 'active');
  toast(`Accepted ${t.id}. Take your time and stay safe.`, 'checkCircle');
}
function verifyPin(kind) {
  const t = taskById(ui.otpTask);
  if (!t) return;
  const input = $('#otpInput');
  const value = input?.value?.trim();
  const expected = kind === 'pickup' ? t.pickupPin : t.deliveryPin;
  if (value !== expected) { toast('That demo code does not match. Try the sample code shown.', 'alert'); return; }
  if (kind === 'pickup') {
    t.status = 'Picked up'; addTaskEvent(t, 'Pickup verified');
    syncOrderFromTask(t);
    notify('sell', `Picked up · ${t.id}`, `${t.partnerName} has the parcel.`);
    audit('Pickup verified', `${t.id} · OTP matched`);
  } else {
    t.status = 'Delivered'; t.earned = t.payout; t.completedAt = nowLabel();
    addTaskEvent(t, 'Delivered · customer OTP verified');
    syncOrderFromTask(t);
    notify('sell', `Delivered · ${t.id}`, `${t.customer} received the order.`);
    notify('shop', `Order delivered`, `${t.id} · ${t.customer} · ${money(t.earned)} sample earning.`);
    audit('Delivery completed', `${t.id} · ${money(t.earned)} sample earning`, 'Runner demo');
  }
  save(); closeModal(); paint();
  if (kind === 'delivery') { toast(`${money(t.earned || t.payout)} sample earning recorded. Nothing was paid out.`, 'rupee'); }
  else toast('Pickup confirmed. Handle the parcel carefully.', 'checkCircle');
}
function markDeliveredFromPickup(order) {
  order.status = 'Delivered';
  order.timeline.push({ label: 'Collected in store', at: nowLabel() });
  notify('shop', `Order collected · ${order.id}`, `${order.customer} picked up the order.`);
  audit('Pickup collected', `${order.id}`);
}

/* --------------------------------- modals --------------------------------- */
function modalHead(title, sub = '') {
  return `<div class="modal__head"><div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div><button class="modal__close" data-act="close" aria-label="Close">${icon('x')}</button></div>`;
}
function openLauncher() {
  const rows = Object.entries(SURFACES).map(([key, s]) => {
    const active = key === route.surface;
    const label = key === 'ops' ? 'Operations' : (PORTALS[key] || {}).label || s.label;
    return `<a class="list-row list-row--link" href="${portalPath(key)}" style="border-radius:12px;border:1px solid ${active ? 'var(--accent)' : 'var(--line)'};margin-bottom:8px;background:${active ? 'var(--accent-soft)' : '#fff'}">
      <span class="kpi__icon">${icon(s.icon)}</span>
      <span class="list-row__main"><b>${esc(label)} portal</b><small>${esc(s.blurb)}</small></span>
      <span class="list-row__end">${active ? pill('You are here', 'green') : icon('arrowUpRight', 'chev')}</span>
    </a>`;
  }).join('');
  openModal(`${modalHead('Portals are separate on purpose', 'Each one has its own sign-in and its own permissions.')}
    <div class="modal__body"><div class="stack-sm">${rows}</div>
    <div class="notice notice--info mt-14">${icon('lock')}<span>Opening another portal leaves this session behind and asks for that portal's credentials. A customer sign-in never grants seller, partner, fleet or operations access.</span></div></div>
    <div class="modal__foot"><a class="btn btn--ghost btn--sm" href="/">Back to the public site</a><button class="btn btn--primary btn--sm" data-act="close">Close</button></div>`);
}
function openAccount() {
  const persona = personaFor(route.surface);
  const portal = portalLabel(route.surface);
  openModal(`${modalHead(`${portal} account`, 'Signed in to this portal only.')}
    <div class="modal__body">
      <div class="row gap-10" style="padding-bottom:14px;border-bottom:1px solid var(--line-soft)">
        <span class="ava ava--${persona.avatar}">${persona.initials}</span>
        <div class="flex1"><b>${esc(persona.name)}</b><div class="tiny muted">${esc(persona.sub)} · ${esc(portal)} portal</div></div>
        ${pill('Signed in', 'green', true)}
      </div>
      <div class="stack-sm mt-14">
        <button class="btn btn--ghost btn--sm btn--block" data-act="palette">${icon('command')} Search everything · ⌘K</button>
        <a class="btn btn--ghost btn--sm btn--block" href="/help/">${icon('help')} Help centre</a>
        <button class="btn btn--ghost btn--sm btn--block" data-act="reset">${icon('refresh')} Reset demo data</button>
        <button class="btn btn--danger btn--sm btn--block" data-act="sign-out">${icon('logout')} Sign out of this portal</button>
      </div>
      <div class="notice notice--plain mt-10">${icon('lock')}<span>Other NearBuy portals (${Object.values(PORTALS).map((x) => x.label).join(', ')}, Operations) sign in separately. This session opens none of them.</span></div>
    </div>`);
}
function openInbox() {
  const audience = route.surface === 'shop' ? 'shop' : route.surface;
  const notes = state.notifications.filter((n) => n.audience === audience || (audience === 'shop' && n.audience === 'shop'));
  openModal(`${modalHead('Notifications', `${notes.filter((n) => n.unread).length} unread in this workspace`)}
    <div class="modal__body" style="padding-top:8px"><div class="rows" style="margin:0 -22px">${notes.length ? notes.map((n) => `<div class="list-row"><span class="kpi__icon">${icon('bell')}</span><div class="list-row__main"><b>${esc(n.title)}</b><small>${esc(n.body)}</small></div><div class="list-row__end"><span class="tiny muted">${esc(n.at)}</span>${n.unread ? pill('New', 'amber') : ''}</div></div>`).join('') : emptyState('bell', 'All caught up', 'New order and delivery updates will appear here.')}</div></div>
    <div class="modal__foot"><button class="btn btn--ghost btn--sm" data-act="mark-read">Mark all as read</button><button class="btn btn--primary btn--sm" data-act="close">Done</button></div>`);
}
function openAreaPicker() {
  openModal(`${modalHead('Where should we deliver?', 'Choose a demo neighbourhood.')}
    <div class="modal__body"><div class="stack-sm">${state.areas.map((a) => `<button class="radio-card ${areaLabel() === a.name ? 'on' : ''}" data-act="set-area" data-area="${esc(a.name)}" style="width:100%;text-align:left"><span class="radio-dot ${areaLabel() === a.name ? 'on' : ''}"></span><span class="kpi__icon" style="width:28px;height:28px">${icon('pin')}</span><span><b>${esc(a.name)}</b><small>${esc(a.city)} · ${a.radius} km · ${a.partners} demo runners</small></span></button>`).join('')}</div><div class="notice notice--plain mt-14">${icon('shield')}<span>Coverage is simulated. No address or GPS data is collected.</span></div></div>`);
}
function openOrderModal(id) {
  const o = orderById(id);
  if (!o) return;
  const task = o.taskId ? taskById(o.taskId) : null;
  const action = sellerNextAction(o);
  openModal(`${modalHead(`Order ${o.id}`, `${esc(o.customer)} · ${esc(o.area)} · ${esc(o.placed)}`)}
    <div class="modal__body">
      <div class="row gap-8 wrap mb-14">${statusPill(orderStatusLabel(o))}${pill(o.method, 'outline')}${pill(money(o.total), 'ink')}</div>
      ${orderTimeline(o)}
      <div class="rows mt-14" style="border:1px solid var(--line);border-radius:12px;overflow:hidden">${o.items.map((i) => `<div class="row gap-10" style="padding:9px 12px;border-bottom:1px solid var(--line-soft)"><span class="table__thumb">${i.emoji}</span><span class="flex1 small">${esc(i.name)} <span class="muted">× ${i.qty}</span></span><b class="small">${money(i.price * i.qty)}</b></div>`).join('')}</div>
      <div class="stack-sm mt-14">
        <div class="spread small"><span class="muted">Address</span><b style="text-align:right;max-width:60%">${esc(o.address)}</b></div>
        ${task ? `<div class="spread small"><span class="muted">Runner task</span><b>${esc(task.id)} · ${esc(task.status)}</b></div>` : ''}
        <div class="spread small"><span class="muted">Timeline entries</span><b>${o.timeline.length}</b></div>
      </div>
    </div>
    <div class="modal__foot">
      ${action.act && action.act !== 'view-order' ? `<button class="btn btn--primary btn--sm" data-act="${action.act}" data-id="${o.id}">${icon(action.icon, 'sm')} ${action.label}</button>` : ''}
      ${o.status === 'Preparing' || o.status === 'New' ? `<button class="btn btn--danger btn--sm" data-act="cancel-order" data-id="${o.id}">Cancel order</button>` : ''}
      <button class="btn btn--ghost btn--sm" data-act="close">Close</button>
    </div>`);
}
function openTaskModal(id) {
  const t = taskById(id);
  if (!t) return;
  openModal(`${modalHead(`Task ${t.id}`, `${esc(t.shop)} → ${esc(t.customer)}`)}
    <div class="modal__body">
      <div class="row gap-8 wrap mb-14">${statusPill(t.status)}${pill(`${t.distance} km`, 'outline')}${pill(money(t.payout), 'ink')}</div>
      <div class="task-card__route mb-14">
        <div class="route-stop"><i class="dot-a"></i><div><b>${esc(t.shop)}</b><small>${esc(t.shopArea)} · ${t.pickupDistance} km to shop</small></div></div>
        <div class="route-stop"><i class="dot-b"></i><div><b>${esc(t.customer)}</b><small>${esc(t.area)} · ${t.distance} km route</small></div></div>
      </div>
      <p class="small muted" style="line-height:1.6">“${esc(t.instructions)}”</p>
      <div class="stat-strip mt-14"><div><b>${t.items}</b><small>Items</small></div><div><b>${t.weight} kg</b><small>Weight</small></div><div><b>${esc(t.category)}</b><small>Category</small></div><div><b>${esc(t.partnerName || '—')}</b><small>Partner</small></div></div>
      <div class="timeline mt-14">${(t.timeline || []).slice().reverse().map((e, i) => `<div class="timeline__row ${i === 0 ? 'now' : 'done'}"><span class="timeline__dot">${icon(i === 0 ? 'clock' : 'check')}</span><div class="timeline__body"><b>${esc(e.label)}</b><small>${esc(e.at)}</small></div></div>`).join('')}</div>
    </div>
    <div class="modal__foot">
      ${t.status === 'Requested' ? `<button class="btn btn--primary btn--sm" data-act="auto-match" data-id="${t.id}">${icon('zap', 'sm')} Match a partner</button>` : ''}
      ${t.status === 'Requested' && t.orderId ? `<button class="btn btn--ghost btn--sm" data-act="switch" data-surface="sell" data-view="orders">${icon('store')} Seller view</button>` : ''}
      <button class="btn btn--ghost btn--sm" data-act="close">Close</button>
    </div>`);
}
function openOtpModal(id, kind) {
  const t = taskById(id);
  if (!t) return;
  ui.otpTask = id;
  const code = kind === 'pickup' ? t.pickupPin : t.deliveryPin;
  openModal(`${modalHead(kind === 'pickup' ? 'Verify pickup OTP' : 'Verify customer OTP', `${esc(t.id)} · ${kind === 'pickup' ? esc(t.shop) : esc(t.customer)}`)}
    <div class="modal__body">
      <p class="small muted mb-14">A real flow would rate-limit attempts and handle exceptions safely. For this demo, enter the sample code below.</p>
      <div class="center mb-14"><span class="otp">${code}<small>SAMPLE OTP</small></span></div>
      <form id="otpForm" class="form-grid" data-kind="${kind}">
        <label class="field"><span>Enter the 4-digit demo code</span><input class="input" id="otpInput" name="pin" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" placeholder="••••" required autocomplete="off" style="letter-spacing:.4em;text-align:center;font-size:20px" /></label>
        <button class="btn btn--primary btn--block">${icon('check')} Confirm ${kind === 'pickup' ? 'pickup' : 'delivery'}</button>
      </form>
      <div class="notice notice--plain mt-14">${icon('shield')}<span>No real OTP, customer contact or location is involved.</span></div>
    </div>`);
  setTimeout(() => $('#otpInput')?.focus(), 60);
}
function openReturnModal(id) {
  const t = taskById(id);
  if (!t) return;
  openModal(`${modalHead('Something did not go to plan', `Task ${esc(t.id)}`)}
    <div class="modal__body"><p class="small muted mb-14">Record the reason and the parcel returns to the shop. Ops will see this in the audit trail.</p>
      <form id="returnForm" class="form-grid" data-id="${t.id}">
        <label class="field"><span>Why could it not be delivered?</span><select class="select" name="reason"><option>Customer unavailable</option><option>Customer refused the parcel</option><option>Incorrect or incomplete address</option><option>Unsafe delivery conditions</option><option>Parcel damaged or incorrect</option></select></label>
        <label class="field"><span>Note (optional)</span><textarea class="textarea" name="note" placeholder="Keep it brief. No personal information."></textarea></label>
        <button class="btn btn--danger">${icon('refresh')} Record return to shop</button>
      </form></div>`);
}
function openSosModal() {
  openModal(`${modalHead('Safety options', 'This demo cannot call for help.')}
    <div class="modal__body"><div class="notice">${icon('alert')}<span>If you are in immediate danger, move to a safe public place and contact local emergency services directly. No emergency service, contact or location sharing is connected here.</span></div>
    <div class="stack-sm mt-14">
      <button class="btn btn--ghost btn--sm btn--block" data-act="nav" data-surface="deliver" data-view="safety">${icon('shield')} Open the safety checklist</button>
      <button class="btn btn--ghost btn--sm btn--block" data-act="nav" data-surface="deliver" data-view="safety">${icon('alert')} Report a demo issue</button>
    </div></div>`);
}
function openResetModal() {
  openModal(`${modalHead('Reset the demo?', 'This clears orders, tasks, stock, earnings and incidents in this browser.')}
    <div class="modal__body"><div class="notice">${icon('alert')}<span>Everything returns to the original sample data. This cannot be undone.</span></div></div>
    <div class="modal__foot"><button class="btn btn--ghost btn--sm" data-act="close">Keep my data</button><button class="btn btn--danger btn--sm" data-act="reset-yes">${icon('refresh')} Reset everything</button></div>`);
}
function openProductForm(id) {
  const p = id ? productById(id) : null;
  openModal(`${modalHead(p ? 'Edit product' : 'Add a product', p ? 'Changes appear on the customer storefront instantly.' : 'A new product for Green Basket Market.')}
    <div class="modal__body"><form id="productForm" class="form-grid" data-id="${p ? p.id : ''}">
      <div class="form-grid form-grid--2">
        <label class="field"><span>Product name</span><input class="input" type="text" name="name" required value="${p ? esc(p.name) : ''}" placeholder="e.g. Alphonso mangoes" /></label>
        <label class="field"><span>Emoji</span><input class="input" name="emoji" maxlength="4" value="${p ? p.emoji : '🥭'}" /></label>
      </div>
      <label class="field"><span>Short detail</span><input class="input" type="text" name="detail" value="${p ? esc(p.detail) : ''}" placeholder="e.g. Sweet & ripe · 1 kg" /></label>
      <div class="form-grid form-grid--2">
        <label class="field"><span>Price (₹)</span><input class="input" name="price" type="number" min="1" required value="${p ? p.price : ''}" /></label>
        <label class="field"><span>MRP (₹)</span><input class="input" name="mrp" type="number" min="1" value="${p ? p.mrp : ''}" /></label>
      </div>
      <div class="form-grid form-grid--2">
        <label class="field"><span>Stock</span><input class="input" name="stock" type="number" min="0" value="${p ? p.stock : 10}" /></label>
        <label class="field"><span>Low-stock alert at</span><input class="input" name="lowAt" type="number" min="0" value="${p ? p.lowAt : 4}" /></label>
      </div>
      <div class="form-grid form-grid--2">
        <label class="field"><span>Category</span><select class="select" name="cat">${CATEGORIES.filter((c) => c.id !== 'all').map((c) => `<option value="${c.id}" ${p && p.cat === c.id ? 'selected' : ''}>${c.label}</option>`).join('')}</select></label>
        <label class="field"><span>Badge (optional)</span><input class="input" type="text" name="badge" value="${p ? esc(p.badge || '') : ''}" placeholder="Fresh today" /></label>
      </div>
      <button class="btn btn--primary">${icon('check')} ${p ? 'Save changes' : 'Add to catalogue'}</button>
    </form></div>`);
}
function openPromoForm() {
  openModal(`${modalHead('New promotion', 'Demo campaigns only — no real discount is applied to a payment.')}
    <div class="modal__body"><form id="promoForm" class="form-grid">
      <label class="field"><span>Title</span><input class="input" type="text" name="title" required placeholder="e.g. Weekend essentials" /></label>
      <div class="form-grid form-grid--2">
        <label class="field"><span>Code</span><input class="input" type="text" name="code" required maxlength="12" placeholder="e.g. WEEKEND10" style="text-transform:uppercase" /></label>
        <label class="field"><span>Offer</span><input class="input" type="text" name="type" required placeholder="e.g. 10% off" /></label>
      </div>
      <label class="field"><span>Ends</span><input class="input" type="text" name="ends" placeholder="e.g. 30 Jun 2025" /></label>
      <button class="btn btn--primary">${icon('megaphone')} Create promotion</button>
    </form></div>`);
}
function openAreaForm(id) {
  const a = id ? state.areas.find((x) => x.id === id) : null;
  openModal(`${modalHead(a ? 'Edit service area' : 'Add a service area', 'Radius and status are simulated in this demo.')}
    <div class="modal__body"><form id="areaForm" class="form-grid" data-id="${a ? a.id : ''}">
      <div class="form-grid form-grid--2">
        <label class="field"><span>Area name</span><input class="input" type="text" name="name" required value="${a ? esc(a.name) : ''}" placeholder="e.g. Lajpat Nagar" ${a ? 'readonly' : ''} /></label>
        <label class="field"><span>City</span><input class="input" type="text" name="city" value="${a ? esc(a.city) : 'Delhi'}" /></label>
      </div>
      <div class="form-grid form-grid--2">
        <label class="field"><span>Radius (km)</span><input class="input" name="radius" type="number" min="0.5" max="5" step="0.5" value="${a ? a.radius : 2}" /></label>
        <label class="field"><span>Status</span><select class="select" name="status">${['Pilot', 'Planning', 'Paused'].map((s) => `<option ${a && a.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
      </div>
      <button class="btn btn--primary">${icon('check')} ${a ? 'Save area' : 'Add area'}</button>
    </form></div>`);
}

/* --------------------------------- actions -------------------------------- */
function handleAction(act, ds, el, event) {
  switch (act) {
    case 'nav': go(ds.surface, ds.view, ds.id || null); break;
    case 'switch': crossPortalNotice(ds.surface); break;
    case 'sign-out': signOutPortal(); break;
    case 'fill-demo': {
      const p = PORTALS[ds.surface];
      const form = el && el.closest('.portal-gate');
      if (!p || !form) break;
      const email = form.querySelector('[name="email"]');
      const pass = form.querySelector('[name="password"]');
      if (email) email.value = p.email;
      if (pass) pass.value = p.pass;
      toast('Demo credentials filled. Press sign in.', 'key');
      break;
    }
    case 'drawer': ui.drawer = !ui.drawer; syncDrawer(); break;
    case 'close': closeModal(); break;
    case 'backdrop': if (event.target === el) closeModal(); break;
    case 'palette': openPalette(); break;
    case 'pal-go': { const [s, v, ...rest] = String(ds.go).split('/'); ui.palette = null; renderOverlay(); go(s, v, rest.join('/') || null); break; }
    case 'launcher': openLauncher(); break;
    case 'account': openAccount(); break;
    case 'inbox': openInbox(); break;
    case 'mark-read': state.notifications.forEach((n) => { n.unread = false; }); save(); closeModal(); paint(); toast('All notifications marked as read.', 'bell'); break;
    case 'area': openAreaPicker(); break;
    case 'set-area': state.area = ds.area; save(); closeModal(); paint(); toast(`Delivering to ${ds.area}.`, 'pin'); break;
    case 'reset': openResetModal(); break;
    case 'reset-yes': try { localStorage.removeItem(KEY); } catch {} location.reload(); break;
    case 'toast': toast(ds.msg || 'Done.', 'checkCircle'); break;
    case 'send-otp': {
      const app = applicationFor(ds.kind);
      const form = el && el.closest('form');
      captureStep(ds.kind, form);
      if (!/^[6-9]\d{9}$/.test(app.phone)) {
        ui.onboardError = 'Enter a valid 10-digit Indian mobile number before requesting the demo OTP.';
        save(); refreshPage();
        toast('Add a valid mobile number first.', 'alert');
        break;
      }
      ui.onboardError = '';
      app.otpSent = true;
      app.otpVerified = false;
      save(); refreshPage();
      toast(`Demo OTP ${DEMO_OTP}. No SMS was sent.`, 'phone');
      break;
    }
    case 'ob-back': {
      const app = applicationFor(ds.kind);
      app.step = Math.max(0, app.step - 1);
      ui.onboardError = '';
      save(); paint();
      break;
    }
    case 'ob-photo': {
      captureStep('seller', el && el.closest('form'));
      applicationFor('seller').photo = true;
      save(); refreshPage();
      toast('Sample shopfront attached. Nothing was uploaded.', 'package');
      break;
    }
    case 'ob-selfie': {
      captureStep('runner', el && el.closest('form'));
      applicationFor('runner').selfie = true;
      save(); refreshPage();
      toast('Sample photograph attached. Liveness was not checked.', 'user');
      break;
    }
    case 'ob-decide': decideApplication(ds.kind, ds.decision); break;
    case 'ob-restart': restartApplication(ds.kind); break;
    case 'enquiry-status': {
      const e = state.enquiries.find((x) => x.id === ds.id);
      if (!e) break;
      e.status = ds.status;
      audit(`Enquiry ${ds.status === 'Responded' ? 'answered' : ds.status === 'Closed' ? 'closed' : 'reopened'}`, `${e.id} · ${e.topic} · ${e.name}`, 'Ops reviewer (demo)');
      save(); paint();
      toast(`Enquiry ${e.id} marked ${e.status.toLowerCase()}.`, ds.status === 'Closed' ? 'archive' : 'checkCircle');
      break;
    }
    case 'admin-lock': clearAdminSession(); paint(); toast('Operations session cleared for this tab.', 'lock'); break;
    case 'save': {
      const on = state.saved.includes(ds.id);
      state.saved = on ? state.saved.filter((x) => x !== ds.id) : [...state.saved, ds.id];
      save(); paint();
      toast(on ? 'Removed from saved items.' : 'Saved for later.', 'heart');
      break;
    }
    case 'add': {
      const qty = Number(ds.qty || 1);
      const line = state.cart.find((l) => l.id === ds.id);
      if (line) line.qty += qty; else state.cart.push({ id: ds.id, qty });
      save(); paint();
      toast(`${productById(ds.id).name} added to cart.`, 'bag');
      break;
    }
    case 'qty': ui.qty = clamp((ui.qty || 1) + Number(ds.delta), 1, 20); refreshPage(); break;
    case 'cart-qty': {
      const line = state.cart.find((l) => l.id === ds.id);
      if (!line) break;
      line.qty += Number(ds.delta);
      if (line.qty <= 0) state.cart = state.cart.filter((l) => l.id !== ds.id);
      save(); paint();
      break;
    }
    case 'cart-remove': state.cart = state.cart.filter((l) => l.id !== ds.id); save(); paint(); toast('Removed from cart.', 'x'); break;
    case 'coupon': {
      const value = ($('#couponInput')?.value || '').trim().toUpperCase();
      if (value === 'LOCAL10') { state.coupon = 'LOCAL10'; save(); paint(); toast('LOCAL10 applied — 10% off this demo order.', 'tag'); }
      else { state.coupon = ''; save(); paint(); toast(value ? 'That demo code is not valid. Try LOCAL10.' : 'Enter a demo coupon code.', 'alert'); }
      break;
    }
    case 'method': ui.method = el.value; save(); refreshPage(); break;
    case 'filter-cat': ui.category = ds.cat; refreshPage(); break;
    case 'clear-filters': ui.query = ''; ui.category = 'all'; refreshPage(); break;
    case 'quick-search': ui.query = ds.q; go('shop', 'explore'); break;
    case 'category': ui.category = ds.cat; go('shop', 'explore'); break;
    case 'follow': {
      const followed = state.followed || (state.followed = []);
      const on = followed.includes(ds.id);
      state.followed = on ? followed.filter((x) => x !== ds.id) : [...followed, ds.id];
      save(); paint();
      toast(on ? 'Shop unfollowed.' : `Following ${shopById(ds.id).name}.`, 'heart');
      break;
    }
    case 'account-tab': ui.accountTab = ds.tab; refreshPage(); break;
    case 'address-demo': toast('Demo address saved to this account.', 'pin'); break;
    case 'profile-save': break;
    case 'accept-order': {
      const o = orderById(ds.id); if (!o) break;
      o.status = 'Preparing';
      o.timeline.push({ label: 'Accepted by shop', at: nowLabel() });
      notify('shop', `Order accepted · ${o.id}`, `${SELLER.name} accepted your order.`);
      audit('Order accepted', `${o.id} · ${o.customer}`, 'Seller demo');
      save(); closeModal(); paint(); toast(`Order ${o.id} accepted.`, 'checkCircle');
      break;
    }
    case 'ready-order': {
      const o = orderById(ds.id); if (!o) break;
      o.status = 'Ready';
      o.timeline.push({ label: o.method === 'Pickup' ? 'Ready for pickup' : 'Ready for runner', at: nowLabel() });
      notify('shop', `Order ready · ${o.id}`, o.method === 'Pickup' ? 'Collect from Green Basket Market.' : 'Waiting for a nearby runner.');
      audit('Order ready', `${o.id} · ${o.method}`, 'Seller demo');
      save(); closeModal(); paint(); toast(o.method === 'Pickup' ? 'Marked ready for pickup.' : 'Marked ready. Request a runner when you are set.', 'checkCircle');
      break;
    }
    case 'collect-order': {
      const o = orderById(ds.id); if (!o) break;
      markDeliveredFromPickup(o);
      save(); closeModal(); paint(); toast(`${o.id} collected. Nice work.`, 'bag');
      break;
    }
    case 'request-runner': { const o = orderById(ds.id); if (!o) break; requestRunnerFor(o); save(); closeModal(); paint(); break; }
    case 'view-order': openOrderModal(ds.id); break;
    case 'cancel-order': {
      const o = orderById(ds.id); if (!o) break;
      o.status = 'Cancelled';
      o.timeline.push({ label: 'Cancelled', at: nowLabel() });
      if (o.taskId) { const t = taskById(o.taskId); if (t) { t.status = 'Cancelled'; addTaskEvent(t, 'Cancelled with order'); } }
      notify('sell', `Order cancelled · ${o.id}`, `${o.customer} cancelled the order.`);
      audit('Order cancelled', `${o.id}`, 'Shop demo');
      save(); closeModal(); paint(); toast(`Order ${o.id} cancelled.`, 'x');
      break;
    }
    case 'order-filter': ui.orderFilter = ds.filter; refreshPage(); break;
    case 'stock-filter': ui.stockFilter = ds.filter; refreshPage(); break;
    case 'stock': {
      const p = productById(ds.id);
      p.stock = clamp(p.stock + Number(ds.delta), 0, 999);
      save(); refreshPage();
      break;
    }
    case 'restock': { const p = productById(ds.id); p.stock = 20; save(); paint(); toast(`${p.name} restocked to 20 units.`, 'package'); break; }
    case 'restock-all': {
      [...lowStock(), ...outOfStock()].forEach((p) => { p.stock = 20; });
      save(); paint(); toast('Low and out-of-stock items restocked in the demo.', 'refresh');
      break;
    }
    case 'edit-product': openProductForm(ds.id); break;
    case 'add-product': openProductForm(null); break;
    case 'toggle-setting': {
      state.settings[ds.key] = el.checked;
      save(); paint();
      toast(`${ds.key === 'shopOpen' ? 'Shop status' : 'Setting'} updated.`, 'checkCircle');
      break;
    }
    case 'toggle-promo': {
      const p = state.promos.find((x) => x.id === ds.id); if (!p) break;
      p.status = p.status === 'Active' ? 'Paused' : 'Active';
      save(); refreshPage(); toast(`${p.code} is now ${p.status.toLowerCase()}.`, 'megaphone');
      break;
    }
    case 'new-promo': openPromoForm(); break;
    case 'return-approve': case 'return-reject': {
      const r = state.returns.find((x) => x.id === ds.id); if (!r) break;
      r.status = act === 'return-approve' ? 'Approved' : 'Rejected';
      audit('Return reviewed', `${r.id} · ${r.status}`, 'Seller demo');
      save(); paint(); toast(`Return ${r.id} ${r.status.toLowerCase()}.`, 'refresh');
      break;
    }
    case 'online-toggle': setRunnerOnline(el.checked); break;
    case 'runner-online': {
      const r = runnerById(ds.id); if (!r) break;
      r.online = !r.online; save(); paint();
      toast(`${r.name} is now ${r.online ? 'online' : 'offline'} in the demo.`, r.online ? 'zap' : 'clock');
      break;
    }
    case 'runner-switch': {
      const r = runnerById(ds.id); if (!r) break;
      state.runners = [r, ...state.runners.filter((x) => x.id !== r.id)];
      save(); paint(); toast(`Now delivering as ${r.name}.`, 'user');
      break;
    }
    case 'accept-task': acceptTask(ds.id); break;
    case 'pass-task': {
      const t = taskById(ds.id); if (!t) break;
      t.skippedBy = [...(t.skippedBy || []), me().id];
      save(); paint(); toast('Request passed. No penalty in this demo.', 'checkCircle');
      break;
    }
    case 'task-detail': openTaskModal(ds.id); break;
    case 'arrive-shop': {
      const t = taskById(ds.id); if (!t) break;
      t.status = 'At shop'; addTaskEvent(t, 'Arrived at shop');
      syncOrderFromTask(t); save(); paint(); toast('Shop arrival noted. Ask for the parcel.', 'pin');
      break;
    }
    case 'verify-pickup': openOtpModal(ds.id, 'pickup'); break;
    case 'start-route': {
      const t = taskById(ds.id); if (!t) break;
      t.status = 'En route'; addTaskEvent(t, 'Route started');
      syncOrderFromTask(t); save(); paint(); toast('Route started. Location is not tracked in this demo.', 'truck');
      break;
    }
    case 'verify-delivery': openOtpModal(ds.id, 'delivery'); break;
    case 'return-task': openReturnModal(ds.id); break;
    case 'sos': openSosModal(); break;
    case 'auto-match': {
      const t = taskById(ds.id); if (!t) break;
      const partner = matchTask(t);
      save(); closeModal(); paint();
      toast(partner ? `${t.id} matched with ${partner.name}. Nothing was dispatched.` : 'No eligible online partner for this task.', partner ? 'zap' : 'alert');
      break;
    }
    case 'auto-match-all': {
      const queue = state.tasks.filter((t) => t.status === 'Requested');
      let matched = 0;
      queue.forEach((t) => { if (matchTask(t)) matched += 1; });
      save(); paint();
      toast(matched ? `${matched} task${matched > 1 ? 's' : ''} matched to available partners.` : 'No eligible partners online right now.', 'zap');
      break;
    }
    case 'pricing-save': {
      const input = $(`[data-act="pricing-input"][data-id="${ds.id}"]`);
      save(); paint(); toast('Sample pricing band updated.', 'rupee');
      break;
    }
    case 'add-area': openAreaForm(null); break;
    case 'area-edit': openAreaForm(ds.id); break;
    case 'resolve-incident': {
      const i = state.incidents.find((x) => x.id === ds.id); if (!i) break;
      i.status = 'Resolved'; audit('Incident resolved', `${i.id} · ${i.type}`, 'Ops demo');
      save(); paint(); toast('Incident marked resolved in the local log.', 'shield');
      break;
    }
    case 'export-earnings': case 'export-payouts': case 'export-audit': {
      const rows = act === 'export-audit'
        ? [['ID', 'Action', 'Detail', 'Actor', 'Time'], ...state.audit.map((a) => [a.id, a.action, a.detail, a.actor, a.time])]
        : act === 'export-payouts'
          ? [['Task', 'Shop', 'Status', 'Sample amount'], ...state.tasks.map((t) => [t.id, t.shop, t.status, t.earned || t.payout])]
          : [['Task', 'Shop', 'Completed', 'Distance', 'Sample earning'], ...state.tasks.filter((t) => t.status === 'Delivered').map((t) => [t.id, t.shop, t.completedAt || '', t.distance, t.earned || t.payout])];
      const csv = rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'nearbuy-one-demo.csv'; a.click();
      URL.revokeObjectURL(a.href);
      toast('Demo CSV downloaded.', 'download');
      break;
    }
    default: break;
  }
}

/* --------------------------------- render --------------------------------- */
/* ===========================================================================
   Onboarding, verification and the protected operations entrance.

   Everything here is a browser-only simulation. No SMS is sent, no document
   is uploaded, no identity provider is called and no reviewer is involved.
   ========================================================================= */

const DEMO_OTP = '123456';
const ADMIN_CODE = 'NB-OPS-2026';
const ADMIN_SESSION_KEY = 'nearbuy.ops.session';

const SELLER_STEPS = ['Account', 'Business', 'Details', 'Location', 'Operations', 'Payout', 'Review'];
const RUNNER_STEPS = ['Mobile', 'About you', 'Documents', 'Vehicle & area', 'Payout', 'Safety', 'Review'];

const SELLER_TYPES = [
  ['Grocery and daily essentials', 'Fruit, vegetables, dairy and household staples'],
  ['General store', 'Everyday household and personal-use products'],
  ['Stationery and books', 'School, office and reading supplies'],
  ['Bookshop', 'Books, guides and reference titles'],
  ['Convenience store', 'Long hours, quick top-up shopping'],
  ['Other eligible retail', 'Subject to category review']
];

const VEHICLES = [
  ['Walking', 'Best for 0–500 m runs'],
  ['Bicycle', 'Nearby residential deliveries'],
  ['E-bike', 'Longer local distances'],
  ['Electric scooter', 'Eligible with a valid licence'],
  ['Business fleet', 'Company-owned vehicle and team'],
  ['Shop staff', 'Authorised by a participating shop']
];

function sellerBlank() {
  return {
    status: 'Incomplete', step: 0,
    phone: '', email: '', language: 'English', otpSent: false, otpVerified: false,
    businessType: '', legalName: '', displayName: '', owner: '', gstin: '',
    address: '', pin: '', area: 'Hauz Khas', photo: false,
    hoursOpen: '8:00 am', hoursClose: '10:00 pm', holiday: 'Sunday',
    prep: '15–25 min', radius: 2, pickup: true, delivery: true,
    bankHolder: '', bankAcc: '', ifsc: '',
    checks: [], submittedAt: null, decidedAt: null, decisionNote: ''
  };
}

function runnerBlank() {
  return {
    status: 'Incomplete', step: 0,
    phone: '', email: '', otpSent: false, otpVerified: false,
    name: '', dob: '', age: null, address: '', pin: '',
    idType: 'Aadhaar', idLast4: '', selfie: false,
    vehicle: 'Bicycle', area: 'Hauz Khas', maxKm: 2,
    payoutMethod: 'UPI', upi: '', bankAcc: '', ifsc: '',
    emergencyName: '', emergencyPhone: '',
    training: false, agreement: false,
    checks: [], submittedAt: null, decidedAt: null, decisionNote: ''
  };
}

function sellerApplication() { return state.onboarding.seller; }
function runnerApplication() { return state.onboarding.runner; }
function applicationFor(kind) { return kind === 'seller' ? sellerApplication() : runnerApplication(); }

/* Keeps whatever the applicant has typed when a secondary action re-renders. */
function captureStep(kind, form) {
  if (!form) return;
  const app = applicationFor(kind);
  const fd = new FormData(form);
  const step = Number(fd.get('step') ?? app.step);
  if (kind === 'seller') applySellerStep(app, step, fd);
  else applyRunnerStep(app, step, fd);
  save();
}

/* ------------------------------ admin session ------------------------------ */
function adminSession() {
  try { return JSON.parse(sessionStorage.getItem(ADMIN_SESSION_KEY) || 'null'); }
  catch { return null; }
}
function setAdminSession(role) {
  try { sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ role, at: Date.now() })); } catch { /* ignore */ }
}
function clearAdminSession() {
  try { sessionStorage.removeItem(ADMIN_SESSION_KEY); } catch { /* ignore */ }
}
/* ---------------------------- portal identities ---------------------------- */
/* One shell, five workspaces, five separate sign-ins. A customer session never
   opens seller, partner, fleet or operations tools. Browser-only simulation. */
const PORTAL_KEY = 'nearbuy.portal.session.v1';
const PORTALS = {
  shop: { label: 'Customer', icon: 'bag', email: 'riya@nearbuy.demo', pass: 'NearBuy123!', persona: 'Riya Sharma', blurb: 'Shop from shops around you' },
  sell: { label: 'Seller', icon: 'store', email: 'owner@nearbuy.demo', pass: 'Seller123!', persona: 'Green Basket Market', blurb: 'Run your shop, catalogue and orders' },
  deliver: { label: 'Delivery Partner', icon: 'truck', email: 'rohan@nearbuy.demo', pass: 'Runner123!', persona: 'Rohan Kumar', blurb: 'Accept nearby deliveries' },
  fleet: { label: 'Fleet', icon: 'layers', email: 'arjun@nearbuy.demo', pass: 'Fleet123!', persona: 'Arjun Rao', blurb: 'Manage a delivery fleet' }
};
const PUBLIC_VIEWS = { sell: ['register'], deliver: ['register'] };
const DEMO_PASSWORDS = Object.fromEntries(Object.entries(PORTALS).map(([k, v]) => [k, v.pass]));

function portalSession() {
  try { return JSON.parse(sessionStorage.getItem(PORTAL_KEY) || 'null'); } catch { return null; }
}
function setPortalSession(surface) {
  try { sessionStorage.setItem(PORTAL_KEY, JSON.stringify({ surface, at: Date.now() })); } catch { /* private mode */ }
}
function clearPortalSession() {
  try { sessionStorage.removeItem(PORTAL_KEY); } catch { /* ignore */ }
}
function portalOpen(surface) {
  if (surface === 'ops') return !!adminSession();
  const session = portalSession();
  return !!session && session.surface === surface;
}
function portalPublic(surface, view) {
  return (PUBLIC_VIEWS[surface] || []).includes(view);
}
function portalLabel(surface) { return (PORTALS[surface] || { label: 'NearBuy' }).label; }

function adminLockPage() {
  return `<div class="page">
    <div class="admin-lock card">
      <span class="admin-lock__icon">${icon('lock')}</span>
      <span class="kicker"><i></i>PROTECTED INTERNAL CONSOLE</span>
      <h1>Operations is not a public portal</h1>
      <p class="small muted">The NearBuy control tower is an internal workspace for verification, dispatch, pricing and audit. It is deliberately gated and is not linked as a fourth customer portal.</p>
      <p class="tiny muted">Operations modules stay hidden until you unlock, but every other workspace is still one click away in the switcher.</p>
      <form id="adminUnlockForm" class="admin-lock__form">
        <label class="field"><span>Demo access code</span>
          <input class="input" type="text" name="code" placeholder="Enter demo code" autocomplete="off" spellcheck="false" />
        </label>
        <button class="btn btn--primary btn--block" type="submit">${icon('shield')} Unlock operations console</button>
      </form>
      <div class="notice notice--plain">${icon('lock')}<span>Demo gate only. The code is <b>${ADMIN_CODE}</b>, it creates a browser-session flag, and every record behind it is sample data. Production requires real authentication, role-based permissions, MFA for sensitive roles and server-side checks.</span></div>
      <div class="admin-lock__links">
        <a class="btn btn--ghost btn--sm" href="/">${icon('home')} NearBuy home</a>
        <button class="btn btn--ghost btn--sm" type="button" data-act="nav" data-surface="shop" data-view="home">${icon('bag')} Back to shopping</button>
      </div>
    </div>
  </div>`;
}

/* --------------------------------- pieces ---------------------------------- */
function portalPath(surface) {
  return { shop: '/customer/', sell: '/seller/', deliver: '/runner/', fleet: '/portal.html#/fleet/overview', ops: '/admin/' }[surface] || '/';
}

function portalSignInPage(surface) {
  const p = PORTALS[surface] || PORTALS.shop;
  const meta = SURFACES[surface];
  return `<div class="page">
    <div class="portal-gate card">
      <span class="portal-gate__icon">${icon(p.icon)}</span>
      <span class="kicker"><i></i>${esc(p.label.toUpperCase())} PORTAL</span>
      <h1>Sign in to the ${esc(p.label)} portal</h1>
      <p class="small muted">${esc(p.blurb)}. Every NearBuy portal signs in separately and carries its own permissions, so a customer session can never open seller, partner or operations tools.</p>
      ${ui.signInError ? `<div class="notice">${icon('alert')}<span>${esc(ui.signInError)}</span></div>` : ''}
      <form id="portalSignInForm" class="form-grid">
        <input type="hidden" name="surface" value="${esc(surface)}" />
        <label class="field"><span>Email</span><input class="input" type="email" name="email" autocomplete="username" placeholder="you@example.com" required /></label>
        <label class="field"><span>Password</span><input class="input" type="password" name="password" autocomplete="current-password" placeholder="Your password" required /></label>
        <button class="btn btn--primary btn--block" type="submit">${icon('lock')} Sign in to ${esc(p.label)}</button>
      </form>
      <button class="btn btn--ghost btn--block mt-8" type="button" data-act="fill-demo" data-surface="${esc(surface)}">Use the demo credentials</button>
      <div class="notice notice--plain">${icon('shield')}<span>Demo sign-in: <b>${esc(p.email)}</b> / <b>${esc(p.pass)}</b>. Authentication is simulated in this browser — production needs a real identity provider, server-side sessions and per-role permission checks.</span></div>
      <div class="portal-gate__links">
        <a class="btn btn--ghost btn--sm" href="/">${icon('home')} Public site</a>
        ${surface === 'sell' || surface === 'deliver'
          ? `<a class="btn btn--ghost btn--sm" href="/${surface === 'sell' ? 'seller' : 'runner'}/register/">${icon('plus')} Register instead</a>`
          : ''}
        ${surface === 'shop' ? `<a class="btn btn--ghost btn--sm" href="/help/">${icon('help')} Need help?</a>` : ''}
      </div>
      <p class="tiny muted mt-10">${esc(meta.blurb)} · ${esc(p.persona)} is the demo identity for this portal.</p>
    </div>
  </div>`;
}

function crossPortalNotice(surface) {
  closeModal();
  if (surface === route.surface) { go(surface, 'overview'); return; }
  const p = PORTALS[surface] || { label: surface === 'ops' ? 'Operations' : 'NearBuy', blurb: '' };
  openModal(`${modalHead('That belongs to another portal', `This action lives in the ${esc(p.label)} portal.`)}
    <div class="modal__body">
      <p class="small muted">${esc(p.blurb || 'Each portal has its own sign-in and its own permissions.')} Switching portals means signing in there — it is never a click inside this one.</p>
      <div class="notice notice--info mt-14">${icon('lock')}<span>A customer session does not grant seller, partner, fleet or operations access, and nothing here carries that session across.</span></div>
    </div>
    <div class="modal__foot">
      <a class="btn btn--primary btn--sm" href="${portalPath(surface)}">${icon('arrowUpRight', 'sm')} Open the ${esc(p.label)} portal</a>
      <button class="btn btn--ghost btn--sm" data-act="close">Stay in ${esc(portalLabel(route.surface))}</button>
    </div>`);
}

function signOutPortal() {
  const surface = route.surface;
  clearPortalSession();
  clearAdminSession();
  ui.signInError = '';
  closeModal();
  paint();
  toast(`Signed out of the ${portalLabel(surface)} portal.`, 'logout');
}

function obNotice(text, tone = 'info') {
  return `<div class="notice ${tone === 'warn' ? '' : 'notice--' + tone}">${icon(tone === 'warn' ? 'alert' : 'shield')}<span>${text}</span></div>`;
}
function obError() {
  return ui.onboardError ? `<div class="notice">${icon('alert')}<span>${esc(ui.onboardError)}</span></div>` : '';
}
function obF(name, label, value, opts = {}) {
  const type = opts.type || 'text';
  const attrs = [
    opts.ph ? `placeholder="${esc(opts.ph)}"` : '',
    opts.inputmode ? `inputmode="${opts.inputmode}"` : '',
    opts.maxlength ? `maxlength="${opts.maxlength}"` : '',
    opts.required === false ? '' : 'required',
    opts.min ? `min="${opts.min}"` : ''
  ].filter(Boolean).join(' ');
  return `<label class="field"><span>${label}</span><input class="input" type="${type}" name="${name}" value="${esc(value ?? '')}" ${attrs} />${opts.hint ? `<small class="hint">${opts.hint}</small>` : ''}</label>`;
}
function obS(name, label, value, options, hint = '') {
  return `<label class="field"><span>${label}</span><select class="select" name="${name}">${options.map((o) => `<option ${o === value ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>${hint ? `<small class="hint">${hint}</small>` : ''}</label>`;
}
function obCheck(name, label, checked, hint = '') {
  return `<label class="ob-check"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''} /><span>${label}${hint ? `<small class="tiny muted">${hint}</small>` : ''}</span></label>`;
}
function obRadio(name, value, current, title, sub) {
  return `<label class="radio-card ${value === current ? 'on' : ''}">
    <input type="radio" name="${name}" value="${esc(value)}" ${value === current ? 'checked' : ''} />
    <span><b>${esc(title)}</b><small>${esc(sub)}</small></span>
  </label>`;
}
function obUpload(label, stateText, act, kind, done) {
  return `<div class="upload-box">
    <span class="upload-box__icon">${icon(done ? 'checkCircle' : 'package')}</span>
    <b class="small">${esc(label)}</b>
    <div class="tiny muted">${esc(stateText)}</div>
    <button class="btn btn--ghost btn--sm mt-6" type="button" data-act="${act}" data-kind="${kind}">${icon('plus')} ${done ? 'Replace sample' : 'Attach sample'}</button>
  </div>`;
}
function obOtp(kind, app) {
  return `<div class="form-grid form-grid--2">
    <label class="field"><span>Mobile number</span>
      <div class="row gap-8">
        <input class="input" type="tel" name="phone" value="${esc(app.phone)}" placeholder="10-digit mobile" inputmode="numeric" maxlength="10" required />
        <button class="btn btn--ghost btn--sm nowrap" type="button" data-act="send-otp" data-kind="${kind}">Send demo OTP</button>
      </div>
    </label>
    ${app.otpSent
      ? `<label class="field"><span>Enter OTP <span class="otp-inline">${DEMO_OTP}</span></span><input class="input" type="text" name="otp" inputmode="numeric" maxlength="6" placeholder="6-digit code" required /></label>`
      : `<label class="field"><span>OTP</span><input class="input" type="text" value="" placeholder="Send the demo OTP first" disabled /></label>`}
  </div>
  ${app.otpSent ? `<div class="tiny muted">Demo code <b>${DEMO_OTP}</b> — displayed because no SMS is sent in this prototype.</div>` : ''}`;
}
function obSummary(rows) {
  return `<div class="summary-list">${rows.map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v || '—')}</b></div>`).join('')}</div>`;
}
function obChecklist(checks) {
  if (!checks.length) return `<div class="empty" style="padding:22px"><div class="empty__icon">${icon('clipboard')}</div><b>No checks yet</b><p>Automated checks run when the application is submitted.</p></div>`;
  return `<ul class="checklist">${checks.map((c) => `<li class="${c.state}">${icon(c.state === 'pass' ? 'checkCircle' : c.state === 'fail' ? 'x' : 'alert')}<span><b>${esc(c.label)}</b><br><span class="tiny muted">${esc(c.detail)}</span></span></li>`).join('')}</ul>`;
}
function obStatusTone(status) {
  return { Approved: 'green', Rejected: 'red', 'Correction required': 'amber', 'Under review': 'blue', 'Pending verification': 'amber' }[status] || 'neutral';
}
function obHead(kind) {
  const sell = kind === 'seller';
  return pageHead(
    sell ? 'SELLER HUB · ONBOARDING' : 'NEARBUY RUNNER · ONBOARDING',
    sell ? 'Register your shop' : 'Join NearBuy Runner',
    sell
      ? 'Bring a physical shop online. Seven guided steps, then a simulated verification review.'
      : 'Short local deliveries, chosen by you. Seven guided steps for eligible adults aged 18 or over.',
    `<a class="btn btn--ghost btn--sm" href="/${sell ? 'seller' : 'runner'}/">${icon('chevronLeft')} Portal home</a>`
  );
}
function obAside(kind, app) {
  const sell = kind === 'seller';
  return `<aside class="stack">
    ${card({
      title: 'What happens next',
      body: `<div class="timeline">
        ${[['Application', 'Your details are saved in this browser only.'],
           ['Automated checks', 'Format, duplicate and completeness checks run instantly.'],
           ['Human review', 'A reviewer approves, asks for a correction or explains a rejection.'],
           ['Go live', sell ? 'The shop becomes eligible for listing and orders.' : 'The partner can go online and receive nearby requests.']]
          .map(([t, s]) => `<div class="timeline__row"><span class="timeline__dot"></span><div class="timeline__body"><b class="small">${t}</b><p class="tiny muted">${s}</p></div></div>`).join('')}
      </div>`,
      foot: `<span class="tiny muted">${icon('shield')} Simulated verification · no real KYC</span>`
    })}
    ${card({
      title: sell ? 'Documents you would need' : 'Eligibility for launch',
      body: sell
        ? `<ul class="ticks">${['Shop address proof', 'Owner identity (PAN where applicable)', 'GSTIN if registered', 'Bank account for settlements', 'A clear photo of the shopfront'].map((t) => `<li>${icon('check')} ${t}</li>`).join('')}</ul><div class="tiny muted mt-8">Nothing is uploaded here. Production would use an authorised KYC provider with encrypted storage and human review.</div>`
        : `<ul class="ticks">${['Verified adult, 18 or older', 'Government photo identity', 'A payout account in your name', 'Emergency contact', 'Safety briefing acknowledgement'].map((t) => `<li>${icon('check')} ${t}</li>`).join('')}</ul><div class="notice notice--plain mt-8">${icon('alert')}<span>NearBuy does not create delivery accounts for minors. Guardian consent alone does not change this launch policy.</span></div>`
    })}
  </aside>`;
}

/* ------------------------------ seller wizard ------------------------------ */
function sellerOnboarding() {
  const app = sellerApplication();
  if (app.status !== 'Incomplete') return obApplicationPage('seller', app);
  const step = app.step;
  return `<div class="page">
    ${obHead('seller')}
    ${stepper(SELLER_STEPS, step)}
    ${obError()}
    <div class="grid grid--aside">
      <div class="stack">
        ${card({
          title: `Step ${step + 1} of ${SELLER_STEPS.length} · ${SELLER_STEPS[step]}`,
          body: `<form id="sellerOnboardForm" class="form-grid" novalidate>
            <input type="hidden" name="step" value="${step}" />
            ${sellerStepBody(step, app)}
            <div class="ob-actions">
              <button class="btn btn--ghost btn--sm" type="button" data-act="ob-back" data-kind="seller" ${step === 0 ? 'disabled' : ''}>${icon('chevronLeft')} Back</button>
              <button class="btn btn--primary btn--sm" type="submit">${step === SELLER_STEPS.length - 1 ? 'Submit application' : 'Continue'} ${icon('arrowRight')}</button>
            </div>
          </form>`
        })}
      </div>
      ${obAside('seller', app)}
    </div>
  </div>`;
}

function sellerStepBody(step, app) {
  switch (step) {
    case 0:
      return `${obOtp('seller', app)}
        ${obF('email', 'Email (optional)', app.email, { type: 'email', required: false, ph: 'owner@shop.in', hint: 'Used for settlement statements in production.' })}
        ${obS('language', 'Preferred language', app.language, ['English', 'Hindi'])}
        ${obCheck('consent', 'I agree to the NearBuy seller terms and privacy notice.', false, 'Demo consent only — no legal agreement is formed.')}`;
    case 1:
      return `<div class="stack-sm">${SELLER_TYPES.map(([t, s]) => obRadio('businessType', t, app.businessType, t, s)).join('')}</div>`;
    case 2:
      return `${obF('legalName', 'Legal business name', app.legalName, { ph: 'As on your registration' })}
        ${obF('displayName', 'Shop display name', app.displayName, { ph: 'What neighbours will see' })}
        ${obF('owner', 'Owner name', app.owner, { ph: 'Full name' })}
        ${obF('gstin', 'GSTIN (optional)', app.gstin, { ph: '07ABCDE1234F1Z5', required: false, maxlength: 15, hint: 'Format is checked in the demo; not verified with any tax system.' })}`;
    case 3:
      return `${obF('address', 'Shop address', app.address, { ph: 'Shop number, street, locality' })}
        <div class="form-grid form-grid--2">
          ${obF('pin', 'PIN code', app.pin, { ph: '110016', inputmode: 'numeric', maxlength: 6 })}
          ${obS('area', 'Service area', app.area, ['Hauz Khas', 'Green Park', 'Saket'])}
        </div>
        ${obUpload('Shopfront photograph', app.photo ? 'Sample shop photo attached to this application.' : 'A clear photo of your shopfront, shutter and signage.', 'ob-photo', 'seller', app.photo)}
        ${obNotice('Map pin, address proof and shopfront review would be checked by a human in production.', 'info')}`;
    case 4:
      return `<div class="form-grid form-grid--2">
          ${obF('hoursOpen', 'Opening time', app.hoursOpen, { ph: '8:00 am' })}
          ${obF('hoursClose', 'Closing time', app.hoursClose, { ph: '10:00 pm' })}
        </div>
        <div class="form-grid form-grid--2">
          ${obS('holiday', 'Weekly holiday', app.holiday, ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'None'])}
          ${obS('prep', 'Preparation time', app.prep, ['10–15 min', '15–25 min', '20–30 min', '30–45 min'])}
        </div>
        ${obS('radius', 'Maximum delivery radius', String(app.radius), ['1', '2', '3'], 'Kilometres from the shop. Runner payouts follow the configured pricing bands.')}
        <div class="stack-sm">
          ${obCheck('pickup', 'Offer store pickup', app.pickup, 'Customers collect from the shop. Always free.')}
          ${obCheck('delivery', 'Offer NearBuy Runner delivery', app.delivery, 'Only where an eligible partner is available.')}
        </div>`;
    case 5:
      return `${obF('bankHolder', 'Account holder name', app.bankHolder, { ph: 'As printed on the bank account' })}
        ${obF('bankAcc', 'Bank account number', app.bankAcc, { inputmode: 'numeric', maxlength: 18, ph: '9–18 digits' })}
        ${obF('ifsc', 'IFSC code', app.ifsc, { maxlength: 11, ph: 'HDFC0001234' })}
        ${obNotice('No bank connection exists in this prototype. Production needs an authorised verification (for example a penny-drop check) before payouts are enabled.', 'warn')}`;
    default:
      return `${obSummary([
        ['Business', app.businessType],
        ['Shop name', app.displayName],
        ['Owner', app.owner],
        ['Address', `${app.address}, ${app.area} ${app.pin}`],
        ['Hours', `${app.hoursOpen} – ${app.hoursClose} · closed ${app.holiday}`],
        ['Fulfilment', [app.pickup ? 'Pickup' : '', app.delivery ? 'Runner delivery' : ''].filter(Boolean).join(' + ')],
        ['Payout', `•••• ${String(app.bankAcc).slice(-4)} · ${app.ifsc}`]
      ])}
      ${obCheck('declaration', 'I confirm these details are accurate and understand verification is simulated here.', false)}
      ${obNotice('Submitting runs automated checks, then places the application in human review. Nothing goes live automatically.', 'info')}`;
  }
}

function applySellerStep(app, step, fd) {
  const get = (k) => String(fd.get(k) ?? '').trim();
  switch (step) {
    case 0:
      app.phone = get('phone'); app.email = get('email'); app.language = get('language') || 'English';
      app.otpVerified = get('otp') === DEMO_OTP;
      app.consent = fd.get('consent') === 'on';
      break;
    case 1:
      if (get('businessType')) app.businessType = get('businessType');
      break;
    case 2:
      app.legalName = get('legalName'); app.displayName = get('displayName');
      app.owner = get('owner'); app.gstin = get('gstin').toUpperCase();
      break;
    case 3:
      app.address = get('address'); app.pin = get('pin'); app.area = get('area') || app.area;
      break;
    case 4:
      app.hoursOpen = get('hoursOpen'); app.hoursClose = get('hoursClose');
      app.holiday = get('holiday'); app.prep = get('prep'); app.radius = Number(get('radius')) || 2;
      app.pickup = fd.get('pickup') === 'on'; app.delivery = fd.get('delivery') === 'on';
      break;
    case 5:
      app.bankHolder = get('bankHolder'); app.bankAcc = get('bankAcc'); app.ifsc = get('ifsc').toUpperCase();
      break;
    case 6:
      app.declaration = fd.get('declaration') === 'on';
      break;
    default: break;
  }
}

function validateSellerStep(step, app) {
  switch (step) {
    case 0:
      if (!/^[6-9]\d{9}$/.test(app.phone)) return 'Enter a valid 10-digit Indian mobile number.';
      if (!app.otpSent) return 'Send the demo OTP to verify the mobile number first.';
      if (!app.otpVerified) return `That OTP is not correct. The demo code is ${DEMO_OTP}.`;
      if (!app.consent) return 'Accept the seller terms to continue.';
      return null;
    case 1:
      return app.businessType ? null : 'Choose the type of business you operate.';
    case 2:
      if (app.legalName.length < 2) return 'Enter the legal business name.';
      if (app.displayName.length < 2) return 'Enter the name neighbours will see.';
      if (app.owner.length < 2) return 'Enter the owner name.';
      if (app.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(app.gstin)) return 'That GSTIN does not look valid. Leave it blank if the shop is not registered.';
      return null;
    case 3:
      if (app.address.length < 8) return 'Enter the full shop address (street and shop number).';
      if (!/^\d{6}$/.test(app.pin)) return 'Enter a valid 6-digit PIN code.';
      if (!app.photo) return 'Attach a sample shopfront photograph to continue.';
      return null;
    case 4:
      if (!app.hoursOpen || !app.hoursClose) return 'Set the opening and closing times.';
      if (!app.pickup && !app.delivery) return 'Enable pickup, delivery, or both.';
      return null;
    case 5:
      if (app.bankHolder.length < 2) return 'Enter the account holder name.';
      if (!/^\d{9,18}$/.test(app.bankAcc)) return 'Enter a valid bank account number (9–18 digits).';
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(app.ifsc)) return 'Enter a valid IFSC code, for example HDFC0001234.';
      return null;
    default:
      return app.declaration ? null : 'Confirm the declaration before submitting.';
  }
}

function submitSellerStep(fd, form) {
  const app = sellerApplication();
  const step = Number(fd.get('step') ?? app.step);
  applySellerStep(app, step, fd);
  const error = validateSellerStep(step, app);
  if (error) { ui.onboardError = error; save(); refreshPage(); return; }
  ui.onboardError = '';
  if (step >= SELLER_STEPS.length - 1) { submitSellerApplication(app); return; }
  app.step = step + 1;
  save();
  paint();
}

function submitSellerApplication(app) {
  app.checks = [
    { label: 'Mobile ownership', detail: 'Demo OTP accepted in this browser', state: 'pass' },
    { label: 'Mobile number format', detail: `+91 ${app.phone}`, state: 'pass' },
    { label: 'Duplicate shop check', detail: 'No matching demo shop record', state: 'pass' },
    { label: 'GSTIN format', detail: app.gstin ? 'Format accepted · not verified with GSTN' : 'Not provided · applicability needs review', state: app.gstin ? 'pass' : 'review' },
    { label: 'Shopfront photograph', detail: app.photo ? 'Sample image attached · clarity needs review' : 'Missing', state: 'review' },
    { label: 'Location consistency', detail: `PIN ${app.pin} · ${app.area} · map pin not verified`, state: 'review' },
    { label: 'Bank account', detail: 'Verification provider not connected', state: 'review' }
  ];
  app.status = 'Under review';
  app.submittedAt = nowLabel();
  app.decidedAt = null;
  app.decisionNote = 'Automated checks completed; waiting for a human reviewer.';
  notify('ops', 'New seller application', `${app.displayName || 'Shop'} · ${app.area} · needs review`);
  audit('Seller application submitted', `${app.displayName || 'Shop'} · ${app.businessType}`, 'Seller onboarding');
  save();
  paint();
  toast('Application submitted. Automated checks ran; a human review is simulated next.', 'clipboard');
}

/* ------------------------------ runner wizard ------------------------------ */
function runnerOnboarding() {
  const app = runnerApplication();
  if (app.status !== 'Incomplete') return obApplicationPage('runner', app);
  const step = app.step;
  return `<div class="page">
    ${obHead('runner')}
    ${stepper(RUNNER_STEPS, step)}
    ${obError()}
    <div class="grid grid--aside">
      <div class="stack">
        ${card({
          title: `Step ${step + 1} of ${RUNNER_STEPS.length} · ${RUNNER_STEPS[step]}`,
          body: `<form id="runnerOnboardForm" class="form-grid" novalidate>
            <input type="hidden" name="step" value="${step}" />
            ${runnerStepBody(step, app)}
            <div class="ob-actions">
              <button class="btn btn--ghost btn--sm" type="button" data-act="ob-back" data-kind="runner" ${step === 0 ? 'disabled' : ''}>${icon('chevronLeft')} Back</button>
              <button class="btn btn--primary btn--sm" type="submit">${step === RUNNER_STEPS.length - 1 ? 'Submit application' : 'Continue'} ${icon('arrowRight')}</button>
            </div>
          </form>`
        })}
      </div>
      ${obAside('runner', app)}
    </div>
  </div>`;
}

function runnerStepBody(step, app) {
  switch (step) {
    case 0:
      return `${obOtp('runner', app)}
        ${obF('email', 'Email (optional)', app.email, { type: 'email', required: false, ph: 'you@example.com' })}
        ${obNotice('Only adults aged 18 or over can hold a delivery account at launch. The next step checks the date of birth you enter.', 'info')}`;
    case 1:
      return `${obF('name', 'Full name', app.name, { ph: 'As on your identity document' })}
        ${obF('dob', 'Date of birth', app.dob, { type: 'date', hint: 'Used only for the demo age gate. Not stored anywhere else.' })}
        ${obF('address', 'Residential address', app.address, { ph: 'House, street, locality' })}
        ${obF('pin', 'PIN code', app.pin, { inputmode: 'numeric', maxlength: 6, ph: '110016' })}`;
    case 2:
      return `${obS('idType', 'Identity document', app.idType, ['Aadhaar', 'PAN', 'Driving licence', 'Passport'])}
        ${obF('idLast4', 'Last 4 characters of the document number', app.idLast4, { maxlength: 4, ph: '4821', hint: 'Only the last four characters are kept, to demonstrate masking. Full numbers should never be stored in a browser.' })}
        ${obUpload('Profile photograph', app.selfie ? 'Sample selfie attached (liveness not checked).' : 'A clear, recent photograph of your face.', 'ob-selfie', 'runner', app.selfie)}
        ${obNotice('Production must use an authorised KYC provider, encrypted storage, consent records and human review for mismatches.', 'warn')}`;
    case 3:
      return `<div class="stack-sm">${VEHICLES.map(([t, s]) => obRadio('vehicle', t, app.vehicle, t, s)).join('')}</div>
        <div class="form-grid form-grid--2">
          ${obS('area', 'Preferred operating area', app.area, ['Hauz Khas', 'Green Park', 'Saket'])}
          ${obS('maxKm', 'Maximum delivery distance', String(app.maxKm), ['1', '2', '3'], 'Kilometres you are willing to travel for one task.')}
        </div>`;
    case 4:
      return `${obS('payoutMethod', 'Payout method', app.payoutMethod, ['UPI', 'Bank account'])}
        ${app.payoutMethod === 'UPI'
          ? obF('upi', 'UPI ID', app.upi, { ph: 'name@bank' })
          : `${obF('bankAcc', 'Bank account number', app.bankAcc, { inputmode: 'numeric', maxlength: 18 })}
             ${obF('ifsc', 'IFSC code', app.ifsc, { maxlength: 11, ph: 'HDFC0001234' })}`}
        ${obNotice('Payout details are simulated. No UPI mandate is created and no money moves.', 'info')}`;
    case 5:
      return `${obF('emergencyName', 'Emergency contact name', app.emergencyName, { ph: 'Family member or friend' })}
        ${obF('emergencyPhone', 'Emergency contact number', app.emergencyPhone, { inputmode: 'numeric', maxlength: 10 })}
        <div class="stack-sm">
          ${obCheck('training', 'I have read the safety briefing', app.training, 'Parcel limits, safe routes, no unsafe deliveries, SOS process.')}
          ${obCheck('agreement', 'I accept the partner terms and the 18+ launch policy', app.agreement, 'Demo agreement only.')}
        </div>
        ${obNotice('No speed-based targets or incentives. You may pass any request without penalty.', 'info')}`;
    default:
      return `${obSummary([
        ['Name', app.name],
        ['Date of birth', app.dob ? `${app.dob} · ${app.age ?? '—'} years` : ''],
        ['Identity', app.idLast4 ? `${app.idType} · ••••${app.idLast4}` : ''],
        ['Delivery type', app.vehicle],
        ['Operating area', `${app.area} · up to ${app.maxKm} km`],
        ['Payout', app.payoutMethod === 'UPI' ? app.upi : `•••• ${String(app.bankAcc).slice(-4)} · ${app.ifsc}`],
        ['Emergency contact', app.emergencyName ? `${app.emergencyName} · ${app.emergencyPhone}` : '']
      ])}
      ${obCheck('declaration', 'I confirm the details above are accurate.', false)}
      ${obNotice('Submitting does not create an active delivery account. Automated checks and a simulated human review follow.', 'info')}`;
  }
}

function applyRunnerStep(app, step, fd) {
  const get = (k) => String(fd.get(k) ?? '').trim();
  switch (step) {
    case 0:
      app.phone = get('phone'); app.email = get('email');
      app.otpVerified = get('otp') === DEMO_OTP;
      break;
    case 1:
      app.name = get('name'); app.dob = get('dob');
      app.age = ageFromDob(app.dob);
      app.address = get('address'); app.pin = get('pin');
      break;
    case 2:
      app.idType = get('idType') || app.idType;
      app.idLast4 = get('idLast4').toUpperCase();
      break;
    case 3:
      if (get('vehicle')) app.vehicle = get('vehicle');
      app.area = get('area') || app.area;
      app.maxKm = Number(get('maxKm')) || app.maxKm;
      break;
    case 4:
      app.payoutMethod = get('payoutMethod') || app.payoutMethod;
      app.upi = get('upi'); app.bankAcc = get('bankAcc'); app.ifsc = get('ifsc').toUpperCase();
      break;
    case 5:
      app.emergencyName = get('emergencyName'); app.emergencyPhone = get('emergencyPhone');
      app.training = fd.get('training') === 'on'; app.agreement = fd.get('agreement') === 'on';
      break;
    case 6:
      app.declaration = fd.get('declaration') === 'on';
      break;
    default: break;
  }
}

function validateRunnerStep(step, app) {
  switch (step) {
    case 0:
      if (!/^[6-9]\d{9}$/.test(app.phone)) return 'Enter a valid 10-digit Indian mobile number.';
      if (!app.otpSent) return 'Send the demo OTP to verify the mobile number first.';
      if (!app.otpVerified) return `That OTP is not correct. The demo code is ${DEMO_OTP}.`;
      return null;
    case 1:
      if (app.name.length < 2) return 'Enter your full name.';
      if (!app.dob) return 'Enter your date of birth.';
      if (app.age === null) return 'That date of birth is not valid.';
      if (app.age < 18) return `NearBuy Runner is an adult-only programme. The date entered makes this applicant ${app.age}, and delivery accounts are not created for under-18s. Guardian consent does not change this launch policy.`;
      if (app.age > 75) return 'Enter a date of birth between 18 and 75 years ago.';
      if (app.address.length < 8) return 'Enter your residential address.';
      if (!/^\d{6}$/.test(app.pin)) return 'Enter a valid 6-digit PIN code.';
      return null;
    case 2:
      if (!/^[A-Z0-9]{4}$/.test(app.idLast4)) return 'Enter the last 4 alphanumeric characters of the document.';
      if (!app.selfie) return 'Attach a sample profile photograph to continue.';
      return null;
    case 3:
      return app.vehicle ? null : 'Choose how you will make deliveries.';
    case 4:
      if (app.payoutMethod === 'UPI') {
        if (!/^[\w.-]{2,}@[\w.-]{2,}$/.test(app.upi)) return 'Enter a valid UPI ID, for example name@bank.';
      } else {
        if (!/^\d{9,18}$/.test(app.bankAcc)) return 'Enter a valid bank account number (9–18 digits).';
        if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(app.ifsc)) return 'Enter a valid IFSC code.';
      }
      return null;
    case 5:
      if (app.emergencyName.length < 2) return 'Enter an emergency contact name.';
      if (!/^[6-9]\d{9}$/.test(app.emergencyPhone)) return 'Enter a valid 10-digit emergency contact number.';
      if (!app.training) return 'Acknowledge the safety briefing.';
      if (!app.agreement) return 'Accept the partner terms and the 18+ policy.';
      return null;
    default:
      return app.declaration ? null : 'Confirm the declaration before submitting.';
  }
}

function submitRunnerStep(fd, form) {
  const app = runnerApplication();
  const step = Number(fd.get('step') ?? app.step);
  applyRunnerStep(app, step, fd);
  const error = validateRunnerStep(step, app);
  if (error) { ui.onboardError = error; save(); refreshPage(); return; }
  ui.onboardError = '';
  if (step >= RUNNER_STEPS.length - 1) { submitRunnerApplication(app); return; }
  app.step = step + 1;
  save();
  paint();
}

function submitRunnerApplication(app) {
  app.checks = [
    { label: 'Age gate (18+)', detail: `Date of birth gives ${app.age} years`, state: app.age >= 18 ? 'pass' : 'fail' },
    { label: 'Mobile ownership', detail: 'Demo OTP accepted in this browser', state: 'pass' },
    { label: 'Mobile number format', detail: `+91 ${app.phone}`, state: 'pass' },
    { label: 'Identity document format', detail: `${app.idType} ending ${app.idLast4} · not verified`, state: 'review' },
    { label: 'Liveness / selfie', detail: 'Sample image attached · not checked', state: 'review' },
    { label: 'Emergency contact', detail: `+91 ${app.emergencyPhone}`, state: 'pass' },
    { label: 'Safety briefing + agreement', detail: 'Acknowledged in this browser', state: 'pass' },
    { label: 'Payout verification', detail: 'Provider not connected', state: 'review' }
  ];
  app.status = app.age >= 18 ? 'Under review' : 'Rejected';
  app.submittedAt = nowLabel();
  app.decidedAt = app.status === 'Rejected' ? nowLabel() : null;
  app.decisionNote = app.age >= 18
    ? 'Automated checks completed; waiting for a human reviewer.'
    : 'Automatic ineligibility: launch policy requires verified adults aged 18 or over.';
  notify('ops', 'New partner application', `${app.name || 'Applicant'} · ${app.vehicle} · ${app.area}`);
  audit('Partner application submitted', `${app.name || 'Applicant'} · age ${app.age}`, 'Runner onboarding');
  save();
  paint();
  toast(app.age >= 18 ? 'Application submitted for simulated review.' : 'Application rejected by the 18+ launch policy.', app.age >= 18 ? 'clipboard' : 'alert');
}

function ageFromDob(dob) {
  if (!dob) return null;
  const d = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  if (age < 0 || age > 120) return null;
  return age;
}

/* --------------------------- application status ---------------------------- */
function obApplicationPage(kind, app) {
  const sell = kind === 'seller';
  const approved = app.status === 'Approved';
  const failed = ['Rejected', 'Correction required'].includes(app.status);
  return `<div class="page">
    ${obHead(kind)}
    <div class="grid grid--aside">
      <div class="stack">
        ${card({
          title: 'Application status',
          action: `<span class="pill pill--${obStatusTone(app.status)}"><i></i>${esc(app.status)}</span>`,
          body: `<div class="stack-sm">
            <div class="row between wrap gap-8">
              <div><b class="small">${esc(sell ? (app.displayName || 'Your shop') : (app.name || 'Your application'))}</b><div class="tiny muted">${sell ? `${esc(app.businessType)} · ${esc(app.area)}` : `${esc(app.vehicle)} · ${esc(app.area)} · up to ${app.maxKm} km`}</div></div>
              <div class="tiny muted">Submitted ${esc(app.submittedAt || '—')}</div>
            </div>
            ${app.decisionNote ? `<div class="notice ${failed ? '' : approved ? 'notice--plain' : 'notice--info'}">${icon(approved ? 'checkCircle' : failed ? 'alert' : 'clock')}<span>${esc(app.decisionNote)}</span></div>` : ''}
            ${approved ? `<div class="notice notice--plain">${icon('checkCircle')}<span>Approved in this demo. ${sell ? 'The shop would now be eligible for listings and orders.' : 'The partner would now be eligible to go online.'} No real account was created.</span></div>` : ''}
          </div>`,
          foot: `<div class="row between wrap gap-8">
            <button class="btn btn--ghost btn--sm" type="button" data-act="ob-restart" data-kind="${kind}">${icon('refresh')} Start a new application</button>
            ${approved
              ? `<button class="btn btn--primary btn--sm" type="button" data-act="nav" data-surface="${sell ? 'sell' : 'deliver'}" data-view="overview">${icon('arrowRight')} Open ${sell ? 'Seller Hub' : 'Runner workspace'}</button>`
              : `<div class="row gap-6 wrap">
                   <button class="btn btn--soft btn--sm" type="button" data-act="ob-decide" data-kind="${kind}" data-decision="Correction required">Request correction</button>
                   <button class="btn btn--ghost btn--sm" type="button" data-act="ob-decide" data-kind="${kind}" data-decision="Rejected">Reject (demo)</button>
                   <button class="btn btn--primary btn--sm" type="button" data-act="ob-decide" data-kind="${kind}" data-decision="Approved">${icon('check')} Simulate approval</button>
                 </div>`}
          </div>`
        })}
        ${card({ title: 'Automated checks', sub: 'Assistive only — they never make the final decision.', body: obChecklist(app.checks) })}
      </div>
      <aside class="stack">
        ${card({ title: 'Where this appears', body: `<div class="small">Applications are visible to the internal operations console under <b>Verifications</b>. That workspace is deliberately protected and is not a public portal.</div><button class="btn btn--ghost btn--sm mt-10" type="button" data-act="nav" data-surface="ops" data-view="verifications">${icon('shield')} Open verifications</button>` })}
        ${card({ body: `<div class="row gap-8 small"><span class="kpi__icon">${icon('lock')}</span><div><b>Nothing left this browser</b><div class="tiny muted">No SMS, document, bank or identity service was contacted. Production requires authorised providers, encryption and retention rules.</div></div></div>` })}
      </aside>
    </div>
  </div>`;
}

function decideApplication(kind, decision) {
  const app = applicationFor(kind);
  if (!app || app.status === 'Incomplete') { toast('No submitted application to review.', 'alert'); return; }
  const sell = kind === 'seller';
  app.status = decision;
  app.decidedAt = nowLabel();
  if (decision === 'Approved') {
    app.decisionNote = `Approved in the demo by an operations reviewer. ${sell ? 'Eligible for listings and orders.' : 'Eligible to receive simulated requests.'}`;
    if (!sell) {
      const initials = (app.name || 'NB').split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase();
      if (!state.runners.some((r) => r.id === 'runner-applicant')) {
        state.runners.push({
          id: 'runner-applicant', name: app.name, initials, mode: app.vehicle, zone: app.area,
          age: app.age, online: false, maxKm: app.maxKm, categories: ['Grocery', 'Stationery', 'General'],
          alerts: true, shareLocation: false, avatar: 'blue', demoApplicant: true
        });
      }
    }
    notify(sell ? 'sell' : 'deliver', 'Application approved (demo)', sell ? `${app.displayName} can start listing.` : `${app.name} can go online.`);
  } else if (decision === 'Correction required') {
    app.decisionNote = 'Reviewer needs a correction before this application can be approved. In production the specific field and an appeal route would be listed here.';
  } else {
    app.decisionNote = 'Application rejected in the demo. A real rejection must carry a reason code, reviewer identity and an appeal route.';
  }
  audit('Application ' + decision.toLowerCase(), `${sell ? app.displayName : app.name} · ${kind}`, 'Ops reviewer (demo)');
  save();
  paint();
  toast(`Application marked “${decision}”.`, decision === 'Approved' ? 'checkCircle' : 'alert');
}

function restartApplication(kind) {
  if (kind === 'seller') state.onboarding.seller = sellerBlank();
  else state.onboarding.runner = runnerBlank();
  save();
  paint();
  toast('Started a fresh demo application.', 'refresh');
}

/* ------------------------------ ops queue ---------------------------------- */
function opsApplications() {
  return [
    { kind: 'seller', app: state.onboarding.seller, title: state.onboarding.seller.displayName || 'Shop application' },
    { kind: 'runner', app: state.onboarding.runner, title: state.onboarding.runner.name || 'Partner application' }
  ].filter((x) => x.app.status !== 'Incomplete');
}

function opsVerifications() {
  const apps = opsApplications();
  const pending = apps.filter((a) => !['Approved', 'Rejected'].includes(a.app.status)).length;
  return `<div class="page">
    ${pageHead('OPS · VERIFICATIONS', 'Verification queue', 'Review seller and delivery-partner applications. Simulated records only — no document, identity or bank check exists.',
      `<span class="chip active">${icon('shield')} ${adminSession()?.role || 'Reviewer'} · demo</span>`)}
    <div class="grid grid--kpi">
      ${kpi({ label: 'Applications', value: apps.length, icon: 'clipboard', foot: 'submitted in this browser' })}
      ${kpi({ label: 'Awaiting decision', value: pending, icon: 'clock', foot: 'simulated SLA none' })}
      ${kpi({ label: 'Verified partners', value: state.runners.length, icon: 'users', foot: 'demo profiles only' })}
      ${kpi({ label: 'Checks automated', value: apps.reduce((n, a) => n + a.app.checks.length, 0), icon: 'zap', foot: 'assistive, not decisive' })}
    </div>
    ${apps.length ? `<div class="stack">
      ${apps.map(({ kind, app }) => card({
        title: kind === 'seller' ? `Seller application · ${esc(app.displayName || 'Unnamed shop')}` : `Partner application · ${esc(app.name || 'Unnamed applicant')}`,
        sub: kind === 'seller'
          ? `${esc(app.businessType)} · ${esc(app.area)} ${esc(app.pin)} · submitted ${esc(app.submittedAt || '—')}`
          : `${esc(app.vehicle)} · ${esc(app.area)} · age ${app.age ?? '—'} · submitted ${esc(app.submittedAt || '—')}`,
        action: `<span class="pill pill--${obStatusTone(app.status)}"><i></i>${esc(app.status)}</span>`,
        body: `<div class="stack-sm">
          ${obChecklist(app.checks)}
          ${app.decisionNote ? `<div class="tiny muted">${esc(app.decisionNote)}</div>` : ''}
        </div>`,
        foot: `<div class="row between wrap gap-8">
          <span class="tiny muted">${icon('lock')} Reviewer decisions are written to the demo audit log.</span>
          <div class="row gap-6 wrap">
            <button class="btn btn--soft btn--sm" type="button" data-act="ob-decide" data-kind="${kind}" data-decision="Correction required">${icon('refresh')} Request correction</button>
            <button class="btn btn--ghost btn--sm" type="button" data-act="ob-decide" data-kind="${kind}" data-decision="Rejected">Reject</button>
            <button class="btn btn--primary btn--sm" type="button" data-act="ob-decide" data-kind="${kind}" data-decision="Approved">${icon('check')} Approve</button>
          </div>
        </div>`
      })).join('')}
    </div>` : card({
      title: 'Nothing waiting',
      body: emptyState('clipboard', 'No applications submitted', 'Start a seller or partner application from the public portal, then return here to review it.', `<div class="row gap-8 mt-10"><a class="btn btn--ghost btn--sm" href="/seller/register/">Seller application</a><a class="btn btn--ghost btn--sm" href="/runner/register/">Partner application</a></div>`)
    })}
    <div class="notice notice--plain">${icon('lock')}<span>Demo queue. Production decisions require authenticated reviewers with role permissions, reason codes, evidence retention, approvals for sensitive actions and an appeal route. Automated checks must never make irreversible decisions.</span></div>
  </div>`;
}

function pageHtml() {
  if (route.surface === 'ops' && !adminSession()) return adminLockPage();
  if (!portalOpen(route.surface) && !portalPublic(route.surface, route.view)) return portalSignInPage(route.surface);
  switch (route.surface) {
    case 'sell': return sellPage();
    case 'deliver': return deliverPage();
    case 'fleet': return fleetPage();
    case 'ops': return opsPage();
    default: return shopPage();
  }
}
function refreshPage() {
  const active = document.activeElement;
  const id = active?.id;
  const pos = active && 'selectionStart' in active ? active.selectionStart : null;
  const page = $('#page');
  if (!page) { paint(); return; }
  page.classList.add('no-anim');
  page.innerHTML = pageHtml();
  if (id) {
    const next = document.getElementById(id);
    if (next) {
      next.focus();
      if (pos != null && next.setSelectionRange) { try { next.setSelectionRange(pos, pos); } catch {} }
    }
  }
}
let lastRouteKey = null;
function paint() {
  readRoute();
  const key = `${route.surface}/${route.view}/${route.id || ''}`;
  const isNewView = key !== lastRouteKey;
  lastRouteKey = key;
  const y = window.scrollY;
  document.body.dataset.surface = route.surface;
  const opsLocked = (route.surface === 'ops' && !adminSession()) || (!portalOpen(route.surface) && !portalPublic(route.surface, route.view));
  document.body.classList.toggle('ops-locked', opsLocked);
  const barHtml = opsLocked ? '' : mobilebarHtml();
  $('#app').innerHTML = `${railHtml()}<div class="scrim ${ui.drawer ? 'show' : ''}" id="scrim" data-act="drawer"></div>
    <div class="main">${topbarHtml()}<main class="content"><div id="page">${pageHtml()}</div></main></div>${barHtml}`;
  document.body.classList.toggle('has-mobilebar', barHtml.length > 0);
  renderOverlay();
  syncDrawer();
  document.title = `${viewTitle()} · ${currentMeta().label} — NearBuy One`;
  window.scrollTo({ top: isNewView ? 0 : y, behavior: 'instant' in window ? 'instant' : 'auto' });
}

/* ---------------------------------- forms --------------------------------- */
const debounce = (fn, ms = 140) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const applyExploreSearch = debounce(() => {
  const results = $('#exploreResults');
  if (results) {
    results.innerHTML = exploreResults();
    const count = $('#exploreCount');
    if (count) count.textContent = `${filteredCatalogue().length} finds · pickup or local delivery`;
  }
}, 120);
const applySellSearch = debounce(() => refreshPage(), 160);

function handleSubmit(form, event) {
  event.preventDefault();
  const fd = new FormData(form);
  const formId = form.id || form.dataset.form || '';
  switch (formId) {
    case 'hero-search': {
      ui.category = 'all';
      ui.query = (fd.get('q') || '').toString();
      go('shop', 'explore');
      toast(ui.query ? `Showing results for “${ui.query}”.` : 'Showing everything nearby.', 'search');
      break;
    }
    case 'checkoutForm': placeOrder(fd); break;
    case 'otpForm': verifyPin(form.dataset.kind); break;
    case 'productForm': {
      const id = form.dataset.id;
      if (id) {
        const p = productById(id);
        p.name = fd.get('name'); p.detail = fd.get('detail'); p.price = Number(fd.get('price'));
        p.mrp = Math.max(Number(fd.get('mrp')) || p.price, p.price); p.stock = Number(fd.get('stock'));
        p.lowAt = Number(fd.get('lowAt')); p.cat = fd.get('cat'); p.badge = fd.get('badge'); p.emoji = fd.get('emoji') || p.emoji;
        audit('Product updated', `${p.name} · ${money(p.price)} · stock ${p.stock}`, 'Seller demo');
        toast(`${p.name} updated across the storefront.`, 'package');
      } else {
        const nextNum = Math.max(...state.catalogue.map((p) => Number(String(p.id).replace(/\D/g, '')) || 0)) + 1;
        const cat = fd.get('cat');
        const tones = { grocery: 'tone-bread', fresh: 'tone-spinach', bakery: 'tone-milk', stationery: 'tone-notebook', home: 'tone-tote', personal: 'tone-wash' };
        const p = {
          id: `p${nextNum}`, name: fd.get('name'), detail: fd.get('detail') || 'Nearby find',
          price: Number(fd.get('price')), mrp: Math.max(Number(fd.get('mrp')) || Number(fd.get('price')), Number(fd.get('price'))),
          cat, shop: SELLER.shopId, emoji: fd.get('emoji') || '🛒', tone: tones[cat] || 'tone-bread',
          badge: fd.get('badge') || '', stock: Number(fd.get('stock')), lowAt: Number(fd.get('lowAt')) || 4, sold: 0
        };
        state.catalogue.push(p);
        notify('shop', 'New local find', `${p.name} is now available at Green Basket Market.`);
        audit('Product added', `${p.name} · ${money(p.price)}`, 'Seller demo');
        toast(`${p.name} added to the catalogue and storefront.`, 'package');
      }
      save(); closeModal(); paint();
      break;
    }
    case 'promoForm': {
      const promo = { id: uid('LP'), title: fd.get('title'), code: String(fd.get('code') || '').toUpperCase(), type: fd.get('type'), status: 'Active', uses: 0, ends: fd.get('ends') || '30 Jun 2025' };
      state.promos.unshift(promo);
      audit('Promotion created', `${promo.code} · ${promo.type}`, 'Seller demo');
      save(); closeModal(); paint(); toast(`${promo.code} is live in the demo.`, 'megaphone');
      break;
    }
    case 'areaForm': {
      const id = form.dataset.id;
      if (id) {
        const a = state.areas.find((x) => x.id === id);
        a.radius = Number(fd.get('radius')); a.city = fd.get('city'); a.status = fd.get('status');
        audit('Area updated', `${a.name} · ${a.radius} km · ${a.status}`, 'Ops demo');
        toast(`${a.name} updated.`, 'pin');
      } else {
        const name = String(fd.get('name') || '').trim();
        if (!name) { toast('Give the area a name.', 'alert'); return; }
        state.areas.push({ id: slug(name), name, city: fd.get('city') || 'Delhi', radius: Number(fd.get('radius')), status: fd.get('status'), shops: 0, partners: 0 });
        audit('Area added', `${name} · ${fd.get('radius')} km`, 'Ops demo');
        toast(`${name} added to the demo network.`, 'pin');
      }
      save(); closeModal(); paint();
      break;
    }
    case 'returnForm': {
      const t = taskById(form.dataset.id);
      if (!t) break;
      const reason = fd.get('reason');
      t.status = 'Returned'; t.returnReason = reason; t.returnNote = fd.get('note'); t.completedAt = nowLabel();
      addTaskEvent(t, `Returned · ${reason}`);
      syncOrderFromTask(t);
      state.returns.unshift({ id: uid('RT'), order: t.orderId || t.id, customer: t.customer, product: t.items + ' items', reason, status: 'Needs review', amount: t.payout, date: 'Just now' });
      notify('ops', `Return recorded · ${t.id}`, `${me().name} · ${reason}`);
      audit('Return recorded', `${t.id} · ${reason}`, 'Runner demo');
      save(); closeModal(); paint(); toast('Return recorded. The shop and ops can see it now.', 'refresh');
      break;
    }
    case 'runner-prefs': {
      const r = me();
      r.mode = fd.get('mode'); r.zone = fd.get('zone'); r.maxKm = Number(fd.get('maxKm'));
      r.categories = $$('input[name="category"]:checked', form).map((x) => x.value);
      r.alerts = fd.get('alerts') === 'on'; r.shareLocation = fd.get('shareLocation') === 'on';
      save(); paint(); toast('Demo preferences saved.', 'sliders');
      break;
    }
    case 'incident': {
      const incident = { id: uid('INC'), partnerId: me().id, partner: me().name, task: String(fd.get('task') || '').trim(), type: fd.get('type'), message: fd.get('message'), status: 'Open', date: nowLabel() };
      state.incidents.unshift(incident);
      notify('ops', `Safety report · ${incident.id}`, `${me().name} · ${incident.type}`);
      audit('Safety report', `${incident.id} · ${incident.type}`, 'Runner demo');
      save(); paint(); toast('Sample report saved. Ops can see it now.', 'shield');
      break;
    }
    case 'portalSignInForm': {
      const surface = String(fd.get('surface') || '');
      const p = PORTALS[surface];
      const email = String(fd.get('email') || '').trim().toLowerCase();
      const pass = String(fd.get('password') || '');
      if (!p) break;
      if (email !== p.email || pass !== p.pass) {
        ui.signInError = `Those details do not match the ${p.label} portal. Each portal has its own account — a customer login cannot open seller, partner or operations tools.`;
        paint();
        toast('Sign-in failed for this portal.', 'alert');
        break;
      }
      ui.signInError = '';
      setPortalSession(surface);
      audit('Portal sign-in', `${p.label} portal · ${p.persona}`, 'Demo auth');
      save();
      closeModal();
      paint();
      toast(`Signed in to the ${p.label} portal.`, 'checkCircle');
      break;
    }
    case 'adminUnlockForm': {
      const code = String(fd.get('code') || '').trim().toUpperCase();
      if (code !== ADMIN_CODE) {
        toast('That demo access code is not correct.', 'alert');
        break;
      }
      setAdminSession('Operations reviewer');
      audit('Operations console unlocked', 'Demo access code accepted in this browser', 'Demo gate');
      save(); paint();
      toast('Operations console unlocked for this tab. All records are demo data.', 'shield');
      break;
    }
    case 'sellerOnboardForm': submitSellerStep(fd, form); break;
    case 'runnerOnboardForm': submitRunnerStep(fd, form); break;
    case 'runner-support': case 'support': {
      audit('Demo note', `${form.id} · ${String(fd.get('topic') || 'general')}`, 'Demo user');
      save(); paint(); toast('Demo note saved in this browser. Nobody was contacted.', 'mail');
      break;
    }
    default: toast('This is a demo form.', 'checkCircle');
  }
}

/* --------------------------------- events --------------------------------- */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  if (['INPUT', 'SELECT', 'TEXTAREA', 'OPTION'].includes(el.tagName)) return;
  const isHashLink = el.tagName === 'A' && String(el.getAttribute('href') || '').startsWith('#');
  if (el.tagName === 'A' && !isHashLink && el.getAttribute('href') !== '#') return;
  e.preventDefault();
  handleAction(el.dataset.act, el.dataset, el, e);
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act, ds = el.dataset;
  if (act === 'sort') { ui.sort = el.value; refreshPage(); return; }
  if (act === 'setting-select') {
    state.settings[ds.key] = ds.key === 'radius' ? Number(el.value) : el.value;
    save(); paint(); toast('Shop setting saved.', 'sliders'); return;
  }
  if (act === 'cat-toggle') {
    const r = me();
    const boxes = $$('input[name="category"]:checked').map((x) => x.value);
    r.categories = boxes; save(); refreshPage(); return;
  }
  if (act === 'method' || act === 'online-toggle' || act === 'toggle-setting') { handleAction(act, ds, el, e); return; }
  handleAction(act, ds, el, e);
});
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.id === 'exploreSearch') { ui.query = el.value; applyExploreSearch(); return; }
  if (el.dataset.act === 'sell-search') { ui.sellQuery = el.value; applySellSearch(); return; }
  if (el.id === 'paletteInput') { refreshPalette(el.value); return; }
  if (el.dataset.act === 'range-max') {
    const label = el.closest('label')?.querySelector('span');
    if (label) label.textContent = `Maximum distance · ${el.value} km`;
    return;
  }
  if (el.dataset.act === 'pricing-input') {
    const band = state.pricing.find((b) => b.id === el.dataset.id);
    if (band) { band.pay = Math.max(0, Number(el.value)); save(); }
  }
});
document.addEventListener('submit', (e) => {
  const form = e.target;
  handleSubmit(form, e);
});
window.addEventListener('hashchange', () => { ui.drawer = false; paint(); });
window.addEventListener('storage', (e) => { if (e.key === KEY) { toast('Demo data updated in another tab.', 'refresh'); } });
document.addEventListener('keydown', (e) => {
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); ui.palette ? closeModal() : openPalette(); return; }
  if (e.key === 'Escape') { if (ui.modal || ui.palette) closeModal(); else if (ui.drawer) { ui.drawer = false; syncDrawer(); } return; }
  if (ui.palette) {
    const items = paletteMatches();
    if (e.key === 'ArrowDown') { e.preventDefault(); ui.palette.idx = clamp((ui.palette.idx || 0) + 1, 0, items.length - 1); renderOverlay(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); ui.palette.idx = clamp((ui.palette.idx || 0) - 1, 0, items.length - 1); renderOverlay(); }
    if (e.key === 'Enter') {
      const item = items[ui.palette.idx || 0];
      if (item) { e.preventDefault(); ui.palette = null; renderOverlay(); go(...String(item.go).split('/')); }
    }
  }
});

/* ---------------------------------- boot ---------------------------------- */
(function boot() {
  state.area = state.area || 'Hauz Khas';
  state.coupon = state.coupon || '';
  state.followed = state.followed || ['greenbasket'];
  state.taskSeq = state.taskSeq || 1040;
  state.orderSeq = state.orderSeq || 20487;
  state.runners = state.runners || RUNNERS;
  if (!state.saved) state.saved = ['p107'];
  save();
  readRoute();
  paint();
})();
