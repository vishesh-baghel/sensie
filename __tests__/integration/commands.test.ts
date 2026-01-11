/**
 * Integration tests for chat commands
 *
 * These tests verify that commands work correctly through the full
 * chat API route, including authentication and response formatting.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as messageHandler } from '@/app/api/chat/message/route';
import type { SessionData } from '@/lib/auth/auth';

// Mock authentication modules
vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn(),
  isSessionExpired: vi.fn().mockReturnValue(false),
}));

vi.mock('@/lib/auth/auth', () => ({
  requireAuth: vi.fn().mockReturnValue({ authorized: true }),
}));

// Mock database modules
vi.mock('@/lib/db/client', () => ({
  prisma: {
    question: {
      findUnique: vi.fn(),
    },
    learningSession: {
      update: vi.fn(),
      findMany: vi.fn(),
    },
    message: {
      findMany: vi.fn(),
    },
    subtopic: {
      findUnique: vi.fn(),
    },
    concept: {
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    topic: {
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    feynmanExercise: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    knowledgeGapRecord: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    answer: {
      findMany: vi.fn(),
    },
    learningAnalytics: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    userProgress: {
      findUnique: vi.fn(),
    },
    badge: {
      findMany: vi.fn(),
    },
    review: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/db/sessions', () => ({
  getActiveSession: vi.fn(),
  createSession: vi.fn(),
  addMessage: vi.fn(),
  getSessionById: vi.fn(),
  endSession: vi.fn(),
  getActiveSessionsByUser: vi.fn(),
  getSessionMessages: vi.fn(),
}));

vi.mock('@/lib/db/topics', () => ({
  getTopicById: vi.fn(),
  getTopicsByUser: vi.fn(),
  getActiveTopics: vi.fn(),
}));

vi.mock('@/lib/db/reviews', () => ({
  countReviewsDue: vi.fn(),
  getReviewsDue: vi.fn(),
}));

vi.mock('@/lib/db/progress', () => ({
  getUserProgress: vi.fn(),
  getTodayAnalytics: vi.fn(),
}));

vi.mock('@/lib/mastra/prompts', () => ({
  SENSIE_SYSTEM_PROMPT: 'You are Sensie, a wise teacher...',
}));

// Mock sensieAgent for non-command messages
vi.mock('@/lib/mastra/agents/sensie', () => ({
  sensieAgent: {
    stream: vi.fn().mockImplementation(() =>
      Promise.resolve({
        toUIMessageStreamResponse: vi.fn().mockReturnValue(
          new Response('data: {"type":"text-delta","delta":"Hello from Sensie!"}\n\ndata: [DONE]\n', {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
          })
        ),
      })
    ),
  },
  generateProgressReport: vi.fn(),
  generateQuiz: vi.fn(),
  handleCommand: vi.fn(),
}));

function createMockRequest(body: object): NextRequest {
  return new NextRequest('http://localhost:3000/api/chat/message', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

const mockSession: SessionData = {
  userId: 'user-123',
  role: 'owner',
  createdAt: Date.now(),
  expiresAt: Date.now() + 60 * 60 * 24 * 7 * 1000,
};

describe('Chat Commands Integration', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getSession } = await import('@/lib/auth/session');
    (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);
    const { requireAuth } = await import('@/lib/auth/auth');
    (requireAuth as ReturnType<typeof vi.fn>).mockReturnValue({ authorized: true });
  });

  describe('Command Detection', () => {
    it('should detect and handle /progress command', async () => {
      const { getUserProgress, getTodayAnalytics } = await import('@/lib/db/progress');
      const { getTopicsByUser } = await import('@/lib/db/topics');
      const { countReviewsDue } = await import('@/lib/db/reviews');

      (getUserProgress as ReturnType<typeof vi.fn>).mockResolvedValue({
        currentLevel: 3,
        totalXP: 500,
        currentStreak: 2,
        longestStreak: 5,
      });

      (getTodayAnalytics as ReturnType<typeof vi.fn>).mockResolvedValue({
        questionsAnswered: 5,
        questionsCorrect: 4,
        xpEarned: 25,
      });

      (getTopicsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 't-1', name: 'Rust', status: 'ACTIVE', masteryPercentage: 50 },
      ]);

      (countReviewsDue as ReturnType<typeof vi.fn>).mockResolvedValue(2);

      const request = createMockRequest({
        messages: [{ role: 'user', content: '/progress' }],
      });

      const response = await messageHandler(request);

      expect(response.status).toBe(200);

      const text = await response.text();
      expect(text).toContain('Level 3');
      expect(text).toContain('500 XP');
    });

    it('should detect and handle /topics command', async () => {
      const { getTopicsByUser } = await import('@/lib/db/topics');

      (getTopicsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 't-1', name: 'Rust Programming', status: 'ACTIVE', masteryPercentage: 75, subtopics: [] },
        { id: 't-2', name: 'Go Basics', status: 'QUEUED', masteryPercentage: 0, subtopics: [] },
      ]);

      const request = createMockRequest({
        messages: [{ role: 'user', content: '/topics' }],
      });

      const response = await messageHandler(request);

      expect(response.status).toBe(200);

      const text = await response.text();
      expect(text).toContain('Rust Programming');
      expect(text).toContain('Go Basics');
    });

    it('should detect and handle /continue command', async () => {
      const { getActiveSessionsByUser, getSessionMessages } = await import('@/lib/db/sessions');
      const { getTopicById } = await import('@/lib/db/topics');

      (getActiveSessionsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 's-1', topicId: 't-1', currentSubtopicId: null },
      ]);

      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 't-1',
        name: 'TypeScript Mastery',
        masteryPercentage: 60,
      });

      (getSessionMessages as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const request = createMockRequest({
        messages: [{ role: 'user', content: '/continue' }],
      });

      const response = await messageHandler(request);

      expect(response.status).toBe(200);

      const text = await response.text();
      expect(text).toContain('TypeScript Mastery');
      expect(text).toContain('60%');
    });

    it('should detect and handle /review command', async () => {
      const { countReviewsDue, getReviewsDue } = await import('@/lib/db/reviews');
      const { prisma } = await import('@/lib/db/client');

      (countReviewsDue as ReturnType<typeof vi.fn>).mockResolvedValue(3);
      (getReviewsDue as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'r-1', conceptId: 'c-1' },
      ]);
      (prisma.concept.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        name: 'Memory Management',
      });

      const request = createMockRequest({
        messages: [{ role: 'user', content: '/review' }],
      });

      const response = await messageHandler(request);

      expect(response.status).toBe(200);

      const text = await response.text();
      expect(text).toContain('3 Reviews Due');
    });

    it('should detect and handle /break command', async () => {
      const { getActiveSession, getSessionById } = await import('@/lib/db/sessions');
      const { prisma } = await import('@/lib/db/client');
      const { getTopicById } = await import('@/lib/db/topics');

      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 't-1',
        userId: 'user-123',
        name: 'Rust',
      });

      (getActiveSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 's-1',
        topicId: 't-1',
      });

      (getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 's-1',
        createdAt: new Date(Date.now() - 15 * 60 * 1000),
      });

      (prisma.message.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { role: 'USER' },
        { role: 'USER' },
      ]);

      (prisma.learningSession.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const request = createMockRequest({
        messages: [{ role: 'user', content: '/break' }],
        topicId: 't-1',
      });

      const response = await messageHandler(request);

      expect(response.status).toBe(200);

      const text = await response.text();
      expect(text).toContain('/continue');
    });

    it('should detect and handle /quiz command', async () => {
      const { getActiveTopics } = await import('@/lib/db/topics');

      (getActiveTopics as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 't-1', name: 'Python Fundamentals', masteryPercentage: 40 },
      ]);

      const request = createMockRequest({
        messages: [{ role: 'user', content: '/quiz' }],
      });

      const response = await messageHandler(request);

      expect(response.status).toBe(200);

      const text = await response.text();
      expect(text).toContain('Quiz Time');
      expect(text).toContain('Python Fundamentals');
    });
  });

  describe('Command with Topic Context', () => {
    it('should handle /hint command with topic context', async () => {
      const { getTopicById } = await import('@/lib/db/topics');
      const { getActiveSession, getSessionById } = await import('@/lib/db/sessions');
      const { prisma } = await import('@/lib/db/client');

      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 't-1',
        userId: 'user-123',
        name: 'Rust',
      });

      (getActiveSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 's-1',
        topicId: 't-1',
      });

      (getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 's-1',
        hintsUsed: 1,
        currentQuestionId: 'q-1',
      });

      (prisma.question.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'q-1',
        hints: ['Hint 1', 'Hint 2', 'Hint 3'],
        concept: { id: 'c-1' },
      });

      (prisma.learningSession.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const request = createMockRequest({
        messages: [{ role: 'user', content: '/hint' }],
        topicId: 't-1',
      });

      const response = await messageHandler(request);

      expect(response.status).toBe(200);

      const text = await response.text();
      expect(text).toContain('Hint 2');
    });

    it('should handle /skip command with topic context', async () => {
      const { getTopicById } = await import('@/lib/db/topics');
      const { getActiveSession, getSessionById } = await import('@/lib/db/sessions');
      const { prisma } = await import('@/lib/db/client');

      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 't-1',
        userId: 'user-123',
        name: 'Go',
      });

      (getActiveSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 's-1',
        topicId: 't-1',
      });

      (getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 's-1',
        skipsUsed: 0,
        skippedQuestionIds: [],
        currentQuestionId: 'q-1',
      });

      (prisma.learningSession.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const request = createMockRequest({
        messages: [{ role: 'user', content: '/skip' }],
        topicId: 't-1',
      });

      const response = await messageHandler(request);

      expect(response.status).toBe(200);

      const text = await response.text();
      expect(text).toContain('skipped');
      expect(text).toContain('2 skip');
    });
  });

  describe('Non-command Messages', () => {
    it('should route regular messages to Sensie agent', async () => {
      const { sensieAgent } = await import('@/lib/mastra/agents/sensie');

      const request = createMockRequest({
        messages: [{ role: 'user', content: 'Hello Sensie!' }],
      });

      const response = await messageHandler(request);

      expect(response.status).toBe(200);
      expect(sensieAgent.stream).toHaveBeenCalled();
    });

    it('should not treat messages with / in the middle as commands', async () => {
      const { sensieAgent } = await import('@/lib/mastra/agents/sensie');

      const request = createMockRequest({
        messages: [{ role: 'user', content: 'What does the /etc/passwd file contain?' }],
      });

      const response = await messageHandler(request);

      expect(response.status).toBe(200);
      expect(sensieAgent.stream).toHaveBeenCalled();
    });

    it('should route AI SDK v6 format messages correctly', async () => {
      const { sensieAgent } = await import('@/lib/mastra/agents/sensie');

      const request = createMockRequest({
        messages: [{
          role: 'user',
          parts: [{ type: 'text', text: 'What is ownership in Rust?' }],
        }],
      });

      const response = await messageHandler(request);

      expect(response.status).toBe(200);
      expect(sensieAgent.stream).toHaveBeenCalled();
    });
  });

  describe('Command Response Format', () => {
    it('should return AI SDK compatible stream format for commands', async () => {
      const { getTopicsByUser } = await import('@/lib/db/topics');
      (getTopicsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const request = createMockRequest({
        messages: [{ role: 'user', content: '/topics' }],
      });

      const response = await messageHandler(request);

      expect(response.status).toBe(200);
      // AI SDK uses text/event-stream for SSE
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');

      const text = await response.text();
      // Should contain stream format markers (SSE data format)
      expect(text).toContain('data:');
      expect(text).toContain('"type":"text-delta"');
    });
  });

  describe('Command Error Handling', () => {
    it('should handle unknown commands gracefully', async () => {
      // Unknown commands should still be processed by the command handler
      // but return an error message
      const request = createMockRequest({
        messages: [{ role: 'user', content: '/unknowncommand' }],
      });

      const response = await messageHandler(request);

      // Unknown commands fall through to agent
      expect(response.status).toBe(200);
    });

    it('should require authentication for commands', async () => {
      const { getSession } = await import('@/lib/auth/session');
      const { requireAuth } = await import('@/lib/auth/auth');

      (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (requireAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        authorized: false,
        error: 'Not authenticated',
      });

      const request = createMockRequest({
        messages: [{ role: 'user', content: '/progress' }],
      });

      const response = await messageHandler(request);

      expect(response.status).toBe(401);
    });
  });

  describe('Case Insensitivity', () => {
    it('should handle uppercase commands', async () => {
      const { getUserProgress, getTodayAnalytics } = await import('@/lib/db/progress');
      const { getTopicsByUser } = await import('@/lib/db/topics');
      const { countReviewsDue } = await import('@/lib/db/reviews');

      (getUserProgress as ReturnType<typeof vi.fn>).mockResolvedValue({
        currentLevel: 1,
        totalXP: 0,
        currentStreak: 0,
        longestStreak: 0,
      });

      (getTodayAnalytics as ReturnType<typeof vi.fn>).mockResolvedValue({
        questionsAnswered: 0,
        questionsCorrect: 0,
        xpEarned: 0,
      });

      (getTopicsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (countReviewsDue as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      const request = createMockRequest({
        messages: [{ role: 'user', content: '/PROGRESS' }],
      });

      const response = await messageHandler(request);

      expect(response.status).toBe(200);

      const text = await response.text();
      expect(text).toContain('Progress');
    });

    it('should handle mixed case commands', async () => {
      const { getTopicsByUser } = await import('@/lib/db/topics');
      (getTopicsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const request = createMockRequest({
        messages: [{ role: 'user', content: '/Topics' }],
      });

      const response = await messageHandler(request);

      expect(response.status).toBe(200);
    });
  });

  describe('AI SDK v6 Message Format', () => {
    it('should detect commands from AI SDK v6 parts format', async () => {
      const { getTopicsByUser } = await import('@/lib/db/topics');
      (getTopicsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const request = createMockRequest({
        messages: [{
          role: 'user',
          parts: [{ type: 'text', text: '/topics' }],
        }],
      });

      const response = await messageHandler(request);

      expect(response.status).toBe(200);
      const text = await response.text();
      // When no topics, the message is "No topics yet! What would you like to learn?"
      expect(text.toLowerCase()).toContain('topics');
    });

    it('should detect commands from multi-part messages', async () => {
      const { getUserProgress, getTodayAnalytics } = await import('@/lib/db/progress');
      const { getTopicsByUser } = await import('@/lib/db/topics');
      const { countReviewsDue } = await import('@/lib/db/reviews');

      (getUserProgress as ReturnType<typeof vi.fn>).mockResolvedValue({
        currentLevel: 1, totalXP: 0, currentStreak: 0, longestStreak: 0,
      });
      (getTodayAnalytics as ReturnType<typeof vi.fn>).mockResolvedValue({
        questionsAnswered: 0, questionsCorrect: 0, xpEarned: 0,
      });
      (getTopicsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (countReviewsDue as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      const request = createMockRequest({
        messages: [{
          role: 'user',
          parts: [
            { type: 'text', text: '/progress' },
            { type: 'image', image: 'base64data' }, // Should be ignored
          ],
        }],
      });

      const response = await messageHandler(request);

      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain('Progress');
    });
  });

  describe('Command Whitespace Handling', () => {
    it('should handle commands with leading whitespace', async () => {
      const { getTopicsByUser } = await import('@/lib/db/topics');
      (getTopicsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const request = createMockRequest({
        messages: [{ role: 'user', content: '  /topics' }],
      });

      const response = await messageHandler(request);
      expect(response.status).toBe(200);
    });

    it('should handle commands with trailing whitespace', async () => {
      const { getTopicsByUser } = await import('@/lib/db/topics');
      (getTopicsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const request = createMockRequest({
        messages: [{ role: 'user', content: '/topics   ' }],
      });

      const response = await messageHandler(request);
      expect(response.status).toBe(200);
    });
  });

  describe('Skip Command Edge Cases', () => {
    it('should enforce skip limit', async () => {
      const { getTopicById } = await import('@/lib/db/topics');
      const { getActiveSession, getSessionById } = await import('@/lib/db/sessions');

      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 't-1', userId: 'user-123', name: 'Rust',
      });
      (getActiveSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 's-1', topicId: 't-1',
      });
      (getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 's-1',
        skipsUsed: 3, // Max skips used
        skippedQuestionIds: ['q-1', 'q-2', 'q-3'],
        currentQuestionId: 'q-4',
      });

      const request = createMockRequest({
        messages: [{ role: 'user', content: '/skip' }],
        topicId: 't-1',
      });

      const response = await messageHandler(request);

      expect(response.status).toBe(200);
      const text = await response.text();
      // Actual message: "Hohoho! No skips remaining. A true master faces every challenge!"
      expect(text.toLowerCase()).toContain('no skips remaining');
    });

    it('should handle skip when no current question', async () => {
      const { getTopicById } = await import('@/lib/db/topics');
      const { getActiveSession, getSessionById } = await import('@/lib/db/sessions');

      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 't-1', userId: 'user-123', name: 'Rust',
      });
      (getActiveSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 's-1', topicId: 't-1',
      });
      (getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 's-1',
        skipsUsed: 0,
        skippedQuestionIds: [],
        currentQuestionId: null, // No current question
      });

      const request = createMockRequest({
        messages: [{ role: 'user', content: '/skip' }],
        topicId: 't-1',
      });

      const response = await messageHandler(request);

      expect(response.status).toBe(200);
      const text = await response.text();
      // Actual message: "No active question to skip!"
      expect(text.toLowerCase()).toContain('no active question');
    });
  });

  describe('Hint Command Conversation Context Fallback', () => {
    it('should use conversation context when no currentQuestionId', async () => {
      const { getTopicById } = await import('@/lib/db/topics');
      const { getActiveSession, getSessionById } = await import('@/lib/db/sessions');
      const { prisma } = await import('@/lib/db/client');

      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 't-1', userId: 'user-123', name: 'Rust',
      });
      (getActiveSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 's-1', topicId: 't-1',
      });
      (getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 's-1',
        hintsUsed: 0,
        currentQuestionId: null, // No formal question tracked
      });

      // Mock conversation with a question from Sensie
      (prisma.message.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'msg-1', role: 'SENSIE', content: 'What do you think makes ownership unique in Rust?' },
        { id: 'msg-2', role: 'USER', content: 'I am not sure' },
      ]);

      (prisma.learningSession.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const request = createMockRequest({
        messages: [{ role: 'user', content: '/hint' }],
        topicId: 't-1',
      });

      const response = await messageHandler(request);

      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain('Hint 1/3');
      expect(text.toLowerCase()).toContain('fundamental');
    });

    it('should return progressive hints from conversation context', async () => {
      const { getTopicById } = await import('@/lib/db/topics');
      const { getActiveSession, getSessionById } = await import('@/lib/db/sessions');
      const { prisma } = await import('@/lib/db/client');

      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 't-1', userId: 'user-123', name: 'Rust',
      });
      (getActiveSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 's-1', topicId: 't-1',
      });
      (getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 's-1',
        hintsUsed: 1, // Already used 1 hint
        currentQuestionId: null,
      });

      (prisma.message.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'msg-1', role: 'SENSIE', content: 'How would you describe memory management in Rust?' },
      ]);

      (prisma.learningSession.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const request = createMockRequest({
        messages: [{ role: 'user', content: '/hint' }],
        topicId: 't-1',
      });

      const response = await messageHandler(request);

      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain('Hint 2/3');
      expect(text.toLowerCase()).toContain('break down');
    });

    it('should ignore hint messages when looking for questions', async () => {
      const { getTopicById } = await import('@/lib/db/topics');
      const { getActiveSession, getSessionById } = await import('@/lib/db/sessions');
      const { prisma } = await import('@/lib/db/client');

      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 't-1', userId: 'user-123', name: 'Rust',
      });
      (getActiveSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 's-1', topicId: 't-1',
      });
      (getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 's-1',
        hintsUsed: 0,
        currentQuestionId: null,
      });

      // Most recent message is a hint, should find the earlier question
      (prisma.message.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'msg-3', role: 'SENSIE', content: '**Hint 1/3:** Think about memory...' },
        { id: 'msg-2', role: 'USER', content: '/hint' },
        { id: 'msg-1', role: 'SENSIE', content: 'What is the borrow checker?' },
      ]);

      (prisma.learningSession.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const request = createMockRequest({
        messages: [{ role: 'user', content: '/hint' }],
        topicId: 't-1',
      });

      const response = await messageHandler(request);

      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain('Hint 1/3');
    });

    it('should return no active question when no questions in conversation', async () => {
      const { getTopicById } = await import('@/lib/db/topics');
      const { getActiveSession, getSessionById } = await import('@/lib/db/sessions');
      const { prisma } = await import('@/lib/db/client');

      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 't-1', userId: 'user-123', name: 'Rust',
      });
      (getActiveSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 's-1', topicId: 't-1',
      });
      (getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 's-1',
        hintsUsed: 0,
        currentQuestionId: null,
      });

      // No questions in conversation - only statements
      (prisma.message.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'msg-2', role: 'SENSIE', content: 'Welcome to your training, young apprentice!' },
        { id: 'msg-1', role: 'USER', content: 'Hello Sensie' },
      ]);

      const request = createMockRequest({
        messages: [{ role: 'user', content: '/hint' }],
        topicId: 't-1',
      });

      const response = await messageHandler(request);

      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text.toLowerCase()).toContain('no active question');
    });
  });

  describe('Hint Command Edge Cases', () => {
    it('should handle hint when all hints used', async () => {
      const { getTopicById } = await import('@/lib/db/topics');
      const { getActiveSession, getSessionById } = await import('@/lib/db/sessions');

      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 't-1', userId: 'user-123', name: 'Rust',
      });
      (getActiveSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 's-1', topicId: 't-1',
      });
      (getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 's-1',
        hintsUsed: 3, // All hints used
        currentQuestionId: 'q-1',
      });

      const request = createMockRequest({
        messages: [{ role: 'user', content: '/hint' }],
        topicId: 't-1',
      });

      const response = await messageHandler(request);

      expect(response.status).toBe(200);
      const text = await response.text();
      // Actual message: "Hohoho! You've used all 3 hints for this question."
      expect(text.toLowerCase()).toMatch(/used all.*hints/i);
    });

    it('should handle hint when no session', async () => {
      const { getTopicById } = await import('@/lib/db/topics');
      const { getActiveSession } = await import('@/lib/db/sessions');

      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 't-1', userId: 'user-123', name: 'Rust',
      });
      (getActiveSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const request = createMockRequest({
        messages: [{ role: 'user', content: '/hint' }],
        topicId: 't-1',
      });

      const response = await messageHandler(request);

      expect(response.status).toBe(200);
      const text = await response.text();
      // Actual message: "Hohoho! You need to be in a learning session to get hints."
      expect(text.toLowerCase()).toContain('learning session');
    });
  });

  describe('Continue Command Edge Cases', () => {
    it('should handle continue with multiple sessions', async () => {
      const { getActiveSessionsByUser, getSessionMessages } = await import('@/lib/db/sessions');
      const { getTopicById, getActiveTopics } = await import('@/lib/db/topics');

      (getActiveSessionsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 's-1', topicId: 't-1', updatedAt: new Date('2024-01-02'), currentSubtopicId: null },
        { id: 's-2', topicId: 't-2', updatedAt: new Date('2024-01-01'), currentSubtopicId: null },
      ]);
      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 't-1',
        name: 'Most Recent Topic',
        masteryPercentage: 45,
      });
      (getSessionMessages as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const request = createMockRequest({
        messages: [{ role: 'user', content: '/continue' }],
      });

      const response = await messageHandler(request);

      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain('Most Recent Topic');
    });

    it('should handle continue when topic not found', async () => {
      const { getActiveSessionsByUser, getSessionMessages } = await import('@/lib/db/sessions');
      const { getTopicById, getActiveTopics } = await import('@/lib/db/topics');

      (getActiveSessionsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 's-1', topicId: 't-1', updatedAt: new Date(), currentSubtopicId: null },
      ]);
      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue(null); // Topic deleted
      (getActiveTopics as ReturnType<typeof vi.fn>).mockResolvedValue([]); // No active topics either
      (getSessionMessages as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const request = createMockRequest({
        messages: [{ role: 'user', content: '/continue' }],
      });

      const response = await messageHandler(request);

      expect(response.status).toBe(200);
      const text = await response.text();
      // Actual message: "No active topics to continue!"
      expect(text.toLowerCase()).toContain('no active topics');
    });
  });

  describe('Break Command Edge Cases', () => {
    it('should handle break without topicId', async () => {
      const request = createMockRequest({
        messages: [{ role: 'user', content: '/break' }],
        // No topicId provided
      });

      const response = await messageHandler(request);

      expect(response.status).toBe(200);
      const text = await response.text();
      // Should still work - general break response
      expect(text.toLowerCase()).toMatch(/break|rest|continue/i);
    });

    it('should calculate session duration correctly', async () => {
      const { getTopicById } = await import('@/lib/db/topics');
      const { getActiveSession, getSessionById, endSession } = await import('@/lib/db/sessions');
      const { prisma } = await import('@/lib/db/client');

      const sessionStart = new Date(Date.now() - 45 * 60 * 1000); // 45 minutes ago

      (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 't-1', userId: 'user-123', name: 'Rust',
      });
      (getActiveSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 's-1', topicId: 't-1',
      });
      (getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 's-1',
        createdAt: sessionStart,
      });
      (prisma.message.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { role: 'USER' }, { role: 'USER' }, { role: 'USER' },
      ]);
      (prisma.learningSession.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const request = createMockRequest({
        messages: [{ role: 'user', content: '/break' }],
        topicId: 't-1',
      });

      const response = await messageHandler(request);

      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain('45 minutes');
    });
  });

  describe('Quiz Command Edge Cases', () => {
    it('should handle quiz with multiple active topics', async () => {
      const { getActiveTopics } = await import('@/lib/db/topics');

      (getActiveTopics as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 't-1', name: 'Rust', masteryPercentage: 60 },
        { id: 't-2', name: 'Go', masteryPercentage: 30 },
        { id: 't-3', name: 'Python', masteryPercentage: 80 },
      ]);

      const request = createMockRequest({
        messages: [{ role: 'user', content: '/quiz' }],
      });

      const response = await messageHandler(request);

      expect(response.status).toBe(200);
      const text = await response.text();
      // Should list topics to choose from
      expect(text).toContain('Quiz Time');
    });
  });

  describe('Review Command Edge Cases', () => {
    it('should handle review with zero reviews due', async () => {
      const { countReviewsDue } = await import('@/lib/db/reviews');

      (countReviewsDue as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      const request = createMockRequest({
        messages: [{ role: 'user', content: '/review' }],
      });

      const response = await messageHandler(request);

      expect(response.status).toBe(200);
      const text = await response.text();
      // Actual message: "Hohoho! No reviews due right now. Great work keeping up with your training!"
      expect(text.toLowerCase()).toContain('no reviews due');
    });

    it('should display first review concept', async () => {
      const { countReviewsDue, getReviewsDue } = await import('@/lib/db/reviews');
      const { prisma } = await import('@/lib/db/client');

      (countReviewsDue as ReturnType<typeof vi.fn>).mockResolvedValue(5);
      (getReviewsDue as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'r-1', conceptId: 'c-1' },
      ]);
      (prisma.concept.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        name: 'Ownership and Borrowing',
      });

      const request = createMockRequest({
        messages: [{ role: 'user', content: '/review' }],
      });

      const response = await messageHandler(request);

      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain('5 Review');
      expect(text).toContain('Ownership and Borrowing');
    });
  });

  describe('Progress Command Edge Cases', () => {
    it('should handle zero progress gracefully', async () => {
      const { getUserProgress, getTodayAnalytics } = await import('@/lib/db/progress');
      const { getTopicsByUser } = await import('@/lib/db/topics');
      const { countReviewsDue } = await import('@/lib/db/reviews');

      // Command handler expects progress to have defaults, so provide minimal data
      (getUserProgress as ReturnType<typeof vi.fn>).mockResolvedValue({
        currentLevel: 1,
        totalXP: 0,
        currentStreak: 0,
        longestStreak: 0,
      });
      (getTodayAnalytics as ReturnType<typeof vi.fn>).mockResolvedValue({
        questionsAnswered: 0,
        questionsCorrect: 0,
        xpEarned: 0,
      });
      (getTopicsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (countReviewsDue as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      const request = createMockRequest({
        messages: [{ role: 'user', content: '/progress' }],
      });

      const response = await messageHandler(request);

      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain('Progress');
      expect(text).toContain('Level 1');
    });

    it('should show today\'s statistics', async () => {
      const { getUserProgress, getTodayAnalytics } = await import('@/lib/db/progress');
      const { getTopicsByUser } = await import('@/lib/db/topics');
      const { countReviewsDue } = await import('@/lib/db/reviews');

      (getUserProgress as ReturnType<typeof vi.fn>).mockResolvedValue({
        currentLevel: 5,
        totalXP: 1500,
        currentStreak: 7,
        longestStreak: 14,
      });
      (getTodayAnalytics as ReturnType<typeof vi.fn>).mockResolvedValue({
        questionsAnswered: 20,
        questionsCorrect: 18,
        xpEarned: 100,
      });
      (getTopicsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 't-1', name: 'Rust', status: 'ACTIVE', masteryPercentage: 75 },
      ]);
      (countReviewsDue as ReturnType<typeof vi.fn>).mockResolvedValue(3);

      const request = createMockRequest({
        messages: [{ role: 'user', content: '/progress' }],
      });

      const response = await messageHandler(request);

      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain('Level 5');
      expect(text).toContain('1500 XP');
      expect(text).toContain('7 day');
      // Check for questions answered count
      expect(text).toContain('20');
    });
  });

  describe('Topics Command Edge Cases', () => {
    it('should show subtopics when available', async () => {
      const { getTopicsByUser } = await import('@/lib/db/topics');

      (getTopicsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: 't-1',
          name: 'Rust Programming',
          status: 'ACTIVE',
          masteryPercentage: 50,
          subtopics: [
            { name: 'Ownership', masteryPercentage: 80, isLocked: false },
            { name: 'Borrowing', masteryPercentage: 30, isLocked: false },
            { name: 'Lifetimes', masteryPercentage: 10, isLocked: true },
          ],
        },
      ]);

      const request = createMockRequest({
        messages: [{ role: 'user', content: '/topics' }],
      });

      const response = await messageHandler(request);

      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain('Rust Programming');
      // The /topics command shows "Current: <subtopic>" for first in-progress subtopic
      // The logic finds first unlocked subtopic with mastery < 100, which is "Ownership"
      expect(text).toContain('Current: Ownership');
    });

    it('should group topics by status', async () => {
      const { getTopicsByUser } = await import('@/lib/db/topics');

      (getTopicsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 't-1', name: 'Active Topic', status: 'ACTIVE', masteryPercentage: 50, subtopics: [] },
        { id: 't-2', name: 'Queued Topic', status: 'QUEUED', masteryPercentage: 0, subtopics: [] },
        { id: 't-3', name: 'Completed Topic', status: 'COMPLETED', masteryPercentage: 100, subtopics: [] },
      ]);

      const request = createMockRequest({
        messages: [{ role: 'user', content: '/topics' }],
      });

      const response = await messageHandler(request);

      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain('Active Topic');
      expect(text).toContain('Queued Topic');
      expect(text).toContain('Completed Topic');
    });
  });

  describe('Stream Response Format Verification', () => {
    it('should include all required stream protocol parts', async () => {
      const { getTopicsByUser } = await import('@/lib/db/topics');
      (getTopicsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const request = createMockRequest({
        messages: [{ role: 'user', content: '/topics' }],
      });

      const response = await messageHandler(request);

      expect(response.status).toBe(200);
      const text = await response.text();

      // Verify AI SDK stream format markers are present
      expect(text).toContain('data:'); // SSE data prefix
      expect(text).toContain('"type":"start"'); // Start message
      expect(text).toContain('"type":"text-delta"'); // Text delta
      expect(text).toContain('"type":"finish"'); // Finish message
      expect(text).toContain('[DONE]'); // SSE done marker
    });

    it('should have correct Content-Type header', async () => {
      const { getTopicsByUser } = await import('@/lib/db/topics');
      (getTopicsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const request = createMockRequest({
        messages: [{ role: 'user', content: '/topics' }],
      });

      const response = await messageHandler(request);

      // AI SDK uses text/event-stream for SSE
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    });

    it('should include complete message lifecycle events', async () => {
      const { getTopicsByUser } = await import('@/lib/db/topics');
      (getTopicsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const request = createMockRequest({
        messages: [{ role: 'user', content: '/topics' }],
      });

      const response = await messageHandler(request);
      const text = await response.text();

      // Verify full message lifecycle
      expect(text).toContain('"type":"start"');
      expect(text).toContain('"type":"start-step"');
      expect(text).toContain('"type":"text-start"');
      expect(text).toContain('"type":"text-delta"');
      expect(text).toContain('"type":"text-end"');
      expect(text).toContain('"type":"finish-step"');
      expect(text).toContain('"type":"finish"');
    });
  });

  describe('Phase 2 Commands', () => {
    describe('/feynman command', () => {
      it('should start Feynman exercise with topic context', async () => {
        const { getTopicById } = await import('@/lib/db/topics');
        const { prisma } = await import('@/lib/db/client');

        (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: 't-1',
          userId: 'user-123',
          name: 'Rust Programming',
          masteryPercentage: 85,
        });

        (prisma.topic.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: 't-1',
          userId: 'user-123',
          masteryPercentage: 85,
          subtopics: [
            {
              isLocked: false,
              concepts: [{ id: 'c-1', name: 'Ownership' }],
            },
          ],
        });

        // Mock for feynman engine to check if trigger is valid
        (prisma.feynmanExercise.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        (prisma.feynmanExercise.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
        (prisma.feynmanExercise.create as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: 'exercise-1',
          conceptName: 'Ownership',
          status: 'IN_PROGRESS',
        });

        const request = createMockRequest({
          messages: [{ role: 'user', content: '/feynman' }],
          topicId: 't-1',
        });

        const response = await messageHandler(request);

        expect(response.status).toBe(200);
        const text = await response.text();
        expect(text.toLowerCase()).toMatch(/feynman|explain/i);
      });

      it('should handle /feynman without topic context', async () => {
        const { getActiveTopics } = await import('@/lib/db/topics');

        (getActiveTopics as ReturnType<typeof vi.fn>).mockResolvedValue([
          { id: 't-1', name: 'Rust Programming', masteryPercentage: 85 },
        ]);

        const request = createMockRequest({
          messages: [{ role: 'user', content: '/feynman' }],
        });

        const response = await messageHandler(request);

        expect(response.status).toBe(200);
      });
    });

    describe('/analytics command', () => {
      it('should show weekly analytics by default', async () => {
        const { getUserProgress, getTodayAnalytics } = await import('@/lib/db/progress');
        const { getTopicsByUser } = await import('@/lib/db/topics');
        const { countReviewsDue } = await import('@/lib/db/reviews');
        const { prisma } = await import('@/lib/db/client');

        // Mock for analytics-engine calls
        (prisma.learningAnalytics.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
        (prisma.userProgress.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
          totalXP: 2500,
          currentStreak: 10,
          longestStreak: 15,
        });
        (prisma.badge.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
        (prisma.learningSession.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
        (prisma.answer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
        (prisma.review.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
        (prisma.feynmanExercise.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
        (prisma.topic.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);
        (prisma.concept.count as ReturnType<typeof vi.fn>).mockResolvedValue(5);

        (getUserProgress as ReturnType<typeof vi.fn>).mockResolvedValue({
          currentLevel: 5,
          totalXP: 2500,
          currentStreak: 10,
          longestStreak: 15,
        });

        (getTodayAnalytics as ReturnType<typeof vi.fn>).mockResolvedValue({
          questionsAnswered: 25,
          questionsCorrect: 20,
          xpEarned: 150,
        });

        (getTopicsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([
          { id: 't-1', name: 'Rust', status: 'ACTIVE', masteryPercentage: 75 },
        ]);

        (countReviewsDue as ReturnType<typeof vi.fn>).mockResolvedValue(5);

        const request = createMockRequest({
          messages: [{ role: 'user', content: '/analytics' }],
        });

        const response = await messageHandler(request);

        expect(response.status).toBe(200);
        const text = await response.text();
        expect(text.toLowerCase()).toMatch(/analytics|stats|level/i);
      });

      it('should support period argument', async () => {
        const { getUserProgress, getTodayAnalytics } = await import('@/lib/db/progress');
        const { getTopicsByUser } = await import('@/lib/db/topics');
        const { countReviewsDue } = await import('@/lib/db/reviews');
        const { prisma } = await import('@/lib/db/client');

        // Mock for analytics-engine calls
        (prisma.learningAnalytics.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
        (prisma.userProgress.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
          totalXP: 1000,
          currentStreak: 5,
          longestStreak: 10,
        });
        (prisma.badge.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
        (prisma.learningSession.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
        (prisma.answer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
        (prisma.review.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
        (prisma.feynmanExercise.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
        (prisma.topic.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
        (prisma.concept.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

        (getUserProgress as ReturnType<typeof vi.fn>).mockResolvedValue({
          currentLevel: 3,
          totalXP: 1000,
          currentStreak: 5,
          longestStreak: 10,
        });
        (getTodayAnalytics as ReturnType<typeof vi.fn>).mockResolvedValue({
          questionsAnswered: 10,
          questionsCorrect: 8,
          xpEarned: 50,
        });
        (getTopicsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([]);
        (countReviewsDue as ReturnType<typeof vi.fn>).mockResolvedValue(0);

        const request = createMockRequest({
          messages: [{ role: 'user', content: '/analytics daily' }],
        });

        const response = await messageHandler(request);

        expect(response.status).toBe(200);
      });
    });

    describe('/gaps command', () => {
      it('should show knowledge gaps for topic', async () => {
        const { getTopicById } = await import('@/lib/db/topics');
        const { prisma } = await import('@/lib/db/client');

        (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: 't-1',
          userId: 'user-123',
          name: 'Rust Programming',
          masteryPercentage: 60,
        });

        (prisma.topic.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: 't-1',
          userId: 'user-123',
          masteryPercentage: 60,
          subtopics: [
            {
              name: 'Basics',
              masteryPercentage: 50,
              concepts: [{ id: 'c-1', name: 'Ownership', isMastered: false }],
            },
          ],
        });

        // Mock for gap-detector calls
        (prisma.answer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
          { isCorrect: false, depth: 'SHALLOW', hintsUsed: 0, question: { concept: { name: 'Ownership', subtopic: { name: 'Basics' } } } },
        ]);
        (prisma.knowledgeGapRecord.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

        const request = createMockRequest({
          messages: [{ role: 'user', content: '/gaps' }],
          topicId: 't-1',
        });

        const response = await messageHandler(request);

        expect(response.status).toBe(200);
        const text = await response.text();
        expect(text.toLowerCase()).toMatch(/gap|knowledge|analysis/i);
      });

      it('should handle /gaps without topic context', async () => {
        const { getActiveTopics } = await import('@/lib/db/topics');

        (getActiveTopics as ReturnType<typeof vi.fn>).mockResolvedValue([]);

        const request = createMockRequest({
          messages: [{ role: 'user', content: '/gaps' }],
        });

        const response = await messageHandler(request);

        expect(response.status).toBe(200);
      });
    });
  });
});
