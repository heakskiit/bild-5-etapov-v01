/**
 * The one-line tier explanation under a pricing slider (§3.3).
 *
 * It lives outside Slider.tsx for two reasons. The wording has to come from
 * the message dictionaries: it used to be Russian text built inside the
 * component, so every other locale read Russian under the slider. And a plain
 * `.ts` module is something vitest can exercise -- the suite only picks up
 * `*.test.ts` and has no JSX transform.
 */

import type { Vars } from '@/lib/i18n/pick';

export interface TierStep {
	/** Inclusive upper bound of this tier, same units as the slider value. */
	upTo: number;
	pricePerUnit: number;
}

/** Same shape as the `t` the configurators build with `dig()`. */
export type Translate = (key: string, vars?: Vars) => string;

/**
 * A rate exactly as configured: cents at minimum, more decimals when the price
 * really has them, so 0.055 reads "$0.055" and not "$0.06". Rounding to cents
 * used to make five of the ten tiers show a rate the customer is not charged.
 */
export function formatRate(rate: number): string {
	// toFixed(8) with the zeros trimmed gives the price's own decimals and drops
	// floating-point noise (0.1 + 0.2 is not "0.30000000000000004").
	const exact = rate.toFixed(8).replace(/0+$/, '');
	const decimals = Math.max(2, (exact.split('.')[1] ?? '').length);
	return `$${rate.toFixed(decimals)}`;
}

/**
 * §3.3: "Метки тиров прямо на треке ... чтобы прогрессивная скидка была
 * видна, а не заявлена текстом: «до 500M — $0.09 за 1M», «от 501M — $0.07 за
 * 1M»." The ticks (in Slider) show *where* the breaks are; this names the rate
 * that's active right now and, if there's a cheaper tier ahead, where it starts.
 */
export function describeTier(
	value: number,
	tiers: readonly TierStep[],
	format: (v: number) => string,
	t: Translate,
): string {
	for (let i = 0; i < tiers.length; i++) {
		const tier = tiers[i];
		if (value <= tier.upTo) {
			const next = tiers[i + 1];
			if (!next) return t('configurator.tierLowest', { rate: formatRate(tier.pricePerUnit) });
			return t('configurator.tierDrop', {
				rate: formatRate(tier.pricePerUnit),
				from: format(tier.upTo + 1),
				next: formatRate(next.pricePerUnit),
			});
		}
	}
	const last = tiers[tiers.length - 1];
	return t('configurator.tierLowest', { rate: formatRate(last.pricePerUnit) });
}
