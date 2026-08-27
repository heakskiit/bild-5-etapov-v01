export type Dict = Record<string, unknown>;
export type Vars = Record<string, string | number>;

const interpolate = (template: string, vars?: Vars): string =>
	vars ? template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match)) : template;

/**
 * Pure, client-safe key lookup — no `next/headers`, so this can be imported
 * from both Server and Client Components. Returns the dotted path itself if
 * nothing is found, so a lookup can never silently render as `undefined`.
 * Optional `vars` fills `{placeholders}` in the resolved string, e.g.
 * dig(dict, 'common.buyFor', { price: '$6.50' }) — used for the price- and
 * date-embedded copy §2.2/§4.2 call for ("Оплатить $6.50", "Последняя
 * проверка: {date}").
 */
export const dig = (dict: Dict, path: string, vars?: Vars): string => {
	const value = path
		.split('.')
		.reduce<unknown>((node, key) => (node == null ? undefined : (node as Dict)[key]), dict);
	return typeof value === 'string' ? interpolate(value, vars) : path;
};

/**
 * Deep-merges `override` onto `base` (plain objects only; arrays and
 * primitives are replaced wholesale). Used to layer a locale dictionary over
 * the English fallback so a half-translated locale never falls back to a raw
 * dotted key in the UI.
 */
export const deepMerge = (base: Dict, override: Dict): Dict => {
	const out: Dict = { ...base };
	for (const key of Object.keys(override)) {
		const a = base[key];
		const b = override[key];
		out[key] =
			a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)
				? deepMerge(a as Dict, b as Dict)
				: b;
	}
	return out;
};
