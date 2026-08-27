# Runbook — operating the MVP without an admin panel

## Restocking digital codes
1. Open the keys spreadsheet, tab `KEYS`.
2. Paste new rows: `SKU | CODE | AVAILABLE` (leave `ORDER_ID` and `SOLD_AT` empty).
   `SKU` must match `sheetSku` in `config/pricing.config.ts`.
3. Nothing else. The next paid order picks the first `AVAILABLE` row for that SKU.

**Never** edit a row whose status is `SOLD` — it is the delivery receipt for a
customer order.

### Verifying the atomic reservation
Fire two reservations at once and confirm two distinct codes come back:

```bash
for i in 1 2; do
  curl -s -X POST "$SHEETS_WEBAPP_URL" -H 'content-type: application/json' \
    -d "{\"secret\":\"$SHEETS_WEBAPP_SECRET\",\"action\":\"reserve\",\"sku\":\"SHARK_1M\",\"orderId\":\"TEST-$i\"}" &
done; wait
```

If the two responses ever contain the same `code`, `LockService` is not engaged —
stop selling that SKU and investigate before anything else.

## Changing prices
Edit `config/pricing.config.ts`, bump `PRICING_VERSION`, run
`npm run verify:pricing`, deploy. Existing orders keep the version they were
quoted at (`orders.pricing_version`), so historic revenue stays explainable.

## Booster dispatch (free-for-all)
Paid boost orders post an embed to the hidden executors channel with the payout
already computed at 50% of the service total. Whoever claims the order first in
the thread takes the job. Payout percentage lives in `BOOSTER_PAYOUT_SHARE`.

## Order lifecycle
```
awaiting_payment ──(signed webhook)──► completed          (digital codes)
awaiting_payment ──(signed webhook)──► action_required
        └─(customer submits credentials)─► in_progress
                └─(executor finishes, status set to completed)
                        └─ trigger nullifies credentials
```

## Payment incidents
- **Underpaid:** the order flips to `action_required` with an `underpaid` event.
  Resolve manually in Discord; never fulfil from the sheet by hand without
  recording an `order_events` row.
- **Webhook replay:** expected and harmless — `webhook_events` has a unique
  constraint on `(provider, external_id)`.
- **Missing webhook:** re-send it from the CryptoBot dashboard. The endpoint is
  idempotent, so replaying is always safe.

## Support
All customer contact happens on Discord with Ticket Tool. There is no on-site
chat, and no support path should ever ask for a password over chat — the only
legitimate channel is the encrypted form inside the paid order card.

## Cloudflare / origin checklist
- DNS records proxied (orange cloud); TLS mode "Full (strict)".
- Origin firewall allows Cloudflare IP ranges only, so the origin IP stays hidden
  and no customer needs a VPN.
- Rate limit `/api/checkout`; leave `/api/webhooks/cryptobot` reachable for the
  provider but keep it signature-gated.
