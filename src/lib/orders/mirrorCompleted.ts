/**
 * BATCH E3: a completed order is copied into the owner's Google Sheet.
 *
 * The sheet is a convenience log, not a system of record -- the database
 * stays authoritative. That single sentence decides every design choice in
 * this file:
 *
 *  - the write never throws. A finished job must stay finished even if
 *    Google is down, so the caller is not given the option of failing;
 *  - failures are logged loudly, never swallowed;
 *  - the secret travels in the JSON body, not in a header. Header values are
 *    ISO-8859-1 only, and this payload carries Cyrillic;
 *  - if the two env vars are absent the feature is simply off. A shop
 *    without a spreadsheet still has to be able to complete orders.
 *
 * The existing SHEETS_WEBAPP_* pair belongs to the digital-code vault
 * (src/lib/keys/googleSheets.ts) and is deliberately NOT reused: that script
 * hands out cash-card keys, and an orders log has no business holding a
 * credential that can dispense inventory.
 */

import type { OrderSelection } from '@/types/order';
import { describeSelection } from '@/lib/orders/describeSelection';
import { dig, type Dict } from '@/lib/i18n/pick';

type Translate = (key: string, vars?: Record<string, string | number>) => string;

export type CompletedOrder = {
	publicId: string;
	selection: OrderSelection;
	/** numeric over PostgREST arrives as a string. */
	totalUsd?: number | string | null;
	discountUsd?: number | string | null;
	promoCode?: string | null;
	deliveryMultiplier?: number | string | null;
	contactHandle?: string | null;
	/** Email of whoever closed the job, or a marker for automatic delivery. */
	completedBy: string;
	completedAt?: string;
};

export type OrderSheetRow = {
	completedAt: string;
	publicId: string;
	item: string;
	platform: string;
	contact: string;
	totalUsd: string;
	promoCode: string;
	discountUsd: string;
	completedBy: string;
};

/** Marker used when nobody closed the order by hand. */
export const AUTO_DELIVERY = 'auto (CryptoBot)';

/** Money as the sheet wants it: fixed two decimals, or empty for nothing. */
function money(value: number | string | null | undefined, keepZero = false): string {
	const n = Number(value ?? 0);
	if (!Number.isFinite(n)) return '';
	if (n === 0 && !keepZero) return '';
	return n.toFixed(2);
}

/**
 * Pure row builder -- separated from the HTTP call so it can be tested
 * without a network, and so a formatting mistake shows up in `npm test`
 * rather than in a spreadsheet three weeks later.
 */
export function buildOrderRow(order: CompletedOrder, t: Translate): OrderSheetRow {
	return {
		completedAt: order.completedAt ?? new Date().toISOString(),
		publicId: order.publicId,
		// Same description the booster and the customer read, doubled amounts
		// included -- three renderings of one order would be three chances to
		// disagree with each other.
		item: describeSelection(order.selection, t, order.deliveryMultiplier),
		platform: (order.selection.platform ?? '').toString().toUpperCase(),
		contact: order.contactHandle ?? '',
		totalUsd: money(order.totalUsd, true),
		promoCode: order.promoCode ?? '',
		discountUsd: money(order.discountUsd),
		completedBy: order.completedBy,
	};
}

async function russianTranslator(): Promise<Translate> {
	// The sheet has one reader -- the owner -- so it is written in one
	// language instead of whatever locale cookie the closing request carried.
	const dict = (await import('../../../messages/ru.json')).default as Dict;
	return (key, vars) => dig(dict, key, vars);
}

/**
 * Appends one row to the orders sheet. Resolves in every case; the boolean
 * says whether the row landed, for callers that want to log it.
 */
export async function mirrorCompletedOrder(order: CompletedOrder): Promise<boolean> {
	const url = process.env.SHEETS_WEBHOOK_URL;
	const secret = process.env.SHEETS_WEBHOOK_SECRET;
	if (!url || !secret) return false;

	try {
		const t = await russianTranslator();
		const row = buildOrderRow(order, t);

		const response = await fetch(url, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ secret, ...row }),
			// Short on purpose: the order is already completed, and nobody should
			// wait on a spreadsheet.
			signal: AbortSignal.timeout(8_000),
		});

		const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
		if (!response.ok || !data?.ok) {
			console.error('[sheets] order not logged', {
				order: order.publicId,
				status: response.status,
				error: data?.error,
			});
			return false;
		}
		return true;
	} catch (err) {
		// Timeouts, DNS, a redeployed script URL -- all of it lands here and
		// none of it is allowed to reach the caller.
		console.error('[sheets] order not logged', { order: order.publicId, err });
		return false;
	}
}
