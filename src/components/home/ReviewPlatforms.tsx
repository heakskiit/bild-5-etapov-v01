import { getTranslations } from '@/lib/i18n/getTranslations';

/**
 * Home §4.1 section 6 (BATCH F10): "where to read our reviews" banners.
 * Replaces the home FAQ block (moved to /about). Each banner links to the
 * seller's own review page on that marketplace. A platform without a profile
 * yet (`href: null`) renders as a non-clickable "coming soon" banner rather
 * than a link to an empty page.
 *
 * `logo`: drop the official logo into /public/images/reviews/ and set the
 * path here; until then a wordmark in the brand colour is shown.
 */
type Platform = {
	id: string;
	name: string;
	href: string | null;
	logo: string | null;
	accent: string;
};

const PLATFORMS: readonly Platform[] = [
	{
		id: 'playerauctions',
		name: 'PlayerAuctions',
		href: 'https://www.playerauctions.com/store/tommymodz/feedback/',
		logo: null,
		accent: 'text-[#ff8a00]',
	},
	{
		id: 'eldorado',
		name: 'Eldorado.gg',
		href: 'https://www.eldorado.gg/users/Tommymodz/reviews',
		logo: null,
		accent: 'text-[#ffc83d]',
	},
	{
		id: 'trustpilot',
		name: 'Trustpilot',
		href: null,
		logo: null,
		accent: 'text-[#00b67a]',
	},
];

export async function ReviewPlatforms() {
	const t = await getTranslations();

	return (
		<section>
			<h2 className="font-display text-2xl md:text-3xl">{t('home.reviews.title')}</h2>
			<p className="mt-2 text-sm text-ink-soft">{t('home.reviews.subtitle')}</p>

			<div className="mt-6 grid gap-4 sm:grid-cols-3">
				{PLATFORMS.map((p) => {
					const body = (
						<>
							<div className="flex h-12 items-center justify-center">
								{p.logo ? (
									// eslint-disable-next-line @next/next/no-img-element
									<img src={p.logo} alt={p.name} className="max-h-10 w-auto" />
								) : (
									<span className={`font-display text-2xl font-bold ${p.accent}`}>
										{p.id === 'trustpilot' ? '★ ' : ''}
										{p.name}
									</span>
								)}
							</div>
							<p className="mt-3 text-center text-xs uppercase tracking-widest text-ink-muted">
								{p.href ? `${t('home.reviews.read')} →` : t('home.reviews.soon')}
							</p>
						</>
					);

					return p.href ? (
						<a
							key={p.id}
							href={p.href}
							target="_blank"
							rel="noopener noreferrer"
							aria-label={`${p.name} — ${t('home.reviews.read')}`}
							className="glass-panel block p-6 transition hover:-translate-y-0.5 hover:border-white/30"
						>
							{body}
						</a>
					) : (
						<div key={p.id} aria-disabled="true" className="glass-panel cursor-default p-6 opacity-50">
							{body}
						</div>
					);
				})}
			</div>
		</section>
	);
}
