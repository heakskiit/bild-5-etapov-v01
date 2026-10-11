import Link from 'next/link';
import { getTranslations } from '@/lib/i18n/getTranslations';

/**
 * Support hub. BATCH F17 (FIX-COPY-029): help with an existing order goes
 * through Orders -> "Need help with this order" (F15 support requests:
 * order data attached, reply and conversation in the order card). Discord
 * stays as the secondary channel for general questions and sign-in problems.
 */
export default async function SupportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
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

      <div className="grid gap-4 md:grid-cols-2">
        <section className="glass-panel space-y-3 p-5">
          <h2 className="font-display text-lg text-neon-blue">{t('support.hub.orderTitle')}</h2>
          <p className="text-sm text-white/70">{t('support.hub.orderBody')}</p>
          <Link
            href={`/${locale}/dashboard/orders`}
            className="inline-block min-w-[14rem] text-balance rounded-lg bg-neon-blue px-6 py-3 text-center font-display uppercase text-night shadow-neon-blue"
          >
            {t('support.hub.orderCta')}
          </Link>
        </section>

        <section className="glass-panel space-y-3 p-5">
          <h2 className="font-display text-lg text-white/80">{t('support.hub.discordTitle')}</h2>
          <p className="text-sm text-white/70">{t('support.hub.discordBody')}</p>
          <a
            href={invite}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block min-w-[14rem] text-balance rounded-lg border border-neon-blue/60 px-6 py-3 text-center font-display uppercase text-neon-blue"
          >
            {t('common.joinDiscord')}
          </a>
        </section>
      </div>

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
