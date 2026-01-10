/**
 * Integration Tests for Sensie Agent
 *
 * These tests make REAL LLM calls to verify the agent works correctly.
 * Run with: pnpm test:integration
 *
 * Prerequisites:
 * - AI_GATEWAY_API_KEY or ANTHROPIC_API_KEY must be set
 * - Database must be running with seed data (or mock db)
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import {
  sensieAgent,
  evaluateAnswer,
  generateQuestion,
  generateQuiz,
  generateHints,
  generateEncouragement,
  isGibberishAnswer,
  validateQuestion,
  selectBestQuestion,
} from '@/lib/mastra/agents/sensie';
import type { SocraticContext, SocraticQuestion, Concept } from '@/lib/types';

// Mock Prisma for integration tests (we test LLM, not DB)
vi.mock('@/lib/db/client', () => ({
  prisma: {
    concept: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'test-concept-1',
        name: 'JavaScript Closures',
        explanation: 'A closure is a function that has access to variables from its outer (enclosing) scope, even after the outer function has returned. This happens because the inner function maintains a reference to its lexical environment.',
        subtopic: {
          id: 'subtopic-1',
          name: 'Functions',
          topic: {
            id: 'topic-1',
            name: 'JavaScript',
          },
        },
      }),
      findMany: vi.fn().mockResolvedValue([
        { name: 'JavaScript Closures' },
        { name: 'Prototypes' },
        { name: 'Event Loop' },
      ]),
    },
    topic: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'topic-1',
        name: 'JavaScript',
        subtopics: [
          {
            id: 'subtopic-1',
            name: 'Functions',
            isLocked: false,
            concepts: [
              { id: 'concept-1', name: 'Closures', isMastered: false },
              { id: 'concept-2', name: 'Higher-Order Functions', isMastered: false },
            ],
          },
        ],
      }),
    },
    answer: {
      count: vi.fn().mockResolvedValue(0),
    },
  },
}));

// Skip if no API key is available
const hasApiKey = Boolean(process.env.AI_GATEWAY_API_KEY || process.env.ANTHROPIC_API_KEY);

describe.skipIf(!hasApiKey)('Sensie Agent Integration Tests', () => {
  // Increase timeout for LLM calls
  const TEST_TIMEOUT = 60000; // 60 seconds

  describe('sensieAgent.generate', () => {
    it('should generate a response with structured output', async () => {
      const result = await sensieAgent.generate(
        'Generate a brief encouraging message for a student learning programming.',
        {
          output: {
            type: 'object',
            properties: {
              message: { type: 'string', description: 'The encouraging message' },
            },
            required: ['message'],
          },
        }
      );

      expect(result.object).toBeDefined();
      expect(result.object.message).toBeDefined();
      expect(typeof result.object.message).toBe('string');
      expect(result.object.message.length).toBeGreaterThan(10);
    }, TEST_TIMEOUT);

    it('should respond in Master Roshi voice', async () => {
      const result = await sensieAgent.generate(
        'Say hello to a new student in your Master Roshi teaching style. Keep it brief.',
      );

      expect(result.text).toBeDefined();
      expect(result.text.length).toBeGreaterThan(20);
      // Should have some personality (not just generic)
      const text = result.text.toLowerCase();
      const hasPersonality =
        text.includes('hoho') ||
        text.includes('training') ||
        text.includes('young') ||
        text.includes('master') ||
        text.includes('learn') ||
        text.includes('teach');
      expect(hasPersonality).toBe(true);
    }, TEST_TIMEOUT);
  });

  describe('generateQuestion', () => {
    it('should generate a valid Socratic question', async () => {
      const context: SocraticContext = {
        conceptId: 'test-concept-1',
        topicName: 'JavaScript',
        subtopicName: 'Functions',
        conceptName: 'Closures',
        userLevel: 5,
        hintsUsed: 0,
        previousAnswers: [],
      };

      const question = await generateQuestion(context);

      expect(question).toBeDefined();
      expect(question.text).toBeDefined();
      expect(question.text.length).toBeGreaterThan(10);
      expect(question.text).toContain('?');
      expect(question.type).toMatch(/^(RECALL|UNDERSTANDING|APPLICATION|ANALYSIS|SYNTHESIS)$/);
      expect(question.difficulty).toBeGreaterThanOrEqual(1);
      expect(question.difficulty).toBeLessThanOrEqual(5);
      expect(Array.isArray(question.expectedElements)).toBe(true);
      expect(Array.isArray(question.hints)).toBe(true);
    }, TEST_TIMEOUT);

    it('should adjust difficulty based on previous answers', async () => {
      const contextStruggling: SocraticContext = {
        conceptId: 'test-concept-1',
        topicName: 'JavaScript',
        subtopicName: 'Functions',
        conceptName: 'Closures',
        userLevel: 3,
        hintsUsed: 2,
        previousAnswers: [
          { text: 'wrong', isCorrect: false, depth: 'NONE' },
          { text: 'wrong', isCorrect: false, depth: 'NONE' },
          { text: 'wrong', isCorrect: false, depth: 'NONE' },
        ],
      };

      const question = await generateQuestion(contextStruggling);

      // Should generate easier question for struggling student
      expect(question.difficulty).toBeLessThanOrEqual(3);
    }, TEST_TIMEOUT);
  });

  describe('evaluateAnswer', () => {
    const mockQuestion: SocraticQuestion = {
      text: 'What is a closure in JavaScript and why is it useful?',
      type: 'UNDERSTANDING',
      difficulty: 3,
      expectedElements: [
        'function has access to outer scope',
        'persists after outer function returns',
        'data privacy or encapsulation',
      ],
      hints: ['Think about what happens to variables when a function returns'],
      followUpPrompts: [],
    };

    const mockContext: SocraticContext = {
      conceptId: 'test-concept-1',
      topicName: 'JavaScript',
      subtopicName: 'Functions',
      conceptName: 'Closures',
      userLevel: 5,
      hintsUsed: 0,
      previousAnswers: [],
    };

    it('should evaluate a correct answer as correct', async () => {
      const correctAnswer = `A closure is when a function can access variables from its outer scope even after that outer function has finished executing.
      This happens because JavaScript functions maintain a reference to their lexical environment.
      Closures are useful for data privacy - you can create private variables that are only accessible through the returned function.`;

      const result = await evaluateAnswer(correctAnswer, mockQuestion, mockContext);

      expect(result).toBeDefined();
      expect(result.evaluation).toBeDefined();
      expect(result.evaluation.isCorrect).toBe(true);
      expect(result.feedback).toBeDefined();
      expect(result.feedback.length).toBeGreaterThan(10);
      expect(['next_concept', 'follow_up']).toContain(result.nextAction);
    }, TEST_TIMEOUT);

    it('should evaluate an incorrect answer as incorrect', async () => {
      const incorrectAnswer = 'A closure is just a function that runs code.';

      const result = await evaluateAnswer(incorrectAnswer, mockQuestion, mockContext);

      expect(result).toBeDefined();
      expect(result.evaluation.isCorrect).toBe(false);
      expect(result.feedback.length).toBeGreaterThan(10);
      expect(result.nextAction).toBe('guide');
      // Should provide guidance for improvement
      if (result.guidingQuestion) {
        expect(result.guidingQuestion.text).toContain('?');
      }
    }, TEST_TIMEOUT);

    it('should identify shallow answers', async () => {
      const shallowAnswer = 'A closure lets a function access variables from outside.';

      const result = await evaluateAnswer(shallowAnswer, mockQuestion, mockContext);

      expect(result).toBeDefined();
      expect(result.evaluation.depth).toMatch(/^(SHALLOW|NONE)$/);
      // Missing elements should include deeper concepts
      expect(result.evaluation.missingElements.length).toBeGreaterThan(0);
    }, TEST_TIMEOUT);
  });

  describe('generateQuiz', () => {
    it('should generate a valid quiz with questions', async () => {
      const quiz = await generateQuiz('topic-1', {
        questionCount: 3,
        difficulty: 3,
      });

      expect(quiz).toBeDefined();
      expect(quiz.title).toBeDefined();
      expect(quiz.description).toBeDefined();
      expect(Array.isArray(quiz.questions)).toBe(true);
      expect(quiz.questions.length).toBeGreaterThan(0);
      expect(quiz.totalPoints).toBeGreaterThan(0);
      expect(quiz.passingScore).toBeGreaterThan(0);

      // Validate each question
      quiz.questions.forEach(q => {
        expect(q.question).toBeDefined();
        expect(q.question.length).toBeGreaterThan(10);
        expect(q.type).toMatch(/^(UNDERSTANDING|APPLICATION|ANALYSIS)$/);
        expect(q.difficulty).toBeGreaterThanOrEqual(1);
        expect(q.difficulty).toBeLessThanOrEqual(5);
        expect(q.expectedAnswer).toBeDefined();
        expect(Array.isArray(q.scoringCriteria)).toBe(true);
      });
    }, TEST_TIMEOUT);
  });

  describe('generateHints', () => {
    const mockQuestion: SocraticQuestion = {
      text: 'What happens to variables in a closure?',
      type: 'UNDERSTANDING',
      difficulty: 3,
      expectedElements: ['persist', 'reference'],
      hints: [], // Empty to force generation
      followUpPrompts: [],
    };

    const mockConcept: Concept = {
      id: 'concept-1',
      name: 'JavaScript Closures',
      explanation: 'A closure is a function that has access to variables from its outer scope.',
      examples: [],
      subtopicId: 'subtopic-1',
      mastery: 0,
      isMastered: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should generate 3 progressive hints', async () => {
      const hints = await generateHints(mockQuestion, mockConcept);

      expect(Array.isArray(hints)).toBe(true);
      expect(hints.length).toBe(3);
      hints.forEach(hint => {
        expect(typeof hint).toBe('string');
        expect(hint.length).toBeGreaterThan(10);
      });
    }, TEST_TIMEOUT);
  });

  describe('generateEncouragement', () => {
    it('should generate encouragement for correct answers', async () => {
      const message = await generateEncouragement('correct');

      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(5);
    }, TEST_TIMEOUT);

    it('should generate encouragement for struggling students', async () => {
      const message = await generateEncouragement('struggle');

      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(5);
    }, TEST_TIMEOUT);
  });
});

// Unit tests for utility functions (no LLM calls needed)
describe('Sensie Agent Utility Functions', () => {
  describe('isGibberishAnswer', () => {
    it('should detect short answers as gibberish', () => {
      expect(isGibberishAnswer('hi')).toBe(true);
      expect(isGibberishAnswer('a')).toBe(true);
      expect(isGibberishAnswer('abc')).toBe(true);
    });

    it('should detect keyboard mashing', () => {
      expect(isGibberishAnswer('asdf')).toBe(true);
      expect(isGibberishAnswer('qwerty')).toBe(true);
      expect(isGibberishAnswer('aaaaa')).toBe(true);
    });

    it('should detect non-answers', () => {
      expect(isGibberishAnswer('idk')).toBe(true);
      expect(isGibberishAnswer('dunno')).toBe(true);
      expect(isGibberishAnswer('test')).toBe(true);
    });

    it('should accept valid answers', () => {
      expect(isGibberishAnswer('A closure is a function')).toBe(false);
      expect(isGibberishAnswer('Variables are stored in memory')).toBe(false);
      expect(isGibberishAnswer('The function returns a value')).toBe(false);
    });
  });

  describe('validateQuestion', () => {
    it('should validate a well-formed question', () => {
      const question: SocraticQuestion = {
        text: 'What is the purpose of closures in JavaScript?',
        type: 'UNDERSTANDING',
        difficulty: 3,
        expectedElements: ['data privacy', 'state preservation'],
        hints: ['Think about private variables'],
        followUpPrompts: [],
      };

      const result = validateQuestion(question);

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should reject question without question mark', () => {
      const question: SocraticQuestion = {
        text: 'Explain what closures are',
        type: 'UNDERSTANDING',
        difficulty: 3,
        expectedElements: ['closure definition'],
        hints: ['Think about scope'],
        followUpPrompts: [],
      };

      const result = validateQuestion(question);

      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Question should end with a question mark');
    });

    it('should reject question with invalid difficulty', () => {
      const question: SocraticQuestion = {
        text: 'What is a closure?',
        type: 'UNDERSTANDING',
        difficulty: 10, // Invalid
        expectedElements: ['closure'],
        hints: ['hint'],
        followUpPrompts: [],
      };

      const result = validateQuestion(question);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.includes('Difficulty'))).toBe(true);
    });

    it('should reject question without expected elements', () => {
      const question: SocraticQuestion = {
        text: 'What is a closure?',
        type: 'UNDERSTANDING',
        difficulty: 3,
        expectedElements: [],
        hints: ['hint'],
        followUpPrompts: [],
      };

      const result = validateQuestion(question);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.includes('expected element'))).toBe(true);
    });
  });

  describe('selectBestQuestion', () => {
    const questions: SocraticQuestion[] = [
      { text: 'Easy question?', type: 'RECALL', difficulty: 1, expectedElements: [], hints: [], followUpPrompts: [] },
      { text: 'Medium question?', type: 'UNDERSTANDING', difficulty: 3, expectedElements: [], hints: [], followUpPrompts: [] },
      { text: 'Hard question?', type: 'ANALYSIS', difficulty: 5, expectedElements: [], hints: [], followUpPrompts: [] },
    ];

    it('should select harder question for high performers', () => {
      // For high performers (accuracy >= 0.8, hintsUsed < 1), target difficulty is 4
      // Both 3 and 5 are equidistant from 4, so either is acceptable
      const question = selectBestQuestion(questions, { accuracy: 0.9, hintsUsed: 0 });

      expect(question.difficulty).toBeGreaterThanOrEqual(3);
    });

    it('should select medium question for average performers', () => {
      const question = selectBestQuestion(questions, { accuracy: 0.65, hintsUsed: 1 });

      expect(question.difficulty).toBe(3);
    });

    it('should select easier question for struggling performers', () => {
      const question = selectBestQuestion(questions, { accuracy: 0.3, hintsUsed: 2 });

      expect(question.difficulty).toBe(1);
    });

    it('should throw for empty questions array', () => {
      expect(() => selectBestQuestion([], { accuracy: 0.5, hintsUsed: 0 })).toThrow();
    });
  });
});
