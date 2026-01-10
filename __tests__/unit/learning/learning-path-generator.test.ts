import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generatePath,
  createTopicFromPath,
  identifyDomain,
  estimateLearningTime,
  validatePath,
  getPrerequisites,
  adjustPathForUser,
  generateSubtopics,
  PATH_CONSTRAINTS,
} from '@/lib/learning/learning-path-generator';
import type { LearningPath } from '@/lib/types';

// Mock Prisma client
vi.mock('@/lib/db/client', () => ({
  prisma: {
    topic: {
      create: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

// Mock sensieAgent - now used for LLM calls
vi.mock('@/lib/mastra/agents/sensie', () => ({
  sensieAgent: {
    generate: vi.fn().mockResolvedValue({
      text: 'Mock response',
      object: {
        domain: 'technical',
        subtopics: [
          { name: 'Fundamentals', order: 1, concepts: ['Concept 1', 'Concept 2', 'Concept 3'] },
          { name: 'Intermediate', order: 2, concepts: ['Concept 4', 'Concept 5'] },
          { name: 'Advanced', order: 3, concepts: ['Concept 6', 'Concept 7'] },
        ],
        prerequisites: ['Basic programming'],
        reasoning: 'These are needed...',
      },
    }),
  },
}));

describe('learning-path-generator', () => {
  const mockPath: LearningPath = {
    topicName: 'Rust Programming',
    domain: 'technical',
    estimatedHours: 5,
    subtopics: [
      {
        name: 'Ownership',
        description: 'Subtopic 1: Ownership',
        order: 1,
        concepts: [
          { name: 'Ownership Rules', keyPoints: [] },
          { name: 'Move Semantics', keyPoints: [] },
          { name: 'Borrowing', keyPoints: [] },
        ],
      },
      {
        name: 'Lifetimes',
        description: 'Subtopic 2: Lifetimes',
        order: 2,
        concepts: [
          { name: 'Lifetime Annotations', keyPoints: [] },
          { name: 'Lifetime Elision', keyPoints: [] },
        ],
      },
      {
        name: 'Traits',
        description: 'Subtopic 3: Traits',
        order: 3,
        concepts: [
          { name: 'Trait Definition', keyPoints: [] },
          { name: 'Trait Bounds', keyPoints: [] },
        ],
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generatePath', () => {
    it('should generate learning path for topic', async () => {
      const result = await generatePath('Rust Programming');

      expect(result).toHaveProperty('topicName');
      expect(result).toHaveProperty('domain');
      expect(result).toHaveProperty('subtopics');
      expect(result).toHaveProperty('estimatedHours');
    });

    it('should include user goal context', async () => {
      const result = await generatePath('Rust Programming', 'Build CLI tools');

      expect(result).toHaveProperty('topicName', 'Rust Programming');
    });
  });

  describe('createTopicFromPath', () => {
    it('should create topic and subtopics in database', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.topic.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'topic-123',
        name: 'Rust Programming',
        subtopics: [],
      });

      const result = await createTopicFromPath(mockPath, 'user-123');

      expect(result).toHaveProperty('id');
      expect(prisma.topic.create).toHaveBeenCalled();
    });

    it('should create topic with ACTIVE status by default', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.topic.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'topic-123',
        name: 'Rust Programming',
        status: 'ACTIVE',
        subtopics: [],
      });

      await createTopicFromPath(mockPath, 'user-123');

      expect(prisma.topic.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'ACTIVE',
          }),
        })
      );
    });

    it('should create topic with QUEUED status when shouldQueue is true', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.topic.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'topic-123',
        name: 'Rust Programming',
        status: 'QUEUED',
        subtopics: [],
      });

      await createTopicFromPath(mockPath, 'user-123', true);

      expect(prisma.topic.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'QUEUED',
            startedAt: null,
          }),
        })
      );
    });
  });

  describe('identifyDomain', () => {
    it('should identify domain for a topic', async () => {
      const result = await identifyDomain('Rust Programming');

      expect(['technical', 'soft-skills', 'career']).toContain(result);
    });
  });

  describe('estimateLearningTime', () => {
    it('should estimate hours based on path complexity', () => {
      const result = estimateLearningTime(mockPath);

      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);
    });

    it('should scale with number of concepts', () => {
      const smallPath: LearningPath = {
        ...mockPath,
        subtopics: [
          {
            name: 'Single Subtopic',
            description: 'Only one',
            order: 1,
            concepts: [{ name: 'One Concept', keyPoints: [] }],
          },
        ],
      };

      const smallTime = estimateLearningTime(smallPath);
      const fullTime = estimateLearningTime(mockPath);

      expect(fullTime).toBeGreaterThan(smallTime);
    });
  });

  describe('validatePath', () => {
    it('should validate correct path structure', () => {
      const result = validatePath(mockPath);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for too few subtopics', () => {
      const invalidPath: LearningPath = {
        ...mockPath,
        subtopics: [
          {
            name: 'Only One',
            description: 'Only subtopic',
            order: 1,
            concepts: [{ name: 'Concept 1', keyPoints: [] }],
          },
        ],
      };
      const result = validatePath(invalidPath);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should return errors for too few concepts in subtopic', () => {
      const invalidPath: LearningPath = {
        ...mockPath,
        subtopics: [
          {
            name: 'Subtopic 1',
            description: 'First',
            order: 1,
            concepts: [{ name: 'Only One', keyPoints: [] }], // Need at least 2
          },
          {
            name: 'Subtopic 2',
            description: 'Second',
            order: 2,
            concepts: [{ name: 'C1', keyPoints: [] }, { name: 'C2', keyPoints: [] }],
          },
          {
            name: 'Subtopic 3',
            description: 'Third',
            order: 3,
            concepts: [{ name: 'C3', keyPoints: [] }, { name: 'C4', keyPoints: [] }],
          },
        ],
      };
      const result = validatePath(invalidPath);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('too few concepts'))).toBe(true);
    });

    it('should detect duplicate subtopic names', () => {
      const invalidPath: LearningPath = {
        ...mockPath,
        subtopics: [
          {
            name: 'Ownership',
            description: 'First',
            order: 1,
            concepts: [{ name: 'C1', keyPoints: [] }, { name: 'C2', keyPoints: [] }],
          },
          {
            name: 'Ownership', // Duplicate!
            description: 'Second',
            order: 2,
            concepts: [{ name: 'C3', keyPoints: [] }, { name: 'C4', keyPoints: [] }],
          },
          {
            name: 'Traits',
            description: 'Third',
            order: 3,
            concepts: [{ name: 'C5', keyPoints: [] }, { name: 'C6', keyPoints: [] }],
          },
        ],
      };
      const result = validatePath(invalidPath);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Duplicate'))).toBe(true);
    });
  });

  describe('getPrerequisites', () => {
    it('should return prerequisites for topic', async () => {
      const result = await getPrerequisites('Advanced Rust');

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('adjustPathForUser', () => {
    it('should return path unchanged for new user', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.topic.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await adjustPathForUser(mockPath, 'user-123');

      expect(result).toEqual(mockPath);
    });

    it('should filter known concepts for experienced user', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.topic.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: 'completed-topic',
          status: 'COMPLETED',
          subtopics: [
            {
              concepts: [{ name: 'Ownership Rules' }],
            },
          ],
        },
      ]);

      const result = await adjustPathForUser(mockPath, 'user-123');

      // Should still have a valid path
      expect(result.subtopics.length).toBeGreaterThanOrEqual(PATH_CONSTRAINTS.MIN_SUBTOPICS);
    });
  });

  describe('generateSubtopics', () => {
    it('should generate subtopics with concepts', async () => {
      const result = await generateSubtopics('Rust Programming', 'technical');

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('order');
      expect(result[0]).toHaveProperty('concepts');
    });

    it('should include user goal when provided', async () => {
      const result = await generateSubtopics('Rust Programming', 'technical', 'Build CLI tools');

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('PATH_CONSTRAINTS', () => {
    it('should have correct constraint values', () => {
      expect(PATH_CONSTRAINTS.MIN_SUBTOPICS).toBe(3);
      expect(PATH_CONSTRAINTS.MAX_SUBTOPICS).toBe(12);
      expect(PATH_CONSTRAINTS.MIN_CONCEPTS_PER_SUBTOPIC).toBe(2);
      expect(PATH_CONSTRAINTS.MAX_CONCEPTS_PER_SUBTOPIC).toBe(8);
      expect(PATH_CONSTRAINTS.MIN_QUESTIONS_PER_CONCEPT).toBe(3);
      expect(PATH_CONSTRAINTS.MAX_QUESTIONS_PER_CONCEPT).toBe(10);
    });
  });
});
