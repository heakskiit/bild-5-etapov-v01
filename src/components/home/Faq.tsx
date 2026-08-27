import Link from 'next/link';
import { getTranslations } from '@/lib/i18n/getTranslations';

/**
 * §4.2 point 7: exactly the six questions listed in §3.4 — сколько ждать,
 * безопасно ли для аккаунта, нужен ли пароль, какие криптовалюты, что если
 * код не пришёл, как вернуть деньги — plus a link to the full support page.
 * Native <details>/<summary>, same reasoning as ProductFaq.tsx: zero-JS,
 * crawlable, keyboard-accessible for free.
 */
export async function Faq({ locale }: { locale: string }) {
	const t = await getTranslations();

	const entries = [
		{ q: 'home.faq.q1', a: 'home.faq.a1' },
		{ q: 'home.faq.q2', a: 'home.faq.a2' },
		{ q: 'home.faq.q3', a: 'home.faq.a3' },
		{ q: 'home.faq.q4', a: 'home.faq.a4' },
		{ q: 'home.faq.q5', a: 'home.faq.a5' },
		{ q: 'home.faq.q6', a: 'home.faq.a6' },
	];

	return (
		<section>
			<div className="flex flex-wrap items-baseline justify-between gap-3">
				<h2 className="font-display text-2xl md:text-3xl">{t('home.faq.title')}</h2>
				<Link href={`/${locale}/support`} className="text-sm text-cyan-500 underline-offset-4 hover:underline">
					{t('home.faq.allQuestions')} →
				</Link>
			</div>

			<div className="mt-6 space-y-2">
				{entries.map(({ q, a }) => (
					<details key={q} className="group glass-panel-sm px-4 py-3 open:shadow-neon-inset">
						<summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-sm text-ink">
							{t(q)}
							<span className="shrink-0 text-cyan-500 transition-transform duration-150 group-open:rotate-45">+</span>
						</summary>
						<p className="mt-2 text-sm leading-relaxed text-ink-soft">{t(a)}</p>
					</details>
				))}
			</div>
		</section>
	);
}
