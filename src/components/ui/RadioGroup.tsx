'use client';

/** Generic neon radio group used for denominations, amounts, versions, launchers. */
export function RadioGroup<T extends string | number>({
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
	return (
		<fieldset>
			<legend className="mb-2 font-display text-xs uppercase tracking-widest text-white/60">
				{t(labelKey)}
			</legend>
			<div className="flex flex-wrap gap-2">
				{options.map((option) => {
					const active = option === value;
					return (
						<label
							key={String(option)}
							className={`min-w-[5.5rem] cursor-pointer text-balance rounded-lg border px-3 py-2 text-center text-sm capitalize transition ${
								active
									? 'border-[#FF2A85] bg-[#1a1a2e] text-white shadow-[0_0_12px_rgba(255,42,133,0.4)]'
									: 'border-gray-800 text-white/60 hover:border-white/30'
							}`}
						>
							<input
								type="radio"
								name={labelKey}
								className="sr-only"
								checked={active}
								onChange={() => onChange(option)}
							/>
							{format(option)}
						</label>
					);
				})}
			</div>
		</fieldset>
	);
}
