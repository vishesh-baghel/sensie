import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getDueReviews } from '@/app/api/review/due/route';
import { POST as startReview } from '@/app/api/review/start/route';
import { POST as recordReview } from '@/app/api/review/record/route';
import type { SessionData } from '@/lib/auth/auth';

// Mock session module
vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn(),
  isSessionExpired: vi.fn().mockReturnValue(false),
}));

// Mock auth module
vi.mock('@/lib/auth/auth', () => ({
  requireAuth: vi.fn().mockReturnValue({ authorized: true }),
}));

// Mock db/reviews module
vi.mock('@/lib/db/reviews', () => ({
  getReviewsDue: vi.fn(),
  countReviewsDue: vi.fn(),
  getReviewById: vi.fn(),
  updateReviewAfterRating: vi.fn(),
  getReviewStats: vi.fn(),
}));

// Mock db/progress module
vi.mock('@/lib/db/progress', () => ({
  updateTodayAnalytics: vi.fn(),
}));

// Mock ts-fsrs
vi.mock('ts-fsrs', () => ({
  fsrs: vi.fn().mockReturnValue({
    repeat: vi.fn().mockReturnValue({
      1: { card: { due: new Date(), stability: 1, difficulty: 5, elapsed_days: 0, scheduled_days: 1, reps: 1, lapses: 0, state: 1 } },
      2: { card: { due: new Date(), stability: 2, difficulty: 5, elapsed_days: 0, scheduled_days: 2, reps: 1, lapses: 0, state: 1 } },
      3: { card: { due: new Date(), stability: 3, difficulty: 5, elapsed_days: 0, scheduled_days: 3, reps: 1, lapses: 0, state: 2 } },
      4: { card: { due: new Date(), stability: 5, difficulty: 5, elapsed_days: 0, scheduled_days: 7, reps: 1, lapses: 0, state: 2 } },
    }),
  }),
  Grade: { Again: 1, Hard: 2, Good: 3, Easy: 4 },
  Rating: { Again: 1, Hard: 2, Good: 3, Easy: 4 },
}));

// Mock Prisma client
vi.mock('@/lib/db/client', () => ({
  prisma: {
    concept: {
      findUnique: vi.fn(),
    },
    subtopic: {
      findUnique: vi.fn(),
    },
    topic: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock Sensie agent
vi.mock('@/lib/mastra/agents/sensie', () => ({
  generateQuestion: vi.fn(),
}));

const mockSession: SessionData = {
  userId: 'user-123',
  role: 'owner',
  createdAt: Date.now(),
  expiresAt: Date.now() + 60 * 60 * 24 * 7 * 1000,
};

describe('review API routes', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getSession } = await import('@/lib/auth/session');
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);
    const { requireAuth } = await import('@/lib/auth/auth');
    (requireAuth as ReturnType<typeof vi.fn>).mockReturnValue({ authorized: true });
  });

  describe('GET /api/review/due', () => {
    it('should return due reviews', async () => {
      const { getReviewsDue, countReviewsDue } = await import('@/lib/db/reviews');
      const mockReviews = [
        { id: 'r1', topicId: 't1', nextReview: new Date() },
        { id: 'r2', topicId: 't1', nextReview: new Date() },
      ];
      (getReviewsDue as ReturnType<typeof vi.fn>).mockResolvedValue(mockReviews);
      (countReviewsDue as ReturnType<typeof vi.fn>).mockResolvedValue(5);

      const request = new NextRequest('http://localhost:3000/api/review/due');
      const response = await getDueReviews(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.reviews.length).toBe(2);
      expect(data.reviews[0].id).toBe('r1');
      expect(data.totalDue).toBe(5);
    });

    it('should limit reviews to 20', async () => {
      const { getReviewsDue, countReviewsDue } = await import('@/lib/db/reviews');
      (getReviewsDue as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (countReviewsDue as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      const request = new NextRequest(
        'http://localhost:3000/api/review/due?limit=20'
      );
      await getDueReviews(request);

      expect(getReviewsDue).toHaveBeenCalledWith('user-123', 20);
    });

    it('should order by oldest due first', async () => {
      const { getReviewsDue, countReviewsDue } = await import('@/lib/db/reviews');
      const oldDate = new Date('2024-01-01');
      const newDate = new Date('2024-01-02');
      const mockReviews = [
        { id: 'r1', nextReview: oldDate },
        { id: 'r2', nextReview: newDate },
      ];
      (getReviewsDue as ReturnType<typeof vi.fn>).mockResolvedValue(mockReviews);
      (countReviewsDue as ReturnType<typeof vi.fn>).mockResolvedValue(2);

      const request = new NextRequest('http://localhost:3000/api/review/due');
      const response = await getDueReviews(request);
      const data = await response.json();

      // The DB function should already return ordered results
      expect(data.reviews[0].id).toBe('r1');
    });

    it('should return 401 if not authenticated', async () => {
      const { getSession } = await import('@/lib/auth/session');
      const { requireAuth } = await import('@/lib/auth/auth');
      (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (requireAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        authorized: false,
        error: 'Not authenticated',
      });

      const request = new NextRequest('http://localhost:3000/api/review/due');
      const response = await getDueReviews(request);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/review/start', () => {
    it('should start review session with reviews due', async () => {
      const { getReviewsDue, countReviewsDue, getReviewStats } = await import('@/lib/db/reviews');
      const { prisma } = await import('@/lib/db/client');
      const { generateQuestion } = await import('@/lib/mastra/agents/sensie');

      const mockReviews = [
        {
          id: 'r1',
          topicId: 't1',
          conceptId: 'c1',
          type: 'CONCEPT',
          status: 'LEARNING',
          stability: 1,
          difficulty: 3,
          reps: 2,
          lapses: 0,
          lastReviewed: new Date(),
          nextReview: new Date(),
        },
      ];
      (getReviewsDue as ReturnType<typeof vi.fn>).mockResolvedValue(mockReviews);
      (countReviewsDue as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      (getReviewStats as ReturnType<typeof vi.fn>).mockResolvedValue({
        totalReviews: 10,
        dueToday: 1,
        completed: 8,
        averageRetention: 80,
      });
      (prisma.concept.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'c1',
        name: 'Test Concept',
        subtopic: {
          name: 'Test Subtopic',
          topic: { name: 'Test Topic' },
        },
      });
      (generateQuestion as ReturnType<typeof vi.fn>).mockResolvedValue({
        text: 'What do you know about this concept?',
        type: 'RECALL',
        difficulty: 3,
        expectedElements: [],
        hints: [],
        followUpPrompts: [],
      });

      const request = new NextRequest(
        'http://localhost:3000/api/review/start',
        {
          method: 'POST',
          body: JSON.stringify({}),
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const response = await startReview(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.reviewSession.totalDue).toBe(1);
      expect(data.reviewSession.items.length).toBe(1);
    });

    it('should return no reviews message when none due', async () => {
      const { getReviewsDue, getReviewStats } = await import('@/lib/db/reviews');

      (getReviewsDue as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (getReviewStats as ReturnType<typeof vi.fn>).mockResolvedValue({
        totalReviews: 10,
        dueToday: 0,
        completed: 10,
        averageRetention: 90,
      });

      const request = new NextRequest(
        'http://localhost:3000/api/review/start',
        {
          method: 'POST',
          body: JSON.stringify({}),
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const response = await startReview(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.reviewSession.totalDue).toBe(0);
      expect(data.message).toContain('No reviews due');
    });
  });

  describe('POST /api/review/record', () => {
    const mockReview = {
      id: 'review-123',
      userId: 'user-123',
      topicId: 't1',
      nextReview: new Date(),
      stability: 1,
      difficulty: 5,
      elapsedDays: 0,
      scheduledDays: 1,
      reps: 0,
      lapses: 0,
      state: 0,
      lastReviewed: null,
    };

    it('should record rating 1 (Again)', async () => {
      const { getReviewById, updateReviewAfterRating } = await import('@/lib/db/reviews');
      (getReviewById as ReturnType<typeof vi.fn>).mockResolvedValue(mockReview);
      (updateReviewAfterRating as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockReview,
        reps: 1,
      });

      const request = new NextRequest(
        'http://localhost:3000/api/review/record',
        {
          method: 'POST',
          body: JSON.stringify({ reviewId: 'review-123', rating: 1 }),
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const response = await recordReview(request);

      expect(response.status).toBe(200);
    });

    it('should record rating 2 (Hard)', async () => {
      const { getReviewById, updateReviewAfterRating } = await import('@/lib/db/reviews');
      (getReviewById as ReturnType<typeof vi.fn>).mockResolvedValue(mockReview);
      (updateReviewAfterRating as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockReview,
        reps: 1,
      });

      const request = new NextRequest(
        'http://localhost:3000/api/review/record',
        {
          method: 'POST',
          body: JSON.stringify({ reviewId: 'review-123', rating: 2 }),
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const response = await recordReview(request);

      expect(response.status).toBe(200);
    });

    it('should record rating 3 (Good)', async () => {
      const { getReviewById, updateReviewAfterRating } = await import('@/lib/db/reviews');
      (getReviewById as ReturnType<typeof vi.fn>).mockResolvedValue(mockReview);
      (updateReviewAfterRating as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockReview,
        reps: 1,
      });

      const request = new NextRequest(
        'http://localhost:3000/api/review/record',
        {
          method: 'POST',
          body: JSON.stringify({ reviewId: 'review-123', rating: 3 }),
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const response = await recordReview(request);

      expect(response.status).toBe(200);
    });

    it('should record rating 4 (Easy)', async () => {
      const { getReviewById, updateReviewAfterRating } = await import('@/lib/db/reviews');
      (getReviewById as ReturnType<typeof vi.fn>).mockResolvedValue(mockReview);
      (updateReviewAfterRating as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockReview,
        reps: 1,
      });

      const request = new NextRequest(
        'http://localhost:3000/api/review/record',
        {
          method: 'POST',
          body: JSON.stringify({ reviewId: 'review-123', rating: 4 }),
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const response = await recordReview(request);

      expect(response.status).toBe(200);
    });

    it('should return next review date', async () => {
      const { getReviewById, updateReviewAfterRating } = await import('@/lib/db/reviews');
      const nextReviewDate = new Date('2024-02-01');
      (getReviewById as ReturnType<typeof vi.fn>).mockResolvedValue(mockReview);
      (updateReviewAfterRating as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockReview,
        nextReview: nextReviewDate,
      });

      const request = new NextRequest(
        'http://localhost:3000/api/review/record',
        {
          method: 'POST',
          body: JSON.stringify({ reviewId: 'review-123', rating: 3 }),
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const response = await recordReview(request);
      const data = await response.json();

      expect(data.nextReview).toBeDefined();
    });

    it('should return 400 for invalid rating', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/review/record',
        {
          method: 'POST',
          body: JSON.stringify({ reviewId: 'review-123', rating: 5 }),
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const response = await recordReview(request);

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent review', async () => {
      const { getReviewById } = await import('@/lib/db/reviews');
      (getReviewById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost:3000/api/review/record',
        {
          method: 'POST',
          body: JSON.stringify({ reviewId: 'non-existent', rating: 3 }),
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const response = await recordReview(request);

      expect(response.status).toBe(404);
    });

    it('should return 403 if review belongs to different user', async () => {
      const { getReviewById } = await import('@/lib/db/reviews');
      (getReviewById as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockReview,
        userId: 'different-user',
      });

      const request = new NextRequest(
        'http://localhost:3000/api/review/record',
        {
          method: 'POST',
          body: JSON.stringify({ reviewId: 'review-123', rating: 3 }),
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const response = await recordReview(request);

      expect(response.status).toBe(403);
    });
  });
});
