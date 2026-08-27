'use client';

/**
 * NEONDRIVE design system §3.3 — Slider.
 *
 * "Никогда не существует сам по себе — только в связке": number input,
 * preset chips, and (when pricing has real tiers) tick marks + a status line
 * naming the current rate — this is that whole cluster in one component.
 *
 * Implementation note: this LOOKS fully custom (no native track/thumb
 * visible) but the actual interactive element is still a real
 * `<input type="range">`, made invisible and stretched over the custom
 * visuals. Mouse drag, touch drag, and keyboard (arrows, Home/End) all come
 * from the browser for free that way — reimplementing pointer-drag math by
 * hand is exactly the kind of thing that looks right and is subtly wrong in
 * ways that only show up with a mouse in hand, which I don't have here.
 * Only PageUp/PageDown are handled explicitly, because native browsers
 * don't agree on what "a bigger step" means for range inputs.
 */

import { useId, useMemo, useState, type KeyboardEvent } from 'react';

export interface SliderTier {
	/** Inclusive upper bound of this tier, same units as `value`. */
	upTo: number;
	pricePerUnit: number;
}

export interface SliderProps {
	label: string;
	min: number;
	max: number;
	step?: number;
	value: number;
	onChange: (value: number) => void;
	/** Appended after the number wherever it's displayed, e.g. "m". */
	suffix?: string;
	/** Presets shown as chips under the track. Defaults to tier boundaries when `tiers` is given, else [min, max]. */
	presets?: number[];
	/** When given: tick marks on the track + a line naming the active tier's rate (§3.3). */
	tiers?: SliderTier[];
	/** Custom formatting for the value/presets/ticks. Defaults to a locale-formatted number + suffix. */
	formatValue?: (v: number) => string;
}

function clamp(v: number, min: number, max: number) {
	return Math.min(max, Math.max(min, v));
}

export function Slider({
	label,
	min,
	max,
	step = 1,
	value,
	onChange,
	suffix = '',
	presets,
	tiers,
	formatValue,
}: SliderProps) {
	const inputId = useId();
	const [focused, setFocused] = useState(false);

	const format = formatValue ?? ((v: number) => `${v.toLocaleString('ru-RU')}${suffix}`);
	const safeValue = clamp(value, min, max);
	const percent = ((safeValue - min) / (max - min)) * 100;

	const resolvedPresets = useMemo(() => {
		if (presets) return presets;
		if (tiers && tiers.length) {
			const bounds = [min, ...tiers.map((tier) => tier.upTo)].filter((v) => v <= max);
			return Array.from(new Set(bounds));
		}
		return [min, max];
	}, [presets, tiers, min, max]);

	// §3.3: "стрелки ±1 шаг, PageUp/PageDown ±10, Home/End в края" — arrows
	// and Home/End are already exactly this for a native range input, no
	// code needed. PageUp/PageDown is the one browsers don't agree on, so
	// it's pinned here to exactly 10 steps rather than left to the UA.
	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === 'PageUp') {
			event.preventDefault();
			onChange(clamp(safeValue + step * 10, min, max));
		} else if (event.key === 'PageDown') {
			event.preventDefault();
			onChange(clamp(safeValue - step * 10, min, max));
		}
	};

	const onNumberInput = (raw: string) => {
		if (raw === '' || raw === '-') return;
		const n = Number(raw);
		if (Number.isNaN(n)) return;
		onChange(clamp(n, min, max));
	};

	return (
		<div>
			<div className="mb-2 flex items-baseline justify-between gap-4">
				<label htmlFor={inputId} className="font-display text-xs uppercase tracking-widest text-white/60">
					{label}
				</label>
				{/* §3.3: "Числовое поле справа от лейбла (можно ввести 3750 руками) + шаг стрелками" */}
				{/* Same fill/text pair as the primary (PAY) button — bg-pink-500 +
				    text-night — so this reads as an active input, not a disabled one. */}
				<input
					type="number"
					inputMode="numeric"
					min={min}
					max={max}
					step={step}
					value={safeValue}
					onChange={(event) => onNumberInput(event.target.value)}
					onBlur={(event) => onNumberInput(event.target.value)}
					className="w-24 rounded-md bg-pink-500 px-2 py-1 text-right text-sm font-semibold text-night shadow-glow-pink tabular-nums outline-none transition-colors hover:bg-pink-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500 focus-visible:outline-offset-2"
				/>
			</div>

			{/* Fixed-height interactive zone: visual track/ticks/thumb and the
			    real (invisible) range input all share this exact box via
			    `absolute inset-0`/`top-1/2`, so their coordinate math always
			    agrees regardless of content around them. */}
			<div className="relative pt-7">
				<div
					className="pointer-events-none absolute top-0 -translate-x-1/2 whitespace-nowrap rounded-md border border-pink-500/60 bg-surface-elevated px-2 py-0.5 text-xs font-semibold text-ink tabular-nums"
					style={{ left: `${percent}%` }}
				>
					{format(safeValue)}
				</div>

				<div className="relative h-4">
					<div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-surface-2">
						<div
							className="h-full rounded-full bg-gradient-to-r from-pink-500 to-cyan-500"
							style={{ width: `${percent}%` }}
						/>
					</div>

					{tiers?.map((tier) => {
						const tickPercent = ((clamp(tier.upTo, min, max) - min) / (max - min)) * 100;
						if (tickPercent <= 0.5 || tickPercent >= 99.5) return null;
						return (
							<div
								key={tier.upTo}
								aria-hidden="true"
								className="pointer-events-none absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-[var(--night)]/70"
								style={{ left: `${tickPercent}%` }}
							/>
						);
					})}

					{/* Purely decorative — the real thumb is inside the transparent
					    range input below. Mirrors its value and shows a focus ring
					    when that input is focused, since the real thumb is invisible
					    and so is any outline drawn directly on it. */}
					<div
						aria-hidden="true"
						className={[
							'pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-glow-pink',
							focused ? 'ring-2 ring-cyan-500 ring-offset-2 ring-offset-night' : '',
						].join(' ')}
						style={{ left: `${percent}%` }}
					/>

					<input
						id={inputId}
						type="range"
						min={min}
						max={max}
						step={step}
						value={safeValue}
						onChange={(event) => onChange(Number(event.target.value))}
						onKeyDown={onKeyDown}
						onFocus={() => setFocused(true)}
						onBlur={() => setFocused(false)}
						aria-valuetext={format(safeValue)}
						className="absolute inset-0 h-4 w-full cursor-pointer appearance-none bg-transparent opacity-0"
					/>
				</div>
			</div>

			{tiers && tiers.length > 0 && (
				<p className="mb-3 mt-2 text-xs text-ink-muted">{describeTier(safeValue, tiers, format)}</p>
			)}

			{/* §3.3: "Пресеты-чипы под треком" */}
			<div className="mt-3 flex flex-wrap gap-2">
				{resolvedPresets.map((preset) => (
					<button
						key={preset}
						type="button"
						onClick={() => onChange(preset)}
						className={[
							'rounded-md border px-3 py-1 text-xs font-medium transition-colors',
							'focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500 focus-visible:outline-offset-2',
							safeValue === preset
								? 'border-pink-500 bg-surface-2 text-ink shadow-glow-pink'
								: 'border-[var(--border-subtle)] bg-surface-2 text-ink-soft hover:bg-surface-elevated hover:text-ink',
						].join(' ')}
					>
						{format(preset)}
					</button>
				))}
			</div>
		</div>
	);
}

function formatRate(rate: number): string {
	return `$${rate < 0.01 ? rate.toFixed(3) : rate.toFixed(2)}`;
}

/**
 * §3.3: "Метки тиров прямо на треке ... чтобы прогрессивная скидка была
 * видна, а не заявлена текстом: «до 500M — $0.09 за 1M», «от 501M — $0.07 за
 * 1M»." The ticks (above) show *where* the breaks are; this names the rate
 * that's active right now and, if there's a cheaper tier ahead, where it starts.
 */
function describeTier(value: number, tiers: SliderTier[], format: (v: number) => string): string {
	let previousBound = 0;
	for (let i = 0; i < tiers.length; i++) {
		const tier = tiers[i];
		if (value <= tier.upTo) {
			const next = tiers[i + 1];
			if (!next) return `${formatRate(tier.pricePerUnit)} за единицу — минимальная ставка`;
			return `${formatRate(tier.pricePerUnit)} за единицу · с ${format(tier.upTo + 1)} ставка упадёт до ${formatRate(next.pricePerUnit)}`;
		}
		previousBound = tier.upTo;
	}
	const last = tiers[tiers.length - 1];
	return `${formatRate(last.pricePerUnit)} за единицу — минимальная ставка`;
}
