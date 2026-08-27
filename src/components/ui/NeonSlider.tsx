'use client';

/** Neon range slider. Emits only the numeric value; pricing stays server-side. */
export function NeonSlider({
	labelKey,
	min,
	max,
	step = 1,
	value,
	suffix = '',
	onChange,
	t = (k: string) => k,
}: {
	labelKey: string;
	min: number;
	max: number;
	step?: number;
	value: number;
	suffix?: string;
	onChange: (v: number) => void;
	t?: (key: string) => string;
}) {
	const progress = ((value - min) / (max - min)) * 100;

	return (
		<div>
			<div className="mb-2 flex items-baseline justify-between gap-4">
				<span className="font-display text-xs uppercase tracking-widest text-white/60">
					{t(labelKey)}
				</span>
				<span className="font-display text-lg text-neon-blue">
					{value.toLocaleString()}
					{suffix}
				</span>
			</div>

			<input
				type="range"
				min={min}
				max={max}
				step={step}
				value={value}
				onChange={(e) => onChange(Number(e.target.value))}
				aria-label={t(labelKey)}
				className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 outline-none
                   [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5
                   [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
                   [&::-webkit-slider-thumb]:bg-neon-pink [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(255,42,133,0.5)]"
				style={{
					background: `linear-gradient(90deg,#FF2A85 ${progress}%, rgba(255,255,255,.1) ${progress}%)`,
				}}
			/>

			<div className="mt-1 flex justify-between text-[10px] text-white/40">
				<span>
					{min.toLocaleString()}
					{suffix}
				</span>
				<span>
					{max.toLocaleString()}
					{suffix}
				</span>
			</div>
		</div>
	);
}
