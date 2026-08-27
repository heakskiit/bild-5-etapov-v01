'use client';

import { useRef } from 'react';
import type { KeyboardEvent } from 'react';

/**
 * NEONDRIVE design system §3.1 — Chip selector.
 *
 * "Единый компонент для всех сегментированных выборов. Сейчас на разных
 * страницах три разных визуальных решения — их нужно свести к одному."
 * That's PlatformSelector, RadioGroup, and Dropdown today — this is meant to
 * become the one they all become. Swapping those call sites over is a
 * separate pass (they're used across BoostConfigurator, SharkCardConfigurator,
 * etc.); this file is just the new component per §5 step 1.
 *
 * The doc specifies `role="radiogroup"` + arrow-key switching explicitly —
 * that ARIA pattern is for when you're NOT using native <input type="radio">
 * (which gets arrow-key nav for free); building it out of <button>s is what
 * makes the manual keydown handler below necessary, not optional.
 */

export interface ChipOption<T extends string | number = string> {
	value: T;
	label: string;
	disabled?: boolean;
	/** e.g. "Недоступно для Xbox" — required if `disabled` is true (§3.1). */
	disabledReason?: string;
}

export interface ChipGroupProps<T extends string | number = string> {
	/** Accessible name for the group — not rendered, use a separate visible label/legend if you need one on screen. */
	label: string;
	options: ChipOption<T>[];
	value: T;
	onChange: (value: T) => void;
	className?: string;
}

export function ChipGroup<T extends string | number = string>({
	label,
	options,
	value,
	onChange,
	className = '',
}: ChipGroupProps<T>) {
	const refs = useRef<Array<HTMLButtonElement | null>>([]);

	const focusNextEnabled = (fromIndex: number, dir: 1 | -1) => {
		if (options.every((o) => o.disabled)) return;
		let i = fromIndex;
		for (let step = 0; step < options.length; step++) {
			i = (i + dir + options.length) % options.length;
			if (!options[i].disabled) {
				refs.current[i]?.focus();
				onChange(options[i].value);
				return;
			}
		}
	};

	const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
		// §3.1: "переключение стрелками клавиатуры" — right/down and
		// left/up both move focus, matching the native radiogroup pattern.
		if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
			event.preventDefault();
			focusNextEnabled(index, 1);
		} else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
			event.preventDefault();
			focusNextEnabled(index, -1);
		}
	};

	const firstEnabledIndex = options.findIndex((o) => !o.disabled);

	return (
		<div role="radiogroup" aria-label={label} className={`flex flex-wrap gap-2 ${className}`}>
			{options.map((option, index) => {
				const selected = option.value === value;
				// Roving tabindex: only one stop in the group's tab order at a
				// time (the selected chip, or the first enabled one if nothing's
				// selected yet) — arrow keys move both focus and selection
				// between the rest, same as native radios.
				const tabIndex = selected ? 0 : index === firstEnabledIndex && !options.some((o) => o.value === value) ? 0 : -1;

				return (
					<button
						key={String(option.value)}
						ref={(el) => {
							refs.current[index] = el;
						}}
						type="button"
						role="radio"
						aria-checked={selected}
						aria-disabled={option.disabled || undefined}
						title={option.disabled ? option.disabledReason : undefined}
						tabIndex={tabIndex}
						disabled={option.disabled}
						onKeyDown={(event) => onKeyDown(event, index)}
						onClick={() => !option.disabled && onChange(option.value)}
						className={[
							// min-h-11 (44px): mobile tap-target floor used across the
							// doc's control states, not spelled out per-chip but
							// consistent with §2.1's "минимальная область нажатия 44×44".
							'inline-flex min-h-11 items-center gap-1.5 rounded-md border px-4 text-sm font-medium',
							'transition-all duration-150 ease-[cubic-bezier(.2,.8,.2,1)]',
							'focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500 focus-visible:outline-offset-2',
							option.disabled
								? 'cursor-not-allowed border-[var(--border-subtle)] bg-surface-2 text-ink-muted opacity-40'
								: selected
									? 'border-pink-500 bg-surface-2 font-semibold text-ink shadow-glow-pink'
									: 'border-[var(--border-subtle)] bg-surface-2 text-ink-soft hover:bg-surface-elevated hover:text-ink',
						].join(' ')}
					>
						{/* Selected state also gets a checkmark, not just the pink
						    border/glow — §3.1: "Плюс галочка для тех, кто не
						    различает цвет." */}
						{selected && !option.disabled && <CheckIcon />}
						{option.label}
					</button>
				);
			})}
		</div>
	);
}

function CheckIcon() {
	return (
		<svg className="h-3.5 w-3.5 shrink-0 text-pink-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
			<path
				fillRule="evenodd"
				d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.8 6.8-6.8a1 1 0 0 1 1.4 0Z"
				clipRule="evenodd"
			/>
		</svg>
	);
}
