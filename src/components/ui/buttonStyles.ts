/**
 * Pure class-string generation for the Button look — deliberately in its
 * own file, with no `'use client'`, separate from Button.tsx.
 *
 * Button.tsx *is* `'use client'` (it needs state for the loading spinner),
 * and in the RSC model that directive marks every export of that module as
 * a client reference for anyone importing it — including a plain function
 * like `buttonClasses` that returns a string and touches no hooks. A Server
 * Component can render `<Button>` as JSX (that's the point of the client
 * boundary), but it can't *call* `buttonClasses()` imported from Button.tsx
 * — that throws "Attempted to call buttonClasses() from the server but
 * buttonClasses is on the client." Hero.tsx and CtaStrip.tsx are Server
 * Components styling a `<Link>` with this exact function, so it has to live
 * somewhere with no client boundary at all. This file is that somewhere.
 */

export type Variant = 'primary' | 'secondary' | 'ghost' | 'link' | 'danger';
export type Size = 'sm' | 'md' | 'lg';

export const base =
	'inline-flex items-center justify-center gap-2 rounded-md font-semibold ' +
	'transition-all duration-150 ease-[cubic-bezier(.2,.8,.2,1)] select-none ' +
	'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ' +
	'disabled:opacity-40 disabled:pointer-events-none disabled:cursor-not-allowed';

// §2.1: sm 36/px-16, md 44/px-20, lg 56/px-28. Tailwind spacing 4=16px,
// 5=20px, 7=28px, so px-4/px-5/px-7 land exactly on those paddings.
export const sizeStyles: Record<Size, string> = {
	sm: 'h-9 px-4 text-sm uppercase tracking-wide',
	md: 'h-11 px-5 text-base',
	lg: 'h-14 px-7 text-lg',
};

export const variantStyles: Record<Variant, string> = {
	// `text-base` here is deliberate, not a leftover font-size class: this
	// project's tailwind.config.ts also defines `colors.base` (#0B0B16), so
	// Tailwind emits TWO separate `.text-base` rules — font-size AND color —
	// and both apply since they're different properties. That's how this
	// variant gets its on-accent text color straight from the §2 table
	// ("текст #0B0B16") without a second class. Confirmed by compiling it.
	primary:
		'bg-pink-500 text-base shadow-glow-pink hover:bg-pink-600 ' +
		'hover:shadow-glow-pink-lg active:translate-y-px focus-visible:outline-cyan-500',
	secondary:
		'border border-cyan-500/60 text-cyan-500 hover:bg-cyan-500/10 ' +
		'hover:shadow-glow-cyan active:translate-y-px focus-visible:outline-pink-500',
	ghost: 'text-ink-soft hover:bg-white/5 hover:text-ink focus-visible:outline-cyan-500',
	// Not in the doc's code block (it was cut off before these two) — built
	// from the §2 table: "текст cyan, подчёркивание на hover" for Link,
	// "рамка --danger, текст --danger" for Danger. `danger` isn't a Tailwind
	// color token in this project (only a CSS var, --danger, with no
	// <alpha-value> hookup) — border/text work fine as `border-[var(--danger)]`,
	// but a *tinted* hover background needs opacity, and Tailwind can't inject
	// an alpha channel into an arbitrary var() reference (confirmed by
	// compiling `bg-[var(--danger)]/10` — it silently produces no rule at
	// all). So the hover tint below is a literal rgba() mirroring #FF4D4D
	// instead of a var() + opacity modifier.
	link: 'h-auto rounded-none p-0 font-normal text-cyan-500 underline-offset-4 hover:underline focus-visible:outline-cyan-500',
	danger:
		'border border-[var(--danger)] text-[var(--danger)] hover:bg-[rgba(255,77,77,0.1)] focus-visible:outline-[var(--danger)]',
};

/**
 * For places that need this exact look on something that isn't a <button> —
 * the hero/CTA-strip primary actions are real navigation (<Link>), and a
 * <button onClick={() => router.push(...)}> would be worse for SEO, right-
 * click-open-in-new-tab, and crawling than just... using a link. Safe to
 * call from both Server and Client Components — that's the whole reason
 * this file exists.
 */
export function buttonClasses(variant: Variant = 'primary', size: Size = 'md'): string {
	return [base, variant !== 'link' ? sizeStyles[size] : '', variantStyles[variant]].filter(Boolean).join(' ');
}
