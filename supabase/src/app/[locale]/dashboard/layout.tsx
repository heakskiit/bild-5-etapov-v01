import { getProfile } from '@/lib/supabase/auth';
import { getTranslations } from '@/lib/i18n/getTranslations';
import { DashboardNav, type DashboardTab } from '@/components/dashboard/DashboardNav';

/**
 * Shared shell for every /dashboard/** route. Tabs are built from the
 * caller's `profiles.role` — a ghost never sees a Queue or Admin tab exist
 * in the first place, on top of the route-level `requireRole` guard each
 * page below also does independently.
 */
export default async function DashboardLayout({
	children,
	params,
}: {
	children: React.ReactNode;
	params: Promise<{ locale: string }>;
}) {
	const { locale } = await params;
	const [profile, t] = await Promise.all([getProfile(), getTranslations()]);
	const role = profile?.role ?? 'ghost';

	const tabs: DashboardTab[] = [
		{ href: `/${locale}/dashboard`, label: t('nav.dashboard') },
		{ href: `/${locale}/dashboard/orders`, label: t('dashboard.ordersLabel') },
	];
	if (role === 'modder' || role === 'admin') {
		tabs.push({ href: `/${locale}/dashboard/queue`, label: t('nav.queue') });
	}
	if (role === 'admin') {
		tabs.push({ href: `/${locale}/dashboard/admin`, label: t('nav.admin') });
	}

	return (
		<div className="space-y-6">
			<DashboardNav tabs={tabs} />
			{children}
		</div>
	);
}
