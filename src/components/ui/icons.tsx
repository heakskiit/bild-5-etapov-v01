/**
 * In-house SVG icon set. Everything here is drawn by us — no third-party or
 * rights-encumbered artwork enters the bundle.
 */

type IconProps = { className?: string };

export const ShieldIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z" strokeLinejoin="round" />
    <path d="m8.5 12 2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const BoltIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" strokeLinejoin="round" />
  </svg>
);

export const CoinIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <ellipse cx="12" cy="7" rx="7" ry="3" />
    <path d="M5 7v10c0 1.7 3.1 3 7 3s7-1.3 7-3V7" />
    <path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
  </svg>
);

export const PalmIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M12 21V9" strokeLinecap="round" />
    <path d="M12 9C9 6 6 6 4 8c3-4 6-4 8-2 2-2 5-2 8 2-2-2-5-2-8 1Z" strokeLinejoin="round" />
  </svg>
);

export const ClockIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const DiscordIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path
      d="M8 6.5c2.6-1 5.4-1 8 0M6.5 8.5c-2 3-2.3 6-1.7 8.3 1.6 1.2 3.2 1.9 4.7 2.2l.9-1.6M17.5 8.5c2 3 2.3 6 1.7 8.3-1.6 1.2-3.2 1.9-4.7 2.2l-.9-1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <ellipse cx="9" cy="13" rx="1.3" ry="1.6" fill="currentColor" stroke="none" />
    <ellipse cx="15" cy="13" rx="1.3" ry="1.6" fill="currentColor" stroke="none" />
  </svg>
);

/**
 * §4.2 point 9: "иконки принимаемых криптовалют" in the footer. These are
 * generic ticker-in-a-circle glyphs, not reproductions of each network's
 * official brand mark — deliberate, both to stay clear of any trademark
 * question and because a hand-drawn outline set reads as one family
 * instead of four mismatched brand kits.
 *
 * The four picked (BTC/ETH/USDT/TON) are what CryptoBot Pay is best known
 * for supporting, but cryptobot.ts creates the invoice with
 * `currency_type: 'fiat'` and no fixed asset list — the payer picks from
 * whatever CryptoBot itself currently offers. Verify this set against your
 * actual CryptoBot dashboard before shipping; swap/add glyphs as needed.
 */
export const BtcIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
    <circle cx="12" cy="12" r="9" />
    <path
      d="M9.5 7.5h4a2 2 0 0 1 0 4h-4m0 0h4.5a2 2 0 0 1 0 4h-4.5m0-8v-1.5m0 9.5v1.5m2.5-11v-1.5m0 9.5v1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const EthIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 5.5 8 12l4 2.3L16 12l-4-6.5Z" strokeLinejoin="round" />
    <path d="M8 13.3 12 18.5l4-5.2-4 2.3-4-2.3Z" strokeLinejoin="round" />
  </svg>
);

export const UsdtIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 8.5h8M12 8.5v3M9.5 12.8c0 1 1.1 1.7 2.5 1.7s2.5-.7 2.5-1.7-1.1-1.5-2.5-1.5-2.5-.5-2.5-1.5S10.6 8 12 8s2.5.5 2.5 1.3" strokeLinecap="round" />
    <path d="M12 14.5v3.5" strokeLinecap="round" />
  </svg>
);

export const TonIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M7 8h10l-5 9-5-9Z" strokeLinejoin="round" />
    <path d="M7 8h10" strokeLinecap="round" />
  </svg>
);
