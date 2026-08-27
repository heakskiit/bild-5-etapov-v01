import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LOCALES, type Locale } from '@/lib/i18n/config';
import { DisclaimerBar } from '@/components/layout/DisclaimerBar';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { fontVariables } from '@/lib/fonts';
import '../globals.css';

/** SSR + one static shell per locale: hreflang and crawlable copy for SEO. */
export const dynamicParams = false;
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  return {
    title: 'Neondrive — digital codes & co-op services',
    description:
      'Independent community platform for digital codes and piloted co-op gameplay services.',
    alternates: {
      canonical: `${base}/${locale}`,
      languages: Object.fromEntries(LOCALES.map((l) => [l, `${base}/${l}`])),
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!LOCALES.includes(locale as Locale)) notFound();

  return (
    <html lang={locale} className={fontVariables}>
      <body className="relative min-h-screen bg-night font-body text-white antialiased">
        {/*
          Fixed background: an image layer plus a darkening overlay layer
          (styles in globals.css: .bg-layer-image / .bg-layer-overlay).
          These are real `position: fixed` elements rather than
          `background-attachment: fixed` on <body> — that property is still
          unreliable on iOS Safari, where the image scrolls with the page
          instead of staying put behind the cards. Two stacked fixed divs
          get the same effect on every browser.
          Swap the url() below for the real asset path (or wire it up to a
          CMS/locale-specific value); everything else can stay as-is.
        */}
        <div
          className="bg-layer-image"
          style={{ backgroundImage: "url('/images/bg/vice-nights.jpg')" }}
          aria-hidden="true"
        />
        <div className="bg-layer-overlay" aria-hidden="true" />

        <DisclaimerBar />
        <Header locale={locale} />
        <main className="relative mx-auto max-w-6xl px-4 py-8">{children}</main>
        <Footer locale={locale} />
      </body>
    </html>
  );
}
