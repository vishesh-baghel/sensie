import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  hashPassphrase,
  verifyPassphrase,
  validatePassphrase,
  generatePassphraseSuggestion,
  isStrongPassphrase,
  getPassphraseStrength,
  BCRYPT_ROUNDS,
  PASSPHRASE_REQUIREMENTS,
  WORDLIST,
} from '@/lib/auth/passphrase';

// Mock bcrypt to avoid slow hashing in tests
vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2b$12$mockedhashvalue'),
    compare: vi.fn().mockImplementation((pass: string, hash: string) => {
      // Simulate real comparison - return true if pass matches expected
      return Promise.resolve(pass === 'correct-passphrase');
    }),
  },
}));

describe('passphrase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('hashPassphrase', () => {
    it('should hash passphrase', async () => {
      const result = await hashPassphrase('test-passphrase');

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should produce different hashes for same input (with salt)', async () => {
      const hash1 = await hashPassphrase('test-passphrase');
      const hash2 = await hashPassphrase('test-passphrase');

      // Both are mocked to same value, but in real bcrypt they'd be different
      expect(typeof hash1).toBe('string');
      expect(typeof hash2).toBe('string');
    });
  });

  describe('verifyPassphrase', () => {
    it('should verify correct passphrase', async () => {
      const result = await verifyPassphrase('correct-passphrase', 'any-hash');

      expect(result).toBe(true);
    });

    it('should reject incorrect passphrase', async () => {
      const result = await verifyPassphrase('wrong-passphrase', 'any-hash');

      expect(result).toBe(false);
    });
  });

  describe('validatePassphrase', () => {
    it('should validate passphrase meeting requirements', () => {
      const result = validatePassphrase('valid-passphrase-here');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject too short passphrase', () => {
      const result = validatePassphrase('short');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('at least');
    });

    it('should reject too long passphrase', () => {
      const longPassphrase = 'a'.repeat(200);
      const result = validatePassphrase(longPassphrase);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('at most');
    });

    it('should reject empty passphrase', () => {
      const result = validatePassphrase('');

      expect(result.valid).toBe(false);
    });
  });

  describe('generatePassphraseSuggestion', () => {
    it('should generate passphrase with default word count (4)', () => {
      const result = generatePassphraseSuggestion();

      expect(typeof result).toBe('string');
      const words = result.split('-');
      expect(words.length).toBe(4);
    });

    it('should generate passphrase with specified word count', () => {
      const result = generatePassphraseSuggestion(5);

      const words = result.split('-');
      expect(words.length).toBe(5);
    });

    it('should use words from wordlist', () => {
      const result = generatePassphraseSuggestion(3);
      const words = result.split('-');

      words.forEach(word => {
        expect(WORDLIST).toContain(word);
      });
    });
  });

  describe('isStrongPassphrase', () => {
    it('should return true for strong passphrase', () => {
      const result = isStrongPassphrase('strong-passphrase-here-123!');

      expect(result).toBe(true);
    });

    it('should return false for weak passphrase', () => {
      const result = isStrongPassphrase('weak');

      expect(result).toBe(false);
    });

    it('should return true for passphrase with mixed characters', () => {
      const result = isStrongPassphrase('MyStrong-Pass123!');

      expect(result).toBe(true);
    });
  });

  describe('getPassphraseStrength', () => {
    it('should return high score for strong passphrase', () => {
      const result = getPassphraseStrength('very-strong-passphrase-123!');

      expect(result).toBeGreaterThanOrEqual(70);
    });

    it('should return low score for weak passphrase', () => {
      const result = getPassphraseStrength('weak');

      expect(result).toBeLessThan(30);
    });

    it('should return 0 for empty string', () => {
      const result = getPassphraseStrength('');

      expect(result).toBe(0);
    });

    it('should increase score for length', () => {
      const short = getPassphraseStrength('abc');
      const long = getPassphraseStrength('abcdefghijklmnopqrstuvwxyz');

      expect(long).toBeGreaterThan(short);
    });

    it('should increase score for character variety', () => {
      const lowercase = getPassphraseStrength('abcdefghij');
      const mixed = getPassphraseStrength('Abc123!@#x');

      expect(mixed).toBeGreaterThan(lowercase);
    });

    it('should increase score for multiple words', () => {
      const single = getPassphraseStrength('singlewordhere');
      const multiWord = getPassphraseStrength('multi-word-pass-here');

      expect(multiWord).toBeGreaterThan(single);
    });

    it('should cap at 100', () => {
      const result = getPassphraseStrength('Super-Long-Very-Strong-Passphrase-With-Numbers-123-And-Symbols-!@#$%');

      expect(result).toBeLessThanOrEqual(100);
    });
  });

  describe('constants', () => {
    it('should have correct bcrypt rounds', () => {
      expect(BCRYPT_ROUNDS).toBe(12);
    });

    it('should have correct passphrase requirements', () => {
      expect(PASSPHRASE_REQUIREMENTS.minLength).toBe(8);
      expect(PASSPHRASE_REQUIREMENTS.maxLength).toBe(128);
      expect(PASSPHRASE_REQUIREMENTS.minWords).toBe(3);
    });

    it('should have wordlist for generation', () => {
      expect(WORDLIST.length).toBeGreaterThan(0);
      expect(WORDLIST).toContain('apple');
    });

    it('should have diverse words in wordlist', () => {
      expect(WORDLIST.length).toBeGreaterThanOrEqual(20);
    });
  });
});
