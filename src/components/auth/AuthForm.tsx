'use client';

import { useMemo, useState } from 'react';
import { browserClient } from '@/lib/supabase/browserClient';
import { Button } from '@/components/ui/Button';
import { dig, type Dict } from '@/lib/i18n/pick';

const INPUT =
	'w-full rounded-lg border border-white/15 bg-night px-3 py-2 text-sm outline-none focus:border-neon-blue';

export function AuthForm({ locale, messages }: { locale: string; messages: Dict }) {
	const t = useMemo(() => (key: string) => dig(messages, key), [messages]);
	const [email, setEmail] = useState('');
	const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
	const [oauthBusy, setOauthBusy] = useState(false);

	// Every redirect keeps `next` locale-aware, and `data.locale` rides along
	// on the auth.users row so the 0003 trigger can seed profiles.locale
	// correctly instead of always defaulting to 'en'.
	const redirectTo =
		typeof window !== 'undefined'
			? `${window.location.origin}/auth/callback?next=${encodeURIComponent(`/${locale}/dashboard`)}`
			: undefined;

	const sendMagicLink = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setState('sending');
		const supabase = browserClient();
		const { error } = await supabase.auth.signInWithOtp({
			email,
			options: { emailRedirectTo: redirectTo, data: { locale } },
		});
		setState(error ? 'error' : 'sent');
	};

	const signInWithDiscord = async () => {
		setOauthBusy(true);
		const supabase = browserClient();
		const { error } = await supabase.auth.signInWithOAuth({
			provider: 'discord',
			options: { redirectTo, queryParams: { locale } },
		});
		if (error) setOauthBusy(false); // on success the browser navigates away
	};

	if (state === 'sent') {
		return <p className="text-sm text-ink">{t('auth.checkEmail')}</p>;
	}

	return (
		<div className="space-y-5">
			<form onSubmit={sendMagicLink} className="space-y-3">
				<label className="block text-xs uppercase tracking-widest text-white/50" htmlFor="auth-email">
					{t('auth.emailLabel')}
				</label>
				<input
					id="auth-email"
					type="email"
					required
					autoComplete="email"
					placeholder={t('auth.emailPlaceholder')}
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					className={INPUT}
				/>
				<Button type="submit" variant="primary" loading={state === 'sending'} className="w-full">
					{t('auth.sendLink')}
				</Button>
				{state === 'error' && <p className="text-xs text-pink-400">{t('auth.error')}</p>}
			</form>

			<div className="flex items-center gap-3 text-xs text-white/40">
				<span className="h-px flex-1 bg-white/10" />
				{t('auth.orDivider')}
				<span className="h-px flex-1 bg-white/10" />
			</div>

			<Button variant="secondary" onClick={signInWithDiscord} loading={oauthBusy} className="w-full">
				{t('auth.discordButton')}
			</Button>
		</div>
	);
}
