'use client';

/**
 * Shark Cards: ONE card for all denominations, selected via a chip group.
 * No platform switch, no add-ons, no delivery modifier — a code is a code.
 */

import { useMemo, useState } from 'react';
import { SHARK_CARDS } from '@/../config/pricing.config';
import { ChipGroup, type ChipOption } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { dig, type Dict } from '@/lib/i18n/pick';
import { useCheckout, emptyOrderDetails, type Contact } from '@/lib/hooks/useCheckout';
import { CheckoutModal } from '@/components/checkout/CheckoutModal';
import type { OrderDetails } from '@/lib/validation/order';
import type { OrderSelection } from '@/types/order';

/**
 * §3.1: "Номиналы подписываются единообразно: $100K · $500K · $1M · $2M ·
 * $4M · $8M · $10M. Сейчас $10 000k — так никто не пишет." — that's a direct
 * description of what the old `format` here produced (`$10,000k`). K under a
 * million, M at a million and up, no other punctuation.
 */
function formatDenomination(denomination: number): string {
	if (denomination >= 1_000_000) return `$${denomination / 1_000_000}M`;
	return `$${denomination / 1_000}K`;
}

export function SharkCardConfigurator({
	stock,
	messages,
}: {
	stock?: Record<string, number>;
	messages: Dict;
}) {
	const t = useMemo(() => (key: string, vars?: Record<string, string | number>) => dig(messages, key, vars), [messages]);

	const [variantId, setVariantId] = useState<string>(SHARK_CARDS[2].id);
	const [modalOpen, setModalOpen] = useState(false);
	const [contact, setContact] = useState<Contact>({ method: 'telegram', handle: '' });
	const [details, setDetails] = useState<OrderDetails>(emptyOrderDetails);
	const [promoCode, setPromoCode] = useState('');
	const { busy, error, checkout, clearError } = useCheckout();

	const card = SHARK_CARDS.find((c) => c.id === variantId)!;
	const soldOut = stock ? (stock[card.sheetSku] ?? 0) <= 0 : false;

	const denominationOptions: ChipOption<string>[] = SHARK_CARDS.map((c) => ({
		value: c.id,
		label: formatDenomination(c.denomination),
	}));

	// Memoised deliberately: the modal's live discount preview keys off this
	// object's contents, and a fresh literal on every render would make it
	// re-fetch forever.
	const selection = useMemo<OrderSelection>(
		() => ({ product: 'shark_card', platform: 'pc', variantId }),
		[variantId],
	);

	const buy = () => checkout(selection, contact, details, promoCode);

	return (
		<div className="glass-panel space-y-5 p-6">
			<ChipGroup
				label={t('configurator.amount')}
				options={denominationOptions}
				value={variantId}
				onChange={setVariantId}
			/>

			<div className="glass-panel-sm border-neon-pink shadow-neon-pink p-4">
				<Button
					variant="primary"
					size="lg"
					className="w-full"
					onClick={() => setModalOpen(true)}
					disabled={soldOut}
					disabledReason={soldOut ? t('common.outOfStock') : undefined}
				>
					{/* §2.2 copy rule: "Не «BUY NOW», а «Купить за $2.49»" — this is
					    now common.buyFor ("Купить за {price}"), interpolated, so it's
					    correct in all 5 locales instead of a hardcoded RU literal. */}
					{soldOut ? t('common.outOfStock') : t('common.buyFor', { price: `$${card.price.toFixed(2)}` })}
				</Button>
			</div>

			<CheckoutModal
				open={modalOpen}
				onClose={() => { setModalOpen(false); clearError(); }}
				contact={contact}
				onContactChange={setContact}
				details={details}
				onDetailsChange={setDetails}
				promoCode={promoCode}
				onPromoCodeChange={setPromoCode}
				selection={selection}
				fallbackTotal={card.price}
				busy={busy}
				error={error}
				onSubmit={buy}
				onRetry={buy}
				t={t}
			/>
		</div>
	);
}
