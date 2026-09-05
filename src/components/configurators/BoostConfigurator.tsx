'use client';

/**
 * Conditional-logic host for every boost card.
 *
 * The decision table this implements:
 *
 *  product   | platform  | amount / level control        | add-on grid
 *  ----------|-----------|------------------------------|-------------
 *  leveling  | pc        | Slider 1..8000               | PC set (10)
 *  leveling  | ps/xbox   | Dropdown of fixed levels     | Console set (10)
 *  money     | pc        | Slider 100m..5000m           | PC set (10)
 *  money     | ps/xbox   | Radio group of fixed amounts | Console set (10)
 *
 * The "pc" platform option itself is labelled "PC Legacy/Enhanced" — Legacy
 * vs Enhanced and Steam/Epic/Rockstar are no longer separate selectors here;
 * that choice moves to checkout in a follow-up task.
 *
 * Delivery speed is common to all four branches. The price shown here is an
 * optimistic preview computed with the same pure function the server uses; the
 * server value always wins at invoice time (see src/lib/pricing/calculate.ts,
 * which itself derives every number from config/pricing.config.ts).
 */

import { useEffect, useMemo, useState } from 'react';
import {
	DELIVERY_MODIFIERS,
	LEVELING_ADDONS_CONSOLE,
	LEVELING_ADDONS_PC,
	LEVELING_CONSOLE,
	LEVELING_PC,
	MONEY_CONSOLE,
	MONEY_PC,
	type DeliverySpeed,
	type Platform,
} from '@/../config/pricing.config';
import { calculatePrice, type PriceBreakdown } from '@/lib/pricing/calculate';
import { dig, type Dict } from '@/lib/i18n/pick';
import type { OrderSelection, ProductKind } from '@/types/order';
import { AddonGrid } from './AddonGrid';
import { Slider } from '@/components/ui/Slider';
import { ChipGroup, type ChipOption } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { useCheckout, emptyOrderDetails, type Contact } from '@/lib/hooks/useCheckout';
import { CheckoutModal } from '@/components/checkout/CheckoutModal';
import type { OrderDetails } from '@/lib/validation/order';

const PLATFORM_OPTIONS: ChipOption<Platform>[] = [
	{ value: 'pc', label: 'PC Legacy/Enhanced' },
	{ value: 'ps', label: 'PlayStation' },
	{ value: 'xbox', label: 'Xbox' },
];

const DELIVERY_LABEL_KEYS: Record<DeliverySpeed, string> = {
	normal: 'configurator.deliveryNormal',
	express: 'configurator.deliveryExpress',
	super_express: 'configurator.deliverySuperExpress',
};

export function BoostConfigurator({
	product,
	messages,
}: {
	product: Extract<ProductKind, 'leveling' | 'money'>;
	messages: Dict;
}) {
	// Resolved once per `messages` prop change (locale switch), never per
	// render — this is what every control below uses instead of the raw key.
	const t = useMemo(() => (key: string, vars?: Record<string, string | number>) => dig(messages, key, vars), [messages]);

	// 1. All configurable inputs live in one selection object: platform,
	// launcher, the slider value (level for leveling / amountMillions for
	// money), delivery speed, addons, etc.
	const [selection, setSelection] = useState<OrderSelection>({
		product,
		platform: 'pc',
		level: product === 'leveling' ? 100 : undefined,
		amountMillions: product === 'money' ? MONEY_PC.minMillions : undefined,
		gameVersion: 'legacy',
		launcher: 'steam',
		addonIds: [],
		delivery: 'normal',
	});

	// Derived pricing state. Recomputed via useEffect below whenever the
	// selection changes, so every slider drag or checkbox toggle instantly
	// refreshes the Total Price shown in the checkout bar.
	const [priceBreakdown, setPriceBreakdown] = useState<PriceBreakdown | null>(null);
	const [priceError, setPriceError] = useState<string | null>(null);
	const [modalOpen, setModalOpen] = useState(false);
	const [contact, setContact] = useState<Contact>({ method: 'telegram', handle: '' });
	const [details, setDetails] = useState<OrderDetails>(emptyOrderDetails);
	const [promoCode, setPromoCode] = useState('');
	const { busy, error, checkout, clearError } = useCheckout();

	const patch = (next: Partial<OrderSelection>) => setSelection((prev) => ({ ...prev, ...next }));

	/** Switching platform resets platform-specific state — never carry it over. */
	const onPlatformChange = (platform: Platform) => {
		const isPc = platform === 'pc';
		patch({
			platform,
			addonIds: [], // the add-on catalogue itself changes
			level: product === 'leveling' ? (isPc ? 100 : 50) : undefined,
			amountMillions: product === 'money' ? (isPc ? MONEY_PC.minMillions : 10) : undefined,
			gameVersion: isPc ? 'legacy' : undefined,
			launcher: isPc ? 'steam' : undefined,
		});
	};

	// 2. Single source of truth for price recalculation. `calculatePrice`
	// (src/lib/pricing/calculate.ts) is the same pure function used server-side,
	// and it in turn reads every rate/tier from config/pricing.config.ts — so the
	// progressive-discount math for the money-boost slider is always correct and
	// never duplicated here.
	useEffect(() => {
		try {
			const breakdown = calculatePrice(selection);
			setPriceBreakdown(breakdown);
			setPriceError(null);
		} catch (err) {
			// Selection can be transiently invalid mid-update (e.g. platform just
			// switched but level hasn't settled yet) — treat that as "no price yet"
			// instead of throwing.
			setPriceBreakdown(null);
			setPriceError(err instanceof Error ? err.message : 'Unable to price this configuration');
		}
	}, [selection]);

	const isPc = selection.platform === 'pc';
	const addons = isPc ? LEVELING_ADDONS_PC : LEVELING_ADDONS_CONSOLE;

	const buy = () => {
		if (!priceBreakdown) return;
		// Log the fully-formed order (every selected option + the final price)
		// for debugging/inspection before anything is sent over the wire.
		// eslint-disable-next-line no-console
		console.log('[BoostConfigurator] Pay via CryptoBot — order payload:', {
			...selection,
			priceBreakdown,
			totalUsd: priceBreakdown.total,
		});
		// Only IDs travel over the wire. No price — the server recomputes it from
		// pricing.config.ts and never trusts a client-supplied amount.
		checkout(selection, contact, details, promoCode);
	};

	return (
		// This is the card wrapper: same `.glass-panel` surface used for the
		// left-hand image tile and info panels, so the whole page reads as one
		// glass system rather than each component inventing its own opacity.
		// The chips below are all `ChipGroup` (design system §3.1) now —
		// PlatformSelector/RadioGroup/Dropdown were three different visual
		// solutions for the same "pick one of these" job; this is the one
		// they collapsed into.
		<div className="glass-panel space-y-5 p-6">
			<ChipGroup
				label={t('configurator.platform')}
				options={PLATFORM_OPTIONS}
				value={selection.platform}
				onChange={onPlatformChange}
			/>

			{product === 'leveling' &&
				(isPc ? (
					<Slider
						label={t('configurator.targetLevel')}
						min={LEVELING_PC.minLevel}
						max={LEVELING_PC.maxLevel}
						value={selection.level!}
						onChange={(level) => patch({ level })}
						tiers={LEVELING_PC.tiers}
					/>
				) : (
					<ChipGroup
						label={t('configurator.targetLevel')}
						options={Object.keys(LEVELING_CONSOLE[selection.platform]!)
							.map(Number)
							.map((level): ChipOption<number> => ({ value: level, label: String(level) }))}
						value={selection.level!}
						onChange={(level) => patch({ level })}
					/>
				))}

			{product === 'money' &&
				(isPc ? (
					// Version (Legacy/Enhanced) and launcher (Steam/Epic/Rockstar) are no
					// longer separate selectors here — "PC" in PLATFORM_OPTIONS above now
					// reads "PC Legacy/Enhanced" and covers both. `selection.gameVersion`/
					// `selection.launcher` still default to 'legacy'/'steam' (set in the
					// initial state and in onPlatformChange) so pricing keeps working;
					// picking the actual launcher moves to checkout in a follow-up task.
					<Slider
						label={t('configurator.amount')}
						min={MONEY_PC.minMillions}
						max={MONEY_PC.maxMillions}
						step={MONEY_PC.step}
						suffix="m"
						value={selection.amountMillions!}
						onChange={(amountMillions) => patch({ amountMillions })}
						tiers={MONEY_PC.tiers}
					/>
				) : (
					<ChipGroup
						label={t('configurator.amount')}
						options={Object.keys(MONEY_CONSOLE)
							.map(Number)
							.map((amount): ChipOption<number> => ({ value: amount, label: `${amount}M` }))}
						value={selection.amountMillions!}
						onChange={(amountMillions) => patch({ amountMillions })}
					/>
				))}

			<AddonGrid
				options={addons}
				selected={selection.addonIds ?? []}
				onChange={(addonIds) => patch({ addonIds })}
				t={t}
			/>

			<ChipGroup
				label={t('configurator.delivery')}
				options={(Object.keys(DELIVERY_MODIFIERS) as DeliverySpeed[]).map(
					(speed): ChipOption<DeliverySpeed> => ({
						value: speed,
						label: t(DELIVERY_LABEL_KEYS[speed]),
					}),
				)}
				value={selection.delivery!}
				onChange={(delivery) => patch({ delivery })}
			/>

			<CheckoutBar
				priceBreakdown={priceBreakdown}
				priceError={priceError}
				onBuyClick={() => setModalOpen(true)}
				t={t}
			/>

			<CheckoutModal
				open={modalOpen}
				onClose={() => { setModalOpen(false); clearError(); }}
				contact={contact}
				onContactChange={setContact}
				details={details}
				onDetailsChange={setDetails}
				promoCode={promoCode}
				onPromoCodeChange={setPromoCode}
				// The modal re-prices this server-side to show the discount; the
				// local breakdown below is only the fallback when that can't run.
				selection={selection}
				fallbackTotal={priceBreakdown?.total ?? null}
				busy={busy}
				error={error}
				onSubmit={buy}
				onRetry={buy}
				t={t}
			/>
		</div>
	);
}

function CheckoutBar({
	priceBreakdown,
	priceError,
	onBuyClick,
	t,
}: {
	priceBreakdown: PriceBreakdown | null;
	priceError: string | null;
	onBuyClick: () => void;
	t: (key: string, vars?: Record<string, string | number>) => string;
}) {
	return (
		// `glass-panel-sm` gives the bar the same translucent fill + blur as
		// every other surface. `border-neon-pink shadow-neon-pink` is the same
		// pair OrderRow/Header/the homepage hero already use for an active
		// state — now that shadow-neon-pink is a single tight 14px bloom
		// (tailwind.config.ts) instead of a 42px one, it stays crisp here too.
		<div className="glass-panel-sm border-neon-pink shadow-neon-pink space-y-2 p-4">
			{priceError && <p className="text-xs text-pink-400">{priceError}</p>}
			<Button
				variant="primary"
				size="lg"
				className="w-full"
				onClick={onBuyClick}
				disabled={!priceBreakdown}
				disabledReason={!priceBreakdown ? (priceError ?? undefined) : undefined}
			>
				{/* §2.2: "Не «PAY VIA CRYPTOBOT», а «Оплатить $6.50»" — now a real
				    interpolated key (common.payFor: "Оплатить {price}") instead of
				    a hardcoded Russian literal, so it's correct in all 5 locales. */}
				{priceBreakdown ? t('common.payFor', { price: `$${priceBreakdown.total.toFixed(2)}` }) : t('common.payFor', { price: '…' })}
			</Button>
		</div>
	);
}
