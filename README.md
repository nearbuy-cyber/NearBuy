# NearBuy

**Your neighbourhood. Everything you need.**

A public, mobile-first marketing site for a neighbourhood commerce platform — 3D hero, three portal entry points, categories, how it works, partner programme and support — sitting in front of **NearBuy One**, the working product: five workspaces sharing one live data model.

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
| `/about/` | About NearBuy, the neighbourhood model and the prototype disclaimer |
| `/help/` | Help centre with quick links, 8 FAQs and support routes |
| `/portal.html` | NearBuy One itself — the internal product shell and operations console |

Three portals, three separate front doors, independent sign-in / registration / verification journeys, one backend. The homepage is the only public entry point; the operations console stays internal.

### Homepage build notes

- **3D without the weight** — CSS 3D transforms, pointer tilt on the portal cards, layered parallax on the hero diorama, floating glass stat cards, soft aurora gradients. No WebGL, no 3D libraries, no layout thrash: all motion runs on `transform` / `translate` inside `requestAnimationFrame`.
- **Reduced motion is a feature** — the footer *Reduce motion* control and `prefers-reduced-motion` both stop parallax, tilt, marquee and float animations, and reveal content instantly. The choice is remembered in `localStorage` (`nearbuy.motion`).
- **Light on mobile** — single-column hero, simplified scene (parallax off on coarse pointers), 2×2 then 1-up grids, and a scrollable tab strip. Art is compressed: 164 KB hero JPEG, ~56–72 KB portal renders.
- **Accessible by default** — skip link, one `<h1>`, labelled landmarks, `aria-selected` tablist with arrow-key support, focus-trapped portal chooser with `Esc`, visible focus rings, `aria-current` on the active page.

## NearBuy One

**One portal for the whole neighbourhood.** Shop, sell, deliver, run a fleet and operate the network — five workspaces inside a single, consistent shell, sharing one live data model, at **`/portal.html`**.

## Why this exists

The original prototype was five separate sites: a customer marketplace, a Seller Hub, a Runner app, a business/fleet portal and a delivery-ops console. Each had its own header, its own navigation and its own copy of the data, so an order could never really be followed from cart to doorstep.

NearBuy One rebuilds them as **one product**:

| | Before | Now |
| --- | --- | --- |
| Shell | 5 different headers and sidebars | 1 rail + 1 top bar, identical on every surface |
| Data | separate local-storage keys per portal | one shared store: orders, tasks, stock, payouts, incidents |
| Navigation | page loads between portals | instant switching, deep-linkable URLs, ⌘K search |
| Flow | each portal showed its own fake data | a real loop: cart → shop → runner → ops → back to the customer |
| Design | mixed spacing, radii and type scales | one design system, one 8-pt rhythm, one component set |

## The five workspaces

| Workspace | Who | What you can do |
| --- | --- | --- |
| **Shop** | Neighbour | Discover, filter, save, cart, checkout, track orders, manage account, follow shops |
| **Sell** | Green Basket Market | Accept orders, mark ready, request runners, edit catalogue & stock, promotions, payouts, insights, settings, team |
| **Deliver** | Runner | Go online, accept/pass requests, shop arrival, pickup OTP, route, delivery OTP, earnings, preferences, safety reports |
| **Fleet** | Neighbourhood fleet lead | Team availability, work allocation, auto-match, reports, safety commitments |
| **Ops** | South Delhi ops desk | Control tower, dispatch queue, partner eligibility, service areas, pricing bands, incidents, audit log |

## Follow one order around the loop

1. **Shop** — add a product, open the cart, apply `LOCAL10`, place the order at checkout.
2. **Sell** — the order appears instantly in *Orders*: accept it, mark it ready, then **Request runner**.
3. **Deliver** — the request is waiting in *Delivery requests*: accept it, note arrival at the shop, verify the pickup OTP, start the route and verify the delivery OTP.
4. **Shop** — the same order is now *Delivered*, with a full timeline.
5. **Ops** — the task, its status changes and the sample earning are in the audit log; stock has gone down; the shop's payouts and the runner's earnings have updated.

Every screen in every workspace is looking at the same record.

## Keyboard & shortcuts

| Keys | Action |
| --- | --- |
| `⌘K` / `Ctrl K` | Search everything — workspaces, products, shops, orders |
| `↑ ↓` then `↵` | Move through command results and open |
| `Esc` | Close a dialog, palette or the mobile drawer |
| `Alt 1…5` | Jump to Shop, Sell, Deliver, Fleet, Ops |

## Demo data

All data is local sample data in `localStorage` (key `nearbuy.one.v2`). Nothing is sent anywhere.

- Customer: **Riya Sharma** — Hauz Khas, South Delhi
- Shop: **Green Basket Market** — owner Riya, manager Aarav, inventory Sana
- Runners: **Rohan Kumar** (walking), Meena Joshi (bicycle), Farhan Ali (bicycle)
- Areas: Hauz Khas, Green Park, Saket · pricing bands from ₹10 to ₹25

Reset everything from **All workspaces → Reset demo data**, or the rail footer.

## Design system

- **One shell** — a 256 px navy rail (identity, workspace switcher, grouped navigation, demo notice) and a 68 px translucent top bar (breadcrumb, workspace pills, ⌘K search, cart, notifications, identity).
- **One accent per workspace** — marigold for Shop, green for Sell, blue for Deliver, violet for Fleet, teal for Ops. Everything else stays identical, so switching feels like moving rooms in the same building.
- **One rhythm** — 18 px gutters, 18 px card radii, 8-pt spacing steps, a single KPI card, table, list row, empty state, status pill, modal and toast.
- **Built to move** — hover lift on cards, staggered sparklines and bars, page-entry transitions, reduced-motion support.
- **Responsive by construction** — 5-up workspace pills collapse to icons, then to a switcher; the rail becomes a drawer; tables scroll; the mobile bottom bar mirrors each workspace's most-used views.

## Files

```
index.html            the universal homepage (3D marketing site)
home.css · home.js    homepage design system, tilt/parallax/reveal, tabs, chooser
about/ · help/        static public pages built on the same system
customer/ seller/ runner/
                      portal front doors; each redirects into its workspace
portal.html           NearBuy One — the unified product shell
nearbuy.css           product design system + every workspace style
nearbuy.js            data, store, router, five workspaces, flows, modals
classic.html · seller.html · partner.html · business.html · delivery-admin.html
                      earlier standalone pages (legacy, kept for reference)
public/assets/        brand mark + compressed 3D renders used by the homepage
```

## Brand

Deep navy `#081428`, marigold `#f47718`, cream `#fbf7f0` and white. Display type is Manrope, body type DM Sans, with system fallbacks. Cards are 16–26 px radius; motion is 200–700 ms on a single easing curve.

> **Prototype notice.** This is a simulated demo. Checkout charges nothing, no shop is contacted, no runner is dispatched, no OTP is sent, no payout or bank account exists, and no personal or sensitive information should be entered. Maps, distances and pricing are schematic. The proposed adult-only delivery policy and any real worker or business arrangement require qualified Indian legal review; this demo does not determine legal eligibility.
