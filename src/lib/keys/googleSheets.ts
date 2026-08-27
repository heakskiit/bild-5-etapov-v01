/**
 * Key warehouse client: Google Sheets via an Apps Script Web App.
 *
 * The atomicity guarantee lives on the Apps Script side (LockService), not
 * here — see apps-script/keyVault.gs. This module only speaks HTTP and keeps
 * the shared secret out of the URL query string.
 */

import { encryptSecret } from '@/lib/crypto/aes';

interface VaultResponse {
  ok: boolean;
  code?: string;
  error?: string;
  remaining?: number;
}

export async function fulfilDigitalCode(sku: string, orderPublicId: string): Promise<string> {
  const url = process.env.SHEETS_WEBAPP_URL;
  const secret = process.env.SHEETS_WEBAPP_SECRET;
  if (!url || !secret) throw new Error('Sheets web app env vars missing');

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secret, action: 'reserve', sku, orderId: orderPublicId }),
    // Apps Script can be slow; fail loudly instead of hanging the webhook.
    signal: AbortSignal.timeout(15_000),
  });

  const data = (await response.json()) as VaultResponse;
  if (!data.ok || !data.code) {
    throw new Error(`Key vault refused: ${data.error ?? 'unknown'} (sku=${sku})`);
  }

  // Codes rest encrypted; they are decrypted only for the "Show Code" call.
  return encryptSecret(data.code, orderPublicId);
}

export async function stockLevel(sku: string): Promise<number> {
  const url = process.env.SHEETS_WEBAPP_URL!;
  const secret = process.env.SHEETS_WEBAPP_SECRET!;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secret, action: 'stock', sku }),
    next: { revalidate: 60 },
  });
  const data = (await res.json()) as VaultResponse;
  return data.remaining ?? 0;
}

/**
 * §3.4 / item 5 ("нет в наличии"): SharkCardConfigurator and
 * ProductPreviewCard both already accept a `stock` prop, but nothing called
 * this to actually populate it — the "out of stock" state existed in the
 * UI and nowhere else. This is the missing wiring.
 *
 * Deliberately returns `undefined` (not a stock map with zeros) if
 * SHEETS_WEBAPP_URL/SECRET aren't configured or the Apps Script call fails
 * — both configurators already treat "no stock prop" as "don't render a
 * stock claim at all", which is correct here: a Sheets outage should hide
 * the stock badge, not make every card look sold out.
 */
export async function getSharkCardStock(skus: string[]): Promise<Record<string, number> | undefined> {
  if (!process.env.SHEETS_WEBAPP_URL || !process.env.SHEETS_WEBAPP_SECRET) return undefined;

  try {
    const levels = await Promise.all(skus.map((sku) => stockLevel(sku)));
    return Object.fromEntries(skus.map((sku, i) => [sku, levels[i]]));
  } catch (err) {
    console.error('[googleSheets] stock lookup failed, hiding stock badges', err);
    return undefined;
  }
}
