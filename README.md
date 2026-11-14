# NearBuy

**Your neighbourhood. Everything you need.**

A public, mobile-first marketing site for a neighbourhood commerce platform — 3D hero, three portal entry points, categories, how it works, partner programme and support — sitting in front of **NearBuy One**, the working product: one shared data model behind five workspaces, each with its own separate sign-in.

```bash
npm start
```

Then open **http://localhost:4173** — no build step, no dependencies, no backend.

---

## The public site

| Route | Page |
| --- | --- |
| `/` | Universal homepage — 3D hero, portals, categories, how it works, why NearBuy, portal previews, partners, trust, FAQs |
| `/customer/` · `/customer/login/` | Enters the customer portal (redirects into NearBuy One, Shop workspace) |
| `/seller/` · `/seller/register/` | Enters the seller portal (Sell workspace) |
| `/runner/` · `/runner/register/` | Enters the delivery-partner portal (Deliver workspace) |
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
| Fleet (sub-portal) | `/portal.html#/fleet/overview` | `arjun@nearbuy.demo` / `Fleet123!` |
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
| **Shop** | Neighbour | Discover, filter, save, cart, checkout, track orders, manage account, follow shops |
| **Sell** | Green Basket Market | Accept orders, mark ready, request runners, edit catalogue & stock, promotions, payouts, insights, settings, team |
| **Deliver** | Runner | Go online, accept/pass requests, shop arrival, pickup OTP, route, delivery OTP, earnings, preferences, safety reports |
| **Fleet** | Neighbourhood fleet lead | Team availability, work allocation, auto-match, reports, safety commitments |
| **Ops** | South Delhi ops desk | Control tower, dispatch queue, **verification queue**, partner eligibility, service areas, pricing bands, incidents, audit log |

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

## Keyboard & shortcuts

| Keys | Action |
| --- | --- |
| `⌘K` / `Ctrl K` | Search everything — workspaces, products, shops, orders |
| `↑ ↓` then `↵` | Move through command results and open |
| `Esc` | Close a dialog, palette or the mobile drawer |

There is deliberately no keyboard shortcut that jumps between portals — doing so would be a permission bypass, not a convenience.

## Demo data

All data is local sample data in `localStorage` (key `nearbuy.one.v2`). Nothing is sent anywhere.

- Customer: **Riya Sharma** — Hauz Khas, South Delhi
- Shop: **Green Basket Market** — owner Riya, manager Aarav, inventory Sana
- Runners: **Rohan Kumar** (walking), Meena Joshi (bicycle), Farhan Ali (bicycle)
- Areas: Hauz Khas, Green Park, Saket · pricing bands from ₹10 to ₹25

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
