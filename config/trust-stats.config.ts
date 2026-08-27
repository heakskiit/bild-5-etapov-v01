/**
 * §4.2 point 3 (hero trust row) and point 6 (safety check date) both require
 * real numbers — "Цифры только реальные" is explicit in the doc. I have no
 * access to your order database or ops process from here, so these are
 * `null` on purpose rather than a plausible-looking guess: every place that
 * reads this treats `null` as "don't show this fact" instead of printing a
 * fake stat. Fill in real values (ideally computed from the orders table at
 * request/build time, not hand-typed) before this ships.
 */
export const TRUST_STATS = {
	/** e.g. count of orders with status 'completed'. */
	completedOrders: null as number | null,
	/** Average minutes from payment to code delivery, e.g. 12. */
	avgDeliveryMinutes: null as number | null,
};

/** §4.2 point 6: "обязательно с датой последней проверки, а не абстрактным обещанием." ISO date, e.g. '2026-08-15'. */
export const LAST_SAFETY_CHECK_DATE: string | null = null;
