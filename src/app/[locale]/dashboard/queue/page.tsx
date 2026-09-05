import { requireRole, routeClient } from '@/lib/supabase/auth';
import { getTranslations, getMessages } from '@/lib/i18n/getTranslations';
import { QueueRow } from '@/components/dashboard/QueueRow';

/**
 * Booster board (§4, modder → /dashboard/queue). Rows here are exactly what
 * `modder_queue_select` (0002) exposes: unclaimed service orders plus the
 * caller's own claimed jobs. Contact handle is shown so a modder can reach
 * the customer to coordinate a session — no account credentials are read,
 * queried, or rendered on this route.
 */
export default async function QueuePage({ params }: { params: Promise<{ locale: string }> }) {
	const { locale } = await params;
	const profile = await requireRole(locale, ['modder', 'admin']);
	const t = await getTranslations();
	const messages = await getMessages();

	const supabase = await routeClient();
	const { data: orders } = await supabase
		.from('orders')
		.select('id, public_id, status, selection, contact_handle, assigned_modder_id, delivery_multiplier, created_at')
		.order('created_at', { ascending: true })
		.limit(100);

	const list = orders ?? [];
	const unclaimed = list.filter((o) => !o.assigned_modder_id);
	const mine = list.filter((o) => o.assigned_modder_id === profile.id);

	return (
		<div className="space-y-8">
			<h1 className="font-display text-3xl text-neon-pink">{t('nav.queue')}</h1>

			<Section title={t('queue.unclaimedTitle')} emptyLabel={t('queue.unclaimedEmpty')}>
				{unclaimed.map((order) => (
					<QueueRow key={order.id} order={order as any} locale={locale} messages={messages} claimable />
				))}
			</Section>

			<Section title={t('queue.mineTitle')} emptyLabel={t('queue.mineEmpty')}>
				{mine.map((order) => (
					<QueueRow key={order.id} order={order as any} locale={locale} messages={messages} claimable={false} />
				))}
			</Section>
		</div>
	);
}

function Section({
	title,
	emptyLabel,
	children,
}: {
	title: string;
	emptyLabel: string;
	children: React.ReactNode;
}) {
	const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
	return (
		<section className="space-y-3">
			<h2 className="font-display text-sm uppercase tracking-widest text-white/60">{title}</h2>
			{hasChildren ? (
				<div className="space-y-2">{children}</div>
			) : (
				<div className="glass-panel p-6 text-center text-sm text-ink-soft">{emptyLabel}</div>
			)}
		</section>
	);
}
