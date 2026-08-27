import { Unbounded, Exo_2, Inter, Manrope } from 'next/font/google';

/**
 * §1.2 of the design system: "Два шрифта, оба с кириллицей — обязательное
 * условие при локали ru". Before this file existed, tailwind.config.ts
 * pointed font-display/font-body at --font-display/--font-body, but nothing
 * in the project ever *set* those variables — every page was silently
 * rendering in the browser's system-ui fallback. This is what was missing.
 *
 * Display (H1/H2/logo only) = Unbounded, fallback Exo 2.
 * Text (everything else)    = Inter, fallback Manrope.
 * Both fallbacks are loaded for real (not just named) so they're only ever
 * one swap away if the primary face is blocked, not silently system-ui.
 */

export const fontUnbounded = Unbounded({
	subsets: ['latin', 'cyrillic'],
	weight: ['600', '700', '800'],
	variable: '--font-unbounded',
	display: 'swap',
});

export const fontExo2 = Exo_2({
	subsets: ['latin', 'cyrillic'],
	weight: ['600', '700'],
	variable: '--font-exo2',
	display: 'swap',
});

export const fontInter = Inter({
	subsets: ['latin', 'cyrillic'],
	weight: ['400', '500', '600', '700'],
	variable: '--font-inter',
	display: 'swap',
});

export const fontManrope = Manrope({
	subsets: ['latin', 'cyrillic'],
	weight: ['400', '500', '600', '700'],
	variable: '--font-manrope',
	display: 'swap',
});

/** Spread onto <body> (or <html>) alongside the existing className string. */
export const fontVariables = [
	fontUnbounded.variable,
	fontExo2.variable,
	fontInter.variable,
	fontManrope.variable,
].join(' ');
