'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { dig, type Dict } from '@/lib/i18n/pick';
import type { OrderSelection } from '@/types/order';

interface QueueOrder {
	id: string;
	public_id: string;
	status: string;
	selection: OrderSelection;
	contact_handle: string | null;
	created_at: string;
}

export function QueueRow({
	order,
	locale,
	messages,
	claimable,
}: {
	order: QueueOrder;
	locale: string;
	messages: Dict;
	claimable: boolean;
}) {
	const t = useMemo(() => (key: string, vars?: Record<string, string | number>) => dig(messages, key, vars), [messages]);
	const router = useRouter();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState(false);

	const claim = async () => {
		setBusy(true);
		setError(false);
		try {
			const res = await fetch('/api/dashboard/queue/claim', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ orderId: order.public_id }),
			});
			if (!res.ok) {
				setError(true);
				setBusy(false);
				return;
			}
			router.push(`/${locale}/dashboard/jobs/${order.public_id}`);
			router.refresh();
		} catch {
			setError(true);
			setBusy(false);
		}
	};

	const describe = () => {
		const s = order.selection;
		if (s.product === 'leveling') return t('dashboard.describeLeveling', { level: s.level ?? '—' });
		return t('dashboard.describeMoney', { amount: s.amountMillions ?? '—' });
	};

	return (
		<div className="glass-panel flex flex-wrap items-center justify-between gap-3 p-4">
			<div>
				<p className="font-mono text-xs text-white/50">{order.public_id}</p>
				<p className="text-sm text-ink">
					{describe()} · {order.selection.platform?.toUpperCase()}
				</p>
				{order.contact_handle && <p className="mt-1 text-xs text-neon-blue">{order.contact_handle}</p>}
			</div>

			{claimable ? (
				<div className="flex flex-col items-end gap-1">
					<Button variant="primary" size="sm" onClick={claim} loading={busy}>
						{t('queue.claim')}
					</Button>
					{error && <span className="text-[11px] text-pink-400">{t('queue.claimError')}</span>}
				</div>
			) : (
				<Link
					href={`/${locale}/dashboard/jobs/${order.public_id}`}
					className="text-sm font-semibold text-cyan-500 underline-offset-2 hover:underline"
				>
					{t('queue.openJob')}
				</Link>
			)}
		</div>
	);
}
