/**
 * BATCH F18: review marketplaces, shared by the home banners (F10) and the
 * "leave a review" prompt after a customer confirms an order.
 * `href: null` = no profile yet; such a platform is never linked.
 */
export type ReviewPlatform = {
	id: string;
	name: string;
	href: string | null;
	logo: string | null;
	accent: string;
};

export const REVIEW_PLATFORMS: readonly ReviewPlatform[] = [
	{
		id: 'playerauctions',
		name: 'PlayerAuctions',
		href: 'https://www.playerauctions.com/store/tommymodz/feedback/',
		logo: null,
		accent: 'text-[#ff8a00]',
	},
	{
		id: 'eldorado',
		name: 'Eldorado.gg',
		href: 'https://www.eldorado.gg/users/Tommymodz/reviews',
		logo: null,
		accent: 'text-[#ffc83d]',
	},
	{
		id: 'trustpilot',
		name: 'Trustpilot',
		href: null,
		logo: null,
		accent: 'text-[#00b67a]',
	},
];
