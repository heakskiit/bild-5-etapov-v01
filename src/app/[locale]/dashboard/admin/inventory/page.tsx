import { requireRole, routeClient } from '@/lib/supabase/auth';
import { getTranslations, getMessages } from '@/lib/i18n/getTranslations';
import { SHARK_CARDS } from '@/../config/pricing.config';
import { getSharkCardStock } from '@/lib/keys/googleSheets';

/**
 * admin → /dashboard/admin/inventory (§4). Stock lives entirely in the
 * Sheet — Postgres only ever records a code *after* it's been fulfilled to
 * an order (see 0001's digital_codes) — so "inventory" here means two
 * separate reads: live stock from Apps Script, and fulfilment history from
 * digital_codes. Never queries or renders code_ciphertext (locked out at
 * the column-grant level by 0004 regardless).
 */
export default async function InventoryPage({ params }: { params: Promise<{ locale: string }> }) {
	const { locale } = await params;
	await requireRole(locale, ['admin']);
	const t = await getTranslations();
	const messages = await getMessages();

	const stock = await getSharkCardStock(SHARK_CARDS.map((c) => c.sheetSku));

	const supabase = await routeClient();
	const { data: recent } = await supabase
		.from('digital_codes')
		.select('id, created_at, revealed_at, orders(public_id, selection)')
		.order('created_at', { ascending: false })
		.limit(20);

	const skuLabel = (variantId: string | undefined) =>
		SHARK_CARDS.find((c) => c.id === variantId)?.denomination.toLocaleString(locale) ?? '—';

	return (
		<div className="space-y-8">
			<h1 className="font-display text-3xl text-neon-pink">{t('admin.inventory.title')}</h1>

			<section className="space-y-3">
				<h2 className="font-display text-sm uppercase tracking-widest text-white/60">{t('admin.inventory.stockTitle')}</h2>
				{!stock ? (
					<div className="glass-panel p-6 text-sm text-ink-soft">{t('admin.inventory.stockUnavailable')}</div>
				) : (
					<div className="glass-panel overflow-hidden">
						<table className="w-full text-left text-sm">
							<thead className="text-xs uppercase tracking-widest text-white/50">
								<tr>
									<th className="px-4 py-3">{t('admin.inventory.sku')}</th>
									<th className="px-4 py-3">{t('admin.inventory.denomination')}</th>
									<th className="px-4 py-3">{t('admin.inventory.price')}</th>
									<th className="px-4 py-3">{t('admin.inventory.stock')}</th>
								</tr>
							</thead>
							<tbody>
								{SHARK_CARDS.map((card) => {
									const remaining = stock[card.sheetSku];
									return (
										<tr key={card.id} className="border-t border-white/5">
											<td className="px-4 py-3 font-mono text-xs text-white/60">{card.sheetSku}</td>
											<td className="px-4 py-3 text-ink">{card.denomination.toLocaleString(locale)}</td>
											<td className="px-4 py-3 text-ink">${card.price.toFixed(2)}</td>
											<td
												className={`px-4 py-3 font-semibold ${
													remaining === 0 ? 'text-pink-400' : remaining !== undefined && remaining < 5 ? 'text-amber-300' : 'text-emerald-300'
												}`}
											>
												{remaining ?? '—'}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</section>

			<section className="space-y-3">
				<h2 className="font-display text-sm uppercase tracking-widest text-white/60">{t('admin.inventory.recentTitle')}</h2>
				{recent && recent.length > 0 ? (
					<div className="glass-panel divide-y divide-white/5 p-2">
						{(recent as any[]).map((row) => (
							<div key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm text-ink-soft">
								<span className="font-mono text-xs text-white/50">{row.orders?.public_id ?? '—'}</span>
								<span>{skuLabel(row.orders?.selection?.variantId)} GTA$</span>
								<span className={row.revealed_at ? 'text-emerald-300' : 'text-white/40'}>
									{row.revealed_at ? t('admin.inventory.revealed') : t('admin.inventory.notRevealed')}
								</span>
								<span className="text-xs text-white/40">{new Date(row.created_at).toLocaleString(locale)}</span>
							</div>
						))}
					</div>
				) : (
					<p className="text-sm text-ink-soft">{t('admin.inventory.recentEmpty')}</p>
				)}
			</section>
		</div>
	);
}
