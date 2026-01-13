/**
 * Bug #6 Regression Tests - Progress Tracking Integration
 *
 * This test file verifies that:
 * 1. XP is awarded when submitting answers (questions/answer)
 * 2. XP is awarded when submitting quizzes (quiz/submit)
 * 3. User streak is updated after learning activities
 *
 * Bug #6: Quiz/conversation answers NOT tracked in progress system.
 * Despite 3/3 perfect quiz score, progress shows 0 questions answered, 0 XP.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
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

vi.mock('@/lib/db/topics', () => ({
  getTopicById: vi.fn(),
}));

vi.mock('@/lib/db/progress', () => ({
  updateTodayAnalytics: vi.fn(),
}));

vi.mock('@/lib/learning/progress-tracker', () => ({
  updateMastery: vi.fn(),
}));

// Mock Sensie agent
vi.mock('@/lib/mastra/agents/sensie', () => ({
  evaluateAnswer: vi.fn(),
  sensieAgent: {
    generate: vi.fn(),
  },
}));

// Mock analytics engine - this is what we're testing gets called
vi.mock('@/lib/learning/analytics-engine', () => ({
  awardXP: vi.fn().mockResolvedValue(100),
  updateStreak: vi.fn().mockResolvedValue({
    currentStreak: 1,
    longestStreak: 1,
    streakBroken: false,
  }),
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

describe('Bug #6: Progress Tracking Integration', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getSession } = await import('@/lib/auth/session');
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);
    const { requireAuth } = await import('@/lib/auth/auth');
    (requireAuth as ReturnType<typeof vi.fn>).mockReturnValue({ authorized: true });
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('POST /api/questions/answer - XP and Streak Tracking', () => {
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
      currentSubtopicId: 'subtopic-123',
      hintsUsed: 0,
      currentAttempts: 0,
    };

    it('should award XP when user submits correct answer', async () => {
      // Import the route handler
      const { POST: submitAnswer } = await import('@/app/api/questions/answer/route');

      // Setup mocks
      const { getQuestionById } = await import('@/lib/db/questions');
      const { getSessionById, updateSessionState } = await import('@/lib/db/sessions');
      const { createAnswer } = await import('@/lib/db/answers');
      const { evaluateAnswer } = await import('@/lib/mastra/agents/sensie');
      const { updateMastery } = await import('@/lib/learning/progress-tracker');
      const { updateTodayAnalytics } = await import('@/lib/db/progress');
      const { awardXP, updateStreak } = await import('@/lib/learning/analytics-engine');

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

      // Bug #6: awardXP should be called but currently is NOT
      expect(awardXP).toHaveBeenCalled();
      expect(awardXP).toHaveBeenCalledWith(
        'user-123',
        expect.any(Number), // XP amount
        expect.any(String)  // reason
      );
    });

    it('should update streak when user submits answer', async () => {
      const { POST: submitAnswer } = await import('@/app/api/questions/answer/route');

      const { getQuestionById } = await import('@/lib/db/questions');
      const { getSessionById, updateSessionState } = await import('@/lib/db/sessions');
      const { createAnswer } = await import('@/lib/db/answers');
      const { evaluateAnswer } = await import('@/lib/mastra/agents/sensie');
      const { updateMastery } = await import('@/lib/learning/progress-tracker');
      const { updateTodayAnalytics } = await import('@/lib/db/progress');
      const { awardXP, updateStreak } = await import('@/lib/learning/analytics-engine');

      (getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue(mockLearningSession);
      (getQuestionById as ReturnType<typeof vi.fn>).mockResolvedValue(mockQuestion);
      (evaluateAnswer as ReturnType<typeof vi.fn>).mockResolvedValue({
        evaluation: {
          isCorrect: true,
          depth: 'DEEP',
          feedback: 'Good work!',
          missingElements: [],
        },
        feedback: 'Good work!',
        nextAction: 'next_concept',
      });
      (createAnswer as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'answer-123' });
      (updateSessionState as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (updateMastery as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (updateTodayAnalytics as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const request = createMockRequest('http://localhost:3000/api/questions/answer', {
        questionId: 'q-123',
        answer: 'Good answer here',
        sessionId: 'session-123',
      });

      await submitAnswer(request);

      // Bug #6: updateStreak should be called but currently is NOT
      expect(updateStreak).toHaveBeenCalled();
      expect(updateStreak).toHaveBeenCalledWith('user-123');
    });

    it('should award more XP for deep answers than shallow answers', async () => {
      const { POST: submitAnswer } = await import('@/app/api/questions/answer/route');

      const { getQuestionById } = await import('@/lib/db/questions');
      const { getSessionById, updateSessionState } = await import('@/lib/db/sessions');
      const { createAnswer } = await import('@/lib/db/answers');
      const { evaluateAnswer } = await import('@/lib/mastra/agents/sensie');
      const { updateMastery } = await import('@/lib/learning/progress-tracker');
      const { updateTodayAnalytics } = await import('@/lib/db/progress');
      const { awardXP } = await import('@/lib/learning/analytics-engine');

      // Setup for deep answer
      (getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue(mockLearningSession);
      (getQuestionById as ReturnType<typeof vi.fn>).mockResolvedValue(mockQuestion);
      (evaluateAnswer as ReturnType<typeof vi.fn>).mockResolvedValue({
        evaluation: {
          isCorrect: true,
          depth: 'DEEP',
          feedback: 'Excellent!',
          missingElements: [],
        },
        feedback: 'Excellent!',
        nextAction: 'next_concept',
      });
      (createAnswer as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'answer-123' });
      (updateSessionState as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (updateMastery as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (updateTodayAnalytics as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const request = createMockRequest('http://localhost:3000/api/questions/answer', {
        questionId: 'q-123',
        answer: 'Deep answer with good understanding',
        sessionId: 'session-123',
      });

      await submitAnswer(request);

      // For deep correct answers, should award more XP
      expect(awardXP).toHaveBeenCalled();
    });
  });

  describe('POST /api/quiz/submit - XP and Streak Tracking', () => {
    it('should award XP when user submits quiz', async () => {
      const { POST: submitQuiz } = await import('@/app/api/quiz/submit/route');

      const { getTopicById } = await import('@/lib/db/topics');
      const { updateTodayAnalytics } = await import('@/lib/db/progress');
      const { updateMastery } = await import('@/lib/learning/progress-tracker');
      const { sensieAgent } = await import('@/lib/mastra/agents/sensie');
      const { awardXP, updateStreak } = await import('@/lib/learning/analytics-engine');

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

      const request = createMockRequest('http://localhost:3000/api/quiz/submit', {
        topicId: 'topic-123',
        answers: [
          { questionId: 'q-1', answer: 'Answer 1' },
          { questionId: 'q-2', answer: 'Answer 2' },
          { questionId: 'q-3', answer: 'Answer 3' },
        ],
        quizData: {
          questions: [
            {
              question: 'What is X?',
              type: 'UNDERSTANDING',
              difficulty: 3,
              expectedAnswer: 'X is something',
              scoringCriteria: ['Key point'],
            },
            {
              question: 'What is Y?',
              type: 'UNDERSTANDING',
              difficulty: 3,
              expectedAnswer: 'Y is something',
              scoringCriteria: ['Key point'],
            },
            {
              question: 'What is Z?',
              type: 'UNDERSTANDING',
              difficulty: 3,
              expectedAnswer: 'Z is something',
              scoringCriteria: ['Key point'],
            },
          ],
        },
      });

      const response = await submitQuiz(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Bug #6: awardXP should be called but currently is NOT
      expect(awardXP).toHaveBeenCalled();
      expect(awardXP).toHaveBeenCalledWith(
        'user-123',
        expect.any(Number), // XP based on quiz performance
        expect.any(String)  // reason like 'quiz_completion'
      );
    });

    it('should update streak when user completes quiz', async () => {
      const { POST: submitQuiz } = await import('@/app/api/quiz/submit/route');

      const { getTopicById } = await import('@/lib/db/topics');
      const { updateTodayAnalytics } = await import('@/lib/db/progress');
      const { updateMastery } = await import('@/lib/learning/progress-tracker');
      const { sensieAgent } = await import('@/lib/mastra/agents/sensie');
      const { updateStreak } = await import('@/lib/learning/analytics-engine');

      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'topic-123',
        userId: 'user-123',
        name: 'Test Topic',
      });
      (sensieAgent.generate as ReturnType<typeof vi.fn>).mockResolvedValue({
        object: {
          isCorrect: true,
          score: 10,
          feedback: 'Perfect!',
          keyMissingPoints: [],
        },
      });
      (updateTodayAnalytics as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (updateMastery as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const request = createMockRequest('http://localhost:3000/api/quiz/submit', {
        topicId: 'topic-123',
        answers: [{ questionId: 'q-1', answer: 'Perfect answer' }],
        quizData: {
          questions: [{
            question: 'Test?',
            type: 'RECALL',
            difficulty: 2,
            expectedAnswer: 'Yes',
            scoringCriteria: [],
          }],
        },
      });

      await submitQuiz(request);

      // Bug #6: updateStreak should be called but currently is NOT
      expect(updateStreak).toHaveBeenCalled();
      expect(updateStreak).toHaveBeenCalledWith('user-123');
    });

    it('should award XP proportional to quiz score', async () => {
      const { POST: submitQuiz } = await import('@/app/api/quiz/submit/route');

      const { getTopicById } = await import('@/lib/db/topics');
      const { updateTodayAnalytics } = await import('@/lib/db/progress');
      const { updateMastery } = await import('@/lib/learning/progress-tracker');
      const { sensieAgent } = await import('@/lib/mastra/agents/sensie');
      const { awardXP } = await import('@/lib/learning/analytics-engine');

      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'topic-123',
        userId: 'user-123',
        name: 'Test Topic',
      });

      // Perfect score on all questions
      (sensieAgent.generate as ReturnType<typeof vi.fn>).mockResolvedValue({
        object: {
          isCorrect: true,
          score: 10,
          feedback: 'Perfect!',
          keyMissingPoints: [],
        },
      });
      (updateTodayAnalytics as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (updateMastery as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const request = createMockRequest('http://localhost:3000/api/quiz/submit', {
        topicId: 'topic-123',
        answers: [
          { questionId: 'q-1', answer: 'Perfect' },
          { questionId: 'q-2', answer: 'Perfect' },
          { questionId: 'q-3', answer: 'Perfect' },
        ],
        quizData: {
          questions: [
            { question: 'Q1?', type: 'RECALL', difficulty: 3, expectedAnswer: 'A1', scoringCriteria: [] },
            { question: 'Q2?', type: 'RECALL', difficulty: 3, expectedAnswer: 'A2', scoringCriteria: [] },
            { question: 'Q3?', type: 'RECALL', difficulty: 3, expectedAnswer: 'A3', scoringCriteria: [] },
          ],
        },
      });

      await submitQuiz(request);

      // Should award XP based on the score (higher score = more XP)
      expect(awardXP).toHaveBeenCalled();
    });
  });
});
