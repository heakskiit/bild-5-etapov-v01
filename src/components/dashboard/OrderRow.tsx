'use client';

import { useMemo, useState } from 'react';
import type { Order, OrderStatus } from '@/types/order';
import { CredentialsForm } from './CredentialsForm';
import { Button } from '@/components/ui/Button';
import { dig, type Dict } from '@/lib/i18n/pick';
import { describeSelection } from '@/lib/orders/describeSelection';

const CHIP: Record<OrderStatus, string> = {
  awaiting_payment: 'border-white/25 text-white/60',
  // §1.1: this chip renders at 11px — pink-400, not pink-500 (4.3:1 fails AA at that size).
  action_required: 'border-neon-pink text-pink-400 shadow-neon-pink',
  in_progress: 'border-neon-blue text-neon-blue shadow-neon-blue',
  completed: 'border-emerald-400/60 text-emerald-300',
  cancelled: 'border-white/20 text-white/40',
  refunded: 'border-white/20 text-white/40',
};

export function OrderRow({
  order,
  messages,
}: {
  order: Order & {
    public_id: string;
    total_usd: string;
    // numeric over PostgREST is a string; absent on pre-promo rows.
    discount_usd?: string | number | null;
    delivery_multiplier?: string | number | null;
    promo_code?: string | null;
  };
  messages: Dict;
}) {
  const t = useMemo(() => (key: string, vars?: Record<string, string | number>) => dig(messages, key, vars), [messages]);
  const [code, setCode] = useState<string | null>(null);
  const [revealBusy, setRevealBusy] = useState(false);
  const [revealError, setRevealError] = useState(false);
  const [open, setOpen] = useState(false);
  const isCode = order.selection.product === 'shark_card';
  const discount = Number(order.discount_usd ?? 0);

  const reveal = async () => {
    setRevealBusy(true);
    setRevealError(false);
    try {
      const res = await fetch('/api/orders/reveal-code', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId: order.public_id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.code) {
        setRevealError(true);
        return;
      }
      setCode(data.code);
    } catch {
      setRevealError(true);
    } finally {
      setRevealBusy(false);
    }
  };

  return (
    <>
      <tr className="border-t border-white/10">
        <td className="px-4 py-3 font-mono text-xs">{order.public_id}</td>
        <td className="px-4 py-3">{describeSelection(order.selection, t, order.delivery_multiplier)}</td>
        <td className="px-4 py-3">
          ${Number(order.total_usd).toFixed(2)}
          {/* The only place a customer can still see what a code did:
              the checkout modal is gone by the time the order exists,
              and the invoice shows the discounted figure alone. */}
          {discount > 0 && (
            <p className="mt-1 text-[11px] text-emerald-300">
              {order.promo_code
                ? t('dashboard.discountApplied', { amount: `$${discount.toFixed(2)}`, code: order.promo_code })
                : t('dashboard.discountAppliedNoCode', { amount: `$${discount.toFixed(2)}` })}
            </p>
          )}
        </td>
        <td className="px-4 py-3">
          <span className={`rounded-full border px-3 py-1 text-[11px] ${CHIP[order.status]}`}>
            {t(`dashboard.status.${order.status}`)}
          </span>
          {/* §3.4: "вебхук не пришёл («Проверяем оплату, обычно занимает до 2
              минут»)" — a customer who just paid via the Telegram bot lands
              back on this page before the webhook has caught up, and
              "awaiting_payment" on its own reads as "did my payment go
              through?" rather than "we're still catching up". */}
          {order.status === 'awaiting_payment' && (
            <p className="mt-1 text-[11px] text-white/40">{t('common.awaitingPaymentNote')}</p>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          {isCode ? (
            <div className="flex flex-col items-end gap-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={reveal}
                disabled={order.status !== 'completed'}
                loading={revealBusy}
              >
                {code ?? t('common.showCode')}
              </Button>
              {revealError && <span className="text-[11px] text-pink-400">{t('common.revealError')}</span>}
            </div>
          ) : order.status === 'action_required' ? (
            <Button variant="primary" size="sm" onClick={() => setOpen((v) => !v)}>
              {t('common.provideAccess')}
            </Button>
          ) : null}
        </td>
      </tr>

      {open && (
        <tr>
          <td colSpan={5} className="bg-night/60 px-4 py-4">
            <CredentialsForm orderId={order.public_id} onDone={() => setOpen(false)} messages={messages} />
          </td>
        </tr>
      )}
    </>
  );
}
