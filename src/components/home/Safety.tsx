import { getTranslations } from '@/lib/i18n/getTranslations';
import { LAST_SAFETY_CHECK_DATE } from '@/../config/trust-stats.config';
import { ShieldIcon, ClockIcon, DiscordIcon } from '@/components/ui/icons';

/**
 * §4.2 point 6: three columns (no-mods explanation, 72h check WITH a real
 * date — "не абстрактным обещанием" — and Discord support), then a wide
 * plaque on Safe Account Sharing, called out in the doc as "самый сильный
 * аргумент проекта, и на сайте его сейчас нет вообще."
 */
export async function Safety() {
	const t = await getTranslations();

	const checkBody = LAST_SAFETY_CHECK_DATE
		? t('home.safety.checkBodyWithDate', { date: LAST_SAFETY_CHECK_DATE })
		: t('home.safety.checkBodyNoDate');

	const columns = [
		{ Icon: ShieldIcon, title: t('home.safety.noModsTitle'), body: t('home.safety.noModsBody') },
		{ Icon: ClockIcon, title: t('home.safety.checkTitle'), body: checkBody },
		{ Icon: DiscordIcon, title: t('home.safety.discordTitle'), body: t('home.safety.discordBody') },
	];

	return (
		<section>
			<h2 className="font-display text-2xl md:text-3xl">{t('home.safety.title')}</h2>

			<div className="mt-6 grid gap-4 md:grid-cols-3">
				{columns.map(({ Icon, title, body }) => (
					<div key={title} className="glass-panel p-6">
						<Icon className="h-8 w-8 text-cyan-500" />
						<h3 className="mt-3 font-display text-lg text-ink">{title}</h3>
						<p className="mt-2 text-sm text-ink-soft">{body}</p>
					</div>
				))}
			</div>

			<div className="glass-panel mt-4 border-cyan-500/40 p-6">
				<h3 className="font-display text-lg text-cyan-500">{t('home.safety.sharingTitle')}</h3>
				<p className="mt-2 max-w-[65ch] text-sm text-ink-soft">{t('home.safety.sharingBody')}</p>
			</div>
		</section>
	);
}
