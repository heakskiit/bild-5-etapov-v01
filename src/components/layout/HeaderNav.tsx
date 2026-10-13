'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { LogoutButton } from './LogoutButton';

export interface NavLink {
	href: string;
	label: string;
}

/**
 * §4.2 point 2: active item underlined, burger + full-screen menu on small
 * screens. Client-only because of `usePathname`/`useState`; Header stays a
 * Server Component. BATCH F19: premium styling, desktop row from `lg`.
 */
export function HeaderNav({
	locale,
	links,
	authHref,
	authLabel,
	authAvatarUrl,
	isAuthenticated,
	logoutLabel,
	openMenuLabel,
	closeMenuLabel,
}: {
	locale: string;
	links: NavLink[];
	authHref: string;
	authLabel: string;
	authAvatarUrl?: string | null;
	isAuthenticated: boolean;
	logoutLabel: string;
	openMenuLabel: string;
	closeMenuLabel: string;
}) {
	const pathname = usePathname();
	const [open, setOpen] = useState(false);

	useEffect(() => {
		if (!open) return;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setOpen(false);
		};
		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.body.style.overflow = previousOverflow;
			document.removeEventListener('keydown', onKeyDown);
		};
	}, [open]);

	const isActive = (href: string) => pathname === href || pathname?.startsWith(`${href}/`);

	const AuthLink = ({ onNavigate }: { onNavigate?: () => void }) => (
		<Link
			href={authHref}
			onClick={onNavigate}
			className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#00E5FF]/55 bg-[#090816]/40 px-5 text-sm font-medium text-[#00E5FF] transition-[border-color,box-shadow,background-color] duration-200 hover:border-[#00E5FF] hover:bg-[#00E5FF]/[0.06] hover:shadow-[0_0_18px_-4px_rgba(0,229,255,0.45)]"
		>
			{authAvatarUrl ? (
				// eslint-disable-next-line @next/next/no-img-element
				<img src={authAvatarUrl} alt="" className="h-5 w-5 rounded-full" referrerPolicy="no-referrer" />
			) : (
				<UserIcon />
			)}
			{authLabel}
		</Link>
	);

	return (
		<>
			<span aria-hidden="true" className="hidden h-6 w-px shrink-0 bg-white/15 lg:block" />

			<div className="hidden flex-1 items-center gap-7 lg:flex">
				{links.map((link) => {
					const active = isActive(link.href);
					return (
						<Link
							key={link.href}
							href={link.href}
							aria-current={active ? 'page' : undefined}
							className={[
								'relative whitespace-nowrap py-2 text-[15px] font-medium transition-colors duration-150',
								active ? 'text-[#F5F4FC]' : 'text-[#B9B8C9] hover:text-white',
							].join(' ')}
						>
							{link.label}
							{active && (
								<span aria-hidden="true" className="absolute inset-x-0 -bottom-0.5 h-0.5 rounded-full bg-[#FF278A]" />
							)}
						</Link>
					);
				})}
			</div>

			<div className="hidden shrink-0 items-center gap-3 lg:flex">
				<AuthLink />
				{isAuthenticated && <LogoutButton locale={locale} label={logoutLabel} />}
			</div>

			{/* Mobile/tablet burger — the panel below is conditionally rendered,
					not just hidden, so it can't intercept clicks while "closed". */}
			<button
				type="button"
				onClick={() => setOpen(true)}
				aria-label={openMenuLabel}
				aria-expanded={open}
				className="ml-auto flex h-11 w-11 items-center justify-center rounded-full text-[#F5F4FC]/85 transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 lg:hidden"
			>
				<BurgerIcon />
			</button>

			{/* Portal escapes the header's backdrop-filter containing block. */}
			{open && createPortal(
				<div className="fixed inset-0 z-[100] flex flex-col overflow-y-auto overscroll-contain bg-[#090816] p-6 lg:hidden">
					<button
						type="button"
						onClick={() => setOpen(false)}
						aria-label={closeMenuLabel}
						className="ml-auto flex h-11 w-11 items-center justify-center rounded-full text-[#F5F4FC]/85 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
					>
						<CloseIcon />
					</button>
					<nav className="mt-10 flex flex-col gap-6 text-lg">
						{links.map((link) => (
							<Link
								key={link.href}
								href={link.href}
								onClick={() => setOpen(false)}
								aria-current={isActive(link.href) ? 'page' : undefined}
								className={isActive(link.href) ? 'text-[#FF278A]' : 'text-[#F5F4FC]'}
							>
								{link.label}
							</Link>
						))}
					</nav>
					<div className="mt-8 flex flex-col items-start gap-3">
						<AuthLink onNavigate={() => setOpen(false)} />
						{isAuthenticated && (
							<LogoutButton
								locale={locale}
								label={logoutLabel}
								onNavigate={() => setOpen(false)}
								className="inline-flex items-center gap-2 text-lg text-[#B9B8C9] hover:text-white disabled:opacity-50"
							/>
						)}
					</div>
				</div>,
				document.body,
			)}
		</>
	);
}

function UserIcon() {
	return (
		<svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
			<circle cx="10" cy="7" r="3.2" />
			<path strokeLinecap="round" d="M3.8 16.5c1.2-2.6 3.4-3.9 6.2-3.9s5 1.3 6.2 3.9" />
		</svg>
	);
}

function BurgerIcon() {
	return (
		<svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
			<path strokeLinecap="round" d="M3 5.5h14M3 10h14M3 14.5h14" />
		</svg>
	);
}

function CloseIcon() {
	return (
		<svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
			<path strokeLinecap="round" d="M5 5l10 10M15 5 5 15" />
		</svg>
	);
}
