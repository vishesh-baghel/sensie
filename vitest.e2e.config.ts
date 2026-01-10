import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['**/__tests__/e2e/**/*.test.ts'],
    testTimeout: 120000, // 2 minutes for LLM calls
    hookTimeout: 30000,
    retry: 0, // No retries for E2E tests
    sequence: {
      shuffle: false, // Run tests in order
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
    },
  },
});
