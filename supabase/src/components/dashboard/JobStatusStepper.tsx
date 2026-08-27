'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { dig, type Dict } from '@/lib/i18n/pick';
import type { OrderStatus } from '@/types/order';

/** Forward-only transitions a modder can trigger from a given status. */
const NEXT_STEPS: Partial<Record<OrderStatus, OrderStatus[]>> = {
	action_required: ['in_progress'],
	in_progress: ['action_required', 'completed'],
};

const CHIP: Record<string, string> = {
	action_required: 'border-neon-pink text-pink-400 shadow-neon-pink',
	in_progress: 'border-neon-blue text-neon-blue shadow-neon-blue',
	completed: 'border-emerald-400/60 text-emerald-300',
};

export function JobStatusStepper({
	orderId,
	currentStatus,
	messages,
}: {
	orderId: string;
	currentStatus: OrderStatus;
	messages: Dict;
}) {
	const t = useMemo(() => (key: string, vars?: Record<string, string | number>) => dig(messages, key, vars), [messages]);
	const router = useRouter();
	const [status, setStatus] = useState(currentStatus);
	const [busy, setBusy] = useState<OrderStatus | null>(null);
	const [error, setError] = useState(false);

	const advance = async (next: OrderStatus) => {
		setBusy(next);
		setError(false);
		try {
			const res = await fetch(`/api/dashboard/jobs/${orderId}/status`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ status: next }),
			});
			if (!res.ok) {
				setError(true);
				return;
			}
			setStatus(next);
			router.refresh();
		} catch {
			setError(true);
		} finally {
			setBusy(null);
		}
	};

	const options = NEXT_STEPS[status] ?? [];

	return (
		<div className="space-y-3">
			<span className={`inline-block rounded-full border px-3 py-1 text-[11px] ${CHIP[status] ?? 'border-white/20 text-white/50'}`}>
				{t(`dashboard.status.${status}`)}
			</span>

			{options.length > 0 && (
				<div className="flex flex-wrap gap-2">
					{options.map((next) => (
						<Button key={next} variant="secondary" size="sm" onClick={() => advance(next)} loading={busy === next}>
							{t(`jobs.moveTo.${next}`)}
						</Button>
					))}
				</div>
			)}

			{error && <p className="text-xs text-pink-400">{t('jobs.statusError')}</p>}
		</div>
	);
}
