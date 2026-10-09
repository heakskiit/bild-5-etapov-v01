import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getProfile, routeClient } from '@/lib/supabase/auth';
import { OrderRow } from '@/components/dashboard/OrderRow';
import { getTranslations, getMessages } from '@/lib/i18n/getTranslations';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { pendingWindowStart } from '@/lib/orders/orderLimits';
import { groupByCart, shortCartId } from '@/lib/orders/groupByCart';
import type { Dict } from '@/lib/i18n/pick';

/**
 * Orders table. Two behaviours share one row component:
 *  - digital codes -> "Show Code" (enabled only once status is completed)
 *  - boost services -> status chip + the encrypted handover form when required
 *
 * BATCH E2: paid work comes first, unpaid orders sit in their own section
 * underneath. The customer keeps every route back to an unfinished payment --
 * removing them outright would strand anyone who closed the invoice tab --
 * but they no longer interleave with real orders.
 *
 * Unpaid orders older than the pending window are dropped: the CryptoBot
 * invoice has lapsed, so the row offers a bill that can no longer be settled.
 * How many were dropped is still reported, because an order disappearing
 * without a word is worse than one that is plainly stale.
 */

type OrderListRow = {
  public_id: string;
  status: string;
  created_at: string;
  cart_id?: string | null;
  total_usd?: string | number | null;
};

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
    .select('public_id, status, selection, total_usd, discount_usd, promo_code, delivery_multiplier, cart_id, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  const all = (orders ?? []) as OrderListRow[];
  const pendingCutoff = Date.parse(pendingWindowStart());
  const unpaid = (order: OrderListRow) => order.status === 'awaiting_payment';

  const settled = all.filter((order) => !unpaid(order));
  const pending = all.filter((order) => unpaid(order) && Date.parse(order.created_at) >= pendingCutoff);
  const lapsed = all.length - settled.length - pending.length;

  return (
    <div>
      <h1 className="font-display text-3xl text-neon-pink">{t('dashboard.ordersLabel')}</h1>

      {settled.length > 0 && <OrdersTable rows={settled} messages={messages} t={t} />}

      {pending.length > 0 && (
        <section className="mt-8 space-y-3">
          <h2 className="font-display text-sm uppercase tracking-widest text-white/60">
            {t('dashboard.pendingLabel')}
          </h2>
          <OrdersTable rows={pending} messages={messages} t={t} />
        </section>
      )}

      {settled.length === 0 && pending.length === 0 && (
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

      {lapsed > 0 && (
        <p className="mt-4 text-xs text-white/40">{t('dashboard.expiredHidden', { count: lapsed })}</p>
      )}
    </div>
  );
}

/** One markup definition, rendered once per section. */
function OrdersTable({
  rows,
  messages,
  t,
}: {
  rows: OrderListRow[];
  messages: Dict;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
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
          {/* BATCH F13: orders paid as one cart share a header row and a
              left accent, so they read as one purchase. */}
          {groupByCart(rows).map((unit) =>
            unit.kind === 'single' ? (
              <OrderRow key={unit.order.public_id} order={unit.order as any} messages={messages} />
            ) : (
              <CartGroup key={unit.cartId} cartId={unit.cartId} count={unit.orders.length} totalUsd={unit.totalUsd} t={t}>
                {unit.orders.map((order) => (
                  <OrderRow key={order.public_id} order={order as any} messages={messages} grouped />
                ))}
              </CartGroup>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

function CartGroup({
  cartId,
  count,
  totalUsd,
  t,
  children,
}: {
  cartId: string;
  count: number;
  totalUsd: number;
  t: (key: string, vars?: Record<string, string | number>) => string;
  children: React.ReactNode;
}) {
  return (
    <>
      <tr className="border-t border-white/10 bg-neon-pink/5">
        <td colSpan={5} className="border-l-2 border-neon-pink px-4 py-2 text-xs">
          <span className="font-display uppercase tracking-widest text-pink-400">
            {t('dashboard.cartGroup', { id: shortCartId(cartId), count })}
          </span>
          <span className="ml-3 text-white/60">{t('dashboard.cartGroupTotal', { total: `$${totalUsd.toFixed(2)}` })}</span>
        </td>
      </tr>
      {children}
    </>
  );
}
