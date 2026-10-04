import { describe, expect, it } from 'vitest';
import { SHARK_CARDS } from '@/../config/pricing.config';
import { parseStockResponse, sheetSkuForVariant } from './vault';

describe('sheetSkuForVariant (FIX-PAY-016)', () => {
	it.each(SHARK_CARDS.map((c) => [c.id, c.sheetSku]))('%s -> %s', (id, sku) => {
		expect(sheetSkuForVariant(id)).toBe(sku);
	});

	it('the cheapest card maps to the name used in the KEYS sheet', () => {
		expect(sheetSkuForVariant('sc_100k')).toBe('SHARK_100K');
	});

	it('a sheet SKU is not a variant id', () => {
		expect(sheetSkuForVariant('SHARK_100K')).toBeNull();
	});

	it.each([undefined, null, '', 42, 'sc_3m'])('unknown variant %s -> null', (value) => {
		expect(sheetSkuForVariant(value)).toBeNull();
	});

	it('every card has its own sheet SKU', () => {
		const skus = SHARK_CARDS.map((c) => c.sheetSku);
		expect(new Set(skus).size).toBe(skus.length);
	});
});

describe('parseStockResponse (FIX-PAY-016)', () => {
	it('reads a real stock figure', () => {
		expect(parseStockResponse({ ok: true, remaining: 1 }, 'SHARK_100K')).toBe(1);
	});

	it('a genuine zero stays zero', () => {
		expect(parseStockResponse({ ok: true, remaining: 0 }, 'SHARK_100K')).toBe(0);
	});

	it('the orders-log reply from the mixed-up URL is an error, not zero', () => {
		expect(() => parseStockResponse({ ok: true, row: 190 }, 'SHARK_100K')).toThrow(/no stock figure/);
	});

	it.each([
		['unauthorized', { ok: false, error: 'unauthorized' }],
		['null body', null],
		['undefined body', undefined],
		['string figure', { ok: true, remaining: '3' }],
		['negative figure', { ok: true, remaining: -1 }],
		['fractional figure', { ok: true, remaining: 1.5 }],
		['NaN figure', { ok: true, remaining: Number.NaN }],
	])('%s throws', (_label, body) => {
		expect(() => parseStockResponse(body, 'SHARK_100K')).toThrow();
	});
});
