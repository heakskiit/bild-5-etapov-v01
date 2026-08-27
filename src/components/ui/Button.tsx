'use client';

import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { base, sizeStyles, variantStyles, buttonClasses, type Variant, type Size } from './buttonStyles';

/**
 * NEONDRIVE design system §2 — Button.
 *
 * This is the components/ui/button.tsx skeleton from §2.2, completed: the
 * doc's code block stopped mid-`ghost` variant and never wrote `link` or
 * `danger` (built here from the §2 table instead), and only sketched the
 * `styles` object — not the component that assembles it with a loading
 * state, a disabled reason, or ref forwarding.
 *
 * The actual class-string logic (base/sizeStyles/variantStyles/buttonClasses)
 * lives in ./buttonStyles.ts, not here — see that file's header comment for
 * why: this file is `'use client'`, and Server Components (Hero.tsx,
 * CtaStrip.tsx) need to call `buttonClasses()` directly to style a <Link>,
 * which they can't do if the function is exported from a client module.
 *
 * One `primary` per meaningful block (§2.1) — that's a usage convention,
 * this component doesn't enforce it.
 *
 * Need just the class string (styling a <Link> from a Server Component)?
 * Import `buttonClasses` from './buttonStyles' directly, not from here —
 * re-exporting it from this file wouldn't actually fix anything, since a
 * 'use client' file makes every one of its exports a client reference for
 * whoever imports them, re-export or not.
 */

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: Variant;
	size?: Size;
	loading?: boolean;
	/** Shown next to the spinner while `loading` is true. */
	loadingText?: string;
	/**
	 * Why the button is disabled, e.g. "Выберите платформу" (§2.2: "Disabled
	 * всегда объясняет причину"). This covers the tooltip half (native
	 * `title`); the doc also wants it readable without hovering — render
	 * that copy next to the button yourself wherever there's room, since
	 * that placement is page-specific.
	 */
	disabledReason?: string;
	children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
	{
		variant = 'primary',
		size = 'md',
		loading = false,
		loadingText = 'Обработка…',
		disabledReason,
		disabled,
		className = '',
		children,
		type = 'button',
		...rest
	},
	ref,
) {
	const isDisabled = Boolean(disabled) || loading;

	return (
		<button
			ref={ref}
			type={type}
			disabled={isDisabled}
			// §2.2: "Loading блокирует повторный клик — иначе двойной инвойс в
			// CryptoBot." `disabled` on the element itself is what actually
			// stops the second click; aria-busy just announces why.
			aria-busy={loading || undefined}
			title={!loading && disabled ? disabledReason : undefined}
			className={[
				base,
				variant !== 'link' ? sizeStyles[size] : '',
				variantStyles[variant],
				loading ? 'relative' : '',
				className,
			]
				.filter(Boolean)
				.join(' ')}
			{...rest}
		>
			{loading ? (
				<>
					{/* §2.2: "ширина фиксирована" — the real children stay in the
					    layout (via `invisible`, not `hidden`) so the button keeps
					    its normal width; the spinner+text render on top of them. */}
					<span className="invisible inline-flex items-center gap-2">{children}</span>
					<span className="absolute inset-0 flex items-center justify-center gap-2">
						<Spinner />
						{loadingText}
					</span>
				</>
			) : (
				children
			)}
		</button>
	);
});

function Spinner() {
	return (
		<svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
			<path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
		</svg>
	);
}
