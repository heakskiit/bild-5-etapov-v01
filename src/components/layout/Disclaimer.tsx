/**
 * §4.2 point 9: mandatory standalone legal block in the footer, with its own
 * border — separate from the top DisclaimerBar (same text, different job:
 * that one is a quiet strip every page opens with, this one is the footer's
 * own citation of it). Text lives in messages/*.json under common.disclaimer
 * so all locales stay in sync; don't inline it anywhere else.
 *
 * DE/FR/ES/RU are now real translations, not the English text repeated —
 * same caveat as about.tsx: this is a trademark non-affiliation notice, so
 * treat it as legally load-bearing and have it reviewed before shipping,
 * not just proofread for fluency.
 */

import { getTranslations } from '@/lib/i18n/getTranslations';

export async function Disclaimer() {
	const t = await getTranslations();

	return (
		<section aria-label={t('common.legalDisclaimer')} className="glass-panel-sm mt-10 p-4 text-xs leading-relaxed text-white/60 shadow-neon-inset">
			{t('common.disclaimer')}
		</section>
	);
}
