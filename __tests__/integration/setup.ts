/**
 * Setup file for integration tests
 * Loads environment variables from .env file
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env from the package root
config({ path: resolve(__dirname, '../../.env') });

// Log which API key is available (without revealing the key)
if (process.env.AI_GATEWAY_API_KEY) {
  console.log('✓ AI_GATEWAY_API_KEY is set');
} else if (process.env.ANTHROPIC_API_KEY) {
  console.log('✓ ANTHROPIC_API_KEY is set');
} else {
  console.log('✗ No API key found - LLM integration tests will be skipped');
}
