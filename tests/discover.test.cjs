const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the real browser script with a minimal DOM and fresh demo storage.
// The interactive layout is also checked separately in a browser.
function makeApp() {
  const storage = () => {
    const values = new Map();
    return {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key)
    };
  };
  const node = () => ({ innerHTML: '', classList: { add() {}, toggle() {} }, appendChild() {}, remove() {} });
  const nodes = { '#app': node(), '#overlay': node(), '#toasts': node() };
  const document = {
    body: { dataset: {}, classList: { toggle() {} } },
    querySelector: (selector) => nodes[selector] || null,
    querySelectorAll: () => [],
    getElementById: () => null,
    createElement: node,
    addEventListener() {}
  };
  const context = vm.createContext({
    document,
    window: { scrollY: 0, scrollTo() {}, addEventListener() {} },
    location: { hash: '#/shop/home' },
    localStorage: storage(), sessionStorage: storage(), URLSearchParams,
    setTimeout() {}, clearTimeout() {}, console
  });
  const source = fs.readFileSync(path.join(__dirname, '..', 'nearbuy.js'), 'utf8');
  vm.runInContext(source, context, { filename: 'nearbuy.js' });
  return (expression) => vm.runInContext(expression, context);
}

test('search matches categories and words across product details', () => {
  const run = makeApp();
  run("ui.query = 'bakery'");
  assert.equal(run('filteredCatalogue().length'), 3);
  run("ui.query = 'fresh milk'");
  assert.equal(run('filteredCatalogue()[0].id'), 'p101');
  assert.equal(run('filteredCatalogue().length'), 1);
});

test('stock and deal filters combine and can be reset', () => {
  const run = makeApp();
  run("state.catalogue.find(p => p.id === 'p102').mrp = state.catalogue.find(p => p.id === 'p102').price");
  run('ui.exploreAvailable = true; ui.exploreDeals = true');
  assert.equal(run('filteredCatalogue().length'), 16);
  run("ui.category = 'fresh'; ui.query = 'bananas'; ui.sort = 'price-low'; resetExploreFilters()");
  assert.equal(run('filteredCatalogue().length'), 18);
  assert.equal(run('ui.category'), 'all');
  assert.equal(run('ui.query'), '');
  assert.equal(run('ui.sort'), 'popular');
  assert.equal(run('ui.exploreAvailable || ui.exploreDeals'), false);
});

test('Discover shortcuts start with the intended filters', () => {
  const run = makeApp();
  run("ui.query = 'milk'; ui.exploreAvailable = true; handleAction('category', {cat: 'fresh'})");
  assert.equal(run('ui.query'), '');
  assert.equal(run('ui.exploreAvailable'), false);
  assert.equal(run('ui.category'), 'fresh');
  assert.equal(run('filteredCatalogue().length'), 4);
  run("handleAction('discover-deals', {})");
  assert.equal(run('ui.category'), 'all');
  assert.equal(run('ui.exploreDeals'), true);
  run("handleAction('discover-all', {})");
  assert.equal(run('ui.exploreDeals'), false);
  assert.equal(run('filteredCatalogue().length'), 18);
});

test('product photos only appear for the matching original demo product', () => {
  const run = makeApp();
  assert.match(run("productCard(productById('p101'), {featureImage: true})"), /discover-milk\.jpg/);
  run("productById('p101').name = 'Different product'");
  assert.doesNotMatch(run("productCard(productById('p101'), {featureImage: true})"), /discover-milk\.jpg/);
});

test('the demo offer updates the cart and checkout discount', () => {
  const run = makeApp();
  run("state.cart = [{id:'p101', qty: 2}]; handleAction('discover-offer', {})");
  assert.equal(run('state.coupon'), 'LOCAL10');
  assert.equal(run("orderTotals(cartLines(), 'Delivery').discount"), 7);
  assert.match(run('shopCart()'), /LOCAL10 discount/);
  assert.match(run('shopCheckout()'), /LOCAL10 discount/);
});
