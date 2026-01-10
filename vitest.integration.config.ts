import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

/**
 * Vitest config for integration tests
 *
 * These tests make REAL LLM calls and require:
 * - AI_GATEWAY_API_KEY or ANTHROPIC_API_KEY
 *
 * Run with: pnpm test:integration
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['__tests__/integration/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    testTimeout: 120000, // 2 minutes for LLM calls
    hookTimeout: 60000,
    // Setup file to load environment variables
    setupFiles: ['__tests__/integration/setup.ts'],
    // Run tests sequentially to avoid rate limits
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Don't run in parallel to avoid rate limits
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
    },
  },
});
