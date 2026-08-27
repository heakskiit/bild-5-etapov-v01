'use client';

/**
 * NEONDRIVE design system §3.2 — Option card (replaces native checkboxes).
 *
 * "Самый заметный признак незавершённости — нативные системные квадраты."
 * This is the fix: a custom 20×20 box, the whole card clickable (min-height
 * 56px), the price delta on the right, and an optional hint tooltip for
 * options whose name alone doesn't explain what they do.
 *
 * Mutual exclusion ("Взаимоисключающие опции блокируют друг друга с
 * пояснением") is supported at the prop level — `disabled` + `disabledReason`
 * — but which specific addons should exclude which others isn't something
 * this component can decide; that's a real business rule, not a styling
 * question, and none of the current addon data encodes it (see the note in
 * AddonGrid.tsx). Wire `disabled`/`disabledReason` in from the caller once
 * that rule exists.
 */

export interface OptionCardProps {
	id: string;
	label: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
	/** Right-aligned price delta, e.g. "+$3.00" or "−15%" (§3.2). */
	priceLabel?: string;
	/** Shown behind a question-mark icon for non-obvious options, e.g. "K/D ratio cleanup". */
	hint?: string;
	disabled?: boolean;
	/** Required in practice when `disabled` is true — the doc wants the reason visible, not just an inert control. */
	disabledReason?: string;
}

export function OptionCard({
	id,
	label,
	checked,
	onChange,
	priceLabel,
	hint,
	disabled = false,
	disabledReason,
}: OptionCardProps) {
	const isDiscount = priceLabel?.trim().startsWith('-') || priceLabel?.trim().startsWith('−');

	return (
		<label
			htmlFor={id}
			title={disabled ? disabledReason : undefined}
			className={[
				// min-h-14 = 56px (§3.2: "Высота минимум 56px"), whole card
				// clickable because the checkbox+box+label all live inside one
				// <label> — clicking anywhere in it toggles the input.
				'flex min-h-14 cursor-pointer items-center gap-3 rounded-md border px-3 py-2',
				'transition-all duration-150 ease-[cubic-bezier(.2,.8,.2,1)]',
				'focus-within:outline focus-within:outline-2 focus-within:outline-cyan-500 focus-within:outline-offset-2',
				disabled
					? 'cursor-not-allowed border-[var(--border-subtle)] bg-surface-2 opacity-40'
					: checked
						? 'border-pink-500 bg-surface-2 shadow-glow-pink'
						: 'border-[var(--border-default)] bg-surface-2 hover:border-white/30',
			].join(' ')}
		>
			<input
				id={id}
				type="checkbox"
				checked={checked}
				disabled={disabled}
				onChange={(event) => onChange(event.target.checked)}
				className="sr-only"
			/>

			{/* §3.2: "Кастомный бокс 20×20, радиус 6 ... заливка pink, галочка
			    цветом #0B0B16, рамка карточки pink, --glow-pink-sm" — the box
			    itself; the card's own border+glow (above) covers the second half. */}
			<span
				aria-hidden="true"
				className={[
					'flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border transition-colors',
					checked && !disabled ? 'border-pink-500 bg-pink-500' : 'border-[var(--border-default)]',
				].join(' ')}
			>
				{checked && !disabled && <CheckIcon />}
			</span>

			<span className="flex-1 text-sm text-ink-soft">{label}</span>

			{hint && (
				// A <button>, not a <span>, specifically so it doesn't toggle the
				// checkbox when tapped — nested interactive controls inside a
				// <label> don't trigger the label's own default activation.
				<span className="group relative shrink-0">
					<button type="button" aria-label={hint} className="flex h-4 w-4 items-center justify-center text-ink-muted hover:text-ink-soft">
						<HintIcon />
					</button>
					<span
						role="tooltip"
						className="pointer-events-none absolute bottom-full right-0 z-10 mb-2 hidden w-48 rounded-md border border-[var(--border-default)] bg-surface-elevated p-2 text-xs leading-snug text-ink-soft shadow-[var(--shadow-2)] group-hover:block group-focus-within:block"
					>
						{hint}
					</span>
				</span>
			)}

			{priceLabel && (
				<span
					className={`shrink-0 text-xs font-semibold tabular-nums ${isDiscount ? 'text-[var(--success)]' : 'text-ink-soft'}`}
				>
					{priceLabel}
				</span>
			)}
		</label>
	);
}

function CheckIcon() {
	return (
		<svg className="h-3.5 w-3.5 text-[var(--text-on-accent)]" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
			<path
				fillRule="evenodd"
				d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.8 6.8-6.8a1 1 0 0 1 1.4 0Z"
				clipRule="evenodd"
			/>
		</svg>
	);
}

function HintIcon() {
	return (
		<svg viewBox="0 0 20 20" fill="currentColor" className="h-full w-full" aria-hidden="true">
			<path
				fillRule="evenodd"
				d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM8.94 6.94a1.5 1.5 0 1 1 2.12 2.12c-.4.4-.56.9-.56 1.44v.25a.75.75 0 0 1-1.5 0v-.25c0-.9.34-1.68.94-2.28a.5.5 0 1 0-.85-.35.75.75 0 0 1-1.5 0 2 2 0 0 1 1.35-1.93ZM10 14.75a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8Z"
				clipRule="evenodd"
			/>
		</svg>
	);
}
