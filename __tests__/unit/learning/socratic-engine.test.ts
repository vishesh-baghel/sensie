import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateQuestion,
  evaluateAnswer,
  generateGuidingQuestion,
  provideHint,
  isGibberishAnswer,
  detectKnowledgeGaps,
  generateFollowUpQuestion,
  shouldProceedToNextConcept,
} from '@/lib/learning/socratic-engine';
import type { SocraticContext, SocraticQuestion } from '@/lib/types';

// Mock Prisma client
vi.mock('@/lib/db/client', () => ({
  prisma: {
    concept: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock AI SDK
vi.mock('ai', () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: {
      text: 'What happens when you transfer ownership in Rust?',
      type: 'UNDERSTANDING',
      difficulty: 3,
      expectedElements: ['move semantics', 'original variable invalid'],
      hints: ['Think about the original variable...', 'Consider memory...', 'Key insight...'],
      followUpPrompts: ['Why does this matter?'],
      isCorrect: true,
      depth: 'DEEP',
      feedback: 'Excellent work!',
      missingElements: [],
      gaps: [],
    },
  }),
}));

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn().mockReturnValue('mock-model'),
}));

describe('socratic-engine', () => {
  const mockContext: SocraticContext = {
    topicId: 'topic-123',
    subtopicId: 'subtopic-123',
    conceptId: 'concept-123',
    userLevel: 3,
    previousAnswers: [],
    hintsUsed: 0,
  };

  const mockQuestion: SocraticQuestion = {
    text: 'What happens when you transfer ownership of a value in Rust?',
    type: 'UNDERSTANDING',
    difficulty: 3,
    expectedElements: ['move', 'original variable invalid', 'memory safety'],
    hints: [
      'Think about what happens to the original variable...',
      'Consider the concept of "moving" data...',
      'The key insight is about memory safety and single ownership.',
    ],
    followUpPrompts: [
      'Can you explain why this matters for memory safety?',
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateQuestion', () => {
    it('should generate a question with all expected elements', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.concept.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'concept-123',
        name: 'Ownership',
        explanation: 'Ownership is Rust\'s memory management system',
        subtopic: {
          name: 'Memory Management',
          topic: {
            name: 'Rust Programming',
          },
        },
      });

      const result = await generateQuestion(mockContext);

      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('difficulty');
      expect(result).toHaveProperty('expectedElements');
      expect(result).toHaveProperty('hints');
    });

    it('should throw error for non-existent concept', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.concept.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(generateQuestion(mockContext)).rejects.toThrow('Concept not found');
    });
  });

  describe('evaluateAnswer', () => {
    it('should evaluate an answer and return evaluation result', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.concept.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'concept-123',
        name: 'Ownership',
        explanation: 'Ownership concept',
      });

      const correctAnswer =
        'When ownership is transferred, the original variable becomes invalid and cannot be used. This is called a move and ensures memory safety by preventing double-free errors.';

      const result = await evaluateAnswer(correctAnswer, mockQuestion, mockContext);

      expect(result).toHaveProperty('isCorrect');
      expect(result).toHaveProperty('depth');
      expect(result).toHaveProperty('feedback');
      expect(result).toHaveProperty('missingElements');
    });

    it('should detect gibberish answers immediately', async () => {
      const result = await evaluateAnswer('asdf', mockQuestion, mockContext);

      expect(result.isCorrect).toBe(false);
      expect(result.depth).toBe('SHALLOW');
      expect(result.missingElements).toEqual(mockQuestion.expectedElements);
    });
  });

  describe('generateGuidingQuestion', () => {
    it('should generate a guiding question', async () => {
      const result = await generateGuidingQuestion(
        'The value is copied.',
        mockQuestion,
        'Understanding move semantics'
      );

      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('difficulty');
      // Guiding question should be easier
      expect(result.difficulty).toBeLessThanOrEqual(mockQuestion.difficulty);
    });
  });

  describe('provideHint', () => {
    it('should provide hint level 1', async () => {
      const result = await provideHint(mockQuestion, 1);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should provide hint level 2', async () => {
      const result = await provideHint(mockQuestion, 2);

      expect(typeof result).toBe('string');
    });

    it('should provide hint level 3', async () => {
      const result = await provideHint(mockQuestion, 3);

      expect(typeof result).toBe('string');
    });

    it('should clamp hint number to valid range', async () => {
      const result = await provideHint(mockQuestion, 10);

      // Should return the last hint (hint 3)
      expect(typeof result).toBe('string');
    });
  });

  describe('isGibberishAnswer', () => {
    it('should detect gibberish answer (repeated chars)', () => {
      expect(isGibberishAnswer('aaaaaa')).toBe(true);
    });

    it('should detect too-short answer', () => {
      expect(isGibberishAnswer('yes')).toBe(true);
    });

    it('should detect common throwaway answers', () => {
      expect(isGibberishAnswer('idk')).toBe(true);
      expect(isGibberishAnswer('dunno')).toBe(true);
      expect(isGibberishAnswer('test')).toBe(true);
    });

    it('should detect just numbers', () => {
      expect(isGibberishAnswer('12345')).toBe(true);
    });

    it('should accept valid answer', () => {
      expect(
        isGibberishAnswer('Ownership transfer means the value moves to a new owner.')
      ).toBe(false);
    });

    it('should require at least 2 meaningful words', () => {
      expect(isGibberishAnswer('just a')).toBe(true);
      expect(isGibberishAnswer('the value moves')).toBe(false);
    });
  });

  describe('detectKnowledgeGaps', () => {
    it('should return empty array when no incorrect answers', async () => {
      const result = await detectKnowledgeGaps([], 'Rust ownership');

      expect(result).toEqual([]);
    });

    it('should detect gaps from incorrect answers', async () => {
      const incorrectAnswers = [
        { question: mockQuestion, answer: 'The value is copied.' },
        { question: mockQuestion, answer: 'Both variables can use the value.' },
      ];

      const result = await detectKnowledgeGaps(incorrectAnswers, 'Rust ownership');

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('generateFollowUpQuestion', () => {
    it('should generate follow-up for shallow answer', async () => {
      const result = await generateFollowUpQuestion(
        'The value moves.',
        mockQuestion,
        ['memory safety', 'original variable invalid']
      );

      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('type');
      expect(result.difficulty).toBe(mockQuestion.difficulty); // Same difficulty
    });
  });

  describe('shouldProceedToNextConcept', () => {
    it('should proceed when 80%+ correct with 1 deep answer', () => {
      const result = shouldProceedToNextConcept(4, 5, 1);
      expect(result).toBe(true);
    });

    it('should proceed when 60%+ correct with 2 deep answers', () => {
      const result = shouldProceedToNextConcept(3, 5, 2);
      expect(result).toBe(true);
    });

    it('should not proceed when insufficient questions', () => {
      const result = shouldProceedToNextConcept(2, 2, 2);
      expect(result).toBe(false);
    });

    it('should not proceed when insufficient correct answers', () => {
      const result = shouldProceedToNextConcept(2, 5, 1);
      expect(result).toBe(false);
    });

    it('should require deep understanding for progress', () => {
      // 80%+ correct but no deep answers
      const result = shouldProceedToNextConcept(4, 5, 0);
      expect(result).toBe(false);
    });

    it('should not proceed when correct rate < 60%', () => {
      const result = shouldProceedToNextConcept(2, 5, 2);
      expect(result).toBe(false);
    });
  });
});
