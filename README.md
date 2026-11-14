# NearBuy

**Your neighbourhood. Everything you need.**

A public, mobile-first marketing site for a neighbourhood commerce platform — 3D hero, three portal entry points, categories, how it works, partner programme and support — sitting in front of **NearBuy One**, the working product: one shared data model behind five workspaces, each with its own separate sign-in.

```bash
npm start
```

Then open **http://localhost:4173** for the public site and **http://localhost:4173/seller/** for the Seller Hub. `npm start` runs the Node server in `server/` (Node 22.5 or newer, no npm dependencies, no build step); it serves the static site and the Seller Hub API from one port. `npm run start:static` still serves the static pages alone, but the Seller Hub cannot sign anyone in without the API. Run the regression tests with `npm test`.

## Seller Hub (`/seller/`)

A working seller workspace backed by a real server: accounts, sessions, a SQLite database, server-side validation and role checks. It replaces the earlier static `/seller/` landing page.

### Demo sign-ins

The server creates one sample store, **Green Basket Market**, the first time it starts (skipped when `NODE_ENV=production` unless `SEED_DEMO=1`). Every sample record is labelled **DEMO DATA** in the interface.

| Role | Email | Password | Can do |
| --- | --- | --- | --- |
| Store owner | `owner@nearbuy.demo` | `Seller123!` | Everything, including payments, team, ads and settings |
| Catalogue manager | `catalogue@nearbuy.demo` | `Team123!` | Products, promotions, analytics (read) |
| Order manager | `orders@nearbuy.demo` | `Team123!` | Orders, returns, shipping |
| Inventory manager | `stock@nearbuy.demo` | `Team123!` | Stock and warehouses; orders read-only |
| Finance viewer | `finance@nearbuy.demo` | `Team123!` | Payments, orders, returns and analytics, read-only |

The sign-in page also offers a *Fill in the demo sign-in* shortcut. To start again from a clean sample store, stop the server, delete the `data/` folder and start it again.

**If a demo sign-in returns you to the form:** the browser is not keeping the session cookie. The usual cause is viewing the Seller Hub inside another site's frame (hosted previews do this). Outside production the server therefore issues the cookie as `SameSite=None; Secure; Partitioned` over HTTPS, which works both framed and in its own tab; the form also explains the problem and links to a standalone tab if the cookie is still refused. The other cause is running a static file server (`npm run start:static`) instead of `npm start` — the pages load but there is no API to sign in to.

### What is implemented

- **Accounts:** registration, email verification, sign-in, password reset, session list and remote sign-out, team invitations, five roles enforced on the server for every request.
- **Onboarding:** business, store, bank, pickup-location and first-product steps, then marketplace review.
- **Catalogue:** product create/edit with category attributes, variants, image upload, draft and submit, automated quality check, bulk CSV upload, listing statuses.
- **Inventory:** per-SKU stock with reservations, low-stock thresholds, bulk update, movement history, warehouses.
- **Orders and returns:** the full order lifecycle with enforced step order, stock reserved on order and deducted on dispatch, invoice and label PDFs, return review, restock and refund.
- **Payments:** a ledger posted on delivery, fees and GST calculated per order, settlement statements with PDF and CSV exports.
- **Growth:** promotions with server-calculated price previews, campaign records, analytics reports and CSV exports calculated from the store's own records.
- **Support and learning:** tickets with threaded replies, FAQs, a text learning centre.

### What runs in demo mode or still needs an integration

These are stated in the interface as well; nothing here is presented as live.

| Area | Current behaviour | Needed for production |
| --- | --- | --- |
| Email | Messages are written to an outbox table. With `DEV_MAIL_PREVIEW=1` the link is shown on screen | An SMTP account (`SMTP_HOST` and related variables) and `npm install nodemailer` |
| Seller and listing review | Auto-approved when `DEMO_AUTO_REVIEW` is on (the default outside production) | A staff review process using the operations API below |
| Carriers | Shipment records, labels and tracking events are created locally; no courier is booked | A carrier or aggregator API |
| Payouts | Settlements are calculated and marked *awaiting payout*; no money moves | A payout provider, then `POST /api/ops/settlements/:code/paid` |
| Advertising | Campaigns are stored; real campaigns record zero delivery | An ad-serving system |
| KYC | PAN, GSTIN and IFSC are format-checked only | A verification provider |
| Customer orders | Created through *Simulate order* or the sample data | The customer checkout writing to the same database |
| Sample images | 10 of the 28 sample products have photographs; the other 18 use labelled placeholder cards | Real product photography |

### Configuration

| Variable | Purpose | Default |
| --- | --- | --- |
| `PORT`, `HOST` | Listen address | `4173`, `0.0.0.0` |
| `NODE_ENV` | `production` turns off demo seeding, auto-review and on-screen mail links, and requires `PUBLIC_BASE_URL` | unset |
| `PUBLIC_BASE_URL` | Origin used in emailed links and the same-origin check | derived from the request |
| `NEARBUY_DATA_DIR`, `NEARBUY_DB_FILE` | Where the database, uploads and key file live | `./data` |
| `NEARBUY_DATA_KEY` | Key that encrypts bank account numbers at rest. Without it a key file is generated in the data folder | generated |
| `SESSION_SAMESITE` | `lax` or `none` for the session cookie | `none` outside production, `lax` in production |
| `COOKIE_SECURE` | `1` forces the `Secure` cookie flag when the proxy does not report HTTPS | unset |
| `TRUST_PROXY` | `1` reads the client address from `X-Forwarded-For` for rate limits | unset |
| `SEED_DEMO` | `1` or `0` forces the sample store on or off | on outside production |
| `DEMO_AUTO_REVIEW` | `0` sends sellers and listings to the operations queue instead of auto-approving | on outside production |
| `DEV_MAIL_PREVIEW` | `1` shows verification, reset and invite links on screen when no SMTP account is set. Ignored in production | unset |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `MAIL_FROM` | Outgoing email | unset (no email is sent) |
| `OPS_API_KEY` | Enables the operations API. Must be at least 16 characters | unset (API returns 503) |

### Operations API

Staff actions have no screen yet; they are HTTP endpoints protected by `X-Ops-Key: <OPS_API_KEY>` (optional `X-Ops-Staff: <name>` for the audit trail).

| Request | Purpose |
| --- | --- |
| `GET /api/ops/sellers?status=under_review` | Sellers waiting for review |
| `POST /api/ops/sellers/:code/review` | `{ "decision": "approve" \| "reject" \| "action_required", "note": "…" }` |
| `GET /api/ops/listings` · `POST /api/ops/listings/:code/review` | Approve or reject a submitted listing (a rejection needs a note) |
| `GET /api/ops/tickets` · `POST /api/ops/tickets/:code/reply` | Answer a seller ticket |
| `POST /api/ops/settlements/:code/paid` | Record a payout reference once money has been sent |

### Security notes

Passwords are hashed with scrypt; sessions are random tokens stored hashed, in an `HttpOnly` cookie. Every state-changing request must carry the `X-NearBuy-Request: 1` header and come from the same origin, so cross-site form posts are refused. Every query is scoped to the signed-in seller. Uploads are checked by content, not file name. The Seller Hub pages are served with a Content-Security-Policy that allows no inline or third-party script. Rate limits are held in memory, so a multi-instance deployment needs a shared store. `node:sqlite` is still marked experimental by Node; for production traffic move the same schema to a managed database.

### Tests

`tests/seller-hub.test.cjs` starts the real server on a spare port with a temporary data folder and exercises it over HTTP: security headers and CSRF, sign-in behind an HTTPS proxy and for every demo account, registration through approval, listing review, tenant isolation, the order lifecycle with stock and ledger, returns, inventory, promotions, tickets, role limits, invitations and password reset, and every page endpoint and export.

### Customer Discover

After signing in to the customer portal, **Discover** brings neighbourhood shopping together with a search bar, category shortcuts, popular in-stock products, local shops, saved items and order tracking. Product search understands category names and multiple words; **Browse everything** also offers in-stock and deal filters. The **LOCAL10** demo offer can be applied from Discover and is reflected in the cart and checkout.

The neighbourhood picker, products, prices, orders and offer are simulated; choosing an area does not perform a live coverage or GPS check. Changes stay in this browser.

### Customer product details

Every catalogue item has a product page at `#/shop/product/<id>` with a showcase, description, shop location and public contact fields, delivery and pickup information, highlights, specifications, warranty, manufacturer information and related finds. Missing information is explicitly marked as not provided; descriptions and highlights can fall back to the item's existing short detail. The first four original demo products have illustrative images, while other items show a placeholder until images are supplied. Delivery is ₹19 below ₹199 after discounts, free at or above ₹199; pickup is free. Availability and delivery coverage are not checked in this demo.

For Green Basket products, sign in to **Seller → Products & catalogue** and open **Add product** or **Edit → Product page details** to provide optional descriptions, highlights, specifications, warranty, manufacturer details and up to four image URLs. URLs must be HTTPS (excluding localhost) or local `/public/assets/` paths; images are not uploaded. Viewers' browsers request any external image from its host, so use only images you are permitted to share. The seller can set optional, customer-visible owner and phone fields in **Manage profile → Business details**. These are separate from private login and runner contact details; other shops' missing public contacts remain unavailable. Use sample values only and do not call the displayed demo contacts.

---

## Delivery partner network ("Routely")

Local orders are carried by a delivery network that runs on the same server and database as the Seller Hub, but has its own name, look and sign-ins. Each audience gets a separate app and a separate session cookie; one sign-in never opens another app.

| App | Address | Who uses it | Demo sign-in (only when `SEED_DEMO=1`) |
| --- | --- | --- | --- |
| Partner app (mobile-first) | `/runner/` | Delivery partners: apply, go online, accept offers, pick up, deliver, earnings, support | `rohan@nearbuy.demo` / `Runner123!` |
| Control tower | `/control-tower/` | Operations: live map, dispatch, partner approval, zones and fees, finance, support, reports, audit | `tower@nearbuy.demo` / `Tower123!` |
| Fleet portal | `/fleet/` | Fleet managers: their own riders, deliveries, performance, settlements | `fleet@nearbuy.demo` / `Fleet123!` |
| Order tracking | `/track/?t=<private link>` | Customers: status, arrival estimate, delivery code, preferences, rating, problem report | link is created with each order |
| Seller deliveries | `/seller/deliveries` | Sellers: preparation time, ready for pickup, pickup PIN, handover, issues | `owner@nearbuy.demo` / `Seller123!` |

**Try one delivery end to end**

1. Seller Hub → **Deliveries** → **Create test order**, then **Mark ready for pickup**. Note the pickup PIN.
2. Partner app → sign in, switch **online**, set a test location, **Accept** the offer, and follow the steps. The customer address appears only after pickup.
3. Open the tracking link (shown in the control tower on the delivery page) to see the 4-digit delivery code the partner must enter.
4. Control tower → **Deliveries** shows every status change, offer, proof and payment record.

**What is real and what is not**

- Real: accounts and sessions, partner applications and document review, zones and fee rules, automatic and manual assignment, PIN and code checks, 250 m arrival check, proof records, earnings, cash-on-delivery reconciliation, payout records, tickets, audit log, live updates.
- Not connected (no provider account): SMS, maps and routing, bank payouts, online payment. One-time codes are shown on screen in test mode; a location is a PIN-code centre; distance is straight-line × 1.35; a payout is a record that operations settle with a bank reference. Local orders are created with the test-order tool because the storefront has no checkout yet, and they are labelled as test data.

**Settings (environment variables)**

| Variable | Default | Meaning |
| --- | --- | --- |
| `DELIVERY_ADMIN_EMAIL`, `DELIVERY_ADMIN_PASSWORD`, `DELIVERY_ADMIN_NAME` | none | Creates the first control tower administrator at start-up |
| `DELIVERY_OFFER_SECONDS` | `45` | Time a partner has to answer an offer |
| `DELIVERY_TEST_TOOLS` | on, off in production | `0` hides on-screen codes, test locations and test orders |
| `DELIVERY_BACKGROUND` | on | `0` stops the 2-second dispatch loop (used by tests) |
| `DELIVERY_SEED_HISTORY` | on | `0` skips the sample deliveries in demo data |

Code: `server/delivery/` (server), `delivery/` (shared look and components), `runner/`, `control-tower/`, `fleet/`, `track/`, `seller/app/pages-deliveries.js`. Tests: `tests/delivery-network.test.cjs`.

---

## The public site

| Route | Page |
| --- | --- |
| `/` | Universal homepage — 3D hero, portals, categories, how it works, why NearBuy, portal previews, partners, trust, FAQs, Help & Support enquiry form |
| `/customer/` · `/customer/login/` | Enters the customer portal (redirects into NearBuy One, Shop workspace) |
| `/seller/` · `/seller/register/` | Enters the seller portal (Sell workspace) |
| `/runner/` · `/runner/register/` | Delivery partner app (see the delivery partner network section) |
| `/admin/` | Gated entrance to the internal operations console (noindex, never linked in public navigation) |
| `/about/` | About NearBuy, the neighbourhood model and the prototype disclaimer |
| `/help/` | Help centre with quick links, 8 FAQs and support routes |
| `/portal.html` | NearBuy One itself — the internal product shell and operations console |

Three portals, three separate front doors, independent sign-in / registration / verification journeys, one backend. The homepage is the only public entry point; the operations console stays internal.

Each portal signs in **on its own** and opens **only its own tools**. There is no workspace switcher, no persona dropdown, no `Alt`-number jump and no cross-portal link that carries a session across: landing on another portal's URL shows that portal's sign-in, and a customer session never opens seller, partner, fleet or operations screens.

| Portal | Front door | Demo sign-in |
| --- | --- | --- |
| Customer | `/customer/` | `riya@nearbuy.demo` / `NearBuy123!` |
| Seller | `/seller/` | `owner@nearbuy.demo` / `Seller123!` |
| Delivery Partner | `/runner/` | `rohan@nearbuy.demo` / `Runner123!` |
| Fleet | `/fleet/` | `fleet@nearbuy.demo` / `Fleet123!` |
| Operations | `/admin/` or `#/ops/overview` | access code `NB-OPS-2026` |

Sessions live in `sessionStorage` for the current tab and are cleared by *Sign out*, so a demo reviewer can walk all five portals one after another without one session ever unlocking the next. Registration (`/seller/register/`, `/runner/register/`) stays public — you register before you have an account.

### Registration and verification (simulated)

| Journey | Route | What actually works |
| --- | --- | --- |
| Seller onboarding | `/seller/register/` → `#/sell/register` | 7 steps (account, business, details, location, operations, payout, review) with per-step validation, mobile OTP, GSTIN/IFSC format checks, sample document attachment and a submission that lands in the ops queue |
| Partner onboarding | `/runner/register/` → `#/deliver/register` | 7 steps with a hard **18+ age gate** computed from the date of birth, document masking (last 4 characters only), emergency contact, safety briefing and the three operational limits below |
| Verification queue | `#/ops/verifications` (after unlocking ops) | Every submitted application with its automated checks and reviewer actions: approve, request correction, reject — each written to the audit log |
| Application status | `#/sell/register` · `#/deliver/register` after submission | Status stays visible with the checks that ran, so a rejected applicant always sees why |

Two demo secrets make this walkable: OTP **`123456`** (displayed in the UI because no SMS is sent) and operations access code **`NB-OPS-2026`** (browser-session only). The delivery programme is adults-only at launch: an under-18 date of birth is refused with an explanation and cannot be overridden in the UI.

What is *not* real: no SMS, no document upload, no identity provider, no bank verification, no reviewer. Automated checks are assistive only and never make the final decision — production needs authorised KYC providers, encrypted storage, reason codes, MFA for reviewers and an appeal route.

### Homepage build notes

- **3D without the weight** — CSS 3D transforms, pointer tilt on the portal cards, layered parallax on the hero diorama, floating glass stat cards, soft aurora gradients. No WebGL, no 3D libraries, no layout thrash: all motion runs on `transform` / `translate` inside `requestAnimationFrame`.
- **Reduced motion is a feature** — the footer *Reduce motion* control and `prefers-reduced-motion` both stop parallax, tilt, marquee and float animations, and reveal content instantly. The choice is remembered in `localStorage` (`nearbuy.motion`).
- **Light on mobile** — single-column hero, simplified scene (parallax off on coarse pointers), 2×2 then 1-up grids, and a scrollable tab strip. Art is compressed: 164 KB hero JPEG, ~56–72 KB portal renders.
- **Accessible by default** — skip link, one `<h1>`, labelled landmarks, `aria-selected` tablist with arrow-key support, focus-trapped portal chooser with `Esc`, visible focus rings, `aria-current` on the active page.

### Help & Support (homepage, above the footer)

A four-field enquiry card — full name, mobile/email, topic and message — sits in the cream band directly above the footer, so it reads as part of the homepage rather than a separate contact page. It validates on submit (name length, email **or** 10-digit Indian mobile, a topic from the list, a message of at least 10 characters), writes inline errors with `aria-invalid`, focuses the first problem and counts characters as you type.

A valid submission shows **"Thank you for contacting NearBuy! We've received your query and will get back to you."** with a reference such as `ENQ-1042`, and stores the record in the same demo store the product uses (`nearbuy.one.v2` → `enquiries`). It then appears in the operations console under **Enquiries**, where an operator can mark it answered, close or reopen it — each change is audited.

Because there is no backend, nothing is emailed and no support agent is paged; the card says so, and the demo store keeps the note in this browser.

## NearBuy One

**One shared backend, five separately signed-in workspaces.** Shop, sell, deliver, run a fleet and operate the network — one consistent shell and one live data model, but each workspace opens only after its own sign-in, at **`/portal.html`**.

## Why this exists

The original prototype was five separate sites: a customer marketplace, a Seller Hub, a Runner app, a business/fleet portal and a delivery-ops console. Each had its own header, its own navigation and its own copy of the data, so an order could never really be followed from cart to doorstep.

NearBuy One rebuilds them as **one product**:

| | Before | Now |
| --- | --- | --- |
| Shell | 5 different headers and sidebars | 1 rail + 1 top bar, identical on every surface |
| Data | separate local-storage keys per portal | one shared store: orders, tasks, stock, payouts, incidents |
| Navigation | page loads between portals | deep-linkable URLs, ⌘K search scoped to the portal you are signed in to |
| Flow | each portal showed its own fake data | a real loop: cart → shop → runner → ops → back to the customer |
| Design | mixed spacing, radii and type scales | one design system, one 8-pt rhythm, one component set |

## The five workspaces

| Workspace | Who | What you can do |
| --- | --- | --- |
| **Shop** | Neighbour | Discover, filter, save, cart, checkout, track orders, manage account, follow shops — plus the **Why Use NearBuy?** benefits band |
| **Sell** | Green Basket Market | Accept orders, mark ready, request runners, edit catalogue & stock, promotions, payouts, insights, settings, team — plus the **Why Sell on NearBuy?** benefits band |
| **Deliver** | Runner | Go online, accept/pass requests, shop arrival, pickup OTP, route, delivery OTP, earnings, preferences, safety reports — plus the **Why Become a NearBuy Delivery Partner?** band |
| **Fleet** | Neighbourhood fleet lead | Team availability, work allocation, auto-match, reports, safety commitments |
| **Ops** | South Delhi ops desk | Control tower, dispatch queue, **verification queue**, **homepage enquiry queue**, partner eligibility, service areas, pricing bands, incidents, audit log |

## Follow one order around the loop

Every portal is signed in separately — that is the point — so the loop is walked by signing in as each one in turn. The data underneath is the same record throughout.

1. **Customer** — sign in as `riya@nearbuy.demo`, add a product, open the cart, apply `LOCAL10`, place the order. *Sign out.*
2. **Seller** — sign in as `owner@nearbuy.demo`; the order is already in *Orders*. Accept it, mark it ready, then **Request runner** on *Delivery & pickup*. *Sign out.*
3. **Delivery Partner** — sign in as `rohan@nearbuy.demo`; the request is waiting in *Delivery requests*. Accept it, note arrival at the shop, verify the pickup OTP, start the route, verify the delivery OTP. *Sign out.*
4. **Customer** — sign in again: the order reads *Delivered* with the full timeline, and the runner's sample earning is on the seller's ledger.
5. **Operations** — unlock with `NB-OPS-2026`: the task, every status change and the sample earning are in the audit log.

Nothing carries a session across those steps: each one is a fresh sign-in for that portal only.

## The operations console is gated

No workspace is a public portal. Any gated route withholds its module list, its counts, its data and its breadcrumb label until the matching sign-in happens; another portal's session opens nothing. `/admin/` is a noindex signpost to the operations gate, deliberately absent from the homepage, footer and portal cards, and operations still needs `NB-OPS-2026` on top of a session.

This is a browser-only demonstration of the model, not a security boundary: the checks run in the client, so production still needs server-side sessions, per-role permission checks on every sensitive action, and MFA for administrative roles.

## Three benefits bands, one identity

Each portal opens with its own benefits band, built from the same component — same card grid, same status/legend pattern, same closing banner — but speaking to its own side of the marketplace.

| | Customer (`#/shop/home`) | Seller Hub (`#/sell/overview`) | Delivery Partner (`#/deliver/overview`) |
| --- | --- | --- | --- |
| Heading | **Why Use NearBuy?** | **Why Sell on NearBuy?** | **Why Become a NearBuy Delivery Partner?** |
| Message | Your neighbourhood. Your favourite shops. Everything closer. | Grow your business with local customers | Your neighbourhood. Your delivery journey. |
| Accent | Marigold on warm cream | Green on mint | Blue on pale blue |
| Proof points | Nearby shops, local products, search, delivery or pickup, support local, choice, tracking, assistance | Reach customers, digital shop, catalogue, orders, delivery, promotion, insights, support | Nearby requests, flexible availability, transparent earnings, easy pickup, simple process, tracking, support, safety |
| Ends with | Explore nearby shops · *Shop local. Shop smart. Shop NearBuy.* | Start selling on NearBuy | Join as Delivery Partner · see how earnings work |

Each band links only to routes inside its own portal, and each states its limits plainly. The partner band also carries a four-step **How NearBuy Runner works** strip (register → receive requests → pick up and deliver → get paid) and says outright that there are no guaranteed orders, fixed earnings or speed incentives, that only verified adults aged 18+ are onboarded at launch, and that every request can be declined without penalty.

## Selling on NearBuy — the benefits band

The seller landing page (`#/sell/overview`) carries a **Why Sell on NearBuy?** section directly under the KPI hero: eight benefit cards, each with a real destination, a status label and a closing CTA that opens the seller registration flow.

Two rules are enforced in the copy, not just in review:

- **No promises.** The band states plainly that there are no guaranteed sales, orders, commission or delivery, that delivery depends on an eligible partner being available, and that fees and settlement timing live in *Payments & earnings*.
- **No dead claims.** Every card is labelled either **In demo** (it works in this prototype) or **Partly** (some of it is still planned — advertising products, a real human support desk, photo upload). Nothing is marked live that a reviewer cannot click.

The section is NearBuy's own; it borrows the *structure* of marketplace seller pages, never their claims, and the Flipkart name appears nowhere in the product.

### Monthly feature review

Keep all three bands honest by reviewing them once a month against what actually ships:

1. Re-read the eight cards on each band against the build; flip **Partly → In demo** only when the feature is genuinely clickable, and delete a card rather than overstate it.
2. Compare the offer with nearby marketplaces (fees, payout timing, ad formats, support hours, catalogue limits, delivery windows) and record the differences — without importing their guarantees.
3. Update *Payments & earnings* if commission or settlement timing changes, since the seller band points there for money questions.
4. Re-walk the customer journeys the customer band claims — search, compare, checkout, pickup, tracking, help — and remove any claim the demo cannot demonstrate.
5. **Delivery partner review (monthly):** compare nearby platforms' partner features, earnings models, verification requirements and safety systems; check that distance bands, payout timing and deductions still match what the app shows before a request is accepted, and that the safety centre is reachable from every delivery state.
6. **Seller profile review (monthly):** re-check the four Manage profile modules against what NearBuy actually uses each field for, confirm the completion checks still mirror real requirements (not aspiration), and verify that bank, PAN, GSTIN and documents are still masked outside Seller Hub and Operations.
7. Check all three honesty lines still match reality before publishing any new claim.

## Seller Hub · Manage profile

`#/sell/profile` is the seller's central record: one place to enter account, location, payout and business information that every other NearBuy surface reads. The header block (*Your shop profile · Seller account and business settings · Active*) sits above a **Profile completion** meter that starts at **75%** — six of eight checks — so a new seller can see exactly what is still missing.

| Module | What it holds | Who may edit |
| --- | --- | --- |
| Account details | Full name, mobile, email, profile photo, seller ID, account created/status; login mobile, login email, password change, two-step verification, active sessions, last login | Owner only — login credentials are never shown to shop staff |
| Manage locations | Shop, pickup, return and warehouse addresses with building, street, landmark, city, state, PIN, GPS, contact person and number; opening hours, pickup availability, handover instructions and default pickup **per branch** | Owner edits, manager views |
| Bank details | Holder name, bank, account number + confirm, IFSC, savings/current, branch; primary settlement account, payout default, verification status, settlement history with UTR, failed/pending settlements | Owner only, plus operations verification |
| Business details | Shop and legal name, type, category, description, year established, outlets, logo and shop photos; PAN, GSTIN, registration number, licences, registered address, ownership; document uploads with review status | Owner edits and verifies, manager views |

Rules the screens enforce rather than describe:

- **Account numbers are masked** as `•••• •••• 4321` everywhere — including the change log and the operations queue. PAN and GSTIN are likewise masked, and the full values never reach the DOM.
- **No payout detail changes without verification.** A new or edited account lands in **Pending review**; it cannot become primary until operations approve it, and settlements stay on the previously verified account until then.
- **Every sensitive save is queued, logged and notified.** Bank, legal-name, PAN/GSTIN and document replacements create a change record (`CHG-…`), write an audit entry and notify both operations and the seller.
- **Passwords are never displayed or stored.** The password form checks length, letter + number, and confirmation; only a “changed” timestamp is kept.
- **Only relevant documents are requested** for the declared business type; a proprietorship is not asked for a partnership deed.
- **Shop location and delivery coverage are separate.** Each branch has its own serviceable PIN codes, delivery radius and pickup/delivery availability, so a shop address never silently becomes a delivery promise.
- **Rejections carry a reason.** Operations can approve or reject with *Correction required*, which returns the item to the seller with a visible status.

Operations reviews these changes at **Profile changes** (`#/ops/changes` — Ops console → Profile changes), where the queue shows pending edits, uploaded documents awaiting review and unverified payout accounts, with approve/reject actions that update the seller record and notify the shop. Sensitive documents and bank numbers are scoped to Seller Hub and Operations: the customer portal and NearBuy Runner read the shop's name, address, pickup contact and handover notes, and nothing else.

## Keyboard & shortcuts

| Keys | Action |
| --- | --- |
| `⌘K` / `Ctrl K` | Search everything — workspaces, products, shops, orders |
| `↑ ↓` then `↵` | Move through command results and open |
| `Esc` | Close a dialog, palette or the mobile drawer |

There is deliberately no keyboard shortcut that jumps between portals — doing so would be a permission bypass, not a convenience.

## Demo data

All catalogue and profile data is local sample data in `localStorage` (key `nearbuy.one.v2`). Forms do not submit it to a backend. If a seller adds an external showcase image URL, viewers' browsers request that image from its host.

- Customer: **Riya Sharma** — Hauz Khas, South Delhi
- Shop: **Green Basket Market** — owner Riya, manager Aarav, inventory Sana
- Runners: **Rohan Kumar** (walking), Meena Joshi (bicycle), Farhan Ali (bicycle)
- Areas: Hauz Khas, Green Park, Saket · pricing bands from ₹10 to ₹25
- Enquiries: two sample homepage queries in the ops queue, plus anything you submit from the homepage form

Reset everything from the rail footer’s *Reset demo data*, or from the account menu.

## Design system

- **One shell** — a 256 px navy rail (identity, the portal you are signed in to, grouped navigation, demo notice) and a 68 px translucent top bar (breadcrumb, portal chip, ⌘K search, cart, notifications, identity). The rail never advertises another portal's tools.
- **One accent per workspace** — marigold for Shop, green for Sell, blue for Deliver, violet for Fleet, teal for Ops. Everything else stays identical, so switching feels like moving rooms in the same building.
- **One rhythm** — 18 px gutters, 18 px card radii, 8-pt spacing steps, a single KPI card, table, list row, empty state, status pill, modal and toast.
- **Built to move** — hover lift on cards, staggered sparklines and bars, page-entry transitions, reduced-motion support.
- **Responsive by construction** — the rail becomes a drawer on small screens, tables scroll, and every page keeps one navigation model. The Customer, Seller and Delivery Partner portals no longer carry a mobile bottom bar; Fleet and Operations still do.

## Files

```
index.html            the universal homepage (3D marketing site)
home.css · home.js    homepage design system, tilt/parallax/reveal, tabs, chooser
about/ · help/        static public pages built on the same system
customer/ seller/ runner/
                      portal front doors; each redirects into its workspace
seller/register/ · runner/register/
                      registration front doors (7-step onboarding wizards)
admin/                noindex signpost to the gated operations console
portal.html           NearBuy One — the unified product shell
nearbuy.css           product design system + every workspace style
nearbuy.js            data, store, router, five workspaces, flows, modals
classic.html · seller.html · partner.html · business.html · delivery-admin.html
                      earlier standalone pages (legacy, kept for reference)
public/assets/        brand mark + compressed 3D renders used by the homepage
```

## Brand

Deep navy `#081428`, marigold `#f47718`, cream `#fbf7f0` and white. Display type is Manrope, body type DM Sans, with system fallbacks. Cards are 16–26 px radius; motion is 200–700 ms on a single easing curve.

> **Prototype notice.** This is a simulated demo. Checkout charges nothing, no shop is contacted, no runner is dispatched, no OTP is sent, no application is really verified, no payout or bank account exists, and no personal or sensitive information should be entered. Maps, distances and pricing are schematic. The proposed adult-only delivery policy and any real worker or business arrangement require qualified Indian legal review; this demo does not determine legal eligibility.

### Master feature checklist

The [NearBuy feature checklist](/roadmap/) translates the 84-item blueprint into five reviewable sections. All items start unchecked; selections persist only in the current browser and can be reset. This is a manual planning aid, not a live implementation or production-readiness tracker. If browser storage is unavailable, selections last only for the current page session.
