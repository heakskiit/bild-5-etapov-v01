'use client';

/**
 * BATCH F11: one shared cart store for every component on the page (header
 * badge, configurators, /cart). Backed by localStorage; `useSyncExternalStore`
 * keeps all readers in sync, including other open tabs (`storage` event).
 * The server snapshot is always the empty cart, so SSR and the first client
 * render match and there is no hydration mismatch -- the badge appears right
 * after hydration.
 */

import { useCallback, useSyncExternalStore } from 'react';
import type { OrderSelection } from '@/types/order';
import { addItem, cartTotal, CART_STORAGE_KEY, parseCart, removeItem, type AddResult, type CartItem } from './cart';

const CHANGE_EVENT = 'nd-cart-change';
const EMPTY: CartItem[] = [];

let cachedRaw: string | null | undefined;
let cachedItems: CartItem[] = EMPTY;

function readRaw(): string | null {
	try {
		return window.localStorage.getItem(CART_STORAGE_KEY);
	} catch {
		return null; // private mode / storage disabled
	}
}

/** Must return the SAME array while storage is unchanged, or React loops. */
function getSnapshot(): CartItem[] {
	const raw = readRaw();
	if (raw !== cachedRaw) {
		cachedRaw = raw;
		cachedItems = parseCart(raw);
	}
	return cachedItems;
}

const getServerSnapshot = () => EMPTY;

function subscribe(onChange: () => void) {
	window.addEventListener('storage', onChange);
	window.addEventListener(CHANGE_EVENT, onChange);
	return () => {
		window.removeEventListener('storage', onChange);
		window.removeEventListener(CHANGE_EVENT, onChange);
	};
}

function write(items: CartItem[]) {
	try {
		window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
	} catch {
		// Storage full or disabled: nothing sensible to do, the cart just won't persist.
	}
	window.dispatchEvent(new Event(CHANGE_EVENT));
}

function newId(): string {
	return typeof crypto !== 'undefined' && 'randomUUID' in crypto
		? crypto.randomUUID()
		: `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useCart() {
	const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

	const add = useCallback((selection: OrderSelection): AddResult => {
		const result = addItem(getSnapshot(), selection, newId(), Date.now());
		if (result.ok) write(result.items);
		return result;
	}, []);

	const remove = useCallback((id: string) => write(removeItem(getSnapshot(), id)), []);
	const clear = useCallback(() => write([]), []);

	return { items, count: items.length, total: cartTotal(items), add, remove, clear };
}
