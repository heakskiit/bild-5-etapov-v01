/**
 * ORDER VOLUME LIMITS (Batch E1).
 *
 * An unpaid order costs the customer nothing: a row is written, an invoice is
 * created, and if nobody pays it simply sits there. Cheap for whoever is
 * playing games, expensive for the owner, who has to read past it in every
 * list that matters.
 *
 * Two limits, deliberately different in shape:
 *
 *  - pending: how many unpaid orders one profile may have open at once. This
 *    is the limit that actually stops the abuse, and it never inconveniences a
 *    paying customer, because paying removes the order from the count within
 *    seconds.
 *  - daily: a backstop against churning rows all day. Set high enough that a
 *    real customer cannot reach it.
 *
 * FAIL OPEN, like the rate limiter: a count that could not be read is passed
 * as null and the order is allowed. Refusing to sell because a COUNT(*) failed
 * would be a worse outage than the abuse this prevents.
 */

/** Unpaid orders one profile may have open at the same time. */
export const MAX_PENDING_ORDERS = 5;

/** Orders of any status one profile may create per rolling 24 hours. */
export const MAX_ORDERS_PER_DAY = 20;

/**
 * How far back an unpaid order still counts as "waiting". A CryptoBot invoice
 * stops being payable long before this, so anything older is abandoned rather
 * than pending and must not hold a slot forever.
 */
export const PENDING_WINDOW_HOURS = 48;

export type OrderLimitReason = 'too_many_pending' | 'daily_limit';

export type OrderLimitVerdict =
	| { allowed: true }
	| { allowed: false; reason: OrderLimitReason; limit: number };

const ALLOW: OrderLimitVerdict = { allowed: true };

/** Usable only if the count is a real, finite, non-negative number. */
const usable = (n: number | null | undefined): n is number =>
	typeof n === 'number' && Number.isFinite(n) && n >= 0;

/**
 * Pure decision, so the rule can be tested without a database and cannot
 * drift between the route that enforces it and the copy that explains it.
 */
export function canPlaceOrder({
	pendingCount,
	dailyCount,
}: {
	pendingCount: number | null | undefined;
	dailyCount: number | null | undefined;
}): OrderLimitVerdict {
	// Pending is checked first on purpose: it is the refusal a customer can act
	// on ("pay the one you already have"), whereas the daily cap can only tell
	// them to come back tomorrow.
	if (usable(pendingCount) && pendingCount >= MAX_PENDING_ORDERS) {
		return { allowed: false, reason: 'too_many_pending', limit: MAX_PENDING_ORDERS };
	}
	if (usable(dailyCount) && dailyCount >= MAX_ORDERS_PER_DAY) {
		return { allowed: false, reason: 'daily_limit', limit: MAX_ORDERS_PER_DAY };
	}
	return ALLOW;
}

/** Start of the pending window, as the ISO string the DB filter needs. */
export const pendingWindowStart = (now: Date = new Date()): string =>
	new Date(now.getTime() - PENDING_WINDOW_HOURS * 3_600_000).toISOString();

/** Start of the rolling day, as the ISO string the DB filter needs. */
export const dayWindowStart = (now: Date = new Date()): string =>
	new Date(now.getTime() - 24 * 3_600_000).toISOString();
