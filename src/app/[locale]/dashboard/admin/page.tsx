import { describeSelection } from '@/lib/orders/describeSelection';
import Link from 'next/link';
import { requireRole, routeClient } from '@/lib/supabase/auth';
import { getTranslations } from '@/lib/i18n/getTranslations';
import { dayWindowStart } from '@/lib/orders/orderLimits';
import type { OrderSelection, OrderStatus } from '@/types/order';

type AdminFilterStatus = 'paid24' | 'all' | 'paid' | 'awaiting_payment' | 'cancelled' | 'completed';

type AdminSearchParams = {
	status?: string | string[];
	q?: string | string[];
	page?: string | string[];
};

type AdminOrderRow = {
	id: string;
	public_id: string;
	user_id: string;
	status: OrderStatus;
	selection: OrderSelection;
	total_usd: string;
	created_at: string;
	paid_at: string | null;
	contact_handle: string | null;
	assigned_modder_id: string | null;
};

type ProfileLookup = {
	id: string;
	email: string | null;
	discord_id: string | null;
};

const PAGE_SIZE = 25;
const FILTERS: Array<{ value: AdminFilterStatus; labelKey: string }> = [
	{ value: 'paid24', labelKey: 'admin.filterPaid24' },
	{ value: 'all', labelKey: 'admin.filterAll' },
	{ value: 'paid', labelKey: 'admin.filterPaid' },
	{ value: 'awaiting_payment', labelKey: 'admin.filterAwaiting' },
	{ value: 'cancelled', labelKey: 'admin.filterCancelled' },
	{ value: 'completed', labelKey: 'admin.filterCompleted' },
];

/**
 * admin → /dashboard/admin. An orders workbench with server-side filters,
 * search, newest-first sorting and pagination.
 *
 * BATCH E2: the default view is "paid in the last 24 hours" rather than
 * everything ever ordered. Unpaid orders cost nothing to create, so an
 * unfiltered list is the one thing an abuser can fill up for free -- and the
 * owner would be reading past it every single day. Full history is still one
 * click away behind the "all" filter.
 *
 * Role management lived here until E2 and now doesn't: roles are changed
 * directly in the database. A button with no API behind it is dead weight,
 * and an API with no button is an unwatched door -- so both went.
 */
export default async function AdminPage({
	params,
	searchParams,
}: {
	params: Promise<{ locale: string }>;
	searchParams: Promise<AdminSearchParams>;
}) {
	const { locale } = await params;
	await requireRole(locale, ['admin']);
	const [rawSearchParams, t] = await Promise.all([searchParams, getTranslations()]);
	const filters = normalizeFilters(rawSearchParams);

	const supabase = await routeClient();
	const ordersResult = await loadAdminOrders(supabase, filters);

	const totalPages = Math.max(1, Math.ceil(ordersResult.totalCount / PAGE_SIZE));
	const from = ordersResult.totalCount === 0 ? 0 : (filters.page - 1) * PAGE_SIZE + 1;
	const to = ordersResult.totalCount === 0 ? 0 : Math.min(filters.page * PAGE_SIZE, ordersResult.totalCount);

	return (
		<div className="space-y-8">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h1 className="font-display text-3xl text-neon-pink">{t('nav.admin')}</h1>
					<p className="mt-2 text-sm text-white/50">{t('admin.sortNewest')}</p>
				</div>
				<Link
					href={`/${locale}/dashboard/admin/inventory`}
					className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-neon-blue hover:border-neon-blue"
				>
					{t('admin.inventory.title')}
				</Link>
				<Link
					href={`/${locale}/dashboard/admin/promo`}
					className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-neon-blue hover:border-neon-blue"
				>
					{t('admin.promo.title')}
				</Link>
			</div>

			<section className="space-y-4">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<h2 className="font-display text-sm uppercase tracking-widest text-white/60">{t('admin.ordersTitle')}</h2>
					<p className="text-xs text-white/40">
						{t('admin.resultCount', { from, to, total: ordersResult.totalCount })}
					</p>
				</div>

				<div className="glass-panel space-y-4 p-4">
					<div className="flex flex-wrap gap-2">
						{FILTERS.map((filter) => {
							const active = filters.status === filter.value;
							return (
								<Link
									key={filter.value}
									href={buildAdminHref(locale, filters, { status: filter.value, page: 1 })}
									className={[
										'rounded-md border px-3 py-1.5 text-sm transition-colors',
										active
											? 'border-neon-pink text-pink-400 shadow-neon-pink'
											: 'border-white/10 text-white/70 hover:border-neon-blue hover:text-neon-blue',
									].join(' ')}
								>
									{t(filter.labelKey)}
								</Link>
							);
						})}
					</div>

					<form method="get" className="flex flex-wrap items-center gap-3">
						<input type="hidden" name="status" value={filters.status} />
						<input
							name="q"
							defaultValue={filters.q}
							placeholder={t('admin.searchPlaceholder')}
							className="min-w-[18rem] flex-1 rounded-lg border border-white/15 bg-night px-3 py-2 text-sm text-white outline-none focus:border-neon-blue"
						/>
						<button
							type="submit"
							className="rounded-lg border border-neon-blue/60 px-3 py-2 text-sm text-neon-blue transition-colors hover:bg-neon-blue/10"
						>
							{t('admin.searchButton')}
						</button>
						{hasActiveFilters(filters) && (
							<Link
								href={`/${locale}/dashboard/admin`}
								className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/60 transition-colors hover:text-white"
							>
								{t('admin.clearFilters')}
							</Link>
						)}
					</form>

					<p className="text-xs text-white/40">{t('admin.searchHelp')}</p>
				</div>

				{ordersResult.orders.length > 0 ? (
					<>
						<div className="glass-panel overflow-x-auto">
							<table className="w-full min-w-[980px] text-left text-sm">
								<thead className="border-b border-white/10 text-xs uppercase tracking-widest text-white/50">
									<tr>
										<th className="px-4 py-3">{t('dashboard.columnOrder')}</th>
										<th className="px-4 py-3">{t('admin.customerColumn')}</th>
										<th className="px-4 py-3">{t('dashboard.columnItem')}</th>
										<th className="px-4 py-3">{t('dashboard.columnTotal')}</th>
										<th className="px-4 py-3">{t('dashboard.columnStatus')}</th>
										<th className="px-4 py-3">{t('admin.paidColumn')}</th>
										<th className="px-4 py-3">{t('admin.createdColumn')}</th>
									</tr>
								</thead>
								<tbody>
									{ordersResult.orders.map((order: AdminOrderRow) => {
										const customer = ordersResult.profileMap.get(order.user_id);
										return (
											<tr key={order.id} className="border-t border-white/5 align-top">
												<td className="px-4 py-3 font-mono text-xs text-white/80">{order.public_id}</td>
												<td className="px-4 py-3">
													<div className="space-y-1">
														<p className="text-sm text-ink">{customer?.email ?? t('admin.customerUnknown')}</p>
														<p className="text-xs text-white/40">{customer?.discord_id ?? order.contact_handle ?? '—'}</p>
													</div>
												</td>
												<td className="px-4 py-3 text-ink">{describeSelection(order.selection, t, (order as any).delivery_multiplier)}</td>
												<td className="px-4 py-3 text-ink">${Number(order.total_usd).toFixed(2)}</td>
												<td className="px-4 py-3">
													<span className={statusChipClass(order.status)}>{t(`dashboard.status.${order.status}`)}</span>
												</td>
												<td className="px-4 py-3 text-xs text-white/60">{formatDate(order.paid_at, locale)}</td>
												<td className="px-4 py-3 text-xs text-white/60">{formatDate(order.created_at, locale)}</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>

						{totalPages > 1 && (
							<div className="flex flex-wrap items-center justify-between gap-3">
								<p className="text-xs text-white/40">{t('admin.pageLabel', { page: filters.page, totalPages })}</p>
								<div className="flex items-center gap-2">
									<Link
										href={buildAdminHref(locale, filters, { page: Math.max(1, filters.page - 1) })}
										aria-disabled={filters.page <= 1}
										className={[
											'rounded-lg border px-3 py-1.5 text-sm',
											filters.page <= 1 ? 'pointer-events-none border-white/5 text-white/25' : 'border-white/10 text-white/70 hover:border-neon-blue hover:text-neon-blue',
										].join(' ')}
									>
										{t('admin.prevPage')}
									</Link>
									<Link
										href={buildAdminHref(locale, filters, { page: Math.min(totalPages, filters.page + 1) })}
										aria-disabled={filters.page >= totalPages}
										className={[
											'rounded-lg border px-3 py-1.5 text-sm',
											filters.page >= totalPages
												? 'pointer-events-none border-white/5 text-white/25'
												: 'border-white/10 text-white/70 hover:border-neon-blue hover:text-neon-blue',
										].join(' ')}
									>
										{t('admin.nextPage')}
									</Link>
								</div>
							</div>
						)}
					</>
				) : (
					<div className="glass-panel p-8 text-center text-sm text-ink-soft">{t('admin.ordersEmpty')}</div>
				)}
			</section>
		</div>
	);
}

function pickFirst(value: string | string[] | undefined): string | undefined {
	return Array.isArray(value) ? value[0] : value;
}

function normalizeFilters(searchParams: AdminSearchParams) {
	const status = pickFirst(searchParams.status);
	const page = Number.parseInt(pickFirst(searchParams.page) ?? '1', 10);
	return {
		status: isAdminFilterStatus(status) ? status : 'paid24',
		q: (pickFirst(searchParams.q) ?? '').trim(),
		page: Number.isFinite(page) && page > 0 ? page : 1,
	};
}

function isAdminFilterStatus(value: string | undefined): value is AdminFilterStatus {
	return value === 'paid24' || value === 'all' || value === 'paid' || value === 'awaiting_payment' || value === 'cancelled' || value === 'completed';
}

function hasActiveFilters(filters: { status: AdminFilterStatus; q: string; page: number }) {
	return filters.status !== 'paid24' || filters.q.length > 0 || filters.page > 1;
}

function buildAdminHref(
	locale: string,
	filters: { status: AdminFilterStatus; q: string; page: number },
	overrides: Partial<{ status: AdminFilterStatus; q: string; page: number }>,
) {
	const next = { ...filters, ...overrides };
	const params = new URLSearchParams();
	// 'paid24' is the default, so it stays out of the URL; 'all' has to be
	// spelled out because it is now an explicit choice.
	if (next.status !== 'paid24') params.set('status', next.status);
	if (next.q) params.set('q', next.q);
	if (next.page > 1) params.set('page', String(next.page));
	const query = params.toString();
	return query ? `/${locale}/dashboard/admin?${query}` : `/${locale}/dashboard/admin`;
}

async function loadAdminOrders(
	supabase: Awaited<ReturnType<typeof routeClient>>,
	filters: { status: AdminFilterStatus; q: string; page: number },
) {
	let query = supabase
		.from('orders')
		.select('id, public_id, user_id, status, selection, total_usd, created_at, paid_at, contact_handle, assigned_modder_id, delivery_multiplier', { count: 'exact' })
		.order('created_at', { ascending: false });

	if (filters.status === 'paid24') {
		// The default view: what actually came in overnight. Unpaid rows cannot
		// reach this list at all, which is the entire point of it.
		query = query.not('paid_at', 'is', null).gte('paid_at', dayWindowStart());
	} else if (filters.status === 'paid') {
		query = query.not('paid_at', 'is', null);
	} else if (filters.status === 'awaiting_payment') {
		query = query.eq('status', 'awaiting_payment');
	} else if (filters.status === 'cancelled') {
		query = query.in('status', ['cancelled', 'refunded']);
	} else if (filters.status === 'completed') {
		query = query.eq('status', 'completed');
	}

	if (filters.q) {
		const profileIds = await findProfileIdsBySearch(supabase, filters.q);
		const clauses = [
			`public_id.ilike.%${escapeOrValue(filters.q)}%`,
			`contact_handle.ilike.%${escapeOrValue(filters.q)}%`,
		];
		if (profileIds.length > 0) {
			const ids = profileIds.join(',');
			clauses.push(`user_id.in.(${ids})`, `assigned_modder_id.in.(${ids})`);
		}
		query = query.or(clauses.join(','));
	}

	const from = (filters.page - 1) * PAGE_SIZE;
	const to = from + PAGE_SIZE - 1;
	const { data, count } = await query.range(from, to);
	const orders = (data ?? []) as AdminOrderRow[];
	const profileMap = await loadProfileMap(supabase, orders);

	return {
		orders,
		totalCount: count ?? 0,
		profileMap,
	};
}

async function findProfileIdsBySearch(supabase: Awaited<ReturnType<typeof routeClient>>, search: string) {
	const escaped = escapeOrValue(search);
	const { data } = await supabase
		.from('profiles')
		.select('id')
		.or(`email.ilike.%${escaped}%,discord_id.ilike.%${escaped}%`)
		.limit(50);
	return (data ?? []).map((row: { id: string }) => row.id);
}

async function loadProfileMap(supabase: Awaited<ReturnType<typeof routeClient>>, orders: AdminOrderRow[]) {
	const ids = Array.from(
		new Set(
			orders
				.flatMap((order) => [order.user_id, order.assigned_modder_id])
				.filter((value): value is string => Boolean(value)),
		),
	);
	if (ids.length === 0) return new Map<string, ProfileLookup>();

	const { data } = await supabase.from('profiles').select('id, email, discord_id').in('id', ids);
	return new Map((data ?? []).map((profile: ProfileLookup) => [profile.id, profile]));
}

function escapeOrValue(value: string) {
	return value.replaceAll(',', '\\,').replaceAll('(', '').replaceAll(')', '');
}

function statusChipClass(status: OrderStatus) {
	const base = 'rounded-full border px-3 py-1 text-[11px]';
	const palette: Record<OrderStatus, string> = {
		awaiting_payment: 'border-white/25 text-white/60',
		action_required: 'border-neon-pink text-pink-400 shadow-neon-pink',
		in_progress: 'border-neon-blue text-neon-blue shadow-neon-blue',
		completed: 'border-emerald-400/60 text-emerald-300',
		cancelled: 'border-white/20 text-white/40',
		refunded: 'border-white/20 text-white/40',
	};
	return `${base} ${palette[status]}`;
}

function formatDate(value: string | null, locale: string) {
	if (!value) return '—';
	return new Date(value).toLocaleString(locale);
}
