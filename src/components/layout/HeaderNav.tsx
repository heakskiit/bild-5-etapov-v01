'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

export interface NavLink {
	href: string;
	label: string;
}

/**
 * §4.2 point 2: "Активный пункт меню подчёркнут cyan-линией 2px. На
 * мобильном — бургер и полноэкранное меню." Split out of Header.tsx because
 * both of those need `usePathname`/`useState`, which means client-only —
 * Header itself stays a Server Component so the auth check (`requireUser`)
 * and translations don't have to round-trip to the client.
 */
export function HeaderNav({
	links,
	authHref,
	authLabel,
	authAvatarUrl,
	openMenuLabel,
	closeMenuLabel,
}: {
	links: NavLink[];
	authHref: string;
	authLabel: string;
	authAvatarUrl?: string | null;
	openMenuLabel: string;
	closeMenuLabel: string;
}) {
	const pathname = usePathname();
	const [open, setOpen] = useState(false);

	const isActive = (href: string) => pathname === href || pathname?.startsWith(`${href}/`);

	const AuthLink = ({ onNavigate }: { onNavigate?: () => void }) => (
		<Link
			href={authHref}
			onClick={onNavigate}
			className="inline-flex items-center gap-2 rounded-lg border border-neon-blue/50 px-3 py-1.5 text-sm text-neon-blue shadow-neon-blue"
		>
			{authAvatarUrl && (
				// eslint-disable-next-line @next/next/no-img-element
				<img src={authAvatarUrl} alt="" className="h-5 w-5 rounded-full" referrerPolicy="no-referrer" />
			)}
			{authLabel}
		</Link>
	);

	return (
		<>
			<div className="hidden flex-1 flex-wrap gap-6 text-sm text-white/70 md:flex">
				{links.map((link) => (
					<Link
						key={link.href}
						href={link.href}
						aria-current={isActive(link.href) ? 'page' : undefined}
						className={[
							'text-balance border-b-2 pb-0.5 transition-colors duration-150',
							isActive(link.href) ? 'border-cyan-500 text-ink' : 'border-transparent hover:text-neon-blue',
						].join(' ')}
					>
						{link.label}
					</Link>
				))}
			</div>

			<div className="hidden md:block">
				<AuthLink />
			</div>

			{/* Mobile burger — only the trigger is visible under md; the panel
			    below is conditionally rendered, not just hidden, so it can't
			    intercept clicks while "closed". */}
			<button
				type="button"
				onClick={() => setOpen(true)}
				aria-label={openMenuLabel}
				aria-expanded={open}
				className="ml-auto flex h-9 w-9 items-center justify-center rounded-md text-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500 focus-visible:outline-offset-2 md:hidden"
			>
				<BurgerIcon />
			</button>

			{open && (
				<div className="fixed inset-0 z-[60] flex flex-col bg-[var(--bg-base)] p-6 md:hidden">
					<button
						type="button"
						onClick={() => setOpen(false)}
						aria-label={closeMenuLabel}
						className="ml-auto flex h-9 w-9 items-center justify-center rounded-md text-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500 focus-visible:outline-offset-2"
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
								className={isActive(link.href) ? 'text-cyan-500' : 'text-ink'}
							>
								{link.label}
							</Link>
						))}
					</nav>
					<div className="mt-8">
						<AuthLink onNavigate={() => setOpen(false)} />
					</div>
				</div>
			)}
		</>
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
