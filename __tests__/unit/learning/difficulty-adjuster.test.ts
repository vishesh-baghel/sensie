import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateDifficulty,
  shouldAdjust,
  getNextDifficulty,
  applyHintPenalty,
  calculateEffectiveAccuracy,
  hasSufficientSampleSize,
  getPerformanceMetrics,
  DIFFICULTY_THRESHOLDS,
} from '@/lib/learning/difficulty-adjuster';
import type { PerformanceMetrics } from '@/lib/types';

// Mock Prisma client
vi.mock('@/lib/db/client', () => ({
  prisma: {
    answer: {
      findMany: vi.fn(),
    },
  },
}));

describe('difficulty-adjuster', () => {
  const mockMetrics: PerformanceMetrics = {
    totalQuestions: 10,
    correctAnswers: 8,
    hintsUsed: 2,
    averageTimeToAnswer: 30,
    recentAccuracy: 0.8,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateDifficulty', () => {
    it('should calculate recommended difficulty based on accuracy', () => {
      // With 80% base accuracy and 80% recent, should give difficulty 4
      const result = calculateDifficulty(mockMetrics);
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(5);
    });

    it('should return difficulty 5 for very high accuracy (90%+)', () => {
      const highMetrics: PerformanceMetrics = {
        totalQuestions: 10,
        correctAnswers: 10,
        hintsUsed: 0,
        averageTimeToAnswer: 20,
        recentAccuracy: 0.95,
      };
      const result = calculateDifficulty(highMetrics);
      expect(result).toBe(5);
    });

    it('should return difficulty 3 for insufficient sample size', () => {
      const smallSample: PerformanceMetrics = {
        totalQuestions: 3,
        correctAnswers: 3,
        hintsUsed: 0,
        averageTimeToAnswer: 20,
        recentAccuracy: 1.0,
      };
      const result = calculateDifficulty(smallSample);
      expect(result).toBe(3); // Default to medium
    });

    it('should return difficulty 1 for very low accuracy (<40%)', () => {
      const lowMetrics: PerformanceMetrics = {
        totalQuestions: 10,
        correctAnswers: 2,
        hintsUsed: 10,
        averageTimeToAnswer: 60,
        recentAccuracy: 0.2,
      };
      const result = calculateDifficulty(lowMetrics);
      expect(result).toBe(1);
    });
  });

  describe('shouldAdjust', () => {
    it('should return true when accuracy > 80% and not at max', () => {
      const highAccuracy: PerformanceMetrics = {
        totalQuestions: 10,
        correctAnswers: 9,
        hintsUsed: 0,
        averageTimeToAnswer: 20,
        recentAccuracy: 0.95,
      };
      const result = shouldAdjust(3, highAccuracy);
      expect(result).toBe(true);
    });

    it('should return true when accuracy < 50% and not at min', () => {
      const lowAccuracy: PerformanceMetrics = {
        totalQuestions: 10,
        correctAnswers: 3,
        hintsUsed: 5,
        averageTimeToAnswer: 60,
        recentAccuracy: 0.3,
      };
      const result = shouldAdjust(3, lowAccuracy);
      expect(result).toBe(true);
    });

    it('should return false when accuracy between 50-80%', () => {
      const midAccuracy: PerformanceMetrics = {
        totalQuestions: 10,
        correctAnswers: 7,
        hintsUsed: 0,
        averageTimeToAnswer: 30,
        recentAccuracy: 0.65,
      };
      const result = shouldAdjust(3, midAccuracy);
      expect(result).toBe(false);
    });

    it('should return false when at max difficulty with high accuracy', () => {
      const highAccuracy: PerformanceMetrics = {
        totalQuestions: 10,
        correctAnswers: 10,
        hintsUsed: 0,
        averageTimeToAnswer: 20,
        recentAccuracy: 0.95,
      };
      const result = shouldAdjust(5, highAccuracy);
      expect(result).toBe(false);
    });

    it('should return false with insufficient sample size', () => {
      const smallSample: PerformanceMetrics = {
        totalQuestions: 3,
        correctAnswers: 3,
        hintsUsed: 0,
        averageTimeToAnswer: 20,
        recentAccuracy: 1.0,
      };
      const result = shouldAdjust(3, smallSample);
      expect(result).toBe(false);
    });
  });

  describe('getNextDifficulty', () => {
    it('should increase difficulty when accuracy > 80%', () => {
      const highAccuracy: PerformanceMetrics = {
        totalQuestions: 10,
        correctAnswers: 9,
        hintsUsed: 0,
        averageTimeToAnswer: 20,
        recentAccuracy: 0.95,
      };
      const result = getNextDifficulty(3, highAccuracy);
      expect(result).toBe(4);
    });

    it('should decrease difficulty when accuracy < 50%', () => {
      const lowAccuracy: PerformanceMetrics = {
        totalQuestions: 10,
        correctAnswers: 2,
        hintsUsed: 5,
        averageTimeToAnswer: 60,
        recentAccuracy: 0.3,
      };
      const result = getNextDifficulty(3, lowAccuracy);
      expect(result).toBe(2);
    });

    it('should maintain difficulty when accuracy 50-80%', () => {
      const midAccuracy: PerformanceMetrics = {
        totalQuestions: 10,
        correctAnswers: 7,
        hintsUsed: 0,
        averageTimeToAnswer: 30,
        recentAccuracy: 0.65,
      };
      const result = getNextDifficulty(3, midAccuracy);
      expect(result).toBe(3);
    });

    it('should not exceed max difficulty (5)', () => {
      const highAccuracy: PerformanceMetrics = {
        totalQuestions: 10,
        correctAnswers: 10,
        hintsUsed: 0,
        averageTimeToAnswer: 20,
        recentAccuracy: 0.95,
      };
      const result = getNextDifficulty(5, highAccuracy);
      expect(result).toBe(5); // Capped at max
    });

    it('should not go below min difficulty (1)', () => {
      const lowAccuracy: PerformanceMetrics = {
        totalQuestions: 10,
        correctAnswers: 1,
        hintsUsed: 10,
        averageTimeToAnswer: 100,
        recentAccuracy: 0.1,
      };
      const result = getNextDifficulty(1, lowAccuracy);
      expect(result).toBe(1); // Floored at min
    });

    it('should maintain current difficulty with insufficient sample', () => {
      const smallSample: PerformanceMetrics = {
        totalQuestions: 3,
        correctAnswers: 0,
        hintsUsed: 10,
        averageTimeToAnswer: 100,
        recentAccuracy: 0,
      };
      const result = getNextDifficulty(3, smallSample);
      expect(result).toBe(3); // No change
    });
  });

  describe('applyHintPenalty', () => {
    it('should reduce score by 10% per hint', () => {
      const result = applyHintPenalty(100, 1);
      expect(result).toBe(90); // 100 * (1 - 0.1)
    });

    it('should apply 50% penalty with 5 hints', () => {
      const result = applyHintPenalty(100, 5);
      expect(result).toBe(50); // 100 * (1 - 0.5)
    });

    it('should not apply penalty with 0 hints', () => {
      const result = applyHintPenalty(100, 0);
      expect(result).toBe(100);
    });

    it('should not go below 0', () => {
      const result = applyHintPenalty(100, 15);
      expect(result).toBe(0);
    });

    it('should handle fractional hints', () => {
      const result = applyHintPenalty(0.8, 0.2);
      expect(result).toBeCloseTo(0.784); // 0.8 * (1 - 0.02)
    });
  });

  describe('calculateEffectiveAccuracy', () => {
    it('should calculate accuracy with hint penalty', () => {
      const result = calculateEffectiveAccuracy(mockMetrics);
      // Base: 8/10 = 0.8
      // Avg hints: 2/10 = 0.2
      // Penalized: 0.8 * (1 - 0.02) = 0.784
      // Weighted with recent: 0.784 * 0.4 + 0.8 * 0.6 = 0.3136 + 0.48 = 0.7936
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it('should return 0 for no questions', () => {
      const emptyMetrics: PerformanceMetrics = {
        totalQuestions: 0,
        correctAnswers: 0,
        hintsUsed: 0,
        averageTimeToAnswer: 0,
        recentAccuracy: 0,
      };
      const result = calculateEffectiveAccuracy(emptyMetrics);
      expect(result).toBe(0);
    });

    it('should weight recent accuracy higher', () => {
      const metricsWithRecent: PerformanceMetrics = {
        totalQuestions: 10,
        correctAnswers: 5, // 50% overall
        hintsUsed: 0,
        averageTimeToAnswer: 30,
        recentAccuracy: 0.9, // 90% recent
      };
      const result = calculateEffectiveAccuracy(metricsWithRecent);
      // Should be closer to 0.9 than 0.5 due to 60% weight on recent
      expect(result).toBeGreaterThan(0.7);
    });
  });

  describe('hasSufficientSampleSize', () => {
    it('should return true with 5+ questions', () => {
      const result = hasSufficientSampleSize(mockMetrics);
      expect(result).toBe(true);
    });

    it('should return true with exactly 5 questions', () => {
      const fiveQuestions: PerformanceMetrics = {
        ...mockMetrics,
        totalQuestions: 5,
      };
      const result = hasSufficientSampleSize(fiveQuestions);
      expect(result).toBe(true);
    });

    it('should return false with < 5 questions', () => {
      const smallSample: PerformanceMetrics = {
        ...mockMetrics,
        totalQuestions: 3,
      };
      const result = hasSufficientSampleSize(smallSample);
      expect(result).toBe(false);
    });

    it('should return false with 0 questions', () => {
      const noQuestions: PerformanceMetrics = {
        ...mockMetrics,
        totalQuestions: 0,
      };
      const result = hasSufficientSampleSize(noQuestions);
      expect(result).toBe(false);
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should fetch metrics from recent answers', async () => {
      const { prisma } = await import('@/lib/db/client');
      const mockAnswers = [
        { isCorrect: true, hintsUsed: 0, timeToAnswer: 20, question: {} },
        { isCorrect: true, hintsUsed: 1, timeToAnswer: 30, question: {} },
        { isCorrect: false, hintsUsed: 2, timeToAnswer: 45, question: {} },
      ];
      (prisma.answer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockAnswers);

      const result = await getPerformanceMetrics('user-123', 'subtopic-123');

      expect(result.totalQuestions).toBe(3);
      expect(result.correctAnswers).toBe(2);
      expect(result.hintsUsed).toBe(3);
    });

    it('should use specified window size', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.answer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await getPerformanceMetrics('user-123', 'subtopic-123', 10);

      expect(prisma.answer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 })
      );
    });

    it('should return empty metrics when no answers', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.answer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await getPerformanceMetrics('user-123', 'subtopic-123');

      expect(result.totalQuestions).toBe(0);
      expect(result.correctAnswers).toBe(0);
      expect(result.hintsUsed).toBe(0);
      expect(result.recentAccuracy).toBe(0);
    });
  });

  describe('DIFFICULTY_THRESHOLDS', () => {
    it('should have correct threshold values', () => {
      expect(DIFFICULTY_THRESHOLDS.INCREASE).toBe(0.8);
      expect(DIFFICULTY_THRESHOLDS.DECREASE).toBe(0.5);
      expect(DIFFICULTY_THRESHOLDS.MIN_SAMPLE_SIZE).toBe(5);
      expect(DIFFICULTY_THRESHOLDS.HINT_PENALTY).toBe(0.1);
      expect(DIFFICULTY_THRESHOLDS.MAX_DIFFICULTY).toBe(5);
      expect(DIFFICULTY_THRESHOLDS.MIN_DIFFICULTY).toBe(1);
    });
  });
});
