import Link from 'next/link';
import { LocaleSwitcher } from './LocaleSwitcher';
import { HeaderNav, type NavLink } from './HeaderNav';
import { getTranslations } from '@/lib/i18n/getTranslations';
import { requireUser } from '@/lib/supabase/auth';
import { CartButton } from '@/components/cart/CartButton';

/**
 * §4.2 point 2. Sticky, blurred, logo left / links / auth + cart + language
 * right. BATCH F19: premium look — darker translucent surface, 80px on
 * desktop, a thin pink-to-cyan hairline instead of a plain border. The
 * desktop row starts at `lg` so tablets get the burger instead of a
 * cramped, overlapping row. The disclaimer lives in DisclaimerBar.tsx.
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
		<header className="sticky top-0 z-50 bg-[#090816]/80 backdrop-blur-xl backdrop-saturate-150">
			<nav className="mx-auto flex h-[72px] max-w-6xl items-center gap-3 px-4 lg:h-20 lg:gap-5">
				<Link
					href={`/${locale}`}
					className="shrink-0 font-display text-[22px] font-bold leading-none tracking-tight text-[#FF278A] transition-[text-shadow] duration-200 hover:[text-shadow:0_0_14px_rgba(255,39,138,0.55)] lg:text-[26px]"
				>
					NEON<span className="text-[#00E5FF]">DRIVE</span>
				</Link>

				<HeaderNav
					locale={locale}
					links={links}
					// §4.2 point 2: guests see "Войти", signed-in users "Кабинет" with
					// the Discord avatar when there is one (magic-link users have none).
					authHref={user ? `/${locale}/dashboard` : `/${locale}/auth`}
					authLabel={user ? t('nav.dashboard') : t('nav.login')}
					authAvatarUrl={(user?.user_metadata?.avatar_url as string | undefined) ?? null}
					isAuthenticated={Boolean(user)}
					logoutLabel={t('nav.logout')}
					openMenuLabel={t('common.openMenu')}
					closeMenuLabel={t('common.closeMenu')}
				/>

				<CartButton locale={locale} label={t('nav.cart')} />

				{/* Custom dropdown with locale code + flag — §3.4. See LocaleSwitcher.tsx. */}
				<LocaleSwitcher current={locale} />
			</nav>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-[#FF278A]/70 via-[#FF278A]/25 to-[#00E5FF]/70"
			/>
		</header>
	);
}
