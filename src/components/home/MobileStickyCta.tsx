'use client';

/**
 * §4.4 (mobile): "Липкая нижняя панель с ценой и CTA появляется после
 * прокрутки hero." §4.5 mounts this as a sibling of <Footer>, so it's
 * homepage-only, not a global site chrome piece.
 *
 * Deliberately links to /store rather than embedding its own buy flow —
 * ProductPreviewCard already owns a live checkout in the hero; duplicating
 * that here would mean two independent places that can create an invoice,
 * which is exactly the kind of double-invoice risk Button's loading state
 * exists to prevent (see §2.2). This bar's job is "get back to the offer
 * fast while scrolling", not a second checkout.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { startingPrice } from '@/lib/pricing/startingPrice';

const SCROLL_THRESHOLD_PX = 480; // roughly the hero's min-h-[560px] minus the header/disclaimer bars above it

export function MobileStickyCta({ locale }: { locale: string }) {
	const [visible, setVisible] = useState(false);
	const price = startingPrice('shark_card');

	useEffect(() => {
		const onScroll = () => setVisible(window.scrollY > SCROLL_THRESHOLD_PX);
		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => window.removeEventListener('scroll', onScroll);
	}, []);

	return (
		<div
			aria-hidden={!visible}
			className={[
				'fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-night/95 px-4 py-3 backdrop-blur-xl transition-transform duration-200 ease-[cubic-bezier(.2,.8,.2,1)] md:hidden',
				visible ? 'translate-y-0' : 'translate-y-full pointer-events-none',
			].join(' ')}
		>
			<div className="flex items-center justify-between gap-4">
				<div>
					<p className="text-[11px] uppercase tracking-widest text-ink-muted">от</p>
					<p className="font-display text-lg tabular-nums text-ink">${price.toFixed(2)}</p>
				</div>
				<Link href={`/${locale}/gta-5`} className={buttonClasses('primary', 'md')} tabIndex={visible ? 0 : -1}>
					Открыть магазин
				</Link>
			</div>
		</div>
	);
}
