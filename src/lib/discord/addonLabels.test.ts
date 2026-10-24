/**
 * ADD-ON NAMES ON THE BOOSTER CARD (F21).
 *
 * The Discord embed printed raw catalog ids (`pc_lvl_together`). These tests pin
 * the readable English names, and the fallback that keeps an id the catalog no
 * longer knows visible instead of dropping it.
 */

import { describe, expect, it } from 'vitest';

import { LEVELING_ADDONS_CONSOLE, LEVELING_ADDONS_PC } from '@/../config/pricing.config';
import { dig, type Dict } from '@/lib/i18n/pick';

import en from '../../../messages/en.json';
import { addonLabel, formatAddons } from './addonLabels';

const english = en as Dict;
const CATALOG = [...LEVELING_ADDONS_PC, ...LEVELING_ADDONS_CONSOLE];

describe('addonLabel', () => {
	it('gives every add-on in both catalogs its English dictionary name, never the raw id', () => {
		expect(CATALOG.length).toBeGreaterThan(10);

		for (const addon of CATALOG) {
			const name = addonLabel(addon.id);

			expect(name, addon.id).toBe(dig(english, addon.labelKey));
			expect(name, addon.id).not.toBe(addon.id);
			expect(name, addon.id).not.toMatch(/^(pc|con)_lvl_/);
		}
	});

	it('turns the id from the real card into its readable name', () => {
		expect(addonLabel('pc_lvl_together')).toBe(dig(english, 'addons.pc.together'));
	});

	it('returns an id the catalog does not know unchanged, so nothing is hidden', () => {
		expect(addonLabel('retired_addon_2025')).toBe('retired_addon_2025');
		expect(addonLabel('')).toBe('');
	});
});

describe('formatAddons', () => {
	it('joins readable names with commas', () => {
		expect(formatAddons(['pc_lvl_kd_reset', 'pc_lvl_stealth'])).toBe(
			`${dig(english, 'addons.pc.kdReset')}, ${dig(english, 'addons.pc.stealthMode')}`,
		);
	});

	it('keeps an unknown id in the list next to the known ones', () => {
		const value = formatAddons(['pc_lvl_kd_reset', 'retired_addon_2025']);

		expect(value).toContain(dig(english, 'addons.pc.kdReset'));
		expect(value).toContain('retired_addon_2025');
	});

	it('shows a dash when there are no add-ons', () => {
		expect(formatAddons([])).toBe('—');
		expect(formatAddons(undefined)).toBe('—');
		expect(formatAddons(null)).toBe('—');
	});

	it('stays inside the 1024-character limit of a Discord field with every add-on selected', () => {
		expect(formatAddons(CATALOG.map((addon) => addon.id)).length).toBeLessThanOrEqual(1024);
	});
});
