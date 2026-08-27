import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/supabase/auth';
import { getTranslations, getMessages } from '@/lib/i18n/getTranslations';
import { AuthForm } from '@/components/auth/AuthForm';

/**
 * Единая страница входа (§3): Magic Link + Discord OAuth, ни одного пароля
 * от самого сайта. `/[locale]/login` теперь просто редиректит сюда.
 */
export default async function AuthPage({ params }: { params: Promise<{ locale: string }> }) {
	const { locale } = await params;
	const user = await requireUser();
	if (user) redirect(`/${locale}/dashboard`);

	const t = await getTranslations();
	const messages = await getMessages();

	return (
		<div className="mx-auto flex max-w-md flex-col gap-6">
			<h1 className="font-display text-3xl text-neon-pink">{t('auth.title')}</h1>
			<div className="glass-panel p-6">
				<AuthForm locale={locale} messages={messages} />
			</div>
		</div>
	);
}
