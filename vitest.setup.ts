import '@testing-library/jest-dom';
import { beforeAll, afterAll, afterEach } from 'vitest';

// Mock environment variables for tests
beforeAll(() => {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/sensie_test';
  process.env.POSTGRES_URL = 'postgresql://test:test@localhost:5432/sensie_test';
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.ANTHROPIC_API_KEY = 'test-key';
  process.env.LANGFUSE_PUBLIC_KEY = 'pk-lf-test';
  process.env.LANGFUSE_SECRET_KEY = 'sk-lf-test';
  process.env.LANGFUSE_HOST = 'https://cloud.langfuse.com';
  process.env.SESSION_SECRET = 'test-session-secret-32-chars-min';
});

afterEach(() => {
  // Clear mocks after each test
});

afterAll(() => {
  // Cleanup
});
