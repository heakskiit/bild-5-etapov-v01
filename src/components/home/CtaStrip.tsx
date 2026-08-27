import Link from 'next/link';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { getTranslations } from '@/lib/i18n/getTranslations';

/**
 * §4.2 point 8: "Панель на всю ширину... с градиентной рамкой." Tailwind has
 * no gradient-border utility, and `border-image` fights `border-radius`
 * across browsers — the reliable way is the classic padding trick: an outer
 * box painted with the pink→cyan gradient, a 1px inset, and an opaque inner
 * box on top. The "border" is really the 1px of gradient showing through
 * the gap.
 */
export async function CtaStrip({ locale }: { locale: string }) {
	const t = await getTranslations();

	return (
		<section className="rounded-2xl bg-gradient-to-r from-pink-500 to-cyan-500 p-px">
			<div className="flex flex-col items-center gap-5 rounded-[calc(1rem-1px)] bg-surface px-6 py-10 text-center sm:flex-row sm:justify-between sm:text-left">
				<div>
					<h2 className="font-display text-2xl">{t('home.cta.title')}</h2>
					<p className="mt-1 text-sm text-ink-soft">{t('home.cta.subtitle')}</p>
				</div>
				<div className="flex flex-col items-center gap-3 sm:flex-row">
					<Link href={`/${locale}/store`} className={buttonClasses('primary', 'lg')}>
						{t('home.cta.primary')}
					</Link>
					<a
						href={process.env.NEXT_PUBLIC_DISCORD_INVITE_URL}
						target="_blank"
						rel="noopener noreferrer"
						className="text-sm text-cyan-500 underline-offset-4 hover:underline"
					>
						{t('common.joinDiscord')} →
					</a>
				</div>
			</div>
		</section>
	);
}
