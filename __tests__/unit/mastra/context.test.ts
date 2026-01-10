import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildSocraticContext,
  buildTeachingContext,
  buildEvaluationContext,
  buildQuizContext,
  getConversationContext,
  getPerformanceSummary,
  formatContextForPrompt,
  getConceptHistory,
  getRelatedConcepts,
  getStreakContext,
  getTopicCompletionContext,
} from '@/lib/mastra/context';
import type { SocraticContext } from '@/lib/types';

// Mock Prisma client
vi.mock('@/lib/db/client', () => ({
  prisma: {
    userProgress: {
      findUnique: vi.fn(),
    },
    answer: {
      findMany: vi.fn(),
    },
    learningSession: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    subtopic: {
      findUnique: vi.fn(),
    },
    concept: {
      findUnique: vi.fn(),
    },
    question: {
      findUnique: vi.fn(),
    },
    topic: {
      findUnique: vi.fn(),
    },
    message: {
      findMany: vi.fn(),
    },
  },
}));

describe('mastra context helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildSocraticContext', () => {
    it('should build context from database state', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.userProgress.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: 'user-123',
        currentLevel: 3,
      });
      (prisma.answer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.learningSession.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'session-123',
        hintsUsed: 1,
      });

      const result = await buildSocraticContext('user-123', 'topic-123', 'subtopic-123', 'concept-123');

      expect(result).toHaveProperty('topicId', 'topic-123');
      expect(result).toHaveProperty('subtopicId', 'subtopic-123');
      expect(result).toHaveProperty('conceptId', 'concept-123');
      expect(result).toHaveProperty('userLevel', 3);
      expect(result).toHaveProperty('hintsUsed', 1);
    });

    it('should handle missing user progress', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.userProgress.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.answer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.learningSession.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await buildSocraticContext('user-123', 'topic-123', 'subtopic-123', 'concept-123');

      expect(result.userLevel).toBe(1); // Default level
      expect(result.hintsUsed).toBe(0); // Default hints
    });
  });

  describe('buildTeachingContext', () => {
    it('should build full teaching context from session', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.learningSession.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'session-123',
        userId: 'user-123',
        topicId: 'topic-123',
        currentSubtopicId: 'subtopic-123',
        currentConceptId: 'concept-123',
        hintsUsed: 2,
        topic: { id: 'topic-123', name: 'Rust' },
      });
      (prisma.subtopic.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'subtopic-123',
        name: 'Ownership',
      });
      (prisma.concept.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'concept-123',
        name: 'Move Semantics',
      });
      (prisma.answer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.message.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.userProgress.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        currentLevel: 2,
      });

      const result = await buildTeachingContext('session-123');

      expect(result).toHaveProperty('topicId', 'topic-123');
      expect(result).toHaveProperty('subtopicId', 'subtopic-123');
      expect(result).toHaveProperty('conceptId', 'concept-123');
      expect(result).toHaveProperty('hintsUsed', 2);
    });

    it('should throw error for missing session', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.learningSession.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(buildTeachingContext('nonexistent')).rejects.toThrow('Session not found');
    });
  });

  describe('buildEvaluationContext', () => {
    it('should build context for answer evaluation', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.question.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'question-123',
        text: 'What is ownership?',
        expectedElements: ['move semantics'],
        difficulty: 3,
        concept: { name: 'Ownership' },
        answers: [],
      });

      const result = await buildEvaluationContext('question-123', 'User answer here');

      expect(result).toHaveProperty('question');
      expect(result.question.text).toBe('What is ownership?');
      expect(result).toHaveProperty('userAnswer', 'User answer here');
    });

    it('should throw error for missing question', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.question.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(buildEvaluationContext('nonexistent', 'answer')).rejects.toThrow('Question not found');
    });
  });

  describe('buildQuizContext', () => {
    it('should build quiz generation context', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.topic.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'topic-123',
        name: 'Rust',
        subtopics: [
          {
            name: 'Ownership',
            concepts: [{ name: 'Move' }, { name: 'Borrow' }],
          },
        ],
      });
      (prisma.userProgress.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        currentLevel: 2,
      });
      (prisma.answer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await buildQuizContext('topic-123', 'user-123');

      expect(result).toHaveProperty('topicName', 'Rust');
      expect(result.subtopicNames).toContain('Ownership');
      expect(result.conceptNames).toContain('Move');
    });

    it('should throw error for missing topic', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.topic.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(buildQuizContext('nonexistent', 'user-123')).rejects.toThrow('Topic not found');
    });
  });

  describe('getConversationContext', () => {
    it('should return recent messages', async () => {
      const { prisma } = await import('@/lib/db/client');
      const mockMessages = [
        { id: '1', content: 'Hello', createdAt: new Date('2024-01-01') },
        { id: '2', content: 'Hi', createdAt: new Date('2024-01-02') },
      ];
      (prisma.message.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockMessages);

      const result = await getConversationContext('session-123');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
    });

    it('should respect limit parameter', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.message.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await getConversationContext('session-123', 5);

      expect(prisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 })
      );
    });
  });

  describe('getPerformanceSummary', () => {
    it('should return performance metrics', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.answer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { isCorrect: true, hintsUsed: 0, question: { difficulty: 3 } },
        { isCorrect: true, hintsUsed: 1, question: { difficulty: 4 } },
        { isCorrect: false, hintsUsed: 2, question: { difficulty: 3 } },
      ]);

      const result = await getPerformanceSummary('user-123', 'topic-123');

      expect(result).toHaveProperty('totalQuestions', 3);
      expect(result).toHaveProperty('correctAnswers', 2);
      expect(result).toHaveProperty('hintsUsed', 3);
    });

    it('should handle no answers', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.answer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await getPerformanceSummary('user-123', 'topic-123');

      expect(result.totalQuestions).toBe(0);
      expect(result.correctAnswers).toBe(0);
      expect(result.recentAccuracy).toBe(0);
    });
  });

  describe('formatContextForPrompt', () => {
    it('should format context for LLM', () => {
      const context: SocraticContext = {
        topicId: 'topic-123',
        subtopicId: 'subtopic-123',
        conceptId: 'concept-123',
        userLevel: 3,
        previousAnswers: [],
        hintsUsed: 0,
      };

      const result = formatContextForPrompt(context);

      expect(typeof result).toBe('string');
      expect(result).toContain('Topic ID: topic-123');
      expect(result).toContain('User Level: 3');
    });

    it('should include recent answers in output', () => {
      const context: SocraticContext = {
        topicId: 'topic-123',
        subtopicId: 'subtopic-123',
        conceptId: 'concept-123',
        userLevel: 3,
        previousAnswers: [
          { id: '1', text: 'My answer', isCorrect: true, depth: 'DEEP', userId: 'u1', questionId: 'q1', sessionId: 's1', hintsUsed: 0, createdAt: new Date() },
        ],
        hintsUsed: 0,
      };

      const result = formatContextForPrompt(context);

      expect(result).toContain('Recent answers:');
      expect(result).toContain('✓');
    });
  });

  describe('getConceptHistory', () => {
    it('should return user history for concept', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.answer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { isCorrect: true, depth: 'DEEP', hintsUsed: 0, createdAt: new Date() },
        { isCorrect: true, depth: 'SHALLOW', hintsUsed: 1, createdAt: new Date() },
      ]);

      const result = await getConceptHistory('user-123', 'concept-123');

      expect(result).toHaveProperty('previousAttempts', 2);
      expect(result).toHaveProperty('bestDepth', 'DEEP');
    });

    it('should handle no history', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.answer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await getConceptHistory('user-123', 'concept-123');

      expect(result.previousAttempts).toBe(0);
      expect(result.bestDepth).toBeNull();
    });
  });

  describe('getRelatedConcepts', () => {
    it('should return related concepts', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.concept.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'concept-123',
        prerequisites: [{ id: 'prereq-1', name: 'Prerequisite' }],
        dependents: [],
        subtopic: {
          concepts: [
            { id: 'concept-123', name: 'Current' },
            { id: 'sibling-1', name: 'Sibling' },
          ],
        },
      });

      const result = await getRelatedConcepts('concept-123');

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return empty array for missing concept', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.concept.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await getRelatedConcepts('nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('getStreakContext', () => {
    it('should return streak information', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.userProgress.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        currentStreak: 5,
        longestStreak: 10,
        lastActivityDate: new Date(),
      });

      const result = await getStreakContext('user-123');

      expect(result).toHaveProperty('currentStreak', 5);
      expect(result).toHaveProperty('longestStreak', 10);
    });

    it('should handle missing user progress', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.userProgress.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await getStreakContext('user-123');

      expect(result.currentStreak).toBe(0);
      expect(result.longestStreak).toBe(0);
    });
  });

  describe('getTopicCompletionContext', () => {
    it('should return topic completion progress', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.topic.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'topic-123',
        name: 'Rust',
        masteryPercentage: 65,
        subtopics: [
          {
            masteryPercentage: 80,
            concepts: [
              { isMastered: true },
              { isMastered: true },
            ],
          },
          {
            masteryPercentage: 50,
            concepts: [
              { isMastered: false },
            ],
          },
        ],
      });

      const result = await getTopicCompletionContext('topic-123', 'user-123');

      expect(result).toHaveProperty('completedSubtopics', 1);
      expect(result).toHaveProperty('totalSubtopics', 2);
      expect(result).toHaveProperty('masteredConcepts', 2);
      expect(result).toHaveProperty('totalConcepts', 3);
      expect(result).toHaveProperty('overallMastery', 65);
    });

    it('should throw error for missing topic', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.topic.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(getTopicCompletionContext('nonexistent', 'user-123')).rejects.toThrow('Topic not found');
    });
  });
});
