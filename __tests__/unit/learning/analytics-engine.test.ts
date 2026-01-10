/**
 * Analytics Engine Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
vi.mock('@/lib/db/client', () => ({
  prisma: {
    learningAnalytics: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    userProgress: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    badge: {
      findMany: vi.fn(),
    },
    learningSession: {
      findMany: vi.fn(),
    },
    answer: {
      findMany: vi.fn(),
    },
    review: {
      findMany: vi.fn(),
    },
    feynmanExercise: {
      findMany: vi.fn(),
    },
    topic: {
      count: vi.fn(),
    },
    concept: {
      count: vi.fn(),
    },
  },
}));

import {
  getLearningAnalytics,
  recordAnalytics,
  updateStreak,
  awardXP,
  calculateLevel,
  getXPForNextLevel,
} from '@/lib/learning/analytics-engine';
import { prisma } from '@/lib/db/client';

describe('analytics-engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getLearningAnalytics', () => {
    const mockSetup = () => {
      (prisma.learningAnalytics.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          date: new Date(),
          questionsAnswered: 10,
          questionsCorrect: 8,
          xpEarned: 150,
          timeSpent: 30,
        },
      ]);
      (prisma.userProgress.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        totalXP: 1500,
        currentStreak: 5,
        longestStreak: 10,
      });
      (prisma.badge.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { name: 'First Steps' },
      ]);
      (prisma.learningSession.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { createdAt: new Date(), lastActivity: new Date(Date.now() + 30 * 60 * 1000) },
      ]);
      (prisma.answer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { isCorrect: true },
        { isCorrect: true },
        { isCorrect: false },
      ]);
      (prisma.review.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: '1' }]);
      (prisma.feynmanExercise.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.topic.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      (prisma.concept.count as ReturnType<typeof vi.fn>).mockResolvedValue(5);
    };

    it('should return analytics for daily period', async () => {
      mockSetup();

      const analytics = await getLearningAnalytics('user-1', 'daily');

      expect(analytics.period).toBe('daily');
      expect(analytics.userId).toBe('user-1');
      expect(analytics.questionsAnswered).toBe(3);
      expect(analytics.questionsCorrect).toBe(2);
      expect(analytics.accuracy).toBe(67); // 2/3 = 66.67%
    });

    it('should return analytics for weekly period', async () => {
      mockSetup();

      const analytics = await getLearningAnalytics('user-1', 'weekly');

      expect(analytics.period).toBe('weekly');
      expect(analytics.currentStreak).toBe(5);
      expect(analytics.longestStreak).toBe(10);
    });

    it('should return analytics for all-time period', async () => {
      mockSetup();

      const analytics = await getLearningAnalytics('user-1', 'all-time');

      expect(analytics.period).toBe('all-time');
    });

    it('should calculate 0 accuracy for no answers', async () => {
      mockSetup();
      (prisma.answer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const analytics = await getLearningAnalytics('user-1', 'daily');

      expect(analytics.accuracy).toBe(0);
      expect(analytics.questionsAnswered).toBe(0);
    });
  });

  describe('recordAnalytics', () => {
    it('should upsert analytics record', async () => {
      (prisma.learningAnalytics.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await recordAnalytics('user-1', {
        questionsAnswered: 5,
        questionsCorrect: 4,
        xpEarned: 100,
      });

      expect(prisma.learningAnalytics.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId_date: expect.objectContaining({
              userId: 'user-1',
            }),
          }),
        })
      );
    });
  });

  describe('updateStreak', () => {
    it('should create initial streak for new user', async () => {
      (prisma.userProgress.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.userProgress.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        currentStreak: 1,
        longestStreak: 1,
      });

      const result = await updateStreak('user-1');

      expect(result.currentStreak).toBe(1);
      expect(result.longestStreak).toBe(1);
      expect(result.streakBroken).toBe(false);
    });

    it('should increment streak for consecutive day', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      (prisma.userProgress.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: 'user-1',
        currentStreak: 5,
        longestStreak: 10,
        lastActivityDate: yesterday,
      });
      (prisma.userProgress.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        currentStreak: 6,
        longestStreak: 10,
      });

      const result = await updateStreak('user-1');

      expect(result.currentStreak).toBe(6);
      expect(result.streakBroken).toBe(false);
    });

    it('should break streak for non-consecutive day', async () => {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      (prisma.userProgress.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: 'user-1',
        currentStreak: 5,
        longestStreak: 10,
        lastActivityDate: threeDaysAgo,
      });
      (prisma.userProgress.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        currentStreak: 1,
        longestStreak: 10,
      });

      const result = await updateStreak('user-1');

      expect(result.currentStreak).toBe(1);
      expect(result.streakBroken).toBe(true);
    });

    it('should not change streak for same day activity', async () => {
      const today = new Date();

      (prisma.userProgress.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: 'user-1',
        currentStreak: 5,
        longestStreak: 10,
        lastActivityDate: today,
      });
      (prisma.userProgress.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        currentStreak: 5,
        longestStreak: 10,
      });

      const result = await updateStreak('user-1');

      expect(result.currentStreak).toBe(5);
      expect(result.streakBroken).toBe(false);
    });
  });

  describe('awardXP', () => {
    it('should award XP and record analytics', async () => {
      (prisma.userProgress.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
        totalXP: 200,
        currentLevel: 1,
      });
      (prisma.learningAnalytics.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const totalXP = await awardXP('user-1', 100, 'correct answer');

      expect(totalXP).toBe(200);
      expect(prisma.userProgress.upsert).toHaveBeenCalled();
      expect(prisma.learningAnalytics.upsert).toHaveBeenCalled();
    });
  });

  describe('calculateLevel', () => {
    // Level calculation: threshold starts at 100, increases by 200 each level
    // Level 1: 0-99 XP
    // Level 2: 100-399 XP (100 + 300-1 = 399)
    // Level 3: 400-899 XP (400 + 500-1 = 899)
    // etc.

    it('should return level 1 for 0-99 XP', () => {
      expect(calculateLevel(0)).toBe(1);
      expect(calculateLevel(50)).toBe(1);
      expect(calculateLevel(99)).toBe(1);
    });

    it('should return level 2 for 100-399 XP', () => {
      expect(calculateLevel(100)).toBe(2);
      expect(calculateLevel(200)).toBe(2);
      expect(calculateLevel(399)).toBe(2);
    });

    it('should return level 3 for 400-899 XP', () => {
      expect(calculateLevel(400)).toBe(3);
      expect(calculateLevel(600)).toBe(3);
      expect(calculateLevel(899)).toBe(3);
    });

    it('should cap at level 10', () => {
      expect(calculateLevel(100000)).toBe(10);
    });

    it('should handle edge cases', () => {
      expect(calculateLevel(-10)).toBe(1);
    });
  });

  describe('getXPForNextLevel', () => {
    it('should return correct thresholds', () => {
      expect(getXPForNextLevel(1)).toBe(100);
      expect(getXPForNextLevel(2)).toBe(300);
      expect(getXPForNextLevel(3)).toBe(500);
    });
  });
});
