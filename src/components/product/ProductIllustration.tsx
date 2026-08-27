'use client';

import { useState } from 'react';

/**
 * Product artwork slot for the left column, above the safety widget.
 * Tries the catalog's local illustration first; if that 404s (or was never
 * generated), falls back to a temporary Unsplash still, so the slot is never
 * left empty. Image area is untouched (object-contain, no overlay) — the
 * title sits in its own caption strip below the art, not layered on top of
 * it, so nothing darkens the artwork regardless of how bright or dark the
 * icon itself is.
 */
export function ProductIllustration({
	src,
	fallbackSrc = 'https://images.unsplash.com/photo-1533738363-b7f9aef128ce?auto=format&fit=crop&w=800&q=60',
	title,
}: {
	src: string;
	fallbackSrc?: string;
	title: string;
}) {
	const [broken, setBroken] = useState(false);

	return (
		// Flex column instead of the old absolute-overlay layout: the image
		// area gets its own untouched space (object-contain, no scrim, no
		// gradient sitting on top of it), and the title lives in a separate
		// caption strip below it. That's what removes the darkening — there
		// used to be a `bg-gradient-to-t from-[#0b0b16] ... inset-0` layer
		// painted over the WHOLE tile (not just a thin strip behind the
		// text), fully opaque at the bottom fading up — fine over a busy
		// bright photo, but it dims any icon that isn't one. Container bg is
		// now plain `bg-surface` (the site's normal card tone) instead of a
		// near-black gradient, so if the icon has transparent padding you
		// see a normal dark-navy card, not a black hole.
		<div className="relative flex aspect-[4/3] flex-col overflow-hidden rounded-xl border border-neon-pink bg-surface shadow-neon-pink">
			<div className="flex flex-1 items-center justify-center p-6">
				<img
					src={broken ? fallbackSrc : src}
					alt=""
					onError={() => setBroken(true)}
					className="max-h-full max-w-full object-contain"
				/>
			</div>
			<div className="border-t border-white/10 bg-night/70 px-4 py-2">
				<p className="font-display text-sm uppercase tracking-wide text-white sm:text-base">
					{title}
				</p>
			</div>
		</div>
	);
}
