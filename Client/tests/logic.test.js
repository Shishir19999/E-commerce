import test from 'node:test';
import assert from 'node:assert/strict';
import { motionAllowed, parallaxOffset, clamp } from '../src/lib/motion.js';
import { validateAddress, validateCard, formatCard } from '../src/lib/checkout.js';
import { parseVariants } from '../src/pages/Admin/variants.js';

test('motionAllowed: off for reduced motion, small screens and low-power devices', () => {
  assert.equal(motionAllowed({}), true);
  assert.equal(motionAllowed({ reducedMotion: true }), false);
  assert.equal(motionAllowed({ width: 600 }), false);
  assert.equal(motionAllowed({ saveData: true }), false);
  assert.equal(motionAllowed({ cores: 2 }), false);
  assert.equal(motionAllowed({ memory: 1 }), false);
});

test('parallaxOffset: zero when centred, signed, and clamped', () => {
  assert.equal(parallaxOffset({ top: 400, height: 200 }, 1000, 0.2), 0);
  assert.ok(parallaxOffset({ top: 0, height: 200 }, 1000, 0.2) > 0);
  assert.ok(parallaxOffset({ top: 800, height: 200 }, 1000, 0.2) < 0);
  assert.equal(parallaxOffset({ top: -5000, height: 200 }, 1000, 0.5, 90), 90);
  assert.equal(clamp(5, 0, 3), 3);
});

test('checkout validation', () => {
  assert.deepEqual(Object.keys(validateAddress({ name: '', phone: '1', street: '', city: '', zip: '' })).sort(), ['city', 'name', 'phone', 'street', 'zip']);
  assert.deepEqual(validateAddress({ name: 'Ann Lee', phone: '555-0100', street: '1 Main St', city: 'Springfield', zip: '12345' }), {});
  const now = new Date('2026-10-07');
  const ok = { holder: 'Ann Lee', number: '4242 4242 4242 4242', exp: '12/34', cvc: '123' };
  assert.deepEqual(validateCard(ok, now), {});
  assert.ok(validateCard({ ...ok, number: '4242 4242 4242 4241' }, now).number);
  assert.ok(validateCard({ ...ok, exp: '01/20' }, now).exp);
  assert.ok(validateCard({ ...ok, exp: '13/30' }, now).exp);
  assert.ok(validateCard({ ...ok, cvc: '12' }, now).cvc);
  assert.equal(formatCard('4242424242424242'), '4242 4242 4242 4242');
});

test('parseVariants', () => {
  assert.deepEqual(parseVariants('Color: Black, White | Size: S, M'), [{ name: 'Color', options: ['Black', 'White'] }, { name: 'Size', options: ['S', 'M'] }]);
  assert.deepEqual(parseVariants(''), []);
});

import { toCsv } from '../src/lib/csv.js';
import { deliveryWindow, taxAmount, orderTotal, sellerEarnings } from '../src/lib/pricing.js';
import { returnEligibility, sellerStatusError } from '../src/lib/rules.js';

test('toCsv: quoting, newlines and spreadsheet formula guard', () => {
  const csv = toCsv([{ a: 'x,y', b: '=SUM(1)', c: 'say "hi"', d: 5, e: 'line\nbreak', f: null }], [['A', (r) => r.a], ['B', (r) => r.b], ['C', (r) => r.c], ['D', (r) => r.d], ['E', (r) => r.e], ['F', (r) => r.f]]);
  assert.equal(csv, 'A,B,C,D,E,F\r\n"x,y",\'=SUM(1),"say ""hi""",5,"line\nbreak",\r\n');
  assert.equal(toCsv([{ n: -3 }], [['N', (r) => r.n]]), 'N\r\n-3\r\n'); // numbers are never treated as formulas
});

test('pricing: tax, totals, earnings, delivery window', () => {
  assert.equal(taxAmount(27, 0), 2.16);
  assert.equal(taxAmount(30, 3), 2.16);
  assert.equal(orderTotal(30, 3, 4.99, 2.16), 34.15);
  assert.equal(sellerEarnings(40), 36);
  const [a, b] = deliveryWindow('standard', '2026-01-01T00:00:00Z');
  assert.equal(a.toISOString().slice(0, 10), '2026-01-04');
  assert.equal(b.toISOString().slice(0, 10), '2026-01-06');
  assert.equal(deliveryWindow('teleport', Date.now()), null);
});

test('rules: return window and seller status moves', () => {
  const now = Date.parse('2026-03-01T00:00:00Z');
  const o = (over) => ({ status: 'Delivered', timeline: [{ status: 'Delivered', at: '2026-02-20T00:00:00Z' }], ...over });
  assert.equal(returnEligibility(o(), now).ok, true);
  assert.equal(returnEligibility(o({ status: 'Shipped' }), now).ok, false);
  assert.equal(returnEligibility(o({ returnRequest: { status: 'rejected' } }), now).ok, false);
  assert.match(returnEligibility(o({ timeline: [{ status: 'Delivered', at: '2026-01-01T00:00:00Z' }] }), now).reason, /window/);
  assert.equal(sellerStatusError('Processing', 'Shipped'), '');
  assert.ok(sellerStatusError('Shipped', 'Processing'));
  assert.ok(sellerStatusError('Processing', 'Cancelled'));
  assert.ok(sellerStatusError('Cancelled', 'Shipped'));
});
