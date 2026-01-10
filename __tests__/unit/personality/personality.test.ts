import { describe, it, expect, vi, beforeEach } from 'vitest';
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
} from '@/lib/personality/constants';
import {
  getGreeting,
  getEncouragement,
  getIncorrectResponse,
  getHintPhrase,
  getBreakMessage,
  getStreakMilestone,
  getMasteryCelebration,
  getReviewPhrase,
  getSessionEndPhrase,
  getAnimeReference,
  getQuirkyPhrase,
  getErrorPhrase,
  getSkipResponse,
  maybeAddQuirk,
  sensieVoice,
  shouldIncludeAnimeReference,
  getFlavorText,
} from '@/lib/personality/utils';

describe('personality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constants', () => {
    it('should have first time greetings', () => {
      expect(GREETINGS.FIRST_TIME.length).toBeGreaterThan(0);
    });

    it('should have returning greetings', () => {
      expect(GREETINGS.RETURNING.length).toBeGreaterThan(0);
    });

    it('should have encouragement for correct answers', () => {
      expect(ENCOURAGEMENT.CORRECT_ANSWER.length).toBeGreaterThan(0);
    });

    it('should have encouragement for deep understanding', () => {
      expect(ENCOURAGEMENT.DEEP_UNDERSTANDING.length).toBeGreaterThan(0);
    });

    it('should have encouragement for struggles', () => {
      expect(ENCOURAGEMENT.STRUGGLE.length).toBeGreaterThan(0);
    });

    it('should have incorrect responses', () => {
      expect(INCORRECT_RESPONSES.length).toBeGreaterThan(0);
    });

    it('should have hint phrases for all levels', () => {
      expect(HINT_PHRASES.LEVEL_1.length).toBeGreaterThan(0);
      expect(HINT_PHRASES.LEVEL_2.length).toBeGreaterThan(0);
      expect(HINT_PHRASES.LEVEL_3.length).toBeGreaterThan(0);
    });

    it('should have streak milestones', () => {
      expect(STREAK_MILESTONES[3]).toBeDefined();
      expect(STREAK_MILESTONES[7]).toBeDefined();
      expect(STREAK_MILESTONES[30]).toBeDefined();
      expect(STREAK_MILESTONES[100]).toBeDefined();
    });

    it('should have break messages', () => {
      expect(BREAK_MESSAGES.length).toBeGreaterThan(0);
    });

    it('should have mastery celebrations', () => {
      expect(MASTERY_CELEBRATIONS.length).toBeGreaterThan(0);
    });

    it('should have review phrases', () => {
      expect(REVIEW_PHRASES.START.length).toBeGreaterThan(0);
      expect(REVIEW_PHRASES.COMPLETE.length).toBeGreaterThan(0);
    });

    it('should have anime references', () => {
      expect(ANIME_REFERENCES.length).toBeGreaterThan(0);
    });

    it('should have quirky phrases', () => {
      expect(QUIRKY_PHRASES.length).toBeGreaterThan(0);
      expect(QUIRKY_PHRASES).toContain('Hohoho!');
    });

    it('should have error phrases', () => {
      expect(ERROR_PHRASES.length).toBeGreaterThan(0);
    });

    it('should have command phrases', () => {
      expect(COMMAND_PHRASES.SKIP.length).toBeGreaterThan(0);
      expect(COMMAND_PHRASES.TOPICS).toBeDefined();
      expect(COMMAND_PHRASES.PROGRESS).toBeDefined();
    });
  });

  describe('utils', () => {
    describe('getGreeting', () => {
      it('should return greeting for first time', () => {
        const greeting = getGreeting('first_time');
        expect(GREETINGS.FIRST_TIME).toContain(greeting);
      });

      it('should return greeting for returning', () => {
        const greeting = getGreeting('returning');
        expect(GREETINGS.RETURNING).toContain(greeting);
      });

      it('should return greeting for after break', () => {
        const greeting = getGreeting('after_break');
        expect(GREETINGS.AFTER_BREAK).toContain(greeting);
      });
    });

    describe('getEncouragement', () => {
      it('should return encouragement for correct', () => {
        const encouragement = getEncouragement('correct');
        expect(ENCOURAGEMENT.CORRECT_ANSWER).toContain(encouragement);
      });

      it('should return encouragement for deep', () => {
        const encouragement = getEncouragement('deep');
        expect(ENCOURAGEMENT.DEEP_UNDERSTANDING).toContain(encouragement);
      });

      it('should return encouragement for struggle', () => {
        const encouragement = getEncouragement('struggle');
        expect(ENCOURAGEMENT.STRUGGLE).toContain(encouragement);
      });
    });

    describe('getIncorrectResponse', () => {
      it('should return incorrect response', () => {
        const response = getIncorrectResponse();
        expect(INCORRECT_RESPONSES).toContain(response);
      });
    });

    describe('getHintPhrase', () => {
      it('should return hint phrase for level 1', () => {
        const phrase = getHintPhrase(1);
        expect(HINT_PHRASES.LEVEL_1).toContain(phrase);
      });

      it('should return hint phrase for level 2', () => {
        const phrase = getHintPhrase(2);
        expect(HINT_PHRASES.LEVEL_2).toContain(phrase);
      });

      it('should return hint phrase for level 3', () => {
        const phrase = getHintPhrase(3);
        expect(HINT_PHRASES.LEVEL_3).toContain(phrase);
      });
    });

    describe('getStreakMilestone', () => {
      it('should return milestone for known days', () => {
        expect(getStreakMilestone(7)).toBe(STREAK_MILESTONES[7]);
      });

      it('should return null for non-milestone days', () => {
        expect(getStreakMilestone(5)).toBeNull();
      });
    });

    describe('getFlavorText', () => {
      it('should return thinking flavor', () => {
        expect(getFlavorText('thinking')).toBe('*strokes beard thoughtfully*');
      });

      it('should return excited flavor', () => {
        expect(getFlavorText('excited')).toBe('Hohoho!');
      });

      it('should return empty for neutral', () => {
        expect(getFlavorText('neutral')).toBe('');
      });
    });

    describe('sensieVoice', () => {
      it('should return message (possibly with quirk)', () => {
        const message = 'Test message';
        const result = sensieVoice(message);
        expect(result).toContain('Test message');
      });
    });

    describe('shouldIncludeAnimeReference', () => {
      it('should return boolean', () => {
        const result = shouldIncludeAnimeReference();
        expect(typeof result).toBe('boolean');
      });
    });
  });
});
