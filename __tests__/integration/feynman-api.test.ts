/**
 * Integration tests for Feynman API routes
 *
 * Tests verify that the Feynman Technique API works correctly
 * including authentication, validation, and response formatting.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/feynman/route';
import { POST as submitHandler } from '@/app/api/feynman/submit/route';
import type { SessionData } from '@/lib/auth/auth';

// Mock authentication modules
vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn(),
  isSessionExpired: vi.fn().mockReturnValue(false),
}));

vi.mock('@/lib/auth/auth', () => ({
  requireAuth: vi.fn().mockReturnValue({ authorized: true }),
}));

// Mock prisma client
vi.mock('@/lib/db/client', () => ({
  prisma: {
    topic: {
      findUnique: vi.fn(),
    },
    feynmanExercise: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    concept: {
      findUnique: vi.fn(),
    },
    userProgress: {
      updateMany: vi.fn(),
    },
    learningAnalytics: {
      upsert: vi.fn(),
    },
  },
}));

// Mock feynman engine
vi.mock('@/lib/learning/feynman-engine', () => ({
  getFeynmanStats: vi.fn(),
  getActiveFeynmanExercise: vi.fn(),
  startFeynmanExercise: vi.fn(),
  shouldTriggerFeynman: vi.fn(),
  getFeynmanPrompt: vi.fn(),
  submitFeynmanExplanation: vi.fn(),
  formatFeynmanFeedback: vi.fn(),
  FEYNMAN_TRIGGER_MASTERY: 80,
  FEYNMAN_XP_REWARD: 200,
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

describe('Feynman API Integration', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getSession } = await import('@/lib/auth/session');
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);
    const { requireAuth } = await import('@/lib/auth/auth');
    (requireAuth as ReturnType<typeof vi.fn>).mockReturnValue({ authorized: true });
  });

  describe('GET /api/feynman', () => {
    it('should return Feynman stats', async () => {
      const { getFeynmanStats, getActiveFeynmanExercise } = await import('@/lib/learning/feynman-engine');

      (getFeynmanStats as ReturnType<typeof vi.fn>).mockResolvedValue({
        totalCompleted: 5,
        totalAttempts: 8,
        averageScore: 85,
        topicsWithFeynman: 3,
      });

      const request = createMockRequest('/api/feynman');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.stats.totalCompleted).toBe(5);
      expect(data.stats.averageScore).toBe(85);
    });

    it('should include active exercise when topicId provided', async () => {
      const { getFeynmanStats, getActiveFeynmanExercise } = await import('@/lib/learning/feynman-engine');

      (getFeynmanStats as ReturnType<typeof vi.fn>).mockResolvedValue({
        totalCompleted: 2,
        totalAttempts: 3,
        averageScore: 75,
        topicsWithFeynman: 1,
      });

      (getActiveFeynmanExercise as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'exercise-1',
        conceptName: 'Ownership',
        status: 'IN_PROGRESS',
        targetAudience: 'child',
      });

      const request = createMockRequest('/api/feynman', {
        searchParams: { topicId: 'topic-1' },
      });
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.activeExercise).not.toBeNull();
      expect(data.activeExercise.conceptName).toBe('Ownership');
    });

    it('should require authentication', async () => {
      const { getSession } = await import('@/lib/auth/session');
      const { requireAuth } = await import('@/lib/auth/auth');

      (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (requireAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        authorized: false,
        error: 'Not authenticated',
      });

      const request = createMockRequest('/api/feynman');
      const response = await GET(request);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/feynman', () => {
    it('should start a new Feynman exercise', async () => {
      const { prisma } = await import('@/lib/db/client');
      const {
        getActiveFeynmanExercise,
        shouldTriggerFeynman,
        startFeynmanExercise,
        getFeynmanPrompt,
      } = await import('@/lib/learning/feynman-engine');

      (getActiveFeynmanExercise as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.topic.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'topic-1',
        userId: 'user-123',
        name: 'Rust Programming',
        subtopics: [
          {
            isLocked: false,
            concepts: [{ id: 'c-1', name: 'Ownership' }],
          },
        ],
      });
      (shouldTriggerFeynman as ReturnType<typeof vi.fn>).mockResolvedValue({
        should: true,
        conceptName: 'Ownership',
        conceptId: 'c-1',
      });
      (startFeynmanExercise as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'exercise-1',
        conceptName: 'Ownership',
        status: 'IN_PROGRESS',
        targetAudience: 'child',
      });
      (getFeynmanPrompt as ReturnType<typeof vi.fn>).mockReturnValue('Explain Ownership to a 10-year-old...');

      const request = createMockRequest('/api/feynman', {
        method: 'POST',
        body: JSON.stringify({ topicId: 'topic-1', targetAudience: 'child' }),
      });
      const response = await POST(request);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.exercise.conceptName).toBe('Ownership');
      expect(data.prompt).toContain('Ownership');
    });

    it('should return existing exercise if one is active', async () => {
      const { getActiveFeynmanExercise, getFeynmanPrompt } = await import('@/lib/learning/feynman-engine');

      (getActiveFeynmanExercise as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'exercise-1',
        conceptName: 'Borrowing',
        status: 'IN_PROGRESS',
        targetAudience: 'beginner',
      });
      (getFeynmanPrompt as ReturnType<typeof vi.fn>).mockReturnValue('Explain Borrowing...');

      const request = createMockRequest('/api/feynman', {
        method: 'POST',
        body: JSON.stringify({ topicId: 'topic-1' }),
      });
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toContain('active Feynman exercise');
    });

    it('should validate topicId is provided', async () => {
      const request = createMockRequest('/api/feynman', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Topic ID');
    });

    it('should validate target audience', async () => {
      const request = createMockRequest('/api/feynman', {
        method: 'POST',
        body: JSON.stringify({ topicId: 'topic-1', targetAudience: 'invalid' }),
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid target audience');
    });

    it('should return 404 for non-existent topic', async () => {
      const { prisma } = await import('@/lib/db/client');
      const { getActiveFeynmanExercise } = await import('@/lib/learning/feynman-engine');

      (getActiveFeynmanExercise as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.topic.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const request = createMockRequest('/api/feynman', {
        method: 'POST',
        body: JSON.stringify({ topicId: 'invalid-topic' }),
      });
      const response = await POST(request);

      expect(response.status).toBe(404);
    });

    it('should reject topic owned by different user', async () => {
      const { prisma } = await import('@/lib/db/client');
      const { getActiveFeynmanExercise } = await import('@/lib/learning/feynman-engine');

      (getActiveFeynmanExercise as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.topic.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'topic-1',
        userId: 'other-user',
        name: 'Rust',
        subtopics: [],
      });

      const request = createMockRequest('/api/feynman', {
        method: 'POST',
        body: JSON.stringify({ topicId: 'topic-1' }),
      });
      const response = await POST(request);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/feynman/submit', () => {
    it('should submit and evaluate explanation', async () => {
      const {
        getActiveFeynmanExercise,
        submitFeynmanExplanation,
        formatFeynmanFeedback,
      } = await import('@/lib/learning/feynman-engine');

      (getActiveFeynmanExercise as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'exercise-1',
      });
      (submitFeynmanExplanation as ReturnType<typeof vi.fn>).mockResolvedValue({
        exercise: {
          id: 'exercise-1',
          status: 'COMPLETED',
        },
        evaluation: {
          score: 85,
          clarity: 8,
          accuracy: 9,
          simplicity: 8,
          isApproved: true,
          feedback: 'Great job!',
          unclearParts: [],
          probingQuestions: [],
          suggestions: [],
        },
      });
      (formatFeynmanFeedback as ReturnType<typeof vi.fn>).mockReturnValue('Excellent work! Score: 85/100');

      const request = createMockRequest('/api/feynman/submit', {
        method: 'POST',
        body: JSON.stringify({
          topicId: 'topic-1',
          explanation: 'Ownership is like having a toy. Only one person can play with it at a time.',
        }),
      });
      const response = await submitHandler(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.isApproved).toBe(true);
      expect(data.evaluation.score).toBe(85);
    });

    it('should validate explanation length', async () => {
      const request = createMockRequest('/api/feynman/submit', {
        method: 'POST',
        body: JSON.stringify({
          topicId: 'topic-1',
          explanation: 'Hi',
        }),
      });
      const response = await submitHandler(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('detailed explanation');
    });

    it('should return error when no active exercise', async () => {
      const { getActiveFeynmanExercise } = await import('@/lib/learning/feynman-engine');

      (getActiveFeynmanExercise as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const request = createMockRequest('/api/feynman/submit', {
        method: 'POST',
        body: JSON.stringify({
          topicId: 'topic-1',
          explanation: 'A valid explanation that is long enough to pass validation.',
        }),
      });
      const response = await submitHandler(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('No active Feynman exercise');
    });

    it('should accept exerciseId directly', async () => {
      const { submitFeynmanExplanation, formatFeynmanFeedback } = await import('@/lib/learning/feynman-engine');

      (submitFeynmanExplanation as ReturnType<typeof vi.fn>).mockResolvedValue({
        exercise: { id: 'exercise-1', status: 'NEEDS_IMPROVEMENT' },
        evaluation: {
          score: 60,
          clarity: 6,
          accuracy: 7,
          simplicity: 5,
          isApproved: false,
          feedback: 'Try again',
          unclearParts: [{ text: 'confusing part', issue: 'unclear', suggestion: 'simplify' }],
          probingQuestions: ['Can you explain differently?'],
          suggestions: ['Use an analogy'],
        },
      });
      (formatFeynmanFeedback as ReturnType<typeof vi.fn>).mockReturnValue('Needs improvement...');

      const request = createMockRequest('/api/feynman/submit', {
        method: 'POST',
        body: JSON.stringify({
          exerciseId: 'exercise-1',
          explanation: 'A somewhat decent explanation that needs work.',
        }),
      });
      const response = await submitHandler(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.isApproved).toBe(false);
    });
  });
});
