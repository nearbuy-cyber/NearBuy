const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Run the production SPA in a lightweight DOM so the checks require no packages.
function makeApp(initial = {}) {
  const storage = (seed = {}) => {
    const values = new Map(Object.entries(seed));
    return {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key)
    };
  };
  const node = () => ({ innerHTML: '', classList: { add() {}, toggle() {} }, appendChild() {}, remove() {} });
  const nodes = { '#app': node(), '#overlay': node(), '#toasts': node() };
  const listeners = {};
  const document = {
    body: { dataset: {}, classList: { toggle() {} } },
    querySelector: (selector) => nodes[selector] || null,
    querySelectorAll: () => [],
    getElementById: () => null,
    createElement: node,
    addEventListener(type, handler) { (listeners[type] ||= []).push(handler); }
  };
  class FormDataStub {
    constructor(form) { this.values = form.values || {}; }
    get(key) { return Object.hasOwn(this.values, key) ? this.values[key] : null; }
    forEach(callback) { Object.entries(this.values).forEach(([key, value]) => callback(value, key)); }
  }
  const context = vm.createContext({
    document, window: { scrollY: 0, scrollTo() {}, addEventListener() {} },
    location: { hash: '#/shop/home' }, localStorage: storage(initial), sessionStorage: storage(),
    URL, URLSearchParams, FormData: FormDataStub, listeners, setTimeout() {}, clearTimeout() {}, console
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'nearbuy.js'), 'utf8'), context, { filename: 'nearbuy.js' });
  return (expression) => vm.runInContext(expression, context);
}

test('every catalogue item has a complete product page, including sold-out items', () => {
  const run = makeApp();
  const ids = JSON.parse(run('JSON.stringify(state.catalogue.map(p => p.id))'));
  for (const id of ids) {
    const html = run(`shopProduct(${JSON.stringify(id)})`);
    for (const section of ['productTitle', 'productShowcaseTitle', 'productDescriptionTitle', 'productDeliveryTitle', 'productHighlightsTitle', 'productShopTitle', 'productDetailsTitle']) {
      assert.match(html, new RegExp(`id="${section}"`), `${id} is missing ${section}`);
    }
    for (const tab of ['Specifications', 'Description', 'Warranty', 'Manufacturer info']) assert.ok(html.includes(tab), `${id} is missing ${tab}`);
    assert.match(html, /Owner name/);
    assert.match(html, /Phone number/);
    assert.match(html, /after discounts/);
  }
  const soldOut = run("shopProduct('p116')");
  assert.match(soldOut, /Out of stock right now/);
  assert.doesNotMatch(soldOut, /id="product-add-to-cart"/);
  assert.match(run("shopProduct('missing-product')"), /no longer available/);
});

test('shop contact data is explicit, shop-specific, and never drawn from private login or runner fields', () => {
  const run = makeApp();
  run(`state.profile.account.mobile = 'PRIVATE-ACCOUNT';
       state.profile.account.loginMobile = 'PRIVATE-LOGIN';
       state.profile.locations[0].phone = 'PRIVATE-RUNNER';
       state.profile.locations[0].instructions = 'PRIVATE-HANDOVER';
       state.profile.locations[0].building = 'PRIVATE-BUILDING';
       state.profile.locations[0].hours = 'PRIVATE-HOURS';
       state.profile.business.publicOwnerName = 'Public Owner';
       state.profile.business.publicPhone = '90000 00000';`);
  const green = run("shopProduct('p101')");
  assert.match(green, /Public Owner/);
  assert.match(green, /90000 00000/);
  for (const secret of ['PRIVATE-ACCOUNT', 'PRIVATE-LOGIN', 'PRIVATE-RUNNER', 'PRIVATE-HANDOVER', 'PRIVATE-BUILDING', 'PRIVATE-HOURS']) assert.doesNotMatch(green, new RegExp(secret));
  assert.match(green, /<dt>Shop location<\/dt><dd>Hauz Khas<\/dd>/);
  const otherShop = run("shopProduct('p106')");
  assert.match(otherShop, /Paper Lane Books &amp; More/);
  assert.match(otherShop, /<dt>Owner name<\/dt><dd>Not provided by the shop<\/dd>/);
  assert.match(otherShop, /<dt>Phone number<\/dt><dd>Not provided by the shop<\/dd>/);
  assert.doesNotMatch(otherShop, /Public Owner|90000 00000|PRIVATE-/);
});

test('fresh profiles leave public contact details blank and explicitly saved values persist', () => {
  const first = makeApp();
  const html = first("shopProduct('p101')");
  assert.match(html, /<dt>Owner name<\/dt><dd>Not provided by the shop<\/dd>/);
  assert.match(html, /<dt>Phone number<\/dt><dd>Not provided by the shop<\/dd>/);
  const saved = JSON.parse(first('JSON.stringify(state)'));
  saved.profile.business.publicOwnerName = 'Explicit owner';
  saved.profile.business.publicPhone = '90000 00000';
  const restored = makeApp({ 'nearbuy.one.v2': JSON.stringify(saved) });
  assert.match(restored("shopProduct('p101')"), /Explicit owner/);
  assert.match(restored("shopProduct('p101')"), /90000 00000/);
});

test('previously saved profiles do not automatically publish contact information', () => {
  const first = makeApp();
  const saved = JSON.parse(first('JSON.stringify(state)'));
  delete saved.profile.business.publicOwnerName;
  delete saved.profile.business.publicPhone;
  saved.profile.account.loginMobile = 'PRIVATE-LOGIN';
  saved.profile.locations[0].phone = 'PRIVATE-RUNNER';
  const run = makeApp({ 'nearbuy.one.v2': JSON.stringify(saved) });
  const html = run("shopProduct('p101')");
  assert.match(html, /<dt>Owner name<\/dt><dd>Not provided by the shop<\/dd>/);
  assert.match(html, /<dt>Phone number<\/dt><dd>Not provided by the shop<\/dd>/);
  assert.doesNotMatch(html, /PRIVATE-LOGIN|PRIVATE-RUNNER/);
});

test('seller public contact fields can be saved and cleared without exposing private details', () => {
  const run = makeApp();
  assert.equal(run(`globalThis.businessFields = { ...state.profile.business, publicOwnerName: 'Demo owner', publicPhone: '90000 00000' };
    profileSaveBusiness({get: (key) => businessFields[key] ?? null})`), null);
  assert.match(run("shopProduct('p101')"), /Demo owner/);
  assert.match(run("shopProduct('p101')"), /90000 00000/);
  assert.match(run(`businessFields.publicPhone = 'not-a-phone'; profileSaveBusiness({get: (key) => businessFields[key] ?? null})`), /valid public shop phone/);
  assert.equal(run('state.profile.business.publicPhone'), '90000 00000');
  assert.equal(run(`businessFields.publicOwnerName = ''; businessFields.publicPhone = ''; profileSaveBusiness({get: (key) => businessFields[key] ?? null})`), null);
  assert.match(run("shopProduct('p101')"), /<dt>Phone number<\/dt><dd>Not provided by the shop<\/dd>/);
});

test('seller product details save, render, escape and persist across both editing and creation', () => {
  const run = makeApp();
  const fields = {
    name: 'Farm fresh whole milk', detail: 'Full cream · 500 ml', price: '34', mrp: '38', stock: '18', lowAt: '6', cat: 'bakery', badge: 'Bestseller', emoji: '🥛',
    description: 'Shop description <script>alert(1)</script>', highlights: 'First highlight\nSecond highlight',
    specifications: 'Size: 500 ml\nMaterial: Glass', images: '/public/assets/discover-milk.jpg\nhttps://images.example.test/milk.jpg',
    warranty: 'Demo warranty', manufacturerName: 'Demo manufacturer', manufacturerAddress: 'Demo address', countryOfOrigin: 'India'
  };
  run(`globalThis.form = { id: 'productForm', dataset: {id: 'p101'}, values: ${JSON.stringify(fields)}, querySelector: () => null };
       handleSubmit(form, {preventDefault() {}})`);
  assert.equal(run("productById('p101').description"), fields.description);
  assert.equal(run("productById('p101').highlights.length"), 2);
  assert.equal(run("productById('p101').specifications[0].value"), '500 ml');
  assert.equal(run("productById('p101').images.length"), 2);
  assert.equal(run("JSON.parse(localStorage.getItem('nearbuy.one.v2')).catalogue.find(p => p.id === 'p101').warranty"), 'Demo warranty');
  let html = run("shopProduct('p101')");
  assert.match(html, /Shop description &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /First highlight/);
  assert.match(html, /Size<\/dt><dd>500 ml/);
  run("ui.productTab = 'warranty'");
  assert.match(run("shopProduct('p101')"), /Demo warranty/);
  run("ui.productTab = 'manufacturer'");
  html = run("shopProduct('p101')");
  assert.match(html, /Demo manufacturer/);
  assert.match(html, /Demo address/);
  assert.match(html, /India/);
  run('openProductForm("p101")');
  assert.match(run('ui.modal.inner'), /Size: 500 ml/);
  assert.match(run('ui.modal.inner'), /Demo warranty/);

  run(`form.dataset.id = ''; form.values.name = 'New demo item'; handleSubmit(form, {preventDefault() {}})`);
  const createdId = run("state.catalogue.find(p => p.name === 'New demo item').id");
  assert.match(run(`shopProduct(${JSON.stringify(createdId)})`), /Shop description &lt;script&gt;/);
  assert.equal(run(`state.catalogue.find(p => p.id === ${JSON.stringify(createdId)}).manufacturerName`), 'Demo manufacturer');
});

test('invalid specifications or image URLs do not mutate the catalogue', () => {
  const run = makeApp();
  const fields = {name: 'Should not save', detail: '', price: '50', mrp: '50', stock: '5', lowAt: '1', cat: 'bakery', specifications: 'Missing a colon', images: ''};
  run(`globalThis.section = {open: false}; globalThis.errorBox = {hidden: true, textContent: ''};
       globalThis.form = {id: 'productForm', dataset: {id: 'p101'}, values: ${JSON.stringify(fields)}, querySelector: (s) => s === '.product-form-details' ? section : errorBox};
       handleSubmit(form, {preventDefault() {}})`);
  assert.equal(run("productById('p101').name"), 'Farm fresh whole milk');
  assert.equal(run('section.open'), true);
  assert.equal(run('errorBox.hidden'), false);
  assert.match(run('errorBox.textContent'), /specification/i);
  run("form.values.specifications = ''; form.values.images = 'javascript:alert(1)'; handleSubmit(form, {preventDefault() {}})");
  assert.equal(run("productById('p101').name"), 'Farm fresh whole milk');
  assert.match(run('errorBox.textContent'), /HTTPS image URLs/);
});

test('showcase images are constrained, and seeded photos cannot follow a renamed product', () => {
  const run = makeApp();
  assert.equal(run("safeProductImageUrl('/public/assets/discover-milk.jpg')"), '/public/assets/discover-milk.jpg');
  assert.equal(run("safeProductImageUrl('https://images.example.test/a.jpg')"), 'https://images.example.test/a.jpg');
  for (const value of ['javascript:alert(1)', 'data:image/png;base64,xxx', 'http://example.test/a.jpg', '//example.test/a.jpg', '/private/document', '/public/assets/../portal.html', 'https://user:pass@example.test/a.jpg', 'https://localhost/a.jpg', 'https://127.0.0.1/a.jpg', 'https://[::1]/a.jpg']) {
    assert.equal(run(`safeProductImageUrl(${JSON.stringify(value)})`), '', value);
  }
  assert.equal(run("productImageUrls(productById('p101')).length"), 2);
  run("productById('p101').name = 'Renamed product'");
  assert.equal(run("productImageUrls(productById('p101')).length"), 0);
  assert.match(run("shopProduct('p101')"), /No showcase images have been added/);
});

test('product navigation resets controls, while cart and saved items retain shared state', () => {
  const run = makeApp();
  run("shopProduct('p101'); ui.qty = 3; ui.productTab = 'warranty'; ui.productImageIndex = 1; shopProduct('p102')");
  assert.equal(run('ui.qty'), 1);
  assert.equal(run('ui.productTab'), 'specifications');
  assert.equal(run('ui.productImageIndex'), 0);
  run("state.cart = []; handleAction('add', {id: 'p102', qty: '3'}); handleAction('save', {id: 'p102'})");
  assert.equal(run('state.cart[0].qty'), 3);
  assert.equal(run("state.saved.includes('p102')"), true);
  assert.match(run("shopProduct('p102')"), /Saved for later/);
  assert.match(run('shopCart()'), /Sunrise bananas/);
  assert.equal(run("deliveryFeeFor(198, 'Delivery')"), 19);
  assert.equal(run("deliveryFeeFor(199, 'Delivery')"), 0);
  assert.equal(run("deliveryFeeFor(0, 'Pickup')"), 0);
});

test('modal delegation preserves native details and submit controls while backdrop clicks still close', () => {
  const run = makeApp();
  run(`globalThis.backdrop = { tagName: 'DIV', dataset: {act: 'backdrop'}, closest() { return this; } };
       globalThis.nativeControl = { tagName: 'SUMMARY', closest() { return backdrop; } };
       globalThis.event = {target: nativeControl, prevented: false, preventDefault() { this.prevented = true; }};
       listeners.click[0](event);`);
  assert.equal(run('event.prevented'), false);
  run(`nativeControl.tagName = 'BUTTON'; event.prevented = false; listeners.click[0](event);`);
  assert.equal(run('event.prevented'), false);
  run(`ui.modal = {inner: 'modal', cls: ''};
       event = {target: backdrop, prevented: false, preventDefault() { this.prevented = true; }};
       listeners.click[0](event);`);
  assert.equal(run('event.prevented'), true);
  assert.equal(run('ui.modal'), null);
});
