/**
 * Integration tests for Analytics API routes
 *
 * Tests verify that the Learning Analytics API works correctly
 * including authentication, validation, and response formatting.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/analytics/route';
import type { SessionData } from '@/lib/auth/auth';

// Mock authentication modules
vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn(),
  isSessionExpired: vi.fn().mockReturnValue(false),
}));

vi.mock('@/lib/auth/auth', () => ({
  requireAuth: vi.fn().mockReturnValue({ authorized: true }),
}));

// Mock analytics engine
vi.mock('@/lib/learning/analytics-engine', () => ({
  getLearningAnalytics: vi.fn(),
  recordAnalytics: vi.fn(),
  updateStreak: vi.fn(),
  awardXP: vi.fn(),
  calculateLevel: vi.fn(),
}));

function createMockRequest(path: string, options: RequestInit & { searchParams?: Record<string, string> } = {}): NextRequest {
  const url = new URL(`http://localhost:3000${path}`);
  if (options.searchParams) {
    Object.entries(options.searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }
  return new NextRequest(url, {
    method: options.method || 'GET',
    body: options.body,
    headers: options.headers || { 'Content-Type': 'application/json' },
  });
}

const mockSession: SessionData = {
  userId: 'user-123',
  role: 'owner',
  createdAt: Date.now(),
  expiresAt: Date.now() + 60 * 60 * 24 * 7 * 1000,
};

describe('Analytics API Integration', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getSession } = await import('@/lib/auth/session');
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);
    const { requireAuth } = await import('@/lib/auth/auth');
    (requireAuth as ReturnType<typeof vi.fn>).mockReturnValue({ authorized: true });
  });

  describe('GET /api/analytics', () => {
    it('should return weekly analytics by default', async () => {
      const { getLearningAnalytics } = await import('@/lib/learning/analytics-engine');

      (getLearningAnalytics as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: 'user-123',
        period: 'weekly',
        totalStudyTime: 120,
        questionsAnswered: 50,
        questionsCorrect: 40,
        accuracy: 80,
        xpEarned: 500,
        currentStreak: 5,
        longestStreak: 10,
        badgesEarned: [{ name: 'First Steps', earnedAt: new Date() }],
        topicsStudied: 3,
        conceptsLearned: 15,
        reviewsCompleted: 10,
        feynmanCompleted: 2,
        currentLevel: 3,
        totalXP: 1500,
      });

      const request = createMockRequest('/api/analytics');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.analytics.period).toBe('weekly');
      expect(data.analytics.questionsAnswered).toBe(50);
      expect(data.analytics.accuracy).toBe(80);
      expect(getLearningAnalytics).toHaveBeenCalledWith('user-123', 'weekly');
    });

    it('should return daily analytics when requested', async () => {
      const { getLearningAnalytics } = await import('@/lib/learning/analytics-engine');

      (getLearningAnalytics as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: 'user-123',
        period: 'daily',
        totalStudyTime: 30,
        questionsAnswered: 10,
        questionsCorrect: 8,
        accuracy: 80,
        xpEarned: 100,
        currentStreak: 1,
        longestStreak: 10,
        badgesEarned: [],
        topicsStudied: 1,
        conceptsLearned: 3,
        reviewsCompleted: 2,
        feynmanCompleted: 0,
        currentLevel: 2,
        totalXP: 500,
      });

      const request = createMockRequest('/api/analytics', {
        searchParams: { period: 'daily' },
      });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.analytics.period).toBe('daily');
      expect(getLearningAnalytics).toHaveBeenCalledWith('user-123', 'daily');
    });

    it('should return monthly analytics when requested', async () => {
      const { getLearningAnalytics } = await import('@/lib/learning/analytics-engine');

      (getLearningAnalytics as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: 'user-123',
        period: 'monthly',
        totalStudyTime: 600,
        questionsAnswered: 200,
        questionsCorrect: 160,
        accuracy: 80,
        xpEarned: 2000,
        currentStreak: 15,
        longestStreak: 20,
        badgesEarned: [{ name: 'Streak Master', earnedAt: new Date() }],
        topicsStudied: 5,
        conceptsLearned: 50,
        reviewsCompleted: 40,
        feynmanCompleted: 5,
        currentLevel: 5,
        totalXP: 5000,
      });

      const request = createMockRequest('/api/analytics', {
        searchParams: { period: 'monthly' },
      });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.analytics.period).toBe('monthly');
      expect(getLearningAnalytics).toHaveBeenCalledWith('user-123', 'monthly');
    });

    it('should return all-time analytics when requested', async () => {
      const { getLearningAnalytics } = await import('@/lib/learning/analytics-engine');

      (getLearningAnalytics as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: 'user-123',
        period: 'all-time',
        totalStudyTime: 3000,
        questionsAnswered: 1000,
        questionsCorrect: 850,
        accuracy: 85,
        xpEarned: 10000,
        currentStreak: 30,
        longestStreak: 45,
        badgesEarned: [
          { name: 'First Steps', earnedAt: new Date() },
          { name: 'Streak Master', earnedAt: new Date() },
          { name: 'Feynman Expert', earnedAt: new Date() },
        ],
        topicsStudied: 10,
        conceptsLearned: 200,
        reviewsCompleted: 150,
        feynmanCompleted: 20,
        currentLevel: 10,
        totalXP: 25000,
      });

      const request = createMockRequest('/api/analytics', {
        searchParams: { period: 'all-time' },
      });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.analytics.period).toBe('all-time');
      expect(getLearningAnalytics).toHaveBeenCalledWith('user-123', 'all-time');
    });

    it('should reject invalid period', async () => {
      const request = createMockRequest('/api/analytics', {
        searchParams: { period: 'invalid' },
      });
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid period');
    });

    it('should require authentication', async () => {
      const { getSession } = await import('@/lib/auth/session');
      const { requireAuth } = await import('@/lib/auth/auth');

      (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (requireAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        authorized: false,
        error: 'Not authenticated',
      });

      const request = createMockRequest('/api/analytics');
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('should handle zero analytics gracefully', async () => {
      const { getLearningAnalytics } = await import('@/lib/learning/analytics-engine');

      (getLearningAnalytics as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: 'user-123',
        period: 'weekly',
        totalStudyTime: 0,
        questionsAnswered: 0,
        questionsCorrect: 0,
        accuracy: 0,
        xpEarned: 0,
        currentStreak: 0,
        longestStreak: 0,
        badgesEarned: [],
        topicsStudied: 0,
        conceptsLearned: 0,
        reviewsCompleted: 0,
        feynmanCompleted: 0,
        currentLevel: 1,
        totalXP: 0,
      });

      const request = createMockRequest('/api/analytics');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.analytics.accuracy).toBe(0);
      expect(data.analytics.currentLevel).toBe(1);
    });

    it('should include all expected fields', async () => {
      const { getLearningAnalytics } = await import('@/lib/learning/analytics-engine');

      (getLearningAnalytics as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: 'user-123',
        period: 'weekly',
        totalStudyTime: 60,
        questionsAnswered: 20,
        questionsCorrect: 15,
        accuracy: 75,
        xpEarned: 200,
        currentStreak: 3,
        longestStreak: 7,
        badgesEarned: [],
        topicsStudied: 2,
        conceptsLearned: 8,
        reviewsCompleted: 5,
        feynmanCompleted: 1,
        currentLevel: 2,
        totalXP: 700,
      });

      const request = createMockRequest('/api/analytics');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      const analytics = data.analytics;

      // Verify all expected fields are present
      expect(analytics).toHaveProperty('userId');
      expect(analytics).toHaveProperty('period');
      expect(analytics).toHaveProperty('totalStudyTime');
      expect(analytics).toHaveProperty('questionsAnswered');
      expect(analytics).toHaveProperty('questionsCorrect');
      expect(analytics).toHaveProperty('accuracy');
      expect(analytics).toHaveProperty('xpEarned');
      expect(analytics).toHaveProperty('currentStreak');
      expect(analytics).toHaveProperty('longestStreak');
      expect(analytics).toHaveProperty('badgesEarned');
      expect(analytics).toHaveProperty('topicsStudied');
      expect(analytics).toHaveProperty('conceptsLearned');
      expect(analytics).toHaveProperty('reviewsCompleted');
      expect(analytics).toHaveProperty('feynmanCompleted');
      expect(analytics).toHaveProperty('currentLevel');
      expect(analytics).toHaveProperty('totalXP');
    });
  });
});
