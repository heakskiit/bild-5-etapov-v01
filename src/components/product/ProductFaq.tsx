/**
 * FAQ spoilers — native <details>/<summary>, per spec.
 * Native elements give us zero-JS, SSR-friendly, crawlable content, which
 * matters because these answers carry long-tail SEO traffic.
 */

import { getTranslations } from '@/lib/i18n/getTranslations';

export async function ProductFaq() {
  const t = await getTranslations();

  const entries = [
    { q: 'faq.howBoostWorks', a: 'faq.howBoostWorksBody' },
    { q: 'faq.whySoCheap', a: 'faq.whySoCheapBody' },
  ];

  return (
    <div className="space-y-2">
      {entries.map(({ q, a }) => (
        <details
          key={q}
          className="group glass-panel-sm px-4 py-3 open:shadow-neon-inset"
        >
          {/* §1.1: 12px text can't carry pink-500 (4.3:1, fails 4.5:1 AA) — pink-400 instead. */}
          <summary className="cursor-pointer list-none font-display text-xs uppercase tracking-widest text-pink-400">
            {t(q)}
            <span className="float-right transition group-open:rotate-45">+</span>
          </summary>
          <p className="mt-2 text-xs leading-relaxed text-white/70">{t(a)}</p>
        </details>
      ))}
    </div>
  );
}
