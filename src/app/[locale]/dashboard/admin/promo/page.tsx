import { redirect } from 'next/navigation';
import { requireRole, getVerifiedProfile } from '@/lib/supabase/auth';
import { serviceClient } from '@/lib/supabase/service';
import { getTranslations, getMessages } from '@/lib/i18n/getTranslations';
import { PromoCodeManager, type PromoRow } from '@/components/dashboard/PromoCodeManager';

/**
 * admin -> /dashboard/admin/promo (PROMO-7).
 *
 * Reads through the service-role client, which is not a shortcut: promo_codes
 * has RLS enabled with zero policies (0006), so a page-level routeClient()
 * would return an empty list rather than an error -- an admin page that
 * silently shows nothing is worse than one that fails.
 */

export default async function PromoPage({ params }: { params: Promise<{ locale: string }> }) {
	const { locale } = await params;
	await requireRole(locale, ['admin']);

	// requireRole() may trust the middleware header for speed. Everything below
	// ignores RLS, so the role is re-established from the session first -- the
	// same rule the admin API routes follow before any serviceClient() call.
	const caller = await getVerifiedProfile();
	if (!caller || caller.role !== 'admin') redirect(`/${locale}/dashboard`);

	const t = await getTranslations();
	const messages = await getMessages();

	const db = serviceClient();
	const [listed, issued, active, used] = await Promise.all([
		db
			.from('promo_codes')
			.select('id, code, discount_type, discount_value, min_order_usd, active, used_at, expires_at, created_at, used_by_order_id')
			.order('created_at', { ascending: false })
			.limit(100),
		db.from('promo_codes').select('id', { count: 'exact', head: true }),
		db.from('promo_codes').select('id', { count: 'exact', head: true }).eq('active', true).is('used_at', null),
		db.from('promo_codes').select('id', { count: 'exact', head: true }).not('used_at', 'is', null),
	]);

	// PostgREST reports a failed read as { data: null, error } instead of
	// throwing, so every one of these queries used to fail silently: a broken
	// list rendered exactly like "no codes issued yet".
	if (listed.error) {
		console.error('[admin/promo] promo_codes list read failed', listed.error);
		// The list is the whole point of the page, so failing loudly is the
		// lesser evil: an admin who sees an error retries, while an admin who
		// sees an empty table issues a duplicate code.
		throw new Error(`promo_codes read failed: ${listed.error.message}`);
	}

	for (const [label, result] of [
		['issued', issued],
		['active', active],
		['used', used],
	] as const) {
		// A wrong counter is cosmetic, so these still degrade to 0 -- but they
		// no longer do it without saying so.
		if (result.error) console.error(`[admin/promo] ${label} count failed`, result.error);
	}

	const listedRows = (listed.data ?? []) as any[];

	// Resolved in a second read rather than an embedded join: the same shape
	// loadProfileMap() uses on the orders page, and it keeps the row selection
	// above independent of how used_by_order_id happens to be constrained.
	const orderIds = listedRows.map((row) => row.used_by_order_id).filter(Boolean);
	const orderMap = new Map<string, string>();
	if (orderIds.length > 0) {
		const { data: orders, error: ordersError } = await db.from('orders').select('id, public_id').in('id', orderIds);
		// Not fatal: without this map the code column simply shows no order
		// link, which is a degraded page rather than a misleading one.
		if (ordersError) console.error('[admin/promo] used_by_order_id lookup failed', ordersError);
		for (const order of (orders ?? []) as any[]) orderMap.set(order.id, order.public_id);
	}

	const rows: PromoRow[] = listedRows.map((row) => ({
		id: Number(row.id),
		code: row.code,
		discount_type: row.discount_type,
		// numeric arrives as a string over PostgREST; coerced once, here.
		discount_value: Number(row.discount_value),
		min_order_usd: Number(row.min_order_usd ?? 0),
		active: Boolean(row.active),
		used_at: row.used_at ?? null,
		expires_at: row.expires_at ?? null,
		created_at: row.created_at,
		order_public_id: row.used_by_order_id ? orderMap.get(row.used_by_order_id) ?? null : null,
	}));

	return (
		<div className="space-y-8">
			<div className="space-y-1">
				<h1 className="font-display text-3xl text-neon-pink">{t('admin.promo.title')}</h1>
				<p className="text-sm text-ink-soft">{t('admin.promo.subtitle')}</p>
			</div>

			<PromoCodeManager
				rows={rows}
				stats={{ issued: issued.count ?? 0, active: active.count ?? 0, used: used.count ?? 0 }}
				messages={messages}
				locale={locale}
			/>
		</div>
	);
}
