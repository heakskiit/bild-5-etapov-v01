import { getTranslations } from '@/lib/i18n/getTranslations';

/**
 * Shared shell for /legal/terms, /legal/privacy, /legal/refund — same
 * "load-bearing copy" note as about/page.tsx: this is a solid first draft
 * consistent with how the system actually behaves (crypto-only payment,
 * encrypted+nullified credentials, Sheets sync excluding passwords), not a
 * substitute for an actual legal review before launch.
 */
export function LegalPage({
	title,
	sections,
}: {
	title: string;
	sections: { heading: string; body: string }[];
}) {
	return (
		<div className="prose prose-invert max-w-3xl">
			<h1 className="font-display text-3xl text-neon-pink">{title}</h1>
			{sections.map((s) => (
				<section key={s.heading}>
					<h2>{s.heading}</h2>
					<p>{s.body}</p>
				</section>
			))}
		</div>
	);
}

export async function loadLegalCopy(key: 'terms' | 'privacy' | 'refund', sectionKeys: string[]) {
	const t = await getTranslations();
	return sectionKeys.map((s) => ({
		heading: t(`legal.${key}.${s}.heading`),
		body: t(`legal.${key}.${s}.body`),
	}));
}
