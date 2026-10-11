'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { dig, type Dict } from '@/lib/i18n/pick';
import {
  SUPPORT_MESSAGE_MAX,
  SUPPORT_REASONS,
  hasUnseenReply,
  type SupportReason,
  type SupportSummary,
} from '@/lib/support/requests';

/**
 * BATCH F15 (FEAT-SUP-027): the "Need help with this order" panel under an
 * order row. Either the form (no open request) or the latest request with
 * its status and the support answer.
 *
 * Opening a request that carries an unread answer marks it read, which is
 * what clears the "Has reply" badge on the row.
 */
export function SupportRequestPanel({
  orderId,
  request,
  canCreate,
  messages,
  onClose,
}: {
  orderId: string;
  request: SupportSummary | null;
  canCreate: boolean;
  messages: Dict;
  onClose: () => void;
}) {
  const t = useMemo(() => (key: string, vars?: Record<string, string | number>) => dig(messages, key, vars), [messages]);
  const router = useRouter();
  const [current, setCurrent] = useState<SupportSummary | null>(request);
  const [composing, setComposing] = useState(!request && canCreate);
  const [reason, setReason] = useState<SupportReason | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!current || !hasUnseenReply(current)) return;
    fetch('/api/orders/support/seen', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ requestId: current.publicId }),
    })
      .then((res) => (res.ok ? router.refresh() : undefined))
      .catch(() => undefined);
  }, [current, router]);

  const needsMessage = reason === 'other' && message.trim().length === 0;

  const submit = async () => {
    if (!reason || needsMessage) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/orders/support', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId, reason, message: message.trim() || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.request) {
        setError(
          data?.error === 'already_open'
            ? t('support.alreadyOpen')
            : res.status === 429
              ? t('support.tooMany')
              : t('support.error'),
        );
        return;
      }
      setCurrent(data.request);
      setComposing(false);
      router.refresh();
    } catch {
      setError(t('support.error'));
    } finally {
      setBusy(false);
    }
  };

  if (composing) {
    return (
      <div className="space-y-4">
        <p className="font-display text-sm uppercase tracking-widest text-pink-400">
          {t('support.title', { id: orderId })}
        </p>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-xs uppercase tracking-widest text-white/50">{t('support.reasonLabel')}</legend>
          {SUPPORT_REASONS.map((value) => (
            <label key={value} className="flex cursor-pointer items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                name={`support-reason-${orderId}`}
                value={value}
                checked={reason === value}
                onChange={() => setReason(value)}
                className="accent-pink-500"
              />
              {t(`support.reasons.${value}`)}
            </label>
          ))}
        </fieldset>

        <label className="block space-y-1">
          <span className="text-xs uppercase tracking-widest text-white/50">
            {reason === 'other' ? t('support.messageLabel') : t('support.messageLabelOptional')}
          </span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, SUPPORT_MESSAGE_MAX))}
            rows={3}
            maxLength={SUPPORT_MESSAGE_MAX}
            placeholder={t('support.messagePlaceholder')}
            className="w-full rounded-lg border border-white/15 bg-night/60 px-3 py-2 text-sm text-ink placeholder:text-white/30 focus:border-neon-blue focus:outline-none"
          />
          <span className="block text-right text-[11px] text-white/30">
            {message.length}/{SUPPORT_MESSAGE_MAX}
          </span>
        </label>

        <p className="text-[11px] text-white/40">{t('support.attachedNote')}</p>

        {error && <p className="text-xs text-pink-400">{error}</p>}

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={current ? () => setComposing(false) : onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={submit}
            loading={busy}
            disabled={!reason || needsMessage}
            disabledReason={!reason ? t('support.pickReason') : needsMessage ? t('support.messageRequired') : undefined}
          >
            {t('support.submit')}
          </Button>
        </div>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-display text-sm uppercase tracking-widest text-pink-400">
          {t('support.requestLabel', { id: current.publicId })}
        </span>
        <span className="rounded-full border border-white/20 px-2 py-0.5 text-[11px] text-white/70">
          {t(`support.status.${current.status}`)}
        </span>
        <span className="text-[11px] text-white/40">{t(`support.reasons.${current.reason}`)}</span>
      </div>

      {current.message && (
        <div>
          <p className="text-xs uppercase tracking-widest text-white/40">{t('support.yourMessage')}</p>
          <p className="whitespace-pre-wrap text-white/70">{current.message}</p>
        </div>
      )}

      {current.reply ? (
        <div className="rounded-lg border border-neon-blue/40 bg-neon-blue/5 p-3">
          <p className="text-xs uppercase tracking-widest text-neon-blue">{t('support.replyLabel')}</p>
          <p className="mt-1 whitespace-pre-wrap text-ink">{current.reply}</p>
        </div>
      ) : (
        <p className="text-xs text-white/50">{t('support.waitingReply')}</p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        {current.status === 'resolved' && canCreate && (
          <Button variant="secondary" size="sm" onClick={() => setComposing(true)}>
            {t('support.newRequest')}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t('common.close')}
        </Button>
      </div>
    </div>
  );
}
