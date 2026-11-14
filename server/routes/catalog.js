'use strict';
// Products, images, variants, inventory and warehouses.
const fs = require('node:fs');
const path = require('node:path');
const { route, reply } = require('../router');
const { get, all, run, tx, insert, update, nextCode, parseJson, paged, notify, logActivity } = require('../db');
const { DATA_DIR, HttpError, bad, notFound, conflict, nowIso, r2, validate, toCsv, parseCsv, randomToken, PATTERNS, CATEGORIES, GST_RATES } = require('../lib');
const { moveStock, STOCK_STATUS_SQL } = require('../stock');

const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const LISTING_STATUSES = ['draft', 'pending_approval', 'active', 'inactive', 'qc_failed', 'rejected'];
const TAX_CATEGORIES = ['Taxable goods', 'Nil rated', 'Exempt goods'];
// Auto-approval is a demo convenience: on by default in development, and only on in production when asked for explicitly.
const autoReview = () => (process.env.DEMO_AUTO_REVIEW ? process.env.DEMO_AUTO_REVIEW === '1' : process.env.NODE_ENV !== 'production');

const CATEGORY_ATTRIBUTES = {
  Electronics: [
    { key: 'warranty', label: 'Warranty', type: 'text', required: true, placeholder: '1 year manufacturer warranty' },
    { key: 'connectivity', label: 'Connectivity', type: 'select', options: ['Bluetooth', 'Wired', 'Wi-Fi', 'USB', 'Not applicable'] },
    { key: 'power_source', label: 'Power source', type: 'select', options: ['Rechargeable battery', 'Replaceable battery', 'Mains', 'USB powered', 'Not applicable'] },
  ],
  Fashion: [
    { key: 'fabric', label: 'Fabric', type: 'text', required: true, placeholder: '100% cotton' },
    { key: 'fit', label: 'Fit', type: 'select', options: ['Regular', 'Slim', 'Relaxed', 'Oversized', 'Not applicable'] },
    { key: 'care', label: 'Care instructions', type: 'text', placeholder: 'Machine wash cold' },
  ],
  'Home and Kitchen': [
    { key: 'capacity', label: 'Capacity / size', type: 'text', placeholder: '1 litre' },
    { key: 'pack_contents', label: 'Pack contents', type: 'text', required: true, placeholder: '1 bottle, 1 lid' },
    { key: 'dishwasher_safe', label: 'Dishwasher safe', type: 'select', options: ['Yes', 'No', 'Not applicable'] },
  ],
  Beauty: [
    { key: 'skin_type', label: 'Suitable for', type: 'select', options: ['All skin types', 'Dry', 'Oily', 'Sensitive', 'Combination', 'Not applicable'] },
    { key: 'shelf_life_months', label: 'Shelf life (months)', type: 'number', required: true },
    { key: 'ingredients', label: 'Key ingredients', type: 'text' },
  ],
  Grocery: [
    { key: 'shelf_life_days', label: 'Shelf life (days)', type: 'number', required: true },
    { key: 'diet', label: 'Dietary type', type: 'select', required: true, options: ['Vegetarian', 'Non-vegetarian', 'Vegan'] },
    { key: 'fssai_licence', label: 'FSSAI licence number', type: 'text', placeholder: '14-digit licence number' },
  ],
  Books: [
    { key: 'author', label: 'Author', type: 'text', required: true },
    { key: 'publisher', label: 'Publisher', type: 'text' },
    { key: 'language', label: 'Language', type: 'select', options: ['English', 'Hindi', 'Bengali', 'Tamil', 'Telugu', 'Marathi', 'Other'] },
    { key: 'isbn', label: 'ISBN', type: 'text' },
  ],
  Toys: [
    { key: 'age_group', label: 'Age group', type: 'select', required: true, options: ['0–2 years', '3–5 years', '6–8 years', '9–12 years', '12+ years'] },
    { key: 'battery_required', label: 'Batteries required', type: 'select', options: ['Yes', 'No'] },
  ],
  Sports: [
    { key: 'sport', label: 'Sport / activity', type: 'text', required: true, placeholder: 'Yoga' },
    { key: 'skill_level', label: 'Skill level', type: 'select', options: ['Beginner', 'Intermediate', 'Advanced', 'All levels'] },
  ],
  Accessories: [
    { key: 'ideal_for', label: 'Ideal for', type: 'select', required: true, options: ['Men', 'Women', 'Unisex', 'Kids'] },
    { key: 'warranty', label: 'Warranty', type: 'text', placeholder: '6 months' },
  ],
};

function ensureWarehouse(sellerId) {
  const existing = get('SELECT * FROM warehouses WHERE seller_id = ? ORDER BY id LIMIT 1', sellerId);
  if (existing) return existing;
  const pickup = get('SELECT * FROM seller_pickup_locations WHERE seller_id = ? ORDER BY is_default DESC, id LIMIT 1', sellerId);
  const id = insert('warehouses', {
    seller_id: sellerId, code: 'WH-01', name: pickup ? pickup.name : 'Primary warehouse', pickup_location_id: pickup ? pickup.id : null,
    city: pickup ? pickup.city : null, pincode: pickup ? pickup.pincode : null, created_at: nowIso(),
  });
  return get('SELECT * FROM warehouses WHERE id = ?', id);
}

/* ---------- Uploads ---------- */
function sniff(buf) {
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { mime: 'image/png', ext: 'png' };
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  if (buf.length > 5 && buf.toString('ascii', 0, 5) === '%PDF-') return { mime: 'application/pdf', ext: 'pdf' };
  return null;
}
const UPLOAD_KINDS = {
  product_image: { perm: 'products.write', max: 2 * 1024 * 1024, types: ['image/png', 'image/jpeg', 'image/webp'] },
  logo: { perm: 'settings.manage', max: 1024 * 1024, types: ['image/png', 'image/jpeg', 'image/webp'] },
  attachment: { perm: 'support.use', max: 3 * 1024 * 1024, types: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'] },
};
function storeUpload(sellerId, userId, kind, buf, mime, ext, originalName) {
  const dir = path.join(UPLOAD_DIR, String(sellerId));
  fs.mkdirSync(dir, { recursive: true });
  const file = `${randomToken(12)}.${ext}`;
  fs.writeFileSync(path.join(dir, file), buf);
  return insert('uploads', { seller_id: sellerId, user_id: userId, kind, mime, size: buf.length, file, original_name: originalName || null, created_at: nowIso() });
}
route('POST', '/api/uploads', { raw: true, limit: 3 * 1024 * 1024 + 1024 }, (ctx) => {
  const kind = UPLOAD_KINDS[ctx.query.kind];
  if (!kind) throw bad('Unknown upload type.');
  if (!ctx.can(kind.perm)) throw new HttpError(403, 'Your role does not have permission to upload this file.', { code: 'forbidden' });
  if (!ctx.raw || !ctx.raw.length) throw bad('The file is empty.');
  if (ctx.raw.length > kind.max) throw new HttpError(413, `File is too large. The limit is ${kind.max / 1024 / 1024} MB.`);
  const type = sniff(ctx.raw);
  if (!type || !kind.types.includes(type.mime)) throw bad(ctx.query.kind === 'attachment' ? 'Only JPG, PNG, WebP or PDF files are accepted.' : 'Only JPG, PNG or WebP images are accepted.');
  const count = get("SELECT COUNT(*) AS n FROM uploads WHERE seller_id = ? AND created_at > ?", ctx.sellerId, new Date(Date.now() - 3600000).toISOString()).n;
  if (count > 300) throw new HttpError(429, 'Upload limit reached. Please try again later.');
  const id = storeUpload(ctx.sellerId, ctx.user.id, ctx.query.kind, ctx.raw, type.mime, type.ext, String(ctx.query.name || '').slice(0, 120));
  return reply.created({ id, mime: type.mime, size: ctx.raw.length, name: String(ctx.query.name || '').slice(0, 120) });
});
route('GET', '/api/uploads/:id', (ctx) => {
  const row = get('SELECT * FROM uploads WHERE id = ? AND seller_id = ?', Number(ctx.params.id), ctx.sellerId);
  if (!row) throw notFound('File');
  const file = path.join(UPLOAD_DIR, String(row.seller_id), path.basename(row.file));
  if (!fs.existsSync(file)) throw notFound('File');
  return reply.bytes(row.mime, fs.readFileSync(file), 'private, max-age=86400');
});

/* ---------- Catalogue metadata ---------- */
route('GET', '/api/meta/catalog', (ctx) => {
  ensureWarehouse(ctx.sellerId);
  return {
    categories: CATEGORIES, category_attributes: CATEGORY_ATTRIBUTES, gst_rates: GST_RATES, tax_categories: TAX_CATEGORIES,
    warehouses: all('SELECT id, code, name, city, pincode FROM warehouses WHERE seller_id = ? ORDER BY id', ctx.sellerId),
    low_stock_default: ctx.seller.low_stock_default, auto_review: autoReview(),
  };
});

/* ---------- Product helpers ---------- */
const STOCK_JOIN = `LEFT JOIN (SELECT product_id, SUM(on_hand - reserved) AS available, SUM(reserved) AS reserved, SUM(on_hand) AS on_hand, MIN(safety_stock) AS safety_stock
  FROM inventory WHERE seller_id = ? GROUP BY product_id) s ON s.product_id = p.id`;
const LIST_SELECT = `p.id, p.code, p.title, p.sku, p.category, p.brand, p.price, p.mrp, p.status, p.is_demo, p.updated_at, p.created_at,
  COALESCE(s.available, 0) AS available, COALESCE(s.reserved, 0) AS reserved,
  (SELECT upload_id FROM product_images WHERE product_id = p.id ORDER BY is_primary DESC, position LIMIT 1) AS image_id,
  (SELECT COUNT(*) FROM product_variants WHERE product_id = p.id) AS variant_count`;

function findProduct(sellerId, code) {
  const p = get('SELECT * FROM products WHERE code = ? AND seller_id = ?', code, sellerId);
  if (!p) throw notFound('Product');
  return p;
}
function productDetail(sellerId, p) {
  const inv = all('SELECT * FROM inventory WHERE product_id = ? AND seller_id = ? ORDER BY id', p.id, sellerId);
  const variants = all('SELECT * FROM product_variants WHERE product_id = ? AND seller_id = ? ORDER BY id', p.id, sellerId).map((v) => {
    const row = inv.find((i) => i.variant_id === v.id) || { on_hand: 0, reserved: 0 };
    return { id: v.id, sku: v.sku, size: v.size, colour: v.colour, price: v.price, available: row.on_hand - row.reserved, reserved: row.reserved, quantity: row.on_hand - row.reserved };
  });
  const totals = inv.reduce((a, i) => ({ on_hand: a.on_hand + i.on_hand, reserved: a.reserved + i.reserved }), { on_hand: 0, reserved: 0 });
  const sold = get(`SELECT COALESCE(SUM(oi.qty), 0) AS units, COALESCE(SUM(oi.line_total), 0) AS revenue FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE oi.product_id = ? AND oi.seller_id = ? AND o.status != 'cancelled'`, p.id, sellerId);
  return {
    code: p.code, title: p.title, category: p.category, brand: p.brand, description: p.description, highlights: parseJson(p.highlights, []),
    model_number: p.model_number, sku: p.sku, specs: parseJson(p.specs, {}), attributes: parseJson(p.attributes, {}), mrp: p.mrp, price: p.price,
    discount_pct: p.mrp && p.price ? Math.round((1 - p.price / p.mrp) * 100) : 0, tax_category: p.tax_category, gst_rate: p.gst_rate,
    package: parseJson(p.package, {}), dispatch_days: p.dispatch_days, warehouse_id: p.warehouse_id, status: p.status, qc_notes: parseJson(p.qc_notes, []),
    is_demo: Boolean(p.is_demo), created_at: p.created_at, updated_at: p.updated_at,
    images: all('SELECT upload_id, is_primary FROM product_images WHERE product_id = ? AND seller_id = ? ORDER BY is_primary DESC, position', p.id, sellerId).map((i) => ({ upload_id: i.upload_id, is_primary: Boolean(i.is_primary) })),
    variants,
    stock: { available: totals.on_hand - totals.reserved, reserved: totals.reserved, on_hand: totals.on_hand, safety_stock: inv.length ? inv[0].safety_stock : null },
    quantity: totals.on_hand - totals.reserved,
    sales: { units: sold.units, revenue: r2(sold.revenue) },
  };
}

/** Automated listing quality check. Returns a list of problems; empty means the listing passed. */
function qualityCheck(p, imageCount) {
  const notes = [];
  if (imageCount < 1) notes.push('Add at least one product image.');
  if ((p.title || '').length < 15) notes.push('Product title should be at least 15 characters and describe the item clearly.');
  if ((p.description || '').length < 60) notes.push('Description should be at least 60 characters.');
  if ((p.highlights || []).length < 2) notes.push('Add at least two highlights.');
  if (p.mrp && p.price && p.price < p.mrp * 0.1) notes.push('Selling price is more than 90% below MRP. Check the pricing.');
  if (/(best|cheapest|no\.?\s*1|guaranteed)/i.test(p.title || '')) notes.push('Remove unverifiable claims such as "best", "cheapest" or "guaranteed" from the title.');
  return notes;
}

function readProductPayload(ctx, body, strict, existing) {
  const s = (rule) => ({ ...rule, required: strict ? rule.required : false });
  const errors = {}; // every problem is collected so the seller sees all of them in one go
  const base = validate(body, {
    title: { required: true, min: strict ? 10 : 3, max: 150, label: 'Product title' },
    sku: { required: true, format: 'sku', label: 'Seller SKU' },
    category: s({ required: true, enum: CATEGORIES }),
    brand: s({ required: true, max: 60 }),
    description: s({ required: true, min: strict ? 30 : 0, max: 3000 }),
    highlights: { type: 'array', of: 'string', max: 8, itemMax: 160 },
    model_number: { max: 60, label: 'Model number' },
    specs: { type: 'object' }, attributes: { type: 'object' }, package: { type: 'object' },
    mrp: s({ type: 'number', required: true, min: 1, max: 10000000, label: 'MRP' }),
    price: s({ type: 'number', required: true, min: 1, max: 10000000, label: 'Selling price' }),
    tax_category: { enum: TAX_CATEGORIES, default: 'Taxable goods', label: 'Tax category' },
    gst_rate: { type: 'number', default: 18, label: 'GST rate' },
    quantity: { type: 'int', min: 0, max: 1000000 },
    safety_stock: { type: 'int', min: 0, max: 100000, label: 'Safety stock' },
    warehouse_id: { type: 'int' },
    dispatch_days: { type: 'int', min: 1, max: 7, default: 2, label: 'Dispatch time' },
    image_ids: { type: 'array', of: 'int', max: 8, label: 'Images' },
    primary_image_id: { type: 'int' },
    variants: { type: 'array', max: 30 },
  }, { into: errors });
  base.sku = base.sku || '';
  if (!errors.gst_rate && !GST_RATES.includes(base.gst_rate)) errors.gst_rate = 'Choose a valid GST rate.';
  if (base.tax_category !== 'Taxable goods') base.gst_rate = 0;
  if (base.mrp != null && base.price != null && base.price > base.mrp) errors.price = 'Selling price cannot be higher than MRP.';

  const specs = validate(base.specs || {}, {
    dimensions: { max: 60 }, weight: { max: 30 }, colour: { max: 40 }, material: { max: 60 }, size: { max: 40 },
    manufacturer: s({ required: true, max: 120 }), country_of_origin: s({ required: true, max: 60, label: 'Country of origin' }), hsn_code: { max: 8, label: 'HSN code' },
  }, { into: errors, prefix: 'specs.' });
  if (specs.hsn_code && !/^\d{4,8}$/.test(specs.hsn_code)) errors['specs.hsn_code'] = 'HSN code must be 4 to 8 digits.';
  const pkg = validate(base.package || {}, {
    weight_g: s({ type: 'int', required: true, min: 1, max: 50000, label: 'Package weight' }),
    length_cm: s({ type: 'number', required: true, min: 1, max: 300, label: 'Length' }),
    width_cm: s({ type: 'number', required: true, min: 1, max: 300, label: 'Width' }),
    height_cm: s({ type: 'number', required: true, min: 1, max: 300, label: 'Height' }),
  }, { into: errors, prefix: 'package.' });
  const attributes = {};
  for (const def of CATEGORY_ATTRIBUTES[base.category] || []) {
    let val = (base.attributes || {})[def.key];
    val = val === undefined || val === null ? '' : String(val).trim().slice(0, 160);
    if (!val) { if (strict && def.required) errors[`attributes.${def.key}`] = `${def.label} is required for ${base.category}.`; continue; }
    if (def.type === 'select' && !def.options.includes(val)) { errors[`attributes.${def.key}`] = `Choose a valid ${def.label.toLowerCase()}.`; continue; }
    if (def.type === 'number' && !(Number(val) > 0)) { errors[`attributes.${def.key}`] = `${def.label} must be a positive number.`; continue; }
    attributes[def.key] = val;
  }

  const variants = [];
  const seen = new Set();
  (base.variants || []).forEach((raw, idx) => {
    const v = raw && typeof raw === 'object' ? raw : {};
    const sku = String(v.sku || '').trim();
    const size = String(v.size || '').trim().slice(0, 30);
    const colour = String(v.colour || '').trim().slice(0, 30);
    const qty = Number(v.quantity === '' || v.quantity == null ? 0 : v.quantity);
    const price = v.price === '' || v.price == null ? null : Number(v.price);
    if (!PATTERNS.sku.test(sku)) errors[`variants.${idx}.sku`] = 'Enter a valid variant SKU.';
    else if (seen.has(sku.toLowerCase()) || sku.toLowerCase() === base.sku.toLowerCase()) errors[`variants.${idx}.sku`] = 'Each variant needs its own unique SKU.';
    if (!size && !colour) errors[`variants.${idx}.size`] = 'Give the variant a size or a colour.';
    if (!Number.isInteger(qty) || qty < 0) errors[`variants.${idx}.quantity`] = 'Quantity must be a whole number, 0 or more.';
    if (price !== null && (!Number.isFinite(price) || price < 1 || (base.mrp && price > base.mrp))) errors[`variants.${idx}.price`] = 'Variant price must be between ₹1 and the MRP.';
    seen.add(sku.toLowerCase());
    variants.push({ id: Number(v.id) || null, sku, size, colour, price: price === null ? null : r2(price), quantity: qty });
  });
  if (strict && !variants.length && base.quantity == null && !existing) errors.quantity = 'Quantity is required.';

  // SKU must be unique for this seller across products and variants.
  const skus = [base.sku, ...variants.map((v) => v.sku)];
  const productId = existing ? existing.id : 0;
  skus.forEach((sku, idx) => {
    if (!sku) return;
    const clash = get('SELECT id FROM products WHERE seller_id = ? AND sku = ? COLLATE NOCASE AND id != ?', ctx.sellerId, sku, productId)
      || get('SELECT id FROM inventory WHERE seller_id = ? AND sku = ? COLLATE NOCASE AND product_id != ?', ctx.sellerId, sku, productId);
    if (clash) errors[idx === 0 ? 'sku' : `variants.${idx - 1}.sku`] = `SKU ${sku} is already used by another listing.`;
  });

  let warehouse = base.warehouse_id ? get('SELECT * FROM warehouses WHERE id = ? AND seller_id = ?', base.warehouse_id, ctx.sellerId) : null;
  if (base.warehouse_id && !warehouse) errors.warehouse_id = 'Choose one of your warehouses.';
  if (!warehouse) warehouse = ensureWarehouse(ctx.sellerId);

  const imageIds = [...new Set(base.image_ids || [])];
  for (const id of imageIds) {
    if (!get("SELECT id FROM uploads WHERE id = ? AND seller_id = ? AND kind = 'product_image'", id, ctx.sellerId)) { errors.image_ids = 'One of the images could not be found. Upload it again.'; break; }
  }
  if (Object.keys(errors).length) throw bad('Please correct the highlighted fields.', errors);
  return { base, specs, pkg, attributes, variants, warehouse, imageIds, primaryImageId: imageIds.includes(base.primary_image_id) ? base.primary_image_id : imageIds[0] || null };
}

function reconcileInventory(ctx, productId, data, isNew) {
  const { base, variants, warehouse } = data;
  const actor = ctx.user.name;
  const safety = base.safety_stock != null ? base.safety_stock : null;
  const defaultSafety = safety != null ? safety : ctx.seller.low_stock_default;
  const rows = all('SELECT * FROM inventory WHERE product_id = ? AND seller_id = ?', productId, ctx.sellerId);
  const setAvailable = (inv, qty, reason) => {
    const delta = qty - (inv.on_hand - inv.reserved);
    if (delta) moveStock(ctx.sellerId, inv.id, { onHandDelta: delta, kind: 'adjustment', reason, ref: base.sku, actor });
  };
  const createRow = (sku, variantId, qty) => {
    const id = insert('inventory', { seller_id: ctx.sellerId, product_id: productId, variant_id: variantId, warehouse_id: warehouse.id, sku, on_hand: 0, reserved: 0, safety_stock: defaultSafety, updated_at: nowIso() });
    if (qty > 0) moveStock(ctx.sellerId, id, { onHandDelta: qty, kind: 'initial', reason: 'Opening stock', actor, quiet: true });
  };
  const removeRow = (inv) => {
    if (inv.reserved > 0) throw conflict(`SKU ${inv.sku} has ${inv.reserved} unit(s) reserved for open orders and cannot be removed yet.`);
    run('DELETE FROM inventory WHERE id = ? AND seller_id = ?', inv.id, ctx.sellerId);
  };
  const baseRow = rows.find((r) => r.variant_id == null);
  if (variants.length) {
    if (baseRow) removeRow(baseRow);
    const existing = all('SELECT * FROM product_variants WHERE product_id = ? AND seller_id = ?', productId, ctx.sellerId);
    const keep = new Set();
    for (const v of variants) {
      const current = v.id ? existing.find((e) => e.id === v.id) : null;
      if (current) {
        keep.add(current.id);
        run('UPDATE product_variants SET sku = ?, size = ?, colour = ?, price = ? WHERE id = ? AND seller_id = ?', v.sku, v.size, v.colour, v.price, current.id, ctx.sellerId);
        const inv = rows.find((r) => r.variant_id === current.id);
        if (inv) {
          run('UPDATE inventory SET sku = ?, warehouse_id = ? WHERE id = ?', v.sku, warehouse.id, inv.id);
          setAvailable(inv, v.quantity, 'Edited on listing');
        } else createRow(v.sku, current.id, v.quantity);
      } else {
        const variantId = insert('product_variants', { seller_id: ctx.sellerId, product_id: productId, sku: v.sku, size: v.size, colour: v.colour, price: v.price });
        createRow(v.sku, variantId, v.quantity);
      }
    }
    for (const old of existing) {
      if (keep.has(old.id)) continue;
      const inv = rows.find((r) => r.variant_id === old.id);
      if (inv) removeRow(inv);
      run('DELETE FROM product_variants WHERE id = ? AND seller_id = ?', old.id, ctx.sellerId);
    }
  } else {
    for (const inv of rows.filter((r) => r.variant_id != null)) removeRow(inv);
    run('DELETE FROM product_variants WHERE product_id = ? AND seller_id = ?', productId, ctx.sellerId);
    if (baseRow) {
      run('UPDATE inventory SET sku = ?, warehouse_id = ? WHERE id = ?', base.sku, warehouse.id, baseRow.id);
      if (base.quantity != null) setAvailable(baseRow, base.quantity, 'Edited on listing');
    } else createRow(base.sku, null, base.quantity || 0);
  }
  if (safety != null && !isNew) run('UPDATE inventory SET safety_stock = ? WHERE product_id = ? AND seller_id = ?', safety, productId, ctx.sellerId);
}

/** Decide the listing status after a submit. */
function submitForReview(ctx, product, imageCount) {
  const notes = qualityCheck({ ...product, highlights: parseJson(product.highlights, []) }, imageCount);
  if (notes.length) {
    run("UPDATE products SET status = 'qc_failed', qc_notes = ?, updated_at = ? WHERE id = ?", JSON.stringify(notes), nowIso(), product.id);
    notify(ctx.sellerId, 'listing', `Quality check failed: ${product.title}`, notes[0], `/seller/products/${product.code}`);
    return { status: 'qc_failed', qc_notes: notes, message: 'Saved, but the listing did not pass the automated quality check. Fix the listed issues and submit again.' };
  }
  if (autoReview() && !product.is_demo) {
    run("UPDATE products SET status = 'active', qc_notes = '[]', updated_at = ? WHERE id = ?", nowIso(), product.id);
    notify(ctx.sellerId, 'listing', `Listing is live: ${product.title}`, 'Approved automatically — demo review mode is on, so no human catalogue review took place.', `/seller/products/${product.code}`);
    return { status: 'active', qc_notes: [], message: 'Listing submitted and approved automatically (demo review mode — no human catalogue review is connected).' };
  }
  run("UPDATE products SET status = 'pending_approval', qc_notes = '[]', updated_at = ? WHERE id = ?", nowIso(), product.id);
  return { status: 'pending_approval', qc_notes: [], message: 'Listing submitted. It will go live once the marketplace catalogue team approves it.' };
}

function saveProduct(ctx, existing, body) {
  const action = body && body.action === 'submit' ? 'submit' : 'draft';
  // Listings that are already live or awaiting review must stay complete, so they are validated strictly on every save.
  const strict = action === 'submit' || (existing && ['active', 'inactive', 'pending_approval'].includes(existing.status));
  const data = readProductPayload(ctx, body, strict, existing);
  const { base } = data;
  return tx(() => {
    const fields = {
      title: base.title, category: base.category, brand: base.brand, description: base.description, highlights: base.highlights || [],
      model_number: base.model_number, sku: base.sku, specs: data.specs, attributes: data.attributes, mrp: base.mrp, price: base.price,
      tax_category: base.tax_category, gst_rate: base.gst_rate, package: data.pkg, dispatch_days: base.dispatch_days, warehouse_id: data.warehouse.id,
      updated_at: nowIso(),
    };
    let productId;
    let code;
    if (existing) {
      update('products', ctx.sellerId, existing.id, fields);
      productId = existing.id; code = existing.code;
    } else {
      code = nextCode('PRD', 10000);
      productId = insert('products', { seller_id: ctx.sellerId, code, status: 'draft', created_at: nowIso(), ...fields });
    }
    reconcileInventory(ctx, productId, data, !existing);
    run('DELETE FROM product_images WHERE product_id = ? AND seller_id = ?', productId, ctx.sellerId);
    data.imageIds.forEach((uploadId, position) => insert('product_images', { seller_id: ctx.sellerId, product_id: productId, upload_id: uploadId, is_primary: uploadId === data.primaryImageId ? 1 : 0, position }));

    const saved = get('SELECT * FROM products WHERE id = ?', productId);
    let outcome = { status: saved.status, message: existing ? 'Changes saved.' : 'Draft saved.' };
    if (action === 'submit' || ['active', 'inactive'].includes(saved.status)) {
      if (['draft', 'qc_failed', 'rejected', 'pending_approval'].includes(saved.status)) outcome = submitForReview(ctx, saved, data.imageIds.length);
      else {
        // Live listings stay live after an edit only if they still pass the quality check.
        const notes = qualityCheck({ ...saved, highlights: base.highlights || [] }, data.imageIds.length);
        if (notes.length) {
          run("UPDATE products SET status = 'qc_failed', qc_notes = ? WHERE id = ?", JSON.stringify(notes), productId);
          outcome = { status: 'qc_failed', qc_notes: notes, message: 'Changes saved, but the listing no longer passes the quality check and has been taken offline.' };
        } else outcome = { status: saved.status, message: 'Changes saved to the live listing.' };
      }
    }
    logActivity(ctx, existing ? 'Updated product' : 'Created product', 'product', code, `${base.title} · ${outcome.status}`);
    return { ...outcome, code, product: productDetail(ctx.sellerId, get('SELECT * FROM products WHERE id = ?', productId)) };
  });
}

/* ---------- Product routes ---------- */
function productFilters(ctx) {
  const where = ['p.seller_id = ?'];
  const params = [ctx.sellerId, ctx.sellerId];
  const tab = ctx.query.tab || 'all';
  if (tab === 'out_of_stock') where.push("p.status = 'active' AND COALESCE(s.available, 0) <= 0");
  else if (LISTING_STATUSES.includes(tab)) { where.push('p.status = ?'); params.push(tab); }
  if (ctx.query.category && CATEGORIES.includes(ctx.query.category)) { where.push('p.category = ?'); params.push(ctx.query.category); }
  return { where, params };
}
route('GET', '/api/products', { perm: 'products.read' }, (ctx) => {
  const { where, params } = productFilters(ctx);
  const list = paged({
    select: LIST_SELECT, from: `products p ${STOCK_JOIN}`, where, params,
    search: { q: ctx.query.q, cols: ['p.title', 'p.sku', 'p.code', 'p.brand'] },
    sortMap: { title: 'p.title COLLATE NOCASE', price: 'p.price', stock: 'available', updated: 'p.updated_at', mrp: 'p.mrp' },
    sort: ctx.query.sort, defaultSort: 'p.updated_at DESC', page: ctx.query.page, pageSize: ctx.query.page_size,
  });
  const c = get(`SELECT COUNT(*) AS all_count,
      SUM(p.status = 'active') AS active, SUM(p.status = 'inactive') AS inactive, SUM(p.status = 'pending_approval') AS pending_approval,
      SUM(p.status = 'qc_failed') AS qc_failed, SUM(p.status = 'rejected') AS rejected, SUM(p.status = 'draft') AS draft,
      SUM(p.status = 'active' AND COALESCE(s.available, 0) <= 0) AS out_of_stock
    FROM products p ${STOCK_JOIN} WHERE p.seller_id = ?`, ctx.sellerId, ctx.sellerId);
  return { ...list, counts: { all: c.all_count, active: c.active || 0, inactive: c.inactive || 0, pending_approval: c.pending_approval || 0, qc_failed: c.qc_failed || 0, rejected: c.rejected || 0, out_of_stock: c.out_of_stock || 0, draft: c.draft || 0 } };
});

const EXPORT_HEADERS = [['code', 'Product ID'], ['title', 'Product title'], ['sku', 'Seller SKU'], ['category', 'Category'], ['brand', 'Brand'], ['price', 'Selling price (INR)'], ['mrp', 'MRP (INR)'], ['available', 'Available stock'], ['reserved', 'Reserved stock'], ['status', 'Listing status'], ['updated_at', 'Last updated'], [(r) => (r.is_demo ? 'DEMO DATA' : ''), 'Record type']];
route('GET', '/api/products/export.csv', { perm: 'products.read' }, (ctx) => {
  const { where, params } = productFilters(ctx);
  const list = paged({ select: LIST_SELECT, from: `products p ${STOCK_JOIN}`, where, params, search: { q: ctx.query.q, cols: ['p.title', 'p.sku', 'p.code', 'p.brand'] }, defaultSort: 'p.code', pageSize: 100 });
  let rows = list.rows;
  for (let page = 2; page <= list.pages && page <= 50; page += 1) rows = rows.concat(paged({ select: LIST_SELECT, from: `products p ${STOCK_JOIN}`, where, params, search: { q: ctx.query.q, cols: ['p.title', 'p.sku', 'p.code', 'p.brand'] }, defaultSort: 'p.code', pageSize: 100, page }).rows);
  logActivity(ctx, 'Exported products', 'product', null, `${rows.length} rows`);
  return reply.csv('nearbuy-products.csv', toCsv(EXPORT_HEADERS, rows));
});

const IMPORT_COLUMNS = ['title', 'sku', 'category', 'brand', 'description', 'highlights', 'mrp', 'price', 'gst_rate', 'quantity', 'model_number', 'colour', 'material', 'size', 'manufacturer', 'country_of_origin', 'package_weight_g', 'length_cm', 'width_cm', 'height_cm', 'dispatch_days'];
route('GET', '/api/products/import-template.csv', { perm: 'products.read' }, () => reply.csv('nearbuy-product-upload-template.csv', toCsv(IMPORT_COLUMNS.map((c) => [c, c]), [{
  title: 'Handwoven Cotton Table Runner 180 cm', sku: 'HOME-RUNNER-180', category: 'Home and Kitchen', brand: 'Your Brand',
  description: 'Handwoven cotton table runner with a natural finish. Suitable for six-seater dining tables. Machine washable.',
  highlights: 'Handwoven cotton|180 cm x 35 cm|Machine washable', mrp: 899, price: 649, gst_rate: 5, quantity: 40, model_number: 'TR-180',
  colour: 'Natural', material: 'Cotton', size: '180 x 35 cm', manufacturer: 'Your Manufacturer', country_of_origin: 'India',
  package_weight_g: 300, length_cm: 30, width_cm: 20, height_cm: 4, dispatch_days: 2,
}])));

route('POST', '/api/products/import', { perm: 'products.write' }, (ctx) => {
  const { headers, records } = parseCsv(ctx.body.csv);
  if (!records.length) throw bad('The file has no data rows.');
  if (!headers.includes('sku') || !headers.includes('title')) throw bad('The file must have at least "title" and "sku" columns. Download the template for the expected layout.');
  if (records.length > 500) throw bad('Upload at most 500 rows at a time.');
  const result = { created: 0, updated: 0, errors: [] };
  for (const rec of records) {
    const existing = get('SELECT * FROM products WHERE seller_id = ? AND sku = ? COLLATE NOCASE', ctx.sellerId, rec.sku || '');
    const num = (v) => (v === '' || v == null ? undefined : Number(v));
    const body = {
      action: 'draft', title: rec.title, sku: rec.sku, category: rec.category || undefined, brand: rec.brand, description: rec.description,
      highlights: rec.highlights ? rec.highlights.split('|') : [], model_number: rec.model_number, mrp: num(rec.mrp), price: num(rec.price),
      gst_rate: num(rec.gst_rate), quantity: num(rec.quantity), dispatch_days: num(rec.dispatch_days),
      specs: { colour: rec.colour, material: rec.material, size: rec.size, manufacturer: rec.manufacturer, country_of_origin: rec.country_of_origin },
      package: { weight_g: num(rec.package_weight_g), length_cm: num(rec.length_cm), width_cm: num(rec.width_cm), height_cm: num(rec.height_cm) },
    };
    try {
      if (existing) {
        const current = productDetail(ctx.sellerId, existing);
        if (current.variants.length) throw bad('This listing has variants. Edit it in the product form.');
        // Only columns present in the file are changed; everything else is kept.
        const merged = { ...current, image_ids: current.images.map((i) => i.upload_id), primary_image_id: (current.images.find((i) => i.is_primary) || {}).upload_id, action: 'draft', variants: [] };
        for (const key of ['title', 'category', 'brand', 'description', 'model_number', 'mrp', 'price', 'gst_rate', 'quantity', 'dispatch_days']) if (headers.includes(key) && body[key] !== undefined && body[key] !== '') merged[key] = body[key];
        if (headers.includes('highlights') && rec.highlights) merged.highlights = body.highlights;
        for (const key of Object.keys(body.specs)) if (headers.includes(key) && body.specs[key]) merged.specs = { ...merged.specs, [key]: body.specs[key] };
        saveProduct(ctx, existing, merged);
        result.updated += 1;
      } else {
        saveProduct(ctx, null, body);
        result.created += 1;
      }
    } catch (err) {
      if (!(err instanceof HttpError)) throw err;
      const detail = err.extra && err.extra.fields ? Object.values(err.extra.fields).join(' ') : err.message;
      result.errors.push({ line: rec._line, sku: rec.sku || '', message: detail });
    }
  }
  if (result.created || result.updated) notify(ctx.sellerId, 'listing', 'Bulk upload finished', `${result.created} created as drafts, ${result.updated} updated, ${result.errors.length} row(s) with errors.`, '/seller/products?tab=draft');
  return result;
});

route('GET', '/api/products/:code', { perm: 'products.read' }, (ctx) => ({ product: productDetail(ctx.sellerId, findProduct(ctx.sellerId, ctx.params.code)) }));
route('POST', '/api/products', { perm: 'products.write' }, (ctx) => reply.created(saveProduct(ctx, null, ctx.body)));
route('PUT', '/api/products/:code', { perm: 'products.write' }, (ctx) => saveProduct(ctx, findProduct(ctx.sellerId, ctx.params.code), ctx.body));

route('POST', '/api/products/:code/duplicate', { perm: 'products.write' }, (ctx) => {
  const source = findProduct(ctx.sellerId, ctx.params.code);
  return tx(() => {
    let n = 1;
    let sku = `${source.sku}-COPY`.slice(0, 40);
    while (get('SELECT 1 FROM products WHERE seller_id = ? AND sku = ? COLLATE NOCASE', ctx.sellerId, sku) || get('SELECT 1 FROM inventory WHERE seller_id = ? AND sku = ? COLLATE NOCASE', ctx.sellerId, sku)) { n += 1; sku = `${source.sku.slice(0, 32)}-COPY${n}`; }
    const code = nextCode('PRD', 10000);
    const id = insert('products', {
      seller_id: ctx.sellerId, code, title: `${source.title} (copy)`.slice(0, 150), category: source.category, brand: source.brand, description: source.description,
      highlights: source.highlights, model_number: source.model_number, sku, specs: source.specs, attributes: source.attributes, mrp: source.mrp, price: source.price,
      tax_category: source.tax_category, gst_rate: source.gst_rate, package: source.package, dispatch_days: source.dispatch_days, warehouse_id: source.warehouse_id,
      status: 'draft', created_at: nowIso(), updated_at: nowIso(),
    });
    for (const img of all('SELECT * FROM product_images WHERE product_id = ? AND seller_id = ?', source.id, ctx.sellerId)) insert('product_images', { seller_id: ctx.sellerId, product_id: id, upload_id: img.upload_id, is_primary: img.is_primary, position: img.position });
    insert('inventory', { seller_id: ctx.sellerId, product_id: id, variant_id: null, warehouse_id: source.warehouse_id || ensureWarehouse(ctx.sellerId).id, sku, on_hand: 0, reserved: 0, safety_stock: ctx.seller.low_stock_default, updated_at: nowIso() });
    logActivity(ctx, 'Duplicated product', 'product', code, `Copy of ${source.code}`);
    return reply.created({ code, message: 'Duplicate saved as a draft with zero stock. Variants are not copied.' });
  });
});

route('POST', '/api/products/:code/status', { perm: 'products.write' }, (ctx) => {
  const p = findProduct(ctx.sellerId, ctx.params.code);
  const action = ctx.body.action;
  return tx(() => {
    if (action === 'deactivate') {
      if (p.status !== 'active') throw conflict('Only active listings can be deactivated.');
      run("UPDATE products SET status = 'inactive', updated_at = ? WHERE id = ?", nowIso(), p.id);
      logActivity(ctx, 'Deactivated listing', 'product', p.code, p.title);
      return { status: 'inactive', message: 'Listing deactivated. Customers can no longer order it.' };
    }
    if (action === 'activate') {
      if (p.status !== 'inactive') throw conflict('Only inactive listings can be activated. Drafts must be submitted for review first.');
      run("UPDATE products SET status = 'active', updated_at = ? WHERE id = ?", nowIso(), p.id);
      logActivity(ctx, 'Activated listing', 'product', p.code, p.title);
      return { status: 'active', message: 'Listing is active again.' };
    }
    if (action === 'submit') {
      if (!['draft', 'qc_failed', 'rejected'].includes(p.status)) throw conflict('This listing has already been submitted.');
      // Re-run full validation against the stored record before review.
      const detail = productDetail(ctx.sellerId, p);
      const outcome = saveProduct(ctx, p, { ...detail, image_ids: detail.images.map((i) => i.upload_id), primary_image_id: (detail.images.find((i) => i.is_primary) || {}).upload_id, action: 'submit', quantity: detail.variants.length ? undefined : detail.quantity, safety_stock: undefined });
      return { status: outcome.status, qc_notes: outcome.qc_notes, message: outcome.message };
    }
    throw bad('Unknown listing action.');
  });
});

route('PATCH', '/api/products/:code/price', { perm: 'products.write' }, (ctx) => {
  const p = findProduct(ctx.sellerId, ctx.params.code);
  const data = validate(ctx.body, { price: { type: 'number', required: true, min: 1, max: 10000000, label: 'Selling price' }, mrp: { type: 'number', required: true, min: 1, max: 10000000, label: 'MRP' } });
  if (data.price > data.mrp) throw bad('Please correct the highlighted fields.', { price: 'Selling price cannot be higher than MRP.' });
  run('UPDATE products SET price = ?, mrp = ?, updated_at = ? WHERE id = ? AND seller_id = ?', data.price, data.mrp, nowIso(), p.id, ctx.sellerId);
  run('UPDATE product_variants SET price = NULL WHERE product_id = ? AND seller_id = ? AND price > ?', p.id, ctx.sellerId, data.mrp);
  logActivity(ctx, 'Updated price', 'product', p.code, `₹${p.price ?? '—'} → ₹${data.price} (MRP ₹${data.mrp})`);
  return { ok: true, message: 'Price updated.' };
});

route('DELETE', '/api/products/:code', { perm: 'products.write' }, (ctx) => {
  const p = findProduct(ctx.sellerId, ctx.params.code);
  if (!['draft', 'qc_failed', 'rejected'].includes(p.status)) throw conflict('Only drafts, rejected listings and listings that failed the quality check can be deleted. Deactivate a live listing instead.');
  if (get('SELECT 1 FROM order_items WHERE product_id = ? AND seller_id = ?', p.id, ctx.sellerId)) throw conflict('This listing has order history and cannot be deleted.');
  run('DELETE FROM products WHERE id = ? AND seller_id = ?', p.id, ctx.sellerId);
  logActivity(ctx, 'Deleted draft listing', 'product', p.code, p.title);
  return { ok: true, message: 'Listing deleted.' };
});

/* ---------- Inventory ---------- */
const INV_FROM = `inventory i JOIN products p ON p.id = i.product_id LEFT JOIN product_variants v ON v.id = i.variant_id LEFT JOIN warehouses w ON w.id = i.warehouse_id`;
const INV_SELECT = `i.id, i.sku, i.on_hand, i.reserved, (i.on_hand - i.reserved) AS available, i.safety_stock, i.updated_at, p.code AS product_code, p.title, p.status AS listing_status, p.is_demo,
  TRIM(COALESCE(v.size, '') || CASE WHEN v.size != '' AND v.colour != '' THEN ' / ' ELSE '' END || COALESCE(v.colour, '')) AS variant_label,
  w.name AS warehouse, w.id AS warehouse_id, ${STOCK_STATUS_SQL} AS stock_status,
  (SELECT upload_id FROM product_images WHERE product_id = p.id ORDER BY is_primary DESC, position LIMIT 1) AS image_id`;
function inventoryFilters(ctx) {
  const where = ['i.seller_id = ?'];
  const params = [ctx.sellerId];
  if (['healthy', 'low', 'critical', 'out_of_stock'].includes(ctx.query.status)) { where.push(`${STOCK_STATUS_SQL} = ?`); params.push(ctx.query.status); }
  if (ctx.query.status === 'attention') where.push(`${STOCK_STATUS_SQL} != 'healthy'`);
  if (ctx.query.warehouse) { where.push('i.warehouse_id = ?'); params.push(Number(ctx.query.warehouse)); }
  return { where, params };
}
function inventorySummary(sellerId) {
  const s = get(`SELECT COUNT(*) AS skus, COALESCE(SUM(i.on_hand - i.reserved), 0) AS available, COALESCE(SUM(i.reserved), 0) AS reserved,
      SUM(${STOCK_STATUS_SQL} IN ('low', 'critical')) AS low, SUM(${STOCK_STATUS_SQL} = 'critical') AS critical, SUM(${STOCK_STATUS_SQL} = 'out_of_stock') AS out_of_stock,
      SUM(${STOCK_STATUS_SQL} = 'healthy') AS healthy
    FROM inventory i WHERE i.seller_id = ?`, sellerId);
  return { skus: s.skus, available: s.available, reserved: s.reserved, low: s.low || 0, critical: s.critical || 0, out_of_stock: s.out_of_stock || 0, healthy: s.healthy || 0 };
}
route('GET', '/api/inventory', { perm: 'inventory.read' }, (ctx) => {
  const { where, params } = inventoryFilters(ctx);
  const list = paged({
    select: INV_SELECT, from: INV_FROM, where, params, search: { q: ctx.query.q, cols: ['p.title', 'i.sku', 'p.code'] },
    sortMap: { available: 'available', reserved: 'i.reserved', title: 'p.title COLLATE NOCASE', sku: 'i.sku COLLATE NOCASE', safety: 'i.safety_stock', updated: 'i.updated_at' },
    sort: ctx.query.sort, defaultSort: 'available ASC, p.title', page: ctx.query.page, pageSize: ctx.query.page_size,
  });
  return { ...list, summary: inventorySummary(ctx.sellerId), low_stock_default: ctx.seller.low_stock_default, warehouses: all('SELECT id, name FROM warehouses WHERE seller_id = ?', ctx.sellerId) };
});
route('GET', '/api/inventory/export.csv', { perm: 'inventory.read' }, (ctx) => {
  const { where, params } = inventoryFilters(ctx);
  const rows = all(`SELECT ${INV_SELECT} FROM ${INV_FROM} WHERE ${where.join(' AND ')} ORDER BY p.title LIMIT 5000`, ...params);
  logActivity(ctx, 'Exported inventory', 'inventory', null, `${rows.length} rows`);
  return reply.csv('nearbuy-inventory.csv', toCsv([['sku', 'sku'], ['title', 'product'], ['variant_label', 'variant'], ['warehouse', 'warehouse'], ['available', 'available'], ['reserved', 'reserved'], ['safety_stock', 'safety_stock'], ['stock_status', 'status'], ['updated_at', 'updated_at']], rows));
});
route('GET', '/api/inventory/history', { perm: 'inventory.read' }, (ctx) => {
  const where = ['m.seller_id = ?'];
  const params = [ctx.sellerId];
  if (ctx.query.inventory_id) { where.push('m.inventory_id = ?'); params.push(Number(ctx.query.inventory_id)); }
  if (ctx.query.kind) { where.push('m.kind = ?'); params.push(String(ctx.query.kind)); }
  return paged({
    select: 'm.id, m.kind, m.change, m.on_hand_after, m.reserved_after, m.reason, m.ref, m.actor, m.created_at, i.sku, p.title, p.code AS product_code',
    from: 'stock_movements m JOIN inventory i ON i.id = m.inventory_id JOIN products p ON p.id = i.product_id', where, params,
    search: { q: ctx.query.q, cols: ['i.sku', 'p.title', 'm.ref'] }, defaultSort: 'm.id DESC', page: ctx.query.page, pageSize: ctx.query.page_size || 15,
  });
});
route('PATCH', '/api/inventory/:id', { perm: 'inventory.write' }, (ctx) => {
  const row = get('SELECT * FROM inventory WHERE id = ? AND seller_id = ?', Number(ctx.params.id), ctx.sellerId);
  if (!row) throw notFound('Inventory record');
  const data = validate(ctx.body, {
    available: { type: 'int', min: 0, max: 1000000, label: 'Available quantity' },
    safety_stock: { type: 'int', min: 0, max: 100000, label: 'Safety stock' },
    reason: { max: 160 },
  }, { partial: true });
  if (data.available === undefined && data.safety_stock === undefined) throw bad('Nothing to update.');
  return tx(() => {
    if (data.safety_stock != null) run('UPDATE inventory SET safety_stock = ?, updated_at = ? WHERE id = ?', data.safety_stock, nowIso(), row.id);
    if (data.available != null) {
      const delta = data.available - (row.on_hand - row.reserved);
      if (delta) moveStock(ctx.sellerId, row.id, { onHandDelta: delta, kind: 'adjustment', reason: data.reason || 'Manual stock update', actor: ctx.user.name });
    }
    logActivity(ctx, 'Updated inventory', 'inventory', row.sku, [data.available != null ? `available ${row.on_hand - row.reserved} → ${data.available}` : '', data.safety_stock != null ? `safety stock ${row.safety_stock} → ${data.safety_stock}` : ''].filter(Boolean).join(', '));
    const fresh = get(`SELECT ${INV_SELECT} FROM ${INV_FROM} WHERE i.id = ?`, row.id);
    return { ok: true, item: fresh, message: `Stock for ${row.sku} updated.` };
  });
});
route('POST', '/api/inventory/bulk', { perm: 'inventory.write' }, (ctx) => {
  const { headers, records } = parseCsv(ctx.body.csv);
  if (!records.length) throw bad('The file has no data rows.');
  if (!headers.includes('sku') || !(headers.includes('available') || headers.includes('quantity') || headers.includes('safety_stock'))) throw bad('The file needs a "sku" column and an "available" (or "safety_stock") column.');
  if (records.length > 2000) throw bad('Upload at most 2,000 rows at a time.');
  const result = { updated: 0, unchanged: 0, errors: [] };
  tx(() => {
    for (const rec of records) {
      const row = get('SELECT * FROM inventory WHERE seller_id = ? AND sku = ? COLLATE NOCASE', ctx.sellerId, rec.sku || '');
      if (!row) { result.errors.push({ line: rec._line, sku: rec.sku || '', message: 'SKU not found.' }); continue; }
      const qtyText = rec.available !== undefined && rec.available !== '' ? rec.available : rec.quantity;
      const safetyText = rec.safety_stock;
      const qty = qtyText === undefined || qtyText === '' ? null : Number(qtyText);
      const safety = safetyText === undefined || safetyText === '' ? null : Number(safetyText);
      if ((qty !== null && (!Number.isInteger(qty) || qty < 0)) || (safety !== null && (!Number.isInteger(safety) || safety < 0))) { result.errors.push({ line: rec._line, sku: rec.sku, message: 'Quantities must be whole numbers, 0 or more.' }); continue; }
      let changed = false;
      if (safety !== null && safety !== row.safety_stock) { run('UPDATE inventory SET safety_stock = ?, updated_at = ? WHERE id = ?', safety, nowIso(), row.id); changed = true; }
      if (qty !== null && qty !== row.on_hand - row.reserved) { moveStock(ctx.sellerId, row.id, { onHandDelta: qty - (row.on_hand - row.reserved), kind: 'import', reason: 'Bulk stock update', actor: ctx.user.name }); changed = true; }
      if (changed) result.updated += 1; else result.unchanged += 1;
    }
    logActivity(ctx, 'Bulk stock update', 'inventory', null, `${result.updated} updated, ${result.errors.length} errors`);
  });
  return result;
});
route('POST', '/api/inventory/threshold', { perm: 'inventory.write' }, (ctx) => {
  const data = validate(ctx.body, { safety_stock: { type: 'int', required: true, min: 0, max: 100000, label: 'Low-stock threshold' }, apply_to_all: { type: 'bool' } });
  tx(() => {
    run('UPDATE sellers SET low_stock_default = ? WHERE id = ?', data.safety_stock, ctx.sellerId);
    if (data.apply_to_all) run('UPDATE inventory SET safety_stock = ?, updated_at = ? WHERE seller_id = ?', data.safety_stock, nowIso(), ctx.sellerId);
    logActivity(ctx, 'Set low-stock threshold', 'inventory', null, `${data.safety_stock}${data.apply_to_all ? ' (applied to all SKUs)' : ' (new SKUs only)'}`);
  });
  return { ok: true, message: data.apply_to_all ? 'Threshold applied to every SKU.' : 'Default threshold saved for new SKUs.' };
});

route('GET', '/api/warehouses', { perm: 'inventory.read' }, (ctx) => {
  ensureWarehouse(ctx.sellerId);
  return { warehouses: all(`SELECT w.*, (SELECT COUNT(*) FROM inventory WHERE warehouse_id = w.id) AS skus, (SELECT COALESCE(SUM(on_hand), 0) FROM inventory WHERE warehouse_id = w.id) AS units FROM warehouses w WHERE w.seller_id = ? ORDER BY w.id`, ctx.sellerId) };
});
route('POST', '/api/warehouses', { perm: 'inventory.write' }, (ctx) => {
  const data = validate(ctx.body, { name: { required: true, min: 2, max: 80 }, city: { required: true, max: 60 }, pincode: { required: true, format: 'pincode', label: 'PIN code' } });
  const n = get('SELECT COUNT(*) AS n FROM warehouses WHERE seller_id = ?', ctx.sellerId).n;
  if (n >= 20) throw conflict('You can have at most 20 warehouses.');
  const id = insert('warehouses', { seller_id: ctx.sellerId, code: `WH-${String(n + 1).padStart(2, '0')}`, ...data, created_at: nowIso() });
  logActivity(ctx, 'Added warehouse', 'warehouse', data.name);
  return reply.created({ id, message: 'Warehouse added.' });
});

module.exports = { ensureWarehouse, storeUpload, productDetail, saveProduct, findProduct, CATEGORY_ATTRIBUTES, STOCK_JOIN, LIST_SELECT, inventorySummary, UPLOAD_DIR };
