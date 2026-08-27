/**
 * Safety widget — sits in the left column of every product card, under the
 * illustration. Copy is fixed by the spec; only `gameVersion` is dynamic.
 */

import { getTranslations } from '@/lib/i18n/getTranslations';
import { ShieldIcon } from '@/components/ui/icons';

export async function SafetyWidget({ gameVersion }: { gameVersion: string }) {
	const t = await getTranslations();

	return (
		<div className="glass-panel glass-edge-blue p-4">
			<div className="flex items-center gap-2">
				<ShieldIcon className="h-5 w-5 text-neon-blue" aria-hidden />
				<span className="font-display text-sm uppercase tracking-wide text-neon-blue">
					{t('safety.badge')}
				</span>
			</div>

			<p className="mt-2 text-xs leading-relaxed text-white/65">{t('safety.body')}</p>

			<div className="mt-3 flex flex-wrap gap-2">
				<Badge label={`${t('safety.currentVersion')}: ${gameVersion}`} tone="blue" />
				<Badge label={t('safety.updatedEvery')} tone="pink" />
			</div>
		</div>
	);
}

function Badge({ label, tone }: { label: string; tone: 'blue' | 'pink' }) {
	const tones = {
		blue: 'border-gray-800 text-neon-blue shadow-[0_0_10px_rgba(0,240,255,0.3)]',
		// §1.1: pink-500 on bg-base is 4.3:1 — fails small text (needs 4.5:1).
		// This badge renders at 11px, so pink-400 (#FF5CA0) here, not pink-500.
		pink: 'border-gray-800 text-pink-400 shadow-[0_0_10px_rgba(255,42,133,0.3)]',
	} as const;
	return (
		<span
			className={`rounded-full border px-3 py-1 text-[11px] font-medium ${tones[tone]} bg-night/60`}
		>
			{label}
		</span>
	);
}
