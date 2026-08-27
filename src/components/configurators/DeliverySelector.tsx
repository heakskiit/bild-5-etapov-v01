'use client';

import { DELIVERY_MODIFIERS, type DeliverySpeed } from '@/../config/pricing.config';

const LABELS: Record<DeliverySpeed, string> = {
	normal: 'configurator.deliveryNormal',
	express: 'configurator.deliveryExpress',
	super_express: 'configurator.deliverySuperExpress',
};

/**
 * Delivery modifier picker, shared by every boost configurator.
 * Percentages come from the config so a price change never touches this file.
 */
export function DeliverySelector({
	value,
	onChange,
	t = (k: string) => k,
}: {
	value: DeliverySpeed;
	onChange: (v: DeliverySpeed) => void;
	t?: (key: string) => string;
}) {
	return (
		<fieldset>
			<legend className="mb-2 font-display text-xs uppercase tracking-widest text-white/60">
				{t('configurator.delivery')}
			</legend>
			<div className="grid gap-2 sm:grid-cols-3">
				{(Object.keys(DELIVERY_MODIFIERS) as DeliverySpeed[]).map((speed) => {
					const active = value === speed;
					return (
						<label
							key={speed}
							className={`flex min-h-[2.75rem] cursor-pointer items-center justify-center text-balance rounded-lg border px-3 py-2 text-center text-sm transition ${
								active
									? 'border-[#FF2A85] bg-[#1a1a2e] text-white shadow-[0_0_12px_rgba(255,42,133,0.4)]'
									: 'border-gray-800 text-white/60 hover:border-white/30'
							}`}
						>
							<input
								type="radio"
								name="delivery"
								className="sr-only"
								checked={active}
								onChange={() => onChange(speed)}
							/>
							{t(LABELS[speed])}
						</label>
					);
				})}
			</div>
		</fieldset>
	);
}
