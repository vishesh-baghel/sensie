import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isCommand,
  parseCommand,
  executeCommand,
  SUPPORTED_COMMANDS,
  type SupportedCommand,
  type CommandContext,
} from '@/lib/chat/commands';

// Mock all database modules
vi.mock('@/lib/db/client', () => ({
  prisma: {
    question: {
      findUnique: vi.fn(),
    },
    learningSession: {
      update: vi.fn(),
    },
    message: {
      findMany: vi.fn(),
    },
    subtopic: {
      findUnique: vi.fn(),
    },
    concept: {
      findUnique: vi.fn(),
    },
    topic: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/db/topics', () => ({
  getTopicsByUser: vi.fn(),
  getActiveTopics: vi.fn(),
  getTopicById: vi.fn(),
}));

vi.mock('@/lib/db/sessions', () => ({
  getSessionById: vi.fn(),
  endSession: vi.fn(),
  getActiveSessionsByUser: vi.fn(),
  getSessionMessages: vi.fn(),
}));

vi.mock('@/lib/db/reviews', () => ({
  countReviewsDue: vi.fn(),
  getReviewsDue: vi.fn(),
}));

vi.mock('@/lib/db/progress', () => ({
  getUserProgress: vi.fn(),
  getTodayAnalytics: vi.fn(),
}));

vi.mock('@/lib/mastra/agents/sensie', () => ({
  generateProgressReport: vi.fn(),
  generateQuiz: vi.fn(),
  handleCommand: vi.fn(),
}));

// Mock new Phase 2 modules
vi.mock('@/lib/learning/feynman-engine', () => ({
  shouldTriggerFeynman: vi.fn(),
  startFeynmanExercise: vi.fn(),
  getActiveFeynmanExercise: vi.fn(),
  getFeynmanPrompt: vi.fn().mockReturnValue('Feynman prompt'),
  getFeynmanStats: vi.fn(),
  FEYNMAN_TRIGGER_MASTERY: 80,
}));

vi.mock('@/lib/learning/analytics-engine', () => ({
  getLearningAnalytics: vi.fn(),
}));

vi.mock('@/lib/learning/gap-detector', () => ({
  analyzeKnowledgeGaps: vi.fn(),
}));

describe('Chat Commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isCommand', () => {
    it('should return true for valid commands', () => {
      expect(isCommand('/hint')).toBe(true);
      expect(isCommand('/skip')).toBe(true);
      expect(isCommand('/progress')).toBe(true);
      expect(isCommand('/topics')).toBe(true);
      expect(isCommand('/review')).toBe(true);
      expect(isCommand('/quiz')).toBe(true);
      expect(isCommand('/break')).toBe(true);
      expect(isCommand('/continue')).toBe(true);
    });

    it('should return true for commands with trailing text', () => {
      expect(isCommand('/hint please')).toBe(true);
      expect(isCommand('/progress detailed')).toBe(true);
    });

    it('should return true for commands with different casing', () => {
      expect(isCommand('/HINT')).toBe(true);
      expect(isCommand('/Progress')).toBe(true);
      expect(isCommand('/CONTINUE')).toBe(true);
    });

    it('should return true for commands with leading/trailing whitespace', () => {
      expect(isCommand('  /hint  ')).toBe(true);
      expect(isCommand('\n/progress\n')).toBe(true);
    });

    it('should return false for regular messages', () => {
      expect(isCommand('Hello Sensie')).toBe(false);
      expect(isCommand('What is ownership?')).toBe(false);
      expect(isCommand('I think the answer is...')).toBe(false);
    });

    it('should return false for messages containing command text but not starting with it', () => {
      expect(isCommand('I need a /hint')).toBe(false);
      expect(isCommand('Show me /progress')).toBe(false);
    });

    it('should return false for unknown commands', () => {
      expect(isCommand('/unknown')).toBe(false);
      expect(isCommand('/help')).toBe(false);
      expect(isCommand('/exit')).toBe(false);
    });

    it('should return false for empty or whitespace-only messages', () => {
      expect(isCommand('')).toBe(false);
      expect(isCommand('   ')).toBe(false);
      expect(isCommand('\n\t')).toBe(false);
    });
  });

  describe('parseCommand', () => {
    it('should parse valid commands correctly', () => {
      expect(parseCommand('/hint')).toEqual({ command: '/hint', args: '' });
      expect(parseCommand('/skip')).toEqual({ command: '/skip', args: '' });
      expect(parseCommand('/progress')).toEqual({ command: '/progress', args: '' });
      expect(parseCommand('/continue')).toEqual({ command: '/continue', args: '' });
    });

    it('should extract arguments after command', () => {
      expect(parseCommand('/quiz topic-123')).toEqual({ command: '/quiz', args: 'topic-123' });
      expect(parseCommand('/hint please')).toEqual({ command: '/hint', args: 'please' });
    });

    it('should handle case-insensitive commands', () => {
      expect(parseCommand('/HINT')).toEqual({ command: '/hint', args: '' });
      expect(parseCommand('/Progress')).toEqual({ command: '/progress', args: '' });
    });

    it('should return null for unknown commands', () => {
      expect(parseCommand('/unknown')).toEqual({ command: null, args: '' });
      expect(parseCommand('/help')).toEqual({ command: null, args: '' });
    });

    it('should return null for non-command messages', () => {
      expect(parseCommand('Hello')).toEqual({ command: null, args: '' });
      expect(parseCommand('What is this?')).toEqual({ command: null, args: '' });
    });
  });

  describe('executeCommand', () => {
    const mockContext: CommandContext = {
      userId: 'user-123',
      topicId: 'topic-123',
      sessionId: 'session-123',
    };

    describe('/hint command', () => {
      it('should require a session', async () => {
        const result = await executeCommand('/hint', { userId: 'user-123' });

        expect(result.success).toBe(false);
        expect(result.message).toContain('need to be in a learning session');
      });

      it('should check for max hints used', async () => {
        const { getSessionById } = await import('@/lib/db/sessions');
        (getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: 'session-123',
          hintsUsed: 3,
          currentQuestionId: 'q-123',
        });

        const result = await executeCommand('/hint', mockContext);

        expect(result.success).toBe(false);
        expect(result.message).toContain("You've used all 3 hints");
      });

      it('should use conversation context when no currentQuestionId', async () => {
        const { getSessionById } = await import('@/lib/db/sessions');
        const { prisma } = await import('@/lib/db/client');

        (getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: 'session-123',
          hintsUsed: 0,
          currentQuestionId: null,
        });

        // Mock conversation messages with a question from Sensie
        (prisma.message.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
          { id: 'msg-1', role: 'SENSIE', content: 'What do you think is the purpose of ownership in Rust?' },
          { id: 'msg-2', role: 'USER', content: 'I am not sure' },
        ]);

        (prisma.learningSession.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

        const result = await executeCommand('/hint', mockContext);

        expect(result.success).toBe(true);
        expect(result.message).toContain('Hint 1/3');
        expect(result.message).toContain('fundamental concept');
      });

      it('should return no active question when no questions in conversation', async () => {
        const { getSessionById } = await import('@/lib/db/sessions');
        const { prisma } = await import('@/lib/db/client');

        (getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: 'session-123',
          hintsUsed: 0,
          currentQuestionId: null,
        });

        // No questions in the conversation
        (prisma.message.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
          { id: 'msg-1', role: 'SENSIE', content: 'Welcome to your training, apprentice!' },
          { id: 'msg-2', role: 'USER', content: 'Hello!' },
        ]);

        const result = await executeCommand('/hint', mockContext);

        expect(result.success).toBe(false);
        expect(result.message).toContain('No active question');
      });

      it('should return a hint when available', async () => {
        const { getSessionById } = await import('@/lib/db/sessions');
        const { prisma } = await import('@/lib/db/client');

        (getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: 'session-123',
          hintsUsed: 0,
          currentQuestionId: 'q-123',
        });

        (prisma.question.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: 'q-123',
          hints: ['First hint', 'Second hint', 'Third hint'],
          concept: { id: 'c-123' },
        });

        (prisma.learningSession.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

        const result = await executeCommand('/hint', mockContext);

        expect(result.success).toBe(true);
        expect(result.message).toContain('Hint 1/3');
        expect(result.message).toContain('First hint');
      });
    });

    describe('/skip command', () => {
      it('should require a session', async () => {
        const result = await executeCommand('/skip', { userId: 'user-123' });

        expect(result.success).toBe(false);
        expect(result.message).toContain('need to be in a learning session');
      });

      it('should check for max skips used', async () => {
        const { getSessionById } = await import('@/lib/db/sessions');
        (getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: 'session-123',
          skipsUsed: 3,
          skippedQuestionIds: ['q-1', 'q-2', 'q-3'],
          currentQuestionId: 'q-4',
        });

        const result = await executeCommand('/skip', mockContext);

        expect(result.success).toBe(false);
        expect(result.message).toContain('No skips remaining');
      });

      it('should skip question when valid', async () => {
        const { getSessionById } = await import('@/lib/db/sessions');
        const { prisma } = await import('@/lib/db/client');

        (getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: 'session-123',
          skipsUsed: 1,
          skippedQuestionIds: ['q-1'],
          currentQuestionId: 'q-2',
        });

        (prisma.learningSession.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

        const result = await executeCommand('/skip', mockContext);

        expect(result.success).toBe(true);
        expect(result.message).toContain('skipped');
        expect(result.data).toEqual({
          skipsUsed: 2,
          skipsRemaining: 1,
        });
      });
    });

    describe('/progress command', () => {
      it('should return progress data', async () => {
        const { getUserProgress, getTodayAnalytics } = await import('@/lib/db/progress');
        const { getTopicsByUser } = await import('@/lib/db/topics');
        const { countReviewsDue } = await import('@/lib/db/reviews');

        (getUserProgress as ReturnType<typeof vi.fn>).mockResolvedValue({
          currentLevel: 5,
          totalXP: 1250,
          currentStreak: 3,
          longestStreak: 7,
        });

        (getTodayAnalytics as ReturnType<typeof vi.fn>).mockResolvedValue({
          questionsAnswered: 10,
          questionsCorrect: 8,
          xpEarned: 50,
        });

        (getTopicsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([
          { id: 't-1', name: 'Rust', status: 'ACTIVE', masteryPercentage: 75, subtopics: [] },
          { id: 't-2', name: 'Go', status: 'COMPLETED', masteryPercentage: 95, subtopics: [] },
        ]);

        (countReviewsDue as ReturnType<typeof vi.fn>).mockResolvedValue(3);

        const result = await executeCommand('/progress', mockContext);

        expect(result.success).toBe(true);
        expect(result.message).toContain('Level 5');
        expect(result.message).toContain('1250 XP');
        expect(result.message).toContain('Active: 1/3');
        expect(result.message).toContain('Completed: 1');
        expect(result.message).toContain('3 reviews due');
      });
    });

    describe('/topics command', () => {
      it('should list all topics grouped by status', async () => {
        const { getTopicsByUser } = await import('@/lib/db/topics');

        (getTopicsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([
          { id: 't-1', name: 'Rust', status: 'ACTIVE', masteryPercentage: 75, subtopics: [] },
          { id: 't-2', name: 'Go', status: 'COMPLETED', masteryPercentage: 95, subtopics: [] },
          { id: 't-3', name: 'Python', status: 'QUEUED', masteryPercentage: 0, subtopics: [] },
        ]);

        const result = await executeCommand('/topics', mockContext);

        expect(result.success).toBe(true);
        expect(result.message).toContain('Active');
        expect(result.message).toContain('Rust');
        expect(result.message).toContain('Completed');
        expect(result.message).toContain('Go');
        expect(result.message).toContain('Queued');
        expect(result.message).toContain('Python');
      });

      it('should show message when no topics exist', async () => {
        const { getTopicsByUser } = await import('@/lib/db/topics');
        (getTopicsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([]);

        const result = await executeCommand('/topics', mockContext);

        expect(result.success).toBe(true);
        expect(result.message).toContain('No topics yet');
      });
    });

    describe('/review command', () => {
      it('should show message when no reviews due', async () => {
        const { countReviewsDue } = await import('@/lib/db/reviews');
        (countReviewsDue as ReturnType<typeof vi.fn>).mockResolvedValue(0);

        const result = await executeCommand('/review', mockContext);

        expect(result.success).toBe(true);
        expect(result.message).toContain('No reviews due');
      });

      it('should show review count and preview', async () => {
        const { countReviewsDue, getReviewsDue } = await import('@/lib/db/reviews');
        const { prisma } = await import('@/lib/db/client');

        (countReviewsDue as ReturnType<typeof vi.fn>).mockResolvedValue(5);
        (getReviewsDue as ReturnType<typeof vi.fn>).mockResolvedValue([
          { id: 'r-1', conceptId: 'c-1' },
          { id: 'r-2', conceptId: 'c-2' },
        ]);
        (prisma.concept.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
          name: 'Test Concept',
        });

        const result = await executeCommand('/review', mockContext);

        expect(result.success).toBe(true);
        expect(result.message).toContain('5 Reviews Due');
        expect(result.action).toBe('navigate');
        expect(result.navigateTo).toBe('/review');
      });
    });

    describe('/quiz command', () => {
      it('should prompt for quiz when no topic specified', async () => {
        const { getActiveTopics } = await import('@/lib/db/topics');
        (getActiveTopics as ReturnType<typeof vi.fn>).mockResolvedValue([
          { id: 't-1', name: 'Rust', masteryPercentage: 50 },
        ]);

        const result = await executeCommand('/quiz', { userId: 'user-123' });

        expect(result.success).toBe(true);
        expect(result.message).toContain('Quiz Time');
        expect(result.message).toContain('Rust');
      });

      it('should show error when no active topics', async () => {
        const { getActiveTopics } = await import('@/lib/db/topics');
        (getActiveTopics as ReturnType<typeof vi.fn>).mockResolvedValue([]);

        const result = await executeCommand('/quiz', { userId: 'user-123' });

        expect(result.success).toBe(false);
        expect(result.message).toContain('No active topics');
      });
    });

    describe('/break command', () => {
      it('should save progress and show summary', async () => {
        const { getSessionById } = await import('@/lib/db/sessions');
        const { prisma } = await import('@/lib/db/client');

        (getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: 'session-123',
          createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        });

        (prisma.message.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
          { role: 'USER' },
          { role: 'USER' },
          { role: 'USER' },
        ]);

        (prisma.learningSession.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

        const result = await executeCommand('/break', mockContext);

        expect(result.success).toBe(true);
        expect(result.message).toContain('/continue');
        expect(result.data).toHaveProperty('sessionDuration');
        expect(result.data).toHaveProperty('questionsAnswered');
      });
    });

    describe('/continue command', () => {
      it('should resume most recent session', async () => {
        const { getActiveSessionsByUser, getSessionMessages } = await import('@/lib/db/sessions');
        const { getTopicById } = await import('@/lib/db/topics');

        (getActiveSessionsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([
          { id: 'session-123', topicId: 'topic-123', currentSubtopicId: 'sub-1' },
        ]);

        (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: 'topic-123',
          name: 'Rust Programming',
          masteryPercentage: 65,
        });

        (getSessionMessages as ReturnType<typeof vi.fn>).mockResolvedValue([]);

        const result = await executeCommand('/continue', mockContext);

        expect(result.success).toBe(true);
        expect(result.message).toContain('Resuming: Rust Programming');
        expect(result.message).toContain('65%');
        expect(result.action).toBe('navigate');
        expect(result.navigateTo).toContain('topic=topic-123');
      });

      it('should fall back to active topic when no session', async () => {
        const { getActiveSessionsByUser } = await import('@/lib/db/sessions');
        const { getActiveTopics } = await import('@/lib/db/topics');

        (getActiveSessionsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([]);
        (getActiveTopics as ReturnType<typeof vi.fn>).mockResolvedValue([
          { id: 't-1', name: 'Go Basics', masteryPercentage: 30 },
        ]);

        const result = await executeCommand('/continue', mockContext);

        expect(result.success).toBe(true);
        expect(result.message).toContain('Go Basics');
        expect(result.action).toBe('navigate');
      });

      it('should show message when nothing to continue', async () => {
        const { getActiveSessionsByUser } = await import('@/lib/db/sessions');
        const { getActiveTopics } = await import('@/lib/db/topics');

        (getActiveSessionsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([]);
        (getActiveTopics as ReturnType<typeof vi.fn>).mockResolvedValue([]);

        const result = await executeCommand('/continue', mockContext);

        expect(result.success).toBe(false);
        expect(result.message).toContain('No active topics');
        expect(result.navigateTo).toBe('/topics');
      });
    });
  });

  describe('SUPPORTED_COMMANDS', () => {
    it('should contain all expected commands', () => {
      expect(SUPPORTED_COMMANDS).toContain('/hint');
      expect(SUPPORTED_COMMANDS).toContain('/skip');
      expect(SUPPORTED_COMMANDS).toContain('/progress');
      expect(SUPPORTED_COMMANDS).toContain('/topics');
      expect(SUPPORTED_COMMANDS).toContain('/review');
      expect(SUPPORTED_COMMANDS).toContain('/quiz');
      expect(SUPPORTED_COMMANDS).toContain('/break');
      expect(SUPPORTED_COMMANDS).toContain('/continue');
      expect(SUPPORTED_COMMANDS).toContain('/feynman');
      expect(SUPPORTED_COMMANDS).toContain('/analytics');
      expect(SUPPORTED_COMMANDS).toContain('/gaps');
    });

    it('should have 11 commands total', () => {
      expect(SUPPORTED_COMMANDS.length).toBe(11);
    });
  });

  describe('Edge Cases', () => {
    const mockContext: CommandContext = {
      userId: 'user-123',
      topicId: 'topic-123',
      sessionId: 'session-123',
    };

    describe('/hint edge cases', () => {
      it('should handle session not found', async () => {
        const { getSessionById } = await import('@/lib/db/sessions');
        (getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const result = await executeCommand('/hint', mockContext);

        expect(result.success).toBe(false);
        expect(result.message).toContain('Session not found');
      });

      it('should fall back to conversation context when question not found', async () => {
        const { getSessionById } = await import('@/lib/db/sessions');
        const { prisma } = await import('@/lib/db/client');

        (getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: 'session-123',
          hintsUsed: 0,
          currentQuestionId: 'q-123',
        });

        (prisma.question.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        // Mock conversation with a question from Sensie
        (prisma.message.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
          { id: 'msg-1', role: 'SENSIE', content: 'How does memory management work in Rust?' },
          { id: 'msg-2', role: 'USER', content: 'Not sure' },
        ]);

        (prisma.learningSession.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

        const result = await executeCommand('/hint', mockContext);

        expect(result.success).toBe(true);
        expect(result.message).toContain('Hint 1/3');
      });

      it('should show no active question when question not found and no conversation questions', async () => {
        const { getSessionById } = await import('@/lib/db/sessions');
        const { prisma } = await import('@/lib/db/client');

        (getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: 'session-123',
          hintsUsed: 0,
          currentQuestionId: 'q-123',
        });

        (prisma.question.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        // No questions in conversation either
        (prisma.message.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
          { id: 'msg-1', role: 'SENSIE', content: 'Great job so far!' },
        ]);

        const result = await executeCommand('/hint', mockContext);

        expect(result.success).toBe(false);
        expect(result.message).toContain('No active question');
      });

      it('should return progressive hints from conversation context', async () => {
        const { getSessionById } = await import('@/lib/db/sessions');
        const { prisma } = await import('@/lib/db/client');

        // First hint (hintsUsed = 0)
        (getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: 'session-123',
          hintsUsed: 1, // Already used 1 hint
          currentQuestionId: null,
        });

        (prisma.message.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
          { id: 'msg-1', role: 'SENSIE', content: 'What makes ownership unique in Rust?' },
        ]);

        (prisma.learningSession.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

        const result = await executeCommand('/hint', mockContext);

        expect(result.success).toBe(true);
        expect(result.message).toContain('Hint 2/3');
        expect(result.message).toContain('Break down');
      });

      it('should ignore hint messages when looking for questions', async () => {
        const { getSessionById } = await import('@/lib/db/sessions');
        const { prisma } = await import('@/lib/db/client');

        (getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: 'session-123',
          hintsUsed: 0,
          currentQuestionId: null,
        });

        // Most recent Sensie message is a hint, should find the earlier question
        (prisma.message.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
          { id: 'msg-3', role: 'SENSIE', content: '**Hint 1/3:** Think about it...' },
          { id: 'msg-2', role: 'USER', content: 'I need a hint' },
          { id: 'msg-1', role: 'SENSIE', content: 'What is the borrow checker?' },
        ]);

        (prisma.learningSession.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

        const result = await executeCommand('/hint', mockContext);

        expect(result.success).toBe(true);
        expect(result.message).toContain('Hint 1/3');
      });

      it('should ignore progress messages when looking for questions', async () => {
        const { getSessionById } = await import('@/lib/db/sessions');
        const { prisma } = await import('@/lib/db/client');

        (getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: 'session-123',
          hintsUsed: 0,
          currentQuestionId: null,
        });

        // Most recent Sensie message is a progress report, should find the earlier question
        (prisma.message.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
          { id: 'msg-3', role: 'SENSIE', content: '**Your Training Progress**\nLevel 5...' },
          { id: 'msg-2', role: 'USER', content: '/progress' },
          { id: 'msg-1', role: 'SENSIE', content: 'Why do we need lifetimes?' },
        ]);

        (prisma.learningSession.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

        const result = await executeCommand('/hint', mockContext);

        expect(result.success).toBe(true);
        expect(result.message).toContain('Hint 1/3');
      });

      it('should use fallback hint when hints array is empty', async () => {
        const { getSessionById } = await import('@/lib/db/sessions');
        const { prisma } = await import('@/lib/db/client');

        (getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: 'session-123',
          hintsUsed: 0,
          currentQuestionId: 'q-123',
        });

        (prisma.question.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: 'q-123',
          hints: [],
          concept: { id: 'c-123' },
        });

        (prisma.learningSession.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

        const result = await executeCommand('/hint', mockContext);

        expect(result.success).toBe(true);
        expect(result.message).toContain('Hint 1/3');
        expect(result.message).toContain('Think about the core principle');
      });

      it('should return progressive hints based on usage', async () => {
        const { getSessionById } = await import('@/lib/db/sessions');
        const { prisma } = await import('@/lib/db/client');

        // Test hint 2
        (getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: 'session-123',
          hintsUsed: 1,
          currentQuestionId: 'q-123',
        });

        (prisma.question.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: 'q-123',
          hints: ['First hint', 'Second hint', 'Third hint'],
          concept: { id: 'c-123' },
        });

        (prisma.learningSession.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

        const result = await executeCommand('/hint', mockContext);

        expect(result.success).toBe(true);
        expect(result.message).toContain('Hint 2/3');
        expect(result.message).toContain('Second hint');
      });
    });

    describe('/skip edge cases', () => {
      it('should handle session not found', async () => {
        const { getSessionById } = await import('@/lib/db/sessions');
        (getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const result = await executeCommand('/skip', mockContext);

        expect(result.success).toBe(false);
        expect(result.message).toContain('Session not found');
      });

      it('should handle no active question', async () => {
        const { getSessionById } = await import('@/lib/db/sessions');
        (getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: 'session-123',
          skipsUsed: 0,
          skippedQuestionIds: [],
          currentQuestionId: null,
        });

        const result = await executeCommand('/skip', mockContext);

        expect(result.success).toBe(false);
        expect(result.message).toContain('No active question');
      });
    });

    describe('/progress edge cases', () => {
      it('should handle zero topics gracefully', async () => {
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

        const result = await executeCommand('/progress', mockContext);

        expect(result.success).toBe(true);
        expect(result.message).toContain('Level 1');
        expect(result.message).toContain('0 XP');
        expect(result.message).toContain('Active: 0/3');
      });

      it('should calculate average mastery correctly', async () => {
        const { getUserProgress, getTodayAnalytics } = await import('@/lib/db/progress');
        const { getTopicsByUser } = await import('@/lib/db/topics');
        const { countReviewsDue } = await import('@/lib/db/reviews');

        (getUserProgress as ReturnType<typeof vi.fn>).mockResolvedValue({
          currentLevel: 3,
          totalXP: 500,
          currentStreak: 1,
          longestStreak: 5,
        });

        (getTodayAnalytics as ReturnType<typeof vi.fn>).mockResolvedValue({
          questionsAnswered: 5,
          questionsCorrect: 4,
          xpEarned: 20,
        });

        (getTopicsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([
          { id: 't-1', name: 'Rust', status: 'ACTIVE', masteryPercentage: 50 },
          { id: 't-2', name: 'Go', status: 'ACTIVE', masteryPercentage: 100 },
        ]);
        (countReviewsDue as ReturnType<typeof vi.fn>).mockResolvedValue(0);

        const result = await executeCommand('/progress', mockContext);

        expect(result.success).toBe(true);
        // Average should be (50 + 100) / 2 = 75%
        expect(result.message).toContain('75%');
      });
    });

    describe('/topics edge cases', () => {
      it('should show current subtopic in progress', async () => {
        const { getTopicsByUser } = await import('@/lib/db/topics');

        (getTopicsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([
          {
            id: 't-1',
            name: 'Rust',
            status: 'ACTIVE',
            masteryPercentage: 50,
            subtopics: [
              { id: 's-1', name: 'Ownership', isLocked: false, masteryPercentage: 100 },
              { id: 's-2', name: 'Borrowing', isLocked: false, masteryPercentage: 50 },
              { id: 's-3', name: 'Lifetimes', isLocked: true, masteryPercentage: 0 },
            ],
          },
        ]);

        const result = await executeCommand('/topics', mockContext);

        expect(result.success).toBe(true);
        expect(result.message).toContain('Rust');
        expect(result.message).toContain('Current: Borrowing');
      });
    });

    describe('/review edge cases', () => {
      it('should handle single review correctly', async () => {
        const { countReviewsDue, getReviewsDue } = await import('@/lib/db/reviews');
        const { prisma } = await import('@/lib/db/client');

        (countReviewsDue as ReturnType<typeof vi.fn>).mockResolvedValue(1);
        (getReviewsDue as ReturnType<typeof vi.fn>).mockResolvedValue([
          { id: 'r-1', conceptId: 'c-1' },
        ]);
        (prisma.concept.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
          name: 'Single Concept',
        });

        const result = await executeCommand('/review', mockContext);

        expect(result.success).toBe(true);
        expect(result.message).toContain('1 Review Due');
        expect(result.message).not.toContain('1 Reviews'); // Correct singular
      });

      it('should show ellipsis for many reviews', async () => {
        const { countReviewsDue, getReviewsDue } = await import('@/lib/db/reviews');
        const { prisma } = await import('@/lib/db/client');

        (countReviewsDue as ReturnType<typeof vi.fn>).mockResolvedValue(10);
        (getReviewsDue as ReturnType<typeof vi.fn>).mockResolvedValue([
          { id: 'r-1', conceptId: 'c-1' },
          { id: 'r-2', conceptId: 'c-2' },
          { id: 'r-3', conceptId: 'c-3' },
          { id: 'r-4', conceptId: 'c-4' },
          { id: 'r-5', conceptId: 'c-5' },
        ]);
        (prisma.concept.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
          name: 'Test Concept',
        });

        const result = await executeCommand('/review', mockContext);

        expect(result.success).toBe(true);
        expect(result.message).toContain('10 Reviews Due');
        expect(result.message).toContain('...and 5 more');
      });
    });

    describe('/quiz edge cases', () => {
      it('should use specific topic when provided', async () => {
        const { getTopicById } = await import('@/lib/db/topics');

        (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: 'topic-123',
          name: 'Specific Topic',
          masteryPercentage: 60,
        });

        const result = await executeCommand('/quiz', mockContext);

        expect(result.success).toBe(true);
        expect(result.message).toContain('Quiz Time');
        expect(result.message).toContain('Specific Topic');
      });

      it('should handle topic not found', async () => {
        const { getTopicById } = await import('@/lib/db/topics');
        (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const result = await executeCommand('/quiz', mockContext);

        expect(result.success).toBe(false);
        expect(result.message).toContain('Topic not found');
      });
    });

    describe('/break edge cases', () => {
      it('should handle no session gracefully', async () => {
        const result = await executeCommand('/break', { userId: 'user-123' });

        expect(result.success).toBe(true);
        expect(result.message).toContain('/continue');
      });

      it('should calculate session duration correctly', async () => {
        const { getSessionById } = await import('@/lib/db/sessions');
        const { prisma } = await import('@/lib/db/client');

        // 45 minutes ago
        (getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: 'session-123',
          createdAt: new Date(Date.now() - 45 * 60 * 1000),
        });

        (prisma.message.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
          { role: 'USER' },
          { role: 'USER' },
          { role: 'USER' },
          { role: 'USER' },
          { role: 'USER' },
        ]);

        (prisma.learningSession.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

        const result = await executeCommand('/break', mockContext);

        expect(result.success).toBe(true);
        expect(result.data).toHaveProperty('sessionDuration', 45);
        expect(result.data).toHaveProperty('questionsAnswered', 5);
      });
    });

    describe('/continue edge cases', () => {
      it('should show subtopic name when available', async () => {
        const { getActiveSessionsByUser, getSessionMessages } = await import('@/lib/db/sessions');
        const { getTopicById } = await import('@/lib/db/topics');
        const { prisma } = await import('@/lib/db/client');

        (getActiveSessionsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([
          { id: 'session-123', topicId: 'topic-123', currentSubtopicId: 'sub-1' },
        ]);

        (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: 'topic-123',
          name: 'Rust Programming',
          masteryPercentage: 65,
        });

        (prisma.subtopic.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: 'sub-1',
          name: 'Ownership Basics',
        });

        (getSessionMessages as ReturnType<typeof vi.fn>).mockResolvedValue([
          { id: 'msg-1', role: 'USER', content: 'Hello' },
          { id: 'msg-2', role: 'SENSIE', content: 'Hi!' },
        ]);

        const result = await executeCommand('/continue', mockContext);

        expect(result.success).toBe(true);
        expect(result.message).toContain('Resuming: Rust Programming');
        expect(result.message).toContain('Current subtopic: Ownership Basics');
        expect(result.message).toContain('2 messages');
      });

      it('should handle topic not found for session', async () => {
        const { getActiveSessionsByUser, getSessionMessages } = await import('@/lib/db/sessions');
        const { getTopicById, getActiveTopics } = await import('@/lib/db/topics');

        (getActiveSessionsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([
          { id: 'session-123', topicId: 'topic-123', currentSubtopicId: null },
        ]);

        (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        (getActiveTopics as ReturnType<typeof vi.fn>).mockResolvedValue([]);
        (getSessionMessages as ReturnType<typeof vi.fn>).mockResolvedValue([]);

        const result = await executeCommand('/continue', mockContext);

        expect(result.success).toBe(false);
        expect(result.message).toContain('No active topics');
      });
    });
  });

  describe('Command Result Structure', () => {
    it('should return consistent result structure for success', async () => {
      const { getTopicsByUser } = await import('@/lib/db/topics');
      (getTopicsByUser as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await executeCommand('/topics', { userId: 'user-123' });

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.message).toBe('string');
    });

    it('should return consistent result structure for failure', async () => {
      const result = await executeCommand('/hint', { userId: 'user-123' });

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
      expect(result.success).toBe(false);
      expect(typeof result.message).toBe('string');
    });

    it('should include data when available', async () => {
      const { getSessionById } = await import('@/lib/db/sessions');
      (getSessionById as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'session-123',
        hintsUsed: 3,
        currentQuestionId: 'q-123',
      });

      const result = await executeCommand('/hint', {
        userId: 'user-123',
        sessionId: 'session-123',
      });

      expect(result.data).toBeDefined();
      expect(result.data).toHaveProperty('hintsUsed');
      expect(result.data).toHaveProperty('maxHints');
    });

    it('should include navigation info when applicable', async () => {
      const { countReviewsDue, getReviewsDue } = await import('@/lib/db/reviews');
      const { prisma } = await import('@/lib/db/client');

      (countReviewsDue as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      (getReviewsDue as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'r-1', conceptId: 'c-1' },
      ]);
      (prisma.concept.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        name: 'Test',
      });

      const result = await executeCommand('/review', { userId: 'user-123' });

      expect(result.action).toBe('navigate');
      expect(result.navigateTo).toBe('/review');
    });
  });

  describe('New Commands (Phase 2)', () => {
    const mockContext: CommandContext = {
      userId: 'user-123',
      topicId: 'topic-123',
      sessionId: 'session-123',
    };

    describe('/feynman command', () => {
      it('should show stats when using /feynman status', async () => {
        const { getFeynmanStats } = await import('@/lib/learning/feynman-engine');
        (getFeynmanStats as ReturnType<typeof vi.fn>).mockResolvedValue({
          totalCompleted: 5,
          totalAttempts: 10,
          averageScore: 85,
          topicsWithFeynman: 3,
        });

        const result = await executeCommand('/feynman', mockContext, 'status');

        expect(result.success).toBe(true);
        expect(result.message).toContain('Feynman Stats');
        expect(result.message).toContain('5');
        expect(result.message).toContain('85');
      });

      it('should require topic for new exercise', async () => {
        const { getActiveFeynmanExercise } = await import('@/lib/learning/feynman-engine');
        (getActiveFeynmanExercise as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const result = await executeCommand('/feynman', { userId: 'user-123' });

        expect(result.success).toBe(false);
        expect(result.message).toContain('need to be learning a topic');
      });

      it('should show active exercise if one exists', async () => {
        const { getActiveFeynmanExercise, getFeynmanPrompt } = await import('@/lib/learning/feynman-engine');
        (getActiveFeynmanExercise as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: 'ex-1',
          conceptName: 'Ownership',
          targetAudience: 'child',
          status: 'IN_PROGRESS',
          attempts: 1,
        });

        const result = await executeCommand('/feynman', mockContext);

        expect(result.success).toBe(true);
        expect(result.message).toContain('Feynman Exercise in Progress');
        expect(result.message).toContain('Ownership');
      });

      it('should require sufficient mastery for new exercise', async () => {
        const { getActiveFeynmanExercise, shouldTriggerFeynman } = await import('@/lib/learning/feynman-engine');
        const { getTopicById } = await import('@/lib/db/topics');

        (getActiveFeynmanExercise as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        (getTopicById as ReturnType<typeof vi.fn>).mockResolvedValue({
          id: 'topic-123',
          name: 'Rust',
          masteryPercentage: 50, // Below threshold
        });
        (shouldTriggerFeynman as ReturnType<typeof vi.fn>).mockResolvedValue({
          should: false,
        });

        const result = await executeCommand('/feynman', mockContext);

        expect(result.success).toBe(false);
        expect(result.message).toContain('Not Ready Yet');
        expect(result.message).toContain('80%');
      });
    });

    describe('/analytics command', () => {
      it('should show weekly analytics by default', async () => {
        const { getLearningAnalytics } = await import('@/lib/learning/analytics-engine');
        (getLearningAnalytics as ReturnType<typeof vi.fn>).mockResolvedValue({
          totalStudyTime: 120,
          sessionsCount: 10,
          questionsAnswered: 50,
          questionsCorrect: 40,
          accuracy: 80,
          topicsMastered: 2,
          conceptsLearned: 15,
          reviewsCompleted: 20,
          feynmanExercisesCompleted: 1,
          xpEarned: 500,
          currentStreak: 5,
          longestStreak: 10,
          badgesEarned: ['First Steps'],
        });

        const result = await executeCommand('/analytics', mockContext);

        expect(result.success).toBe(true);
        expect(result.message).toContain('Learning Analytics');
        expect(result.message).toContain('Weekly');
        expect(result.message).toContain('120 minutes');
        expect(result.message).toContain('80%');
      });

      it('should show daily analytics when specified', async () => {
        const { getLearningAnalytics } = await import('@/lib/learning/analytics-engine');
        (getLearningAnalytics as ReturnType<typeof vi.fn>).mockResolvedValue({
          totalStudyTime: 30,
          sessionsCount: 2,
          questionsAnswered: 10,
          questionsCorrect: 8,
          accuracy: 80,
          topicsMastered: 0,
          conceptsLearned: 3,
          reviewsCompleted: 5,
          feynmanExercisesCompleted: 0,
          xpEarned: 100,
          currentStreak: 5,
          longestStreak: 10,
          badgesEarned: [],
        });

        const result = await executeCommand('/analytics', mockContext, 'daily');

        expect(result.success).toBe(true);
        expect(result.message).toContain('Daily');
        expect(result.message).toContain('30 minutes');
      });

      it('should handle errors gracefully', async () => {
        const { getLearningAnalytics } = await import('@/lib/learning/analytics-engine');
        (getLearningAnalytics as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Database error'));

        const result = await executeCommand('/analytics', mockContext);

        expect(result.success).toBe(false);
        expect(result.message).toContain('Unable to fetch analytics');
      });
    });

    describe('/gaps command', () => {
      it('should require topic to analyze gaps', async () => {
        const result = await executeCommand('/gaps', { userId: 'user-123' });

        expect(result.success).toBe(false);
        expect(result.message).toContain('need to be learning a topic');
      });

      it('should show no gaps message when none found', async () => {
        const { analyzeKnowledgeGaps } = await import('@/lib/learning/gap-detector');
        (analyzeKnowledgeGaps as ReturnType<typeof vi.fn>).mockResolvedValue({
          gaps: [],
          recommendedActions: [],
          overallStrength: 90,
          criticalGapsCount: 0,
        });

        const result = await executeCommand('/gaps', mockContext);

        expect(result.success).toBe(true);
        expect(result.message).toContain('No significant knowledge gaps');
        expect(result.message).toContain('90%');
      });

      it('should show gaps by severity', async () => {
        const { analyzeKnowledgeGaps } = await import('@/lib/learning/gap-detector');
        (analyzeKnowledgeGaps as ReturnType<typeof vi.fn>).mockResolvedValue({
          gaps: [
            { concept: 'Ownership', severity: 'critical', evidence: 'Low accuracy', relatedMisconceptions: ['Confused with references'] },
            { concept: 'Borrowing', severity: 'moderate', evidence: 'Needs practice', relatedMisconceptions: [] },
            { concept: 'Lifetimes', severity: 'minor', evidence: 'Minor confusion', relatedMisconceptions: [] },
          ],
          recommendedActions: [
            { type: 'reteach', priority: 'high', targetConceptName: 'Ownership', reason: 'Critical gap', estimatedTime: 15 },
          ],
          overallStrength: 60,
          criticalGapsCount: 1,
        });

        const result = await executeCommand('/gaps', mockContext);

        expect(result.success).toBe(true);
        expect(result.message).toContain('Knowledge Gap Analysis');
        expect(result.message).toContain('60%');
        expect(result.message).toContain('Critical Gaps');
        expect(result.message).toContain('Ownership');
        expect(result.message).toContain('Moderate Gaps');
        expect(result.message).toContain('Recommendations');
      });

      it('should handle analysis errors gracefully', async () => {
        const { analyzeKnowledgeGaps } = await import('@/lib/learning/gap-detector');
        (analyzeKnowledgeGaps as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Analysis failed'));

        const result = await executeCommand('/gaps', mockContext);

        expect(result.success).toBe(false);
        expect(result.message).toContain('Unable to analyze');
      });
    });
  });
});
