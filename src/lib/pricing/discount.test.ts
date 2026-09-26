/**
 * PROMO DISCOUNT MATH (Batch D).
 *
 * These numbers decide what a customer is charged, so the cases below are
 * deliberately the awkward ones: the 20% ceiling, the invoice floor, the
 * numeric string PostgREST hands back, and the bonus code that must never
 * become money. The happy path is the least interesting line in the file.
 */

import { describe, expect, it } from 'vitest';

import {
	MAX_DISCOUNT_SHARE,
	MIN_INVOICE_USD,
	roundMoney,
} from '@/../config/pricing.config';
import {
	applyPromoDiscount,
	isUsableDiscountValue,
	noPromoDiscount,
	PriceValueError,
} from '@/lib/pricing/discount';

describe('applyPromoDiscount', () => {
	it('takes a straight percentage off the subtotal', () => {
		expect(applyPromoDiscount(100, 'percent', 20)).toEqual({
			subtotal: 100,
			discountUsd: 20,
			total: 80,
		});
	});

	it('caps a greedy percentage at the business ceiling', () => {
		// The admin form refuses to issue anything above 20%, so this can only
		// come from a hand-edited row -- which is exactly why the ceiling is
		// enforced here and not only in the schema.
		expect(applyPromoDiscount(100, 'percent', 50)).toEqual({
			subtotal: 100,
			discountUsd: 20,
			total: 80,
		});
	});

	it('caps a fixed-dollar code at the same ceiling', () => {
		// A $999 code against an $80 order is only ever worth $16.
		expect(applyPromoDiscount(80, 'fixed_usd', 999)).toEqual({
			subtotal: 80,
			discountUsd: 16,
			total: 64,
		});
	});

	it('never lets a bonus code touch the price', () => {
		// Regression guard (PROMO-10): the fixed_usd fallback reads any
		// non-percent type as a dollar amount, so an X2 code -- whose value is
		// the multiplier 2 -- used to hand out a silent $2 discount.
		expect(applyPromoDiscount(100, 'bonus_x2', 2)).toEqual({
			subtotal: 100,
			discountUsd: 0,
			total: 100,
		});
	});

	it('coerces the numeric string PostgREST returns', () => {
		// Observed live in the promo panel: a $30.14 order with a 20% code.
		// Without the Number() coercion this became string concatenation.
		const fromDatabase = '20' as unknown as number;
		expect(applyPromoDiscount(30.14, 'percent', fromDatabase)).toEqual({
			subtotal: 30.14,
			discountUsd: 6.03,
			total: 24.11,
		});
	});

	it('never invoices below the CryptoBot minimum', () => {
		const result = applyPromoDiscount(MIN_INVOICE_USD, 'percent', 20);
		expect(result.total).toBe(MIN_INVOICE_USD);
		expect(result.discountUsd).toBe(0);
	});

	it('reports the discount actually granted, not the face value', () => {
		// The floor absorbs part of the code here: $0.10 is really given, not
		// the $0.50 the code asked for, and the customer-facing line must say
		// what happened rather than what was requested.
		expect(applyPromoDiscount(0.6, 'fixed_usd', 0.5)).toEqual({
			subtotal: 0.6,
			discountUsd: 0.1,
			total: 0.5,
		});
	});

	it('reconciles total + discount back to the subtotal at every price', () => {
		// The invariant the invoice depends on: a customer adding up the two
		// visible lines has to land exactly on the subtotal, with no stray cent.
		for (let raw = 0.5; raw <= 200; raw += 0.37) {
			const subtotal = roundMoney(raw);
			const result = applyPromoDiscount(subtotal, 'percent', 20);

			expect(roundMoney(result.total + result.discountUsd)).toBe(subtotal);
			expect(result.total).toBeGreaterThanOrEqual(MIN_INVOICE_USD);
			// One cent of tolerance: the cap is exact, the total is rounded.
			expect(result.discountUsd).toBeLessThanOrEqual(subtotal * MAX_DISCOUNT_SHARE + 0.01);
		}
	});

	it('refuses a code whose value is missing rather than invoicing NaN', () => {
		// The real shape of the bug: null coerces to NaN, Math.min(NaN, cap) is
		// NaN, and Math.max(MIN_INVOICE_USD, NaN) is NaN -- so an $80 order used
		// to reach CryptoBot as a NaN amount.
		const missing = null as unknown as number;
		expect(() => applyPromoDiscount(80, 'percent', missing)).toThrow(PriceValueError);
	});

	it('refuses a code whose value is not a number', () => {
		// Hand-edited rows are expected (codes are editable in the admin panel
		// and directly in the database), so junk has to fail closed.
		const junk = 'twenty' as unknown as number;
		expect(() => applyPromoDiscount(80, 'fixed_usd', junk)).toThrow(PriceValueError);
	});

	it('refuses a negative value instead of charging above the price', () => {
		// No database constraint stops a negative fixed_usd code. Unclamped it
		// inverts the subtraction: an $80 order would be invoiced at $130 with a
		// negative "saving" shown to the customer.
		expect(() => applyPromoDiscount(80, 'fixed_usd', -50)).toThrow(PriceValueError);
	});

	it('refuses an infinite value', () => {
		expect(() => applyPromoDiscount(80, 'percent', Number.POSITIVE_INFINITY)).toThrow(
			PriceValueError,
		);
	});

	it('refuses a broken subtotal rather than dropping to the invoice floor', () => {
		// calculate.ts is not covered by tests yet, so this is the guard that
		// stops a defective price from being sold for $0.50. Both entry points
		// are checked: the preview answers with noPromoDiscount() in six places.
		expect(() => applyPromoDiscount(Number.NaN, 'percent', 20)).toThrow(PriceValueError);
		expect(() => applyPromoDiscount(-5, 'percent', 20)).toThrow(PriceValueError);
		expect(() => noPromoDiscount(Number.NaN)).toThrow(PriceValueError);
	});
});

describe('isUsableDiscountValue', () => {
	it('lets the routes refuse a broken row before a hold is taken', () => {
		// Valid: the numeric string PostgREST returns must keep working, and a
		// bonus code's value is a multiplier validated by promoBonus.ts.
		expect(isUsableDiscountValue('percent', 20)).toBe(true);
		expect(isUsableDiscountValue('percent', '20' as unknown as number)).toBe(true);
		expect(isUsableDiscountValue('fixed_usd', 0)).toBe(true);
		expect(isUsableDiscountValue('bonus_x2', 2)).toBe(true);

		expect(isUsableDiscountValue('percent', null as unknown as number)).toBe(false);
		expect(isUsableDiscountValue('percent', '' as unknown as number)).toBe(false);
		expect(isUsableDiscountValue('fixed_usd', 'abc' as unknown as number)).toBe(false);
		expect(isUsableDiscountValue('fixed_usd', -5)).toBe(false);
	});
});

describe('noPromoDiscount', () => {
	it('is shaped like a discounted total so callers need no branching', () => {
		expect(noPromoDiscount(9)).toEqual({ subtotal: 9, discountUsd: 0, total: 9 });
	});
});
