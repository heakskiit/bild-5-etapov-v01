/**
 * ORDER DESCRIPTION (Batch D).
 *
 * One function now feeds five screens plus the Discord embed, so a mistake
 * here is a mistake everywhere at once -- which is the point: before PROMO-10
 * the same logic was copy-pasted five times and could disagree with itself.
 * The translator is faked as a recorder, because what matters is which key is
 * chosen and which numbers are handed to it, not the wording.
 */

import { describe, expect, it } from 'vitest';

import { describeSelection } from '@/lib/orders/describeSelection';
import type { OrderSelection } from '@/types/order';

type Vars = Record<string, string | number> | undefined;

function recorder() {
	const calls: Array<{ key: string; vars: Vars }> = [];
	const t = (key: string, vars?: Record<string, string | number>) => {
		calls.push({ key, vars });
		return key;
	};
	return { calls, t };
}

const EM_DASH = '\u2014';

const money = (amountMillions?: number) =>
	({ product: 'money', platform: 'pc', amountMillions }) as unknown as OrderSelection;
const leveling = (level?: number) =>
	({ product: 'leveling', platform: 'pc', level }) as unknown as OrderSelection;
const cashCard = () =>
	({ product: 'shark_card', platform: 'pc', variantId: 'whale' }) as unknown as OrderSelection;

describe('describeSelection', () => {
	it('shows the doubled amount and says why on an X2 money order', () => {
		const { calls, t } = recorder();
		describeSelection(money(100), t, 2);

		expect(calls).toEqual([
			{ key: 'dashboard.describeMoneyBonus', vars: { amount: 200, multiplier: 2 } },
		]);
	});

	it('accepts the numeric string the multiplier column returns', () => {
		const { calls, t } = recorder();
		describeSelection(money(100), t, '2');

		expect(calls[0].vars).toEqual({ amount: 200, multiplier: 2 });
	});

	it('uses the plain line for an ordinary money order', () => {
		const { calls, t } = recorder();
		describeSelection(money(100), t, 1);
		// Omitted multiplier must behave exactly like an explicit 1, because
		// every screen written before PROMO-10 passes nothing at all.
		describeSelection(money(100), t);

		expect(calls).toEqual([
			{ key: 'dashboard.describeMoney', vars: { amount: 100 } },
			{ key: 'dashboard.describeMoney', vars: { amount: 100 } },
		]);
	});

	it('falls back to the plain line when the multiplier is unusable', () => {
		const { calls, t } = recorder();
		describeSelection(money(100), t, 'abc');
		describeSelection(money(100), t, null);

		expect(calls.map((call) => call.key)).toEqual([
			'dashboard.describeMoney',
			'dashboard.describeMoney',
		]);
	});

	it('prints a dash instead of a number when the order carries no amount', () => {
		const { calls, t } = recorder();
		describeSelection(money(undefined), t, 2);

		expect(calls).toEqual([
			{ key: 'dashboard.describeMoney', vars: { amount: EM_DASH } },
		]);
	});

	it('ignores the multiplier on levelling and cash cards', () => {
		// X2 is money-only by decision; an X2 code cannot even be applied to
		// these, but an order carrying a stray multiplier must still read right.
		const { calls, t } = recorder();
		describeSelection(leveling(120), t, 2);
		describeSelection(leveling(undefined), t, 1);
		describeSelection(cashCard(), t, 2);

		expect(calls).toEqual([
			{ key: 'dashboard.describeLeveling', vars: { level: 120 } },
			{ key: 'dashboard.describeLeveling', vars: { level: EM_DASH } },
			{ key: 'dashboard.describeCashCard', vars: undefined },
		]);
	});

	it('returns whatever the translator produced', () => {
		const t = (key: string, vars?: Record<string, string | number>) =>
			`${key}:${JSON.stringify(vars ?? null)}`;

		expect(describeSelection(money(50), t, 2)).toBe(
			'dashboard.describeMoneyBonus:{"amount":100,"multiplier":2}',
		);
	});
});
