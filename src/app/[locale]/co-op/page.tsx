import { redirect } from 'next/navigation';

/** §-restructure: Co-op folded into /gta-5. Redirect kept for old/external links. */
export default async function LegacyCoopRedirect({ params }: { params: Promise<{ locale: string }> }) {
	const { locale } = await params;
	redirect(`/${locale}/gta-5`);
}
