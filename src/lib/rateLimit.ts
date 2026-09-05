/**
 * Durable rate limiting (PROMO-5).
 *
 * Counters live in Postgres (migration 0009) rather than in module state, so
 * they survive cold starts and are shared by every serverless instance. The
 * previous in-process version could be reset simply by waiting for a new
 * instance, which made it a speed bump rather than a limit.
 *
 * FAIL OPEN, DELIBERATELY
 * If the limiter itself errors, the request is allowed. A limiter that takes
 * checkout down with it is a worse outage than the abuse it prevents, and if
 * Postgres is unreachable the request was going to fail on its own anyway.
 * Every failure is logged so a broken limiter cannot fail silently forever.
 */

import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase/service';

export type RateLimitVerdict = {
	allowed: boolean;
	/** Null when the check could not run (fail-open) or the key was fresh. */
	resetAt: string | null;
	retryAfterSeconds: number;
};

const ALLOW: RateLimitVerdict = { allowed: true, resetAt: null, retryAfterSeconds: 0 };

/**
 * Per-user budgets, all per minute. Kept together so they can be reasoned
 * about as a set instead of being scattered across route files.
 *
 * `checkoutPreview` is the loosest by far because the debounce fires once per
 * typing pause: one hand-typed code legitimately costs several lookups.
 */
export const RATE_LIMITS = {
	checkout: { limit: 10, windowSeconds: 60 },
	checkoutPreview: { limit: 60, windowSeconds: 60 },
	revealCode: { limit: 20, windowSeconds: 60 },
	credentials: { limit: 10, windowSeconds: 60 },
	adminRole: { limit: 20, windowSeconds: 60 },
} as const;

export type RateLimitBucket = keyof typeof RATE_LIMITS;

/**
 * Records one hit against `bucket:identity` and reports whether it is allowed.
 * The hit is counted even when refused, so hammering a limit keeps it closed.
 */
export async function consumeRateLimit(
	bucket: RateLimitBucket,
	identity: string,
): Promise<RateLimitVerdict> {
	const { limit, windowSeconds } = RATE_LIMITS[bucket];

	try {
		const { data, error } = await serviceClient()
			.rpc('consume_rate_limit', {
				p_key: `${bucket}:${identity}`,
				p_limit: limit,
				p_window_seconds: windowSeconds,
			})
			.maybeSingle<{ allowed: boolean; hit_count: number; reset_at: string }>();

		if (error) throw error;
		if (!data) return ALLOW;

		const msLeft = new Date(data.reset_at).getTime() - Date.now();
		return {
			allowed: data.allowed,
			resetAt: data.reset_at,
			retryAfterSeconds: Number.isFinite(msLeft) ? Math.max(1, Math.ceil(msLeft / 1000)) : 60,
		};
	} catch (err) {
		console.error(`[rateLimit] ${bucket} check failed, allowing request`, err);
		return ALLOW;
	}
}

/** Standard 429 with Retry-After, for routes that need no custom body. */
export function tooManyRequests(verdict: RateLimitVerdict) {
	return NextResponse.json(
		{ error: 'rate_limited' },
		{ status: 429, headers: { 'retry-after': String(verdict.retryAfterSeconds || 60) } },
	);
}
