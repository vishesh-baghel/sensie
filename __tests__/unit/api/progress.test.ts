import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getProgress } from '@/app/api/progress/route';
import { GET as getTopicProgress } from '@/app/api/progress/[topicId]/route';
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

// Mock db modules
vi.mock('@/lib/db/topics', () => ({
  getTopicsByUser: vi.fn(),
  getTopicById: vi.fn(),
}));

vi.mock('@/lib/db/progress', () => ({
  getUserProgress: vi.fn(),
  getUserBadges: vi.fn(),
  getTodayAnalytics: vi.fn(),
}));

vi.mock('@/lib/db/reviews', () => ({
  countReviewsDue: vi.fn(),
  getReviewStats: vi.fn(),
}));

vi.mock('@/lib/learning/progress-tracker', () => ({
  getProgressSummary: vi.fn(),
  getNextAction: vi.fn(),
}));

const mockSession: SessionData = {
  userId: 'user-123',
  role: 'owner',
  createdAt: Date.now(),
  expiresAt: Date.now() + 60 * 60 * 24 * 7 * 1000,
};

describe('progress API routes', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getSession } = await import('@/lib/auth/session');
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);
    const { requireAuth } = await import('@/lib/auth/auth');
    (requireAuth as ReturnType<typeof vi.fn>).mockReturnValue({ authorized: true });
  });

  describe('GET /api/progress', () => {
    it('should return overall progress', async () => {
      const { getTopicsByUser } = await import('@/lib/db/topics');
      const { getUserProgress, getUserBadges, getTodayAnalytics } = await import('@/lib/db/progress');
      const { countReviewsDue } = await import('@/lib/db/reviews');

      (getTopicsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 't1', status: 'ACTIVE', masteryPercentage: 50 },
        { id: 't2', status: 'COMPLETED', masteryPercentage: 100 },
      ]);
      (getUserProgress as ReturnType<typeof vi.fn>).mockResolvedValue({
        totalXP: 1500,
        currentLevel: 5,
        currentStreak: 7,
        longestStreak: 14,
      });
      (getUserBadges as ReturnType<typeof vi.fn>).mockResolvedValue([
        { badgeType: 'FIRST_TOPIC', name: 'First Topic', icon: '📚', earnedAt: new Date() },
      ]);
      (getTodayAnalytics as ReturnType<typeof vi.fn>).mockResolvedValue({
        questionsAnswered: 10,
        questionsCorrect: 8,
        conceptsMastered: 2,
        timeSpent: 1800,
        xpEarned: 150,
      });
      (countReviewsDue as ReturnType<typeof vi.fn>).mockResolvedValue(5);

      const request = new NextRequest('http://localhost:3000/api/progress');
      const response = await getProgress();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.overview).toBeDefined();
      expect(data.overview.totalXP).toBe(1500);
      expect(data.overview.level).toBe(5);
    });

    it('should include XP and level', async () => {
      const { getTopicsByUser } = await import('@/lib/db/topics');
      const { getUserProgress, getUserBadges, getTodayAnalytics } = await import('@/lib/db/progress');
      const { countReviewsDue } = await import('@/lib/db/reviews');

      (getTopicsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (getUserProgress as ReturnType<typeof vi.fn>).mockResolvedValue({
        totalXP: 500,
        currentLevel: 2,
        currentStreak: 3,
        longestStreak: 10,
      });
      (getUserBadges as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (getTodayAnalytics as ReturnType<typeof vi.fn>).mockResolvedValue({
        questionsAnswered: 0,
        questionsCorrect: 0,
        conceptsMastered: 0,
        timeSpent: 0,
        xpEarned: 0,
      });
      (countReviewsDue as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      const response = await getProgress();
      const data = await response.json();

      expect(data.overview.totalXP).toBe(500);
      expect(data.overview.level).toBe(2);
    });

    it('should include streak info', async () => {
      const { getTopicsByUser } = await import('@/lib/db/topics');
      const { getUserProgress, getUserBadges, getTodayAnalytics } = await import('@/lib/db/progress');
      const { countReviewsDue } = await import('@/lib/db/reviews');

      (getTopicsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (getUserProgress as ReturnType<typeof vi.fn>).mockResolvedValue({
        totalXP: 0,
        currentLevel: 1,
        currentStreak: 5,
        longestStreak: 15,
      });
      (getUserBadges as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (getTodayAnalytics as ReturnType<typeof vi.fn>).mockResolvedValue({
        questionsAnswered: 0,
        questionsCorrect: 0,
        conceptsMastered: 0,
        timeSpent: 0,
        xpEarned: 0,
      });
      (countReviewsDue as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      const response = await getProgress();
      const data = await response.json();

      expect(data.overview.currentStreak).toBe(5);
      expect(data.overview.longestStreak).toBe(15);
    });

    it('should return 401 if not authenticated', async () => {
      const { getSession } = await import('@/lib/auth/session');
      const { requireAuth } = await import('@/lib/auth/auth');
      (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (requireAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        authorized: false,
        error: 'Not authenticated',
      });

      const response = await getProgress();

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/progress/[topicId]', () => {
    it('should return topic-specific progress', async () => {
      const { getTopicById } = await import('@/lib/db/topics');
      const { getProgressSummary, getNextAction } = await import('@/lib/learning/progress-tracker');
      const { countReviewsDue, getReviewStats } = await import('@/lib/db/reviews');

      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'topic-123',
        userId: 'user-123',
        name: 'Test Topic',
        status: 'ACTIVE',
      });
      (getProgressSummary as ReturnType<typeof vi.fn>).mockResolvedValue({
        topicMastery: 75,
        subtopicsCompleted: 3,
        totalSubtopics: 5,
        conceptsMastered: 10,
        totalConcepts: 15,
        questionsAnswered: 50,
        correctRate: 80,
      });
      (getNextAction as ReturnType<typeof vi.fn>).mockResolvedValue({
        action: 'continue',
        subtopicId: 'sub-123',
        conceptId: 'concept-123',
      });
      (countReviewsDue as ReturnType<typeof vi.fn>).mockResolvedValue(3);
      (getReviewStats as ReturnType<typeof vi.fn>).mockResolvedValue({
        totalReviews: 20,
        dueToday: 3,
        completed: 15,
        averageRetention: 85,
      });

      const request = new NextRequest(
        'http://localhost:3000/api/progress/topic-123'
      );
      const params = Promise.resolve({ topicId: 'topic-123' });
      const response = await getTopicProgress(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.progress.mastery).toBe(75);
      expect(data.progress.subtopics.completed).toBe(3);
    });

    it('should include next action recommendation', async () => {
      const { getTopicById } = await import('@/lib/db/topics');
      const { getProgressSummary, getNextAction } = await import('@/lib/learning/progress-tracker');
      const { countReviewsDue, getReviewStats } = await import('@/lib/db/reviews');

      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'topic-123',
        userId: 'user-123',
        name: 'Test Topic',
        status: 'ACTIVE',
      });
      (getProgressSummary as ReturnType<typeof vi.fn>).mockResolvedValue({
        topicMastery: 50,
        subtopicsCompleted: 2,
        totalSubtopics: 4,
        conceptsMastered: 5,
        totalConcepts: 10,
        questionsAnswered: 25,
        correctRate: 70,
      });
      (getNextAction as ReturnType<typeof vi.fn>).mockResolvedValue({
        action: 'review',
      });
      (countReviewsDue as ReturnType<typeof vi.fn>).mockResolvedValue(5);
      (getReviewStats as ReturnType<typeof vi.fn>).mockResolvedValue({
        totalReviews: 10,
        dueToday: 5,
        completed: 5,
        averageRetention: 70,
      });

      const request = new NextRequest(
        'http://localhost:3000/api/progress/topic-123'
      );
      const params = Promise.resolve({ topicId: 'topic-123' });
      const response = await getTopicProgress(request, { params });
      const data = await response.json();

      expect(data.progress.nextAction.action).toBe('review');
    });

    it('should return 404 for non-existent topic', async () => {
      const { getTopicById } = await import('@/lib/db/topics');
      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost:3000/api/progress/non-existent'
      );
      const params = Promise.resolve({ topicId: 'non-existent' });
      const response = await getTopicProgress(request, { params });

      expect(response.status).toBe(404);
    });

    it('should return 403 for topic belonging to different user', async () => {
      const { getTopicById } = await import('@/lib/db/topics');
      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'topic-123',
        userId: 'different-user',
        name: 'Test Topic',
        status: 'ACTIVE',
      });

      const request = new NextRequest(
        'http://localhost:3000/api/progress/topic-123'
      );
      const params = Promise.resolve({ topicId: 'topic-123' });
      const response = await getTopicProgress(request, { params });

      expect(response.status).toBe(403);
    });
  });
});
