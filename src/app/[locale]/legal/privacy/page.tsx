import { getTranslations } from '@/lib/i18n/getTranslations';
import { LegalPage, loadLegalCopy } from '@/components/legal/LegalPage';

export default async function PrivacyPage() {
	const t = await getTranslations();
	const sections = await loadLegalCopy('privacy', [
		'whatWeCollect',
		'credentialsHandling',
		'howWeUseData',
		'sheetsSync',
		'dataRetention',
		'yourRights',
	]);
	return <LegalPage title={t('footer.privacy')} sections={sections} />;
}
