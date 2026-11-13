# NearBuy Marketplace & Seller Hub Demo

A responsive, browser-only NearBuy customer marketplace and separate seller portal prototype. Run both locally with:

```bash
npm start
```

Then open `http://localhost:4173`.

## Demo customer accounts

All accounts use the password **`NearBuy123!`**. You can sign in with any one-click demo profile in the sign-in dialog or enter the credentials manually.

| Customer | Email | Sample area |
| --- | --- | --- |
| Riya Sharma | `riya@nearbuy.demo` | Hauz Khas |
| Aarav Mehta | `aarav@nearbuy.demo` | Saket |
| Sana Khan | `sana@nearbuy.demo` | Greater Kailash |

## Included demo flows

- Browse local shops, categories and sample products; search by product, shop or product ID.
- Select a neighbourhood, open shop/product details, and save products.
- Add products to a cart, use `LOCAL10`, choose delivery or pickup, and create a sample order.
- Manage profile and saved delivery addresses; view payments and order notifications.
- Follow local shops, request a demo return/refund, save private product reviews, inspect order progress, cancel an eligible order, or reorder.
- Filter and sort product listings; shop listings can be filtered and sorted too.
- Saved items, cart, selected area, addresses and demo-created account data persist in the browser using local storage.

## Seller Hub demo

Open [`/seller.html`](http://localhost:4173/seller.html) or use **Open Seller Hub demo** in the customer-site footer. Seller demo accounts share the password **`Seller123!`**:

| Demo teammate | Email | Role |
| --- | --- | --- |
| Riya Sharma | `owner@nearbuy.demo` | Shop owner |
| Aarav Mehta | `manager@nearbuy.demo` | Shop manager |
| Sana Khan | `inventory@nearbuy.demo` | Inventory manager |

The responsive Seller Hub includes an overview, order queue and simulated fulfilment statuses, editable catalogue and stock counts, returns, sample earnings/settlements, promotions, insights, shop settings, support, team access, and notifications. In **Delivery & pickup**, a prepared sample order can be routed to the Runner demo, recorded for the shop’s own delivery staff, or prepared for customer pickup.

## NearBuy Runner & delivery network demos

- [`/partner.html`](http://localhost:4173/partner.html) — public partner landing and responsive Runner partner app: adult age-gate explainer, online/offline control, flexible distance/category preferences, sample request cards, accept/pass, pickup and customer OTP workflow, task history, earnings, privacy, safety and local support.
- [`/business.html`](http://localhost:4173/business.html) — neighbourhood business/fleet portal: roster of adult demo profiles, simulated work allocation and reporting.
- [`/delivery-admin.html`](http://localhost:4173/delivery-admin.html) — operations control-tower demo: sample partner eligibility records, manual dispatch to online adult demo profiles, service-area and proposed pricing controls, incident log and local audit trail.

The Seller Hub, Runner, Business and Admin demos share delivery tasks through browser local storage. A Seller Hub Runner request appears in the Runner queue; simulated partner acceptance, pickup and delivery statuses can then be seen back in Seller Hub. All partner accounts are one-click **adult demo profiles** (ages 21–31); there are no real credentials or applications. The age eligibility check rejects anyone under 18 for this proposed demo launch policy.

**Prototype notice:** all sign-in, tasks, matching, team access, KYC states, pricing, earnings, incident reports and settlement views are simulated and stored in the browser. There is no backend, identity/business verification, secure OTP, live inventory/location sync, masked calling, real runner dispatch, emergency response, payment processing, UPI/bank account, insurance, or actual payout. Maps and distances are schematic. Sample earnings are not promised rates. No personal or sensitive information should be entered. The proposed adult-only delivery policy and any real worker/business arrangement require qualified Indian legal review; this demo does not determine legal eligibility.

**Customer prototype notice:** checkout does not charge a payment method, contact a shop, or dispatch a runner. Customer data is sample/demo data only; do not enter real sensitive information.
