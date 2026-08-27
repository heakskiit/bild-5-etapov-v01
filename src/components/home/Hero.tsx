import Link from 'next/link';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { ProductPreviewCard } from './ProductPreviewCard';
import { getTranslations, getMessages } from '@/lib/i18n/getTranslations';
import { TRUST_STATS } from '@/../config/trust-stats.config';
import { getSharkCardStock } from '@/lib/keys/googleSheets';
import { SHARK_CARDS } from '@/../config/pricing.config';

/**
 * §4.2 point 3: "Высота 560–640, а не весь экран: пользователь должен
 * увидеть край следующей секции." `min-h-[560px]` (not `min-h-screen`) is
 * what does that — on any viewport taller than ~560+header+disclaimer, the
 * next section's top edge is visible without scrolling.
 *
 * Background is scoped to THIS section only (§4.3: "Фон только в hero, ниже
 * — сплошной --bg-base") — a local absolute layer + scrim, not the sitewide
 * fixed background layout.tsx also sets. I left that sitewide one alone
 * rather than removing it from every other page sight-unseen; if you want
 * product/store pages solid too, say so and I'll pull it from layout.tsx.
 */
export async function Hero({ locale }: { locale: string }) {
	const t = await getTranslations();
	// ProductPreviewCard is 'use client' and can't call next/headers itself —
	// same reason the product page passes `messages` down to the configurators.
	const messages = await getMessages();

	const facts = [
		TRUST_STATS.completedOrders != null &&
			t('home.hero.trustOrders', { count: TRUST_STATS.completedOrders.toLocaleString(locale) }),
		TRUST_STATS.avgDeliveryMinutes != null &&
			t('home.hero.trustDelivery', { minutes: TRUST_STATS.avgDeliveryMinutes }),
		t('home.hero.trustCrypto'),
	].filter((f): f is string => Boolean(f));

	return (
		<section className="relative isolate -mx-4 overflow-hidden md:mx-0 md:rounded-2xl md:border md:border-white/10">
			<div
				className="absolute inset-0 -z-10 bg-cover bg-center"
				style={{ backgroundImage: "url('/images/bg/vice-nights.jpg')" }}
				aria-hidden="true"
			/>
			<div className="absolute inset-0 -z-10 bg-[var(--scrim)]" aria-hidden="true" />

			<div className="mx-auto grid min-h-[560px] max-w-[1200px] items-center gap-10 px-6 py-14 md:grid-cols-12 md:py-20">
				<div className="md:col-span-7">
					<h1 className="font-display text-4xl leading-[1.05] tracking-tight md:text-6xl">
						{t('home.hero.titleLead')} <span className="text-pink-500">{t('home.hero.titleAccent')}</span>
					</h1>
					<p className="mt-5 max-w-[52ch] text-lg text-ink-soft">{t('home.hero.subtitle')}</p>

					<div className="mt-8 flex flex-col gap-3 sm:flex-row">
						<Link href={`/${locale}/store`} className={buttonClasses('primary', 'lg')}>
							{t('nav.store')}
						</Link>
						<Link href={`/${locale}/co-op`} className={buttonClasses('secondary', 'lg')}>
							{t('nav.coop')}
						</Link>
					</div>

					{facts.length > 0 && (
						<ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-muted">
							{facts.map((fact) => (
								<li key={fact}>{fact}</li>
							))}
						</ul>
					)}
				</div>

				<div className="md:col-span-5">
					<ProductPreviewCard messages={messages} stock={await getSharkCardStock(SHARK_CARDS.map((c) => c.sheetSku))} />
				</div>
			</div>
		</section>
	);
}
