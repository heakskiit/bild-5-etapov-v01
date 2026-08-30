import Link from 'next/link';
import { LocaleSwitcher } from './LocaleSwitcher';
import { HeaderNav, type NavLink } from './HeaderNav';
import { getTranslations } from '@/lib/i18n/getTranslations';
import { requireUser } from '@/lib/supabase/auth';

/**
 * §4.2 point 2. Sticky, blurred, logo left / links center / language +
 * auth right. The disclaimer used to render here — see DisclaimerBar.tsx
 * for why it moved out (sticky parent was making it sticky too).
 */
export async function Header({ locale }: { locale: string }) {
	const t = await getTranslations();
	const user = await requireUser();

	const links: NavLink[] = [
		{ href: `/${locale}/gta-5`, label: t('nav.gta5') },
		{ href: `/${locale}/gta-6`, label: t('nav.gta6') },
		{ href: `/${locale}/about`, label: t('nav.about') },
		{ href: `/${locale}/support`, label: t('nav.support') },
	];

	return (
		<header className="sticky top-0 z-50 border-b border-white/10 bg-night/90 backdrop-blur">
			<nav className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
				<Link href={`/${locale}`} className="font-display text-lg text-neon-pink drop-shadow">
					NEON<span className="text-neon-blue">DRIVE</span>
				</Link>

				<HeaderNav
					locale={locale}
					links={links}
					// §4.2 point 2: "Для гостя кнопка называется «Войти», для
					// авторизованного — «Кабинет» с аватаром." `user_metadata.avatar_url`
					// is what Discord OAuth populates per the auth model comment in
					// lib/supabase/auth.ts — magic-link users won't have one, hence
					// the fallback to no avatar rather than a broken image.
					authHref={user ? `/${locale}/dashboard` : `/${locale}/auth`}
					authLabel={user ? t('nav.dashboard') : t('nav.login')}
					authAvatarUrl={(user?.user_metadata?.avatar_url as string | undefined) ?? null}
					isAuthenticated={Boolean(user)}
					logoutLabel={t('nav.logout')}
					openMenuLabel={t('common.openMenu')}
					closeMenuLabel={t('common.closeMenu')}
				/>

				{/* Custom dropdown with locale code + flag — §3.4. See LocaleSwitcher.tsx. */}
				<LocaleSwitcher current={locale} />
			</nav>
		</header>
	);
}
