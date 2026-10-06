# E-commerce

MERN e-commerce app: Express + Mongoose + JWT API (`/api/v1`) and a React 19 (Vite 8) client in `Client/`.

Requires Node.js 24 LTS (Docker images: node:24, nginx:1.30, mongo:8.0).
Payment: with no `STRIPE_SECRET_KEY` a clearly-labelled **mock** path is used (orders marked "paid (mock)", no real payment). With a Stripe **test** key, checkout redirects to Stripe Checkout and a webhook marks the order paid. The Stripe code is unit-tested with a mocked client only; the live Stripe flow has not been exercised.

## Setup

1. `npm install` in the root and in `Client`.
2. Copy `.env.example` to `.env` and fill in `PORT`, `DEV_MODE`, `MONGODB_URL`, `JWT_SECRET` (use a long random secret).
3. Copy `Client/.env.example` to `Client/.env` (`VITE_API_URL`, the API origin, default `http://localhost:8080`).
4. Start MongoDB, then `npm start` (API via `node --watch` + Vite client together), or `npm run start:server` for the API only.
5. Production client build: `cd Client && npm run build`.

### Seed demo data
`npm run seed` (idempotent and deterministic, uses `MONGODB_URL`; `--reset` also clears all orders first) creates 12 categories, 84 products
(picsum image URLs), 25 users and 60 orders (mixed statuses, totals consistent with line items, product stock reduced by non-cancelled orders).
Demo logins (password `Password123!`, local demo data only): `admin@example.com` and `manager@example.com` (admins), `user@example.com`.

### Making an admin
Registration always creates role 0 users. Promote one in MongoDB, e.g.
`db.users.updateOne({email:"you@example.com"},{$set:{role:1}})`, then log in again.

## Client routes

`/` products (search, category filter, sort, pagination) · `/product/:slug` · `/category` · `/cart` · `/login` · `/register` ·
`/checkout`, `/checkout/success`, `/checkout/cancel`, `/orders` (login required) · `/admin/categories`, `/admin/products`, `/admin/orders` (admin only).
Auth token and cart persist in `localStorage`.

## API

All responses look like `{ success, message, ... }`. Send `Authorization: Bearer <token>` where auth is required.

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/api/v1/auth/register` | public | new users always role 0 |
| POST | `/api/v1/auth/login` | public | returns `user` (incl. `role`) and `token` |
| GET | `/api/v1/auth/me` | user | current user; 401 if the user was deleted or the token revoked |
| POST | `/api/v1/auth/logout` | user | bumps `tokenVersion`: all tokens issued so far stop working |
| GET | `/api/v1/auth/test` | admin | test route |
| GET | `/api/v1/categories` | public | list |
| POST | `/api/v1/categories` | admin | `{name}` |
| PUT | `/api/v1/categories/:id` | admin | `{name}` |
| DELETE | `/api/v1/categories/:id` | admin | refused if it has products |
| GET | `/api/v1/products` | public | `page, limit (max 50), search, category (id or slug), sort=newest\|price_asc\|price_desc` |
| GET | `/api/v1/products/:slug` | public | |
| POST | `/api/v1/products` | admin | multipart or JSON: `name, description, price, quantity, category`, `photo` (http(s) URL, or an image file field, max 1 MB) |
| PUT | `/api/v1/products/:id` | admin | same fields, all optional |
| DELETE | `/api/v1/products/:id` | admin | |
| POST | `/api/v1/orders` | user | MOCK order `{items:[{product,quantity}], shippingAddress}`; prices computed server-side, stock decremented. 403 when Stripe is configured |
| GET | `/api/v1/payments/config` | public | `{mode: "stripe"|"mock"}` |
| POST | `/api/v1/payments/checkout` | user | same body; Stripe: reserves stock, creates a pending order + Checkout Session, returns `{mode:"stripe", url}`; no key: `{mode:"mock", order}` |
| POST | `/api/v1/payments/webhook` | Stripe signature | `checkout.session.completed` -> `paid (stripe)`; `checkout.session.expired` -> order cancelled and stock restored |
| GET | `/api/v1/orders/mine` | user | my orders |
| GET | `/api/v1/orders` | admin | `page, limit, status` |
| PUT | `/api/v1/orders/:id/status` | admin | `{status}`: Not Processed, Processing, Shipped, Delivered, Cancelled (cancelling restocks) |

Uploaded photos are saved in `uploads/` and served at `/uploads/<file>`.

## Payments (Stripe test mode)

Set in `.env`: `STRIPE_SECRET_KEY` (`sk_test_...`), `STRIPE_WEBHOOK_SECRET` (`whsec_...`) and `FRONTEND_URL` (success/cancel redirects go to `$FRONTEND_URL/checkout/success` and `/checkout/cancel`). Forward webhooks locally with
`stripe listen --forward-to localhost:8080/api/v1/payments/webhook` (it prints the `whsec_` value). Test card: 4242 4242 4242 4242.
Stock is reserved when the Stripe order is created and released if the session expires (31 minutes) or Stripe fails to create it.

## Sessions and logout

JWTs carry the user's `tokenVersion`; `POST /api/v1/auth/logout` increments it, so tokens issued before logout (on any device) are rejected. `requireSignIn` also checks that the user still exists, and `isAdmin` reads the role from the database.

## Tests

`npm test` (node:test + supertest). Needs local MongoDB; uses a throwaway database `ecommerce_test` (override with `TEST_MONGO_URI`) that is dropped afterwards. Stripe is mocked.

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
