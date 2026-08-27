import { Hero } from '@/components/home/Hero';
import { PopularProducts } from '@/components/home/PopularProducts';
import { HowItWorks } from '@/components/home/HowItWorks';
import { Safety } from '@/components/home/Safety';
import { Faq } from '@/components/home/Faq';
import { CtaStrip } from '@/components/home/CtaStrip';
import { MobileStickyCta } from '@/components/home/MobileStickyCta';

/**
 * §4.1 skeleton, minus section 6 (Reviews): "рендерится ТОЛЬКО при наличии
 * данных, иначе секции нет." There's no reviews source wired into this
 * project yet, so per that same rule the honest state is "section absent",
 * not a placeholder — same call already made for TrustpilotPlaceholder,
 * which this rebuild also drops for the same reason (§4.3 flags the old
 * "(placeholder — API integration pending)" text as exactly the kind of
 * "technical placeholder" that's out by §5 step 4). When a real reviews
 * source exists, add `{reviews.length > 0 && <Reviews items={reviews} />}`
 * between Safety and Faq, matching the doc's skeleton order.
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
	const { locale } = await params;

	return (
		<>
			<div className="space-y-16">
				<Hero locale={locale} />
				<PopularProducts locale={locale} />
				<HowItWorks />
				<Safety />
				<Faq locale={locale} />
				<CtaStrip locale={locale} />
			</div>
			<MobileStickyCta locale={locale} />
		</>
	);
}
