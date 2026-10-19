'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { dig, type Dict } from '@/lib/i18n/pick';
import {
  SUPPORT_MESSAGE_MAX,
  SUPPORT_REASONS,
  autoCloseAt,
  hasUnseenReply,
  type SupportMessage,
  type SupportReason,
  type SupportSummary,
} from '@/lib/support/requests';

const textareaClass =
  'w-full rounded-lg border border-white/15 bg-night/60 px-3 py-2 text-sm text-ink placeholder:text-white/30 focus:border-neon-blue focus:outline-none';

/**
 * BATCH F15 (FEAT-SUP-027) / F15c (FEAT-SUP-028): the "Need help with this
 * order" panel under an order row. Either the new-request form, or the
 * request as a conversation: messages of both sides, a reply box while the
 * request is open, and a "Solved" button.
 *
 * Rendered only after a click, so local times here never meet SSR.
 */
export function SupportRequestPanel({
  orderId,
  request,
  canCreate,
  messages,
  onClose,
  initialReason = null,
}: {
  orderId: string;
  request: SupportSummary | null;
  canCreate: boolean;
  messages: Dict;
  onClose: () => void;
  /** BATCH F18: "Not received" opens the form with this reason picked. */
  initialReason?: SupportReason | null;
}) {
  const t = useMemo(() => (key: string, vars?: Record<string, string | number>) => dig(messages, key, vars), [messages]);
  const router = useRouter();
  const [current, setCurrent] = useState<SupportSummary | null>(request);
  const [composing, setComposing] = useState(!request && canCreate);
  const [reason, setReason] = useState<SupportReason | null>(initialReason);
  const [message, setMessage] = useState('');
  const [thread, setThread] = useState<SupportMessage[] | null>(null);
  const [threadError, setThreadError] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The server re-renders the row after every action; keep the panel in step.
  useEffect(() => setCurrent(request), [request]);

  const loadThread = useCallback(async (id: string) => {
    setThreadError(false);
    try {
      const res = await fetch(`/api/orders/support/thread?id=${encodeURIComponent(id)}`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(data?.messages)) throw new Error('thread');
      setThread(data.messages);
    } catch {
      setThreadError(true);
    }
  }, []);

  useEffect(() => {
    if (current && !composing) loadThread(current.publicId);
  }, [current?.publicId, current?.lastStaffAt, current?.lastCustomerAt, composing, loadThread]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const errorText = (status: number, code?: string) =>
    code === 'already_open'
      ? t('support.alreadyOpen')
      : code === 'closed'
        ? t('support.closedNote')
        : status === 429
          ? t('support.tooMany')
          : t('support.error');

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
        setError(errorText(res.status, data?.error));
        return;
      }
      setCurrent(data.request);
      setComposing(false);
      setMessage('');
      setReason(null);
      router.refresh();
    } catch {
      setError(t('support.error'));
    } finally {
      setBusy(false);
    }
  };

  const send = async (resolve: boolean) => {
    if (!current) return;
    const body = draft.trim();
    if (!resolve && !body) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/orders/support/thread', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ requestId: current.publicId, body: body || undefined, resolve: resolve || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(errorText(res.status, data?.error));
        return;
      }
      setDraft('');
      await loadThread(current.publicId);
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
            className={textareaClass}
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
            loadingText={t('common.processing')}
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

  const closesAt = autoCloseAt(current);
  const isOpen = current.status !== 'resolved';

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

      {/* Conversation */}
      <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
        {thread === null && !threadError && <p className="text-xs text-white/40">{t('support.loading')}</p>}
        {threadError && <p className="text-xs text-pink-400">{t('support.threadError')}</p>}
        {thread?.length === 0 && <p className="text-xs text-white/40">{t('support.noMessages')}</p>}
        {thread?.map((m, i) => (
          <div key={i} className={`flex ${m.author === 'customer' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={[
                'max-w-[85%] rounded-lg border px-3 py-2',
                m.author === 'customer' ? 'border-white/15 bg-white/5' : 'border-neon-blue/40 bg-neon-blue/5',
              ].join(' ')}
            >
              <p className={`text-[10px] uppercase tracking-widest ${m.author === 'customer' ? 'text-white/40' : 'text-neon-blue'}`}>
                {m.author === 'customer' ? t('support.you') : t('support.staff')} · {new Date(m.createdAt).toLocaleString()}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-ink">{m.body}</p>
            </div>
          </div>
        ))}
      </div>

      {isOpen ? (
        <>
          <p className="text-xs text-white/50">
            {closesAt
              ? t('support.awaitingYou', { time: new Date(closesAt).toLocaleString() })
              : t('support.waitingReply')}
          </p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, SUPPORT_MESSAGE_MAX))}
            rows={2}
            maxLength={SUPPORT_MESSAGE_MAX}
            placeholder={t('support.replyPlaceholder')}
            className={textareaClass}
          />
          {error && <p className="text-xs text-pink-400">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => send(true)} disabled={busy}>
              {t('support.markResolved')}
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              {t('common.close')}
            </Button>
            <Button variant="primary" size="sm" onClick={() => send(false)} loading={busy} loadingText={t('common.processing')} disabled={!draft.trim()}>
              {t('support.send')}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-white/50">
            {current.closedReason === 'auto_idle'
              ? t('support.closedAuto')
              : current.closedReason === 'customer'
                ? t('support.closedCustomer')
                : t('support.closedStaff')}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            {canCreate && (
              <Button variant="secondary" size="sm" onClick={() => setComposing(true)}>
                {t('support.newRequest')}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              {t('common.close')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
