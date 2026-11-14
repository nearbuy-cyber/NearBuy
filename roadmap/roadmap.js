(function () {
  'use strict';
  var groups = [
    { id: 'customer', title: 'Customer platform', description: 'Make the neighbourhood easy to discover, shop and enjoy.', icon: '⌂', features: ['Homepage and portal navigation', 'Location and serviceability', 'Product and shop search', 'Category browsing', 'Product comparison', 'Shop storefronts', 'Product details', 'Cart and checkout', 'Multi-shop basket', 'Payments and refunds', 'Order tracking', 'Wishlist and reorder', 'Reviews and questions', 'Customer helpdesk', 'Rewards and loyalty'] },
    { id: 'seller', title: 'Seller Hub', description: 'Simple, powerful tools for the businesses around us.', icon: '▦', features: ['Seller onboarding and verification', 'Manage Profile', 'Account and login security', 'Manage Locations', 'Bank Details', 'Business Details', 'Shop storefront', 'Single product listing', 'Bulk product listing', 'AI-assisted listing', 'Product QC', 'SKU and variants', 'Inventory management', 'POS and stock synchronisation', 'Order management', 'Delivery management', 'Returns and complaints', 'Payments and settlements', 'Offers and promotions', 'Seller analytics', 'Staff management', 'Business reports'] },
    { id: 'runner', title: 'Runner & delivery partner', description: 'A reliable, transparent network for local fulfilment.', icon: '➜', features: ['Runner operations dashboard', 'Live delivery overview', 'Partner onboarding', 'Partner eligibility and verification', 'Availability management', 'Delivery job matching', 'Partner job requests', 'Pickup QR or OTP', 'Customer delivery OTP', 'Location tracking', 'Delivery proof', 'Incident management', 'Earnings and payouts', 'Partner support', 'Safety and policy management'] },
    { id: 'business-admin', title: 'Business partner & admin', description: 'The relationships and operations that make the network work.', icon: '◇', features: ['Business partner application', 'Partner verification', 'Referral management', 'Partner performance', 'Admin overview', 'Customer management', 'Seller management', 'Shop management', 'Product catalogue moderation', 'Orders and fulfilment', 'Financial administration', 'Refunds and disputes', 'Promotion management', 'Support and escalation', 'Fraud and risk monitoring', 'Reports and analytics', 'Role and permission management', 'Audit logs'] },
    { id: 'platform', title: 'Platform infrastructure', description: 'The shared foundations behind every NearBuy experience.', icon: '▤', features: ['Shared identity system', 'Product master catalogue', 'Location and serviceability engine', 'Search infrastructure', 'Pricing and promotion engine', 'Transactional inventory', 'Order orchestration', 'Payment reconciliation', 'Settlement ledger', 'Notification infrastructure', 'Media storage', 'Security and privacy', 'Monitoring and backups', 'API and integration layer'] }
  ];
  var storageKey = 'nearbuy.blueprint.checklist.v1';
  var selected = {};
  try {
    var saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) selected = saved;
  } catch (error) { /* Storage is optional. */ }
  var container = document.getElementById('sections');
  var total = groups.reduce(function (sum, group) { return sum + group.features.length; }, 0);
  var allInputs = [];
  groups.forEach(function (group, groupIndex) {
    var section = document.createElement('section');
    section.className = 'feature-section';
    section.setAttribute('aria-labelledby', group.id + '-title');
    var header = document.createElement('div');
    header.className = 'feature-heading';
    var icon = document.createElement('span'); icon.className = 'feature-icon icon-' + groupIndex; icon.textContent = group.icon; icon.setAttribute('aria-hidden', 'true');
    var text = document.createElement('div'); text.className = 'feature-title';
    var title = document.createElement('h3'); title.id = group.id + '-title'; title.textContent = group.title;
    var description = document.createElement('p'); description.textContent = group.description;
    text.append(title, description);
    var count = document.createElement('span'); count.className = 'section-count';
    header.append(icon, text, count);
    var list = document.createElement('div'); list.className = 'feature-list';
    var inputs = [];
    group.features.forEach(function (feature, index) {
      var key = group.id + '-' + index;
      var label = document.createElement('label'); label.className = 'feature';
      var input = document.createElement('input'); input.type = 'checkbox'; input.checked = selected[key] === true; input.dataset.key = key;
      var name = document.createElement('span'); name.textContent = feature;
      label.append(input, name); list.appendChild(label); inputs.push(input); allInputs.push(input);
      input.addEventListener('change', function () { if (input.checked) selected[key] = true; else delete selected[key]; save(); update(); });
    });
    group.inputs = inputs; group.count = count;
    section.append(header, list); container.appendChild(section);
  });
  function save() { try { localStorage.setItem(storageKey, JSON.stringify(selected)); } catch (error) { /* Continue in memory if storage is unavailable. */ } }
  function update() {
    var done = allInputs.filter(function (input) { return input.checked; }).length;
    groups.forEach(function (group) { group.count.textContent = group.inputs.filter(function (input) { return input.checked; }).length + ' / ' + group.features.length; });
    document.getElementById('progress-label').textContent = done + ' of ' + total + ' reviewed';
    document.getElementById('percentage').textContent = Math.round(done / total * 100) + '%';
    document.getElementById('progress-fill').style.width = (done / total * 100) + '%';
    document.querySelector('.progress-track').setAttribute('aria-valuemax', total);
    document.querySelector('.progress-track').setAttribute('aria-valuenow', done);
    document.getElementById('reset').disabled = done === 0;
  }
  document.getElementById('reset').addEventListener('click', function () {
    if (!window.confirm('Reset all reviewed features? This cannot be undone.')) return;
    selected = {}; allInputs.forEach(function (input) { input.checked = false; }); save(); update();
  });
  update();
}());
