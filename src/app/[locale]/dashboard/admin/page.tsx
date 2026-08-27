import { requireRole, routeClient } from '@/lib/supabase/auth';
import { getTranslations, getMessages } from '@/lib/i18n/getTranslations';
import { AdminRoleTable } from '@/components/dashboard/AdminRoleTable';
import Link from 'next/link';

/**
 * admin → /dashboard/admin (§4): role management + audit. Inventory
 * (Sheets-synced key stock, §4 admin/inventory) is a separate follow-up —
 * not part of this pass.
 */
export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
	const { locale } = await params;
	await requireRole(locale, ['admin']);
	const t = await getTranslations();
	const messages = await getMessages();

	const supabase = await routeClient();
	const [{ data: profiles }, { data: auditLog }] = await Promise.all([
		supabase.from('profiles').select('id, email, role, created_at').order('created_at', { ascending: false }),
		supabase
			.from('role_audit')
			.select('target_user_id, changed_by, old_role, new_role, created_at')
			.order('created_at', { ascending: false })
			.limit(20),
	]);

	return (
		<div className="space-y-8">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="font-display text-3xl text-neon-pink">{t('nav.admin')}</h1>
				<Link
					href={`/${locale}/dashboard/admin/inventory`}
					className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-neon-blue hover:border-neon-blue"
				>
					{t('admin.inventory.title')}
				</Link>
			</div>

			<section className="space-y-3">
				<h2 className="font-display text-sm uppercase tracking-widest text-white/60">{t('admin.rolesTitle')}</h2>
				<AdminRoleTable profiles={profiles ?? []} messages={messages} />
			</section>

			<section className="space-y-3">
				<h2 className="font-display text-sm uppercase tracking-widest text-white/60">{t('admin.auditTitle')}</h2>
				{auditLog && auditLog.length > 0 ? (
					<div className="glass-panel divide-y divide-white/5 p-2">
						{auditLog.map((entry, i) => (
							<div key={i} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm text-ink-soft">
								<span className="font-mono text-xs text-white/50">{entry.target_user_id.slice(0, 8)}</span>
								<span>
									{entry.old_role} → <span className="text-neon-blue">{entry.new_role}</span>
								</span>
								<span className="text-xs text-white/40">{new Date(entry.created_at).toLocaleString(locale)}</span>
							</div>
						))}
					</div>
				) : (
					<p className="text-sm text-ink-soft">{t('admin.auditEmpty')}</p>
				)}
			</section>
		</div>
	);
}
