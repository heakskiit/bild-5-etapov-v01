import { getTranslations } from '@/lib/i18n/getTranslations';

/**
 * §4.1/§4.2 point 1: "DISCLAIMER BAR · 12px · text-muted · по центру · не
 * sticky." This used to live *inside* Header, which is `sticky top-0` — a
 * child of a sticky element is sticky too, so the disclaimer was pinning to
 * the viewport along with the nav instead of scrolling away. Pulling it out
 * to sit above <Header> in the layout is what actually makes it non-sticky.
 *
 * Bug fix: the bar was `h-7` (a fixed 28px, single-line height). That's
 * enough room on desktop, where the full disclaimer sentence fits on one
 * line, but on narrow/mobile widths the same text wraps onto 3-4 lines —
 * the box didn't grow to match, so the extra lines overflowed straight
 * into <Header> right below it (visible as ghosted text bleeding through
 * the header's translucent/blurred background). `min-h-7` + vertical
 * padding lets the bar grow with however many lines it actually needs,
 * on any viewport, instead of clipping/overlapping the next element.
 */
export async function DisclaimerBar() {
	const t = await getTranslations();

	return (
		<div className="flex min-h-7 items-center justify-center bg-[var(--bg-surface)] px-4 py-1.5">
			<p className="text-center text-[11px] leading-tight text-[var(--text-muted)]">{t('common.disclaimer')}</p>
		</div>
	);
}
