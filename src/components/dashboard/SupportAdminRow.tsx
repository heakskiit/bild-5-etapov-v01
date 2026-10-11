'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { dig, type Dict } from '@/lib/i18n/pick';
import { SUPPORT_REPLY_MAX, SUPPORT_STATUSES, type SupportStatus } from '@/lib/support/requests';

export type AdminSupportRow = {
  publicId: string;
  reason: string;
  message: string | null;
  status: SupportStatus;
  reply: string | null;
  replySeenAt: string | null;
  notifyFailed: boolean;
  createdAt: string;
  orderPublicId: string;
  orderStatus: string;
  contact: string | null;
  email: string | null;
  discordId: string | null;
};

/** BATCH F15: one support request in the admin list -- status + answer. */
export function SupportAdminRow({ row, messages }: { row: AdminSupportRow; messages: Dict }) {
  const t = useMemo(() => (key: string, vars?: Record<string, string | number>) => dig(messages, key, vars), [messages]);
  const router = useRouter();
  const [status, setStatus] = useState<SupportStatus>(row.status);
  const [reply, setReply] = useState(row.reply ?? '');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const dirty = status !== row.status || reply.trim() !== (row.reply ?? '');

  const save = async () => {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch('/api/dashboard/admin/support', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: row.publicId, status, reply: reply.trim() }),
      });
      if (!res.ok) {
        setNote({ ok: false, text: t('admin.support.saveError') });
        return;
      }
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
        {row.notifyFailed && (
          <span className="rounded-full border border-pink-400/60 px-2 py-0.5 text-[11px] text-pink-400">
            {t('admin.support.notifyFailed')}
          </span>
        )}
        <span className="ml-auto text-[11px] text-white/40">{row.createdAt.slice(0, 16).replace('T', ' ')} UTC</span>
      </header>

      {row.message && <p className="whitespace-pre-wrap text-white/80">{row.message}</p>}

      <p className="text-[11px] text-white/50">
        {[row.contact, row.email, row.discordId ? `Discord ${row.discordId}` : null].filter(Boolean).join(' · ') || '—'}
      </p>

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
        {row.reply && (
          <span className="text-[11px] text-white/40">
            {row.replySeenAt ? t('admin.support.replySeen') : t('admin.support.replyUnseen')}
          </span>
        )}
        {note && <span className={`text-[11px] ${note.ok ? 'text-emerald-300' : 'text-pink-400'}`}>{note.text}</span>}
        <Button variant="primary" size="sm" onClick={save} loading={busy} disabled={!dirty}>
          {t('admin.support.save')}
        </Button>
      </div>
    </article>
  );
}
