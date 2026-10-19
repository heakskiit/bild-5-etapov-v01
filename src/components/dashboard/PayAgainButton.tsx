'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { dig, type Dict } from '@/lib/i18n/pick';

/**
 * BATCH F14 (FEAT-PAY-026): "Pay" on an order that is still waiting.
 *
 * The tab is opened synchronously on the click and only then pointed at the
 * invoice. Opening it after the fetch resolves is what browsers block as a
 * popup -- which is exactly the failure this button exists to fix.
 *
 * For a cart one button covers the whole group: the API renews the single
 * invoice that all of its orders share.
 */
export function PayAgainButton({
  orderId,
  messages,
  size = 'sm',
}: {
  orderId: string;
  messages: Dict;
  size?: 'sm' | 'md';
}) {
  const t = useMemo(() => (key: string) => dig(messages, key), [messages]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async () => {
    setBusy(true);
    setError(null);
    const tab = window.open('', '_blank');
    try {
      const res = await fetch('/api/orders/pay-link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.payUrl) {
        tab?.close();
        setError(data?.error === 'not_payable' || data?.error === 'expired' ? t('dashboard.payNotPayable') : t('dashboard.payError'));
        return;
      }

      if (tab) tab.location.href = data.payUrl;
      // Blocked anyway (in-app browsers do this): keep the promise visible.
      else window.location.href = data.payUrl;
    } catch {
      tab?.close();
      setError(t('dashboard.payError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="primary" size={size} onClick={pay} loading={busy} loadingText={t('common.processing')}>
        {t('dashboard.payAgain')}
      </Button>
      {error && <span className="text-[11px] text-pink-400">{error}</span>}
    </div>
  );
}
