import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateTopicMastery,
  calculateSubtopicMastery,
  updateMastery,
  isTopicMastered,
  calculateWeightedMastery,
  applyRecencyDecay,
  getProgressSummary,
  shouldUnlockNextSubtopic,
  getNextAction,
} from '@/lib/learning/progress-tracker';

// Mock Prisma client
vi.mock('@/lib/db/client', () => ({
  prisma: {
    subtopic: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    answer: {
      findMany: vi.fn(),
    },
    topic: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    concept: {
      count: vi.fn(),
    },
    review: {
      count: vi.fn(),
    },
  },
}));

describe('progress-tracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateTopicMastery', () => {
    it('should calculate mastery from subtopics', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.subtopic.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'sub-1', concepts: [{ id: 'c1' }, { id: 'c2' }] },
        { id: 'sub-2', concepts: [{ id: 'c3' }] },
      ]);
      // Mock subtopic mastery calculations
      (prisma.answer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await calculateTopicMastery('topic-123', 'user-123');

      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    });

    it('should return 0 for topic with no subtopics', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.subtopic.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await calculateTopicMastery('topic-123', 'user-123');

      expect(result).toBe(0);
    });
  });

  describe('calculateSubtopicMastery', () => {
    it('should calculate mastery from answers', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.answer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { isCorrect: true, depth: 'DEEP', hintsUsed: 0, createdAt: new Date(), question: {} },
        { isCorrect: true, depth: 'SHALLOW', hintsUsed: 1, createdAt: new Date(), question: {} },
        { isCorrect: false, depth: 'SHALLOW', hintsUsed: 2, createdAt: new Date(), question: {} },
      ]);

      const result = await calculateSubtopicMastery('subtopic-123', 'user-123');

      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    });

    it('should return 0 with no answers', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.answer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await calculateSubtopicMastery('subtopic-123', 'user-123');

      expect(result).toBe(0);
    });
  });

  describe('updateMastery', () => {
    it('should update mastery in database', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.subtopic.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'sub-1', concepts: [] },
      ]);
      (prisma.answer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.topic.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (prisma.subtopic.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await updateMastery('topic-123', 'user-123');

      expect(prisma.topic.update).toHaveBeenCalled();
    });
  });

  describe('isTopicMastered', () => {
    it('should return true when mastery >= threshold', () => {
      const result = isTopicMastered(85, 80);
      expect(result).toBe(true);
    });

    it('should return false when mastery < threshold', () => {
      const result = isTopicMastered(75, 80);
      expect(result).toBe(false);
    });

    it('should use user-configured threshold', () => {
      const result = isTopicMastered(60, 50);
      expect(result).toBe(true);
    });

    it('should return true when mastery equals threshold', () => {
      const result = isTopicMastered(80, 80);
      expect(result).toBe(true);
    });
  });

  describe('calculateWeightedMastery', () => {
    it('should calculate mastery with weighted factors', () => {
      const metrics = {
        correctAnswers: 8,
        totalAnswers: 10,
        deepAnswers: 5,
        hintsUsed: 2,
        daysSinceLastActivity: 1,
      };

      const result = calculateWeightedMastery(metrics);

      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    });

    it('should return perfect score for perfect performance', () => {
      const metrics = {
        correctAnswers: 10,
        totalAnswers: 10,
        deepAnswers: 10,
        hintsUsed: 0,
        daysSinceLastActivity: 0,
      };

      const result = calculateWeightedMastery(metrics);

      expect(result).toBe(100);
    });

    it('should return 0 for no answers', () => {
      const metrics = {
        correctAnswers: 0,
        totalAnswers: 0,
        deepAnswers: 0,
        hintsUsed: 0,
        daysSinceLastActivity: 0,
      };

      const result = calculateWeightedMastery(metrics);

      expect(result).toBe(0);
    });

    it('should penalize hint usage', () => {
      const withHints = {
        correctAnswers: 10,
        totalAnswers: 10,
        deepAnswers: 10,
        hintsUsed: 20,
        daysSinceLastActivity: 0,
      };

      const withoutHints = {
        correctAnswers: 10,
        totalAnswers: 10,
        deepAnswers: 10,
        hintsUsed: 0,
        daysSinceLastActivity: 0,
      };

      expect(calculateWeightedMastery(withHints)).toBeLessThan(calculateWeightedMastery(withoutHints));
    });
  });

  describe('applyRecencyDecay', () => {
    it('should not decay for recent activity (0 days)', () => {
      const result = applyRecencyDecay(80, 0);
      expect(result).toBe(80);
    });

    it('should not decay for negative days', () => {
      const result = applyRecencyDecay(80, -1);
      expect(result).toBe(80);
    });

    it('should apply decay for old activity', () => {
      const result = applyRecencyDecay(80, 14);
      expect(result).toBeLessThan(80);
      expect(result).toBeGreaterThan(0);
    });

    it('should cap decay at maximum (30%)', () => {
      const result = applyRecencyDecay(100, 365);
      // Max 30% decay means at least 70% retained
      expect(result).toBeGreaterThanOrEqual(70);
    });
  });

  describe('getProgressSummary', () => {
    it('should return complete progress summary', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.topic.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'topic-123',
        masteryPercentage: 65,
        subtopics: [
          { id: 'sub-1', masteryPercentage: 80, concepts: [{ id: 'c1' }, { id: 'c2' }] },
          { id: 'sub-2', masteryPercentage: 50, concepts: [{ id: 'c3' }] },
        ],
      });
      (prisma.answer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { isCorrect: true },
        { isCorrect: true },
        { isCorrect: false },
      ]);
      (prisma.concept.count as ReturnType<typeof vi.fn>).mockResolvedValue(2);

      const result = await getProgressSummary('topic-123', 'user-123');

      expect(result).toHaveProperty('topicMastery');
      expect(result).toHaveProperty('subtopicsCompleted');
      expect(result).toHaveProperty('totalSubtopics');
      expect(result).toHaveProperty('conceptsMastered');
      expect(result).toHaveProperty('questionsAnswered');
      expect(result).toHaveProperty('correctRate');
    });

    it('should throw error for non-existent topic', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.topic.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(getProgressSummary('nonexistent', 'user-123')).rejects.toThrow('Topic not found');
    });
  });

  describe('shouldUnlockNextSubtopic', () => {
    it('should return true when current subtopic >= 70% mastery', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.subtopic.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'subtopic-123',
        masteryPercentage: 75,
      });

      const result = await shouldUnlockNextSubtopic('subtopic-123');

      expect(result).toBe(true);
    });

    it('should return false when current subtopic < 70% mastery', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.subtopic.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'subtopic-123',
        masteryPercentage: 60,
      });

      const result = await shouldUnlockNextSubtopic('subtopic-123');

      expect(result).toBe(false);
    });

    it('should return false for non-existent subtopic', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.subtopic.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await shouldUnlockNextSubtopic('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('getNextAction', () => {
    it('should return complete when topic is mastered', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.topic.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'topic-123',
        masteryPercentage: 100,
        status: 'COMPLETED',
        subtopics: [],
      });

      const result = await getNextAction('topic-123', 'user-123');

      expect(result.action).toBe('complete');
    });

    it('should return review when reviews are due', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.topic.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'topic-123',
        masteryPercentage: 50,
        status: 'ACTIVE',
        subtopics: [],
      });
      (prisma.review.count as ReturnType<typeof vi.fn>).mockResolvedValue(5);

      const result = await getNextAction('topic-123', 'user-123');

      expect(result.action).toBe('review');
    });

    it('should return continue when in progress', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.topic.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'topic-123',
        masteryPercentage: 30,
        status: 'ACTIVE',
        subtopics: [
          {
            id: 'sub-1',
            isLocked: false,
            masteryPercentage: 30,
            order: 1,
            concepts: [{ id: 'c1', isMastered: false }],
          },
        ],
      });
      (prisma.review.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      const result = await getNextAction('topic-123', 'user-123');

      expect(result.action).toBe('continue');
      expect(result.subtopicId).toBe('sub-1');
      expect(result.conceptId).toBe('c1');
    });

    it('should throw error for non-existent topic', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.topic.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(getNextAction('nonexistent', 'user-123')).rejects.toThrow('Topic not found');
    });
  });
});
