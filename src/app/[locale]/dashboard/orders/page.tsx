import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getProfile, routeClient } from '@/lib/supabase/auth';
import { OrderRow } from '@/components/dashboard/OrderRow';
import { getTranslations, getMessages } from '@/lib/i18n/getTranslations';
import { buttonClasses } from '@/components/ui/buttonStyles';

/**
 * Orders table. Two behaviours share one row component:
 *  - digital codes → "Show Code" (enabled only once status is completed)
 *  - boost services → status chip + the encrypted handover form when required
 */
export default async function OrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const profile = await getProfile();
  if (!profile) redirect(`/${locale}/auth`);

  const supabase = await routeClient();
  const t = await getTranslations();
  // OrderRow/CredentialsForm are 'use client' — same reason every other
  // client configurator in this project receives `messages` as a prop
  // instead of calling next/headers itself.
  const messages = await getMessages();

  // discount_usd and promo_code join the selection so a paid order can
  // still show what the code did. Safe through routeClient(): 0002 only
  // ever revoked UPDATE on orders, never column-level SELECT.
  const { data: orders } = await supabase
    .from('orders')
    .select('public_id, status, selection, total_usd, discount_usd, promo_code, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div>
      <h1 className="font-display text-3xl text-neon-pink">{t('dashboard.ordersLabel')}</h1>

      {orders && orders.length > 0 ? (
        <div className="mt-6 overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-surface/80 text-left text-xs uppercase tracking-widest text-white/50">
              <tr>
                <th className="px-4 py-3">{t('dashboard.columnOrder')}</th>
                <th className="px-4 py-3">{t('dashboard.columnItem')}</th>
                <th className="px-4 py-3">{t('dashboard.columnTotal')}</th>
                <th className="px-4 py-3">{t('dashboard.columnStatus')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <OrderRow key={order.public_id} order={order as any} messages={messages} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        // §3.4 / item 5: "пусто" is one of the mandatory screen states this
        // page didn't have — it used to render a table with headers and zero
        // rows, which reads as broken rather than "you have no orders".
        <div className="glass-panel mt-6 flex flex-col items-center gap-3 p-10 text-center">
          <p className="font-display text-lg text-ink">{t('common.ordersEmptyTitle')}</p>
          <p className="max-w-sm text-sm text-ink-soft">{t('common.ordersEmptyBody')}</p>
          <Link href={`/${locale}/gta-5`} className={buttonClasses('primary', 'md')}>
            {t('common.ordersEmptyCta')}
          </Link>
        </div>
      )}
    </div>
  );
}
