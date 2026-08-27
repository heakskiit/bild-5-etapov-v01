'use client';

/** Native select — used for console levels, where free input is not allowed. */
export function Dropdown<T extends string | number>({
	labelKey,
	options,
	value,
	onChange,
	format = (v: T) => String(v),
	t = (k: string) => k,
}: {
	labelKey: string;
	options: readonly T[];
	value: T;
	onChange: (v: T) => void;
	format?: (v: T) => string;
	t?: (key: string) => string;
}) {
	const numeric = typeof value === 'number';

	return (
		<label className="block">
			<span className="mb-2 block font-display text-xs uppercase tracking-widest text-white/60">
				{t(labelKey)}
			</span>
			<select
				value={String(value)}
				onChange={(e) => onChange((numeric ? Number(e.target.value) : e.target.value) as T)}
				className="w-full rounded-lg border border-gray-800 bg-night px-3 py-3 text-sm text-white outline-none focus:border-[#FF2A85] focus:shadow-[0_0_12px_rgba(255,42,133,0.4)]"
			>
				{options.map((option) => (
					<option key={String(option)} value={String(option)}>
						{format(option)}
					</option>
				))}
			</select>
		</label>
	);
}
