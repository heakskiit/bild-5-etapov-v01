import type { Locale } from '@/lib/i18n/config';

interface FlagProps {
	className?: string;
}

/** Simplified, recognisable Union Jack — not a heraldically exact one. */
const FlagEn = ({ className }: FlagProps) => (
	<svg viewBox="0 0 20 14" className={className} aria-hidden="true">
		<rect width="20" height="14" fill="#00247D" />
		<path d="M0 0 20 14M20 0 0 14" stroke="#fff" strokeWidth="2.8" />
		<path d="M0 0 20 14M20 0 0 14" stroke="#CF142B" strokeWidth="1.2" />
		<path d="M10 0V14M0 7H20" stroke="#fff" strokeWidth="4.6" />
		<path d="M10 0V14M0 7H20" stroke="#CF142B" strokeWidth="2.6" />
	</svg>
);

const FlagDe = ({ className }: FlagProps) => (
	<svg viewBox="0 0 20 14" className={className} aria-hidden="true">
		<rect width="20" height="4.67" fill="#000" />
		<rect y="4.67" width="20" height="4.67" fill="#DD0000" />
		<rect y="9.33" width="20" height="4.67" fill="#FFCE00" />
	</svg>
);

const FlagFr = ({ className }: FlagProps) => (
	<svg viewBox="0 0 20 14" className={className} aria-hidden="true">
		<rect width="6.67" height="14" fill="#0055A4" />
		<rect x="6.67" width="6.67" height="14" fill="#fff" />
		<rect x="13.33" width="6.67" height="14" fill="#EF4135" />
	</svg>
);

const FlagEs = ({ className }: FlagProps) => (
	<svg viewBox="0 0 20 14" className={className} aria-hidden="true">
		<rect width="20" height="14" fill="#AA151B" />
		<rect y="3.5" width="20" height="7" fill="#F1BF00" />
	</svg>
);

const FlagRu = ({ className }: FlagProps) => (
	<svg viewBox="0 0 20 14" className={className} aria-hidden="true">
		<rect width="20" height="4.67" fill="#fff" />
		<rect y="4.67" width="20" height="4.67" fill="#0039A6" />
		<rect y="9.33" width="20" height="4.67" fill="#D52B1E" />
	</svg>
);

export const FLAGS: Record<Locale, (props: FlagProps) => React.JSX.Element> = {
	en: FlagEn,
	de: FlagDe,
	fr: FlagFr,
	es: FlagEs,
	ru: FlagRu,
};
