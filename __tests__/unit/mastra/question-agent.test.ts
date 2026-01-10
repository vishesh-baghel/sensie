import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateQuestions,
  generateFollowUp,
  generateQuiz,
  generateHints,
  generateGuidingQuestion,
  selectBestQuestion,
  validateQuestion,
} from '@/lib/mastra';
import type { Concept, SocraticQuestion } from '@/lib/types';

// Mock Prisma client
vi.mock('@/lib/db/client', () => ({
  prisma: {
    concept: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    topic: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock the Mastra core modules
vi.mock('@mastra/core/agent', () => ({
  Agent: vi.fn().mockImplementation(() => ({
    name: 'sensie',
    generate: vi.fn().mockResolvedValue({
      object: {
        questions: [
          {
            text: 'What do you understand about this concept?',
            type: 'UNDERSTANDING',
            difficulty: 3,
            expectedElements: ['key point 1', 'key point 2'],
            hints: ['Think about...', 'Consider...', 'Remember...'],
            followUpPrompts: ['Why is this important?'],
          },
        ],
        text: 'What do you think happens when you transfer ownership?',
        type: 'UNDERSTANDING',
        difficulty: 3,
        expectedElements: ['move semantics', 'original variable invalid'],
        hints: ['Think about the original variable', 'Consider memory', 'What happens?'],
        followUpPrompts: ['Can you explain further?'],
        title: 'Rust Ownership Quiz',
        description: 'Test your understanding of ownership',
        totalPoints: 50,
        passingScore: 35,
        timeLimit: 15,
      },
    }),
    __registerMastra: vi.fn(),
  })),
}));

vi.mock('@mastra/core/mastra', () => ({
  Mastra: vi.fn().mockImplementation(() => ({
    agents: {},
  })),
}));

describe('question-agent', () => {
  // Mock Concept matching Prisma schema
  const mockConcept: Concept = {
    id: 'concept-123',
    subtopicId: 'subtopic-123',
    name: 'Ownership in Rust',
    explanation: 'Ownership is Rust\'s memory management system...',
    codeExamples: ['let s1 = String::from("hello"); let s2 = s1;'],
    analogies: ['Like passing a physical book to someone'],
    isMastered: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    masteredAt: null,
  };

  const mockQuestion: SocraticQuestion = {
    text: 'What happens when you transfer ownership in Rust?',
    type: 'UNDERSTANDING',
    difficulty: 3,
    expectedElements: ['move', 'original variable invalid'],
    hints: ['Think about the original variable...'],
    followUpPrompts: ['Why does this matter?'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateQuestions', () => {
    it('should generate questions for concept', async () => {
      const result = await generateQuestions(mockConcept, { difficulty: 3 });
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('text');
      expect(result[0]).toHaveProperty('type');
      expect(result[0]).toHaveProperty('difficulty');
    });

    it('should respect difficulty level', async () => {
      const result = await generateQuestions(mockConcept, { difficulty: 5 });
      expect(Array.isArray(result)).toBe(true);
    });

    it('should filter by question type', async () => {
      const result = await generateQuestions(mockConcept, { difficulty: 3, type: 'APPLICATION' });
      expect(Array.isArray(result)).toBe(true);
    });

    it('should avoid specified elements', async () => {
      const result = await generateQuestions(mockConcept, {
        difficulty: 3,
        avoidElements: ['borrowing'],
      });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('generateFollowUp', () => {
    it('should generate follow-up for shallow answer', async () => {
      const result = await generateFollowUp(mockQuestion, 'It moves', ['memory safety']);
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('difficulty');
      expect(result).toHaveProperty('expectedElements');
    });

    it('should target specific missing elements', async () => {
      const result = await generateFollowUp(mockQuestion, 'It moves', ['original variable invalid']);
      expect(result).toHaveProperty('text');
    });
  });

  describe('generateQuiz', () => {
    it('should generate quiz with specified count', async () => {
      // Mock prisma to return a topic
      const { prisma } = await import('@/lib/db/client');
      (prisma.topic.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'topic-123',
        name: 'Rust Fundamentals',
        subtopics: [
          {
            id: 'subtopic-123',
            isLocked: false,
            concepts: [{ name: 'Ownership' }, { name: 'Borrowing' }],
          },
        ],
      });

      const result = await generateQuiz('topic-123', { questionCount: 5 });
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('questions');
      expect(result).toHaveProperty('totalPoints');
      expect(result).toHaveProperty('passingScore');
    });

    it('should throw error for non-existent topic', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.topic.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(generateQuiz('nonexistent', { questionCount: 5 })).rejects.toThrow(
        'Topic not found'
      );
    });
  });

  describe('generateHints', () => {
    it('should return existing hints if already 3', async () => {
      const questionWithHints: SocraticQuestion = {
        ...mockQuestion,
        hints: ['Hint 1', 'Hint 2', 'Hint 3'],
      };
      const result = await generateHints(questionWithHints, mockConcept);
      expect(result).toEqual(['Hint 1', 'Hint 2', 'Hint 3']);
    });

    it('should generate hints if fewer than 3', async () => {
      const questionWithFewHints: SocraticQuestion = {
        ...mockQuestion,
        hints: ['Hint 1'],
      };
      const result = await generateHints(questionWithFewHints, mockConcept);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('generateGuidingQuestion', () => {
    it('should generate guiding question for knowledge gap', async () => {
      const result = await generateGuidingQuestion(
        'It copies the value',
        mockQuestion,
        'Understanding move semantics'
      );
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('difficulty');
    });

    it('should reduce difficulty for guiding question', async () => {
      const result = await generateGuidingQuestion(
        'Wrong answer',
        { ...mockQuestion, difficulty: 4 },
        'Gap description'
      );
      expect(result.difficulty).toBeLessThanOrEqual(3);
    });
  });

  describe('selectBestQuestion', () => {
    it('should select appropriate question for high performance', () => {
      const questions = [
        { ...mockQuestion, difficulty: 2 },
        { ...mockQuestion, difficulty: 3 },
        { ...mockQuestion, difficulty: 4 },
      ];
      const result = selectBestQuestion(questions, { accuracy: 0.85, hintsUsed: 0 });
      expect(result.difficulty).toBe(4); // High performer gets harder questions
    });

    it('should select easier question for low accuracy', () => {
      const questions = [
        { ...mockQuestion, difficulty: 2 },
        { ...mockQuestion, difficulty: 3 },
        { ...mockQuestion, difficulty: 4 },
      ];
      const result = selectBestQuestion(questions, { accuracy: 0.3, hintsUsed: 5 });
      expect(result.difficulty).toBeLessThanOrEqual(2); // Struggling student gets easier questions
    });

    it('should select moderate difficulty for average performance', () => {
      const questions = [
        { ...mockQuestion, difficulty: 2 },
        { ...mockQuestion, difficulty: 3 },
        { ...mockQuestion, difficulty: 4 },
      ];
      const result = selectBestQuestion(questions, { accuracy: 0.65, hintsUsed: 1 });
      expect(result.difficulty).toBe(3);
    });

    it('should throw error for empty questions array', () => {
      expect(() => selectBestQuestion([], { accuracy: 0.5, hintsUsed: 0 })).toThrow(
        'No questions provided'
      );
    });

    it('should return single question when only one available', () => {
      const result = selectBestQuestion([mockQuestion], { accuracy: 0.5, hintsUsed: 0 });
      expect(result).toEqual(mockQuestion);
    });
  });

  describe('validateQuestion', () => {
    it('should validate well-formed question', () => {
      const result = validateQuestion(mockQuestion);
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should identify issues with empty text', () => {
      const badQuestion: SocraticQuestion = {
        ...mockQuestion,
        text: '',
      };
      const result = validateQuestion(badQuestion);
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Question text is too short or empty');
    });

    it('should identify missing question mark', () => {
      const badQuestion: SocraticQuestion = {
        ...mockQuestion,
        text: 'This is a statement without a question mark',
      };
      const result = validateQuestion(badQuestion);
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Question should end with a question mark');
    });

    it('should identify missing expected elements', () => {
      const badQuestion: SocraticQuestion = {
        ...mockQuestion,
        expectedElements: [],
      };
      const result = validateQuestion(badQuestion);
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Question should have at least 1 expected element');
    });

    it('should identify missing hints', () => {
      const badQuestion: SocraticQuestion = {
        ...mockQuestion,
        hints: [],
      };
      const result = validateQuestion(badQuestion);
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Question should have at least 1 hint');
    });

    it('should identify too many hints', () => {
      const badQuestion: SocraticQuestion = {
        ...mockQuestion,
        hints: ['hint1', 'hint2', 'hint3', 'hint4'],
      };
      const result = validateQuestion(badQuestion);
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Question should have at most 3 hints');
    });
  });
});
