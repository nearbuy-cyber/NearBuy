const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function createHarness(initialHash = '#/shop/home') {
  const storage = new Map();
  const sessStorage = new Map();
  const bodyClasses = new Map();
  const elements = new Map([
    ['app', { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] }],
    ['overlay', { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] }],
    ['toasts', { appendChild() {} }],
    ['nbSearchHint', {
      classes: new Set(),
      classList: {
        toggle(cls, force) {
          if (force === undefined) {
            if (this._set.has(cls)) this._set.delete(cls); else this._set.add(cls);
          } else if (force) this._set.add(cls); else this._set.delete(cls);
        }
      }
    }]
  ]);
  elements.get('nbSearchHint').classList._set = elements.get('nbSearchHint').classes;

  const listeners = {};
  let currentHash = initialHash;
  const locationObj = {
    get hash() { return currentHash; },
    set hash(val) {
      currentHash = String(val);
      (listeners['window:hashchange'] || []).forEach((fn) => fn());
    },
    search: '',
    pathname: '/portal.html'
  };

  const document = {
    body: {
      dataset: {},
      classList: {
        toggle(cls, force) {
          bodyClasses.set(cls, Boolean(force));
        }
      }
    },
    activeElement: null,
    addEventListener(type, fn) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    },
    createElement() {
      return { className: '', innerHTML: '', classList: { add() {} }, remove() {} };
    },
    getElementById(id) {
      return elements.get(id) || null;
    },
    querySelector(sel) {
      if (sel.startsWith('#') && !sel.includes(' ')) return elements.get(sel.slice(1)) || null;
      return null;
    },
    querySelectorAll() {
      return [];
    }
  };
  const window = {
    location: locationObj,
    scrollTo() {},
    addEventListener(type, fn) {
      listeners[`window:${type}`] = listeners[`window:${type}`] || [];
      listeners[`window:${type}`].push(fn);
    }
  };
  const localStorage = {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key)
  };
  const sessionStorage = {
    getItem: (key) => (sessStorage.has(key) ? sessStorage.get(key) : null),
    setItem: (key, value) => sessStorage.set(key, String(value)),
    removeItem: (key) => sessStorage.delete(key)
  };
  const context = vm.createContext({
    console,
    Math,
    Date,
    Intl,
    JSON,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Set,
    Map,
    RegExp,
    URL,
    Error,
    parseInt,
    parseFloat,
    isNaN,
    setTimeout: () => 1,
    clearTimeout() {},
    window,
    location: locationObj,
    history: { replaceState() {} },
    document,
    localStorage,
    sessionStorage
  });
  const source = fs.readFileSync(path.join(__dirname, '..', 'nearbuy.js'), 'utf8');
  vm.runInContext(source, context, { filename: 'nearbuy.js' });
  return { context, elements, bodyClasses, listeners, window };
}

test('strictly excludes confidential reference names, colours, and logos across source files', () => {
  const filesToCheck = [
    'nearbuy.js',
    'nearbuy.css',
    'portal.html',
    'index.html',
    'customer/index.html',
    'customer/login/index.html'
  ];
  const decode = (b64) => new RegExp(Buffer.from(b64, 'base64').toString('utf8'), 'i');
  const forbiddenPatterns = [
    decode('c2hvcGthcnQ='),
    decode('ZmxpcGthcnQ='),
    decode('ZXhwbG9yZVxzK3BsdXM='),
    decode('IzI4NzRmMA=='),
    decode('IzE1NThjMA=='),
    decode('I2ZmZTUwMA=='),
    decode('I2ZiNjQxYg==')
  ];

  for (const relPath of filesToCheck) {
    const content = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
    for (const pattern of forbiddenPatterns) {
      assert.doesNotMatch(content, pattern, `${relPath} must not contain confidential token ${pattern}`);
    }
  }
});

test('customer portal renders full-width NearBuy storefront while keeping other workspaces on sidebar shell', () => {
  const { context, elements, bodyClasses } = createHarness('#/shop/home');
  const appHtml = elements.get('app').innerHTML;

  assert.equal(bodyClasses.get('shop-storefront'), true);
  assert.match(appHtml, /class="nb-store-topbar"/);
  assert.match(appHtml, /Near<span>Buy<\/span>/);
  assert.match(appHtml, /class="nb-cat-strip"/);
  assert.match(appHtml, /class="nb-hero"/);
  assert.match(appHtml, /class="nb-promo-grid"/);
  assert.match(appHtml, /Deals of the Day/);
  assert.match(appHtml, /Best of Fresh &amp; Groceries/);
  assert.match(appHtml, /Books, Stationery &amp; Morning Picks/);
  assert.match(appHtml, /Home, Kitchen &amp; Everyday Care/);
  assert.match(appHtml, /class="nb-wide-banner"/);
  assert.match(appHtml, /class="nb-shops-strip"/);
  assert.match(appHtml, /class="nb-two-col"/);
  assert.match(appHtml, /nb-seller-box/);
  assert.match(appHtml, /class="nb-trust-row"/);
  assert.match(appHtml, /class="nb-footer"/);
  assert.match(appHtml, /id="nbCartDrawer"/);
  assert.doesNotMatch(appHtml, /id="rail"/);

  vm.runInContext(`go('sell', 'overview');`, context);
  assert.equal(bodyClasses.get('shop-storefront'), false);
  assert.match(elements.get('app').innerHTML, /id="rail"/);
});

test('public storefront browsing works signed out while checkout and orders require customer sign-in', () => {
  const { context, elements } = createHarness('#/shop/home');

  for (const [view, id] of [['explore', null], ['shops', null], ['product', 'p101'], ['cart', null], ['saved', null], ['help', null]]) {
    vm.runInContext(`go('shop', ${JSON.stringify(view)}, ${JSON.stringify(id)});`, context);
    assert.doesNotMatch(elements.get('app').innerHTML, /id="portalSignInForm"/, `${view} should be publicly browsable`);
  }

  vm.runInContext(`go('shop', 'orders');`, context);
  assert.match(elements.get('app').innerHTML, /id="portalSignInForm"/);

  vm.runInContext(`
    setPortalSession('shop');
    paint();
  `, context);
  assert.doesNotMatch(elements.get('app').innerHTML, /id="portalSignInForm"/);
  assert.match(elements.get('app').innerHTML, /Riya/);
});

test('login query flag, cart drawer, quick search, hero slide, and seller modal work in customer portal', () => {
  const { context, elements } = createHarness('#/shop/home?login=1');
  assert.match(elements.get('overlay').innerHTML, /Sign in to NearBuy/);
  assert.match(elements.get('overlay').innerHTML, /\/public\/assets\/nearbuy-logo\.png/);

  vm.runInContext(`closeModal();`, context);
  assert.equal(elements.get('overlay').innerHTML, '');

  vm.runInContext(`handleAction('shop-seller-open', {});`, context);
  assert.match(elements.get('overlay').innerHTML, /Sell locally on NearBuy/);
  vm.runInContext(`closeModal();`, context);

  vm.runInContext(`
    state.cart = [];
    handleAction('cart-add', { id: 'p101' });
    handleAction('cart-drawer-open', {});
  `, context);
  assert.match(elements.get('app').innerHTML, /class="nb-drawer open"/);
  assert.match(elements.get('app').innerHTML, /Farm fresh whole milk/);

  vm.runInContext(`handleAction('cart-drawer-close', {});`, context);
  assert.doesNotMatch(elements.get('app').innerHTML, /class="nb-drawer open"/);

  vm.runInContext(`handleAction('hero-slide', { slide: '2' });`, context);
  const slideIdx = vm.runInContext(`ui.heroSlide`, context);
  assert.equal(slideIdx, 2);

  vm.runInContext(`handleAction('quick-search', { q: 'sourdough' });`, context);
  const routeSnap = JSON.parse(vm.runInContext(`JSON.stringify({ view: route.view, query: ui.query, count: filteredCatalogue().length })`, context));
  assert.equal(routeSnap.view, 'explore');
  assert.equal(routeSnap.query, 'sourdough');
  assert.equal(routeSnap.count, 1);
});
