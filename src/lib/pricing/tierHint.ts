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

export function formatRate(rate: number): string {
	return `$${rate < 0.01 ? rate.toFixed(3) : rate.toFixed(2)}`;
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
