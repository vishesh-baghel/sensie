/**
 * Feynman Engine Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
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

// Mock AI SDK
vi.mock('ai', () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: {
      clarity: 8,
      accuracy: 9,
      simplicity: 7,
      feedback: 'Good job explaining this concept!',
      unclearParts: [],
      probingQuestions: ['Can you give another example?'],
      suggestions: ['Add more context'],
      isApproved: true,
    },
  }),
}));

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn(() => 'mock-model'),
}));

import {
  shouldTriggerFeynman,
  startFeynmanExercise,
  evaluateFeynmanExplanation,
  getActiveFeynmanExercise,
  getFeynmanStats,
  getFeynmanPrompt,
  formatFeynmanFeedback,
  FEYNMAN_TRIGGER_MASTERY,
  FEYNMAN_XP_REWARD,
} from '@/lib/learning/feynman-engine';
import { prisma } from '@/lib/db/client';

describe('feynman-engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('shouldTriggerFeynman', () => {
    it('should return false if topic mastery is below threshold', async () => {
      (prisma.topic.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'topic-1',
        masteryPercentage: 50,
        subtopics: [],
      });

      const result = await shouldTriggerFeynman('user-1', 'topic-1');

      expect(result.should).toBe(false);
    });

    it('should return false if there is already an active exercise', async () => {
      (prisma.topic.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'topic-1',
        masteryPercentage: 85,
        subtopics: [
          {
            concepts: [{ id: 'concept-1', name: 'Test Concept' }],
          },
        ],
      });

      (prisma.feynmanExercise.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'exercise-1',
        status: 'IN_PROGRESS',
      });

      const result = await shouldTriggerFeynman('user-1', 'topic-1');

      expect(result.should).toBe(false);
    });

    it('should return true with concept when mastery is above threshold', async () => {
      (prisma.topic.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'topic-1',
        masteryPercentage: 85,
        subtopics: [
          {
            concepts: [{ id: 'concept-1', name: 'Ownership' }],
          },
        ],
      });

      (prisma.feynmanExercise.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.feynmanExercise.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await shouldTriggerFeynman('user-1', 'topic-1');

      expect(result.should).toBe(true);
      expect(result.conceptName).toBe('Ownership');
      expect(result.conceptId).toBe('concept-1');
    });
  });

  describe('startFeynmanExercise', () => {
    it('should create a new exercise', async () => {
      const mockExercise = {
        id: 'exercise-1',
        userId: 'user-1',
        topicId: 'topic-1',
        conceptName: 'Ownership',
        status: 'IN_PROGRESS',
        targetAudience: 'child',
        explanation: '',
        attempts: 0,
        createdAt: new Date(),
      };

      (prisma.feynmanExercise.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockExercise);

      const exercise = await startFeynmanExercise({
        userId: 'user-1',
        topicId: 'topic-1',
        conceptName: 'Ownership',
        targetAudience: 'child',
        previousAttempts: [],
      });

      expect(exercise.id).toBe('exercise-1');
      expect(exercise.status).toBe('IN_PROGRESS');
      expect(exercise.targetAudience).toBe('child');
    });
  });

  describe('evaluateFeynmanExplanation', () => {
    it('should return low score for too short explanation', async () => {
      const evaluation = await evaluateFeynmanExplanation('Hi', {
        userId: 'user-1',
        topicId: 'topic-1',
        conceptName: 'Ownership',
        targetAudience: 'child',
        previousAttempts: [],
      });

      expect(evaluation.isApproved).toBe(false);
      expect(evaluation.score).toBe(0);
      expect(evaluation.feedback).toContain('barely a sentence');
    });

    it('should use LLM for valid explanations', async () => {
      (prisma.concept.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'concept-1',
        name: 'Ownership',
        explanation: 'Ownership is when...',
      });

      const explanation = 'Ownership in Rust is like having a toy. Only one person can play with it at a time. When you give it to a friend, you cannot play with it anymore until they give it back.';

      const evaluation = await evaluateFeynmanExplanation(explanation, {
        userId: 'user-1',
        topicId: 'topic-1',
        conceptId: 'concept-1',
        conceptName: 'Ownership',
        targetAudience: 'child',
        previousAttempts: [],
      });

      expect(evaluation.isApproved).toBe(true);
      expect(evaluation.clarity).toBe(8);
      expect(evaluation.accuracy).toBe(9);
    });
  });

  describe('getActiveFeynmanExercise', () => {
    it('should return null if no active exercise', async () => {
      (prisma.feynmanExercise.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await getActiveFeynmanExercise('user-1');

      expect(result).toBeNull();
    });

    it('should return active exercise with topic filter', async () => {
      const mockExercise = {
        id: 'exercise-1',
        userId: 'user-1',
        topicId: 'topic-1',
        conceptName: 'Borrowing',
        status: 'IN_PROGRESS',
        targetAudience: 'beginner',
        explanation: '',
        attempts: 1,
        createdAt: new Date(),
      };

      (prisma.feynmanExercise.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockExercise);

      const result = await getActiveFeynmanExercise('user-1', 'topic-1');

      expect(result).not.toBeNull();
      expect(result?.conceptName).toBe('Borrowing');
    });
  });

  describe('getFeynmanStats', () => {
    it('should return correct stats', async () => {
      (prisma.feynmanExercise.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { status: 'COMPLETED', attempts: 2, topicId: 'topic-1', evaluation: { score: 90 } },
        { status: 'COMPLETED', attempts: 1, topicId: 'topic-1', evaluation: { score: 85 } },
        { status: 'IN_PROGRESS', attempts: 1, topicId: 'topic-2' },
      ]);

      const stats = await getFeynmanStats('user-1');

      expect(stats.totalCompleted).toBe(2);
      expect(stats.totalAttempts).toBe(4);
      expect(stats.averageScore).toBe(88); // (90+85)/2 = 87.5 rounded
      expect(stats.topicsWithFeynman).toBe(1);
    });

    it('should return zero stats for new user', async () => {
      (prisma.feynmanExercise.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const stats = await getFeynmanStats('user-1');

      expect(stats.totalCompleted).toBe(0);
      expect(stats.averageScore).toBe(0);
    });
  });

  describe('getFeynmanPrompt', () => {
    it('should generate prompt for child audience', () => {
      const prompt = getFeynmanPrompt('Ownership', 'child');

      expect(prompt).toContain('Ownership');
      expect(prompt).toContain('10-year-old');
      expect(prompt).toContain(String(FEYNMAN_TRIGGER_MASTERY));
    });

    it('should generate prompt for beginner audience', () => {
      const prompt = getFeynmanPrompt('Borrowing', 'beginner');

      expect(prompt).toContain('Borrowing');
      expect(prompt).toContain('just started learning programming');
    });

    it('should generate prompt for peer audience', () => {
      const prompt = getFeynmanPrompt('Lifetimes', 'peer');

      expect(prompt).toContain('Lifetimes');
      expect(prompt).toContain("fellow developer who hasn't");
    });
  });

  describe('formatFeynmanFeedback', () => {
    it('should format approved feedback with XP reward', () => {
      const feedback = formatFeynmanFeedback({
        score: 85,
        clarity: 8,
        accuracy: 9,
        simplicity: 8,
        feedback: 'Great work!',
        unclearParts: [],
        probingQuestions: [],
        suggestions: [],
        isApproved: true,
      });

      expect(feedback).toContain('Excellent work');
      expect(feedback).toContain('85/100');
      expect(feedback).toContain(String(FEYNMAN_XP_REWARD));
      expect(feedback).toContain('8/10');
    });

    it('should format rejected feedback with suggestions', () => {
      const feedback = formatFeynmanFeedback({
        score: 50,
        clarity: 5,
        accuracy: 6,
        simplicity: 4,
        feedback: 'Needs work',
        unclearParts: [
          { text: 'complex part', issue: 'too technical', suggestion: 'simplify' },
        ],
        probingQuestions: ['Can you explain differently?'],
        suggestions: ['Use simpler words'],
        isApproved: false,
      });

      expect(feedback).toContain('refine it further');
      expect(feedback).toContain('50/100');
      expect(feedback).toContain('complex part');
      expect(feedback).toContain('too technical');
      expect(feedback).toContain('Can you explain differently');
      expect(feedback).toContain('Use simpler words');
    });
  });

  describe('constants', () => {
    it('should have correct mastery threshold', () => {
      expect(FEYNMAN_TRIGGER_MASTERY).toBe(80);
    });

    it('should have correct XP reward', () => {
      expect(FEYNMAN_XP_REWARD).toBe(200);
    });
  });
});
