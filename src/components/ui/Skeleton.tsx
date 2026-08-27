/**
 * §3.4 / item 5: "загрузка (скелетоны, не спиннер по центру)" — the doc is
 * specific that a loading state should be a skeleton shaped like the real
 * content, not a spinner floating in the middle of an empty page. This is
 * the one primitive every skeleton screen in the app builds from.
 *
 * `animate-pulse` already turns off for prefers-reduced-motion — that's the
 * global `@media (prefers-reduced-motion: reduce) { *, *::before, *::after
 * { animation: none !important } }` rule in globals.css (§1.5), not
 * something this component has to handle itself.
 */
export function Skeleton({ className = '' }: { className?: string }) {
	return <div className={`animate-pulse rounded-md bg-white/10 ${className}`} aria-hidden="true" />;
}
