'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface DashboardTab {
	href: string;
	label: string;
}

export function DashboardNav({ tabs }: { tabs: DashboardTab[] }) {
	const pathname = usePathname();
	const isActive = (href: string) => pathname === href;

	return (
		<nav className="flex flex-wrap gap-1 border-b border-white/10 pb-2 text-sm">
			{tabs.map((tab) => (
				<Link
					key={tab.href}
					href={tab.href}
					aria-current={isActive(tab.href) ? 'page' : undefined}
					className={[
						'rounded-md px-3 py-1.5 transition-colors duration-150',
						isActive(tab.href)
							? 'border border-neon-pink text-pink-400 shadow-neon-pink'
							: 'border border-transparent text-white/60 hover:text-neon-blue',
					].join(' ')}
				>
					{tab.label}
				</Link>
			))}
		</nav>
	);
}
