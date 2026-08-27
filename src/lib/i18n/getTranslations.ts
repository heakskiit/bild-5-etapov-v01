import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALES, type Locale } from './config';
import { dig, deepMerge, type Dict, type Vars } from './pick';

const cache = new Map<Locale, Dict>();

async function load(locale: Locale): Promise<Dict> {
	if (!cache.has(locale)) {
		cache.set(locale, (await import(`../../../messages/${locale}.json`)).default as Dict);
	}
	return cache.get(locale)!;
}

async function resolveLocale(): Promise<Locale> {
	const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value as Locale | undefined;
	return cookieLocale && LOCALES.includes(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;
}

/**
 * Server-side translator. Falls back to English for any missing key so a
 * half-translated locale can never ship an empty button.
 */
export async function getTranslations() {
	const locale = await resolveLocale();
	const [dict, fallback] = await Promise.all([load(locale), load(DEFAULT_LOCALE)]);

	return (path: string, vars?: Vars): string => {
		const value = dig(dict, path, vars);
		return value === path ? dig(fallback, path, vars) : value;
	};
}

/**
 * Plain, serializable dictionary for the current locale, deep-merged over the
 * English fallback. `'use client'` configurators can't call `next/headers`
 * themselves (that's what caused raw `configurator.xxx` keys to leak into the
 * UI), so Server Components fetch this once and pass it down as a prop; the
 * client then reads it locally with `dig` from `./pick`.
 */
export async function getMessages(): Promise<Dict> {
	const locale = await resolveLocale();
	const [dict, fallback] = await Promise.all([load(locale), load(DEFAULT_LOCALE)]);
	return deepMerge(fallback, dict);
}
