# Neondrive — digital codes & co-op services portal

Multilingual SSR storefront for digital codes and piloted/co-op gameplay services.
No custom admin panel: stock lives in Google Sheets, executor dispatch lives in Discord.

> **Legal note.** This project is an independent community and digital service platform.
> The disclaimer in `messages/*.json → common.disclaimer` must render in the header
> (small print) and the footer (standalone block) of **every** page. No Rockstar logos,
> no Pricedown, no copyrighted characters — illustrations in `public/illustrations` are
> our own vector work only.

---

## 1. Step-by-step development plan

Phases are ordered by dependency, not by calendar. Each phase ends with a
verifiable artifact so the next one can start from a known-good state.

### Phase 0 — Foundation
1. Create the repo, install Next.js (App Router) + TypeScript + Tailwind.
2. Commit `tailwind.config.ts` palette (`#0B0B16`, `#FF2A85`, `#00F0FF`) and
   `globals.css` (focus rings, `prefers-reduced-motion`).
3. Add `.env.example`; wire secret storage for the deploy target.
4. Build the layout shell: `Header` (with small-print disclaimer), `Footer`
   (with the standalone disclaimer block), `LocaleSwitcher`.
   **Exit criteria:** every route renders the disclaimer twice, SSR verified with
   `curl` (text present in the HTML source, not injected by JS).

### Phase 1 — Internationalisation before content
5. Declare locales in `src/lib/i18n/config.ts` (`en` default, `de`, `fr`, `es`, `ru`).
6. Implement `middleware.ts`: cookie → `Accept-Language` → `en`, then redirect to `/{locale}`.
7. Implement `getTranslations()` with English fallback per key.
8. Fill `messages/en.json` first; treat it as the schema for the other four files.
   **Exit criteria:** switching language keeps the path, persists in a cookie, and
   German/French labels do not break any button (all buttons use `min-w-*` +
   `text-balance`, never fixed widths).

### Phase 2 — Data model and auth
9. Apply `supabase/migrations/0001_init.sql`: `profiles`, `orders`, `digital_codes`,
   `account_credentials`, `order_events`, `webhook_events`.
10. Enable RLS policies exactly as in the migration; confirm a user cannot read
    another user's order, and that nobody can read credentials back.
11. Turn on Magic Link (email) + Discord OAuth in Supabase. **No password field
    anywhere in signup.**
    **Exit criteria:** sign in with both providers; `profiles` row auto-created.

### Phase 3 — Pricing engine (before any UI that shows a price)
12. Write `config/pricing.config.ts` — the single source of truth: shark card
    denominations, PC level tiers, console level tables, console money radios,
    PC money tiers, two independent 10-item add-on catalogues, delivery
    modifiers (0 / 0.30 / 0.60), booster share (0.50).
13. Write `src/lib/pricing/calculate.ts` with the marginal tier walk, so the
    average price per million falls as the slider grows.
14. Write `src/lib/validation/order.ts` (`zod`, `.strict()`) — the trust boundary.
15. Run `npm run verify:pricing`.
    **Exit criteria:** all pricing checks pass, including "console level must come
    from the fixed dropdown" and "add-ons cannot cross the PC/console boundary".

### Phase 4 — Product card and conditional logic
16. Build the composable left column: illustration, `SafetyWidget`
    ("No bans reported", 72h copy, version + update chips), `ProductFaq`
    (native `<details>`: HOW THIS BOOST WORKS / WHY SO CHEAP?).
17. Build UI primitives: `NeonSlider`, `RadioGroup`, `Dropdown`, `AddonGrid`,
    `PlatformSelector`, `DeliverySelector`.
18. Build `BoostConfigurator` — the decision table:

    | product | platform | amount control | add-ons |
    |---|---|---|---|
    | leveling | PC | slider 1…8000 | PC set (10) |
    | leveling | PS / Xbox | dropdown 50/75/100/120/150/200/300 | console set (10) |
    | money | PC | version + launcher selectors, slider 100m…5000m | PC set (10) |
    | money | PS / Xbox | radio 10/20/50/75/100/150/200/300 m | console set (10) |

19. Build `SharkCardConfigurator`: one card, radio denominations, no platform,
    no delivery modifier.
    **Exit criteria:** switching platform resets platform-specific state and swaps
    the add-on grid; the displayed total always matches `calculatePrice`.

### Phase 5 — Payments
20. Implement `POST /api/checkout`: authenticate, `zod`-parse IDs only,
    **recompute** the total, insert the order, create the CryptoBot invoice,
    return only `payUrl`.
21. Implement `POST /api/webhooks/cryptobot`: read the raw body, verify
    `crypto-pay-api-signature` = `HMAC_SHA256(SHA256(token), rawBody)` with a
    timing-safe compare, dedupe on `update_id`, compare paid amount to our own
    total, then fulfil.
22. Run `npm run verify:security`.
    **Exit criteria:** a request with a body-tampered signature returns 401; a
    replayed `update_id` returns `deduplicated: true`; underpayment flags the
    order instead of delivering.

### Phase 6 — Fulfilment integrations
23. Deploy `apps-script/keyVault.gs` as a Web App; set `SHARED_SECRET` in Script
    Properties; sheet columns `SKU | CODE | STATUS | ORDER_ID | SOLD_AT`.
24. Wire `src/lib/keys/googleSheets.ts`; codes are AES-encrypted before they touch
    Postgres and decrypted only by `POST /api/orders/reveal-code`.
25. Wire `src/lib/discord/notifyBoosters.ts`: embed with order ID, service,
    platform, **payout computed on the backend**, customer contact.
    **Exit criteria:** two concurrent purchases of the same SKU receive two
    different codes (LockService test, see `docs/runbook.md`); an out-of-stock SKU
    fails loudly instead of completing the order.

### Phase 7 — Dashboard and Safe Account Sharing
26. `/dashboard`: totals + language control. `/dashboard/orders`: table with
    "Show Code" (enabled only when `completed`) and status chips
    (`Action Required` / `In Progress` / `Completed`).
27. `CredentialsForm` + `POST /api/orders/credentials`: available **only after
    payment**, AES-256-GCM with the order's public id as AAD, form reset on submit
    so no secret lingers in component state.
28. Confirm the `trg_nullify_credentials` trigger wipes secrets on completion.
    **Exit criteria:** no credential input exists anywhere in the checkout flow;
    after marking an order complete, credential columns are `NULL` and
    `nullified_at` is set.

### Phase 8 — Content, SEO, legal pages
29. `/about` (safety guarantees, key legality), `/support` (FAQ + Discord invite —
    no on-site chat), legal routes: terms, refund policy, privacy.
30. Per-locale metadata, `hreflang` alternates, `sitemap.xml`, `robots.txt`,
    JSON-LD `Product` + `FAQPage`.
31. Home page: hero, category links, Trustpilot placeholder (4.8/5, marked
    `data-trustpilot-placeholder`), benefit blocks.

### Phase 9 — Infrastructure and hardening
32. Deploy the origin in Germany (Hetzner) or the Netherlands (DigitalOcean /
    Vultr); run the app under a process manager with health checks.
33. Put Cloudflare in front: proxied DNS, "Full (strict)" TLS, origin firewall
    that accepts Cloudflare IP ranges only (hides the origin IP, so customers need
    no VPN anywhere in the world), WAF + rate limits on `/api/checkout`.
34. Register the webhook URL in CryptoBot; confirm delivery from the real sender.
35. Backups: nightly Postgres dump, plus a copy of the keys sheet.

### Phase 10 — Pre-launch verification
36. `npm run typecheck`, `npm run verify:pricing`, `npm run verify:security`.
37. Manual QA in all five locales on mobile and desktop.
38. Price-tampering attempt: intercept the checkout request, inject `price` and a
    console-only level on a PC order — both must be rejected.
39. Load-test the code warehouse with parallel purchases.

---

## 2. File structure

```
gta-portal/
├── config/
│   └── pricing.config.ts          ← ALL prices, tiers, add-ons, modifiers
├── messages/
│   ├── en.json  de.json  fr.json  es.json  ru.json
├── apps-script/
│   └── keyVault.gs                ← Google Sheets Web App, LockService
├── supabase/migrations/
│   └── 0001_init.sql              ← schema, RLS, nullify trigger
├── scripts/
│   ├── verify-pricing.mts         ← 9 revenue-protecting checks
│   └── verify-security.mts        ← 8 AES + webhook signature checks
├── src/
│   ├── app/
│   │   ├── globals.css
│   │   ├── [locale]/
│   │   │   ├── layout.tsx         ← Header + Footer + hreflang
│   │   │   ├── page.tsx           ← hero, Trustpilot, benefits
│   │   │   ├── store/page.tsx
│   │   │   ├── co-op/page.tsx
│   │   │   ├── about/page.tsx
│   │   │   ├── support/page.tsx
│   │   │   ├── product/[slug]/page.tsx
│   │   │   └── dashboard/
│   │   │       ├── page.tsx
│   │   │       └── orders/page.tsx
│   │   └── api/
│   │       ├── checkout/route.ts             ← recomputes price, creates invoice
│   │       ├── webhooks/cryptobot/route.ts   ← signature + idempotency + fulfil
│   │       └── orders/
│   │           ├── credentials/route.ts      ← post-payment AES intake
│   │           └── reveal-code/route.ts      ← "Show Code"
│   ├── components/
│   │   ├── layout/      Header, Footer, Disclaimer, LocaleSwitcher
│   │   ├── product/     SafetyWidget, ProductFaq
│   │   ├── configurators/ BoostConfigurator, SharkCardConfigurator,
│   │   │                  PlatformSelector, AddonGrid, DeliverySelector
│   │   ├── dashboard/   OrderRow, CredentialsForm
│   │   └── ui/          NeonSlider, RadioGroup, Dropdown, icons,
│   │                    TrustpilotPlaceholder
│   ├── lib/
│   │   ├── pricing/     calculate.ts, cryptobot.ts
│   │   ├── crypto/      aes.ts           ← AES-256-GCM envelope
│   │   ├── keys/        googleSheets.ts  ← key warehouse client
│   │   ├── discord/     notifyBoosters.ts
│   │   ├── supabase/    service.ts, auth.ts
│   │   ├── i18n/        config.ts, getTranslations.ts
│   │   ├── validation/  order.ts         ← zod trust boundary
│   │   └── catalog.ts   ← copy/art/slugs, kept apart from prices
│   └── types/order.ts
├── middleware.ts                  ← locale negotiation
├── next.config.mjs                ← CSP + security headers
├── tailwind.config.ts             ← synthwave palette, neon shadows
└── .env.example
```

## 3. Quick start

```bash
cp .env.example .env.local          # fill in Supabase, CryptoBot, Sheets, Discord
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"  # AES key
npm install
npm run verify:pricing              # 9 checks
npm run verify:security             # 8 checks
npm run dev
```

## 4. Non-negotiable invariants

1. The browser never sends a price. `/api/checkout` recomputes everything.
2. An order becomes payable only through a signature-verified webhook.
3. A code leaves the warehouse exactly once (Apps Script `LockService`).
4. Passwords are collected only after payment, encrypted at rest, and nullified
   on completion.
5. The disclaimer renders in the header and the footer on every page.
6. Prices change in `config/pricing.config.ts` only — never in a component.
