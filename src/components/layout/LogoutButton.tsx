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
				'inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/70 transition-colors hover:text-white disabled:opacity-50'
			}
		>
			{label}
		</button>
	);
}
