import Stripe from "stripe";

// Stripe is optional: without STRIPE_SECRET_KEY the app uses the clearly-labelled mock payment path.
// Tests inject a fake client with app.set('stripe', fake).
let cached = null;
let cachedKey = null;

export const getStripe = (app) => {
  const injected = app?.get("stripe");
  if (injected) return injected;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!cached || cachedKey !== key) {
    cached = new Stripe(key);
    cachedKey = key;
  }
  return cached;
};
