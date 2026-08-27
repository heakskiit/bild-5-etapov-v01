import { getTranslations } from '@/lib/i18n/getTranslations';

/**
 * §4.1/§4.2 point 5: "3 шага, крупные номера, линия-коннектор." Snaps the
 * new-user's biggest fear (giving up their password) at step 1 specifically.
 */
export async function HowItWorks() {
	const t = await getTranslations();

	const steps = [
		{ n: 1, title: t('home.howItWorks.step1Title'), body: t('home.howItWorks.step1Body') },
		{ n: 2, title: t('home.howItWorks.step2Title'), body: t('home.howItWorks.step2Body') },
		{ n: 3, title: t('home.howItWorks.step3Title'), body: t('home.howItWorks.step3Body') },
	];

	return (
		<section>
			<h2 className="font-display text-2xl md:text-3xl">{t('home.howItWorks.title')}</h2>
			<div className="relative mt-8 grid gap-8 md:grid-cols-3">
				{/* Connector line behind the number circles — desktop only, since
				    a horizontal line reading across 3 stacked rows on mobile
				    wouldn't connect anything meaningful. */}
				<div
					className="pointer-events-none absolute left-0 right-0 top-6 hidden h-px bg-[var(--border-default)] md:block"
					aria-hidden="true"
				/>
				{steps.map((step) => (
					<div key={step.n} className="relative">
						<div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border border-pink-500 bg-surface font-display text-lg text-pink-500 shadow-glow-pink">
							{step.n}
						</div>
						<h3 className="mt-4 font-display text-lg text-ink">{step.title}</h3>
						<p className="mt-1 text-sm text-ink-soft">{step.body}</p>
					</div>
				))}
			</div>
		</section>
	);
}
