'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { dig, type Dict } from '@/lib/i18n/pick';

type Revealed = { login: string; password: string; note: string | null };

/** Hide the plaintext again on its own, so it does not sit on an open screen. */
const AUTO_HIDE_MS = 2 * 60 * 1000;

const ERROR_KEYS: Record<string, string> = {
	not_in_progress: 'jobs.credentials.notInProgress',
	no_credentials: 'jobs.credentials.none',
	wiped: 'jobs.credentials.wiped',
	rate_limited: 'jobs.credentials.tooMany',
};

export function CredentialsReveal({
	orderId,
	status,
	messages,
}: {
	orderId: string;
	status: string;
	messages: Dict;
}) {
	const t = useMemo(() => (key: string, vars?: Record<string, string | number>) => dig(messages, key, vars), [messages]);
	const [data, setData] = useState<Revealed | null>(null);
	const [busy, setBusy] = useState(false);
	const [errorKey, setErrorKey] = useState<string | null>(null);

	useEffect(() => {
		if (!data) return;
		const timer = setTimeout(() => setData(null), AUTO_HIDE_MS);
		return () => clearTimeout(timer);
	}, [data]);

	const reveal = async () => {
		setBusy(true);
		setErrorKey(null);
		try {
			const res = await fetch(`/api/dashboard/jobs/${orderId}/credentials`, { method: 'POST' });
			const body = await res.json().catch(() => null);
			if (!res.ok || !body?.login) {
				const code = res.status === 429 ? 'rate_limited' : body?.error;
				setErrorKey(ERROR_KEYS[code] ?? 'jobs.credentials.error');
				return;
			}
			setData({ login: body.login, password: body.password, note: body.note ?? null });
		} catch {
			setErrorKey('jobs.credentials.error');
		} finally {
			setBusy(false);
		}
	};

	if (status === 'completed') {
		return <p className="text-sm text-ink-soft">{t('jobs.credentials.wiped')}</p>;
	}
	if (status !== 'in_progress') {
		return <p className="text-sm text-ink-soft">{t('jobs.credentials.notInProgress')}</p>;
	}

	return (
		<div className="space-y-3">
			{data ? (
				<>
					<dl className="grid gap-3 sm:grid-cols-2">
						<Secret label={t('jobs.credentials.login')} value={data.login} />
						<Secret label={t('jobs.credentials.password')} value={data.password} />
						{data.note && <Secret label={t('jobs.credentials.note')} value={data.note} />}
					</dl>
					<Button variant="secondary" size="sm" onClick={() => setData(null)}>
						{t('jobs.credentials.hide')}
					</Button>
				</>
			) : (
				<Button variant="secondary" size="sm" onClick={reveal} loading={busy}>
					{t('jobs.credentials.show')}
				</Button>
			)}
			<p className="text-[11px] text-white/40">{t('jobs.credentials.hint')}</p>
			{errorKey && <p className="text-xs text-pink-400">{t(errorKey)}</p>}
		</div>
	);
}

function Secret({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<dt className="text-xs uppercase tracking-widest text-white/50">{label}</dt>
			<dd className="mt-1 select-all break-all font-mono text-sm text-ink">{value}</dd>
		</div>
	);
}
