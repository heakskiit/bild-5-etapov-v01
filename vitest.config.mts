import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Test runner config (Batch D).
 *
 * The only thing that genuinely needs configuring is the `@/` alias: the app
 * imports itself through it everywhere, and `@/../config/pricing.config`
 * resolves through the same rule, so pointing `@` at ./src covers both.
 *
 * Node environment on purpose — everything under test is pure math and string
 * building, with no DOM and no network, which is why the suite runs in well
 * under a second and can sit in front of every commit.
 */
export default defineConfig({
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url)),
		},
	},
	test: {
		environment: 'node',
		include: ['src/**/*.test.ts'],
	},
});
