/**
 * Thin CryptoBot Pay client. Only createInvoice is needed for the MVP —
 * everything else about payment state arrives through the webhook.
 */

interface InvoiceResponse {
  invoice_id: string;
  pay_url: string;
  status: string;
}

/**
 * How long a CryptoBot invoice stays payable. BATCH F14 stores the resulting
 * moment on the order so the "Pay" button knows when to issue a new invoice
 * instead of reopening a dead one.
 */
export const INVOICE_TTL_SECONDS = 3600;

export async function createInvoice(params: {
  amount: number;
  description: string;
  payload: string;
  /** Where the invoice's "Return" button sends the customer after paying. */
  returnUrl: string;
}): Promise<InvoiceResponse> {
  const token = process.env.CRYPTO_PAY_TOKEN;
  const base = process.env.CRYPTO_PAY_API_BASE ?? 'https://pay.crypt.bot/api';
  if (!token) throw new Error('CRYPTO_PAY_TOKEN is not set');

  const res = await fetch(`${base}/createInvoice`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'Crypto-Pay-API-Token': token },
    body: JSON.stringify({
      currency_type: 'fiat',
      fiat: 'USD',
      amount: params.amount.toFixed(2),
      description: params.description,
      payload: params.payload,
      // paid_btn_url is required by CryptoBot whenever paid_btn_name is set
      // (confirmed against current API docs — this used to be laxer, which
      // is presumably why it was missing here). 'callback' → "Return" is the
      // right label for a site, not 'openBot', which is Telegram-bot-specific.
      paid_btn_name: 'callback',
      paid_btn_url: params.returnUrl,
      allow_comments: false,
      expires_in: INVOICE_TTL_SECONDS,
    }),
    cache: 'no-store',
  });

  const json = await res.json();
  if (!json.ok) throw new Error(`createInvoice failed: ${JSON.stringify(json.error)}`);
  return json.result as InvoiceResponse;
}
