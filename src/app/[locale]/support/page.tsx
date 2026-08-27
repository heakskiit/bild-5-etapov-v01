import { getTranslations } from '@/lib/i18n/getTranslations';

/**
 * Support hub. There is no on-site chat by design: every path leads to the
 * Discord server where Ticket Tool handles queueing and history.
 */
export default async function SupportPage() {
  const t = await getTranslations();
  const invite = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL ?? '#';

  const faq = [
    ['support.faq.q1', 'support.faq.a1'],
    ['support.faq.q2', 'support.faq.a2'],
    ['support.faq.q3', 'support.faq.a3'],
    ['support.faq.q4', 'support.faq.a4'],
  ] as const;

  return (
    <div className="space-y-10">
      <h1 className="font-display text-3xl text-neon-pink">{t('common.support')}</h1>

      <a
        href={invite}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block min-w-[14rem] text-balance rounded-lg bg-neon-blue px-6 py-3 text-center font-display uppercase text-night shadow-neon-blue"
      >
        {t('common.joinDiscord')}
      </a>

      <div className="space-y-2">
        {faq.map(([qKey, aKey]) => (
          <details key={qKey} className="glass-panel-sm px-4 py-3">
            <summary className="cursor-pointer font-display text-sm text-neon-blue">{t(qKey)}</summary>
            <p className="mt-2 text-sm text-white/70">{t(aKey)}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
