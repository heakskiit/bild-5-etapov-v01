/**
 * I18N GUARDS (F20).
 *
 * Five ways copy has slipped past the dictionaries so far, each now a test:
 *
 *   1. Russian typed straight into a component. The mobile sticky bar, the
 *      add-on hints, the slider's tier line and the button spinner all did
 *      this, so every locale saw Russian.
 *   2. Cyrillic inside a dictionary that is not `ru.json` (an untranslated
 *      paste).
 *   3. A `t('some.key')` whose key is in no dictionary. `dig()` echoes the path
 *      back, so the page prints `common.processing` as if it were copy, and
 *      messages.test.ts cannot see it: key *parity* still holds when a key is
 *      missing from all five files at once.
 *   4. A translation that drops or renames a `{placeholder}` the English
 *      string declares.
 *   5. A locale tag typed into a number or date formatter. The slider hard-coded
 *      `ru-RU`, so every language saw Russian digit grouping; Slider.tsx is JSX,
 *      which vitest cannot import, so this scan is the only thing that notices.
 *
 * Source files are parsed with the TypeScript compiler API instead of being
 * grepped, so comments (this codebase quotes its design doc in Russian all over
 * them) are never mistaken for UI text.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { type Dict, dig } from '@/lib/i18n/pick';

const LOCALES = ['en', 'ru', 'de', 'fr', 'es'] as const;
const CYRILLIC = /[\u0400-\u04FF]/;
const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));

/** Cyrillic that is allowed in code, by file (path under src/, forward slashes). */
const ALLOWED_CYRILLIC: Record<string, readonly string[]> = {
	// The language switcher shows each language in its own tongue.
	'lib/i18n/config.ts': ['Русский'],
};

/** Keys that moved out of components in F20. Some are reached through a map or a
 *  prop rather than a literal t('...') call, which the source scan cannot see. */
const F20_KEYS = [
	'common.processing',
	'configurator.tierLowest',
	'configurator.tierDrop',
	'addons.hints.kdReset',
	'addons.hints.slow',
	'home.popular.priceFrom',
	'home.cta.primary',
];

const dictionaries = new Map(
	LOCALES.map(
		(locale) =>
			[
				locale,
				JSON.parse(
					readFileSync(new URL(`../../../messages/${locale}.json`, import.meta.url), 'utf8'),
				) as Dict,
			] as const,
	),
);

function leaves(node: unknown, prefix = ''): [string, string][] {
	if (typeof node === 'string') return [[prefix, node]];
	if (node === null || typeof node !== 'object' || Array.isArray(node)) return [];
	return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
		leaves(value, prefix ? `${prefix}.${key}` : key),
	);
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

function sourceFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			return entry.name === 'node_modules' || entry.name === '.next' ? [] : sourceFiles(full);
		}
		const isCode = /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts');
		return isCode ? [full] : [];
	});
}

interface Scan {
	files: number;
	cyrillic: string[];
	locales: string[];
	keys: { where: string; key: string }[];
}

let scanned: Scan | undefined;

/** One pass over src/ serves both source-level tests. */
function scanSources(): Scan {
	if (scanned) return scanned;

	const files = sourceFiles(SRC_DIR);
	const cyrillic: string[] = [];
	const locales: string[] = [];
	const keys: Scan['keys'] = [];

	for (const file of files) {
		const rel = relative(SRC_DIR, file).split(sep).join('/');
		const source = ts.createSourceFile(
			file,
			readFileSync(file, 'utf8'),
			ts.ScriptTarget.Latest,
			true,
			file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
		);
		const at = (node: ts.Node) => `${rel}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`;

		const visit = (node: ts.Node): void => {
			if (
				ts.isStringLiteral(node) ||
				ts.isNoSubstitutionTemplateLiteral(node) ||
				ts.isTemplateHead(node) ||
				ts.isTemplateMiddle(node) ||
				ts.isTemplateTail(node) ||
				ts.isJsxText(node)
			) {
				if (CYRILLIC.test(node.text) && !ALLOWED_CYRILLIC[rel]?.includes(node.text)) {
					cyrillic.push(`${at(node)}  ${node.text.trim().slice(0, 80)}`);
				}
			}

			if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
				const name = node.expression.text;
				const arg = name === 't' ? node.arguments[0] : name === 'dig' ? node.arguments[1] : undefined;
				if (arg && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg))) {
					keys.push({ where: at(node), key: arg.text });
				}
			}

			if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
				const callee = node.expression;
				const first = node.arguments?.[0];
				const formats =
					ts.isPropertyAccessExpression(callee) &&
					(/^toLocale(Date|Time)?String$/.test(callee.name.text) ||
						(ts.isIdentifier(callee.expression) && callee.expression.text === 'Intl'));
				if (formats && first && (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first))) {
					locales.push(`${at(node)}  ${node.getText(source).slice(0, 80)}`);
				}
			}

			ts.forEachChild(node, visit);
		};
		visit(source);
	}

	scanned = { files: files.length, cyrillic, locales, keys };
	return scanned;
}

describe('i18n guards', () => {
	it('actually scans the source tree (a guard that finds nothing proves nothing)', () => {
		const { files, keys } = scanSources();

		expect(files).toBeGreaterThan(80);
		expect(keys.length).toBeGreaterThan(200);
	});

	it('has no Russian text typed into a component', () => {
		expect(scanSources().cyrillic).toEqual([]);
	});

	it('has no locale tag typed into a number or date formatter', () => {
		expect(scanSources().locales).toEqual([]);
	});

	it('keeps Cyrillic out of every dictionary except ru.json', () => {
		const offenders = LOCALES.filter((locale) => locale !== 'ru').flatMap((locale) =>
			leaves(dictionaries.get(locale))
				.filter(([, value]) => CYRILLIC.test(value))
				.map(([key]) => `${locale}: ${key}`),
		);

		expect(offenders).toEqual([]);
	});

	it('resolves every literal key passed to t() or dig()', () => {
		const english = dictionaries.get('en') as Dict;
		const missing = scanSources()
			.keys.filter(({ key }) => dig(english, key) === key)
			.map(({ where, key }) => `${where}  ${key}`);

		expect(missing).toEqual([]);
	});

	it('fills the same {placeholders} in every locale as the English string declares', () => {
		const problems: string[] = [];

		for (const locale of LOCALES) {
			const translated = new Map(leaves(dictionaries.get(locale)));

			for (const [key, text] of leaves(dictionaries.get('en'))) {
				const want = placeholders(text).join(',');
				const got = placeholders(translated.get(key) ?? '').join(',');
				if (want !== got) problems.push(`${locale}: ${key} should have {${want}} but has {${got}}`);
			}
		}

		expect(problems).toEqual([]);
	});

	it('carries the keys that replaced the hard-coded text, in every locale', () => {
		for (const locale of LOCALES) {
			const dict = dictionaries.get(locale) as Dict;

			for (const key of F20_KEYS) {
				// dig() echoes the path when the lookup fails.
				expect(dig(dict, key), `${locale}: ${key}`).not.toBe(key);
			}
		}
	});
});
