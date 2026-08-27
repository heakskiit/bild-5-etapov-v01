/**
 * SERVER-SIDE PRICE ENGINE — the only place a payable amount is produced.
 *
 * [CRITICAL] The frontend sends selected IDs only (product, platform, level,
 * amount, addon ids, delivery id). This module recomputes the total from
 * pricing.config.ts. Any `price` field arriving from the browser is discarded.
 */

import {
  BOOSTER_PAYOUT_SHARE,
  DELIVERY_MODIFIERS,
  LEVELING_ADDONS_CONSOLE,
  LEVELING_ADDONS_PC,
  LEVELING_CONSOLE,
  LEVELING_PC,
  MONEY_CONSOLE,
  MONEY_PC,
  PRICING_VERSION,
  SHARK_CARDS,
  roundMoney,
  type AddonOption,
  type DeliverySpeed,
  type PriceTier,
} from '@/../config/pricing.config';
import type { OrderSelection } from '@/types/order';

export interface PriceBreakdown {
  base: number;
  addonsFlat: number;
  addonsPercent: number;
  deliveryFee: number;
  total: number;
  boosterPayout: number;
  pricingVersion: string;
}

/** Marginal tier walk: sum(portion in tier * tier rate). */
export function tieredPrice(units: number, tiers: PriceTier[]): number {
  let remaining = units;
  let previousBound = 0;
  let sum = 0;

  for (const tier of tiers) {
    if (remaining <= 0) break;
    const tierWidth = tier.upTo - previousBound;
    const consumed = Math.min(remaining, tierWidth);
    sum += consumed * tier.pricePerUnit;
    remaining -= consumed;
    previousBound = tier.upTo;
  }

  if (remaining > 0) {
    // Slider value above the last bound must never be silently free.
    throw new PricingError('OUT_OF_RANGE', `Value ${units} exceeds configured tiers`);
  }
  return sum;
}

export class PricingError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'PricingError';
  }
}

function resolveAddons(selection: OrderSelection): AddonOption[] {
  const catalogue =
    selection.platform === 'pc' ? LEVELING_ADDONS_PC : LEVELING_ADDONS_CONSOLE;
  return (selection.addonIds ?? []).map((id) => {
    const found = catalogue.find((a) => a.id === id);
    if (!found) throw new PricingError('UNKNOWN_ADDON', `Addon ${id} not valid for this platform`);
    return found;
  });
}

function baseForSelection(selection: OrderSelection): number {
  switch (selection.product) {
    case 'shark_card': {
      const card = SHARK_CARDS.find((c) => c.id === selection.variantId);
      if (!card) throw new PricingError('UNKNOWN_VARIANT', 'Shark card denomination not found');
      return card.price;
    }

    case 'leveling': {
      if (selection.platform === 'pc') {
        const level = selection.level ?? 0;
        if (level < LEVELING_PC.minLevel || level > LEVELING_PC.maxLevel) {
          throw new PricingError('OUT_OF_RANGE', 'Level outside 1..8000');
        }
        return LEVELING_PC.basePrice + tieredPrice(level, LEVELING_PC.tiers);
      }
      const table = LEVELING_CONSOLE[selection.platform];
      const price = table?.[selection.level ?? -1];
      if (price === undefined) {
        throw new PricingError('UNKNOWN_VARIANT', 'Console level must be one of the fixed options');
      }
      return price;
    }

    case 'money': {
      if (selection.platform === 'pc') {
        const millions = selection.amountMillions ?? 0;
        if (
          millions < MONEY_PC.minMillions ||
          millions > MONEY_PC.maxMillions ||
          millions % MONEY_PC.step !== 0
        ) {
          throw new PricingError('OUT_OF_RANGE', 'PC money amount invalid');
        }
        const raw = tieredPrice(millions, MONEY_PC.tiers);
        const version = MONEY_PC.versionMultiplier[selection.gameVersion ?? 'legacy'];
        const launcher = MONEY_PC.launcherMultiplier[selection.launcher ?? 'steam'];
        if (version === undefined || launcher === undefined) {
          throw new PricingError('UNKNOWN_VARIANT', 'Unknown PC version/launcher');
        }
        return raw * version * launcher;
      }
      const price = MONEY_CONSOLE[selection.amountMillions ?? -1];
      if (price === undefined) {
        throw new PricingError('UNKNOWN_VARIANT', 'Console money amount must be a fixed option');
      }
      return price;
    }

    default:
      throw new PricingError('UNKNOWN_PRODUCT', `Unsupported product ${selection.product}`);
  }
}

export function calculatePrice(selection: OrderSelection): PriceBreakdown {
  const base = baseForSelection(selection);

  const addons = selection.product === 'shark_card' ? [] : resolveAddons(selection);
  const addonsFlat = addons
    .filter((a) => a.kind === 'flat')
    .reduce((sum, a) => sum + a.value, 0);
  const percentShare = addons
    .filter((a) => a.kind === 'percent')
    .reduce((sum, a) => sum + a.value, 0);
  const addonsPercent = base * percentShare;

  const configuratorSubtotal = Math.max(base + addonsFlat + addonsPercent, 0);

  const delivery: DeliverySpeed =
    selection.product === 'shark_card' ? 'normal' : selection.delivery ?? 'normal';
  const modifier = DELIVERY_MODIFIERS[delivery];
  if (modifier === undefined) throw new PricingError('UNKNOWN_DELIVERY', 'Bad delivery speed');
  const deliveryFee = configuratorSubtotal * modifier;

  const total = roundMoney(configuratorSubtotal + deliveryFee);

  return {
    base: roundMoney(base),
    addonsFlat: roundMoney(addonsFlat),
    addonsPercent: roundMoney(addonsPercent),
    deliveryFee: roundMoney(deliveryFee),
    total,
    // Codes are stock, not labour: no booster payout.
    boosterPayout:
      selection.product === 'shark_card' ? 0 : roundMoney(total * BOOSTER_PAYOUT_SHARE),
    pricingVersion: PRICING_VERSION,
  };
}
