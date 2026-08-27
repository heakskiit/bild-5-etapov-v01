/**
 * Standalone sanity check for the price engine — run with `npm run verify:pricing`.
 * It exercises the invariants that protect revenue:
 *   1. tiered discount is progressive (average $/million falls monotonically)
 *   2. delivery modifiers add exactly 0 / 30 / 60 percent
 *   3. invalid selections throw rather than silently price at 0
 *   4. add-ons cannot cross the PC / console boundary
 */

import assert from 'node:assert/strict';
import { calculatePrice, tieredPrice, PricingError } from '../src/lib/pricing/calculate.ts';
import { MONEY_PC, DELIVERY_MODIFIERS } from '../config/pricing.config.ts';

let checks = 0;
const check = (name: string, fn: () => void) => {
  fn();
  checks++;
  console.log(`  ok  ${name}`);
};

console.log('pricing engine');

check('progressive discount: average $/m strictly decreases', () => {
  let previousAverage = Infinity;
  for (let m = MONEY_PC.minMillions; m <= MONEY_PC.maxMillions; m += MONEY_PC.step) {
    const average = tieredPrice(m, MONEY_PC.tiers) / m;
    assert.ok(average <= previousAverage + 1e-12, `average rose at ${m}m`);
    previousAverage = average;
  }
  const cheapest = tieredPrice(5000, MONEY_PC.tiers) / 5000;
  const dearest = tieredPrice(100, MONEY_PC.tiers) / 100;
  assert.ok(cheapest < dearest * 0.75, 'top of the slider should be materially cheaper per million');
});

check('marginal maths: 500m equals the first tier exactly', () => {
  assert.equal(tieredPrice(500, MONEY_PC.tiers), 500 * 0.09);
  // 600m = 500 @ 0.09 + 100 @ 0.07
  assert.ok(Math.abs(tieredPrice(600, MONEY_PC.tiers) - (500 * 0.09 + 100 * 0.07)) < 1e-9);
});

check('delivery modifiers are exactly +0% / +30% / +60%', () => {
  const base = { product: 'money', platform: 'ps', amountMillions: 100 } as const;
  const normal = calculatePrice({ ...base, delivery: 'normal' }).total;
  const express = calculatePrice({ ...base, delivery: 'express' }).total;
  const superExpress = calculatePrice({ ...base, delivery: 'super_express' }).total;
  assert.ok(Math.abs(express - normal * 1.3) < 0.01, `${express} vs ${normal * 1.3}`);
  assert.ok(Math.abs(superExpress - normal * 1.6) < 0.01);
  assert.equal(DELIVERY_MODIFIERS.super_express, 0.6);
});

check('booster payout is 50% of the service total, 0 for codes', () => {
  const boost = calculatePrice({ product: 'money', platform: 'xbox', amountMillions: 50 });
  assert.ok(Math.abs(boost.boosterPayout - boost.total * 0.5) < 0.01);
  const code = calculatePrice({ product: 'shark_card', platform: 'pc', variantId: 'sc_1m' });
  assert.equal(code.boosterPayout, 0);
});

check('console level must come from the fixed dropdown', () => {
  assert.doesNotThrow(() => calculatePrice({ product: 'leveling', platform: 'ps', level: 120 }));
  assert.throws(
    () => calculatePrice({ product: 'leveling', platform: 'ps', level: 121 }),
    (e: unknown) => e instanceof PricingError && e.code === 'UNKNOWN_VARIANT',
  );
});

check('PC slider bounds and step are enforced', () => {
  assert.throws(() => calculatePrice({ product: 'money', platform: 'pc', amountMillions: 99 }));
  assert.throws(() => calculatePrice({ product: 'money', platform: 'pc', amountMillions: 6000 }));
  assert.throws(() => calculatePrice({ product: 'money', platform: 'pc', amountMillions: 125 }));
  assert.doesNotThrow(() => calculatePrice({ product: 'money', platform: 'pc', amountMillions: 150 }));
  assert.throws(() => calculatePrice({ product: 'leveling', platform: 'pc', level: 8001 }));
});

check('add-ons cannot cross the PC / console boundary', () => {
  assert.throws(
    () => calculatePrice({ product: 'leveling', platform: 'ps', level: 100, addonIds: ['pc_lvl_unlock_all'] }),
    (e: unknown) => e instanceof PricingError && e.code === 'UNKNOWN_ADDON',
  );
  assert.doesNotThrow(() =>
    calculatePrice({ product: 'leveling', platform: 'ps', level: 100, addonIds: ['con_lvl_cayo'] }),
  );
});

check('"together cheaper" reduces the total, priority queue raises it', () => {
  const plain = calculatePrice({ product: 'leveling', platform: 'pc', level: 1000 }).total;
  const together = calculatePrice({ product: 'leveling', platform: 'pc', level: 1000, addonIds: ['pc_lvl_together'] }).total;
  const priority = calculatePrice({ product: 'leveling', platform: 'pc', level: 1000, addonIds: ['pc_lvl_priority'] }).total;
  assert.ok(together < plain && priority > plain);
});

check('PC enhanced version costs 15% more than legacy', () => {
  const legacy = calculatePrice({ product: 'money', platform: 'pc', amountMillions: 500, gameVersion: 'legacy' }).total;
  const enhanced = calculatePrice({ product: 'money', platform: 'pc', amountMillions: 500, gameVersion: 'enhanced' }).total;
  assert.ok(Math.abs(enhanced - legacy * 1.15) < 0.02);
});

console.log(`\n${checks} checks passed`);
