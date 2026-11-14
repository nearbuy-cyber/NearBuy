'use strict';
// Demonstration data. Everything created here is flagged is_demo = 1 and labelled DEMO DATA in the interface.
// Orders, shipments, returns and ledger rows are produced by the same workflow functions the application uses,
// so stock levels, timelines and settlement totals are internally consistent.
const fs = require('node:fs');
const path = require('node:path');
const { get, all, run, tx, insert, nextCode } = require('./db');
const { nowIso, setClock, hashPassword, encrypt, istDate, addDays, r2 } = require('./lib');
const { moveStock } = require('./stock');
const { ensureWarehouse, storeUpload } = require('./routes/catalog');
const { createOrder, createReturn, applyOrderAction, applyReturnAction, demoCustomer } = require('./routes/orders');
const { runSettlement } = require('./routes/finance');
const { TICKET_CATEGORIES } = require('./routes/account');

const ASSET_DIR = path.join(__dirname, 'demo-assets');
const DEMO_OWNER = { email: 'owner@nearbuy.demo', password: 'Seller123!', name: 'Riya Sharma', mobile: '9810012345' };
const DEMO_TEAM = [
  { email: 'catalogue@nearbuy.demo', name: 'Kunal Batra', role: 'catalogue_manager' },
  { email: 'orders@nearbuy.demo', name: 'Sana Sheikh', role: 'order_manager' },
  { email: 'stock@nearbuy.demo', name: 'Deepak Rawat', role: 'inventory_manager' },
  { email: 'finance@nearbuy.demo', name: 'Neha Kapoor', role: 'finance_viewer' },
];
const TEAM_PASSWORD = 'Team123!';

// [title, sku, category, brand, price, mrp, gst, stock, weight_g, [l, w, h], attributes, final status, variants]
const PRODUCTS = [
  ['Wireless Bluetooth Headphones with Mic', 'AUD-BT-HP01', 'Electronics', 'SoundNest', 1499, 2499, 18, 60, 320, [20, 18, 8], { warranty: '1 year manufacturer warranty', connectivity: 'Bluetooth', power_source: 'Rechargeable battery' }, 'active'],
  ['Smart Fitness Band with Heart Rate Monitor', 'WEAR-FB-02', 'Electronics', 'PulseFit', 1999, 3499, 18, 30, 90, [12, 8, 4], { warranty: '1 year manufacturer warranty', connectivity: 'Bluetooth', power_source: 'Rechargeable battery' }, 'active', null, 9],
  ['Portable Bluetooth Speaker 10 W', 'AUD-SPK-03', 'Electronics', 'SoundNest', 1199, 1799, 18, 40, 450, [16, 10, 10], { warranty: '6 months warranty', connectivity: 'Bluetooth', power_source: 'Rechargeable battery' }, 'active'],
  ['Fast Charging Power Bank 10000 mAh', 'PWR-PB-04', 'Electronics', 'VoltEdge', 899, 1499, 18, 70, 240, [15, 8, 3], { warranty: '1 year manufacturer warranty', connectivity: 'USB', power_source: 'Rechargeable battery' }, 'active'],
  ["Men's Cotton Casual Shirt Sky Blue", 'FSH-SHRT-05', 'Fashion', 'Loom & Line', 899, 1499, 5, 0, 280, [30, 25, 4], { fabric: '100% cotton', fit: 'Regular', care: 'Machine wash cold' }, 'active', [['S', 'Sky Blue', 14], ['M', 'Sky Blue', 22], ['L', 'Sky Blue', 18], ['XL', 'Sky Blue', 9]]],
  ["Women's Printed Cotton Kurta", 'FSH-KRT-06', 'Fashion', 'Loom & Line', 749, 1299, 5, 0, 260, [30, 25, 4], { fabric: 'Cotton', fit: 'Regular', care: 'Hand wash' }, 'active', [['S', 'Indigo', 12], ['M', 'Indigo', 20], ['L', 'Indigo', 15]]],
  ['Unisex Lightweight Running Shoes', 'FSH-SHOE-07', 'Fashion', 'StrideOn', 1599, 2499, 12, 0, 720, [32, 20, 12], { fabric: 'Mesh upper with EVA sole', fit: 'Regular', care: 'Wipe with a damp cloth' }, 'active', [['UK 7', 'Grey', 10], ['UK 8', 'Grey', 14], ['UK 9', 'Grey', 8]]],
  ['Stainless Steel Water Bottle 1 Litre', 'HK-BTL-08', 'Home and Kitchen', 'Kitchen Kraft', 499, 799, 12, 120, 380, [28, 9, 9], { capacity: '1 litre', pack_contents: '1 bottle with lid', dishwasher_safe: 'Yes' }, 'active'],
  ['Non-stick Cookware Set 3 Pieces', 'HK-CKW-09', 'Home and Kitchen', 'Kitchen Kraft', 1899, 2999, 18, 30, 2600, [40, 30, 14], { capacity: '1.5 L, 2 L and 24 cm', pack_contents: '1 kadhai, 1 saucepan, 1 frying pan', dishwasher_safe: 'No' }, 'active'],
  ['LED Desk Lamp with Touch Dimmer', 'HK-LMP-10', 'Home and Kitchen', 'GlowWell', 699, 1099, 18, 30, 540, [36, 14, 14], { capacity: 'Not applicable', pack_contents: '1 lamp, 1 USB cable', dishwasher_safe: 'Not applicable' }, 'active', null, 6],
  ['Ceramic Coffee Mug Set of 4', 'HK-MUG-11', 'Home and Kitchen', 'Clay Story', 399, 699, 12, 24, 1200, [24, 24, 12], { capacity: '300 ml each', pack_contents: '4 mugs', dishwasher_safe: 'Yes' }, 'active', null, 0],
  ['Cotton Double Bedsheet with 2 Pillow Covers', 'HK-BED-12', 'Home and Kitchen', 'Loom & Line', 849, 1399, 5, 34, 900, [32, 26, 8], { capacity: '228 x 254 cm', pack_contents: '1 bedsheet, 2 pillow covers', dishwasher_safe: 'Not applicable' }, 'active'],
  ['Vitamin C Face Serum 30 ml', 'BTY-SRM-13', 'Beauty', 'Dew Botanics', 449, 699, 18, 46, 110, [12, 5, 5], { skin_type: 'All skin types', shelf_life_months: '24', ingredients: 'Vitamin C, hyaluronic acid' }, 'active'],
  ['Herbal Hair Oil 200 ml', 'BTY-OIL-14', 'Beauty', 'Dew Botanics', 299, 399, 18, 70, 260, [18, 6, 6], { skin_type: 'Not applicable', shelf_life_months: '24', ingredients: 'Amla, bhringraj, coconut oil' }, 'active'],
  ['Professional Makeup Brush Set of 12', 'BTY-BRS-15', 'Beauty', 'Dew Botanics', 499, 799, 18, 20, 210, [22, 12, 4], { skin_type: 'All skin types', shelf_life_months: '36', ingredients: 'Synthetic bristles' }, 'active', null, 0],
  ['Premium Mixed Dry Fruits 500 g', 'GRO-DRY-16', 'Grocery', 'Harvest Table', 549, 699, 5, 60, 540, [22, 16, 7], { shelf_life_days: '180', diet: 'Vegetarian', fssai_licence: '10020011000123' }, 'active'],
  ['Assam Black Tea 250 g', 'GRO-TEA-17', 'Grocery', 'Harvest Table', 199, 249, 5, 90, 280, [16, 10, 7], { shelf_life_days: '365', diet: 'Vegetarian', fssai_licence: '10020011000123' }, 'active'],
  ['Cold Pressed Groundnut Oil 1 Litre', 'GRO-OIL-18', 'Grocery', 'Harvest Table', 329, 399, 5, 30, 1050, [26, 9, 9], { shelf_life_days: '270', diet: 'Vegetarian', fssai_licence: '10020011000123' }, 'active', null, 4],
  ['Classic Ruled Notebooks Pack of 5', 'BK-NTB-19', 'Books', 'PaperTrail', 199, 299, 12, 150, 900, [30, 21, 5], { author: 'Not applicable', publisher: 'PaperTrail', language: 'English' }, 'active'],
  ["Illustrated Children's Story Collection", 'BK-STY-20', 'Books', 'PaperTrail', 349, 499, 0, 36, 520, [26, 20, 3], { author: 'Meenal Rao', publisher: 'PaperTrail', language: 'English', isbn: '9780000000002' }, 'active'],
  ['Wooden Building Blocks 50 Pieces', 'TOY-BLK-21', 'Toys', 'PlayGrove', 749, 1199, 12, 26, 1100, [28, 20, 10], { age_group: '3–5 years', battery_required: 'No' }, 'active', null, 4],
  ['Remote Control Racing Car', 'TOY-RC-22', 'Toys', 'PlayGrove', 999, 1599, 12, 13, 640, [30, 18, 12], { age_group: '6–8 years', battery_required: 'Yes' }, 'pending_approval'],
  ['Anti-slip Yoga Mat 6 mm', 'SPT-YGA-23', 'Sports', 'StrideOn', 599, 999, 12, 80, 950, [62, 14, 14], { sport: 'Yoga', skill_level: 'All levels' }, 'active'],
  ['Resistance Bands Set of 5', 'SPT-RB-24', 'Sports', 'StrideOn', 399, 649, 18, 30, 300, [20, 14, 5], { sport: 'Strength training', skill_level: 'All levels' }, 'active', null, 8],
  ['Training Football Size 5', 'SPT-FB-25', 'Sports', 'StrideOn', 699, 1099, 12, 22, 440, [23, 23, 23], { sport: 'Football', skill_level: 'All levels' }, 'inactive'],
  ['Classic Analog Wrist Watch', 'ACC-WCH-26', 'Accessories', 'Meridian', 1299, 1999, 18, 28, 180, [10, 9, 7], { ideal_for: 'Unisex', warranty: '1 year' }, 'active'],
  ['UV Protection Sunglasses', 'ACC-SUN-27', 'Accessories', 'Meridian', 599, 999, 18, 26, 120, [16, 7, 5], { ideal_for: 'Unisex', warranty: '6 months' }, 'qc_failed'],
  ['Laptop Backpack 25 Litre', 'ACC-BAG-28', 'Accessories', 'Meridian', 799, 1299, 18, 58, 680, [46, 30, 12], { ideal_for: 'Unisex', warranty: '6 months' }, 'active'],
  ["Men's Leather Wallet", 'ACC-WLT-29', 'Accessories', 'Meridian', 549, 899, 18, 0, 110, [12, 10, 2], { ideal_for: 'Men' }, 'draft'],
  ['Travel Toiletry Pouch', 'ACC-TTP-30', 'Accessories', 'Meridian', 349, 599, 18, 40, 150, [24, 14, 8], { ideal_for: 'Unisex' }, 'rejected'],
];
const DESCRIPTIONS = {
  Electronics: 'Built for everyday use with dependable battery life and a compact body. Tested for quality before dispatch and covered by the brand warranty stated on this listing.',
  Fashion: 'Made from breathable, skin-friendly fabric with clean stitching and a comfortable everyday fit. Colour may vary slightly from the photographs because of studio lighting.',
  'Home and Kitchen': 'A durable everyday essential for the Indian home, made from food-safe and long-lasting materials. Easy to clean and designed to stay looking good with regular use.',
  Beauty: 'A dermatologically tested formula made for Indian weather. Free from parabens and suitable for daily use. Check the batch number and use-by date on the pack.',
  Grocery: 'Sourced directly from trusted growers, cleaned, graded and packed in a hygienic facility. Store in a cool, dry place away from sunlight after opening.',
  Books: 'Printed on good-quality paper with a sturdy binding that stands up to daily handling. A dependable choice for school, college, office and home use.',
  Toys: 'Made from child-safe materials with smooth edges and non-toxic colours. Encourages imagination and hand-eye coordination. Adult supervision is recommended.',
  Sports: 'Designed for regular training at home or outdoors with a non-slip finish and tough, tear-resistant material. Lightweight and easy to carry to practice.',
  Accessories: 'A versatile everyday accessory with a clean, timeless design and sturdy construction. Packed in a protective box, ready for gifting.',
};
const HIGHLIGHTS = {
  Electronics: ['Long battery life', 'Compact and lightweight', 'Brand warranty included', 'Quality checked before dispatch'],
  Fashion: ['Breathable fabric', 'Comfortable regular fit', 'Colour-fast dye', 'Easy care'],
  'Home and Kitchen': ['Food-safe material', 'Easy to clean', 'Built for daily use', 'Sturdy construction'],
  Beauty: ['Dermatologically tested', 'Paraben free', 'Suitable for daily use'],
  Grocery: ['Hygienically packed', 'No added preservatives', 'Sourced from trusted growers'],
  Books: ['Good-quality paper', 'Sturdy binding', 'Suitable for school and office'],
  Toys: ['Child-safe materials', 'Non-toxic colours', 'Builds motor skills'],
  Sports: ['Non-slip finish', 'Tear-resistant material', 'Lightweight and portable'],
  Accessories: ['Timeless design', 'Sturdy build', 'Gift-ready packaging'],
};

function lcg(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }
const isoDaysAgo = (days, hour = 11) => new Date(`${addDays(istDate(), -Math.floor(days))}T${String(hour).padStart(2, '0')}:${String(Math.floor((days % 1) * 59)).padStart(2, '0')}:00+05:30`).toISOString();

function seedDemoData(sellerId, owner) {
  const rand = lcg(20261114 + sellerId);
  const ctx = { sellerId, user: { id: owner.id, name: owner.name }, can: () => true };
  const refreshSeller = () => { ctx.seller = get('SELECT * FROM sellers WHERE id = ?', sellerId); };
  refreshSeller();
  try {
    return tx(() => {
      setClock(isoDaysAgo(75, 10));
      if (!get('SELECT 1 FROM seller_pickup_locations WHERE seller_id = ?', sellerId)) {
        insert('seller_pickup_locations', { seller_id: sellerId, name: 'Hauz Khas dispatch point (DEMO DATA)', contact_person: owner.name, mobile: '9810012345', address: '12 Aurobindo Market, Hauz Khas', city: 'New Delhi', state: 'Delhi', pincode: '110016', is_default: 1, created_at: nowIso() });
      }
      const warehouse = ensureWarehouse(sellerId);

      /* Products */
      const products = [];
      PRODUCTS.forEach((p, idx) => {
        const [title, sku, category, brand, price, mrp, gst, stock, weight, dims, attributes, status, variants] = p;
        if (get('SELECT 1 FROM products WHERE seller_id = ? AND sku = ?', sellerId, sku) || get('SELECT 1 FROM inventory WHERE seller_id = ? AND sku LIKE ?', sellerId, `${sku}%`)) return;
        const created = nowIso();
        const incomplete = status === 'draft';
        const productId = insert('products', {
          seller_id: sellerId, code: nextCode('PRD', 10000), title, category, brand, description: incomplete ? '' : `${title}. ${DESCRIPTIONS[category]}`,
          highlights: incomplete ? [] : HIGHLIGHTS[category], model_number: `${sku.split('-')[1]}-${100 + idx}`, sku,
          specs: { dimensions: `${dims[0]} x ${dims[1]} x ${dims[2]} cm`, weight: `${weight} g`, colour: variants ? variants[0][1] : '', material: '', size: '', manufacturer: `${brand} Pvt. Ltd.`, country_of_origin: 'India' },
          attributes, mrp, price, tax_category: gst === 0 ? 'Exempt goods' : 'Taxable goods', gst_rate: gst, package: { weight_g: weight, length_cm: dims[0], width_cm: dims[1], height_cm: dims[2] },
          dispatch_days: category === 'Grocery' ? 1 : 2, warehouse_id: warehouse.id, status: 'active', is_demo: 1, created_at: created, updated_at: created,
        });
        const file = path.join(ASSET_DIR, `${sku}.jpg`);
        if (fs.existsSync(file) && status !== 'qc_failed' && status !== 'draft') {
          const uploadId = storeUpload(sellerId, owner.id, 'product_image', fs.readFileSync(file), 'image/jpeg', 'jpg', `${sku}.jpg`);
          insert('product_images', { seller_id: sellerId, product_id: productId, upload_id: uploadId, is_primary: 1, position: 0 });
        }
        const rows = [];
        if (variants) {
          for (const [size, colour, qty] of variants) {
            const vsku = `${sku}-${size.replace(/\s+/g, '')}`;
            const variantId = insert('product_variants', { seller_id: sellerId, product_id: productId, sku: vsku, size, colour, price: null });
            rows.push([insert('inventory', { seller_id: sellerId, product_id: productId, variant_id: variantId, warehouse_id: warehouse.id, sku: vsku, on_hand: 0, reserved: 0, safety_stock: 6, updated_at: created }), qty + 12]);
          }
        } else rows.push([insert('inventory', { seller_id: sellerId, product_id: productId, variant_id: null, warehouse_id: warehouse.id, sku, on_hand: 0, reserved: 0, safety_stock: 10, updated_at: created }), stock]);
        for (const [invId, qty] of rows) if (qty > 0) moveStock(sellerId, invId, { onHandDelta: qty, kind: 'initial', reason: 'Opening stock (DEMO DATA)', actor: owner.name, quiet: true });
        products.push({ id: productId, status, target: p[13], invIds: rows.map((r) => r[0]), price, title });
      });
      const sellable = products.filter((p) => p.status === 'active' || p.status === 'inactive');
      if (!sellable.length) return { products: 0, orders: 0 };

      /* Orders, walked through the real workflow */
      const act = (order, action, body, at) => { setClock(at); applyOrderAction(ctx, get('SELECT * FROM orders WHERE id = ?', order.id), action, body || {}); };
      const settleCuts = [45, 30, 16];
      const plan = [];
      const openStages = ['new', 'new', 'new', 'pending_confirmation', 'pending_confirmation', 'processing', 'processing', 'packed', 'packed_shipment', 'ready_to_ship', 'ready_to_ship', 'shipped', 'shipped', 'shipped_failed'];
      openStages.forEach((stage, i) => plan.push({ days: i < 3 ? i * 0.25 : i < 5 ? 1 + (i - 3) * 0.4 : i < 9 ? 2 + (i - 5) * 0.7 : 3 + (i - 9) * 0.5, stage }));
      for (let i = 0; i < 30; i += 1) plan.push({ days: 6 + i * 1.75 + rand(), stage: i === 4 ? 'cancel_new' : i === 11 ? 'cancel_packed' : i === 19 ? 'rto' : i === 25 ? 'cancel_processing' : 'delivered' });
      plan.sort((a, b) => b.days - a.days);
      const delivered = [];
      let created = 0;
      for (const item of plan) {
        while (settleCuts.length && item.days < settleCuts[0]) {
          const cut = settleCuts.shift();
          setClock(isoDaysAgo(cut, 18));
          runSettlement(sellerId, { isDemo: true, status: 'demo_recorded', at: nowIso(), upTo: nowIso() });
        }
        const product = sellable[Math.floor(rand() * sellable.length)];
        const invId = product.invIds[Math.floor(rand() * product.invIds.length)];
        const inv = get('SELECT on_hand, reserved FROM inventory WHERE id = ?', invId);
        const qty = Math.min(inv.on_hand - inv.reserved, product.price < 600 ? 1 + Math.floor(rand() * 3) : 1 + Math.floor(rand() * 1.4));
        if (qty < 1) continue;
        // Recent orders are placed relative to the current time so that none is dated in the future.
        const placed = item.days < 6 ? new Date(Date.now() - Math.round((item.days * 24 + 0.4 + rand() * 0.5) * 3600000)).toISOString() : isoDaysAgo(item.days, 9 + Math.floor(rand() * 10));
        setClock(placed);
        const order = createOrder(sellerId, { lines: [{ inventoryId: invId, qty }], customer: demoCustomer(Math.floor(rand() * 12)), placedAt: placed, paymentMethod: rand() < 0.28 ? 'Cash on delivery' : 'Prepaid', isDemo: true, quietNotify: true });
        created += 1;
        const t = (hours) => new Date(Date.parse(placed) + hours * 3600000).toISOString();
        const steps = { pending_confirmation: 1, processing: 2, packed: 3, packed_shipment: 4, ready_to_ship: 5, shipped: 6, shipped_failed: 6, delivered: 7, rto: 6 }[item.stage] || 0;
        const sequence = [['accept', 2], ['process', 5], ['pack', 20], ['shipment', 21], ['ready', 22], ['dispatch', 28], ['deliver', 28 + 30 + Math.floor(rand() * 60)]];
        if (item.stage === 'cancel_new') act(order, 'cancel', { reason: 'Customer requested cancellation' }, t(3));
        else if (item.stage === 'cancel_processing') { act(order, 'accept', {}, t(2)); act(order, 'process', {}, t(5)); act(order, 'cancel', { reason: 'Pricing error', note: 'Listing price was entered incorrectly' }, t(9)); }
        else if (item.stage === 'cancel_packed') { sequence.slice(0, 3).forEach(([a, h]) => act(order, a, {}, t(h))); act(order, 'cancel', { reason: 'Product damaged or defective', note: 'Damage found during packing' }, t(23)); }
        else sequence.slice(0, steps).forEach(([a, h]) => act(order, a, {}, t(h)));
        if (item.stage === 'shipped_failed') act(order, 'fail', { reason: 'Customer not available at the delivery address' }, t(60));
        if (item.stage === 'rto') { act(order, 'fail', { reason: 'Address not found' }, t(70)); act(order, 'rto', {}, t(140)); }
        if (item.stage === 'delivered') delivered.push({ id: order.id, days: item.days });
      }

      /* Returns */
      const returnPlan = [['new', 'Quality not as expected', 'Feels less sturdy than the listing suggested.'], ['new', 'Damaged in transit', 'Outer box was crushed and the product has a dent.'], ['under_review', 'Item not as described', 'Colour looks different from the photos.'],
        ['under_review', 'Defective or not working', 'Has a fault that showed up after first use.'], ['approved', 'Wrong item delivered', 'Received a different item from the one ordered.'], ['received', 'Quality not as expected', 'Build quality is lower than expected.'],
        ['rejected', 'No longer needed', 'Ordered by mistake.'], ['completed', 'Damaged in transit', 'Seal was broken on arrival.'], ['completed', 'Defective or not working', 'Arrived with a visible defect and could not be used.']];
      const candidates = [...delivered].sort((a, b) => a.days - b.days);
      let returns = 0;
      returnPlan.forEach(([target, reason, description], i) => {
        const pick = candidates[i * 2 + 1] || candidates[i];
        if (!pick) return;
        const order = get('SELECT * FROM orders WHERE id = ?', pick.id);
        const item = get('SELECT * FROM order_items WHERE order_id = ? ORDER BY id LIMIT 1', order.id);
        const base = Date.parse(order.delivered_at) + 26 * 3600000;
        const at = (h) => new Date(Math.min(base + h * 3600000, Date.now() - (9 - i) * 1800000)).toISOString();
        setClock(at(0));
        const ret = createReturn(sellerId, { order, item, qty: 1, reason, description, requestedAt: at(0), isDemo: true, quiet: true });
        const step = (action, body, h) => { setClock(at(h)); applyReturnAction(ctx, get('SELECT * FROM returns WHERE id = ?', ret.id), action, body || {}); };
        if (target !== 'new') step('review', { note: 'Checking order photos and packing record.' }, 5);
        if (['approved', 'received', 'completed'].includes(target)) step('approve', {}, 9);
        if (target === 'rejected') step('reject', { reason: 'The return window closed before this request and the item is non-returnable once opened.' }, 9);
        if (['received', 'completed'].includes(target)) step('receive', { condition: i % 2 ? 'Sellable — restock' : 'Damaged — do not restock' }, 60);
        if (target === 'completed') step('refund', {}, 64);
        returns += 1;
      });

      /* Final stock positions and listing statuses */
      setClock(isoDaysAgo(0.5, 8));
      for (const p of products) {
        if (p.target != null) {
          const inv = get('SELECT * FROM inventory WHERE id = ?', p.invIds[0]);
          const delta = p.target - (inv.on_hand - inv.reserved);
          if (delta) moveStock(sellerId, inv.id, { onHandDelta: delta, kind: 'adjustment', reason: 'Stock count correction (DEMO DATA)', actor: owner.name, quiet: true });
        }
        if (p.status !== 'active') {
          const notes = p.status === 'qc_failed' ? ['Add at least one product image.'] : p.status === 'rejected' ? ['Rejected by catalogue review (DEMO DATA): the brand shown in the images does not match the brand on the listing. Upload images of the correct product and resubmit.'] : [];
          run('UPDATE products SET status = ?, qc_notes = ?, updated_at = ? WHERE id = ?', p.status, JSON.stringify(notes), nowIso(), p.id);
        }
      }

      /* Promotions */
      const today = istDate();
      const ids = (n, offset = 0) => sellable.filter((p) => p.status === 'active').slice(offset, offset + n).map((p) => p.id);
      const promo = (name, productIds, type, value, start, end, budget, state) => insert('promotions', { seller_id: sellerId, code: nextCode('PRM', 300), name, product_ids: productIds, discount_type: type, discount_value: value, start_date: addDays(today, start), end_date: addDays(today, end), budget, state, is_demo: 1, created_at: nowIso(), updated_at: nowIso() });
      promo('Winter Essentials Sale', ids(4, 7), 'percentage', 10, -3, 11, 15000, 'published');
      promo('Fitness Fortnight', ids(2, 18), 'flat', 50, -6, 8, 6000, 'published');
      promo('Republic Day Preview', ids(5, 0), 'percentage', 15, 20, 27, 25000, 'published');
      promo('Diwali Festive Offer', ids(6, 2), 'percentage', 20, -32, -18, 30000, 'published');
      promo('Back to School Stationery', ids(2, 14), 'percentage', 12, 5, 19, 4000, 'draft');
      promo('Kitchen Clearance', ids(3, 6), 'flat', 75, -10, 4, 8000, 'paused');

      /* Advertising campaigns with illustrative delivery metrics */
      const campaign = (name, objective, productIds, budget, start, end, state, days, quality) => {
        const metrics = [];
        for (let d = days; d >= 1; d -= 1) {
          if (state === 'paused' && d < 5) break;
          const impressions = Math.round(budget * (1.2 + rand() * 0.8));
          const clicks = Math.round(impressions * (0.012 + rand() * 0.014) * quality);
          const conversions = Math.floor(clicks * (0.012 + rand() * 0.02) * quality + rand());
          const spend = r2(Math.min(budget, clicks * (3.2 + rand() * 2.4)));
          metrics.push({ date: addDays(today, end != null && end < 0 ? end - d + 1 : -d), impressions, clicks, conversions, spend, revenue: r2(conversions * (500 + rand() * 600)) });
        }
        insert('advertising_campaigns', { seller_id: sellerId, code: nextCode('ADC', 600), name, objective, product_ids: productIds, daily_budget: budget, start_date: addDays(today, start), end_date: end == null ? null : addDays(today, end), targeting: { type: 'automatic', keywords: [], categories: [], placements: ['Search results', 'Product pages'] }, bid_strategy: 'automatic', bid_amount: null, state, metrics, is_demo: 1, created_at: nowIso(), updated_at: nowIso() });
      };
      campaign('Bestsellers — Always On', 'Increase sales', ids(4, 0), 600, -40, null, 'active', 40, 1.15);
      campaign('Home & Kitchen Visibility', 'Boost product visibility', ids(3, 7), 400, -21, 14, 'active', 21, 0.9);
      campaign('Fitness Gear Push', 'Increase sales', ids(2, 18), 300, -30, 20, 'paused', 30, 1);
      campaign('Diwali Gifting', 'Increase sales', ids(5, 2), 800, -45, -20, 'completed', 25, 1.3);
      campaign('New Year Wearables', 'Launch a new product', ids(2, 1), 500, 12, 40, 'scheduled', 0, 1);
      campaign('Stationery Clearance', 'Clear slow-moving stock', ids(1, 14), 250, 3, 17, 'draft', 0, 1);

      /* Support tickets */
      const ticket = (daysAgo, category, subject, description, status, related, replies) => {
        setClock(isoDaysAgo(daysAgo, 12));
        const cat = TICKET_CATEGORIES[category];
        const createdAt = nowIso();
        const id = insert('support_tickets', { seller_id: sellerId, code: nextCode('TKT', 8000), category, related_type: related ? related[0] : null, related_ref: related ? related[1] : null, subject, description, assigned_team: cat.team, priority: cat.priority, status, created_by: owner.name, is_demo: 1, created_at: createdAt, updated_at: createdAt });
        insert('ticket_messages', { seller_id: sellerId, ticket_id: id, author_type: 'seller', author_name: owner.name, body: description, created_at: createdAt });
        (replies || []).forEach(([who, body], n) => {
          const at = new Date(Date.parse(createdAt) + (n + 1) * 5 * 3600000).toISOString();
          insert('ticket_messages', { seller_id: sellerId, ticket_id: id, author_type: who === 'me' ? 'seller' : 'support', author_name: who === 'me' ? owner.name : `${who} · ${cat.team} (DEMO reply)`, body, created_at: at });
          run('UPDATE support_tickets SET updated_at = ? WHERE id = ?', at, id);
        });
      };
      const someOrder = (n) => { const o = all('SELECT code FROM orders WHERE seller_id = ? ORDER BY placed_at DESC LIMIT 30', sellerId)[n]; return o ? ['order', o.code] : null; };
      const someProduct = (n) => { const p = all('SELECT code FROM products WHERE seller_id = ? ORDER BY id LIMIT 30', sellerId)[n]; return p ? ['product', p.code] : null; };
      ticket(1, 'payment', 'Settlement shows awaiting payout for over a week', 'The latest settlement statement has not been paid out to my bank account. Please confirm the expected payout date.', 'open', null, []);
      ticket(2, 'listing', 'Sunglasses listing failed quality check', 'My UV Protection Sunglasses listing failed the quality check. I would like to understand what needs to be changed before I resubmit.', 'in_progress', someProduct(26), [['Aditi', 'Thanks for writing in. The listing has no product image. Please add at least one clear image on a white background and resubmit.']]);
      ticket(3, 'order', 'Customer not reachable for delivery', 'The delivery attempt for this order failed because the customer was not available. Should I re-attempt or wait for the customer to respond?', 'waiting_for_seller', someOrder(13), [['Rahul', 'Please confirm whether you want a re-attempt tomorrow or the package returned to your pickup location.']]);
      ticket(5, 'return', 'Returned product received in damaged condition', 'A returned product arrived damaged and cannot be resold. I want to know how the refund deduction will be handled in this case.', 'in_progress', null, [['Farah', 'We have asked for photos of the returned unit. Please attach them here so that the claim can be assessed.'], ['me', 'Photos shared by email as the file is larger than the upload limit.']]);
      ticket(7, 'account', 'Update registered business address', 'We have moved our registered office. Please let me know which documents are needed to update the address on our GST profile here.', 'resolved', null, [['Vivek', 'You can update the address under Settings → Business profile. If the GSTIN has changed as well, re-enter the PAN so that the two can be matched.']]);
      ticket(9, 'technical', 'Bulk upload template columns', 'I need to upload around 200 products. Which columns are mandatory in the CSV template and is there a row limit per file?', 'resolved', null, [['Aditi', 'Title and SKU are mandatory. Each file can contain up to 500 rows, and imported listings are saved as drafts for you to review.']]);
      ticket(12, 'payment', 'Clarification on shipping fee slabs', 'I would like a breakdown of how shipping fees are calculated for packages above 500 g so that I can price my heavier products correctly.', 'closed', null, [['Neeraj', 'Shipping is charged per 500 g slab on the package weight saved on each listing. The fee appears as a separate ledger line for every delivered order.']]);
      ticket(15, 'order', 'Order cancelled after packing', 'One of my orders was cancelled after I had packed it. Please confirm that the reserved stock has been released back to my inventory.', 'closed', someOrder(20), [['Rahul', 'Confirmed. Cancelling before dispatch releases the reservation automatically, and the movement is visible in your stock history.']]);
      ticket(18, 'listing', 'Adding size variants to an existing listing', 'I want to add size variants to an existing shirt listing without losing its order history. Is that possible from the edit screen?', 'resolved', someProduct(4), [['Aditi', 'Yes. Open the listing, choose Edit and add variants in the Inventory section. Existing order history stays with the listing.']]);
      ticket(22, 'technical', 'Team member cannot see payments', 'I invited a colleague as Order manager but she cannot open the Payments page. Is this expected for that role?', 'closed', null, [['Vivek', 'Yes, that is expected. Only the Store owner and Finance viewer roles can open Payments. You can change her role under Settings → Team.']]);
      ticket(0.3, 'technical', 'Request: export orders with tax breakup', 'It would help our accountant if the order export had separate CGST, SGST and IGST columns. Please consider adding this to the CSV.', 'open', null, []);

      /* A short, curated notification feed (seeding itself is silent) */
      setClock(null);
      run('DELETE FROM notifications WHERE seller_id = ?', sellerId);
      const note = (minsAgo, type, title, body, link, read) => insert('notifications', { seller_id: sellerId, type, title, body, link, created_at: new Date(Date.now() - minsAgo * 60000).toISOString(), read_at: read ? new Date(Date.now() - minsAgo * 30000).toISOString() : null });
      const newest = all("SELECT code, total FROM orders WHERE seller_id = ? AND status = 'new' ORDER BY placed_at DESC LIMIT 2", sellerId);
      note(2880, 'account', 'Sample data loaded', 'Products, orders, returns, payments, campaigns and tickets marked DEMO DATA were added to this account.', '/seller/dashboard', true);
      note(1300, 'payment', 'Settlement statement recorded', 'A demo settlement was added to your ledger. No bank transfer was made.', '/seller/payments/settlements', true);
      note(900, 'listing', 'Quality check failed: UV Protection Sunglasses', 'Add at least one product image.', '/seller/products?tab=qc_failed', true);
      note(420, 'shipping', 'Failed delivery recorded', 'A shipment could not be delivered. Record a re-attempt or a return to seller.', '/seller/shipping/shipments?tab=failed', false);
      note(180, 'return', 'Return requests awaiting response', 'New return requests need a decision.', '/seller/returns?tab=new', false);
      note(95, 'inventory', 'Out of stock: Ceramic Coffee Mug Set of 4', 'HK-MUG-11 has 0 units available.', '/seller/inventory?status=out_of_stock', false);
      note(60, 'inventory', 'Critically low stock: Cold Pressed Groundnut Oil 1 Litre', 'GRO-OIL-18 has 4 units available (safety stock 10).', '/seller/inventory?status=critical', false);
      newest.forEach((o, i) => note(25 - i * 14, 'order', `New order ${o.code}`, `₹${Math.round(o.total).toLocaleString('en-IN')} · DEMO DATA`, `/seller/orders/${o.code}`, false));
      run('UPDATE sellers SET has_demo_data = 1 WHERE id = ?', sellerId);
      return { products: products.length, orders: created, returns };
    });
  } finally { setClock(null); }
}

/** Create the demo seller account on first start. Skipped in production unless SEED_DEMO=1. */
function seedIfNeeded() {
  const wanted = process.env.SEED_DEMO ? process.env.SEED_DEMO === '1' : process.env.NODE_ENV !== 'production';
  if (!wanted || get('SELECT 1 FROM users WHERE email = ?', DEMO_OWNER.email)) return false;
  const started = Date.now();
  const created = isoDaysAgo(80, 10);
  const { sellerId, owner } = tx(() => {
    const userId = insert('users', { email: DEMO_OWNER.email, password_hash: hashPassword(DEMO_OWNER.password), name: DEMO_OWNER.name, mobile: DEMO_OWNER.mobile, email_verified_at: created, created_at: created });
    const id = insert('sellers', {
      code: nextCode('SLR', 5000), owner_user_id: userId, store_name: 'Green Basket Market', business_name: 'Green Basket Retail LLP', business_type: 'Limited liability partnership', status: 'approved',
      status_note: 'DEMO DATA: this sample account was created as approved. No KYC was performed.', onboarding_submitted_at: created,
      store_description: 'A neighbourhood store from Hauz Khas, New Delhi, selling everyday electronics, home, fashion and grocery essentials.', contact_email: 'care@greenbasket.demo', contact_phone: '9810012345', created_at: created,
    });
    insert('seller_team_members', { seller_id: id, user_id: userId, role: 'owner', status: 'active', created_at: created });
    insert('seller_business_profiles', { seller_id: id, legal_name: 'Green Basket Retail LLP', business_type: 'Limited liability partnership', gstin: '07AAKFG4521M1Z6', pan_enc: encrypt('AAKFG4521M'), pan_last4: '521M', address: '12 Aurobindo Market, Hauz Khas', city: 'New Delhi', state: 'Delhi', pincode: '110016', updated_at: created });
    insert('seller_pickup_locations', { seller_id: id, name: 'Hauz Khas dispatch point', contact_person: DEMO_OWNER.name, mobile: DEMO_OWNER.mobile, address: '12 Aurobindo Market, Hauz Khas', city: 'New Delhi', state: 'Delhi', pincode: '110016', is_default: 1, created_at: created });
    insert('seller_pickup_locations', { seller_id: id, name: 'Okhla storage unit', contact_person: 'Deepak Rawat', mobile: '9810067890', address: 'B-41 Okhla Industrial Area Phase 2', city: 'New Delhi', state: 'Delhi', pincode: '110020', is_default: 0, created_at: created });
    insert('seller_bank_accounts', { seller_id: id, holder_name: 'Green Basket Retail LLP', bank_name: 'Demo Bank of India', account_enc: encrypt('000012345678'), account_last4: '5678', ifsc: 'DEMO0000001', verification_status: 'unverified', updated_at: created });
    run('UPDATE sellers SET package_settings = ? WHERE id = ?', JSON.stringify({ default_weight_g: 500, default_length_cm: 25, default_width_cm: 20, default_height_cm: 10, packaging_type: 'Corrugated box', fragile_handling: false }), id);
    for (const member of DEMO_TEAM) {
      const memberId = insert('users', { email: member.email, password_hash: hashPassword(TEAM_PASSWORD), name: member.name, email_verified_at: created, created_at: created });
      insert('seller_team_members', { seller_id: id, user_id: memberId, role: member.role, status: 'active', invited_by: userId, created_at: created });
    }
    return { sellerId: id, owner: { id: userId, name: DEMO_OWNER.name } };
  });
  const result = seedDemoData(sellerId, owner);
  console.log(`[nearbuy] Demo seller created (${DEMO_OWNER.email} / ${DEMO_OWNER.password}) with ${result.products} products and ${result.orders} orders in ${Date.now() - started} ms. All records are flagged DEMO DATA.`);
  return true;
}

// Seller-triggered: add the demo data set to an otherwise empty account.
const { route } = require('./router');
route('POST', '/api/demo/load', { perm: 'settings.manage' }, (ctx) => {
  if (ctx.seller.has_demo_data) throw new (require('./lib').HttpError)(409, 'Sample data has already been loaded into this account.');
  const result = seedDemoData(ctx.sellerId, { id: ctx.user.id, name: ctx.user.name });
  return { ok: true, ...result, message: `Sample data loaded: ${result.products} products, ${result.orders} orders and ${result.returns} returns, all marked DEMO DATA.` };
});

// Lets the sign-in page offer the demo credentials. Never enabled in production.
route('GET', '/api/public-config', { auth: 'public' }, () => {
  const demo = process.env.NODE_ENV !== 'production' && get('SELECT 1 FROM users WHERE email = ?', DEMO_OWNER.email)
    ? { email: DEMO_OWNER.email, password: DEMO_OWNER.password, team: DEMO_TEAM.map((m) => ({ email: m.email, role: m.role })), team_password: TEAM_PASSWORD } : null;
  return { demo, mail_configured: Boolean(process.env.SMTP_HOST), business_types: require('./lib').BUSINESS_TYPES };
});

module.exports = { seedIfNeeded, seedDemoData, DEMO_OWNER, DEMO_TEAM, TEAM_PASSWORD };
