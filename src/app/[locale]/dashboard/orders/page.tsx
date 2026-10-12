import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getProfile, routeClient } from '@/lib/supabase/auth';
import { OrderRow } from '@/components/dashboard/OrderRow';
import { PayAgainButton } from '@/components/dashboard/PayAgainButton';
import { getTranslations, getMessages } from '@/lib/i18n/getTranslations';
import { buttonClasses } from '@/components/ui/buttonStyles';
import { pendingWindowStart } from '@/lib/orders/orderLimits';
import { isFreshUnpaid } from '@/lib/orders/payableStatus';
import { groupByCart, shortCartId } from '@/lib/orders/groupByCart';
import type { Dict } from '@/lib/i18n/pick';
import { serviceClient } from '@/lib/supabase/service';
import { canRequestHelp, type SupportSummary } from '@/lib/support/requests';
import { ConfirmReceipt } from '@/components/dashboard/ConfirmReceipt';
import { canConfirmReceipt, revealedAtOf } from '@/lib/orders/confirmReceipt';

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
  selection?: { product?: string } | null;
  customer_confirmed_at?: string | null;
  digital_codes?: unknown;
};

/** BATCH F18: may this order be confirmed as received right now? */
function confirmable(order: OrderListRow): boolean {
  return canConfirmReceipt({
    status: order.status,
    isCode: order.selection?.product === 'shark_card',
    revealedAt: revealedAtOf(order.digital_codes),
    confirmedAt: order.customer_confirmed_at ?? null,
  });
}

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
    .select('public_id, status, selection, total_usd, discount_usd, promo_code, delivery_multiplier, cart_id, created_at, customer_confirmed_at, digital_codes(revealed_at)')
    .order('created_at', { ascending: false })
    .limit(50);

  const all = (orders ?? []) as OrderListRow[];

  // BATCH F15: latest support request per order. support_requests is
  // service-only (0018), so it is read with the service client and pinned
  // to this user's id -- never anyone else's rows.
  const support = await loadSupport(profile.id);
  // BATCH F15b: an admin answers requests in Admin -> Support; a help
  // button on their own test orders would only open tickets to themselves.
  const staff = profile.role === 'admin';
  const pendingCutoff = Date.parse(pendingWindowStart());
  const unpaid = (order: OrderListRow) => order.status === 'awaiting_payment';

  const settled = all.filter((order) => !unpaid(order));
  const pending = all.filter((order) => unpaid(order) && Date.parse(order.created_at) >= pendingCutoff);
  const lapsed = all.length - settled.length - pending.length;

  return (
    <div>
      <h1 className="font-display text-3xl text-neon-pink">{t('dashboard.ordersLabel')}</h1>

      {settled.length > 0 && <OrdersTable rows={settled} messages={messages} t={t} support={support} staff={staff} />}

      {pending.length > 0 && (
        <section className="mt-8 space-y-3">
          <h2 className="font-display text-sm uppercase tracking-widest text-white/60">
            {t('dashboard.pendingLabel')}
          </h2>
          <OrdersTable rows={pending} messages={messages} t={t} support={support} staff={staff} />
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

async function loadSupport(userId: string): Promise<Map<string, SupportSummary>> {
  const map = new Map<string, SupportSummary>();
  try {
    const { data, error } = await serviceClient()
      .from('support_requests')
      .select(
        'public_id, reason, message, status, reply, replied_at, reply_seen_at, created_at, last_customer_at, last_staff_at, closed_reason, orders(public_id)',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    for (const r of (data ?? []) as any[]) {
      const order = Array.isArray(r.orders) ? r.orders[0] : r.orders;
      // Newest first: the first row seen for an order is its latest request.
      if (!order?.public_id || map.has(order.public_id)) continue;
      map.set(order.public_id, {
        publicId: r.public_id,
        reason: r.reason,
        message: r.message,
        status: r.status,
        reply: r.reply,
        repliedAt: r.replied_at,
        replySeenAt: r.reply_seen_at,
        createdAt: r.created_at,
        lastCustomerAt: r.last_customer_at,
        lastStaffAt: r.last_staff_at,
        closedReason: r.closed_reason,
      });
    }
  } catch (err) {
    // The orders list must still render if this lookup fails.
    console.error('[orders page] support', err);
  }
  return map;
}

/** One markup definition, rendered once per section. */
function OrdersTable({
  rows,
  messages,
  t,
  support,
  staff,
}: {
  rows: OrderListRow[];
  messages: Dict;
  t: (key: string, vars?: Record<string, string | number>) => string;
  support: Map<string, SupportSummary>;
  staff: boolean;
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
              <OrderRow
                key={unit.order.public_id}
                order={unit.order as any}
                messages={messages}
                payable={isFreshUnpaid(unit.order.status, unit.order.created_at)}
                support={support.get(unit.order.public_id) ?? null}
                helpAllowed={!staff && canRequestHelp(unit.order.status, unit.order.created_at)}
                confirmedAt={unit.order.customer_confirmed_at ?? null}
                revealedAt={revealedAtOf(unit.order.digital_codes)}
              />
            ) : (
              <CartGroup
                key={unit.cartId}
                cartId={unit.cartId}
                count={unit.orders.length}
                totalUsd={unit.totalUsd}
                t={t}
                /* BATCH F14: one invoice covers the cart, so one button does too. */
                payOrderId={
                  unit.orders.every((o) => isFreshUnpaid(o.status, o.created_at)) ? unit.orders[0].public_id : null
                }
                messages={messages}
                /* BATCH F18: one "received" button for the finished part of the cart. */
                confirmOrderId={unit.orders.find(confirmable)?.public_id ?? null}
                allConfirmed={unit.orders.every((o) => Boolean(o.customer_confirmed_at))}
              >
                {unit.orders.map((order) => (
                  <OrderRow
                    key={order.public_id}
                    order={order as any}
                    messages={messages}
                    grouped
                    support={support.get(order.public_id) ?? null}
                    helpAllowed={!staff && canRequestHelp(order.status, order.created_at)}
                    confirmedAt={order.customer_confirmed_at ?? null}
                    revealedAt={revealedAtOf(order.digital_codes)}
                  />
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
  payOrderId,
  messages,
  confirmOrderId = null,
  allConfirmed = false,
  children,
}: {
  cartId: string;
  count: number;
  totalUsd: number;
  t: (key: string, vars?: Record<string, string | number>) => string;
  payOrderId?: string | null;
  messages: Dict;
  confirmOrderId?: string | null;
  allConfirmed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      <tr className="border-t border-white/10 bg-neon-pink/5">
        <td colSpan={5} className="border-l-2 border-neon-pink px-4 py-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-display uppercase tracking-widest text-pink-400">
                {t('dashboard.cartGroup', { id: shortCartId(cartId), count })}
              </span>
              <span className="ml-3 text-white/60">
                {t('dashboard.cartGroupTotal', { total: `$${totalUsd.toFixed(2)}` })}
              </span>
            </div>
            {payOrderId && <PayAgainButton orderId={payOrderId} messages={messages} />}
            {confirmOrderId ? (
              <ConfirmReceipt orderId={confirmOrderId} messages={messages} cart />
            ) : allConfirmed ? (
              <ConfirmReceipt orderId={cartId} messages={messages} confirmedAt="done" cart />
            ) : null}
          </div>
        </td>
      </tr>
      {children}
    </>
  );
}
