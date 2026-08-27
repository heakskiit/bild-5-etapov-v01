'use client';

import { ChipGroup, type ChipOption } from '@/components/ui/Chip';
import type { Contact } from '@/lib/hooks/useCheckout';
import type { ContactMethod } from '@/lib/validation/order';

const INPUT =
	'w-full rounded-lg border border-white/15 bg-night px-3 py-2 text-sm outline-none focus:border-neon-blue';

const METHOD_KEYS: Record<ContactMethod, string> = {
	telegram: 'checkout.contactMethodTelegram',
	whatsapp: 'checkout.contactMethodWhatsapp',
	discord: 'checkout.contactMethodDiscord',
};

const PLACEHOLDER_KEYS: Record<ContactMethod, string> = {
	telegram: 'checkout.contactPlaceholderTelegram',
	whatsapp: 'checkout.contactPlaceholderWhatsapp',
	discord: 'checkout.contactPlaceholderDiscord',
};

export const isContactValid = (contact: Contact) => contact.handle.trim().length >= 2;

/**
 * §1: mandatory on every checkout, regardless of product type — this is
 * the one thing all three entry points (BoostConfigurator,
 * SharkCardConfigurator, ProductPreviewCard) now share before the pay
 * button. Never shows a password field; that stays out of scope here
 * entirely (see the boost credential flow, which is a separate,
 * post-purchase step in the dashboard).
 */
export function ContactField({
	value,
	onChange,
	t,
}: {
	value: Contact;
	onChange: (next: Contact) => void;
	t: (key: string, vars?: Record<string, string | number>) => string;
}) {
	const options: ChipOption<ContactMethod>[] = (['telegram', 'whatsapp', 'discord'] as const).map((m) => ({
		value: m,
		label: t(METHOD_KEYS[m]),
	}));

	return (
		<div className="space-y-2">
			<ChipGroup
				label={t('checkout.contactLabel')}
				options={options}
				value={value.method}
				onChange={(method) => onChange({ ...value, method })}
			/>
			<input
				type="text"
				value={value.handle}
				onChange={(e) => onChange({ ...value, handle: e.target.value })}
				placeholder={t(PLACEHOLDER_KEYS[value.method])}
				aria-label={t('checkout.contactLabel')}
				className={INPUT}
			/>
		</div>
	);
}
