import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sensieAgent,
  teachConcept,
  askSocraticQuestion,
  evaluateAnswer,
  suggestNextConcept,
  generateEncouragement,
  handleCommand,
  generateBreakMessage,
  generateProgressReport,
  isGibberishAnswer,
  generateQuestion,
  validateQuestion,
  selectBestQuestion,
} from '@/lib/mastra';
import type { SocraticContext, SocraticQuestion } from '@/lib/types';

// Mock Prisma client
vi.mock('@/lib/db/client', () => ({
  prisma: {
    concept: {
      findUnique: vi.fn(),
    },
    topic: {
      findUnique: vi.fn(),
    },
    answer: {
      count: vi.fn(),
    },
    userProgress: {
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
        introduction: 'Welcome to learning!',
        contextSetting: 'Let us explore this concept.',
        text: 'What do you understand about this concept?',
        type: 'UNDERSTANDING',
        difficulty: 2,
        expectedElements: ['key point 1', 'key point 2'],
        hints: ['Think about...', 'Consider...', 'Remember...'],
        followUpPrompts: ['Why is this important?'],
        isCorrect: true,
        depth: 'DEEP',
        feedback: 'Well done, young one!',
        missingElements: [],
        message: 'Keep training!',
        overview: 'Good progress!',
        strengths: ['Understanding'],
        areasToImprove: ['Practice more'],
        recommendation: 'Continue learning',
        motivation: 'You can do it!',
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

describe('sensie-agent', () => {
  const mockContext: SocraticContext = {
    topicId: 'topic-123',
    subtopicId: 'subtopic-123',
    conceptId: 'concept-123',
    userLevel: 3,
    previousAnswers: [],
    hintsUsed: 0,
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

  describe('sensieAgent', () => {
    it('should be defined with correct name', () => {
      expect(sensieAgent).toBeDefined();
      expect(sensieAgent.name).toBe('sensie');
    });
  });

  describe('isGibberishAnswer', () => {
    it('should detect gibberish answers', () => {
      expect(isGibberishAnswer('abc')).toBe(true);
      expect(isGibberishAnswer('asdf')).toBe(true);
      expect(isGibberishAnswer('12345')).toBe(true);
      expect(isGibberishAnswer('idk')).toBe(true);
    });

    it('should accept valid answers', () => {
      expect(isGibberishAnswer('The value moves to the new variable')).toBe(false);
      expect(isGibberishAnswer('Ownership is transferred and the original becomes invalid')).toBe(false);
    });

    it('should reject answers with too few words', () => {
      expect(isGibberishAnswer('yes')).toBe(true);
      expect(isGibberishAnswer('no')).toBe(true);
    });
  });

  describe('handleCommand', () => {
    it('should handle /hint command', async () => {
      const result = await handleCommand('/hint', mockContext);
      expect(result).toContain('Hint');
      expect(result).toContain('1/3');
    });

    it('should handle /hint when hints exhausted', async () => {
      const exhaustedContext = { ...mockContext, hintsUsed: 3 };
      const result = await handleCommand('/hint', exhaustedContext);
      expect(result).toContain('all your hints');
    });

    it('should handle /skip command', async () => {
      const result = await handleCommand('/skip', mockContext);
      expect(result).toContain('Skipping');
    });

    it('should handle /progress command', async () => {
      const result = await handleCommand('/progress', mockContext);
      expect(result).toContain('progress');
    });

    it('should handle /review command', async () => {
      const result = await handleCommand('/review', mockContext);
      expect(result).toContain('review');
    });

    it('should handle /quiz command', async () => {
      const result = await handleCommand('/quiz', mockContext);
      expect(result).toContain('quiz');
    });

    it('should handle unknown command', async () => {
      const result = await handleCommand('/unknown', mockContext);
      expect(result).toContain('Try');
    });
  });

  describe('generateBreakMessage', () => {
    it('should generate break message with session stats', async () => {
      const result = await generateBreakMessage(30, 10);
      expect(result).toContain('10 questions');
      expect(result).toContain('30 minutes');
    });

    it('should generate break message for short sessions', async () => {
      const result = await generateBreakMessage(5, 2);
      expect(result).toContain('2 questions');
      expect(result).toContain('5 minutes');
    });
  });

  describe('generateEncouragement', () => {
    it('should generate encouragement for correct answer', async () => {
      const result = await generateEncouragement('correct');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should generate encouragement for struggling student', async () => {
      const result = await generateEncouragement('struggle');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should generate progress celebration', async () => {
      const result = await generateEncouragement('progress');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
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
      expect(result.difficulty).toBe(2); // Struggling student gets easier questions
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
      expect(() => selectBestQuestion([], { accuracy: 0.5, hintsUsed: 0 })).toThrow('No questions provided');
    });

    it('should return single question when only one available', () => {
      const result = selectBestQuestion([mockQuestion], { accuracy: 0.5, hintsUsed: 0 });
      expect(result).toEqual(mockQuestion);
    });
  });
});
