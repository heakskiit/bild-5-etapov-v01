/**
 * TIER LINE UNDER THE PRICING SLIDERS (F20).
 *
 * The line used to be Russian text built inside Slider.tsx, so English,
 * German, French and Spanish visitors read Russian under the slider. It now
 * comes from the dictionaries; these tests pin the wording and make sure no
 * placeholder is left unfilled for any real tier of either slider.
 */

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { LEVELING_PC, MONEY_PC } from '@/../config/pricing.config';
import { type Dict, dig } from '@/lib/i18n/pick';

import { describeTier, formatRate, type TierStep } from './tierHint';

const LOCALES = ['en', 'ru', 'de', 'fr', 'es'] as const;

const dictionaries = new Map(
	LOCALES.map(
		(locale) =>
			[
				locale,
				JSON.parse(
					readFileSync(new URL(`../../../messages/${locale}.json`, import.meta.url), 'utf8'),
				) as Dict,
			] as const,
	),
);

const translator =
	(locale: (typeof LOCALES)[number]) => (key: string, vars?: Record<string, string | number>) =>
		dig(dictionaries.get(locale) as Dict, key, vars);

const millions = (v: number) => `${v}m`;

const TIERS: TierStep[] = [
	{ upTo: 500, pricePerUnit: 0.09 },
	{ upTo: 1000, pricePerUnit: 0.07 },
	{ upTo: 5000, pricePerUnit: 0.05 },
];

describe('describeTier', () => {
	it('names the active rate and where the next, cheaper tier starts', () => {
		const t = translator('en');

		expect(describeTier(100, TIERS, millions, t)).toBe('$0.09 per unit · from 501m the rate drops to $0.07');
		expect(describeTier(500, TIERS, millions, t)).toBe('$0.09 per unit · from 501m the rate drops to $0.07');
		expect(describeTier(501, TIERS, millions, t)).toBe('$0.07 per unit · from 1001m the rate drops to $0.05');
	});

	it('says it is the lowest rate inside the last tier', () => {
		const t = translator('en');

		expect(describeTier(1001, TIERS, millions, t)).toBe('$0.05 per unit — lowest rate');
		expect(describeTier(5000, TIERS, millions, t)).toBe('$0.05 per unit — lowest rate');
	});

	it('treats a value past the last tier as the lowest rate too', () => {
		expect(describeTier(9000, TIERS, millions, translator('en'))).toBe('$0.05 per unit — lowest rate');
	});

	it('prints a rate under one cent with three decimals', () => {
		expect(formatRate(0.09)).toBe('$0.09');
		expect(formatRate(0.007)).toBe('$0.007');
	});

	it('keeps the Russian wording exactly as it was before it moved into the dictionary', () => {
		const t = translator('ru');

		expect(describeTier(100, TIERS, millions, t)).toBe('$0.09 за единицу · с 501m ставка упадёт до $0.07');
		expect(describeTier(5000, TIERS, millions, t)).toBe('$0.05 за единицу — минимальная ставка');
	});

	it('puts the rate, the break point and the next rate into the drop line in every locale', () => {
		for (const locale of LOCALES) {
			const line = describeTier(100, TIERS, millions, translator(locale));

			expect(line, locale).toContain('$0.09');
			expect(line, locale).toContain('501m');
			expect(line, locale).toContain('$0.07');
		}
	});

	it('fills every placeholder for every real tier of both sliders, in every locale', () => {
		const sliders = [
			{ min: LEVELING_PC.minLevel, max: LEVELING_PC.maxLevel, tiers: LEVELING_PC.tiers },
			{ min: MONEY_PC.minMillions, max: MONEY_PC.maxMillions, tiers: MONEY_PC.tiers },
		];

		for (const locale of LOCALES) {
			for (const { min, max, tiers } of sliders) {
				const values = [min, max, ...tiers.flatMap((tier) => [tier.upTo, tier.upTo + 1])].filter(
					(v) => v >= min && v <= max,
				);

				for (const value of values) {
					const line = describeTier(value, tiers, millions, translator(locale));

					expect(line, `${locale} @ ${value}`).not.toMatch(/[{}]/);
					expect(line, `${locale} @ ${value}`).not.toContain('configurator.tier');
					expect(line.length, `${locale} @ ${value}`).toBeGreaterThan(10);
				}
			}
		}
	});
});
