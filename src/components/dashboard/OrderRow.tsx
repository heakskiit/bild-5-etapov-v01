'use client';

import { useMemo, useState } from 'react';
import type { Order, OrderStatus } from '@/types/order';
import { CredentialsForm } from './CredentialsForm';
import { Button } from '@/components/ui/Button';
import { dig, type Dict } from '@/lib/i18n/pick';
import { describeSelection } from '@/lib/orders/describeSelection';
import { PayAgainButton } from './PayAgainButton';
import { SupportRequestPanel } from './SupportRequestPanel';
import { ConfirmReceipt } from './ConfirmReceipt';
import { canConfirmReceipt } from '@/lib/orders/confirmReceipt';
import { hasUnseenReply, type SupportSummary } from '@/lib/support/requests';

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
  grouped = false,
  payable = false,
  support = null,
  helpAllowed = false,
  confirmedAt = null,
  revealedAt = null,
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
  /** BATCH F13: part of a cart card -- indented under the cart header. */
  grouped?: boolean;
  /** BATCH F14: unpaid and still inside the auto-cancel window. */
  payable?: boolean;
  /** BATCH F15: latest support request on this order, if any. */
  support?: SupportSummary | null;
  /** BATCH F15: a new request may be raised (see canRequestHelp). */
  helpAllowed?: boolean;
  /** BATCH F18: when the customer confirmed receipt, if ever. */
  confirmedAt?: string | null;
  /** BATCH F18: when the digital code was first opened, if ever. */
  revealedAt?: string | null;
}) {
  const t = useMemo(() => (key: string, vars?: Record<string, string | number>) => dig(messages, key, vars), [messages]);
  const [code, setCode] = useState<string | null>(null);
  const [revealBusy, setRevealBusy] = useState(false);
  const [revealError, setRevealError] = useState(false);
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [problem, setProblem] = useState(false);
  const isCode = order.selection.product === 'shark_card';
  const discount = Number(order.discount_usd ?? 0);
  const [revealedNow, setRevealedNow] = useState(false);
  // BATCH F18: inside a cart the single button lives on the group header.
  const showConfirm =
    !grouped &&
    (Boolean(confirmedAt) ||
      canConfirmReceipt({ status: order.status, isCode, revealedAt: revealedAt ?? (revealedNow ? 'now' : null) }));
  const canProblem = Boolean(support) || helpAllowed;
  const openProblem = () => {
    setProblem(!support);
    setHelpOpen(true);
  };

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
      // The server has stamped revealed_at; let the confirm button appear now.
      setRevealedNow(true);
    } catch {
      setRevealError(true);
    } finally {
      setRevealBusy(false);
    }
  };

  return (
    <>
      <tr className={grouped ? 'border-t border-white/5 bg-neon-pink/[0.02]' : 'border-t border-white/10'}>
        <td className={grouped ? 'border-l-2 border-neon-pink py-3 pl-6 pr-4 font-mono text-xs' : 'px-4 py-3 font-mono text-xs'}>
          {order.public_id}
        </td>
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
          <div className="flex flex-col items-end gap-2">
          {isCode ? (
            <div className="flex flex-col items-end gap-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={reveal}
                disabled={order.status !== 'completed'}
                loading={revealBusy}
                loadingText={t('common.processing')}
              >
                {code ?? t('common.showCode')}
              </Button>
              {revealError && <span className="text-[11px] text-pink-400">{t('common.revealError')}</span>}
            </div>
          ) : order.status === 'awaiting_payment' ? (
            /* BATCH F14: Telegram did not open, the tab was closed, the phone
               died -- the invoice is still here. For a cart the button lives
               on the group header instead, so it is not repeated per row. */
            grouped || !payable ? null : (
              <PayAgainButton orderId={order.public_id} messages={messages} />
            )
          ) : order.status === 'action_required' ? (
            <Button variant="primary" size="sm" onClick={() => setOpen((v) => !v)}>
              {t('common.provideAccess')}
            </Button>
          ) : null}
          {showConfirm && (
            <ConfirmReceipt
              orderId={order.public_id}
              messages={messages}
              confirmedAt={confirmedAt}
              onProblem={canProblem ? openProblem : undefined}
            />
          )}
          {/* BATCH F15: "Need help with this order". */}
          {support ? (
            <button
              type="button"
              onClick={() => setHelpOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-md border border-neon-blue/40 px-2.5 py-1 text-xs text-neon-blue transition hover:border-neon-blue hover:bg-neon-blue/10"
            >
              {t('support.requestLabel', { id: support.publicId })} · {t(`support.status.${support.status}`)}
              {hasUnseenReply(support) && (
                <span className="rounded-full bg-pink-500 px-1.5 py-0.5 text-[10px] font-semibold text-base">
                  {t('support.hasReply')}
                </span>
              )}
            </button>
          ) : helpAllowed ? (
            <button
              type="button"
              onClick={() => {
                setProblem(false);
                setHelpOpen((v) => !v);
              }}
              className="rounded-md border border-neon-blue/40 px-2.5 py-1 text-xs text-neon-blue transition hover:border-neon-blue hover:bg-neon-blue/10"
            >
              {t('support.button')}
            </button>
          ) : null}
          </div>
        </td>
      </tr>

      {open && (
        <tr>
          <td colSpan={5} className="bg-night/60 px-4 py-4">
            <CredentialsForm orderId={order.public_id} onDone={() => setOpen(false)} messages={messages} />
          </td>
        </tr>
      )}

      {helpOpen && (
        <tr>
          <td colSpan={5} className="bg-night/60 px-4 py-4">
            <SupportRequestPanel
              orderId={order.public_id}
              request={support}
              canCreate={helpAllowed}
              messages={messages}
              onClose={() => setHelpOpen(false)}
              initialReason={problem ? 'item_not_received' : null}
            />
          </td>
        </tr>
      )}
    </>
  );
}
