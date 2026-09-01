/**
 * SINGLE SOURCE OF TRUTH FOR ALL PRICES.
 * -------------------------------------------------------------
 * The owner edits ONLY this file (or the Google Sheet that hydrates it)
 * to change prices. No UI component may hardcode a price.
 *
 * Every number here is USD.
 * The backend re-reads this file at invoice time — the frontend price is
 * display-only and is NEVER trusted.
 */

export type Platform = 'pc' | 'ps' | 'xbox';
export type GameVersion = 'legacy' | 'enhanced';
export type Launcher = 'steam' | 'epic' | 'rockstar';
export type DeliverySpeed = 'normal' | 'express' | 'super_express';

/** Marginal tier: `upTo` is inclusive upper bound of the tier, in units. */
export interface PriceTier {
  upTo: number;
  pricePerUnit: number;
}

export interface AddonOption {
  id: string;
  /** i18n key, never raw text */
  labelKey: string;
  /** 'flat' = + absolute USD, 'percent' = + share of configurator subtotal */
  kind: 'flat' | 'percent';
  value: number;
}

export const PRICING_VERSION = '2026.08.1';

/* ------------------------------------------------------------------ */
/* 1. DELIVERY MODIFIERS (apply to every boost service)                */
/* ------------------------------------------------------------------ */
export const DELIVERY_MODIFIERS: Record<DeliverySpeed, number> = {
  normal: 0,
  express: 0.3,
  super_express: 0.6,
};

/* ------------------------------------------------------------------ */
/* 2. SHARK CARDS — digital codes, single card + radio group           */
/* ------------------------------------------------------------------ */
export const SHARK_CARDS = [
  { id: 'sc_100k', denomination: 100_000, price: 2.49, sheetSku: 'SHARK_100K' },
  { id: 'sc_500k', denomination: 500_000, price: 5.99, sheetSku: 'SHARK_500K' },
  { id: 'sc_1m', denomination: 1_000_000, price: 9.99, sheetSku: 'SHARK_1M' },
  { id: 'sc_2m', denomination: 2_000_000, price: 17.99, sheetSku: 'SHARK_2M' },
  { id: 'sc_4m', denomination: 4_000_000, price: 29.99, sheetSku: 'SHARK_4M' },
  { id: 'sc_8m', denomination: 8_000_000, price: 49.99, sheetSku: 'SHARK_8M' },
  { id: 'sc_10m', denomination: 10_000_000, price: 59.99, sheetSku: 'SHARK_10M' },
] as const;

/* ------------------------------------------------------------------ */
/* 3. LEVELING BOOST                                                   */
/* ------------------------------------------------------------------ */
/** PC: free slider 1..8000, marginal per-level tiers. */
export const LEVELING_PC = {
  minLevel: 1,
  maxLevel: 8000,
  basePrice: 1.5,
  tiers: [
    { upTo: 100, pricePerUnit: 0.05 },
    { upTo: 500, pricePerUnit: 0.03 },
    { upTo: 1000, pricePerUnit: 0.018 },
    { upTo: 3000, pricePerUnit: 0.011 },
    { upTo: 8000, pricePerUnit: 0.007 },
  ] as PriceTier[],
};

/** Consoles: slider hidden, fixed dropdown levels only. */
export const LEVELING_CONSOLE: Record<Platform, Record<number, number> | null> = {
  pc: null,
  ps: { 50: 6.99, 75: 9.49, 100: 11.99, 120: 14.49, 150: 17.99, 200: 23.99, 300: 34.99 },
  xbox: { 50: 6.99, 75: 9.49, 100: 11.99, 120: 14.49, 150: 17.99, 200: 23.99, 300: 34.99 },
};

/** 10 checkboxes shown for PC leveling. */
export const LEVELING_ADDONS_PC: AddonOption[] = [
  { id: 'pc_lvl_together', labelKey: 'addons.pc.together', kind: 'percent', value: -0.15 },
  { id: 'pc_lvl_unlock_all', labelKey: 'addons.pc.unlockAll', kind: 'flat', value: 4.99 },
  { id: 'pc_lvl_stats_max', labelKey: 'addons.pc.statsMax', kind: 'flat', value: 3.49 },
  { id: 'pc_lvl_heist_prep', labelKey: 'addons.pc.heistPrep', kind: 'flat', value: 5.99 },
  { id: 'pc_lvl_kd_reset', labelKey: 'addons.pc.kdReset', kind: 'flat', value: 2.99 },
  { id: 'pc_lvl_vehicles', labelKey: 'addons.pc.vehiclePack', kind: 'flat', value: 6.49 },
  { id: 'pc_lvl_weapons', labelKey: 'addons.pc.weaponPack', kind: 'flat', value: 3.99 },
  { id: 'pc_lvl_stealth', labelKey: 'addons.pc.stealthMode', kind: 'percent', value: 0.1 },
  { id: 'pc_lvl_priority', labelKey: 'addons.pc.priorityQueue', kind: 'percent', value: 0.12 },
  { id: 'pc_lvl_stream', labelKey: 'addons.pc.liveProgress', kind: 'flat', value: 1.99 },
];

/** A DIFFERENT set of 10 checkboxes for consoles. */
export const LEVELING_ADDONS_CONSOLE: AddonOption[] = [
  { id: 'con_lvl_together', labelKey: 'addons.console.together', kind: 'percent', value: -0.15 },
  { id: 'con_lvl_piloted', labelKey: 'addons.console.pilotedOnly', kind: 'flat', value: 4.49 },
  { id: 'con_lvl_crew', labelKey: 'addons.console.crewInvite', kind: 'flat', value: 1.49 },
  { id: 'con_lvl_night', labelKey: 'addons.console.nightSession', kind: 'flat', value: 2.99 },
  { id: 'con_lvl_casino', labelKey: 'addons.console.casinoWork', kind: 'flat', value: 5.49 },
  { id: 'con_lvl_cayo', labelKey: 'addons.console.cayoRuns', kind: 'flat', value: 7.99 },
  { id: 'con_lvl_rp_events', labelKey: 'addons.console.rpEvents', kind: 'flat', value: 3.29 },
  { id: 'con_lvl_slow', labelKey: 'addons.console.slowSafeMode', kind: 'percent', value: 0.08 },
  { id: 'con_lvl_priority', labelKey: 'addons.console.priorityQueue', kind: 'percent', value: 0.12 },
  { id: 'con_lvl_report', labelKey: 'addons.console.sessionReport', kind: 'flat', value: 1.49 },
];

/* ------------------------------------------------------------------ */
/* 4. MONEY BOOST                                                      */
/* ------------------------------------------------------------------ */
/** Consoles: fixed radio amounts (in millions). */
export const MONEY_CONSOLE: Record<number, number> = {
  10: 4.99,
  20: 8.49,
  50: 17.99,
  75: 24.49,
  100: 29.99,
  150: 41.99,
  200: 52.99,
  300: 74.99,
};

/**
 * PC: slider 100m .. 5000m with TIERED (progressive) discount.
 * Marginal model: each million inside a tier costs that tier's rate, so the
 * average price per million falls monotonically as the slider grows.
 */
export const MONEY_PC = {
  minMillions: 100,
  maxMillions: 5000,
  step: 50,
  tiers: [
    { upTo: 500, pricePerUnit: 0.09 },
    { upTo: 1000, pricePerUnit: 0.07 },
    { upTo: 2000, pricePerUnit: 0.055 },
    { upTo: 3500, pricePerUnit: 0.042 },
    { upTo: 5000, pricePerUnit: 0.033 },
  ] as PriceTier[],
  /** Multipliers for the PC-only selectors. */
  versionMultiplier: { legacy: 1, enhanced: 1.15 } as Record<GameVersion, number>,
  launcherMultiplier: { steam: 1, epic: 1, rockstar: 1 } as Record<Launcher, number>,
};

/* ------------------------------------------------------------------ */
/* 5. BOOSTER PAYOUT                                                   */
/* ------------------------------------------------------------------ */
/** Share of the service total paid to the executor. Backend-only value. */
export const BOOSTER_PAYOUT_SHARE = 0.5;

/** Rounding applied to every customer-facing total. */
export const roundMoney = (n: number): number => Math.round(n * 100) / 100;

/* ------------------------------------------------------------------ */
/* 6. PROMO CODES                                                      */
/* ------------------------------------------------------------------ */
/** Hard ceiling on any promo discount, as a share of the order total.
 *  Enforced for fixed_usd codes too, which the schema check cannot cover. */
export const MAX_DISCOUNT_SHARE = 0.2;

/** Smallest invoice CryptoBot will accept, in USD. */
export const MIN_INVOICE_USD = 0.5;

/** How long a code stays held for an unpaid checkout. Matches the CryptoBot
 *  invoice lifetime (expires_in: 3600 in lib/pricing/cryptobot.ts), so the
 *  code frees itself exactly when the invoice stops being payable. */
export const PROMO_HOLD_MINUTES = 60;
