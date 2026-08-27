'use client';

import type { AddonOption } from '@/../config/pricing.config';
import { OptionCard } from '@/components/ui/OptionCard';

/**
 * The 10-option extras grid. The `options` array is swapped by the parent
 * when the platform changes, which is why this component holds no catalogue
 * knowledge of its own beyond formatting and the two named hints below.
 *
 * §3.2: "Взаимоисключающие опции блокируют друг друга с пояснением" is NOT
 * implemented here — `AddonOption` in pricing.config.ts has no field saying
 * which options conflict, and guessing would mean inventing a business rule
 * (e.g. "Together — cheaper" excludes X) with no real basis. `OptionCard`
 * already accepts `disabled`/`disabledReason` for exactly this; once the
 * config gains real exclusion data, wire it in here — the `disabledBy`
 * lookup below is where that would plug in.
 */

// §3.2: "Иконка вопроса с тултипом у неочевидных опций: «K/D ratio cleanup»,
// «Extra-slow stealth pacing»" — those two, named directly in the doc, map
// to these ids. The other eight addon names are already self-explanatory.
const HINTS: Record<string, string> = {
	pc_lvl_kd_reset: 'Обнуляет счётчик убийств/смертей в статистике аккаунта.',
	con_lvl_slow: 'Действия на аккаунте выполняются медленнее обычного, чтобы снизить риск флагов от античита.',
	pc_lvl_stealth: 'Действия на аккаунте выполняются медленнее обычного, чтобы снизить риск флагов от античита.',
};

function priceLabel(option: AddonOption): string {
	if (option.kind === 'percent') {
		const pct = Math.round(Math.abs(option.value) * 100);
		return option.value < 0 ? `−${pct}%` : `+${pct}%`;
	}
	return option.value < 0 ? `−$${Math.abs(option.value).toFixed(2)}` : `+$${option.value.toFixed(2)}`;
}

export function AddonGrid({
	options,
	selected,
	onChange,
	t = (k: string) => k,
}: {
	options: AddonOption[];
	selected: string[];
	onChange: (ids: string[]) => void;
	t?: (key: string) => string;
}) {
	const toggle = (id: string) =>
		onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

	return (
		<fieldset>
			<legend className="mb-2 block font-display text-xs uppercase tracking-widest text-white/60">
				{t('configurator.extras')}
			</legend>
			<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
				{options.map((option) => (
					<OptionCard
						key={option.id}
						id={option.id}
						label={t(option.labelKey)}
						checked={selected.includes(option.id)}
						onChange={() => toggle(option.id)}
						priceLabel={priceLabel(option)}
						hint={HINTS[option.id]}
					/>
				))}
			</div>
		</fieldset>
	);
}
