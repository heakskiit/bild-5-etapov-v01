import type {
  DeliverySpeed,
  GameVersion,
  Launcher,
  Platform,
} from '@/../config/pricing.config';

export type ProductKind = 'shark_card' | 'leveling' | 'money';

export type OrderStatus =
  | 'awaiting_payment'
  | 'action_required'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'refunded';

/**
 * The ONLY shape the browser may submit to /api/checkout.
 * Notice there is no price field: prices are derived server-side.
 */
export interface OrderSelection {
  product: ProductKind;
  platform: Platform;
  /** shark_card denomination id */
  variantId?: string;
  /** leveling target level (slider on PC, dropdown on console) */
  level?: number;
  /** money boost amount in millions */
  amountMillions?: number;
  gameVersion?: GameVersion;
  launcher?: Launcher;
  addonIds?: string[];
  delivery?: DeliverySpeed;
  locale?: string;
}

export interface Order {
  id: string;
  publicId: string;
  userId: string;
  status: OrderStatus;
  selection: OrderSelection;
  totalUsd: number;
  boosterPayoutUsd: number;
  pricingVersion: string;
  invoiceId?: string;
  paidAt?: string;
  createdAt: string;
}
