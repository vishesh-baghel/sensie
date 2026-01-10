/**
 * Mastra Configuration for Sensie
 *
 * Central hub for AI agents and configuration.
 */

import { Mastra } from '@mastra/core/mastra';
import { sensieAgent } from './agents/sensie';

// Create Mastra instance with registered agents
export const mastra = new Mastra({
  agents: { sensieAgent },
});

// Re-export agent and all functions
export * from './agents/sensie';

// Re-export supporting modules
export * from './prompts';
export * from './schemas';
export * from './context';
