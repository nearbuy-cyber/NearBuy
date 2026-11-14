// Learning Center content. Lessons are written guides — no video is bundled, so none is claimed.
// Lesson ids are stable: progress and bookmarks are stored against them on the server.
const L = (id, title, minutes, summary, steps, link) => ({ id, title, minutes, summary, steps, link });

export const MODULES = [
  { key: 'getting-started', title: 'Getting started', ico: 'sparkle', summary: 'Set up your seller account and understand how the Seller Hub is organised.', lessons: [
    L('gs-account-setup', 'Complete your seller account', 6, 'What NearBuy needs before your store can go live, and why.', [
      ['Business details', 'Enter your legal business name, business type and registered address exactly as they appear on your registration documents. A GSTIN is needed to sell taxable goods; the Seller Hub checks its format and that the embedded PAN matches the PAN you enter.'],
      ['Pickup address', 'Add the address your orders are collected from. The PIN code decides which shipping zone applies to each order, so use the real dispatch location rather than your office.'],
      ['Bank account', 'Add the account your settlements should be addressed to. The account number is encrypted on the server and only the last four digits are ever shown again.'],
      ['Submit for review', 'When every step shows a tick, submit the account. Until it is approved you can prepare listings, but they cannot go live.']], ['Open onboarding', '/seller/onboarding']),
    L('gs-tour', 'A tour of the Seller Hub', 5, 'Where to find each part of your business.', [
      ['Dashboard', 'A daily summary: sales, orders that need action, stock alerts and recent activity. Every card links to the page where you can act on it.'],
      ['Sell', 'Products, Inventory, Orders, Returns, Shipping and Payments cover the day-to-day running of your store.'],
      ['Grow', 'Growth, Advertising and Analytics help you decide what to sell more of and where you are losing sales.'],
      ['Search and notifications', 'The search bar at the top finds products, orders, returns and tickets by ID or name. The bell shows alerts such as new orders and low stock.']], ['Open dashboard', '/seller/dashboard']),
    L('gs-team', 'Invite your team', 4, 'Give colleagues access to only what they need.', [
      ['Roles', 'There are five roles: Store owner, Catalogue manager, Order manager, Inventory manager and Finance viewer. Each role sees only its own menu items, and the server enforces the same limits.'],
      ['Sending an invitation', 'Go to Settings → Team, enter a name, email and role. The person receives a link to set their own password. You never see or set it for them.'],
      ['Removing access', 'Removing a team member signs them out of every device immediately.']], ['Manage team', '/seller/settings/team'])] },
  { key: 'listing', title: 'Listing products', ico: 'box', summary: 'Create listings that pass quality checks and convert browsers into buyers.', lessons: [
    L('ls-first-product', 'Add your first product', 8, 'A walk through the seven sections of the product form.', [
      ['Basics', 'Choose the most specific category — it decides which attributes are asked for and which GST rate is suggested. Write the product name the way a customer would search for it: brand, product type, key feature, size.'],
      ['Pricing', 'MRP is the printed maximum retail price including taxes. Your selling price can never be higher than the MRP. The form shows the discount and the estimated amount you receive after fees as you type.'],
      ['Inventory', 'Each product needs a unique SKU. Set the opening stock and a low-stock threshold so that you are alerted before you run out.'],
      ['Images', 'Upload at least one clear image on a plain background. JPG, PNG or WebP up to 2 MB each. The first image is the main one shown in search results.'],
      ['Shipping and tax', 'Enter the packed weight and dimensions — shipping fees are charged by weight slab. Add the HSN code and GST rate so that invoices are correct.'],
      ['Submit', 'Save a draft at any time. When you submit, the listing is checked against the listing rules and either goes live or is returned with the reason.']], ['Add a product', '/seller/products/new']),
    L('ls-quality', 'Pass listing quality checks', 5, 'The most common reasons a listing is sent back.', [
      ['Missing or unclear images', 'Listings without an image cannot be submitted. Blurry, watermarked or collage images are rejected by reviewers.'],
      ['Price errors', 'A selling price above the MRP is blocked when you save.'],
      ['Thin descriptions', 'A description under 30 characters cannot be submitted. Describe what is in the box, materials, dimensions and care instructions.'],
      ['Fixing a failed listing', 'Open the listing from Products → QC failed, read the reviewer note at the top, correct the fields and submit again.']], ['View QC failed listings', '/seller/products?tab=qc_failed']),
    L('ls-bulk', 'Upload products in bulk', 6, 'Add many listings at once with a CSV file.', [
      ['Download the template', 'The template has one row per product with the required columns. Keep the header row unchanged.'],
      ['Validate first', 'Upload the file to see a row-by-row check. Nothing is saved until you confirm, and rows with errors are listed with the reason.'],
      ['Import', 'Valid rows are created as drafts so that you can add images before submitting them for review.']], ['Open bulk upload', '/seller/products/bulk-upload'])] },
  { key: 'orders', title: 'Managing orders', ico: 'cart', summary: 'Move orders from new to delivered without missing a dispatch date.', lessons: [
    L('or-lifecycle', 'The order lifecycle', 6, 'What each order status means and what you do next.', [
      ['New', 'Stock is reserved for the order. Accept it to confirm that you can fulfil it, or cancel with a reason if you cannot.'],
      ['Processing and packed', 'Start processing when you pick the items, then mark the order as packed. Check the product, quantity and variant against the order before sealing the package.'],
      ['Ready to ship', 'Generate the shipment record, download the shipping label and fix it to the package. Then mark the order ready for pickup.'],
      ['Shipped and delivered', 'When the package leaves, stock is deducted. When it is delivered, the sale and the marketplace fees are written to your payments ledger.'],
      ['Steps cannot be skipped', 'The server checks every transition. An order that has not been packed cannot be shipped, and a delivered order cannot be cancelled.']], ['Open orders', '/seller/orders']),
    L('or-documents', 'Invoices and shipping labels', 4, 'The documents that travel with each order.', [
      ['Tax invoice', 'Available once an order is accepted. It lists the taxable value and GST split (CGST and SGST within your state, IGST for other states) using the HSN code and rate from your listing.'],
      ['Shipping label', 'An A6 label with the delivery address, your pickup address, the package weight and a scannable barcode of the shipment ID.'],
      ['Customer privacy', 'The Seller Hub masks customer names and phone numbers on screen. The full delivery address appears only on the label.']], ['Shipping labels', '/seller/shipping/labels']),
    L('or-cancellations', 'Avoid cancellations and late dispatch', 4, 'Keep your fulfilment record clean.', [
      ['Watch the dispatch-by date', 'Every order shows a dispatch-by date. Orders close to or past it are flagged on the dashboard and can be filtered with “Overdue only”.'],
      ['Keep stock accurate', 'Most seller cancellations come from stock that was not really available. Update inventory the same day anything changes.'],
      ['When you must cancel', 'Cancel as early as possible and choose the true reason. Reserved stock goes back to available inventory immediately.']], ['Overdue orders', '/seller/orders?overdue=1'])] },
  { key: 'inventory', title: 'Inventory management', ico: 'layers', summary: 'Keep stock accurate so that you never oversell.', lessons: [
    L('in-stock-states', 'Available, reserved and damaged stock', 5, 'The three numbers behind every SKU.', [
      ['Available', 'Units that can be sold right now. This is what customers can order.'],
      ['Reserved', 'Units held for orders that are placed but not yet shipped. Reserved units move out of your stock when the order is shipped, or back to available if the order is cancelled.'],
      ['Damaged', 'Units you hold but cannot sell. Record them so that your stock count matches the shelf.'],
      ['Stock history', 'Every change — orders, cancellations, returns and manual edits — is logged with who made it and why.']], ['Open inventory', '/seller/inventory']),
    L('in-alerts', 'Low-stock alerts and thresholds', 4, 'Get warned before you run out.', [
      ['Thresholds', 'Each SKU has a low-stock threshold. When available stock falls to it, the SKU shows as Low; at half the threshold or less it shows as Critical.'],
      ['Notifications', 'You are notified when a SKU first becomes low or runs out. Turn these alerts on or off in Settings → Notifications.'],
      ['Out-of-stock listings', 'A listing with no available stock stays in your catalogue but cannot be ordered until you add stock.']], ['Low-stock items', '/seller/inventory?status=low']),
    L('in-bulk', 'Update stock in bulk', 4, 'Change many SKUs with one CSV file.', [
      ['Export, edit, upload', 'Download the current stock as CSV, change the available or damaged quantities, and upload the file.'],
      ['Preview before applying', 'The preview shows the old and new quantity for every row and lists rows that cannot be applied, such as an unknown SKU or a quantity below what is reserved.']], ['Bulk update', '/seller/inventory/bulk-update'])] },
  { key: 'payments', title: 'Payments and settlements', ico: 'wallet', summary: 'Understand what you earn on each order and how settlements are calculated.', lessons: [
    L('pa-fees', 'How fees are calculated', 6, 'From the customer price to the amount you receive.', [
      ['Platform fee', 'A commission percentage that depends on the category, plus a fixed closing fee per order. The fee schedule in this build is illustrative.'],
      ['Shipping fee', 'Charged by packed weight slab and by whether the delivery is local, within your zone or national.'],
      ['GST on fees', '18% GST is charged on the platform and shipping fees. It is shown as a separate line so that you can claim input credit.'],
      ['Net amount', 'Sale amount minus platform fee, shipping fee and GST on fees. The order page shows this estimate before delivery and the actual ledger entries afterwards.']], ['Open payments', '/seller/payments']),
    L('pa-settlements', 'Reading a settlement statement', 5, 'What a settlement is — and what it is not.', [
      ['The ledger', 'Every delivered order writes a sale entry and its fee entries. A completed return writes a refund deduction. Nothing else changes your balance.'],
      ['Closing a cycle', 'A settlement groups all unsettled ledger entries into one statement and shows the net amount owed to you.'],
      ['Awaiting payout', 'A new settlement is marked “Awaiting payout”. The Seller Hub does not move money: a settlement only shows as paid when marketplace finance records a bank reference for it.'],
      ['Reconciling', 'Download the CSV or PDF statement. The order-wise breakdown adds up exactly to the net amount.']], ['View settlements', '/seller/payments/settlements'])] },
  { key: 'policies', title: 'Marketplace policies', ico: 'shield', summary: 'The rules that keep customers confident and your account in good standing.', lessons: [
    L('po-listing-rules', 'Listing rules', 4, 'What you can list and how to describe it.', [
      ['Sell only genuine products', 'List products you hold and are authorised to sell. Counterfeit and prohibited items lead to account suspension.'],
      ['Describe honestly', 'Images and descriptions must match the item the customer receives, including colour, size and what is in the box.'],
      ['Price fairly', 'The MRP must be the printed MRP. Inflating it to show a bigger discount is not allowed.']], ['Your products', '/seller/products']),
    L('po-returns', 'Returns policy for sellers', 5, 'How return requests are handled.', [
      ['Review promptly', 'Review each return request and approve or reject it with a clear reason. Rejections need a reason that the customer can understand.'],
      ['Inspect on receipt', 'When the product comes back, record its condition. Sellable items are added back to your available stock automatically.'],
      ['Refund deductions', 'A completed return is recorded as a refund deduction in your ledger and appears in your next settlement.']], ['Open returns', '/seller/returns']),
    L('po-data', 'Customer data and privacy', 3, 'Your responsibilities when handling customer information.', [
      ['Use data only to fulfil orders', 'Customer details are provided so that you can deliver the order. Do not contact customers for marketing or share their details.'],
      ['Protect your account', 'Use a strong password, give each team member their own login, and remove access as soon as someone leaves.']], ['Security settings', '/seller/settings/security'])] },
];

export const ALL_LESSONS = MODULES.flatMap((m) => m.lessons.map((lesson) => ({ ...lesson, module: m.key, moduleTitle: m.title })));
export const findModule = (key) => MODULES.find((m) => m.key === key);

export const FAQS = [
  ['Account', [
    ['How long does account approval take?', 'After you submit onboarding, your account is reviewed by marketplace staff. In this build, review can be set to automatic for evaluation; otherwise the account stays “Under review” until staff record a decision. You can prepare draft listings while you wait.'],
    ['Can I change my business details after approval?', 'Yes, the store owner can edit them from Settings → Business details. If you change the GSTIN you are asked to re-enter the PAN so that the two can be matched.'],
    ['How do I give a colleague access?', 'The store owner can invite team members from Settings → Team and choose a role for each. Each person sets their own password from the invitation link.']]],
  ['Listings', [
    ['Why was my listing rejected?', 'Open the listing from Products → QC failed. The reviewer note at the top explains what to fix. Correct it and submit the listing again.'],
    ['Why can’t I set my price above the MRP?', 'Selling above the printed maximum retail price is not permitted, so the form blocks it.'],
    ['What image formats are accepted?', 'JPG, PNG and WebP up to 2 MB each. Files are checked on the server — renaming another file type does not work.']]],
  ['Orders and shipping', [
    ['Why can’t I mark an order as shipped?', 'Orders move one stage at a time. An order must be accepted, processed, packed and have a shipment record before it can be shipped.'],
    ['Does NearBuy book a courier for me?', 'Not in this build. No courier service is connected, so shipments are recorded as self-ship and you arrange the pickup yourself. The label and shipment record are generated for you.'],
    ['Where is the customer’s full address?', 'On the shipping label only. Names and phone numbers are masked on screen to protect customer privacy.']]],
  ['Payments', [
    ['When do I get paid?', 'A settlement statement shows what you are owed. This build is not connected to a bank or payout provider, so a settlement stays “Awaiting payout” until marketplace finance records a payout reference.'],
    ['What fees are deducted?', 'A category commission, a fixed closing fee, a weight-based shipping fee and 18% GST on those fees. Each order page shows the breakdown.'],
    ['Why is there a refund deduction?', 'When a return is completed, the refunded amount is deducted from your ledger and included in your next settlement.']]],
  ['Returns', [
    ['Can I reject a return?', 'Yes, with a specific reason. Rejections are visible to the customer and to marketplace staff.'],
    ['Is returned stock added back automatically?', 'Only when you record the product as “Sellable — restock” on receipt. Damaged or used items are not added to available stock.']]],
];
