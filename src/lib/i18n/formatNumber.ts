/**
 * Grouped numbers for the slider (§3.3): 8000 reads "8,000" in English, "8.000"
 * in German and "8 000" in Russian and French.
 *
 * The locale is a BCP-47 tag from the dictionary (`format.numberLocale`), not
 * the visitor's browser setting: server and browser have to print the same text
 * or React reports a hydration mismatch. The component used to hard-code
 * `ru-RU`, so every language saw Russian grouping.
 */

/** Used when no tag is passed: English, like the dictionary fallback. */
export const DEFAULT_NUMBER_LOCALE = 'en-US';

/**
 * Never throws. A missing dictionary key echoes its own path back (`dig()`), and
 * "format.numberLocale" is not a valid tag, so a bad value falls back to
 * English grouping instead of crashing the page.
 */
export function formatCount(value: number, locale: string = DEFAULT_NUMBER_LOCALE): string {
	try {
		return value.toLocaleString(locale);
	} catch {
		return value.toLocaleString(DEFAULT_NUMBER_LOCALE);
	}
}
