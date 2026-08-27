'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LOCALES, LOCALE_COOKIE, LOCALE_LABELS, type Locale } from '@/lib/i18n/config';
import { FLAGS } from '@/components/ui/Flags';

/**
 * §3.4: "Селектор языка: кастомный дропдаун с кодом локали и флагом, а не
 * нативный select." A native <select> is exactly the kind of control §5's
 * acceptance criteria bans ("ни одного нативного контрола браузера"), so
 * this is the standard ARIA menu-button pattern instead: trigger button +
 * `role="listbox"` popup, arrow-key navigation, Escape/click-outside to
 * close, focus returns to the trigger on close.
 */
export function LocaleSwitcher({ current }: { current: string }) {
	const router = useRouter();
	const pathname = usePathname();
	const [open, setOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

	const currentLocale = (LOCALES.includes(current as Locale) ? current : 'en') as Locale;
	const CurrentFlag = FLAGS[currentLocale];

	useEffect(() => {
		if (!open) return;
		const onClickOutside = (event: MouseEvent) => {
			if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
		};
		const onEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				setOpen(false);
				triggerRef.current?.focus();
			}
		};
		document.addEventListener('mousedown', onClickOutside);
		document.addEventListener('keydown', onEscape);
		return () => {
			document.removeEventListener('mousedown', onClickOutside);
			document.removeEventListener('keydown', onEscape);
		};
	}, [open]);

	const change = (next: Locale) => {
		document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=${60 * 60 * 24 * 365}`;
		localStorage.setItem(LOCALE_COOKIE, next);
		const segments = pathname.split('/');
		segments[1] = next;
		router.push(segments.join('/') || `/${next}`);
		setOpen(false);
	};

	const openAndFocusCurrent = () => {
		setOpen(true);
		requestAnimationFrame(() => optionRefs.current[LOCALES.indexOf(currentLocale)]?.focus());
	};

	const onOptionKeyDown = (event: React.KeyboardEvent, index: number) => {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			optionRefs.current[(index + 1) % LOCALES.length]?.focus();
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			optionRefs.current[(index - 1 + LOCALES.length) % LOCALES.length]?.focus();
		} else if (event.key === 'Home') {
			event.preventDefault();
			optionRefs.current[0]?.focus();
		} else if (event.key === 'End') {
			event.preventDefault();
			optionRefs.current[LOCALES.length - 1]?.focus();
		}
		// Enter/Space need no handling here — they're plain <button>s, so the
		// browser already fires a click (and therefore `change`) natively.
	};

	return (
		<div ref={rootRef} className="relative inline-block text-left">
			<button
				ref={triggerRef}
				type="button"
				aria-haspopup="listbox"
				aria-expanded={open}
				onClick={() => (open ? setOpen(false) : openAndFocusCurrent())}
				onKeyDown={(event) => {
					if (!open && (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ')) {
						event.preventDefault();
						openAndFocusCurrent();
					}
				}}
				className="flex items-center gap-2 rounded-lg border border-white/15 bg-night px-2.5 py-1.5 text-sm text-white/80 transition-colors hover:border-white/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500 focus-visible:outline-offset-2"
			>
				<CurrentFlag className="h-3.5 w-5 shrink-0 rounded-[2px]" />
				<span className="uppercase tabular-nums">{currentLocale}</span>
				<svg
					className={`h-3 w-3 shrink-0 text-white/50 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
					viewBox="0 0 12 12"
					fill="none"
					aria-hidden="true"
				>
					<path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
				</svg>
			</button>

			{open && (
				<ul role="listbox" aria-label="Language" className="glass-panel-sm absolute right-0 z-30 mt-2 w-44 overflow-hidden py-1">
					{LOCALES.map((locale, index) => {
						const Flag = FLAGS[locale];
						const selected = locale === currentLocale;
						return (
							<li key={locale} role="presentation">
								<button
									ref={(el) => {
										optionRefs.current[index] = el;
									}}
									type="button"
									role="option"
									aria-selected={selected}
									onClick={() => change(locale)}
									onKeyDown={(event) => onOptionKeyDown(event, index)}
									className={[
										'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors',
										'focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500 focus-visible:-outline-offset-2',
										selected ? 'bg-white/5 text-ink' : 'text-ink-soft hover:bg-white/5 hover:text-ink',
									].join(' ')}
								>
									<Flag className="h-3.5 w-5 shrink-0 rounded-[2px]" />
									<span className="flex-1">{LOCALE_LABELS[locale]}</span>
									<span className="text-[11px] uppercase tabular-nums text-ink-muted">{locale}</span>
								</button>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
