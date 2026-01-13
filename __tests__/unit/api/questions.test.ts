import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as submitAnswer } from '@/app/api/questions/answer/route';
import { POST as getHint } from '@/app/api/questions/hint/route';
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
vi.mock('@/lib/db/questions', () => ({
  getQuestionById: vi.fn(),
}));

vi.mock('@/lib/db/answers', () => ({
  createAnswer: vi.fn(),
}));

vi.mock('@/lib/db/sessions', () => ({
  getSessionById: vi.fn(),
  updateSessionState: vi.fn(),
}));

vi.mock('@/lib/db/progress', () => ({
  updateTodayAnalytics: vi.fn(),
}));

vi.mock('@/lib/learning/progress-tracker', () => ({
  updateMastery: vi.fn(),
}));

// Mock analytics engine
vi.mock('@/lib/learning/analytics-engine', () => ({
  awardXP: vi.fn().mockResolvedValue(100),
  updateStreak: vi.fn().mockResolvedValue({
    currentStreak: 1,
    longestStreak: 1,
    streakBroken: false,
  }),
}));

// Mock Sensie agent
vi.mock('@/lib/mastra/agents/sensie', () => ({
  evaluateAnswer: vi.fn(),
  generateHints: vi.fn(),
}));

// Mock Prisma client
vi.mock('@/lib/db/client', () => ({
  prisma: {
    concept: {
      findUnique: vi.fn(),
    },
  },
}));

const mockSession: SessionData = {
  userId: 'user-123',
  role: 'owner',
  createdAt: Date.now(),
  expiresAt: Date.now() + 60 * 60 * 24 * 7 * 1000,
};

function createMockRequest(url: string, body: object): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

describe('questions API routes', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getSession } = await import('@/lib/auth/session');
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);
    const { requireAuth } = await import('@/lib/auth/auth');
    (requireAuth as ReturnType<typeof vi.fn>).mockReturnValue({ authorized: true });
  });

  describe('POST /api/questions/answer', () => {
    const mockQuestion = {
      id: 'q-123',
      conceptId: 'concept-123',
      text: 'What is ownership in Rust?',
      type: 'UNDERSTANDING',
      difficulty: 3,
      expectedElements: ['single owner', 'memory safety'],
      hints: ['Think about memory...'],
      followUpPrompts: [],
    };

    const mockLearningSession = {
      id: 'session-123',
      userId: 'user-123',
      topicId: 'topic-123',
      hintsUsed: 0,
      currentAttempts: 0,
    };

    it('should evaluate answer and return result', async () => {
      const { getQuestionById } = await import('@/lib/db/questions');
      const { getSessionById, updateSessionState } = await import('@/lib/db/sessions');
      const { createAnswer } = await import('@/lib/db/answers');
      const { evaluateAnswer } = await import('@/lib/mastra/agents/sensie');
      const { updateMastery } = await import('@/lib/learning/progress-tracker');
      const { updateTodayAnalytics } = await import('@/lib/db/progress');

      (getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue(mockLearningSession);
      (getQuestionById as ReturnType<typeof vi.fn>).mockResolvedValue(mockQuestion);
      (evaluateAnswer as ReturnType<typeof vi.fn>).mockResolvedValue({
        evaluation: {
          isCorrect: true,
          depth: 'DEEP',
          feedback: 'Excellent understanding!',
          missingElements: [],
        },
        feedback: 'Excellent understanding!',
        nextAction: 'next_concept',
      });
      (createAnswer as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'answer-123' });
      (updateSessionState as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (updateMastery as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (updateTodayAnalytics as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const request = createMockRequest('http://localhost:3000/api/questions/answer', {
        questionId: 'q-123',
        answer: 'Ownership means the value has a single owner that manages memory.',
        sessionId: 'session-123',
      });
      const response = await submitAnswer(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.evaluation.isCorrect).toBe(true);
    });

    it('should handle incorrect answer', async () => {
      const { getQuestionById } = await import('@/lib/db/questions');
      const { getSessionById, updateSessionState } = await import('@/lib/db/sessions');
      const { createAnswer } = await import('@/lib/db/answers');
      const { evaluateAnswer } = await import('@/lib/mastra/agents/sensie');
      const { updateMastery } = await import('@/lib/learning/progress-tracker');
      const { updateTodayAnalytics } = await import('@/lib/db/progress');

      (getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue(mockLearningSession);
      (getQuestionById as ReturnType<typeof vi.fn>).mockResolvedValue(mockQuestion);
      (evaluateAnswer as ReturnType<typeof vi.fn>).mockResolvedValue({
        evaluation: {
          isCorrect: false,
          depth: 'SHALLOW',
          feedback: 'Not quite right. Think about memory safety.',
          missingElements: ['memory safety'],
        },
        feedback: 'Not quite right.',
        nextAction: 'guide',
        guidingQuestion: {
          text: 'What happens to memory when ownership changes?',
          type: 'UNDERSTANDING',
          difficulty: 2,
          expectedElements: [],
          hints: [],
          followUpPrompts: [],
        },
      });
      (createAnswer as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'answer-123' });
      (updateSessionState as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (updateMastery as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (updateTodayAnalytics as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const request = createMockRequest('http://localhost:3000/api/questions/answer', {
        questionId: 'q-123',
        answer: 'Ownership is about who owns the code.',
        sessionId: 'session-123',
      });
      const response = await submitAnswer(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.evaluation.isCorrect).toBe(false);
      expect(data.nextAction).toBe('guide');
    });

    it('should return 400 for missing fields', async () => {
      const request = createMockRequest('http://localhost:3000/api/questions/answer', {
        questionId: 'q-123',
        // Missing answer and sessionId
      });
      const response = await submitAnswer(request);

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent session', async () => {
      const { getSessionById } = await import('@/lib/db/sessions');
      (getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const request = createMockRequest('http://localhost:3000/api/questions/answer', {
        questionId: 'q-123',
        answer: 'Some answer',
        sessionId: 'non-existent',
      });
      const response = await submitAnswer(request);

      expect(response.status).toBe(404);
    });

    it('should return 403 for session belonging to different user', async () => {
      const { getSessionById } = await import('@/lib/db/sessions');
      (getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockLearningSession,
        userId: 'different-user',
      });

      const request = createMockRequest('http://localhost:3000/api/questions/answer', {
        questionId: 'q-123',
        answer: 'Some answer',
        sessionId: 'session-123',
      });
      const response = await submitAnswer(request);

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/questions/hint', () => {
    const mockQuestion = {
      id: 'q-123',
      conceptId: 'concept-123',
      text: 'What is ownership?',
      type: 'UNDERSTANDING',
      difficulty: 3,
      expectedElements: [],
      hints: ['Hint 1', 'Hint 2', 'Hint 3'],
      followUpPrompts: [],
    };

    const mockLearningSession = {
      id: 'session-123',
      userId: 'user-123',
      topicId: 'topic-123',
      hintsUsed: 0,
    };

    it('should return first hint', async () => {
      const { getQuestionById } = await import('@/lib/db/questions');
      const { getSessionById, updateSessionState } = await import('@/lib/db/sessions');
      const { prisma } = await import('@/lib/db/client');

      (getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue(mockLearningSession);
      (getQuestionById as ReturnType<typeof vi.fn>).mockResolvedValue(mockQuestion);
      (prisma.concept.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'concept-123',
        name: 'Ownership',
      });
      (updateSessionState as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const request = createMockRequest('http://localhost:3000/api/questions/hint', {
        questionId: 'q-123',
        sessionId: 'session-123',
      });
      const response = await getHint(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.hintNumber).toBe(1);
      expect(data.hintsRemaining).toBe(2);
    });

    it('should return second hint after using first', async () => {
      const { getQuestionById } = await import('@/lib/db/questions');
      const { getSessionById, updateSessionState } = await import('@/lib/db/sessions');
      const { prisma } = await import('@/lib/db/client');

      (getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockLearningSession,
        hintsUsed: 1,
      });
      (getQuestionById as ReturnType<typeof vi.fn>).mockResolvedValue(mockQuestion);
      (prisma.concept.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'concept-123',
        name: 'Ownership',
      });
      (updateSessionState as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const request = createMockRequest('http://localhost:3000/api/questions/hint', {
        questionId: 'q-123',
        sessionId: 'session-123',
      });
      const response = await getHint(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.hintNumber).toBe(2);
      expect(data.hintsRemaining).toBe(1);
    });

    it('should deny hints when all 3 used', async () => {
      const { getSessionById } = await import('@/lib/db/sessions');
      (getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockLearningSession,
        hintsUsed: 3,
      });

      const request = createMockRequest('http://localhost:3000/api/questions/hint', {
        questionId: 'q-123',
        sessionId: 'session-123',
      });
      const response = await getHint(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(false);
      expect(data.error).toBe('No hints remaining for this question');
    });

    it('should return 404 for non-existent question', async () => {
      const { getQuestionById } = await import('@/lib/db/questions');
      const { getSessionById } = await import('@/lib/db/sessions');

      (getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue(mockLearningSession);
      (getQuestionById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const request = createMockRequest('http://localhost:3000/api/questions/hint', {
        questionId: 'non-existent',
        sessionId: 'session-123',
      });
      const response = await getHint(request);

      expect(response.status).toBe(404);
    });
  });
});
