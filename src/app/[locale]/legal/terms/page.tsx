import { getTranslations } from '@/lib/i18n/getTranslations';
import { LegalPage, loadLegalCopy } from '@/components/legal/LegalPage';

export default async function TermsPage() {
	const t = await getTranslations();
	const sections = await loadLegalCopy('terms', [
		'whoWeAre',
		'eligibility',
		'ordersPayment',
		'coopRisk',
		'prohibitedUse',
		'liability',
	]);
	return <LegalPage title={t('footer.terms')} sections={sections} />;
}
