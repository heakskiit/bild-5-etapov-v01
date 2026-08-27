# Security model

## Trust boundaries
| Boundary | Enforcement |
|---|---|
| Browser → `/api/checkout` | `zod .strict()` (unknown keys rejected) + full server-side price recomputation |
| CryptoBot → webhook | `HMAC_SHA256(SHA256(token), rawBody)` compared timing-safely against `crypto-pay-api-signature` |
| Webhook replays | unique `(provider, external_id)` on `webhook_events` |
| User → other users' data | Postgres RLS; the service-role key is used only inside server route handlers |
| Credentials at rest | AES-256-GCM, key in env only, order id bound as AAD |

## Why the frontend price is display-only
`calculatePrice` is a pure function of `config/pricing.config.ts`, so the client
can render an instant preview with the same code. The invoice, however, is always
generated from the server's own call. A tampered request cannot lower the price;
it can only fail validation.

## Why AAD matters
The order's public id is passed as additional authenticated data. Copying a
credential row onto another order makes decryption fail rather than succeed
silently — the ciphertext is cryptographically bound to its order.

## Credential lifecycle
1. Checkout never asks for a password.
2. After payment, the order card exposes the encrypted form.
3. The API accepts credentials only in `action_required` / `in_progress`.
4. On `completed`, `trg_nullify_credentials` sets all secret columns to `NULL`.

Customers can write credentials; nobody can read them back through the anon key.
Decryption happens only in server code, for executors, through a dedicated path.

## Secrets inventory
`SUPABASE_SERVICE_ROLE_KEY`, `CRYPTO_PAY_TOKEN`, `CREDENTIALS_ENCRYPTION_KEY`,
`SHEETS_WEBAPP_SECRET`, `DISCORD_BOOSTER_WEBHOOK_URL`, Discord OAuth secret.
None of these may appear in a `NEXT_PUBLIC_*` variable, a log line, or an error
message returned to the client.

## Key rotation
`CREDENTIALS_ENCRYPTION_KEY` rotation requires re-encrypting live rows. Because
the envelope is versioned (`v1.<iv>.<tag>.<ct>`), a `v2` prefix can be introduced
and decryption can accept both during the migration window.
