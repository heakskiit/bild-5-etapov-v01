'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '@/lib/supabase/browserClient';

export function LogoutButton({
	locale,
	label,
	className,
	onNavigate,
}: {
	locale: string;
	label: string;
	/** Override the default styling — used to match the desktop pill vs the plain mobile-panel link. */
	className?: string;
	/** Closes the mobile menu panel before navigating away, same as AuthLink does. */
	onNavigate?: () => void;
}) {
	const router = useRouter();
	const [busy, setBusy] = useState(false);

	const signOut = async () => {
		setBusy(true);
		const supabase = browserClient();
		await supabase.auth.signOut();
		onNavigate?.();
		router.push(`/${locale}`);
		router.refresh();
	};

	return (
		<button
			type="button"
			onClick={signOut}
			disabled={busy}
			className={
				className ??
				'inline-flex h-11 items-center gap-2 rounded-full border border-[#B9B8C9]/20 bg-white/[0.03] px-5 text-sm font-medium text-[#F5F4FC]/85 transition-colors hover:border-[#B9B8C9]/40 hover:bg-white/[0.06] hover:text-white disabled:opacity-50'
			}
		>
			{label}
		</button>
	);
}
