'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { dig, type Dict } from '@/lib/i18n/pick';

/**
 * admin -> /dashboard/admin/promo (PROMO-7).
 *
 * Issues codes and switches them off. Everything else about a code is
 * deliberately read-only here: editing the percent or the threshold of a code
 * that is already in a customer's hands would rewrite what they were promised
 * after the fact, and a spent code is the only record of what a discount on a
 * paid order was for. Who redeemed which code and when is a question for the
 * database, not for this table.
 */

export interface PromoRow {
	id: number;
	code: string;
	/** 'bonus_x2' rows carry a multiplier in discount_value, not a percent. */
	discount_type: 'percent' | 'fixed_usd' | 'bonus_x2';
	discount_value: number;
	min_order_usd: number;
	active: boolean;
	used_at: string | null;
	expires_at: string | null;
	created_at: string;
	order_public_id: string | null;
}

export interface PromoStats {
	issued: number;
	active: number;
	used: number;
}

/** The agreed grid: 5 and 10 from $10, 15 and 20 from $30. */
const PRESETS = [
	{ percent: 5, minOrder: 10 },
	{ percent: 10, minOrder: 10 },
	{ percent: 15, minOrder: 30 },
	{ percent: 20, minOrder: 30 },
];

// No O/0, I/1 or S/5: these codes get read off a screenshot and typed by hand.
// The modulo bias this leaves is meaningless for a coupon.
const ALPHABET = 'ABCDEFGHJKLMNPQRTUVWXYZ2346789';

function generateCode(): string {
	const bytes = new Uint8Array(7);
	crypto.getRandomValues(bytes);
	return 'ND-' + Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

const money = (n: number) => `$${n.toFixed(2)}`;

export function PromoCodeManager({
	rows,
	stats,
	messages,
	locale,
}: {
	rows: PromoRow[];
	stats: PromoStats;
	messages: Dict;
	locale: string;
}) {
	const t = useMemo(() => (key: string, vars?: Record<string, string | number>) => dig(messages, key, vars), [messages]);
	const router = useRouter();

	// Generated on click, never during render: a random initial value would not
	// survive hydration.
	const [code, setCode] = useState('');
	const [kind, setKind] = useState<'percent' | 'bonus_x2'>('percent');
	const [percent, setPercent] = useState(10);
	const [minOrder, setMinOrder] = useState(10);
	const [expires, setExpires] = useState('');
	const [reserved, setReserved] = useState('');
	const [pending, setPending] = useState(false);
	const [togglingId, setTogglingId] = useState<number | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		const value = code.trim().toUpperCase();
		setPending(true);
		setError(null);
		setNotice(null);
		try {
			const res = await fetch('/api/dashboard/admin/promo', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					code: value,
					kind,
					// Omitted for a bonus code: the multiplier is fixed server-side, and
					// sending a percent it will ignore would suggest X2 codes have one.
					discountValue: kind === 'percent' ? percent : undefined,
					minOrderUsd: minOrder,
					// A date input yields a day; the code stays usable to the end of it.
					expiresAt: expires ? new Date(`${expires}T23:59:59Z`).toISOString() : null,
					reservedForUserId: reserved.trim() || null,
				}),
			});
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				setError(body?.error === 'code_exists' ? t('admin.promo.errorExists') : t('admin.promo.errorGeneric'));
				return;
			}
			setNotice(t('admin.promo.created', { code: value }));
			setCode(generateCode());
			router.refresh();
		} catch {
			setError(t('admin.promo.errorGeneric'));
		} finally {
			setPending(false);
		}
	};

	const toggle = async (row: PromoRow) => {
		setTogglingId(row.id);
		setError(null);
		try {
			const res = await fetch('/api/dashboard/admin/promo', {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ id: row.id, active: !row.active }),
			});
			if (!res.ok) {
				setError(t('admin.promo.errorGeneric'));
				return;
			}
			router.refresh();
		} catch {
			setError(t('admin.promo.errorGeneric'));
		} finally {
			setTogglingId(null);
		}
	};

	const stateOf = (row: PromoRow) => {
		if (row.used_at) return { label: t('admin.promo.stateUsed'), className: 'text-white/40' };
		if (!row.active) return { label: t('admin.promo.stateOff'), className: 'text-white/40' };
		if (row.expires_at && new Date(row.expires_at) <= new Date()) {
			return { label: t('admin.promo.stateExpired'), className: 'text-amber-300' };
		}
		return { label: t('admin.promo.stateActive'), className: 'text-emerald-300' };
	};

	const inputClass =
		'w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-ink outline-none focus:border-neon-pink/60';
	const labelClass = 'block text-xs uppercase tracking-widest text-white/50';

	return (
		<div className="space-y-8">
			<section className="grid grid-cols-3 gap-3">
				{[
					{ label: t('admin.promo.issued'), value: stats.issued },
					{ label: t('admin.promo.activeCount'), value: stats.active },
					{ label: t('admin.promo.usedCount'), value: stats.used },
				].map((card) => (
					<div key={card.label} className="glass-panel-sm p-4">
						<p className={labelClass}>{card.label}</p>
						<p className="font-display text-2xl text-ink">{card.value}</p>
					</div>
				))}
			</section>

			<section className="space-y-3">
				<h2 className="font-display text-sm uppercase tracking-widest text-white/60">{t('admin.promo.createTitle')}</h2>
				<form onSubmit={submit} className="glass-panel space-y-4 p-4">
					<div>
						<p className={labelClass}>{t('admin.promo.kindLabel')}</p>
						<div className="mt-2 flex flex-wrap gap-2">
							{(['percent', 'bonus_x2'] as const).map((option) => (
								<button
									key={option}
									type="button"
									onClick={() => setKind(option)}
									className={`rounded-full border px-3 py-1 text-xs ${
										kind === option ? 'border-neon-pink/60 text-neon-pink' : 'border-white/10 text-ink-soft hover:border-white/30'
									}`}
								>
									{option === 'percent' ? t('admin.promo.kindPercent') : t('admin.promo.kindBonus')}
								</button>
							))}
						</div>
						{kind === 'bonus_x2' && (
							<p className="mt-2 text-xs text-amber-300">{t('admin.promo.bonusNote')}</p>
						)}
					</div>

					<div>
						<p className={labelClass}>{t('admin.promo.presetsLabel')}</p>
						<div className="mt-2 flex flex-wrap gap-2">
							{PRESETS.map((preset) => {
								const selected = percent === preset.percent && minOrder === preset.minOrder;
								return (
									<button
										key={`${preset.percent}-${preset.minOrder}`}
										type="button"
										onClick={() => {
											setPercent(preset.percent);
											setMinOrder(preset.minOrder);
										}}
										className={`rounded-full border px-3 py-1 text-xs ${
											selected ? 'border-neon-pink/60 text-neon-pink' : 'border-white/10 text-ink-soft hover:border-white/30'
										}`}
									>
										{preset.percent}% · {t('admin.promo.fromAmount', { amount: money(preset.minOrder) })}
									</button>
								);
							})}
						</div>
					</div>

					<div className="grid gap-3 sm:grid-cols-2">
						<div className="space-y-1">
							<label className={labelClass} htmlFor="promo-code">{t('admin.promo.codeLabel')}</label>
							<div className="flex gap-2">
								<input
									id="promo-code"
									value={code}
									onChange={(e) => setCode(e.target.value.toUpperCase())}
									className={`${inputClass} font-mono`}
									required
								/>
								<button
									type="button"
									onClick={() => setCode(generateCode())}
									className="whitespace-nowrap rounded-lg border border-white/10 px-3 py-2 text-xs uppercase tracking-widest text-ink-soft hover:border-white/30"
								>
									{t('admin.promo.generate')}
								</button>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1">
								<label className={labelClass} htmlFor="promo-percent">{t('admin.promo.percentLabel')}</label>
								<input
									id="promo-percent"
									type="number"
									min={1}
									max={20}
									step={1}
									value={kind === 'bonus_x2' ? '' : percent}
									onChange={(e) => setPercent(Number(e.target.value))}
									className={`${inputClass} disabled:opacity-40`}
									disabled={kind === 'bonus_x2'}
									required={kind === 'percent'}
								/>
							</div>
							<div className="space-y-1">
								<label className={labelClass} htmlFor="promo-min">{t('admin.promo.minOrderLabel')}</label>
								<input
									id="promo-min"
									type="number"
									min={0}
									step={1}
									value={minOrder}
									onChange={(e) => setMinOrder(Number(e.target.value))}
									className={inputClass}
									required
								/>
							</div>
						</div>

						<div className="space-y-1">
							<label className={labelClass} htmlFor="promo-expires">{t('admin.promo.expiresLabel')}</label>
							<input id="promo-expires" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} className={inputClass} />
						</div>
						<div className="space-y-1">
							<label className={labelClass} htmlFor="promo-reserved">{t('admin.promo.reservedLabel')}</label>
							<input id="promo-reserved" value={reserved} onChange={(e) => setReserved(e.target.value)} className={`${inputClass} font-mono text-xs`} />
						</div>
					</div>

					<p className="text-xs text-white/40">{t('admin.promo.ceilingNote')}</p>

					<div className="flex flex-wrap items-center gap-3">
						<button
							type="submit"
							disabled={pending}
							className="rounded-lg border border-neon-pink/60 px-4 py-2 text-xs uppercase tracking-widest text-neon-pink disabled:opacity-50"
						>
							{pending ? t('admin.promo.creating') : t('admin.promo.submit')}
						</button>
						{notice && <span className="text-xs text-emerald-300">{notice}</span>}
						{error && <span className="text-xs text-pink-400">{error}</span>}
					</div>
				</form>
			</section>

			<section className="space-y-3">
				{rows.length === 0 ? (
					<p className="text-sm text-ink-soft">{t('admin.promo.empty')}</p>
				) : (
					<div className="glass-panel overflow-x-auto">
						<table className="w-full text-left text-sm">
							<thead className="text-xs uppercase tracking-widest text-white/50">
								<tr>
									<th className="px-4 py-3">{t('admin.promo.tableCode')}</th>
									<th className="px-4 py-3">{t('admin.promo.tableDiscount')}</th>
									<th className="px-4 py-3">{t('admin.promo.tableState')}</th>
									<th className="px-4 py-3">{t('admin.promo.tableOrder')}</th>
									<th className="px-4 py-3">{t('admin.promo.tableCreated')}</th>
									<th className="px-4 py-3" />
								</tr>
							</thead>
							<tbody>
								{rows.map((row) => {
									const state = stateOf(row);
									return (
										<tr key={row.id} className="border-t border-white/5">
											<td className="px-4 py-3 font-mono text-xs text-ink">{row.code}</td>
											<td className="px-4 py-3 text-ink-soft">
												{row.discount_type === 'bonus_x2' ? `X${row.discount_value}` : `${row.discount_value}%`}
												{row.min_order_usd > 0 ? ` · ${t('admin.promo.fromAmount', { amount: money(row.min_order_usd) })}` : ''}
											</td>
											<td className={`px-4 py-3 ${state.className}`}>{state.label}</td>
											<td className="px-4 py-3 font-mono text-xs text-white/50">{row.order_public_id ?? '—'}</td>
											<td className="px-4 py-3 text-xs text-white/40">{new Date(row.created_at).toLocaleDateString(locale)}</td>
											<td className="px-4 py-3 text-right">
												{!row.used_at && (
													<button
														type="button"
														onClick={() => toggle(row)}
														disabled={togglingId === row.id}
														className="rounded-full border border-white/10 px-3 py-1 text-xs text-ink-soft hover:border-white/30 disabled:opacity-50"
													>
														{row.active ? t('admin.promo.turnOff') : t('admin.promo.turnOn')}
													</button>
												)}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</section>
		</div>
	);
}
