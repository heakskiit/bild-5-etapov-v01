'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { dig, type Dict } from '@/lib/i18n/pick';
import {
  SUPPORT_REPLY_MAX,
  SUPPORT_STATUSES,
  autoCloseAt,
  type SupportClosedReason,
  type SupportMessage,
  type SupportStatus,
} from '@/lib/support/requests';

export type AdminSupportRow = {
  publicId: string;
  reason: string;
  status: SupportStatus;
  replySeenAt: string | null;
  hasReply: boolean;
  notifyFailed: boolean;
  createdAt: string;
  lastCustomerAt: string | null;
  lastStaffAt: string | null;
  closedReason: SupportClosedReason | null;
  thread: SupportMessage[];
  orderPublicId: string;
  orderStatus: string;
  contact: string | null;
  email: string | null;
  discordId: string | null;
};

/** UTC on purpose: this row is server-rendered, local time would mismatch on hydration. */
const utc = (iso: string) => `${iso.slice(0, 16).replace('T', ' ')} UTC`;

/** BATCH F15 / F15c: one support request in the admin list -- conversation, status, new reply. */
export function SupportAdminRow({ row, messages }: { row: AdminSupportRow; messages: Dict }) {
  const t = useMemo(() => (key: string, vars?: Record<string, string | number>) => dig(messages, key, vars), [messages]);
  const router = useRouter();
  const [status, setStatus] = useState<SupportStatus>(row.status);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const dirty = status !== row.status || reply.trim().length > 0;
  const closesAt = autoCloseAt(row);
  const staffTurn = row.status !== 'resolved' && !closesAt;

  const save = async () => {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch('/api/dashboard/admin/support', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: row.publicId, status, reply: reply.trim() || undefined }),
      });
      if (!res.ok) {
        setNote({ ok: false, text: t('admin.support.saveError') });
        return;
      }
      setReply('');
      setNote({ ok: true, text: t('admin.support.saved') });
      router.refresh();
    } catch {
      setNote({ ok: false, text: t('admin.support.saveError') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="glass-panel space-y-3 p-4 text-sm">
      <header className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-pink-400">{row.publicId}</span>
        <span className="font-mono text-xs text-white/70">{row.orderPublicId}</span>
        <span className="rounded-full border border-white/20 px-2 py-0.5 text-[11px] text-white/60">
          {t(`dashboard.status.${row.orderStatus}`)}
        </span>
        <span className="text-xs text-white/50">{t(`support.reasons.${row.reason}`)}</span>
        {staffTurn && (
          <span className="rounded-full bg-pink-500 px-2 py-0.5 text-[11px] font-semibold text-base">
            {t('admin.support.awaitingStaff')}
          </span>
        )}
        {closesAt && (
          <span className="rounded-full border border-neon-blue/50 px-2 py-0.5 text-[11px] text-neon-blue">
            {t('admin.support.awaitingCustomer', { time: utc(closesAt) })}
          </span>
        )}
        {row.status === 'resolved' && row.closedReason && (
          <span className="text-[11px] text-white/40">{t(`admin.support.closed.${row.closedReason}`)}</span>
        )}
        {row.notifyFailed && (
          <span className="rounded-full border border-pink-400/60 px-2 py-0.5 text-[11px] text-pink-400">
            {t('admin.support.notifyFailed')}
          </span>
        )}
        <span className="ml-auto text-[11px] text-white/40">{utc(row.createdAt)}</span>
      </header>

      <p className="text-[11px] text-white/50">
        {[row.contact, row.email, row.discordId ? `Discord ${row.discordId}` : null].filter(Boolean).join(' \u00b7 ') || '\u2014'}
      </p>

      {/* Conversation */}
      <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
        {row.thread.length === 0 && <p className="text-xs text-white/40">{t('support.noMessages')}</p>}
        {row.thread.map((m, i) => (
          <div key={i} className={`flex ${m.author === 'staff' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={[
                'max-w-[85%] rounded-lg border px-3 py-2',
                m.author === 'staff' ? 'border-neon-blue/40 bg-neon-blue/5' : 'border-white/15 bg-white/5',
              ].join(' ')}
            >
              <p className={`text-[10px] uppercase tracking-widest ${m.author === 'staff' ? 'text-neon-blue' : 'text-white/40'}`}>
                {m.author === 'staff' ? t('support.staff') : t('admin.support.customer')} \u00b7 {utc(m.createdAt)}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-ink">{m.body}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-start gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as SupportStatus)}
          className="rounded-lg border border-white/15 bg-night/60 px-2 py-1.5 text-sm text-ink"
        >
          {SUPPORT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {t(`support.status.${value}`)}
            </option>
          ))}
        </select>
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value.slice(0, SUPPORT_REPLY_MAX))}
          rows={3}
          maxLength={SUPPORT_REPLY_MAX}
          placeholder={t('admin.support.replyPlaceholder')}
          className="min-w-[16rem] flex-1 rounded-lg border border-white/15 bg-night/60 px-3 py-2 text-sm text-ink placeholder:text-white/30 focus:border-neon-blue focus:outline-none"
        />
      </div>

      <div className="flex items-center justify-end gap-3">
        {row.hasReply && (
          <span className="text-[11px] text-white/40">
            {row.replySeenAt ? t('admin.support.replySeen') : t('admin.support.replyUnseen')}
          </span>
        )}
        {note && <span className={`text-[11px] ${note.ok ? 'text-emerald-300' : 'text-pink-400'}`}>{note.text}</span>}
        <Button variant="primary" size="sm" onClick={save} loading={busy} loadingText={t('common.processing')} disabled={!dirty}>
          {reply.trim() ? t('admin.support.sendReply') : t('admin.support.save')}
        </Button>
      </div>
    </article>
  );
}
