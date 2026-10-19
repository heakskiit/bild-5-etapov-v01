'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { dig, type Dict } from '@/lib/i18n/pick';
import { REVIEW_PLATFORMS } from '@/lib/reviews/platforms';

/**
 * BATCH F18 (FEAT-ORD-030): "Received, all good" / "Not received".
 *
 * The first button marks the order (or the whole cart) as confirmed; the
 * second opens the existing support panel with "item not received" picked.
 * After confirming, a short thank-you with links to the review pages.
 */
export function ConfirmReceipt({
  orderId,
  messages,
  confirmedAt = null,
  cart = false,
  onProblem,
}: {
  orderId: string;
  messages: Dict;
  confirmedAt?: string | null;
  /** One button for every finished order of the cart. */
  cart?: boolean;
  /** Absent when no support action is possible here (e.g. cart header). */
  onProblem?: () => void;
}) {
  const t = useMemo(() => (key: string) => dig(messages, key), [messages]);
  const router = useRouter();
  const [done, setDone] = useState(Boolean(confirmedAt));
  const [justNow, setJustNow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/orders/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error === 'not_ready' ? t('dashboard.confirm.notReady') : t('dashboard.confirm.error'));
        return;
      }
      setDone(true);
      setJustNow(true);
      router.refresh();
    } catch {
      setError(t('dashboard.confirm.error'));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    const links = REVIEW_PLATFORMS.filter((p) => p.href);
    return (
      <div className="flex flex-col items-end gap-1 text-right">
        <span className="rounded-full border border-emerald-400/50 px-2.5 py-0.5 text-[11px] text-emerald-300">
          {'\u2713'} {t('dashboard.confirm.confirmed')}
        </span>
        {justNow && links.length > 0 && (
          <p className="max-w-[16rem] text-[11px] text-white/60">
            {t('dashboard.confirm.thanks')}{' '}
            {links.map((p, i) => (
              <span key={p.id}>
                {i > 0 && ' \u00b7 '}
                <a href={p.href!} target="_blank" rel="noopener noreferrer" className="text-neon-blue underline-offset-2 hover:underline">
                  {p.name}
                </a>
              </span>
            ))}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="primary" size="sm" onClick={confirm} loading={busy} loadingText={t('common.processing')}>
        {cart ? t('dashboard.confirm.buttonCart') : t('dashboard.confirm.button')}
      </Button>
      {onProblem && (
        <button type="button" onClick={onProblem} className="text-[11px] text-white/50 underline-offset-2 hover:text-pink-400 hover:underline">
          {t('dashboard.confirm.problem')}
        </button>
      )}
      {error && <span className="text-[11px] text-pink-400">{error}</span>}
    </div>
  );
}
