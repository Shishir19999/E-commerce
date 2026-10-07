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
