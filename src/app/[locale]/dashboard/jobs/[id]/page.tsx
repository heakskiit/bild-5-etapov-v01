import { redirect } from 'next/navigation';
import { requireRole, routeClient } from '@/lib/supabase/auth';
import { getTranslations, getMessages } from '@/lib/i18n/getTranslations';
import { JobStatusStepper } from '@/components/dashboard/JobStatusStepper';

const DELIVERY_LABEL_KEYS: Record<string, string> = {
	normal: 'configurator.deliveryNormal',
	express: 'configurator.deliveryExpress',
	super_express: 'configurator.deliverySuperExpress',
};

/**
 * modder → /dashboard/jobs/[id] (§4). Deliberately does NOT read or render
 * account_credentials — coordinating the actual session (when the modder
 * plays, on which platform) happens off-platform via the contact handle
 * shown here, per the checkout/queue design agreed for this pass.
 */
export default async function JobPage({
	params,
}: {
	params: Promise<{ locale: string; id: string }>;
}) {
	const { locale, id } = await params;
	const profile = await requireRole(locale, ['modder', 'admin']);
	const t = await getTranslations();
	const messages = await getMessages();

	const supabase = await routeClient();
	const { data: order } = await supabase
		.from('orders')
		.select('id, public_id, status, selection, contact_handle, assigned_modder_id, total_usd, created_at')
		.eq('public_id', id)
		.maybeSingle();

	if (!order) redirect(`/${locale}/dashboard/queue`);
	// Belt-and-suspenders on top of RLS: only the owning modder or an admin
	// gets the working view; anyone else bounces back to the board.
	if (profile.role !== 'admin' && order.assigned_modder_id !== profile.id) {
		redirect(`/${locale}/dashboard/queue`);
	}

	const { data: events } = await supabase
		.from('order_events')
		.select('kind, detail, created_at')
		.eq('order_id', order.id)
		.order('created_at', { ascending: false });

	const s = order.selection;
	const description =
		s.product === 'leveling'
			? t('dashboard.describeLeveling', { level: s.level ?? '—' })
			: t('dashboard.describeMoney', { amount: s.amountMillions ?? '—' });

	return (
		<div className="space-y-6">
			<div>
				<p className="font-mono text-xs text-white/50">{order.public_id}</p>
				<h1 className="font-display text-2xl text-neon-pink">{description}</h1>
			</div>

			<div className="glass-panel grid gap-4 p-5 sm:grid-cols-2">
				<Field label={t('jobs.platform')} value={s.platform?.toUpperCase() ?? '—'} />
				<Field label={t('jobs.delivery')} value={s.delivery ? t(DELIVERY_LABEL_KEYS[s.delivery] ?? '') : '—'} />
				<Field label={t('jobs.contact')} value={order.contact_handle ?? t('jobs.noContact')} />
				<Field label={t('jobs.total')} value={`$${Number(order.total_usd).toFixed(2)}`} />
			</div>

			<div className="glass-panel p-5">
				<h2 className="mb-3 font-display text-sm uppercase tracking-widest text-white/60">{t('jobs.statusTitle')}</h2>
				<JobStatusStepper orderId={order.public_id} currentStatus={order.status} messages={messages} />
			</div>

			<div className="glass-panel p-5">
				<h2 className="mb-3 font-display text-sm uppercase tracking-widest text-white/60">{t('jobs.historyTitle')}</h2>
				{events && events.length > 0 ? (
					<ul className="space-y-2 text-sm text-ink-soft">
						{events.map((e, i) => (
							<li key={i} className="flex justify-between border-b border-white/5 pb-2 last:border-0">
								<span>{e.kind}</span>
								<span className="text-xs text-white/40">{new Date(e.created_at).toLocaleString(locale)}</span>
							</li>
						))}
					</ul>
				) : (
					<p className="text-sm text-ink-soft">{t('jobs.noHistory')}</p>
				)}
			</div>
		</div>
	);
}

function Field({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<div className="text-xs uppercase tracking-widest text-white/50">{label}</div>
			<div className="mt-1 text-sm text-ink">{value}</div>
		</div>
	);
}
