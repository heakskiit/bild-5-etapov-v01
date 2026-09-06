/**
 * TRANSLATION DICTIONARIES (Batch D).
 *
 * `dig()` returns the dotted path when a key is missing, which is a good
 * failure mode in production -- nothing renders as "undefined" -- and a
 * terrible one in review, because a missing translation looks like ordinary
 * text until a customer sees `checkout.bonusLine` in their basket. This file
 * is the guard: key parity across all five locales, and every placeholder the
 * new promo copy relies on actually filled in.
 *
 * The files are read from disk rather than imported so the test needs no JSON
 * module support and fails loudly if a file stops being valid JSON.
 */

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { type Dict, dig } from '@/lib/i18n/pick';

const LOCALES = ['en', 'ru', 'de', 'fr', 'es'] as const;

const load = (locale: string): Dict =>
	JSON.parse(
		readFileSync(new URL(`../../../messages/${locale}.json`, import.meta.url), 'utf8'),
	) as Dict;

const dictionaries = new Map(LOCALES.map((locale) => [locale, load(locale)]));

function flatten(node: unknown, prefix = ''): string[] {
	if (node === null || typeof node !== 'object' || Array.isArray(node)) return [prefix];
	return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
		flatten(value, prefix ? `${prefix}.${key}` : key),
	);
}

/** Keys the promo and X2 work depends on, including the pre-existing ones
 *  their new variants have to sit beside. */
const REQUIRED_KEYS = [
	'dashboard.describeCashCard',
	'dashboard.describeLeveling',
	'dashboard.describeMoney',
	'dashboard.describeMoneyBonus',
	'dashboard.discountApplied',
	'checkout.bonusLine',
	'checkout.promoBonusApplied',
	'checkout.promoMinOrder',
	'checkout.promoWrongProduct',
	'checkout.dailyLimit',
	'checkout.tooManyPending',
	'dashboard.pendingLabel',
	'admin.promo.kindLabel',
	'admin.promo.kindPercent',
	'admin.promo.kindBonus',
	'admin.promo.bonusNote',
];

describe('message dictionaries', () => {
	it('every locale carries exactly the English key set', () => {
		const english = flatten(dictionaries.get('en')).sort();

		for (const locale of LOCALES) {
			const keys = flatten(dictionaries.get(locale)).sort();
			expect(keys).toEqual(english);
		}
	});

	it('resolves every key the promo screens use, in every locale', () => {
		for (const locale of LOCALES) {
			const dict = dictionaries.get(locale) as Dict;

			for (const key of REQUIRED_KEYS) {
				const value = dig(dict, key);
				// dig() echoes the path when the lookup fails, so a returned
				// value equal to the key means the translation is missing.
				expect(value).not.toBe(key);
				expect(value.trim().length).toBeGreaterThan(0);
			}
		}
	});

	it('fills both placeholders in the X2 delivery line', () => {
		for (const locale of LOCALES) {
			const dict = dictionaries.get(locale) as Dict;

			expect(dig(dict, 'dashboard.describeMoneyBonus')).toContain('{amount}');
			expect(dig(dict, 'dashboard.describeMoneyBonus')).toContain('{multiplier}');

			const rendered = dig(dict, 'dashboard.describeMoneyBonus', { amount: 200, multiplier: 2 });
			expect(rendered).toContain('200');
			expect(rendered).not.toContain('{');
		}
	});

	it('fills the multiplier in the applied-code notice', () => {
		for (const locale of LOCALES) {
			const dict = dictionaries.get(locale) as Dict;

			expect(dig(dict, 'checkout.promoBonusApplied')).toContain('{multiplier}');

			const rendered = dig(dict, 'checkout.promoBonusApplied', { multiplier: 2 });
			expect(rendered).toContain('2');
			expect(rendered).not.toContain('{');
		}
	});

	it('fills the threshold and the saving in the money-carrying lines', () => {
		for (const locale of LOCALES) {
			const dict = dictionaries.get(locale) as Dict;

			expect(dig(dict, 'checkout.promoMinOrder', { amount: '$30.00' })).toContain('$30.00');
			expect(dig(dict, 'dashboard.discountApplied', { amount: '$1.80', code: 'HOLDTEST' }))
				.toContain('HOLDTEST');
		}
	});
});
