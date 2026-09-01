/**
 * Booster coordination via a Discord webhook — free-for-all model.
 * Posted to a hidden executors channel after payment clears.
 *
 * Payouts are settled off the site, so the embed shows the order total rather
 * than a computed payout figure that nobody actually pays out.
 */

import type { Order } from '@/types/order';

const NEON_PINK = 0xff2a85;

export async function notifyBoosters(order: Order & Record<string, any>): Promise<void> {
  const url = process.env.DISCORD_BOOSTER_WEBHOOK_URL;
  if (!url) throw new Error('DISCORD_BOOSTER_WEBHOOK_URL is not set');

  const s = order.selection;
  const service =
    s.product === 'leveling'
      ? `Leveling → level ${s.level}`
      : `Money Boost → ${s.amountMillions}m`;

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
