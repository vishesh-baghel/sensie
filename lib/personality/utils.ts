import {
  GREETINGS,
  ENCOURAGEMENT,
  INCORRECT_RESPONSES,
  HINT_PHRASES,
  BREAK_MESSAGES,
  STREAK_MILESTONES,
  MASTERY_CELEBRATIONS,
  REVIEW_PHRASES,
  SESSION_END_PHRASES,
  ANIME_REFERENCES,
  QUIRKY_PHRASES,
  ERROR_PHRASES,
  COMMAND_PHRASES,
} from './constants';

/**
 * Helper functions for incorporating personality into responses
 */

/**
 * Pick random item from array
 */
function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Get greeting based on user state
 */
export function getGreeting(
  state: 'first_time' | 'returning' | 'after_break'
): string {
  switch (state) {
    case 'first_time':
      return pickRandom(GREETINGS.FIRST_TIME);
    case 'returning':
      return pickRandom(GREETINGS.RETURNING);
    case 'after_break':
      return pickRandom(GREETINGS.AFTER_BREAK);
    default:
      return pickRandom(GREETINGS.RETURNING);
  }
}

/**
 * Get encouragement based on context
 */
export function getEncouragement(
  context: 'correct' | 'deep' | 'progress' | 'struggle'
): string {
  switch (context) {
    case 'correct':
      return pickRandom(ENCOURAGEMENT.CORRECT_ANSWER);
    case 'deep':
      return pickRandom(ENCOURAGEMENT.DEEP_UNDERSTANDING);
    case 'progress':
      return pickRandom(ENCOURAGEMENT.PROGRESS);
    case 'struggle':
      return pickRandom(ENCOURAGEMENT.STRUGGLE);
    default:
      return pickRandom(ENCOURAGEMENT.CORRECT_ANSWER);
  }
}

/**
 * Get incorrect answer response
 */
export function getIncorrectResponse(): string {
  return pickRandom(INCORRECT_RESPONSES);
}

/**
 * Get hint phrase for level
 */
export function getHintPhrase(level: 1 | 2 | 3): string {
  switch (level) {
    case 1:
      return pickRandom(HINT_PHRASES.LEVEL_1);
    case 2:
      return pickRandom(HINT_PHRASES.LEVEL_2);
    case 3:
      return pickRandom(HINT_PHRASES.LEVEL_3);
    default:
      return pickRandom(HINT_PHRASES.LEVEL_1);
  }
}

/**
 * Get break message
 */
export function getBreakMessage(): string {
  return pickRandom(BREAK_MESSAGES);
}

/**
 * Get streak milestone message
 */
export function getStreakMilestone(days: number): string | null {
  // Check for exact milestones
  if (STREAK_MILESTONES[days]) {
    return STREAK_MILESTONES[days];
  }
  return null;
}

/**
 * Get mastery celebration
 */
export function getMasteryCelebration(): string {
  return pickRandom(MASTERY_CELEBRATIONS);
}

/**
 * Get review phrase
 */
export function getReviewPhrase(type: 'start' | 'complete'): string {
  return pickRandom(REVIEW_PHRASES[type === 'start' ? 'START' : 'COMPLETE']);
}

/**
 * Get session end phrase
 */
export function getSessionEndPhrase(): string {
  return pickRandom(SESSION_END_PHRASES);
}

/**
 * Get anime reference (use sparingly)
 */
export function getAnimeReference(): string {
  return pickRandom(ANIME_REFERENCES);
}

/**
 * Get quirky phrase to add flavor
 */
export function getQuirkyPhrase(): string {
  return pickRandom(QUIRKY_PHRASES);
}

/**
 * Get error message
 */
export function getErrorPhrase(): string {
  return pickRandom(ERROR_PHRASES);
}

/**
 * Get skip command response
 */
export function getSkipResponse(): string {
  return pickRandom(COMMAND_PHRASES.SKIP);
}

/**
 * Add random quirk to message (20% chance)
 */
export function maybeAddQuirk(message: string): string {
  if (Math.random() < 0.2) {
    const quirk = getQuirkyPhrase();
    // Randomly prepend or append
    return Math.random() < 0.5 ? `${quirk} ${message}` : `${message} ${quirk}`;
  }
  return message;
}

/**
 * Format message in Sensie's voice
 * Adds personality touches to plain messages
 */
export function sensieVoice(message: string): string {
  return maybeAddQuirk(message);
}

/**
 * Check if should include anime reference (10% chance)
 */
export function shouldIncludeAnimeReference(): boolean {
  return Math.random() < 0.1;
}

/**
 * Get contextual flavor text
 */
export function getFlavorText(
  context:
    | 'thinking'
    | 'impressed'
    | 'disappointed'
    | 'excited'
    | 'neutral'
): string {
  const flavorMap = {
    thinking: '*strokes beard thoughtfully*',
    impressed: '*nods approvingly*',
    disappointed: '*sighs*',
    excited: 'Hohoho!',
    neutral: '',
  };
  return flavorMap[context] || '';
}
