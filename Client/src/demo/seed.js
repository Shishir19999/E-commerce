// Seed data for the browser-only demo. Pure functions: no DOM, no import.meta.
import { makeArt } from '../lib/art.js';

export const DEMO_PASSWORD = 'Password123!';
export const DEMO_ACCOUNTS = [
  { role: 'Customer', email: 'user@example.com', password: DEMO_PASSWORD },
  { role: 'Admin', email: 'admin@example.com', password: DEMO_PASSWORD },
];

export const slugify = (s) =>
  String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const DAY = 86400000;

// tiny deterministic PRNG so every visitor starts from the same store
const rng = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const hex = (prefix, n) => (prefix + n.toString(16).padStart(6, '0')).padEnd(24, '0').slice(0, 24);

const COLOR = { name: 'Color', options: ['Black', 'Silver', 'White'] };
const SIZE = { name: 'Size', options: ['S', 'M', 'L', 'XL'] };
const FASHION_COLOR = { name: 'Color', options: ['Black', 'Navy', 'Sand'] };

// [category, hue, [ [name, price, glyph, description, { compareAt, stock, variants, featured }] ]]
const CATALOG = [
  ['Electronics', 232, [
    ['Aurora Wireless Headphones', 89.99, 'audio', 'Over-ear Bluetooth headphones with 40 hours of battery life, soft memory-foam cushions and a built-in microphone for calls.', { compareAt: 119.99, stock: 64, variants: [COLOR], featured: true }],
    ['Pulse Smart Watch', 129, 'watch', 'Tracks heart rate, sleep and workouts, with a bright always-on display and a week of battery life per charge.', { stock: 41, variants: [COLOR], featured: true }],
    ['Cube Portable Speaker', 49.5, 'speaker', 'Pocket-sized waterproof speaker with deep bass, 12 hours of playtime and stereo pairing.', { stock: 88, variants: [COLOR] }],
    ['Vista 4K Action Camera', 159, 'camera', 'Shoots stabilised 4K video at 60 fps. Comes with a waterproof case and a mounting kit for bikes and helmets.', { compareAt: 189, stock: 9 }],
    ['TypeRight Mechanical Keyboard', 74.9, 'keyboard', 'Compact 75% layout with hot-swappable switches, per-key backlight and a USB-C braided cable.', { stock: 52, variants: [{ name: 'Switch', options: ['Linear', 'Tactile', 'Clicky'] }] }],
    ['Volt 65W USB-C Charger', 29.99, 'box', 'Charges a laptop, tablet and phone at once with two USB-C ports and one USB-A. Folding plug fits any bag.', { stock: 120 }],
  ]],
  ['Fashion', 332, [
    ['Harbor Denim Jacket', 64, 'shirt', 'Mid-weight rigid denim with a classic fit, brass buttons and two chest pockets. Gets better with every wash.', { stock: 36, variants: [SIZE, FASHION_COLOR], featured: true }],
    ['Stride Running Sneakers', 74.99, 'shoe', 'Breathable knit upper, responsive foam midsole and a grippy outsole for road and treadmill runs.', { compareAt: 99.99, stock: 58, variants: [{ name: 'Size', options: ['7', '8', '9', '10', '11'] }] }],
    ['Everyday Cotton Tee', 14.5, 'shirt', 'Soft combed cotton crew neck in a relaxed fit. Pre-shrunk, so it keeps its shape.', { stock: 200, variants: [SIZE, FASHION_COLOR] }],
    ['Metro Canvas Backpack', 44, 'bag', 'Water-resistant canvas daypack with a padded 15-inch laptop sleeve and quick-access side pockets.', { stock: 4, variants: [FASHION_COLOR] }],
    ['Tailored Slim Chinos', 39.9, 'shirt', 'Stretch cotton twill with a tapered leg that works from the office to the weekend.', { stock: 73, variants: [SIZE, FASHION_COLOR] }],
    ['Alpine Wool Scarf', 19.99, 'sparkle', 'A warm, lightly brushed wool blend scarf, 180 cm long, with a subtle herringbone weave.', { stock: 90, variants: [FASHION_COLOR] }],
  ]],
  ['Home & Kitchen', 24, [
    ['Stoneware Mug Set of 4', 24, 'cup', 'Hand-glazed stoneware mugs, 350 ml each. Microwave and dishwasher safe.', { stock: 80, featured: true }],
    ['Ember Non-stick Frying Pan', 32.75, 'cup', 'A 28 cm pan with a ceramic non-stick coating, even heat spread and a stay-cool handle. Works on induction.', { stock: 47 }],
    ['Brew 1.7L Electric Kettle', 27.5, 'cup', 'Rapid-boil stainless kettle with auto shut-off, boil-dry protection and a removable limescale filter.', { compareAt: 34.5, stock: 61 }],
    ['Bamboo Cutting Board', 16.99, 'box', 'Large reversible board with a juice groove. Gentle on knives and easy to keep clean.', { stock: 95 }],
    ['CloudRest Memory Foam Pillow', 34, 'box', 'Contoured memory foam with a cooling gel layer and a washable bamboo cover.', { stock: 7 }],
    ['Crisp Air Fryer 5L', 89, 'box', 'Cooks with up to 80 percent less oil. Digital presets for fries, chicken, fish and baking.', { compareAt: 109, stock: 29 }],
  ]],
  ['Sports & Fitness', 152, [
    ['Grip Yoga Mat 6mm', 22, 'dumbbell', 'Non-slip, cushioned mat with alignment lines, plus a carry strap. 183 x 61 cm.', { stock: 110, featured: true }],
    ['IronCore Adjustable Dumbbells', 139, 'dumbbell', 'Dial from 2 to 24 kg in 2 kg steps. Replaces twelve pairs of weights and fits under a bed.', { stock: 18 }],
    ['FlexBand Resistance Set', 18.99, 'dumbbell', 'Five latex bands from light to extra heavy, with a door anchor, handles and a carry bag.', { stock: 140 }],
    ['Frost Insulated Bottle 750ml', 21.5, 'bottle', 'Double-wall steel keeps drinks cold for 24 hours or hot for 12. Leak-proof lid, fits cup holders.', { stock: 0, variants: [COLOR] }],
    ['Sprint Jump Rope', 11.99, 'dumbbell', 'Speed rope with ball bearings and an adjustable steel cable. Includes spare cable and screws.', { stock: 84 }],
    ['Roll Out Foam Roller', 25, 'dumbbell', 'High-density 45 cm roller that eases tight muscles after training. Textured surface for deeper work.', { stock: 52 }],
  ]],
  ['Books', 42, [
    ['Mastering JavaScript', 39, 'book', 'A practical guide to modern JavaScript, from closures and async code to testing and tooling.', { stock: 60 }],
    ['The Pragmatic Programmer', 44.95, 'book', 'Timeless advice on craft, habits and tools for writing software that lasts. 20th anniversary edition.', { stock: 45, featured: true }],
    ['Atomic Habits', 16.5, 'book', 'Small changes that compound. A clear framework for building good habits and breaking bad ones.', { compareAt: 22, stock: 150 }],
    ['Weeknight Cookbook', 27, 'book', '100 dinners in 30 minutes or less, with shopping lists and substitution tips for busy households.', { stock: 70 }],
    ['Illustrated World Atlas', 35, 'book', 'Updated maps, country profiles and infographics in a hardcover edition that is a pleasure to browse.', { stock: 33 }],
    ['Introduction to Algorithms', 89, 'book', 'The standard university text on data structures and algorithms, with exercises in every chapter.', { stock: 21 }],
  ]],
  ['Beauty', 304, [
    ['Glow Vitamin C Serum', 18.5, 'bottle', 'Brightening 15 percent vitamin C serum with hyaluronic acid. Fragrance-free, for all skin types.', { stock: 130, featured: true }],
    ['Dew Hydrating Moisturizer', 15.99, 'bottle', 'Lightweight gel-cream that keeps skin hydrated for 48 hours. Non-greasy under makeup.', { stock: 115 }],
    ['Shield Mineral Sunscreen SPF50', 17.25, 'bottle', 'Broad spectrum zinc sunscreen with no white cast. Water resistant for 80 minutes.', { compareAt: 21, stock: 6 }],
    ['Argan Repair Shampoo', 12.49, 'bottle', 'Sulfate-free formula with argan oil that cleans gently and leaves hair smooth and shiny.', { stock: 98 }],
    ['Velvet Matte Lipstick Trio', 21, 'sparkle', 'Three long-wear matte shades in a travel case. Comfortable, non-drying finish.', { stock: 64 }],
    ['Spin Facial Cleansing Brush', 36, 'sparkle', 'Waterproof sonic brush with two speeds and a soft silicone head. USB rechargeable.', { stock: 39 }],
  ]],
  ['Toys & Games', 196, [
    ['BrickWorld 500 Piece Set', 29.99, 'toy', 'Compatible building bricks with an idea booklet. Encourages creativity for ages 6 and up.', { stock: 77 }],
    ['Dash Remote Control Car', 42, 'toy', 'Fast 2.4 GHz off-road car with rechargeable battery and shock-absorbing tyres. Ages 8 and up.', { stock: 26 }],
    ['Empire Strategy Board Game', 34.5, 'toy', 'Build, trade and outsmart your rivals in 60 minutes. For 2 to 5 players, ages 10 and up.', { compareAt: 44, stock: 31, featured: true }],
    ['Cuddle Bear Plush', 18, 'toy', 'Ultra-soft 35 cm teddy bear, machine washable and safe from birth.', { stock: 88 }],
    ['Skyline 1000 Piece Puzzle', 15.99, 'toy', 'A city skyline at dusk printed on thick, glare-free cardboard with a poster guide.', { stock: 59 }],
    ['Timber Wooden Train Set', 38, 'toy', '40-piece wooden railway with bridges, tunnels and two engines. Works with major brands of track.', { stock: 15 }],
  ]],
  ['Garden & Outdoor', 128, [
    ['Trim Cordless Hedge Trimmer', 98, 'leaf', '20V cordless trimmer with a 55 cm dual-action blade and a 45 minute battery.', { stock: 22 }],
    ['Gardener Tool Set of 5', 31.99, 'leaf', 'Hand trowel, transplanter, cultivator, pruners and gloves in rust-resistant steel with soft grips.', { stock: 66 }],
    ['Summit 4 Person Tent', 129, 'leaf', 'Two-room dome tent with a rain fly, taped seams and a pre-bent pole system for a 10 minute setup.', { compareAt: 159, stock: 12, featured: true }],
    ['Glow Solar Path Lights 8 Pack', 35, 'lamp', 'Weatherproof stake lights that charge by day and glow warm white for up to 10 hours at night.', { stock: 54 }],
    ['Roam Folding Camp Chair', 24.99, 'chair', 'Lightweight steel frame, breathable mesh back and a cup holder. Packs into its own carry bag.', { stock: 73 }],
    ['Terra Ceramic Planter', 19.5, 'leaf', 'Glazed 25 cm planter with a drainage hole and saucer. Suits herbs, succulents and small shrubs.', { stock: 3 }],
  ]],
];

const COMMENTS = {
  5: ['Absolutely love it. Better than expected.', 'Excellent quality and it arrived quickly.', 'Worth every cent. Would buy again.', 'Five stars, no complaints at all.'],
  4: ['Very good overall. Does what it promises.', 'Great value for the price, small nitpicks only.', 'Solid quality and nicely packaged.', 'Happy with it. Setup was easy.'],
  3: ['It is fine. Does the job but nothing special.', 'Decent, though I expected a little more.', 'Average quality, fair price.'],
  2: ['Not as described, a bit disappointing.', 'Feels cheaper than the photos suggest.'],
};

const FIRST = ['Maya', 'Liam', 'Sofia', 'Noah', 'Aria', 'Ethan', 'Zara', 'Lucas', 'Nina', 'Owen', 'Ivy', 'Leo'];
const LAST = ['Patel', 'Nguyen', 'Garcia', 'Kim', 'Rossi', 'Haddad', 'Okafor', 'Silva', 'Novak', 'Tanaka', 'Berg', 'Costa'];

export function buildSeed(passwordHash, now = Date.now()) {
  const rand = rng(20261007);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const between = (a, b) => a + Math.floor(rand() * (b - a + 1));

  // users
  const users = [
    { _id: hex('a1', 1), name: 'Demo Admin', email: 'admin@example.com', phone: '555-0100', address: '1 Market Street, Springfield', role: 1 },
    { _id: hex('a1', 2), name: 'Demo Customer', email: 'user@example.com', phone: '555-0101', address: '24 Maple Avenue, Springfield', role: 0 },
  ];
  FIRST.forEach((f, i) =>
    users.push({
      _id: hex('a1', i + 3),
      name: `${f} ${LAST[i]}`,
      email: `${f.toLowerCase()}.${LAST[i].toLowerCase()}@example.com`,
      phone: `555-02${String(i).padStart(2, '0')}`,
      address: `${between(10, 990)} ${pick(['Oak', 'Pine', 'Cedar', 'Elm', 'Lake'])} Road, ${pick(['Riverton', 'Fairview', 'Lakeside'])}`,
      role: 0,
    })
  );
  users.forEach((u, i) => Object.assign(u, { passwordHash, wishlist: [], tokenVersion: 0, createdAt: new Date(now - (60 - i * 3) * DAY).toISOString() }));

  // categories + products
  const categories = [];
  const products = [];
  let pn = 0;
  CATALOG.forEach(([cname, hue, list], ci) => {
    const cat = { _id: hex('c1', ci + 1), name: cname, slug: slugify(cname), createdAt: new Date(now - 90 * DAY).toISOString() };
    categories.push(cat);
    list.forEach(([name, price, glyph, description, o = {}]) => {
      pn++;
      const h = (hue + pn * 7) % 360;
      products.push({
        _id: hex('b1', pn),
        name,
        slug: slugify(name),
        description,
        price,
        compareAtPrice: o.compareAt || 0,
        category: cat._id,
        quantity: o.stock ?? 50,
        photo: makeArt(h, glyph, 0),
        images: [makeArt(h, glyph, 1), makeArt(h, glyph, 2), makeArt(h, glyph, 3)],
        variants: o.variants || [],
        featured: !!o.featured,
        rating: 0,
        numReviews: 0,
        sold: 0,
        createdAt: new Date(now - (90 - pn) * DAY).toISOString(),
        updatedAt: new Date(now - (90 - pn) * DAY).toISOString(),
      });
    });
  });

  // reviews
  const customers = users.filter((u) => u.role === 0);
  const reviews = [];
  products.forEach((p) => {
    const n = between(0, 5);
    const authors = [...customers].sort(() => rand() - 0.5).slice(0, n);
    authors.forEach((u) => {
      const rating = pick([5, 5, 5, 4, 4, 4, 3, 2]);
      reviews.push({
        _id: hex('d1', reviews.length + 1),
        product: p._id,
        user: u._id,
        userName: u.name,
        rating,
        comment: pick(COMMENTS[rating]),
        verified: rand() > 0.35,
        createdAt: new Date(now - between(1, 80) * DAY).toISOString(),
      });
    });
  });
  products.forEach((p) => recalcRating(p, reviews));

  // coupons
  const coupons = [
    { _id: hex('e1', 1), code: 'WELCOME10', description: '10% off your first order', type: 'percent', value: 10, minSubtotal: 0, expiresAt: null, usageLimit: 0, used: 14, active: true },
    { _id: hex('e1', 2), code: 'SAVE5', description: '$5 off orders over $40', type: 'fixed', value: 5, minSubtotal: 40, expiresAt: null, usageLimit: 0, used: 9, active: true },
    { _id: hex('e1', 3), code: 'BIGSPEND25', description: '25% off orders over $150', type: 'percent', value: 25, minSubtotal: 150, expiresAt: null, usageLimit: 50, used: 3, active: true },
    { _id: hex('e1', 4), code: 'SUMMER20', description: 'Expired summer sale (example of an expired coupon)', type: 'percent', value: 20, minSubtotal: 0, expiresAt: new Date(now - 30 * DAY).toISOString(), usageLimit: 0, used: 41, active: true },
  ];

  // orders spread across the last 45 days (so the dashboard charts have shape)
  const flow = ['Not Processed', 'Processing', 'Shipped', 'Delivered'];
  const notes = ['Order placed', 'Being packed at the warehouse', 'Handed to the carrier', 'Delivered to the address'];
  const orders = [];
  for (let i = 0; i < 44; i++) {
    const u = pick(customers);
    const age = Math.floor(Math.pow(rand(), 1.4) * 45);
    const createdAt = now - age * DAY - between(0, 80000) * 1000;
    const picks = [...products].sort(() => rand() - 0.5).slice(0, between(1, 3));
    const items = picks.map((p) => ({ product: p._id, name: p.name, price: p.price, quantity: between(1, 2), variant: p.variants[0]?.options[0] || '', photo: p.photo }));
    const subtotal = Math.round(items.reduce((s, it) => s + it.price * it.quantity, 0) * 100) / 100;
    const shippingMethod = pick(['standard', 'standard', 'express', 'pickup']);
    const shipping = shippingMethod === 'express' ? 12.99 : shippingMethod === 'standard' && subtotal < 50 ? 4.99 : 0;
    let status = age > 12 ? pick(['Delivered', 'Delivered', 'Delivered', 'Cancelled']) : age > 4 ? pick(['Shipped', 'Delivered', 'Processing']) : pick(['Not Processed', 'Processing', 'Not Processed']);
    if (i < 3) status = 'Not Processed';
    const steps = status === 'Cancelled' ? [{ status: 'Not Processed', note: notes[0] }, { status: 'Cancelled', note: 'Cancelled at the customer request' }] : flow.slice(0, flow.indexOf(status) + 1).map((s, k) => ({ status: s, note: notes[k] }));
    const timeline = steps.map((s, k) => ({ ...s, at: new Date(Math.min(now, createdAt + k * 0.8 * DAY)).toISOString() }));
    if (status !== 'Cancelled') items.forEach((it) => (products.find((p) => p._id === it.product).sold += it.quantity));
    orders.push({
      _id: hex('f1', i + 1),
      user: u._id,
      items,
      subtotal,
      discount: 0,
      shipping,
      couponCode: '',
      shippingMethod,
      total: Math.round((subtotal + shipping) * 100) / 100,
      shippingAddress: `${u.name}, ${u.address} - ${u.phone}`,
      status,
      timeline,
      payment: { method: 'mock', status: status === 'Cancelled' ? 'refunded (mock)' : 'paid (mock)' },
      createdAt: new Date(createdAt).toISOString(),
      updatedAt: timeline[timeline.length - 1].at,
    });
  }
  orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return { version: 1, seededAt: new Date(now).toISOString(), users, categories, products, reviews, coupons, orders };
}

export function recalcRating(product, reviews) {
  const mine = reviews.filter((r) => r.product === product._id);
  product.numReviews = mine.length;
  product.rating = mine.length ? Math.round((mine.reduce((s, r) => s + r.rating, 0) / mine.length) * 10) / 10 : 0;
}
