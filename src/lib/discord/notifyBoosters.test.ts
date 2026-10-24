/**
 * THE BOOSTER CARD IN DISCORD (F21).
 *
 * Drives the real notifyBoosters() with fetch stubbed, so the assertions run on
 * the JSON Discord would receive. The two orders are the test orders from the
 * channel: a leveling order with an add-on, and a money boost with none.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '../../../messages/en.json';
import { dig, type Dict } from '@/lib/i18n/pick';

import { notifyBoosters, notifyBoostersCart } from './notifyBoosters';

type Dispatch = Parameters<typeof notifyBoosters>[0];

interface Embed {
	title: string;
	fields: { name: string; value: string; inline: boolean }[];
}

const english = en as Dict;
const sent: { url: string; body: { content?: string; embeds: Embed[] } }[] = [];

const base = {
	id: 'o-1',
	userId: 'u-1',
	status: 'action_required',
	boosterPayoutUsd: 0.5,
	pricingVersion: '2026.08.1',
	createdAt: '2026-10-04T09:10:00Z',
};

const levelingOrder = (overrides: Record<string, unknown> = {}): Dispatch =>
	({
		...base,
		publicId: 'GT-38701E76',
		totalUsd: 1.03,
		contact_handle: 'telegram: vashnik',
		selection: { product: 'leveling', platform: 'pc', level: 1, delivery: 'normal', addonIds: ['pc_lvl_together'] },
		...overrides,
	}) as unknown as Dispatch;

const moneyOrder = (overrides: Record<string, unknown> = {}): Dispatch =>
	({
		...base,
		publicId: 'GT-EBB0F72B',
		totalUsd: 0.8,
		contact_handle: 'telegram: fdsa',
		selection: { product: 'money', platform: 'pc', amountMillions: 100, delivery: 'normal', addonIds: [] },
		...overrides,
	}) as unknown as Dispatch;

const value = (embed: Embed, name: string) => embed.fields.find((field) => field.name === name)?.value;

beforeEach(() => {
	sent.length = 0;
	vi.stubEnv('DISCORD_BOOSTER_WEBHOOK_URL', 'https://discord.test/hook');
	vi.stubGlobal(
		'fetch',
		vi.fn(async (url: string, init: { body: string }) => {
			sent.push({ url, body: JSON.parse(init.body) });
			return new Response(null, { status: 204 });
		}),
	);
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

describe('booster card', () => {
	it('names the add-on instead of printing its catalog id', async () => {
		await notifyBoosters(levelingOrder());

		const [{ body }] = sent;
		expect(value(body.embeds[0], 'Add-ons')).toBe(dig(english, 'addons.pc.together'));
		expect(JSON.stringify(body)).not.toContain('pc_lvl_together');
	});

	it('shows a dash when the order has no add-ons', async () => {
		await notifyBoosters(moneyOrder());

		expect(value(sent[0].body.embeds[0], 'Add-ons')).toBe('—');
	});

	it('leaves every other field of the card exactly as it was', async () => {
		await notifyBoosters(levelingOrder());

		const embed = sent[0].body.embeds[0];
		expect(embed.title).toBe('🆕 Order GT-38701E76');
		expect(embed.fields.map((field) => field.name)).toEqual([
			'Service',
			'Platform',
			'Delivery',
			'Order total',
			'Add-ons',
			'Customer contact',
		]);
		expect(value(embed, 'Service')).toBe('Leveling → level 1');
		expect(value(embed, 'Platform')).toBe('PC');
		expect(value(embed, 'Delivery')).toBe('normal');
		expect(value(embed, 'Order total')).toBe('**$1.03**');
		expect(value(embed, 'Customer contact')).toBe('telegram: vashnik');
	});

	it('names the add-ons in every embed of a cart message', async () => {
		const first = levelingOrder({
			cart_id: '8f2c1d9e-0000-4000-8000-000000000001',
			selection: {
				product: 'leveling',
				platform: 'pc',
				level: 50,
				delivery: 'normal',
				addonIds: ['pc_lvl_kd_reset', 'pc_lvl_stealth'],
			},
		});
		const second = moneyOrder({ cart_id: '8f2c1d9e-0000-4000-8000-000000000001' });

		await notifyBoostersCart([first, second]);

		expect(sent).toHaveLength(1);
		const { content, embeds } = sent[0].body;
		expect(content).toContain('2 jobs from one customer');
		expect(value(embeds[0], 'Add-ons')).toBe(
			`${dig(english, 'addons.pc.kdReset')}, ${dig(english, 'addons.pc.stealthMode')}`,
		);
		expect(value(embeds[1], 'Add-ons')).toBe('—');
		expect(JSON.stringify(sent[0].body)).not.toMatch(/pc_lvl_|con_lvl_/);
	});
});
