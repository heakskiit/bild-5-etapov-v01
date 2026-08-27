import { calculatePrice } from './calculate';
import { MONEY_PC, SHARK_CARDS } from '@/../config/pricing.config';
import type { OrderSelection, ProductKind } from '@/types/order';

/**
 * §4.2 point 4: "цена «от»" on every product card. This is NOT a hardcoded
 * number — pricing.config.ts's own header says "No UI component may
 * hardcode a price", and the homepage is no exception. Each selection below
 * is the same *realistic minimum* the configurators themselves open with
 * (BoostConfigurator's initial state, SharkCardConfigurator's cheapest
 * card), not the mathematical floor (e.g. leveling level=1, which would
 * price an order that boosts nothing). Change pricing.config.ts and these
 * numbers move with it automatically.
 */
const STARTING_SELECTION: Record<ProductKind, OrderSelection> = {
	shark_card: { product: 'shark_card', platform: 'pc', variantId: SHARK_CARDS[0].id },
	leveling: { product: 'leveling', platform: 'pc', level: 100, addonIds: [], delivery: 'normal' },
	money: {
		product: 'money',
		platform: 'pc',
		amountMillions: MONEY_PC.minMillions,
		gameVersion: 'legacy',
		launcher: 'steam',
		addonIds: [],
		delivery: 'normal',
	},
};

export function startingPrice(kind: ProductKind): number {
	return calculatePrice(STARTING_SELECTION[kind]).total;
}
