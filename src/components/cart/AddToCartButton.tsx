'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useCart } from '@/lib/cart/useCart';
import { MAX_CART_ITEMS } from '@/lib/cart/cart';
import type { OrderSelection } from '@/types/order';

type Translate = (key: string, vars?: Record<string, string | number>) => string;

/** BATCH F11: "Add to cart" next to the buy button, with 2 s feedback. */
export function AddToCartButton({
	selection,
	disabled,
	t,
}: {
	selection: OrderSelection;
	disabled?: boolean;
	t: Translate;
}) {
	const { add } = useCart();
	const [state, setState] = useState<'idle' | 'added' | 'full'>('idle');
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => () => {
		if (timer.current) clearTimeout(timer.current);
	}, []);

	const onClick = () => {
		const result = add(selection);
		setState(result.ok ? 'added' : result.reason === 'full' ? 'full' : 'idle');
		if (timer.current) clearTimeout(timer.current);
		timer.current = setTimeout(() => setState('idle'), 2000);
	};

	const label =
		state === 'added'
			? `${t('cart.added')} ✓`
			: state === 'full'
				? t('cart.full', { max: MAX_CART_ITEMS })
				: t('cart.add');

	return (
		<Button variant="secondary" size="lg" className="w-full" onClick={onClick} disabled={disabled} aria-live="polite">
			{label}
		</Button>
	);
}
