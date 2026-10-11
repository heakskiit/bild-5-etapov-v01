/**
 * Support requests -> private staff channel (BATCH F15 / FEAT-SUP-027).
 *
 * A separate webhook from the booster dispatch on purpose: boosters see jobs,
 * staff see complaints, and a customer's refund request has no business in
 * the channel every booster reads.
 *
 * Game credentials are never part of this message: they stay encrypted in
 * account_credentials and are revealed only on the job page.
 */

const SUPPORT_RED = 0xff4d4d;

const REASON_LABELS: Record<string, string> = {
  payment_not_confirmed: 'Payment not confirmed',
  queue_too_long: 'Order in queue too long',
  credentials_help: 'Help with order details / access',
  item_not_received: 'Item not received or not working',
  cancel_refund: 'Cancel order / refund',
  other: 'Other',
};

/** Selection keys that are noise or private for a support message. */
const HIDDEN_SELECTION_KEYS = new Set(['details', 'contact', 'locale', 'promoCode']);

export type SupportNotice = {
  requestId: string;
  reason: string;
  message: string | null;
  order: {
    public_id: string;
    status: string;
    total_usd: string | number;
    discount_usd?: string | number | null;
    promo_code?: string | null;
    selection: Record<string, unknown> | null;
    paid_at: string | null;
    created_at: string;
    contact_handle: string | null;
    cart_id?: string | null;
  };
  customer: { email: string | null; discordId: string | null };
  events: Array<{ kind: string; created_at: string }>;
  adminUrl: string;
};

export function summarizeSelection(selection: Record<string, unknown> | null): string {
  if (!selection) return '—';
  const parts = Object.entries(selection)
    .filter(([key, value]) => !HIDDEN_SELECTION_KEYS.has(key) && value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`);
  return clip(parts.join('\n') || '—', 1000);
}

export function buildSupportMessage(notice: SupportNotice) {
  const o = notice.order;
  const discount = Number(o.discount_usd ?? 0);
  const events = notice.events.length
    ? notice.events.map((e) => `\`${e.created_at.slice(0, 16).replace('T', ' ')}\` ${e.kind}`).join('\n')
    : '—';

  return {
    username: 'Support Desk',
    content: `🆘 **${notice.requestId}** — ${REASON_LABELS[notice.reason] ?? notice.reason} · order **${o.public_id}**`,
    embeds: [
      {
        title: `${notice.requestId} · ${o.public_id}`,
        url: notice.adminUrl,
        color: SUPPORT_RED,
        description: notice.message ? clip(notice.message, 1000) : '_No comment_',
        fields: [
          { name: 'Reason', value: REASON_LABELS[notice.reason] ?? notice.reason, inline: true },
          { name: 'Order status', value: o.status, inline: true },
          {
            name: 'Total',
            value: `$${Number(o.total_usd).toFixed(2)}${discount > 0 ? ` (−$${discount.toFixed(2)}${o.promo_code ? ` ${o.promo_code}` : ''})` : ''}`,
            inline: true,
          },
          { name: 'Created', value: utc(o.created_at), inline: true },
          { name: 'Paid', value: o.paid_at ? utc(o.paid_at) : 'not paid', inline: true },
          { name: 'Cart', value: o.cart_id ? o.cart_id.slice(0, 8) : '—', inline: true },
          { name: 'Items', value: summarizeSelection(o.selection) },
          {
            name: 'Customer',
            value: clip(
              [
                o.contact_handle ? `contact: ${o.contact_handle}` : null,
                notice.customer.email ? `email: ${notice.customer.email}` : null,
                notice.customer.discordId ? `discord: <@${notice.customer.discordId}>` : null,
              ]
                .filter(Boolean)
                .join('\n') || '—',
              1000,
            ),
          },
          { name: 'Last events', value: clip(events, 1000) },
        ],
      },
    ],
  };
}

export async function notifySupport(notice: SupportNotice): Promise<void> {
  const url = process.env.DISCORD_SUPPORT_WEBHOOK_URL;
  if (!url) throw new Error('DISCORD_SUPPORT_WEBHOOK_URL is not set');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(buildSupportMessage(notice)),
  });
  if (!res.ok) throw new Error(`Discord support webhook failed: ${res.status} ${await res.text()}`);
}

function utc(iso: string): string {
  return `${iso.slice(0, 16).replace('T', ' ')} UTC`;
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
