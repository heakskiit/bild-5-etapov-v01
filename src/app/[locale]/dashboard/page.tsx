import { redirect } from 'next/navigation';
import { getProfile, routeClient } from '@/lib/supabase/auth';
import { LocaleSwitcher } from '@/components/layout/LocaleSwitcher';
import { getTranslations } from '@/lib/i18n/getTranslations';

/** Dashboard overview: totals plus language preference. */
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const profile = await getProfile();
  if (!profile) redirect(`/${locale}/auth`);

  const supabase = await routeClient();
  const t = await getTranslations();

  const { data: orders } = await supabase
    .from('orders')
    .select('status, total_usd')
    .order('created_at', { ascending: false });

  const list = orders ?? [];
  const spent = list.reduce((sum, o) => sum + Number(o.total_usd), 0);
  const active = list.filter((o) => ['action_required', 'in_progress'].includes(o.status)).length;

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl text-neon-pink">{t('nav.dashboard')}</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={t('dashboard.ordersLabel')} value={String(list.length)} />
        <Stat label={t('dashboard.activeLabel')} value={String(active)} />
        <Stat label={t('dashboard.totalSpentLabel')} value={`$${spent.toFixed(2)}`} />
      </div>

      <div className="glass-panel p-5">
        <h2 className="mb-3 font-display text-sm uppercase tracking-widest text-white/60">
          {t('dashboard.languageLabel')}
        </h2>
        <LocaleSwitcher current={locale} />
      </div>
    </div>
  );
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="glass-panel p-5 shadow-neon-inset">
    <div className="text-xs uppercase tracking-widest text-white/50">{label}</div>
    <div className="mt-1 font-display text-2xl text-neon-blue">{value}</div>
  </div>
);
