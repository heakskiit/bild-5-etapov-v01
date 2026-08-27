'use client';

import type { Platform } from '@/../config/pricing.config';

const PLATFORMS: { id: Platform; label: string }[] = [
	{ id: 'pc', label: 'PC' },
	{ id: 'ps', label: 'PlayStation' },
	{ id: 'xbox', label: 'Xbox' },
];

/**
 * Platform is the master switch of the whole card: changing it swaps the
 * amount control and the add-on catalogue (see BoostConfigurator).
 */
export function PlatformSelector({
	value,
	onChange,
	t = (k: string) => k,
}: {
	value: Platform;
	onChange: (p: Platform) => void;
	t?: (key: string) => string;
}) {
	return (
		<div role="tablist" aria-label={t('configurator.platform')} className="flex flex-wrap gap-2">
			{PLATFORMS.map(({ id, label }) => {
				const active = value === id;
				return (
					<button
						key={id}
						role="tab"
						aria-selected={active}
						onClick={() => onChange(id)}
						className={`min-w-[7rem] text-balance rounded-lg border px-4 py-2 font-display text-sm uppercase tracking-wide transition ${
							active
								? 'border-[#FF2A85] bg-[#1a1a2e] text-white shadow-[0_0_12px_rgba(255,42,133,0.4)]'
								: 'border-gray-800 text-white/60 hover:border-white/30'
						}`}
					>
						{label}
					</button>
				);
			})}
		</div>
	);
}
