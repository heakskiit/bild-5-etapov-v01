import { redirect } from 'next/navigation';
import { getProfile, routeClient } from '@/lib/supabase/auth';
import { LocaleSwitcher } from '@/components/layout/LocaleSwitcher';
import { getTranslations } from '@/lib/i18n/getTranslations';
import { pendingWindowStart } from '@/lib/orders/orderLimits';

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
    .select('status, total_usd, created_at')
    .order('created_at', { ascending: false });

  const list = orders ?? [];
  const spent = list.reduce((sum, o) => sum + Number(o.total_usd), 0);
  const active = list.filter((o) => ['action_required', 'in_progress'].includes(o.status)).length;
  // Only orders still inside the pending window: once the invoice has
  // lapsed the order cannot be paid any more, so counting it would show a
  // bill the customer has no way to settle. Same window the checkout route
  // enforces, so this tile and that refusal always agree.
  const pendingCutoff = Date.parse(pendingWindowStart());
  const pending = list.filter(
    (o) => o.status === 'awaiting_payment' && Date.parse(o.created_at) >= pendingCutoff,
  ).length;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl text-neon-pink">{t('nav.dashboard')}</h1>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label={t('dashboard.ordersLabel')} value={String(list.length)} icon={<IconOrders />} />
        <Stat label={t('dashboard.activeLabel')} value={String(active)} icon={<IconBolt />} />
        <Stat label={t('dashboard.totalSpentLabel')} value={`$${spent.toFixed(2)}`} icon={<IconWallet />} />
        <Stat label={t('dashboard.pendingLabel')} value={String(pending)} icon={<IconClock />} />
      </div>

      {/* BATCH F19: one compact row instead of a tall panel. */}
      <div className="glass-panel flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#B9B8C9]">
          {t('dashboard.languageLabel')}
        </h2>
        <LocaleSwitcher current={locale} />
      </div>
    </div>
  );
}

/** BATCH F19: equal-height stat card; styling lives in `.nd-stat` (globals.css). */
const Stat = ({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) => (
  <div className="nd-stat">
    <div className="flex items-start justify-between gap-3">
      <span className="text-[11px] font-medium uppercase leading-snug tracking-[0.14em] text-[#B9B8C9]">{label}</span>
      <span className="shrink-0 text-[#00E5FF]/75">{icon}</span>
    </div>
    <div className="mt-4 font-display text-2xl leading-none tabular-nums text-[#00E5FF] sm:text-[28px]">{value}</div>
  </div>
);

const iconProps = {
  className: 'h-5 w-5',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

const IconOrders = () => (
  <svg {...iconProps}>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4h6v3H9zM9 11h6M9 15h4" />
  </svg>
);

const IconBolt = () => (
  <svg {...iconProps}>
    <path d="M13 3 5 13.5h6L10 21l8-10.5h-6z" />
  </svg>
);

const IconWallet = () => (
  <svg {...iconProps}>
    <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" />
    <rect x="4" y="8" width="16" height="11" rx="2" />
    <path d="M16 13.5h2" />
  </svg>
);

const IconClock = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);
