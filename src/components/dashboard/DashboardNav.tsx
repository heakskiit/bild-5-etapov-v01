'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface DashboardTab {
	href: string;
	label: string;
}

/**
 * BATCH F19: segmented pill tabs. The active tab is the longest matching
 * prefix, so /dashboard/admin/support still highlights "Admin" instead of
 * nothing.
 */
export function DashboardNav({ tabs }: { tabs: DashboardTab[] }) {
	const pathname = usePathname() ?? '';
	const active = tabs
		.filter((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`))
		.sort((a, b) => b.href.length - a.href.length)[0]?.href;

	return (
		<nav className="flex">
			<div className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-[#B9B8C9]/15 bg-[#090816]/75 p-1 backdrop-blur-xl">
				{tabs.map((tab) => {
					const isActive = tab.href === active;
					return (
						<Link
							key={tab.href}
							href={tab.href}
							aria-current={isActive ? 'page' : undefined}
							className={[
								'whitespace-nowrap rounded-full border px-4 py-1.5 text-sm transition-colors duration-150',
								isActive
									? 'border-[#FF278A]/70 bg-[#FF278A]/10 text-[#F5F4FC] shadow-[0_0_16px_-6px_rgba(255,39,138,0.7)]'
									: 'border-transparent text-[#B9B8C9] hover:bg-white/[0.04] hover:text-white',
							].join(' ')}
						>
							{tab.label}
						</Link>
					);
				})}
			</div>
		</nav>
	);
}
