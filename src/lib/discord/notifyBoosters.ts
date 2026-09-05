/**
 * Booster coordination via a Discord webhook — free-for-all model.
 * Posted to a hidden executors channel after payment clears.
 *
 * Payouts are settled off the site, so the embed shows the order total rather
 * than a computed payout figure that nobody actually pays out.
 */

import type { Order } from '@/types/order';
import { deliveredMillions } from '@/lib/pricing/promoBonus';

const NEON_PINK = 0xff2a85;

export async function notifyBoosters(order: Order & Record<string, any>): Promise<void> {
  const url = process.env.DISCORD_BOOSTER_WEBHOOK_URL;
  if (!url) throw new Error('DISCORD_BOOSTER_WEBHOOK_URL is not set');

  const s = order.selection;

  // The single number this whole feature exists for. A booster who reads the
  // ordered amount instead of the delivered one hands over half the goods and
  // marks the job done, so the multiplier is applied here and repeated as its
  // own field below -- one place to misread is one too many.
  const multiplier = Number(order.delivery_multiplier ?? 1) || 1;
  const delivered = deliveredMillions(s.amountMillions, multiplier);

  const service =
    s.product === 'leveling'
      ? `Leveling → level ${s.level}`
      : `Money Boost → ${delivered ?? s.amountMillions}m${multiplier > 1 ? ` (X${multiplier})` : ''}`;

  const embed = {
    title: `🆕 Order ${order.publicId ?? order.public_id}`,
    color: NEON_PINK,
    fields: [
      { name: 'Service', value: service, inline: true },
      { name: 'Platform', value: String(s.platform).toUpperCase(), inline: true },
      { name: 'Delivery', value: s.delivery ?? 'normal', inline: true },
      {
        name: 'Order total',
        value: `**$${Number(order.totalUsd ?? order.total_usd).toFixed(2)}**`,
        inline: true,
      },
      ...(multiplier > 1
        ? [
            {
              name: `⭐ Bonus X${multiplier}`,
              value: `Deliver **${delivered ?? '?'}m** — the customer paid for ${s.amountMillions}m.`,
              inline: false,
            },
          ]
        : []),
      { name: 'Add-ons', value: (s.addonIds ?? []).join(', ') || '—', inline: false },
      { name: 'Customer contact', value: order.contact_handle ?? 'see dashboard', inline: false },
    ],
    footer: { text: 'First to claim in thread takes the job · free-for-all' },
    timestamp: new Date().toISOString(),
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'Order Dispatch', embeds: [embed] }),
  });

  if (!res.ok) throw new Error(`Discord webhook failed: ${res.status} ${await res.text()}`);
}
