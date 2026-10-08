'use client';

import Link from 'next/link';
import { useCart } from '@/lib/cart/useCart';

/** BATCH F11: header cart icon with an item counter. */
export function CartButton({ locale, label }: { locale: string; label: string }) {
	const { count } = useCart();

	return (
		<Link
			href={`/${locale}/cart`}
			aria-label={count > 0 ? `${label} (${count})` : label}
			title={label}
			className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-white/80 transition-colors hover:text-neon-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
		>
			<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
				<path d="M3 4h2l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h8.7a1.5 1.5 0 0 0 1.5-1.1L21 8H6.2" strokeLinecap="round" strokeLinejoin="round" />
				<circle cx="9.5" cy="20" r="1.3" />
				<circle cx="17" cy="20" r="1.3" />
			</svg>
			{count > 0 && (
				<span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-neon-pink px-1 text-[10px] font-bold leading-none text-white">
					{count}
				</span>
			)}
		</Link>
	);
}
