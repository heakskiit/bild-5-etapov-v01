'use client';

/**
 * §4.1/§4.2 point 3: "Справа — живая карточка товара с ценой и работающей
 * кнопкой. Это главное отличие от текущей версии: продажа начинается на
 * первом экране." Deliberately a SEPARATE, smaller component from
 * SharkCardConfigurator — that one is the full product-page configurator
 * (glass-panel wrapper, all 7 denominations); this is a compact "mini-выбор
 * номинала" (§4.1) meant to sit inside the hero.
 *
 * `stock` is optional and comes from the parent (a server component calling
 * googleSheets.ts `stockLevel`) — see page.tsx. If it's not passed, or the
 * Sheets call failed, this renders with no stock claim at all rather than
 * assuming "in stock"; a missing fact isn't the same as a false one.
 */

import { useMemo, useState } from 'react';
import { SHARK_CARDS } from '@/../config/pricing.config';
import { getProductBySlug } from '@/lib/catalog';
import { ChipGroup, type ChipOption } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { dig, type Dict } from '@/lib/i18n/pick';
import { useCheckout, emptyOrderDetails, type Contact } from '@/lib/hooks/useCheckout';
import { CheckoutModal } from '@/components/checkout/CheckoutModal';
import type { OrderDetails } from '@/lib/validation/order';

function formatDenomination(denomination: number): string {
	if (denomination >= 1_000_000) return `$${denomination / 1_000_000}M`;
	return `$${denomination / 1_000}K`;
}

// A handful, not the full set of 7 — keeps the hero card compact. The
// product page's own configurator has the complete range.
const PREVIEW_CARD_IDS = ['sc_100k', 'sc_1m', 'sc_4m', 'sc_10m'];

const CASH_CARDS_ENTRY = getProductBySlug('cash-cards')!;

export function ProductPreviewCard({ messages, stock }: { messages: Dict; stock?: Record<string, number> }) {
	const t = useMemo(() => (key: string, vars?: Record<string, string | number>) => dig(messages, key, vars), [messages]);

	const [variantId, setVariantId] = useState<string>(SHARK_CARDS[0].id);
	const [modalOpen, setModalOpen] = useState(false);
	const [contact, setContact] = useState<Contact>({ method: 'telegram', handle: '' });
	const [details, setDetails] = useState<OrderDetails>(emptyOrderDetails);
	const { busy, error, checkout, clearError } = useCheckout();

	const card = SHARK_CARDS.find((c) => c.id === variantId)!;
	const soldOut = stock ? (stock[card.sheetSku] ?? 0) <= 0 : false;
	const options: ChipOption<string>[] = SHARK_CARDS.filter((c) => PREVIEW_CARD_IDS.includes(c.id)).map((c) => ({
		value: c.id,
		label: formatDenomination(c.denomination),
	}));

	const buy = () => checkout({ product: 'shark_card', platform: 'pc', variantId }, contact, details);

	return (
		<div className="glass-panel p-6">
			<div className="flex items-center justify-between gap-2">
				<p className="font-display text-xs uppercase tracking-widest text-ink-muted">{t(CASH_CARDS_ENTRY.titleKey)}</p>
				{/* Only rendered when we actually know — see the header comment. */}
				{stock && (
					<span
						className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
							soldOut ? 'border-white/20 text-white/40' : 'border-emerald-400/40 text-emerald-300'
						}`}
					>
						{soldOut ? t('common.outOfStock') : t('common.inStock')}
					</span>
				)}
			</div>
			<p className="mt-1 font-display text-3xl tabular-nums text-ink">${card.price.toFixed(2)}</p>

			<div className="mt-4">
				<ChipGroup label={t('configurator.amount')} options={options} value={variantId} onChange={setVariantId} />
			</div>

			<Button
				variant="primary"
				size="lg"
				className="mt-5 w-full"
				onClick={() => setModalOpen(true)}
				disabled={soldOut}
				disabledReason={soldOut ? t('common.outOfStock') : undefined}
			>
				{soldOut ? t('common.outOfStock') : t('common.buyFor', { price: `$${card.price.toFixed(2)}` })}
			</Button>

			<CheckoutModal
				open={modalOpen}
				onClose={() => { setModalOpen(false); clearError(); }}
				contact={contact}
				onContactChange={setContact}
				details={details}
				onDetailsChange={setDetails}
				busy={busy}
				error={error}
				onSubmit={buy}
				onRetry={buy}
				t={t}
			/>
		</div>
	);
}
