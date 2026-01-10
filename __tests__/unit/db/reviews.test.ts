import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createReview,
  getReviewsDue,
  getReviewById,
  countReviewsDue,
  updateReviewAfterRating,
  getReviewsByStatus,
  reviewExistsForItem,
  getReviewStats,
} from '@/lib/db/reviews';

// Mock Prisma client
vi.mock('@/lib/db/client', () => ({
  prisma: {
    review: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
}));

describe('reviews db module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createReview', () => {
    it('should create a review for a concept', async () => {
      const { prisma } = await import('@/lib/db/client');
      const mockReview = {
        id: 'review-123',
        userId: 'user-123',
        topicId: 'topic-123',
        subtopicId: 'subtopic-123',
        conceptId: 'concept-123',
        type: 'CONCEPT',
        status: 'NEW',
        nextReview: new Date(),
      };
      (prisma.review.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockReview);

      const input = {
        userId: 'user-123',
        topicId: 'topic-123',
        subtopicId: 'subtopic-123',
        conceptId: 'concept-123',
        type: 'CONCEPT' as const,
        nextReview: new Date(),
      };

      const result = await createReview(input);

      expect(result).toEqual(mockReview);
      expect(prisma.review.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          topicId: 'topic-123',
          subtopicId: 'subtopic-123',
          conceptId: 'concept-123',
          type: 'CONCEPT',
          nextReview: input.nextReview,
          status: 'NEW',
        },
      });
    });

    it('should create a review for a topic', async () => {
      const { prisma } = await import('@/lib/db/client');
      const mockReview = {
        id: 'review-123',
        userId: 'user-123',
        topicId: 'topic-123',
        type: 'TOPIC',
        status: 'NEW',
        nextReview: new Date(),
      };
      (prisma.review.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockReview);

      const input = {
        userId: 'user-123',
        topicId: 'topic-123',
        type: 'TOPIC' as const,
        nextReview: new Date(),
      };

      const result = await createReview(input);

      expect(result.type).toBe('TOPIC');
      expect(result.status).toBe('NEW');
    });
  });

  describe('getReviewsDue', () => {
    it('should return reviews due before now', async () => {
      const { prisma } = await import('@/lib/db/client');
      const mockReviews = [
        { id: 'review-1', nextReview: new Date('2024-01-01') },
        { id: 'review-2', nextReview: new Date('2024-01-02') },
      ];
      (prisma.review.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockReviews);

      const result = await getReviewsDue('user-123');

      expect(result).toEqual(mockReviews);
      expect(prisma.review.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          nextReview: { lte: expect.any(Date) },
        },
        orderBy: { nextReview: 'asc' },
        take: 20, // MAX_REVIEWS_PER_SESSION
      });
    });

    it('should limit results when specified', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.review.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await getReviewsDue('user-123', 10);

      expect(prisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 })
      );
    });

    it('should order by oldest due first', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.review.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await getReviewsDue('user-123');

      expect(prisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { nextReview: 'asc' },
        })
      );
    });
  });

  describe('getReviewById', () => {
    it('should return review by id', async () => {
      const { prisma } = await import('@/lib/db/client');
      const mockReview = { id: 'review-123', userId: 'user-123' };
      (prisma.review.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockReview);

      const result = await getReviewById('review-123');

      expect(result).toEqual(mockReview);
      expect(prisma.review.findUnique).toHaveBeenCalledWith({
        where: { id: 'review-123' },
      });
    });

    it('should return null for non-existent review', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.review.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await getReviewById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('countReviewsDue', () => {
    it('should return count of due reviews', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.review.count as ReturnType<typeof vi.fn>).mockResolvedValue(5);

      const result = await countReviewsDue('user-123');

      expect(result).toBe(5);
      expect(prisma.review.count).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          nextReview: { lte: expect.any(Date) },
        },
      });
    });
  });

  describe('updateReviewAfterRating', () => {
    it('should update all FSRS fields after rating', async () => {
      const { prisma } = await import('@/lib/db/client');
      const updateData = {
        stability: 5.5,
        difficulty: 4.2,
        elapsedDays: 1,
        scheduledDays: 7,
        reps: 1,
        lapses: 0,
        state: 2,
        lastReviewed: new Date(),
        nextReview: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        lastRating: 3,
        status: 'GRADUATED' as const,
      };
      const mockUpdatedReview = { id: 'review-123', ...updateData };
      (prisma.review.update as ReturnType<typeof vi.fn>).mockResolvedValue(mockUpdatedReview);

      const result = await updateReviewAfterRating('review-123', updateData);

      expect(result.stability).toBe(5.5);
      expect(result.status).toBe('GRADUATED');
      expect(prisma.review.update).toHaveBeenCalledWith({
        where: { id: 'review-123' },
        data: updateData,
      });
    });
  });

  describe('getReviewsByStatus', () => {
    it('should return reviews filtered by status', async () => {
      const { prisma } = await import('@/lib/db/client');
      const mockReviews = [
        { id: 'review-1', status: 'LEARNING' },
        { id: 'review-2', status: 'LEARNING' },
      ];
      (prisma.review.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockReviews);

      const result = await getReviewsByStatus('user-123', 'LEARNING');

      expect(result).toEqual(mockReviews);
      expect(prisma.review.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123', status: 'LEARNING' },
        orderBy: { nextReview: 'asc' },
      });
    });
  });

  describe('reviewExistsForItem', () => {
    it('should return true if review exists', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.review.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'review-123',
      });

      const result = await reviewExistsForItem(
        'user-123',
        'topic-123',
        'subtopic-123',
        'concept-123'
      );

      expect(result).toBe(true);
    });

    it('should return false if no review exists', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.review.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await reviewExistsForItem('user-123', 'topic-123');

      expect(result).toBe(false);
    });
  });

  describe('getReviewStats', () => {
    it('should return review statistics', async () => {
      const { prisma } = await import('@/lib/db/client');
      // Mock the three count calls in order
      (prisma.review.count as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(100) // totalReviews
        .mockResolvedValueOnce(10)  // dueToday
        .mockResolvedValueOnce(50); // graduated

      const result = await getReviewStats('user-123');

      expect(result).toEqual({
        totalReviews: 100,
        dueToday: 10,
        completed: 50,
        averageRetention: 50, // 50/100 * 100
      });
    });

    it('should return 0 retention when no reviews', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.review.count as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(0) // totalReviews
        .mockResolvedValueOnce(0) // dueToday
        .mockResolvedValueOnce(0); // graduated

      const result = await getReviewStats('user-123');

      expect(result.averageRetention).toBe(0);
    });
  });
});
