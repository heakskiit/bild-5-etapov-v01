/**
 * ONE description of an order, shared by every screen that shows one.
 *
 * Before PROMO-10 this logic was copy-pasted into five places: the customer's
 * order row, the booster queue, the job card, the admin list and the Discord
 * embed. That was survivable while the text only depended on `selection` --
 * it stopped being survivable once the delivered amount could differ from the
 * ordered amount, because a booster reading "100M" while the customer reads
 * "200M" is not a cosmetic bug.
 */

import type { OrderSelection } from '@/types/order';
import { deliveredMillions } from '@/lib/pricing/promoBonus';

type Translate = (key: string, vars?: Record<string, string | number>) => string;

export function describeSelection(
	selection: OrderSelection,
	t: Translate,
	/** From orders.delivery_multiplier; 1 for every ordinary order. */
	multiplier: number | string | null | undefined = 1,
): string {
	if (selection.product === 'shark_card') return t('dashboard.describeCashCard');
	if (selection.product === 'leveling') {
		return t('dashboard.describeLeveling', { level: selection.level ?? '\u2014' });
	}

	const factor = Number(multiplier ?? 1);
	const delivered = deliveredMillions(selection.amountMillions, factor);

	// Show the doubled figure, and say why it is doubled. Printing "200M" with
	// no explanation invites a support ticket from the booster asking whether
	// the order is a mistake.
	if (delivered != null && Number.isFinite(factor) && factor > 1) {
		return t('dashboard.describeMoneyBonus', { amount: delivered, multiplier: factor });
	}

	return t('dashboard.describeMoney', { amount: selection.amountMillions ?? '\u2014' });
}
