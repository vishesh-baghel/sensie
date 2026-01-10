/**
 * Passphrase hashing and verification using bcrypt
 *
 * Sensie uses passphrases instead of passwords for better memorability
 */

import bcrypt from 'bcrypt';

/**
 * Bcrypt cost factor (higher = more secure but slower)
 */
export const BCRYPT_ROUNDS = 12;

/**
 * Minimum passphrase requirements
 */
export const PASSPHRASE_REQUIREMENTS = {
  minLength: 8,
  maxLength: 128,
  minWords: 3,
};

/**
 * Hash a passphrase for storage
 */
export async function hashPassphrase(passphrase: string): Promise<string> {
  return bcrypt.hash(passphrase, BCRYPT_ROUNDS);
}

/**
 * Verify a passphrase against stored hash
 */
export async function verifyPassphrase(
  passphrase: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(passphrase, hash);
}

/**
 * Validate passphrase meets requirements
 */
export function validatePassphrase(passphrase: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!passphrase || passphrase.length < PASSPHRASE_REQUIREMENTS.minLength) {
    errors.push(`Passphrase must be at least ${PASSPHRASE_REQUIREMENTS.minLength} characters`);
  }

  if (passphrase && passphrase.length > PASSPHRASE_REQUIREMENTS.maxLength) {
    errors.push(`Passphrase must be at most ${PASSPHRASE_REQUIREMENTS.maxLength} characters`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generate a random passphrase suggestion
 * Uses wordlist for memorable phrases
 */
export function generatePassphraseSuggestion(wordCount: number = 4): string {
  const words: string[] = [];
  for (let i = 0; i < wordCount; i++) {
    const randomIndex = Math.floor(Math.random() * WORDLIST.length);
    words.push(WORDLIST[randomIndex]);
  }
  return words.join('-');
}

/**
 * Check if passphrase is strong enough
 */
export function isStrongPassphrase(passphrase: string): boolean {
  return getPassphraseStrength(passphrase) >= 50;
}

/**
 * Get passphrase strength score (0-100)
 */
export function getPassphraseStrength(passphrase: string): number {
  if (!passphrase) return 0;

  let score = 0;

  // Length scoring (up to 40 points)
  score += Math.min(passphrase.length * 2, 40);

  // Character variety (up to 30 points)
  if (/[a-z]/.test(passphrase)) score += 7;
  if (/[A-Z]/.test(passphrase)) score += 8;
  if (/[0-9]/.test(passphrase)) score += 7;
  if (/[^a-zA-Z0-9]/.test(passphrase)) score += 8;

  // Word count bonus for passphrase-style (up to 20 points)
  const words = passphrase.split(/[\s\-_]+/).filter(w => w.length > 0);
  score += Math.min(words.length * 5, 20);

  // Uniqueness bonus (up to 10 points)
  const uniqueChars = new Set(passphrase.toLowerCase()).size;
  score += Math.min(uniqueChars, 10);

  return Math.min(score, 100);
}

/**
 * Common wordlist for passphrase generation
 */
export const WORDLIST = [
  'apple', 'banana', 'cherry', 'dragon', 'eagle', 'falcon',
  'garden', 'harbor', 'island', 'jungle', 'kingdom', 'lantern',
  'mountain', 'nectar', 'ocean', 'planet', 'quest', 'rainbow',
  'summit', 'thunder', 'universe', 'valley', 'whisper', 'zenith',
  // ... would include many more words in production
];
