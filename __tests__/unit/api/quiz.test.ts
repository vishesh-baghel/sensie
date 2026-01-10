import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as generateQuizHandler } from '@/app/api/quiz/route';
import { POST as submitQuiz } from '@/app/api/quiz/submit/route';
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

// Mock db/topics module
vi.mock('@/lib/db/topics', () => ({
  getTopicById: vi.fn(),
}));

// Mock db/progress module
vi.mock('@/lib/db/progress', () => ({
  updateTodayAnalytics: vi.fn(),
}));

// Mock learning/progress-tracker
vi.mock('@/lib/learning/progress-tracker', () => ({
  updateMastery: vi.fn(),
}));

// Mock Sensie agent
vi.mock('@/lib/mastra/agents/sensie', () => ({
  generateQuiz: vi.fn(),
  sensieAgent: {
    generate: vi.fn(),
  },
}));

const mockSession: SessionData = {
  userId: 'user-123',
  role: 'owner',
  createdAt: Date.now(),
  expiresAt: Date.now() + 60 * 60 * 24 * 7 * 1000,
};

describe('quiz API routes', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getSession } = await import('@/lib/auth/session');
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);
    const { requireAuth } = await import('@/lib/auth/auth');
    (requireAuth as ReturnType<typeof vi.fn>).mockReturnValue({ authorized: true });
  });

  describe('POST /api/quiz', () => {
    it('should generate quiz for topic', async () => {
      const { getTopicById } = await import('@/lib/db/topics');
      const { generateQuiz } = await import('@/lib/mastra/agents/sensie');

      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'topic-123',
        userId: 'user-123',
        name: 'Test Topic',
      });
      (generateQuiz as ReturnType<typeof vi.fn>).mockResolvedValue({
        title: 'Test Topic Quiz',
        description: 'Test your knowledge',
        questions: [
          {
            question: 'What is X?',
            type: 'UNDERSTANDING',
            difficulty: 3,
            expectedAnswer: 'X is...',
            scoringCriteria: ['Mentions key point'],
          },
        ],
        totalPoints: 10,
        passingScore: 7,
      });

      const request = new NextRequest('http://localhost:3000/api/quiz', {
        method: 'POST',
        body: JSON.stringify({
          topicId: 'topic-123',
          questionCount: 5,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await generateQuizHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.quiz.title).toBeDefined();
      expect(data.quiz.questions.length).toBeGreaterThan(0);
    });

    it('should return 400 for missing topicId', async () => {
      const request = new NextRequest('http://localhost:3000/api/quiz', {
        method: 'POST',
        body: JSON.stringify({
          questionCount: 5,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await generateQuizHandler(request);

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent topic', async () => {
      const { getTopicById } = await import('@/lib/db/topics');
      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/quiz', {
        method: 'POST',
        body: JSON.stringify({
          topicId: 'non-existent',
          questionCount: 5,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await generateQuizHandler(request);

      expect(response.status).toBe(404);
    });

    it('should return 403 for topic belonging to different user', async () => {
      const { getTopicById } = await import('@/lib/db/topics');
      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'topic-123',
        userId: 'different-user',
        name: 'Test Topic',
      });

      const request = new NextRequest('http://localhost:3000/api/quiz', {
        method: 'POST',
        body: JSON.stringify({
          topicId: 'topic-123',
          questionCount: 5,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await generateQuizHandler(request);

      expect(response.status).toBe(403);
    });

    it('should reject invalid difficulty', async () => {
      const { getTopicById } = await import('@/lib/db/topics');
      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'topic-123',
        userId: 'user-123',
        name: 'Test Topic',
      });

      const request = new NextRequest('http://localhost:3000/api/quiz', {
        method: 'POST',
        body: JSON.stringify({
          topicId: 'topic-123',
          questionCount: 5,
          difficulty: 10, // Invalid - should be 1-5
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await generateQuizHandler(request);

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/quiz/submit', () => {
    it('should evaluate quiz answers', async () => {
      const { getTopicById } = await import('@/lib/db/topics');
      const { updateTodayAnalytics } = await import('@/lib/db/progress');
      const { updateMastery } = await import('@/lib/learning/progress-tracker');
      const { sensieAgent } = await import('@/lib/mastra/agents/sensie');

      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'topic-123',
        userId: 'user-123',
        name: 'Test Topic',
      });
      (sensieAgent.generate as ReturnType<typeof vi.fn>).mockResolvedValue({
        object: {
          isCorrect: true,
          score: 8,
          feedback: 'Good answer!',
          keyMissingPoints: [],
        },
      });
      (updateTodayAnalytics as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (updateMastery as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/quiz/submit', {
        method: 'POST',
        body: JSON.stringify({
          topicId: 'topic-123',
          answers: [
            { questionId: 'q-1', answer: 'My answer to question 1' },
          ],
          quizData: {
            questions: [
              {
                question: 'What is X?',
                type: 'UNDERSTANDING',
                difficulty: 3,
                expectedAnswer: 'X is something important',
                scoringCriteria: ['Mentions key point'],
              },
            ],
          },
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await submitQuiz(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.results.totalScore).toBeDefined();
      expect(data.results.percentage).toBeDefined();
    });

    it('should return 400 for missing fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/quiz/submit', {
        method: 'POST',
        body: JSON.stringify({
          topicId: 'topic-123',
          // Missing answers and quizData
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await submitQuiz(request);

      expect(response.status).toBe(400);
    });

    it('should return 400 for empty answers', async () => {
      const request = new NextRequest('http://localhost:3000/api/quiz/submit', {
        method: 'POST',
        body: JSON.stringify({
          topicId: 'topic-123',
          answers: [],
          quizData: { questions: [] },
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await submitQuiz(request);

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent topic', async () => {
      const { getTopicById } = await import('@/lib/db/topics');
      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/quiz/submit', {
        method: 'POST',
        body: JSON.stringify({
          topicId: 'non-existent',
          answers: [{ questionId: 'q-1', answer: 'Test' }],
          quizData: { questions: [{ question: 'Test?', type: 'UNDERSTANDING', difficulty: 3, expectedAnswer: 'Yes', scoringCriteria: [] }] },
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await submitQuiz(request);

      expect(response.status).toBe(404);
    });
  });
});
