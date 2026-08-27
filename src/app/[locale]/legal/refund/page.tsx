import { getTranslations } from '@/lib/i18n/getTranslations';
import { LegalPage, loadLegalCopy } from '@/components/legal/LegalPage';

export default async function RefundPage() {
	const t = await getTranslations();
	const sections = await loadLegalCopy('refund', [
		'digitalCodes',
		'coopServices',
		'howToRequest',
		'paymentMethod',
		'disputes',
	]);
	return <LegalPage title={t('footer.refund')} sections={sections} />;
}
