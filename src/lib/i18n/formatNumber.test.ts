/**
 * SLIDER NUMBER FORMAT (F22).
 *
 * The slider hard-coded `ru-RU`, so an English visitor read 8 000 where English
 * writes 8,000. The tag now comes from each dictionary (`format.numberLocale`).
 * Grouping is asserted on 7-digit numbers for most languages because some write
 * a 4-digit number without a separator (Spanish: 8000), and checked with \s where
 * the separator is a no-break space.
 */

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { DEFAULT_NUMBER_LOCALE, formatCount } from './formatNumber';
import { type Dict, dig } from './pick';

const LOCALES = ['en', 'ru', 'de', 'fr', 'es'] as const;
const KEY = 'format.numberLocale';

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

const tag = (locale: (typeof LOCALES)[number]) => dig(dictionaries.get(locale) as Dict, KEY);

describe('format.numberLocale', () => {
	it('is defined in every dictionary, known to Intl, and belongs to that language', () => {
		for (const locale of LOCALES) {
			expect(tag(locale), locale).not.toBe(KEY);
			expect(Intl.NumberFormat.supportedLocalesOf([tag(locale)]), locale).toHaveLength(1);
			expect(tag(locale).toLowerCase().startsWith(locale), locale).toBe(true);
		}
	});

	it('groups thousands the way each language writes them', () => {
		expect(formatCount(1234567, tag('en'))).toBe('1,234,567');
		expect(formatCount(1234567, tag('de'))).toBe('1.234.567');
		expect(formatCount(1234567, tag('es'))).toBe('1.234.567');
		expect(formatCount(1234567, tag('ru'))).toMatch(/^1\s234\s567$/);
		expect(formatCount(1234567, tag('fr'))).toMatch(/^1\s234\s567$/);

		// The slider's own maximum, in the three languages where 4 digits are grouped.
		expect(formatCount(8000, tag('en'))).toBe('8,000');
		expect(formatCount(8000, tag('de'))).toBe('8.000');
		expect(formatCount(8000, tag('ru'))).toMatch(/^8\s000$/);
	});

	it('leaves Russian exactly as the slider always showed it', () => {
		for (const value of [1, 150, 1000, 8000, 123456]) {
			expect(formatCount(value, tag('ru'))).toBe(value.toLocaleString('ru-RU'));
		}
	});
});

describe('formatCount', () => {
	it('defaults to English grouping, never to the runtime locale', () => {
		expect(DEFAULT_NUMBER_LOCALE).toBe('en-US');
		expect(formatCount(8000)).toBe('8,000');
	});

	it('never throws on a bad tag (a missing dictionary key echoes its own path)', () => {
		expect(formatCount(8000, KEY)).toBe('8,000');
		expect(formatCount(8000, '')).toBe('8,000');
	});
});
