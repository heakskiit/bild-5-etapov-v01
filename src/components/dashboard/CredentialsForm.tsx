'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { dig, type Dict } from '@/lib/i18n/pick';

/**
 * Safe Account Sharing form — post-payment only.
 * Rendered exclusively inside an order card whose status is `action_required`,
 * so a customer can never be prompted for a password during checkout.
 */
export function CredentialsForm({
  orderId,
  onDone,
  messages,
}: {
  orderId: string;
  onDone: () => void;
  messages: Dict;
}) {
  const t = useMemo(() => (key: string) => dig(messages, key), [messages]);
  const [state, setState] = useState<'idle' | 'sending' | 'error'>('idle');

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState('sending');
    // Captured before the first await: React pools/nulls the SyntheticEvent
    // (including currentTarget) once this handler yields, so reading
    // event.currentTarget *after* the fetch resolves throws.
    const formEl = event.currentTarget;
    const form = new FormData(formEl);

    const res = await fetch('/api/orders/credentials', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        orderId,
        login: form.get('login'),
        password: form.get('password'),
        twoFactorNote: form.get('note') || undefined,
      }),
    });

    // Nothing is kept in component state: no secret survives the submit.
    formEl.reset();
    if (res.ok) onDone();
    else setState('error');
  };

  return (
    <form onSubmit={submit} className="max-w-md space-y-3" autoComplete="off">
      <p className="text-xs text-white/60">{t('dashboard.credentialsNotice')}</p>
      <input name="login" required placeholder={t('dashboard.loginPlaceholder')} className={INPUT} />
      <input
        name="password"
        type="password"
        required
        placeholder={t('dashboard.passwordPlaceholder')}
        className={INPUT}
      />
      <input name="note" placeholder={t('dashboard.notePlaceholder')} className={INPUT} />
      <Button type="submit" variant="primary" loading={state === 'sending'} loadingText={t('common.encrypting')}>
        {t('common.sendSecurely')}
      </Button>
      {state === 'error' && <p className="text-xs text-pink-400">{t('common.saveError')}</p>}
    </form>
  );
}

const INPUT =
  'w-full rounded-lg border border-white/15 bg-night px-3 py-2 text-sm outline-none focus:border-neon-blue';
