# ShopLane (E-commerce)

A full-stack online store: a React 19 + Vite client (`Client/`) and an Express + Mongoose + JWT API (`/api/v1`) at the repository root. The same UI also runs as a **browser-only demo** with sample data and no backend.

**Live demo:** https://shishir19999.github.io/E-commerce/

Requires Node.js 24 LTS (Docker images: node:24, nginx:1.30, mongo:8.0).

## Two ways to run it

### 1. Browser-only demo (no server, no database)

```
cd Client
npm install
npm run dev:demo        # local dev server with the in-browser backend
npm run build:pages     # static build for GitHub Pages -> Client/dist (base path /E-commerce/)
npm run preview:pages   # serve that build locally
```

`VITE_DEMO=true` (set by those scripts) swaps the API layer for an in-browser backend with the same routes, validation and response shapes as the Express API. It seeds 48 products in 8 categories, reviews, coupons, users and orders, persists to `localStorage`, adds realistic latency and uses a mock payment. A "Demo mode" banner is always shown, with a **Reset demo data** button. The build uses a hash router, so deep links and refreshes work under the `/E-commerce/` sub-path. Publish the contents of `Client/dist` to the `gh-pages` branch.

**Demo logins** (shown on the login screen as one-click buttons; password `Password123!`):

| Role | Email |
|---|---|
| Customer | `user@example.com` |
| Admin | `admin@example.com` |

Coupon codes to try: `WELCOME10` (10% off), `SAVE5` ($5 off over $40), `BIGSPEND25` (25% off over $150). `SUMMER20` is deliberately expired.

### 2. Full stack (Express + MongoDB, optional Stripe test mode)

1. `npm install` in the root and in `Client`.
2. Copy `.env.example` to `.env` and fill in `PORT`, `DEV_MODE`, `MONGODB_URL`, `JWT_SECRET` (a long random secret).
3. Copy `Client/.env.example` to `Client/.env` (`VITE_API_URL`, the API origin, default `http://localhost:8080`).
4. Start MongoDB, then `npm start` (API via `node --watch` plus the Vite client), or `npm run start:server` for the API only.
5. Optional sample data: `npm run seed` (idempotent; `--reset` also clears orders). It creates 12 categories, 84 products, 25 users, coupons and 60 orders. Same demo logins as above (`manager@example.com` is a second admin).
6. Production client build: `cd Client && npm run build`.

With no `STRIPE_SECRET_KEY` a clearly labelled **mock** payment path is used (orders are marked "paid (mock)"). With a Stripe **test** key, checkout redirects to Stripe Checkout and a webhook marks the order paid. The Stripe code is unit-tested with a mocked client only; the live Stripe flow has not been exercised.

## Features

- **Catalogue:** category, price slider, rating and in-stock filters, six sort orders, grid/list toggle, pagination, filters kept in the URL, search box with live suggestions (keyboard accessible).
- **Product page:** gallery with thumbnails and hover/tap zoom, variants (colour, size, ...), stock and discount badges, reviews with 1-5 stars, rating breakdown and verified-purchase flag, related products, recently viewed.
- **Wishlist** (per account) and a **cart drawer** with quantity steppers and coupon codes (plus a full cart page).
- **Checkout:** address, shipping method (standard / express / pickup, free standard shipping over $50), mock card form with inline validation, review step and a live summary. Totals, coupons and stock are always recomputed on the server.
- **Orders:** history, tracking timeline and progress bar, customer cancellation (restocks), printable invoice.
- **Admin:** dashboard (revenue and orders charts, low-stock alerts, top sellers, status counts), product CRUD (variants, compare-at price, featured, gallery), categories, orders with status notes, coupons, users and roles.
- **UX:** design tokens, light/dark theme (follows the system, remembered), responsive down to 320px, skeleton loaders, empty and error states, toasts, confirm dialogs, inline form validation, 404 page, lazy-loaded images, skip link and ARIA labelling.

### Parallax and scroll reveal

The home page hero, category banners, featured section background and promo banner use a small parallax and scroll-reveal system (`Client/src/lib/motion.js`): `IntersectionObserver` plus `requestAnimationFrame`, no libraries, only `transform` and `opacity`. It is switched off for `prefers-reduced-motion`, viewports under 768px, data-saver and low-power devices (2 cores or fewer, 2 GB memory or less), and it is never used on the cart, checkout or admin screens.

## Tests and checks

```
npm test                       # API tests (node:test + supertest; needs local MongoDB, throwaway DB dropped afterwards)
cd Client && npm test          # demo backend, motion, checkout validation (node:test, no browser)
cd Client && npm run lint && npm run build
```

## Client routes

`/` home · `/shop` (filters via query string) · `/product/:slug` · `/cart` · `/login` · `/register` · `/wishlist`, `/profile`, `/checkout`, `/checkout/success`, `/checkout/cancel`, `/orders`, `/orders/:id`, `/orders/:id/invoice` (sign-in required) · `/admin`, `/admin/products`, `/admin/categories`, `/admin/orders`, `/admin/coupons`, `/admin/users` (admin only). In the demo build the same paths live after `#`.

## Making an admin

Registration always creates role 0 users. Promote one in MongoDB, e.g.
`db.users.updateOne({email:"you@example.com"},{$set:{role:1}})`, then log in again. Admins can also change roles under Admin > Users.

## API

All responses look like `{ success, message, ... }`. Send `Authorization: Bearer <token>` where auth is required.

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/api/v1/auth/register`, `/login` | public | new users always role 0 |
| GET | `/api/v1/auth/me` | user | 401 if the user was deleted or the token revoked |
| PUT | `/api/v1/auth/profile` | user | name, phone, address |
| POST | `/api/v1/auth/logout` | user | bumps `tokenVersion`: earlier tokens stop working |
| GET | `/api/v1/categories` | public | list |
| POST/PUT/DELETE | `/api/v1/categories[/:id]` | admin | delete refused if it has products |
| GET | `/api/v1/products` | public | `page, limit, search, category (id or slug), sort (newest, popular, rating, price_asc, price_desc, name), minPrice, maxPrice, minRating, inStock, featured, ids` |
| GET | `/api/v1/products/:slug`, `/:slug/related` | public | |
| POST/PUT/DELETE | `/api/v1/products[/:id]` | admin | multipart or JSON; `variants`, `images`, `compareAtPrice`, `featured`; photo URL or image file (max 1 MB) |
| GET/POST/DELETE | `/api/v1/reviews[/:id]` | public / user | one review per user and product; the rating aggregate is kept on the product |
| GET/POST/DELETE | `/api/v1/wishlist[/:productId]` | user | |
| POST | `/api/v1/coupons/validate` | public | `{code, subtotal}` |
| GET/POST/PUT/DELETE | `/api/v1/coupons[/:id]` | admin | |
| GET | `/api/v1/payments/config` | public | `{mode: "stripe" or "mock"}` |
| POST | `/api/v1/payments/checkout` | user | `{items:[{product,quantity,variant?}], shippingAddress, shippingMethod?, couponCode?}`; Stripe: returns `{mode:"stripe", url}`; otherwise the mock order |
| POST | `/api/v1/payments/webhook` | Stripe signature | paid / expired handling |
| GET | `/api/v1/orders/mine`, `/:id` | user | owner (or admin for `/:id`) |
| POST | `/api/v1/orders/:id/cancel` | owner | only before shipping; restocks |
| GET | `/api/v1/orders` | admin | `page, limit, status` |
| PUT | `/api/v1/orders/:id/status` | admin | `{status, note?}`; cancelling restocks |
| GET | `/api/v1/admin/stats` | admin | revenue/orders series, low stock, top products |
| GET/PUT/DELETE | `/api/v1/admin/users[/:id[/role]]` | admin | cannot change or delete yourself |

Uploaded photos are saved in `uploads/` and served at `/uploads/<file>`.

## Payments (Stripe test mode)

Set in `.env`: `STRIPE_SECRET_KEY` (`sk_test_...`), `STRIPE_WEBHOOK_SECRET` (`whsec_...`) and `FRONTEND_URL` (success/cancel redirects go to `$FRONTEND_URL/checkout/success` and `/checkout/cancel`). Forward webhooks locally with
`stripe listen --forward-to localhost:8080/api/v1/payments/webhook` (it prints the `whsec_` value). Test card: 4242 4242 4242 4242.
Stock is reserved when the Stripe order is created and released if the session expires (31 minutes) or Stripe fails to create it.

## Sessions and logout

JWTs carry the user's `tokenVersion`; `POST /api/v1/auth/logout` increments it, so tokens issued before logout (on any device) are rejected. `requireSignIn` also checks that the user still exists, and `isAdmin` reads the role from the database.

## Deploy with Docker

```
export JWT_SECRET=$(openssl rand -hex 32)      # required
# optional: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, FRONTEND_URL, VITE_API_URL
docker compose up --build
```

Client (nginx) on http://localhost:8081, API on http://localhost:8080, MongoDB data in the `mongo-data` volume, uploaded photos in the `uploads` volume.
`VITE_API_URL` is baked into the client at build time: set it to the public API URL before building for a real host, and set `FRONTEND_URL` to the public client URL.
Create an admin as described in "Making an admin" (e.g. `docker compose exec mongo mongosh ecommerce --eval 'db.users.updateOne({email:"you@example.com"},{$set:{role:1}})'`), or load demo data with `INSTALL_DEV=true docker compose up --build -d` then `docker compose exec backend npm run seed`.
In production, terminate TLS in front (reverse proxy / load balancer) and restrict CORS.
