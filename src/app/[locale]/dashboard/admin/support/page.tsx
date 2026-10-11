import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireRole, getVerifiedProfile } from '@/lib/supabase/auth';
import { serviceClient } from '@/lib/supabase/service';
import { getTranslations, getMessages } from '@/lib/i18n/getTranslations';
import { SupportAdminRow, type AdminSupportRow } from '@/components/dashboard/SupportAdminRow';
import type { SupportStatus } from '@/lib/support/requests';

/**
 * admin -> /dashboard/admin/support (BATCH F15 / FEAT-SUP-027).
 *
 * Read through the service-role client because support_requests has RLS on
 * with no policies (0018); the role is re-checked from the session first,
 * exactly like the promo page.
 */

const FILTERS = ['active', 'resolved', 'all'] as const;
type Filter = (typeof FILTERS)[number];

export default async function SupportAdminPage({
	params,
	searchParams,
}: {
	params: Promise<{ locale: string }>;
	searchParams: Promise<{ filter?: string | string[] }>;
}) {
	const { locale } = await params;
	await requireRole(locale, ['admin']);
	const caller = await getVerifiedProfile();
	if (!caller || caller.role !== 'admin') redirect(`/${locale}/dashboard`);

	const raw = (await searchParams).filter;
	const requested = Array.isArray(raw) ? raw[0] : raw;
	const filter: Filter = (FILTERS as readonly string[]).includes(requested ?? '') ? (requested as Filter) : 'active';

	const [t, messages] = await Promise.all([getTranslations(), getMessages()]);

	let query = serviceClient()
		.from('support_requests')
		.select(
			'public_id, reason, message, status, reply, reply_seen_at, notify_failed, created_at, orders(public_id, status, contact_handle), profiles(email, discord_id)',
		)
		.order('created_at', { ascending: false })
		.limit(100);
	if (filter === 'active') query = query.neq('status', 'resolved');
	if (filter === 'resolved') query = query.eq('status', 'resolved');

	const { data, error } = await query;
	if (error) console.error('[admin/support page]', error);

	const one = <T,>(value: T | T[] | null | undefined): T | null => (Array.isArray(value) ? (value[0] ?? null) : (value ?? null));

	const rows: AdminSupportRow[] = (data ?? []).map((r: any) => {
		const order = one(r.orders) as { public_id: string; status: string; contact_handle: string | null } | null;
		const profile = one(r.profiles) as { email: string | null; discord_id: string | null } | null;
		return {
			publicId: r.public_id,
			reason: r.reason,
			message: r.message,
			status: r.status as SupportStatus,
			reply: r.reply,
			replySeenAt: r.reply_seen_at,
			notifyFailed: Boolean(r.notify_failed),
			createdAt: r.created_at,
			orderPublicId: order?.public_id ?? '—',
			orderStatus: order?.status ?? 'cancelled',
			contact: order?.contact_handle ?? null,
			email: profile?.email ?? null,
			discordId: profile?.discord_id ?? null,
		};
	});

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="font-display text-3xl text-neon-pink">{t('admin.support.title')}</h1>
				<Link href={`/${locale}/dashboard/admin`} className="text-sm text-neon-blue hover:underline">
					{t('nav.admin')}
				</Link>
			</div>

			<nav className="flex flex-wrap gap-2 text-sm">
				{FILTERS.map((value) => (
					<Link
						key={value}
						href={`/${locale}/dashboard/admin/support?filter=${value}`}
						className={[
							'rounded-md border px-3 py-1.5',
							filter === value ? 'border-neon-pink text-pink-400' : 'border-white/15 text-white/60 hover:text-neon-blue',
						].join(' ')}
					>
						{t(`admin.support.filter.${value}`)}
					</Link>
				))}
			</nav>

			{rows.length === 0 ? (
				<p className="text-sm text-white/50">{t('admin.support.empty')}</p>
			) : (
				<div className="space-y-3">
					{rows.map((row) => (
						<SupportAdminRow key={row.publicId} row={row} messages={messages} />
					))}
				</div>
			)}
		</div>
	);
}
