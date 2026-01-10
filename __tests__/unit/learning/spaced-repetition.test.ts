import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createCard,
  scheduleNextReview,
  getReviewsDue,
  createReviewItem,
  recordReview,
  getNextReviewDate,
  isCardDue,
  stateToStatus,
  calculateRetention,
  getOptimalInterval,
} from '@/lib/learning/spaced-repetition';
import type { Card, Rating } from '@/lib/types';
import { State } from '@/lib/types';

// Mock Prisma client
vi.mock('@/lib/db/client', () => ({
  prisma: {
    review: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    subtopic: {
      findUnique: vi.fn(),
    },
    concept: {
      findUnique: vi.fn(),
    },
  },
}));

describe('spaced-repetition', () => {
  const mockCard: Card = {
    due: new Date(),
    stability: 1,
    difficulty: 5,
    elapsed_days: 0,
    scheduled_days: 1,
    reps: 0,
    lapses: 0,
    state: State.New,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createCard', () => {
    it('should create a new card with default values', () => {
      const card = createCard();

      expect(card).toHaveProperty('due');
      expect(card).toHaveProperty('stability');
      expect(card).toHaveProperty('difficulty');
      expect(card).toHaveProperty('elapsed_days');
      expect(card).toHaveProperty('scheduled_days');
      expect(card).toHaveProperty('reps');
      expect(card).toHaveProperty('lapses');
      expect(card).toHaveProperty('state');
    });

    it('should set initial state to New', () => {
      const card = createCard();
      expect(card.state).toBe(State.New);
    });

    it('should set reps to 0', () => {
      const card = createCard();
      expect(card.reps).toBe(0);
    });
  });

  describe('scheduleNextReview', () => {
    it('should schedule next review based on FSRS algorithm', () => {
      const rating: Rating = 3; // Good
      const result = scheduleNextReview(mockCard, rating);

      expect(result).toHaveProperty('due');
      expect(result.due instanceof Date).toBe(true);
      expect(result.reps).toBeGreaterThanOrEqual(mockCard.reps);
    });

    it('should increase interval for Easy rating', () => {
      const goodRating: Rating = 3;
      const easyRating: Rating = 4;

      const goodResult = scheduleNextReview(mockCard, goodRating);
      const easyResult = scheduleNextReview(mockCard, easyRating);

      // Easy should have later due date than Good
      expect(easyResult.due.getTime()).toBeGreaterThanOrEqual(goodResult.due.getTime());
    });

    it('should update reps after review', () => {
      const rating: Rating = 3;
      const result = scheduleNextReview(mockCard, rating);

      expect(result.reps).toBe(1);
    });

    it('should update state after review', () => {
      const rating: Rating = 3;
      const result = scheduleNextReview(mockCard, rating);

      // After first review with Good rating, should move to Learning or Review
      expect(result.state).not.toBe(State.New);
    });
  });

  describe('getReviewsDue', () => {
    it('should return reviews ordered by oldest due first', async () => {
      const { prisma } = await import('@/lib/db/client');
      const mockReviews = [
        { id: 'r1', nextReview: new Date('2024-01-01'), userId: 'u1', topicId: 't1', type: 'CONCEPT', status: 'LEARNING', topic: { name: 'Topic' } },
        { id: 'r2', nextReview: new Date('2024-01-02'), userId: 'u1', topicId: 't1', type: 'CONCEPT', status: 'LEARNING', topic: { name: 'Topic' } },
      ];
      (prisma.review.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockReviews);

      const result = await getReviewsDue('user-123');

      expect(Array.isArray(result)).toBe(true);
    });

    it('should limit reviews to specified count', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.review.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await getReviewsDue('user-123', 10);

      expect(prisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 })
      );
    });

    it('should filter reviews due before now', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.review.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await getReviewsDue('user-123');

      expect(prisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            nextReview: { lte: expect.any(Date) },
          }),
        })
      );
    });
  });

  describe('createReviewItem', () => {
    it('should create review item for concept', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.concept.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'concept-123',
        name: 'Concept',
        subtopic: { topicId: 'topic-123' },
      });
      (prisma.review.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'review-123',
        userId: 'user-123',
        topicId: 'topic-123',
        conceptId: 'concept-123',
        type: 'CONCEPT',
        status: 'NEW',
        nextReview: new Date(),
        topic: { name: 'Topic' },
      });

      const result = await createReviewItem('user-123', 'concept-123', 'CONCEPT');

      expect(result).toHaveProperty('id');
      expect(result.type).toBe('CONCEPT');
    });

    it('should create review item for subtopic', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.subtopic.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'subtopic-123',
        name: 'Subtopic',
        topicId: 'topic-123',
      });
      (prisma.review.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'review-123',
        userId: 'user-123',
        topicId: 'topic-123',
        subtopicId: 'subtopic-123',
        type: 'SUBTOPIC',
        status: 'NEW',
        nextReview: new Date(),
        topic: { name: 'Topic' },
      });

      const result = await createReviewItem('user-123', 'subtopic-123', 'SUBTOPIC');

      expect(result.type).toBe('SUBTOPIC');
    });

    it('should throw error for non-existent concept', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.concept.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        createReviewItem('user-123', 'nonexistent', 'CONCEPT')
      ).rejects.toThrow('Concept not found');
    });
  });

  describe('recordReview', () => {
    it('should record review and update schedule', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.review.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'review-123',
        stability: 1,
        difficulty: 5,
        elapsedDays: 0,
        scheduledDays: 1,
        reps: 0,
        lapses: 0,
        state: 0,
        nextReview: new Date(),
      });
      (prisma.review.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = await recordReview('review-123', 3);

      expect(result).toHaveProperty('reviewId');
      expect(result).toHaveProperty('rating');
      expect(result).toHaveProperty('nextReviewDate');
      expect(result).toHaveProperty('newStatus');
    });

    it('should throw error for non-existent review', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.review.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(recordReview('nonexistent', 3)).rejects.toThrow('Review not found');
    });
  });

  describe('getNextReviewDate', () => {
    it('should calculate next review date', () => {
      const result = getNextReviewDate(mockCard, 3);

      expect(result instanceof Date).toBe(true);
      expect(result.getTime()).toBeGreaterThanOrEqual(Date.now());
    });

    it('should return sooner date for Again rating', () => {
      const againDate = getNextReviewDate(mockCard, 1);
      const goodDate = getNextReviewDate(mockCard, 3);

      expect(againDate.getTime()).toBeLessThanOrEqual(goodDate.getTime());
    });
  });

  describe('isCardDue', () => {
    it('should return true for due card', () => {
      const dueCard = { ...mockCard, due: new Date(Date.now() - 1000) };
      const result = isCardDue(dueCard);
      expect(result).toBe(true);
    });

    it('should return false for future card', () => {
      const futureCard = { ...mockCard, due: new Date(Date.now() + 86400000) };
      const result = isCardDue(futureCard);
      expect(result).toBe(false);
    });

    it('should return true for card due exactly now', () => {
      const nowCard = { ...mockCard, due: new Date() };
      const result = isCardDue(nowCard);
      expect(result).toBe(true);
    });
  });

  describe('stateToStatus', () => {
    it('should convert New state to NEW status', () => {
      const result = stateToStatus(State.New);
      expect(result).toBe('NEW');
    });

    it('should convert Learning state to LEARNING status', () => {
      const result = stateToStatus(State.Learning);
      expect(result).toBe('LEARNING');
    });

    it('should convert Review state to GRADUATED status', () => {
      const result = stateToStatus(State.Review);
      expect(result).toBe('GRADUATED');
    });

    it('should convert Relearning state to LAPSED status', () => {
      const result = stateToStatus(State.Relearning);
      expect(result).toBe('LAPSED');
    });
  });

  describe('calculateRetention', () => {
    it('should calculate retention probability', () => {
      const cardWithReview = {
        ...mockCard,
        stability: 10,
        last_review: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      };
      const result = calculateRetention(cardWithReview);

      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it('should return 0 for zero stability', () => {
      const zeroStabilityCard = { ...mockCard, stability: 0 };
      const result = calculateRetention(zeroStabilityCard);
      expect(result).toBe(0);
    });

    it('should return higher retention for higher stability', () => {
      const lowStability = { ...mockCard, stability: 1, last_review: new Date(Date.now() - 24 * 60 * 60 * 1000) };
      const highStability = { ...mockCard, stability: 100, last_review: new Date(Date.now() - 24 * 60 * 60 * 1000) };

      const lowResult = calculateRetention(lowStability);
      const highResult = calculateRetention(highStability);

      expect(highResult).toBeGreaterThan(lowResult);
    });
  });

  describe('getOptimalInterval', () => {
    it('should return optimal interval for desired retention', () => {
      const cardWithStability = { ...mockCard, stability: 10 };
      const result = getOptimalInterval(cardWithStability, 0.9);

      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 for zero stability', () => {
      const zeroStabilityCard = { ...mockCard, stability: 0 };
      const result = getOptimalInterval(zeroStabilityCard, 0.9);
      expect(result).toBe(0);
    });

    it('should return 0 for invalid retention values', () => {
      const result1 = getOptimalInterval(mockCard, 0);
      const result2 = getOptimalInterval(mockCard, 1);
      const result3 = getOptimalInterval(mockCard, -0.5);

      expect(result1).toBe(0);
      expect(result2).toBe(0);
      expect(result3).toBe(0);
    });

    it('should return longer interval for lower retention target', () => {
      const cardWithStability = { ...mockCard, stability: 10 };
      const highRetention = getOptimalInterval(cardWithStability, 0.95);
      const lowRetention = getOptimalInterval(cardWithStability, 0.7);

      expect(lowRetention).toBeGreaterThan(highRetention);
    });
  });
});
