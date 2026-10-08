import { CartView } from '@/components/cart/CartView';
import { getMessages } from '@/lib/i18n/getTranslations';

/** BATCH F11: the cart page. Contents live in the browser, so the page itself is static. */
export default async function CartPage({ params }: { params: Promise<{ locale: string }> }) {
	const { locale } = await params;
	const messages = await getMessages();
	return <CartView locale={locale} messages={messages} />;
}
