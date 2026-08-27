import type { Config } from 'tailwindcss';

/** Synthwave / Vice City palette. All neon comes from box-shadow, not images. */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        night: '#0B0B16',
        neon: {
          pink: '#FF2A85',
          blue: '#00F0FF',
        },
        // --- NEONDRIVE design system §1.1/1.6 (new canonical tokens) ---
        // `night`/`neon` above are kept for back-compat (still used by
        // classes like `bg-night/70`, `border-neon-pink` across the project)
        // rather than a single destructive rename — see design doc §5, step
        // 3, page-by-page rebuild comes after this. `surface` DID need to
        // become this nested shape to get `bg-surface-2`/`-elevated`, so its
        // old flat `#141428` is gone; the new `DEFAULT` (`#12121F`) is close
        // enough in value that every existing `bg-surface/60` etc. still
        // looks right, it just now resolves through this object's DEFAULT.
        base: '#0B0B16', // same value as `night` — new canonical name going forward
        surface: { DEFAULT: '#12121F', 2: '#1A1A2B', elevated: '#20203A' },
        pink: { 400: '#FF5CA0', 500: '#FF2A85', 600: '#E01F72' },
        cyan: { 400: '#5CF6FF', 500: '#00F0FF', 600: '#00C4D1' },
        ink: { DEFAULT: '#F2F2F7', soft: '#A8A8C0', muted: '#6E6E8A' },
      },
      boxShadow: {
        // Every component below already pairs this with a solid `border-neon-*`
        // for the crisp edge — so this token only needs to supply the soft
        // bloom. The old version stacked THREE shadows (6px solid-ish core +
        // 18px @ .55 + 42px @ .25); that 42px/.25 outer layer is what turns
        // into a haze the moment it's applied to anything larger than a small
        // button (hero sections, full-width cards). One tight layer instead.
        'neon-pink': '0 0 14px 0 rgba(255,42,133,.35)',
        'neon-blue': '0 0 14px 0 rgba(0,240,255,.35)',
        'neon-inset': 'inset 0 0 10px rgba(0,240,255,.16)',
        // --- design system §1.6 — used by Button/Chip below ---
        'glow-pink': '0 0 0 1px rgba(255,42,133,.5), 0 0 16px rgba(255,42,133,.25)',
        'glow-pink-lg': '0 0 0 1px rgba(255,42,133,.7), 0 0 32px rgba(255,42,133,.35)',
        'glow-cyan': '0 0 0 1px rgba(0,240,255,.5), 0 0 16px rgba(0,240,255,.22)',
      },
      // §1.4: radii sm 8 · md 12 · lg 16 · xl 24 · pill 999 (pill already
      // covered by Tailwind's default `rounded-full`). This OVERRIDES the
      // default md/lg/xl scale (was 6/8/12px) — every existing `rounded-md`/
      // `-lg`/`-xl` in the project gets rounder. Flagging it because it's the
      // one token change here with a sitewide visual effect; check a page
      // after pulling this in.
      borderRadius: { sm: '8px', md: '12px', lg: '16px', xl: '24px' },
      backgroundImage: {
        'sunset-grid':
          'linear-gradient(180deg,#0B0B16 0%,#1B0B2A 55%,#3A0F3A 100%)',
        'scanlines': 'repeating-linear-gradient(0deg,rgba(255,255,255,.03) 0 1px,transparent 1px 3px)',
      },
      fontFamily: {
        // NOTE: Pricedown and any Rockstar-owned face are forbidden.
        // §1.2: Display = Unbounded (fallback Exo 2), Text = Inter (fallback
        // Manrope) — both loaded with the cyrillic subset in src/lib/fonts.ts.
        // Tailwind KEY names (`display`/`body`) are unchanged on purpose:
        // `font-display`/`font-body` are already used across ~20 files, so
        // only what they point to changed, not what they're called.
        display: ['var(--font-unbounded)', 'var(--font-exo2)', 'system-ui', 'sans-serif'],
        body: ['var(--font-inter)', 'var(--font-manrope)', 'system-ui', 'sans-serif'],
      },
      animation: {
        flicker: 'flicker 6s linear infinite',
      },
      keyframes: {
        flicker: {
          '0%,19%,21%,100%': { opacity: '1' },
          '20%': { opacity: '.72' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
